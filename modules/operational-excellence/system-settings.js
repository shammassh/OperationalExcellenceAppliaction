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
    },
    pool: {
        max: 20,
        min: 2,
        idleTimeoutMillis: 60000
    }
};

// Shared connection pool - create once and reuse
let poolPromise = null;
let pool = null;

async function getPool() {
    // Check if we have a valid connected pool
    if (pool && pool.connected) {
        return pool;
    }
    
    // Reset if pool exists but is not connected
    if (pool && !pool.connected) {
        poolPromise = null;
        pool = null;
    }
    
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).then(newPool => {
            console.log('System Settings: Connected to SQL Server');
            pool = newPool;
            pool.on('error', err => {
                console.error('System Settings Pool Error:', err);
                poolPromise = null;
                pool = null;
            });
            return pool;
        }).catch(err => {
            console.error('System Settings: Database connection failed:', err);
            poolPromise = null;
            pool = null;
            throw err;
        });
    }
    return poolPromise;
}

// Helper function to get database connection (deprecated - use getPool instead)
async function getDbConnection() {
    return await getPool();
}

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
                    <button class="tab" data-tab="schemes">🏭 Outlet Schemes</button>
                    <button class="tab" data-tab="outlets">🏬 Outlets</button>
                    <button class="tab" data-tab="locations">📍 Locations</button>
                    <button class="tab" data-tab="prodcategories">📂 Prod Categories</button>
                    <button class="tab" data-tab="thirdparties">🤝 Third Parties</button>
                    <button class="tab" data-tab="shifts">⏰ Shifts</button>
                    <button class="tab" data-tab="unitcosts">💰 Unit Costs</button>
                    <button class="tab" data-tab="approvalrules">📋 Approval Rules</button>
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
                
                <!-- Outlet Schemes Tab -->
                <div id="schemes-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Production Outlet Schemes</div>
                        <button class="btn btn-primary" onclick="openModal('scheme')">+ Add Scheme</button>
                    </div>
                    <div id="schemes-table">
                        <div class="loading">Loading outlet schemes...</div>
                    </div>
                </div>
                
                <!-- Production Outlets Tab -->
                <div id="outlets-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Production Outlets</div>
                        <button class="btn btn-primary" onclick="openModal('outlet')">+ Add Outlet</button>
                    </div>
                    <div id="outlets-table">
                        <div class="loading">Loading outlets...</div>
                    </div>
                </div>
                
                <!-- Production Locations Tab -->
                <div id="locations-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Production Locations</div>
                        <button class="btn btn-primary" onclick="openModal('location')">+ Add Location</button>
                    </div>
                    <div id="locations-table">
                        <div class="loading">Loading locations...</div>
                    </div>
                </div>
                
                <!-- Production Categories Tab -->
                <div id="prodcategories-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Production Categories</div>
                        <button class="btn btn-primary" onclick="openModal('prodcategory')">+ Add Category</button>
                    </div>
                    <div id="prodcategories-table">
                        <div class="loading">Loading categories...</div>
                    </div>
                </div>
                
                <!-- Third Parties Tab -->
                <div id="thirdparties-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Third Parties</div>
                        <button class="btn btn-primary" onclick="openModal('thirdparty')">+ Add Third Party</button>
                    </div>
                    <div id="thirdparties-table">
                        <div class="loading">Loading third parties...</div>
                    </div>
                </div>
                
                <!-- Shifts Tab -->
                <div id="shifts-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Shifts</div>
                        <button class="btn btn-primary" onclick="openModal('shift')">+ Add Shift</button>
                    </div>
                    <div id="shifts-table">
                        <div class="loading">Loading shifts...</div>
                    </div>
                </div>
                
                <!-- Unit Costs Tab -->
                <div id="unitcosts-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Manage Unit Costs</div>
                        <button class="btn btn-primary" onclick="openModal('unitcost')">+ Add Unit Cost</button>
                    </div>
                    <div id="unitcosts-table">
                        <div class="loading">Loading unit costs...</div>
                    </div>
                </div>
                
                <!-- Approval Rules Tab -->
                <div id="approvalrules-tab" class="tab-content">
                    <div class="section-header">
                        <div class="section-title">Approval Flow Configuration</div>
                    </div>
                    
                    <!-- Approver Emails Section -->
                    <div style="background: white; border-radius: 10px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                        <h3 style="margin-bottom: 20px; color: #333; font-size: 18px;">📧 Approver Email Addresses</h3>
                        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">Configure the email addresses for each approver role</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                            <div>
                                <h4 style="color: #17a2b8; margin-bottom: 15px;">Extra Cleaning Module</h4>
                                <div class="form-group">
                                    <label>Area Manager Email</label>
                                    <input type="email" id="approval_AREA_MANAGER_EMAIL" placeholder="areamanager@company.com" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                </div>
                                <div class="form-group">
                                    <label>Head of Operations Email</label>
                                    <input type="email" id="approval_HEAD_OF_OPERATIONS_EMAIL" placeholder="headops@company.com" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                </div>
                                <div class="form-group">
                                    <label>HR Manager Email</label>
                                    <input type="email" id="approval_HR_MANAGER_EMAIL" placeholder="hr@company.com" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                </div>
                            </div>
                            <div>
                                <h4 style="color: #667eea; margin-bottom: 15px;">Production Extras Module</h4>
                                <div class="form-group">
                                    <label>Default Approver 1 Email</label>
                                    <input type="email" id="approval_DEFAULT_APPROVER_1_EMAIL" placeholder="approver1@company.com" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                </div>
                                <div class="form-group">
                                    <label>Default Approver 2 Email</label>
                                    <input type="email" id="approval_DEFAULT_APPROVER_2_EMAIL" placeholder="approver2@company.com" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                </div>
                                <div class="form-group">
                                    <label>HR Approver Email</label>
                                    <input type="email" id="approval_HR_APPROVER_EMAIL" placeholder="hr@company.com" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                </div>
                            </div>
                        </div>
                        <div style="margin-top: 20px; text-align: right;">
                            <button class="btn btn-success" onclick="saveApprovalSettings()">💾 Save Email Settings</button>
                        </div>
                    </div>
                    
                    <!-- Approval Rules Section -->
                    <div style="background: white; border-radius: 10px; padding: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <div>
                                <h3 style="color: #333; font-size: 18px; margin-bottom: 5px;">📋 Approval Flow Rules</h3>
                                <p style="color: #666; font-size: 14px;">Define conditions that modify the default approval flow</p>
                            </div>
                            <button class="btn btn-primary" onclick="openModal('approvalrule')">+ Add Rule</button>
                        </div>
                        
                        <!-- Default Flows Info -->
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                            <strong style="color: #333;">Default Approval Flows:</strong>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                                <div style="padding: 10px; background: #e3f2fd; border-radius: 6px;">
                                    <span style="color: #17a2b8; font-weight: 600;">🧹 Extra Cleaning:</span>
                                    <span style="color: #666;">Area Manager → Head of Operations</span>
                                </div>
                                <div style="padding: 10px; background: #f3e5f5; border-radius: 6px;">
                                    <span style="color: #667eea; font-weight: 600;">👷 Production:</span>
                                    <span style="color: #666;">Approver 1 → Approver 2</span>
                                </div>
                            </div>
                        </div>
                        
                        <div id="approvalrules-table">
                            <div class="loading">Loading rules...</div>
                        </div>
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
            
            <!-- Outlet Scheme Modal -->
            <div id="schemeModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="schemeModalTitle">Add Outlet Scheme</div>
                        <button class="modal-close" onclick="closeModal('scheme')">&times;</button>
                    </div>
                    <form id="schemeForm">
                        <input type="hidden" id="schemeId" value="">
                        <div class="form-group">
                            <label>Scheme Name *</label>
                            <input type="text" id="schemeName" required placeholder="Enter scheme name">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="schemeStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('scheme')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Scheme</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Production Outlet Modal -->
            <div id="outletModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="outletModalTitle">Add Outlet</div>
                        <button class="modal-close" onclick="closeModal('outlet')">&times;</button>
                    </div>
                    <form id="outletForm">
                        <input type="hidden" id="outletId" value="">
                        <div class="form-group">
                            <label>Outlet Name *</label>
                            <input type="text" id="outletName" required placeholder="Enter outlet name">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="outletStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('outlet')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Outlet</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Production Location Modal -->
            <div id="locationModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="locationModalTitle">Add Location</div>
                        <button class="modal-close" onclick="closeModal('location')">&times;</button>
                    </div>
                    <form id="locationForm">
                        <input type="hidden" id="locationId" value="">
                        <div class="form-group">
                            <label>Outlet Scheme *</label>
                            <select id="locationScheme" required>
                                <option value="">Select Scheme...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Location Name *</label>
                            <input type="text" id="locationName" required placeholder="Enter location name">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="locationStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('location')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Location</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Production Category Modal -->
            <div id="prodcategoryModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="prodcategoryModalTitle">Add Category</div>
                        <button class="modal-close" onclick="closeModal('prodcategory')">&times;</button>
                    </div>
                    <form id="prodcategoryForm">
                        <input type="hidden" id="prodcategoryId" value="">
                        <div class="form-group">
                            <label>Category Name *</label>
                            <input type="text" id="prodcategoryName" required placeholder="Enter category name">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="prodcategoryStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('prodcategory')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Category</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Third Party Modal -->
            <div id="thirdpartyModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="thirdpartyModalTitle">Add Third Party</div>
                        <button class="modal-close" onclick="closeModal('thirdparty')">&times;</button>
                    </div>
                    <form id="thirdpartyForm">
                        <input type="hidden" id="thirdpartyId" value="">
                        <div class="form-group">
                            <label>Third Party Name *</label>
                            <input type="text" id="thirdpartyName" required placeholder="Enter third party name">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="thirdpartyStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('thirdparty')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Third Party</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Shift Modal -->
            <div id="shiftModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="shiftModalTitle">Add Shift</div>
                        <button class="modal-close" onclick="closeModal('shift')">&times;</button>
                    </div>
                    <form id="shiftForm">
                        <input type="hidden" id="shiftId" value="">
                        <div class="form-group">
                            <label>Shift Name *</label>
                            <input type="text" id="shiftName" required placeholder="e.g., Morning, Afternoon, Night">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="shiftStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('shift')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Shift</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Unit Cost Modal -->
            <div id="unitcostModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title" id="unitcostModalTitle">Add Unit Cost</div>
                        <button class="modal-close" onclick="closeModal('unitcost')">&times;</button>
                    </div>
                    <form id="unitcostForm">
                        <input type="hidden" id="unitcostId" value="">
                        <div class="form-group">
                            <label>Category *</label>
                            <select id="unitcostCategory" required>
                                <option value="">Select Category...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Third Party *</label>
                            <select id="unitcostThirdParty" required>
                                <option value="">Select Third Party...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Shift *</label>
                            <select id="unitcostShift" required>
                                <option value="">Select Shift...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Cost Value ($) *</label>
                            <input type="number" id="unitcostValue" step="0.01" min="0" required placeholder="e.g., 15.50">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="unitcostStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('unitcost')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Unit Cost</button>
                        </div>
                    </form>
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
            
            <!-- Approval Rule Modal -->
            <div id="approvalruleModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <div class="modal-title" id="approvalruleModalTitle">Add Approval Rule</div>
                        <button class="modal-close" onclick="closeModal('approvalrule')" style="color: white;">&times;</button>
                    </div>
                    <form id="approvalruleForm">
                        <input type="hidden" id="approvalruleId" value="">
                        <div class="form-group">
                            <label>Rule Name *</label>
                            <input type="text" id="approvalruleName" required placeholder="e.g., Skip AM for Happy Categories">
                        </div>
                        <div class="form-group">
                            <label>Module *</label>
                            <select id="approvalruleModule" required>
                                <option value="">Select Module...</option>
                                <option value="ExtraCleaning">Extra Cleaning</option>
                                <option value="Production">Production Extras</option>
                            </select>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <label style="font-weight: 600; color: #333; margin-bottom: 10px; display: block;">Condition (When this matches...)</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <select id="approvalruleField" required>
                                    <option value="">Field...</option>
                                    <option value="Category">Category</option>
                                    <option value="ThirdParty">Third Party</option>
                                    <option value="NumberOfAgents">Number of Agents</option>
                                    <option value="Store">Store</option>
                                </select>
                                <select id="approvalruleOperator" required>
                                    <option value="">Operator...</option>
                                    <option value="equals">Equals</option>
                                    <option value="contains">Contains</option>
                                    <option value="greater_than">Greater Than</option>
                                    <option value="less_than">Less Than</option>
                                </select>
                                <input type="text" id="approvalruleValue" required placeholder="Value...">
                            </div>
                        </div>
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <label style="font-weight: 600; color: #333; margin-bottom: 10px; display: block;">Action (Do this...)</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <select id="approvalruleAction" required>
                                    <option value="">Action Type...</option>
                                    <option value="skip">SKIP Approver</option>
                                    <option value="add">ADD Approver</option>
                                </select>
                                <select id="approvalruleTarget" required>
                                    <option value="">Target Approver...</option>
                                    <option value="AreaManager">Area Manager</option>
                                    <option value="HeadOfOperations">Head of Operations</option>
                                    <option value="HR">HR Manager</option>
                                    <option value="Approver1">Approver 1</option>
                                    <option value="Approver2">Approver 2</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Priority (lower = higher priority)</label>
                            <input type="number" id="approvalrulePriority" value="0" min="0">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="approvalruleStatus">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('approvalrule')">Cancel</button>
                            <button type="submit" class="btn btn-success">Save Rule</button>
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
                loadSchemes();
                loadOutlets();
                loadLocations();
                loadProdCategories();
                loadThirdParties();
                loadShifts();
                loadUnitCosts();
                
                // Modal functions
                function openModal(type) {
                    document.getElementById(type + 'Id').value = '';
                    document.getElementById(type + 'Form').reset();
                    document.getElementById(type + 'ModalTitle').textContent = 'Add ' + type.charAt(0).toUpperCase() + type.slice(1);
                    
                    // Populate category dropdown when opening provider modal
                    if (type === 'provider') {
                        populateProviderCategoryDropdown();
                    }
                    
                    // Populate scheme dropdown when opening location modal
                    if (type === 'location') {
                        populateLocationSchemeDropdown();
                    }
                    
                    // Populate dropdowns when opening unit cost modal
                    if (type === 'unitcost') {
                        populateUnitCostDropdowns();
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
                            else if (deleteType === 'scheme') await loadSchemes();
                            else if (deleteType === 'outlet') await loadOutlets();
                            else if (deleteType === 'location') await loadLocations();
                            else if (deleteType === 'prodcategory') await loadProdCategories();
                            else if (deleteType === 'thirdparty') await loadThirdParties();
                            else if (deleteType === 'shift') await loadShifts();
                            else if (deleteType === 'unitcost') await loadUnitCosts();
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
                
                // ========== PRODUCTION OUTLET SCHEMES ==========
                async function loadSchemes() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/schemes');
                        const schemes = await res.json();
                        renderSchemesTable(schemes);
                    } catch (err) {
                        console.error('Error loading schemes:', err);
                    }
                }
                
                function renderSchemesTable(schemes) {
                    const container = document.getElementById('schemes-table');
                    if (!container) return;
                    
                    if (schemes.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No outlet schemes found. Click "Add Scheme" to create one.</div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table>
                            <thead>
                                <tr>
                                    <th>Scheme Name</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${schemes.map(s => \`
                                    <tr>
                                        <td>\${s.SchemeName}</td>
                                        <td><span class="status-badge \${s.IsActive ? 'active' : 'inactive'}">\${s.IsActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>\${new Date(s.CreatedDate).toLocaleDateString()}</td>
                                        <td class="actions">
                                            <button class="btn-icon edit" onclick="editScheme(\${s.Id}, '\${escapeJS(s.SchemeName)}', \${s.IsActive})" title="Edit">✏️</button>
                                            <button class="btn-icon delete" onclick="confirmDelete('scheme', \${s.Id}, '\${escapeJS(s.SchemeName)}')" title="Delete">🗑️</button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function editScheme(id, name, isActive) {
                    document.getElementById('schemeId').value = id;
                    document.getElementById('schemeName').value = name;
                    document.getElementById('schemeStatus').value = isActive ? '1' : '0';
                    document.getElementById('schemeModalTitle').textContent = 'Edit Outlet Scheme';
                    document.getElementById('schemeModal').classList.add('show');
                }
                
                document.getElementById('schemeForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('schemeId').value;
                    const data = {
                        schemeName: document.getElementById('schemeName').value,
                        isActive: document.getElementById('schemeStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/schemes/' + id : '/operational-excellence/system-settings/api/schemes';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('scheme');
                            showToast(id ? 'Outlet scheme updated!' : 'Outlet scheme added!');
                            await loadSchemes();
                            await loadLocations(); // Refresh to update dropdowns
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving scheme', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving scheme:', err);
                        showToast('Error saving scheme', 'error');
                    }
                });
                
                // ========== PRODUCTION OUTLETS ==========
                async function loadOutlets() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/outlets');
                        const outlets = await res.json();
                        renderOutletsTable(outlets);
                    } catch (err) {
                        console.error('Error loading outlets:', err);
                    }
                }
                
                function renderOutletsTable(outlets) {
                    const container = document.getElementById('outlets-table');
                    if (!container) return;
                    
                    if (outlets.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No outlets found. Click "Add Outlet" to create one.</div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table>
                            <thead>
                                <tr>
                                    <th>Outlet Name</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${outlets.map(o => \`
                                    <tr>
                                        <td>\${o.OutletName}</td>
                                        <td><span class="status-badge \${o.IsActive ? 'active' : 'inactive'}">\${o.IsActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>\${new Date(o.CreatedDate).toLocaleDateString()}</td>
                                        <td class="actions">
                                            <button class="btn-icon edit" onclick="editOutlet(\${o.Id}, '\${escapeJS(o.OutletName)}', \${o.IsActive})" title="Edit">✏️</button>
                                            <button class="btn-icon delete" onclick="confirmDelete('outlet', \${o.Id}, '\${escapeJS(o.OutletName)}')" title="Delete">🗑️</button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function editOutlet(id, name, isActive) {
                    document.getElementById('outletId').value = id;
                    document.getElementById('outletName').value = name;
                    document.getElementById('outletStatus').value = isActive ? '1' : '0';
                    document.getElementById('outletModalTitle').textContent = 'Edit Outlet';
                    document.getElementById('outletModal').classList.add('show');
                }
                
                document.getElementById('outletForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('outletId').value;
                    const data = {
                        outletName: document.getElementById('outletName').value,
                        isActive: document.getElementById('outletStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/outlets/' + id : '/operational-excellence/system-settings/api/outlets';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('outlet');
                            showToast(id ? 'Outlet updated!' : 'Outlet added!');
                            await loadOutlets();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving outlet', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving outlet:', err);
                        showToast('Error saving outlet', 'error');
                    }
                });
                
                // ========== PRODUCTION LOCATIONS ==========
                async function loadLocations() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/locations');
                        const locations = await res.json();
                        renderLocationsTable(locations);
                    } catch (err) {
                        console.error('Error loading locations:', err);
                    }
                }
                
                function renderLocationsTable(locations) {
                    const container = document.getElementById('locations-table');
                    if (!container) return;
                    
                    if (locations.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No locations found. Click "Add Location" to create one.</div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table>
                            <thead>
                                <tr>
                                    <th>Location Name</th>
                                    <th>Outlet Scheme</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${locations.map(l => \`
                                    <tr>
                                        <td>\${l.LocationName}</td>
                                        <td>\${l.SchemeName || 'N/A'}</td>
                                        <td><span class="status-badge \${l.IsActive ? 'active' : 'inactive'}">\${l.IsActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>\${new Date(l.CreatedDate).toLocaleDateString()}</td>
                                        <td class="actions">
                                            <button class="btn-icon edit" onclick="editLocation(\${l.Id}, '\${escapeJS(l.LocationName)}', \${l.SchemeId || 'null'}, \${l.IsActive})" title="Edit">✏️</button>
                                            <button class="btn-icon delete" onclick="confirmDelete('location', \${l.Id}, '\${escapeJS(l.LocationName)}')" title="Delete">🗑️</button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function editLocation(id, name, schemeId, isActive) {
                    document.getElementById('locationId').value = id;
                    document.getElementById('locationName').value = name;
                    document.getElementById('locationScheme').value = schemeId || '';
                    document.getElementById('locationStatus').value = isActive ? '1' : '0';
                    document.getElementById('locationModalTitle').textContent = 'Edit Location';
                    populateLocationSchemeDropdown().then(() => {
                        document.getElementById('locationScheme').value = schemeId || '';
                    });
                    document.getElementById('locationModal').classList.add('show');
                }
                
                async function populateLocationSchemeDropdown() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/schemes');
                        const schemes = await res.json();
                        const select = document.getElementById('locationScheme');
                        select.innerHTML = '<option value="">-- Select Outlet Scheme --</option>' + 
                            schemes.filter(s => s.IsActive).map(s => \`<option value="\${s.Id}">\${s.SchemeName}</option>\`).join('');
                    } catch (err) {
                        console.error('Error loading schemes for dropdown:', err);
                    }
                }
                
                document.getElementById('locationForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('locationId').value;
                    const data = {
                        locationName: document.getElementById('locationName').value,
                        schemeId: document.getElementById('locationScheme').value || null,
                        isActive: document.getElementById('locationStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/locations/' + id : '/operational-excellence/system-settings/api/locations';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('location');
                            showToast(id ? 'Location updated!' : 'Location added!');
                            await loadLocations();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving location', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving location:', err);
                        showToast('Error saving location', 'error');
                    }
                });
                
                // ========== PRODUCTION CATEGORIES ==========
                async function loadProdCategories() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/prodcategorys');
                        const categories = await res.json();
                        renderProdCategoriesTable(categories);
                    } catch (err) {
                        console.error('Error loading production categories:', err);
                    }
                }
                
                function renderProdCategoriesTable(categories) {
                    const container = document.getElementById('prodcategories-table');
                    if (!container) return;
                    
                    if (categories.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No categories found. Click "Add Category" to create one.</div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table>
                            <thead>
                                <tr>
                                    <th>Category Name</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${categories.map(c => \`
                                    <tr>
                                        <td>\${c.CategoryName}</td>
                                        <td><span class="status-badge \${c.IsActive ? 'active' : 'inactive'}">\${c.IsActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>\${new Date(c.CreatedDate).toLocaleDateString()}</td>
                                        <td class="actions">
                                            <button class="btn-icon edit" onclick="editProdCategory(\${c.Id}, '\${escapeJS(c.CategoryName)}', \${c.IsActive})" title="Edit">✏️</button>
                                            <button class="btn-icon delete" onclick="confirmDelete('prodcategory', \${c.Id}, '\${escapeJS(c.CategoryName)}')" title="Delete">🗑️</button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function editProdCategory(id, name, isActive) {
                    document.getElementById('prodcategoryId').value = id;
                    document.getElementById('prodcategoryName').value = name;
                    document.getElementById('prodcategoryStatus').value = isActive ? '1' : '0';
                    document.getElementById('prodcategoryModalTitle').textContent = 'Edit Category';
                    document.getElementById('prodcategoryModal').classList.add('show');
                }
                
                document.getElementById('prodcategoryForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('prodcategoryId').value;
                    const data = {
                        categoryName: document.getElementById('prodcategoryName').value,
                        isActive: document.getElementById('prodcategoryStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/prodcategorys/' + id : '/operational-excellence/system-settings/api/prodcategorys';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('prodcategory');
                            showToast(id ? 'Category updated!' : 'Category added!');
                            await loadProdCategories();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving category', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving category:', err);
                        showToast('Error saving category', 'error');
                    }
                });
                
                // ========== THIRD PARTIES ==========
                async function loadThirdParties() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/thirdpartys');
                        const parties = await res.json();
                        renderThirdPartiesTable(parties);
                    } catch (err) {
                        console.error('Error loading third parties:', err);
                    }
                }
                
                function renderThirdPartiesTable(parties) {
                    const container = document.getElementById('thirdparties-table');
                    if (!container) return;
                    
                    if (parties.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No third parties found. Click "Add Third Party" to create one.</div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table>
                            <thead>
                                <tr>
                                    <th>Third Party Name</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${parties.map(p => \`
                                    <tr>
                                        <td>\${p.ThirdPartyName}</td>
                                        <td><span class="status-badge \${p.IsActive ? 'active' : 'inactive'}">\${p.IsActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>\${new Date(p.CreatedDate).toLocaleDateString()}</td>
                                        <td class="actions">
                                            <button class="btn-icon edit" onclick="editThirdParty(\${p.Id}, '\${escapeJS(p.ThirdPartyName)}', \${p.IsActive})" title="Edit">✏️</button>
                                            <button class="btn-icon delete" onclick="confirmDelete('thirdparty', \${p.Id}, '\${escapeJS(p.ThirdPartyName)}')" title="Delete">🗑️</button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function editThirdParty(id, name, isActive) {
                    document.getElementById('thirdpartyId').value = id;
                    document.getElementById('thirdpartyName').value = name;
                    document.getElementById('thirdpartyStatus').value = isActive ? '1' : '0';
                    document.getElementById('thirdpartyModalTitle').textContent = 'Edit Third Party';
                    document.getElementById('thirdpartyModal').classList.add('show');
                }
                
                document.getElementById('thirdpartyForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('thirdpartyId').value;
                    const data = {
                        thirdPartyName: document.getElementById('thirdpartyName').value,
                        isActive: document.getElementById('thirdpartyStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/thirdpartys/' + id : '/operational-excellence/system-settings/api/thirdpartys';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('thirdparty');
                            showToast(id ? 'Third party updated!' : 'Third party added!');
                            await loadThirdParties();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving third party', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving third party:', err);
                        showToast('Error saving third party', 'error');
                    }
                });
                
                // ========== SHIFTS ==========
                async function loadShifts() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/shifts');
                        const shifts = await res.json();
                        renderShiftsTable(shifts);
                    } catch (err) {
                        console.error('Error loading shifts:', err);
                    }
                }
                
                function renderShiftsTable(shifts) {
                    const container = document.getElementById('shifts-table');
                    if (!container) return;
                    
                    if (shifts.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No shifts found. Click "Add Shift" to create one.</div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table>
                            <thead>
                                <tr>
                                    <th>Shift Name</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${shifts.map(s => \`
                                    <tr>
                                        <td>\${s.ShiftName}</td>
                                        <td><span class="status-badge \${s.IsActive ? 'active' : 'inactive'}">\${s.IsActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>\${new Date(s.CreatedDate).toLocaleDateString()}</td>
                                        <td class="actions">
                                            <button class="btn-icon edit" onclick="editShift(\${s.Id}, '\${escapeJS(s.ShiftName)}', \${s.IsActive})" title="Edit">✏️</button>
                                            <button class="btn-icon delete" onclick="confirmDelete('shift', \${s.Id}, '\${escapeJS(s.ShiftName)}')" title="Delete">🗑️</button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function editShift(id, name, isActive) {
                    document.getElementById('shiftId').value = id;
                    document.getElementById('shiftName').value = name;
                    document.getElementById('shiftStatus').value = isActive ? '1' : '0';
                    document.getElementById('shiftModalTitle').textContent = 'Edit Shift';
                    document.getElementById('shiftModal').classList.add('show');
                }
                
                document.getElementById('shiftForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('shiftId').value;
                    const data = {
                        shiftName: document.getElementById('shiftName').value,
                        isActive: document.getElementById('shiftStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/shifts/' + id : '/operational-excellence/system-settings/api/shifts';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('shift');
                            showToast(id ? 'Shift updated!' : 'Shift added!');
                            await loadShifts();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving shift', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving shift:', err);
                        showToast('Error saving shift', 'error');
                    }
                });
                
                // ========== UNIT COSTS ==========
                let unitCostsData = [];
                let prodCategoriesForCost = [];
                let thirdPartiesForCost = [];
                let shiftsForCost = [];
                
                async function loadUnitCosts() {
                    try {
                        // Load unit costs and also refresh dropdown data
                        const [costsRes, categoriesRes, partiesRes, shiftsRes] = await Promise.all([
                            fetch('/operational-excellence/system-settings/api/unitcosts'),
                            fetch('/operational-excellence/system-settings/api/prodcategorys'),
                            fetch('/operational-excellence/system-settings/api/thirdpartys'),
                            fetch('/operational-excellence/system-settings/api/shifts')
                        ]);
                        unitCostsData = await costsRes.json();
                        prodCategoriesForCost = await categoriesRes.json();
                        thirdPartiesForCost = await partiesRes.json();
                        shiftsForCost = await shiftsRes.json();
                        renderUnitCostsTable(unitCostsData);
                    } catch (err) {
                        console.error('Error loading unit costs:', err);
                    }
                }
                
                function renderUnitCostsTable(costs) {
                    const container = document.getElementById('unitcosts-table');
                    if (!container) return;
                    
                    if (costs.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No unit costs found. Click "Add Unit Cost" to create one.</div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table>
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Third Party</th>
                                    <th>Shift</th>
                                    <th>Cost ($)</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${costs.map(c => \`
                                    <tr>
                                        <td>\${c.CategoryName || '-'}</td>
                                        <td>\${c.ThirdPartyName || '-'}</td>
                                        <td>\${c.ShiftName || '-'}</td>
                                        <td>$\${c.CostValue ? parseFloat(c.CostValue).toFixed(2) : '0.00'}</td>
                                        <td><span class="status-badge \${c.IsActive ? 'active' : 'inactive'}">\${c.IsActive ? 'Active' : 'Inactive'}</span></td>
                                        <td class="actions">
                                            <button class="btn-icon edit" onclick="editUnitCost(\${c.Id}, \${c.CategoryId}, \${c.ThirdPartyId}, \${c.ShiftId}, \${c.CostValue || 0}, \${c.IsActive})" title="Edit">✏️</button>
                                            <button class="btn-icon delete" onclick="confirmDelete('unitcost', \${c.Id}, 'this unit cost')" title="Delete">🗑️</button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function populateUnitCostDropdowns() {
                    // Fetch fresh data for dropdowns
                    Promise.all([
                        fetch('/operational-excellence/system-settings/api/prodcategorys'),
                        fetch('/operational-excellence/system-settings/api/thirdpartys'),
                        fetch('/operational-excellence/system-settings/api/shifts')
                    ]).then(async ([categoriesRes, partiesRes, shiftsRes]) => {
                        const categories = await categoriesRes.json();
                        const parties = await partiesRes.json();
                        const shifts = await shiftsRes.json();
                        
                        // Update cached data
                        prodCategoriesForCost = categories;
                        thirdPartiesForCost = parties;
                        shiftsForCost = shifts;
                        
                        // Populate Category dropdown
                        const categorySelect = document.getElementById('unitcostCategory');
                        categorySelect.innerHTML = '<option value="">Select Category...</option>';
                        categories.filter(c => c.IsActive).forEach(c => {
                            categorySelect.innerHTML += '<option value="' + c.Id + '">' + c.CategoryName + '</option>';
                        });
                        
                        // Populate Third Party dropdown
                        const thirdPartySelect = document.getElementById('unitcostThirdParty');
                        thirdPartySelect.innerHTML = '<option value="">Select Third Party...</option>';
                        parties.filter(t => t.IsActive).forEach(t => {
                            thirdPartySelect.innerHTML += '<option value="' + t.Id + '">' + t.ThirdPartyName + '</option>';
                        });
                        
                        // Populate Shift dropdown
                        const shiftSelect = document.getElementById('unitcostShift');
                        shiftSelect.innerHTML = '<option value="">Select Shift...</option>';
                        shifts.filter(s => s.IsActive).forEach(s => {
                            shiftSelect.innerHTML += '<option value="' + s.Id + '">' + s.ShiftName + '</option>';
                        });
                    }).catch(err => {
                        console.error('Error populating unit cost dropdowns:', err);
                        showToast('Error loading dropdown data', 'error');
                    });
                }
                
                function editUnitCost(id, categoryId, thirdPartyId, shiftId, value, isActive) {
                    // First set the form values
                    document.getElementById('unitcostId').value = id;
                    document.getElementById('unitcostValue').value = value;
                    document.getElementById('unitcostStatus').value = isActive ? '1' : '0';
                    document.getElementById('unitcostModalTitle').textContent = 'Edit Unit Cost';
                    document.getElementById('unitcostModal').classList.add('show');
                    
                    // Then populate dropdowns and set selected values
                    Promise.all([
                        fetch('/operational-excellence/system-settings/api/prodcategorys'),
                        fetch('/operational-excellence/system-settings/api/thirdpartys'),
                        fetch('/operational-excellence/system-settings/api/shifts')
                    ]).then(async ([categoriesRes, partiesRes, shiftsRes]) => {
                        const categories = await categoriesRes.json();
                        const parties = await partiesRes.json();
                        const shifts = await shiftsRes.json();
                        
                        // Populate Category dropdown
                        const categorySelect = document.getElementById('unitcostCategory');
                        categorySelect.innerHTML = '<option value="">Select Category...</option>';
                        categories.filter(c => c.IsActive).forEach(c => {
                            categorySelect.innerHTML += '<option value="' + c.Id + '">' + c.CategoryName + '</option>';
                        });
                        categorySelect.value = categoryId;
                        
                        // Populate Third Party dropdown
                        const thirdPartySelect = document.getElementById('unitcostThirdParty');
                        thirdPartySelect.innerHTML = '<option value="">Select Third Party...</option>';
                        parties.filter(t => t.IsActive).forEach(t => {
                            thirdPartySelect.innerHTML += '<option value="' + t.Id + '">' + t.ThirdPartyName + '</option>';
                        });
                        thirdPartySelect.value = thirdPartyId;
                        
                        // Populate Shift dropdown
                        const shiftSelect = document.getElementById('unitcostShift');
                        shiftSelect.innerHTML = '<option value="">Select Shift...</option>';
                        shifts.filter(s => s.IsActive).forEach(s => {
                            shiftSelect.innerHTML += '<option value="' + s.Id + '">' + s.ShiftName + '</option>';
                        });
                        shiftSelect.value = shiftId;
                    }).catch(err => {
                        console.error('Error populating unit cost dropdowns:', err);
                    });
                }
                
                document.getElementById('unitcostForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('unitcostId').value;
                    const data = {
                        categoryId: parseInt(document.getElementById('unitcostCategory').value),
                        thirdPartyId: parseInt(document.getElementById('unitcostThirdParty').value),
                        shiftId: parseInt(document.getElementById('unitcostShift').value),
                        costValue: parseFloat(document.getElementById('unitcostValue').value) || 0,
                        isActive: document.getElementById('unitcostStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/unitcosts/' + id : '/operational-excellence/system-settings/api/unitcosts';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('unitcost');
                            showToast(id ? 'Unit cost updated!' : 'Unit cost added!');
                            await loadUnitCosts();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving unit cost', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving unit cost:', err);
                        showToast('Error saving unit cost', 'error');
                    }
                });
                
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
                
                // ========== APPROVAL SETTINGS & RULES ==========
                let approvalSettingsData = [];
                let approvalRulesData = [];
                
                // Load approval settings on page load
                loadApprovalSettings();
                loadApprovalRules();
                
                async function loadApprovalSettings() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/approval-settings?t=' + Date.now());
                        approvalSettingsData = await res.json();
                        
                        // Populate the email inputs
                        approvalSettingsData.forEach(setting => {
                            const inputId = 'approval_' + setting.SettingKey;
                            const input = document.getElementById(inputId);
                            if (input) {
                                input.value = setting.SettingValue || '';
                            }
                        });
                    } catch (err) {
                        console.error('Error loading approval settings:', err);
                        showToast('Error loading approval settings', 'error');
                    }
                }
                
                async function saveApprovalSettings() {
                    const settings = [
                        { key: 'AREA_MANAGER_EMAIL', value: document.getElementById('approval_AREA_MANAGER_EMAIL')?.value || '' },
                        { key: 'HEAD_OF_OPERATIONS_EMAIL', value: document.getElementById('approval_HEAD_OF_OPERATIONS_EMAIL')?.value || '' },
                        { key: 'HR_MANAGER_EMAIL', value: document.getElementById('approval_HR_MANAGER_EMAIL')?.value || '' },
                        { key: 'DEFAULT_APPROVER_1_EMAIL', value: document.getElementById('approval_DEFAULT_APPROVER_1_EMAIL')?.value || '' },
                        { key: 'DEFAULT_APPROVER_2_EMAIL', value: document.getElementById('approval_DEFAULT_APPROVER_2_EMAIL')?.value || '' },
                        { key: 'HR_APPROVER_EMAIL', value: document.getElementById('approval_HR_APPROVER_EMAIL')?.value || '' }
                    ];
                    
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/approval-settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ settings })
                        });
                        
                        if (res.ok) {
                            showToast('Approval settings saved!');
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving approval settings', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving approval settings:', err);
                        showToast('Error saving approval settings', 'error');
                    }
                }
                
                async function loadApprovalRules() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/approval-rules?t=' + Date.now());
                        approvalRulesData = await res.json();
                        renderApprovalRulesTable(approvalRulesData);
                    } catch (err) {
                        console.error('Error loading approval rules:', err);
                        document.getElementById('approvalrules-table').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Error loading approval rules</p></div>';
                    }
                }
                
                function renderApprovalRulesTable(rules) {
                    if (!rules.length) {
                        document.getElementById('approvalrules-table').innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No approval rules configured. Add your first rule!</p></div>';
                        return;
                    }
                    
                    let html = '<table class="data-table"><thead><tr><th>Priority</th><th>Rule Name</th><th>Module</th><th>Condition</th><th>Action</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
                    rules.forEach(r => {
                        const operatorText = r.TriggerOperator === 'equals' ? '=' : (r.TriggerOperator === 'contains' ? 'contains' : r.TriggerOperator);
                        const actionText = r.ActionType === 'skip' ? 'SKIP' : 'ADD';
                        const actionClass = r.ActionType === 'skip' ? 'background: #fff3cd; color: #856404;' : 'background: #d4edda; color: #155724;';
                        
                        html += '<tr>';
                        html += '<td><span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">' + r.Priority + '</span></td>';
                        html += '<td><strong>' + r.RuleName + '</strong></td>';
                        html += '<td>' + r.Module + '</td>';
                        html += '<td><code style="background: #f1f3f4; padding: 2px 6px; border-radius: 4px;">' + r.TriggerField + ' ' + operatorText + ' "' + r.TriggerValue + '"</code></td>';
                        html += '<td><span style="' + actionClass + ' padding: 2px 8px; border-radius: 4px; font-weight: 600;">' + actionText + '</span> ' + r.TargetApprover + '</td>';
                        html += '<td><span class="status-badge ' + (r.IsActive ? 'status-active' : 'status-inactive') + '">' + (r.IsActive ? 'Active' : 'Inactive') + '</span></td>';
                        html += '<td class="actions">';
                        html += '<button class="btn btn-primary btn-sm" onclick="editApprovalRule(' + r.Id + ')">Edit</button>';
                        html += '<button class="btn btn-danger btn-sm" onclick="deleteApprovalRule(' + r.Id + ')">Delete</button>';
                        html += '</td></tr>';
                    });
                    html += '</tbody></table>';
                    document.getElementById('approvalrules-table').innerHTML = html;
                }
                
                function editApprovalRule(id) {
                    const rule = approvalRulesData.find(r => r.Id === id);
                    if (!rule) return;
                    
                    document.getElementById('approvalruleId').value = rule.Id;
                    document.getElementById('approvalruleName').value = rule.RuleName;
                    document.getElementById('approvalruleModule').value = rule.Module;
                    document.getElementById('approvalruleField').value = rule.TriggerField;
                    document.getElementById('approvalruleOperator').value = rule.TriggerOperator;
                    document.getElementById('approvalruleValue').value = rule.TriggerValue;
                    document.getElementById('approvalruleAction').value = rule.ActionType;
                    document.getElementById('approvalruleTarget').value = rule.TargetApprover;
                    document.getElementById('approvalrulePriority').value = rule.Priority;
                    document.getElementById('approvalruleStatus').value = rule.IsActive ? '1' : '0';
                    document.getElementById('approvalruleModalTitle').textContent = 'Edit Approval Rule';
                    document.getElementById('approvalruleModal').classList.add('show');
                }
                
                async function deleteApprovalRule(id) {
                    if (!confirm('Are you sure you want to delete this approval rule?')) return;
                    
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/approval-rules/' + id, {
                            method: 'DELETE'
                        });
                        
                        if (res.ok) {
                            showToast('Approval rule deleted!');
                            await loadApprovalRules();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error deleting approval rule', 'error');
                        }
                    } catch (err) {
                        console.error('Error deleting approval rule:', err);
                        showToast('Error deleting approval rule', 'error');
                    }
                }
                
                document.getElementById('approvalruleForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('approvalruleId').value;
                    const data = {
                        ruleName: document.getElementById('approvalruleName').value,
                        module: document.getElementById('approvalruleModule').value,
                        triggerField: document.getElementById('approvalruleField').value,
                        triggerOperator: document.getElementById('approvalruleOperator').value,
                        triggerValue: document.getElementById('approvalruleValue').value,
                        actionType: document.getElementById('approvalruleAction').value,
                        targetApprover: document.getElementById('approvalruleTarget').value,
                        priority: parseInt(document.getElementById('approvalrulePriority').value) || 0,
                        isActive: document.getElementById('approvalruleStatus').value === '1'
                    };
                    
                    try {
                        const url = id ? '/operational-excellence/system-settings/api/approval-rules/' + id : '/operational-excellence/system-settings/api/approval-rules';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            closeModal('approvalrule');
                            showToast(id ? 'Approval rule updated!' : 'Approval rule added!');
                            await loadApprovalRules();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Error saving approval rule', 'error');
                        }
                    } catch (err) {
                        console.error('Error saving approval rule:', err);
                        showToast('Error saving approval rule', 'error');
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

// ========== PRODUCTION OUTLET SCHEMES API ==========
router.get('/api/schemes', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query('SELECT * FROM ProductionOutletSchemes ORDER BY SchemeName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading schemes:', err);
        res.status(500).json({ error: 'Failed to load schemes' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.post('/api/schemes', async (req, res) => {
    let pool;
    try {
        const { schemeName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('schemeName', sql.NVarChar, schemeName)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ProductionOutletSchemes (SchemeName, IsActive, CreatedDate, CreatedBy) 
                    VALUES (@schemeName, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding scheme:', err);
        res.status(500).json({ error: 'Failed to add scheme' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.put('/api/schemes/:id', async (req, res) => {
    let pool;
    try {
        const { schemeName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('schemeName', sql.NVarChar, schemeName)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ProductionOutletSchemes SET SchemeName = @schemeName, IsActive = @isActive WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating scheme:', err);
        res.status(500).json({ error: 'Failed to update scheme' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.delete('/api/schemes/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ProductionOutletSchemes WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting scheme:', err);
        res.status(500).json({ error: 'Failed to delete scheme' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

// ========== PRODUCTION OUTLETS API ==========
router.get('/api/outlets', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query('SELECT * FROM ProductionOutlets ORDER BY OutletName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading outlets:', err);
        res.status(500).json({ error: 'Failed to load outlets' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.post('/api/outlets', async (req, res) => {
    let pool;
    try {
        const { outletName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('outletName', sql.NVarChar, outletName)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ProductionOutlets (OutletName, IsActive, CreatedDate, CreatedBy) 
                    VALUES (@outletName, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding outlet:', err);
        res.status(500).json({ error: 'Failed to add outlet' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.put('/api/outlets/:id', async (req, res) => {
    let pool;
    try {
        const { outletName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('outletName', sql.NVarChar, outletName)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ProductionOutlets SET OutletName = @outletName, IsActive = @isActive WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating outlet:', err);
        res.status(500).json({ error: 'Failed to update outlet' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.delete('/api/outlets/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ProductionOutlets WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting outlet:', err);
        res.status(500).json({ error: 'Failed to delete outlet' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

// ========== PRODUCTION LOCATIONS API ==========
router.get('/api/locations', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT l.*, s.SchemeName 
                    FROM ProductionLocations l 
                    LEFT JOIN ProductionOutletSchemes s ON l.SchemeId = s.Id 
                    ORDER BY l.LocationName`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading locations:', err);
        res.status(500).json({ error: 'Failed to load locations' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.post('/api/locations', async (req, res) => {
    let pool;
    try {
        const { locationName, schemeId, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('locationName', sql.NVarChar, locationName)
            .input('schemeId', sql.Int, schemeId || null)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ProductionLocations (LocationName, SchemeId, IsActive, CreatedDate, CreatedBy) 
                    VALUES (@locationName, @schemeId, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding location:', err);
        res.status(500).json({ error: 'Failed to add location' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.put('/api/locations/:id', async (req, res) => {
    let pool;
    try {
        const { locationName, schemeId, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('locationName', sql.NVarChar, locationName)
            .input('schemeId', sql.Int, schemeId || null)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ProductionLocations SET LocationName = @locationName, SchemeId = @schemeId, IsActive = @isActive WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating location:', err);
        res.status(500).json({ error: 'Failed to update location' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.delete('/api/locations/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ProductionLocations WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting location:', err);
        res.status(500).json({ error: 'Failed to delete location' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

// ========== PRODUCTION CATEGORIES API ==========
router.get('/api/prodcategorys', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query('SELECT * FROM ProductionCategories ORDER BY CategoryName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading production categories:', err);
        res.status(500).json({ error: 'Failed to load categories' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.post('/api/prodcategorys', async (req, res) => {
    let pool;
    try {
        const { categoryName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('categoryName', sql.NVarChar, categoryName)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ProductionCategories (CategoryName, IsActive, CreatedDate, CreatedBy) 
                    VALUES (@categoryName, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).json({ error: 'Failed to add category' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.put('/api/prodcategorys/:id', async (req, res) => {
    let pool;
    try {
        const { categoryName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('categoryName', sql.NVarChar, categoryName)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ProductionCategories SET CategoryName = @categoryName, IsActive = @isActive WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ error: 'Failed to update category' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.delete('/api/prodcategorys/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ProductionCategories WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ error: 'Failed to delete category' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

// ========== THIRD PARTIES API ==========
router.get('/api/thirdpartys', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query('SELECT * FROM ProductionThirdParties ORDER BY ThirdPartyName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading third parties:', err);
        res.status(500).json({ error: 'Failed to load third parties' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.post('/api/thirdpartys', async (req, res) => {
    let pool;
    try {
        const { thirdPartyName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('thirdPartyName', sql.NVarChar, thirdPartyName)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ProductionThirdParties (ThirdPartyName, IsActive, CreatedDate, CreatedBy) 
                    VALUES (@thirdPartyName, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding third party:', err);
        res.status(500).json({ error: 'Failed to add third party' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.put('/api/thirdpartys/:id', async (req, res) => {
    let pool;
    try {
        const { thirdPartyName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('thirdPartyName', sql.NVarChar, thirdPartyName)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ProductionThirdParties SET ThirdPartyName = @thirdPartyName, IsActive = @isActive WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating third party:', err);
        res.status(500).json({ error: 'Failed to update third party' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.delete('/api/thirdpartys/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ProductionThirdParties WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting third party:', err);
        res.status(500).json({ error: 'Failed to delete third party' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

// ========== SHIFTS API ==========
router.get('/api/shifts', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query('SELECT * FROM ProductionShifts ORDER BY ShiftName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading shifts:', err);
        res.status(500).json({ error: 'Failed to load shifts' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.post('/api/shifts', async (req, res) => {
    let pool;
    try {
        const { shiftName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('shiftName', sql.NVarChar, shiftName)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ProductionShifts (ShiftName, IsActive, CreatedDate, CreatedBy) 
                    VALUES (@shiftName, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding shift:', err);
        res.status(500).json({ error: 'Failed to add shift' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.put('/api/shifts/:id', async (req, res) => {
    let pool;
    try {
        const { shiftName, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('shiftName', sql.NVarChar, shiftName)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ProductionShifts SET ShiftName = @shiftName, IsActive = @isActive WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating shift:', err);
        res.status(500).json({ error: 'Failed to update shift' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.delete('/api/shifts/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ProductionShifts WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting shift:', err);
        res.status(500).json({ error: 'Failed to delete shift' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

// ========== UNIT COSTS API ==========
router.get('/api/unitcosts', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT uc.*, 
                    c.CategoryName, 
                    t.ThirdPartyName, 
                    s.ShiftName
                    FROM ProductionUnitCosts uc
                    LEFT JOIN ProductionCategories c ON uc.CategoryId = c.Id
                    LEFT JOIN ProductionThirdParties t ON uc.ThirdPartyId = t.Id
                    LEFT JOIN ProductionShifts s ON uc.ShiftId = s.Id
                    ORDER BY c.CategoryName, t.ThirdPartyName, s.ShiftName`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading unit costs:', err);
        res.status(500).json({ error: 'Failed to load unit costs' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.post('/api/unitcosts', async (req, res) => {
    let pool;
    try {
        const { categoryId, thirdPartyId, shiftId, costValue, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('categoryId', sql.Int, categoryId)
            .input('thirdPartyId', sql.Int, thirdPartyId)
            .input('shiftId', sql.Int, shiftId)
            .input('costValue', sql.Decimal(10, 2), costValue)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ProductionUnitCosts (CategoryId, ThirdPartyId, ShiftId, CostValue, IsActive, CreatedDate, CreatedBy) 
                    VALUES (@categoryId, @thirdPartyId, @shiftId, @costValue, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding unit cost:', err);
        if (err.message && err.message.includes('UQ_UnitCosts_Combination')) {
            res.status(400).json({ error: 'This combination of Category, Third Party, and Shift already exists' });
        } else {
            res.status(500).json({ error: 'Failed to add unit cost' });
        }
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.put('/api/unitcosts/:id', async (req, res) => {
    let pool;
    try {
        const { categoryId, thirdPartyId, shiftId, costValue, isActive } = req.body;
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('categoryId', sql.Int, categoryId)
            .input('thirdPartyId', sql.Int, thirdPartyId)
            .input('shiftId', sql.Int, shiftId)
            .input('costValue', sql.Decimal(10, 2), costValue)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE ProductionUnitCosts SET CategoryId = @categoryId, ThirdPartyId = @thirdPartyId, ShiftId = @shiftId, CostValue = @costValue, IsActive = @isActive WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating unit cost:', err);
        if (err.message && err.message.includes('UQ_UnitCosts_Combination')) {
            res.status(400).json({ error: 'This combination of Category, Third Party, and Shift already exists' });
        } else {
            res.status(500).json({ error: 'Failed to update unit cost' });
        }
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

router.delete('/api/unitcosts/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ProductionUnitCosts WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting unit cost:', err);
        res.status(500).json({ error: 'Failed to delete unit cost' });
    } finally {
        if (pool) try { await pool.close(); } catch(e) {}
    }
});

// ========== APPROVAL SETTINGS API ==========
router.get('/api/approval-settings', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM ApprovalSettings ORDER BY Module, SettingKey');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading approval settings:', err);
        res.status(500).json({ error: 'Failed to load approval settings' });
    }
});

router.put('/api/approval-settings', async (req, res) => {
    try {
        const { settings } = req.body;
        const pool = await getPool();
        
        for (const setting of settings) {
            // Create a new request for each update
            const request = pool.request();
            await request
                .input('key', sql.NVarChar, setting.key)
                .input('value', sql.NVarChar, setting.value)
                .input('updatedBy', sql.NVarChar, req.session?.user?.name || 'System')
                .query(`UPDATE ApprovalSettings SET SettingValue = @value, UpdatedDate = GETDATE(), UpdatedBy = @updatedBy WHERE SettingKey = @key`);
        }
        
        console.log('Approval settings saved:', settings.map(s => s.key + '=' + s.value).join(', '));
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating approval settings:', err);
        res.status(500).json({ error: 'Failed to update approval settings' });
    }
});

// ========== APPROVAL RULES API ==========
router.get('/api/approval-rules', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM ApprovalRules ORDER BY Module, Priority, RuleName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading approval rules:', err);
        res.status(500).json({ error: 'Failed to load approval rules' });
    }
});

router.post('/api/approval-rules', async (req, res) => {
    try {
        const { ruleName, module, triggerField, triggerOperator, triggerValue, actionType, targetApprover, priority, isActive } = req.body;
        const pool = await getPool();
        await pool.request()
            .input('ruleName', sql.NVarChar, ruleName)
            .input('module', sql.NVarChar, module)
            .input('triggerField', sql.NVarChar, triggerField)
            .input('triggerOperator', sql.NVarChar, triggerOperator)
            .input('triggerValue', sql.NVarChar, triggerValue)
            .input('actionType', sql.NVarChar, actionType)
            .input('targetApprover', sql.NVarChar, targetApprover)
            .input('priority', sql.Int, priority)
            .input('isActive', sql.Bit, isActive)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'System')
            .query(`INSERT INTO ApprovalRules (RuleName, Module, TriggerField, TriggerOperator, TriggerValue, ActionType, TargetApprover, Priority, IsActive, CreatedDate, CreatedBy)
                    VALUES (@ruleName, @module, @triggerField, @triggerOperator, @triggerValue, @actionType, @targetApprover, @priority, @isActive, GETDATE(), @createdBy)`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding approval rule:', err);
        res.status(500).json({ error: 'Failed to add approval rule' });
    }
});

router.put('/api/approval-rules/:id', async (req, res) => {
    try {
        const { ruleName, module, triggerField, triggerOperator, triggerValue, actionType, targetApprover, priority, isActive } = req.body;
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('ruleName', sql.NVarChar, ruleName)
            .input('module', sql.NVarChar, module)
            .input('triggerField', sql.NVarChar, triggerField)
            .input('triggerOperator', sql.NVarChar, triggerOperator)
            .input('triggerValue', sql.NVarChar, triggerValue)
            .input('actionType', sql.NVarChar, actionType)
            .input('targetApprover', sql.NVarChar, targetApprover)
            .input('priority', sql.Int, priority)
            .input('isActive', sql.Bit, isActive)
            .query(`UPDATE ApprovalRules SET RuleName = @ruleName, Module = @module, TriggerField = @triggerField, TriggerOperator = @triggerOperator,
                    TriggerValue = @triggerValue, ActionType = @actionType, TargetApprover = @targetApprover, Priority = @priority, IsActive = @isActive
                    WHERE Id = @id`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating approval rule:', err);
        res.status(500).json({ error: 'Failed to update approval rule' });
    }
});

router.delete('/api/approval-rules/:id', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ApprovalRules WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting approval rule:', err);
        res.status(500).json({ error: 'Failed to delete approval rule' });
    }
});

module.exports = router;
