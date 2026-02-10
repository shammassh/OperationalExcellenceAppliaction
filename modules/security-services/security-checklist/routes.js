/**
 * Security Checklist Form
 * Weekly checklist entry for security staff
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

// Get Monday of the week for a given date
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// Security Checklist Form Page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get all active locations with subcategories
        const locationsResult = await pool.request()
            .query(`
                SELECT 
                    l.Id as LocationId,
                    l.LocationName,
                    sc.Id as SubCategoryId,
                    sc.SubCategoryName,
                    sc.HasAMShift,
                    sc.HasPMShift
                FROM Security_Checklist_Locations l
                INNER JOIN Security_Checklist_SubCategories sc ON sc.LocationId = l.Id
                WHERE l.IsActive = 1 AND sc.IsActive = 1
                ORDER BY l.SortOrder, l.LocationName, sc.SortOrder, sc.SubCategoryName
            `);
        
        await pool.close();
        
        // Group by location
        const locations = {};
        locationsResult.recordset.forEach(row => {
            if (!locations[row.LocationId]) {
                locations[row.LocationId] = {
                    id: row.LocationId,
                    name: row.LocationName,
                    subCategories: []
                };
            }
            locations[row.LocationId].subCategories.push({
                id: row.SubCategoryId,
                name: row.SubCategoryName,
                hasAM: row.HasAMShift,
                hasPM: row.HasPMShift
            });
        });
        
        // Build location options HTML
        let locationOptions = '<option value="">Select Location</option>';
        Object.values(locations).forEach(loc => {
            loc.subCategories.forEach(sub => {
                locationOptions += `<option value="${sub.id}" data-has-am="${sub.hasAM}" data-has-pm="${sub.hasPM}">${loc.name} - ${sub.name}</option>`;
            });
        });
        
        // Get current Monday
        const today = new Date();
        const monday = getMonday(today);
        const mondayStr = monday.toISOString().split('T')[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Security Checklist - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 1400px; margin: 0 auto; }
                    .header {
                        background: rgba(255,255,255,0.95);
                        border-radius: 15px;
                        padding: 25px 30px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .header h1 {
                        color: #333;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .header-nav a {
                        color: #1565c0;
                        text-decoration: none;
                        font-weight: 500;
                        margin-left: 20px;
                    }
                    .header-nav a:hover { text-decoration: underline; }
                    .form-card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .filter-row {
                        display: grid;
                        grid-template-columns: 200px 300px auto;
                        gap: 20px;
                        margin-bottom: 25px;
                        align-items: end;
                    }
                    .form-group {
                        display: flex;
                        flex-direction: column;
                    }
                    .form-group label {
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 8px;
                        font-size: 14px;
                    }
                    .form-group label .required { color: #e74c3c; }
                    .form-group input,
                    .form-group select {
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 15px;
                        transition: all 0.3s;
                    }
                    .form-group input:focus,
                    .form-group select:focus {
                        outline: none;
                        border-color: #1565c0;
                        box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.1);
                    }
                    .btn-load {
                        background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 10px;
                        font-size: 15px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        height: fit-content;
                    }
                    .btn-load:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(21, 101, 192, 0.4);
                    }
                    .checklist-container {
                        display: none;
                        margin-top: 20px;
                    }
                    .checklist-container.visible {
                        display: block;
                    }
                    .week-info {
                        background: #e3f2fd;
                        padding: 15px 20px;
                        border-radius: 10px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .week-info h3 {
                        color: #1565c0;
                        font-size: 16px;
                    }
                    .week-info span {
                        color: #666;
                        font-size: 14px;
                    }
                    .checklist-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    .checklist-table th {
                        background: #f8f9fa;
                        padding: 15px 10px;
                        text-align: center;
                        font-weight: 600;
                        color: #333;
                        border: 1px solid #e0e0e0;
                        font-size: 13px;
                    }
                    .checklist-table th:first-child {
                        text-align: left;
                        min-width: 250px;
                    }
                    .checklist-table td {
                        padding: 12px 10px;
                        border: 1px solid #e0e0e0;
                        text-align: center;
                        vertical-align: middle;
                    }
                    .checklist-table td:first-child {
                        text-align: left;
                        font-weight: 500;
                        background: #fafafa;
                    }
                    .item-name {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .expected-count {
                        background: #1565c0;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .shift-checkboxes {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 5px;
                    }
                    .shift-checkbox {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        font-size: 12px;
                        color: #666;
                    }
                    .shift-checkbox input[type="checkbox"] {
                        width: 18px;
                        height: 18px;
                        cursor: pointer;
                        accent-color: #1565c0;
                    }
                    .shift-checkbox.disabled {
                        opacity: 0.3;
                    }
                    .shift-checkbox.disabled input {
                        cursor: not-allowed;
                    }
                    .btn-submit {
                        background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
                        color: white;
                        border: none;
                        padding: 15px 50px;
                        border-radius: 10px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                    }
                    .btn-submit:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(46, 125, 50, 0.4);
                    }
                    .btn-submit:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                        transform: none;
                    }
                    .alert {
                        padding: 15px 20px;
                        border-radius: 10px;
                        margin-bottom: 20px;
                        display: none;
                    }
                    .alert-success {
                        background: #d1fae5;
                        color: #065f46;
                        border: 1px solid #a7f3d0;
                    }
                    .alert-error {
                        background: #fee2e2;
                        color: #991b1b;
                        border: 1px solid #fecaca;
                    }
                    .no-items {
                        text-align: center;
                        padding: 40px;
                        color: #666;
                    }
                    .no-items h3 {
                        margin-bottom: 10px;
                        color: #333;
                    }
                    .loading {
                        text-align: center;
                        padding: 40px;
                        color: #666;
                    }
                    .submit-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .notes-group {
                        flex: 1;
                        margin-right: 20px;
                    }
                    .notes-group textarea {
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 14px;
                        resize: vertical;
                        min-height: 60px;
                    }
                    .notes-group textarea:focus {
                        outline: none;
                        border-color: #1565c0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📋 Security Checklist</h1>
                        <div class="header-nav">
                            <a href="/security-services/security-checklist/history">📜 View History</a>
                            <a href="/security-services">← Security Services</a>
                        </div>
                    </div>
                    
                    <div class="form-card">
                        <div id="alertBox" class="alert"></div>
                        
                        <div class="filter-row">
                            <div class="form-group">
                                <label>Week Starting <span class="required">*</span></label>
                                <input type="date" id="weekStart" value="${mondayStr}">
                            </div>
                            <div class="form-group">
                                <label>Location <span class="required">*</span></label>
                                <select id="locationSelect">
                                    ${locationOptions}
                                </select>
                            </div>
                            <button class="btn-load" onclick="loadChecklist()">Load Checklist</button>
                        </div>
                        
                        <div id="checklistContainer" class="checklist-container">
                            <div id="checklistContent"></div>
                        </div>
                    </div>
                </div>
                
                <script>
                    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    let currentSubCategoryId = null;
                    let hasAM = true;
                    let hasPM = true;
                    
                    function showAlert(message, type) {
                        const alertBox = document.getElementById('alertBox');
                        alertBox.textContent = message;
                        alertBox.className = 'alert alert-' + type;
                        alertBox.style.display = 'block';
                        setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
                    }
                    
                    function getMonday(date) {
                        const d = new Date(date);
                        const day = d.getDay();
                        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                        return new Date(d.setDate(diff));
                    }
                    
                    // Adjust week start to Monday
                    document.getElementById('weekStart').addEventListener('change', function() {
                        const selectedDate = new Date(this.value);
                        const monday = getMonday(selectedDate);
                        this.value = monday.toISOString().split('T')[0];
                    });
                    
                    async function loadChecklist() {
                        const weekStart = document.getElementById('weekStart').value;
                        const locationSelect = document.getElementById('locationSelect');
                        const subCategoryId = locationSelect.value;
                        
                        if (!weekStart || !subCategoryId) {
                            showAlert('Please select week and location', 'error');
                            return;
                        }
                        
                        currentSubCategoryId = subCategoryId;
                        const selectedOption = locationSelect.options[locationSelect.selectedIndex];
                        hasAM = selectedOption.dataset.hasAm === 'true';
                        hasPM = selectedOption.dataset.hasPm === 'true';
                        
                        const container = document.getElementById('checklistContainer');
                        const content = document.getElementById('checklistContent');
                        container.classList.add('visible');
                        content.innerHTML = '<div class="loading">Loading checklist items...</div>';
                        
                        try {
                            const response = await fetch('/security-services/security-checklist/items/' + subCategoryId + '?weekStart=' + weekStart);
                            const data = await response.json();
                            
                            if (!data.success) {
                                content.innerHTML = '<div class="no-items"><h3>Error</h3><p>' + data.message + '</p></div>';
                                return;
                            }
                            
                            if (data.items.length === 0) {
                                content.innerHTML = '<div class="no-items"><h3>No Items Found</h3><p>No checklist items have been configured for this location. Please contact the supervisor to set up the checklist reference.</p></div>';
                                return;
                            }
                            
                            renderChecklist(data, weekStart);
                        } catch (err) {
                            content.innerHTML = '<div class="no-items"><h3>Error</h3><p>' + err.message + '</p></div>';
                        }
                    }
                    
                    function renderChecklist(data, weekStart) {
                        const content = document.getElementById('checklistContent');
                        const locationName = document.getElementById('locationSelect').options[document.getElementById('locationSelect').selectedIndex].text;
                        
                        // Calculate week end date
                        const startDate = new Date(weekStart);
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 6);
                        
                        const formatDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                        
                        let html = \`
                            <div class="week-info">
                                <h3>📍 \${locationName}</h3>
                                <span>Week: \${formatDate(startDate)} - \${formatDate(endDate)}</span>
                            </div>
                            <form id="checklistForm">
                                <table class="checklist-table">
                                    <thead>
                                        <tr>
                                            <th>Checklist Item</th>
                        \`;
                        
                        // Add day headers
                        days.forEach(day => {
                            html += '<th>' + day + '</th>';
                        });
                        
                        html += '</tr></thead><tbody>';
                        
                        // Add rows for each item
                        data.items.forEach(item => {
                            html += '<tr>';
                            html += '<td><div class="item-name">' + item.ItemName;
                            if (item.ExpectedCount) {
                                html += ' <span class="expected-count">' + item.ExpectedCount + '</span>';
                            }
                            html += '</div></td>';
                            
                            // Add checkboxes for each day
                            for (let d = 1; d <= 7; d++) {
                                const existing = data.entries.find(e => e.ItemId === item.Id && e.DayOfWeek === d);
                                const amChecked = existing ? existing.AMChecked : false;
                                const pmChecked = existing ? existing.PMChecked : false;
                                
                                html += '<td><div class="shift-checkboxes">';
                                
                                // AM checkbox
                                if (hasAM) {
                                    html += \`<label class="shift-checkbox">
                                        <input type="checkbox" name="item_\${item.Id}_day_\${d}_am" \${amChecked ? 'checked' : ''}>
                                        AM
                                    </label>\`;
                                }
                                
                                // PM checkbox
                                if (hasPM) {
                                    html += \`<label class="shift-checkbox">
                                        <input type="checkbox" name="item_\${item.Id}_day_\${d}_pm" \${pmChecked ? 'checked' : ''}>
                                        PM
                                    </label>\`;
                                }
                                
                                if (!hasAM && !hasPM) {
                                    html += '<span style="color:#999">—</span>';
                                }
                                
                                html += '</div></td>';
                            }
                            
                            html += '</tr>';
                        });
                        
                        html += \`
                                    </tbody>
                                </table>
                                
                                <div class="submit-row">
                                    <div class="notes-group">
                                        <textarea id="notes" placeholder="Additional notes (optional)...">\${data.existingEntry?.Notes || ''}</textarea>
                                    </div>
                                    <button type="submit" class="btn-submit" id="submitBtn">
                                        \${data.existingEntry ? 'Update Checklist' : 'Save Checklist'}
                                    </button>
                                </div>
                            </form>
                        \`;
                        
                        content.innerHTML = html;
                        
                        // Form submit handler
                        document.getElementById('checklistForm').addEventListener('submit', saveChecklist);
                    }
                    
                    async function saveChecklist(e) {
                        e.preventDefault();
                        
                        const weekStart = document.getElementById('weekStart').value;
                        const notes = document.getElementById('notes').value;
                        const form = document.getElementById('checklistForm');
                        const submitBtn = document.getElementById('submitBtn');
                        
                        // Collect all checkbox values
                        const entries = [];
                        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
                        const itemDays = {};
                        
                        checkboxes.forEach(cb => {
                            const match = cb.name.match(/item_(\\d+)_day_(\\d+)_(am|pm)/);
                            if (match) {
                                const itemId = match[1];
                                const day = match[2];
                                const shift = match[3];
                                const key = itemId + '_' + day;
                                
                                if (!itemDays[key]) {
                                    itemDays[key] = { itemId: parseInt(itemId), day: parseInt(day), am: false, pm: false };
                                }
                                
                                if (shift === 'am') itemDays[key].am = cb.checked;
                                if (shift === 'pm') itemDays[key].pm = cb.checked;
                            }
                        });
                        
                        Object.values(itemDays).forEach(entry => {
                            entries.push({
                                itemId: entry.itemId,
                                dayOfWeek: entry.day,
                                amChecked: entry.am,
                                pmChecked: entry.pm
                            });
                        });
                        
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Saving...';
                        
                        try {
                            const response = await fetch('/security-services/security-checklist/save', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    subCategoryId: currentSubCategoryId,
                                    weekStart: weekStart,
                                    notes: notes,
                                    entries: entries
                                })
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showAlert('Checklist saved successfully!', 'success');
                                submitBtn.textContent = 'Update Checklist';
                            } else {
                                showAlert(result.message || 'Error saving checklist', 'error');
                            }
                        } catch (err) {
                            showAlert('Error: ' + err.message, 'error');
                        }
                        
                        submitBtn.disabled = false;
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading security checklist:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

// Get checklist items for a subcategory
router.get('/items/:subCategoryId', async (req, res) => {
    const subCategoryId = req.params.subCategoryId;
    const weekStart = req.query.weekStart;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get items for this subcategory
        const itemsResult = await pool.request()
            .input('subCategoryId', sql.Int, subCategoryId)
            .query(`
                SELECT Id, ItemName, ExpectedCount, SortOrder
                FROM Security_Checklist_Items
                WHERE SubCategoryId = @subCategoryId AND IsActive = 1
                ORDER BY SortOrder, ItemName
            `);
        
        // Get existing entry if any
        let existingEntry = null;
        let entries = [];
        
        if (weekStart) {
            const entryResult = await pool.request()
                .input('subCategoryId', sql.Int, subCategoryId)
                .input('weekStart', sql.Date, weekStart)
                .query(`
                    SELECT Id, Notes, FilledBy, CreatedAt
                    FROM Security_Checklist_Entries
                    WHERE SubCategoryId = @subCategoryId AND WeekStartDate = @weekStart AND Status = 'Active'
                `);
            
            if (entryResult.recordset.length > 0) {
                existingEntry = entryResult.recordset[0];
                
                // Get entry details
                const detailsResult = await pool.request()
                    .input('entryId', sql.Int, existingEntry.Id)
                    .query(`
                        SELECT ItemId, DayOfWeek, AMChecked, PMChecked
                        FROM Security_Checklist_EntryDetails
                        WHERE EntryId = @entryId
                    `);
                
                entries = detailsResult.recordset;
            }
        }
        
        await pool.close();
        
        res.json({
            success: true,
            items: itemsResult.recordset,
            existingEntry: existingEntry,
            entries: entries
        });
    } catch (err) {
        console.error('Error getting checklist items:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// Save checklist
router.post('/save', async (req, res) => {
    const user = req.currentUser;
    const { subCategoryId, weekStart, notes, entries } = req.body;
    
    if (!subCategoryId || !weekStart || !entries) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            // Check for existing entry
            const existingResult = await transaction.request()
                .input('subCategoryId', sql.Int, subCategoryId)
                .input('weekStart', sql.Date, weekStart)
                .query(`
                    SELECT Id FROM Security_Checklist_Entries
                    WHERE SubCategoryId = @subCategoryId AND WeekStartDate = @weekStart AND Status = 'Active'
                `);
            
            let entryId;
            
            if (existingResult.recordset.length > 0) {
                // Update existing entry
                entryId = existingResult.recordset[0].Id;
                
                await transaction.request()
                    .input('id', sql.Int, entryId)
                    .input('notes', sql.NVarChar, notes || '')
                    .input('filledBy', sql.NVarChar, user.displayName)
                    .input('filledById', sql.NVarChar, user.id)
                    .query(`
                        UPDATE Security_Checklist_Entries
                        SET Notes = @notes, FilledBy = @filledBy, FilledById = @filledById, UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);
                
                // Delete existing details
                await transaction.request()
                    .input('entryId', sql.Int, entryId)
                    .query(`DELETE FROM Security_Checklist_EntryDetails WHERE EntryId = @entryId`);
            } else {
                // Create new entry
                const insertResult = await transaction.request()
                    .input('subCategoryId', sql.Int, subCategoryId)
                    .input('weekStart', sql.Date, weekStart)
                    .input('notes', sql.NVarChar, notes || '')
                    .input('filledBy', sql.NVarChar, user.displayName)
                    .input('filledById', sql.NVarChar, user.id)
                    .query(`
                        INSERT INTO Security_Checklist_Entries (SubCategoryId, WeekStartDate, Notes, FilledBy, FilledById)
                        OUTPUT INSERTED.Id
                        VALUES (@subCategoryId, @weekStart, @notes, @filledBy, @filledById)
                    `);
                
                entryId = insertResult.recordset[0].Id;
            }
            
            // Insert entry details
            for (const entry of entries) {
                await transaction.request()
                    .input('entryId', sql.Int, entryId)
                    .input('itemId', sql.Int, entry.itemId)
                    .input('dayOfWeek', sql.Int, entry.dayOfWeek)
                    .input('amChecked', sql.Bit, entry.amChecked)
                    .input('pmChecked', sql.Bit, entry.pmChecked)
                    .query(`
                        INSERT INTO Security_Checklist_EntryDetails (EntryId, ItemId, DayOfWeek, AMChecked, PMChecked)
                        VALUES (@entryId, @itemId, @dayOfWeek, @amChecked, @pmChecked)
                    `);
            }
            
            await transaction.commit();
            await pool.close();
            
            res.json({ success: true, entryId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Error saving checklist:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// View checklist history
router.get('/history', async (req, res) => {
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`
                SELECT 
                    e.Id,
                    e.WeekStartDate,
                    e.FilledBy,
                    e.CreatedAt,
                    e.UpdatedAt,
                    l.LocationName,
                    sc.SubCategoryName,
                    (SELECT COUNT(*) FROM Security_Checklist_EntryDetails WHERE EntryId = e.Id AND (AMChecked = 1 OR PMChecked = 1)) as CheckedCount
                FROM Security_Checklist_Entries e
                INNER JOIN Security_Checklist_SubCategories sc ON sc.Id = e.SubCategoryId
                INNER JOIN Security_Checklist_Locations l ON l.Id = sc.LocationId
                WHERE e.Status = 'Active'
                ORDER BY e.WeekStartDate DESC, l.LocationName, sc.SubCategoryName
            `);
        
        await pool.close();
        
        const entries = result.recordset;
        
        let tableRows = entries.map(e => {
            const weekStart = new Date(e.WeekStartDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const formatDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            
            return `
                <tr>
                    <td>${formatDate(weekStart)} - ${formatDate(weekEnd)}, ${weekStart.getFullYear()}</td>
                    <td><span class="location-badge">${e.LocationName} - ${e.SubCategoryName}</span></td>
                    <td>${e.FilledBy}</td>
                    <td><span class="count-badge">${e.CheckedCount}</span></td>
                    <td>${new Date(e.UpdatedAt || e.CreatedAt).toLocaleDateString('en-GB')}</td>
                    <td>
                        <button class="btn-view" onclick="viewEntry(${e.Id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        if (entries.length === 0) {
            tableRows = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#666;">No checklist entries found</td></tr>';
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Checklist History - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
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
                        opacity: 0.9;
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
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-weight: 600;
                        color: #333;
                        border-bottom: 2px solid #e0e0e0;
                    }
                    td {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    tr:hover { background: #f8f9fa; }
                    .location-badge {
                        background: #e3f2fd;
                        color: #1565c0;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 13px;
                        font-weight: 500;
                    }
                    .count-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 13px;
                        font-weight: 600;
                    }
                    .btn-view {
                        background: #1565c0;
                        color: white;
                        border: none;
                        padding: 8px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    .btn-view:hover {
                        background: #0d47a1;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Checklist History</h1>
                    <div class="header-nav">
                        <a href="/security-services/security-checklist">← New Entry</a>
                        <a href="/security">Security Department</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <table>
                            <thead>
                                <tr>
                                    <th>Week</th>
                                    <th>Location</th>
                                    <th>Filled By</th>
                                    <th>Checked Items</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <script>
                    function viewEntry(id) {
                        window.location.href = '/security-services/security-checklist/view/' + id;
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading history:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

// View single checklist entry
router.get('/view/:id', async (req, res) => {
    const user = req.currentUser;
    const entryId = req.params.id;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get entry info
        const entryResult = await pool.request()
            .input('id', sql.Int, entryId)
            .query(`
                SELECT 
                    e.*,
                    l.LocationName,
                    sc.SubCategoryName,
                    sc.HasAMShift,
                    sc.HasPMShift
                FROM Security_Checklist_Entries e
                INNER JOIN Security_Checklist_SubCategories sc ON sc.Id = e.SubCategoryId
                INNER JOIN Security_Checklist_Locations l ON l.Id = sc.LocationId
                WHERE e.Id = @id
            `);
        
        if (entryResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Entry not found');
        }
        
        const entry = entryResult.recordset[0];
        
        // Get items for this subcategory
        const itemsResult = await pool.request()
            .input('subCategoryId', sql.Int, entry.SubCategoryId)
            .query(`
                SELECT Id, ItemName, ExpectedCount
                FROM Security_Checklist_Items
                WHERE SubCategoryId = @subCategoryId AND IsActive = 1
                ORDER BY SortOrder, ItemName
            `);
        
        // Get entry details
        const detailsResult = await pool.request()
            .input('entryId', sql.Int, entryId)
            .query(`
                SELECT ItemId, DayOfWeek, AMChecked, PMChecked
                FROM Security_Checklist_EntryDetails
                WHERE EntryId = @entryId
            `);
        
        await pool.close();
        
        const items = itemsResult.recordset;
        const details = detailsResult.recordset;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        // Calculate week dates
        const weekStart = new Date(entry.WeekStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const formatDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        // Build table rows
        let tableRows = items.map(item => {
            let row = '<tr>';
            row += '<td class="item-cell"><span class="item-name">' + item.ItemName + '</span>';
            if (item.ExpectedCount) {
                row += ' <span class="expected-count">' + item.ExpectedCount + '</span>';
            }
            row += '</td>';
            
            for (let d = 1; d <= 7; d++) {
                const detail = details.find(det => det.ItemId === item.Id && det.DayOfWeek === d);
                const amChecked = detail ? detail.AMChecked : false;
                const pmChecked = detail ? detail.PMChecked : false;
                
                row += '<td class="check-cell">';
                if (entry.HasAMShift) {
                    row += '<div class="shift-status ' + (amChecked ? 'checked' : 'unchecked') + '">AM ' + (amChecked ? '✓' : '✗') + '</div>';
                }
                if (entry.HasPMShift) {
                    row += '<div class="shift-status ' + (pmChecked ? 'checked' : 'unchecked') + '">PM ' + (pmChecked ? '✓' : '✗') + '</div>';
                }
                row += '</td>';
            }
            
            row += '</tr>';
            return row;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>View Checklist - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
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
                        opacity: 0.9;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { 
                        max-width: 1400px; 
                        margin: 0 auto; 
                        padding: 30px 20px; 
                    }
                    .info-card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        margin-bottom: 20px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                    }
                    .info-item label {
                        display: block;
                        font-size: 12px;
                        color: #888;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    .info-item span {
                        font-size: 16px;
                        font-weight: 600;
                        color: #333;
                    }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        overflow-x: auto;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        min-width: 900px;
                    }
                    th {
                        background: #f8f9fa;
                        padding: 12px 10px;
                        text-align: center;
                        font-weight: 600;
                        color: #333;
                        border: 1px solid #e0e0e0;
                        font-size: 13px;
                    }
                    th:first-child {
                        text-align: left;
                        min-width: 200px;
                    }
                    td {
                        padding: 10px;
                        border: 1px solid #e0e0e0;
                        text-align: center;
                        vertical-align: middle;
                    }
                    .item-cell {
                        text-align: left;
                        background: #fafafa;
                    }
                    .item-name {
                        font-weight: 500;
                    }
                    .expected-count {
                        background: #1565c0;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                        margin-left: 8px;
                    }
                    .check-cell {
                        padding: 5px;
                    }
                    .shift-status {
                        font-size: 11px;
                        padding: 3px 8px;
                        border-radius: 4px;
                        margin: 2px 0;
                    }
                    .shift-status.checked {
                        background: #d1fae5;
                        color: #065f46;
                    }
                    .shift-status.unchecked {
                        background: #fee2e2;
                        color: #991b1b;
                    }
                    .notes-section {
                        margin-top: 20px;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                    }
                    .notes-section h4 {
                        color: #333;
                        margin-bottom: 10px;
                    }
                    .notes-section p {
                        color: #666;
                        line-height: 1.6;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 View Checklist</h1>
                    <div class="header-nav">
                        <a href="/security-services/security-checklist/history">← Back to History</a>
                        <a href="/security-services/security-checklist">New Entry</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="info-card">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Location</label>
                                <span>${entry.LocationName} - ${entry.SubCategoryName}</span>
                            </div>
                            <div class="info-item">
                                <label>Week</label>
                                <span>${formatDate(weekStart)} - ${formatDate(weekEnd)}</span>
                            </div>
                            <div class="info-item">
                                <label>Filled By</label>
                                <span>${entry.FilledBy}</span>
                            </div>
                            <div class="info-item">
                                <label>Submitted</label>
                                <span>${new Date(entry.CreatedAt).toLocaleDateString('en-GB')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <table>
                            <thead>
                                <tr>
                                    <th>Checklist Item</th>
                                    ${days.map(d => '<th>' + d + '</th>').join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                        
                        ${entry.Notes ? `
                            <div class="notes-section">
                                <h4>📝 Notes</h4>
                                <p>${entry.Notes}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing checklist:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
