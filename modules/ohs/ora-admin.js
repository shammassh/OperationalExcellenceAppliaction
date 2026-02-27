/**
 * ORA Admin Setup
 * Configure hazard categories, injury types, and risk matrix
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    },
    pool: {
        max: 50,
        min: 5,
        idleTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000
    }
};

let poolPromise = null;
let pool = null;

async function getPool() {
    if (pool && pool.connected) return pool;
    if (pool && !pool.connected) { poolPromise = null; pool = null; }
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).then(newPool => {
            pool = newPool;
            pool.on('error', () => { poolPromise = null; pool = null; });
            return pool;
        }).catch(err => {
            poolPromise = null; pool = null;
            throw err;
        });
    }
    return poolPromise;
}

const commonStyles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
        font-family: 'Segoe UI', Arial, sans-serif; 
        background: #f0f2f5;
        min-height: 100vh;
    }
    .header {
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        color: white;
        padding: 15px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .header h1 { font-size: 22px; }
    .header-nav { display: flex; gap: 15px; }
    .header-nav a {
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
    }
    .header-nav a:hover { background: rgba(255,255,255,0.2); }
    
    .container { padding: 20px; max-width: 1400px; margin: 0 auto; }
    
    .tabs {
        display: flex;
        gap: 5px;
        background: white;
        padding: 10px 15px 0;
        border-radius: 8px 8px 0 0;
        border-bottom: 2px solid #e0e0e0;
    }
    .tab {
        padding: 12px 24px;
        cursor: pointer;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        font-weight: 500;
        color: #666;
        margin-bottom: -2px;
    }
    .tab:hover { background: #e8e8e8; }
    .tab.active {
        background: white;
        color: #2c3e50;
        border-color: #e0e0e0;
        border-bottom: 2px solid white;
    }
    
    .tab-content {
        display: none;
        background: white;
        padding: 20px;
        border-radius: 0 0 8px 8px;
    }
    .tab-content.active { display: block; }
    
    .toolbar {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
        align-items: center;
    }
    .toolbar button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .btn-primary { background: #6c5ce7; color: white; }
    .btn-primary:hover { background: #5b4cdb; }
    .btn-success { background: #27ae60; color: white; }
    .btn-danger { background: #e74c3c; color: white; }
    
    .table-wrapper {
        overflow-x: auto;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
    }
    table {
        border-collapse: collapse;
        width: 100%;
        font-size: 13px;
    }
    th, td {
        border: 1px solid #e0e0e0;
        padding: 10px;
        text-align: left;
    }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f5f8ff; }
    
    td input, td select, td textarea {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid transparent;
        background: transparent;
        font-size: 13px;
        border-radius: 4px;
    }
    td input:focus, td select:focus, td textarea:focus {
        border-color: #6c5ce7;
        outline: none;
        background: white;
    }
    td input:hover, td select:hover, td textarea:hover {
        border-color: #ddd;
    }
    
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        justify-content: center;
        align-items: center;
        z-index: 1500;
    }
    .modal.active { display: flex; }
    .modal-content {
        background: white;
        padding: 25px;
        border-radius: 12px;
        min-width: 400px;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
    }
    .modal h3 { margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
    .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
    }
    .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }
    
    .info-box {
        background: #e8f4fd;
        border-left: 4px solid #6c5ce7;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 0 8px 8px 0;
    }
    
    .risk-matrix {
        border-collapse: collapse;
        margin: 20px 0;
    }
    .risk-matrix th, .risk-matrix td {
        padding: 15px;
        text-align: center;
        font-weight: bold;
    }
    .risk-matrix .low { background: #28a745; color: white; }
    .risk-matrix .medium { background: #ffc107; color: #333; }
    .risk-matrix .high { background: #fd7e14; color: white; }
    .risk-matrix .extreme { background: #dc3545; color: white; }
    
    .toast {
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 2000;
        display: none;
    }
    .toast.success { background: #27ae60; }
    .toast.error { background: #e74c3c; }
`;

// ==========================================
// MAIN ADMIN PAGE
// ==========================================
router.get('/', async (req, res) => {
    let pool;
    try {
        pool = await getPool();
        
        // Get all data
        const hazardsResult = await pool.request().query('SELECT * FROM ORAHazardCategories ORDER BY SortOrder, CategoryName');
        const injuriesResult = await pool.request().query('SELECT * FROM ORAInjuryCategories ORDER BY SortOrder, CategoryName');
        const severityResult = await pool.request().query('SELECT * FROM ORASeverityLevels ORDER BY SortOrder');
        const likelihoodResult = await pool.request().query('SELECT * FROM ORALikelihoodLevels ORDER BY SortOrder');
        const matrixResult = await pool.request().query('SELECT * FROM ORARiskMatrix ORDER BY LikelihoodValue DESC, SeverityValue');
        
        const hazards = hazardsResult.recordset;
        const injuries = injuriesResult.recordset;
        const severityLevels = severityResult.recordset;
        const likelihoodLevels = likelihoodResult.recordset;
        const riskMatrix = matrixResult.recordset;
        
        // Build matrix display
        const matrixMap = {};
        riskMatrix.forEach(m => {
            matrixMap[`${m.SeverityValue}-${m.LikelihoodValue}`] = m;
        });
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>ORA Admin Setup</title>
                <style>${commonStyles}</style>
            </head>
            <body>
                <div class="header">
                    <h1>⚙️ ORA Admin Setup</h1>
                    <div class="header-nav">
                        <a href="/ohs/ora">📋 ORA</a>
                        <a href="/ohs">🦺 OHS</a>
                        <a href="/admin">🔧 Admin</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="tabs">
                        <div class="tab active" onclick="showTab('hazards')">⚠️ Hazard Categories</div>
                        <div class="tab" onclick="showTab('injuries')">🩹 Injury Categories</div>
                        <div class="tab" onclick="showTab('matrix')">📊 Risk Matrix</div>
                    </div>
                    
                    <!-- Hazard Categories Tab -->
                    <div class="tab-content active" id="tab-hazards">
                        <div class="info-box">
                            <strong>Hazard Categories</strong> - Define the types of hazards that can be identified in risk assessments.
                        </div>
                        
                        <div class="toolbar">
                            <button class="btn-success" onclick="showAddHazardModal()">➕ Add Hazard Category</button>
                        </div>
                        
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 50px;">Order</th>
                                        <th>Category Name</th>
                                        <th>Examples</th>
                                        <th>Potential Harm</th>
                                        <th style="width: 60px;">Active</th>
                                        <th style="width: 80px;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="hazardsTable">
                                    ${hazards.map(h => `
                                        <tr data-id="${h.Id}">
                                            <td><input type="number" value="${h.SortOrder}" onchange="updateHazard(${h.Id}, 'SortOrder', this.value)" style="width: 50px;"></td>
                                            <td><input type="text" value="${h.CategoryName}" onchange="updateHazard(${h.Id}, 'CategoryName', this.value)"></td>
                                            <td><input type="text" value="${h.Examples || ''}" onchange="updateHazard(${h.Id}, 'Examples', this.value)"></td>
                                            <td><input type="text" value="${h.PotentialHarm || ''}" onchange="updateHazard(${h.Id}, 'PotentialHarm', this.value)"></td>
                                            <td style="text-align: center;"><input type="checkbox" ${h.IsActive ? 'checked' : ''} onchange="updateHazard(${h.Id}, 'IsActive', this.checked ? 1 : 0)"></td>
                                            <td><button class="btn-danger" onclick="deleteHazard(${h.Id})" style="padding: 4px 8px; font-size: 11px;">🗑️</button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Injury Categories Tab -->
                    <div class="tab-content" id="tab-injuries">
                        <div class="info-box">
                            <strong>Injury/Illness Categories</strong> - Define the types of injuries or illnesses that can result from hazards.
                        </div>
                        
                        <div class="toolbar">
                            <button class="btn-success" onclick="showAddInjuryModal()">➕ Add Injury Category</button>
                        </div>
                        
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 50px;">Order</th>
                                        <th>Category Name</th>
                                        <th>Description</th>
                                        <th style="width: 60px;">Active</th>
                                        <th style="width: 80px;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="injuriesTable">
                                    ${injuries.map(i => `
                                        <tr data-id="${i.Id}">
                                            <td><input type="number" value="${i.SortOrder}" onchange="updateInjury(${i.Id}, 'SortOrder', this.value)" style="width: 50px;"></td>
                                            <td><input type="text" value="${i.CategoryName}" onchange="updateInjury(${i.Id}, 'CategoryName', this.value)"></td>
                                            <td><input type="text" value="${i.Description || ''}" onchange="updateInjury(${i.Id}, 'Description', this.value)"></td>
                                            <td style="text-align: center;"><input type="checkbox" ${i.IsActive ? 'checked' : ''} onchange="updateInjury(${i.Id}, 'IsActive', this.checked ? 1 : 0)"></td>
                                            <td><button class="btn-danger" onclick="deleteInjury(${i.Id})" style="padding: 4px 8px; font-size: 11px;">🗑️</button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Risk Matrix Tab -->
                    <div class="tab-content" id="tab-matrix">
                        <div class="info-box">
                            <strong>Risk Matrix</strong> - The risk level is calculated as Severity × Likelihood. This matrix shows the resulting risk levels.
                        </div>
                        
                        <h3 style="margin-bottom: 15px;">📊 Risk Assessment Matrix</h3>
                        
                        <table class="risk-matrix" style="margin-bottom: 30px;">
                            <tr>
                                <th colspan="2" rowspan="2" style="background: #f8f9fa;">Likelihood ↓ / Severity →</th>
                                ${severityLevels.map(s => `<th style="background: #f8f9fa;">${s.LevelValue}<br>${s.LevelName}</th>`).join('')}
                            </tr>
                            <tr></tr>
                            ${likelihoodLevels.slice().reverse().map(l => `
                                <tr>
                                    <th style="background: #f8f9fa;">${l.LevelValue}</th>
                                    <th style="background: #f8f9fa;">${l.LevelName}</th>
                                    ${severityLevels.map(s => {
                                        const entry = matrixMap[`${s.LevelValue}-${l.LevelValue}`];
                                        if (!entry) return '<td>-</td>';
                                        const cls = entry.RiskLevel.toLowerCase().replace(' risk', '');
                                        return `<td class="${cls}">${entry.RiskScore}<br><small>${entry.RiskLevel}</small></td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </table>
                        
                        <h4 style="margin: 20px 0 10px;">📋 Risk Level Definitions</h4>
                        <table>
                            <tr style="background: #dc3545; color: white;"><td><strong>Extreme Risk (12-16)</strong></td><td>Not tolerable: Immediate action required</td></tr>
                            <tr style="background: #fd7e14; color: white;"><td><strong>High Risk (6-11)</strong></td><td>Not tolerable: Urgent management attention</td></tr>
                            <tr style="background: #ffc107;"><td><strong>Medium Risk (3-5)</strong></td><td>Not tolerable: Management attention required</td></tr>
                            <tr style="background: #28a745; color: white;"><td><strong>Low Risk (1-2)</strong></td><td>May be tolerable: Longer term action may be needed</td></tr>
                        </table>
                        
                        <h4 style="margin: 30px 0 10px;">⚠️ Severity Levels</h4>
                        <table>
                            <thead><tr><th>Level</th><th>Name</th><th>Description</th></tr></thead>
                            <tbody>
                                ${severityLevels.map(s => `
                                    <tr>
                                        <td style="text-align: center; font-weight: bold;">${s.LevelValue}</td>
                                        <td>${s.LevelName}</td>
                                        <td>${s.Description || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <h4 style="margin: 30px 0 10px;">📈 Likelihood Levels</h4>
                        <table>
                            <thead><tr><th>Level</th><th>Name</th><th>Description</th><th>Frequency</th></tr></thead>
                            <tbody>
                                ${likelihoodLevels.map(l => `
                                    <tr>
                                        <td style="text-align: center; font-weight: bold;">${l.LevelValue}</td>
                                        <td>${l.LevelName}</td>
                                        <td>${l.Description || '-'}</td>
                                        <td>${l.FrequencyDescription || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Add Hazard Modal -->
                <div class="modal" id="addHazardModal">
                    <div class="modal-content">
                        <h3>➕ Add Hazard Category</h3>
                        <form onsubmit="addHazard(event)">
                            <div class="form-group">
                                <label>Category Name *</label>
                                <input type="text" id="newHazardName" required placeholder="e.g., Work at height">
                            </div>
                            <div class="form-group">
                                <label>Examples</label>
                                <textarea id="newHazardExamples" rows="2" placeholder="e.g., Ladders, scaffolds, rooftops"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Potential Harm</label>
                                <textarea id="newHazardHarm" rows="2" placeholder="e.g., Falls causing fractures, fatalities"></textarea>
                            </div>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addHazardModal')" style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                                <button type="submit" class="btn-success">Add</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Add Injury Modal -->
                <div class="modal" id="addInjuryModal">
                    <div class="modal-content">
                        <h3>➕ Add Injury Category</h3>
                        <form onsubmit="addInjury(event)">
                            <div class="form-group">
                                <label>Category Name *</label>
                                <input type="text" id="newInjuryName" required placeholder="e.g., Burns">
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea id="newInjuryDesc" rows="2" placeholder="Optional description"></textarea>
                            </div>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addInjuryModal')" style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                                <button type="submit" class="btn-success">Add</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    function showTab(tabId) {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        
                        document.querySelector('.tab:nth-child(' + (tabId === 'hazards' ? 1 : tabId === 'injuries' ? 2 : 3) + ')').classList.add('active');
                        document.getElementById('tab-' + tabId).classList.add('active');
                    }
                    
                    function showAddHazardModal() { document.getElementById('addHazardModal').classList.add('active'); }
                    function showAddInjuryModal() { document.getElementById('addInjuryModal').classList.add('active'); }
                    function closeModal(id) { document.getElementById(id).classList.remove('active'); }
                    
                    async function addHazard(e) {
                        e.preventDefault();
                        const data = {
                            categoryName: document.getElementById('newHazardName').value,
                            examples: document.getElementById('newHazardExamples').value,
                            potentialHarm: document.getElementById('newHazardHarm').value
                        };
                        
                        try {
                            const res = await fetch('/ohs/ora/admin/api/hazards', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            if (res.ok) {
                                showToast('Added', 'success');
                                setTimeout(() => location.reload(), 500);
                            }
                        } catch (err) {
                            showToast('Error', 'error');
                        }
                    }
                    
                    async function updateHazard(id, field, value) {
                        try {
                            await fetch('/ohs/ora/admin/api/hazards/' + id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ field, value })
                            });
                        } catch (err) {
                            showToast('Error', 'error');
                        }
                    }
                    
                    async function deleteHazard(id) {
                        if (!confirm('Delete this hazard category?')) return;
                        try {
                            const res = await fetch('/ohs/ora/admin/api/hazards/' + id, { method: 'DELETE' });
                            if (res.ok) {
                                document.querySelector('#hazardsTable tr[data-id="' + id + '"]').remove();
                                showToast('Deleted', 'success');
                            }
                        } catch (err) {
                            showToast('Error', 'error');
                        }
                    }
                    
                    async function addInjury(e) {
                        e.preventDefault();
                        const data = {
                            categoryName: document.getElementById('newInjuryName').value,
                            description: document.getElementById('newInjuryDesc').value
                        };
                        
                        try {
                            const res = await fetch('/ohs/ora/admin/api/injuries', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            if (res.ok) {
                                showToast('Added', 'success');
                                setTimeout(() => location.reload(), 500);
                            }
                        } catch (err) {
                            showToast('Error', 'error');
                        }
                    }
                    
                    async function updateInjury(id, field, value) {
                        try {
                            await fetch('/ohs/ora/admin/api/injuries/' + id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ field, value })
                            });
                        } catch (err) {
                            showToast('Error', 'error');
                        }
                    }
                    
                    async function deleteInjury(id) {
                        if (!confirm('Delete this injury category?')) return;
                        try {
                            const res = await fetch('/ohs/ora/admin/api/injuries/' + id, { method: 'DELETE' });
                            if (res.ok) {
                                document.querySelector('#injuriesTable tr[data-id="' + id + '"]').remove();
                                showToast('Deleted', 'success');
                            }
                        } catch (err) {
                            showToast('Error', 'error');
                        }
                    }
                    
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast ' + type;
                        toast.style.display = 'block';
                        setTimeout(() => toast.style.display = 'none', 3000);
                    }
                    
                    document.querySelectorAll('.modal').forEach(m => {
                        m.addEventListener('click', function(e) { if (e.target === this) closeModal(this.id); });
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('ORA Admin error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// API: Hazard CRUD
// ==========================================
router.post('/api/hazards', async (req, res) => {
    const { categoryName, examples, potentialHarm } = req.body;
    
    let pool;
    try {
        pool = await getPool();
        const maxOrder = await pool.request().query('SELECT ISNULL(MAX(SortOrder), 0) + 1 as NextOrder FROM ORAHazardCategories');
        
        await pool.request()
            .input('categoryName', sql.NVarChar, categoryName)
            .input('examples', sql.NVarChar, examples)
            .input('potentialHarm', sql.NVarChar, potentialHarm)
            .input('sortOrder', sql.Int, maxOrder.recordset[0].NextOrder)
            .query('INSERT INTO ORAHazardCategories (CategoryName, Examples, PotentialHarm, SortOrder) VALUES (@categoryName, @examples, @potentialHarm, @sortOrder)');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/api/hazards/:id', async (req, res) => {
    const { field, value } = req.body;
    const allowedFields = ['CategoryName', 'Examples', 'PotentialHarm', 'SortOrder', 'IsActive'];
    
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ success: false, error: 'Invalid field' });
    }
    
    let pool;
    try {
        pool = await getPool();
        const sqlType = field === 'SortOrder' ? sql.Int : field === 'IsActive' ? sql.Bit : sql.NVarChar;
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('value', sqlType, value)
            .query(`UPDATE ORAHazardCategories SET ${field} = @value WHERE Id = @id`);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/api/hazards/:id', async (req, res) => {
    let pool;
    try {
        pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ORAHazardCategories WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Injury CRUD
// ==========================================
router.post('/api/injuries', async (req, res) => {
    const { categoryName, description } = req.body;
    
    let pool;
    try {
        pool = await getPool();
        const maxOrder = await pool.request().query('SELECT ISNULL(MAX(SortOrder), 0) + 1 as NextOrder FROM ORAInjuryCategories');
        
        await pool.request()
            .input('categoryName', sql.NVarChar, categoryName)
            .input('description', sql.NVarChar, description)
            .input('sortOrder', sql.Int, maxOrder.recordset[0].NextOrder)
            .query('INSERT INTO ORAInjuryCategories (CategoryName, Description, SortOrder) VALUES (@categoryName, @description, @sortOrder)');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/api/injuries/:id', async (req, res) => {
    const { field, value } = req.body;
    const allowedFields = ['CategoryName', 'Description', 'SortOrder', 'IsActive'];
    
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ success: false, error: 'Invalid field' });
    }
    
    let pool;
    try {
        pool = await getPool();
        const sqlType = field === 'SortOrder' ? sql.Int : field === 'IsActive' ? sql.Bit : sql.NVarChar;
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('value', sqlType, value)
            .query(`UPDATE ORAInjuryCategories SET ${field} = @value WHERE Id = @id`);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/api/injuries/:id', async (req, res) => {
    let pool;
    try {
        pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ORAInjuryCategories WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
