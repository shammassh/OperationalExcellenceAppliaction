/**
 * Entrance Form Routes
 * Security Services - Worker Entrance Management
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

// Entrance Form - Main Page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    const today = new Date().toISOString().split('T')[0];
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Workers Entrance Form - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: #f0f2f5;
                    min-height: 100vh;
                }
                .header {
                    background: linear-gradient(135deg, #6a1b9a 0%, #4a148c 100%);
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
                    transition: opacity 0.3s;
                }
                .header-nav a:hover { opacity: 1; }
                .container { 
                    max-width: 1000px; 
                    margin: 0 auto; 
                    padding: 30px 20px; 
                }
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
                    transition: all 0.3s;
                }
                .tab.active {
                    background: #6a1b9a;
                    color: white;
                }
                .tab:hover:not(.active) {
                    background: #f3e5f5;
                }
                .card {
                    background: white;
                    border-radius: 0 15px 15px 15px;
                    padding: 30px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                }
                .form-section {
                    margin-bottom: 25px;
                    padding-bottom: 25px;
                    border-bottom: 1px solid #eee;
                }
                .form-section:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 15px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                }
                .form-group label {
                    font-size: 13px;
                    font-weight: 500;
                    color: #555;
                    margin-bottom: 6px;
                }
                .form-group .label-ar {
                    font-size: 12px;
                    color: #888;
                    direction: rtl;
                }
                .form-group input,
                .form-group select {
                    padding: 12px 15px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.3s;
                }
                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: #6a1b9a;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                .items-table th {
                    background: #f8f9fa;
                    padding: 12px;
                    text-align: left;
                    font-size: 13px;
                    font-weight: 600;
                    color: #555;
                    border-bottom: 2px solid #dee2e6;
                }
                .items-table td {
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                }
                .items-table input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .items-table input:focus {
                    outline: none;
                    border-color: #6a1b9a;
                }
                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.3s;
                }
                .btn-success {
                    background: #6a1b9a;
                    color: white;
                }
                .btn-success:hover {
                    background: #4a148c;
                }
                .btn-danger {
                    background: #c62828;
                    color: white;
                    padding: 8px 12px;
                }
                .btn-danger:hover {
                    background: #b71c1c;
                }
                .btn-outline {
                    background: white;
                    border: 2px solid #6a1b9a;
                    color: #6a1b9a;
                }
                .btn-outline:hover {
                    background: #f3e5f5;
                }
                .actions-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 25px;
                    padding-top: 25px;
                    border-top: 1px solid #eee;
                }
                .alert {
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    display: none;
                }
                .alert-success {
                    background: #e8f5e9;
                    color: #2e7d32;
                    border: 1px solid #a5d6a7;
                }
                .alert-error {
                    background: #ffebee;
                    color: #c62828;
                    border: 1px solid #ef9a9a;
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: block;
                }
                .log-list {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .log-item {
                    background: #f8f9fa;
                    border-radius: 10px;
                    padding: 20px;
                    border-left: 4px solid #6a1b9a;
                    transition: all 0.3s;
                    cursor: pointer;
                }
                .log-item:hover {
                    background: #f3e5f5;
                }
                .log-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .log-item-date {
                    font-weight: 600;
                    font-size: 16px;
                }
                .log-item-entrance {
                    background: #6a1b9a;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                }
                .log-item-meta {
                    color: #666;
                    font-size: 13px;
                }
                .empty-state {
                    text-align: center;
                    padding: 60px;
                    color: #666;
                }
                .empty-state-icon {
                    font-size: 60px;
                    margin-bottom: 15px;
                }
                .filter-row {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .filter-row .form-group {
                    min-width: 180px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚪 Workers Entrance Form - نموذج الدخول</h1>
                <div class="header-nav">
                    <a href="/security-services">← Security Services</a>
                    <a href="/dashboard">Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div id="alertBox" class="alert"></div>
                
                <div class="tabs">
                    <button class="tab active" onclick="showTab('new')">➕ New Entry</button>
                    <button class="tab" onclick="showTab('history')">📋 History</button>
                </div>
                
                <!-- New Entry Tab -->
                <div id="tab-new" class="tab-content active">
                    <div class="card">
                        <form id="entranceForm">
                            <div class="form-section">
                                <div class="section-title">📋 Form Information</div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Date</label>
                                        <input type="date" id="formDate" name="formDate" value="${today}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Entrance *</label>
                                        <select id="entrance" name="entrance" required>
                                            <option value="">-- Select Entrance --</option>
                                            <option value="Lower Entrance">Lower Entrance</option>
                                            <option value="Upper Entrance">Upper Entrance</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Location *</label>
                                        <select id="location" name="location" required>
                                            <option value="">-- Select Location --</option>
                                            <option value="HO Zouk">HO Zouk</option>
                                            <option value="HO Dbayeh">HO Dbayeh</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <div class="section-title">
                                    👷 Worker Entries
                                    <button type="button" class="btn btn-outline" onclick="addEntry()" style="margin-left: auto; padding: 8px 16px; font-size: 13px;">
                                        + Add Entry
                                    </button>
                                </div>
                                <table class="items-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 5%;">#</th>
                                            <th style="width: 20%;">Full Name<br><span style="font-size: 11px; color: #888;">الإسم الكامل</span></th>
                                            <th style="width: 18%;">Contractor<br><span style="font-size: 11px; color: #888;">المتعهد</span></th>
                                            <th style="width: 12%;">Time In<br><span style="font-size: 11px; color: #888;">وقت الدخول</span></th>
                                            <th style="width: 12%;">Time Out<br><span style="font-size: 11px; color: #888;">وقت الخروج</span></th>
                                            <th style="width: 18%;">Guard Name<br><span style="font-size: 11px; color: #888;">إسم الحارس</span></th>
                                            <th style="width: 5%;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="entriesBody">
                                        <tr data-row="1">
                                            <td>1</td>
                                            <td><input type="text" name="entries[0][fullName]" placeholder="Full name" required></td>
                                            <td><input type="text" name="entries[0][contractor]" placeholder="Contractor"></td>
                                            <td><input type="time" name="entries[0][timeIn]" required></td>
                                            <td><input type="time" name="entries[0][timeOut]"></td>
                                            <td><input type="text" name="entries[0][guardName]" placeholder="Guard name" required></td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="actions-bar">
                                <span style="color: #666; font-size: 13px;">* Required fields</span>
                                <button type="submit" class="btn btn-success">💾 Save Workers Entrance Form</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- History Tab -->
                <div id="tab-history" class="tab-content">
                    <div class="card">
                        <div class="filter-row">
                            <div class="form-group">
                                <label>From Date</label>
                                <input type="date" id="filterFromDate" onchange="loadHistory()">
                            </div>
                            <div class="form-group">
                                <label>To Date</label>
                                <input type="date" id="filterToDate" onchange="loadHistory()">
                            </div>
                            <div class="form-group">
                                <label>Entrance</label>
                                <select id="filterEntrance" onchange="loadHistory()">
                                    <option value="">All Entrances</option>
                                    <option value="Lower Entrance">Lower Entrance</option>
                                    <option value="Upper Entrance">Upper Entrance</option>
                                </select>
                            </div>
                        </div>
                        <div id="historyList" class="log-list">
                            <div class="empty-state">
                                <div class="empty-state-icon">📋</div>
                                <p>Loading history...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                let entryCount = 1;
                
                function showTab(tab) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    event.target.classList.add('active');
                    
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    document.getElementById('tab-' + tab).classList.add('active');
                    
                    if (tab === 'history') {
                        loadHistory();
                    }
                }
                
                function addEntry() {
                    entryCount++;
                    const tbody = document.getElementById('entriesBody');
                    const row = document.createElement('tr');
                    row.dataset.row = entryCount;
                    row.innerHTML = 
                        '<td>' + entryCount + '</td>' +
                        '<td><input type="text" name="entries[' + (entryCount-1) + '][fullName]" placeholder="Full name" required></td>' +
                        '<td><input type="text" name="entries[' + (entryCount-1) + '][contractor]" placeholder="Contractor"></td>' +
                        '<td><input type="time" name="entries[' + (entryCount-1) + '][timeIn]" required></td>' +
                        '<td><input type="time" name="entries[' + (entryCount-1) + '][timeOut]"></td>' +
                        '<td><input type="text" name="entries[' + (entryCount-1) + '][guardName]" placeholder="Guard name" required></td>' +
                        '<td><button type="button" class="btn btn-danger" onclick="removeEntry(this)">✕</button></td>';
                    tbody.appendChild(row);
                }
                
                function removeEntry(btn) {
                    btn.closest('tr').remove();
                    renumberEntries();
                }
                
                function renumberEntries() {
                    const rows = document.querySelectorAll('#entriesBody tr');
                    rows.forEach((row, index) => {
                        row.querySelector('td:first-child').textContent = index + 1;
                        row.querySelectorAll('input').forEach(input => {
                            input.name = input.name.replace(/entries\\[\\d+\\]/, 'entries[' + index + ']');
                        });
                    });
                    entryCount = rows.length;
                }
                
                function showAlert(message, type) {
                    const alertBox = document.getElementById('alertBox');
                    alertBox.textContent = message;
                    alertBox.className = 'alert alert-' + type;
                    alertBox.style.display = 'block';
                    setTimeout(() => alertBox.style.display = 'none', 5000);
                }
                
                document.getElementById('entranceForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const entries = [];
                    let hasValidationError = false;
                    
                    document.querySelectorAll('#entriesBody tr').forEach((row, index) => {
                        const fullNameInput = row.querySelector('input[name="entries[' + index + '][fullName]"]');
                        const contractorInput = row.querySelector('input[name="entries[' + index + '][contractor]"]');
                        const timeInInput = row.querySelector('input[name="entries[' + index + '][timeIn]"]');
                        const timeOutInput = row.querySelector('input[name="entries[' + index + '][timeOut]"]');
                        const guardNameInput = row.querySelector('input[name="entries[' + index + '][guardName]"]');
                        
                        const fullName = fullNameInput?.value?.trim();
                        const contractor = contractorInput?.value?.trim();
                        const timeIn = timeInInput?.value;
                        const timeOut = timeOutInput?.value;
                        const guardName = guardNameInput?.value?.trim();
                        
                        // Reset border styles
                        [fullNameInput, timeInInput, guardNameInput].forEach(input => {
                            if (input) input.style.borderColor = '#ddd';
                        });
                        
                        // Check if row has any data
                        if (fullName || contractor || timeIn || timeOut || guardName) {
                            // Validate required fields
                            if (!fullName) {
                                fullNameInput.style.borderColor = '#c62828';
                                hasValidationError = true;
                            }
                            if (!timeIn) {
                                timeInInput.style.borderColor = '#c62828';
                                hasValidationError = true;
                            }
                            if (!guardName) {
                                guardNameInput.style.borderColor = '#c62828';
                                hasValidationError = true;
                            }
                            if (fullName && timeIn && guardName) {
                                entries.push({ fullName, contractor, timeIn, timeOut, guardName });
                            }
                        }
                    });
                    
                    if (hasValidationError) {
                        showAlert('Please fill in Full Name, Time In, and Guard Name for all entries', 'error');
                        return;
                    }
                    
                    if (entries.length === 0) {
                        showAlert('Please add at least one worker entry', 'error');
                        return;
                    }
                    
                    const data = {
                        formDate: document.getElementById('formDate').value,
                        entrance: document.getElementById('entrance').value,
                        location: document.getElementById('location').value,
                        entries: entries
                    };
                    
                    try {
                        const res = await fetch('/security-services/entrance-form/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await res.json();
                        
                        if (result.success) {
                            showAlert('Entrance form saved successfully!', 'success');
                            // Reset form
                            document.getElementById('entranceForm').reset();
                            document.getElementById('formDate').value = '${today}';
                            document.getElementById('entriesBody').innerHTML = 
                                '<tr data-row="1">' +
                                    '<td>1</td>' +
                                    '<td><input type="text" name="entries[0][fullName]" placeholder="Full name" required></td>' +
                                    '<td><input type="text" name="entries[0][contractor]" placeholder="Contractor"></td>' +
                                    '<td><input type="time" name="entries[0][timeIn]" required></td>' +
                                    '<td><input type="time" name="entries[0][timeOut]"></td>' +
                                    '<td><input type="text" name="entries[0][guardName]" placeholder="Guard name" required></td>' +
                                    '<td></td>' +
                                '</tr>';
                            entryCount = 1;
                        } else {
                            showAlert(result.error || 'Failed to save entrance form', 'error');
                        }
                    } catch (err) {
                        showAlert('Error saving entrance form: ' + err.message, 'error');
                    }
                });
                
                async function loadHistory() {
                    const fromDate = document.getElementById('filterFromDate').value;
                    const toDate = document.getElementById('filterToDate').value;
                    const entrance = document.getElementById('filterEntrance').value;
                    
                    let url = '/security-services/entrance-form/list?';
                    if (fromDate) url += 'fromDate=' + fromDate + '&';
                    if (toDate) url += 'toDate=' + toDate + '&';
                    if (entrance) url += 'entrance=' + encodeURIComponent(entrance);
                    
                    try {
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        const container = document.getElementById('historyList');
                        
                        if (!data.forms || data.forms.length === 0) {
                            container.innerHTML = 
                                '<div class="empty-state">' +
                                    '<div class="empty-state-icon">📋</div>' +
                                    '<p>No entrance forms found</p>' +
                                '</div>';
                            return;
                        }
                        
                        container.innerHTML = data.forms.map(form => {
                            const formDate = new Date(form.FormDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            return '<div class="log-item" onclick="viewForm(' + form.Id + ')">' +
                                '<div class="log-item-header">' +
                                    '<span class="log-item-date">' + formDate + '</span>' +
                                    '<span class="log-item-entrance">' + form.Entrance + '</span>' +
                                '</div>' +
                                '<div class="log-item-meta">' +
                                    '<span>📍 ' + form.Location + '</span>' +
                                    '<span style="margin-left: 20px;">👷 ' + form.EntryCount + ' worker(s)</span>' +
                                '</div>' +
                            '</div>';
                        }).join('');
                    } catch (err) {
                        console.error('Error loading history:', err);
                    }
                }
                
                function viewForm(id) {
                    window.location.href = '/security-services/entrance-form/' + id;
                }
            </script>
        </body>
        </html>
    `);
});

// API: Save Entrance Form
router.post('/save', async (req, res) => {
    try {
        const { formDate, entrance, location, entries } = req.body;
        const user = req.currentUser;
        
        if (!formDate || !entrance || !location) {
            return res.json({ success: false, error: 'Missing required fields' });
        }
        
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.json({ success: false, error: 'Please add at least one worker entry' });
        }
        
        // Validate each entry has required fields
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const validEntries = entries.filter(entry => 
            entry.fullName && entry.fullName.trim() && 
            entry.timeIn && timeRegex.test(entry.timeIn) &&
            entry.guardName && entry.guardName.trim()
        );
        
        if (validEntries.length === 0) {
            return res.json({ success: false, error: 'Each entry must have Full Name, Time In, and Guard Name' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Insert main form
        const formResult = await pool.request()
            .input('formDate', sql.Date, formDate)
            .input('entrance', sql.NVarChar, entrance)
            .input('location', sql.NVarChar, location)
            .input('createdBy', sql.NVarChar, user.displayName)
            .input('createdById', sql.Int, user.id)
            .query(`
                INSERT INTO Security_EntranceForms (FormDate, Entrance, Location, CreatedBy, CreatedById)
                OUTPUT INSERTED.Id
                VALUES (@formDate, @entrance, @location, @createdBy, @createdById)
            `);
        
        const formId = formResult.recordset[0].Id;
        
        // Insert entries
        for (let i = 0; i < validEntries.length; i++) {
            const entry = validEntries[i];
            const timeInValue = entry.timeIn.length === 5 ? entry.timeIn + ':00' : entry.timeIn;
            const timeOutValue = entry.timeOut ? (entry.timeOut.length === 5 ? entry.timeOut + ':00' : entry.timeOut) : null;
            
            await pool.request()
                .input('entranceFormId', sql.Int, formId)
                .input('fullName', sql.NVarChar, entry.fullName)
                .input('contractor', sql.NVarChar, entry.contractor || '')
                .input('timeIn', sql.NVarChar, timeInValue)
                .input('timeOut', sql.NVarChar, timeOutValue)
                .input('guardName', sql.NVarChar, entry.guardName)
                .input('entryOrder', sql.Int, i + 1)
                .query(`
                    INSERT INTO Security_EntranceEntries (EntranceFormId, FullName, Contractor, TimeIn, TimeOut, GuardName, EntryOrder)
                    VALUES (@entranceFormId, @fullName, @contractor, CAST(@timeIn AS TIME), ${timeOutValue ? 'CAST(@timeOut AS TIME)' : 'NULL'}, @guardName, @entryOrder)
                `);
        }
        
        await pool.close();
        res.json({ success: true, formId });
    } catch (err) {
        console.error('Error saving entrance form:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Get Entrance Forms (with filters)
router.get('/list', async (req, res) => {
    try {
        const { fromDate, toDate, entrance } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT ef.*, 
                   (SELECT COUNT(*) FROM Security_EntranceEntries WHERE EntranceFormId = ef.Id) as EntryCount
            FROM Security_EntranceForms ef
            WHERE ef.Status = 'Active'
        `;
        
        const request = pool.request();
        
        if (fromDate) {
            query += ' AND ef.FormDate >= @fromDate';
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ' AND ef.FormDate <= @toDate';
            request.input('toDate', sql.Date, toDate);
        }
        if (entrance) {
            query += ' AND ef.Entrance = @entrance';
            request.input('entrance', sql.NVarChar, entrance);
        }
        
        query += ' ORDER BY ef.FormDate DESC, ef.CreatedAt DESC';
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ forms: result.recordset });
    } catch (err) {
        console.error('Error fetching entrance forms:', err);
        res.json({ forms: [], error: err.message });
    }
});

// View Single Entrance Form
router.get('/:id', async (req, res) => {
    try {
        const formId = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        // Get form details
        const formResult = await pool.request()
            .input('id', sql.Int, formId)
            .query('SELECT * FROM Security_EntranceForms WHERE Id = @id');
        
        if (formResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Entrance form not found');
        }
        
        const form = formResult.recordset[0];
        
        // Get entries
        const entriesResult = await pool.request()
            .input('formId', sql.Int, formId)
            .query('SELECT * FROM Security_EntranceEntries WHERE EntranceFormId = @formId ORDER BY EntryOrder');
        
        await pool.close();
        
        const entries = entriesResult.recordset;
        const formDateFormatted = new Date(form.FormDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Helper function to format time
        const formatTime = (timeVal) => {
            if (!timeVal) return '-';
            if (timeVal instanceof Date) {
                return timeVal.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            // If it's a string, try to extract HH:MM
            const str = timeVal.toString();
            const match = str.match(/(\d{2}):(\d{2})/);
            return match ? match[0] : str.substring(0, 5);
        };
        
        let entryRows = entries.map((entry, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${entry.FullName}</td>
                <td>${entry.Contractor || '-'}</td>
                <td>${formatTime(entry.TimeIn)}</td>
                <td>${formatTime(entry.TimeOut)}</td>
                <td>${entry.GuardName}</td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Workers Entrance Form - ${formDateFormatted} - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #6a1b9a 0%, #4a148c 100%);
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
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1000px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .form-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 25px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #eee;
                    }
                    .form-title {
                        font-size: 22px;
                        font-weight: 600;
                        color: #333;
                    }
                    .form-badge {
                        background: #6a1b9a;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 13px;
                        font-weight: 500;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-bottom: 25px;
                    }
                    .info-item label {
                        display: block;
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 5px;
                        text-transform: uppercase;
                    }
                    .info-item span {
                        font-size: 16px;
                        font-weight: 500;
                        color: #333;
                    }
                    .entries-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .entries-table th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-size: 13px;
                        font-weight: 600;
                        color: #555;
                        border-bottom: 2px solid #dee2e6;
                    }
                    .entries-table td {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }
                    .entries-table tr:hover {
                        background: #f8f9fa;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        text-decoration: none;
                        display: inline-block;
                    }
                    .btn-outline {
                        background: white;
                        border: 2px solid #6a1b9a;
                        color: #6a1b9a;
                    }
                    .btn-outline:hover {
                        background: #f3e5f5;
                    }
                    @media print {
                        .header, .btn { display: none; }
                        .card { box-shadow: none; border: 1px solid #ddd; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚪 Workers Entrance Form Details</h1>
                    <div class="header-nav">
                        <a href="/security-services/entrance-form">← Back to Workers Entrance Forms</a>
                        <a href="/security-services">Security Services</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="form-header">
                            <div>
                                <div class="form-title">${formDateFormatted}</div>
                            </div>
                            <span class="form-badge">${form.Entrance}</span>
                        </div>
                        
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Date</label>
                                <span>${formDateFormatted}</span>
                            </div>
                            <div class="info-item">
                                <label>Entrance</label>
                                <span>${form.Entrance}</span>
                            </div>
                            <div class="info-item">
                                <label>Location</label>
                                <span>${form.Location}</span>
                            </div>
                            <div class="info-item">
                                <label>Created By</label>
                                <span>${form.CreatedBy}</span>
                            </div>
                        </div>
                        
                        <h3 style="margin-bottom: 15px; color: #333;">👷 Worker Entries (${entries.length})</h3>
                        <table class="entries-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Full Name<br><span style="font-size: 11px; color: #888;">الإسم الكامل</span></th>
                                    <th>Contractor<br><span style="font-size: 11px; color: #888;">المتعهد</span></th>
                                    <th>Time In<br><span style="font-size: 11px; color: #888;">وقت الدخول</span></th>
                                    <th>Time Out<br><span style="font-size: 11px; color: #888;">وقت الخروج</span></th>
                                    <th>Guard Name<br><span style="font-size: 11px; color: #888;">إسم الحارس</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${entryRows}
                            </tbody>
                        </table>
                        
                        <div style="margin-top: 25px; text-align: right;">
                            <button class="btn btn-outline" onclick="window.print()">🖨️ Print</button>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing entrance form:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
