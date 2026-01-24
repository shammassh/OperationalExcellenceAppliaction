/**
 * Complaint Routes
 * Store managers submit and track complaints to Third-Party/Cleaning/Procurement/Maintenance departments
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../../uploads/complaints');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'complaint-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Category to Complaint Types mapping - now loaded from database
// (keeping this for reference, actual data comes from ComplaintCategories, ComplaintTypes, ComplaintCases tables)

// Main page - Complaint Form
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get stores for dropdown
        const stores = await pool.request().query(`
            SELECT Id, StoreName, StoreCode FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        // Get complaint config (hierarchical)
        const categories = await pool.request().query('SELECT * FROM ComplaintCategories WHERE IsActive = 1 ORDER BY SortOrder, Name');
        const types = await pool.request().query('SELECT * FROM ComplaintTypes WHERE IsActive = 1 ORDER BY SortOrder, Name');
        const cases = await pool.request().query('SELECT * FROM ComplaintCases WHERE IsActive = 1 ORDER BY SortOrder, Name');
        
        await pool.close();
        
        // Build hierarchical config for JavaScript
        const complaintConfig = categories.recordset.map(cat => ({
            id: cat.Id,
            name: cat.Name,
            icon: cat.Icon || '📁',
            types: types.recordset.filter(t => t.CategoryId === cat.Id).map(type => ({
                id: type.Id,
                name: type.Name,
                cases: cases.recordset.filter(c => c.TypeId === type.Id).map(cs => ({
                    id: cs.Id,
                    name: cs.Name
                }))
            }))
        }));
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.Id}">${s.StoreName} (${s.StoreCode})</option>`
        ).join('');
        
        const categoryOptions = categories.recordset.map(c =>
            `<option value="${c.Id}">${c.Icon || '📁'} ${c.Name}</option>`
        ).join('');
        
        const userName = req.session?.user?.displayName || req.session?.user?.email || 'User';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Complaint - ${process.env.APP_NAME || 'OE App'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                        padding: 8px 15px;
                        border-radius: 6px;
                        transition: all 0.3s;
                    }
                    .header-nav a:hover { opacity: 1; background: rgba(255,255,255,0.1); }
                    .container { max-width: 900px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .card-header {
                        border-bottom: 2px solid #e17055;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    .card-header h2 { color: #e17055; font-size: 20px; }
                    .card-header p { color: #666; margin-top: 5px; font-size: 14px; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label {
                        display: block;
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: #333;
                    }
                    .form-group label .required { color: #e17055; }
                    .form-control {
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        transition: border-color 0.3s;
                    }
                    .form-control:focus {
                        outline: none;
                        border-color: #e17055;
                    }
                    textarea.form-control { min-height: 120px; resize: vertical; }
                    .btn {
                        padding: 12px 30px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.3s;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                    }
                    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(225,112,85,0.4); }
                    .form-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                    }
                    .form-row-3 {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 20px;
                    }
                    @media (max-width: 768px) {
                        .form-row, .form-row-3 { grid-template-columns: 1fr; }
                    }
                    .file-input-wrapper {
                        position: relative;
                        overflow: hidden;
                        display: inline-block;
                        width: 100%;
                    }
                    .file-input-wrapper input[type=file] {
                        position: absolute;
                        left: 0;
                        top: 0;
                        opacity: 0;
                        cursor: pointer;
                        width: 100%;
                        height: 100%;
                    }
                    .file-input-label {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        padding: 20px;
                        border: 2px dashed #e0e0e0;
                        border-radius: 8px;
                        background: #f9f9f9;
                        cursor: pointer;
                        transition: all 0.3s;
                    }
                    .file-input-label:hover { border-color: #e17055; background: #fff5f3; }
                    .file-name { color: #666; font-size: 13px; margin-top: 8px; }
                    .checkbox-group {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .checkbox-group input[type="checkbox"] {
                        width: 20px;
                        height: 20px;
                        cursor: pointer;
                    }
                    .info-box {
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        border-radius: 8px;
                        padding: 15px;
                        margin-bottom: 20px;
                        font-size: 14px;
                        color: #856404;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📝 Complaint</h1>
                    <div class="header-nav">
                        <a href="/stores/complaint/list">📋 All Complaints</a>
                        <a href="/stores/complaint/history">📜 My Submissions</a>
                        <a href="/stores">← Back to Stores</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <h2>Submit a New Complaint</h2>
                            <p>Report issues with Cleaning, Third Party, Procurement, or Maintenance services</p>
                        </div>
                        
                        <div class="info-box">
                            ℹ️ Use this form to report issues you are facing with cleaning, helpers, security, valet, procurement, or maintenance services at your store. The relevant department will handle your complaint and provide updates.
                        </div>
                        
                        <form id="complaintForm" method="POST" action="/stores/complaint/submit" enctype="multipart/form-data">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Store <span class="required">*</span></label>
                                    <select name="storeId" class="form-control" required>
                                        <option value="">-- Select Store --</option>
                                        ${storeOptions}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Created By</label>
                                    <input type="text" class="form-control" value="${userName}" readonly style="background:#f5f5f5;">
                                </div>
                            </div>
                            
                            <div class="form-row-3">
                                <div class="form-group">
                                    <label>Category <span class="required">*</span></label>
                                    <select name="categoryId" id="categoryId" class="form-control" required onchange="updateComplaintTypes()">
                                        <option value="">-- Select Category --</option>
                                        ${categoryOptions}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Complaint Type <span class="required">*</span></label>
                                    <select name="complaintTypeId" id="complaintTypeId" class="form-control" required onchange="updateCases()">
                                        <option value="">-- Select Category First --</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Case <span class="required">*</span></label>
                                    <select name="caseId" id="caseId" class="form-control" required>
                                        <option value="">-- Select Type First --</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Complaint Description <span class="required">*</span></label>
                                <textarea name="description" class="form-control" placeholder="Provide full details of the issue you are facing..." required></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label>Attachment</label>
                                <div class="file-input-wrapper">
                                    <div class="file-input-label" id="fileLabel">
                                        <span>📎</span> Click to upload an image or document
                                    </div>
                                    <input type="file" name="attachment" id="attachment" accept="image/*,.pdf,.doc,.docx" onchange="updateFileName()">
                                </div>
                                <div class="file-name" id="fileName"></div>
                            </div>
                            
                            <button type="submit" class="btn btn-primary">
                                <span>📤</span> Submit Complaint
                            </button>
                        </form>
                    </div>
                </div>
                
                <script>
                    const complaintConfig = ${JSON.stringify(complaintConfig)};
                    
                    function updateComplaintTypes() {
                        const categoryId = parseInt(document.getElementById('categoryId').value);
                        const typeSelect = document.getElementById('complaintTypeId');
                        const caseSelect = document.getElementById('caseId');
                        
                        typeSelect.innerHTML = '<option value="">-- Select Type --</option>';
                        caseSelect.innerHTML = '<option value="">-- Select Type First --</option>';
                        
                        const category = complaintConfig.find(c => c.id === categoryId);
                        if (category && category.types) {
                            category.types.forEach(type => {
                                typeSelect.innerHTML += '<option value="' + type.id + '">' + type.name + '</option>';
                            });
                        }
                    }
                    
                    function updateCases() {
                        const categoryId = parseInt(document.getElementById('categoryId').value);
                        const typeId = parseInt(document.getElementById('complaintTypeId').value);
                        const caseSelect = document.getElementById('caseId');
                        
                        caseSelect.innerHTML = '<option value="">-- Select Case --</option>';
                        
                        const category = complaintConfig.find(c => c.id === categoryId);
                        if (category) {
                            const type = category.types.find(t => t.id === typeId);
                            if (type && type.cases) {
                                type.cases.forEach(cs => {
                                    caseSelect.innerHTML += '<option value="' + cs.id + '">' + cs.name + '</option>';
                                });
                            }
                        }
                    }
                    
                    function updateFileName() {
                        const input = document.getElementById('attachment');
                        const fileName = document.getElementById('fileName');
                        if (input.files.length > 0) {
                            fileName.textContent = '📄 ' + input.files[0].name;
                            document.getElementById('fileLabel').innerHTML = '<span>✅</span> File selected - Click to change';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading complaint form:', err);
        res.status(500).send('Error loading form: ' + err.message);
    }
});

// Submit complaint
router.post('/submit', upload.single('attachment'), async (req, res) => {
    try {
        const { storeId, categoryId, complaintTypeId, caseId, description } = req.body;
        const userId = req.session?.user?.id || 1;
        
        const attachmentUrl = req.file ? '/uploads/complaints/' + req.file.filename : null;
        const attachmentName = req.file ? req.file.originalname : null;
        
        const pool = await sql.connect(dbConfig);
        
        // Get the text names for backward compatibility (Category, ComplaintType columns)
        const categoryResult = await pool.request()
            .input('catId', sql.Int, categoryId)
            .query('SELECT Name FROM ComplaintCategories WHERE Id = @catId');
        const categoryName = categoryResult.recordset[0]?.Name || '';
        
        const typeResult = await pool.request()
            .input('typeId', sql.Int, complaintTypeId)
            .query('SELECT Name FROM ComplaintTypes WHERE Id = @typeId');
        const typeName = typeResult.recordset[0]?.Name || '';
        
        const caseResult = await pool.request()
            .input('caseId', sql.Int, caseId)
            .query('SELECT Name FROM ComplaintCases WHERE Id = @caseId');
        const caseName = caseResult.recordset[0]?.Name || '';
        
        // TransferTo defaults to the category name (department handles based on category)
        const transferName = categoryName;
        
        await pool.request()
            .input('storeId', sql.Int, storeId)
            .input('createdBy', sql.Int, userId)
            .input('categoryId', sql.Int, categoryId)
            .input('complaintTypeId', sql.Int, complaintTypeId)
            .input('caseId', sql.Int, caseId)
            .input('category', sql.NVarChar, categoryName)
            .input('complaintType', sql.NVarChar, typeName)
            .input('caseNumber', sql.NVarChar, caseName)
            .input('description', sql.NVarChar, description)
            .input('attachmentUrl', sql.NVarChar, attachmentUrl)
            .input('attachmentName', sql.NVarChar, attachmentName)
            .input('transferTo', sql.NVarChar, transferName)
            .input('status', sql.NVarChar, 'Open')
            .input('createdAt', sql.DateTime, new Date())
            .query(`
                INSERT INTO Complaints (StoreId, CreatedBy, CategoryId, ComplaintTypeId, CaseId, Category, ComplaintType, CaseNumber, Description, 
                    AttachmentUrl, AttachmentName, TransferTo, Status, CreatedAt)
                VALUES (@storeId, @createdBy, @categoryId, @complaintTypeId, @caseId, @category, @complaintType, @caseNumber, @description,
                    @attachmentUrl, @attachmentName, @transferTo, @status, @createdAt)
            `);
        
        await pool.close();
        
        res.redirect('/stores/complaint/success');
    } catch (err) {
        console.error('Error submitting complaint:', err);
        res.status(500).send('Error submitting complaint: ' + err.message);
    }
});

// Success page
router.get('/success', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Complaint Submitted - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .success-card {
                    background: white;
                    border-radius: 15px;
                    padding: 50px;
                    text-align: center;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    max-width: 500px;
                }
                .success-icon { font-size: 60px; margin-bottom: 20px; }
                .success-title { font-size: 24px; color: #27ae60; margin-bottom: 10px; }
                .success-msg { color: #666; margin-bottom: 30px; line-height: 1.6; }
                .btn {
                    padding: 12px 30px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    text-decoration: none;
                    display: inline-block;
                    margin: 5px;
                }
                .btn-primary { background: #e17055; color: white; }
                .btn-secondary { background: #6c757d; color: white; }
            </style>
        </head>
        <body>
            <div class="success-card">
                <div class="success-icon">✅</div>
                <div class="success-title">Complaint Submitted!</div>
                <div class="success-msg">Your complaint has been sent to the relevant department. You will receive updates as they handle your issue.</div>
                <a href="/stores/complaint" class="btn btn-primary">Submit Another</a>
                <a href="/stores/complaint/history" class="btn btn-secondary">View My Complaints</a>
            </div>
        </body>
        </html>
    `);
});

// My submissions history
router.get('/history', async (req, res) => {
    try {
        const userId = req.session?.user?.id || 1;
        const pool = await sql.connect(dbConfig);
        
        const complaints = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT c.*, s.StoreName, u.DisplayName as CreatedByName
                FROM Complaints c
                LEFT JOIN Stores s ON c.StoreId = s.Id
                LEFT JOIN Users u ON c.CreatedBy = u.Id
                WHERE c.CreatedBy = @userId
                ORDER BY c.CreatedAt DESC
            `);
        
        await pool.close();
        
        const rows = complaints.recordset.map(c => `
            <tr onclick="window.location='/stores/complaint/view/${c.Id}'" style="cursor:pointer;">
                <td>${c.Id}</td>
                <td>${new Date(c.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>${c.StoreName || '-'}</td>
                <td><span class="category-badge ${c.Category?.toLowerCase().replace(' ', '-')}">${c.Category || '-'}</span></td>
                <td>${c.ComplaintType || '-'}</td>
                <td>${c.CaseNumber || '-'}</td>
                <td><span class="status-badge ${c.Status?.toLowerCase().replace(' ', '-')}">${c.Status}</span></td>
            </tr>
        `).join('');
        
        res.send(generateListPage('My Complaints', rows, true));
    } catch (err) {
        console.error('Error loading complaint history:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// All complaints list (for department users)
router.get('/list', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const complaints = await pool.request().query(`
            SELECT c.*, s.StoreName, u.DisplayName as CreatedByName
            FROM Complaints c
            LEFT JOIN Stores s ON c.StoreId = s.Id
            LEFT JOIN Users u ON c.CreatedBy = u.Id
            ORDER BY 
                CASE WHEN c.Escalate = 1 THEN 0 ELSE 1 END,
                CASE c.Status WHEN 'Open' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
                c.CreatedAt DESC
        `);
        
        await pool.close();
        
        const rows = complaints.recordset.map(c => `
            <tr onclick="window.location='/stores/complaint/view/${c.Id}'" style="cursor:pointer;">
                <td>${c.Id}</td>
                <td>${new Date(c.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>${c.StoreName || '-'}</td>
                <td>${c.CreatedByName || '-'}</td>
                <td><span class="category-badge ${c.Category?.toLowerCase().replace(' ', '-')}">${c.Category || '-'}</span></td>
                <td>${c.ComplaintType || '-'}</td>
                <td>${c.CaseNumber || '-'}</td>
                <td><span class="status-badge ${c.Status?.toLowerCase().replace(' ', '-')}">${c.Status}</span></td>
            </tr>
        `).join('');
        
        res.send(generateListPage('All Complaints', rows, false));
    } catch (err) {
        console.error('Error loading complaints list:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// View single complaint
router.get('/view/:id', async (req, res) => {
    try {
        const complaintId = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        const complaint = await pool.request()
            .input('id', sql.Int, complaintId)
            .query(`
                SELECT c.*, s.StoreName, u.DisplayName as CreatedByName
                FROM Complaints c
                LEFT JOIN Stores s ON c.StoreId = s.Id
                LEFT JOIN Users u ON c.CreatedBy = u.Id
                WHERE c.Id = @id
            `);
        
        const updates = await pool.request()
            .input('complaintId', sql.Int, complaintId)
            .query(`
                SELECT cu.*, u.DisplayName as UpdatedByName
                FROM ComplaintUpdates cu
                LEFT JOIN Users u ON cu.UpdatedBy = u.Id
                WHERE cu.ComplaintId = @complaintId
                ORDER BY cu.UpdatedAt DESC
            `);
        
        await pool.close();
        
        if (!complaint.recordset.length) {
            return res.status(404).send('Complaint not found');
        }
        
        const c = complaint.recordset[0];
        
        const updateRows = updates.recordset.map(u => `
            <div class="update-item">
                <div class="update-header">
                    <strong>${u.UpdatedByName || 'Unknown'}</strong>
                    <span>${new Date(u.UpdatedAt).toLocaleString('en-GB')}</span>
                </div>
                <div class="update-text">${u.UpdateNote}</div>
            </div>
        `).join('') || '<p style="color:#888;">No updates yet</p>';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Complaint #${c.Id} - ${process.env.APP_NAME || 'OE App'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1000px; margin: 0 auto; padding: 30px 20px; }
                    .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); margin-bottom: 20px; }
                    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
                    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
                    .detail-item label { display: block; color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
                    .detail-item .value { font-size: 15px; font-weight: 500; }
                    .description-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; line-height: 1.6; }
                    .status-badge, .category-badge {
                        padding: 6px 15px;
                        border-radius: 20px;
                        font-size: 13px;
                        font-weight: 600;
                        display: inline-block;
                    }
                    .status-badge.open { background: #cce5ff; color: #004085; }
                    .status-badge.in-progress { background: #fff3cd; color: #856404; }
                    .status-badge.resolved { background: #d4edda; color: #155724; }
                    .status-badge.closed { background: #e2e3e5; color: #383d41; }
                    .category-badge.cleaning { background: #d4edda; color: #155724; }
                    .category-badge.third-party { background: #cce5ff; color: #004085; }
                    .category-badge.procurement { background: #e2d5f1; color: #6f42c1; }
                    .category-badge.maintenance { background: #fff3cd; color: #856404; }
                    .escalate-badge { background: #f8d7da; color: #721c24; padding: 6px 15px; border-radius: 20px; font-weight: 600; }
                    .update-item { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #e17055; }
                    .update-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
                    .update-header span { color: #888; }
                    .update-text { line-height: 1.5; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; font-weight: 600; margin-bottom: 8px; }
                    .form-control { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; }
                    .form-control:focus { outline: none; border-color: #e17055; }
                    .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
                    .btn-primary { background: #e17055; color: white; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-warning { background: #ffc107; color: #333; }
                    .action-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
                    .two-col { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
                    @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📝 Complaint #${c.Id}</h1>
                    <div class="header-nav">
                        <a href="/stores/complaint/list">← Back to List</a>
                        <a href="/stores">Stores</a>
                    </div>
                </div>
                <div class="container">
                    <div class="two-col">
                        <div>
                            <div class="card">
                                <div class="card-title">Complaint Details</div>
                                <div class="detail-grid">
                                    <div class="detail-item">
                                        <label>Store</label>
                                        <div class="value">${c.StoreName || '-'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Created By</label>
                                        <div class="value">${c.CreatedByName || '-'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Created At</label>
                                        <div class="value">${new Date(c.CreatedAt).toLocaleString('en-GB')}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Category</label>
                                        <div class="value"><span class="category-badge ${c.Category?.toLowerCase().replace(' ', '-')}">${c.Category}</span></div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Complaint Type</label>
                                        <div class="value">${c.ComplaintType}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Transfer To</label>
                                        <div class="value">${c.TransferTo}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Status</label>
                                        <div class="value"><span class="status-badge ${c.Status?.toLowerCase().replace(' ', '-')}">${c.Status}</span></div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Due Date</label>
                                        <div class="value">${c.DueDate ? new Date(c.DueDate).toLocaleDateString('en-GB') : '-'}</div>
                                    </div>
                                    ${c.Escalate ? '<div class="detail-item"><label>Escalated</label><div class="value"><span class="escalate-badge">🔴 URGENT</span></div></div>' : ''}
                                    ${c.CaseNumber ? `<div class="detail-item"><label>Case Reference</label><div class="value">${c.CaseNumber}</div></div>` : ''}
                                </div>
                                <div class="description-box">
                                    <strong>Description:</strong><br><br>
                                    ${c.Description}
                                </div>
                                ${c.AttachmentUrl ? `
                                    <div style="margin-top: 15px;">
                                        <strong>Attachment:</strong> <a href="${c.AttachmentUrl}" target="_blank">📎 ${c.AttachmentName || 'View Attachment'}</a>
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="card">
                                <div class="card-title">Updates</div>
                                ${updateRows}
                            </div>
                        </div>
                        
                        <div>
                            <div class="card">
                                <div class="card-title">Actions</div>
                                
                                <form action="/stores/complaint/${c.Id}/update" method="POST">
                                    <div class="form-group">
                                        <label>Add Update</label>
                                        <textarea name="updateNote" class="form-control" rows="3" placeholder="Enter update note..."></textarea>
                                    </div>
                                    <button type="submit" class="btn btn-primary" style="width:100%;">💬 Add Update</button>
                                </form>
                                
                                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                                
                                <form action="/stores/complaint/${c.Id}/status" method="POST">
                                    <div class="form-group">
                                        <label>Change Status</label>
                                        <select name="status" class="form-control">
                                            <option value="Open" ${c.Status === 'Open' ? 'selected' : ''}>Open</option>
                                            <option value="In Progress" ${c.Status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                            <option value="Resolved" ${c.Status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                            <option value="Closed" ${c.Status === 'Closed' ? 'selected' : ''}>Closed</option>
                                        </select>
                                    </div>
                                    <button type="submit" class="btn btn-success" style="width:100%;">✓ Update Status</button>
                                </form>
                                
                                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                                
                                <form action="/stores/complaint/${c.Id}/snooze" method="POST">
                                    <div class="form-group">
                                        <label>Snooze Until</label>
                                        <input type="datetime-local" name="snoozeUntil" class="form-control" value="${c.SnoozeUntil ? new Date(c.SnoozeUntil).toISOString().slice(0,16) : ''}">
                                    </div>
                                    <button type="submit" class="btn btn-warning" style="width:100%;">⏰ Snooze</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading complaint:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Add update to complaint
router.post('/:id/update', async (req, res) => {
    try {
        const complaintId = req.params.id;
        const { updateNote } = req.body;
        const userId = req.session?.user?.id || 1;
        
        if (!updateNote?.trim()) {
            return res.redirect('/stores/complaint/view/' + complaintId);
        }
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('complaintId', sql.Int, complaintId)
            .input('updateNote', sql.NVarChar, updateNote)
            .input('updatedBy', sql.Int, userId)
            .query(`
                INSERT INTO ComplaintUpdates (ComplaintId, UpdateNote, UpdatedBy, UpdatedAt)
                VALUES (@complaintId, @updateNote, @updatedBy, GETDATE())
            `);
        
        await pool.request()
            .input('id', sql.Int, complaintId)
            .query(`UPDATE Complaints SET UpdatedAt = GETDATE() WHERE Id = @id`);
        
        await pool.close();
        
        res.redirect('/stores/complaint/view/' + complaintId);
    } catch (err) {
        console.error('Error adding update:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Update complaint status
router.post('/:id/status', async (req, res) => {
    try {
        const complaintId = req.params.id;
        const { status } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, complaintId)
            .input('status', sql.NVarChar, status)
            .query(`UPDATE Complaints SET Status = @status, UpdatedAt = GETDATE() WHERE Id = @id`);
        
        await pool.close();
        
        res.redirect('/stores/complaint/view/' + complaintId);
    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Snooze complaint
router.post('/:id/snooze', async (req, res) => {
    try {
        const complaintId = req.params.id;
        const { snoozeUntil } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, complaintId)
            .input('snoozeUntil', sql.DateTime, snoozeUntil || null)
            .query(`UPDATE Complaints SET SnoozeUntil = @snoozeUntil, UpdatedAt = GETDATE() WHERE Id = @id`);
        
        await pool.close();
        
        res.redirect('/stores/complaint/view/' + complaintId);
    } catch (err) {
        console.error('Error snoozing complaint:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Helper function to generate list pages
function generateListPage(title, rows, isMyComplaints) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title} - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                .header {
                    background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { font-size: 24px; }
                .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; padding: 8px 15px; border-radius: 6px; }
                .header-nav a:hover { opacity: 1; background: rgba(255,255,255,0.1); }
                .container { max-width: 1400px; margin: 0 auto; padding: 30px 20px; }
                .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; min-width: 800px; }
                th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                th { background: #f8f9fa; font-weight: 600; position: sticky; top: 0; }
                tr:hover { background: #f8f9fa; }
                .status-badge, .category-badge {
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-badge.open { background: #cce5ff; color: #004085; }
                .status-badge.in-progress { background: #fff3cd; color: #856404; }
                .status-badge.resolved { background: #d4edda; color: #155724; }
                .status-badge.closed { background: #e2e3e5; color: #383d41; }
                .category-badge.cleaning { background: #d4edda; color: #155724; }
                .category-badge.third-party { background: #cce5ff; color: #004085; }
                .category-badge.procurement { background: #e2d5f1; color: #6f42c1; }
                .category-badge.maintenance { background: #fff3cd; color: #856404; }
                .category-badge.helper { background: #ffeaa7; color: #856404; }
                .category-badge.security { background: #74b9ff; color: #0056b3; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 ${title}</h1>
                <div class="header-nav">
                    <a href="/stores/complaint">+ New Complaint</a>
                    ${isMyComplaints ? '<a href="/stores/complaint/list">All Complaints</a>' : '<a href="/stores/complaint/history">My Complaints</a>'}
                    <a href="/stores">← Back to Stores</a>
                </div>
            </div>
            <div class="container">
                <div class="card">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Store</th>
                                ${isMyComplaints ? '' : '<th>Created By</th>'}
                                <th>Category</th>
                                <th>Type</th>
                                <th>Case</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="8" style="text-align:center;color:#888;">No complaints found</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
    `;
}

module.exports = router;
