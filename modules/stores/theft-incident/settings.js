/**
 * Theft Incident Settings - Routes
 * Manages Stores, Capture Methods, and Outsource Security Companies
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');

// Configure multer for CSV upload
const uploadStorage = multer.memoryStorage();
const csvUpload = multer({
    storage: uploadStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /csv|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Only CSV files are allowed'));
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

// Settings Page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const stores = await pool.request().query('SELECT * FROM Stores ORDER BY StoreName');
        const captureMethods = await pool.request().query('SELECT * FROM CaptureMethods ORDER BY MethodName');
        const companies = await pool.request().query('SELECT * FROM OutsourceSecurityCompanies ORDER BY CompanyName');
        
        await pool.close();
        
        const storeRows = stores.recordset.map(s => `
            <tr data-id="${s.Id}">
                <td>${s.StoreName}</td>
                <td>${s.StoreCode || '-'}</td>
                <td><span class="status-badge ${s.IsActive ? 'active' : 'inactive'}">${s.IsActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-edit" onclick="editStore(${s.Id}, '${s.StoreName.replace(/'/g, "\\'")}', '${(s.StoreCode || '').replace(/'/g, "\\'")}', ${s.IsActive})">Edit</button>
                    <button class="btn btn-sm btn-delete" onclick="deleteItem('stores', ${s.Id}, '${s.StoreName.replace(/'/g, "\\'")}')">Delete</button>
                </td>
            </tr>
        `).join('');
        
        const methodRows = captureMethods.recordset.map(m => `
            <tr data-id="${m.Id}">
                <td>${m.MethodName}</td>
                <td><span class="status-badge ${m.IsActive ? 'active' : 'inactive'}">${m.IsActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-edit" onclick="editMethod(${m.Id}, '${m.MethodName.replace(/'/g, "\\'")}', ${m.IsActive})">Edit</button>
                    <button class="btn btn-sm btn-delete" onclick="deleteItem('capture-methods', ${m.Id}, '${m.MethodName.replace(/'/g, "\\'")}')">Delete</button>
                </td>
            </tr>
        `).join('');
        
        const companyRows = companies.recordset.map(c => `
            <tr data-id="${c.Id}">
                <td>${c.CompanyName}</td>
                <td><span class="status-badge ${c.IsActive ? 'active' : 'inactive'}">${c.IsActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-edit" onclick="editCompany(${c.Id}, '${c.CompanyName.replace(/'/g, "\\'")}', ${c.IsActive})">Edit</button>
                    <button class="btn btn-sm btn-delete" onclick="deleteItem('outsource-companies', ${c.Id}, '${c.CompanyName.replace(/'/g, "\\'")}')">Delete</button>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Theft Incident Settings - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%);
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
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px; }
                    .breadcrumb { margin-bottom: 20px; color: #666; }
                    .breadcrumb a { color: #0078d4; text-decoration: none; }
                    
                    .tabs {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 20px;
                    }
                    .tab {
                        padding: 12px 24px;
                        background: white;
                        border: none;
                        border-radius: 8px 8px 0 0;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        color: #666;
                        transition: all 0.2s;
                    }
                    .tab.active {
                        background: #dc3545;
                        color: white;
                    }
                    .tab:hover:not(.active) { background: #eee; }
                    
                    .tab-content {
                        display: none;
                        background: white;
                        padding: 30px;
                        border-radius: 0 12px 12px 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    }
                    .tab-content.active { display: block; }
                    
                    .section-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                    .section-header h2 { font-size: 20px; color: #333; }
                    
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #fafafa; }
                    
                    .status-badge {
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .status-badge.active { background: #d4edda; color: #155724; }
                    .status-badge.inactive { background: #f8d7da; color: #721c24; }
                    
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.2s;
                    }
                    .btn-primary { background: #dc3545; color: white; }
                    .btn-primary:hover { background: #a71d2a; }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
                    .btn-edit { background: #0078d4; color: white; }
                    .btn-edit:hover { background: #005a9e; }
                    .btn-delete { background: #6c757d; color: white; }
                    .btn-delete:hover { background: #dc3545; }
                    
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .modal.show { display: flex; }
                    .modal-content {
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        width: 100%;
                        max-width: 500px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                    .modal-header h3 { font-size: 18px; color: #333; }
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                    }
                    .modal-close:hover { color: #333; }
                    
                    .form-group {
                        margin-bottom: 20px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 6px;
                        font-weight: 500;
                        color: #555;
                    }
                    .form-group input, .form-group select {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .form-group input:focus, .form-group select:focus {
                        outline: none;
                        border-color: #0078d4;
                    }
                    .checkbox-group {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .checkbox-group input { width: auto; }
                    
                    .modal-footer {
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 40px;
                        color: #888;
                    }
                    .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                    
                    .upload-section {
                        background: #f8f9fa;
                        border: 2px dashed #ddd;
                        border-radius: 12px;
                        padding: 25px;
                        margin-bottom: 25px;
                        text-align: center;
                    }
                    .upload-section:hover { border-color: #dc3545; }
                    .upload-section h3 { margin-bottom: 10px; color: #333; }
                    .upload-section p { color: #666; margin-bottom: 15px; font-size: 14px; }
                    .upload-section input[type="file"] {
                        display: none;
                    }
                    .upload-btn {
                        display: inline-block;
                        padding: 12px 24px;
                        background: #28a745;
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s;
                    }
                    .upload-btn:hover { background: #218838; }
                    .upload-info {
                        margin-top: 15px;
                        padding: 15px;
                        background: #e7f3ff;
                        border-radius: 8px;
                        text-align: left;
                    }
                    .upload-info code {
                        background: #fff;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-family: monospace;
                    }
                    .btn-group { display: flex; gap: 10px; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .upload-result {
                        margin-top: 15px;
                        padding: 15px;
                        border-radius: 8px;
                        display: none;
                    }
                    .upload-result.success { background: #d4edda; color: #155724; display: block; }
                    .upload-result.error { background: #f8d7da; color: #721c24; display: block; }
                    .progress-bar {
                        height: 20px;
                        background: #e9ecef;
                        border-radius: 10px;
                        overflow: hidden;
                        margin-top: 15px;
                        display: none;
                    }
                    .progress-bar.show { display: block; }
                    .progress-bar-fill {
                        height: 100%;
                        background: linear-gradient(90deg, #28a745, #20c997);
                        width: 0%;
                        transition: width 0.3s;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>⚙️ Theft Incident Settings</h1>
                    <div class="header-nav">
                        <a href="/stores/theft-incident">← Back to Form</a>
                        <a href="/stores">Stores</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="breadcrumb">
                        <a href="/dashboard">Dashboard</a> / <a href="/stores">Stores</a> / <a href="/stores/theft-incident">Theft Incident</a> / <span>Settings</span>
                    </div>
                    
                    <div class="tabs">
                        <button class="tab active" onclick="showTab('stores')">🏪 Stores</button>
                        <button class="tab" onclick="showTab('methods')">🎯 Capture Methods</button>
                        <button class="tab" onclick="showTab('companies')">🛡️ Security Companies</button>
                    </div>
                    
                    <!-- Stores Tab -->
                    <div id="stores-tab" class="tab-content active">
                        <div class="section-header">
                            <h2>🏪 Manage Stores</h2>
                            <div class="btn-group">
                                <button class="btn btn-success" onclick="showBulkUpload()">📤 Bulk Upload</button>
                                <button class="btn btn-primary" onclick="showAddStore()">+ Add Store</button>
                            </div>
                        </div>
                        
                        <!-- Bulk Upload Section -->
                        <div id="bulkUploadSection" class="upload-section" style="display:none;">
                            <h3>📤 Bulk Upload Stores</h3>
                            <p>Upload a CSV file with store names and codes</p>
                            <form id="bulkUploadForm" enctype="multipart/form-data">
                                <label class="upload-btn" for="csvFile">📁 Choose CSV File</label>
                                <input type="file" id="csvFile" name="csvFile" accept=".csv,.txt">
                                <span id="fileName" style="margin-left:15px;color:#666;"></span>
                            </form>
                            <div class="progress-bar" id="uploadProgress">
                                <div class="progress-bar-fill" id="progressFill"></div>
                            </div>
                            <div id="uploadResult" class="upload-result"></div>
                            <div class="upload-info">
                                <strong>📝 CSV Format:</strong><br>
                                <code>StoreName,StoreCode</code><br><br>
                                <strong>Example:</strong><br>
                                <code>Spinneys Beirut,SP001</code><br>
                                <code>Spinneys Jounieh,SP002</code><br>
                                <code>Spinneys Tripoli,SP003</code><br><br>
                                <small>• First row can be header (will be skipped if it contains "StoreName")<br>
                                • StoreCode is optional<br>
                                • Duplicate stores will be skipped</small>
                            </div>
                            <div style="margin-top:15px;">
                                <button class="btn" onclick="hideBulkUpload()">Cancel</button>
                                <button class="btn btn-success" onclick="uploadStores()">🚀 Upload Stores</button>
                                <a href="/stores/theft-incident/settings/stores/template" class="btn" style="text-decoration:none;">💾 Download Template</a>
                            </div>
                        </div>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th>Store Name</th>
                                    <th>Store Code</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="stores-body">
                                ${storeRows || '<tr><td colspan="4"><div class="empty-state"><div class="icon">🏪</div><p>No stores added yet</p></div></td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Capture Methods Tab -->
                    <div id="methods-tab" class="tab-content">
                        <div class="section-header">
                            <h2>🎯 Capture Methods</h2>
                            <button class="btn btn-primary" onclick="showAddMethod()">+ Add Method</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Method Name</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="methods-body">
                                ${methodRows || '<tr><td colspan="3"><div class="empty-state"><div class="icon">🎯</div><p>No capture methods added yet</p></div></td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Security Companies Tab -->
                    <div id="companies-tab" class="tab-content">
                        <div class="section-header">
                            <h2>🛡️ Outsource Security Companies</h2>
                            <button class="btn btn-primary" onclick="showAddCompany()">+ Add Company</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Company Name</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="companies-body">
                                ${companyRows || '<tr><td colspan="3"><div class="empty-state"><div class="icon">🛡️</div><p>No security companies added yet</p></div></td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Store Modal -->
                <div id="storeModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="storeModalTitle">Add Store</h3>
                            <button class="modal-close" onclick="closeModal('storeModal')">&times;</button>
                        </div>
                        <form id="storeForm" onsubmit="saveStore(event)">
                            <input type="hidden" id="storeId" name="id">
                            <div class="form-group">
                                <label for="storeName">Store Name *</label>
                                <input type="text" id="storeName" name="storeName" required>
                            </div>
                            <div class="form-group">
                                <label for="storeCode">Store Code</label>
                                <input type="text" id="storeCode" name="storeCode">
                            </div>
                            <div class="form-group">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="storeActive" name="isActive" checked>
                                    <label for="storeActive">Active</label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn" onclick="closeModal('storeModal')">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Method Modal -->
                <div id="methodModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="methodModalTitle">Add Capture Method</h3>
                            <button class="modal-close" onclick="closeModal('methodModal')">&times;</button>
                        </div>
                        <form id="methodForm" onsubmit="saveMethod(event)">
                            <input type="hidden" id="methodId" name="id">
                            <div class="form-group">
                                <label for="methodName">Method Name *</label>
                                <input type="text" id="methodName" name="methodName" required>
                            </div>
                            <div class="form-group">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="methodActive" name="isActive" checked>
                                    <label for="methodActive">Active</label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn" onclick="closeModal('methodModal')">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Company Modal -->
                <div id="companyModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="companyModalTitle">Add Security Company</h3>
                            <button class="modal-close" onclick="closeModal('companyModal')">&times;</button>
                        </div>
                        <form id="companyForm" onsubmit="saveCompany(event)">
                            <input type="hidden" id="companyId" name="id">
                            <div class="form-group">
                                <label for="companyName">Company Name *</label>
                                <input type="text" id="companyName" name="companyName" required>
                            </div>
                            <div class="form-group">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="companyActive" name="isActive" checked>
                                    <label for="companyActive">Active</label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn" onclick="closeModal('companyModal')">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    function showTab(tab) {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        event.target.classList.add('active');
                        document.getElementById(tab + '-tab').classList.add('active');
                    }
                    
                    function closeModal(id) {
                        document.getElementById(id).classList.remove('show');
                    }
                    
                    // Store functions
                    function showAddStore() {
                        document.getElementById('storeModalTitle').textContent = 'Add Store';
                        document.getElementById('storeForm').reset();
                        document.getElementById('storeId').value = '';
                        document.getElementById('storeActive').checked = true;
                        document.getElementById('storeModal').classList.add('show');
                    }
                    
                    function editStore(id, name, code, active) {
                        document.getElementById('storeModalTitle').textContent = 'Edit Store';
                        document.getElementById('storeId').value = id;
                        document.getElementById('storeName').value = name;
                        document.getElementById('storeCode').value = code;
                        document.getElementById('storeActive').checked = active;
                        document.getElementById('storeModal').classList.add('show');
                    }
                    
                    async function saveStore(e) {
                        e.preventDefault();
                        const id = document.getElementById('storeId').value;
                        const data = {
                            storeName: document.getElementById('storeName').value,
                            storeCode: document.getElementById('storeCode').value,
                            isActive: document.getElementById('storeActive').checked
                        };
                        
                        const url = id ? '/stores/theft-incident/settings/stores/' + id : '/stores/theft-incident/settings/stores';
                        const method = id ? 'PUT' : 'POST';
                        
                        try {
                            const res = await fetch(url, {
                                method: method,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            if (res.ok) {
                                closeModal('storeModal');
                                if (id) {
                                    // Update existing row
                                    const row = document.querySelector('tr[data-id="' + id + '"]');
                                    if (row) {
                                        const cells = row.querySelectorAll('td');
                                        cells[0].textContent = data.storeName;
                                        cells[1].textContent = data.storeCode || '-';
                                        cells[2].innerHTML = '<span class="status-badge ' + (data.isActive ? 'active' : 'inactive') + '">' + (data.isActive ? 'Active' : 'Inactive') + '</span>';
                                        // Update edit button onclick
                                        const editBtn = cells[3].querySelector('.btn-edit');
                                        editBtn.setAttribute('onclick', "editStore(" + id + ", '" + data.storeName.replace(/'/g, "\\'") + "', '" + (data.storeCode || '').replace(/'/g, "\\'") + "', " + data.isActive + ")");
                                        row.style.backgroundColor = '#d4edda';
                                        setTimeout(() => row.style.backgroundColor = '', 1000);
                                    }
                                } else {
                                    location.reload(); // Reload for new items to get the ID
                                }
                            } else {
                                const err = await res.json();
                                alert('Error saving store: ' + (err.error || 'Unknown error'));
                            }
                        } catch (err) {
                            alert('Error saving store: ' + err.message);
                        }
                    }
                    
                    // Method functions
                    function showAddMethod() {
                        document.getElementById('methodModalTitle').textContent = 'Add Capture Method';
                        document.getElementById('methodForm').reset();
                        document.getElementById('methodId').value = '';
                        document.getElementById('methodActive').checked = true;
                        document.getElementById('methodModal').classList.add('show');
                    }
                    
                    function editMethod(id, name, active) {
                        document.getElementById('methodModalTitle').textContent = 'Edit Capture Method';
                        document.getElementById('methodId').value = id;
                        document.getElementById('methodName').value = name;
                        document.getElementById('methodActive').checked = active;
                        document.getElementById('methodModal').classList.add('show');
                    }
                    
                    async function saveMethod(e) {
                        e.preventDefault();
                        const id = document.getElementById('methodId').value;
                        const data = {
                            methodName: document.getElementById('methodName').value,
                            isActive: document.getElementById('methodActive').checked
                        };
                        
                        const url = id ? '/stores/theft-incident/settings/capture-methods/' + id : '/stores/theft-incident/settings/capture-methods';
                        const method = id ? 'PUT' : 'POST';
                        
                        try {
                            const res = await fetch(url, {
                                method: method,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            if (res.ok) {
                                closeModal('methodModal');
                                if (id) {
                                    const row = document.querySelector('#methods-tab tr[data-id="' + id + '"]');
                                    if (row) {
                                        const cells = row.querySelectorAll('td');
                                        cells[0].textContent = data.methodName;
                                        cells[1].innerHTML = '<span class="status-badge ' + (data.isActive ? 'active' : 'inactive') + '">' + (data.isActive ? 'Active' : 'Inactive') + '</span>';
                                        const editBtn = cells[2].querySelector('.btn-edit');
                                        editBtn.setAttribute('onclick', "editMethod(" + id + ", '" + data.methodName.replace(/'/g, "\\'") + "', " + data.isActive + ")");
                                        row.style.backgroundColor = '#d4edda';
                                        setTimeout(() => row.style.backgroundColor = '', 1000);
                                    }
                                } else {
                                    location.reload();
                                }
                            } else {
                                const err = await res.json();
                                alert('Error saving capture method: ' + (err.error || 'Unknown error'));
                            }
                        } catch (err) {
                            alert('Error saving capture method: ' + err.message);
                        }
                    }
                    
                    // Company functions
                    function showAddCompany() {
                        document.getElementById('companyModalTitle').textContent = 'Add Security Company';
                        document.getElementById('companyForm').reset();
                        document.getElementById('companyId').value = '';
                        document.getElementById('companyActive').checked = true;
                        document.getElementById('companyModal').classList.add('show');
                    }
                    
                    function editCompany(id, name, active) {
                        document.getElementById('companyModalTitle').textContent = 'Edit Security Company';
                        document.getElementById('companyId').value = id;
                        document.getElementById('companyName').value = name;
                        document.getElementById('companyActive').checked = active;
                        document.getElementById('companyModal').classList.add('show');
                    }
                    
                    async function saveCompany(e) {
                        e.preventDefault();
                        const id = document.getElementById('companyId').value;
                        const data = {
                            companyName: document.getElementById('companyName').value,
                            isActive: document.getElementById('companyActive').checked
                        };
                        
                        const url = id ? '/stores/theft-incident/settings/outsource-companies/' + id : '/stores/theft-incident/settings/outsource-companies';
                        const method = id ? 'PUT' : 'POST';
                        
                        try {
                            const res = await fetch(url, {
                                method: method,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            if (res.ok) {
                                closeModal('companyModal');
                                if (id) {
                                    const row = document.querySelector('#companies-tab tr[data-id="' + id + '"]');
                                    if (row) {
                                        const cells = row.querySelectorAll('td');
                                        cells[0].textContent = data.companyName;
                                        cells[1].innerHTML = '<span class="status-badge ' + (data.isActive ? 'active' : 'inactive') + '">' + (data.isActive ? 'Active' : 'Inactive') + '</span>';
                                        const editBtn = cells[2].querySelector('.btn-edit');
                                        editBtn.setAttribute('onclick', "editCompany(" + id + ", '" + data.companyName.replace(/'/g, "\\'") + "', " + data.isActive + ")");
                                        row.style.backgroundColor = '#d4edda';
                                        setTimeout(() => row.style.backgroundColor = '', 1000);
                                    }
                                } else {
                                    location.reload();
                                }
                            } else {
                                const err = await res.json();
                                alert('Error saving security company: ' + (err.error || 'Unknown error'));
                            }
                        } catch (err) {
                            alert('Error saving security company: ' + err.message);
                        }
                    }
                    
                    // Delete function
                    async function deleteItem(type, id, name) {
                        if (!confirm('Are you sure you want to delete "' + name + '"?')) return;
                        
                        try {
                            const res = await fetch('/stores/theft-incident/settings/' + type + '/' + id, {
                                method: 'DELETE'
                            });
                            
                            if (res.ok) {
                                // Remove the row immediately from DOM
                                const row = document.querySelector('tr[data-id="' + id + '"]');
                                if (row) {
                                    row.style.transition = 'opacity 0.3s';
                                    row.style.opacity = '0';
                                    setTimeout(() => row.remove(), 300);
                                } else {
                                    location.reload();
                                }
                            } else {
                                const data = await res.json();
                                alert('Error deleting item: ' + (data.error || 'Unknown error'));
                            }
                        } catch (err) {
                            alert('Error deleting item: ' + err.message);
                        }
                    }
                    
                    // Bulk Upload Functions
                    function showBulkUpload() {
                        document.getElementById('bulkUploadSection').style.display = 'block';
                    }
                    
                    function hideBulkUpload() {
                        document.getElementById('bulkUploadSection').style.display = 'none';
                        document.getElementById('csvFile').value = '';
                        document.getElementById('fileName').textContent = '';
                        document.getElementById('uploadResult').className = 'upload-result';
                        document.getElementById('uploadResult').innerHTML = '';
                        document.getElementById('uploadProgress').classList.remove('show');
                    }
                    
                    document.getElementById('csvFile').addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        if (file) {
                            document.getElementById('fileName').textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
                        }
                    });
                    
                    async function uploadStores() {
                        const fileInput = document.getElementById('csvFile');
                        const file = fileInput.files[0];
                        
                        if (!file) {
                            alert('Please select a CSV file first');
                            return;
                        }
                        
                        const progressBar = document.getElementById('uploadProgress');
                        const progressFill = document.getElementById('progressFill');
                        const resultDiv = document.getElementById('uploadResult');
                        
                        progressBar.classList.add('show');
                        progressFill.style.width = '30%';
                        resultDiv.className = 'upload-result';
                        
                        const formData = new FormData();
                        formData.append('csvFile', file);
                        
                        try {
                            progressFill.style.width = '60%';
                            
                            const res = await fetch('/stores/theft-incident/settings/stores/bulk-upload', {
                                method: 'POST',
                                body: formData
                            });
                            
                            progressFill.style.width = '100%';
                            
                            const data = await res.json();
                            
                            if (res.ok) {
                                resultDiv.className = 'upload-result success';
                                resultDiv.innerHTML = '<strong>✅ Upload Complete!</strong><br>' +
                                    'Added: ' + data.added + ' stores<br>' +
                                    'Skipped (duplicates): ' + data.skipped + ' stores';
                                
                                setTimeout(() => location.reload(), 2000);
                            } else {
                                resultDiv.className = 'upload-result error';
                                resultDiv.innerHTML = '<strong>❌ Error:</strong> ' + data.error;
                            }
                        } catch (err) {
                            resultDiv.className = 'upload-result error';
                            resultDiv.innerHTML = '<strong>❌ Error:</strong> ' + err.message;
                        }
                    }
                </script>
            </body>
            </html>
        `);
        
    } catch (err) {
        console.error('Error loading settings:', err);
        res.status(500).send('Error loading settings: ' + err.message);
    }
});

// ==================== STORES API ====================

// CSV Template Download (must be before :id route)
router.get('/stores/template', (req, res) => {
    const csvContent = 'StoreName,StoreCode\\nSpinneys Beirut,SP001\\nSpinneys Jounieh,SP002\\nSpinneys Tripoli,SP003';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=stores-template.csv');
    res.send(csvContent);
});

// Bulk Upload Stores (must be before :id route)
router.post('/stores/bulk-upload', csvUpload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
            return res.status(400).json({ error: 'CSV file is empty' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Get existing stores to check for duplicates
        const existingStores = await pool.request().query('SELECT StoreName FROM Stores');
        const existingNames = new Set(existingStores.recordset.map(s => s.StoreName.toLowerCase()));
        
        let added = 0;
        let skipped = 0;
        const createdBy = req.currentUser?.email || 'system';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Skip header row
            if (i === 0 && line.toLowerCase().includes('storename')) {
                continue;
            }
            
            // Parse CSV line (handle quoted values)
            const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
            const storeName = (parts[0] || '').replace(/^"|"$/g, '').trim();
            const storeCode = (parts[1] || '').replace(/^"|"$/g, '').trim();
            
            if (!storeName) continue;
            
            // Check for duplicates
            if (existingNames.has(storeName.toLowerCase())) {
                skipped++;
                continue;
            }
            
            // Insert store
            await pool.request()
                .input('storeName', sql.NVarChar(100), storeName)
                .input('storeCode', sql.NVarChar(50), storeCode || null)
                .input('createdBy', sql.NVarChar(100), createdBy)
                .query('INSERT INTO Stores (StoreName, StoreCode, IsActive, CreatedBy) VALUES (@storeName, @storeCode, 1, @createdBy)');
            
            existingNames.add(storeName.toLowerCase());
            added++;
        }
        
        await pool.close();
        
        res.json({ success: true, added, skipped });
        
    } catch (err) {
        console.error('Error bulk uploading stores:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/stores', async (req, res) => {
    try {
        const { storeName, storeCode, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('storeName', sql.NVarChar(100), storeName)
            .input('storeCode', sql.NVarChar(50), storeCode || null)
            .input('isActive', sql.Bit, isActive !== false)
            .input('createdBy', sql.NVarChar(100), req.currentUser?.email || 'system')
            .query('INSERT INTO Stores (StoreName, StoreCode, IsActive, CreatedBy) VALUES (@storeName, @storeCode, @isActive, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding store:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/stores/:id', async (req, res) => {
    try {
        const { storeName, storeCode, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('storeName', sql.NVarChar(100), storeName)
            .input('storeCode', sql.NVarChar(50), storeCode || null)
            .input('isActive', sql.Bit, isActive !== false)
            .query('UPDATE Stores SET StoreName = @storeName, StoreCode = @storeCode, IsActive = @isActive WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating store:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/stores/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Stores WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting store:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== CAPTURE METHODS API ====================
router.post('/capture-methods', async (req, res) => {
    try {
        const { methodName, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('methodName', sql.NVarChar(100), methodName)
            .input('isActive', sql.Bit, isActive !== false)
            .input('createdBy', sql.NVarChar(100), req.currentUser?.email || 'system')
            .query('INSERT INTO CaptureMethods (MethodName, IsActive, CreatedBy) VALUES (@methodName, @isActive, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding capture method:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/capture-methods/:id', async (req, res) => {
    try {
        const { methodName, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('methodName', sql.NVarChar(100), methodName)
            .input('isActive', sql.Bit, isActive !== false)
            .query('UPDATE CaptureMethods SET MethodName = @methodName, IsActive = @isActive WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating capture method:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/capture-methods/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM CaptureMethods WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting capture method:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== OUTSOURCE COMPANIES API ====================
router.post('/outsource-companies', async (req, res) => {
    try {
        const { companyName, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('companyName', sql.NVarChar(100), companyName)
            .input('isActive', sql.Bit, isActive !== false)
            .input('createdBy', sql.NVarChar(100), req.currentUser?.email || 'system')
            .query('INSERT INTO OutsourceSecurityCompanies (CompanyName, IsActive, CreatedBy) VALUES (@companyName, @isActive, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding security company:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/outsource-companies/:id', async (req, res) => {
    try {
        const { companyName, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('companyName', sql.NVarChar(100), companyName)
            .input('isActive', sql.Bit, isActive !== false)
            .query('UPDATE OutsourceSecurityCompanies SET CompanyName = @companyName, IsActive = @isActive WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating security company:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/outsource-companies/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM OutsourceSecurityCompanies WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting security company:', err);
        res.status(500).json({ error: err.message });
    }
});

// API to get all options for the form
router.get('/options', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const stores = await pool.request().query('SELECT Id, StoreName, StoreCode FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        const captureMethods = await pool.request().query('SELECT Id, MethodName FROM CaptureMethods WHERE IsActive = 1 ORDER BY MethodName');
        const companies = await pool.request().query('SELECT Id, CompanyName FROM OutsourceSecurityCompanies WHERE IsActive = 1 ORDER BY CompanyName');
        await pool.close();
        
        res.json({
            stores: stores.recordset,
            captureMethods: captureMethods.recordset,
            outsourceCompanies: companies.recordset
        });
    } catch (err) {
        console.error('Error getting options:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
