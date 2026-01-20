/**
 * Extra Cleaning Agents Request Routes
 * Store managers can request extra cleaning agents
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

// Main form page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get stores
        const stores = await pool.request().query('SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        
        // Get categories
        const categories = await pool.request().query('SELECT Id, CategoryName FROM CleaningCategories WHERE IsActive = 1 ORDER BY CategoryName');
        
        // Get all third party providers with their category info (for JavaScript filtering)
        const providers = await pool.request().query(`
            SELECT p.Id, p.ProviderName, p.CategoryId, c.CategoryName 
            FROM ThirdPartyProviders p 
            LEFT JOIN CleaningCategories c ON p.CategoryId = c.Id
            WHERE p.IsActive = 1 
            ORDER BY p.ProviderName
        `);
        
        await pool.close();
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.StoreName}">${s.StoreName}</option>`
        ).join('');
        
        const categoryOptions = categories.recordset.map(c => 
            `<option value="${c.CategoryName}" data-id="${c.Id}">${c.CategoryName}</option>`
        ).join('');
        
        // Store providers as JSON for JavaScript filtering
        const providersJson = JSON.stringify(providers.recordset);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Extra Cleaning Agents Request - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f5f6fa;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container {
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    .breadcrumb {
                        margin-bottom: 20px;
                        color: #666;
                    }
                    .breadcrumb a {
                        color: #17a2b8;
                        text-decoration: none;
                    }
                    .form-container {
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    }
                    .form-title {
                        font-size: 24px;
                        color: #333;
                        margin-bottom: 30px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid #17a2b8;
                    }
                    .form-section {
                        margin-bottom: 30px;
                    }
                    .section-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: #17a2b8;
                        margin-bottom: 15px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .form-row {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                        margin-bottom: 15px;
                    }
                    .form-row.triple {
                        grid-template-columns: repeat(3, 1fr);
                    }
                    .form-row.single {
                        grid-template-columns: 1fr;
                    }
                    .form-group {
                        display: flex;
                        flex-direction: column;
                    }
                    .form-group label {
                        font-size: 14px;
                        font-weight: 500;
                        color: #555;
                        margin-bottom: 6px;
                    }
                    .form-group label.required::after {
                        content: ' *';
                        color: #dc3545;
                    }
                    .form-group input,
                    .form-group select,
                    .form-group textarea {
                        padding: 12px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        transition: border-color 0.2s, box-shadow 0.2s;
                    }
                    .form-group input:focus,
                    .form-group select:focus,
                    .form-group textarea:focus {
                        outline: none;
                        border-color: #17a2b8;
                        box-shadow: 0 0 0 3px rgba(23,162,184,0.1);
                    }
                    .form-group textarea {
                        resize: vertical;
                        min-height: 100px;
                    }
                    .shift-options {
                        display: flex;
                        gap: 20px;
                    }
                    .shift-option {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 15px 25px;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .shift-option:hover {
                        border-color: #17a2b8;
                    }
                    .shift-option.selected {
                        border-color: #17a2b8;
                        background: #e8f7f9;
                    }
                    .shift-option input {
                        display: none;
                    }
                    .btn-row {
                        display: flex;
                        gap: 15px;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .btn {
                        padding: 14px 30px;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: #17a2b8;
                        color: white;
                    }
                    .btn-primary:hover {
                        background: #138496;
                    }
                    .btn-secondary {
                        background: #6c757d;
                        color: white;
                    }
                    .btn-secondary:hover {
                        background: #545b62;
                    }
                    .alert {
                        padding: 15px 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    .alert-success {
                        background: #d4edda;
                        color: #155724;
                        border: 1px solid #c3e6cb;
                    }
                    .alert-error {
                        background: #f8d7da;
                        color: #721c24;
                        border: 1px solid #f5c6cb;
                    }
                    .time-range {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .time-range input {
                        flex: 1;
                    }
                    .time-range span {
                        color: #666;
                        font-weight: 500;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧹 Extra Cleaning Agents Request</h1>
                    <div class="header-nav">
                        <a href="/stores/extra-cleaning/my-requests">📋 My Requests</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="breadcrumb">
                        <a href="/dashboard">Dashboard</a> / <a href="/stores">Stores</a> / <span>Extra Cleaning Request</span>
                    </div>
                    
                    <div class="form-container">
                        <h2 class="form-title">🧹 Extra Cleaning Agents Request Form</h2>
                        
                        <form id="cleaningRequestForm" action="/stores/extra-cleaning/submit" method="POST">
                            
                            <!-- Store & Category -->
                            <div class="form-section">
                                <div class="section-title">📍 Request Details</div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="required" for="store">Store</label>
                                        <select id="store" name="store" required>
                                            <option value="">Select Store...</option>
                                            ${storeOptions}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="required" for="category">Category</label>
                                        <select id="category" name="category" required>
                                            <option value="">Select Category...</option>
                                            ${categoryOptions}
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="required" for="thirdParty">Third Party Provider</label>
                                        <select id="thirdParty" name="thirdParty" required disabled>
                                            <option value="">Select Category first...</option>
                                        </select>
                                        <small style="color: #666; margin-top: 4px;">Select a category to see available providers</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="required" for="numberOfAgents">Number of Extra Agents</label>
                                        <input type="number" id="numberOfAgents" name="numberOfAgents" min="1" max="50" required placeholder="Enter number">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Shift Type -->
                            <div class="form-section">
                                <div class="section-title">⏰ Shift Duration</div>
                                <div class="form-row single">
                                    <div class="form-group">
                                        <label class="required">Shift Hours</label>
                                        <div class="shift-options">
                                            <label class="shift-option selected" onclick="selectShift(this, 9)">
                                                <input type="radio" name="shiftHours" value="9" checked>
                                                <span style="font-size:24px;">🕘</span>
                                                <div>
                                                    <strong>9 Hours</strong>
                                                    <div style="font-size:12px;color:#666;">Standard Shift</div>
                                                </div>
                                            </label>
                                            <label class="shift-option" onclick="selectShift(this, 12)">
                                                <input type="radio" name="shiftHours" value="12">
                                                <span style="font-size:24px;">🕛</span>
                                                <div>
                                                    <strong>12 Hours</strong>
                                                    <div style="font-size:12px;color:#666;">Extended Shift</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Starting Day -->
                            <div class="form-section">
                                <div class="section-title">📅 Starting Day</div>
                                <div class="form-row triple">
                                    <div class="form-group">
                                        <label class="required" for="startDate">Date</label>
                                        <input type="date" id="startDate" name="startDate" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="required" for="startTimeFrom">From Time</label>
                                        <input type="time" id="startTimeFrom" name="startTimeFrom" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="required" for="startTimeTo">To Time</label>
                                        <input type="time" id="startTimeTo" name="startTimeTo" required>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Last Day -->
                            <div class="form-section">
                                <div class="section-title">📅 Last Day</div>
                                <div class="form-row triple">
                                    <div class="form-group">
                                        <label class="required" for="endDate">Date</label>
                                        <input type="date" id="endDate" name="endDate" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="required" for="endTimeFrom">From Time</label>
                                        <input type="time" id="endTimeFrom" name="endTimeFrom" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="required" for="endTimeTo">To Time</label>
                                        <input type="time" id="endTimeTo" name="endTimeTo" required>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Description -->
                            <div class="form-section">
                                <div class="section-title">📝 Additional Details</div>
                                <div class="form-row single">
                                    <div class="form-group">
                                        <label for="description">Description / Reason for Request</label>
                                        <textarea id="description" name="description" placeholder="Explain why extra cleaning agents are needed..."></textarea>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Approval Info -->
                            <div class="form-section">
                                <div class="section-title">✅ Approval Workflow</div>
                                <div style="background:#f8f9fa;padding:20px;border-radius:8px;color:#666;">
                                    <p style="margin-bottom:10px;">This request will be sent for approval to:</p>
                                    <div style="display:flex;gap:20px;flex-wrap:wrap;">
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <span style="width:24px;height:24px;background:#17a2b8;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">1</span>
                                            <span>Area Manager</span>
                                        </div>
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <span style="width:24px;height:24px;background:#17a2b8;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">2</span>
                                            <span>Head Office</span>
                                        </div>
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <span style="width:24px;height:24px;background:#17a2b8;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">3</span>
                                            <span>HR Manager</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Submit -->
                            <div class="btn-row">
                                <button type="submit" class="btn btn-primary">Submit Request</button>
                                <button type="reset" class="btn btn-secondary">Clear Form</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    // All providers data for filtering
                    const allProviders = ${providersJson};
                    
                    // Set minimum date to today
                    const today = new Date().toISOString().split('T')[0];
                    document.getElementById('startDate').min = today;
                    document.getElementById('endDate').min = today;
                    
                    // Update end date min when start date changes
                    document.getElementById('startDate').addEventListener('change', function() {
                        document.getElementById('endDate').min = this.value;
                        if (document.getElementById('endDate').value < this.value) {
                            document.getElementById('endDate').value = this.value;
                        }
                    });
                    
                    // Filter providers when category changes
                    document.getElementById('category').addEventListener('change', function() {
                        const categorySelect = this;
                        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
                        const categoryId = selectedOption.getAttribute('data-id');
                        const categoryName = categorySelect.value;
                        const thirdPartySelect = document.getElementById('thirdParty');
                        
                        // Clear and reset provider dropdown
                        thirdPartySelect.innerHTML = '<option value="">Select Provider...</option>';
                        
                        if (!categoryName) {
                            thirdPartySelect.disabled = true;
                            thirdPartySelect.innerHTML = '<option value="">Select Category first...</option>';
                            return;
                        }
                        
                        // Filter providers by category
                        const filteredProviders = allProviders.filter(p => 
                            p.CategoryId == categoryId || p.CategoryName === categoryName
                        );
                        
                        if (filteredProviders.length === 0) {
                            thirdPartySelect.innerHTML = '<option value="">No providers for this category</option>';
                            thirdPartySelect.disabled = true;
                        } else {
                            filteredProviders.forEach(p => {
                                thirdPartySelect.innerHTML += '<option value="' + p.ProviderName + '">' + p.ProviderName + '</option>';
                            });
                            thirdPartySelect.disabled = false;
                        }
                    });
                    
                    // Shift selection
                    function selectShift(element, hours) {
                        document.querySelectorAll('.shift-option').forEach(opt => opt.classList.remove('selected'));
                        element.classList.add('selected');
                        element.querySelector('input').checked = true;
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading form:', err);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;">
                <h2>Error loading form</h2>
                <p>${err.message}</p>
                <a href="/stores">Back to Stores</a>
            </div>
        `);
    }
});

// Submit request
router.post('/submit', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Debug: log current user info
        console.log('📋 Submit request - Current user:', JSON.stringify(req.currentUser));
        console.log('📋 User ID:', req.currentUser?.userId);
        
        // Format time values (HTML time input gives HH:MM, SQL needs HH:MM:SS)
        const formatTime = (timeStr) => {
            if (!timeStr) return null;
            // Add seconds if not present
            return timeStr.includes(':') && timeStr.split(':').length === 2 
                ? timeStr + ':00' 
                : timeStr;
        };
        
        const result = await pool.request()
            .input('store', sql.NVarChar, req.body.store)
            .input('category', sql.NVarChar, req.body.category)
            .input('thirdParty', sql.NVarChar, req.body.thirdParty)
            .input('numberOfAgents', sql.Int, req.body.numberOfAgents)
            .input('description', sql.NVarChar, req.body.description || '')
            .input('startDate', sql.Date, req.body.startDate)
            .input('startTimeFrom', sql.NVarChar, formatTime(req.body.startTimeFrom))
            .input('startTimeTo', sql.NVarChar, formatTime(req.body.startTimeTo))
            .input('shiftHours', sql.Int, req.body.shiftHours || 9)
            .input('endDate', sql.Date, req.body.endDate)
            .input('endTimeFrom', sql.NVarChar, formatTime(req.body.endTimeFrom))
            .input('endTimeTo', sql.NVarChar, formatTime(req.body.endTimeTo))
            .input('createdBy', sql.Int, req.currentUser.userId)
            .query(`
                INSERT INTO ExtraCleaningRequests (
                    Store, Category, ThirdParty, NumberOfAgents, Description,
                    StartDate, StartTimeFrom, StartTimeTo, ShiftHours,
                    EndDate, EndTimeFrom, EndTimeTo, CreatedBy
                ) VALUES (
                    @store, @category, @thirdParty, @numberOfAgents, @description,
                    @startDate, @startTimeFrom, @startTimeTo, @shiftHours,
                    @endDate, @endTimeFrom, @endTimeTo, @createdBy
                );
                SELECT SCOPE_IDENTITY() as Id;
            `);
        
        const requestId = result.recordset[0].Id;
        await pool.close();
        
        res.redirect(`/stores/extra-cleaning/success/${requestId}`);
    } catch (err) {
        console.error('Error submitting request:', err);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;">
                <h2>Error submitting request</h2>
                <p>${err.message}</p>
                <a href="/stores/extra-cleaning">Try Again</a>
            </div>
        `);
    }
});

// Success page
router.get('/success/:id', async (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Request Submitted - ${process.env.APP_NAME}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .success-card { background: white; padding: 50px; border-radius: 16px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px; }
                .success-icon { font-size: 64px; margin-bottom: 20px; }
                h2 { color: #28a745; margin-bottom: 15px; }
                p { color: #666; margin-bottom: 25px; }
                .request-id { background: #e8f7f9; padding: 15px 30px; border-radius: 8px; font-size: 18px; font-weight: 600; color: #17a2b8; margin-bottom: 25px; display: inline-block; }
                .btn { display: inline-block; padding: 12px 25px; border-radius: 8px; text-decoration: none; margin: 5px; }
                .btn-primary { background: #17a2b8; color: white; }
                .btn-secondary { background: #6c757d; color: white; }
            </style>
        </head>
        <body>
            <div class="success-card">
                <div class="success-icon">✅</div>
                <h2>Request Submitted Successfully!</h2>
                <div class="request-id">Request #ECR-${req.params.id}</div>
                <p>Your extra cleaning agents request has been submitted and is pending approval.</p>
                <p style="font-size:14px;color:#888;">Approval workflow: Area Manager → Head Office → HR Manager</p>
                <div style="margin-top:20px;">
                    <a href="/stores/extra-cleaning" class="btn btn-primary">New Request</a>
                    <a href="/stores/extra-cleaning/my-requests" class="btn btn-secondary">View My Requests</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// My Requests page
router.get('/my-requests', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('userId', sql.Int, req.currentUser.userId)
            .query(`
                SELECT * FROM ExtraCleaningRequests 
                WHERE CreatedBy = @userId 
                ORDER BY CreatedAt DESC
            `);
        
        await pool.close();
        
        const statusBadge = (status) => {
            const colors = {
                'Pending': 'background:#fff3cd;color:#856404;',
                'Approved': 'background:#d4edda;color:#155724;',
                'Rejected': 'background:#f8d7da;color:#721c24;'
            };
            return `<span style="padding:4px 10px;border-radius:12px;font-size:12px;${colors[status] || colors['Pending']}">${status}</span>`;
        };
        
        const tableRows = result.recordset.map(r => `
            <tr>
                <td><strong>ECR-${r.Id}</strong></td>
                <td>${r.Store}</td>
                <td>${r.Category}</td>
                <td>${r.NumberOfAgents}</td>
                <td>${new Date(r.StartDate).toLocaleDateString('en-GB')}</td>
                <td>${new Date(r.EndDate).toLocaleDateString('en-GB')}</td>
                <td>${statusBadge(r.AreaManagerStatus)}</td>
                <td>${statusBadge(r.HOStatus)}</td>
                <td>${statusBadge(r.HRStatus)}</td>
                <td>${statusBadge(r.OverallStatus)}</td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>My Requests - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.1); }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    .table-container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f8f9fa; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #dee2e6; }
                    td { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 14px; }
                    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
                    .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 My Extra Cleaning Requests</h1>
                    <div class="header-nav">
                        <a href="/stores/extra-cleaning">➕ New Request</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="table-container">
                        ${result.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Category</th>
                                        <th>Agents</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th>Area Manager</th>
                                        <th>Head Office</th>
                                        <th>HR Manager</th>
                                        <th>Overall</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div class="icon">📋</div>
                                <h3>No requests yet</h3>
                                <p>You haven't submitted any extra cleaning requests</p>
                                <a href="/stores/extra-cleaning" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#17a2b8;color:white;text-decoration:none;border-radius:8px;">Create New Request</a>
                            </div>
                        `}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading requests:', err);
        res.status(500).send('Error loading requests');
    }
});

module.exports = router;
