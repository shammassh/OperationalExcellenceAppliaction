/**
 * Cleaning Reference
 * Admin page to set up cleaning locations, categories, and checklist items
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
        pool = await sql.connect(dbConfig);
        
        // Get all locations
        const locationsResult = await pool.request()
            .query(`
                SELECT Id, LocationName, LocationNameAr, SortOrder, IsActive
                FROM Security_CleaningLocations
                WHERE IsActive = 1
                ORDER BY SortOrder, LocationName
            `);
        
        // Get all categories
        const categoriesResult = await pool.request()
            .query(`
                SELECT Id, LocationId, CategoryName, CategoryNameAr, SortOrder, IsActive
                FROM Security_CleaningCategories
                WHERE IsActive = 1
                ORDER BY SortOrder, CategoryName
            `);
        
        // Get all items
        const itemsResult = await pool.request()
            .query(`
                SELECT Id, CategoryId, ItemName, ItemNameAr, Frequency, FrequencyAr, SortOrder, IsActive
                FROM Security_CleaningItems
                WHERE IsActive = 1
                ORDER BY SortOrder, ItemName
            `);
        
        await pool.close();
        
        // Build structured data
        const locations = locationsResult.recordset.map(loc => ({
            ...loc,
            categories: categoriesResult.recordset
                .filter(cat => cat.LocationId === loc.Id)
                .map(cat => ({
                    ...cat,
                    items: itemsResult.recordset.filter(item => item.CategoryId === cat.Id)
                }))
        }));
        
        // Prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Cleaning Reference - ${process.env.APP_NAME}</title>
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
                        background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
                        color: white;
                        padding: 20px 25px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .location-title {
                        font-size: 18px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .location-title-ar {
                        font-size: 14px;
                        opacity: 0.9;
                    }
                    .location-actions button {
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        padding: 8px 15px;
                        border-radius: 6px;
                        cursor: pointer;
                        margin-left: 8px;
                        font-size: 13px;
                    }
                    .location-actions button:hover {
                        background: rgba(255,255,255,0.3);
                    }
                    .location-body {
                        padding: 25px;
                    }
                    .category-section {
                        border: 1px solid #e0e0e0;
                        border-radius: 10px;
                        margin-bottom: 20px;
                        overflow: hidden;
                    }
                    .category-section:last-child {
                        margin-bottom: 0;
                    }
                    .category-header {
                        background: #f5f5f5;
                        padding: 15px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .category-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: #333;
                    }
                    .category-title-ar {
                        font-size: 13px;
                        color: #666;
                        margin-left: 10px;
                    }
                    .category-actions button {
                        background: #e3f2fd;
                        border: none;
                        color: #1976d2;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-left: 8px;
                        font-size: 12px;
                    }
                    .category-actions button:hover {
                        background: #bbdefb;
                    }
                    .category-actions button.delete {
                        background: #ffebee;
                        color: #c62828;
                    }
                    .category-actions button.delete:hover {
                        background: #ffcdd2;
                    }
                    .items-list {
                        padding: 15px 20px;
                    }
                    .item-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 15px;
                        background: #fafafa;
                        border-radius: 8px;
                        margin-bottom: 10px;
                    }
                    .item-row:last-child {
                        margin-bottom: 0;
                    }
                    .item-info {
                        flex: 1;
                    }
                    .item-name {
                        font-weight: 500;
                        color: #333;
                    }
                    .item-name-ar {
                        font-size: 13px;
                        color: #666;
                    }
                    .item-frequency {
                        font-size: 12px;
                        color: #1976d2;
                        background: #e3f2fd;
                        padding: 4px 10px;
                        border-radius: 15px;
                        margin-top: 5px;
                        display: inline-block;
                    }
                    .item-actions button {
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 5px 10px;
                        font-size: 13px;
                        border-radius: 4px;
                    }
                    .item-actions button.edit {
                        color: #1976d2;
                    }
                    .item-actions button.edit:hover {
                        background: #e3f2fd;
                    }
                    .item-actions button.delete {
                        color: #c62828;
                    }
                    .item-actions button.delete:hover {
                        background: #ffebee;
                    }
                    .empty-message {
                        text-align: center;
                        padding: 30px;
                        color: #666;
                        font-style: italic;
                    }
                    .add-category-btn {
                        background: #e8f5e9;
                        border: 2px dashed #4caf50;
                        color: #2e7d32;
                        padding: 15px;
                        border-radius: 10px;
                        cursor: pointer;
                        width: 100%;
                        font-size: 14px;
                        font-weight: 500;
                        margin-top: 15px;
                    }
                    .add-category-btn:hover {
                        background: #c8e6c9;
                    }
                    .add-item-btn {
                        background: #e3f2fd;
                        border: 2px dashed #1976d2;
                        color: #1976d2;
                        padding: 10px;
                        border-radius: 8px;
                        cursor: pointer;
                        width: 100%;
                        font-size: 13px;
                        margin-top: 10px;
                    }
                    .add-item-btn:hover {
                        background: #bbdefb;
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
                    .modal.active {
                        display: flex;
                    }
                    .modal-content {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        width: 100%;
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
                        color: #666;
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
                    .form-group input,
                    .form-group select {
                        width: 100%;
                        padding: 12px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .form-group input:focus,
                    .form-group select:focus {
                        outline: none;
                        border-color: #1976d2;
                    }
                    .btn-submit {
                        background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
                        color: white;
                        border: none;
                        padding: 14px 30px;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                    }
                    .btn-submit:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(25, 118, 210, 0.3);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧹 Cleaning Reference</h1>
                    <div class="header-nav">
                        <a href="/security">← Facility Management Department</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="toolbar">
                        <h2>Manage Cleaning Locations & Items</h2>
                        <button class="btn-add" onclick="showAddLocation()">+ Add Location</button>
                    </div>
                    
                    ${locations.length === 0 ? `
                        <div class="location-card">
                            <div class="empty-message">
                                No locations configured yet. Click "Add Location" to get started.
                            </div>
                        </div>
                    ` : locations.map(loc => `
                        <div class="location-card">
                            <div class="location-header">
                                <div class="location-title">
                                    📍 ${loc.LocationName}
                                    ${loc.LocationNameAr ? `<span class="location-title-ar">(${loc.LocationNameAr})</span>` : ''}
                                </div>
                                <div class="location-actions">
                                    <button onclick="editLocation(${loc.Id}, '${loc.LocationName}', '${loc.LocationNameAr || ''}')">✏️ Edit</button>
                                    <button onclick="deleteLocation(${loc.Id})">🗑️ Delete</button>
                                </div>
                            </div>
                            <div class="location-body">
                                ${loc.categories.length === 0 ? `
                                    <div class="empty-message">No categories yet</div>
                                ` : loc.categories.map(cat => `
                                    <div class="category-section">
                                        <div class="category-header">
                                            <div>
                                                <span class="category-title">${cat.CategoryName}</span>
                                                ${cat.CategoryNameAr ? `<span class="category-title-ar">(${cat.CategoryNameAr})</span>` : ''}
                                            </div>
                                            <div class="category-actions">
                                                <button onclick="editCategory(${cat.Id}, ${loc.Id}, '${cat.CategoryName}', '${cat.CategoryNameAr || ''}')">✏️ Edit</button>
                                                <button class="delete" onclick="deleteCategory(${cat.Id})">🗑️ Delete</button>
                                            </div>
                                        </div>
                                        <div class="items-list">
                                            ${cat.items.length === 0 ? `
                                                <div class="empty-message" style="padding: 15px;">No items yet</div>
                                            ` : cat.items.map(item => `
                                                <div class="item-row">
                                                    <div class="item-info">
                                                        <div class="item-name">${item.ItemName}</div>
                                                        ${item.ItemNameAr ? `<div class="item-name-ar">${item.ItemNameAr}</div>` : ''}
                                                        <span class="item-frequency">${item.Frequency}${item.FrequencyAr ? ` / ${item.FrequencyAr}` : ''}</span>
                                                    </div>
                                                    <div class="item-actions">
                                                        <button class="edit" onclick="editItem(${item.Id}, ${cat.Id}, '${item.ItemName.replace(/'/g, "\\'")}', '${(item.ItemNameAr || '').replace(/'/g, "\\'")}', '${item.Frequency}', '${item.FrequencyAr || ''}')">✏️ Edit</button>
                                                        <button class="delete" onclick="deleteItem(${item.Id})">🗑️ Delete</button>
                                                    </div>
                                                </div>
                                            `).join('')}
                                            <button class="add-item-btn" onclick="showAddItem(${cat.Id})">+ Add Item</button>
                                        </div>
                                    </div>
                                `).join('')}
                                <button class="add-category-btn" onclick="showAddCategory(${loc.Id})">+ Add Category to ${loc.LocationName}</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Location Modal -->
                <div class="modal" id="locationModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="locationModalTitle">Add Location</h3>
                            <button class="modal-close" onclick="closeModal('locationModal')">&times;</button>
                        </div>
                        <form id="locationForm" onsubmit="saveLocation(event)">
                            <input type="hidden" id="locationId" value="">
                            <div class="form-group">
                                <label>Location Name (English)</label>
                                <input type="text" id="locationName" required placeholder="e.g., Dbayeh">
                            </div>
                            <div class="form-group">
                                <label>Location Name (Arabic)</label>
                                <input type="text" id="locationNameAr" placeholder="e.g., ضبية" dir="rtl">
                            </div>
                            <button type="submit" class="btn-submit">Save Location</button>
                        </form>
                    </div>
                </div>
                
                <!-- Category Modal -->
                <div class="modal" id="categoryModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="categoryModalTitle">Add Category</h3>
                            <button class="modal-close" onclick="closeModal('categoryModal')">&times;</button>
                        </div>
                        <form id="categoryForm" onsubmit="saveCategory(event)">
                            <input type="hidden" id="categoryId" value="">
                            <input type="hidden" id="categoryLocationId" value="">
                            <div class="form-group">
                                <label>Category Name (English)</label>
                                <input type="text" id="categoryName" required placeholder="e.g., Toilets">
                            </div>
                            <div class="form-group">
                                <label>Category Name (Arabic)</label>
                                <input type="text" id="categoryNameAr" placeholder="e.g., دورات المياه" dir="rtl">
                            </div>
                            <button type="submit" class="btn-submit">Save Category</button>
                        </form>
                    </div>
                </div>
                
                <!-- Item Modal -->
                <div class="modal" id="itemModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="itemModalTitle">Add Item</h3>
                            <button class="modal-close" onclick="closeModal('itemModal')">&times;</button>
                        </div>
                        <form id="itemForm" onsubmit="saveItem(event)">
                            <input type="hidden" id="itemId" value="">
                            <input type="hidden" id="itemCategoryId" value="">
                            <div class="form-group">
                                <label>Item Name (English)</label>
                                <input type="text" id="itemName" required placeholder="e.g., Handles of doors">
                            </div>
                            <div class="form-group">
                                <label>Item Name (Arabic)</label>
                                <input type="text" id="itemNameAr" placeholder="e.g., مقابض الأبواب" dir="rtl">
                            </div>
                            <div class="form-group">
                                <label>Frequency (English)</label>
                                <input type="text" id="itemFrequency" required placeholder="e.g., Daily, Every 4 hours">
                            </div>
                            <div class="form-group">
                                <label>Frequency (Arabic)</label>
                                <input type="text" id="itemFrequencyAr" placeholder="e.g., يوميا، كل 4 ساعات" dir="rtl">
                            </div>
                            <button type="submit" class="btn-submit">Save Item</button>
                        </form>
                    </div>
                </div>
                
                <script>
                    function closeModal(modalId) {
                        document.getElementById(modalId).classList.remove('active');
                    }
                    
                    // Location functions
                    function showAddLocation() {
                        document.getElementById('locationModalTitle').textContent = 'Add Location';
                        document.getElementById('locationId').value = '';
                        document.getElementById('locationName').value = '';
                        document.getElementById('locationNameAr').value = '';
                        document.getElementById('locationModal').classList.add('active');
                    }
                    
                    function editLocation(id, name, nameAr) {
                        document.getElementById('locationModalTitle').textContent = 'Edit Location';
                        document.getElementById('locationId').value = id;
                        document.getElementById('locationName').value = name;
                        document.getElementById('locationNameAr').value = nameAr;
                        document.getElementById('locationModal').classList.add('active');
                    }
                    
                    async function saveLocation(e) {
                        e.preventDefault();
                        const id = document.getElementById('locationId').value;
                        const data = {
                            name: document.getElementById('locationName').value,
                            nameAr: document.getElementById('locationNameAr').value
                        };
                        
                        const url = id ? '/security/cleaning-reference/api/locations/' + id : '/security/cleaning-reference/api/locations';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            location.reload();
                        } else {
                            alert('Error saving location');
                        }
                    }
                    
                    async function deleteLocation(id) {
                        if (!confirm('Delete this location and all its categories/items?')) return;
                        
                        const res = await fetch('/security/cleaning-reference/api/locations/' + id, { method: 'DELETE' });
                        if (res.ok) {
                            location.reload();
                        } else {
                            alert('Error deleting location');
                        }
                    }
                    
                    // Category functions
                    function showAddCategory(locationId) {
                        document.getElementById('categoryModalTitle').textContent = 'Add Category';
                        document.getElementById('categoryId').value = '';
                        document.getElementById('categoryLocationId').value = locationId;
                        document.getElementById('categoryName').value = '';
                        document.getElementById('categoryNameAr').value = '';
                        document.getElementById('categoryModal').classList.add('active');
                    }
                    
                    function editCategory(id, locationId, name, nameAr) {
                        document.getElementById('categoryModalTitle').textContent = 'Edit Category';
                        document.getElementById('categoryId').value = id;
                        document.getElementById('categoryLocationId').value = locationId;
                        document.getElementById('categoryName').value = name;
                        document.getElementById('categoryNameAr').value = nameAr;
                        document.getElementById('categoryModal').classList.add('active');
                    }
                    
                    async function saveCategory(e) {
                        e.preventDefault();
                        const id = document.getElementById('categoryId').value;
                        const data = {
                            locationId: document.getElementById('categoryLocationId').value,
                            name: document.getElementById('categoryName').value,
                            nameAr: document.getElementById('categoryNameAr').value
                        };
                        
                        const url = id ? '/security/cleaning-reference/api/categories/' + id : '/security/cleaning-reference/api/categories';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            location.reload();
                        } else {
                            alert('Error saving category');
                        }
                    }
                    
                    async function deleteCategory(id) {
                        if (!confirm('Delete this category and all its items?')) return;
                        
                        const res = await fetch('/security/cleaning-reference/api/categories/' + id, { method: 'DELETE' });
                        if (res.ok) {
                            location.reload();
                        } else {
                            alert('Error deleting category');
                        }
                    }
                    
                    // Item functions
                    function showAddItem(categoryId) {
                        document.getElementById('itemModalTitle').textContent = 'Add Item';
                        document.getElementById('itemId').value = '';
                        document.getElementById('itemCategoryId').value = categoryId;
                        document.getElementById('itemName').value = '';
                        document.getElementById('itemNameAr').value = '';
                        document.getElementById('itemFrequency').value = '';
                        document.getElementById('itemFrequencyAr').value = '';
                        document.getElementById('itemModal').classList.add('active');
                    }
                    
                    function editItem(id, categoryId, name, nameAr, frequency, frequencyAr) {
                        document.getElementById('itemModalTitle').textContent = 'Edit Item';
                        document.getElementById('itemId').value = id;
                        document.getElementById('itemCategoryId').value = categoryId;
                        document.getElementById('itemName').value = name;
                        document.getElementById('itemNameAr').value = nameAr;
                        document.getElementById('itemFrequency').value = frequency;
                        document.getElementById('itemFrequencyAr').value = frequencyAr;
                        document.getElementById('itemModal').classList.add('active');
                    }
                    
                    async function saveItem(e) {
                        e.preventDefault();
                        const id = document.getElementById('itemId').value;
                        const data = {
                            categoryId: document.getElementById('itemCategoryId').value,
                            name: document.getElementById('itemName').value,
                            nameAr: document.getElementById('itemNameAr').value,
                            frequency: document.getElementById('itemFrequency').value,
                            frequencyAr: document.getElementById('itemFrequencyAr').value
                        };
                        
                        const url = id ? '/security/cleaning-reference/api/items/' + id : '/security/cleaning-reference/api/items';
                        const method = id ? 'PUT' : 'POST';
                        
                        const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            location.reload();
                        } else {
                            alert('Error saving item');
                        }
                    }
                    
                    async function deleteItem(id) {
                        if (!confirm('Delete this item?')) return;
                        
                        const res = await fetch('/security/cleaning-reference/api/items/' + id, { method: 'DELETE' });
                        if (res.ok) {
                            location.reload();
                        } else {
                            alert('Error deleting item');
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        if (pool) await pool.close();
        console.error('Error loading cleaning reference:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API Routes

// Locations
router.post('/api/locations', async (req, res) => {
    try {
        const { name, nameAr } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('nameAr', sql.NVarChar, nameAr || null)
            .input('createdBy', sql.NVarChar, req.currentUser?.name || 'System')
            .query('INSERT INTO Security_CleaningLocations (LocationName, LocationNameAr, CreatedBy) VALUES (@name, @nameAr, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding location:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/locations/:id', async (req, res) => {
    try {
        const { name, nameAr } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('name', sql.NVarChar, name)
            .input('nameAr', sql.NVarChar, nameAr || null)
            .query('UPDATE Security_CleaningLocations SET LocationName = @name, LocationNameAr = @nameAr WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating location:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/locations/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('UPDATE Security_CleaningLocations SET IsActive = 0 WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting location:', err);
        res.status(500).json({ error: err.message });
    }
});

// Categories
router.post('/api/categories', async (req, res) => {
    try {
        const { locationId, name, nameAr } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('locationId', sql.Int, locationId)
            .input('name', sql.NVarChar, name)
            .input('nameAr', sql.NVarChar, nameAr || null)
            .input('createdBy', sql.NVarChar, req.currentUser?.name || 'System')
            .query('INSERT INTO Security_CleaningCategories (LocationId, CategoryName, CategoryNameAr, CreatedBy) VALUES (@locationId, @name, @nameAr, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/categories/:id', async (req, res) => {
    try {
        const { name, nameAr } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('name', sql.NVarChar, name)
            .input('nameAr', sql.NVarChar, nameAr || null)
            .query('UPDATE Security_CleaningCategories SET CategoryName = @name, CategoryNameAr = @nameAr WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/categories/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('UPDATE Security_CleaningCategories SET IsActive = 0 WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ error: err.message });
    }
});

// Items
router.post('/api/items', async (req, res) => {
    try {
        const { categoryId, name, nameAr, frequency, frequencyAr } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('categoryId', sql.Int, categoryId)
            .input('name', sql.NVarChar, name)
            .input('nameAr', sql.NVarChar, nameAr || null)
            .input('frequency', sql.NVarChar, frequency)
            .input('frequencyAr', sql.NVarChar, frequencyAr || null)
            .input('createdBy', sql.NVarChar, req.currentUser?.name || 'System')
            .query('INSERT INTO Security_CleaningItems (CategoryId, ItemName, ItemNameAr, Frequency, FrequencyAr, CreatedBy) VALUES (@categoryId, @name, @nameAr, @frequency, @frequencyAr, @createdBy)');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding item:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/items/:id', async (req, res) => {
    try {
        const { name, nameAr, frequency, frequencyAr } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('name', sql.NVarChar, name)
            .input('nameAr', sql.NVarChar, nameAr || null)
            .input('frequency', sql.NVarChar, frequency)
            .input('frequencyAr', sql.NVarChar, frequencyAr || null)
            .query('UPDATE Security_CleaningItems SET ItemName = @name, ItemNameAr = @nameAr, Frequency = @frequency, FrequencyAr = @frequencyAr, UpdatedAt = GETDATE() WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating item:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/items/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('UPDATE Security_CleaningItems SET IsActive = 0 WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
