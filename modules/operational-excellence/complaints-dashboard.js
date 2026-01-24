/**
 * Complaints Dashboard for Operational Excellence
 * View and manage all store complaints
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

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
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Shared connection pool
let poolPromise = null;
async function getPool() {
    try {
        if (!poolPromise) {
            poolPromise = sql.connect(dbConfig);
        }
        const pool = await poolPromise;
        // Test if connection is still alive
        if (!pool.connected) {
            poolPromise = null;
            poolPromise = sql.connect(dbConfig);
            return await poolPromise;
        }
        return pool;
    } catch (err) {
        poolPromise = null;
        throw err;
    }
}

// Stats API for the card
router.get('/api/stats', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'Open' THEN 1 ELSE 0 END) as [open],
                SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
                SUM(CASE WHEN CAST(CreatedAt as DATE) = CAST(GETDATE() as DATE) THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN SnoozeUntil IS NOT NULL AND CAST(SnoozeUntil as DATE) <= CAST(GETDATE() as DATE) AND Status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as followUpDue
            FROM Complaints
        `);
        
        const stats = result.recordset[0] || {};
        res.json({
            total: stats.total || 0,
            open: stats.open || 0,
            inProgress: stats.inProgress || 0,
            today: stats.today || 0,
            followUpDue: stats.followUpDue || 0
        });
    } catch (err) {
        console.error('Error loading complaints stats:', err);
        poolPromise = null; // Reset pool on error
        res.json({ total: 0, open: 0, inProgress: 0, today: 0, followUpDue: 0 });
    }
});

// Main dashboard page
router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
        const pool = await getPool();
        
        // Get all complaints with store and user info
        const complaints = await pool.request().query(`
            SELECT c.*, s.StoreName, u.DisplayName as CreatedByName,
                   cc.Name as CategoryName, cc.Icon as CategoryIcon,
                   ct.Name as TypeName, cs.Name as CaseName
            FROM Complaints c
            LEFT JOIN Stores s ON c.StoreId = s.Id
            LEFT JOIN Users u ON c.CreatedBy = u.Id
            LEFT JOIN ComplaintCategories cc ON c.CategoryId = cc.Id
            LEFT JOIN ComplaintTypes ct ON c.ComplaintTypeId = ct.Id
            LEFT JOIN ComplaintCases cs ON c.CaseId = cs.Id
            ORDER BY 
                CASE WHEN c.SnoozeUntil IS NOT NULL AND CAST(c.SnoozeUntil as DATE) <= CAST(GETDATE() as DATE) AND c.Status NOT IN ('Resolved', 'Closed') THEN 0 ELSE 1 END,
                CASE c.Status WHEN 'Open' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
                c.CreatedAt DESC
        `);
        
        const rows = complaints.recordset.map(c => {
            // Compare dates as strings (YYYY-MM-DD) to avoid timezone issues
            const snoozeDateStr = c.SnoozeUntil ? new Date(c.SnoozeUntil).toISOString().split('T')[0] : null;
            const todayStr = new Date().toISOString().split('T')[0];
            const isFollowUpDue = snoozeDateStr && snoozeDateStr <= todayStr && !['Resolved', 'Closed'].includes(c.Status);
            const isEscalated = c.EscalatedToThirdParty;
            return `
            <tr onclick="viewComplaint(${c.Id})" style="cursor:pointer;" class="${isFollowUpDue ? 'row-followup' : isEscalated ? 'row-escalated' : c.Status === 'Open' ? 'row-open' : c.Status === 'In Progress' ? 'row-progress' : ''}">
                <td><strong>#${c.Id}</strong> ${isFollowUpDue ? '<span class="followup-badge">🔔 FOLLOW-UP</span>' : ''} ${isEscalated ? '<span class="escalated-badge">⚠️ ESCALATED</span>' : ''}</td>
                <td>${new Date(c.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>${c.StoreName || '-'}</td>
                <td>${c.CreatedByName || '-'}</td>
                <td><span class="category-badge">${c.CategoryIcon || '📁'} ${c.CategoryName || c.Category || '-'}</span></td>
                <td>${c.TypeName || c.ComplaintType || '-'}</td>
                <td>${c.CaseName || c.CaseNumber || '-'}</td>
                <td><span class="status-badge status-${c.Status?.toLowerCase().replace(' ', '-')}">${c.Status}</span>${isEscalated ? '<br><small style="color:#dc3545;">→ ' + (c.ThirdPartyName || 'Third Party') + '</small>' : ''}</td>
                <td>${c.SnoozeUntil ? (isFollowUpDue ? '🔔 ' : '⏰ ') + new Date(c.SnoozeUntil).toLocaleDateString('en-GB') : ''}</td>
            </tr>
        `}).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Complaints Dashboard - ${process.env.APP_NAME || 'OE App'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; padding: 8px 15px; border-radius: 6px; }
                    .header-nav a:hover { opacity: 1; background: rgba(255,255,255,0.1); }
                    .container { max-width: 1600px; margin: 0 auto; padding: 30px 20px; }
                    
                    .stats-row {
                        display: grid;
                        grid-template-columns: repeat(5, 1fr);
                        gap: 20px;
                        margin-bottom: 25px;
                    }
                    .stat-card {
                        background: white;
                        border-radius: 12px;
                        padding: 20px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                        text-align: center;
                    }
                    .stat-card .number { font-size: 36px; font-weight: 700; }
                    .stat-card .label { color: #888; font-size: 13px; text-transform: uppercase; margin-top: 5px; }
                    .stat-card.open .number { color: #e17055; }
                    .stat-card.progress .number { color: #ffc107; }
                    .stat-card.resolved .number { color: #28a745; }
                    .stat-card.today .number { color: #17a2b8; }
                    .stat-card.followup .number { color: #dc3545; }
                    .stat-card.followup { border: 2px solid #dc3545; animation: pulse 2s infinite; }
                    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4); } 50% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); } }
                    
                    tr.row-followup { background: #ffe0e0; }
                    .followup-badge { background: #dc3545; color: white; font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-left: 8px; animation: blink 1s infinite; }
                    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                    
                    tr.row-escalated { background: #fff3cd; }
                    .escalated-badge { background: #fd7e14; color: white; font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-left: 8px; }
                    
                    .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); overflow-x: auto; }
                    table { width: 100%; border-collapse: collapse; min-width: 1000px; }
                    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; position: sticky; top: 0; }
                    tr:hover { background: #f8f9fa; }
                    tr.row-open { background: #fff5f3; }
                    tr.row-progress { background: #fffbf0; }
                    
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .status-badge.status-open { background: #f8d7da; color: #721c24; }
                    .status-badge.status-in-progress { background: #fff3cd; color: #856404; }
                    .status-badge.status-resolved { background: #d4edda; color: #155724; }
                    .status-badge.status-closed { background: #e2e3e5; color: #383d41; }
                    .category-badge { background: #f0f0f0; padding: 4px 10px; border-radius: 15px; font-size: 13px; }
                    
                    /* Modal */
                    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
                    .modal.show { display: flex; }
                    .modal-content { background: white; border-radius: 15px; width: 90%; max-width: 800px; max-height: 90vh; overflow: auto; }
                    .modal-header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 20px 25px; display: flex; justify-content: space-between; align-items: center; }
                    .modal-header h2 { font-size: 20px; }
                    .modal-close { background: none; border: none; color: white; font-size: 28px; cursor: pointer; }
                    .modal-body { padding: 25px; }
                    
                    .detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 25px; }
                    .detail-item label { display: block; color: #888; font-size: 11px; text-transform: uppercase; margin-bottom: 5px; }
                    .detail-item .value { font-size: 15px; font-weight: 500; }
                    
                    .description-box { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 25px; line-height: 1.6; }
                    
                    .updates-section { margin-bottom: 25px; }
                    .updates-section h3 { margin-bottom: 15px; color: #333; font-size: 16px; }
                    .update-item { background: #f0f7ff; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #667eea; }
                    .update-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
                    .update-header strong { color: #667eea; }
                    .update-header span { color: #888; }
                    .update-text { line-height: 1.5; }
                    
                    .action-section { background: #f8f9fa; padding: 20px; border-radius: 10px; }
                    .action-section h3 { margin-bottom: 15px; color: #333; font-size: 16px; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: #333; }
                    .form-control { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; }
                    .form-control:focus { outline: none; border-color: #e17055; }
                    textarea.form-control { min-height: 100px; resize: vertical; }
                    
                    .btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
                    .btn { padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; }
                    .btn-primary { background: #e17055; color: white; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-warning { background: #ffc107; color: #333; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
                    
                    .snooze-row { display: flex; gap: 10px; align-items: end; }
                    .snooze-row .form-group { flex: 1; margin-bottom: 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Store Complaints Dashboard</h1>
                    <div class="header-nav">
                        <a href="/operational-excellence">← Back to OE</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="stats-row">
                        <div class="stat-card followup" onclick="filterFollowUp()" style="cursor:pointer;" title="Click to filter">
                            <div class="number" id="statFollowUp">-</div>
                            <div class="label">🔔 Follow-up Due</div>
                        </div>
                        <div class="stat-card open">
                            <div class="number" id="statOpen">-</div>
                            <div class="label">Open</div>
                        </div>
                        <div class="stat-card progress">
                            <div class="number" id="statProgress">-</div>
                            <div class="label">In Progress</div>
                        </div>
                        <div class="stat-card resolved">
                            <div class="number" id="statResolved">-</div>
                            <div class="label">Resolved</div>
                        </div>
                        <div class="stat-card today">
                            <div class="number" id="statToday">-</div>
                            <div class="label">Today</div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Date</th>
                                    <th>Store</th>
                                    <th>Submitted By</th>
                                    <th>Category</th>
                                    <th>Type</th>
                                    <th>Case</th>
                                    <th>Status</th>
                                    <th>Snoozed Until</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="9" style="text-align:center;color:#888;">No complaints found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Complaint Detail Modal -->
                <div id="complaintModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 id="modalTitle">Complaint Details</h2>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <div class="modal-body" id="modalBody">
                            Loading...
                        </div>
                    </div>
                </div>
                
                <script>
                    // Load stats
                    fetch('/operational-excellence/complaints-dashboard/api/stats')
                        .then(r => r.json())
                        .then(data => {
                            document.getElementById('statFollowUp').textContent = data.followUpDue || 0;
                            document.getElementById('statOpen').textContent = data.open || 0;
                            document.getElementById('statProgress').textContent = data.inProgress || 0;
                            document.getElementById('statResolved').textContent = (data.total - data.open - data.inProgress) || 0;
                            document.getElementById('statToday').textContent = data.today || 0;
                            
                            // Hide follow-up card animation if no follow-ups due
                            if (!data.followUpDue) {
                                document.querySelector('.stat-card.followup').style.animation = 'none';
                                document.querySelector('.stat-card.followup').style.borderColor = '#ddd';
                            }
                        });
                    
                    function filterFollowUp() {
                        // Scroll to first follow-up row
                        const row = document.querySelector('tr.row-followup');
                        if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            row.style.transition = 'background 0.3s';
                            row.style.background = '#ffcccc';
                            setTimeout(() => { row.style.background = ''; }, 1500);
                        } else {
                            alert('No follow-ups due today!');
                        }
                    }
                    
                    function viewComplaint(id) {
                        document.getElementById('complaintModal').classList.add('show');
                        document.getElementById('modalTitle').textContent = 'Complaint #' + id;
                        document.getElementById('modalBody').innerHTML = '<p>Loading...</p>';
                        
                        fetch('/operational-excellence/complaints-dashboard/api/complaint/' + id)
                            .then(r => r.json())
                            .then(data => {
                                renderComplaintDetail(data);
                            })
                            .catch(err => {
                                document.getElementById('modalBody').innerHTML = '<p style="color:red;">Error loading complaint</p>';
                            });
                    }
                    
                    function renderComplaintDetail(data) {
                        const c = data.complaint;
                        const updates = data.updates || [];
                        
                        const updatesHtml = updates.length ? updates.map(u => \`
                            <div class="update-item">
                                <div class="update-header">
                                    <strong>\${u.UpdatedByName || 'OE Team'}</strong>
                                    <span>\${new Date(u.UpdatedAt).toLocaleString('en-GB')}</span>
                                </div>
                                <div class="update-text">\${u.UpdateNote}</div>
                            </div>
                        \`).join('') : '<p style="color:#888;">No updates yet</p>';
                        
                        document.getElementById('modalBody').innerHTML = \`
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Store</label>
                                    <div class="value">\${c.StoreName || '-'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Submitted By</label>
                                    <div class="value">\${c.CreatedByName || '-'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Date</label>
                                    <div class="value">\${new Date(c.CreatedAt).toLocaleString('en-GB')}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Category</label>
                                    <div class="value">\${c.CategoryIcon || ''} \${c.CategoryName || c.Category || '-'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Complaint Type</label>
                                    <div class="value">\${c.TypeName || c.ComplaintType || '-'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Case</label>
                                    <div class="value">\${c.CaseName || c.CaseNumber || '-'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Status</label>
                                    <div class="value"><span class="status-badge status-\${c.Status?.toLowerCase().replace(' ', '-')}">\${c.Status}</span></div>
                                </div>
                                <div class="detail-item">
                                    <label>Snoozed Until</label>
                                    <div class="value">\${c.SnoozeUntil ? new Date(c.SnoozeUntil).toLocaleDateString('en-GB') : '-'}</div>
                                </div>
                                \${c.EscalatedToThirdParty ? \`<div class="detail-item"><label>⚠️ Escalated To</label><div class="value" style="color:#dc3545;font-weight:600;">\${c.ThirdPartyName || 'Third Party'}</div></div>\` : ''}
                                \${c.AttachmentUrl ? \`<div class="detail-item"><label>Attachment</label><div class="value"><a href="\${c.AttachmentUrl}" target="_blank">📎 \${c.AttachmentName || 'View'}</a></div></div>\` : ''}
                            </div>
                            
                            <div class="description-box">
                                <strong>Description:</strong><br><br>
                                \${c.Description || '-'}
                            </div>
                            
                            <div class="updates-section">
                                <h3>📝 Updates History</h3>
                                \${updatesHtml}
                            </div>
                            
                            <div class="action-section">
                                <h3>🔧 Take Action</h3>
                                <form id="actionForm" onsubmit="submitAction(event, \${c.Id})">
                                    <div class="form-group">
                                        <label>Add Update Note</label>
                                        <textarea name="updateNote" class="form-control" placeholder="Describe what was done, what was solved, next steps..."></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Change Status</label>
                                        <select name="status" class="form-control">
                                            <option value="">-- Keep Current --</option>
                                            <option value="In Progress" \${c.Status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                            <option value="Resolved" \${c.Status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                            <option value="Closed" \${c.Status === 'Closed' ? 'selected' : ''}>Closed</option>
                                        </select>
                                    </div>
                                    
                                    <div class="escalation-section" style="background:#fff3cd;padding:15px;border-radius:8px;margin-bottom:15px;">
                                        <h4 style="margin:0 0 10px 0;color:#856404;">⚠️ Escalate to Third Party</h4>
                                        <div class="form-group" style="margin-bottom:10px;">
                                            <label>Third Party Name/Company</label>
                                            <input type="text" name="thirdPartyName" class="form-control" placeholder="e.g., Legal Department, Police, External Auditor..." value="\${c.ThirdPartyName || ''}">
                                        </div>
                                        <div style="display:flex;gap:10px;align-items:center;">
                                            <label style="margin:0;"><input type="checkbox" name="escalateToThirdParty" \${c.EscalatedToThirdParty ? 'checked' : ''}> Mark as Escalated to Third Party</label>
                                        </div>
                                    </div>
                                    
                                    <div class="snooze-row">
                                        <div class="form-group">
                                            <label>Snooze Until (for follow-up)</label>
                                            <input type="date" name="snoozeUntil" class="form-control" value="\${c.SnoozeUntil ? c.SnoozeUntil.split('T')[0] : ''}">
                                        </div>
                                        <button type="button" class="btn btn-secondary" onclick="clearSnooze(\${c.Id})">Clear Snooze</button>
                                    </div>
                                    
                                    <div class="btn-row">
                                        <button type="submit" class="btn btn-primary">💾 Save Changes</button>
                                        <button type="button" class="btn btn-success" onclick="resolveComplaint(\${c.Id})">✓ Mark Resolved</button>
                                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        \`;
                    }
                    
                    function closeModal() {
                        document.getElementById('complaintModal').classList.remove('show');
                    }
                    
                    async function submitAction(e, complaintId) {
                        e.preventDefault();
                        const form = e.target;
                        const data = {
                            updateNote: form.updateNote.value,
                            status: form.status.value,
                            snoozeUntil: form.snoozeUntil.value,
                            escalateToThirdParty: form.escalateToThirdParty.checked,
                            thirdPartyName: form.thirdPartyName.value
                        };
                        
                        try {
                            const res = await fetch('/operational-excellence/complaints-dashboard/api/complaint/' + complaintId + '/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            if (res.ok) {
                                alert('Changes saved successfully!');
                                location.reload();
                            } else {
                                alert('Error saving changes');
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    async function resolveComplaint(complaintId) {
                        if (!confirm('Mark this complaint as Resolved?')) return;
                        
                        try {
                            const res = await fetch('/operational-excellence/complaints-dashboard/api/complaint/' + complaintId + '/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'Resolved', updateNote: 'Complaint resolved by OE team' })
                            });
                            
                            if (res.ok) {
                                alert('Complaint marked as Resolved!');
                                location.reload();
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    async function clearSnooze(complaintId) {
                        try {
                            const res = await fetch('/operational-excellence/complaints-dashboard/api/complaint/' + complaintId + '/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ snoozeUntil: null })
                            });
                            
                            if (res.ok) {
                                alert('Snooze cleared!');
                                location.reload();
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    // Close modal on outside click
                    document.getElementById('complaintModal').addEventListener('click', function(e) {
                        if (e.target === this) closeModal();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading complaints dashboard:', err);
        poolPromise = null; // Reset pool on error
        res.status(500).send('Error: ' + err.message);
    }
});

// Get single complaint with updates
router.get('/api/complaint/:id', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
        const pool = await getPool();
        
        const complaint = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT c.*, s.StoreName, u.DisplayName as CreatedByName,
                       cc.Name as CategoryName, cc.Icon as CategoryIcon,
                       ct.Name as TypeName, cs.Name as CaseName
                FROM Complaints c
                LEFT JOIN Stores s ON c.StoreId = s.Id
                LEFT JOIN Users u ON c.CreatedBy = u.Id
                LEFT JOIN ComplaintCategories cc ON c.CategoryId = cc.Id
                LEFT JOIN ComplaintTypes ct ON c.ComplaintTypeId = ct.Id
                LEFT JOIN ComplaintCases cs ON c.CaseId = cs.Id
                WHERE c.Id = @id
            `);
        
        const updates = await pool.request()
            .input('complaintId', sql.Int, req.params.id)
            .query(`
                SELECT cu.*, u.DisplayName as UpdatedByName
                FROM ComplaintUpdates cu
                LEFT JOIN Users u ON cu.UpdatedBy = u.Id
                WHERE cu.ComplaintId = @complaintId
                ORDER BY cu.UpdatedAt DESC
            `);
        
        res.json({
            complaint: complaint.recordset[0] || null,
            updates: updates.recordset
        });
    } catch (err) {
        console.error('Error loading complaint:', err);
        poolPromise = null; // Reset pool on error
        res.status(500).json({ error: err.message });
    }
});

// Take action on complaint (update, status change, snooze, escalate)
router.post('/api/complaint/:id/action', async (req, res) => {
    try {
        const { updateNote, status, snoozeUntil, escalateToThirdParty, thirdPartyName } = req.body;
        const complaintId = req.params.id;
        const userId = req.session?.user?.id || 1;
        
        const pool = await getPool();
        
        // Add update note if provided
        if (updateNote && updateNote.trim()) {
            await pool.request()
                .input('complaintId', sql.Int, complaintId)
                .input('updateNote', sql.NVarChar, updateNote)
                .input('updatedBy', sql.Int, userId)
                .query(`
                    INSERT INTO ComplaintUpdates (ComplaintId, UpdateNote, UpdatedBy, UpdatedAt)
                    VALUES (@complaintId, @updateNote, @updatedBy, GETDATE())
                `);
        }
        
        // Add escalation note if escalated
        if (escalateToThirdParty && thirdPartyName) {
            await pool.request()
                .input('complaintId', sql.Int, complaintId)
                .input('updateNote', sql.NVarChar, `⚠️ ESCALATED TO THIRD PARTY: ${thirdPartyName}`)
                .input('updatedBy', sql.Int, userId)
                .query(`
                    INSERT INTO ComplaintUpdates (ComplaintId, UpdateNote, UpdatedBy, UpdatedAt)
                    VALUES (@complaintId, @updateNote, @updatedBy, GETDATE())
                `);
        }
        
        // Update complaint status and/or snooze
        let updateParts = ['UpdatedAt = GETDATE()'];
        const request = pool.request().input('id', sql.Int, complaintId);
        
        if (status) {
            updateParts.push('Status = @status');
            request.input('status', sql.NVarChar, status);
        }
        
        if (snoozeUntil !== undefined) {
            updateParts.push('SnoozeUntil = @snoozeUntil');
            request.input('snoozeUntil', sql.Date, snoozeUntil || null);
        }
        
        // Handle escalation
        if (escalateToThirdParty !== undefined) {
            updateParts.push('EscalatedToThirdParty = @escalated');
            request.input('escalated', sql.Bit, escalateToThirdParty ? 1 : 0);
            
            if (escalateToThirdParty) {
                updateParts.push('ThirdPartyName = @thirdPartyName');
                updateParts.push('EscalatedAt = GETDATE()');
                updateParts.push('EscalatedBy = @escalatedBy');
                request.input('thirdPartyName', sql.NVarChar, thirdPartyName || null);
                request.input('escalatedBy', sql.Int, userId);
            }
        }
        
        await request.query(`UPDATE Complaints SET ${updateParts.join(', ')} WHERE Id = @id`);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error taking action on complaint:', err);
        poolPromise = null; // Reset pool on error
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
