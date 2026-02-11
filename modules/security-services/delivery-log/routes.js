/**
 * Delivery Log Sheet Routes
 * Security Services - Delivery Log Management
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

// Delivery Log Sheet - Main Page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    const today = new Date().toISOString().split('T')[0];
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Delivery Log Sheet - ${process.env.APP_NAME}</title>
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
                    background: #1976d2;
                    color: white;
                }
                .tab:hover:not(.active) {
                    background: #e3f2fd;
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
                    border-color: #1976d2;
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
                    padding: 10px 12px;
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
                    border-color: #1976d2;
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
                .btn-primary {
                    background: #1976d2;
                    color: white;
                }
                .btn-primary:hover {
                    background: #1565c0;
                }
                .btn-success {
                    background: #2e7d32;
                    color: white;
                }
                .btn-success:hover {
                    background: #1b5e20;
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
                    border: 2px solid #1976d2;
                    color: #1976d2;
                }
                .btn-outline:hover {
                    background: #e3f2fd;
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
                    border-left: 4px solid #1976d2;
                    transition: all 0.3s;
                    cursor: pointer;
                }
                .log-item:hover {
                    background: #e3f2fd;
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
                .log-item-premises {
                    background: #1976d2;
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
                <h1>📦 Delivery Log Sheet</h1>
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
                        <form id="deliveryLogForm">
                            <div class="form-section">
                                <div class="section-title">📋 Log Information</div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Date *</label>
                                        <input type="date" id="logDate" name="logDate" value="${today}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Premises *</label>
                                        <select id="premises" name="premises" required>
                                            <option value="">-- Select Premises --</option>
                                            <option value="HO Dbayeh Block A">HO Dbayeh Block A</option>
                                            <option value="HO Dbayeh Block B">HO Dbayeh Block B</option>
                                            <option value="Zouk HO">Zouk HO</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Filled By *</label>
                                        <input type="text" id="filledBy" name="filledBy" value="${user.displayName}" required>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <div class="section-title">
                                    📦 Delivery Items
                                    <button type="button" class="btn btn-outline" onclick="addItem()" style="margin-left: auto; padding: 8px 16px; font-size: 13px;">
                                        + Add Item
                                    </button>
                                </div>
                                <table class="items-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 5%;">#</th>
                                            <th style="width: 25%;">Employee Name</th>
                                            <th style="width: 25%;">Received From</th>
                                            <th style="width: 15%;">Time</th>
                                            <th style="width: 25%;">Notes</th>
                                            <th style="width: 5%;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="itemsBody">
                                        <tr data-row="1">
                                            <td>1</td>
                                            <td><input type="text" name="items[0][employeeName]" placeholder="Employee name" required></td>
                                            <td><input type="text" name="items[0][receivedFrom]" placeholder="Received from"></td>
                                            <td><input type="time" name="items[0][time]" required></td>
                                            <td><input type="text" name="items[0][notes]" placeholder="Optional notes"></td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="actions-bar">
                                <span style="color: #666; font-size: 13px;">* Required fields</span>
                                <button type="submit" class="btn btn-success">💾 Save Delivery Log</button>
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
                                <label>Premises</label>
                                <select id="filterPremises" onchange="loadHistory()">
                                    <option value="">All Premises</option>
                                    <option value="HO Dbayeh Block A">HO Dbayeh Block A</option>
                                    <option value="HO Dbayeh Block B">HO Dbayeh Block B</option>
                                    <option value="Zouk HO">Zouk HO</option>
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
                let itemCount = 1;
                
                function showTab(tab) {
                    // Update tab buttons
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    event.target.classList.add('active');
                    
                    // Update tab content
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    document.getElementById('tab-' + tab).classList.add('active');
                    
                    if (tab === 'history') {
                        loadHistory();
                    }
                }
                
                function addItem() {
                    itemCount++;
                    const tbody = document.getElementById('itemsBody');
                    const row = document.createElement('tr');
                    row.dataset.row = itemCount;
                    row.innerHTML = 
                        '<td>' + itemCount + '</td>' +
                        '<td><input type="text" name="items[' + (itemCount-1) + '][employeeName]" placeholder="Employee name" required></td>' +
                        '<td><input type="text" name="items[' + (itemCount-1) + '][receivedFrom]" placeholder="Received from"></td>' +
                        '<td><input type="time" name="items[' + (itemCount-1) + '][time]" required></td>' +
                        '<td><input type="text" name="items[' + (itemCount-1) + '][notes]" placeholder="Optional notes"></td>' +
                        '<td><button type="button" class="btn btn-danger" onclick="removeItem(this)">✕</button></td>';
                    tbody.appendChild(row);
                }
                
                function removeItem(btn) {
                    btn.closest('tr').remove();
                    renumberItems();
                }
                
                function renumberItems() {
                    const rows = document.querySelectorAll('#itemsBody tr');
                    rows.forEach((row, index) => {
                        row.querySelector('td:first-child').textContent = index + 1;
                        row.querySelectorAll('input').forEach(input => {
                            input.name = input.name.replace(/items\\[\\d+\\]/, 'items[' + index + ']');
                        });
                    });
                    itemCount = rows.length;
                }
                
                function showAlert(message, type) {
                    const alertBox = document.getElementById('alertBox');
                    alertBox.textContent = message;
                    alertBox.className = 'alert alert-' + type;
                    alertBox.style.display = 'block';
                    setTimeout(() => alertBox.style.display = 'none', 5000);
                }
                
                document.getElementById('deliveryLogForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const items = [];
                    let hasValidationError = false;
                    
                    document.querySelectorAll('#itemsBody tr').forEach((row, index) => {
                        const employeeInput = row.querySelector('input[name="items[' + index + '][employeeName]"]');
                        const timeInput = row.querySelector('input[name="items[' + index + '][time]"]');
                        const receivedFromInput = row.querySelector('input[name="items[' + index + '][receivedFrom]"]');
                        const notesInput = row.querySelector('input[name="items[' + index + '][notes]"]');
                        
                        const employeeName = employeeInput?.value?.trim();
                        const time = timeInput?.value;
                        const receivedFrom = receivedFromInput?.value;
                        const notes = notesInput?.value;
                        
                        // Reset border styles
                        if (employeeInput) employeeInput.style.borderColor = '#ddd';
                        if (timeInput) timeInput.style.borderColor = '#ddd';
                        
                        // Check if row has any data
                        if (employeeName || time || receivedFrom || notes) {
                            // If row has data, validate required fields
                            if (!employeeName) {
                                employeeInput.style.borderColor = '#c62828';
                                hasValidationError = true;
                            }
                            if (!time) {
                                timeInput.style.borderColor = '#c62828';
                                hasValidationError = true;
                            }
                            if (employeeName && time) {
                                items.push({ employeeName, receivedFrom, time, notes });
                            }
                        }
                    });
                    
                    if (hasValidationError) {
                        showAlert('Please fill in Employee Name and Time for all items', 'error');
                        return;
                    }
                    
                    if (items.length === 0) {
                        showAlert('Please add at least one delivery item with Employee Name and Time', 'error');
                        return;
                    }
                    
                    const data = {
                        logDate: document.getElementById('logDate').value,
                        premises: document.getElementById('premises').value,
                        filledBy: document.getElementById('filledBy').value,
                        items: items
                    };
                    
                    try {
                        const res = await fetch('/security-services/delivery-log/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await res.json();
                        
                        if (result.success) {
                            showAlert('Delivery log saved successfully!', 'success');
                            // Reset form
                            document.getElementById('deliveryLogForm').reset();
                            document.getElementById('logDate').value = '${today}';
                            document.getElementById('filledBy').value = '${user.displayName}';
                            document.getElementById('itemsBody').innerHTML = 
                                '<tr data-row="1">' +
                                    '<td>1</td>' +
                                    '<td><input type="text" name="items[0][employeeName]" placeholder="Employee name" required></td>' +
                                    '<td><input type="text" name="items[0][receivedFrom]" placeholder="Received from"></td>' +
                                    '<td><input type="time" name="items[0][time]" required></td>' +
                                    '<td><input type="text" name="items[0][notes]" placeholder="Optional notes"></td>' +
                                    '<td></td>' +
                                '</tr>';
                            itemCount = 1;
                        } else {
                            showAlert(result.error || 'Failed to save delivery log', 'error');
                        }
                    } catch (err) {
                        showAlert('Error saving delivery log: ' + err.message, 'error');
                    }
                });
                
                async function loadHistory() {
                    const fromDate = document.getElementById('filterFromDate').value;
                    const toDate = document.getElementById('filterToDate').value;
                    const premises = document.getElementById('filterPremises').value;
                    
                    let url = '/security-services/delivery-log/list?';
                    if (fromDate) url += 'fromDate=' + fromDate + '&';
                    if (toDate) url += 'toDate=' + toDate + '&';
                    if (premises) url += 'premises=' + encodeURIComponent(premises);
                    
                    try {
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        const container = document.getElementById('historyList');
                        
                        if (!data.logs || data.logs.length === 0) {
                            container.innerHTML = 
                                '<div class="empty-state">' +
                                    '<div class="empty-state-icon">📋</div>' +
                                    '<p>No delivery logs found</p>' +
                                '</div>';
                            return;
                        }
                        
                        container.innerHTML = data.logs.map(log => {
                            const logDate = new Date(log.LogDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            return '<div class="log-item" onclick="viewLog(' + log.Id + ')">' +
                                '<div class="log-item-header">' +
                                    '<span class="log-item-date">' + logDate + '</span>' +
                                    '<span class="log-item-premises">' + log.Premises + '</span>' +
                                '</div>' +
                                '<div class="log-item-meta">' +
                                    '<span>📝 Filled by: ' + log.FilledBy + '</span>' +
                                    '<span style="margin-left: 20px;">📦 ' + log.ItemCount + ' item(s)</span>' +
                                '</div>' +
                            '</div>';
                        }).join('');
                    } catch (err) {
                        console.error('Error loading history:', err);
                    }
                }
                
                function viewLog(id) {
                    window.location.href = '/security-services/delivery-log/' + id;
                }
            </script>
        </body>
        </html>
    `);
});

// API: Save Delivery Log
router.post('/save', async (req, res) => {
    try {
        const { logDate, premises, filledBy, items } = req.body;
        const user = req.currentUser;
        
        if (!logDate || !premises || !filledBy) {
            return res.json({ success: false, error: 'Missing required fields' });
        }
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.json({ success: false, error: 'Please add at least one delivery item' });
        }
        
        // Validate each item has required fields
        const validItems = items.filter(item => 
            item.employeeName && item.employeeName.trim() && 
            item.time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(item.time)
        );
        
        if (validItems.length === 0) {
            return res.json({ success: false, error: 'Each item must have an Employee Name and valid Time (HH:MM format)' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Insert main log
        const logResult = await pool.request()
            .input('logDate', sql.Date, logDate)
            .input('premises', sql.NVarChar, premises)
            .input('filledBy', sql.NVarChar, filledBy)
            .input('filledById', sql.Int, user.id)
            .query(`
                INSERT INTO Security_DeliveryLogs (LogDate, Premises, FilledBy, FilledById)
                OUTPUT INSERTED.Id
                VALUES (@logDate, @premises, @filledBy, @filledById)
            `);
        
        const logId = logResult.recordset[0].Id;
        
        // Insert validated items
        for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            // Convert HH:MM to HH:MM:SS for SQL Server Time type
            const timeValue = item.time.includes(':') ? (item.time.length === 5 ? item.time + ':00' : item.time) : item.time;
            await pool.request()
                .input('deliveryLogId', sql.Int, logId)
                .input('employeeName', sql.NVarChar, item.employeeName)
                .input('receivedFrom', sql.NVarChar, item.receivedFrom || '')
                .input('deliveryTime', sql.NVarChar, timeValue)
                .input('notes', sql.NVarChar, item.notes || '')
                .input('itemOrder', sql.Int, i + 1)
                .query(`
                    INSERT INTO Security_DeliveryLogItems (DeliveryLogId, EmployeeName, ReceivedFrom, DeliveryTime, Notes, ItemOrder)
                    VALUES (@deliveryLogId, @employeeName, @receivedFrom, CAST(@deliveryTime AS TIME), @notes, @itemOrder)
                `);
        }
        
        await pool.close();
        res.json({ success: true, logId });
    } catch (err) {
        console.error('Error saving delivery log:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Get Delivery Logs (with filters)
router.get('/list', async (req, res) => {
    try {
        const { fromDate, toDate, premises } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT dl.*, 
                   (SELECT COUNT(*) FROM Security_DeliveryLogItems WHERE DeliveryLogId = dl.Id) as ItemCount
            FROM Security_DeliveryLogs dl
            WHERE dl.Status = 'Active'
        `;
        
        const request = pool.request();
        
        if (fromDate) {
            query += ' AND dl.LogDate >= @fromDate';
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ' AND dl.LogDate <= @toDate';
            request.input('toDate', sql.Date, toDate);
        }
        if (premises) {
            query += ' AND dl.Premises = @premises';
            request.input('premises', sql.NVarChar, premises);
        }
        
        query += ' ORDER BY dl.LogDate DESC, dl.CreatedAt DESC';
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ logs: result.recordset });
    } catch (err) {
        console.error('Error fetching delivery logs:', err);
        res.json({ logs: [], error: err.message });
    }
});

// View Single Delivery Log
router.get('/:id', async (req, res) => {
    try {
        const logId = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        // Get log details
        const logResult = await pool.request()
            .input('id', sql.Int, logId)
            .query('SELECT * FROM Security_DeliveryLogs WHERE Id = @id');
        
        if (logResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Delivery log not found');
        }
        
        const log = logResult.recordset[0];
        
        // Get items
        const itemsResult = await pool.request()
            .input('logId', sql.Int, logId)
            .query('SELECT * FROM Security_DeliveryLogItems WHERE DeliveryLogId = @logId ORDER BY ItemOrder');
        
        await pool.close();
        
        const items = itemsResult.recordset;
        const logDateFormatted = new Date(log.LogDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Helper function to format time correctly
        const formatTime = (timeValue) => {
            if (!timeValue) return '-';
            if (timeValue instanceof Date) {
                return timeValue.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            // If it's a string, try to extract HH:MM
            const timeStr = timeValue.toString();
            const match = timeStr.match(/(\d{2}:\d{2})/);
            return match ? match[1] : timeStr.substring(0, 5);
        };
        
        let itemRows = items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.EmployeeName}</td>
                <td>${item.ReceivedFrom || '-'}</td>
                <td>${formatTime(item.DeliveryTime)}</td>
                <td>${item.Notes || '-'}</td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Delivery Log - ${logDateFormatted} - ${process.env.APP_NAME}</title>
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
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 900px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .log-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 25px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #eee;
                    }
                    .log-title {
                        font-size: 22px;
                        font-weight: 600;
                        color: #333;
                    }
                    .log-badge {
                        background: #1976d2;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 13px;
                        font-weight: 500;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
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
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .items-table th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-size: 13px;
                        font-weight: 600;
                        color: #555;
                        border-bottom: 2px solid #dee2e6;
                    }
                    .items-table td {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }
                    .items-table tr:hover {
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
                        border: 2px solid #1976d2;
                        color: #1976d2;
                    }
                    .btn-outline:hover {
                        background: #e3f2fd;
                    }
                    @media print {
                        .header, .btn { display: none; }
                        .card { box-shadow: none; border: 1px solid #ddd; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📦 Delivery Log Details</h1>
                    <div class="header-nav">
                        <a href="/security-services/delivery-log">← Back to Delivery Logs</a>
                        <a href="/security-services">Security Services</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="log-header">
                            <div>
                                <div class="log-title">${logDateFormatted}</div>
                            </div>
                            <span class="log-badge">${log.Premises}</span>
                        </div>
                        
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Date</label>
                                <span>${logDateFormatted}</span>
                            </div>
                            <div class="info-item">
                                <label>Premises</label>
                                <span>${log.Premises}</span>
                            </div>
                            <div class="info-item">
                                <label>Filled By</label>
                                <span>${log.FilledBy}</span>
                            </div>
                        </div>
                        
                        <h3 style="margin-bottom: 15px; color: #333;">📦 Delivery Items (${items.length})</h3>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Employee Name</th>
                                    <th>Received From</th>
                                    <th>Time</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemRows}
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
        console.error('Error viewing delivery log:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
