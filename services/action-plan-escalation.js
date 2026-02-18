/**
 * Action Plan Escalation Service
 * Automatically escalates overdue action plans to Area Managers
 */

const sql = require('mssql');
const emailService = require('./email-service');

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

/**
 * Check for overdue action plans and create escalations
 */
async function checkOverdueActionPlans() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get escalation settings
        const settingsResult = await pool.request().query(`
            SELECT SettingKey, SettingValue 
            FROM OE_EscalationSettings 
            WHERE SettingKey IN ('AutoEscalationEnabled', 'EmailNotificationEnabled')
        `);
        
        const settings = {};
        settingsResult.recordset.forEach(s => {
            settings[s.SettingKey] = s.SettingValue;
        });
        
        // Check if auto-escalation is enabled
        if (settings.AutoEscalationEnabled !== 'true') {
            console.log('[Escalation Service] Auto-escalation is disabled');
            return { escalationsCreated: 0, disabled: true };
        }
        
        console.log('[Escalation Service] Checking for overdue action plans...');
        
        // Find overdue inspections (deadline passed, action plan not completed, not already escalated)
        const overdueResult = await pool.request().query(`
            SELECT 
                i.Id as InspectionId,
                i.DocumentNumber,
                i.StoreId,
                s.StoreName,
                i.InspectedBy,
                i.ActionPlanDeadline,
                DATEDIFF(day, i.ActionPlanDeadline, GETDATE()) as DaysOverdue
            FROM OE_Inspections i
            INNER JOIN Stores s ON i.StoreId = s.Id
            WHERE i.Status = 'Completed'
              AND i.ActionPlanDeadline IS NOT NULL
              AND i.ActionPlanDeadline < GETDATE()
              AND i.ActionPlanCompletedAt IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM OE_ActionPlanEscalations e 
                  WHERE e.InspectionId = i.Id AND e.Status = 'Pending'
              )
        `);
        
        console.log(`[Escalation Service] Found ${overdueResult.recordset.length} overdue action plans`);
        
        let escalationsCreated = 0;
        let notificationsSent = 0;
        
        for (const inspection of overdueResult.recordset) {
            try {
                // Find the Area Manager for this store
                const managerResult = await pool.request()
                    .input('storeId', sql.Int, inspection.StoreId)
                    .query(`
                        SELECT sr.AreaManagerId, u.DisplayName, u.Email
                        FROM OE_StoreResponsibles sr
                        INNER JOIN Users u ON sr.AreaManagerId = u.Id
                        WHERE sr.StoreId = @storeId AND sr.IsActive = 1
                    `);
                
                if (managerResult.recordset.length === 0) {
                    console.log(`[Escalation Service] No Area Manager assigned to store ${inspection.StoreName} (ID: ${inspection.StoreId})`);
                    continue;
                }
                
                const areaManager = managerResult.recordset[0];
                
                // Create escalation record
                await pool.request()
                    .input('inspectionId', sql.Int, inspection.InspectionId)
                    .input('storeId', sql.Int, inspection.StoreId)
                    .input('escalatedToUserId', sql.Int, areaManager.AreaManagerId)
                    .input('reason', sql.NVarChar, `Action plan deadline exceeded by ${inspection.DaysOverdue} day(s)`)
                    .query(`
                        INSERT INTO OE_ActionPlanEscalations 
                        (InspectionId, StoreId, EscalatedToUserId, EscalationLevel, Reason, Status, CreatedAt)
                        VALUES (@inspectionId, @storeId, @escalatedToUserId, 1, @reason, 'Pending', GETDATE())
                    `);
                
                escalationsCreated++;
                console.log(`[Escalation Service] Created escalation for inspection ${inspection.DocumentNumber} to ${areaManager.DisplayName}`);
                
                // Create in-app notification
                await pool.request()
                    .input('userId', sql.Int, areaManager.AreaManagerId)
                    .input('userEmail', sql.NVarChar, areaManager.Email)
                    .input('title', sql.NVarChar, '⚠️ Action Plan Overdue - Escalation')
                    .input('message', sql.NVarChar, `Action plan for inspection ${inspection.DocumentNumber} at ${inspection.StoreName} is ${inspection.DaysOverdue} day(s) overdue. Please follow up with the Store Manager.`)
                    .input('link', sql.NVarChar, `/oe-inspection/audit/${inspection.InspectionId}`)
                    .query(`
                        INSERT INTO Notifications (UserId, UserEmail, Title, Message, Link, Type, IsRead, CreatedAt)
                        VALUES (@userId, @userEmail, @title, @message, @link, 'escalation', 0, GETDATE())
                    `);
                
                // Send email if enabled
                if (settings.EmailNotificationEnabled === 'true' && areaManager.Email) {
                    try {
                        await sendEscalationEmail(areaManager, inspection);
                        notificationsSent++;
                    } catch (emailErr) {
                        console.error('[Escalation Service] Failed to send email:', emailErr.message);
                    }
                }
                
            } catch (err) {
                console.error(`[Escalation Service] Error processing inspection ${inspection.InspectionId}:`, err.message);
            }
        }
        
        console.log(`[Escalation Service] Created ${escalationsCreated} escalations, sent ${notificationsSent} emails`);
        
        return { escalationsCreated, notificationsSent };
        
    } catch (err) {
        console.error('[Escalation Service] Error:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Send reminder notifications before deadline
 */
async function sendDeadlineReminders() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get reminder days setting
        const settingsResult = await pool.request().query(`
            SELECT SettingValue FROM OE_EscalationSettings WHERE SettingKey = 'ReminderDays'
        `);
        
        if (settingsResult.recordset.length === 0) {
            return { reminders: 0 };
        }
        
        const reminderDays = settingsResult.recordset[0].SettingValue.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
        
        console.log(`[Escalation Service] Checking for deadline reminders (${reminderDays.join(', ')} days before)`);
        
        let remindersSent = 0;
        
        for (const daysBefore of reminderDays) {
            // Find inspections where deadline is X days away
            const inspectionsResult = await pool.request()
                .input('daysBefore', sql.Int, daysBefore)
                .query(`
                    SELECT 
                        i.Id as InspectionId,
                        i.DocumentNumber,
                        i.StoreId,
                        s.StoreName,
                        i.InspectedBy,
                        i.ActionPlanDeadline,
                        u.Id as StoreManagerId,
                        u.DisplayName as StoreManagerName,
                        u.Email as StoreManagerEmail
                    FROM OE_Inspections i
                    INNER JOIN Stores s ON i.StoreId = s.Id
                    LEFT JOIN Users u ON (u.StoreId = s.Id OR u.Email = i.InspectedBy) AND u.IsActive = 1
                    WHERE i.Status = 'Completed'
                      AND i.ActionPlanDeadline IS NOT NULL
                      AND i.ActionPlanCompletedAt IS NULL
                      AND DATEDIFF(day, GETDATE(), i.ActionPlanDeadline) = @daysBefore
                `);
            
            for (const inspection of inspectionsResult.recordset) {
                // Check if reminder already sent today for this inspection
                const existingReminder = await pool.request()
                    .input('inspectionId', sql.Int, inspection.InspectionId)
                    .input('today', sql.Date, new Date().toISOString().split('T')[0])
                    .query(`
                        SELECT Id FROM Notifications 
                        WHERE Type = 'action-plan-reminder'
                        AND Link LIKE '%${inspection.InspectionId}%'
                        AND CAST(CreatedAt AS DATE) = @today
                    `);
                
                if (existingReminder.recordset.length === 0 && inspection.StoreManagerId) {
                    await pool.request()
                        .input('userId', sql.Int, inspection.StoreManagerId)
                        .input('userEmail', sql.NVarChar, inspection.StoreManagerEmail)
                        .input('title', sql.NVarChar, `⏰ Action Plan Deadline in ${daysBefore} Day${daysBefore > 1 ? 's' : ''}`)
                        .input('message', sql.NVarChar, `The action plan for inspection ${inspection.DocumentNumber} at ${inspection.StoreName} is due in ${daysBefore} day${daysBefore > 1 ? 's' : ''}. Please complete it before the deadline.`)
                        .input('link', sql.NVarChar, `/oe-inspection/action-plan/${inspection.InspectionId}`)
                        .query(`
                            INSERT INTO Notifications (UserId, UserEmail, Title, Message, Link, Type, IsRead, CreatedAt)
                            VALUES (@userId, @userEmail, @title, @message, @link, 'action-plan-reminder', 0, GETDATE())
                        `);
                    
                    remindersSent++;
                    console.log(`[Escalation Service] Sent ${daysBefore}-day reminder for inspection ${inspection.DocumentNumber}`);
                }
            }
        }
        
        console.log(`[Escalation Service] Sent ${remindersSent} deadline reminders`);
        return { remindersSent };
        
    } catch (err) {
        console.error('[Escalation Service] Error sending reminders:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Send escalation email to Area Manager
 */
async function sendEscalationEmail(areaManager, inspection) {
    const subject = `⚠️ Action Plan Overdue: ${inspection.StoreName} - ${inspection.DocumentNumber}`;
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff6b6b, #ee5a24); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
                <h2 style="margin: 0;">⚠️ Action Plan Escalation</h2>
            </div>
            <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
                <p>Dear ${areaManager.DisplayName},</p>
                <p>An action plan has exceeded its deadline and requires your attention:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #f8f9fa;">
                        <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                        <td style="padding: 12px; border: 1px solid #eee;">${inspection.StoreName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                        <td style="padding: 12px; border: 1px solid #eee;">${inspection.DocumentNumber}</td>
                    </tr>
                    <tr style="background: #f8f9fa;">
                        <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                        <td style="padding: 12px; border: 1px solid #eee;">${new Date(inspection.ActionPlanDeadline).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                        <td style="padding: 12px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">${inspection.DaysOverdue} day(s)</td>
                    </tr>
                </table>
                
                <p>Please contact the Store Manager to ensure the action plan is completed.</p>
                
                <p style="margin-top: 25px;">
                    <em style="color: #888;">This is an automated notification from the OE Inspection System.</em>
                </p>
            </div>
        </div>
    `;
    
    // Use email service if available
    if (emailService && emailService.sendEmail) {
        await emailService.sendEmail({
            to: areaManager.Email,
            subject: subject,
            html: htmlBody
        });
    } else {
        console.log('[Escalation Service] Email service not available, skipping email');
    }
}

/**
 * Mark action plan as completed and clear escalations
 */
async function markActionPlanCompleted(inspectionId) {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Update inspection
        await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                UPDATE OE_Inspections 
                SET ActionPlanCompletedAt = GETDATE()
                WHERE Id = @inspectionId
            `);
        
        // Resolve any pending escalations
        await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                UPDATE OE_ActionPlanEscalations 
                SET Status = 'Resolved', ResolvedAt = GETDATE()
                WHERE InspectionId = @inspectionId AND Status = 'Pending'
            `);
        
        console.log(`[Escalation Service] Marked action plan as completed for inspection ${inspectionId}`);
        return true;
        
    } catch (err) {
        console.error('[Escalation Service] Error marking action plan completed:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Get escalation statistics
 */
async function getEscalationStats() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                COUNT(CASE WHEN Status = 'Pending' THEN 1 END) as PendingCount,
                COUNT(CASE WHEN Status = 'Resolved' THEN 1 END) as ResolvedCount,
                COUNT(*) as TotalCount
            FROM OE_ActionPlanEscalations
            WHERE CreatedAt >= DATEADD(MONTH, -1, GETDATE())
        `);
        
        return result.recordset[0];
        
    } catch (err) {
        console.error('[Escalation Service] Error getting stats:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

module.exports = {
    checkOverdueActionPlans,
    sendDeadlineReminders,
    markActionPlanCompleted,
    getEscalationStats
};
