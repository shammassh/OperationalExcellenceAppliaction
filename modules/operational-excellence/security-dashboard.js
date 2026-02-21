/**
 * Security Schedule Dashboard
 * OE can view all security schedules with filters
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

// Main dashboard
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get filter parameters
        const filterStore = req.query.store || '';
        const filterPeriod = req.query.period || 'all';
        const filterFromDate = req.query.fromDate || '';
        const filterToDate = req.query.toDate || '';
        
        // Build date filter
        let dateFilter = '';
        const today = new Date();
        
        if (filterPeriod === 'today') {
            dateFilter = `AND CAST(s.FromDate AS DATE) <= CAST(GETDATE() AS DATE) AND CAST(s.ToDate AS DATE) >= CAST(GETDATE() AS DATE)`;
        } else if (filterPeriod === 'this-week') {
            dateFilter = `AND s.FromDate >= DATEADD(DAY, -DATEPART(WEEKDAY, GETDATE())+1, CAST(GETDATE() AS DATE)) AND s.FromDate < DATEADD(DAY, 8-DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE))`;
        } else if (filterPeriod === 'this-month') {
            dateFilter = `AND MONTH(s.FromDate) = MONTH(GETDATE()) AND YEAR(s.FromDate) = YEAR(GETDATE())`;
        } else if (filterPeriod === 'last-month') {
            dateFilter = `AND MONTH(s.FromDate) = MONTH(DATEADD(MONTH, -1, GETDATE())) AND YEAR(s.FromDate) = YEAR(DATEADD(MONTH, -1, GETDATE()))`;
        } else if (filterPeriod === 'custom' && filterFromDate && filterToDate) {
            dateFilter = `AND s.FromDate >= '${filterFromDate}' AND s.ToDate <= '${filterToDate}'`;
        }
        
        // Store filter
        let storeFilter = '';
        if (filterStore) {
            storeFilter = `AND s.StoreName = @storeName`;
        }
        
        // Get schedules with filters
        const request = pool.request();
        if (filterStore) {
            request.input('storeName', sql.NVarChar, filterStore);
        }
        
        const schedules = await request.query(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM SecurityScheduleEmployees WHERE ScheduleId = s.Id) as EmployeeCount,
                   u.DisplayName as CreatedByName
            FROM SecuritySchedules s
            LEFT JOIN Users u ON s.CreatedBy = u.Id
            WHERE 1=1 ${dateFilter} ${storeFilter}
            ORDER BY s.CreatedAt DESC
        `);
        
        // Get stats
        const stats = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM SecuritySchedules) as Total,
                (SELECT COUNT(*) FROM SecuritySchedules WHERE CAST(FromDate AS DATE) <= CAST(GETDATE() AS DATE) AND CAST(ToDate AS DATE) >= CAST(GETDATE() AS DATE)) as Active,
                (SELECT COUNT(*) FROM SecuritySchedules WHERE MONTH(FromDate) = MONTH(GETDATE()) AND YEAR(FromDate) = YEAR(GETDATE())) as ThisMonth,
                (SELECT COUNT(*) FROM SecuritySchedules WHERE FromDate >= DATEADD(DAY, -DATEPART(WEEKDAY, GETDATE())+1, CAST(GETDATE() AS DATE))) as ThisWeek
        `);
        
        // Get stores for filter dropdown
        const stores = await pool.request().query(`
            SELECT DISTINCT StoreName FROM SecuritySchedules WHERE StoreName IS NOT NULL ORDER BY StoreName
        `);
        
        await pool.close();
        
        const statsData = stats.recordset[0];
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.StoreName}" ${filterStore === s.StoreName ? 'selected' : ''}>${s.StoreName}</option>`
        ).join('');
        
        const tableRows = schedules.recordset.map(s => {
            const fromDate = new Date(s.FromDate).toLocaleDateString('en-GB');
            const toDate = new Date(s.ToDate).toLocaleDateString('en-GB');
            const createdAt = new Date(s.CreatedAt).toLocaleDateString('en-GB');
            
            return `
                <tr onclick="viewSchedule(${s.Id})" style="cursor:pointer;">
                    <td>#${s.Id}</td>
                    <td>${s.StoreName || '-'}</td>
                    <td>${fromDate} - ${toDate}</td>
                    <td>${s.EmployeeCount}</td>
                    <td>${s.CreatedByName || '-'}</td>
                    <td>${createdAt}</td>
                    <td><span class="status-badge status-${s.Status.toLowerCase()}">${s.Status}</span></td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Security Schedule Dashboard - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 15px;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-bottom: 25px;
                    }
                    .stat-card {
                        background: white;
                        border-radius: 10px;
                        padding: 20px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        text-align: center;
                    }
                    .stat-card .stat-value {
                        font-size: 36px;
                        font-weight: 700;
                        color: #2c3e50;
                    }
                    .stat-card .stat-label {
                        font-size: 13px;
                        color: #666;
                        margin-top: 5px;
                    }
                    .stat-card.active .stat-value { color: #28a745; }
                    .stat-card.week .stat-value { color: #17a2b8; }
                    .stat-card.month .stat-value { color: #667eea; }
                    
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    }
                    
                    .filters {
                        display: flex;
                        gap: 15px;
                        margin-bottom: 20px;
                        flex-wrap: wrap;
                        align-items: flex-end;
                    }
                    .filter-group { display: flex; flex-direction: column; }
                    .filter-group label { font-size: 12px; font-weight: 600; color: #555; margin-bottom: 5px; }
                    .filter-group select, .filter-group input {
                        padding: 10px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                        min-width: 150px;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        text-decoration: none;
                    }
                    .btn-primary { background: #2c3e50; color: white; }
                    .btn-primary:hover { background: #1a252f; }
                    .btn-secondary { background: #6c757d; color: white; }
                    
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .status-submitted { background: #e8f5e9; color: #28a745; }
                    .status-draft { background: #fff3cd; color: #856404; }
                    
                    .empty-state {
                        text-align: center;
                        padding: 50px;
                        color: #666;
                    }
                    
                    .custom-dates { display: none; }
                    .custom-dates.show { display: flex; gap: 15px; }
                    
                    @media (max-width: 768px) {
                        .stats-grid { grid-template-columns: repeat(2, 1fr); }
                        .filters { flex-direction: column; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🛡️ Security Schedule Dashboard</h1>
                    <div class="header-nav">
                        <a href="/operational-excellence">← Back to OE</a>
                    </div>
                </div>
                <div class="container">
                    <!-- Stats Cards -->
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${statsData.Total}</div>
                            <div class="stat-label">Total Schedules</div>
                        </div>
                        <div class="stat-card active">
                            <div class="stat-value">${statsData.Active}</div>
                            <div class="stat-label">Active Now</div>
                        </div>
                        <div class="stat-card week">
                            <div class="stat-value">${statsData.ThisWeek}</div>
                            <div class="stat-label">This Week</div>
                        </div>
                        <div class="stat-card month">
                            <div class="stat-value">${statsData.ThisMonth}</div>
                            <div class="stat-label">This Month</div>
                        </div>
                    </div>
                    
                    <!-- Filters & Table -->
                    <div class="card">
                        <form method="GET" action="/operational-excellence/security-dashboard">
                            <div class="filters">
                                <div class="filter-group">
                                    <label>Store</label>
                                    <select name="store">
                                        <option value="">All Stores</option>
                                        ${storeOptions}
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label>Period</label>
                                    <select name="period" id="periodSelect" onchange="toggleCustomDates()">
                                        <option value="all" ${filterPeriod === 'all' ? 'selected' : ''}>All Time</option>
                                        <option value="today" ${filterPeriod === 'today' ? 'selected' : ''}>Active Today</option>
                                        <option value="this-week" ${filterPeriod === 'this-week' ? 'selected' : ''}>This Week</option>
                                        <option value="this-month" ${filterPeriod === 'this-month' ? 'selected' : ''}>This Month</option>
                                        <option value="last-month" ${filterPeriod === 'last-month' ? 'selected' : ''}>Last Month</option>
                                        <option value="custom" ${filterPeriod === 'custom' ? 'selected' : ''}>Custom Range</option>
                                    </select>
                                </div>
                                <div class="custom-dates ${filterPeriod === 'custom' ? 'show' : ''}" id="customDates">
                                    <div class="filter-group">
                                        <label>From</label>
                                        <input type="date" name="fromDate" value="${filterFromDate}">
                                    </div>
                                    <div class="filter-group">
                                        <label>To</label>
                                        <input type="date" name="toDate" value="${filterToDate}">
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-primary">Apply Filters</button>
                                <a href="/operational-excellence/security-dashboard" class="btn btn-secondary">Clear</a>
                            </div>
                        </form>
                        
                        ${schedules.recordset.length === 0 ? `
                            <div class="empty-state">
                                <h3>No Schedules Found</h3>
                                <p>No security schedules match your filter criteria.</p>
                            </div>
                        ` : `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Period</th>
                                        <th>Employees</th>
                                        <th>Created By</th>
                                        <th>Created Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
                
                <script>
                    function viewSchedule(id) {
                        window.location.href = '/operational-excellence/security-dashboard/view/' + id;
                    }
                    
                    function toggleCustomDates() {
                        const period = document.getElementById('periodSelect').value;
                        const customDates = document.getElementById('customDates');
                        if (period === 'custom') {
                            customDates.classList.add('show');
                        } else {
                            customDates.classList.remove('show');
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

// View schedule details (OE version - no ownership check)
router.get('/view/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const scheduleId = parseInt(req.params.id);
        
        // Get schedule
        const scheduleResult = await pool.request()
            .input('id', sql.Int, scheduleId)
            .query(`
                SELECT s.*, u.DisplayName as CreatedByName
                FROM SecuritySchedules s
                LEFT JOIN Users u ON s.CreatedBy = u.Id
                WHERE s.Id = @id
            `);
        
        if (scheduleResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Schedule not found');
        }
        
        const schedule = scheduleResult.recordset[0];
        
        // Get employees
        const employees = await pool.request()
            .input('scheduleId', sql.Int, scheduleId)
            .query('SELECT * FROM SecurityScheduleEmployees WHERE ScheduleId = @scheduleId ORDER BY Id');
        
        await pool.close();
        
        const fromDate = new Date(schedule.FromDate).toLocaleDateString('en-GB');
        const toDate = new Date(schedule.ToDate).toLocaleDateString('en-GB');
        
        const employeeRows = employees.recordset.map(e => `
            <tr>
                <td>${e.CompanyName}</td>
                <td>${e.EmployeeId || '-'}</td>
                <td>${e.EmployeeName}</td>
                <td>${e.EmployeePosition || '-'}</td>
                <td>${e.LocationCovered || '-'}</td>
                <td>${e.PhoneNumber || '-'}</td>
                <td>${e.MondayFrom || '-'}</td>
                <td>${e.MondayTo || '-'}</td>
                <td>${e.TuesdayFrom || '-'}</td>
                <td>${e.TuesdayTo || '-'}</td>
                <td>${e.WednesdayFrom || '-'}</td>
                <td>${e.WednesdayTo || '-'}</td>
                <td>${e.ThursdayFrom || '-'}</td>
                <td>${e.ThursdayTo || '-'}</td>
                <td>${e.FridayFrom || '-'}</td>
                <td>${e.FridayTo || '-'}</td>
                <td>${e.SaturdayFrom || '-'}</td>
                <td>${e.SaturdayTo || '-'}</td>
                <td>${e.SundayFrom || '-'}</td>
                <td>${e.SundayTo || '-'}</td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>View Schedule #${scheduleId} - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 15px;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .container { max-width: 1600px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 25px;
                    }
                    .info-item { }
                    .info-label { font-weight: 600; color: #666; font-size: 13px; margin-bottom: 5px; }
                    .info-value { font-size: 16px; color: #333; }
                    .schedule-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    .schedule-table th, .schedule-table td { 
                        padding: 10px 8px; 
                        border: 1px solid #ddd; 
                        text-align: center;
                    }
                    .schedule-table th { background: #2c3e50; color: white; }
                    .schedule-table tbody tr:hover { background: #f8f9fa; }
                    @media print {
                        .header, .btn, .no-print { display: none; }
                        .container { padding: 0; }
                        .card { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🛡️ Security Schedule #${scheduleId}</h1>
                    <div class="header-nav">
                        <a href="#" onclick="window.print()">🖨️ Print</a>
                        <a href="/operational-excellence/security-dashboard">← Back to Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Store</div>
                                <div class="info-value">${schedule.StoreName || '-'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Period</div>
                                <div class="info-value">${fromDate} - ${toDate}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Created By</div>
                                <div class="info-value">${schedule.CreatedByName || '-'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Status</div>
                                <div class="info-value">${schedule.Status}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3 style="margin-top:0;">Employee Schedule</h3>
                        <div style="overflow-x: auto;">
                            <table class="schedule-table">
                                <thead>
                                    <tr>
                                        <th rowspan="2">Company</th>
                                        <th rowspan="2">Emp ID</th>
                                        <th rowspan="2">Name</th>
                                        <th rowspan="2">Position</th>
                                        <th rowspan="2">Location</th>
                                        <th rowspan="2">Phone</th>
                                        <th colspan="2">Monday</th>
                                        <th colspan="2">Tuesday</th>
                                        <th colspan="2">Wednesday</th>
                                        <th colspan="2">Thursday</th>
                                        <th colspan="2">Friday</th>
                                        <th colspan="2">Saturday</th>
                                        <th colspan="2">Sunday</th>
                                    </tr>
                                    <tr>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${employeeRows || '<tr><td colspan="20" style="text-align:center;color:#666;">No employees added</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing schedule:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API for stats
router.get('/api/stats', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const stats = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM SecuritySchedules) as Total,
                (SELECT COUNT(*) FROM SecuritySchedules WHERE CAST(FromDate AS DATE) <= CAST(GETDATE() AS DATE) AND CAST(ToDate AS DATE) >= CAST(GETDATE() AS DATE)) as Active,
                (SELECT COUNT(*) FROM SecuritySchedules WHERE MONTH(FromDate) = MONTH(GETDATE()) AND YEAR(FromDate) = YEAR(GETDATE())) as ThisMonth
        `);
        
        await pool.close();
        
        res.json(stats.recordset[0]);
    } catch (err) {
        res.json({ Total: 0, Active: 0, ThisMonth: 0 });
    }
});

module.exports = router;
