/**
 * Thirdparty Attendance Dashboard
 * OE can view all attendance data with pivot-like filters
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

// Main dashboard with pivot-like filtering
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get filter parameters
        const filterStore = req.query.store || '';
        const filterCompany = req.query.company || '';
        const filterWorkerType = req.query.workerType || '';
        const filterName = req.query.name || '';
        const filterFromDate = req.query.fromDate || '';
        const filterToDate = req.query.toDate || '';
        const filterPeriod = req.query.period || 'all';
        const groupBy = req.query.groupBy || 'none';
        
        // Build filters
        let filters = [];
        const request = pool.request();
        
        if (filterStore) {
            filters.push('StoreName = @storeName');
            request.input('storeName', sql.NVarChar, filterStore);
        }
        if (filterCompany) {
            filters.push('Company = @company');
            request.input('company', sql.NVarChar, filterCompany);
        }
        if (filterWorkerType) {
            filters.push('WorkerType = @workerType');
            request.input('workerType', sql.NVarChar, filterWorkerType);
        }
        if (filterName) {
            filters.push("(ISNULL(FirstName, '') + CASE WHEN LastName IS NOT NULL THEN ' ' + LastName ELSE '' END) LIKE @empName");
            request.input('empName', sql.NVarChar, '%' + filterName + '%');
        }
        
        // Date filters
        if (filterPeriod === 'today') {
            filters.push('CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE)');
        } else if (filterPeriod === 'this-week') {
            filters.push('AttendanceDate >= DATEADD(DAY, -DATEPART(WEEKDAY, GETDATE())+1, CAST(GETDATE() AS DATE))');
        } else if (filterPeriod === 'this-month') {
            filters.push('MONTH(AttendanceDate) = MONTH(GETDATE()) AND YEAR(AttendanceDate) = YEAR(GETDATE())');
        } else if (filterPeriod === 'last-month') {
            filters.push('MONTH(AttendanceDate) = MONTH(DATEADD(MONTH, -1, GETDATE())) AND YEAR(AttendanceDate) = YEAR(DATEADD(MONTH, -1, GETDATE()))');
        } else if (filterPeriod === 'custom') {
            if (filterFromDate) {
                filters.push('AttendanceDate >= @fromDate');
                request.input('fromDate', sql.Date, filterFromDate);
            }
            if (filterToDate) {
                filters.push('AttendanceDate <= @toDate');
                request.input('toDate', sql.Date, filterToDate);
            }
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        // Get all records with filters
        const records = await request.query(`
            SELECT a.*, u.DisplayName as UploadedByName
            FROM ThirdpartyAttendance a
            LEFT JOIN Users u ON a.UploadedBy = u.Id
            ${whereClause}
            ORDER BY a.AttendanceDate DESC, a.StoreName, a.Company
        `);
        
        // Get summary stats WITH FILTERS APPLIED
        const statsRequest = pool.request();
        if (filterStore) statsRequest.input('storeName', sql.NVarChar, filterStore);
        if (filterCompany) statsRequest.input('company', sql.NVarChar, filterCompany);
        if (filterWorkerType) statsRequest.input('workerType', sql.NVarChar, filterWorkerType);
        if (filterName) statsRequest.input('empName', sql.NVarChar, '%' + filterName + '%');
        if (filterPeriod === 'custom') {
            if (filterFromDate) statsRequest.input('fromDate', sql.Date, filterFromDate);
            if (filterToDate) statsRequest.input('toDate', sql.Date, filterToDate);
        }
        
        const stats = await statsRequest.query(`
            SELECT 
                COUNT(*) as TotalRecords,
                COUNT(DISTINCT StoreName) as UniqueStores,
                COUNT(DISTINCT Company) as UniqueCompanies,
                SUM(CASE WHEN CHARINDEX(':', TotalHours) > 0 
                    THEN CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 2) AS DECIMAL(10,2)) + CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 1) AS DECIMAL(10,2)) / 60 
                    ELSE TRY_CAST(REPLACE(TotalHours, ',', '.') AS DECIMAL(10,2)) END) as TotalHours,
                COUNT(DISTINCT CAST(AttendanceDate AS DATE)) as UniqueDays
            FROM ThirdpartyAttendance
            ${whereClause}
        `);
        
        // Get pivot data if grouping
        let pivotData = null;
        if (groupBy !== 'none') {
            let groupQuery = '';
            if (groupBy === 'store') {
                groupQuery = `
                    SELECT StoreName as GroupKey, 
                           COUNT(*) as RecordCount,
                           COUNT(DISTINCT Company) as Companies,
                           COUNT(DISTINCT CAST(AttendanceDate AS DATE)) as Days,
                           SUM(CASE WHEN CHARINDEX(':', TotalHours) > 0 
                               THEN CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 2) AS DECIMAL(10,2)) + CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 1) AS DECIMAL(10,2)) / 60 
                               ELSE TRY_CAST(REPLACE(TotalHours, ',', '.') AS DECIMAL(10,2)) END) as TotalHours
                    FROM ThirdpartyAttendance
                    ${whereClause}
                    GROUP BY StoreName
                    ORDER BY StoreName
                `;
            } else if (groupBy === 'company') {
                groupQuery = `
                    SELECT Company as GroupKey, 
                           COUNT(*) as RecordCount,
                           COUNT(DISTINCT StoreName) as Stores,
                           COUNT(DISTINCT CAST(AttendanceDate AS DATE)) as Days,
                           SUM(CASE WHEN CHARINDEX(':', TotalHours) > 0 
                               THEN CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 2) AS DECIMAL(10,2)) + CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 1) AS DECIMAL(10,2)) / 60 
                               ELSE TRY_CAST(REPLACE(TotalHours, ',', '.') AS DECIMAL(10,2)) END) as TotalHours
                    FROM ThirdpartyAttendance
                    ${whereClause}
                    GROUP BY Company
                    ORDER BY Company
                `;
            } else if (groupBy === 'workerType') {
                groupQuery = `
                    SELECT WorkerType as GroupKey, 
                           COUNT(*) as RecordCount,
                           COUNT(DISTINCT Company) as Companies,
                           COUNT(DISTINCT CAST(AttendanceDate AS DATE)) as Days,
                           SUM(CASE WHEN CHARINDEX(':', TotalHours) > 0 
                               THEN CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 2) AS DECIMAL(10,2)) + CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 1) AS DECIMAL(10,2)) / 60 
                               ELSE TRY_CAST(REPLACE(TotalHours, ',', '.') AS DECIMAL(10,2)) END) as TotalHours
                    FROM ThirdpartyAttendance
                    ${whereClause}
                    GROUP BY WorkerType
                    ORDER BY WorkerType
                `;
            } else if (groupBy === 'date') {
                groupQuery = `
                    SELECT CAST(AttendanceDate AS DATE) as GroupKey, 
                           COUNT(*) as RecordCount,
                           COUNT(DISTINCT Company) as Companies,
                           COUNT(DISTINCT StoreName) as Stores,
                           SUM(CASE WHEN CHARINDEX(':', TotalHours) > 0 
                               THEN CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 2) AS DECIMAL(10,2)) + CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 1) AS DECIMAL(10,2)) / 60 
                               ELSE TRY_CAST(REPLACE(TotalHours, ',', '.') AS DECIMAL(10,2)) END) as TotalHours
                    FROM ThirdpartyAttendance
                    ${whereClause}
                    GROUP BY CAST(AttendanceDate AS DATE)
                    ORDER BY CAST(AttendanceDate AS DATE) DESC
                `;
            } else if (groupBy === 'name') {
                groupQuery = `
                    SELECT ISNULL(FirstName, '') + CASE WHEN LastName IS NOT NULL THEN ' ' + LastName ELSE '' END as GroupKey, 
                           COUNT(*) as RecordCount,
                           COUNT(DISTINCT Company) as Companies,
                           COUNT(DISTINCT CAST(AttendanceDate AS DATE)) as Days,
                           SUM(CASE WHEN CHARINDEX(':', TotalHours) > 0 
                               THEN CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 2) AS DECIMAL(10,2)) + CAST(PARSENAME(REPLACE(TotalHours, ':', '.'), 1) AS DECIMAL(10,2)) / 60 
                               ELSE TRY_CAST(REPLACE(TotalHours, ',', '.') AS DECIMAL(10,2)) END) as TotalHours
                    FROM ThirdpartyAttendance
                    ${whereClause}
                    GROUP BY ISNULL(FirstName, '') + CASE WHEN LastName IS NOT NULL THEN ' ' + LastName ELSE '' END
                    ORDER BY TotalHours DESC
                `;
            }
            
            if (groupQuery) {
                const pivotRequest = pool.request();
                if (filterStore) pivotRequest.input('storeName', sql.NVarChar, filterStore);
                if (filterCompany) pivotRequest.input('company', sql.NVarChar, filterCompany);
                if (filterWorkerType) pivotRequest.input('workerType', sql.NVarChar, filterWorkerType);
                if (filterName) pivotRequest.input('empName', sql.NVarChar, '%' + filterName + '%');
                if (filterFromDate) pivotRequest.input('fromDate', sql.Date, filterFromDate);
                if (filterToDate) pivotRequest.input('toDate', sql.Date, filterToDate);
                
                pivotData = await pivotRequest.query(groupQuery);
            }
        }
        
        // Get filter options
        const stores = await pool.request().query('SELECT DISTINCT StoreName FROM ThirdpartyAttendance WHERE StoreName IS NOT NULL ORDER BY StoreName');
        const companies = await pool.request().query('SELECT DISTINCT Company FROM ThirdpartyAttendance WHERE Company IS NOT NULL ORDER BY Company');
        const workerTypes = await pool.request().query('SELECT DISTINCT WorkerType FROM ThirdpartyAttendance WHERE WorkerType IS NOT NULL ORDER BY WorkerType');
        const names = await pool.request().query("SELECT DISTINCT ISNULL(FirstName, '') + CASE WHEN LastName IS NOT NULL THEN ' ' + LastName ELSE '' END as FullName FROM ThirdpartyAttendance WHERE FirstName IS NOT NULL ORDER BY FullName");
        
        await pool.close();
        
        const statsData = stats.recordset[0];
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.StoreName}" ${filterStore === s.StoreName ? 'selected' : ''}>${s.StoreName}</option>`
        ).join('');
        
        const companyOptions = companies.recordset.map(c => 
            `<option value="${c.Company}" ${filterCompany === c.Company ? 'selected' : ''}>${c.Company}</option>`
        ).join('');
        
        const workerTypeOptions = workerTypes.recordset.map(w => 
            `<option value="${w.WorkerType}" ${filterWorkerType === w.WorkerType ? 'selected' : ''}>${w.WorkerType}</option>`
        ).join('');
        
        const nameOptions = names.recordset.map(n => 
            `<option value="${n.FullName || ''}" ${filterName === n.FullName ? 'selected' : ''}>${n.FullName || '-'}</option>`
        ).join('');
        
        // Build pivot table HTML
        let pivotHtml = '';
        if (pivotData && pivotData.recordset.length > 0) {
            const pivotRows = pivotData.recordset.map(r => {
                const groupKey = r.GroupKey instanceof Date ? new Date(r.GroupKey).toLocaleDateString('en-GB') : (r.GroupKey || '-');
                const daysCol = groupBy === 'date' ? `<td>${r.Stores || '-'}</td>` : `<td>${r.Days || '-'}</td>`;
                return `
                    <tr>
                        <td style="font-weight:600;">${groupKey}</td>
                        <td>${r.RecordCount}</td>
                        <td>${r.Companies || r.Stores || '-'}</td>
                        ${daysCol}
                        <td>${r.TotalHours ? r.TotalHours.toFixed(1) : '0'}</td>
                    </tr>
                `;
            }).join('');
            
            const groupLabel = groupBy === 'store' ? 'Store' : 
                              groupBy === 'company' ? 'Company' : 
                              groupBy === 'workerType' ? 'Worker Type' : 
                              groupBy === 'name' ? 'Employee Name' : 'Date';
            const secondCol = groupBy === 'company' ? 'Stores' : 'Companies';
            const thirdCol = groupBy === 'date' ? 'Stores' : 'Days';
            
            pivotHtml = `
                <div class="card" style="margin-bottom:20px;">
                    <div class="card-title">📊 Summary by ${groupLabel}</div>
                    <table>
                        <thead>
                            <tr>
                                <th>${groupLabel}</th>
                                <th>Records</th>
                                <th>${secondCol}</th>
                                <th>${thirdCol}</th>
                                <th>Total Hours</th>
                            </tr>
                        </thead>
                        <tbody>${pivotRows}</tbody>
                    </table>
                </div>
            `;
        }
        
        // Build records table
        const tableRows = records.recordset.slice(0, 500).map((r, idx) => {
            const attendanceDate = r.AttendanceDate ? new Date(r.AttendanceDate).toLocaleDateString('en-GB') : '-';
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${r.StoreName || '-'}</td>
                    <td>${r.StoreCode || '-'}</td>
                    <td>${r.FirstName || ''} ${r.LastName || ''}</td>
                    <td>${r.Company || '-'}</td>
                    <td>${attendanceDate}</td>
                    <td>${r.WorkerType || '-'}</td>
                    <td>${r.TimeIn || '-'}</td>
                    <td>${r.TimeOut || '-'}</td>
                    <td>${r.TotalHours || '-'}</td>
                    <td>${r.UploadedByName || '-'}</td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Thirdparty Attendance Dashboard - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%);
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
                    .container { max-width: 1600px; margin: 0 auto; padding: 30px; }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(5, 1fr);
                        gap: 15px;
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
                        font-size: 32px;
                        font-weight: 700;
                        color: #e67e22;
                    }
                    .stat-card .stat-label {
                        font-size: 12px;
                        color: #666;
                        margin-top: 5px;
                    }
                    
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    
                    .filters {
                        display: flex;
                        gap: 12px;
                        flex-wrap: wrap;
                        align-items: flex-end;
                        margin-bottom: 15px;
                    }
                    .filter-group { display: flex; flex-direction: column; }
                    .filter-group label { font-size: 11px; font-weight: 600; color: #555; margin-bottom: 4px; }
                    .filter-group select, .filter-group input {
                        padding: 8px 10px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        font-size: 13px;
                        min-width: 130px;
                    }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 13px;
                        text-decoration: none;
                    }
                    .btn-primary { background: #e67e22; color: white; }
                    .btn-primary:hover { background: #d35400; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-success { background: #28a745; color: white; }
                    
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; position: sticky; top: 0; }
                    tr:hover { background: #f8f9fa; }
                    
                    .custom-dates { display: none; }
                    .custom-dates.show { display: flex; gap: 12px; }
                    
                    .table-container { max-height: 600px; overflow-y: auto; }
                    
                    .export-btn { margin-left: auto; }
                    
                    .record-count { color: #666; font-size: 13px; margin-bottom: 10px; }
                    
                    @media (max-width: 1200px) {
                        .stats-grid { grid-template-columns: repeat(3, 1fr); }
                    }
                    @media (max-width: 768px) {
                        .stats-grid { grid-template-columns: repeat(2, 1fr); }
                        .filters { flex-direction: column; }
                    }
                    @media print {
                        .header, .filters, .btn { display: none; }
                        .container { padding: 0; }
                        .card { box-shadow: none; page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Thirdparty Attendance Dashboard</h1>
                    <div class="header-nav">
                        <a href="javascript:exportToCSV()">📥 Export CSV</a>
                        <a href="javascript:window.print()">🖨️ Print</a>
                        <a href="/operational-excellence">← Back to OE</a>
                    </div>
                </div>
                <div class="container">
                    <!-- Stats -->
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${statsData.TotalRecords || 0}</div>
                            <div class="stat-label">Total Records</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${statsData.UniqueStores || 0}</div>
                            <div class="stat-label">Stores</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${statsData.UniqueCompanies || 0}</div>
                            <div class="stat-label">Companies</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${statsData.TotalHours ? Math.round(statsData.TotalHours) : 0}</div>
                            <div class="stat-label">Total Hours</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${statsData.UniqueDays || 0}</div>
                            <div class="stat-label">Days Covered</div>
                        </div>
                    </div>
                    
                    <!-- Filters -->
                    <div class="card">
                        <div class="card-title">🔍 Filter & Pivot Data</div>
                        <form method="GET" action="/operational-excellence/attendance-dashboard">
                            <div class="filters">
                                <div class="filter-group">
                                    <label>Store</label>
                                    <select name="store">
                                        <option value="">All Stores</option>
                                        ${storeOptions}
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label>Company</label>
                                    <select name="company">
                                        <option value="">All Companies</option>
                                        ${companyOptions}
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label>Worker Type</label>
                                    <select name="workerType">
                                        <option value="">All Types</option>
                                        ${workerTypeOptions}
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label>Employee Name</label>
                                    <select name="name">
                                        <option value="">All Names</option>
                                        ${nameOptions}
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label>Period</label>
                                    <select name="period" id="periodSelect" onchange="toggleCustomDates()">
                                        <option value="all" ${filterPeriod === 'all' ? 'selected' : ''}>All Time</option>
                                        <option value="today" ${filterPeriod === 'today' ? 'selected' : ''}>Today</option>
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
                                <div class="filter-group">
                                    <label>Group By (Pivot)</label>
                                    <select name="groupBy">
                                        <option value="none" ${groupBy === 'none' ? 'selected' : ''}>No Grouping</option>
                                        <option value="name" ${groupBy === 'name' ? 'selected' : ''}>Employee Name</option>
                                        <option value="store" ${groupBy === 'store' ? 'selected' : ''}>Store</option>
                                        <option value="company" ${groupBy === 'company' ? 'selected' : ''}>Company</option>
                                        <option value="workerType" ${groupBy === 'workerType' ? 'selected' : ''}>Worker Type</option>
                                        <option value="date" ${groupBy === 'date' ? 'selected' : ''}>Date</option>
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary">Apply Filters</button>
                                <a href="/operational-excellence/attendance-dashboard" class="btn btn-secondary">Clear</a>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Pivot Summary -->
                    ${pivotHtml}
                    
                    <!-- Records Table -->
                    <div class="card">
                        <div class="card-title">📝 Attendance Records</div>
                        <div class="record-count">Showing ${Math.min(records.recordset.length, 500)} of ${records.recordset.length} records</div>
                        <div class="table-container">
                            <table id="dataTable">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Store</th>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Company</th>
                                        <th>Date</th>
                                        <th>Worker Type</th>
                                        <th>In</th>
                                        <th>Out</th>
                                        <th>Hours</th>
                                        <th>Uploaded By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows || '<tr><td colspan="11" style="text-align:center;color:#666;">No records found</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <script>
                    function toggleCustomDates() {
                        const period = document.getElementById('periodSelect').value;
                        const customDates = document.getElementById('customDates');
                        if (period === 'custom') {
                            customDates.classList.add('show');
                        } else {
                            customDates.classList.remove('show');
                        }
                    }
                    
                    function exportToCSV() {
                        const table = document.getElementById('dataTable');
                        let csv = [];
                        
                        // Headers
                        const headers = [];
                        table.querySelectorAll('thead th').forEach(th => headers.push(th.textContent));
                        csv.push(headers.join(','));
                        
                        // Rows
                        table.querySelectorAll('tbody tr').forEach(row => {
                            const rowData = [];
                            row.querySelectorAll('td').forEach(td => {
                                let text = td.textContent.replace(/"/g, '""');
                                if (text.includes(',')) text = '"' + text + '"';
                                rowData.push(text);
                            });
                            csv.push(rowData.join(','));
                        });
                        
                        const csvContent = csv.join('\\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'thirdparty-attendance-export.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading attendance dashboard:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API for stats (for landing page card)
router.get('/api/stats', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as Total,
                COUNT(DISTINCT Company) as Companies,
                (SELECT COUNT(*) FROM ThirdpartyAttendance WHERE MONTH(AttendanceDate) = MONTH(GETDATE()) AND YEAR(AttendanceDate) = YEAR(GETDATE())) as ThisMonth
        `);
        
        await pool.close();
        
        res.json(stats.recordset[0]);
    } catch (err) {
        res.json({ Total: 0, Companies: 0, ThisMonth: 0 });
    }
});

module.exports = router;
