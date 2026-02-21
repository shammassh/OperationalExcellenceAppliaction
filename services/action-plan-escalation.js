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

// Base URL for links in emails
const BASE_URL = process.env.BASE_URL || 'https://oeapp-uat.gmrlapps.com';

/**
 * Get email template from database
 */
async function getEmailTemplate(pool, templateKey) {
    const result = await pool.request()
        .input('templateKey', sql.NVarChar, templateKey)
        .query(`
            SELECT SubjectTemplate, BodyTemplate 
            FROM EmailTemplates 
            WHERE TemplateKey = @templateKey AND IsActive = 1
        `);
    
    return result.recordset[0] || null;
}

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(template, data) {
    if (!template) return '';
    
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value || '');
    }
    return result;
}

/**
 * Check for overdue action plans and create escalations (OE and OHS)
 */
async function checkOverdueActionPlans() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get escalation settings
        const settingsResult = await pool.request().query(`
            SELECT SettingKey, SettingValue 
            FROM OE_EscalationSettings 
            WHERE SettingKey IN ('AutoEscalationEnabled', 'EmailNotificationEnabled', 'EscalationEnabled', 'EmailNotifications')
        `);
        
        const settings = {};
        settingsResult.recordset.forEach(s => {
            settings[s.SettingKey] = s.SettingValue;
        });
        
        // Check if auto-escalation is enabled (check both old and new setting keys)
        const escalationEnabled = settings.AutoEscalationEnabled === 'true' || settings.EscalationEnabled === 'true';
        if (!escalationEnabled) {
            console.log('[Escalation Service] Auto-escalation is disabled');
            return { escalationsCreated: 0, disabled: true };
        }
        
        const emailEnabled = settings.EmailNotificationEnabled === 'true' || settings.EmailNotifications === 'true';
        
        console.log('[Escalation Service] Checking for overdue action plans (OE and OHS)...');
        
        let totalEscalations = 0;
        let totalNotifications = 0;
        
        // ============ OE INSPECTIONS ============
        const oeResult = await checkModuleOverdue(pool, 'OE', emailEnabled);
        totalEscalations += oeResult.escalationsCreated;
        totalNotifications += oeResult.notificationsSent;
        
        // ============ OHS INSPECTIONS ============
        const ohsResult = await checkModuleOverdue(pool, 'OHS', emailEnabled);
        totalEscalations += ohsResult.escalationsCreated;
        totalNotifications += ohsResult.notificationsSent;
        
        console.log(`[Escalation Service] Total: ${totalEscalations} escalations, ${totalNotifications} emails sent`);
        
        return { escalationsCreated: totalEscalations, notificationsSent: totalNotifications };
        
    } catch (err) {
        console.error('[Escalation Service] Error:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Check overdue action plans for a specific module (OE or OHS)
 */
async function checkModuleOverdue(pool, module, emailEnabled) {
    const tableName = module === 'OHS' ? 'OHS_Inspections' : 'OE_Inspections';
    const escalationTable = module === 'OHS' ? 'OHS_ActionPlanEscalations' : 'OE_ActionPlanEscalations';
    const responsiblesTable = module === 'OHS' ? 'OE_BrandResponsibles' : 'OE_StoreResponsibles'; // OHS uses brand responsibles
    const inspectionPath = module === 'OHS' ? 'ohs-inspection' : 'oe-inspection';
    
    // Check if escalation table exists for OHS, if not skip
    if (module === 'OHS') {
        const tableExists = await pool.request().query(`
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'OHS_ActionPlanEscalations'
        `);
        if (tableExists.recordset.length === 0) {
            console.log(`[Escalation Service] ${module}: Escalation table doesn't exist, using OE table`);
            // Use OE escalation table but mark as OHS
        }
    }
    
    // Find overdue inspections
    const overdueResult = await pool.request().query(`
        SELECT 
            i.Id as InspectionId,
            i.DocumentNumber,
            i.StoreId,
            s.StoreName,
            s.BrandId,
            i.InspectionDate,
            i.ActionPlanDeadline,
            DATEDIFF(day, i.ActionPlanDeadline, GETDATE()) as DaysOverdue,
            '${module}' as Module
        FROM ${tableName} i
        INNER JOIN Stores s ON i.StoreId = s.Id
        WHERE i.Status = 'Completed'
          AND i.ActionPlanDeadline IS NOT NULL
          AND i.ActionPlanDeadline < GETDATE()
          AND i.ActionPlanCompletedAt IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM OE_ActionPlanEscalations e 
              WHERE e.InspectionId = i.Id AND e.Module = '${module}' AND e.Status = 'Pending'
          )
    `);
    
    console.log(`[Escalation Service] ${module}: Found ${overdueResult.recordset.length} overdue action plans`);
    
    let escalationsCreated = 0;
    let notificationsSent = 0;
    
    for (const inspection of overdueResult.recordset) {
        try {
            // Find the Area Manager - try store responsibles first, then brand responsibles
            let areaManager = null;
            
            // Try OE_StoreResponsibles
            const storeManagerResult = await pool.request()
                .input('storeId', sql.Int, inspection.StoreId)
                .query(`
                    SELECT sr.AreaManagerId, u.DisplayName, u.Email
                    FROM OE_StoreResponsibles sr
                    INNER JOIN Users u ON sr.AreaManagerId = u.Id
                    WHERE sr.StoreId = @storeId AND sr.IsActive = 1
                `);
            
            if (storeManagerResult.recordset.length > 0) {
                areaManager = storeManagerResult.recordset[0];
            } else if (inspection.BrandId) {
                // Try brand responsibles
                const brandManagerResult = await pool.request()
                    .input('brandId', sql.Int, inspection.BrandId)
                    .query(`
                        SELECT br.AreaManagerId, u.DisplayName, u.Email
                        FROM OE_BrandResponsibles br
                        INNER JOIN Users u ON br.AreaManagerId = u.Id
                        WHERE br.BrandId = @brandId AND br.IsActive = 1
                    `);
                
                if (brandManagerResult.recordset.length > 0) {
                    areaManager = brandManagerResult.recordset[0];
                }
            }
            
            if (!areaManager) {
                console.log(`[Escalation Service] ${module}: No Area Manager assigned to store ${inspection.StoreName} (ID: ${inspection.StoreId})`);
                continue;
            }
            
            // Create escalation record (with module identifier)
            await pool.request()
                .input('inspectionId', sql.Int, inspection.InspectionId)
                .input('storeId', sql.Int, inspection.StoreId)
                .input('escalatedToUserId', sql.Int, areaManager.AreaManagerId)
                .input('reason', sql.NVarChar, `${module} Action plan deadline exceeded by ${inspection.DaysOverdue} day(s)`)
                .input('module', sql.NVarChar, module)
                .query(`
                    INSERT INTO OE_ActionPlanEscalations 
                    (InspectionId, StoreId, EscalatedToUserId, EscalationLevel, Reason, Status, Module, CreatedAt)
                    VALUES (@inspectionId, @storeId, @escalatedToUserId, 1, @reason, 'Pending', @module, GETDATE())
                `);
            
            escalationsCreated++;
            console.log(`[Escalation Service] ${module}: Created escalation for ${inspection.DocumentNumber} to ${areaManager.DisplayName}`);
            
            // Create in-app notification
            await pool.request()
                .input('userId', sql.Int, areaManager.AreaManagerId)
                .input('userEmail', sql.NVarChar, areaManager.Email)
                .input('title', sql.NVarChar, `⚠️ ${module} Action Plan Overdue - Escalation`)
                .input('message', sql.NVarChar, `${module} action plan for inspection ${inspection.DocumentNumber} at ${inspection.StoreName} is ${inspection.DaysOverdue} day(s) overdue. Please follow up.`)
                .input('link', sql.NVarChar, `/${inspectionPath}/action-plan/${inspection.InspectionId}`)
                .query(`
                    INSERT INTO Notifications (UserId, UserEmail, Title, Message, Link, Type, IsRead, CreatedAt)
                    VALUES (@userId, @userEmail, @title, @message, @link, 'escalation', 0, GETDATE())
                `);
            
            // Send email if enabled
            if (emailEnabled && areaManager.Email) {
                try {
                    await sendEscalationEmail(areaManager, inspection, module);
                    notificationsSent++;
                } catch (emailErr) {
                    console.error(`[Escalation Service] ${module}: Failed to send email:`, emailErr.message);
                }
            }
            
        } catch (err) {
            console.error(`[Escalation Service] ${module}: Error processing inspection ${inspection.InspectionId}:`, err.message);
        }
    }
    
    console.log(`[Escalation Service] ${module}: Created ${escalationsCreated} escalations, sent ${notificationsSent} emails`);
    
    return { escalationsCreated, notificationsSent };
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
 * Send escalation email to Area Manager (reads template from database)
 * @param {Object} areaManager - { Email, DisplayName }
 * @param {Object} inspection - { InspectionId, DocumentNumber, StoreName, ActionPlanDeadline, DaysOverdue, InspectionDate }
 * @param {string} module - 'OE' or 'OHS'
 */
async function sendEscalationEmail(areaManager, inspection, module = 'OE') {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get template from database
        const templateKey = module === 'OHS' ? 'OHS_ESCALATION' : 'OE_ESCALATION';
        const template = await getEmailTemplate(pool, templateKey);
        
        // Prepare template data
        const templateData = {
            recipientName: areaManager.DisplayName || areaManager.Email,
            storeName: inspection.StoreName,
            documentNumber: inspection.DocumentNumber,
            inspectionDate: inspection.InspectionDate ? new Date(inspection.InspectionDate).toLocaleDateString() : 'N/A',
            deadline: inspection.ActionPlanDeadline ? new Date(inspection.ActionPlanDeadline).toLocaleDateString() : 'N/A',
            daysOverdue: inspection.DaysOverdue || 0,
            actionPlanUrl: `${BASE_URL}/${module.toLowerCase()}-inspection/action-plan/${inspection.InspectionId}`
        };
        
        let subject, htmlBody;
        
        if (template) {
            // Use database template
            subject = replaceTemplateVariables(template.SubjectTemplate, templateData);
            htmlBody = replaceTemplateVariables(template.BodyTemplate, templateData);
        } else {
            // Fallback to hardcoded template if not in database
            console.log(`[Escalation Service] Template ${templateKey} not found in database, using fallback`);
            subject = `[${module}] Action Plan Overdue: ${inspection.StoreName} - ${inspection.DocumentNumber}`;
            htmlBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #ff6b6b, #ee5a24); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
                        <h2 style="margin: 0;">${module} Action Plan Escalation</h2>
                    </div>
                    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
                        <p>Dear ${templateData.recipientName},</p>
                        <p>An action plan has exceeded its deadline and requires your attention:</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                                <td style="padding: 12px; border: 1px solid #eee;">${templateData.storeName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                                <td style="padding: 12px; border: 1px solid #eee;">${templateData.documentNumber}</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                                <td style="padding: 12px; border: 1px solid #eee;">${templateData.deadline}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                                <td style="padding: 12px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">${templateData.daysOverdue} day(s)</td>
                            </tr>
                        </table>
                        
                        <p>Please contact the Store Manager to ensure the action plan is completed.</p>
                        
                        <p style="margin-top: 25px;">
                            <a href="${templateData.actionPlanUrl}" style="background: #ee5a24; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Action Plan</a>
                        </p>
                        
                        <p style="margin-top: 25px;">
                            <em style="color: #888;">This is an automated notification from the ${module} Inspection System.</em>
                        </p>
                    </div>
                </div>
            `;
        }
        
        // Use email service if available
        if (emailService && emailService.sendEmail) {
            await emailService.sendEmail({
                to: areaManager.Email,
                subject: subject,
                html: htmlBody
            });
            console.log(`[Escalation Service] Sent ${module} escalation email to ${areaManager.Email}`);
        } else {
            console.log('[Escalation Service] Email service not available, skipping email');
        }
        
    } catch (err) {
        console.error('[Escalation Service] Error sending escalation email:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
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
