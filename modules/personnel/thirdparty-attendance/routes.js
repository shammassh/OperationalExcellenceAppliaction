/**
 * Third-Parties Attendance Routes
 * Personnel can download CSV template and upload attendance data
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file upload
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

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

// Main page - shows upload history
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser.userId;
        
        // Get user's upload history
        const uploads = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT u.*, usr.DisplayName as UploadedByName
                FROM ThirdpartyAttendanceUploads u
                LEFT JOIN Users usr ON u.UploadedBy = usr.Id
                WHERE u.UploadedBy = @userId
                ORDER BY u.UploadedAt DESC
            `);
        
        await pool.close();
        
        const tableRows = uploads.recordset.map(u => {
            const uploadedAt = new Date(u.UploadedAt).toLocaleDateString('en-GB') + ' ' + 
                               new Date(u.UploadedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            return `
                <tr onclick="viewUpload('${u.BatchId}')" style="cursor:pointer;">
                    <td>${u.FileName || '-'}</td>
                    <td>${u.RecordCount} records</td>
                    <td>${uploadedAt}</td>
                    <td>
                        <a href="/personnel/thirdparty-attendance/view/${u.BatchId}" class="btn btn-sm btn-primary" onclick="event.stopPropagation();">View</a>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Third-Parties Attendance - ${process.env.APP_NAME}</title>
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
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                        font-weight: 600;
                        display: inline-block;
                    }
                    .btn-primary { background: #e67e22; color: white; }
                    .btn-primary:hover { background: #d35400; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .empty-state {
                        text-align: center;
                        padding: 50px;
                        color: #666;
                    }
                    .empty-icon { font-size: 50px; margin-bottom: 15px; }
                    
                    .upload-section {
                        display: flex;
                        gap: 20px;
                        align-items: center;
                        flex-wrap: wrap;
                    }
                    .upload-box {
                        flex: 1;
                        min-width: 300px;
                        border: 2px dashed #ddd;
                        border-radius: 10px;
                        padding: 30px;
                        text-align: center;
                        transition: all 0.3s;
                    }
                    .upload-box:hover, .upload-box.dragover {
                        border-color: #e67e22;
                        background: #fff8f0;
                    }
                    .upload-box input[type="file"] {
                        display: none;
                    }
                    .upload-icon { font-size: 40px; margin-bottom: 10px; }
                    .template-box {
                        background: #f8f9fa;
                        border-radius: 10px;
                        padding: 25px;
                        text-align: center;
                    }
                    .template-box h4 { margin: 0 0 15px 0; color: #333; }
                    .template-box p { color: #666; font-size: 13px; margin-bottom: 15px; }
                    
                    .alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .alert-success { background: #d4edda; color: #155724; }
                    .alert-danger { background: #f8d7da; color: #721c24; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Third-Parties Attendance</h1>
                    <div class="header-nav">
                        <a href="/personnel">← Back to Personnel</a>
                    </div>
                </div>
                <div class="container">
                    ${req.query.success ? '<div class="alert alert-success">✓ File uploaded successfully! ' + (req.query.count || 0) + ' records imported.</div>' : ''}
                    ${req.query.error ? '<div class="alert alert-danger">✗ ' + decodeURIComponent(req.query.error) + '</div>' : ''}
                    
                    <div class="card">
                        <div class="card-title">📤 Upload Attendance Data</div>
                        <div class="upload-section">
                            <div class="template-box">
                                <h4>Step 1: Download Template</h4>
                                <p>Download the CSV template, fill in the attendance data, then upload.</p>
                                <a href="/personnel/thirdparty-attendance/template" class="btn btn-success">⬇ Download CSV Template</a>
                            </div>
                            
                            <form action="/personnel/thirdparty-attendance/upload" method="POST" enctype="multipart/form-data" id="uploadForm">
                                <div class="upload-box" id="dropZone" onclick="document.getElementById('csvFile').click();">
                                    <div class="upload-icon">📁</div>
                                    <h4>Step 2: Upload Filled CSV</h4>
                                    <p style="color:#666;">Click to browse or drag & drop your CSV file here</p>
                                    <input type="file" name="csvFile" id="csvFile" accept=".csv" onchange="handleFileSelect(this)">
                                    <div id="fileName" style="margin-top:10px; color:#e67e22; font-weight:600;"></div>
                                </div>
                                <button type="submit" class="btn btn-primary" style="margin-top:15px; display:none;" id="uploadBtn">📤 Upload File</button>
                            </form>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">📜 Upload History</div>
                        ${uploads.recordset.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-icon">📋</div>
                                <h3>No Uploads Yet</h3>
                                <p>Download the template, fill in attendance data, and upload.</p>
                            </div>
                        ` : `
                            <table>
                                <thead>
                                    <tr>
                                        <th>File Name</th>
                                        <th>Records</th>
                                        <th>Uploaded</th>
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
                    function handleFileSelect(input) {
                        if (input.files.length > 0) {
                            document.getElementById('fileName').textContent = input.files[0].name;
                            document.getElementById('uploadBtn').style.display = 'inline-block';
                        }
                    }
                    
                    function viewUpload(batchId) {
                        window.location.href = '/personnel/thirdparty-attendance/view/' + batchId;
                    }
                    
                    // Drag and drop
                    const dropZone = document.getElementById('dropZone');
                    
                    dropZone.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        dropZone.classList.add('dragover');
                    });
                    
                    dropZone.addEventListener('dragleave', () => {
                        dropZone.classList.remove('dragover');
                    });
                    
                    dropZone.addEventListener('drop', (e) => {
                        e.preventDefault();
                        dropZone.classList.remove('dragover');
                        const files = e.dataTransfer.files;
                        if (files.length > 0 && files[0].name.endsWith('.csv')) {
                            document.getElementById('csvFile').files = files;
                            handleFileSelect(document.getElementById('csvFile'));
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading attendance page:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Download CSV template
router.get('/template', (req, res) => {
    const headers = 'Store,Code,First Name,Last Name,Company,Date,Worker Type,In,Out,Total Hours';
    const sampleRow = 'Store Name,ST001,John,Doe,ABC Company,2026-01-22,Cleaner,08:00,17:00,9';
    const csvContent = headers + '\n' + sampleRow;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="thirdparty-attendance-template.csv"');
    res.send(csvContent);
});

// Upload CSV file
router.post('/upload', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.redirect('/personnel/thirdparty-attendance?error=' + encodeURIComponent('Please select a CSV file'));
        }
        
        const userId = req.currentUser.userId;
        const batchId = uuidv4();
        const fileName = req.file.originalname;
        
        // Parse CSV content
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            return res.redirect('/personnel/thirdparty-attendance?error=' + encodeURIComponent('CSV file is empty or has no data rows'));
        }
        
        // Skip header row
        const dataRows = lines.slice(1);
        
        const pool = await sql.connect(dbConfig);
        
        let recordCount = 0;
        
        for (const row of dataRows) {
            const columns = parseCSVRow(row);
            
            if (columns.length >= 10) {
                await pool.request()
                    .input('batchId', sql.UniqueIdentifier, batchId)
                    .input('storeName', sql.NVarChar, columns[0] || null)
                    .input('storeCode', sql.NVarChar, columns[1] || null)
                    .input('firstName', sql.NVarChar, columns[2] || null)
                    .input('lastName', sql.NVarChar, columns[3] || null)
                    .input('company', sql.NVarChar, columns[4] || null)
                    .input('attendanceDate', sql.NVarChar, columns[5] || null)
                    .input('workerType', sql.NVarChar, columns[6] || null)
                    .input('timeIn', sql.NVarChar, columns[7] || null)
                    .input('timeOut', sql.NVarChar, columns[8] || null)
                    .input('totalHours', sql.NVarChar, columns[9] || null)
                    .input('uploadedBy', sql.Int, userId)
                    .query(`
                        INSERT INTO ThirdpartyAttendance 
                        (UploadBatchId, StoreName, StoreCode, FirstName, LastName, Company, 
                         AttendanceDate, WorkerType, TimeIn, TimeOut, TotalHours, UploadedBy)
                        VALUES 
                        (@batchId, @storeName, @storeCode, @firstName, @lastName, @company,
                         TRY_CAST(@attendanceDate AS DATE), @workerType, @timeIn, @timeOut, @totalHours, @uploadedBy)
                    `);
                recordCount++;
            }
        }
        
        // Record the upload
        await pool.request()
            .input('batchId', sql.UniqueIdentifier, batchId)
            .input('fileName', sql.NVarChar, fileName)
            .input('recordCount', sql.Int, recordCount)
            .input('uploadedBy', sql.Int, userId)
            .query(`
                INSERT INTO ThirdpartyAttendanceUploads (BatchId, FileName, RecordCount, UploadedBy)
                VALUES (@batchId, @fileName, @recordCount, @uploadedBy)
            `);
        
        await pool.close();
        
        res.redirect('/personnel/thirdparty-attendance?success=1&count=' + recordCount);
    } catch (err) {
        console.error('Error uploading file:', err);
        res.redirect('/personnel/thirdparty-attendance?error=' + encodeURIComponent(err.message));
    }
});

// View uploaded records
router.get('/view/:batchId', async (req, res) => {
    try {
        const batchId = req.params.batchId;
        const pool = await sql.connect(dbConfig);
        
        // Get upload info
        const uploadInfo = await pool.request()
            .input('batchId', sql.UniqueIdentifier, batchId)
            .query(`
                SELECT u.*, usr.DisplayName as UploadedByName
                FROM ThirdpartyAttendanceUploads u
                LEFT JOIN Users usr ON u.UploadedBy = usr.Id
                WHERE u.BatchId = @batchId
            `);
        
        if (uploadInfo.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Upload not found');
        }
        
        const upload = uploadInfo.recordset[0];
        
        // Get records
        const records = await pool.request()
            .input('batchId', sql.UniqueIdentifier, batchId)
            .query(`
                SELECT * FROM ThirdpartyAttendance
                WHERE UploadBatchId = @batchId
                ORDER BY Id
            `);
        
        await pool.close();
        
        const uploadedAt = new Date(upload.UploadedAt).toLocaleDateString('en-GB') + ' ' +
                          new Date(upload.UploadedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        const tableRows = records.recordset.map((r, idx) => {
            const attendanceDate = r.AttendanceDate ? new Date(r.AttendanceDate).toLocaleDateString('en-GB') : '-';
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${r.StoreName || '-'}</td>
                    <td>${r.StoreCode || '-'}</td>
                    <td>${r.FirstName || '-'}</td>
                    <td>${r.LastName || '-'}</td>
                    <td>${r.Company || '-'}</td>
                    <td>${attendanceDate}</td>
                    <td>${r.WorkerType || '-'}</td>
                    <td>${r.TimeIn || '-'}</td>
                    <td>${r.TimeOut || '-'}</td>
                    <td>${r.TotalHours || '-'}</td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>View Upload - ${process.env.APP_NAME}</title>
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
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                    }
                    .info-item label { display: block; font-size: 12px; color: #666; margin-bottom: 5px; }
                    .info-item span { font-weight: 600; color: #333; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px; text-align: left; border: 1px solid #ddd; font-size: 13px; }
                    th { background: #e67e22; color: white; }
                    tr:nth-child(even) { background: #f9f9f9; }
                    @media print {
                        .header { display: none; }
                        .container { padding: 0; }
                        .card { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Upload Details</h1>
                    <div class="header-nav">
                        <a href="javascript:window.print()">🖨️ Print</a>
                        <a href="/personnel/thirdparty-attendance">← Back</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-title">📄 Upload Information</div>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>File Name</label>
                                <span>${upload.FileName || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Records</label>
                                <span>${upload.RecordCount}</span>
                            </div>
                            <div class="info-item">
                                <label>Uploaded By</label>
                                <span>${upload.UploadedByName || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Uploaded At</label>
                                <span>${uploadedAt}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">👥 Attendance Records</div>
                        <div style="overflow-x:auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Store</th>
                                        <th>Code</th>
                                        <th>First Name</th>
                                        <th>Last Name</th>
                                        <th>Company</th>
                                        <th>Date</th>
                                        <th>Worker Type</th>
                                        <th>In</th>
                                        <th>Out</th>
                                        <th>Total Hours</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows || '<tr><td colspan="11" style="text-align:center;color:#666;">No records</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing upload:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Helper function to parse CSV row (handles quoted fields)
function parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

module.exports = router;
