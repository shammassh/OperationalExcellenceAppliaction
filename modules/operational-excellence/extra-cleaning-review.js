/**
 * Extra Cleaning Review Module for Operational Excellence
 * OE team can review and manage all extra cleaning requests
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
                COUNT(*) as total,
                SUM(CASE WHEN OverallStatus = 'Pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN CreatedAt >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0) THEN 1 ELSE 0 END) as thisMonth
            FROM ExtraCleaningRequests
        `);
        
        await pool.close();
        
        res.json({
            total: result.recordset[0].total || 0,
            pending: result.recordset[0].pending || 0,
            today: result.recordset[0].today || 0,
            thisMonth: result.recordset[0].thisMonth || 0
        });
    } catch (err) {
        console.error('Error getting stats:', err);
        res.json({ total: 0, pending: 0, today: 0, thisMonth: 0 });
    }
});

// Main review page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                r.*,
                u.DisplayName as CreatedByName,
                u.Email as CreatedByEmail
            FROM ExtraCleaningRequests r
            LEFT JOIN Users u ON r.CreatedBy = u.Id
            ORDER BY r.CreatedAt DESC
        `);
        
        await pool.close();
        
        const statusBadge = (status) => {
            const colors = {
                'Pending': 'background:#fff3cd;color:#856404;',
                'Approved': 'background:#d4edda;color:#155724;',
                'Rejected': 'background:#f8d7da;color:#721c24;',
                'In Progress': 'background:#cce5ff;color:#004085;',
                'Completed': 'background:#d4edda;color:#155724;'
            };
            return `<span style="padding:4px 10px;border-radius:12px;font-size:11px;font-weight:500;${colors[status] || colors['Pending']}">${status || 'Pending'}</span>`;
        };
        
        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        };
        
        const tableRows = result.recordset.map(r => `
            <tr onclick="viewDetails(${r.Id})" style="cursor:pointer;">
                <td><strong>ECR-${r.Id}</strong></td>
                <td>${r.Store || '-'}</td>
                <td>${r.Category || '-'}</td>
                <td>${r.ThirdParty || '-'}</td>
                <td>${r.NumberOfAgents || 0}</td>
                <td>${formatDate(r.StartDate)}</td>
                <td>${formatDate(r.EndDate)}</td>
                <td>${r.CreatedByName || 'Unknown'}</td>
                <td>${statusBadge(r.AreaManagerStatus)}</td>
                <td>${statusBadge(r.HOStatus)}</td>
                <td>${statusBadge(r.HRStatus)}</td>
                <td>${statusBadge(r.OverallStatus)}</td>
                <td>
                    <button onclick="event.stopPropagation(); viewDetails(${r.Id})" class="btn-action">👁️</button>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Extra Cleaning Review - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    
                    .header {
                        background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
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
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    
                    .container { max-width: 1600px; margin: 0 auto; padding: 30px; }
                    
                    .stats-bar {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .stat-card {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        text-align: center;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    }
                    
                    .stat-card .value {
                        font-size: 36px;
                        font-weight: 700;
                        margin-bottom: 5px;
                    }
                    
                    .stat-card .label {
                        color: #666;
                        font-size: 14px;
                    }
                    
                    .stat-card.pending .value { color: #ffc107; }
                    .stat-card.approved .value { color: #28a745; }
                    .stat-card.rejected .value { color: #dc3545; }
                    .stat-card.total .value { color: #17a2b8; }
                    
                    .filters {
                        background: white;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 20px;
                        display: flex;
                        gap: 15px;
                        align-items: center;
                        flex-wrap: wrap;
                    }
                    
                    .filters select, .filters input {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    
                    .filters button {
                        padding: 10px 20px;
                        background: #17a2b8;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    }
                    
                    .table-container {
                        background: white;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    }
                    
                    table { width: 100%; border-collapse: collapse; }
                    
                    th {
                        background: #f8f9fa;
                        padding: 14px 12px;
                        text-align: left;
                        font-size: 11px;
                        text-transform: uppercase;
                        color: #666;
                        border-bottom: 2px solid #dee2e6;
                        white-space: nowrap;
                    }
                    
                    td {
                        padding: 14px 12px;
                        border-bottom: 1px solid #eee;
                        font-size: 13px;
                    }
                    
                    tr:hover { background: #f8f9fa; }
                    
                    .btn-action {
                        padding: 6px 12px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        background: #e9ecef;
                    }
                    
                    .btn-action:hover { background: #dee2e6; }
                    
                    .empty-state {
                        text-align: center;
                        padding: 60px 20px;
                        color: #666;
                    }
                    
                    /* Modal */
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    
                    .modal.active { display: flex; }
                    
                    .modal-content {
                        background: white;
                        border-radius: 16px;
                        width: 90%;
                        max-width: 800px;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    
                    .modal-header {
                        padding: 20px 25px;
                        border-bottom: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    
                    .modal-header h3 { font-size: 20px; color: #333; }
                    
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    }
                    
                    .modal-body { padding: 25px; }
                    
                    .detail-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                    }
                    
                    .detail-item {
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 8px;
                    }
                    
                    .detail-item label {
                        display: block;
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 5px;
                        text-transform: uppercase;
                    }
                    
                    .detail-item .value {
                        font-size: 16px;
                        font-weight: 500;
                        color: #333;
                    }
                    
                    .detail-item.full { grid-column: 1 / -1; }
                    
                    .approval-section {
                        margin-top: 25px;
                        padding-top: 25px;
                        border-top: 1px solid #eee;
                    }
                    
                    .approval-section h4 {
                        margin-bottom: 15px;
                        color: #333;
                    }
                    
                    .approval-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                    }
                    
                    .approval-card {
                        padding: 15px;
                        border-radius: 8px;
                        border: 1px solid #ddd;
                        text-align: center;
                    }
                    
                    .approval-card .role {
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 8px;
                    }
                    
                    .action-buttons {
                        display: flex;
                        gap: 10px;
                        margin-top: 25px;
                        justify-content: flex-end;
                    }
                    
                    .btn {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    
                    .btn-success { background: #28a745; color: white; }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-primary { background: #17a2b8; color: white; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧹 Extra Cleaning Review</h1>
                    <div class="header-nav">
                        <a href="/operational-excellence">← Back to OE</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <!-- Stats Bar -->
                    <div class="stats-bar">
                        <div class="stat-card total">
                            <div class="value" id="totalCount">${result.recordset.length}</div>
                            <div class="label">Total Requests</div>
                        </div>
                        <div class="stat-card pending">
                            <div class="value" id="pendingCount">${result.recordset.filter(r => r.OverallStatus === 'Pending' || !r.OverallStatus).length}</div>
                            <div class="label">Pending</div>
                        </div>
                        <div class="stat-card approved">
                            <div class="value" id="approvedCount">${result.recordset.filter(r => r.OverallStatus === 'Approved').length}</div>
                            <div class="label">Approved</div>
                        </div>
                        <div class="stat-card rejected">
                            <div class="value" id="rejectedCount">${result.recordset.filter(r => r.OverallStatus === 'Rejected').length}</div>
                            <div class="label">Rejected</div>
                        </div>
                    </div>
                    
                    <!-- Filters -->
                    <div class="filters">
                        <select id="filterStatus">
                            <option value="">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                        <select id="filterStore">
                            <option value="">All Stores</option>
                        </select>
                        <input type="date" id="filterFrom" placeholder="From Date">
                        <input type="date" id="filterTo" placeholder="To Date">
                        <button onclick="applyFilters()">🔍 Filter</button>
                        <button onclick="clearFilters()" style="background:#6c757d;">Clear</button>
                    </div>
                    
                    <!-- Table -->
                    <div class="table-container">
                        ${result.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Category</th>
                                        <th>Provider</th>
                                        <th>Agents</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th>Requested By</th>
                                        <th>Area Mgr</th>
                                        <th>Head Office</th>
                                        <th>HR</th>
                                        <th>Overall</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="requestsTable">
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div style="font-size:48px;margin-bottom:15px;">📋</div>
                                <h3>No requests yet</h3>
                                <p>Extra cleaning requests will appear here for review</p>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Detail Modal -->
                <div class="modal" id="detailModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modalTitle">Request Details</h3>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <div class="modal-body" id="modalBody">
                            <!-- Content loaded dynamically -->
                        </div>
                    </div>
                </div>
                
                <script>
                    function viewDetails(id) {
                        // Fetch request details
                        fetch('/operational-excellence/extra-cleaning-review/api/request/' + id)
                            .then(r => r.json())
                            .then(data => {
                                document.getElementById('modalTitle').textContent = 'Request ECR-' + data.Id;
                                document.getElementById('modalBody').innerHTML = \`
                                    <div class="detail-grid">
                                        <div class="detail-item">
                                            <label>Store</label>
                                            <div class="value">\${data.Store || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Category</label>
                                            <div class="value">\${data.Category || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Third Party Provider</label>
                                            <div class="value">\${data.ThirdParty || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Number of Agents</label>
                                            <div class="value">\${data.NumberOfAgents || 0}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Start Date</label>
                                            <div class="value">\${data.StartDate ? new Date(data.StartDate).toLocaleDateString('en-GB') : '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>End Date</label>
                                            <div class="value">\${data.EndDate ? new Date(data.EndDate).toLocaleDateString('en-GB') : '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Start Time</label>
                                            <div class="value">\${data.StartTimeFrom || '-'} - \${data.StartTimeTo || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Shift Hours</label>
                                            <div class="value">\${data.ShiftHours || 9} hours</div>
                                        </div>
                                        <div class="detail-item full">
                                            <label>Description / Reason</label>
                                            <div class="value">\${data.Description || 'No description provided'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Requested By</label>
                                            <div class="value">\${data.CreatedByName || 'Unknown'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Requested On</label>
                                            <div class="value">\${data.CreatedAt ? new Date(data.CreatedAt).toLocaleString('en-GB') : '-'}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="approval-section">
                                        <h4>Approval Status</h4>
                                        <div class="approval-grid">
                                            <div class="approval-card">
                                                <div class="role">Area Manager</div>
                                                <div>\${getStatusBadge(data.AreaManagerStatus)}</div>
                                            </div>
                                            <div class="approval-card">
                                                <div class="role">Head Office</div>
                                                <div>\${getStatusBadge(data.HOStatus)}</div>
                                            </div>
                                            <div class="approval-card">
                                                <div class="role">HR Manager</div>
                                                <div>\${getStatusBadge(data.HRStatus)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="action-buttons">
                                        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                                        \${data.OverallStatus === 'Pending' || !data.OverallStatus ? \`
                                            <button class="btn btn-danger" onclick="updateStatus(\${data.Id}, 'Rejected')">Reject</button>
                                            <button class="btn btn-success" onclick="updateStatus(\${data.Id}, 'Approved')">Approve</button>
                                        \` : ''}
                                    </div>
                                \`;
                                document.getElementById('detailModal').classList.add('active');
                            })
                            .catch(err => {
                                console.error('Error loading details:', err);
                                alert('Error loading request details');
                            });
                    }
                    
                    function getStatusBadge(status) {
                        const colors = {
                            'Pending': 'background:#fff3cd;color:#856404;',
                            'Approved': 'background:#d4edda;color:#155724;',
                            'Rejected': 'background:#f8d7da;color:#721c24;'
                        };
                        const s = status || 'Pending';
                        return '<span style="padding:6px 14px;border-radius:12px;font-size:12px;font-weight:500;' + (colors[s] || colors['Pending']) + '">' + s + '</span>';
                    }
                    
                    function closeModal() {
                        document.getElementById('detailModal').classList.remove('active');
                    }
                    
                    function updateStatus(id, status) {
                        if (!confirm('Are you sure you want to ' + status.toLowerCase() + ' this request?')) return;
                        
                        fetch('/operational-excellence/extra-cleaning-review/api/request/' + id + '/status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: status })
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                alert('Request ' + status.toLowerCase() + ' successfully!');
                                location.reload();
                            } else {
                                alert('Error: ' + data.error);
                            }
                        })
                        .catch(err => {
                            console.error('Error:', err);
                            alert('Error updating status');
                        });
                    }
                    
                    function applyFilters() {
                        // Client-side filtering for simplicity
                        const status = document.getElementById('filterStatus').value;
                        const store = document.getElementById('filterStore').value;
                        const rows = document.querySelectorAll('#requestsTable tr');
                        
                        rows.forEach(row => {
                            let show = true;
                            // Add filter logic here
                            row.style.display = show ? '' : 'none';
                        });
                    }
                    
                    function clearFilters() {
                        document.getElementById('filterStatus').value = '';
                        document.getElementById('filterStore').value = '';
                        document.getElementById('filterFrom').value = '';
                        document.getElementById('filterTo').value = '';
                        document.querySelectorAll('#requestsTable tr').forEach(row => row.style.display = '');
                    }
                    
                    // Close modal on outside click
                    document.getElementById('detailModal').addEventListener('click', function(e) {
                        if (e.target === this) closeModal();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading review page:', err);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;">
                <h2>Error loading page</h2>
                <p>${err.message}</p>
                <a href="/operational-excellence">Back to OE</a>
            </div>
        `);
    }
});

// API: Get single request details
router.get('/api/request/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    r.*,
                    u.DisplayName as CreatedByName,
                    u.Email as CreatedByEmail
                FROM ExtraCleaningRequests r
                LEFT JOIN Users u ON r.CreatedBy = u.Id
                WHERE r.Id = @id
            `);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error getting request:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Update request status
router.post('/api/request/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('status', sql.NVarChar, status)
            .input('userId', sql.Int, req.currentUser?.userId)
            .query(`
                UPDATE ExtraCleaningRequests 
                SET 
                    OverallStatus = @status,
                    HOStatus = @status,
                    UpdatedAt = GETDATE(),
                    UpdatedBy = @userId
                WHERE Id = @id
            `);
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
