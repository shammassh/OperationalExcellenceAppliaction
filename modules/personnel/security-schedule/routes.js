/**
 * Security Schedule Routes
 * Personnel fills weekly schedule for security employees
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

// Main page - shows list of schedules and button to create new
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser.userId;
        
        // Get user's schedules
        const schedules = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT s.*, 
                       (SELECT COUNT(*) FROM SecurityScheduleEmployees WHERE ScheduleId = s.Id) as EmployeeCount,
                       u.DisplayName as CreatedByName
                FROM SecuritySchedules s
                LEFT JOIN Users u ON s.CreatedBy = u.Id
                WHERE s.CreatedBy = @userId
                ORDER BY s.CreatedAt DESC
            `);
        
        await pool.close();
        
        const tableRows = schedules.recordset.map(s => {
            const fromDate = new Date(s.FromDate).toLocaleDateString('en-GB');
            const toDate = new Date(s.ToDate).toLocaleDateString('en-GB');
            const createdAt = new Date(s.CreatedAt).toLocaleDateString('en-GB');
            
            return `
                <tr onclick="viewSchedule(${s.Id})" style="cursor:pointer;">
                    <td>#${s.Id}</td>
                    <td>${s.StoreName || '-'}</td>
                    <td>${fromDate} - ${toDate}</td>
                    <td>${s.EmployeeCount} employees</td>
                    <td><span class="status-badge status-${s.Status.toLowerCase()}">${s.Status}</span></td>
                    <td>${createdAt}</td>
                    <td>
                        <a href="/personnel/security-schedule/view/${s.Id}" class="btn btn-sm btn-primary" onclick="event.stopPropagation();">View</a>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Security Schedule - ${process.env.APP_NAME}</title>
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
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .btn-primary { background: #2c3e50; color: white; }
                    .btn-primary:hover { background: #1a252f; }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
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
                    .empty-icon { font-size: 50px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🛡️ Employees Schedule - Security</h1>
                    <div class="header-nav">
                        <a href="/personnel/security-schedule/new">+ New Schedule</a>
                        <a href="/personnel">← Back to Personnel</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <h2 style="margin:0;">My Schedules</h2>
                        </div>
                        ${schedules.recordset.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-icon">📋</div>
                                <h3>No Schedules Yet</h3>
                                <p>Create your first security employee schedule.</p>
                                <a href="/personnel/security-schedule/new" class="btn btn-primary" style="margin-top:15px;">+ Create New Schedule</a>
                            </div>
                        ` : `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Period</th>
                                        <th>Employees</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
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
                        window.location.href = '/personnel/security-schedule/view/' + id;
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading schedules:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// New schedule form - Step 1: Select date range
router.get('/new', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get stores for dropdown
        const stores = await pool.request().query('SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        
        // Get security companies for dropdown
        const companies = await pool.request().query('SELECT Id, CompanyName FROM OutsourceSecurityCompanies WHERE IsActive = 1 ORDER BY CompanyName');
        
        await pool.close();
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.Id}" data-name="${s.StoreName}">${s.StoreName}</option>`
        ).join('');
        
        const companyOptions = companies.recordset.map(c => 
            `<option value="${c.CompanyName}">${c.CompanyName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>New Security Schedule - ${process.env.APP_NAME}</title>
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
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    .form-row { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
                    .form-group { flex: 1; min-width: 200px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #555; }
                    .form-group input, .form-group select {
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                    }
                    .form-group input:focus, .form-group select:focus {
                        outline: none;
                        border-color: #2c3e50;
                    }
                    .btn {
                        padding: 12px 24px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .btn-primary { background: #2c3e50; color: white; }
                    .btn-primary:hover { background: #1a252f; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn-danger:hover { background: #c82333; }
                    .btn-secondary { background: #6c757d; color: white; }
                    
                    /* Schedule table styles */
                    .schedule-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    .schedule-table th, .schedule-table td { 
                        padding: 8px; 
                        border: 1px solid #ddd; 
                        text-align: center;
                        font-size: 13px;
                    }
                    .schedule-table th { background: #2c3e50; color: white; }
                    .schedule-table th.day-header { font-size: 12px; }
                    .schedule-table input { 
                        width: 100%; 
                        padding: 6px; 
                        border: 1px solid #ddd; 
                        border-radius: 4px; 
                        font-size: 12px;
                        text-align: center;
                    }
                    .schedule-table input[type="time"] { width: 85px; }
                    .schedule-table .employee-info input { text-align: left; }
                    .schedule-table .remove-btn {
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .add-row-btn {
                        margin-top: 15px;
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .add-row-btn:hover { background: #218838; }
                    
                    .actions { margin-top: 25px; display: flex; gap: 15px; }
                    
                    .date-range-section {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    
                    #employeeSection { display: none; }
                    #employeeSection.active { display: block; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🛡️ New Security Schedule</h1>
                    <div class="header-nav">
                        <a href="/personnel/security-schedule">← Back to Schedules</a>
                    </div>
                </div>
                <div class="container">
                    <form id="scheduleForm" action="/personnel/security-schedule/submit" method="POST">
                        <!-- Step 1: Date Range -->
                        <div class="card">
                            <div class="card-title">📅 Schedule Period & Store</div>
                            <div class="date-range-section">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Store *</label>
                                        <select name="storeId" id="storeSelect" required>
                                            <option value="">-- Select Store --</option>
                                            ${storeOptions}
                                        </select>
                                        <input type="hidden" name="storeName" id="storeName">
                                    </div>
                                    <div class="form-group">
                                        <label>From Date *</label>
                                        <input type="date" name="fromDate" id="fromDate" required>
                                    </div>
                                    <div class="form-group">
                                        <label>To Date *</label>
                                        <input type="date" name="toDate" id="toDate" required>
                                    </div>
                                    <div class="form-group" style="align-self: flex-end;">
                                        <button type="button" class="btn btn-primary" onclick="startSchedule()">Start Adding Employees →</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Step 2: Employee List -->
                        <div class="card" id="employeeSection">
                            <div class="card-title">👥 Security Employees Schedule</div>
                            <p style="color:#666; margin-bottom:15px;">Add security employees and their weekly schedule below.</p>
                            
                            <div style="overflow-x: auto;">
                                <table class="schedule-table" id="scheduleTable">
                                    <thead>
                                        <tr>
                                            <th rowspan="2" style="min-width:120px;">Company</th>
                                            <th rowspan="2" style="min-width:80px;">Emp ID</th>
                                            <th rowspan="2" style="min-width:120px;">Name</th>
                                            <th rowspan="2" style="min-width:100px;">Position</th>
                                            <th rowspan="2" style="min-width:120px;">Location</th>
                                            <th rowspan="2" style="min-width:100px;">Phone</th>
                                            <th colspan="2" class="day-header">Monday</th>
                                            <th colspan="2" class="day-header">Tuesday</th>
                                            <th colspan="2" class="day-header">Wednesday</th>
                                            <th colspan="2" class="day-header">Thursday</th>
                                            <th colspan="2" class="day-header">Friday</th>
                                            <th colspan="2" class="day-header">Saturday</th>
                                            <th colspan="2" class="day-header">Sunday</th>
                                            <th rowspan="2">Action</th>
                                        </tr>
                                        <tr>
                                            <th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">From</th><th class="day-header">To</th>
                                        </tr>
                                    </thead>
                                    <tbody id="employeeRows">
                                        <!-- Employee rows will be added here -->
                                    </tbody>
                                </table>
                            </div>
                            
                            <button type="button" class="add-row-btn" onclick="addEmployeeRow()">+ Add Employee</button>
                            
                            <div class="actions">
                                <button type="submit" class="btn btn-success">💾 Save Schedule</button>
                                <a href="/personnel/security-schedule" class="btn btn-secondary">Cancel</a>
                            </div>
                        </div>
                    </form>
                </div>
                
                <script>
                    const companyOptions = \`${companyOptions}\`;
                    let rowCount = 0;
                    
                    // Update store name hidden field
                    document.getElementById('storeSelect').addEventListener('change', function() {
                        const selected = this.options[this.selectedIndex];
                        document.getElementById('storeName').value = selected.dataset.name || '';
                    });
                    
                    function startSchedule() {
                        const store = document.getElementById('storeSelect').value;
                        const fromDate = document.getElementById('fromDate').value;
                        const toDate = document.getElementById('toDate').value;
                        
                        if (!store) {
                            alert('Please select a store');
                            return;
                        }
                        if (!fromDate || !toDate) {
                            alert('Please select both From and To dates');
                            return;
                        }
                        if (new Date(fromDate) > new Date(toDate)) {
                            alert('From date cannot be after To date');
                            return;
                        }
                        
                        // Show employee section
                        document.getElementById('employeeSection').classList.add('active');
                        
                        // Add first row if none exist
                        if (rowCount === 0) {
                            addEmployeeRow();
                        }
                        
                        // Scroll to employee section
                        document.getElementById('employeeSection').scrollIntoView({ behavior: 'smooth' });
                    }
                    
                    function addEmployeeRow() {
                        rowCount++;
                        const tbody = document.getElementById('employeeRows');
                        const row = document.createElement('tr');
                        row.id = 'row_' + rowCount;
                        
                        row.innerHTML = \`
                            <td class="employee-info"><input type="text" name="employees[\${rowCount}][companyName]" placeholder="Company" required></td>
                            <td class="employee-info"><input type="text" name="employees[\${rowCount}][employeeId]" placeholder="ID"></td>
                            <td class="employee-info"><input type="text" name="employees[\${rowCount}][employeeName]" placeholder="Name" required></td>
                            <td class="employee-info"><input type="text" name="employees[\${rowCount}][employeePosition]" placeholder="Position"></td>
                            <td class="employee-info"><input type="text" name="employees[\${rowCount}][locationCovered]" placeholder="Location"></td>
                            <td class="employee-info"><input type="text" name="employees[\${rowCount}][phoneNumber]" placeholder="Phone"></td>
                            <td><input type="time" name="employees[\${rowCount}][mondayFrom]"></td>
                            <td><input type="time" name="employees[\${rowCount}][mondayTo]"></td>
                            <td><input type="time" name="employees[\${rowCount}][tuesdayFrom]"></td>
                            <td><input type="time" name="employees[\${rowCount}][tuesdayTo]"></td>
                            <td><input type="time" name="employees[\${rowCount}][wednesdayFrom]"></td>
                            <td><input type="time" name="employees[\${rowCount}][wednesdayTo]"></td>
                            <td><input type="time" name="employees[\${rowCount}][thursdayFrom]"></td>
                            <td><input type="time" name="employees[\${rowCount}][thursdayTo]"></td>
                            <td><input type="time" name="employees[\${rowCount}][fridayFrom]"></td>
                            <td><input type="time" name="employees[\${rowCount}][fridayTo]"></td>
                            <td><input type="time" name="employees[\${rowCount}][saturdayFrom]"></td>
                            <td><input type="time" name="employees[\${rowCount}][saturdayTo]"></td>
                            <td><input type="time" name="employees[\${rowCount}][sundayFrom]"></td>
                            <td><input type="time" name="employees[\${rowCount}][sundayTo]"></td>
                            <td><button type="button" class="remove-btn" onclick="removeRow(\${rowCount})">✕</button></td>
                        \`;
                        
                        tbody.appendChild(row);
                    }
                    
                    function removeRow(id) {
                        const row = document.getElementById('row_' + id);
                        if (row) {
                            row.remove();
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading new schedule form:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Submit schedule
router.post('/submit', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser.userId;
        const { storeId, storeName, fromDate, toDate, employees } = req.body;
        
        // Create main schedule record
        const scheduleResult = await pool.request()
            .input('storeId', sql.Int, storeId || null)
            .input('storeName', sql.NVarChar, storeName || null)
            .input('fromDate', sql.Date, fromDate)
            .input('toDate', sql.Date, toDate)
            .input('createdBy', sql.Int, userId)
            .query(`
                INSERT INTO SecuritySchedules (StoreId, StoreName, FromDate, ToDate, CreatedBy, Status)
                OUTPUT INSERTED.Id
                VALUES (@storeId, @storeName, @fromDate, @toDate, @createdBy, 'Submitted')
            `);
        
        const scheduleId = scheduleResult.recordset[0].Id;
        
        // Insert employees
        if (employees) {
            const employeeList = Object.values(employees);
            
            for (const emp of employeeList) {
                if (!emp.employeeName || !emp.companyName) continue; // Skip empty rows
                
                await pool.request()
                    .input('scheduleId', sql.Int, scheduleId)
                    .input('companyName', sql.NVarChar, emp.companyName)
                    .input('employeeId', sql.NVarChar, emp.employeeId || null)
                    .input('employeeName', sql.NVarChar, emp.employeeName)
                    .input('employeePosition', sql.NVarChar, emp.employeePosition || null)
                    .input('locationCovered', sql.NVarChar, emp.locationCovered || null)
                    .input('phoneNumber', sql.NVarChar, emp.phoneNumber || null)
                    .input('mondayFrom', sql.NVarChar, emp.mondayFrom || null)
                    .input('mondayTo', sql.NVarChar, emp.mondayTo || null)
                    .input('tuesdayFrom', sql.NVarChar, emp.tuesdayFrom || null)
                    .input('tuesdayTo', sql.NVarChar, emp.tuesdayTo || null)
                    .input('wednesdayFrom', sql.NVarChar, emp.wednesdayFrom || null)
                    .input('wednesdayTo', sql.NVarChar, emp.wednesdayTo || null)
                    .input('thursdayFrom', sql.NVarChar, emp.thursdayFrom || null)
                    .input('thursdayTo', sql.NVarChar, emp.thursdayTo || null)
                    .input('fridayFrom', sql.NVarChar, emp.fridayFrom || null)
                    .input('fridayTo', sql.NVarChar, emp.fridayTo || null)
                    .input('saturdayFrom', sql.NVarChar, emp.saturdayFrom || null)
                    .input('saturdayTo', sql.NVarChar, emp.saturdayTo || null)
                    .input('sundayFrom', sql.NVarChar, emp.sundayFrom || null)
                    .input('sundayTo', sql.NVarChar, emp.sundayTo || null)
                    .query(`
                        INSERT INTO SecurityScheduleEmployees 
                        (ScheduleId, CompanyName, EmployeeId, EmployeeName, EmployeePosition, LocationCovered, PhoneNumber,
                         MondayFrom, MondayTo, TuesdayFrom, TuesdayTo, WednesdayFrom, WednesdayTo,
                         ThursdayFrom, ThursdayTo, FridayFrom, FridayTo, SaturdayFrom, SaturdayTo, SundayFrom, SundayTo)
                        VALUES 
                        (@scheduleId, @companyName, @employeeId, @employeeName, @employeePosition, @locationCovered, @phoneNumber,
                         @mondayFrom, @mondayTo, @tuesdayFrom, @tuesdayTo, @wednesdayFrom, @wednesdayTo,
                         @thursdayFrom, @thursdayTo, @fridayFrom, @fridayTo, @saturdayFrom, @saturdayTo, @sundayFrom, @sundayTo)
                    `);
            }
        }
        
        await pool.close();
        
        res.redirect('/personnel/security-schedule/view/' + scheduleId + '?success=1');
    } catch (err) {
        console.error('Error saving schedule:', err);
        res.status(500).send('Error saving schedule: ' + err.message);
    }
});

// View schedule
router.get('/view/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const scheduleId = parseInt(req.params.id);
        const userId = req.currentUser.userId;
        const success = req.query.success;
        
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
        
        // Check if user owns this schedule or is admin
        if (schedule.CreatedBy !== userId && req.currentUser.roleId !== 31) {
            await pool.close();
            return res.status(403).send('Access denied');
        }
        
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
                    .success-banner {
                        background: #d4edda;
                        color: #155724;
                        padding: 15px 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
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
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                        display: inline-block;
                    }
                    .btn-primary { background: #2c3e50; color: white; }
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
                        <a href="/personnel/security-schedule">← Back to Schedules</a>
                    </div>
                </div>
                <div class="container">
                    ${success ? `
                        <div class="success-banner">
                            ✅ Schedule saved successfully!
                        </div>
                    ` : ''}
                    
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

module.exports = router;
