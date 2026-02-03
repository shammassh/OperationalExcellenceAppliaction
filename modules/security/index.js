/**
 * Security Department Module
 * Dashboard for Security Managers to view delivery logs and patrol sheets
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

// Security Department Dashboard - Main Page with 2 Cards
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const today = new Date().toISOString().split('T')[0];
        
        const statsResult = await pool.request()
            .input('today', sql.Date, today)
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM Security_DeliveryLogs WHERE Status = 'Active') as TotalDeliveryLogs,
                    (SELECT COUNT(*) FROM Security_DeliveryLogs WHERE LogDate = @today AND Status = 'Active') as TodayDeliveryLogs,
                    (SELECT COUNT(*) FROM Security_PatrolSheets WHERE Status = 'Active') as TotalPatrolSheets,
                    (SELECT COUNT(*) FROM Security_PatrolSheets WHERE PatrolDate = @today AND Status = 'Active') as TodayPatrolSheets,
                    (SELECT COUNT(*) FROM Security_EntranceForms WHERE Status = 'Active') as TotalEntranceForms,
                    (SELECT COUNT(*) FROM Security_EntranceForms WHERE FormDate = @today AND Status = 'Active') as TodayEntranceForms,
                    (SELECT COUNT(*) FROM Security_AttendanceReports WHERE Status = 'Active') as TotalAttendanceReports,
                    (SELECT COUNT(*) FROM Security_AttendanceReports WHERE ReportDate = @today AND Status = 'Active') as TodayAttendanceReports,
                    (SELECT COUNT(*) FROM Security_VisitorCars WHERE Status = 'Active') as TotalVisitorCars,
                    (SELECT COUNT(*) FROM Security_VisitorCars WHERE RecordDate = @today AND Status = 'Active') as TodayVisitorCars
            `);
        
        await pool.close();
        
        const stats = statsResult.recordset[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Security Department - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        min-height: 100vh;
                    }
                    .header {
                        background: rgba(0,0,0,0.3);
                        backdrop-filter: blur(10px);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
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
                        max-width: 1000px; 
                        margin: 0 auto; 
                        padding: 50px 20px; 
                    }
                    .welcome-card {
                        background: rgba(255,255,255,0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 15px;
                        padding: 30px;
                        color: white;
                        margin-bottom: 40px;
                        border: 1px solid rgba(255,255,255,0.1);
                        text-align: center;
                    }
                    .welcome-card h2 {
                        margin-bottom: 10px;
                        font-size: 28px;
                    }
                    .welcome-card p {
                        opacity: 0.8;
                        font-size: 16px;
                    }
                    .cards-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                        gap: 30px;
                    }
                    .dashboard-card {
                        background: white;
                        border-radius: 20px;
                        padding: 40px;
                        text-decoration: none;
                        color: #333;
                        transition: all 0.3s ease;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        border: 3px solid transparent;
                    }
                    .dashboard-card:hover {
                        transform: translateY(-10px);
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    }
                    .dashboard-card.delivery {
                        border-bottom: 5px solid #1976d2;
                    }
                    .dashboard-card.delivery:hover {
                        border-color: #1976d2;
                    }
                    .dashboard-card.patrol {
                        border-bottom: 5px solid #2e7d32;
                    }
                    .dashboard-card.patrol:hover {
                        border-color: #2e7d32;
                    }
                    .dashboard-card.entrance {
                        border-bottom: 5px solid #f57c00;
                    }
                    .dashboard-card.entrance:hover {
                        border-color: #f57c00;
                    }
                    .dashboard-card.attendance {
                        border-bottom: 5px solid #7b1fa2;
                    }
                    .dashboard-card.attendance:hover {
                        border-color: #7b1fa2;
                    }
                    .dashboard-card.visitor {
                        border-bottom: 5px solid #0d47a1;
                    }
                    .dashboard-card.visitor:hover {
                        border-color: #0d47a1;
                    }
                    .card-icon {
                        font-size: 80px;
                        margin-bottom: 20px;
                    }
                    .card-title {
                        font-size: 24px;
                        font-weight: 600;
                        margin-bottom: 10px;
                    }
                    .card-desc {
                        color: #666;
                        font-size: 15px;
                        line-height: 1.6;
                        margin-bottom: 20px;
                    }
                    .card-stats {
                        display: flex;
                        gap: 30px;
                        margin-top: 15px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        width: 100%;
                        justify-content: center;
                    }
                    .stat-item {
                        text-align: center;
                    }
                    .stat-number {
                        font-size: 28px;
                        font-weight: 700;
                        color: #333;
                    }
                    .stat-number.delivery { color: #1976d2; }
                    .stat-number.patrol { color: #2e7d32; }
                    .stat-number.entrance { color: #f57c00; }
                    .stat-number.attendance { color: #7b1fa2; }
                    .stat-number.visitor { color: #0d47a1; }
                    .stat-label {
                        font-size: 12px;
                        color: #888;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .view-btn {
                        margin-top: 20px;
                        padding: 12px 30px;
                        border-radius: 25px;
                        font-size: 14px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .view-btn.delivery {
                        background: #e3f2fd;
                        color: #1976d2;
                    }
                    .view-btn.patrol {
                        background: #e8f5e9;
                        color: #2e7d32;
                    }
                    .view-btn.entrance {
                        background: #fff3e0;
                        color: #f57c00;
                    }
                    .view-btn.attendance {
                        background: #f3e5f5;
                        color: #7b1fa2;
                    }
                    .view-btn.visitor {
                        background: #e3f2fd;
                        color: #0d47a1;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔒 Security Department</h1>
                    <div class="header-nav">
                        <a href="/security-services">Security Services</a>
                        <a href="/dashboard">← Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="welcome-card">
                        <h2>Welcome, ${user.displayName}</h2>
                        <p>Security Department Dashboard - View and manage security logs</p>
                    </div>
                    
                    <div class="cards-grid">
                        <a href="/security/attendance-reports" class="dashboard-card attendance">
                            <div class="card-icon">📋</div>
                            <div class="card-title">Employee Attendance</div>
                            <div class="card-desc">Track employees who come after working hours</div>
                            <div class="card-stats">
                                <div class="stat-item">
                                    <div class="stat-number attendance">${stats.TodayAttendanceReports || 0}</div>
                                    <div class="stat-label">Today</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number attendance">${stats.TotalAttendanceReports || 0}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                            </div>
                            <div class="view-btn attendance">View History →</div>
                        </a>
                        
                        <a href="/security/visitor-cars" class="dashboard-card visitor">
                            <div class="card-icon">🚗</div>
                            <div class="card-title">Visitors Cars</div>
                            <div class="card-desc">Track visitor vehicles and plate numbers</div>
                            <div class="card-stats">
                                <div class="stat-item">
                                    <div class="stat-number visitor">${stats.TodayVisitorCars || 0}</div>
                                    <div class="stat-label">Today</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number visitor">${stats.TotalVisitorCars || 0}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                            </div>
                            <div class="view-btn visitor">View History →</div>
                        </a>
                        
                        <a href="/security/delivery-logs" class="dashboard-card delivery">
                            <div class="card-icon">📦</div>
                            <div class="card-title">Delivery Logs</div>
                            <div class="card-desc">View all delivery log records submitted by security personnel</div>
                            <div class="card-stats">
                                <div class="stat-item">
                                    <div class="stat-number delivery">${stats.TodayDeliveryLogs || 0}</div>
                                    <div class="stat-label">Today</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number delivery">${stats.TotalDeliveryLogs || 0}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                            </div>
                            <div class="view-btn delivery">View History →</div>
                        </a>
                        
                        <a href="/security/patrol-sheets" class="dashboard-card patrol">
                            <div class="card-icon">🚶</div>
                            <div class="card-title">Patrol Sheets</div>
                            <div class="card-desc">View all patrol sheet records submitted by security guards</div>
                            <div class="card-stats">
                                <div class="stat-item">
                                    <div class="stat-number patrol">${stats.TodayPatrolSheets || 0}</div>
                                    <div class="stat-label">Today</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number patrol">${stats.TotalPatrolSheets || 0}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                            </div>
                            <div class="view-btn patrol">View History →</div>
                        </a>
                        
                        <a href="/security/entrance-forms" class="dashboard-card entrance">
                            <div class="card-icon">🚪</div>
                            <div class="card-title">Entrance Forms</div>
                            <div class="card-desc">View all entrance form records for workers and contractors</div>
                            <div class="card-stats">
                                <div class="stat-item">
                                    <div class="stat-number entrance">${stats.TodayEntranceForms || 0}</div>
                                    <div class="stat-label">Today</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number entrance">${stats.TotalEntranceForms || 0}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                            </div>
                            <div class="view-btn entrance">View History →</div>
                        </a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading security dashboard:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Delivery Logs History Page
router.get('/delivery-logs', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const logsResult = await pool.request()
            .query(`
                SELECT dl.*, 
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
                <title>Delivery Logs History - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
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
                        opacity: 0.9;
                        transition: opacity 0.3s;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
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
                        border-color: #1976d2;
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
                        background: #1976d2;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: background 0.3s;
                    }
                    .btn-view:hover {
                        background: #1565c0;
                    }
                    .btn-primary {
                        background: #1976d2;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        text-decoration: none;
                    }
                    .btn-primary:hover {
                        background: #1565c0;
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
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📦 Delivery Logs History</h1>
                    <div class="header-nav">
                        <a href="/security-services/delivery-log">+ New Entry</a>
                        <a href="/security">← Back</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">All Delivery Logs</div>
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
                                    <tbody>
                                        ${logRows}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">
                                    <div class="empty-state-icon">📦</div>
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
                                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>No delivery logs found</p></div>';
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
        console.error('Error loading delivery logs:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Patrol Sheets History Page
router.get('/patrol-sheets', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const patrolsResult = await pool.request()
            .query(`
                SELECT ps.*, 
                       (SELECT COUNT(*) FROM Security_PatrolEntries WHERE PatrolSheetId = ps.Id) as EntryCount
                FROM Security_PatrolSheets ps
                WHERE ps.Status = 'Active'
                ORDER BY ps.PatrolDate DESC, ps.CreatedAt DESC
            `);
        
        await pool.close();
        
        const patrols = patrolsResult.recordset;
        
        let patrolRows = patrols.map(patrol => {
            const patrolDate = new Date(patrol.PatrolDate).toLocaleDateString('en-GB', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });
            return `
                <tr onclick="viewPatrol(${patrol.Id})" style="cursor: pointer;">
                    <td>${patrolDate}</td>
                    <td><span class="location-badge">${patrol.Location}</span></td>
                    <td>${patrol.CreatedBy}</td>
                    <td><span class="entry-count">${patrol.EntryCount} patrols</span></td>
                    <td>
                        <button class="btn-view" onclick="event.stopPropagation(); viewPatrol(${patrol.Id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Patrol Sheets History - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
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
                        opacity: 0.9;
                        transition: opacity 0.3s;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
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
                        border-color: #2e7d32;
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
                    .location-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .entry-count {
                        background: #e0f2f1;
                        color: #00796b;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn-view {
                        background: #2e7d32;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: background 0.3s;
                    }
                    .btn-view:hover {
                        background: #1b5e20;
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
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚶 Patrol Sheets History</h1>
                    <div class="header-nav">
                        <a href="/security-services/patrol-sheet">+ New Entry</a>
                        <a href="/security">← Back</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">All Patrol Sheets</div>
                        </div>
                        
                        <div class="filter-row">
                            <input type="date" id="filterFromDate" onchange="filterPatrols()" placeholder="From Date">
                            <input type="date" id="filterToDate" onchange="filterPatrols()" placeholder="To Date">
                            <select id="filterLocation" onchange="filterPatrols()">
                                <option value="">All Locations</option>
                                <option value="HO Dbayeh">HO Dbayeh</option>
                                <option value="HO Zouk">HO Zouk</option>
                            </select>
                        </div>
                        
                        <div id="patrolsTableContainer">
                            ${patrols.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Location</th>
                                            <th>Created By</th>
                                            <th>Entries</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${patrolRows}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">
                                    <div class="empty-state-icon">🚶</div>
                                    <p>No patrol sheets found</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <script>
                    function viewPatrol(id) {
                        window.location.href = '/security-services/patrol-sheet/' + id;
                    }
                    
                    async function filterPatrols() {
                        const fromDate = document.getElementById('filterFromDate').value;
                        const toDate = document.getElementById('filterToDate').value;
                        const location = document.getElementById('filterLocation').value;
                        
                        let url = '/security/api/patrol-sheets?';
                        if (fromDate) url += 'fromDate=' + fromDate + '&';
                        if (toDate) url += 'toDate=' + toDate + '&';
                        if (location) url += 'location=' + encodeURIComponent(location);
                        
                        try {
                            const res = await fetch(url);
                            const data = await res.json();
                            
                            const container = document.getElementById('patrolsTableContainer');
                            
                            if (!data.sheets || data.sheets.length === 0) {
                                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚶</div><p>No patrol sheets found</p></div>';
                                return;
                            }
                            
                            let rows = data.sheets.map(patrol => {
                                const patrolDate = new Date(patrol.PatrolDate).toLocaleDateString('en-GB', { 
                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                                });
                                return '<tr onclick="viewPatrol(' + patrol.Id + ')" style="cursor: pointer;">' +
                                    '<td>' + patrolDate + '</td>' +
                                    '<td><span class="location-badge">' + patrol.Location + '</span></td>' +
                                    '<td>' + patrol.CreatedBy + '</td>' +
                                    '<td><span class="entry-count">' + patrol.EntryCount + ' patrols</span></td>' +
                                    '<td><button class="btn-view" onclick="event.stopPropagation(); viewPatrol(' + patrol.Id + ')">View</button></td>' +
                                '</tr>';
                            }).join('');
                            
                            container.innerHTML = '<table><thead><tr><th>Date</th><th>Location</th><th>Created By</th><th>Entries</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
                        } catch (err) {
                            console.error('Error filtering patrols:', err);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading patrol sheets:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Get Delivery Logs
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

// API: Get Patrol Sheets
router.get('/api/patrol-sheets', async (req, res) => {
    try {
        const { fromDate, toDate, location } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT ps.*, 
                   (SELECT COUNT(*) FROM Security_PatrolEntries WHERE PatrolSheetId = ps.Id) as EntryCount
            FROM Security_PatrolSheets ps
            WHERE ps.Status = 'Active'
        `;
        
        const request = pool.request();
        
        if (fromDate) {
            query += ' AND ps.PatrolDate >= @fromDate';
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ' AND ps.PatrolDate <= @toDate';
            request.input('toDate', sql.Date, toDate);
        }
        if (location) {
            query += ' AND ps.Location = @location';
            request.input('location', sql.NVarChar, location);
        }
        
        query += ' ORDER BY ps.PatrolDate DESC, ps.CreatedAt DESC';
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ sheets: result.recordset });
    } catch (err) {
        console.error('Error fetching patrol sheets:', err);
        res.json({ sheets: [], error: err.message });
    }
});

// Entrance Forms History Page
router.get('/entrance-forms', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const entranceResult = await pool.request()
            .query(`
                SELECT ef.*, 
                       (SELECT COUNT(*) FROM Security_EntranceEntries WHERE EntranceFormId = ef.Id) as EntryCount
                FROM Security_EntranceForms ef
                WHERE ef.Status = 'Active'
                ORDER BY ef.FormDate DESC, ef.CreatedAt DESC
            `);
        
        await pool.close();
        
        const entranceForms = entranceResult.recordset;
        
        let entranceRows = entranceForms.map(form => {
            const formDate = new Date(form.FormDate).toLocaleDateString('en-GB', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });
            return `
                <tr onclick="viewEntrance(${form.Id})" style="cursor: pointer;">
                    <td>${formDate}</td>
                    <td><span class="entrance-badge">${form.Entrance}</span></td>
                    <td>${form.Location}</td>
                    <td>${form.CreatedBy}</td>
                    <td><span class="entry-count">${form.EntryCount} entries</span></td>
                    <td>
                        <button class="btn-view" onclick="event.stopPropagation(); viewEntrance(${form.Id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Entrance Forms History - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
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
                        opacity: 0.9;
                        transition: opacity 0.3s;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
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
                        border-color: #f57c00;
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
                    .entrance-badge {
                        background: #fff3e0;
                        color: #f57c00;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .entry-count {
                        background: #e0f2f1;
                        color: #00796b;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn-view {
                        background: #f57c00;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: background 0.3s;
                    }
                    .btn-view:hover {
                        background: #ef6c00;
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
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚪 Entrance Forms History</h1>
                    <div class="header-nav">
                        <a href="/security-services/entrance-form">+ New Entry</a>
                        <a href="/security">← Back</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">All Entrance Forms</div>
                        </div>
                        
                        <div class="filter-row">
                            <input type="date" id="filterFromDate" onchange="filterEntrance()" placeholder="From Date">
                            <input type="date" id="filterToDate" onchange="filterEntrance()" placeholder="To Date">
                            <select id="filterEntrance" onchange="filterEntrance()">
                                <option value="">All Entrances</option>
                                <option value="Lower Entrance">Lower Entrance</option>
                                <option value="Upper Entrance">Upper Entrance</option>
                            </select>
                            <select id="filterLocation" onchange="filterEntrance()">
                                <option value="">All Locations</option>
                                <option value="HO Dbayeh">HO Dbayeh</option>
                                <option value="HO Zouk">HO Zouk</option>
                            </select>
                        </div>
                        
                        <div id="entranceTableContainer">
                            ${entranceForms.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Entrance</th>
                                            <th>Location</th>
                                            <th>Created By</th>
                                            <th>Entries</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${entranceRows}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">
                                    <div class="empty-state-icon">🚪</div>
                                    <p>No entrance forms found</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <script>
                    function viewEntrance(id) {
                        window.location.href = '/security-services/entrance-form/' + id;
                    }
                    
                    async function filterEntrance() {
                        const fromDate = document.getElementById('filterFromDate').value;
                        const toDate = document.getElementById('filterToDate').value;
                        const entrance = document.getElementById('filterEntrance').value;
                        const location = document.getElementById('filterLocation').value;
                        
                        let url = '/security/api/entrance-forms?';
                        if (fromDate) url += 'fromDate=' + fromDate + '&';
                        if (toDate) url += 'toDate=' + toDate + '&';
                        if (entrance) url += 'entrance=' + encodeURIComponent(entrance) + '&';
                        if (location) url += 'location=' + encodeURIComponent(location);
                        
                        try {
                            const res = await fetch(url);
                            const data = await res.json();
                            
                            const container = document.getElementById('entranceTableContainer');
                            
                            if (!data.forms || data.forms.length === 0) {
                                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚪</div><p>No entrance forms found</p></div>';
                                return;
                            }
                            
                            let rows = data.forms.map(form => {
                                const formDate = new Date(form.FormDate).toLocaleDateString('en-GB', { 
                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                                });
                                return '<tr onclick="viewEntrance(' + form.Id + ')" style="cursor: pointer;">' +
                                    '<td>' + formDate + '</td>' +
                                    '<td><span class="entrance-badge">' + form.Entrance + '</span></td>' +
                                    '<td>' + form.Location + '</td>' +
                                    '<td>' + form.CreatedBy + '</td>' +
                                    '<td><span class="entry-count">' + form.EntryCount + ' entries</span></td>' +
                                    '<td><button class="btn-view" onclick="event.stopPropagation(); viewEntrance(' + form.Id + ')">View</button></td>' +
                                '</tr>';
                            }).join('');
                            
                            container.innerHTML = '<table><thead><tr><th>Date</th><th>Entrance</th><th>Location</th><th>Created By</th><th>Entries</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
                        } catch (err) {
                            console.error('Error filtering entrance forms:', err);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading entrance forms:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Get Entrance Forms
router.get('/api/entrance-forms', async (req, res) => {
    try {
        const { fromDate, toDate, entrance, location } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT ef.*, 
                   (SELECT COUNT(*) FROM Security_EntranceEntries WHERE EntranceFormId = ef.Id) as EntryCount
            FROM Security_EntranceForms ef
            WHERE ef.Status = 'Active'
        `;
        
        const request = pool.request();
        
        if (fromDate) {
            query += ' AND ef.FormDate >= @fromDate';
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ' AND ef.FormDate <= @toDate';
            request.input('toDate', sql.Date, toDate);
        }
        if (entrance) {
            query += ' AND ef.Entrance = @entrance';
            request.input('entrance', sql.NVarChar, entrance);
        }
        if (location) {
            query += ' AND ef.Location = @location';
            request.input('location', sql.NVarChar, location);
        }
        
        query += ' ORDER BY ef.FormDate DESC, ef.CreatedAt DESC';
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ forms: result.recordset });
    } catch (err) {
        console.error('Error fetching entrance forms:', err);
        res.json({ forms: [], error: err.message });
    }
});

// Attendance Reports History Page
router.get('/attendance-reports', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const attendanceResult = await pool.request()
            .query(`
                SELECT ar.*, 
                       (SELECT COUNT(*) FROM Security_AttendanceEntries WHERE AttendanceReportId = ar.Id) as EntryCount
                FROM Security_AttendanceReports ar
                WHERE ar.Status = 'Active'
                ORDER BY ar.ReportDate DESC, ar.CreatedAt DESC
            `);
        
        await pool.close();
        
        const attendanceReports = attendanceResult.recordset;
        
        let attendanceRows = attendanceReports.map(report => {
            const reportDate = new Date(report.ReportDate).toLocaleDateString('en-GB', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });
            return `
                <tr onclick="viewReport(${report.Id})" style="cursor: pointer;">
                    <td>${reportDate}</td>
                    <td><span class="location-badge">${report.Location}</span></td>
                    <td>${report.CreatedBy}</td>
                    <td><span class="entry-count">${report.EntryCount} employees</span></td>
                    <td>
                        <button class="btn-view" onclick="event.stopPropagation(); viewReport(${report.Id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Employee Attendance Reports - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%);
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
                        opacity: 0.9;
                        transition: opacity 0.3s;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
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
                        border-color: #7b1fa2;
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
                    .location-badge {
                        background: #f3e5f5;
                        color: #7b1fa2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .entry-count {
                        background: #e0f2f1;
                        color: #00796b;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn-view {
                        background: #7b1fa2;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: background 0.3s;
                    }
                    .btn-view:hover {
                        background: #6a1b9a;
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
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Employee Attendance Reports</h1>
                    <div class="header-nav">
                        <a href="/security-services/attendance-report">+ New Report</a>
                        <a href="/security">← Back</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">All Attendance Reports (After Working Hours)</div>
                        </div>
                        
                        <div class="filter-row">
                            <input type="date" id="filterFromDate" onchange="filterReports()" placeholder="From Date">
                            <input type="date" id="filterToDate" onchange="filterReports()" placeholder="To Date">
                            <select id="filterLocation" onchange="filterReports()">
                                <option value="">All Locations</option>
                                <option value="HO Zouk">HO Zouk</option>
                                <option value="HO Dbayeh">HO Dbayeh</option>
                            </select>
                        </div>
                        
                        <div id="reportsTableContainer">
                            ${attendanceReports.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Location</th>
                                            <th>Created By</th>
                                            <th>Employees</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${attendanceRows}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">
                                    <div class="empty-state-icon">📋</div>
                                    <p>No attendance reports found</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <script>
                    function viewReport(id) {
                        window.location.href = '/security-services/attendance-report/' + id;
                    }
                    
                    async function filterReports() {
                        const fromDate = document.getElementById('filterFromDate').value;
                        const toDate = document.getElementById('filterToDate').value;
                        const location = document.getElementById('filterLocation').value;
                        
                        let url = '/security/api/attendance-reports?';
                        if (fromDate) url += 'fromDate=' + fromDate + '&';
                        if (toDate) url += 'toDate=' + toDate + '&';
                        if (location) url += 'location=' + encodeURIComponent(location);
                        
                        try {
                            const res = await fetch(url);
                            const data = await res.json();
                            
                            const container = document.getElementById('reportsTableContainer');
                            
                            if (!data.reports || data.reports.length === 0) {
                                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>No attendance reports found</p></div>';
                                return;
                            }
                            
                            let rows = data.reports.map(report => {
                                const reportDate = new Date(report.ReportDate).toLocaleDateString('en-GB', { 
                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                                });
                                return '<tr onclick="viewReport(' + report.Id + ')" style="cursor: pointer;">' +
                                    '<td>' + reportDate + '</td>' +
                                    '<td><span class="location-badge">' + report.Location + '</span></td>' +
                                    '<td>' + report.CreatedBy + '</td>' +
                                    '<td><span class="entry-count">' + report.EntryCount + ' employees</span></td>' +
                                    '<td><button class="btn-view" onclick="event.stopPropagation(); viewReport(' + report.Id + ')">View</button></td>' +
                                '</tr>';
                            }).join('');
                            
                            container.innerHTML = '<table><thead><tr><th>Date</th><th>Location</th><th>Created By</th><th>Employees</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
                        } catch (err) {
                            console.error('Error filtering reports:', err);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading attendance reports:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Get Attendance Reports
router.get('/api/attendance-reports', async (req, res) => {
    try {
        const { fromDate, toDate, location } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT ar.*, 
                   (SELECT COUNT(*) FROM Security_AttendanceEntries WHERE AttendanceReportId = ar.Id) as EntryCount
            FROM Security_AttendanceReports ar
            WHERE ar.Status = 'Active'
        `;
        
        const request = pool.request();
        
        if (fromDate) {
            query += ' AND ar.ReportDate >= @fromDate';
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ' AND ar.ReportDate <= @toDate';
            request.input('toDate', sql.Date, toDate);
        }
        if (location) {
            query += ' AND ar.Location = @location';
            request.input('location', sql.NVarChar, location);
        }
        
        query += ' ORDER BY ar.ReportDate DESC, ar.CreatedAt DESC';
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ reports: result.recordset });
    } catch (err) {
        console.error('Error fetching attendance reports:', err);
        res.json({ reports: [], error: err.message });
    }
});

// Visitor Cars History Page
router.get('/visitor-cars', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const carsResult = await pool.request()
            .query(`
                SELECT vc.*, 
                       (SELECT COUNT(*) FROM Security_VisitorCarEntries WHERE VisitorCarId = vc.Id) as EntryCount
                FROM Security_VisitorCars vc
                WHERE vc.Status = 'Active'
                ORDER BY vc.RecordDate DESC, vc.CreatedAt DESC
            `);
        
        await pool.close();
        
        const visitorCars = carsResult.recordset;
        
        let carsRows = visitorCars.map(record => {
            const recordDate = new Date(record.RecordDate).toLocaleDateString('en-GB', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });
            return `
                <tr onclick="viewRecord(${record.Id})" style="cursor: pointer;">
                    <td>${recordDate}</td>
                    <td><span class="location-badge">${record.Location}</span></td>
                    <td>${record.CreatedBy}</td>
                    <td><span class="entry-count">${record.EntryCount} vehicles</span></td>
                    <td>
                        <button class="btn-view" onclick="event.stopPropagation(); viewRecord(${record.Id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Visitors Cars Records - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
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
                        opacity: 0.9;
                        transition: opacity 0.3s;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
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
                        border-color: #0d47a1;
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
                    .location-badge {
                        background: #e3f2fd;
                        color: #0d47a1;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .entry-count {
                        background: #e0f2f1;
                        color: #00796b;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn-view {
                        background: #0d47a1;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: background 0.3s;
                    }
                    .btn-view:hover {
                        background: #0a3d91;
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
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚗 Visitors Cars Records</h1>
                    <div class="header-nav">
                        <a href="/security-services/visitor-cars">+ New Record</a>
                        <a href="/security">← Back</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">All Visitor Cars Records</div>
                        </div>
                        
                        <div class="filter-row">
                            <input type="date" id="filterFromDate" onchange="filterRecords()" placeholder="From Date">
                            <input type="date" id="filterToDate" onchange="filterRecords()" placeholder="To Date">
                            <select id="filterLocation" onchange="filterRecords()">
                                <option value="">All Locations</option>
                                <option value="HO Zouk">HO Zouk</option>
                                <option value="HO Dbayeh">HO Dbayeh</option>
                            </select>
                        </div>
                        
                        <div id="recordsTableContainer">
                            ${visitorCars.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Location</th>
                                            <th>Created By</th>
                                            <th>Vehicles</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${carsRows}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">
                                    <div class="empty-state-icon">🚗</div>
                                    <p>No visitor cars records found</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <script>
                    function viewRecord(id) {
                        window.location.href = '/security-services/visitor-cars/' + id;
                    }
                    
                    async function filterRecords() {
                        const fromDate = document.getElementById('filterFromDate').value;
                        const toDate = document.getElementById('filterToDate').value;
                        const location = document.getElementById('filterLocation').value;
                        
                        let url = '/security/api/visitor-cars?';
                        if (fromDate) url += 'fromDate=' + fromDate + '&';
                        if (toDate) url += 'toDate=' + toDate + '&';
                        if (location) url += 'location=' + encodeURIComponent(location);
                        
                        try {
                            const res = await fetch(url);
                            const data = await res.json();
                            
                            const container = document.getElementById('recordsTableContainer');
                            
                            if (!data.records || data.records.length === 0) {
                                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚗</div><p>No visitor cars records found</p></div>';
                                return;
                            }
                            
                            let rows = data.records.map(record => {
                                const recordDate = new Date(record.RecordDate).toLocaleDateString('en-GB', { 
                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                                });
                                return '<tr onclick="viewRecord(' + record.Id + ')" style="cursor: pointer;">' +
                                    '<td>' + recordDate + '</td>' +
                                    '<td><span class="location-badge">' + record.Location + '</span></td>' +
                                    '<td>' + record.CreatedBy + '</td>' +
                                    '<td><span class="entry-count">' + record.EntryCount + ' vehicles</span></td>' +
                                    '<td><button class="btn-view" onclick="event.stopPropagation(); viewRecord(' + record.Id + ')">View</button></td>' +
                                '</tr>';
                            }).join('');
                            
                            container.innerHTML = '<table><thead><tr><th>Date</th><th>Location</th><th>Created By</th><th>Vehicles</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
                        } catch (err) {
                            console.error('Error filtering records:', err);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading visitor cars records:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Get Visitor Cars
router.get('/api/visitor-cars', async (req, res) => {
    try {
        const { fromDate, toDate, location } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT vc.*, 
                   (SELECT COUNT(*) FROM Security_VisitorCarEntries WHERE VisitorCarId = vc.Id) as EntryCount
            FROM Security_VisitorCars vc
            WHERE vc.Status = 'Active'
        `;
        
        const request = pool.request();
        
        if (fromDate) {
            query += ' AND vc.RecordDate >= @fromDate';
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ' AND vc.RecordDate <= @toDate';
            request.input('toDate', sql.Date, toDate);
        }
        if (location) {
            query += ' AND vc.Location = @location';
            request.input('location', sql.NVarChar, location);
        }
        
        query += ' ORDER BY vc.RecordDate DESC, vc.CreatedAt DESC';
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ records: result.recordset });
    } catch (err) {
        console.error('Error fetching visitor cars:', err);
        res.json({ records: [], error: err.message });
    }
});

module.exports = router;
