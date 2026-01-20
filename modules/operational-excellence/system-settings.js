/**
 * System Settings Module for Operational Excellence
 * Manage global settings: Stores, Categories, Third Party Providers
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

// Main settings page
router.get('/', (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>System Settings - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: #f5f5f5;
                    min-height: 100vh;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header h1 { font-size: 24px; }
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
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 30px;
                }
                
                .page-title {
                    margin-bottom: 30px;
                }
                .page-title h2 {
                    font-size: 28px;
                    color: #333;
                    margin-bottom: 5px;
                }
                .page-title p {
                    color: #666;
                }
                
                .tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 25px;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 0;
                }
                
                .tab {
                    padding: 12px 24px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    color: #666;
                    border-bottom: 3px solid transparent;
                    margin-bottom: -2px;
                    transition: all 0.2s;
                }
                .tab:hover { color: #667eea; }
                .tab.active {
                    color: #667eea;
                    border-bottom-color: #667eea;
                }
                
                .tab-content {
                    display: none;
                    background: white;
                    border-radius: 12px;
                    padding: 25px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                }
                .tab-content.active { display: block; }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                }
                
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
                .btn-success { background: #28a745; color: white; }
                .btn-success:hover { background: #218838; }
                .btn-danger { background: #dc3545; color: white; }
                .btn-danger:hover { background: #c82333; }
                .btn-secondary { background: #6c757d; color: white; }
                .btn-secondary:hover { background: #5a6268; }
                .btn-sm { padding: 6px 12px; font-size: 13px; }
                
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .data-table th {
                    background: #f8f9fa;
                    padding: 12px 15px;
                    text-align: left;
                    font-weight: 600;
                    color: #333;
                    border-bottom: 2px solid #e0e0e0;
                }
                .data-table td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #eee;
                    color: #555;
                }
                .data-table tr:hover { background: #f8f9fa; }
                
                .status-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .status-active { background: #d4edda; color: #155724; }
                .status-inactive { background: #f8d7da; color: #721c24; }
                
                .actions {
                    display: flex;
                    gap: 8px;
                }
                
                /* Modal */
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
                    border-radius: 16px;
                    padding: 30px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                }
                
                .modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #333;
                }
                
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
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: #333;
                }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }
                .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
                    outline: none;
                    border-color: #667eea;
                }
                
                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 25px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }
                
                .empty-state {
                    text-align: center;
                    padding: 50px;
                    color: #888;
                }
                .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                
                .loading {
                    text-align: center;
                    padding: 30px;
                    color: #666;
                }
                
                .toast {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    padding: 15px 25px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 2000;
                    animation: slideIn 0.3s ease;
                }
                .toast-success { background: #28a745; }
                .toast-error { background: #dc3545; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>⚙️ System Settings</h1>
                <div class="header-nav">
                    <a href="/operational-excellence">← Back to OE</a>
                    <a href="/dashboard">🏠 Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="page-title">
                    <h2>System Settings</h2>
                    <p>Manage global settings used across all modules</p>
                </div>
                
                <div class="tabs">
                    <button class="tab active" data-tab="stores">🏪 Stores</button>
                    <button class="tab" data-tab="categories">📁 Cleaning Categories</button>
                    <button class="tab" data-tab="providers">🏢 Third Party Providers</button>
                </div>
                
                <!-- Stores Tab -->
                <div id="stores-tab" class="tab-content active">
                    <div class="section-header">
                        <div class="section-title">Manage Stores</div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-success" onclick="openBulkModal()">📥 Bulk Import</button>
                            <button class="btn btn-primary" onclick="openModal('store')">+ Add Store</button>
                        </div>
                    </div>
                    <div id="stores-table">
                        <div class="loading">Loading stores...</div>
                    </div>
                </div>
                
                <!-- Categories Tab -->
                <div id="categories-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Cleaning Categories</div>
                        <button class="btn btn-primary" onclick="openModal('category')">+ Add Category</button>
                    </div>
                    <div id="categories-table">
                        <div class="loading">Loading categories...</div>
                    </div>
                </div>
                
                <!-- Providers Tab -->
                <div id="providers-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Third Party Providers</div>
                        <button class="btn btn-primary" onclick="openModal('provider')">+ Add Provider</button>
                    </div>
                    <div id="providers-table">
                        <div class="loading">Loading providers...</div>
                    </div>
                </div>
            </div>
            
            <!-- Store Modal -->
            <div id="storeModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="storeModalTitle">Add Store</div>
                        <button class="modal-close" onclick="closeModal('store')">&times;</button>
                    </div>
                    <form id="storeForm">
                        <input type="hidden" id="storeId" value="">
                        <div class="form-group">
                            <label>Store Name *</label>
                            <input type="text" id="storeName" required placeholder="Enter store name">
                        </div>
                        <div class="form-group">
                            <label>Store Code</label>
                            <input type="text" id="storeCode" placeholder="e.g., ST001">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="storeStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('store')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Store</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Category Modal -->
            <div id="categoryModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="categoryModalTitle">Add Category</div>
                        <button class="modal-close" onclick="closeModal('category')">&times;</button>
                    </div>
                    <form id="categoryForm">
                        <input type="hidden" id="categoryId" value="">
                        <div class="form-group">
                            <label>Category Name *</label>
                            <input type="text" id="categoryName" required placeholder="Enter category name">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="categoryStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('category')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Category</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Provider Modal -->
            <div id="providerModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="providerModalTitle">Add Provider</div>
                        <button class="modal-close" onclick="closeModal('provider')">&times;</button>
                    </div>
                    <form id="providerForm">
                        <input type="hidden" id="providerId" value="">
                        <div class="form-group">
                            <label>Category *</label>
                            <select id="providerCategory" required>
                                <option value="">Select Category...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Provider Name *</label>
                            <input type="text" id="providerName" required placeholder="Enter provider name">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="providerStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('provider')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Provider</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Delete Confirmation Modal -->
            <div id="deleteModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">Confirm Delete</div>
                        <button class="modal-close" onclick="closeDeleteModal()">&times;</button>
                    </div>
                    <p style="color: #666; margin-bottom: 20px;">Are you sure you want to delete this item? This action cannot be undone.</p>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeDeleteModal()">Cancel</button>
                        <button class="btn btn-danger" id="confirmDeleteBtn">Delete</button>
                    </div>
                </div>
            </div>
            
            <!-- Bulk Import Modal -->
            <div id="bulkModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <div class="modal-title">📥 Bulk Import Stores</div>
                        <button class="modal-close" onclick="closeBulkModal()">&times;</button>
                    </div>
                    <form id="bulkForm">
                        <div class="form-group">
                            <label>Enter Store Names (one per line)</label>
                            <textarea id="bulkStores" rows="10" placeholder="Store Name 1&#10;Store Name 2&#10;Store Name 3&#10;..." style="font-family: monospace;"></textarea>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <strong>💡 Tips:</strong>
                            <ul style="margin: 10px 0 0 20px; color: #666; font-size: 13px;">
                                <li>Enter one store name per line</li>
                                <li>Duplicate entries will be skipped</li>
                                <li>All stores will be set to Active by default</li>
                                <li>You can also paste from Excel (one column)</li>
                            </ul>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeBulkModal()">Cancel</button>
                            <button type="submit" class="btn btn-success">Import Stores</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <script>
                // Tab switching
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        tab.classList.add('active');
                        document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
                    });
                });
                
                // Load all data on page load
                loadStores();
                loadCategories();
                loadProviders();
                
                // Modal functions
                function openModal(type) {
                    document.getElementById(type + 'Id').value = '';
                    document.getElementById(type + 'Form').reset();
                    document.getElementById(type + 'ModalTitle').textContent = 'Add ' + type.charAt(0).toUpperCase() + type.slice(1);
                    
                    // Populate category dropdown when opening provider modal
                    if (type === 'provider') {
                        populateProviderCategoryDropdown();
                    }
                    
                    document.getElementById(type + 'Modal').classList.add('show');
                }
                
                function closeModal(type) {
                    document.getElementById(type + 'Modal').classList.remove('show');
                }
                
                function showToast(message, type = 'success') {
                    const toast = document.createElement('div');
                    toast.className = 'toast toast-' + type;
                    toast.textContent = message;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 3000);
                }
                
                // ========== STORES ==========
                let storesData = [];
                
                async function loadStores() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/stores?t=' + Date.now());
                        storesData = await res.json();
                        renderStoresTable(storesData);
                    } catch (err) {
                        console.error('Error loading stores:', err);
                        document.getElementById('stores-table').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Error loading stores</p></div>';
                    }
                }
                
                function renderStoresTable(stores) {
                    if (!stores.length) {
                        document.getElementById('stores-table').innerHTML = '<div class="empty-state"><div class="icon">🏪</div><p>No stores found. Add your first store!</p></div>';
                        return;
                    }
                    
                    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Store Name</th><th>Code</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
                    stores.forEach(s => {
                        html += '<tr>';
                        html += '<td>' + s.Id + '</td>';
                        html += '<td>' + s.StoreName + '</td>';
                        html += '<td>' + (s.StoreCode || '-') + '</td>';
                        html += '<td><span class="status-badge ' + (s.IsActive ? 'status-active' : 'status-inactive') + '">' + (s.IsActive ? 'Active' : 'Inactive') + '</span></td>';
                        html += '<td class="actions">';
                        html += '<button class="btn btn-primary btn-sm" onclick="editStore(' + s.Id + ', \\'' + escapeJS(s.StoreName) + '\\', \\'' + escapeJS(s.StoreCode || '') + '\\', ' + s.IsActive + ')">Edit</button>';
                        html += '<button class="btn btn-danger btn-sm" onclick="deleteItem(\\'store\\', ' + s.Id + ')">Delete</button>';
                        html += '</td></tr>';
                    });
                    html += '</tbody></table>';
                    document.getElementById('stores-table').innerHTML = html;
                }
                
                function editStore(id, name, code, status) {
                    document.getElementById('storeId').value = id;
                    document.getElementById('storeName').value = name;
                    document.getElementById('storeCode').value = code;
                    document.getElementById('storeStatus').value = status ? '1' : '0';
                    document.getElementById('storeModalTitle').textContent = 'Edit Store';
                    document.getElementById('storeModal').classList.add('show');
                }
                
                document.getElementById('storeForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('storeId').value;
                    const data = {
                        name: document.getElementById('storeName').value,
                        code: document.getElementById('storeCode').value,
                        isActive: document.getElementById('storeStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/stores/' + id : '/operational-excellence/system-settings/api/stores';
                        const method = id ? 'PUT' : 'POST';
                        const res = await fetch(url, {
                            method: method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('store');
                            showToast(id ? 'Store updated!' : 'Store added!');
                            await loadStores();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving store', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving store:', err);
                        showToast('Error saving store', 'error');
                    }
                });
                
                // ========== CATEGORIES ==========
                let categoriesData = [];
                
                async function loadCategories() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/categories?t=' + Date.now());
                        categoriesData = await res.json();
                        renderCategoriesTable(categoriesData);
                    } catch (err) {
                        console.error('Error loading categories:', err);
                        document.getElementById('categories-table').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Error loading categories</p></div>';
                    }
                }
                
                function renderCategoriesTable(categories) {
                    if (!categories.length) {
                        document.getElementById('categories-table').innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>No categories found. Add your first category!</p></div>';
                        return;
                    }
                    
                    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Category Name</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
                    categories.forEach(c => {
                        html += '<tr>';
                        html += '<td>' + c.Id + '</td>';
                        html += '<td>' + c.CategoryName + '</td>';
                        html += '<td><span class="status-badge ' + (c.IsActive ? 'status-active' : 'status-inactive') + '">' + (c.IsActive ? 'Active' : 'Inactive') + '</span></td>';
                        html += '<td class="actions">';
                        html += '<button class="btn btn-primary btn-sm" onclick="editCategory(' + c.Id + ', \\'' + escapeJS(c.CategoryName) + '\\', ' + c.IsActive + ')">Edit</button>';
                        html += '<button class="btn btn-danger btn-sm" onclick="deleteItem(\\'category\\', ' + c.Id + ')">Delete</button>';
                        html += '</td></tr>';
                    });
                    html += '</tbody></table>';
                    document.getElementById('categories-table').innerHTML = html;
                }
                
                function editCategory(id, name, status) {
                    document.getElementById('categoryId').value = id;
                    document.getElementById('categoryName').value = name;
                    document.getElementById('categoryStatus').value = status ? '1' : '0';
                    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
                    document.getElementById('categoryModal').classList.add('show');
                }
                
                document.getElementById('categoryForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('categoryId').value;
                    const data = {
                        name: document.getElementById('categoryName').value,
                        isActive: document.getElementById('categoryStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/categories/' + id : '/operational-excellence/system-settings/api/categories';
                        const method = id ? 'PUT' : 'POST';
                        const res = await fetch(url, {
                            method: method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('category');
                            showToast(id ? 'Category updated!' : 'Category added!');
                            await loadCategories();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving category', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving category:', err);
                        showToast('Error saving category', 'error');
                    }
                });
                
                // ========== PROVIDERS ==========
                let providersData = [];
                
                async function loadProviders() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/providers?t=' + Date.now());
                        providersData = await res.json();
                        renderProvidersTable(providersData);
                        // Also populate the category dropdown in provider modal
                        populateProviderCategoryDropdown();
                    } catch (err) {
                        console.error('Error loading providers:', err);
                        document.getElementById('providers-table').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Error loading providers</p></div>';
                    }
                }
                
                function populateProviderCategoryDropdown() {
                    const select = document.getElementById('providerCategory');
                    select.innerHTML = '<option value="">Select Category...</option>';
                    categoriesData.forEach(c => {
                        if (c.IsActive) {
                            select.innerHTML += '<option value="' + c.Id + '">' + c.CategoryName + '</option>';
                        }
                    });
                }
                
                function renderProvidersTable(providers) {
                    if (!providers.length) {
                        document.getElementById('providers-table').innerHTML = '<div class="empty-state"><div class="icon">🏢</div><p>No providers found. Add your first provider!</p></div>';
                        return;
                    }
                    
                    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Category</th><th>Provider Name</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
                    providers.forEach(p => {
                        const categoryName = p.CategoryName || '<span style="color:#999">Not assigned</span>';
                        html += '<tr>';
                        html += '<td>' + p.Id + '</td>';
                        html += '<td>' + categoryName + '</td>';
                        html += '<td>' + p.ProviderName + '</td>';
                        html += '<td><span class="status-badge ' + (p.IsActive ? 'status-active' : 'status-inactive') + '">' + (p.IsActive ? 'Active' : 'Inactive') + '</span></td>';
                        html += '<td class="actions">';
                        html += '<button class="btn btn-primary btn-sm" onclick="editProvider(' + p.Id + ', ' + (p.CategoryId || 'null') + ', \\'' + escapeJS(p.ProviderName) + '\\', ' + p.IsActive + ')">Edit</button>';
                        html += '<button class="btn btn-danger btn-sm" onclick="deleteItem(\\'provider\\', ' + p.Id + ')">Delete</button>';
                        html += '</td></tr>';
                    });
                    html += '</tbody></table>';
                    document.getElementById('providers-table').innerHTML = html;
                }
                
                function editProvider(id, categoryId, name, status) {
                    // Populate category dropdown first
                    populateProviderCategoryDropdown();
                    
                    document.getElementById('providerId').value = id;
                    document.getElementById('providerCategory').value = categoryId || '';
                    document.getElementById('providerName').value = name;
                    document.getElementById('providerStatus').value = status ? '1' : '0';
                    document.getElementById('providerModalTitle').textContent = 'Edit Provider';
                    document.getElementById('providerModal').classList.add('show');
                }
                
                document.getElementById('providerForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('providerId').value;
                    const data = {
                        categoryId: document.getElementById('providerCategory').value || null,
                        name: document.getElementById('providerName').value,
                        isActive: document.getElementById('providerStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/providers/' + id : '/operational-excellence/system-settings/api/providers';
                        const method = id ? 'PUT' : 'POST';
                        const res = await fetch(url, {
                            method: method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('provider');
                            showToast(id ? 'Provider updated!' : 'Provider added!');
                            await loadProviders();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving provider', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving provider:', err);
                        showToast('Error saving provider', 'error');
                    }
                });
                
                // ========== DELETE ==========
                let deleteType = '';
                let deleteId = 0;
                
                function deleteItem(type, id) {
                    deleteType = type;
                    deleteId = id;
                    document.getElementById('deleteModal').classList.add('show');
                }
                
                function closeDeleteModal() {
                    document.getElementById('deleteModal').classList.remove('show');
                }
                
                document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
                    try {
                        const url = '/operational-excellence/system-settings/api/' + deleteType + 's/' + deleteId;
                        const res = await fetch(url, { method: 'DELETE' });
                        
                        if (res.ok) {
                            closeDeleteModal();
                            showToast('Item deleted successfully!');
                            if (deleteType === 'store') await loadStores();
                            else if (deleteType === 'category') await loadCategories();
                            else if (deleteType === 'provider') await loadProviders();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error deleting item', 'error');
                        }
                    } catch (err) {
                        console.error('Error deleting item:', err);
                        showToast('Error deleting item', 'error');
                    }
                });
                
                function escapeJS(str) {
                    return str ? str.replace(/'/g, "\\\\'").replace(/"/g, '\\\\"') : '';
                }
                
                // ========== BULK IMPORT ==========
                function openBulkModal() {
                    document.getElementById('bulkStores').value = '';
                    document.getElementById('bulkModal').classList.add('show');
                }
                
                function closeBulkModal() {
                    document.getElementById('bulkModal').classList.remove('show');
                }
                
                document.getElementById('bulkForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const text = document.getElementById('bulkStores').value.trim();
                    if (!text) {
                        showToast('Please enter store names', 'error');
                        return;
                    }
                    
                    // Parse store names (one per line)
                    const stores = text.split('\\n')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    
                    if (stores.length === 0) {
                        showToast('No valid store names found', 'error');
                        return;
                    }
                    
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/stores/bulk', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ stores })
                        });
                        
                        const result = await res.json();
                        if (res.ok) {
                            showToast('Imported ' + result.imported + ' stores! (' + result.skipped + ' skipped)');
                            closeBulkModal();
                            loadStores();
                        } else {
                            showToast(result.error || 'Error importing stores', 'error');
                        }
                    } catch (err) {
                        showToast('Error importing stores', 'error');
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// ========== STORES API ==========
router.get('/api/stores', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM Stores ORDER BY StoreName');
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading stores:', err);
        res.status(500).json({ error: 'Failed to load stores' });
    }
});

router.post('/api/stores', async (req, res) => {
    try {
        const { name, code, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('code', sql.NVarChar, code || null)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.currentUser?.DisplayName || 'System')
            .query('INSERT INTO Stores (StoreName, StoreCode, IsActive, CreatedBy) VALUES (@name, @code, @isActive, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding store:', err);
        res.status(500).json({ error: 'Failed to add store' });
    }
});

// Bulk import stores
router.post('/api/stores/bulk', async (req, res) => {
    try {
        const { stores } = req.body;
        if (!stores || !Array.isArray(stores) || stores.length === 0) {
            return res.status(400).json({ error: 'No stores provided' });
        }
        
        const pool = await sql.connect(dbConfig);
        const createdBy = req.currentUser?.DisplayName || 'System';
        
        // Get existing store names to avoid duplicates
        const existingResult = await pool.request().query('SELECT StoreName FROM Stores');
        const existingNames = new Set(existingResult.recordset.map(s => s.StoreName.toLowerCase()));
        
        let imported = 0;
        let skipped = 0;
        
        for (const storeName of stores) {
            if (existingNames.has(storeName.toLowerCase())) {
                skipped++;
                continue;
            }
            
            await pool.request()
                .input('name', sql.NVarChar, storeName)
                .input('createdBy', sql.NVarChar, createdBy)
                .query('INSERT INTO Stores (StoreName, IsActive, CreatedBy) VALUES (@name, 1, @createdBy)');
            
            existingNames.add(storeName.toLowerCase());
            imported++;
        }
        
        await pool.close();
        res.json({ success: true, imported, skipped });
    } catch (err) {
        console.error('Error bulk importing stores:', err);
        res.status(500).json({ error: 'Failed to import stores' });
    }
});

router.put('/api/stores/:id', async (req, res) => {
    try {
        const { name, code, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('name', sql.NVarChar, name)
            .input('code', sql.NVarChar, code || null)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE Stores SET StoreName = @name, StoreCode = @code, IsActive = @isActive WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating store:', err);
        res.status(500).json({ error: 'Failed to update store' });
    }
});

router.delete('/api/stores/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Stores WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting store:', err);
        res.status(500).json({ error: 'Failed to delete store' });
    }
});

// ========== CATEGORIES API ==========
router.get('/api/categories', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM CleaningCategories ORDER BY CategoryName');
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading categories:', err);
        res.status(500).json({ error: 'Failed to load categories' });
    }
});

router.post('/api/categories', async (req, res) => {
    try {
        const { name, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.currentUser?.DisplayName || 'System')
            .query('INSERT INTO CleaningCategories (CategoryName, IsActive, CreatedBy) VALUES (@name, @isActive, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).json({ error: 'Failed to add category' });
    }
});

router.put('/api/categories/:id', async (req, res) => {
    try {
        const { name, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('name', sql.NVarChar, name)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE CleaningCategories SET CategoryName = @name, IsActive = @isActive WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

router.delete('/api/categories/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM CleaningCategories WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ========== PROVIDERS API ==========
router.get('/api/providers', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT p.*, c.CategoryName 
            FROM ThirdPartyProviders p
            LEFT JOIN CleaningCategories c ON p.CategoryId = c.Id
            ORDER BY c.CategoryName, p.ProviderName
        `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading providers:', err);
        res.status(500).json({ error: 'Failed to load providers' });
    }
});

// Get providers by category (for filtering in forms)
router.get('/api/providers/by-category/:categoryId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('categoryId', sql.Int, req.params.categoryId)
            .query('SELECT * FROM ThirdPartyProviders WHERE CategoryId = @categoryId AND IsActive = 1 ORDER BY ProviderName');
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading providers by category:', err);
        res.status(500).json({ error: 'Failed to load providers' });
    }
});

router.post('/api/providers', async (req, res) => {
    try {
        const { categoryId, name, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('categoryId', sql.Int, categoryId || null)
            .input('name', sql.NVarChar, name)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.currentUser?.DisplayName || 'System')
            .query('INSERT INTO ThirdPartyProviders (CategoryId, ProviderName, IsActive, CreatedBy) VALUES (@categoryId, @name, @isActive, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding provider:', err);
        res.status(500).json({ error: 'Failed to add provider' });
    }
});

router.put('/api/providers/:id', async (req, res) => {
    try {
        const { categoryId, name, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('categoryId', sql.Int, categoryId || null)
            .input('name', sql.NVarChar, name)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ThirdPartyProviders SET CategoryId = @categoryId, ProviderName = @name, IsActive = @isActive WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating provider:', err);
        res.status(500).json({ error: 'Failed to update provider' });
    }
});

router.delete('/api/providers/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ThirdPartyProviders WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting provider:', err);
        res.status(500).json({ error: 'Failed to delete provider' });
    }
});

module.exports = router;
