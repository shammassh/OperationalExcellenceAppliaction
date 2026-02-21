/**
 * Employee Attendance Report Form
 * Track employees who come after working hours
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

// Employee Attendance Report Form Page
router.get('/', (req, res) => {
    const user = req.currentUser;
    const today = new Date().toISOString().split('T')[0];
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Employee Attendance Report - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container { max-width: 900px; margin: 0 auto; }
                .header {
                    background: rgba(255,255,255,0.95);
                    border-radius: 15px;
                    padding: 25px 30px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .header h1 {
                    color: #333;
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .header-nav a {
                    color: #667eea;
                    text-decoration: none;
                    font-weight: 500;
                    margin-left: 20px;
                }
                .header-nav a:hover { text-decoration: underline; }
                .form-card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .form-row {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    margin-bottom: 25px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                }
                .form-group label {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .form-group label .required { color: #e74c3c; }
                .form-group input,
                .form-group select {
                    padding: 12px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    font-size: 15px;
                    transition: all 0.3s;
                }
                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #667eea;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .entries-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .entries-table th {
                    background: #f8f9fa;
                    padding: 15px;
                    text-align: left;
                    font-size: 13px;
                    font-weight: 600;
                    color: #555;
                    border-bottom: 2px solid #dee2e6;
                }
                .entries-table td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #eee;
                    vertical-align: middle;
                }
                .entries-table input[type="text"],
                .entries-table input[type="time"] {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .entries-table input[type="checkbox"] {
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                }
                .entries-table input:focus {
                    outline: none;
                    border-color: #667eea;
                }
                .btn-add-row {
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 25px;
                }
                .btn-add-row:hover { background: #5a6fd6; }
                .btn-remove {
                    background: #fee2e2;
                    color: #dc2626;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 18px;
                }
                .btn-remove:hover { background: #fecaca; }
                .btn-submit {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.3s;
                }
                .btn-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
                }
                .btn-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                .alert {
                    padding: 15px 20px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    display: none;
                }
                .alert-success {
                    background: #d1fae5;
                    color: #065f46;
                    border: 1px solid #a7f3d0;
                }
                .alert-error {
                    background: #fee2e2;
                    color: #991b1b;
                    border: 1px solid #fecaca;
                }
                .informed-label {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📋 Employee Attendance Report</h1>
                    <div class="header-nav">
                        <a href="/security-services">← Back</a>
                        <a href="/security">Security Dashboard</a>
                    </div>
                </div>
                
                <div class="form-card">
                    <div id="alertBox" class="alert"></div>
                    
                    <div class="section-title">📍 Report Details</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Location <span class="required">*</span></label>
                            <select id="location" required>
                                <option value="">Select Location</option>
                                <option value="HO Zouk">HO Zouk</option>
                                <option value="HO Dbayeh">HO Dbayeh</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Date <span class="required">*</span></label>
                            <input type="date" id="reportDate" value="${today}" required>
                        </div>
                    </div>
                    
                    <div class="section-title">👤 Employee Entries (After Working Hours)</div>
                    
                    <table class="entries-table" id="entriesTable">
                        <thead>
                            <tr>
                                <th style="width: 35%">Employee Name</th>
                                <th style="width: 18%">Time In</th>
                                <th style="width: 18%">Time Out</th>
                                <th style="width: 15%">Informed</th>
                                <th style="width: 14%">Action</th>
                            </tr>
                        </thead>
                        <tbody id="entriesBody">
                            <tr>
                                <td><input type="text" class="entry-name" placeholder="Employee name"></td>
                                <td><input type="time" class="entry-time-in"></td>
                                <td><input type="time" class="entry-time-out"></td>
                                <td class="informed-label"><input type="checkbox" class="entry-informed"> Yes</td>
                                <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <button type="button" class="btn-add-row" onclick="addRow()">
                        + Add Employee
                    </button>
                    
                    <button type="button" class="btn-submit" id="submitBtn" onclick="submitForm()">
                        Submit Report
                    </button>
                </div>
            </div>
            
            <script>
                function addRow() {
                    const tbody = document.getElementById('entriesBody');
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td><input type="text" class="entry-name" placeholder="Employee name"></td>
                        <td><input type="time" class="entry-time-in"></td>
                        <td><input type="time" class="entry-time-out"></td>
                        <td class="informed-label"><input type="checkbox" class="entry-informed"> Yes</td>
                        <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
                    \`;
                    tbody.appendChild(row);
                }
                
                function removeRow(btn) {
                    const tbody = document.getElementById('entriesBody');
                    if (tbody.rows.length > 1) {
                        btn.closest('tr').remove();
                    } else {
                        showAlert('At least one entry row is required', 'error');
                    }
                }
                
                function showAlert(message, type) {
                    const alertBox = document.getElementById('alertBox');
                    alertBox.textContent = message;
                    alertBox.className = 'alert alert-' + type;
                    alertBox.style.display = 'block';
                    setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
                }
                
                async function submitForm() {
                    const location = document.getElementById('location').value;
                    const reportDate = document.getElementById('reportDate').value;
                    
                    if (!location || !reportDate) {
                        showAlert('Please fill in all required fields', 'error');
                        return;
                    }
                    
                    // Collect entries
                    const entries = [];
                    const rows = document.querySelectorAll('#entriesBody tr');
                    
                    rows.forEach((row, index) => {
                        const name = row.querySelector('.entry-name').value.trim();
                        const timeIn = row.querySelector('.entry-time-in').value;
                        const timeOut = row.querySelector('.entry-time-out').value;
                        const informed = row.querySelector('.entry-informed').checked;
                        
                        if (name) {
                            entries.push({
                                employeeName: name,
                                timeIn: timeIn || null,
                                timeOut: timeOut || null,
                                informed: informed,
                                order: index + 1
                            });
                        }
                    });
                    
                    if (entries.length === 0) {
                        showAlert('Please add at least one employee entry', 'error');
                        return;
                    }
                    
                    const submitBtn = document.getElementById('submitBtn');
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Submitting...';
                    
                    try {
                        const response = await fetch('/security-services/attendance-report/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                location,
                                reportDate,
                                entries
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            showAlert('Report submitted successfully!', 'success');
                            setTimeout(() => {
                                window.location.href = '/security-services/attendance-report/' + result.reportId;
                            }, 1500);
                        } else {
                            showAlert(result.message || 'Error submitting report', 'error');
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Submit Report';
                        }
                    } catch (err) {
                        showAlert('Error: ' + err.message, 'error');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit Report';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Save Attendance Report
router.post('/save', async (req, res) => {
    const user = req.currentUser;
    const { location, reportDate, entries } = req.body;
    
    if (!location || !reportDate || !entries || entries.length === 0) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Insert report header
        const reportResult = await pool.request()
            .input('reportDate', sql.Date, reportDate)
            .input('location', sql.NVarChar, location)
            .input('createdBy', sql.NVarChar, user.displayName)
            .input('createdById', sql.NVarChar, user.id)
            .query(`
                INSERT INTO Security_AttendanceReports (ReportDate, Location, CreatedBy, CreatedById)
                OUTPUT INSERTED.Id
                VALUES (@reportDate, @location, @createdBy, @createdById)
            `);
        
        const reportId = reportResult.recordset[0].Id;
        
        // Insert entries
        for (const entry of entries) {
            await pool.request()
                .input('reportId', sql.Int, reportId)
                .input('employeeName', sql.NVarChar, entry.employeeName)
                .input('timeIn', sql.NVarChar, entry.timeIn || '')
                .input('timeOut', sql.NVarChar, entry.timeOut || '')
                .input('informed', sql.Bit, entry.informed ? 1 : 0)
                .input('order', sql.Int, entry.order)
                .query(`
                    INSERT INTO Security_AttendanceEntries (AttendanceReportId, EmployeeName, TimeIn, TimeOut, Informed, EntryOrder)
                    VALUES (@reportId, @employeeName, @timeIn, @timeOut, @informed, @order)
                `);
        }
        
        await pool.close();
        
        res.json({ success: true, reportId });
    } catch (err) {
        console.error('Error saving attendance report:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// View Attendance Report
router.get('/:id', async (req, res) => {
    const user = req.currentUser;
    const reportId = req.params.id;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const reportResult = await pool.request()
            .input('id', sql.Int, reportId)
            .query(`SELECT * FROM Security_AttendanceReports WHERE Id = @id`);
        
        if (reportResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Report not found');
        }
        
        const report = reportResult.recordset[0];
        
        const entriesResult = await pool.request()
            .input('reportId', sql.Int, reportId)
            .query(`SELECT * FROM Security_AttendanceEntries WHERE AttendanceReportId = @reportId ORDER BY EntryOrder`);
        
        await pool.close();
        
        const entries = entriesResult.recordset;
        const reportDate = new Date(report.ReportDate).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        let entriesHtml = entries.map((entry, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${entry.EmployeeName}</td>
                <td>${entry.TimeIn || '-'}</td>
                <td>${entry.TimeOut || '-'}</td>
                <td><span class="informed-badge ${entry.Informed ? 'yes' : 'no'}">${entry.Informed ? '✓ Yes' : '✗ No'}</span></td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>View Attendance Report - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 900px; margin: 0 auto; }
                    .header {
                        background: rgba(255,255,255,0.95);
                        border-radius: 15px;
                        padding: 25px 30px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .header h1 {
                        color: #333;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .header-nav a {
                        color: #667eea;
                        text-decoration: none;
                        font-weight: 500;
                        margin-left: 20px;
                    }
                    .view-card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #eee;
                    }
                    .info-item label {
                        display: block;
                        font-size: 12px;
                        color: #888;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    .info-item span {
                        font-size: 16px;
                        font-weight: 600;
                        color: #333;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
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
                        border-bottom: 2px solid #dee2e6;
                    }
                    td {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }
                    .informed-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .informed-badge.yes {
                        background: #d1fae5;
                        color: #065f46;
                    }
                    .informed-badge.no {
                        background: #fee2e2;
                        color: #991b1b;
                    }
                    .footer-info {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 13px;
                        color: #888;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📋 Attendance Report #${report.Id}</h1>
                        <div class="header-nav">
                            <a href="/security-services/attendance-report">+ New Report</a>
                            <a href="/security/attendance-reports">← Back to History</a>
                        </div>
                    </div>
                    
                    <div class="view-card">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Location</label>
                                <span>${report.Location}</span>
                            </div>
                            <div class="info-item">
                                <label>Date</label>
                                <span>${reportDate}</span>
                            </div>
                            <div class="info-item">
                                <label>Created By</label>
                                <span>${report.CreatedBy}</span>
                            </div>
                        </div>
                        
                        <div class="section-title">👤 Employee Entries</div>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Employee Name</th>
                                    <th>Time In</th>
                                    <th>Time Out</th>
                                    <th>Informed</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${entriesHtml}
                            </tbody>
                        </table>
                        
                        <div class="footer-info">
                            Report created on ${new Date(report.CreatedAt).toLocaleString('en-GB')}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading attendance report:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// List Attendance Reports API
router.get('/list', async (req, res) => {
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

module.exports = router;
