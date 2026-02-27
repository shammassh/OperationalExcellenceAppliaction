/**
 * 5 Days Reminder Service
 * Automated reminder system for the 5 Days Expired Items workflow
 * 
 * Workflow:
 * - Initiate: Start of cycle (1st or 15th of month) - Inform stores to start filling
 * - 48 Hours: Reminder that they have 48 hours to start
 * - Day 1-5: Daily reminders for findings
 * - Final Reminder: Present all findings
 * - Close: If all presented, close cycle. If not, warn about audit impact.
 * 
 * Created: 2026-02-27
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

// Scheduler status
const schedulerStatus = {
    isRunning: false,
    lastRunTime: null,
    lastRunStatus: null,
    lastError: null,
    stats: {
        emailsSent: 0,
        broadcastsCreated: 0,
        cyclesClosed: 0
    },
    history: []
};

/**
 * Get current cycle info
 * Cycles run: 1st-5th and 15th-19th of each month
 */
function getCurrentCycleInfo() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth();
    const year = today.getFullYear();
    
    let cycleStart, cycleEnd, cycleNumber, isInCycle;
    
    if (day >= 1 && day <= 10) {
        // First cycle: 1st-5th (with buffer until 10th)
        cycleStart = new Date(year, month, 1);
        cycleEnd = new Date(year, month, 5);
        cycleNumber = 1;
        isInCycle = day >= 1 && day <= 5;
    } else if (day >= 15 && day <= 24) {
        // Second cycle: 15th-19th (with buffer until 24th)
        cycleStart = new Date(year, month, 15);
        cycleEnd = new Date(year, month, 19);
        cycleNumber = 2;
        isInCycle = day >= 15 && day <= 19;
    } else {
        // Between cycles
        cycleStart = null;
        cycleEnd = null;
        cycleNumber = 0;
        isInCycle = false;
    }
    
    // Calculate days into cycle
    let daysIntoCycle = 0;
    let daysAfterCycle = 0;
    if (cycleStart) {
        const diff = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));
        if (diff <= 5) {
            daysIntoCycle = diff + 1; // Day 1, 2, 3, 4, 5
        } else {
            daysAfterCycle = diff - 5; // Days after cycle end
        }
    }
    
    return {
        today: today,
        day: day,
        cycleStart: cycleStart,
        cycleEnd: cycleEnd,
        cycleNumber: cycleNumber,
        isInCycle: isInCycle,
        daysIntoCycle: daysIntoCycle,
        daysAfterCycle: daysAfterCycle,
        cycleKey: cycleStart ? `${year}-${month + 1}-C${cycleNumber}` : null
    };
}

/**
 * Get reminder type based on current date in cycle
 */
function getReminderType(cycleInfo) {
    const { day, cycleNumber, daysIntoCycle, daysAfterCycle } = cycleInfo;
    
    // Cycle 1: Starts on 1st, ends on 5th
    // Cycle 2: Starts on 15th, ends on 19th
    const cycleStartDay = cycleNumber === 1 ? 1 : 15;
    const cycleEndDay = cycleNumber === 1 ? 5 : 19;
    
    if (day === cycleStartDay) {
        return 'INITIATE';
    } else if (day === cycleStartDay + 2) {
        return 'REMINDER_48H';
    } else if (daysIntoCycle >= 1 && daysIntoCycle <= 5) {
        return `DAY_${daysIntoCycle}`;
    } else if (daysAfterCycle === 1) {
        return 'FINAL_REMINDER';
    } else if (daysAfterCycle >= 2 && daysAfterCycle <= 5) {
        return 'OVERDUE_WARNING';
    }
    
    return null;
}

/**
 * Get stores with pending 5 Days entries for current cycle
 */
async function getStoresWithPendingEntries(pool, cycleInfo) {
    const { cycleStart, cycleEnd } = cycleInfo;
    
    if (!cycleStart || !cycleEnd) return [];
    
    // Get all active stores
    const storesResult = await pool.request()
        .query(`
            SELECT s.Id, s.StoreName, s.StoreCode, s.StoreSize, s.BrandId,
                   b.BrandName
            FROM Stores s
            LEFT JOIN Brands b ON s.BrandId = b.Id
            WHERE s.IsActive = 1
        `);
    
    // Get stores that have submitted entries for this cycle
    const submittedResult = await pool.request()
        .input('cycleStart', sql.Date, cycleStart)
        .input('cycleEnd', sql.Date, cycleEnd)
        .query(`
            SELECT DISTINCT StoreId, COUNT(*) as EntryCount
            FROM FiveDaysEntries
            WHERE EntryDate >= @cycleStart AND EntryDate <= @cycleEnd
            GROUP BY StoreId
        `);
    
    const submittedMap = {};
    submittedResult.recordset.forEach(r => {
        submittedMap[r.StoreId] = r.EntryCount;
    });
    
    // Mark stores with their submission status
    return storesResult.recordset.map(store => ({
        ...store,
        hasSubmitted: !!submittedMap[store.Id],
        entryCount: submittedMap[store.Id] || 0
    }));
}

/**
 * Get store managers for notification
 */
async function getStoreManagers(pool, storeId = null) {
    let query = `
        SELECT DISTINCT u.Id, u.Email, u.DisplayName, sma.StoreId, s.StoreName
        FROM Users u
        JOIN StoreManagerAssignments sma ON u.Id = sma.UserId
        JOIN Stores s ON sma.StoreId = s.Id
        WHERE u.IsActive = 1 AND sma.IsPrimary = 1
    `;
    
    if (storeId) {
        query += ' AND sma.StoreId = @storeId';
    }
    
    const request = pool.request();
    if (storeId) {
        request.input('storeId', sql.Int, storeId);
    }
    
    const result = await request.query(query);
    return result.recordset;
}

/**
 * Get email template
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
 * Replace template variables
 */
function replaceTemplateVariables(template, data) {
    if (!template) return '';
    
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value ?? '');
    }
    return result;
}

/**
 * Create broadcast message
 */
async function createBroadcast(pool, title, message, priority, targetRoles, createdBy) {
    await pool.request()
        .input('title', sql.NVarChar, title)
        .input('message', sql.NVarChar, message)
        .input('targetRoles', sql.NVarChar, targetRoles)
        .input('priority', sql.NVarChar, priority)
        .input('createdBy', sql.Int, createdBy)
        .query(`
            INSERT INTO Broadcasts (Title, Message, TargetRoles, Priority, CreatedBy, ExpiresAt)
            VALUES (@title, @message, @targetRoles, @priority, @createdBy, DATEADD(DAY, 7, GETDATE()))
        `);
}

/**
 * Log reminder sent
 */
async function logReminderSent(pool, cycleKey, reminderType, storeId, recipientEmail) {
    try {
        // Check if FiveDaysReminderLog table exists, if not use a simple approach
        await pool.request()
            .input('cycleKey', sql.NVarChar, cycleKey)
            .input('reminderType', sql.NVarChar, reminderType)
            .input('storeId', sql.Int, storeId)
            .input('recipientEmail', sql.NVarChar, recipientEmail)
            .query(`
                INSERT INTO FiveDaysReminderLog (CycleKey, ReminderType, StoreId, RecipientEmail, SentAt)
                VALUES (@cycleKey, @reminderType, @storeId, @recipientEmail, GETDATE())
            `);
    } catch (err) {
        // Table might not exist yet
        console.log('[5 Days Reminder] Log table not ready:', err.message);
    }
}

/**
 * Check if reminder already sent today
 */
async function wasReminderSentToday(pool, cycleKey, reminderType, storeId) {
    try {
        const result = await pool.request()
            .input('cycleKey', sql.NVarChar, cycleKey)
            .input('reminderType', sql.NVarChar, reminderType)
            .input('storeId', sql.Int, storeId)
            .query(`
                SELECT COUNT(*) as cnt
                FROM FiveDaysReminderLog
                WHERE CycleKey = @cycleKey 
                  AND ReminderType = @reminderType 
                  AND StoreId = @storeId
                  AND CAST(SentAt AS DATE) = CAST(GETDATE() AS DATE)
            `);
        
        return result.recordset[0].cnt > 0;
    } catch (err) {
        return false;
    }
}

/**
 * Get reminder message content
 */
function getReminderContent(reminderType, cycleInfo, store) {
    const cycleEndFormatted = cycleInfo.cycleEnd ? cycleInfo.cycleEnd.toLocaleDateString('en-GB', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    }) : '';
    
    const messages = {
        'INITIATE': {
            title: '📅 5 Days Cycle Started - Action Required',
            message: `The 5 Days Expired Items cycle has started!\n\nPlease begin recording all expired items found in your store.\n\nCycle ends: ${cycleEndFormatted}\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'High'
        },
        'REMINDER_48H': {
            title: '⏰ 48 Hours Left - 5 Days Reminder',
            message: `You have 48 hours remaining to complete your 5 Days entries.\n\nPlease ensure all expired items are recorded before the deadline.\n\nCycle ends: ${cycleEndFormatted}\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'High'
        },
        'DAY_1': {
            title: '📋 Day 1 Reminder - 5 Days Expired Items',
            message: `Day 1 of the 5 Days cycle.\n\nPlease submit your findings for today.\n\nRemember to check all areas for expired items.\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'Normal'
        },
        'DAY_2': {
            title: '📋 Day 2 Reminder - 5 Days Expired Items',
            message: `Day 2 of the 5 Days cycle.\n\nContinue recording expired items.\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'Normal'
        },
        'DAY_3': {
            title: '📋 Day 3 Reminder - 5 Days Expired Items',
            message: `Day 3 of the 5 Days cycle.\n\nYou're halfway through! Keep recording.\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'Normal'
        },
        'DAY_4': {
            title: '📋 Day 4 Reminder - 5 Days Expired Items',
            message: `Day 4 of the 5 Days cycle.\n\nAlmost done! Continue your checks.\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'Normal'
        },
        'DAY_5': {
            title: '📋 Day 5 - Final Day of Cycle',
            message: `Today is the FINAL DAY of the 5 Days cycle!\n\nPlease complete all entries and submit your findings.\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'High'
        },
        'FINAL_REMINDER': {
            title: '⚠️ Final Reminder - Present All Findings',
            message: `The 5 Days cycle has ended.\n\nPlease ensure ALL findings have been submitted and presented.\n\nStores with incomplete submissions will be flagged.\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'High'
        },
        'OVERDUE_WARNING': {
            title: '🚨 Warning - Missing 5 Days Data',
            message: `Your 5 Days cycle submissions are OVERDUE.\n\n⚠️ Missing data WILL affect your upcoming store audit.\n\nPlease complete your submissions immediately.\n\nAccess the form at: ${BASE_URL}/stores/five-days`,
            priority: 'High'
        }
    };
    
    return messages[reminderType] || null;
}

/**
 * Run the 5 Days reminder check
 */
async function runFiveDaysReminders() {
    if (schedulerStatus.isRunning) {
        console.log('[5 Days Reminder] Already running, skipping...');
        return { skipped: true };
    }
    
    schedulerStatus.isRunning = true;
    const startTime = Date.now();
    let pool;
    
    const results = {
        cycleInfo: null,
        reminderType: null,
        emailsSent: 0,
        broadcastCreated: false,
        storesNotified: [],
        storesCompleted: [],
        errors: []
    };
    
    try {
        pool = await sql.connect(dbConfig);
        
        // Get current cycle info
        const cycleInfo = getCurrentCycleInfo();
        results.cycleInfo = cycleInfo;
        
        if (!cycleInfo.cycleKey) {
            console.log('[5 Days Reminder] Not in a cycle period, skipping...');
            return results;
        }
        
        // Get reminder type
        const reminderType = getReminderType(cycleInfo);
        results.reminderType = reminderType;
        
        if (!reminderType) {
            console.log('[5 Days Reminder] No reminder needed for today');
            return results;
        }
        
        console.log(`[5 Days Reminder] Processing ${reminderType} for cycle ${cycleInfo.cycleKey}`);
        
        // Get reminder content
        const content = getReminderContent(reminderType, cycleInfo);
        if (!content) {
            console.log('[5 Days Reminder] No content defined for reminder type:', reminderType);
            return results;
        }
        
        // Get stores with their submission status
        const stores = await getStoresWithPendingEntries(pool, cycleInfo);
        
        // For INITIATE and DAY_X reminders, notify all stores
        // For FINAL_REMINDER and OVERDUE_WARNING, only notify stores without submissions
        let targetStores = stores;
        if (reminderType === 'FINAL_REMINDER' || reminderType === 'OVERDUE_WARNING') {
            targetStores = stores.filter(s => !s.hasSubmitted);
            results.storesCompleted = stores.filter(s => s.hasSubmitted).map(s => s.StoreName);
        }
        
        // Get store managers
        const managers = await getStoreManagers(pool);
        
        // Get email template
        const template = await getEmailTemplate(pool, 'BROADCAST_5DAYS') || 
                         await getEmailTemplate(pool, 'BROADCAST_MESSAGE');
        
        // Create broadcast for dashboard visibility
        if (targetStores.length > 0) {
            try {
                // Get system user or first admin
                const adminResult = await pool.request().query(`
                    SELECT TOP 1 u.Id FROM Users u
                    JOIN UserRoleAssignments ura ON u.Id = ura.UserId
                    JOIN UserRoles r ON ura.RoleId = r.Id
                    WHERE r.RoleName = 'System Admin' AND u.IsActive = 1
                `);
                const systemUserId = adminResult.recordset[0]?.Id || 1;
                
                await createBroadcast(
                    pool,
                    content.title,
                    content.message,
                    content.priority,
                    'Store Manager',
                    systemUserId
                );
                results.broadcastCreated = true;
                schedulerStatus.stats.broadcastsCreated++;
            } catch (err) {
                console.error('[5 Days Reminder] Error creating broadcast:', err.message);
                results.errors.push(`Broadcast error: ${err.message}`);
            }
        }
        
        // Send emails to store managers of target stores
        for (const store of targetStores) {
            const storeManagers = managers.filter(m => m.StoreId === store.Id);
            
            for (const manager of storeManagers) {
                // Check if already sent today
                const alreadySent = await wasReminderSentToday(pool, cycleInfo.cycleKey, reminderType, store.Id);
                if (alreadySent) {
                    continue;
                }
                
                try {
                    let subject = content.title;
                    let body = content.message;
                    
                    // Use template if available
                    if (template) {
                        subject = replaceTemplateVariables(template.SubjectTemplate, {
                            title: content.title,
                            storeName: store.StoreName
                        });
                        body = replaceTemplateVariables(template.BodyTemplate, {
                            title: content.title,
                            message: content.message,
                            recipientName: manager.DisplayName,
                            senderName: 'OE System',
                            sentDate: new Date().toLocaleString('en-GB'),
                            priority: content.priority,
                            dashboardUrl: `${BASE_URL}/stores/five-days`,
                            year: new Date().getFullYear()
                        });
                    }
                    
                    await emailService.sendEmail({
                        to: manager.Email,
                        subject: subject,
                        html: body
                    });
                    
                    results.emailsSent++;
                    schedulerStatus.stats.emailsSent++;
                    results.storesNotified.push(store.StoreName);
                    
                    // Log reminder
                    await logReminderSent(pool, cycleInfo.cycleKey, reminderType, store.Id, manager.Email);
                    
                } catch (err) {
                    console.error(`[5 Days Reminder] Error sending to ${manager.Email}:`, err.message);
                    results.errors.push(`Email to ${manager.Email}: ${err.message}`);
                }
            }
        }
        
        // Update status
        schedulerStatus.lastRunTime = new Date().toISOString();
        schedulerStatus.lastRunStatus = results.errors.length > 0 ? 'partial' : 'success';
        
        console.log(`[5 Days Reminder] Completed: ${results.emailsSent} emails sent, ${results.storesNotified.length} stores notified`);
        
    } catch (err) {
        console.error('[5 Days Reminder] Error:', err);
        schedulerStatus.lastRunStatus = 'error';
        schedulerStatus.lastError = err.message;
        results.errors.push(err.message);
    } finally {
        schedulerStatus.isRunning = false;
        
        // Add to history
        schedulerStatus.history.unshift({
            time: new Date().toISOString(),
            duration: Date.now() - startTime,
            results: { ...results }
        });
        if (schedulerStatus.history.length > 20) {
            schedulerStatus.history.pop();
        }
        
        if (pool) {
            try { await pool.close(); } catch (e) { }
        }
    }
    
    return results;
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
    return {
        ...schedulerStatus,
        currentCycle: getCurrentCycleInfo(),
        currentTime: new Date().toISOString()
    };
}

/**
 * Get dry run preview - what would be sent without actually sending
 */
async function getDryRunPreview() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const cycleInfo = getCurrentCycleInfo();
        const reminderType = getReminderType(cycleInfo);
        const content = reminderType ? getReminderContent(reminderType, cycleInfo) : null;
        const stores = cycleInfo.cycleKey ? await getStoresWithPendingEntries(pool, cycleInfo) : [];
        const managers = await getStoreManagers(pool);
        
        // Filter stores based on reminder type
        let targetStores = stores;
        if (reminderType === 'FINAL_REMINDER' || reminderType === 'OVERDUE_WARNING') {
            targetStores = stores.filter(s => !s.hasSubmitted);
        }
        
        // Build preview
        const recipients = [];
        for (const store of targetStores) {
            const storeManagers = managers.filter(m => m.StoreId === store.Id);
            for (const manager of storeManagers) {
                recipients.push({
                    email: manager.Email,
                    name: manager.DisplayName,
                    store: store.StoreName,
                    hasSubmitted: store.hasSubmitted,
                    entryCount: store.entryCount
                });
            }
        }
        
        return {
            cycleInfo,
            reminderType,
            content,
            totalStores: stores.length,
            targetStores: targetStores.length,
            completedStores: stores.filter(s => s.hasSubmitted).length,
            pendingStores: stores.filter(s => !s.hasSubmitted).length,
            recipients,
            wouldCreateBroadcast: targetStores.length > 0
        };
        
    } finally {
        if (pool) {
            try { await pool.close(); } catch (e) { }
        }
    }
}

module.exports = {
    runFiveDaysReminders,
    getSchedulerStatus,
    getDryRunPreview,
    getCurrentCycleInfo,
    getReminderType
};
