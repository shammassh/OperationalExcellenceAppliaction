/**
 * Notifications Routes
 * Handles in-app notifications for users
 */

const express = require('express');
const router = express.Router();
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

// Get unread notification count for current user
router.get('/count', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser?.id;
        const userEmail = req.currentUser?.email;
        
        const result = await pool.request()
            .input('userId', sql.Int, userId || 0)
            .input('userEmail', sql.NVarChar(200), userEmail || '')
            .query(`SELECT COUNT(*) as count FROM Notifications 
                    WHERE (UserId = @userId OR UserEmail = @userEmail) AND IsRead = 0`);
        
        await pool.close();
        
        res.json({ count: result.recordset[0].count });
    } catch (err) {
        console.error('Error getting notification count:', err);
        res.json({ count: 0 });
    }
});

// Get all notifications for current user
router.get('/list', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser?.id;
        const userEmail = req.currentUser?.email;
        
        const result = await pool.request()
            .input('userId', sql.Int, userId || 0)
            .input('userEmail', sql.NVarChar(200), userEmail || '')
            .query(`SELECT TOP 20 * FROM Notifications 
                    WHERE UserId = @userId OR UserEmail = @userEmail
                    ORDER BY CreatedAt DESC`);
        
        await pool.close();
        
        res.json({ notifications: result.recordset });
    } catch (err) {
        console.error('Error getting notifications:', err);
        res.json({ notifications: [] });
    }
});

// Mark notification as read
router.post('/mark-read/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const notificationId = req.params.id;
        
        await pool.request()
            .input('id', sql.Int, notificationId)
            .query(`UPDATE Notifications SET IsRead = 1 WHERE Id = @id`);
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser?.id;
        const userEmail = req.currentUser?.email;
        
        await pool.request()
            .input('userId', sql.Int, userId || 0)
            .input('userEmail', sql.NVarChar(200), userEmail || '')
            .query(`UPDATE Notifications SET IsRead = 1 
                    WHERE UserId = @userId OR UserEmail = @userEmail`);
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking all as read:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Notifications page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser?.id;
        const userEmail = req.currentUser?.email;
        
        const result = await pool.request()
            .input('userId', sql.Int, userId || 0)
            .input('userEmail', sql.NVarChar(200), userEmail || '')
            .query(`SELECT * FROM Notifications 
                    WHERE UserId = @userId OR UserEmail = @userEmail
                    ORDER BY CreatedAt DESC`);
        
        await pool.close();
        
        const notificationsHtml = result.recordset.length > 0 
            ? result.recordset.map(n => `
                <div class="notification-item ${n.IsRead ? 'read' : 'unread'}" data-id="${n.Id}">
                    <div class="notification-icon">${getTypeIcon(n.Type)}</div>
                    <div class="notification-content">
                        <div class="notification-title">${n.Title}</div>
                        <div class="notification-message">${n.Message}</div>
                        <div class="notification-time">${formatDate(n.CreatedAt)}</div>
                    </div>
                    ${n.Link ? `<a href="${n.Link}" class="notification-action">View →</a>` : ''}
                </div>
            `).join('')
            : '<div class="empty-state"><div class="icon">🔔</div><p>No notifications yet</p></div>';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Notifications - ${process.env.APP_NAME}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .header-nav a:hover { background: rgba(255,255,255,0.25); }
                    .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); }
                    .card-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
                    .card-header h2 { font-size: 18px; color: #333; }
                    .mark-all-btn { padding: 8px 16px; background: #0078d4; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
                    .mark-all-btn:hover { background: #005a9e; }
                    
                    .notification-item { display: flex; align-items: flex-start; padding: 20px; border-bottom: 1px solid #f0f0f0; gap: 15px; transition: background 0.2s; }
                    .notification-item:hover { background: #f8f9fa; }
                    .notification-item.unread { background: #f0f7ff; border-left: 4px solid #0078d4; }
                    .notification-item.read { opacity: 0.7; }
                    .notification-icon { font-size: 28px; }
                    .notification-content { flex: 1; }
                    .notification-title { font-weight: 600; color: #333; margin-bottom: 5px; }
                    .notification-message { color: #666; font-size: 14px; margin-bottom: 8px; }
                    .notification-time { color: #999; font-size: 12px; }
                    .notification-action { padding: 8px 16px; background: #e3f2fd; color: #0078d4; text-decoration: none; border-radius: 6px; font-size: 13px; white-space: nowrap; }
                    .notification-action:hover { background: #0078d4; color: white; }
                    
                    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
                    .empty-state .icon { font-size: 64px; margin-bottom: 15px; opacity: 0.5; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔔 Notifications</h1>
                    <div class="header-nav">
                        <a href="/dashboard">← Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <h2>Your Notifications</h2>
                            ${result.recordset.some(n => !n.IsRead) ? '<button class="mark-all-btn" onclick="markAllRead()">✓ Mark All Read</button>' : ''}
                        </div>
                        ${notificationsHtml}
                    </div>
                </div>
                
                <script>
                    async function markAllRead() {
                        try {
                            await fetch('/notifications/mark-all-read', { method: 'POST' });
                            location.reload();
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    
                    // Mark as read when clicking unread notification
                    document.querySelectorAll('.notification-item.unread').forEach(item => {
                        item.addEventListener('click', async function() {
                            const id = this.dataset.id;
                            await fetch('/notifications/mark-read/' + id, { method: 'POST' });
                            this.classList.remove('unread');
                            this.classList.add('read');
                        });
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading notifications:', err);
        res.status(500).send('Error loading notifications: ' + err.message);
    }
});

// Helper functions
function getTypeIcon(type) {
    const icons = {
        'reminder': '⏰',
        'feedback': '📋',
        'approval': '✅',
        'alert': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || '🔔';
}

function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' minutes ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' days ago';
    
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

module.exports = router;
