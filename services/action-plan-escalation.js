/**
 * Action Plan Escalation Service
 * Automatically escalates overdue action plans to Area Managers
 * Updated: 2026-02-25 - Added inspection-level notifications and scheduler status
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

// ============================================================================
// SCHEDULER STATUS TRACKING
// ============================================================================
const schedulerStatus = {
    isRunning: false,
    lastRunTime: null,
    lastRunStatus: null,  // 'success', 'error', 'partial'
    lastRunDuration: null,
    lastError: null,
    nextRunTime: null,
    runCount: 0,
    stats: {
        escalationsCreated: 0,
        remindersSent: 0,
        overdueNotifications: 0,
        emailsSent: 0,
        errors: 0
    },
    history: []  // Last 20 runs
};

/**
 * Get current scheduler status
 */
function getSchedulerStatus() {
    return {
        ...schedulerStatus,
        uptime: process.uptime(),
        currentTime: new Date().toISOString()
    };
}

/**
 * Update scheduler status after a run
 */
function updateSchedulerStatus(status, stats, error = null, duration = null) {
    schedulerStatus.lastRunTime = new Date().toISOString();
    schedulerStatus.lastRunStatus = status;
    schedulerStatus.lastRunDuration = duration;
    schedulerStatus.lastError = error ? error.message || String(error) : null;
    schedulerStatus.runCount++;
    
    if (stats) {
        schedulerStatus.stats.escalationsCreated += stats.escalationsCreated || 0;
        schedulerStatus.stats.remindersSent += stats.remindersSent || 0;
        schedulerStatus.stats.overdueNotifications += stats.overdueNotifications || 0;
        schedulerStatus.stats.emailsSent += stats.emailsSent || 0;
    }
    if (error) {
        schedulerStatus.stats.errors++;
    }
    
    // Add to history (keep last 20)
    schedulerStatus.history.unshift({
        time: schedulerStatus.lastRunTime,
        status: status,
        duration: duration,
        stats: stats ? { ...stats } : null,
        error: schedulerStatus.lastError
    });
    if (schedulerStatus.history.length > 20) {
        schedulerStatus.history.pop();
    }
}

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
            WHERE EscalatedAt >= DATEADD(MONTH, -1, GETDATE())
        `);
        
        return result.recordset[0];
        
    } catch (err) {
        console.error('[Escalation Service] Error getting stats:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

// ============================================================================
// INSPECTION-LEVEL NOTIFICATIONS (NEW)
// ============================================================================

/**
 * Get escalation settings for a module (OE or OHS)
 */
async function getModuleSettings(pool, module) {
    const settingsTable = module === 'OHS' ? 'OHS_EscalationSettings' : 'OE_EscalationSettings';
    
    try {
        const result = await pool.request().query(`
            SELECT SettingKey, SettingValue FROM ${settingsTable}
        `);
        
        const settings = {};
        result.recordset.forEach(s => {
            settings[s.SettingKey] = s.SettingValue;
        });
        
        return {
            reminderDays: (settings.ReminderDays || '3,1').split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)),
            actionPlanDeadlineDays: parseInt(settings.ActionPlanDeadlineDays) || 7,
            escalationEnabled: settings.EscalationEnabled === 'true' || settings.AutoEscalationEnabled === 'true',
            emailEnabled: settings.EmailNotifications === 'true' || settings.EmailNotificationEnabled === 'true',
            inAppEnabled: settings.InAppNotifications !== 'false'
        };
    } catch (err) {
        console.log(`[Escalation Service] Could not load ${module} settings, using defaults:`, err.message);
        return {
            reminderDays: [3, 1],
            actionPlanDeadlineDays: 7,
            escalationEnabled: true,
            emailEnabled: true,
            inAppEnabled: true
        };
    }
}

/**
 * Send inspection reminder notifications (X days before deadline)
 * Reads ReminderDays from each module's settings
 */
async function checkInspectionReminders(module = 'OE') {
    let pool;
    const startTime = Date.now();
    
    try {
        pool = await sql.connect(dbConfig);
        
        // Get module-specific settings
        const settings = await getModuleSettings(pool, module);
        const { reminderDays, emailEnabled, inAppEnabled } = settings;
        
        if (reminderDays.length === 0) {
            console.log(`[Escalation Service] ${module}: No reminder days configured`);
            return { remindersSent: 0 };
        }
        
        console.log(`[Escalation Service] ${module}: Checking for inspection reminders (${reminderDays.join(', ')} days before deadline)`);
        
        const tableName = module === 'OHS' ? 'OHS_Inspections' : 'OE_Inspections';
        const inspectionPath = module === 'OHS' ? 'ohs-inspection' : 'oe-inspection';
        const templateKey = `${module}_INSPECTION_REMINDER`;
        
        let remindersSent = 0;
        let emailsSent = 0;
        
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
                        i.InspectionDate,
                        i.ActionPlanDeadline,
                        i.CreatedBy,
                        u.Id as StoreManagerId,
                        u.DisplayName as StoreManagerName,
                        u.Email as StoreManagerEmail
                    FROM ${tableName} i
                    INNER JOIN Stores s ON i.StoreId = s.Id
                    LEFT JOIN Users u ON (u.StoreId = s.Id OR u.Email = i.CreatedBy) AND u.IsActive = 1
                    WHERE i.Status = 'Completed'
                      AND i.ActionPlanDeadline IS NOT NULL
                      AND i.ActionPlanCompletedAt IS NULL
                      AND DATEDIFF(day, GETDATE(), i.ActionPlanDeadline) = @daysBefore
                `);
            
            for (const inspection of inspectionsResult.recordset) {
                try {
                    // Check if reminder already sent today for this inspection
                    const existingReminder = await pool.request()
                        .input('inspectionId', sql.Int, inspection.InspectionId)
                        .query(`
                            SELECT Id FROM Notifications 
                            WHERE Type = 'inspection-reminder'
                            AND Link LIKE '%/${inspection.InspectionId}%'
                            AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                        `);
                    
                    if (existingReminder.recordset.length > 0) {
                        continue; // Already sent today
                    }
                    
                    // Create in-app notification
                    if (inAppEnabled && inspection.StoreManagerId) {
                        await pool.request()
                            .input('userId', sql.Int, inspection.StoreManagerId)
                            .input('userEmail', sql.NVarChar, inspection.StoreManagerEmail)
                            .input('title', sql.NVarChar, `⏰ ${module} Action Plan: ${daysBefore} Day${daysBefore > 1 ? 's' : ''} Remaining`)
                            .input('message', sql.NVarChar, `The action plan for ${module} inspection ${inspection.DocumentNumber} at ${inspection.StoreName} is due in ${daysBefore} day${daysBefore > 1 ? 's' : ''}. Please complete it before the deadline.`)
                            .input('link', sql.NVarChar, `/${inspectionPath}/action-plan/${inspection.InspectionId}`)
                            .query(`
                                INSERT INTO Notifications (UserId, UserEmail, Title, Message, Link, Type, IsRead, CreatedAt)
                                VALUES (@userId, @userEmail, @title, @message, @link, 'inspection-reminder', 0, GETDATE())
                            `);
                        
                        remindersSent++;
                    }
                    
                    // Send email reminder
                    if (emailEnabled && inspection.StoreManagerEmail) {
                        try {
                            await sendInspectionEmail(pool, templateKey, {
                                recipientName: inspection.StoreManagerName || 'Store Manager',
                                recipientEmail: inspection.StoreManagerEmail,
                                storeName: inspection.StoreName,
                                documentNumber: inspection.DocumentNumber,
                                inspectionDate: inspection.InspectionDate,
                                deadline: inspection.ActionPlanDeadline,
                                daysUntilDeadline: daysBefore,
                                actionPlanUrl: `${BASE_URL}/${inspectionPath}/action-plan/${inspection.InspectionId}`
                            }, module);
                            emailsSent++;
                        } catch (emailErr) {
                            console.error(`[Escalation Service] ${module}: Failed to send reminder email:`, emailErr.message);
                        }
                    }
                    
                    console.log(`[Escalation Service] ${module}: Sent ${daysBefore}-day reminder for ${inspection.DocumentNumber}`);
                } catch (err) {
                    console.error(`[Escalation Service] ${module}: Error processing reminder for ${inspection.InspectionId}:`, err.message);
                }
            }
        }
        
        console.log(`[Escalation Service] ${module}: Sent ${remindersSent} inspection reminders, ${emailsSent} emails`);
        return { remindersSent, emailsSent, duration: Date.now() - startTime };
        
    } catch (err) {
        console.error(`[Escalation Service] ${module}: Error checking reminders:`, err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Check for overdue inspections and send notifications to store managers
 * (before escalation to Area Manager)
 */
async function checkInspectionOverdue(module = 'OE') {
    let pool;
    const startTime = Date.now();
    
    try {
        pool = await sql.connect(dbConfig);
        
        const settings = await getModuleSettings(pool, module);
        const { emailEnabled, inAppEnabled } = settings;
        
        const tableName = module === 'OHS' ? 'OHS_Inspections' : 'OE_Inspections';
        const inspectionPath = module === 'OHS' ? 'ohs-inspection' : 'oe-inspection';
        const templateKey = `${module}_INSPECTION_OVERDUE`;
        
        console.log(`[Escalation Service] ${module}: Checking for overdue inspections...`);
        
        // Find overdue inspections (deadline passed, not completed, not yet escalated)
        const overdueResult = await pool.request().query(`
            SELECT 
                i.Id as InspectionId,
                i.DocumentNumber,
                i.StoreId,
                s.StoreName,
                i.InspectionDate,
                i.ActionPlanDeadline,
                DATEDIFF(day, i.ActionPlanDeadline, GETDATE()) as DaysOverdue,
                i.CreatedBy,
                u.Id as StoreManagerId,
                u.DisplayName as StoreManagerName,
                u.Email as StoreManagerEmail
            FROM ${tableName} i
            INNER JOIN Stores s ON i.StoreId = s.Id
            LEFT JOIN Users u ON (u.StoreId = s.Id OR u.Email = i.CreatedBy) AND u.IsActive = 1
            WHERE i.Status = 'Completed'
              AND i.ActionPlanDeadline IS NOT NULL
              AND i.ActionPlanDeadline < GETDATE()
              AND i.ActionPlanCompletedAt IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM OE_ActionPlanEscalations e 
                  WHERE e.InspectionId = i.Id AND e.Module = '${module}' AND e.Status = 'Pending'
              )
        `);
        
        let overdueNotifications = 0;
        let emailsSent = 0;
        
        for (const inspection of overdueResult.recordset) {
            try {
                // Check if overdue notification already sent today
                const existingNotification = await pool.request()
                    .input('inspectionId', sql.Int, inspection.InspectionId)
                    .query(`
                        SELECT Id FROM Notifications 
                        WHERE Type = 'inspection-overdue'
                        AND Link LIKE '%/${inspection.InspectionId}%'
                        AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                    `);
                
                if (existingNotification.recordset.length > 0) {
                    continue; // Already notified today
                }
                
                // Create in-app notification
                if (inAppEnabled && inspection.StoreManagerId) {
                    await pool.request()
                        .input('userId', sql.Int, inspection.StoreManagerId)
                        .input('userEmail', sql.NVarChar, inspection.StoreManagerEmail)
                        .input('title', sql.NVarChar, `⚠️ ${module} Action Plan OVERDUE`)
                        .input('message', sql.NVarChar, `The action plan for ${module} inspection ${inspection.DocumentNumber} at ${inspection.StoreName} is ${inspection.DaysOverdue} day(s) overdue. Please complete it immediately to avoid escalation.`)
                        .input('link', sql.NVarChar, `/${inspectionPath}/action-plan/${inspection.InspectionId}`)
                        .query(`
                            INSERT INTO Notifications (UserId, UserEmail, Title, Message, Link, Type, IsRead, CreatedAt)
                            VALUES (@userId, @userEmail, @title, @message, @link, 'inspection-overdue', 0, GETDATE())
                        `);
                    
                    overdueNotifications++;
                }
                
                // Send overdue email
                if (emailEnabled && inspection.StoreManagerEmail) {
                    try {
                        await sendInspectionEmail(pool, templateKey, {
                            recipientName: inspection.StoreManagerName || 'Store Manager',
                            recipientEmail: inspection.StoreManagerEmail,
                            storeName: inspection.StoreName,
                            documentNumber: inspection.DocumentNumber,
                            inspectionDate: inspection.InspectionDate,
                            deadline: inspection.ActionPlanDeadline,
                            daysOverdue: inspection.DaysOverdue,
                            actionPlanUrl: `${BASE_URL}/${inspectionPath}/action-plan/${inspection.InspectionId}`
                        }, module);
                        emailsSent++;
                    } catch (emailErr) {
                        console.error(`[Escalation Service] ${module}: Failed to send overdue email:`, emailErr.message);
                    }
                }
                
                console.log(`[Escalation Service] ${module}: Sent overdue notification for ${inspection.DocumentNumber} (${inspection.DaysOverdue} days overdue)`);
            } catch (err) {
                console.error(`[Escalation Service] ${module}: Error processing overdue ${inspection.InspectionId}:`, err.message);
            }
        }
        
        console.log(`[Escalation Service] ${module}: Sent ${overdueNotifications} overdue notifications, ${emailsSent} emails`);
        return { overdueNotifications, emailsSent, duration: Date.now() - startTime };
        
    } catch (err) {
        console.error(`[Escalation Service] ${module}: Error checking overdue:`, err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Send inspection notification email using database template
 */
async function sendInspectionEmail(pool, templateKey, data, module) {
    try {
        const template = await getEmailTemplate(pool, templateKey);
        
        const templateData = {
            recipientName: data.recipientName,
            storeName: data.storeName,
            documentNumber: data.documentNumber,
            inspectionDate: data.inspectionDate ? new Date(data.inspectionDate).toLocaleDateString() : 'N/A',
            deadline: data.deadline ? new Date(data.deadline).toLocaleDateString() : 'N/A',
            daysUntilDeadline: data.daysUntilDeadline || 0,
            daysOverdue: data.daysOverdue || 0,
            storeManagerName: data.storeManagerName || 'N/A',
            actionPlanUrl: data.actionPlanUrl
        };
        
        let subject, htmlBody;
        
        if (template) {
            subject = replaceTemplateVariables(template.SubjectTemplate, templateData);
            htmlBody = replaceTemplateVariables(template.BodyTemplate, templateData);
        } else {
            // Fallback
            console.log(`[Escalation Service] Template ${templateKey} not found, using fallback`);
            subject = `[${module}] Action Plan Notification - ${data.storeName}`;
            htmlBody = `<p>Action plan for inspection ${data.documentNumber} at ${data.storeName} requires attention.</p>
                        <p><a href="${data.actionPlanUrl}">View Action Plan</a></p>`;
        }
        
        if (emailService && emailService.sendEmail) {
            await emailService.sendEmail({
                to: data.recipientEmail,
                subject: subject,
                html: htmlBody
            });
            console.log(`[Escalation Service] Sent ${templateKey} email to ${data.recipientEmail}`);
        }
    } catch (err) {
        console.error(`[Escalation Service] Error sending ${templateKey} email:`, err);
        throw err;
    }
}

/**
 * Run all inspection notification checks (called by scheduler)
 */
async function runAllInspectionChecks() {
    const startTime = Date.now();
    schedulerStatus.isRunning = true;
    
    const results = {
        escalationsCreated: 0,
        remindersSent: 0,
        overdueNotifications: 0,
        emailsSent: 0
    };
    
    try {
        console.log('[Escalation Service] ========== Starting scheduled run ==========');
        
        // 1. Check existing action plan escalations (original functionality)
        const escalationResult = await checkOverdueActionPlans();
        results.escalationsCreated += escalationResult.escalationsCreated || 0;
        results.emailsSent += escalationResult.notificationsSent || 0;
        
        // 2. Send deadline reminders for OE
        const oeReminders = await checkInspectionReminders('OE');
        results.remindersSent += oeReminders.remindersSent || 0;
        results.emailsSent += oeReminders.emailsSent || 0;
        
        // 3. Send deadline reminders for OHS
        const ohsReminders = await checkInspectionReminders('OHS');
        results.remindersSent += ohsReminders.remindersSent || 0;
        results.emailsSent += ohsReminders.emailsSent || 0;
        
        // 4. Check overdue inspections for OE (before escalation)
        const oeOverdue = await checkInspectionOverdue('OE');
        results.overdueNotifications += oeOverdue.overdueNotifications || 0;
        results.emailsSent += oeOverdue.emailsSent || 0;
        
        // 5. Check overdue inspections for OHS (before escalation)
        const ohsOverdue = await checkInspectionOverdue('OHS');
        results.overdueNotifications += ohsOverdue.overdueNotifications || 0;
        results.emailsSent += ohsOverdue.emailsSent || 0;
        
        const duration = Date.now() - startTime;
        console.log(`[Escalation Service] ========== Run completed in ${duration}ms ==========`);
        console.log(`[Escalation Service] Summary: ${results.escalationsCreated} escalations, ${results.remindersSent} reminders, ${results.overdueNotifications} overdue notifications, ${results.emailsSent} emails`);
        
        updateSchedulerStatus('success', results, null, duration);
        return results;
        
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error('[Escalation Service] Run failed:', err);
        updateSchedulerStatus('error', results, err, duration);
        throw err;
    } finally {
        schedulerStatus.isRunning = false;
    }
}

/**
 * Start the scheduler (hourly checks)
 */
function startScheduler() {
    const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    
    console.log('[Escalation Service] Starting scheduler...');
    
    // Calculate next run time
    schedulerStatus.nextRunTime = new Date(Date.now() + 10000).toISOString();
    
    // Initial run after 10 seconds
    setTimeout(async () => {
        try {
            await runAllInspectionChecks();
        } catch (err) {
            console.error('[Escalation Service] Initial run failed:', err);
        }
        
        // Schedule hourly runs
        schedulerStatus.nextRunTime = new Date(Date.now() + INTERVAL_MS).toISOString();
        setInterval(async () => {
            try {
                schedulerStatus.nextRunTime = new Date(Date.now() + INTERVAL_MS).toISOString();
                await runAllInspectionChecks();
            } catch (err) {
                console.error('[Escalation Service] Scheduled run failed:', err);
            }
        }, INTERVAL_MS);
        
    }, 10000);
    
    console.log('[Escalation Service] Scheduler started. First run in 10 seconds, then hourly.');
}

module.exports = {
    checkOverdueActionPlans,
    sendDeadlineReminders,
    markActionPlanCompleted,
    getEscalationStats,
    // New exports
    checkInspectionReminders,
    checkInspectionOverdue,
    runAllInspectionChecks,
    getSchedulerStatus,
    startScheduler
};
