/**
 * Cleaning Checklist Routes
 * Facility Management - Cleaning Checklist Form
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

// Helper function to get Monday of the week for a given date
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust for Sunday
    return new Date(d.setDate(diff));
}

// Format date as YYYY-MM-DD
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Main Cleaning Checklist Page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get locations
        const locationsResult = await pool.request()
            .query(`
                SELECT Id, LocationName, LocationNameAr
                FROM Security_CleaningLocations
                WHERE IsActive = 1
                ORDER BY SortOrder, LocationName
            `);
        
        // Get recent checklists
        const checklistsResult = await pool.request()
            .query(`
                SELECT TOP 20 c.*, l.LocationName, cat.CategoryName, cat.CategoryNameAr
                FROM Security_CleaningChecklists c
                JOIN Security_CleaningLocations l ON c.LocationId = l.Id
                JOIN Security_CleaningCategories cat ON c.CategoryId = cat.Id
                WHERE c.Status = 'Active'
                ORDER BY c.WeekStartDate DESC, c.CreatedAt DESC
            `);
        
        await pool.close();
        
        const locations = locationsResult.recordset;
        const checklists = checklistsResult.recordset;
        
        const today = new Date().toISOString().split('T')[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Cleaning Checklist - ${process.env.APP_NAME}</title>
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
                        max-width: 1100px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        margin-bottom: 25px;
                    }
                    .card-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .form-row {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .form-group {
                        display: flex;
                        flex-direction: column;
                    }
                    .form-group label {
                        font-size: 13px;
                        font-weight: 500;
                        color: #555;
                        margin-bottom: 8px;
                    }
                    .form-group select,
                    .form-group input {
                        padding: 12px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .form-group select:focus,
                    .form-group input:focus {
                        outline: none;
                        border-color: #8e24aa;
                    }
                    .btn {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.3s;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #8e24aa 0%, #6a1b9a 100%);
                        color: white;
                    }
                    .btn-primary:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(142, 36, 170, 0.3);
                    }
                    .history-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .history-table th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-size: 13px;
                        font-weight: 600;
                        color: #555;
                        border-bottom: 2px solid #dee2e6;
                    }
                    .history-table td {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }
                    .history-table tr:hover {
                        background: #f8f9fa;
                        cursor: pointer;
                    }
                    .badge {
                        padding: 5px 12px;
                        border-radius: 15px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .badge-location {
                        background: #e3f2fd;
                        color: #1976d2;
                    }
                    .badge-category {
                        background: #f3e5f5;
                        color: #8e24aa;
                    }
                    .empty-message {
                        text-align: center;
                        padding: 40px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧹 Cleaning Checklist</h1>
                    <div class="header-nav">
                        <a href="/security-services">← Facility Management</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-title">📝 Fill New Checklist</div>
                        <form action="/security-services/cleaning-checklist/start" method="GET">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Select Date</label>
                                    <input type="date" name="date" value="${today}" required>
                                </div>
                                <div class="form-group">
                                    <label>Select Location</label>
                                    <select name="locationId" id="locationSelect" required onchange="loadCategories()">
                                        <option value="">-- Choose Location --</option>
                                        ${locations.map(loc => `
                                            <option value="${loc.Id}">${loc.LocationName}${loc.LocationNameAr ? ` (${loc.LocationNameAr})` : ''}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Select Category</label>
                                    <select name="categoryId" id="categorySelect" required disabled>
                                        <option value="">-- Choose Location First --</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary">Start Checklist →</button>
                        </form>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">📋 Recent Checklists</div>
                        ${checklists.length === 0 ? `
                            <div class="empty-message">No checklists filled yet</div>
                        ` : `
                            <table class="history-table">
                                <thead>
                                    <tr>
                                        <th>Week Starting</th>
                                        <th>Location</th>
                                        <th>Category</th>
                                        <th>Filled By</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${checklists.map(c => {
                                        const weekStart = new Date(c.WeekStartDate).toLocaleDateString('en-GB', { 
                                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' 
                                        });
                                        return `
                                            <tr onclick="location.href='/security-services/cleaning-checklist/${c.Id}'">
                                                <td>${weekStart}</td>
                                                <td><span class="badge badge-location">${c.LocationName}</span></td>
                                                <td><span class="badge badge-category">${c.CategoryName}${c.CategoryNameAr ? ` / ${c.CategoryNameAr}` : ''}</span></td>
                                                <td>${c.FilledBy}</td>
                                                <td>${c.Status}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
                
                <script>
                    const categoriesByLocation = {};
                    
                    async function loadCategories() {
                        const locationId = document.getElementById('locationSelect').value;
                        const categorySelect = document.getElementById('categorySelect');
                        
                        if (!locationId) {
                            categorySelect.innerHTML = '<option value="">-- Choose Location First --</option>';
                            categorySelect.disabled = true;
                            return;
                        }
                        
                        // Fetch categories for selected location
                        if (!categoriesByLocation[locationId]) {
                            const res = await fetch('/security-services/cleaning-checklist/api/categories/' + locationId);
                            categoriesByLocation[locationId] = await res.json();
                        }
                        
                        const categories = categoriesByLocation[locationId];
                        categorySelect.innerHTML = '<option value="">-- Choose Category --</option>' +
                            categories.map(cat => 
                                '<option value="' + cat.Id + '">' + cat.CategoryName + 
                                (cat.CategoryNameAr ? ' (' + cat.CategoryNameAr + ')' : '') + '</option>'
                            ).join('');
                        categorySelect.disabled = false;
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        if (pool) await pool.close();
        console.error('Error loading cleaning checklist:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API to get categories by location
router.get('/api/categories/:locationId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('locationId', sql.Int, req.params.locationId)
            .query(`
                SELECT Id, CategoryName, CategoryNameAr
                FROM Security_CleaningCategories
                WHERE LocationId = @locationId AND IsActive = 1
                ORDER BY SortOrder, CategoryName
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start/Load checklist form
router.get('/start', async (req, res) => {
    const user = req.currentUser;
    const { date, locationId, categoryId } = req.query;
    
    if (!date || !locationId || !categoryId) {
        return res.redirect('/security-services/cleaning-checklist');
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get the Monday of the selected week
        const selectedDate = new Date(date);
        const mondayDate = getMonday(selectedDate);
        const weekStartStr = formatDate(mondayDate);
        
        // Get location and category info
        const infoResult = await pool.request()
            .input('locationId', sql.Int, locationId)
            .input('categoryId', sql.Int, categoryId)
            .query(`
                SELECT l.LocationName, l.LocationNameAr, c.CategoryName, c.CategoryNameAr
                FROM Security_CleaningLocations l
                CROSS JOIN Security_CleaningCategories c
                WHERE l.Id = @locationId AND c.Id = @categoryId
            `);
        
        if (infoResult.recordset.length === 0) {
            await pool.close();
            return res.status(400).send('Invalid location or category');
        }
        
        const info = infoResult.recordset[0];
        
        // Check if checklist already exists for this week/location/category
        const existingResult = await pool.request()
            .input('locationId', sql.Int, locationId)
            .input('categoryId', sql.Int, categoryId)
            .input('weekStart', sql.Date, weekStartStr)
            .query(`
                SELECT Id FROM Security_CleaningChecklists
                WHERE LocationId = @locationId AND CategoryId = @categoryId 
                AND WeekStartDate = @weekStart AND Status = 'Active'
            `);
        
        let checklistId;
        
        if (existingResult.recordset.length > 0) {
            // Checklist exists, redirect to it
            checklistId = existingResult.recordset[0].Id;
        } else {
            // Create new checklist
            const insertResult = await pool.request()
                .input('locationId', sql.Int, locationId)
                .input('categoryId', sql.Int, categoryId)
                .input('weekStart', sql.Date, weekStartStr)
                .input('filledBy', sql.NVarChar, user.displayName)
                .input('filledById', sql.Int, user.id || null)
                .query(`
                    INSERT INTO Security_CleaningChecklists (LocationId, CategoryId, WeekStartDate, FilledBy, FilledById)
                    OUTPUT INSERTED.Id
                    VALUES (@locationId, @categoryId, @weekStart, @filledBy, @filledById)
                `);
            
            checklistId = insertResult.recordset[0].Id;
            
            // Get items for this category and create entries
            const itemsResult = await pool.request()
                .input('categoryId', sql.Int, categoryId)
                .query(`
                    SELECT Id FROM Security_CleaningItems
                    WHERE CategoryId = @categoryId AND IsActive = 1
                `);
            
            // Create checklist entries for each item
            for (const item of itemsResult.recordset) {
                await pool.request()
                    .input('checklistId', sql.Int, checklistId)
                    .input('itemId', sql.Int, item.Id)
                    .query(`
                        INSERT INTO Security_CleaningChecklistEntries (ChecklistId, ItemId)
                        VALUES (@checklistId, @itemId)
                    `);
            }
        }
        
        await pool.close();
        
        // Redirect to the checklist form
        res.redirect('/security-services/cleaning-checklist/' + checklistId);
        
    } catch (err) {
        if (pool) await pool.close();
        console.error('Error starting checklist:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// View/Edit checklist
router.get('/:id', async (req, res) => {
    const user = req.currentUser;
    const checklistId = req.params.id;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get checklist with location and category info
        const checklistResult = await pool.request()
            .input('id', sql.Int, checklistId)
            .query(`
                SELECT c.*, l.LocationName, l.LocationNameAr, cat.CategoryName, cat.CategoryNameAr
                FROM Security_CleaningChecklists c
                JOIN Security_CleaningLocations l ON c.LocationId = l.Id
                JOIN Security_CleaningCategories cat ON c.CategoryId = cat.Id
                WHERE c.Id = @id
            `);
        
        if (checklistResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Checklist not found');
        }
        
        const checklist = checklistResult.recordset[0];
        
        // Get checklist entries with item info
        const entriesResult = await pool.request()
            .input('checklistId', sql.Int, checklistId)
            .query(`
                SELECT e.*, i.ItemName, i.ItemNameAr, i.Frequency, i.FrequencyAr, i.SortOrder
                FROM Security_CleaningChecklistEntries e
                JOIN Security_CleaningItems i ON e.ItemId = i.Id
                WHERE e.ChecklistId = @checklistId
                ORDER BY i.SortOrder, i.ItemName
            `);
        
        await pool.close();
        
        const entries = entriesResult.recordset;
        const weekStart = new Date(checklist.WeekStartDate);
        
        // Calculate dates for Mon-Fri
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const daysAr = ['الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعة'];
        const dayDates = days.map((day, idx) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + idx);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        });
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Cleaning Checklist - ${checklist.LocationName} - ${process.env.APP_NAME}</title>
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
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        margin-bottom: 25px;
                    }
                    .checklist-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 25px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #eee;
                    }
                    .checklist-title {
                        font-size: 22px;
                        font-weight: 600;
                        color: #333;
                    }
                    .checklist-subtitle {
                        font-size: 14px;
                        color: #666;
                        margin-top: 5px;
                    }
                    .badge {
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 13px;
                        font-weight: 500;
                    }
                    .badge-location {
                        background: #e3f2fd;
                        color: #1976d2;
                    }
                    .badge-category {
                        background: #f3e5f5;
                        color: #8e24aa;
                        margin-left: 10px;
                    }
                    .checklist-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .checklist-table th {
                        background: linear-gradient(135deg, #8e24aa 0%, #6a1b9a 100%);
                        color: white;
                        padding: 15px 10px;
                        text-align: center;
                        font-size: 13px;
                        font-weight: 600;
                    }
                    .checklist-table th:first-child,
                    .checklist-table th:nth-child(2) {
                        text-align: left;
                    }
                    .checklist-table th small {
                        display: block;
                        font-weight: normal;
                        opacity: 0.9;
                        margin-top: 3px;
                    }
                    .checklist-table td {
                        padding: 15px 10px;
                        border-bottom: 1px solid #eee;
                        text-align: center;
                    }
                    .checklist-table td:first-child,
                    .checklist-table td:nth-child(2) {
                        text-align: left;
                    }
                    .checklist-table tr:hover {
                        background: #fafafa;
                    }
                    .item-name {
                        font-weight: 500;
                        color: #333;
                    }
                    .item-name-ar {
                        font-size: 13px;
                        color: #666;
                        direction: rtl;
                    }
                    .frequency-badge {
                        font-size: 11px;
                        color: #8e24aa;
                        background: #f3e5f5;
                        padding: 3px 8px;
                        border-radius: 10px;
                    }
                    .checkbox-cell {
                        cursor: pointer;
                    }
                    .checkbox-cell input[type="checkbox"] {
                        width: 22px;
                        height: 22px;
                        cursor: pointer;
                        accent-color: #8e24aa;
                    }
                    .btn {
                        padding: 12px 30px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.3s;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #8e24aa 0%, #6a1b9a 100%);
                        color: white;
                    }
                    .btn-primary:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(142, 36, 170, 0.3);
                    }
                    .btn-outline {
                        background: white;
                        border: 2px solid #8e24aa;
                        color: #8e24aa;
                    }
                    .btn-outline:hover {
                        background: #f3e5f5;
                    }
                    .actions {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 25px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .save-status {
                        color: #2e7d32;
                        font-size: 14px;
                        display: none;
                    }
                    .save-status.show {
                        display: inline;
                    }
                    @media print {
                        .header, .actions { display: none; }
                        .card { box-shadow: none; border: 1px solid #ddd; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧹 Cleaning Checklist</h1>
                    <div class="header-nav">
                        <a href="/security-services/cleaning-checklist">← Back to Checklists</a>
                        <a href="/security-services">Facility Management</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="checklist-header">
                            <div>
                                <div class="checklist-title">
                                    ${checklist.CategoryName}
                                    ${checklist.CategoryNameAr ? `<span style="font-size: 18px; color: #666;"> / ${checklist.CategoryNameAr}</span>` : ''}
                                </div>
                                <div class="checklist-subtitle">
                                    Week of ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                            <div>
                                <span class="badge badge-location">${checklist.LocationName}</span>
                                <span class="badge badge-category">${checklist.CategoryName}</span>
                            </div>
                        </div>
                        
                        <table class="checklist-table">
                            <thead>
                                <tr>
                                    <th style="width: 25%;">Cleaning Place<br><small>مكان التنظيف</small></th>
                                    <th style="width: 15%;">Frequency<br><small>تكرار التنظيف</small></th>
                                    ${days.map((day, idx) => `
                                        <th style="width: 12%;">${day}<br><small>${daysAr[idx]}</small><br><small>${dayDates[idx]}</small></th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${entries.length === 0 ? `
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                                            No items configured for this category. Please add items in Cleaning Reference first.
                                        </td>
                                    </tr>
                                ` : entries.map(entry => `
                                    <tr>
                                        <td>
                                            <div class="item-name">${entry.ItemName}</div>
                                            ${entry.ItemNameAr ? `<div class="item-name-ar">${entry.ItemNameAr}</div>` : ''}
                                        </td>
                                        <td>
                                            <span class="frequency-badge">${entry.Frequency}</span>
                                            ${entry.FrequencyAr ? `<br><span class="frequency-badge">${entry.FrequencyAr}</span>` : ''}
                                        </td>
                                        <td class="checkbox-cell">
                                            <input type="checkbox" data-entry="${entry.Id}" data-day="Monday" ${entry.Monday ? 'checked' : ''} onchange="saveCheck(this)">
                                        </td>
                                        <td class="checkbox-cell">
                                            <input type="checkbox" data-entry="${entry.Id}" data-day="Tuesday" ${entry.Tuesday ? 'checked' : ''} onchange="saveCheck(this)">
                                        </td>
                                        <td class="checkbox-cell">
                                            <input type="checkbox" data-entry="${entry.Id}" data-day="Wednesday" ${entry.Wednesday ? 'checked' : ''} onchange="saveCheck(this)">
                                        </td>
                                        <td class="checkbox-cell">
                                            <input type="checkbox" data-entry="${entry.Id}" data-day="Thursday" ${entry.Thursday ? 'checked' : ''} onchange="saveCheck(this)">
                                        </td>
                                        <td class="checkbox-cell">
                                            <input type="checkbox" data-entry="${entry.Id}" data-day="Friday" ${entry.Friday ? 'checked' : ''} onchange="saveCheck(this)">
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="actions">
                            <span class="save-status" id="saveStatus">✓ Saved</span>
                            <div>
                                <button class="btn btn-outline" onclick="window.print()">🖨️ Print</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    async function saveCheck(checkbox) {
                        const entryId = checkbox.dataset.entry;
                        const day = checkbox.dataset.day;
                        const checked = checkbox.checked;
                        
                        const statusEl = document.getElementById('saveStatus');
                        statusEl.textContent = 'Saving...';
                        statusEl.classList.add('show');
                        
                        try {
                            const res = await fetch('/security-services/cleaning-checklist/api/entry/' + entryId, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ day, checked })
                            });
                            
                            if (res.ok) {
                                statusEl.textContent = '✓ Saved';
                                setTimeout(() => statusEl.classList.remove('show'), 2000);
                            } else {
                                statusEl.textContent = '❌ Error saving';
                                checkbox.checked = !checked; // Revert
                            }
                        } catch (err) {
                            statusEl.textContent = '❌ Error saving';
                            checkbox.checked = !checked; // Revert
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        if (pool) await pool.close();
        console.error('Error loading checklist:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API to update checklist entry
router.put('/api/entry/:id', async (req, res) => {
    try {
        const { day, checked } = req.body;
        const entryId = req.params.id;
        const user = req.currentUser;
        
        // Validate day
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        if (!validDays.includes(day)) {
            return res.status(400).json({ error: 'Invalid day' });
        }
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, entryId)
            .input('value', sql.Bit, checked ? 1 : 0)
            .input('updatedBy', sql.NVarChar, user?.displayName || 'Unknown')
            .query(`
                UPDATE Security_CleaningChecklistEntries 
                SET ${day} = @value, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
                WHERE Id = @id
            `);
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating entry:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
