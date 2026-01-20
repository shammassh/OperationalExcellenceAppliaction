/**
 * Production Extras Request Module
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const config = require('../../../config/default');

// Database configuration
const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options,
    pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000
    }
};

// Create a single connection pool instance
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('Production Extras: Connected to SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('Production Extras: Database connection failed:', err);
        return null;
    });

// Main form page
router.get('/', async (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Production Extras Request - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .header {
                    background: rgba(255,255,255,0.95);
                    padding: 15px 30px;
                    border-radius: 12px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .header h1 { 
                    color: #333; 
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .header-nav a {
                    color: #667eea;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    background: #f0f0f0;
                    transition: all 0.3s;
                }
                .header-nav a:hover {
                    background: #667eea;
                    color: white;
                }
                .main-container {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    gap: 20px;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                @media (max-width: 1200px) {
                    .main-container {
                        grid-template-columns: 1fr;
                    }
                }
                .form-container {
                    background: white;
                    border-radius: 16px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .form-title {
                    font-size: 22px;
                    color: #333;
                    margin-bottom: 25px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #667eea;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }
                @media (max-width: 768px) {
                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .form-group {
                    margin-bottom: 5px;
                }
                .form-group.full-width {
                    grid-column: span 2;
                }
                @media (max-width: 768px) {
                    .form-group.full-width {
                        grid-column: span 1;
                    }
                }
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #444;
                    font-size: 14px;
                }
                .form-group label .required {
                    color: #dc3545;
                }
                .form-group input,
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 12px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: all 0.3s;
                }
                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    border-color: #667eea;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                .form-group textarea {
                    resize: vertical;
                    min-height: 100px;
                }
                .form-group input[readonly] {
                    background: #f8f9fa;
                    color: #666;
                }
                .cost-display {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 10px;
                    font-size: 18px;
                    font-weight: bold;
                    text-align: center;
                }
                .btn-submit {
                    width: 100%;
                    padding: 15px 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-top: 20px;
                }
                .btn-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
                }
                .btn-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                .history-panel {
                    background: white;
                    border-radius: 16px;
                    padding: 25px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    max-height: calc(100vh - 140px);
                    overflow-y: auto;
                }
                .history-title {
                    font-size: 18px;
                    color: #333;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #667eea;
                }
                .request-card {
                    background: #f8f9fa;
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 15px;
                    border-left: 4px solid #667eea;
                }
                .request-card .status {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .request-card .status.pending { background: #fff3cd; color: #856404; }
                .request-card .status.approved { background: #d4edda; color: #155724; }
                .request-card .status.rejected { background: #f8d7da; color: #721c24; }
                .request-card .info { margin-top: 10px; font-size: 13px; color: #666; }
                .request-card .cost { font-size: 16px; font-weight: bold; color: #667eea; margin-top: 8px; }
                .toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 15px 25px;
                    border-radius: 10px;
                    color: white;
                    font-weight: 500;
                    z-index: 1000;
                    animation: slideIn 0.3s ease;
                }
                .toast.success { background: #28a745; }
                .toast.error { background: #dc3545; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .section-divider {
                    grid-column: span 2;
                    border-top: 1px solid #e0e0e0;
                    margin: 10px 0;
                    padding-top: 15px;
                }
                .section-divider h3 {
                    font-size: 16px;
                    color: #667eea;
                    margin-bottom: 10px;
                }
                @media (max-width: 768px) {
                    .section-divider {
                        grid-column: span 1;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>👷 Production Extras Request</h1>
                <nav class="header-nav">
                    <a href="/stores">← Back to Stores</a>
                    <a href="/dashboard">Dashboard</a>
                </nav>
            </div>
            
            <div class="main-container">
                <div class="form-container">
                    <div class="form-title">📋 New Request</div>
                    <form id="productionExtrasForm">
                        <div class="form-grid">
                            <!-- Location Details -->
                            <div class="form-group">
                                <label>Outlet <span class="required">*</span></label>
                                <select id="outletId" name="outletId" required>
                                    <option value="">Select Outlet...</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Scheme <span class="required">*</span></label>
                                <select id="schemeId" name="schemeId" required>
                                    <option value="">Select Scheme...</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Location <span class="required">*</span></label>
                                <select id="locationId" name="locationId" required>
                                    <option value="">Select Location...</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Category <span class="required">*</span></label>
                                <select id="categoryId" name="categoryId" required>
                                    <option value="">Select Category...</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Third Party <span class="required">*</span></label>
                                <select id="thirdPartyId" name="thirdPartyId" required>
                                    <option value="">Select Third Party...</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Shift <span class="required">*</span></label>
                                <select id="shiftId" name="shiftId" required>
                                    <option value="">Select Shift...</option>
                                </select>
                            </div>
                            
                            <div class="section-divider">
                                <h3>📅 Schedule & Agents</h3>
                            </div>
                            
                            <div class="form-group">
                                <label>Number of Extra Agents <span class="required">*</span></label>
                                <input type="number" id="numberOfAgents" name="numberOfAgents" min="1" value="1" required>
                            </div>
                            
                            <div class="form-group">
                                <label>Starting Date & Time <span class="required">*</span></label>
                                <input type="datetime-local" id="startDateTime" name="startDateTime" required>
                            </div>
                            
                            <div class="form-group">
                                <label>End Date & Time <span class="required">*</span></label>
                                <input type="datetime-local" id="endDateTime" name="endDateTime" required>
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Description</label>
                                <textarea id="description" name="description" placeholder="Describe the reason for requesting extra agents..."></textarea>
                            </div>
                            
                            <div class="section-divider">
                                <h3>💰 Cost Information</h3>
                            </div>
                            
                            <div class="form-group">
                                <label>Unit Cost ($)</label>
                                <input type="text" id="unitCost" name="unitCost" readonly value="0.00">
                            </div>
                            
                            <div class="form-group">
                                <label>Total Cost ($)</label>
                                <div class="cost-display" id="totalCostDisplay">$0.00</div>
                                <input type="hidden" id="totalCost" name="totalCost" value="0">
                            </div>
                            
                            <div class="section-divider">
                                <h3>✅ Approval</h3>
                            </div>
                            
                            <div class="form-group">
                                <label>Approver 1 Email <span class="required">*</span></label>
                                <input type="email" id="approver1Email" name="approver1Email" value="approver1@spinneys.com" required>
                            </div>
                            
                            <div class="form-group">
                                <label>Approver 2 Email <span class="required">*</span></label>
                                <input type="email" id="approver2Email" name="approver2Email" value="approver2@spinneys.com" required>
                            </div>
                        </div>
                        
                        <button type="submit" class="btn-submit" id="submitBtn">
                            📤 Submit Request
                        </button>
                    </form>
                </div>
                
                <div class="history-panel">
                    <div class="history-title">📜 My Recent Requests</div>
                    <div id="requestHistory">
                        <div style="text-align: center; color: #666; padding: 20px;">Loading...</div>
                    </div>
                </div>
            </div>
            
            <script>
                // Data storage
                let outlets = [];
                let schemes = [];
                let locations = [];
                let categories = [];
                let thirdParties = [];
                let shifts = [];
                let unitCosts = [];
                
                // Load all dropdown data on page load
                document.addEventListener('DOMContentLoaded', async () => {
                    await loadDropdownData();
                    await loadMyRequests();
                    setupEventListeners();
                });
                
                async function loadDropdownData() {
                    try {
                        const [outletsRes, schemesRes, locationsRes, categoriesRes, thirdPartiesRes, shiftsRes, unitCostsRes] = await Promise.all([
                            fetch('/stores/production-extras/api/outlets'),
                            fetch('/stores/production-extras/api/schemes'),
                            fetch('/stores/production-extras/api/locations'),
                            fetch('/stores/production-extras/api/categories'),
                            fetch('/stores/production-extras/api/thirdparties'),
                            fetch('/stores/production-extras/api/shifts'),
                            fetch('/stores/production-extras/api/unitcosts')
                        ]);
                        
                        outlets = await outletsRes.json();
                        schemes = await schemesRes.json();
                        locations = await locationsRes.json();
                        categories = await categoriesRes.json();
                        thirdParties = await thirdPartiesRes.json();
                        shifts = await shiftsRes.json();
                        unitCosts = await unitCostsRes.json();
                        
                        populateDropdowns();
                    } catch (err) {
                        console.error('Error loading dropdown data:', err);
                        showToast('Error loading form data', 'error');
                    }
                }
                
                function populateDropdowns() {
                    // Outlets
                    const outletSelect = document.getElementById('outletId');
                    outletSelect.innerHTML = '<option value="">Select Outlet...</option>';
                    outlets.filter(o => o.IsActive).forEach(o => {
                        outletSelect.innerHTML += '<option value="' + o.Id + '">' + o.OutletName + '</option>';
                    });
                    
                    // Schemes
                    const schemeSelect = document.getElementById('schemeId');
                    schemeSelect.innerHTML = '<option value="">Select Scheme...</option>';
                    schemes.filter(s => s.IsActive).forEach(s => {
                        schemeSelect.innerHTML += '<option value="' + s.Id + '">' + s.SchemeName + '</option>';
                    });
                    
                    // Locations
                    const locationSelect = document.getElementById('locationId');
                    locationSelect.innerHTML = '<option value="">Select Location...</option>';
                    locations.filter(l => l.IsActive).forEach(l => {
                        locationSelect.innerHTML += '<option value="' + l.Id + '">' + l.LocationName + '</option>';
                    });
                    
                    // Categories
                    const categorySelect = document.getElementById('categoryId');
                    categorySelect.innerHTML = '<option value="">Select Category...</option>';
                    categories.filter(c => c.IsActive).forEach(c => {
                        categorySelect.innerHTML += '<option value="' + c.Id + '">' + c.CategoryName + '</option>';
                    });
                    
                    // Third Parties
                    const thirdPartySelect = document.getElementById('thirdPartyId');
                    thirdPartySelect.innerHTML = '<option value="">Select Third Party...</option>';
                    thirdParties.filter(t => t.IsActive).forEach(t => {
                        thirdPartySelect.innerHTML += '<option value="' + t.Id + '">' + t.ThirdPartyName + '</option>';
                    });
                    
                    // Shifts
                    const shiftSelect = document.getElementById('shiftId');
                    shiftSelect.innerHTML = '<option value="">Select Shift...</option>';
                    shifts.filter(s => s.IsActive).forEach(s => {
                        shiftSelect.innerHTML += '<option value="' + s.Id + '">' + s.ShiftName + '</option>';
                    });
                }
                
                function setupEventListeners() {
                    // Recalculate cost when relevant fields change
                    ['categoryId', 'thirdPartyId', 'shiftId', 'numberOfAgents', 'startDateTime', 'endDateTime'].forEach(id => {
                        document.getElementById(id).addEventListener('change', calculateCost);
                    });
                    document.getElementById('numberOfAgents').addEventListener('input', calculateCost);
                    
                    // Filter locations when scheme changes
                    document.getElementById('schemeId').addEventListener('change', filterLocations);
                }
                
                function filterLocations() {
                    const schemeId = document.getElementById('schemeId').value;
                    const locationSelect = document.getElementById('locationId');
                    locationSelect.innerHTML = '<option value="">Select Location...</option>';
                    
                    if (schemeId) {
                        locations.filter(l => l.IsActive && l.SchemeId == schemeId).forEach(l => {
                            locationSelect.innerHTML += '<option value="' + l.Id + '">' + l.LocationName + '</option>';
                        });
                    } else {
                        locations.filter(l => l.IsActive).forEach(l => {
                            locationSelect.innerHTML += '<option value="' + l.Id + '">' + l.LocationName + '</option>';
                        });
                    }
                }
                
                function calculateCost() {
                    const categoryId = parseInt(document.getElementById('categoryId').value);
                    const thirdPartyId = parseInt(document.getElementById('thirdPartyId').value);
                    const shiftId = parseInt(document.getElementById('shiftId').value);
                    const numberOfAgents = parseInt(document.getElementById('numberOfAgents').value) || 1;
                    
                    // Find matching unit cost
                    let unitCost = 0;
                    const matchingCost = unitCosts.find(uc => 
                        uc.CategoryId === categoryId && 
                        uc.ThirdPartyId === thirdPartyId && 
                        uc.ShiftId === shiftId &&
                        uc.IsActive
                    );
                    
                    if (matchingCost) {
                        unitCost = parseFloat(matchingCost.CostValue) || 0;
                    }
                    
                    document.getElementById('unitCost').value = unitCost.toFixed(2);
                    
                    // Total = Unit Cost × Number of Agents
                    const totalCost = unitCost * numberOfAgents;
                    document.getElementById('totalCost').value = totalCost.toFixed(2);
                    document.getElementById('totalCostDisplay').textContent = '$' + totalCost.toFixed(2);
                }
                
                async function loadMyRequests() {
                    console.log('loadMyRequests called');
                    try {
                        const res = await fetch('/stores/production-extras/api/my-requests?t=' + Date.now());
                        console.log('API response status:', res.status);
                        if (!res.ok) {
                            throw new Error('Failed to fetch requests');
                        }
                        const requests = await res.json();
                        console.log('Loaded requests:', requests.length, 'items');
                        renderRequests(requests);
                        return requests;
                    } catch (err) {
                        console.error('Error loading requests:', err);
                        document.getElementById('requestHistory').innerHTML = '<div style="text-align: center; color: #dc3545; padding: 20px;">Error loading requests</div>';
                        throw err;
                    }
                }
                
                function renderRequests(requests) {
                    const container = document.getElementById('requestHistory');
                    if (!requests || requests.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No requests yet</div>';
                        return;
                    }
                    
                    container.innerHTML = requests.map(r => {
                        const statusClass = (r.Status || 'pending').toLowerCase();
                        return \`
                            <div class="request-card">
                                <span class="status \${statusClass}">\${r.Status || 'Pending'}</span>
                                <div class="info">
                                    <strong>\${r.CategoryName || 'N/A'}</strong> - \${r.ThirdPartyName || 'N/A'}<br>
                                    \${r.NumberOfAgents || 0} agent(s) | \${r.StartDateTime ? new Date(r.StartDateTime).toLocaleDateString() : 'N/A'} - \${r.EndDateTime ? new Date(r.EndDateTime).toLocaleDateString() : 'N/A'}
                                </div>
                                <div class="cost">$\${parseFloat(r.TotalCost || 0).toFixed(2)}</div>
                            </div>
                        \`;
                    }).join('');
                }
                
                // Form submission
                document.getElementById('productionExtrasForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const submitBtn = document.getElementById('submitBtn');
                    submitBtn.disabled = true;
                    submitBtn.textContent = '⏳ Submitting...';
                    
                    const formData = {
                        outletId: parseInt(document.getElementById('outletId').value),
                        schemeId: parseInt(document.getElementById('schemeId').value),
                        locationId: parseInt(document.getElementById('locationId').value),
                        categoryId: parseInt(document.getElementById('categoryId').value),
                        thirdPartyId: parseInt(document.getElementById('thirdPartyId').value),
                        shiftId: parseInt(document.getElementById('shiftId').value),
                        numberOfAgents: parseInt(document.getElementById('numberOfAgents').value),
                        description: document.getElementById('description').value,
                        startDateTime: document.getElementById('startDateTime').value,
                        endDateTime: document.getElementById('endDateTime').value,
                        unitCost: parseFloat(document.getElementById('unitCost').value),
                        totalCost: parseFloat(document.getElementById('totalCost').value),
                        approver1Email: document.getElementById('approver1Email').value,
                        approver2Email: document.getElementById('approver2Email').value
                    };
                    
                    try {
                        const res = await fetch('/stores/production-extras/api/submit', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(formData)
                        });
                        
                        const result = await res.json();
                        console.log('Submit result:', result);
                        
                        // Handle session expiration
                        if (result.sessionExpired) {
                            showToast('Session expired. Refreshing page...', 'error');
                            setTimeout(() => window.location.reload(), 1500);
                            return;
                        }
                        
                        if (res.ok && result.success) {
                            showToast('Request submitted successfully!', 'success');
                            document.getElementById('productionExtrasForm').reset();
                            document.getElementById('totalCostDisplay').textContent = '$0.00';
                            document.getElementById('unitCost').value = '0.00';
                            document.getElementById('totalCost').value = '0.00';
                            // Refresh the requests list
                            console.log('Calling loadMyRequests...');
                            window.setTimeout(function() {
                                console.log('setTimeout fired, calling loadMyRequests');
                                loadMyRequests();
                            }, 500);
                        } else {
                            showToast(result.error || 'Error submitting request', 'error');
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        // Check if it's a network error that might be auth redirect
                        showToast('Error submitting request. Please refresh the page and try again.', 'error');
                    } finally {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '📤 Submit Request';
                    }
                });
                
                function showToast(message, type = 'success') {
                    const toast = document.createElement('div');
                    toast.className = 'toast ' + type;
                    toast.textContent = message;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 3000);
                }
            </script>
        </body>
        </html>
    `);
});

// API: Get Outlets
router.get('/api/outlets', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query('SELECT * FROM ProductionOutlets WHERE IsActive = 1 ORDER BY OutletName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading outlets:', err);
        res.status(500).json({ error: 'Failed to load outlets' });
    }
});

// API: Get Schemes
router.get('/api/schemes', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query('SELECT * FROM ProductionOutletSchemes WHERE IsActive = 1 ORDER BY SchemeName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading schemes:', err);
        res.status(500).json({ error: 'Failed to load schemes' });
    }
});

// API: Get Locations
router.get('/api/locations', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query('SELECT * FROM ProductionLocations WHERE IsActive = 1 ORDER BY LocationName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading locations:', err);
        res.status(500).json({ error: 'Failed to load locations' });
    }
});

// API: Get Categories
router.get('/api/categories', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query('SELECT * FROM ProductionCategories WHERE IsActive = 1 ORDER BY CategoryName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading categories:', err);
        res.status(500).json({ error: 'Failed to load categories' });
    }
});

// API: Get Third Parties
router.get('/api/thirdparties', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query('SELECT * FROM ProductionThirdParties WHERE IsActive = 1 ORDER BY ThirdPartyName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading third parties:', err);
        res.status(500).json({ error: 'Failed to load third parties' });
    }
});

// API: Get Shifts
router.get('/api/shifts', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query('SELECT * FROM ProductionShifts WHERE IsActive = 1 ORDER BY ShiftName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading shifts:', err);
        res.status(500).json({ error: 'Failed to load shifts' });
    }
});

// API: Get Unit Costs
router.get('/api/unitcosts', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query(`SELECT * FROM ProductionUnitCosts WHERE IsActive = 1`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading unit costs:', err);
        res.status(500).json({ error: 'Failed to load unit costs' });
    }
});

// API: Get My Requests
router.get('/api/my-requests', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: 'Database not connected' });
        const result = await pool.request()
            .query(`SELECT r.*, 
                    c.CategoryName, 
                    t.ThirdPartyName
                    FROM ProductionExtrasRequests r
                    LEFT JOIN ProductionCategories c ON r.CategoryId = c.Id
                    LEFT JOIN ProductionThirdParties t ON r.ThirdPartyId = t.Id
                    ORDER BY r.CreatedDate DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading requests:', err);
        res.status(500).json({ error: 'Failed to load requests' });
    }
});

// API: Submit Request
router.post('/api/submit', async (req, res) => {
    try {
        const {
            outletId, schemeId, locationId, categoryId, thirdPartyId, shiftId,
            numberOfAgents, description, startDateTime, endDateTime,
            unitCost, totalCost, approver1Email, approver2Email
        } = req.body;
        
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ success: false, error: 'Database not connected' });
        
        await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('schemeId', sql.Int, schemeId)
            .input('locationId', sql.Int, locationId)
            .input('categoryId', sql.Int, categoryId)
            .input('thirdPartyId', sql.Int, thirdPartyId)
            .input('shiftId', sql.Int, shiftId)
            .input('numberOfAgents', sql.Int, numberOfAgents)
            .input('description', sql.NVarChar, description || null)
            .input('startDateTime', sql.DateTime, new Date(startDateTime))
            .input('endDateTime', sql.DateTime, new Date(endDateTime))
            .input('unitCost', sql.Decimal(10, 2), unitCost)
            .input('totalCost', sql.Decimal(10, 2), totalCost)
            .input('approver1Email', sql.NVarChar, approver1Email)
            .input('approver2Email', sql.NVarChar, approver2Email)
            .input('createdBy', sql.NVarChar, req.session?.user?.name || 'Unknown')
            .query(`INSERT INTO ProductionExtrasRequests 
                    (OutletId, SchemeId, LocationId, CategoryId, ThirdPartyId, ShiftId,
                     NumberOfAgents, Description, StartDateTime, EndDateTime,
                     UnitCost, TotalCost, Approver1Email, Approver2Email, CreatedBy, Status)
                    VALUES 
                    (@outletId, @schemeId, @locationId, @categoryId, @thirdPartyId, @shiftId,
                     @numberOfAgents, @description, @startDateTime, @endDateTime,
                     @unitCost, @totalCost, @approver1Email, @approver2Email, @createdBy, 'Pending')`);
        
        res.json({ success: true, message: 'Request submitted successfully' });
    } catch (err) {
        console.error('Error submitting request:', err);
        res.status(500).json({ success: false, error: 'Failed to submit request' });
    }
});

module.exports = router;
