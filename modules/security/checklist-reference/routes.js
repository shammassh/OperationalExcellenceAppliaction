/**
 * Security Checklist Reference
 * Admin page to set up locations, subcategories, and checklist items
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

// Main Reference Page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    let pool;
    try {
        console.log('[Checklist Reference] Loading page...');
        pool = await sql.connect(dbConfig);
        console.log('[Checklist Reference] Connected to database');
        
        // Get all locations with subcategories and items
        const locationsResult = await pool.request()
            .query(`
                SELECT Id, LocationName, SortOrder, IsActive
                FROM Security_Checklist_Locations
                ORDER BY SortOrder, LocationName
            `);
        console.log('[Checklist Reference] Locations:', locationsResult.recordset.length);
        
        const subCategoriesResult = await pool.request()
            .query(`
                SELECT Id, LocationId, SubCategoryName, HasAMShift, HasPMShift, SortOrder, IsActive
                FROM Security_Checklist_SubCategories
                ORDER BY SortOrder, SubCategoryName
            `);
        console.log('[Checklist Reference] SubCategories:', subCategoriesResult.recordset.length);
        
        const itemsResult = await pool.request()
            .query(`
                SELECT Id, SubCategoryId, ItemName, ExpectedCount, SortOrder, IsActive
                FROM Security_Checklist_Items
                ORDER BY SortOrder, ItemName
            `);
        console.log('[Checklist Reference] Items:', itemsResult.recordset.length);
        
        await pool.close();
        
        // Build structured data
        const locations = locationsResult.recordset.map(loc => ({
            ...loc,
            subCategories: subCategoriesResult.recordset
                .filter(sc => sc.LocationId === loc.Id)
                .map(sc => ({
                    ...sc,
                    items: itemsResult.recordset.filter(item => item.SubCategoryId === sc.Id)
                }))
        }));
        
        console.log('[Checklist Reference] Built locations data:', locations.length);
        
        // Prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Security Checklist Reference - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { 
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .toolbar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                    }
                    .toolbar h2 {
                        color: #333;
                        font-size: 20px;
                    }
                    .btn-add {
                        background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .btn-add:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(46, 125, 50, 0.3);
                    }
                    .location-card {
                        background: white;
                        border-radius: 15px;
                        margin-bottom: 20px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        overflow: hidden;
                    }
                    .location-header {
                        background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
                        color: white;
                        padding: 20px 25px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .location-header h3 {
                        font-size: 18px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .location-actions {
                        display: flex;
                        gap: 10px;
                    }
                    .btn-icon {
                        background: rgba(255,255,255,0.2);
                        color: white;
                        border: none;
                        width: 36px;
                        height: 36px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .btn-icon:hover {
                        background: rgba(255,255,255,0.3);
                    }
                    .location-body {
                        padding: 20px 25px;
                    }
                    .subcategory-card {
                        background: #f8f9fa;
                        border-radius: 10px;
                        margin-bottom: 15px;
                        overflow: hidden;
                        border: 1px solid #e0e0e0;
                    }
                    .subcategory-card:last-child {
                        margin-bottom: 0;
                    }
                    .subcategory-header {
                        background: #e3f2fd;
                        padding: 15px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .subcategory-header h4 {
                        font-size: 15px;
                        color: #1565c0;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .shift-badges {
                        display: flex;
                        gap: 8px;
                    }
                    .shift-badge {
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .shift-badge.am {
                        background: #fff3e0;
                        color: #e65100;
                    }
                    .shift-badge.pm {
                        background: #e8eaf6;
                        color: #3f51b5;
                    }
                    .shift-badge.disabled {
                        background: #eee;
                        color: #999;
                        text-decoration: line-through;
                    }
                    .subcategory-actions {
                        display: flex;
                        gap: 8px;
                    }
                    .btn-sm {
                        background: #1565c0;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .btn-sm.edit { background: #f57c00; }
                    .btn-sm.delete { background: #c62828; }
                    .btn-sm:hover { opacity: 0.9; }
                    .items-list {
                        padding: 15px 20px;
                    }
                    .item-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 15px;
                        background: white;
                        border-radius: 8px;
                        margin-bottom: 8px;
                        border: 1px solid #e0e0e0;
                    }
                    .item-row:last-child {
                        margin-bottom: 0;
                    }
                    .item-info {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .item-name {
                        font-weight: 500;
                        color: #333;
                    }
                    .expected-count {
                        background: #1565c0;
                        color: white;
                        padding: 2px 10px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .item-actions {
                        display: flex;
                        gap: 5px;
                    }
                    .btn-xs {
                        background: #f5f5f5;
                        color: #666;
                        border: none;
                        width: 28px;
                        height: 28px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .btn-xs:hover { background: #eee; }
                    .btn-xs.edit:hover { background: #fff3e0; color: #f57c00; }
                    .btn-xs.delete:hover { background: #ffebee; color: #c62828; }
                    .no-items {
                        text-align: center;
                        padding: 20px;
                        color: #999;
                        font-size: 14px;
                    }
                    .add-btn-row {
                        padding: 10px 20px 15px;
                    }
                    .btn-add-item {
                        background: white;
                        color: #1565c0;
                        border: 2px dashed #1565c0;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 13px;
                        width: 100%;
                        font-weight: 500;
                    }
                    .btn-add-item:hover {
                        background: #e3f2fd;
                    }
                    .btn-add-subcat {
                        background: #f0f4ff;
                        color: #1565c0;
                        border: 2px dashed #1565c0;
                        padding: 15px;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        width: 100%;
                        font-weight: 500;
                    }
                    .btn-add-subcat:hover {
                        background: #e3f2fd;
                    }
                    .empty-state {
                        background: white;
                        border-radius: 15px;
                        padding: 60px;
                        text-align: center;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .empty-state h3 {
                        color: #333;
                        margin-bottom: 10px;
                    }
                    .empty-state p {
                        color: #666;
                        margin-bottom: 20px;
                    }
                    .inactive {
                        opacity: 0.5;
                    }
                    .inactive-badge {
                        background: #ffebee;
                        color: #c62828;
                        padding: 3px 8px;
                        border-radius: 4px;
                        font-size: 10px;
                        margin-left: 10px;
                    }
                    
                    /* Modal Styles */
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
                        border-radius: 15px;
                        padding: 30px;
                        width: 90%;
                        max-width: 500px;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                    }
                    .modal-header h3 {
                        font-size: 20px;
                        color: #333;
                    }
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                    }
                    .form-group {
                        margin-bottom: 20px;
                    }
                    .form-group label {
                        display: block;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 8px;
                        font-size: 14px;
                    }
                    .form-group input,
                    .form-group select {
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 15px;
                    }
                    .form-group input:focus,
                    .form-group select:focus {
                        outline: none;
                        border-color: #1565c0;
                    }
                    .checkbox-group {
                        display: flex;
                        gap: 20px;
                    }
                    .checkbox-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .checkbox-item input {
                        width: 18px;
                        height: 18px;
                    }
                    .modal-footer {
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                        margin-top: 25px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .btn-cancel {
                        background: #f5f5f5;
                        color: #333;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .btn-save {
                        background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .btn-save:hover {
                        box-shadow: 0 5px 20px rgba(21, 101, 192, 0.3);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Security Checklist Reference</h1>
                    <div class="header-nav">
                        <a href="/security">← Security Department</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="toolbar">
                        <h2>Manage Locations, Sub-Categories & Items</h2>
                        <button class="btn-add" onclick="showAddLocationModal()">
                            ➕ Add Location
                        </button>
                    </div>
                    
                    <div id="locationsContainer">
                        ${locations.length === 0 ? `
                            <div class="empty-state">
                                <h3>No Locations Configured</h3>
                                <p>Start by adding a location (e.g., Dbayeh, Zouk)</p>
                                <button class="btn-add" onclick="showAddLocationModal()">➕ Add First Location</button>
                            </div>
                        ` : locations.map(loc => `
                            <div class="location-card ${!loc.IsActive ? 'inactive' : ''}">
                                <div class="location-header">
                                    <h3>
                                        📍 ${loc.LocationName}
                                        ${!loc.IsActive ? '<span class="inactive-badge">INACTIVE</span>' : ''}
                                    </h3>
                                    <div class="location-actions">
                                        <button class="btn-icon" onclick="showAddSubCategoryModal(${loc.Id}, '${loc.LocationName}')" title="Add Sub-Category">➕</button>
                                        <button class="btn-icon" onclick="editLocation(${loc.Id}, '${loc.LocationName}')" title="Edit">✏️</button>
                                        <button class="btn-icon" onclick="deleteLocation(${loc.Id})" title="Delete">🗑️</button>
                                    </div>
                                </div>
                                <div class="location-body">
                                    ${loc.subCategories.length === 0 ? `
                                        <button class="btn-add-subcat" onclick="showAddSubCategoryModal(${loc.Id}, '${loc.LocationName}')">
                                            ➕ Add Sub-Category (e.g., HO Block A, Control Room)
                                        </button>
                                    ` : loc.subCategories.map(sc => `
                                        <div class="subcategory-card ${!sc.IsActive ? 'inactive' : ''}">
                                            <div class="subcategory-header">
                                                <h4>
                                                    📂 ${sc.SubCategoryName}
                                                    ${!sc.IsActive ? '<span class="inactive-badge">INACTIVE</span>' : ''}
                                                    <div class="shift-badges">
                                                        <span class="shift-badge am ${!sc.HasAMShift ? 'disabled' : ''}">AM</span>
                                                        <span class="shift-badge pm ${!sc.HasPMShift ? 'disabled' : ''}">PM</span>
                                                    </div>
                                                </h4>
                                                <div class="subcategory-actions">
                                                    <button class="btn-sm" onclick="showAddItemModal(${sc.Id}, '${sc.SubCategoryName}')">➕ Item</button>
                                                    <button class="btn-sm edit" onclick="editSubCategory(${sc.Id}, '${sc.SubCategoryName}', ${sc.HasAMShift}, ${sc.HasPMShift})">Edit</button>
                                                    <button class="btn-sm delete" onclick="deleteSubCategory(${sc.Id})">Delete</button>
                                                </div>
                                            </div>
                                            <div class="items-list">
                                                ${sc.items.length === 0 ? `
                                                    <div class="no-items">No items configured</div>
                                                ` : sc.items.map(item => `
                                                    <div class="item-row ${!item.IsActive ? 'inactive' : ''}">
                                                        <div class="item-info">
                                                            <span class="item-name">${item.ItemName}</span>
                                                            ${item.ExpectedCount ? `<span class="expected-count">${item.ExpectedCount}</span>` : ''}
                                                            ${!item.IsActive ? '<span class="inactive-badge">INACTIVE</span>' : ''}
                                                        </div>
                                                        <div class="item-actions">
                                                            <button class="btn-xs edit" onclick="editItem(${item.Id}, '${item.ItemName.replace(/'/g, "\\'")}', ${item.ExpectedCount || 'null'})">✏️</button>
                                                            <button class="btn-xs delete" onclick="deleteItem(${item.Id})">🗑️</button>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                            <div class="add-btn-row">
                                                <button class="btn-add-item" onclick="showAddItemModal(${sc.Id}, '${sc.SubCategoryName}')">
                                                    ➕ Add Checklist Item
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Add/Edit Location Modal -->
                <div id="locationModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="locationModalTitle">Add Location</h3>
                            <button class="modal-close" onclick="closeModal('locationModal')">&times;</button>
                        </div>
                        <form id="locationForm" onsubmit="saveLocation(event)">
                            <input type="hidden" id="locationId">
                            <div class="form-group">
                                <label>Location Name *</label>
                                <input type="text" id="locationName" placeholder="e.g., Dbayeh, Zouk" required>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-cancel" onclick="closeModal('locationModal')">Cancel</button>
                                <button type="submit" class="btn-save">Save Location</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Add/Edit SubCategory Modal -->
                <div id="subCategoryModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="subCategoryModalTitle">Add Sub-Category</h3>
                            <button class="modal-close" onclick="closeModal('subCategoryModal')">&times;</button>
                        </div>
                        <form id="subCategoryForm" onsubmit="saveSubCategory(event)">
                            <input type="hidden" id="subCategoryId">
                            <input type="hidden" id="subCategoryLocationId">
                            <div class="form-group">
                                <label>Location</label>
                                <input type="text" id="subCategoryLocationName" readonly style="background:#f5f5f5;">
                            </div>
                            <div class="form-group">
                                <label>Sub-Category Name *</label>
                                <input type="text" id="subCategoryName" placeholder="e.g., HO Block A, Control Room" required>
                            </div>
                            <div class="form-group">
                                <label>Available Shifts</label>
                                <div class="checkbox-group">
                                    <label class="checkbox-item">
                                        <input type="checkbox" id="hasAMShift" checked>
                                        AM Shift
                                    </label>
                                    <label class="checkbox-item">
                                        <input type="checkbox" id="hasPMShift" checked>
                                        PM Shift
                                    </label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-cancel" onclick="closeModal('subCategoryModal')">Cancel</button>
                                <button type="submit" class="btn-save">Save Sub-Category</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Add/Edit Item Modal -->
                <div id="itemModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="itemModalTitle">Add Checklist Item</h3>
                            <button class="modal-close" onclick="closeModal('itemModal')">&times;</button>
                        </div>
                        <form id="itemForm" onsubmit="saveItem(event)">
                            <input type="hidden" id="itemId">
                            <input type="hidden" id="itemSubCategoryId">
                            <div class="form-group">
                                <label>Sub-Category</label>
                                <input type="text" id="itemSubCategoryName" readonly style="background:#f5f5f5;">
                            </div>
                            <div class="form-group">
                                <label>Item Name *</label>
                                <input type="text" id="itemName" placeholder="e.g., Premises Keys, Napkins Dispensers Keys" required>
                            </div>
                            <div class="form-group">
                                <label>Expected Count (optional)</label>
                                <input type="number" id="expectedCount" placeholder="e.g., 22" min="0">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-cancel" onclick="closeModal('itemModal')">Cancel</button>
                                <button type="submit" class="btn-save">Save Item</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    function showModal(modalId) {
                        document.getElementById(modalId).classList.add('active');
                    }
                    
                    function closeModal(modalId) {
                        document.getElementById(modalId).classList.remove('active');
                    }
                    
                    // Location functions
                    function showAddLocationModal() {
                        document.getElementById('locationModalTitle').textContent = 'Add Location';
                        document.getElementById('locationId').value = '';
                        document.getElementById('locationName').value = '';
                        showModal('locationModal');
                    }
                    
                    function editLocation(id, name) {
                        document.getElementById('locationModalTitle').textContent = 'Edit Location';
                        document.getElementById('locationId').value = id;
                        document.getElementById('locationName').value = name;
                        showModal('locationModal');
                    }
                    
                    async function saveLocation(e) {
                        e.preventDefault();
                        const id = document.getElementById('locationId').value;
                        const name = document.getElementById('locationName').value;
                        
                        try {
                            const response = await fetch('/security/checklist-reference/location', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: id || null, name })
                            });
                            const result = await response.json();
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.message || 'Error saving location');
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    async function deleteLocation(id) {
                        if (!confirm('Are you sure you want to delete this location? This will also delete all sub-categories and items.')) return;
                        
                        try {
                            const response = await fetch('/security/checklist-reference/location/' + id, {
                                method: 'DELETE'
                            });
                            const result = await response.json();
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.message || 'Error deleting location');
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    // SubCategory functions
                    function showAddSubCategoryModal(locationId, locationName) {
                        document.getElementById('subCategoryModalTitle').textContent = 'Add Sub-Category';
                        document.getElementById('subCategoryId').value = '';
                        document.getElementById('subCategoryLocationId').value = locationId;
                        document.getElementById('subCategoryLocationName').value = locationName;
                        document.getElementById('subCategoryName').value = '';
                        document.getElementById('hasAMShift').checked = true;
                        document.getElementById('hasPMShift').checked = true;
                        showModal('subCategoryModal');
                    }
                    
                    function editSubCategory(id, name, hasAM, hasPM) {
                        document.getElementById('subCategoryModalTitle').textContent = 'Edit Sub-Category';
                        document.getElementById('subCategoryId').value = id;
                        document.getElementById('subCategoryName').value = name;
                        document.getElementById('hasAMShift').checked = hasAM;
                        document.getElementById('hasPMShift').checked = hasPM;
                        showModal('subCategoryModal');
                    }
                    
                    async function saveSubCategory(e) {
                        e.preventDefault();
                        const id = document.getElementById('subCategoryId').value;
                        const locationId = document.getElementById('subCategoryLocationId').value;
                        const name = document.getElementById('subCategoryName').value;
                        const hasAMShift = document.getElementById('hasAMShift').checked;
                        const hasPMShift = document.getElementById('hasPMShift').checked;
                        
                        try {
                            const response = await fetch('/security/checklist-reference/subcategory', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: id || null, locationId, name, hasAMShift, hasPMShift })
                            });
                            const result = await response.json();
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.message || 'Error saving sub-category');
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    async function deleteSubCategory(id) {
                        if (!confirm('Are you sure you want to delete this sub-category? This will also delete all items.')) return;
                        
                        try {
                            const response = await fetch('/security/checklist-reference/subcategory/' + id, {
                                method: 'DELETE'
                            });
                            const result = await response.json();
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.message || 'Error deleting sub-category');
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    // Item functions
                    function showAddItemModal(subCategoryId, subCategoryName) {
                        document.getElementById('itemModalTitle').textContent = 'Add Checklist Item';
                        document.getElementById('itemId').value = '';
                        document.getElementById('itemSubCategoryId').value = subCategoryId;
                        document.getElementById('itemSubCategoryName').value = subCategoryName;
                        document.getElementById('itemName').value = '';
                        document.getElementById('expectedCount').value = '';
                        showModal('itemModal');
                    }
                    
                    function editItem(id, name, expectedCount) {
                        document.getElementById('itemModalTitle').textContent = 'Edit Checklist Item';
                        document.getElementById('itemId').value = id;
                        document.getElementById('itemName').value = name;
                        document.getElementById('expectedCount').value = expectedCount || '';
                        showModal('itemModal');
                    }
                    
                    async function saveItem(e) {
                        e.preventDefault();
                        const id = document.getElementById('itemId').value;
                        const subCategoryId = document.getElementById('itemSubCategoryId').value;
                        const name = document.getElementById('itemName').value;
                        const expectedCount = document.getElementById('expectedCount').value;
                        
                        try {
                            const response = await fetch('/security/checklist-reference/item', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: id || null, subCategoryId, name, expectedCount: expectedCount || null })
                            });
                            const result = await response.json();
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.message || 'Error saving item');
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    async function deleteItem(id) {
                        if (!confirm('Are you sure you want to delete this item?')) return;
                        
                        try {
                            const response = await fetch('/security/checklist-reference/item/' + id, {
                                method: 'DELETE'
                            });
                            const result = await response.json();
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.message || 'Error deleting item');
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading checklist reference:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

// Save Location
router.post('/location', async (req, res) => {
    const user = req.currentUser;
    const { id, name } = req.body;
    
    if (!name) {
        return res.json({ success: false, message: 'Location name is required' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        if (id) {
            // Update
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, name)
                .query(`UPDATE Security_Checklist_Locations SET LocationName = @name, UpdatedAt = GETDATE() WHERE Id = @id`);
        } else {
            // Insert
            await pool.request()
                .input('name', sql.NVarChar, name)
                .input('createdBy', sql.NVarChar, user.displayName)
                .query(`INSERT INTO Security_Checklist_Locations (LocationName, CreatedBy) VALUES (@name, @createdBy)`);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving location:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// Delete Location
router.delete('/location/:id', async (req, res) => {
    const id = req.params.id;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`DELETE FROM Security_Checklist_Locations WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting location:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// Save SubCategory
router.post('/subcategory', async (req, res) => {
    const user = req.currentUser;
    const { id, locationId, name, hasAMShift, hasPMShift } = req.body;
    
    if (!name) {
        return res.json({ success: false, message: 'Sub-category name is required' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        if (id) {
            // Update
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, name)
                .input('hasAM', sql.Bit, hasAMShift)
                .input('hasPM', sql.Bit, hasPMShift)
                .query(`UPDATE Security_Checklist_SubCategories SET SubCategoryName = @name, HasAMShift = @hasAM, HasPMShift = @hasPM, UpdatedAt = GETDATE() WHERE Id = @id`);
        } else {
            // Insert
            await pool.request()
                .input('locationId', sql.Int, locationId)
                .input('name', sql.NVarChar, name)
                .input('hasAM', sql.Bit, hasAMShift)
                .input('hasPM', sql.Bit, hasPMShift)
                .input('createdBy', sql.NVarChar, user.displayName)
                .query(`INSERT INTO Security_Checklist_SubCategories (LocationId, SubCategoryName, HasAMShift, HasPMShift, CreatedBy) VALUES (@locationId, @name, @hasAM, @hasPM, @createdBy)`);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving sub-category:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// Delete SubCategory
router.delete('/subcategory/:id', async (req, res) => {
    const id = req.params.id;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`DELETE FROM Security_Checklist_SubCategories WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting sub-category:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// Save Item
router.post('/item', async (req, res) => {
    const user = req.currentUser;
    const { id, subCategoryId, name, expectedCount } = req.body;
    
    console.log('[Checklist Reference] Saving item:', { id, subCategoryId, name, expectedCount });
    
    if (!name) {
        return res.json({ success: false, message: 'Item name is required' });
    }
    
    if (!id && !subCategoryId) {
        return res.json({ success: false, message: 'Sub-category is required for new items' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        if (id) {
            // Update
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, name)
                .input('expectedCount', sql.Int, expectedCount || null)
                .query(`UPDATE Security_Checklist_Items SET ItemName = @name, ExpectedCount = @expectedCount, UpdatedAt = GETDATE() WHERE Id = @id`);
        } else {
            // Insert
            await pool.request()
                .input('subCategoryId', sql.Int, subCategoryId)
                .input('name', sql.NVarChar, name)
                .input('expectedCount', sql.Int, expectedCount || null)
                .input('createdBy', sql.NVarChar, user.displayName)
                .query(`INSERT INTO Security_Checklist_Items (SubCategoryId, ItemName, ExpectedCount, CreatedBy) VALUES (@subCategoryId, @name, @expectedCount, @createdBy)`);
        }
        
        await pool.close();
        console.log('[Checklist Reference] Item saved successfully');
        res.json({ success: true });
    } catch (err) {
        console.error('[Checklist Reference] Error saving item:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// Delete Item
router.delete('/item/:id', async (req, res) => {
    const id = req.params.id;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`DELETE FROM Security_Checklist_Items WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting item:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

module.exports = router;
