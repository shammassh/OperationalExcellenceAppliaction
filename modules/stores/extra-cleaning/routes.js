/**
 * Extra Cleaning Agents Request Routes
 * Store managers can request extra cleaning agents
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const emailService = require('../../../services/email-service');

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

/**
 * Build dynamic approval chain based on category and rules
 * Default flow: Area Manager → Head of Operations → OE Dashboard
 * If category contains "Happy" → SKIP Area Manager
 * If category = "Helper" → ADD HR at the end
 */
async function buildApprovalChain(pool, category) {
    // Get approval settings (emails)
    const settingsResult = await pool.request()
        .query(`SELECT SettingKey, SettingValue FROM ApprovalSettings WHERE Module = 'ExtraCleaning'`);
    
    const settings = {};
    settingsResult.recordset.forEach(s => {
        settings[s.SettingKey] = s.SettingValue;
    });
    
    // Get active approval rules for Extra Cleaning
    const rulesResult = await pool.request()
        .query(`SELECT * FROM ApprovalRules WHERE Module = 'ExtraCleaning' AND IsActive = 1 ORDER BY Priority`);
    
    const rules = rulesResult.recordset;
    
    // Default approval chain: AM → HO
    let chain = [
        { role: 'AreaManager', email: settings.AREA_MANAGER_EMAIL || '' },
        { role: 'HeadOfOperations', email: settings.HEAD_OF_OPERATIONS_EMAIL || '' }
    ];
    
    // Apply rules based on category
    for (const rule of rules) {
        let matches = false;
        
        // Check if rule condition matches
        if (rule.TriggerField === 'Category') {
            if (rule.TriggerOperator === 'contains') {
                matches = category && category.toLowerCase().includes(rule.TriggerValue.toLowerCase());
            } else if (rule.TriggerOperator === 'equals') {
                matches = category && category.toLowerCase() === rule.TriggerValue.toLowerCase();
            }
        }
        
        if (matches) {
            if (rule.ActionType === 'skip') {
                // Remove the target approver from chain
                chain = chain.filter(a => a.role !== rule.TargetApprover);
            } else if (rule.ActionType === 'add') {
                // Add the target approver at the end (before OE Dashboard)
                const approverEmail = rule.TargetApprover === 'HR' 
                    ? settings.HR_MANAGER_EMAIL 
                    : settings[rule.TargetApprover.toUpperCase() + '_EMAIL'] || '';
                    
                chain.push({ role: rule.TargetApprover, email: approverEmail });
            }
        }
    }
    
    // Filter out approvers with no email configured
    chain = chain.filter(a => a.email && a.email.trim() !== '');
    
    return chain;
}

// Main form page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get stores
        const stores = await pool.request().query('SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        
        // Get categories
        const categories = await pool.request().query('SELECT Id, CategoryName FROM CleaningCategories WHERE IsActive = 1 ORDER BY CategoryName');
        
        // Get users by role for approval dropdowns (using multi-role junction table)
        const areaManagers = await pool.request().query(`
            SELECT DISTINCT u.Id, u.DisplayName, u.Email 
            FROM Users u 
            INNER JOIN UserRoleAssignments ura ON u.Id = ura.UserId
            INNER JOIN UserRoles r ON ura.RoleId = r.Id 
            WHERE r.RoleName = 'Area Manager' AND u.IsActive = 1 
            ORDER BY u.DisplayName
        `);
        
        const headOfOps = await pool.request().query(`
            SELECT DISTINCT u.Id, u.DisplayName, u.Email 
            FROM Users u 
            INNER JOIN UserRoleAssignments ura ON u.Id = ura.UserId
            INNER JOIN UserRoles r ON ura.RoleId = r.Id 
            WHERE r.RoleName = 'Head of Operations' AND u.IsActive = 1 
            ORDER BY u.DisplayName
        `);
        
        const hrUsers = await pool.request().query(`
            SELECT DISTINCT u.Id, u.DisplayName, u.Email 
            FROM Users u 
            INNER JOIN UserRoleAssignments ura ON u.Id = ura.UserId
            INNER JOIN UserRoles r ON ura.RoleId = r.Id 
            WHERE r.RoleName = 'HR Officer' AND u.IsActive = 1 
            ORDER BY u.DisplayName
        `);
        
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
        
        // Build approval dropdown options
        const areaManagerOptions = areaManagers.recordset.map(u => 
            `<option value="${u.Id}" data-name="${u.DisplayName}" data-email="${u.Email}">${u.DisplayName}</option>`
        ).join('');
        
        const headOfOpsOptions = headOfOps.recordset.map(u => 
            `<option value="${u.Id}" data-name="${u.DisplayName}" data-email="${u.Email}">${u.DisplayName}</option>`
        ).join('');
        
        const hrOptions = hrUsers.recordset.map(u => 
            `<option value="${u.Id}" data-name="${u.DisplayName}" data-email="${u.Email}">${u.DisplayName}</option>`
        ).join('');
        
        // Store providers as JSON for JavaScript filtering
        const providersJson = JSON.stringify(providers.recordset);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
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
                            
                            <!-- Approval Selection -->
                            <div class="form-section">
                                <div class="section-title">✅ Select Approvers</div>
                                <div class="form-row" id="approvalRow">
                                    <!-- Area Manager -->
                                    <div class="form-group" id="areaManagerGroup">
                                        <label class="required" for="areaManagerId">Area Manager</label>
                                        <select id="areaManagerId" name="areaManagerId" required onchange="updateApproverHiddenFields('am')">
                                            <option value="">Select Area Manager...</option>
                                            ${areaManagerOptions}
                                        </select>
                                        <input type="hidden" id="areaManagerName" name="areaManagerName">
                                        <input type="hidden" id="areaManagerEmail" name="areaManagerEmail">
                                    </div>
                                    
                                    <!-- Head of Operations -->
                                    <div class="form-group" id="headOfOpsGroup">
                                        <label class="required" for="headOfOpsId">Head of Operations</label>
                                        <select id="headOfOpsId" name="headOfOpsId" required onchange="updateApproverHiddenFields('ho')">
                                            <option value="">Select Head of Operations...</option>
                                            ${headOfOpsOptions}
                                        </select>
                                        <input type="hidden" id="headOfOpsName" name="headOfOpsName">
                                        <input type="hidden" id="headOfOpsEmail" name="headOfOpsEmail">
                                    </div>
                                    
                                    <!-- HR Responsible -->
                                    <div class="form-group" id="hrGroup" style="display:none;">
                                        <label class="required" for="hrId">HR Responsible</label>
                                        <select id="hrId" name="hrId" onchange="updateApproverHiddenFields('hr')">
                                            <option value="">Select HR Responsible...</option>
                                            ${hrOptions}
                                        </select>
                                        <input type="hidden" id="hrName" name="hrName">
                                        <input type="hidden" id="hrEmail" name="hrEmail">
                                    </div>
                                </div>
                                <div id="approvalFlowInfo" style="background:#e8f7f9;padding:15px;border-radius:8px;margin-top:15px;font-size:13px;color:#138496;">
                                    <strong>Approval Flow:</strong> <span id="approvalFlowText">Area Manager → Head of Operations → OE Dashboard</span>
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
                        
                        // Update approver visibility when category changes
                        updateApproverVisibility();
                    });
                    
                    // Update approver visibility when store changes
                    document.getElementById('store').addEventListener('change', function() {
                        updateApproverVisibility();
                    });
                    
                    /**
                     * Approver Visibility Rules:
                     * Rule 1: Category = Helper AND Store contains "Happy" → HO + HR (no AM)
                     * Rule 2: Category = Helper only → AM + HO + HR
                     * Rule 3: Store contains "Happy" only → HO only (no AM, no HR)
                     * Rule 4: Default → AM + HO (no HR)
                     */
                    function updateApproverVisibility() {
                        const category = document.getElementById('category').value;
                        const store = document.getElementById('store').value;
                        
                        const amGroup = document.getElementById('areaManagerGroup');
                        const hoGroup = document.getElementById('headOfOpsGroup');
                        const hrGroup = document.getElementById('hrGroup');
                        const amSelect = document.getElementById('areaManagerId');
                        const hrSelect = document.getElementById('hrId');
                        const flowText = document.getElementById('approvalFlowText');
                        
                        const isHelper = category && category.toLowerCase() === 'helpers';
                        const isHappy = store && store.toLowerCase().includes('happy');
                        
                        // Rule 1: Helper + Happy → HO + HR (skip AM)
                        if (isHelper && isHappy) {
                            amGroup.style.display = 'none';
                            amSelect.removeAttribute('required');
                            amSelect.value = '';
                            
                            hoGroup.style.display = 'block';
                            
                            hrGroup.style.display = 'block';
                            hrSelect.setAttribute('required', 'required');
                            
                            flowText.textContent = 'Head of Operations → HR Responsible → OE Dashboard';
                        }
                        // Rule 2: Helper only → AM + HO + HR
                        else if (isHelper && !isHappy) {
                            amGroup.style.display = 'block';
                            amSelect.setAttribute('required', 'required');
                            
                            hoGroup.style.display = 'block';
                            
                            hrGroup.style.display = 'block';
                            hrSelect.setAttribute('required', 'required');
                            
                            flowText.textContent = 'Area Manager → Head of Operations → HR Responsible → OE Dashboard';
                        }
                        // Rule 3: Happy only (not Helper) → HO only
                        else if (!isHelper && isHappy) {
                            amGroup.style.display = 'none';
                            amSelect.removeAttribute('required');
                            amSelect.value = '';
                            
                            hoGroup.style.display = 'block';
                            
                            hrGroup.style.display = 'none';
                            hrSelect.removeAttribute('required');
                            hrSelect.value = '';
                            
                            flowText.textContent = 'Head of Operations → OE Dashboard';
                        }
                        // Rule 4: Default → AM + HO (no HR)
                        else {
                            amGroup.style.display = 'block';
                            amSelect.setAttribute('required', 'required');
                            
                            hoGroup.style.display = 'block';
                            
                            hrGroup.style.display = 'none';
                            hrSelect.removeAttribute('required');
                            hrSelect.value = '';
                            
                            flowText.textContent = 'Area Manager → Head of Operations → OE Dashboard';
                        }
                    }
                    
                    // Initialize visibility on page load
                    updateApproverVisibility();
                    
                    // Update hidden fields when approver dropdown changes
                    function updateApproverHiddenFields(type) {
                        let select, nameField, emailField;
                        
                        if (type === 'am') {
                            select = document.getElementById('areaManagerId');
                            nameField = document.getElementById('areaManagerName');
                            emailField = document.getElementById('areaManagerEmail');
                        } else if (type === 'ho') {
                            select = document.getElementById('headOfOpsId');
                            nameField = document.getElementById('headOfOpsName');
                            emailField = document.getElementById('headOfOpsEmail');
                        } else if (type === 'hr') {
                            select = document.getElementById('hrId');
                            nameField = document.getElementById('hrName');
                            emailField = document.getElementById('hrEmail');
                        }
                        
                        if (select && select.selectedIndex > 0) {
                            const option = select.options[select.selectedIndex];
                            nameField.value = option.getAttribute('data-name') || option.textContent;
                            emailField.value = option.getAttribute('data-email') || '';
                        } else if (nameField && emailField) {
                            nameField.value = '';
                            emailField.value = '';
                        }
                    }
                    
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
        console.log('📋 Category:', req.body.category);
        console.log('📋 Store:', req.body.store);
        
        // Get selected approvers from form
        const category = req.body.category || '';
        const store = req.body.store || '';
        const isHelper = category.toLowerCase() === 'helpers';
        const isHappy = store.toLowerCase().includes('happy');
        
        // Get selected approver details from form
        const selectedAM = req.body.areaManagerId ? {
            id: parseInt(req.body.areaManagerId),
            name: req.body.areaManagerName || '',
            email: req.body.areaManagerEmail || ''
        } : null;
        
        const selectedHO = req.body.headOfOpsId ? {
            id: parseInt(req.body.headOfOpsId),
            name: req.body.headOfOpsName || '',
            email: req.body.headOfOpsEmail || ''
        } : null;
        
        const selectedHR = req.body.hrId ? {
            id: parseInt(req.body.hrId),
            name: req.body.hrName || '',
            email: req.body.hrEmail || ''
        } : null;
        
        // If names/emails not passed from form, fetch from database
        if (selectedAM && (!selectedAM.name || !selectedAM.email)) {
            const amUser = await pool.request()
                .input('id', sql.Int, selectedAM.id)
                .query('SELECT DisplayName, Email FROM Users WHERE Id = @id');
            if (amUser.recordset.length > 0) {
                selectedAM.name = amUser.recordset[0].DisplayName;
                selectedAM.email = amUser.recordset[0].Email;
            }
        }
        
        if (selectedHO && (!selectedHO.name || !selectedHO.email)) {
            const hoUser = await pool.request()
                .input('id', sql.Int, selectedHO.id)
                .query('SELECT DisplayName, Email FROM Users WHERE Id = @id');
            if (hoUser.recordset.length > 0) {
                selectedHO.name = hoUser.recordset[0].DisplayName;
                selectedHO.email = hoUser.recordset[0].Email;
            }
        }
        
        if (selectedHR && selectedHR.id && (!selectedHR.name || !selectedHR.email)) {
            const hrUser = await pool.request()
                .input('id', sql.Int, selectedHR.id)
                .query('SELECT DisplayName, Email FROM Users WHERE Id = @id');
            if (hrUser.recordset.length > 0) {
                selectedHR.name = hrUser.recordset[0].DisplayName;
                selectedHR.email = hrUser.recordset[0].Email;
            }
        }
        
        // Build approval chain based on visibility rules
        let approvalChain = [];
        
        // Rule 1: Helper + Happy → HO + HR (skip AM)
        if (isHelper && isHappy) {
            if (selectedHO) approvalChain.push({ role: 'HeadOfOperations', email: selectedHO.email, name: selectedHO.name, id: selectedHO.id });
            if (selectedHR && selectedHR.id) approvalChain.push({ role: 'HR', email: selectedHR.email, name: selectedHR.name, id: selectedHR.id });
        }
        // Rule 2: Helper only → AM + HO + HR
        else if (isHelper && !isHappy) {
            if (selectedAM) approvalChain.push({ role: 'AreaManager', email: selectedAM.email, name: selectedAM.name, id: selectedAM.id });
            if (selectedHO) approvalChain.push({ role: 'HeadOfOperations', email: selectedHO.email, name: selectedHO.name, id: selectedHO.id });
            if (selectedHR && selectedHR.id) approvalChain.push({ role: 'HR', email: selectedHR.email, name: selectedHR.name, id: selectedHR.id });
        }
        // Rule 3: Happy only → HO only
        else if (!isHelper && isHappy) {
            if (selectedHO) approvalChain.push({ role: 'HeadOfOperations', email: selectedHO.email, name: selectedHO.name, id: selectedHO.id });
        }
        // Rule 4: Default → AM + HO
        else {
            if (selectedAM) approvalChain.push({ role: 'AreaManager', email: selectedAM.email, name: selectedAM.name, id: selectedAM.id });
            if (selectedHO) approvalChain.push({ role: 'HeadOfOperations', email: selectedHO.email, name: selectedHO.name, id: selectedHO.id });
        }
        
        console.log('📋 Approval Chain:', JSON.stringify(approvalChain));
        
        // Format time values (HTML time input gives HH:MM, SQL needs HH:MM:SS)
        const formatTime = (timeStr) => {
            if (!timeStr) return null;
            // Add seconds if not present
            return timeStr.includes(':') && timeStr.split(':').length === 2 
                ? timeStr + ':00' 
                : timeStr;
        };
        
        // Serialize approval chain for storage
        const approvalChainJson = JSON.stringify(approvalChain);
        const firstApprover = approvalChain.length > 0 ? approvalChain[0] : null;
        
        // Determine initial status based on chain
        const initialStatus = firstApprover ? 'PendingApproval' : 'FullyApproved';
        
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
            .input('createdByEmail', sql.NVarChar, req.currentUser?.email || null)
            .input('approvalChain', sql.NVarChar, approvalChainJson)
            .input('currentStep', sql.Int, 0)
            .input('currentApproverEmail', sql.NVarChar, firstApprover?.email || null)
            .input('currentApproverRole', sql.NVarChar, firstApprover?.role || null)
            .input('overallStatus', sql.NVarChar, initialStatus)
            .input('selectedAmId', sql.Int, selectedAM?.id || null)
            .input('selectedAmName', sql.NVarChar, selectedAM?.name || null)
            .input('selectedAmEmail', sql.NVarChar, selectedAM?.email || null)
            .input('selectedHoId', sql.Int, selectedHO?.id || null)
            .input('selectedHoName', sql.NVarChar, selectedHO?.name || null)
            .input('selectedHoEmail', sql.NVarChar, selectedHO?.email || null)
            .input('selectedHrId', sql.Int, selectedHR?.id || null)
            .input('selectedHrName', sql.NVarChar, selectedHR?.name || null)
            .input('selectedHrEmail', sql.NVarChar, selectedHR?.email || null)
            .query(`
                INSERT INTO ExtraCleaningRequests (
                    Store, Category, ThirdParty, NumberOfAgents, Description,
                    StartDate, StartTimeFrom, StartTimeTo, ShiftHours,
                    EndDate, EndTimeFrom, EndTimeTo, CreatedBy, CreatedByEmail,
                    ApprovalChain, CurrentApprovalStep, CurrentApproverEmail, CurrentApproverRole, OverallStatus,
                    SelectedAreaManagerId, SelectedAreaManagerName, SelectedAreaManagerEmail,
                    SelectedHeadOfOpsId, SelectedHeadOfOpsName, SelectedHeadOfOpsEmail,
                    SelectedHRId, SelectedHRName, SelectedHREmail
                ) VALUES (
                    @store, @category, @thirdParty, @numberOfAgents, @description,
                    @startDate, @startTimeFrom, @startTimeTo, @shiftHours,
                    @endDate, @endTimeFrom, @endTimeTo, @createdBy, @createdByEmail,
                    @approvalChain, @currentStep, @currentApproverEmail, @currentApproverRole, @overallStatus,
                    @selectedAmId, @selectedAmName, @selectedAmEmail,
                    @selectedHoId, @selectedHoName, @selectedHoEmail,
                    @selectedHrId, @selectedHrName, @selectedHrEmail
                );
                SELECT SCOPE_IDENTITY() as Id;
            `);
        
        const requestId = result.recordset[0].Id;
        
        // Log the approval chain that will be used
        console.log('✅ Request #' + requestId + ' created with approval chain:', approvalChain.map(a => a.role).join(' → '));
        
        // Send email to first approver
        if (firstApprover && firstApprover.email) {
            console.log('📧 Sending approval email to:', firstApprover.role, '-', firstApprover.email);
            
            // Determine the app URL based on environment
            const appUrl = process.env.NODE_ENV === 'live' 
                ? 'https://oeapp.gmrlapps.com' 
                : 'https://oeapp-uat.gmrlapps.com';
            
            // Get request details for email
            const requestDetails = {
                Id: requestId,
                Store: req.body.store,
                Category: req.body.category,
                SubmittedBy: req.session?.user?.displayName || req.session?.user?.email || 'Unknown',
                DateRequired: req.body.start_date,
                Description: req.body.description
            };
            
            // Send email using user's access token (don't await - let it send in background)
            emailService.sendApprovalRequestEmail({
                approverEmail: firstApprover.email,
                approverRole: firstApprover.role,
                request: requestDetails,
                appUrl: appUrl,
                accessToken: req.currentUser?.accessToken
            }).then(result => {
                if (result.success) {
                    console.log('📧 ✅ Approval email sent to', firstApprover.email);
                } else {
                    console.error('📧 ❌ Failed to send approval email:', result.error);
                }
            }).catch(err => {
                console.error('📧 ❌ Email error:', err.message);
            });
        }
        
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

// Success page - shows the dynamic approval chain for this request
router.get('/success/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get the request to show the approval chain
        const requestResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`SELECT ApprovalChain, Category FROM ExtraCleaningRequests WHERE Id = @id`);
        
        await pool.close();
        
        let approvalChainHtml = 'Area Manager → Head of Operations';
        if (requestResult.recordset.length > 0 && requestResult.recordset[0].ApprovalChain) {
            const chain = JSON.parse(requestResult.recordset[0].ApprovalChain);
            approvalChainHtml = chain.map(a => {
                const roleLabels = {
                    'AreaManager': 'Area Manager',
                    'HeadOfOperations': 'Head of Operations',
                    'HR': 'HR Manager'
                };
                return roleLabels[a.role] || a.role;
            }).join(' → ');
            
            if (approvalChainHtml) {
                approvalChainHtml += ' → OE Dashboard';
            }
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Request Submitted - ${process.env.APP_NAME}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                    .success-card { background: white; padding: 50px; border-radius: 16px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 550px; }
                    .success-icon { font-size: 64px; margin-bottom: 20px; }
                    h2 { color: #28a745; margin-bottom: 15px; }
                    p { color: #666; margin-bottom: 25px; }
                    .request-id { background: #e8f7f9; padding: 15px 30px; border-radius: 8px; font-size: 18px; font-weight: 600; color: #17a2b8; margin-bottom: 25px; display: inline-block; }
                    .approval-chain { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8; text-align: left; }
                    .approval-chain .label { font-weight: 600; color: #333; margin-bottom: 5px; }
                    .approval-chain .flow { color: #667eea; font-weight: 500; }
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
                    <div class="approval-chain">
                        <div class="label">📋 Approval Workflow:</div>
                        <div class="flow">${approvalChainHtml}</div>
                    </div>
                    <div style="margin-top:20px;">
                        <a href="/stores/extra-cleaning" class="btn btn-primary">New Request</a>
                        <a href="/stores/extra-cleaning/my-requests" class="btn btn-secondary">View My Requests</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading success page:', err);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Request Submitted - ${process.env.APP_NAME}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                    .success-card { background: white; padding: 50px; border-radius: 16px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px; }
                    .success-icon { font-size: 64px; margin-bottom: 20px; }
                    h2 { color: #28a745; margin-bottom: 15px; }
                    .btn { display: inline-block; padding: 12px 25px; border-radius: 8px; text-decoration: none; margin: 5px; }
                    .btn-primary { background: #17a2b8; color: white; }
                </style>
            </head>
            <body>
                <div class="success-card">
                    <div class="success-icon">✅</div>
                    <h2>Request Submitted!</h2>
                    <p>Request #ECR-${req.params.id} has been submitted.</p>
                    <a href="/stores/extra-cleaning" class="btn btn-primary">New Request</a>
                </div>
            </body>
            </html>
        `);
    }
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
                <meta charset="UTF-8">
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

// GET: Approval page from email link
router.get('/approve/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const requestId = parseInt(req.params.id);
        const action = req.query.action; // 'approve' or 'reject' from email link
        
        // Get the request details
        const result = await pool.request()
            .input('id', sql.Int, requestId)
            .query(`SELECT r.*, u.DisplayName as CreatedByName 
                    FROM ExtraCleaningRequests r
                    LEFT JOIN Users u ON r.CreatedBy = u.Id
                    WHERE r.Id = @id`);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).send(`
                <div style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
                    <h2 style="color:#dc3545;">❌ Request Not Found</h2>
                    <p>The request you're looking for doesn't exist or has been deleted.</p>
                </div>
            `);
        }
        
        const request = result.recordset[0];
        const approvalChain = JSON.parse(request.ApprovalChain || '[]');
        const currentApprover = approvalChain[request.CurrentApprovalStep] || {};
        
        // Check if already fully approved or rejected
        if (request.OverallStatus === 'FullyApproved') {
            return res.send(`
                <div style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
                    <h2 style="color:#28a745;">✅ Already Approved</h2>
                    <p>This request has already been fully approved.</p>
                    <a href="/stores/extra-cleaning" style="color:#667eea;">← Back to Extra Cleaning</a>
                </div>
            `);
        }
        
        if (request.OverallStatus === 'Rejected') {
            return res.send(`
                <div style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
                    <h2 style="color:#dc3545;">❌ Already Rejected</h2>
                    <p>This request has already been rejected.</p>
                    <a href="/stores/extra-cleaning" style="color:#667eea;">← Back to Extra Cleaning</a>
                </div>
            `);
        }
        
        const roleNames = {
            'AreaManager': 'Area Manager',
            'HeadOfOperations': 'Head of Operations',
            'HR': 'HR Manager'
        };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Approve Request - Extra Cleaning</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header p { margin: 10px 0 0 0; opacity: 0.9; }
                    .content { padding: 25px; }
                    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #eee; }
                    .detail-label { font-weight: 600; width: 140px; color: #666; }
                    .detail-value { flex: 1; }
                    .status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                    .status-pending { background: #fff3cd; color: #856404; }
                    .approval-section { margin-top: 25px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
                    .approval-section h3 { margin-top: 0; color: #333; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; margin-bottom: 5px; font-weight: 600; }
                    .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; min-height: 80px; font-family: inherit; }
                    .buttons { display: flex; gap: 10px; margin-top: 20px; }
                    .btn { flex: 1; padding: 14px 20px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; text-align: center; }
                    .btn-approve { background: #28a745; color: white; }
                    .btn-approve:hover { background: #218838; }
                    .btn-reject { background: #dc3545; color: white; }
                    .btn-reject:hover { background: #c82333; }
                    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                    .chain { margin-top: 15px; padding: 15px; background: #e9ecef; border-radius: 6px; }
                    .chain-step { display: inline-block; padding: 5px 10px; margin: 2px; border-radius: 4px; font-size: 12px; }
                    .chain-done { background: #28a745; color: white; }
                    .chain-current { background: #667eea; color: white; }
                    .chain-pending { background: #ddd; color: #666; }
                    .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 6px; color: white; font-weight: 600; display: none; z-index: 1000; }
                    .toast-success { background: #28a745; }
                    .toast-error { background: #dc3545; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🧹 Extra Cleaning Request</h1>
                        <p>Pending your approval as ${roleNames[request.CurrentApproverRole] || request.CurrentApproverRole}</p>
                    </div>
                    <div class="content">
                        <div class="detail-row">
                            <span class="detail-label">Request ID:</span>
                            <span class="detail-value">#${request.Id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Store:</span>
                            <span class="detail-value">${request.Store || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Category:</span>
                            <span class="detail-value">${request.Category || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Third Party:</span>
                            <span class="detail-value">${request.ThirdParty || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">No. of Agents:</span>
                            <span class="detail-value">${request.NumberOfAgents || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Start Date:</span>
                            <span class="detail-value">${request.StartDate ? new Date(request.StartDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">End Date:</span>
                            <span class="detail-value">${request.EndDate ? new Date(request.EndDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Requested By:</span>
                            <span class="detail-value">${request.CreatedByName || 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Description:</span>
                            <span class="detail-value">${request.Description || 'No description provided'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value"><span class="status-badge status-pending">⏳ Pending Approval</span></span>
                        </div>
                        
                        <div class="chain">
                            <strong>Approval Chain:</strong><br>
                            ${approvalChain.map((step, idx) => {
                                let cls = 'chain-pending';
                                if (idx < request.CurrentApprovalStep) cls = 'chain-done';
                                else if (idx === request.CurrentApprovalStep) cls = 'chain-current';
                                return '<span class="chain-step ' + cls + '">' + (roleNames[step.role] || step.role) + '</span>';
                            }).join(' → ')}
                        </div>
                        
                        <div class="approval-section">
                            <h3>Your Decision</h3>
                            <div class="form-group">
                                <label for="comments">Comments (optional):</label>
                                <textarea id="comments" placeholder="Add any comments about your decision..."></textarea>
                            </div>
                            <div class="buttons">
                                <button class="btn btn-approve" onclick="submitApproval('approve')">✅ Approve</button>
                                <button class="btn btn-reject" onclick="submitApproval('reject')">❌ Reject</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast toast-' + type;
                        toast.style.display = 'block';
                        setTimeout(() => { toast.style.display = 'none'; }, 3000);
                    }
                    
                    async function submitApproval(action) {
                        const comments = document.getElementById('comments').value;
                        const buttons = document.querySelectorAll('.btn');
                        buttons.forEach(b => b.disabled = true);
                        
                        try {
                            const res = await fetch('/stores/extra-cleaning/api/approve/${requestId}', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action, comments })
                            });
                            
                            const data = await res.json();
                            
                            if (res.ok && data.success) {
                                showToast(data.message, 'success');
                                setTimeout(() => {
                                    window.location.href = '/stores/extra-cleaning/approval-success?action=' + action + '&status=' + data.status;
                                }, 1500);
                            } else {
                                showToast(data.error || 'Failed to process', 'error');
                                buttons.forEach(b => b.disabled = false);
                            }
                        } catch (err) {
                            showToast('Error: ' + err.message, 'error');
                            buttons.forEach(b => b.disabled = false);
                        }
                    }
                    
                    // Auto-show action if from email link
                    ${action === 'approve' ? "document.querySelector('.btn-approve').style.animation = 'pulse 1s infinite';" : ''}
                    ${action === 'reject' ? "document.querySelector('.btn-reject').style.animation = 'pulse 1s infinite';" : ''}
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading approval page:', err);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
                <h2 style="color:#dc3545;">❌ Error</h2>
                <p>${err.message}</p>
            </div>
        `);
    }
});

// Success page after approval
router.get('/approval-success', (req, res) => {
    const action = req.query.action;
    const status = req.query.status;
    
    const isApproved = action === 'approve';
    const isFullyApproved = status === 'FullyApproved';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${isApproved ? 'Approved' : 'Rejected'} - Extra Cleaning</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: #f5f5f5; text-align: center; }
                .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .icon { font-size: 64px; margin-bottom: 20px; }
                h1 { color: ${isApproved ? '#28a745' : '#dc3545'}; margin: 0 0 15px 0; }
                p { color: #666; margin-bottom: 25px; }
                .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
                .btn:hover { background: #5a6fd6; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">${isApproved ? '✅' : '❌'}</div>
                <h1>${isApproved ? (isFullyApproved ? 'Fully Approved!' : 'Approved!') : 'Rejected'}</h1>
                <p>${isApproved 
                    ? (isFullyApproved 
                        ? 'The request has been fully approved and is now complete.' 
                        : 'Your approval has been recorded. The request has been sent to the next approver.')
                    : 'The request has been rejected and the requester has been notified.'
                }</p>
                <a href="/stores/extra-cleaning" class="btn">← Back to Extra Cleaning</a>
            </div>
        </body>
        </html>
    `);
});

// API: Approve/Reject request (called from approval email link or dashboard)
router.post('/api/approve/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const requestId = parseInt(req.params.id);
        const { action, comments } = req.body; // action: 'approve' or 'reject'
        const approverEmail = req.currentUser?.email || req.body.approverEmail;
        const approverName = req.currentUser?.name || req.body.approverName || 'Unknown';
        
        // Get the current request
        const requestResult = await pool.request()
            .input('id', sql.Int, requestId)
            .query(`SELECT * FROM ExtraCleaningRequests WHERE Id = @id`);
        
        if (requestResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ error: 'Request not found' });
        }
        
        const request = requestResult.recordset[0];
        const approvalChain = JSON.parse(request.ApprovalChain || '[]');
        const currentStep = request.CurrentApprovalStep || 0;
        
        // Verify this is the current approver
        if (request.CurrentApproverEmail?.toLowerCase() !== approverEmail?.toLowerCase()) {
            await pool.close();
            return res.status(403).json({ error: 'You are not the current approver for this request' });
        }
        
        // Log the approval action in history
        await pool.request()
            .input('requestId', sql.Int, requestId)
            .input('approverEmail', sql.NVarChar, approverEmail)
            .input('approverRole', sql.NVarChar, request.CurrentApproverRole)
            .input('approverName', sql.NVarChar, approverName)
            .input('action', sql.NVarChar, action === 'approve' ? 'Approved' : 'Rejected')
            .input('comments', sql.NVarChar, comments || null)
            .input('stepNumber', sql.Int, currentStep)
            .query(`INSERT INTO ExtraCleaningApprovalHistory 
                    (RequestId, ApproverEmail, ApproverRole, ApproverName, Action, Comments, StepNumber)
                    VALUES (@requestId, @approverEmail, @approverRole, @approverName, @action, @comments, @stepNumber)`);
        
        if (action === 'reject') {
            // Request rejected - set status to Rejected
            await pool.request()
                .input('id', sql.Int, requestId)
                .query(`UPDATE ExtraCleaningRequests SET 
                        OverallStatus = 'Rejected',
                        CurrentApproverEmail = NULL,
                        CurrentApproverRole = NULL
                        WHERE Id = @id`);
            
            await pool.close();
            console.log('❌ Request #' + requestId + ' rejected by ' + approverName);
            
            // Send rejection notification to requester
            const appUrl = process.env.NODE_ENV === 'live' 
                ? 'https://oeapp.gmrlapps.com' 
                : 'https://oeapp-uat.gmrlapps.com';
            
            if (request.CreatedByEmail) {
                emailService.sendStatusNotificationEmail({
                    requesterEmail: request.CreatedByEmail,
                    request: request,
                    status: 'rejected',
                    approverRole: request.CurrentApproverRole,
                    comments: comments,
                    appUrl: appUrl
                }).catch(err => console.error('📧 ❌ Failed to send rejection email:', err.message));
            }
            
            return res.json({ success: true, message: 'Request rejected', status: 'Rejected' });
        }
        
        // Request approved - move to next step
        const nextStep = currentStep + 1;
        
        if (nextStep >= approvalChain.length) {
            // All approvers have approved - mark as fully approved
            await pool.request()
                .input('id', sql.Int, requestId)
                .query(`UPDATE ExtraCleaningRequests SET 
                        OverallStatus = 'FullyApproved',
                        CurrentApprovalStep = ${nextStep},
                        CurrentApproverEmail = NULL,
                        CurrentApproverRole = NULL
                        WHERE Id = @id`);
            
            await pool.close();
            console.log('✅ Request #' + requestId + ' FULLY APPROVED');
            
            // Send approval notification to requester
            const appUrl = process.env.NODE_ENV === 'live' 
                ? 'https://oeapp.gmrlapps.com' 
                : 'https://oeapp-uat.gmrlapps.com';
            
            if (request.CreatedByEmail) {
                emailService.sendStatusNotificationEmail({
                    requesterEmail: request.CreatedByEmail,
                    request: request,
                    status: 'approved',
                    approverRole: 'All Approvers',
                    comments: 'Your request has been fully approved!',
                    appUrl: appUrl
                }).catch(err => console.error('📧 ❌ Failed to send approval notification:', err.message));
            }
            
            return res.json({ success: true, message: 'Request fully approved!', status: 'FullyApproved' });
        } else {
            // Move to next approver
            const nextApprover = approvalChain[nextStep];
            
            await pool.request()
                .input('id', sql.Int, requestId)
                .input('nextEmail', sql.NVarChar, nextApprover.email)
                .input('nextRole', sql.NVarChar, nextApprover.role)
                .query(`UPDATE ExtraCleaningRequests SET 
                        CurrentApprovalStep = ${nextStep},
                        CurrentApproverEmail = @nextEmail,
                        CurrentApproverRole = @nextRole
                        WHERE Id = @id`);
            
            // Send email to next approver
            const appUrl = process.env.NODE_ENV === 'live' 
                ? 'https://oeapp.gmrlapps.com' 
                : 'https://oeapp-uat.gmrlapps.com';
            
            console.log('📧 Sending approval email to next approver:', nextApprover.role, '-', nextApprover.email);
            
            emailService.sendApprovalRequestEmail({
                approverEmail: nextApprover.email,
                approverRole: nextApprover.role,
                request: request,
                appUrl: appUrl
            }).then(result => {
                if (result.success) {
                    console.log('📧 ✅ Next approver email sent to', nextApprover.email);
                } else {
                    console.error('📧 ❌ Failed to send next approver email:', result.error);
                }
            }).catch(err => console.error('📧 ❌ Email error:', err.message));
            
            await pool.close();
            console.log('✅ Request #' + requestId + ' approved by ' + approverName + ', moving to ' + nextApprover.role);
            return res.json({ 
                success: true, 
                message: 'Approved! Sent to ' + nextApprover.role, 
                status: 'PendingApproval',
                nextApprover: nextApprover.role
            });
        }
    } catch (err) {
        console.error('Error processing approval:', err);
        res.status(500).json({ error: 'Failed to process approval' });
    }
});

// API: Get request details with approval history
router.get('/api/request/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get request details
        const requestResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`SELECT r.*, u.DisplayName as CreatedByName
                    FROM ExtraCleaningRequests r
                    LEFT JOIN Users u ON r.CreatedBy = u.Id
                    WHERE r.Id = @id`);
        
        if (requestResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Get approval history
        const historyResult = await pool.request()
            .input('requestId', sql.Int, req.params.id)
            .query(`SELECT * FROM ExtraCleaningApprovalHistory 
                    WHERE RequestId = @requestId 
                    ORDER BY StepNumber, ActionDate`);
        
        await pool.close();
        
        const request = requestResult.recordset[0];
        request.approvalHistory = historyResult.recordset;
        request.approvalChainParsed = JSON.parse(request.ApprovalChain || '[]');
        
        res.json(request);
    } catch (err) {
        console.error('Error loading request details:', err);
        res.status(500).json({ error: 'Failed to load request details' });
    }
});

// API: Get pending approvals for current user
router.get('/api/pending-approvals', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userEmail = req.currentUser?.email;
        
        if (!userEmail) {
            await pool.close();
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const result = await pool.request()
            .input('email', sql.NVarChar, userEmail)
            .query(`SELECT r.*, u.DisplayName as CreatedByName
                    FROM ExtraCleaningRequests r
                    LEFT JOIN Users u ON r.CreatedBy = u.Id
                    WHERE r.CurrentApproverEmail = @email AND r.OverallStatus = 'PendingApproval'
                    ORDER BY r.CreatedAt DESC`);
        
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error loading pending approvals:', err);
        res.status(500).json({ error: 'Failed to load pending approvals' });
    }
});

module.exports = router;
