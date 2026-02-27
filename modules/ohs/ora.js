/**
 * Overall Risk Assessment (ORA) Module
 * Workplace risk assessment and action planning
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
        background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
        color: white;
        padding: 15px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 1000;
    }
    .header h1 { font-size: 22px; }
    .header-nav { display: flex; gap: 15px; align-items: center; }
    .header-nav a {
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 6px;
        background: rgba(255,255,255,0.15);
        font-size: 13px;
    }
    .header-nav a:hover { background: rgba(255,255,255,0.25); }
    
    .container { padding: 20px; max-width: 1600px; margin: 0 auto; }
    
    .stats-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 25px;
    }
    .stat-card {
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        text-align: center;
    }
    .stat-number { font-size: 32px; font-weight: bold; }
    .stat-label { color: #666; font-size: 13px; margin-top: 5px; }
    
    .toolbar {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
        align-items: center;
        background: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .toolbar select, .toolbar input {
        padding: 10px 15px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
    }
    .toolbar button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
    }
    .btn-primary { background: #6c5ce7; color: white; }
    .btn-primary:hover { background: #5b4cdb; }
    .btn-success { background: #27ae60; color: white; }
    .btn-success:hover { background: #219a52; }
    .btn-danger { background: #e74c3c; color: white; }
    .btn-warning { background: #f39c12; color: white; }
    
    .card {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        overflow: hidden;
    }
    .card-header {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .card-body { padding: 20px; }
    
    .table-wrapper { overflow-x: auto; }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    th, td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #eee;
    }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9ff; }
    
    .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
    }
    .badge-low { background: #d4edda; color: #155724; }
    .badge-medium { background: #fff3cd; color: #856404; }
    .badge-high { background: #ffe5d0; color: #c25d00; }
    .badge-extreme { background: #f8d7da; color: #721c24; }
    .badge-draft { background: #e2e3e5; color: #383d41; }
    .badge-submitted { background: #cce5ff; color: #004085; }
    .badge-approved { background: #d4edda; color: #155724; }
    
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
        z-index: 2000;
    }
    .modal.active { display: flex; }
    .modal-content {
        background: white;
        padding: 25px;
        border-radius: 12px;
        min-width: 500px;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
    }
    .modal h3 { margin-bottom: 20px; color: #333; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
    .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
    }
    .form-group textarea { resize: vertical; min-height: 80px; }
    .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #eee;
    }
    
    .risk-level {
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 12px;
        display: inline-block;
    }
    .risk-low { background: #28a745; color: white; }
    .risk-medium { background: #ffc107; color: #333; }
    .risk-high { background: #fd7e14; color: white; }
    .risk-extreme { background: #dc3545; color: white; }
    
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #666;
    }
    .empty-state .icon { font-size: 60px; margin-bottom: 15px; }
`;

// ==========================================
// LANDING PAGE - List all assessments
// ==========================================
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await getPool();
        
        // Get assessments with stats
        const assessmentsResult = await pool.request().query(`
            SELECT TOP 100
                a.Id, a.AssessmentTitle, a.BoundariesDescription, a.LeadAssessorName,
                a.AssessmentDate, a.Status, a.HighestRiskLevel, a.TotalRisks, a.OpenActions,
                a.CreatedAt, s.StoreName, ISNULL(b.BrandName, 'Other') as Brand
            FROM ORAAssessments a
            JOIN Stores s ON a.StoreId = s.Id
            LEFT JOIN Brands b ON s.BrandId = b.Id
            ORDER BY a.CreatedAt DESC
        `);
        
        // Get stores for dropdown
        const storesResult = await pool.request().query(`
            SELECT s.Id, s.StoreName, ISNULL(b.BrandName, 'Other') as Brand 
            FROM Stores s 
            LEFT JOIN Brands b ON s.BrandId = b.Id 
            WHERE s.IsActive = 1 
            ORDER BY b.BrandName, s.StoreName
        `);
        
        // Stats
        const statsResult = await pool.request().query(`
            SELECT 
                COUNT(*) as TotalAssessments,
                SUM(CASE WHEN Status = 'Draft' THEN 1 ELSE 0 END) as Drafts,
                SUM(CASE WHEN HighestRiskLevel = 'Extreme Risk' THEN 1 ELSE 0 END) as ExtremeRisks,
                SUM(CASE WHEN HighestRiskLevel = 'High Risk' THEN 1 ELSE 0 END) as HighRisks,
                SUM(OpenActions) as TotalOpenActions
            FROM ORAAssessments
        `);
        
        const assessments = assessmentsResult.recordset;
        const stores = storesResult.recordset;
        const stats = statsResult.recordset[0];
        
        // Group stores by brand
        const storesByBrand = {};
        stores.forEach(store => {
            const brand = store.Brand || 'Other';
            if (!storesByBrand[brand]) storesByBrand[brand] = [];
            storesByBrand[brand].push(store);
        });
        
        // Helper functions for rendering badges
        function getRiskBadge(level) {
            if (!level) return '-';
            const classes = {
                'Low Risk': 'risk-low',
                'Medium Risk': 'risk-medium',
                'High Risk': 'risk-high',
                'Extreme Risk': 'risk-extreme'
            };
            return `<span class="risk-level ${classes[level] || ''}">${level}</span>`;
        }
        
        function getStatusBadge(status) {
            const classes = {
                'Draft': 'badge-draft',
                'Submitted': 'badge-submitted',
                'Approved': 'badge-approved'
            };
            return `<span class="badge ${classes[status] || 'badge-draft'}">${status}</span>`;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Overall Risk Assessment (ORA)</title>
                <style>${commonStyles}</style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Overall Risk Assessment (ORA)</h1>
                    <div class="header-nav">
                        <a href="/ohs/ora/admin">⚙️ Admin Setup</a>
                        <a href="/ohs">🦺 OHS</a>
                        <a href="/dashboard">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="stats-row">
                        <div class="stat-card">
                            <div class="stat-number" style="color: #6c5ce7;">${stats.TotalAssessments || 0}</div>
                            <div class="stat-label">Total Assessments</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number" style="color: #f39c12;">${stats.Drafts || 0}</div>
                            <div class="stat-label">Drafts</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number" style="color: #dc3545;">${stats.ExtremeRisks || 0}</div>
                            <div class="stat-label">Extreme Risk</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number" style="color: #fd7e14;">${stats.HighRisks || 0}</div>
                            <div class="stat-label">High Risk</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number" style="color: #e74c3c;">${stats.TotalOpenActions || 0}</div>
                            <div class="stat-label">Open Actions</div>
                        </div>
                    </div>
                    
                    <div class="toolbar">
                        <button class="btn-success" onclick="showNewAssessmentModal()">➕ New Assessment</button>
                        <select id="filterBrand" onchange="filterAssessments()" style="min-width: 150px;">
                            <option value="">All Brands</option>
                            ${Object.keys(storesByBrand).map(b => `<option value="${b}">${b}</option>`).join('')}
                        </select>
                        <select id="filterStatus" onchange="filterAssessments()" style="min-width: 120px;">
                            <option value="">All Status</option>
                            <option value="Draft">Draft</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Approved">Approved</option>
                            <option value="Closed">Closed</option>
                        </select>
                        <select id="filterRisk" onchange="filterAssessments()" style="min-width: 130px;">
                            <option value="">All Risk Levels</option>
                            <option value="Extreme Risk">Extreme Risk</option>
                            <option value="High Risk">High Risk</option>
                            <option value="Medium Risk">Medium Risk</option>
                            <option value="Low Risk">Low Risk</option>
                        </select>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <span>📋 Risk Assessments</span>
                            <span style="font-weight: normal; color: #666;">${assessments.length} records</span>
                        </div>
                        <div class="card-body">
                            ${assessments.length === 0 ? `
                                <div class="empty-state">
                                    <div class="icon">📋</div>
                                    <h3>No Risk Assessments Yet</h3>
                                    <p>Create your first Overall Risk Assessment to get started.</p>
                                </div>
                            ` : `
                                <div class="table-wrapper">
                                    <table id="assessmentsTable">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Store</th>
                                                <th>Title / Boundaries</th>
                                                <th>Lead Assessor</th>
                                                <th>Date</th>
                                                <th>Risks</th>
                                                <th>Highest Risk</th>
                                                <th>Actions</th>
                                                <th>Status</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${assessments.map(a => `
                                                <tr data-brand="${a.Brand}" data-status="${a.Status}" data-risk="${a.HighestRiskLevel || ''}">
                                                    <td><strong>ORA-${a.Id}</strong></td>
                                                    <td>
                                                        <strong>${a.StoreName}</strong>
                                                        <br><small style="color:#888">${a.Brand}</small>
                                                    </td>
                                                    <td>
                                                        ${a.AssessmentTitle || '<em>No title</em>'}
                                                        ${a.BoundariesDescription ? `<br><small style="color:#888">${a.BoundariesDescription.substring(0, 50)}...</small>` : ''}
                                                    </td>
                                                    <td>${a.LeadAssessorName || '-'}</td>
                                                    <td>${a.AssessmentDate ? new Date(a.AssessmentDate).toLocaleDateString() : '-'}</td>
                                                    <td style="text-align: center;">${a.TotalRisks || 0}</td>
                                                    <td>${getRiskBadge(a.HighestRiskLevel)}</td>
                                                    <td style="text-align: center;">
                                                        ${a.OpenActions > 0 ? `<span style="color: #e74c3c; font-weight: bold;">${a.OpenActions}</span>` : '0'}
                                                    </td>
                                                    <td>${getStatusBadge(a.Status)}</td>
                                                    <td>
                                                        <a href="/ohs/ora/assessment/${a.Id}" class="btn-primary" style="padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">View</a>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <!-- New Assessment Modal -->
                <div class="modal" id="newAssessmentModal">
                    <div class="modal-content">
                        <h3>➕ Create New Risk Assessment</h3>
                        <form action="/ohs/ora/api/assessment" method="POST" id="newAssessmentForm">
                            <div class="form-group">
                                <label>Store / Location *</label>
                                <select name="storeId" required>
                                    <option value="">Select Store</option>
                                    ${Object.entries(storesByBrand).map(([brand, stores]) => `
                                        <optgroup label="${brand}">
                                            ${stores.map(s => `<option value="${s.Id}">${s.StoreName}</option>`).join('')}
                                        </optgroup>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Assessment Title</label>
                                <input type="text" name="title" placeholder="e.g., Annual Safety Assessment 2026">
                            </div>
                            <div class="form-group">
                                <label>Boundaries for Assessment *</label>
                                <textarea name="boundaries" required placeholder="e.g., Warehouse operations, Cold storage area, All activities"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Lead Risk Assessor *</label>
                                <input type="text" name="leadAssessor" required value="${user?.displayName || ''}" placeholder="Name of lead assessor">
                            </div>
                            <div class="form-group">
                                <label>Team Members</label>
                                <textarea name="teamMembers" placeholder="Names of team members (comma separated)"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Assessment Date *</label>
                                <input type="date" name="assessmentDate" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn-secondary" onclick="closeModal('newAssessmentModal')" style="background: #95a5a6; color: white;">Cancel</button>
                                <button type="submit" class="btn-success">Create Assessment</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    function getRiskBadge(level) {
                        if (!level) return '-';
                        const classes = {
                            'Low Risk': 'risk-low',
                            'Medium Risk': 'risk-medium',
                            'High Risk': 'risk-high',
                            'Extreme Risk': 'risk-extreme'
                        };
                        return '<span class="risk-level ' + (classes[level] || '') + '">' + level + '</span>';
                    }
                    
                    function getStatusBadge(status) {
                        const classes = {
                            'Draft': 'badge-draft',
                            'Submitted': 'badge-submitted',
                            'Approved': 'badge-approved'
                        };
                        return '<span class="badge ' + (classes[status] || 'badge-draft') + '">' + status + '</span>';
                    }
                    
                    function showNewAssessmentModal() {
                        document.getElementById('newAssessmentModal').classList.add('active');
                    }
                    
                    function closeModal(id) {
                        document.getElementById(id).classList.remove('active');
                    }
                    
                    function filterAssessments() {
                        const brand = document.getElementById('filterBrand').value;
                        const status = document.getElementById('filterStatus').value;
                        const risk = document.getElementById('filterRisk').value;
                        
                        document.querySelectorAll('#assessmentsTable tbody tr').forEach(row => {
                            const matchBrand = !brand || row.dataset.brand === brand;
                            const matchStatus = !status || row.dataset.status === status;
                            const matchRisk = !risk || row.dataset.risk === risk;
                            row.style.display = matchBrand && matchStatus && matchRisk ? '' : 'none';
                        });
                    }
                    
                    // Handle form submission
                    document.getElementById('newAssessmentForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        const formData = new FormData(this);
                        const data = Object.fromEntries(formData);
                        
                        try {
                            const res = await fetch('/ohs/ora/api/assessment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                window.location.href = '/ohs/ora/assessment/' + result.id;
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (err) {
                            alert('Error creating assessment');
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('ORA error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// API: Create new assessment
// ==========================================
router.post('/api/assessment', async (req, res) => {
    const { storeId, title, boundaries, leadAssessor, teamMembers, assessmentDate } = req.body;
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await getPool();
        
        const result = await pool.request()
            .input('storeId', sql.Int, storeId)
            .input('title', sql.NVarChar, title)
            .input('boundaries', sql.NVarChar, boundaries)
            .input('leadAssessor', sql.NVarChar, leadAssessor)
            .input('leadAssessorId', sql.Int, user?.userId || null)
            .input('teamMembers', sql.NVarChar, teamMembers)
            .input('assessmentDate', sql.Date, assessmentDate)
            .input('createdBy', sql.Int, user?.userId || 1)
            .query(`
                INSERT INTO ORAAssessments (StoreId, AssessmentTitle, BoundariesDescription, LeadAssessorName, LeadAssessorId, TeamMembers, AssessmentDate, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES (@storeId, @title, @boundaries, @leadAssessor, @leadAssessorId, @teamMembers, @assessmentDate, @createdBy)
            `);
        
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ASSESSMENT DETAIL PAGE - Excel-style Worksheet
// ==========================================
router.get('/assessment/:id', async (req, res) => {
    const assessmentId = req.params.id;
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await getPool();
        
        // Get assessment
        const assessmentResult = await pool.request()
            .input('id', sql.Int, assessmentId)
            .query(`
                SELECT a.*, s.StoreName, ISNULL(b.BrandName, 'Other') as Brand
                FROM ORAAssessments a
                JOIN Stores s ON a.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE a.Id = @id
            `);
        
        if (assessmentResult.recordset.length === 0) {
            return res.status(404).send('Assessment not found');
        }
        
        const assessment = assessmentResult.recordset[0];
        const isEditable = assessment.Status === 'Draft';
        
        // Get risks
        const risksResult = await pool.request()
            .input('assessmentId', sql.Int, assessmentId)
            .query(`
                SELECT r.*, h.CategoryName as HazardCategory, i.CategoryName as InjuryCategory
                FROM ORAAssessmentRisks r
                LEFT JOIN ORAHazardCategories h ON r.HazardCategoryId = h.Id
                LEFT JOIN ORAInjuryCategories i ON r.InjuryCategoryId = i.Id
                WHERE r.AssessmentId = @assessmentId
                ORDER BY r.SortOrder, r.Id
            `);
        
        // Get action plans for all risks
        const actionsResult = await pool.request()
            .input('assessmentId', sql.Int, assessmentId)
            .query(`
                SELECT ap.* FROM ORAActionPlans ap
                JOIN ORAAssessmentRisks r ON ap.RiskId = r.Id
                WHERE r.AssessmentId = @assessmentId
                ORDER BY ap.RiskId, ap.Id
            `);
        
        // Get dropdowns
        const hazardsResult = await pool.request().query('SELECT * FROM ORAHazardCategories WHERE IsActive = 1 ORDER BY SortOrder');
        const injuriesResult = await pool.request().query('SELECT * FROM ORAInjuryCategories WHERE IsActive = 1 ORDER BY SortOrder');
        const severityResult = await pool.request().query('SELECT * FROM ORASeverityLevels ORDER BY SortOrder');
        const likelihoodResult = await pool.request().query('SELECT * FROM ORALikelihoodLevels ORDER BY SortOrder');
        const matrixResult = await pool.request().query('SELECT * FROM ORARiskMatrix');
        
        const risks = risksResult.recordset;
        const actions = actionsResult.recordset;
        const hazards = hazardsResult.recordset;
        const injuries = injuriesResult.recordset;
        const severityLevels = severityResult.recordset;
        const likelihoodLevels = likelihoodResult.recordset;
        const riskMatrix = matrixResult.recordset;
        
        // Group actions by risk
        const actionsByRisk = {};
        actions.forEach(a => {
            if (!actionsByRisk[a.RiskId]) actionsByRisk[a.RiskId] = [];
            actionsByRisk[a.RiskId].push(a);
        });
        
        function getRiskClass(level) {
            const classes = {
                'Low Risk': 'risk-low',
                'Medium Risk': 'risk-medium',
                'High Risk': 'risk-high',
                'Extreme Risk': 'risk-extreme'
            };
            return classes[level] || '';
        }
        
        function getRiskColor(level) {
            const colors = {
                'Low Risk': '#28a745',
                'Medium Risk': '#ffc107',
                'High Risk': '#fd7e14',
                'Extreme Risk': '#dc3545'
            };
            return colors[level] || '#ccc';
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>ORA-${assessment.Id} - ${assessment.StoreName}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                        background: #f5f6fa; 
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                    }
                    .header h1 { font-size: 20px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 15px; background: rgba(255,255,255,0.2); border-radius: 6px; font-size: 13px; }
                    .header-nav a:hover { background: rgba(255,255,255,0.3); }
                    
                    .container { padding: 20px; max-width: 100%; }
                    
                    /* Assessment Header Info */
                    .assessment-info {
                        background: white;
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 20px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    }
                    .assessment-info h2 { margin-bottom: 15px; color: #333; font-size: 18px; }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                        gap: 15px;
                    }
                    .info-item { }
                    .info-item label { color: #888; font-size: 11px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
                    .info-item span { font-weight: 500; color: #333; }
                    
                    /* Excel-style Worksheet Table */
                    .worksheet-container {
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                        overflow: hidden;
                        margin-bottom: 20px;
                    }
                    .worksheet-header {
                        background: #6c5ce7;
                        color: white;
                        padding: 15px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .worksheet-header h3 { font-size: 16px; }
                    
                    .worksheet-scroll {
                        overflow-x: auto;
                        max-height: calc(100vh - 350px);
                        overflow-y: auto;
                    }
                    
                    .worksheet-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                        min-width: 2400px;
                    }
                    .worksheet-table thead {
                        position: sticky;
                        top: 0;
                        z-index: 10;
                    }
                    .worksheet-table th {
                        background: #2d3436;
                        color: white;
                        padding: 10px 8px;
                        text-align: left;
                        font-weight: 600;
                        font-size: 11px;
                        white-space: nowrap;
                        border: 1px solid #444;
                    }
                    .worksheet-table th.section-header {
                        background: #6c5ce7;
                        text-align: center;
                    }
                    .worksheet-table th.existing-risk { background: #e74c3c; }
                    .worksheet-table th.residual-risk { background: #27ae60; }
                    .worksheet-table th.action-header { background: #3498db; }
                    
                    .worksheet-table td {
                        padding: 8px;
                        border: 1px solid #e0e0e0;
                        vertical-align: top;
                        background: white;
                    }
                    .worksheet-table tbody tr:nth-child(even) td {
                        background: #f9f9f9;
                    }
                    .worksheet-table tbody tr:hover td {
                        background: #f0f7ff;
                    }
                    
                    /* Risk Level Cells */
                    .risk-cell {
                        padding: 6px 10px;
                        border-radius: 4px;
                        font-weight: 600;
                        text-align: center;
                        color: white;
                        font-size: 11px;
                    }
                    .risk-cell.low { background: #28a745; }
                    .risk-cell.medium { background: #ffc107; color: #333; }
                    .risk-cell.high { background: #fd7e14; }
                    .risk-cell.extreme { background: #dc3545; }
                    
                    /* Score cells */
                    .score-cell {
                        text-align: center;
                        font-weight: 600;
                        font-size: 14px;
                    }
                    
                    /* Action items in cell */
                    .action-item-cell {
                        background: #f8f9fa;
                        padding: 5px 8px;
                        border-radius: 4px;
                        margin-bottom: 5px;
                        font-size: 11px;
                    }
                    .action-item-cell:last-child { margin-bottom: 0; }
                    
                    /* Toolbar */
                    .toolbar {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 15px;
                        flex-wrap: wrap;
                        align-items: center;
                    }
                    .btn-primary { background: #6c5ce7; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 500; }
                    .btn-success { background: #28a745; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 500; }
                    .btn-danger { background: #dc3545; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 500; }
                    .btn-primary:hover { background: #5b4cdb; }
                    .btn-success:hover { background: #218838; }
                    
                    /* Inline edit cells */
                    .editable-cell {
                        min-width: 100px;
                        cursor: pointer;
                    }
                    .editable-cell:hover {
                        background: #e8f4ff !important;
                    }
                    
                    /* Modal */
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        align-items: center;
                        justify-content: center;
                    }
                    .modal.active { display: flex; }
                    .modal-content {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        width: 95%;
                        max-width: 1000px;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    .modal-content h3 { margin-bottom: 20px; color: #333; }
                    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; font-size: 13px; }
                    .form-group input, .form-group select, .form-group textarea {
                        width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;
                    }
                    .form-group textarea { resize: vertical; min-height: 60px; }
                    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; }
                    
                    /* Section headers in form */
                    .form-section { 
                        background: #6c5ce7; 
                        color: white; 
                        padding: 8px 15px; 
                        border-radius: 6px; 
                        margin: 20px 0 15px 0; 
                        font-weight: 600;
                        font-size: 13px;
                    }
                    .form-section.existing { background: #e74c3c; }
                    .form-section.residual { background: #27ae60; }
                    .form-section.action { background: #3498db; }
                    
                    /* Badge */
                    .badge { padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
                    .badge-draft { background: #ffc107; color: #333; }
                    .badge-submitted { background: #17a2b8; color: white; }
                    .badge-approved { background: #28a745; color: white; }
                    
                    /* Empty state */
                    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
                    .empty-state .icon { font-size: 50px; margin-bottom: 15px; }
                    
                    /* Row number */
                    .row-num { 
                        background: #6c5ce7; 
                        color: white; 
                        font-weight: bold; 
                        text-align: center; 
                        width: 40px;
                        position: sticky;
                        left: 0;
                        z-index: 5;
                    }
                    
                    /* Delete button in row */
                    .row-actions {
                        white-space: nowrap;
                    }
                    .row-actions button {
                        padding: 4px 8px;
                        font-size: 11px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-right: 3px;
                    }
                    .row-actions .edit-btn { background: #3498db; color: white; }
                    .row-actions .delete-btn { background: #dc3545; color: white; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 ORA-${assessment.Id} | ${assessment.StoreName}</h1>
                    <div class="header-nav">
                        <a href="/ohs/ora">← Back to List</a>
                        ${isEditable ? `<a href="#" onclick="submitAssessment(); return false;">✓ Submit Assessment</a>` : ''}
                        <a href="/ohs">🦺 OHS</a>
                        <a href="/dashboard">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <!-- Assessment Info Header -->
                    <div class="assessment-info">
                        <h2>${assessment.AssessmentTitle || 'Overall Risk Assessment'}</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Store / Location</label>
                                <span>${assessment.StoreName} (${assessment.Brand})</span>
                            </div>
                            <div class="info-item">
                                <label>Boundaries for Assessment</label>
                                <span>${assessment.BoundariesDescription || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Lead Risk Assessor</label>
                                <span>${assessment.LeadAssessorName || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Team Members</label>
                                <span>${assessment.TeamMembers || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Assessment Date</label>
                                <span>${assessment.AssessmentDate ? new Date(assessment.AssessmentDate).toLocaleDateString() : '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Status</label>
                                <span class="badge badge-${assessment.Status.toLowerCase()}">${assessment.Status}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Toolbar -->
                    ${isEditable ? `
                    <div class="toolbar">
                        <button class="btn-success" onclick="showAddRiskModal()">➕ Add Risk Row</button>
                        <span style="color: #666; font-size: 13px;">Scroll horizontally to see all columns →</span>
                    </div>
                    ` : ''}
                    
                    <!-- Excel-style Worksheet -->
                    <div class="worksheet-container">
                        <div class="worksheet-header">
                            <h3>📋 ORA Worksheet</h3>
                            <span style="font-size: 13px;">${risks.length} risk${risks.length !== 1 ? 's' : ''} identified</span>
                        </div>
                        
                        <div class="worksheet-scroll">
                            <table class="worksheet-table">
                                <thead>
                                    <tr>
                                        <th rowspan="2" style="width: 40px;">#</th>
                                        <th rowspan="2">Hazard Category</th>
                                        <th rowspan="2">Hazard<br>(What is the hazard?)</th>
                                        <th rowspan="2">Activity / Task / Process</th>
                                        <th rowspan="2">How & When Could<br>Harm Occur?</th>
                                        <th rowspan="2">Injury/Illness<br>Category</th>
                                        <th rowspan="2">Injury or Illness<br>(What could happen?)</th>
                                        <th rowspan="2">Who May Be<br>Harmed?</th>
                                        <th colspan="4" class="section-header existing-risk">Existing Risk Rating</th>
                                        <th rowspan="2">Existing Controls<br>(What is currently in place?)</th>
                                        <th rowspan="2">Additional Controls<br>Required</th>
                                        <th colspan="4" class="section-header residual-risk">Residual Risk Rating</th>
                                        <th colspan="3" class="section-header action-header">Action Plan</th>
                                        ${isEditable ? '<th rowspan="2">Actions</th>' : ''}
                                    </tr>
                                    <tr>
                                        <!-- Existing Risk sub-headers -->
                                        <th class="existing-risk">S</th>
                                        <th class="existing-risk">L</th>
                                        <th class="existing-risk">Score</th>
                                        <th class="existing-risk">Level</th>
                                        <!-- Residual Risk sub-headers -->
                                        <th class="residual-risk">S</th>
                                        <th class="residual-risk">L</th>
                                        <th class="residual-risk">Score</th>
                                        <th class="residual-risk">Level</th>
                                        <!-- Action Plan sub-headers -->
                                        <th class="action-header">Action Required</th>
                                        <th class="action-header">By Who</th>
                                        <th class="action-header">By When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${risks.length === 0 ? `
                                        <tr>
                                            <td colspan="${isEditable ? 21 : 20}" style="text-align: center; padding: 40px; color: #666;">
                                                <div style="font-size: 40px; margin-bottom: 10px;">📋</div>
                                                <strong>No risks identified yet</strong><br>
                                                <span style="font-size: 12px;">Click "Add Risk Row" to start identifying hazards</span>
                                            </td>
                                        </tr>
                                    ` : risks.map((risk, idx) => {
                                        const riskActions = actionsByRisk[risk.Id] || [];
                                        const existingLevelClass = (risk.ExistingRiskLevel || '').toLowerCase().replace(' risk', '').replace(' ', '-');
                                        const residualLevelClass = (risk.ResidualRiskLevel || '').toLowerCase().replace(' risk', '').replace(' ', '-');
                                        
                                        return `
                                        <tr data-id="${risk.Id}">
                                            <td class="row-num">${idx + 1}</td>
                                            <td>${risk.HazardCategory || risk.HazardCategoryOther || '-'}</td>
                                            <td>${risk.HazardDescription || '-'}</td>
                                            <td>${risk.ActivityTaskProcess || '-'}</td>
                                            <td>${risk.HowWhenHarmOccurs || '-'}</td>
                                            <td>${risk.InjuryCategory || risk.InjuryCategoryOther || '-'}</td>
                                            <td>${risk.InjuryDescription || '-'}</td>
                                            <td>${risk.PeopleExposed || '-'}</td>
                                            <!-- Existing Risk -->
                                            <td class="score-cell">${risk.ExistingSeverity || '-'}</td>
                                            <td class="score-cell">${risk.ExistingLikelihood || '-'}</td>
                                            <td class="score-cell" style="background: ${getRiskColor(risk.ExistingRiskLevel)}; color: white; font-weight: bold;">${risk.ExistingRiskScore || '-'}</td>
                                            <td><span class="risk-cell ${existingLevelClass}">${risk.ExistingRiskLevel || '-'}</span></td>
                                            <!-- Existing Controls -->
                                            <td style="max-width: 200px;">${risk.ExistingControls || '-'}</td>
                                            <!-- Additional Controls -->
                                            <td style="max-width: 200px;">${risk.AdditionalControls || '-'}</td>
                                            <!-- Residual Risk -->
                                            <td class="score-cell">${risk.ResidualSeverity || '-'}</td>
                                            <td class="score-cell">${risk.ResidualLikelihood || '-'}</td>
                                            <td class="score-cell" style="background: ${risk.ResidualRiskLevel ? getRiskColor(risk.ResidualRiskLevel) : '#ccc'}; color: white; font-weight: bold;">${risk.ResidualRiskScore || '-'}</td>
                                            <td>${risk.ResidualRiskLevel ? `<span class="risk-cell ${residualLevelClass}">${risk.ResidualRiskLevel}</span>` : '-'}</td>
                                            <!-- Action Plan -->
                                            <td style="min-width: 150px;">
                                                ${riskActions.map(a => `<div class="action-item-cell">${a.ActionRequired || '-'}</div>`).join('') || '-'}
                                                ${isEditable ? `<button onclick="showAddActionModal(${risk.Id})" style="margin-top: 5px; padding: 3px 8px; font-size: 10px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">+ Add</button>` : ''}
                                            </td>
                                            <td style="min-width: 100px;">
                                                ${riskActions.map(a => `<div class="action-item-cell">${a.ResponsiblePerson || '-'}</div>`).join('') || '-'}
                                            </td>
                                            <td style="min-width: 90px;">
                                                ${riskActions.map(a => `<div class="action-item-cell">${a.TargetDate ? new Date(a.TargetDate).toLocaleDateString() : '-'}</div>`).join('') || '-'}
                                            </td>
                                            ${isEditable ? `
                                            <td class="row-actions">
                                                <button class="edit-btn" onclick="editRisk(${risk.Id})">✏️</button>
                                                <button class="delete-btn" onclick="deleteRisk(${risk.Id})">🗑️</button>
                                            </td>
                                            ` : ''}
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Risk Matrix Reference -->
                    <div class="assessment-info" style="margin-top: 20px;">
                        <h2>📊 Risk Matrix Reference</h2>
                        <div style="display: flex; gap: 30px; flex-wrap: wrap; margin-top: 15px;">
                            <div>
                                <strong style="display: block; margin-bottom: 8px; color: #666;">Severity (S)</strong>
                                ${severityLevels.map(s => `<div style="padding: 3px 0; font-size: 12px;"><strong>${s.LevelValue}</strong> = ${s.LevelName}</div>`).join('')}
                            </div>
                            <div>
                                <strong style="display: block; margin-bottom: 8px; color: #666;">Likelihood (L)</strong>
                                ${likelihoodLevels.map(l => `<div style="padding: 3px 0; font-size: 12px;"><strong>${l.LevelValue}</strong> = ${l.LevelName}</div>`).join('')}
                            </div>
                            <div>
                                <strong style="display: block; margin-bottom: 8px; color: #666;">Risk Levels</strong>
                                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                    <span class="risk-cell low">Low (1-2)</span>
                                    <span class="risk-cell medium">Medium (3-5)</span>
                                    <span class="risk-cell high">High (6-11)</span>
                                    <span class="risk-cell extreme">Extreme (12-16)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Add Risk Modal -->
                <div class="modal" id="addRiskModal">
                    <div class="modal-content">
                        <h3>➕ Add Risk Entry</h3>
                        <form id="addRiskForm">
                            <input type="hidden" name="assessmentId" value="${assessment.Id}">
                            
                            <div class="form-section">📝 Hazard & Risk Description</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Hazard Category *</label>
                                    <select name="hazardCategoryId" required>
                                        <option value="">Select Hazard Category</option>
                                        ${hazards.map(h => `<option value="${h.Id}">${h.CategoryName}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Hazard (What is the hazard?)</label>
                                    <input type="text" name="hazardDescription" placeholder="e.g., Wet floor near entrance">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Activity / Task / Process</label>
                                    <input type="text" name="activityTaskProcess" placeholder="e.g., Floor cleaning, Receiving deliveries">
                                </div>
                                <div class="form-group">
                                    <label>How & When Could Harm Occur? *</label>
                                    <textarea name="howWhenHarmOccurs" required placeholder="e.g., Staff or customers could slip on wet floor during cleaning"></textarea>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Injury/Illness Category *</label>
                                    <select name="injuryCategoryId" required>
                                        <option value="">Select Category</option>
                                        ${injuries.map(i => `<option value="${i.Id}">${i.CategoryName}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Injury or Illness (What could happen?)</label>
                                    <input type="text" name="injuryDescription" placeholder="e.g., Broken bones, head injury">
                                </div>
                                <div class="form-group">
                                    <label>Who May Be Harmed?</label>
                                    <input type="text" name="peopleExposed" placeholder="e.g., All staff and customers">
                                </div>
                            </div>
                            
                            <div class="form-section existing">⚠️ Existing Risk Rating</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Severity (S) *</label>
                                    <select name="existingSeverity" required onchange="calculateExistingRisk()">
                                        <option value="">Select</option>
                                        ${severityLevels.map(s => `<option value="${s.LevelValue}">${s.LevelValue} - ${s.LevelName}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Likelihood (L) *</label>
                                    <select name="existingLikelihood" required onchange="calculateExistingRisk()">
                                        <option value="">Select</option>
                                        ${likelihoodLevels.map(l => `<option value="${l.LevelValue}">${l.LevelValue} - ${l.LevelName}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Risk Level</label>
                                    <div id="existingRiskDisplay" style="padding: 10px; border-radius: 6px; background: #eee; font-weight: bold; text-align: center;">-</div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Existing Controls (What is currently in place?)</label>
                                <textarea name="existingControls" placeholder="e.g., Wet floor signs, non-slip flooring, cleaning schedule"></textarea>
                            </div>
                            
                            <div class="form-section residual">✅ Additional Controls & Residual Risk</div>
                            <div class="form-group">
                                <label>Additional Controls Required</label>
                                <textarea name="additionalControls" placeholder="e.g., Install additional drainage, purchase more warning signs"></textarea>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Residual Severity (S)</label>
                                    <select name="residualSeverity" onchange="calculateResidualRisk()">
                                        <option value="">Select</option>
                                        ${severityLevels.map(s => `<option value="${s.LevelValue}">${s.LevelValue} - ${s.LevelName}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Residual Likelihood (L)</label>
                                    <select name="residualLikelihood" onchange="calculateResidualRisk()">
                                        <option value="">Select</option>
                                        ${likelihoodLevels.map(l => `<option value="${l.LevelValue}">${l.LevelValue} - ${l.LevelName}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Residual Risk Level</label>
                                    <div id="residualRiskDisplay" style="padding: 10px; border-radius: 6px; background: #eee; font-weight: bold; text-align: center;">-</div>
                                </div>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addRiskModal')" style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                                <button type="submit" class="btn-success">Add Risk</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Add Action Modal -->
                <div class="modal" id="addActionModal">
                    <div class="modal-content" style="max-width: 500px;">
                        <h3>➕ Add Action</h3>
                        <form id="addActionForm">
                            <input type="hidden" name="riskId" id="actionRiskId">
                            <div class="form-group">
                                <label>Action Required *</label>
                                <textarea name="actionRequired" required placeholder="What action needs to be taken?"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Responsible Person (By Who)</label>
                                <input type="text" name="responsiblePerson" placeholder="Name of person responsible">
                            </div>
                            <div class="form-group">
                                <label>Target Date (By When)</label>
                                <input type="date" name="targetDate">
                            </div>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addActionModal')" style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                                <button type="submit" class="btn-success">Add Action</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    const riskMatrix = ${JSON.stringify(riskMatrix)};
                    
                    function showAddRiskModal() {
                        document.getElementById('addRiskForm').reset();
                        document.getElementById('existingRiskDisplay').innerHTML = '-';
                        document.getElementById('existingRiskDisplay').style.background = '#eee';
                        document.getElementById('residualRiskDisplay').innerHTML = '-';
                        document.getElementById('residualRiskDisplay').style.background = '#eee';
                        document.getElementById('addRiskModal').classList.add('active');
                    }
                    
                    function showAddActionModal(riskId) {
                        document.getElementById('addActionForm').reset();
                        document.getElementById('actionRiskId').value = riskId;
                        document.getElementById('addActionModal').classList.add('active');
                    }
                    
                    function closeModal(id) {
                        document.getElementById(id).classList.remove('active');
                    }
                    
                    function calculateExistingRisk() {
                        const severity = parseInt(document.querySelector('[name="existingSeverity"]').value);
                        const likelihood = parseInt(document.querySelector('[name="existingLikelihood"]').value);
                        const display = document.getElementById('existingRiskDisplay');
                        
                        if (severity && likelihood) {
                            const entry = riskMatrix.find(m => m.SeverityValue === severity && m.LikelihoodValue === likelihood);
                            if (entry) {
                                display.innerHTML = entry.RiskScore + ' - ' + entry.RiskLevel;
                                display.style.background = entry.Color;
                                display.style.color = entry.RiskLevel === 'Medium Risk' ? '#333' : 'white';
                            }
                        } else {
                            display.innerHTML = '-';
                            display.style.background = '#eee';
                            display.style.color = '#333';
                        }
                    }
                    
                    function calculateResidualRisk() {
                        const severity = parseInt(document.querySelector('[name="residualSeverity"]').value);
                        const likelihood = parseInt(document.querySelector('[name="residualLikelihood"]').value);
                        const display = document.getElementById('residualRiskDisplay');
                        
                        if (severity && likelihood) {
                            const entry = riskMatrix.find(m => m.SeverityValue === severity && m.LikelihoodValue === likelihood);
                            if (entry) {
                                display.innerHTML = entry.RiskScore + ' - ' + entry.RiskLevel;
                                display.style.background = entry.Color;
                                display.style.color = entry.RiskLevel === 'Medium Risk' ? '#333' : 'white';
                            }
                        } else {
                            display.innerHTML = '-';
                            display.style.background = '#eee';
                            display.style.color = '#333';
                        }
                    }
                    
                    function editRisk(id) {
                        alert('Edit feature coming soon. For now, delete and re-add the risk.');
                    }
                    
                    async function deleteRisk(id) {
                        if (!confirm('Delete this risk entry?')) return;
                        try {
                            const res = await fetch('/ohs/ora/api/risk/' + id, { method: 'DELETE' });
                            if (res.ok) location.reload();
                            else alert('Error deleting risk');
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    async function submitAssessment() {
                        if (!confirm('Submit this assessment? You will not be able to edit it after submission.')) return;
                        try {
                            const res = await fetch('/ohs/ora/api/assessment/${assessment.Id}/submit', { method: 'POST' });
                            const result = await res.json();
                            if (result.success) location.reload();
                            else alert('Error: ' + result.error);
                        } catch (err) {
                            alert('Error submitting');
                        }
                    }
                    
                    // Form submissions
                    document.getElementById('addRiskForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        const formData = new FormData(this);
                        const data = Object.fromEntries(formData);
                        
                        try {
                            const res = await fetch('/ohs/ora/api/risk', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            if (result.success) location.reload();
                            else alert('Error: ' + result.error);
                        } catch (err) {
                            alert('Error adding risk');
                        }
                    });
                    
                    document.getElementById('addActionForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        const formData = new FormData(this);
                        const data = Object.fromEntries(formData);
                        
                        try {
                            const res = await fetch('/ohs/ora/api/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            if (result.success) location.reload();
                            else alert('Error: ' + result.error);
                        } catch (err) {
                            alert('Error adding action');
                        }
                    });
                    
                    // Close modals on backdrop click
                    document.querySelectorAll('.modal').forEach(modal => {
                        modal.addEventListener('click', function(e) {
                            if (e.target === this) closeModal(this.id);
                        });
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('ORA Assessment error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// API: Add Risk to Assessment
// ==========================================
router.post('/api/risk', async (req, res) => {
    const data = req.body;
    
    let pool;
    try {
        pool = await getPool();
        
        // Calculate risk level from matrix
        const matrixResult = await pool.request()
            .input('severity', sql.Int, data.existingSeverity)
            .input('likelihood', sql.Int, data.existingLikelihood)
            .query('SELECT * FROM ORARiskMatrix WHERE SeverityValue = @severity AND LikelihoodValue = @likelihood');
        
        const riskEntry = matrixResult.recordset[0];
        
        // Calculate residual risk if provided
        let residualRiskEntry = null;
        if (data.residualSeverity && data.residualLikelihood) {
            const residualResult = await pool.request()
                .input('severity', sql.Int, data.residualSeverity)
                .input('likelihood', sql.Int, data.residualLikelihood)
                .query('SELECT * FROM ORARiskMatrix WHERE SeverityValue = @severity AND LikelihoodValue = @likelihood');
            residualRiskEntry = residualResult.recordset[0];
        }
        
        await pool.request()
            .input('assessmentId', sql.Int, data.assessmentId)
            .input('hazardCategoryId', sql.Int, data.hazardCategoryId === 'other' ? null : data.hazardCategoryId)
            .input('hazardDescription', sql.NVarChar, data.hazardDescription)
            .input('activityTaskProcess', sql.NVarChar, data.activityTaskProcess)
            .input('howWhenHarmOccurs', sql.NVarChar, data.howWhenHarmOccurs)
            .input('injuryCategoryId', sql.Int, data.injuryCategoryId)
            .input('injuryDescription', sql.NVarChar, data.injuryDescription)
            .input('peopleExposed', sql.NVarChar, data.peopleExposed)
            .input('existingSeverity', sql.Int, data.existingSeverity)
            .input('existingLikelihood', sql.Int, data.existingLikelihood)
            .input('existingRiskScore', sql.Int, riskEntry?.RiskScore)
            .input('existingRiskLevel', sql.NVarChar, riskEntry?.RiskLevel)
            .input('existingControls', sql.NVarChar, data.existingControls)
            .input('additionalControls', sql.NVarChar, data.additionalControls)
            .input('residualSeverity', sql.Int, data.residualSeverity || null)
            .input('residualLikelihood', sql.Int, data.residualLikelihood || null)
            .input('residualRiskScore', sql.Int, residualRiskEntry?.RiskScore || null)
            .input('residualRiskLevel', sql.NVarChar, residualRiskEntry?.RiskLevel || null)
            .query(`
                INSERT INTO ORAAssessmentRisks (
                    AssessmentId, HazardCategoryId, HazardDescription, ActivityTaskProcess,
                    HowWhenHarmOccurs, InjuryCategoryId, InjuryDescription, PeopleExposed,
                    ExistingSeverity, ExistingLikelihood, ExistingRiskScore, ExistingRiskLevel,
                    ExistingControls, AdditionalControls,
                    ResidualSeverity, ResidualLikelihood, ResidualRiskScore, ResidualRiskLevel
                ) VALUES (
                    @assessmentId, @hazardCategoryId, @hazardDescription, @activityTaskProcess,
                    @howWhenHarmOccurs, @injuryCategoryId, @injuryDescription, @peopleExposed,
                    @existingSeverity, @existingLikelihood, @existingRiskScore, @existingRiskLevel,
                    @existingControls, @additionalControls,
                    @residualSeverity, @residualLikelihood, @residualRiskScore, @residualRiskLevel
                )
            `);
        
        // Update assessment stats
        await updateAssessmentStats(pool, data.assessmentId);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Delete Risk
// ==========================================
router.delete('/api/risk/:id', async (req, res) => {
    let pool;
    try {
        pool = await getPool();
        
        // Get assessment ID first
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT AssessmentId FROM ORAAssessmentRisks WHERE Id = @id');
        
        const assessmentId = result.recordset[0]?.AssessmentId;
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM ORAAssessmentRisks WHERE Id = @id');
        
        if (assessmentId) {
            await updateAssessmentStats(pool, assessmentId);
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Add Action Plan
// ==========================================
router.post('/api/action', async (req, res) => {
    const { riskId, actionRequired, responsiblePerson, targetDate } = req.body;
    
    let pool;
    try {
        pool = await getPool();
        
        await pool.request()
            .input('riskId', sql.Int, riskId)
            .input('actionRequired', sql.NVarChar, actionRequired)
            .input('responsiblePerson', sql.NVarChar, responsiblePerson)
            .input('targetDate', sql.Date, targetDate || null)
            .query(`
                INSERT INTO ORAActionPlans (RiskId, ActionRequired, ResponsiblePerson, TargetDate)
                VALUES (@riskId, @actionRequired, @responsiblePerson, @targetDate)
            `);
        
        // Update assessment open actions count
        const riskResult = await pool.request()
            .input('riskId', sql.Int, riskId)
            .query('SELECT AssessmentId FROM ORAAssessmentRisks WHERE Id = @riskId');
        
        if (riskResult.recordset[0]) {
            await updateAssessmentStats(pool, riskResult.recordset[0].AssessmentId);
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Submit Assessment
// ==========================================
router.post('/api/assessment/:id/submit', async (req, res) => {
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await getPool();
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('submittedBy', sql.Int, user?.userId || 1)
            .query(`
                UPDATE ORAAssessments 
                SET Status = 'Submitted', SubmittedAt = GETDATE(), SubmittedBy = @submittedBy, UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Helper: Update assessment statistics
async function updateAssessmentStats(pool, assessmentId) {
    await pool.request()
        .input('assessmentId', sql.Int, assessmentId)
        .query(`
            UPDATE ORAAssessments SET
                TotalRisks = (SELECT COUNT(*) FROM ORAAssessmentRisks WHERE AssessmentId = @assessmentId),
                HighestRiskLevel = (
                    SELECT TOP 1 ExistingRiskLevel FROM ORAAssessmentRisks 
                    WHERE AssessmentId = @assessmentId
                    ORDER BY ExistingRiskScore DESC
                ),
                OpenActions = (
                    SELECT COUNT(*) FROM ORAActionPlans ap
                    JOIN ORAAssessmentRisks r ON ap.RiskId = r.Id
                    WHERE r.AssessmentId = @assessmentId AND ap.Status != 'Completed'
                ),
                UpdatedAt = GETDATE()
            WHERE Id = @assessmentId
        `);
}

module.exports = router;
