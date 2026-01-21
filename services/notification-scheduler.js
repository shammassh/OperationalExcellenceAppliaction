/**
 * Notification Scheduler
 * Generates reminders for weekly feedback submissions
 */

const sql = require('mssql');

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

// Get current week's start and end dates (Monday to Sunday)
function getCurrentWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);
    
    return {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0]
    };
}

// Generate weekly feedback reminders
async function generateWeeklyFeedbackReminders() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const currentWeek = getCurrentWeekDates();
        
        console.log(`[Notification Scheduler] Checking for missing weekly feedback for week ${currentWeek.start} to ${currentWeek.end}`);
        
        // Get all active stores
        const storesResult = await pool.request()
            .query(`SELECT Id, StoreName FROM Stores WHERE IsActive = 1`);
        
        // Get all Store Managers
        const managersResult = await pool.request()
            .query(`SELECT u.Id, u.DisplayName, u.Email, u.StoreId 
                    FROM Users u 
                    LEFT JOIN UserRoles r ON u.RoleId = r.Id 
                    WHERE r.RoleName = 'Store Manager' AND u.IsActive = 1`);
        
        // Get already submitted feedback for this week
        const submittedResult = await pool.request()
            .input('weekStart', sql.Date, currentWeek.start)
            .input('weekEnd', sql.Date, currentWeek.end)
            .query(`SELECT StoreId FROM WeeklyThirdPartyFeedback 
                    WHERE WeekStartDate = @weekStart AND WeekEndDate = @weekEnd`);
        
        const submittedStoreIds = submittedResult.recordset.map(r => r.StoreId);
        
        // Get pending stores (not submitted yet)
        const pendingStores = storesResult.recordset.filter(s => !submittedStoreIds.includes(s.Id));
        
        console.log(`[Notification Scheduler] ${pendingStores.length} stores have not submitted feedback this week`);
        
        // Create notifications for store managers
        let notificationsCreated = 0;
        
        for (const store of pendingStores) {
            // Find store manager for this store
            const manager = managersResult.recordset.find(m => m.StoreId === store.Id);
            
            if (manager) {
                // Check if reminder already sent today for this store
                const existingReminder = await pool.request()
                    .input('userId', sql.Int, manager.Id)
                    .input('type', sql.NVarChar(50), 'reminder')
                    .input('today', sql.Date, new Date().toISOString().split('T')[0])
                    .query(`SELECT Id FROM Notifications 
                            WHERE UserId = @userId AND Type = @type 
                            AND CAST(CreatedAt AS DATE) = @today
                            AND Title LIKE '%Weekly Third Party Feedback%'`);
                
                if (existingReminder.recordset.length === 0) {
                    // Create reminder notification
                    await pool.request()
                        .input('userId', sql.Int, manager.Id)
                        .input('userEmail', sql.NVarChar(200), manager.Email)
                        .input('title', sql.NVarChar(200), 'Weekly Third Party Feedback Reminder')
                        .input('message', sql.NVarChar(sql.MAX), `Please submit your weekly third party feedback for ${store.StoreName}. Deadline: ${currentWeek.end}`)
                        .input('link', sql.NVarChar(500), '/stores/weekly-feedback')
                        .input('type', sql.NVarChar(50), 'reminder')
                        .query(`INSERT INTO Notifications (UserId, UserEmail, Title, Message, Link, Type, IsRead, CreatedAt)
                                VALUES (@userId, @userEmail, @title, @message, @link, @type, 0, GETDATE())`);
                    
                    notificationsCreated++;
                }
            }
        }
        
        console.log(`[Notification Scheduler] Created ${notificationsCreated} reminder notifications`);
        
        return { pendingStores: pendingStores.length, notificationsCreated };
    } catch (err) {
        console.error('[Notification Scheduler] Error:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

// Check and create login-time notifications for current user
async function checkUserNotifications(userId, userEmail) {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const currentWeek = getCurrentWeekDates();
        
        // Get stores managed by this user
        const userStoresResult = await pool.request()
            .input('userId', sql.Int, userId)
            .input('userEmail', sql.NVarChar(200), userEmail)
            .query(`SELECT s.Id, s.StoreName 
                    FROM Stores s
                    WHERE s.IsActive = 1`);
        
        // Check if user has submitted feedback this week
        const submittedResult = await pool.request()
            .input('userId', sql.Int, userId)
            .input('userEmail', sql.NVarChar(200), userEmail)
            .input('weekStart', sql.Date, currentWeek.start)
            .input('weekEnd', sql.Date, currentWeek.end)
            .query(`SELECT StoreId FROM WeeklyThirdPartyFeedback 
                    WHERE (StoreManagerId = @userId OR StoreManagerEmail = @userEmail)
                    AND WeekStartDate = @weekStart AND WeekEndDate = @weekEnd`);
        
        const submittedStoreIds = submittedResult.recordset.map(r => r.StoreId);
        
        // Check if reminder already exists for today
        const existingReminder = await pool.request()
            .input('userId', sql.Int, userId)
            .input('userEmail', sql.NVarChar(200), userEmail)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`SELECT Id FROM Notifications 
                    WHERE (UserId = @userId OR UserEmail = @userEmail) 
                    AND Type = 'reminder' 
                    AND CAST(CreatedAt AS DATE) = @today
                    AND Title LIKE '%Weekly Third Party Feedback%'`);
        
        // If no submission this week and no reminder today, create one
        if (submittedResult.recordset.length === 0 && existingReminder.recordset.length === 0) {
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('userEmail', sql.NVarChar(200), userEmail)
                .input('title', sql.NVarChar(200), 'Weekly Third Party Feedback Reminder')
                .input('message', sql.NVarChar(sql.MAX), `Don't forget to submit your weekly third party feedback for this week (${currentWeek.start} to ${currentWeek.end}).`)
                .input('link', sql.NVarChar(500), '/stores/weekly-feedback')
                .input('type', sql.NVarChar(50), 'reminder')
                .query(`INSERT INTO Notifications (UserId, UserEmail, Title, Message, Link, Type, IsRead, CreatedAt)
                        VALUES (@userId, @userEmail, @title, @message, @link, @type, 0, GETDATE())`);
            
            console.log(`[Notification Scheduler] Created reminder for user ${userEmail}`);
        }
        
        return true;
    } catch (err) {
        console.error('[Notification Scheduler] Error checking user notifications:', err);
        return false;
    } finally {
        if (pool) await pool.close();
    }
}

// Mark feedback-related notifications as read when user submits
async function markFeedbackNotificationsRead(userId, userEmail) {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('userEmail', sql.NVarChar(200), userEmail)
            .query(`UPDATE Notifications 
                    SET IsRead = 1 
                    WHERE (UserId = @userId OR UserEmail = @userEmail) 
                    AND Type = 'reminder' 
                    AND Title LIKE '%Weekly Third Party Feedback%'
                    AND IsRead = 0`);
        
        console.log(`[Notification Scheduler] Marked feedback reminders as read for ${userEmail}`);
        return true;
    } catch (err) {
        console.error('[Notification Scheduler] Error marking notifications read:', err);
        return false;
    } finally {
        if (pool) await pool.close();
    }
}

module.exports = {
    generateWeeklyFeedbackReminders,
    checkUserNotifications,
    markFeedbackNotificationsRead,
    getCurrentWeekDates
};
