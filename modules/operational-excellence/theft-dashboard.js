/**
 * Theft Incident Dashboard
 * Review and process theft incident reports
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

// API: Get stats for dashboard card
router.get('/api/stats', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM TheftIncidents WHERE Status = 'Open' OR Status = 'Pending') as pending,
                (SELECT COUNT(*) FROM TheftIncidents WHERE CAST(CreatedAt as DATE) = CAST(GETDATE() as DATE)) as today,
                (SELECT COUNT(*) FROM TheftIncidents WHERE CreatedAt >= DATEADD(month, -1, GETDATE())) as month
        `);
        
        await pool.close();
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error getting stats:', err);
        res.json({ pending: 0, today: 0, month: 0 });
    }
});

// API: Update incident status
router.post('/api/update-status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewNotes } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .input('reviewNotes', sql.NVarChar, reviewNotes || null)
            .input('reviewedBy', sql.Int, req.currentUser.id)
            .input('reviewedAt', sql.DateTime2, new Date())
            .query(`
                UPDATE TheftIncidents 
                SET Status = @status, 
                    ReviewNotes = @reviewNotes,
                    ReviewedBy = @reviewedBy,
                    ReviewedAt = @reviewedAt,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Get single incident details
router.get('/api/incident/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT t.*, 
                       u.DisplayName as CreatedByName,
                       r.DisplayName as ReviewedByName
                FROM TheftIncidents t
                LEFT JOIN Users u ON t.CreatedBy = u.Id
                LEFT JOIN Users r ON t.ReviewedBy = r.Id
                WHERE t.Id = @id
            `);
        
        const photos = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM TheftIncidentPhotos WHERE IncidentId = @id');
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        
        res.json({
            ...result.recordset[0],
            photos: photos.recordset
        });
    } catch (err) {
        console.error('Error getting incident:', err);
        res.status(500).json({ error: err.message });
    }
});

// Main dashboard page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get filter values
        const status = req.query.status || 'Open';
        const store = req.query.store || '';
        const dateFrom = req.query.dateFrom || '';
        const dateTo = req.query.dateTo || '';
        
        // Build query
        let whereClause = '1=1';
        const request = pool.request();
        
        if (status && status !== 'all') {
            whereClause += ' AND t.Status = @status';
            request.input('status', sql.NVarChar, status);
        }
        if (store) {
            whereClause += ' AND t.Store = @store';
            request.input('store', sql.NVarChar, store);
        }
        if (dateFrom) {
            whereClause += ' AND t.IncidentDate >= @dateFrom';
            request.input('dateFrom', sql.Date, dateFrom);
        }
        if (dateTo) {
            whereClause += ' AND t.IncidentDate <= @dateTo';
            request.input('dateTo', sql.Date, dateTo);
        }
        
        // Get incidents
        const incidents = await request.query(`
            SELECT t.*, 
                   u.DisplayName as CreatedByName,
                   (SELECT COUNT(*) FROM TheftIncidentPhotos WHERE IncidentId = t.Id) as PhotoCount
            FROM TheftIncidents t
            LEFT JOIN Users u ON t.CreatedBy = u.Id
            WHERE ${whereClause}
            ORDER BY 
                CASE WHEN t.Status = 'Open' THEN 0 
                     WHEN t.Status = 'Pending' THEN 1 
                     ELSE 2 END,
                t.IncidentDate DESC, t.Id DESC
        `);
        
        // Get stats
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'Open' THEN 1 ELSE 0 END) as openCount,
                SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pendingCount,
                SUM(CASE WHEN Status = 'Reviewed' THEN 1 ELSE 0 END) as reviewedCount,
                SUM(CASE WHEN Status = 'Closed' THEN 1 ELSE 0 END) as closedCount,
                SUM(StolenValue) as totalStolenValue,
                SUM(ValueCollected) as totalCollected
            FROM TheftIncidents
        `);
        
        // Get stores for filter
        const stores = await pool.request().query('SELECT DISTINCT Store FROM TheftIncidents ORDER BY Store');
        
        await pool.close();
        
        const statsData = stats.recordset[0];
        
        // Generate table rows
        const tableRows = incidents.recordset.map(r => {
            const statusClass = r.Status === 'Open' ? 'status-open' : 
                               r.Status === 'Pending' ? 'status-pending' :
                               r.Status === 'Reviewed' ? 'status-reviewed' : 'status-closed';
            
            return `
                <tr class="incident-row" data-id="${r.Id}">
                    <td><strong>TI-${r.Id}</strong></td>
                    <td>${formatDate(r.IncidentDate)}</td>
                    <td>${r.Store || '-'}</td>
                    <td>${r.ThiefName || ''} ${r.ThiefSurname || ''}</td>
                    <td>${r.StolenItems ? (r.StolenItems.length > 30 ? r.StolenItems.substring(0, 30) + '...' : r.StolenItems) : '-'}</td>
                    <td>${formatCurrency(r.StolenValue)}</td>
                    <td>${r.CaptureMethod || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${r.Status}</span></td>
                    <td>${r.PhotoCount > 0 ? '📷 ' + r.PhotoCount : '-'}</td>
                    <td>
                        <button class="btn-review" onclick="openReview(${r.Id})">Review</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Store options for filter
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.Store}" ${store === s.Store ? 'selected' : ''}>${s.Store}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Theft Incident Dashboard - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f5f6fa;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%);
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
                        transition: background 0.2s;
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    
                    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                    
                    .stats-row {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    }
                    
                    .stat-card {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                        text-align: center;
                    }
                    .stat-card.open { border-top: 3px solid #dc3545; }
                    .stat-card.pending { border-top: 3px solid #fd7e14; }
                    .stat-card.reviewed { border-top: 3px solid #28a745; }
                    .stat-card.closed { border-top: 3px solid #6c757d; }
                    
                    .stat-value { font-size: 32px; font-weight: 700; }
                    .stat-card.open .stat-value { color: #dc3545; }
                    .stat-card.pending .stat-value { color: #fd7e14; }
                    .stat-card.reviewed .stat-value { color: #28a745; }
                    .stat-card.closed .stat-value { color: #6c757d; }
                    
                    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
                    
                    .filters {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        margin-bottom: 20px;
                        display: flex;
                        gap: 15px;
                        flex-wrap: wrap;
                        align-items: end;
                    }
                    .filter-group { display: flex; flex-direction: column; gap: 5px; }
                    .filter-group label { font-size: 12px; color: #666; font-weight: 500; }
                    .filter-group select, .filter-group input {
                        padding: 8px 12px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        font-size: 14px;
                    }
                    .btn-filter {
                        padding: 8px 20px;
                        background: #0078d4;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    .btn-filter:hover { background: #006cbd; }
                    
                    .table-container {
                        background: white;
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    }
                    
                    table { width: 100%; border-collapse: collapse; }
                    th {
                        background: #f8f9fa;
                        padding: 12px 15px;
                        text-align: left;
                        font-size: 12px;
                        text-transform: uppercase;
                        color: #666;
                        border-bottom: 2px solid #dee2e6;
                    }
                    td {
                        padding: 12px 15px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }
                    .incident-row { cursor: pointer; transition: background 0.2s; }
                    .incident-row:hover { background: #f8f9fa; }
                    
                    .status-badge {
                        display: inline-block;
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .status-open { background: #f8d7da; color: #721c24; }
                    .status-pending { background: #fff3cd; color: #856404; }
                    .status-reviewed { background: #d4edda; color: #155724; }
                    .status-closed { background: #e2e3e5; color: #383d41; }
                    
                    .btn-review {
                        padding: 6px 15px;
                        background: #0078d4;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    .btn-review:hover { background: #006cbd; }
                    
                    /* Modal */
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        overflow-y: auto;
                        padding: 30px;
                    }
                    .modal.show { display: flex; justify-content: center; }
                    
                    .modal-content {
                        background: white;
                        border-radius: 12px;
                        width: 100%;
                        max-width: 900px;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    
                    .modal-header {
                        padding: 20px;
                        border-bottom: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        background: white;
                        z-index: 10;
                    }
                    
                    .modal-body { padding: 20px; }
                    
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    }
                    
                    .detail-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                    }
                    
                    .detail-section {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                    }
                    
                    .detail-section h4 {
                        color: #dc3545;
                        margin-bottom: 10px;
                        font-size: 14px;
                        text-transform: uppercase;
                    }
                    
                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 5px 0;
                        border-bottom: 1px solid #e9ecef;
                    }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { color: #666; font-size: 13px; }
                    .detail-value { font-weight: 500; font-size: 13px; }
                    
                    .photos-grid {
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                        margin-top: 10px;
                    }
                    .photo-thumb {
                        width: 100px;
                        height: 100px;
                        object-fit: cover;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: transform 0.2s;
                    }
                    .photo-thumb:hover { transform: scale(1.1); }
                    
                    .review-section {
                        margin-top: 20px;
                        padding: 20px;
                        background: #e8f4fc;
                        border-radius: 8px;
                    }
                    
                    .review-section h4 { color: #0078d4; margin-bottom: 15px; }
                    
                    .status-buttons {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    
                    .status-btn {
                        padding: 10px 20px;
                        border: 2px solid;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s;
                        background: white;
                    }
                    .status-btn.reviewed { border-color: #28a745; color: #28a745; }
                    .status-btn.reviewed:hover, .status-btn.reviewed.active { background: #28a745; color: white; }
                    .status-btn.pending { border-color: #fd7e14; color: #fd7e14; }
                    .status-btn.pending:hover, .status-btn.pending.active { background: #fd7e14; color: white; }
                    .status-btn.closed { border-color: #6c757d; color: #6c757d; }
                    .status-btn.closed:hover, .status-btn.closed.active { background: #6c757d; color: white; }
                    
                    .review-notes {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        resize: vertical;
                        min-height: 80px;
                    }
                    
                    .btn-submit-review {
                        margin-top: 15px;
                        padding: 12px 30px;
                        background: #0078d4;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                    }
                    .btn-submit-review:hover { background: #006cbd; }
                    .btn-submit-review:disabled { background: #ccc; cursor: not-allowed; }
                    
                    .empty-state {
                        text-align: center;
                        padding: 60px 20px;
                        color: #666;
                    }
                    .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚨 Theft Incident Dashboard</h1>
                    <div class="header-nav">
                        <a href="/operational-excellence">← Back to OE</a>
                        <a href="/dashboard">🏠 Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <!-- Stats -->
                    <div class="stats-row">
                        <div class="stat-card open">
                            <div class="stat-value">${statsData.openCount || 0}</div>
                            <div class="stat-label">Open / New</div>
                        </div>
                        <div class="stat-card pending">
                            <div class="stat-value">${statsData.pendingCount || 0}</div>
                            <div class="stat-label">Pending Info</div>
                        </div>
                        <div class="stat-card reviewed">
                            <div class="stat-value">${statsData.reviewedCount || 0}</div>
                            <div class="stat-label">Reviewed</div>
                        </div>
                        <div class="stat-card closed">
                            <div class="stat-value">${statsData.closedCount || 0}</div>
                            <div class="stat-label">Closed</div>
                        </div>
                    </div>
                    
                    <!-- Filters -->
                    <form class="filters" method="GET">
                        <div class="filter-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="Open" ${status === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Reviewed" ${status === 'Reviewed' ? 'selected' : ''}>Reviewed</option>
                                <option value="Closed" ${status === 'Closed' ? 'selected' : ''}>Closed</option>
                                <option value="all" ${status === 'all' ? 'selected' : ''}>All Status</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Store</label>
                            <select name="store">
                                <option value="">All Stores</option>
                                ${storeOptions}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>From Date</label>
                            <input type="date" name="dateFrom" value="${dateFrom}">
                        </div>
                        <div class="filter-group">
                            <label>To Date</label>
                            <input type="date" name="dateTo" value="${dateTo}">
                        </div>
                        <button type="submit" class="btn-filter">Apply Filters</button>
                    </form>
                    
                    <!-- Table -->
                    <div class="table-container">
                        ${incidents.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Date</th>
                                        <th>Store</th>
                                        <th>Thief</th>
                                        <th>Stolen Items</th>
                                        <th>Value</th>
                                        <th>Capture</th>
                                        <th>Status</th>
                                        <th>Photos</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div class="icon">📋</div>
                                <h3>No incidents found</h3>
                                <p>No theft incidents match your filters</p>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Review Modal -->
                <div class="modal" id="reviewModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modalTitle">Review Incident</h3>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <div class="modal-body" id="modalBody">
                            Loading...
                        </div>
                    </div>
                </div>
                
                <script>
                    let currentIncidentId = null;
                    let selectedStatus = null;
                    
                    function formatDate(dateStr) {
                        if (!dateStr) return '-';
                        const d = new Date(dateStr);
                        return d.toLocaleDateString('en-GB');
                    }
                    
                    function formatCurrency(val) {
                        if (!val) return '$0.00';
                        return '$' + parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2 });
                    }
                    
                    function openReview(id) {
                        currentIncidentId = id;
                        document.getElementById('reviewModal').classList.add('show');
                        document.getElementById('modalTitle').textContent = 'Review Incident TI-' + id;
                        document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;">Loading...</p>';
                        
                        fetch('/operational-excellence/theft-dashboard/api/incident/' + id)
                            .then(r => r.json())
                            .then(data => {
                                renderIncidentDetails(data);
                            })
                            .catch(err => {
                                document.getElementById('modalBody').innerHTML = '<p style="color:red;">Error loading incident</p>';
                            });
                    }
                    
                    function renderIncidentDetails(data) {
                        selectedStatus = data.Status;
                        
                        const photosHtml = data.photos && data.photos.length > 0 
                            ? data.photos.map(p => \`<img src="/uploads/theft-incidents/\${p.FileName}" class="photo-thumb" onclick="window.open('/uploads/theft-incidents/\${p.FileName}', '_blank')">\`).join('')
                            : '<p style="color:#666;">No photos attached</p>';
                        
                        document.getElementById('modalBody').innerHTML = \`
                            <div class="detail-grid">
                                <div class="detail-section">
                                    <h4>📍 Store Information</h4>
                                    <div class="detail-row">
                                        <span class="detail-label">Store</span>
                                        <span class="detail-value">\${data.Store || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Incident Date</span>
                                        <span class="detail-value">\${formatDate(data.IncidentDate)}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Store Manager</span>
                                        <span class="detail-value">\${data.StoreManager || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Reported By</span>
                                        <span class="detail-value">\${data.StaffName || data.CreatedByName || '-'}</span>
                                    </div>
                                </div>
                                
                                <div class="detail-section">
                                    <h4>📦 Stolen Items</h4>
                                    <div class="detail-row">
                                        <span class="detail-label">Items</span>
                                        <span class="detail-value">\${data.StolenItems || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Value</span>
                                        <span class="detail-value" style="color:#dc3545;font-weight:700;">\${formatCurrency(data.StolenValue)}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Collected</span>
                                        <span class="detail-value" style="color:#28a745;">\${formatCurrency(data.ValueCollected)}</span>
                                    </div>
                                </div>
                                
                                <div class="detail-section">
                                    <h4>👤 Thief Information</h4>
                                    <div class="detail-row">
                                        <span class="detail-label">Name</span>
                                        <span class="detail-value">\${data.ThiefName || ''} \${data.ThiefSurname || ''}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">ID Card</span>
                                        <span class="detail-value">\${data.IDCard || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Father's Name</span>
                                        <span class="detail-value">\${data.FatherName || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Date of Birth</span>
                                        <span class="detail-value">\${formatDate(data.DateOfBirth)}</span>
                                    </div>
                                </div>
                                
                                <div class="detail-section">
                                    <h4>🎯 Capture Details</h4>
                                    <div class="detail-row">
                                        <span class="detail-label">Method</span>
                                        <span class="detail-value">\${data.CaptureMethod || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Security Type</span>
                                        <span class="detail-value">\${data.SecurityType || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Company</span>
                                        <span class="detail-value">\${data.OutsourceCompany || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Amount to HO</span>
                                        <span class="detail-value">\${formatCurrency(data.AmountToHO)} \${data.Currency || ''}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="detail-section" style="margin-top:20px;">
                                <h4>📷 Evidence Photos</h4>
                                <div class="photos-grid">
                                    \${photosHtml}
                                </div>
                            </div>
                            
                            <div class="review-section">
                                <h4>✅ Review Decision</h4>
                                <p style="margin-bottom:15px;color:#666;">Current Status: <strong>\${data.Status}</strong></p>
                                
                                <div class="status-buttons">
                                    <button class="status-btn reviewed \${data.Status === 'Reviewed' ? 'active' : ''}" onclick="selectStatus('Reviewed')">
                                        ✓ Mark Reviewed
                                    </button>
                                    <button class="status-btn pending \${data.Status === 'Pending' ? 'active' : ''}" onclick="selectStatus('Pending')">
                                        ⏳ Need More Info
                                    </button>
                                    <button class="status-btn closed \${data.Status === 'Closed' ? 'active' : ''}" onclick="selectStatus('Closed')">
                                        ✕ Close Case
                                    </button>
                                </div>
                                
                                <textarea class="review-notes" id="reviewNotes" placeholder="Add review notes (optional)...">\${data.ReviewNotes || ''}</textarea>
                                
                                <button class="btn-submit-review" id="btnSubmit" onclick="submitReview()">
                                    Save Review
                                </button>
                            </div>
                        \`;
                    }
                    
                    function selectStatus(status) {
                        selectedStatus = status;
                        document.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
                        document.querySelector('.status-btn.' + status.toLowerCase()).classList.add('active');
                    }
                    
                    function submitReview() {
                        const notes = document.getElementById('reviewNotes').value;
                        const btn = document.getElementById('btnSubmit');
                        
                        btn.disabled = true;
                        btn.textContent = 'Saving...';
                        
                        fetch('/operational-excellence/theft-dashboard/api/update-status/' + currentIncidentId, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: selectedStatus, reviewNotes: notes })
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                closeModal();
                                location.reload();
                            } else {
                                alert('Error saving review: ' + (data.error || 'Unknown error'));
                                btn.disabled = false;
                                btn.textContent = 'Save Review';
                            }
                        })
                        .catch(err => {
                            alert('Error saving review');
                            btn.disabled = false;
                            btn.textContent = 'Save Review';
                        });
                    }
                    
                    function closeModal() {
                        document.getElementById('reviewModal').classList.remove('show');
                        currentIncidentId = null;
                    }
                    
                    // Close modal on escape or outside click
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') closeModal();
                    });
                    document.getElementById('reviewModal').addEventListener('click', (e) => {
                        if (e.target.id === 'reviewModal') closeModal();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading theft dashboard:', err);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;">
                <h2>Error loading dashboard</h2>
                <p>${err.message}</p>
                <a href="/operational-excellence">Back</a>
            </div>
        `);
    }
});

// Helper functions
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB');
}

function formatCurrency(val) {
    if (!val) return '$0.00';
    return '$' + parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

module.exports = router;
