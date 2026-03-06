/**
 * Lost and Found Routes
 * Store managers can log lost and found items with details about return to owner
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
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../../uploads/lost-and-found');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'lost-found-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage, 
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

let poolPromise = null;
async function getPool() {
    try {
        if (!poolPromise) {
            poolPromise = sql.connect(dbConfig);
        }
        const pool = await poolPromise;
        if (!pool.connected) {
            poolPromise = null;
            poolPromise = sql.connect(dbConfig);
            return await poolPromise;
        }
        return pool;
    } catch (err) {
        poolPromise = null;
        throw err;
    }
}

// Main page - Lost and Found Form
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const user = req.currentUser || req.session?.user;
        
        // Get stores for dropdown
        const stores = await pool.request().query(`
            SELECT Id, StoreName, StoreCode FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.Id}">${s.StoreName}${s.StoreCode ? ' (' + s.StoreCode + ')' : ''}</option>`
        ).join('');
        
        const userName = user?.displayName || user?.email || 'User';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Lost and Found - ${process.env.APP_NAME || 'OE App'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
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
                        border-bottom: 2px solid #6c5ce7;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    .card-header h2 { color: #6c5ce7; font-size: 20px; }
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
                        border-color: #6c5ce7;
                    }
                    textarea.form-control { min-height: 100px; resize: vertical; }
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
                        background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
                        color: white;
                    }
                    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(108,92,231,0.4); }
                    .btn-secondary {
                        background: #f0f0f0;
                        color: #333;
                    }
                    .btn-secondary:hover { background: #e0e0e0; }
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
                        color: #666;
                        transition: all 0.3s;
                        cursor: pointer;
                    }
                    .file-input-label:hover {
                        border-color: #6c5ce7;
                        background: #f8f7ff;
                    }
                    .file-preview {
                        margin-top: 10px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .file-preview img {
                        max-width: 100px;
                        max-height: 100px;
                        border-radius: 8px;
                        object-fit: cover;
                    }
                    .conditional-field {
                        display: none;
                        animation: slideIn 0.3s ease;
                    }
                    .conditional-field.visible {
                        display: block;
                    }
                    @keyframes slideIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .tab-buttons {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 20px;
                    }
                    .tab-btn {
                        padding: 10px 20px;
                        border: 2px solid #6c5ce7;
                        border-radius: 8px;
                        background: white;
                        color: #6c5ce7;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s;
                    }
                    .tab-btn.active {
                        background: #6c5ce7;
                        color: white;
                    }
                    .tab-btn:hover:not(.active) {
                        background: #f8f7ff;
                    }
                    .history-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                    }
                    .history-table th, .history-table td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .history-table th {
                        background: #f8f9fa;
                        font-weight: 600;
                        color: #333;
                    }
                    .history-table tr:hover {
                        background: #f8f7ff;
                    }
                    .badge {
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .badge-cash { background: #d4edda; color: #155724; }
                    .badge-non-cash { background: #e2e3e5; color: #383d41; }
                    .badge-yes { background: #d4edda; color: #155724; }
                    .badge-no { background: #f8d7da; color: #721c24; }
                    .item-image {
                        width: 50px;
                        height: 50px;
                        object-fit: cover;
                        border-radius: 6px;
                        cursor: pointer;
                    }
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.7);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .modal.active { display: flex; }
                    .modal img {
                        max-width: 90%;
                        max-height: 90%;
                        border-radius: 10px;
                    }
                    .notification {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        padding: 15px 25px;
                        border-radius: 8px;
                        color: white;
                        font-weight: 500;
                        z-index: 1001;
                        animation: slideInRight 0.3s ease;
                    }
                    .notification.success { background: #28a745; }
                    .notification.error { background: #dc3545; }
                    @keyframes slideInRight {
                        from { transform: translateX(100px); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔍 Lost and Found</h1>
                    <div class="header-nav">
                        <span>Welcome, ${userName}</span>
                        <a href="/stores">← Back to Stores</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="tab-buttons">
                        <button class="tab-btn active" onclick="showTab('form')">📝 New Entry</button>
                        <button class="tab-btn" onclick="showTab('history')">📋 History</button>
                    </div>
                    
                    <!-- Form Tab -->
                    <div id="tab-form" class="tab-content">
                        <div class="card">
                            <div class="card-header">
                                <h2>📝 Log Lost and Found Item</h2>
                                <p>Record items that have been found or reported lost</p>
                            </div>
                            
                            <form id="lostFoundForm" enctype="multipart/form-data">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Date <span class="required">*</span></label>
                                        <input type="date" name="itemDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Store <span class="required">*</span></label>
                                        <select name="storeId" class="form-control" required>
                                            <option value="">-- Select Store --</option>
                                            ${storeOptions}
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Item Name <span class="required">*</span></label>
                                        <input type="text" name="itemName" class="form-control" placeholder="e.g., Wallet, Phone, Keys..." required>
                                    </div>
                                    <div class="form-group">
                                        <label>Type <span class="required">*</span></label>
                                        <select name="itemType" class="form-control" required onchange="toggleCurrencyField(this.value)">
                                            <option value="">-- Select Type --</option>
                                            <option value="Cash">💵 Cash</option>
                                            <option value="Non-Cash">📦 Non-Cash</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- Currency field - only visible when Cash is selected -->
                                <div id="currencyField" class="conditional-field">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Currency <span class="required">*</span></label>
                                            <select name="currency" class="form-control">
                                                <option value="">-- Select Currency --</option>
                                                <option value="USD">🇺🇸 USD - US Dollar</option>
                                                <option value="LBP">🇱🇧 LBP - Lebanese Pound</option>
                                                <option value="EUR">🇪🇺 EUR - Euro</option>
                                                <option value="GBP">🇬🇧 GBP - British Pound</option>
                                                <option value="Other">🌍 Other</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Amount</label>
                                            <input type="number" name="amount" class="form-control" placeholder="Enter amount" step="0.01" min="0">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Quantity</label>
                                        <input type="number" name="quantity" class="form-control" value="1" min="1">
                                    </div>
                                    <div class="form-group">
                                        <label>Item Picture</label>
                                        <div class="file-input-wrapper">
                                            <div class="file-input-label" id="fileLabel">
                                                📷 Click to upload image
                                            </div>
                                            <input type="file" name="itemPicture" accept="image/*" onchange="previewImage(this)">
                                        </div>
                                        <div class="file-preview" id="imagePreview"></div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Description</label>
                                    <textarea name="description" class="form-control" placeholder="Describe the item in detail (color, brand, condition, where it was found...)"></textarea>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Returned to Owner? <span class="required">*</span></label>
                                        <select name="returnedToOwner" class="form-control" required onchange="toggleReturnField(this.value)">
                                            <option value="">-- Select --</option>
                                            <option value="Yes">✅ Yes</option>
                                            <option value="No">❌ No</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- Return description - only visible when Yes is selected -->
                                <div id="returnField" class="conditional-field">
                                    <div class="form-group">
                                        <label>Description of Return <span class="required">*</span></label>
                                        <textarea name="returnDescription" class="form-control" placeholder="Describe how the item was returned (owner name, ID verified, signature obtained, date/time of return...)"></textarea>
                                    </div>
                                </div>
                                
                                <div style="display: flex; gap: 15px; margin-top: 30px;">
                                    <button type="button" class="btn btn-secondary" onclick="resetForm()">🔄 Reset</button>
                                    <button type="submit" class="btn btn-primary">💾 Save Entry</button>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <!-- History Tab -->
                    <div id="tab-history" class="tab-content" style="display: none;">
                        <div class="card">
                            <div class="card-header">
                                <h2>📋 Lost and Found History</h2>
                                <p>View all logged items</p>
                            </div>
                            
                            <div class="form-row" style="margin-bottom: 20px;">
                                <div class="form-group">
                                    <label>Filter by Store</label>
                                    <select id="filterStore" class="form-control" onchange="loadHistory()">
                                        <option value="">All Stores</option>
                                        ${storeOptions}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Filter by Type</label>
                                    <select id="filterType" class="form-control" onchange="loadHistory()">
                                        <option value="">All Types</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Non-Cash">Non-Cash</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div id="historyContent">
                                <p style="text-align: center; color: #666;">Loading...</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Image Modal -->
                <div class="modal" id="imageModal" onclick="closeModal()">
                    <img id="modalImage" src="" alt="Item Image">
                </div>
                
                <script>
                    function showTab(tab) {
                        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
                        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                        
                        document.getElementById('tab-' + tab).style.display = 'block';
                        event.target.classList.add('active');
                        
                        if (tab === 'history') {
                            loadHistory();
                        }
                    }
                    
                    function toggleCurrencyField(value) {
                        const field = document.getElementById('currencyField');
                        if (value === 'Cash') {
                            field.classList.add('visible');
                            document.querySelector('[name="currency"]').required = true;
                        } else {
                            field.classList.remove('visible');
                            document.querySelector('[name="currency"]').required = false;
                        }
                    }
                    
                    function toggleReturnField(value) {
                        const field = document.getElementById('returnField');
                        if (value === 'Yes') {
                            field.classList.add('visible');
                            document.querySelector('[name="returnDescription"]').required = true;
                        } else {
                            field.classList.remove('visible');
                            document.querySelector('[name="returnDescription"]').required = false;
                        }
                    }
                    
                    function previewImage(input) {
                        const preview = document.getElementById('imagePreview');
                        const label = document.getElementById('fileLabel');
                        preview.innerHTML = '';
                        
                        if (input.files && input.files[0]) {
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                preview.innerHTML = '<img src="' + e.target.result + '">';
                                label.innerHTML = '✅ ' + input.files[0].name;
                            }
                            reader.readAsDataURL(input.files[0]);
                        } else {
                            label.innerHTML = '📷 Click to upload image';
                        }
                    }
                    
                    function resetForm() {
                        document.getElementById('lostFoundForm').reset();
                        document.getElementById('imagePreview').innerHTML = '';
                        document.getElementById('fileLabel').innerHTML = '📷 Click to upload image';
                        document.getElementById('currencyField').classList.remove('visible');
                        document.getElementById('returnField').classList.remove('visible');
                    }
                    
                    function showNotification(message, type) {
                        const notif = document.createElement('div');
                        notif.className = 'notification ' + type;
                        notif.textContent = message;
                        document.body.appendChild(notif);
                        setTimeout(() => notif.remove(), 3000);
                    }
                    
                    document.getElementById('lostFoundForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const formData = new FormData(e.target);
                        
                        try {
                            const res = await fetch('/stores/lost-and-found/api/save', {
                                method: 'POST',
                                body: formData
                            });
                            
                            const result = await res.json();
                            
                            if (result.success) {
                                showNotification('Item logged successfully!', 'success');
                                resetForm();
                            } else {
                                showNotification(result.error || 'Error saving entry', 'error');
                            }
                        } catch (err) {
                            showNotification('Error: ' + err.message, 'error');
                        }
                    });
                    
                    async function loadHistory() {
                        const storeId = document.getElementById('filterStore').value;
                        const itemType = document.getElementById('filterType').value;
                        
                        let url = '/stores/lost-and-found/api/list?';
                        if (storeId) url += 'storeId=' + storeId + '&';
                        if (itemType) url += 'itemType=' + itemType;
                        
                        try {
                            const res = await fetch(url);
                            const data = await res.json();
                            
                            if (data.length === 0) {
                                document.getElementById('historyContent').innerHTML = '<p style="text-align:center;color:#666;">No items found</p>';
                                return;
                            }
                            
                            let html = '<table class="history-table"><thead><tr>';
                            html += '<th>Date</th><th>Store</th><th>Item</th><th>Type</th><th>Image</th><th>Qty</th><th>Returned</th><th>Description</th>';
                            html += '</tr></thead><tbody>';
                            
                            data.forEach(item => {
                                const typeClass = item.ItemType === 'Cash' ? 'badge-cash' : 'badge-non-cash';
                                const returnClass = item.ReturnedToOwner ? 'badge-yes' : 'badge-no';
                                const imgHtml = item.ItemPicture 
                                    ? '<img src="/uploads/lost-and-found/' + item.ItemPicture + '" class="item-image" onclick="openModal(this.src)">'
                                    : '-';
                                
                                html += '<tr>';
                                html += '<td>' + new Date(item.ItemDate).toLocaleDateString() + '</td>';
                                html += '<td>' + (item.StoreName || '-') + '</td>';
                                html += '<td><strong>' + item.ItemName + '</strong></td>';
                                html += '<td><span class="badge ' + typeClass + '">' + item.ItemType;
                                if (item.ItemType === 'Cash' && item.Currency) {
                                    html += ' (' + item.Currency + (item.Amount ? ' ' + item.Amount : '') + ')';
                                }
                                html += '</span></td>';
                                html += '<td>' + imgHtml + '</td>';
                                html += '<td>' + (item.Quantity || 1) + '</td>';
                                html += '<td><span class="badge ' + returnClass + '">' + (item.ReturnedToOwner ? 'Yes' : 'No') + '</span></td>';
                                html += '<td style="max-width:200px;white-space:pre-wrap;">' + (item.Description || '-') + '</td>';
                                html += '</tr>';
                            });
                            
                            html += '</tbody></table>';
                            document.getElementById('historyContent').innerHTML = html;
                            
                        } catch (err) {
                            document.getElementById('historyContent').innerHTML = '<p style="color:red;">Error loading data</p>';
                        }
                    }
                    
                    function openModal(src) {
                        event.stopPropagation();
                        document.getElementById('modalImage').src = src;
                        document.getElementById('imageModal').classList.add('active');
                    }
                    
                    function closeModal() {
                        document.getElementById('imageModal').classList.remove('active');
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('[Lost and Found] Error:', err);
        res.status(500).send('Error loading page');
    }
});

// API: Save entry
router.post('/api/save', upload.single('itemPicture'), async (req, res) => {
    try {
        const user = req.currentUser || req.session?.user;
        const { 
            itemDate, storeId, itemName, itemType, currency, amount,
            quantity, description, returnedToOwner, returnDescription 
        } = req.body;
        
        const pool = await getPool();
        
        await pool.request()
            .input('itemDate', sql.Date, itemDate)
            .input('storeId', sql.Int, parseInt(storeId))
            .input('itemName', sql.NVarChar, itemName)
            .input('itemType', sql.NVarChar, itemType)
            .input('currency', sql.NVarChar, itemType === 'Cash' ? currency : null)
            .input('amount', sql.Decimal(18, 2), itemType === 'Cash' && amount ? parseFloat(amount) : null)
            .input('quantity', sql.Int, parseInt(quantity) || 1)
            .input('description', sql.NVarChar, description || null)
            .input('itemPicture', sql.NVarChar, req.file ? req.file.filename : null)
            .input('returnedToOwner', sql.Bit, returnedToOwner === 'Yes' ? 1 : 0)
            .input('returnDescription', sql.NVarChar, returnedToOwner === 'Yes' ? returnDescription : null)
            .input('createdBy', sql.NVarChar, user?.displayName || user?.email || 'Unknown')
            .input('userId', sql.Int, user?.userId || null)
            .query(`
                INSERT INTO LostAndFoundItems 
                (ItemDate, StoreId, ItemName, ItemType, Currency, Amount, Quantity, Description, 
                 ItemPicture, ReturnedToOwner, ReturnDescription, CreatedBy, UserId, CreatedAt)
                VALUES 
                (@itemDate, @storeId, @itemName, @itemType, @currency, @amount, @quantity, @description,
                 @itemPicture, @returnedToOwner, @returnDescription, @createdBy, @userId, GETDATE())
            `);
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Lost and Found] Save error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: List entries
router.get('/api/list', async (req, res) => {
    try {
        const { storeId, itemType } = req.query;
        const pool = await getPool();
        
        let query = `
            SELECT lf.*, s.StoreName 
            FROM LostAndFoundItems lf
            LEFT JOIN Stores s ON lf.StoreId = s.Id
            WHERE 1=1
        `;
        
        const request = pool.request();
        
        if (storeId) {
            query += ' AND lf.StoreId = @storeId';
            request.input('storeId', sql.Int, parseInt(storeId));
        }
        
        if (itemType) {
            query += ' AND lf.ItemType = @itemType';
            request.input('itemType', sql.NVarChar, itemType);
        }
        
        query += ' ORDER BY lf.ItemDate DESC, lf.CreatedAt DESC';
        
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('[Lost and Found] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
