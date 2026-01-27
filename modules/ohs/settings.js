/**
 * OHS Settings Module
 * Manage OHS configuration: Stores, Event Types, Categories, Sub-Categories, Injury Types, Body Parts
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
    },
    pool: {
        max: 20,
        min: 2,
        idleTimeoutMillis: 60000
    }
};

// Shared connection pool
let poolPromise = null;
let pool = null;

async function getPool() {
    if (pool && pool.connected) {
        return pool;
    }
    
    if (pool && !pool.connected) {
        poolPromise = null;
        pool = null;
    }
    
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).then(newPool => {
            console.log('OHS Settings: Connected to SQL Server');
            pool = newPool;
            pool.on('error', err => {
                console.error('OHS Settings Pool Error:', err);
                poolPromise = null;
                pool = null;
            });
            return pool;
        }).catch(err => {
            console.error('OHS Settings: Database connection failed:', err);
            poolPromise = null;
            pool = null;
            throw err;
        });
    }
    return poolPromise;
}

// Common styles for settings pages
const getCommonStyles = () => `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
        font-family: 'Segoe UI', Arial, sans-serif; 
        background: #f5f5f5;
        min-height: 100vh;
    }
    .header {
        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
        color: white;
        padding: 15px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .header h1 { font-size: 22px; }
    .header-nav { display: flex; gap: 15px; }
    .header-nav a {
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 5px;
        background: rgba(255,255,255,0.1);
        transition: background 0.2s;
    }
    .header-nav a:hover { background: rgba(255,255,255,0.2); }
    
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 30px;
    }
    
    .page-title {
        margin-bottom: 25px;
    }
    .page-title h2 {
        font-size: 24px;
        color: #333;
        margin-bottom: 5px;
    }
    .page-title p {
        color: #666;
    }
    
    .card {
        background: white;
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
    
    .card-title {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #eee;
    }
    
    .form-group {
        margin-bottom: 20px;
    }
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #333;
    }
    .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 10px 15px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
        outline: none;
        border-color: #e17055;
    }
    
    .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
    }
    .btn-primary {
        background: #e17055;
        color: white;
    }
    .btn-primary:hover { background: #d63031; }
    .btn-success {
        background: #00b894;
        color: white;
    }
    .btn-success:hover { background: #00a381; }
    .btn-danger {
        background: #d63031;
        color: white;
    }
    .btn-danger:hover { background: #c0392b; }
    .btn-secondary {
        background: #74b9ff;
        color: white;
    }
    .btn-secondary:hover { background: #0984e3; }
    
    .table-container {
        overflow-x: auto;
    }
    table {
        width: 100%;
        border-collapse: collapse;
    }
    th, td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #eee;
    }
    th {
        background: #f8f9fa;
        font-weight: 600;
        color: #333;
    }
    tr:hover { background: #f8f9fa; }
    
    .badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    
    .actions {
        display: flex;
        gap: 8px;
    }
    .actions button {
        padding: 6px 12px;
        font-size: 12px;
    }
    
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000;
        align-items: center;
        justify-content: center;
    }
    .modal.active { display: flex; }
    .modal-content {
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .modal-header h3 { font-size: 20px; color: #333; }
    .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    
    .alert {
        padding: 15px 20px;
        border-radius: 8px;
        margin-bottom: 20px;
    }
    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    
    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .search-box {
        padding: 10px 15px;
        border: 1px solid #ddd;
        border-radius: 8px;
        width: 300px;
    }
`;

// =====================================================
// STORES MANAGEMENT
// =====================================================
router.get('/stores', async (req, res) => {
    try {
        const db = await getPool();
        
        // Get OHS stores
        const ohsStores = await db.request().query(`
            SELECT * FROM OHSStores ORDER BY StoreName
        `);
        
        // Get all available stores from Stores table
        const allStores = await db.request().query(`
            SELECT Id, StoreName, StoreCode FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Stores Management - OHS Settings</title>
                <style>${getCommonStyles()}</style>
            </head>
            <body>
                <div class="header">
                    <h1>🏪 OHS Stores Management</h1>
                    <div class="header-nav">
                        <a href="/ohs">← Back to OHS</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Manage Stores</h2>
                        <p>Configure which stores are enabled for OHS incident reporting</p>
                    </div>
                    
                    <div id="alertContainer"></div>
                    
                    <div class="card">
                        <div class="toolbar">
                            <input type="text" class="search-box" placeholder="Search stores..." id="searchBox" onkeyup="filterStores()">
                            <button class="btn btn-primary" onclick="openAddModal()">+ Add Store</button>
                        </div>
                        
                        <div class="table-container">
                            <table id="storesTable">
                                <thead>
                                    <tr>
                                        <th>Store Name</th>
                                        <th>Store Code</th>
                                        <th>Status</th>
                                        <th>Added Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ohsStores.recordset.length === 0 ? `
                                        <tr><td colspan="5" style="text-align: center; color: #666; padding: 40px;">No stores configured yet. Click "Add Store" to get started.</td></tr>
                                    ` : ohsStores.recordset.map(store => `
                                        <tr data-id="${store.Id}">
                                            <td>${store.StoreName}</td>
                                            <td>${store.StoreCode || '-'}</td>
                                            <td><span class="badge ${store.IsActive ? 'badge-success' : 'badge-danger'}">${store.IsActive ? 'Active' : 'Inactive'}</span></td>
                                            <td>${new Date(store.CreatedAt).toLocaleDateString()}</td>
                                            <td class="actions">
                                                <button class="btn btn-secondary" onclick="toggleStatus(${store.Id}, ${store.IsActive})">${store.IsActive ? 'Deactivate' : 'Activate'}</button>
                                                <button class="btn btn-danger" onclick="deleteStore(${store.Id})">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Add Store Modal -->
                <div class="modal" id="addModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Add Store to OHS</h3>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <form id="addForm" onsubmit="addStore(event)">
                            <div class="form-group">
                                <label>Select Store</label>
                                <select name="storeId" required>
                                    <option value="">-- Select a Store --</option>
                                    ${allStores.recordset.map(s => `
                                        <option value="${s.Id}" data-name="${s.StoreName}" data-code="${s.StoreCode || ''}">${s.StoreName} ${s.StoreCode ? '(' + s.StoreCode + ')' : ''}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">Add Store</button>
                        </form>
                    </div>
                </div>
                
                <script>
                    function openAddModal() {
                        document.getElementById('addModal').classList.add('active');
                    }
                    function closeModal() {
                        document.getElementById('addModal').classList.remove('active');
                    }
                    function showAlert(message, type) {
                        document.getElementById('alertContainer').innerHTML = 
                            '<div class="alert alert-' + type + '">' + message + '</div>';
                        setTimeout(() => document.getElementById('alertContainer').innerHTML = '', 5000);
                    }
                    function filterStores() {
                        const search = document.getElementById('searchBox').value.toLowerCase();
                        document.querySelectorAll('#storesTable tbody tr').forEach(row => {
                            const text = row.textContent.toLowerCase();
                            row.style.display = text.includes(search) ? '' : 'none';
                        });
                    }
                    async function addStore(e) {
                        e.preventDefault();
                        const form = e.target;
                        const select = form.querySelector('select');
                        const option = select.options[select.selectedIndex];
                        
                        const data = {
                            storeId: select.value,
                            storeName: option.dataset.name,
                            storeCode: option.dataset.code
                        };
                        
                        const res = await fetch('/ohs/settings/stores/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();
                        if (result.success) {
                            location.reload();
                        } else {
                            showAlert(result.error || 'Failed to add store', 'error');
                        }
                    }
                    async function toggleStatus(id, currentStatus) {
                        const res = await fetch('/ohs/settings/stores/toggle/' + id, { method: 'POST' });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to update status', 'error');
                    }
                    async function deleteStore(id) {
                        if (!confirm('Are you sure you want to remove this store from OHS?')) return;
                        const res = await fetch('/ohs/settings/stores/delete/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to delete store', 'error');
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading OHS stores:', error);
        res.status(500).send('Error loading stores: ' + error.message);
    }
});

// Add store API
router.post('/stores/add', async (req, res) => {
    try {
        const { storeId, storeName, storeCode } = req.body;
        const user = req.currentUser;
        
        const db = await getPool();
        await db.request()
            .input('storeId', sql.Int, storeId)
            .input('storeName', sql.NVarChar, storeName)
            .input('storeCode', sql.NVarChar, storeCode)
            .input('createdBy', sql.NVarChar, user?.email || 'system')
            .query(`
                INSERT INTO OHSStores (StoreId, StoreName, StoreCode, CreatedBy)
                VALUES (@storeId, @storeName, @storeCode, @createdBy)
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding OHS store:', error);
        res.json({ success: false, error: error.message });
    }
});

// Toggle store status API
router.post('/stores/toggle/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.currentUser;
        
        const db = await getPool();
        await db.request()
            .input('id', sql.Int, id)
            .input('updatedBy', sql.NVarChar, user?.email || 'system')
            .query(`
                UPDATE OHSStores 
                SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END,
                    UpdatedAt = GETDATE(),
                    UpdatedBy = @updatedBy
                WHERE Id = @id
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error toggling OHS store:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete store API
router.delete('/stores/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getPool();
        await db.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM OHSStores WHERE Id = @id');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting OHS store:', error);
        res.json({ success: false, error: error.message });
    }
});

// =====================================================
// EVENT TYPES MANAGEMENT
// =====================================================
router.get('/event-types', async (req, res) => {
    try {
        const db = await getPool();
        const eventTypes = await db.request().query(`
            SELECT * FROM OHSEventTypes ORDER BY DisplayOrder, EventTypeName
        `);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Event Types - OHS Settings</title>
                <style>${getCommonStyles()}</style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 OHS Event Types</h1>
                    <div class="header-nav">
                        <a href="/ohs">← Back to OHS</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Manage Event Types</h2>
                        <p>Configure types of events (Accident, Incident, Near Miss, etc.)</p>
                    </div>
                    
                    <div id="alertContainer"></div>
                    
                    <div class="card">
                        <div class="toolbar">
                            <span></span>
                            <button class="btn btn-primary" onclick="openAddModal()">+ Add Event Type</button>
                        </div>
                        
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Event Type</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${eventTypes.recordset.length === 0 ? `
                                        <tr><td colspan="5" style="text-align: center; color: #666; padding: 40px;">No event types configured.</td></tr>
                                    ` : eventTypes.recordset.map(et => `
                                        <tr>
                                            <td>${et.DisplayOrder}</td>
                                            <td><strong>${et.EventTypeName}</strong></td>
                                            <td>${et.Description || '-'}</td>
                                            <td><span class="badge ${et.IsActive ? 'badge-success' : 'badge-danger'}">${et.IsActive ? 'Active' : 'Inactive'}</span></td>
                                            <td class="actions">
                                                <button class="btn btn-secondary" onclick="editItem(${et.Id}, '${et.EventTypeName}', '${et.Description || ''}', ${et.DisplayOrder})">Edit</button>
                                                <button class="btn btn-danger" onclick="deleteItem(${et.Id})">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Add/Edit Modal -->
                <div class="modal" id="itemModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modalTitle">Add Event Type</h3>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <form id="itemForm" onsubmit="saveItem(event)">
                            <input type="hidden" name="id" id="itemId">
                            <div class="form-group">
                                <label>Event Type Name *</label>
                                <input type="text" name="name" id="itemName" required>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea name="description" id="itemDesc" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Display Order</label>
                                <input type="number" name="displayOrder" id="itemOrder" value="0">
                            </div>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </form>
                    </div>
                </div>
                
                <script>
                    function openAddModal() {
                        document.getElementById('modalTitle').textContent = 'Add Event Type';
                        document.getElementById('itemId').value = '';
                        document.getElementById('itemName').value = '';
                        document.getElementById('itemDesc').value = '';
                        document.getElementById('itemOrder').value = '0';
                        document.getElementById('itemModal').classList.add('active');
                    }
                    function editItem(id, name, desc, order) {
                        document.getElementById('modalTitle').textContent = 'Edit Event Type';
                        document.getElementById('itemId').value = id;
                        document.getElementById('itemName').value = name;
                        document.getElementById('itemDesc').value = desc;
                        document.getElementById('itemOrder').value = order;
                        document.getElementById('itemModal').classList.add('active');
                    }
                    function closeModal() {
                        document.getElementById('itemModal').classList.remove('active');
                    }
                    function showAlert(message, type) {
                        document.getElementById('alertContainer').innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
                        setTimeout(() => document.getElementById('alertContainer').innerHTML = '', 5000);
                    }
                    async function saveItem(e) {
                        e.preventDefault();
                        const id = document.getElementById('itemId').value;
                        const data = {
                            name: document.getElementById('itemName').value,
                            description: document.getElementById('itemDesc').value,
                            displayOrder: parseInt(document.getElementById('itemOrder').value) || 0
                        };
                        
                        const url = id ? '/ohs/settings/event-types/update/' + id : '/ohs/settings/event-types/add';
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to save', 'error');
                    }
                    async function deleteItem(id) {
                        if (!confirm('Are you sure you want to delete this event type?')) return;
                        const res = await fetch('/ohs/settings/event-types/delete/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to delete', 'error');
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading event types:', error);
        res.status(500).send('Error loading event types: ' + error.message);
    }
});

// Event Types CRUD APIs
router.post('/event-types/add', async (req, res) => {
    try {
        const { name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        
        await db.request()
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('createdBy', sql.NVarChar, user?.email || 'system')
            .query(`
                INSERT INTO OHSEventTypes (EventTypeName, Description, DisplayOrder, CreatedBy)
                VALUES (@name, @description, @displayOrder, @createdBy)
            `);
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/event-types/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        
        await db.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('updatedBy', sql.NVarChar, user?.email || 'system')
            .query(`
                UPDATE OHSEventTypes 
                SET EventTypeName = @name, Description = @description, DisplayOrder = @displayOrder,
                    UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
                WHERE Id = @id
            `);
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.delete('/event-types/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getPool();
        await db.request().input('id', sql.Int, id).query('DELETE FROM OHSEventTypes WHERE Id = @id');
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// =====================================================
// CATEGORIES & SUB-CATEGORIES MANAGEMENT
// =====================================================
router.get('/categories', async (req, res) => {
    try {
        const db = await getPool();
        
        const categories = await db.request().query(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM OHSEventSubCategories WHERE CategoryId = c.Id) as SubCategoryCount
            FROM OHSEventCategories c
            ORDER BY c.DisplayOrder, c.CategoryName
        `);
        
        const subCategories = await db.request().query(`
            SELECT sc.*, c.CategoryName 
            FROM OHSEventSubCategories sc
            JOIN OHSEventCategories c ON sc.CategoryId = c.Id
            ORDER BY c.DisplayOrder, sc.DisplayOrder, sc.SubCategoryName
        `);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Categories - OHS Settings</title>
                <style>
                    ${getCommonStyles()}
                    .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
                    .tab { padding: 10px 20px; background: #ddd; border: none; cursor: pointer; border-radius: 8px 8px 0 0; }
                    .tab.active { background: white; }
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    .category-header { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #f8f9fa; margin-top: 10px; border-radius: 8px; }
                    .sub-list { padding-left: 30px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📁 OHS Event Categories</h1>
                    <div class="header-nav">
                        <a href="/ohs">← Back to OHS</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Manage Categories & Sub-Categories</h2>
                        <p>Configure event categories (e.g., Physical Hazards) and their sub-categories</p>
                    </div>
                    
                    <div id="alertContainer"></div>
                    
                    <div class="tabs">
                        <button class="tab active" onclick="showTab('categories')">Categories</button>
                        <button class="tab" onclick="showTab('subcategories')">Sub-Categories</button>
                    </div>
                    
                    <!-- Categories Tab -->
                    <div class="tab-content active" id="categoriesTab">
                        <div class="card">
                            <div class="toolbar">
                                <span></span>
                                <button class="btn btn-primary" onclick="openCategoryModal()">+ Add Category</button>
                            </div>
                            
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Order</th>
                                            <th>Category Name</th>
                                            <th>Description</th>
                                            <th>Sub-Categories</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${categories.recordset.map(cat => `
                                            <tr>
                                                <td>${cat.DisplayOrder}</td>
                                                <td><strong>${cat.CategoryName}</strong></td>
                                                <td>${cat.Description || '-'}</td>
                                                <td>${cat.SubCategoryCount}</td>
                                                <td><span class="badge ${cat.IsActive ? 'badge-success' : 'badge-danger'}">${cat.IsActive ? 'Active' : 'Inactive'}</span></td>
                                                <td class="actions">
                                                    <button class="btn btn-secondary" onclick="editCategory(${cat.Id}, '${cat.CategoryName.replace(/'/g, "\\'")}', '${(cat.Description || '').replace(/'/g, "\\'")}', ${cat.DisplayOrder})">Edit</button>
                                                    <button class="btn btn-danger" onclick="deleteCategory(${cat.Id})">Delete</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Sub-Categories Tab -->
                    <div class="tab-content" id="subcategoriesTab">
                        <div class="card">
                            <div class="toolbar">
                                <select id="filterCategory" onchange="filterSubCategories()" style="padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                                    <option value="">All Categories</option>
                                    ${categories.recordset.map(cat => `<option value="${cat.Id}">${cat.CategoryName}</option>`).join('')}
                                </select>
                                <button class="btn btn-primary" onclick="openSubCategoryModal()">+ Add Sub-Category</button>
                            </div>
                            
                            <div class="table-container">
                                <table id="subCatTable">
                                    <thead>
                                        <tr>
                                            <th>Category</th>
                                            <th>Order</th>
                                            <th>Sub-Category Name</th>
                                            <th>Description</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${subCategories.recordset.map(sc => `
                                            <tr data-category="${sc.CategoryId}">
                                                <td>${sc.CategoryName}</td>
                                                <td>${sc.DisplayOrder}</td>
                                                <td><strong>${sc.SubCategoryName}</strong></td>
                                                <td>${sc.Description || '-'}</td>
                                                <td><span class="badge ${sc.IsActive ? 'badge-success' : 'badge-danger'}">${sc.IsActive ? 'Active' : 'Inactive'}</span></td>
                                                <td class="actions">
                                                    <button class="btn btn-secondary" onclick="editSubCategory(${sc.Id}, ${sc.CategoryId}, '${sc.SubCategoryName.replace(/'/g, "\\'")}', '${(sc.Description || '').replace(/'/g, "\\'")}', ${sc.DisplayOrder})">Edit</button>
                                                    <button class="btn btn-danger" onclick="deleteSubCategory(${sc.Id})">Delete</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Category Modal -->
                <div class="modal" id="categoryModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="catModalTitle">Add Category</h3>
                            <button class="modal-close" onclick="closeCategoryModal()">&times;</button>
                        </div>
                        <form onsubmit="saveCategory(event)">
                            <input type="hidden" id="catId">
                            <div class="form-group">
                                <label>Category Name *</label>
                                <input type="text" id="catName" required>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea id="catDesc" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Display Order</label>
                                <input type="number" id="catOrder" value="0">
                            </div>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </form>
                    </div>
                </div>
                
                <!-- Sub-Category Modal -->
                <div class="modal" id="subCategoryModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="subCatModalTitle">Add Sub-Category</h3>
                            <button class="modal-close" onclick="closeSubCategoryModal()">&times;</button>
                        </div>
                        <form onsubmit="saveSubCategory(event)">
                            <input type="hidden" id="subCatId">
                            <div class="form-group">
                                <label>Parent Category *</label>
                                <select id="subCatParent" required>
                                    ${categories.recordset.map(cat => `<option value="${cat.Id}">${cat.CategoryName}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Sub-Category Name *</label>
                                <input type="text" id="subCatName" required>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea id="subCatDesc" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Display Order</label>
                                <input type="number" id="subCatOrder" value="0">
                            </div>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </form>
                    </div>
                </div>
                
                <script>
                    function showTab(tab) {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                        event.target.classList.add('active');
                        document.getElementById(tab + 'Tab').classList.add('active');
                    }
                    function showAlert(message, type) {
                        document.getElementById('alertContainer').innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
                        setTimeout(() => document.getElementById('alertContainer').innerHTML = '', 5000);
                    }
                    function filterSubCategories() {
                        const catId = document.getElementById('filterCategory').value;
                        document.querySelectorAll('#subCatTable tbody tr').forEach(row => {
                            row.style.display = !catId || row.dataset.category === catId ? '' : 'none';
                        });
                    }
                    
                    // Category functions
                    function openCategoryModal() {
                        document.getElementById('catModalTitle').textContent = 'Add Category';
                        document.getElementById('catId').value = '';
                        document.getElementById('catName').value = '';
                        document.getElementById('catDesc').value = '';
                        document.getElementById('catOrder').value = '0';
                        document.getElementById('categoryModal').classList.add('active');
                    }
                    function editCategory(id, name, desc, order) {
                        document.getElementById('catModalTitle').textContent = 'Edit Category';
                        document.getElementById('catId').value = id;
                        document.getElementById('catName').value = name;
                        document.getElementById('catDesc').value = desc;
                        document.getElementById('catOrder').value = order;
                        document.getElementById('categoryModal').classList.add('active');
                    }
                    function closeCategoryModal() {
                        document.getElementById('categoryModal').classList.remove('active');
                    }
                    async function saveCategory(e) {
                        e.preventDefault();
                        const id = document.getElementById('catId').value;
                        const data = {
                            name: document.getElementById('catName').value,
                            description: document.getElementById('catDesc').value,
                            displayOrder: parseInt(document.getElementById('catOrder').value) || 0
                        };
                        const url = id ? '/ohs/settings/categories/update/' + id : '/ohs/settings/categories/add';
                        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to save', 'error');
                    }
                    async function deleteCategory(id) {
                        if (!confirm('Delete this category? All sub-categories will also be deleted!')) return;
                        const res = await fetch('/ohs/settings/categories/delete/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to delete', 'error');
                    }
                    
                    // Sub-Category functions
                    function openSubCategoryModal() {
                        document.getElementById('subCatModalTitle').textContent = 'Add Sub-Category';
                        document.getElementById('subCatId').value = '';
                        document.getElementById('subCatParent').value = '';
                        document.getElementById('subCatName').value = '';
                        document.getElementById('subCatDesc').value = '';
                        document.getElementById('subCatOrder').value = '0';
                        document.getElementById('subCategoryModal').classList.add('active');
                    }
                    function editSubCategory(id, catId, name, desc, order) {
                        document.getElementById('subCatModalTitle').textContent = 'Edit Sub-Category';
                        document.getElementById('subCatId').value = id;
                        document.getElementById('subCatParent').value = catId;
                        document.getElementById('subCatName').value = name;
                        document.getElementById('subCatDesc').value = desc;
                        document.getElementById('subCatOrder').value = order;
                        document.getElementById('subCategoryModal').classList.add('active');
                    }
                    function closeSubCategoryModal() {
                        document.getElementById('subCategoryModal').classList.remove('active');
                    }
                    async function saveSubCategory(e) {
                        e.preventDefault();
                        const id = document.getElementById('subCatId').value;
                        const data = {
                            categoryId: document.getElementById('subCatParent').value,
                            name: document.getElementById('subCatName').value,
                            description: document.getElementById('subCatDesc').value,
                            displayOrder: parseInt(document.getElementById('subCatOrder').value) || 0
                        };
                        const url = id ? '/ohs/settings/subcategories/update/' + id : '/ohs/settings/subcategories/add';
                        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to save', 'error');
                    }
                    async function deleteSubCategory(id) {
                        if (!confirm('Are you sure you want to delete this sub-category?')) return;
                        const res = await fetch('/ohs/settings/subcategories/delete/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to delete', 'error');
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading categories:', error);
        res.status(500).send('Error loading categories: ' + error.message);
    }
});

// Categories CRUD APIs
router.post('/categories/add', async (req, res) => {
    try {
        const { name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        
        await db.request()
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('createdBy', sql.NVarChar, user?.email || 'system')
            .query(`
                INSERT INTO OHSEventCategories (CategoryName, Description, DisplayOrder, CreatedBy)
                VALUES (@name, @description, @displayOrder, @createdBy)
            `);
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/categories/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        
        await db.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('updatedBy', sql.NVarChar, user?.email || 'system')
            .query(`
                UPDATE OHSEventCategories 
                SET CategoryName = @name, Description = @description, DisplayOrder = @displayOrder,
                    UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
                WHERE Id = @id
            `);
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.delete('/categories/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getPool();
        await db.request().input('id', sql.Int, id).query('DELETE FROM OHSEventCategories WHERE Id = @id');
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Sub-Categories CRUD APIs
router.post('/subcategories/add', async (req, res) => {
    try {
        const { categoryId, name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        
        await db.request()
            .input('categoryId', sql.Int, categoryId)
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('createdBy', sql.NVarChar, user?.email || 'system')
            .query(`
                INSERT INTO OHSEventSubCategories (CategoryId, SubCategoryName, Description, DisplayOrder, CreatedBy)
                VALUES (@categoryId, @name, @description, @displayOrder, @createdBy)
            `);
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/subcategories/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { categoryId, name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        
        await db.request()
            .input('id', sql.Int, id)
            .input('categoryId', sql.Int, categoryId)
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('updatedBy', sql.NVarChar, user?.email || 'system')
            .query(`
                UPDATE OHSEventSubCategories 
                SET CategoryId = @categoryId, SubCategoryName = @name, Description = @description, DisplayOrder = @displayOrder,
                    UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
                WHERE Id = @id
            `);
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.delete('/subcategories/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getPool();
        await db.request().input('id', sql.Int, id).query('DELETE FROM OHSEventSubCategories WHERE Id = @id');
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// =====================================================
// INJURY TYPES MANAGEMENT
// =====================================================
router.get('/injury-types', async (req, res) => {
    try {
        const db = await getPool();
        const injuryTypes = await db.request().query(`
            SELECT * FROM OHSInjuryTypes ORDER BY DisplayOrder, InjuryTypeName
        `);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Injury Types - OHS Settings</title>
                <style>${getCommonStyles()}</style>
            </head>
            <body>
                <div class="header">
                    <h1>🩹 OHS Injury Types</h1>
                    <div class="header-nav">
                        <a href="/ohs">← Back to OHS</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Manage Injury Types</h2>
                        <p>Configure types of injuries that can be reported</p>
                    </div>
                    
                    <div id="alertContainer"></div>
                    
                    <div class="card">
                        <div class="toolbar">
                            <span></span>
                            <button class="btn btn-primary" onclick="openAddModal()">+ Add Injury Type</button>
                        </div>
                        
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Injury Type</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${injuryTypes.recordset.map(it => `
                                        <tr>
                                            <td>${it.DisplayOrder}</td>
                                            <td><strong>${it.InjuryTypeName}</strong></td>
                                            <td>${it.Description || '-'}</td>
                                            <td><span class="badge ${it.IsActive ? 'badge-success' : 'badge-danger'}">${it.IsActive ? 'Active' : 'Inactive'}</span></td>
                                            <td class="actions">
                                                <button class="btn btn-secondary" onclick="editItem(${it.Id}, '${it.InjuryTypeName.replace(/'/g, "\\'")}', '${(it.Description || '').replace(/'/g, "\\'")}', ${it.DisplayOrder})">Edit</button>
                                                <button class="btn btn-danger" onclick="deleteItem(${it.Id})">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Modal -->
                <div class="modal" id="itemModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modalTitle">Add Injury Type</h3>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <form onsubmit="saveItem(event)">
                            <input type="hidden" id="itemId">
                            <div class="form-group">
                                <label>Injury Type Name *</label>
                                <input type="text" id="itemName" required>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea id="itemDesc" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Display Order</label>
                                <input type="number" id="itemOrder" value="0">
                            </div>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </form>
                    </div>
                </div>
                
                <script>
                    function openAddModal() {
                        document.getElementById('modalTitle').textContent = 'Add Injury Type';
                        document.getElementById('itemId').value = '';
                        document.getElementById('itemName').value = '';
                        document.getElementById('itemDesc').value = '';
                        document.getElementById('itemOrder').value = '0';
                        document.getElementById('itemModal').classList.add('active');
                    }
                    function editItem(id, name, desc, order) {
                        document.getElementById('modalTitle').textContent = 'Edit Injury Type';
                        document.getElementById('itemId').value = id;
                        document.getElementById('itemName').value = name;
                        document.getElementById('itemDesc').value = desc;
                        document.getElementById('itemOrder').value = order;
                        document.getElementById('itemModal').classList.add('active');
                    }
                    function closeModal() { document.getElementById('itemModal').classList.remove('active'); }
                    function showAlert(message, type) {
                        document.getElementById('alertContainer').innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
                        setTimeout(() => document.getElementById('alertContainer').innerHTML = '', 5000);
                    }
                    async function saveItem(e) {
                        e.preventDefault();
                        const id = document.getElementById('itemId').value;
                        const data = {
                            name: document.getElementById('itemName').value,
                            description: document.getElementById('itemDesc').value,
                            displayOrder: parseInt(document.getElementById('itemOrder').value) || 0
                        };
                        const url = id ? '/ohs/settings/injury-types/update/' + id : '/ohs/settings/injury-types/add';
                        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to save', 'error');
                    }
                    async function deleteItem(id) {
                        if (!confirm('Are you sure?')) return;
                        const res = await fetch('/ohs/settings/injury-types/delete/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to delete', 'error');
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error: ' + error.message);
    }
});

// Injury Types CRUD APIs
router.post('/injury-types/add', async (req, res) => {
    try {
        const { name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        await db.request()
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('createdBy', sql.NVarChar, user?.email || 'system')
            .query(`INSERT INTO OHSInjuryTypes (InjuryTypeName, Description, DisplayOrder, CreatedBy) VALUES (@name, @description, @displayOrder, @createdBy)`);
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/injury-types/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, displayOrder } = req.body;
        const user = req.currentUser;
        const db = await getPool();
        await db.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .input('updatedBy', sql.NVarChar, user?.email || 'system')
            .query(`UPDATE OHSInjuryTypes SET InjuryTypeName = @name, Description = @description, DisplayOrder = @displayOrder, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy WHERE Id = @id`);
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/injury-types/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getPool();
        await db.request().input('id', sql.Int, id).query('DELETE FROM OHSInjuryTypes WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// =====================================================
// BODY PARTS MANAGEMENT
// =====================================================
router.get('/body-parts', async (req, res) => {
    try {
        const db = await getPool();
        const bodyParts = await db.request().query(`
            SELECT * FROM OHSBodyParts ORDER BY DisplayOrder, BodyPartName
        `);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Body Parts - OHS Settings</title>
                <style>${getCommonStyles()}</style>
            </head>
            <body>
                <div class="header">
                    <h1>🦴 OHS Body Parts</h1>
                    <div class="header-nav">
                        <a href="/ohs">← Back to OHS</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Manage Body Parts</h2>
                        <p>Configure body parts for injury reporting</p>
                    </div>
                    
                    <div id="alertContainer"></div>
                    
                    <div class="card">
                        <div class="toolbar">
                            <span></span>
                            <button class="btn btn-primary" onclick="openAddModal()">+ Add Body Part</button>
                        </div>
                        
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Body Part</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${bodyParts.recordset.map(bp => `
                                        <tr>
                                            <td>${bp.DisplayOrder}</td>
                                            <td><strong>${bp.BodyPartName}</strong></td>
                                            <td><span class="badge ${bp.IsActive ? 'badge-success' : 'badge-danger'}">${bp.IsActive ? 'Active' : 'Inactive'}</span></td>
                                            <td class="actions">
                                                <button class="btn btn-secondary" onclick="editItem(${bp.Id}, '${bp.BodyPartName.replace(/'/g, "\\'")}', ${bp.DisplayOrder})">Edit</button>
                                                <button class="btn btn-danger" onclick="deleteItem(${bp.Id})">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Modal -->
                <div class="modal" id="itemModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modalTitle">Add Body Part</h3>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <form onsubmit="saveItem(event)">
                            <input type="hidden" id="itemId">
                            <div class="form-group">
                                <label>Body Part Name *</label>
                                <input type="text" id="itemName" required>
                            </div>
                            <div class="form-group">
                                <label>Display Order</label>
                                <input type="number" id="itemOrder" value="0">
                            </div>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </form>
                    </div>
                </div>
                
                <script>
                    function openAddModal() {
                        document.getElementById('modalTitle').textContent = 'Add Body Part';
                        document.getElementById('itemId').value = '';
                        document.getElementById('itemName').value = '';
                        document.getElementById('itemOrder').value = '0';
                        document.getElementById('itemModal').classList.add('active');
                    }
                    function editItem(id, name, order) {
                        document.getElementById('modalTitle').textContent = 'Edit Body Part';
                        document.getElementById('itemId').value = id;
                        document.getElementById('itemName').value = name;
                        document.getElementById('itemOrder').value = order;
                        document.getElementById('itemModal').classList.add('active');
                    }
                    function closeModal() { document.getElementById('itemModal').classList.remove('active'); }
                    function showAlert(message, type) {
                        document.getElementById('alertContainer').innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
                        setTimeout(() => document.getElementById('alertContainer').innerHTML = '', 5000);
                    }
                    async function saveItem(e) {
                        e.preventDefault();
                        const id = document.getElementById('itemId').value;
                        const data = {
                            name: document.getElementById('itemName').value,
                            displayOrder: parseInt(document.getElementById('itemOrder').value) || 0
                        };
                        const url = id ? '/ohs/settings/body-parts/update/' + id : '/ohs/settings/body-parts/add';
                        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to save', 'error');
                    }
                    async function deleteItem(id) {
                        if (!confirm('Are you sure?')) return;
                        const res = await fetch('/ohs/settings/body-parts/delete/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) location.reload();
                        else showAlert(result.error || 'Failed to delete', 'error');
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error: ' + error.message);
    }
});

// Body Parts CRUD APIs
router.post('/body-parts/add', async (req, res) => {
    try {
        const { name, displayOrder } = req.body;
        const db = await getPool();
        await db.request()
            .input('name', sql.NVarChar, name)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .query(`INSERT INTO OHSBodyParts (BodyPartName, DisplayOrder) VALUES (@name, @displayOrder)`);
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/body-parts/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, displayOrder } = req.body;
        const db = await getPool();
        await db.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('displayOrder', sql.Int, displayOrder || 0)
            .query(`UPDATE OHSBodyParts SET BodyPartName = @name, DisplayOrder = @displayOrder WHERE Id = @id`);
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/body-parts/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getPool();
        await db.request().input('id', sql.Int, id).query('DELETE FROM OHSBodyParts WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

module.exports = router;
