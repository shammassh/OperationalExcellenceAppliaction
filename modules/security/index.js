/**
 * Security Department Module
 * Dashboard for Security Managers to view delivery logs and reports
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

// Database config
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

// Security Department Dashboard
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get summary stats
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const statsResult = await pool.request()
            .input('today', sql.Date, today)
            .input('weekAgo', sql.Date, weekAgo)
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM Security_DeliveryLogs WHERE LogDate = @today AND Status = 'Active') as TodayLogs,
                    (SELECT COUNT(*) FROM Security_DeliveryLogs WHERE LogDate >= @weekAgo AND Status = 'Active') as WeekLogs,
                    (SELECT COUNT(*) FROM Security_DeliveryLogs WHERE Status = 'Active') as TotalLogs,
                    (SELECT COUNT(*) FROM Security_DeliveryLogItems dli 
                     INNER JOIN Security_DeliveryLogs dl ON dli.DeliveryLogId = dl.Id 
                     WHERE dl.LogDate = @today AND dl.Status = 'Active') as TodayItems
            `);
        
        const stats = statsResult.recordset[0];
        
        // Get recent delivery logs
        const logsResult = await pool.request()
            .query(`
                SELECT TOP 20 dl.*, 
                       (SELECT COUNT(*) FROM Security_DeliveryLogItems WHERE DeliveryLogId = dl.Id) as ItemCount
                FROM Security_DeliveryLogs dl
                WHERE dl.Status = 'Active'
                ORDER BY dl.LogDate DESC, dl.CreatedAt DESC
            `);
        
        await pool.close();
        
        const logs = logsResult.recordset;
        
        let logRows = logs.map(log => {
            const logDate = new Date(log.LogDate).toLocaleDateString('en-GB', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });
            return `
                <tr onclick="viewLog(${log.Id})" style="cursor: pointer;">
                    <td>${logDate}</td>
                    <td><span class="premises-badge">${log.Premises}</span></td>
                    <td>${log.FilledBy}</td>
                    <td><span class="item-count">${log.ItemCount} items</span></td>
                    <td>
                        <button class="btn-view" onclick="event.stopPropagation(); viewLog(${log.Id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Security Department Dashboard - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { 
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                        transition: opacity 0.3s;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1400px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .welcome-banner {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 15px;
                        padding: 30px;
                        color: white;
                        margin-bottom: 30px;
                    }
                    .welcome-banner h2 {
                        font-size: 26px;
                        margin-bottom: 8px;
                    }
                    .welcome-banner p {
                        opacity: 0.9;
                        font-size: 15px;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .stat-card {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        text-align: center;
                        border-top: 4px solid #667eea;
                    }
                    .stat-card.today { border-top-color: #2ecc71; }
                    .stat-card.week { border-top-color: #3498db; }
                    .stat-card.total { border-top-color: #9b59b6; }
                    .stat-card.items { border-top-color: #e67e22; }
                    .stat-number {
                        font-size: 36px;
                        font-weight: 700;
                        color: #333;
                        margin-bottom: 5px;
                    }
                    .stat-label {
                        color: #666;
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        margin-bottom: 25px;
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .filter-row {
                        display: flex;
                        gap: 15px;
                        margin-bottom: 20px;
                        flex-wrap: wrap;
                    }
                    .filter-row select,
                    .filter-row input {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        min-width: 150px;
                    }
                    .filter-row select:focus,
                    .filter-row input:focus {
                        outline: none;
                        border-color: #667eea;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-size: 13px;
                        font-weight: 600;
                        color: #555;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        border-bottom: 2px solid #dee2e6;
                    }
                    td {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }
                    tr:hover {
                        background: #f8f9fa;
                    }
                    .premises-badge {
                        background: #e3f2fd;
                        color: #1976d2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .item-count {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn-view {
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: background 0.3s;
                    }
                    .btn-view:hover {
                        background: #5a6fd6;
                    }
                    .btn-primary {
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        text-decoration: none;
                    }
                    .btn-primary:hover {
                        background: #5a6fd6;
                    }
                    .empty-state {
                        text-align: center;
                        padding: 60px;
                        color: #666;
                    }
                    .empty-state-icon {
                        font-size: 60px;
                        margin-bottom: 15px;
                    }
                    .quick-links {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .quick-link {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        text-decoration: none;
                        color: #333;
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        transition: all 0.3s;
                        border-left: 4px solid #667eea;
                    }
                    .quick-link:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                    }
                    .quick-link-icon {
                        font-size: 32px;
                    }
                    .quick-link-text h4 {
                        margin-bottom: 5px;
                        font-size: 16px;
                    }
                    .quick-link-text p {
                        color: #666;
                        font-size: 13px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔒 Security Department</h1>
                    <div class="header-nav">
                        <a href="/dashboard">← Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="welcome-banner">
                        <h2>Welcome, ${user.displayName}</h2>
                        <p>Security Department Dashboard - Monitor delivery logs and security activities</p>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card today">
                            <div class="stat-number">${stats.TodayLogs || 0}</div>
                            <div class="stat-label">Today's Logs</div>
                        </div>
                        <div class="stat-card items">
                            <div class="stat-number">${stats.TodayItems || 0}</div>
                            <div class="stat-label">Today's Deliveries</div>
                        </div>
                        <div class="stat-card week">
                            <div class="stat-number">${stats.WeekLogs || 0}</div>
                            <div class="stat-label">This Week</div>
                        </div>
                        <div class="stat-card total">
                            <div class="stat-number">${stats.TotalLogs || 0}</div>
                            <div class="stat-label">Total Logs</div>
                        </div>
                    </div>
                    
                    <div class="quick-links">
                        <a href="/security-services/delivery-log" class="quick-link">
                            <div class="quick-link-icon">📦</div>
                            <div class="quick-link-text">
                                <h4>New Delivery Log</h4>
                                <p>Create a new delivery log entry</p>
                            </div>
                        </a>
                        <a href="/security-services" class="quick-link">
                            <div class="quick-link-icon">🛡️</div>
                            <div class="quick-link-text">
                                <h4>Security Services</h4>
                                <p>Access all security forms and services</p>
                            </div>
                        </a>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">📋 Recent Delivery Logs</div>
                            <a href="/security-services/delivery-log" class="btn-primary">+ New Entry</a>
                        </div>
                        
                        <div class="filter-row">
                            <input type="date" id="filterFromDate" onchange="filterLogs()" placeholder="From Date">
                            <input type="date" id="filterToDate" onchange="filterLogs()" placeholder="To Date">
                            <select id="filterPremises" onchange="filterLogs()">
                                <option value="">All Premises</option>
                                <option value="HO Dbayeh Block A">HO Dbayeh Block A</option>
                                <option value="HO Dbayeh Block B">HO Dbayeh Block B</option>
                                <option value="Zouk HO">Zouk HO</option>
                            </select>
                        </div>
                        
                        <div id="logsTableContainer">
                            ${logs.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Premises</th>
                                            <th>Filled By</th>
                                            <th>Items</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="logsBody">
                                        ${logRows}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">
                                    <div class="empty-state-icon">📋</div>
                                    <p>No delivery logs found</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <script>
                    function viewLog(id) {
                        window.location.href = '/security-services/delivery-log/' + id;
                    }
                    
                    async function filterLogs() {
                        const fromDate = document.getElementById('filterFromDate').value;
                        const toDate = document.getElementById('filterToDate').value;
                        const premises = document.getElementById('filterPremises').value;
                        
                        let url = '/security/api/delivery-logs?';
                        if (fromDate) url += 'fromDate=' + fromDate + '&';
                        if (toDate) url += 'toDate=' + toDate + '&';
                        if (premises) url += 'premises=' + encodeURIComponent(premises);
                        
                        try {
                            const res = await fetch(url);
                            const data = await res.json();
                            
                            const container = document.getElementById('logsTableContainer');
                            
                            if (!data.logs || data.logs.length === 0) {
                                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>No delivery logs found</p></div>';
                                return;
                            }
                            
                            let rows = data.logs.map(log => {
                                const logDate = new Date(log.LogDate).toLocaleDateString('en-GB', { 
                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                                });
                                return '<tr onclick="viewLog(' + log.Id + ')" style="cursor: pointer;">' +
                                    '<td>' + logDate + '</td>' +
                                    '<td><span class="premises-badge">' + log.Premises + '</span></td>' +
                                    '<td>' + log.FilledBy + '</td>' +
                                    '<td><span class="item-count">' + log.ItemCount + ' items</span></td>' +
                                    '<td><button class="btn-view" onclick="event.stopPropagation(); viewLog(' + log.Id + ')">View</button></td>' +
                                '</tr>';
                            }).join('');
                            
                            container.innerHTML = '<table><thead><tr><th>Date</th><th>Premises</th><th>Filled By</th><th>Items</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
                        } catch (err) {
                            console.error('Error filtering logs:', err);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading security dashboard:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Get Delivery Logs for Dashboard
router.get('/api/delivery-logs', async (req, res) => {
    try {
        const { fromDate, toDate, premises } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT dl.*, 
                   (SELECT COUNT(*) FROM Security_DeliveryLogItems WHERE DeliveryLogId = dl.Id) as ItemCount
            FROM Security_DeliveryLogs dl
            WHERE dl.Status = 'Active'
        `;
        
        const request = pool.request();
        
        if (fromDate) {
            query += ' AND dl.LogDate >= @fromDate';
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ' AND dl.LogDate <= @toDate';
            request.input('toDate', sql.Date, toDate);
        }
        if (premises) {
            query += ' AND dl.Premises = @premises';
            request.input('premises', sql.NVarChar, premises);
        }
        
        query += ' ORDER BY dl.LogDate DESC, dl.CreatedAt DESC';
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ logs: result.recordset });
    } catch (err) {
        console.error('Error fetching delivery logs:', err);
        res.json({ logs: [], error: err.message });
    }
});

module.exports = router;
