/**
 * Production Extras Dashboard for Operational Excellence
 * OE team can review and manage all production extras requests
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
                SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN CAST(CreatedDate AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN CreatedDate >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0) THEN 1 ELSE 0 END) as thisMonth
            FROM ProductionExtrasRequests
        `);
        
        await pool.close();
        
        res.json({
            total: result.recordset[0].total || 0,
            pending: result.recordset[0].pending || 0,
            today: result.recordset[0].today || 0,
            thisMonth: result.recordset[0].thisMonth || 0
        });
    } catch (err) {
        console.error('Error getting production stats:', err);
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
                o.OutletName,
                s.SchemeName,
                l.LocationName,
                c.CategoryName,
                tp.ThirdPartyName,
                sh.ShiftName
            FROM ProductionExtrasRequests r
            LEFT JOIN ProductionOutlets o ON r.OutletId = o.Id
            LEFT JOIN ProductionOutletSchemes s ON r.SchemeId = s.Id
            LEFT JOIN ProductionLocations l ON r.LocationId = l.Id
            LEFT JOIN ProductionCategories c ON r.CategoryId = c.Id
            LEFT JOIN ProductionThirdParties tp ON r.ThirdPartyId = tp.Id
            LEFT JOIN ProductionShifts sh ON r.ShiftId = sh.Id
            ORDER BY r.CreatedDate DESC
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
        
        const formatDateTime = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };
        
        const formatCurrency = (amount) => {
            return '$' + (parseFloat(amount) || 0).toFixed(2);
        };
        
        const tableRows = result.recordset.map(r => `
            <tr onclick="viewDetails(${r.Id})" style="cursor:pointer;">
                <td><strong>PER-${r.Id}</strong></td>
                <td>${r.OutletName || '-'}</td>
                <td>${r.SchemeName || '-'}</td>
                <td>${r.LocationName || '-'}</td>
                <td>${r.CategoryName || '-'}</td>
                <td>${r.ThirdPartyName || '-'}</td>
                <td>${r.ShiftName || '-'}</td>
                <td>${r.NumberOfAgents || 0}</td>
                <td>${formatCurrency(r.UnitCost)}</td>
                <td><strong>${formatCurrency(r.TotalCost)}</strong></td>
                <td>${formatDateTime(r.StartDateTime)}</td>
                <td>${r.CreatedBy || 'Unknown'}</td>
                <td>${statusBadge(r.Approver1Status)}</td>
                <td>${statusBadge(r.Approver2Status)}</td>
                <td>${statusBadge(r.Status)}</td>
                <td>
                    <button onclick="event.stopPropagation(); viewDetails(${r.Id})" class="btn-action">👁️</button>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Production Extras Dashboard - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                    
                    .container { max-width: 1800px; margin: 0 auto; padding: 30px; }
                    
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
                    .stat-card.total .value { color: #667eea; }
                    
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
                        background: #667eea;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    }
                    
                    .table-container {
                        background: white;
                        border-radius: 12px;
                        overflow-x: auto;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    }
                    
                    table { width: 100%; border-collapse: collapse; min-width: 1400px; }
                    
                    th {
                        background: #f8f9fa;
                        padding: 14px 10px;
                        text-align: left;
                        font-size: 11px;
                        text-transform: uppercase;
                        color: #666;
                        border-bottom: 2px solid #dee2e6;
                        white-space: nowrap;
                    }
                    
                    td {
                        padding: 12px 10px;
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
                        max-width: 900px;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    
                    .modal-header {
                        padding: 20px 25px;
                        border-bottom: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border-radius: 16px 16px 0 0;
                    }
                    
                    .modal-header h3 { font-size: 20px; }
                    
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: white;
                    }
                    
                    .modal-body { padding: 25px; }
                    
                    .detail-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
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
                    .detail-item.half { grid-column: span 2; }
                    
                    .cost-summary {
                        margin-top: 20px;
                        padding: 20px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 12px;
                        color: white;
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        text-align: center;
                    }
                    
                    .cost-summary .cost-item .cost-label {
                        font-size: 12px;
                        opacity: 0.9;
                        margin-bottom: 5px;
                    }
                    
                    .cost-summary .cost-item .cost-value {
                        font-size: 24px;
                        font-weight: 700;
                    }
                    
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
                        grid-template-columns: repeat(2, 1fr);
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
                    
                    .approval-card .email {
                        font-size: 11px;
                        color: #888;
                        margin-top: 5px;
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
                    .btn-primary { background: #667eea; color: white; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>👷 Production Extras Dashboard</h1>
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
                            <div class="value" id="pendingCount">${result.recordset.filter(r => r.Status === 'Pending' || !r.Status).length}</div>
                            <div class="label">Pending</div>
                        </div>
                        <div class="stat-card approved">
                            <div class="value" id="approvedCount">${result.recordset.filter(r => r.Status === 'Approved').length}</div>
                            <div class="label">Approved</div>
                        </div>
                        <div class="stat-card rejected">
                            <div class="value" id="rejectedCount">${result.recordset.filter(r => r.Status === 'Rejected').length}</div>
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
                        <select id="filterOutlet">
                            <option value="">All Outlets</option>
                        </select>
                        <select id="filterCategory">
                            <option value="">All Categories</option>
                        </select>
                        <input type="date" id="filterFrom" placeholder="From Date">
                        <input type="date" id="filterTo" placeholder="To Date">
                        <button onclick="applyFilters()">🔍 Filter</button>
                        <button onclick="clearFilters()" style="background:#6c757d;">Clear</button>
                        <button onclick="exportToExcel()" style="background:#28a745;">📊 Export</button>
                    </div>
                    
                    <!-- Table -->
                    <div class="table-container">
                        ${result.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Outlet</th>
                                        <th>Scheme</th>
                                        <th>Location</th>
                                        <th>Category</th>
                                        <th>Third Party</th>
                                        <th>Shift</th>
                                        <th>Agents</th>
                                        <th>Unit Cost</th>
                                        <th>Total Cost</th>
                                        <th>Start Date/Time</th>
                                        <th>Requested By</th>
                                        <th>Approver 1</th>
                                        <th>Approver 2</th>
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
                                <div style="font-size:48px;margin-bottom:15px;">👷</div>
                                <h3>No requests yet</h3>
                                <p>Production extras requests will appear here for review</p>
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
                        fetch('/operational-excellence/production-dashboard/api/request/' + id)
                            .then(r => r.json())
                            .then(data => {
                                document.getElementById('modalTitle').textContent = 'Request PER-' + data.Id;
                                document.getElementById('modalBody').innerHTML = \`
                                    <div class="detail-grid">
                                        <div class="detail-item">
                                            <label>Outlet</label>
                                            <div class="value">\${data.OutletName || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Scheme</label>
                                            <div class="value">\${data.SchemeName || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Location</label>
                                            <div class="value">\${data.LocationName || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Category</label>
                                            <div class="value">\${data.CategoryName || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Third Party Provider</label>
                                            <div class="value">\${data.ThirdPartyName || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Shift</label>
                                            <div class="value">\${data.ShiftName || '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Start Date/Time</label>
                                            <div class="value">\${data.StartDateTime ? new Date(data.StartDateTime).toLocaleString('en-GB') : '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>End Date/Time</label>
                                            <div class="value">\${data.EndDateTime ? new Date(data.EndDateTime).toLocaleString('en-GB') : '-'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Number of Agents</label>
                                            <div class="value">\${data.NumberOfAgents || 0}</div>
                                        </div>
                                        <div class="detail-item full">
                                            <label>Description / Reason</label>
                                            <div class="value">\${data.Description || 'No description provided'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Requested By</label>
                                            <div class="value">\${data.CreatedBy || 'Unknown'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <label>Requested On</label>
                                            <div class="value">\${data.CreatedDate ? new Date(data.CreatedDate).toLocaleString('en-GB') : '-'}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="cost-summary">
                                        <div class="cost-item">
                                            <div class="cost-label">Unit Cost</div>
                                            <div class="cost-value">$\${parseFloat(data.UnitCost || 0).toFixed(2)}</div>
                                        </div>
                                        <div class="cost-item">
                                            <div class="cost-label">Number of Agents</div>
                                            <div class="cost-value">\${data.NumberOfAgents || 0}</div>
                                        </div>
                                        <div class="cost-item">
                                            <div class="cost-label">Total Cost</div>
                                            <div class="cost-value">$\${parseFloat(data.TotalCost || 0).toFixed(2)}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="approval-section">
                                        <h4>Approval Status</h4>
                                        <div class="approval-grid">
                                            <div class="approval-card">
                                                <div class="role">Approver 1</div>
                                                <div>\${getStatusBadge(data.Approver1Status)}</div>
                                                <div class="email">\${data.Approver1Email || '-'}</div>
                                            </div>
                                            <div class="approval-card">
                                                <div class="role">Approver 2</div>
                                                <div>\${getStatusBadge(data.Approver2Status)}</div>
                                                <div class="email">\${data.Approver2Email || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="action-buttons">
                                        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                                        \${data.Status === 'Pending' || !data.Status ? \`
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
                        
                        fetch('/operational-excellence/production-dashboard/api/request/' + id + '/status', {
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
                        const status = document.getElementById('filterStatus').value.toLowerCase();
                        const outlet = document.getElementById('filterOutlet').value.toLowerCase();
                        const category = document.getElementById('filterCategory').value.toLowerCase();
                        const rows = document.querySelectorAll('#requestsTable tr');
                        
                        rows.forEach(row => {
                            const cells = row.querySelectorAll('td');
                            let show = true;
                            
                            if (status && !cells[14].textContent.toLowerCase().includes(status)) show = false;
                            if (outlet && !cells[1].textContent.toLowerCase().includes(outlet)) show = false;
                            if (category && !cells[4].textContent.toLowerCase().includes(category)) show = false;
                            
                            row.style.display = show ? '' : 'none';
                        });
                    }
                    
                    function clearFilters() {
                        document.getElementById('filterStatus').value = '';
                        document.getElementById('filterOutlet').value = '';
                        document.getElementById('filterCategory').value = '';
                        document.getElementById('filterFrom').value = '';
                        document.getElementById('filterTo').value = '';
                        document.querySelectorAll('#requestsTable tr').forEach(row => row.style.display = '');
                    }
                    
                    function exportToExcel() {
                        window.location.href = '/operational-excellence/production-dashboard/api/export';
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
        console.error('Error loading production dashboard:', err);
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
                    o.OutletName,
                    s.SchemeName,
                    l.LocationName,
                    c.CategoryName,
                    tp.ThirdPartyName,
                    sh.ShiftName
                FROM ProductionExtrasRequests r
                LEFT JOIN ProductionOutlets o ON r.OutletId = o.Id
                LEFT JOIN ProductionOutletSchemes s ON r.SchemeId = s.Id
                LEFT JOIN ProductionLocations l ON r.LocationId = l.Id
                LEFT JOIN ProductionCategories c ON r.CategoryId = c.Id
                LEFT JOIN ProductionThirdParties tp ON r.ThirdPartyId = tp.Id
                LEFT JOIN ProductionShifts sh ON r.ShiftId = sh.Id
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
            .input('updatedBy', sql.NVarChar, req.currentUser?.displayName || 'OE Admin')
            .query(`
                UPDATE ProductionExtrasRequests 
                SET 
                    Status = @status,
                    Approver1Status = @status,
                    Approver2Status = @status
                WHERE Id = @id
            `);
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Export to CSV
router.get('/api/export', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                r.Id as RequestID,
                o.OutletName as Outlet,
                s.SchemeName as Scheme,
                l.LocationName as Location,
                c.CategoryName as Category,
                tp.ThirdPartyName as ThirdParty,
                sh.ShiftName as Shift,
                r.NumberOfAgents,
                r.UnitCost,
                r.TotalCost,
                r.StartDateTime,
                r.EndDateTime,
                r.Description,
                r.Approver1Email,
                r.Approver2Email,
                r.Approver1Status,
                r.Approver2Status,
                r.Status,
                r.CreatedBy,
                r.CreatedDate
            FROM ProductionExtrasRequests r
            LEFT JOIN ProductionOutlets o ON r.OutletId = o.Id
            LEFT JOIN ProductionOutletSchemes s ON r.SchemeId = s.Id
            LEFT JOIN ProductionLocations l ON r.LocationId = l.Id
            LEFT JOIN ProductionCategories c ON r.CategoryId = c.Id
            LEFT JOIN ProductionThirdParties tp ON r.ThirdPartyId = tp.Id
            LEFT JOIN ProductionShifts sh ON r.ShiftId = sh.Id
            ORDER BY r.CreatedDate DESC
        `);
        
        await pool.close();
        
        // Generate CSV
        const headers = Object.keys(result.recordset[0] || {});
        let csv = headers.join(',') + '\n';
        
        result.recordset.forEach(row => {
            csv += headers.map(h => {
                let val = row[h];
                if (val === null || val === undefined) return '';
                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                    return '"' + val.replace(/"/g, '""') + '"';
                }
                if (val instanceof Date) {
                    return val.toISOString();
                }
                return val;
            }).join(',') + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=production-extras-requests.csv');
        res.send(csv);
    } catch (err) {
        console.error('Error exporting:', err);
        res.status(500).send('Error exporting data');
    }
});

module.exports = router;
