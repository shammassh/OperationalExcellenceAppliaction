/**
 * Escalation Dashboard Page
 * Main dashboard for viewing and escalating action items
 */

const sql = require('mssql');

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

module.exports = async (req, res) => {
    const isAdmin = req.currentUser?.roleNames?.includes('System Administrator');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Escalation Dashboard - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
                    min-height: 100vh;
                }
                .header {
                    background: rgba(0,0,0,0.2);
                    color: white;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { font-size: 24px; }
                .header-nav { display: flex; gap: 15px; align-items: center; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    background: rgba(255,255,255,0.1);
                    transition: background 0.2s;
                }
                .header-nav a:hover { background: rgba(255,255,255,0.2); }
                .header-nav a.active { background: rgba(255,255,255,0.3); }
                
                .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .stat-card {
                    background: white;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .stat-card .icon { font-size: 32px; margin-bottom: 10px; }
                .stat-card .value { font-size: 36px; font-weight: bold; color: #1f2937; }
                .stat-card .label { color: #6b7280; font-size: 14px; }
                .stat-card.overdue { border-left: 4px solid #dc2626; }
                .stat-card.high { border-left: 4px solid #f59e0b; }
                .stat-card.escalated { border-left: 4px solid #7c3aed; }
                .stat-card.total { border-left: 4px solid #10b981; }
                
                .content-grid {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 20px;
                }
                
                .sidebar {
                    background: white;
                    border-radius: 10px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    height: fit-content;
                }
                .sidebar h3 { margin-bottom: 15px; color: #1f2937; }
                
                .source-list { list-style: none; }
                .source-item {
                    padding: 12px 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: background 0.2s;
                    border: 2px solid transparent;
                }
                .source-item:hover { background: #f3f4f6; }
                .source-item.active { background: #ede9fe; border-color: #7c3aed; }
                .source-item .icon { font-size: 20px; }
                .source-item .name { flex: 1; font-weight: 500; }
                .source-item .count {
                    background: #e5e7eb;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 12px;
                }
                .source-item.active .count { background: #7c3aed; color: white; }
                
                .filter-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
                .filter-section h4 { margin-bottom: 10px; color: #6b7280; font-size: 12px; text-transform: uppercase; }
                .filter-select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                
                .main-content {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .content-header {
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .content-header h2 { color: #1f2937; }
                .content-header .actions { display: flex; gap: 10px; }
                
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .items-table th, .items-table td {
                    padding: 12px 15px;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }
                .items-table th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #6b7280;
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .items-table tr:hover { background: #f9fafb; }
                
                .badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge-overdue { background: #fee2e2; color: #dc2626; }
                .badge-high { background: #fef3c7; color: #d97706; }
                .badge-medium { background: #dbeafe; color: #2563eb; }
                .badge-low { background: #d1fae5; color: #059669; }
                .badge-critical { background: #dc2626; color: white; }
                .badge-escalated { background: #ede9fe; color: #7c3aed; }
                
                .source-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 500;
                }
                
                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .btn-primary { background: #7c3aed; color: white; }
                .btn-primary:hover { background: #6d28d9; }
                .btn-danger { background: #dc2626; color: white; }
                .btn-danger:hover { background: #b91c1c; }
                .btn-sm { padding: 5px 10px; font-size: 12px; }
                
                .action-btn {
                    padding: 5px 10px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-right: 5px;
                }
                .action-btn.escalate { background: #7c3aed; color: white; }
                .action-btn.escalate:hover { background: #6d28d9; }
                .action-btn.view { background: #e5e7eb; color: #374151; }
                .action-btn.view:hover { background: #d1d5db; }
                
                .empty-state {
                    padding: 60px 20px;
                    text-align: center;
                    color: #6b7280;
                }
                .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                
                .loading {
                    padding: 40px;
                    text-align: center;
                    color: #6b7280;
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
                    align-items: center;
                    justify-content: center;
                }
                .modal.active { display: flex; }
                .modal-content {
                    background: white;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-header h3 { color: #1f2937; }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #6b7280;
                }
                .modal-body { padding: 20px; }
                .modal-footer {
                    padding: 15px 20px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                
                .form-group { margin-bottom: 15px; }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                    color: #374151;
                }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .form-group textarea { resize: vertical; min-height: 80px; }
                .form-group .readonly {
                    background: #f3f4f6;
                    color: #6b7280;
                }
                
                .info-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                
                .truncate {
                    max-width: 250px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔴 Escalation Dashboard</h1>
                <div class="header-nav">
                    <a href="/escalation" class="active">Dashboard</a>
                    ${isAdmin ? `
                        <a href="/escalation/admin/sources">Sources</a>
                        <a href="/escalation/admin/templates">Email Templates</a>
                        <a href="/escalation/admin/contacts">Contacts</a>
                    ` : ''}
                    <a href="/dashboard">← Back to Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="stats-row">
                    <div class="stat-card total">
                        <div class="icon">📋</div>
                        <div class="value" id="stat-total">-</div>
                        <div class="label">Open Action Items</div>
                    </div>
                    <div class="stat-card overdue">
                        <div class="icon">⚠️</div>
                        <div class="value" id="stat-overdue">-</div>
                        <div class="label">Overdue Items</div>
                    </div>
                    <div class="stat-card high">
                        <div class="icon">🔥</div>
                        <div class="value" id="stat-high">-</div>
                        <div class="label">High Priority</div>
                    </div>
                    <div class="stat-card escalated">
                        <div class="icon">🔴</div>
                        <div class="value" id="stat-escalated">-</div>
                        <div class="label">Escalated</div>
                    </div>
                </div>
                
                <div class="content-grid">
                    <div class="sidebar">
                        <h3>📂 Sources</h3>
                        <ul class="source-list" id="source-list">
                            <li class="source-item active" data-source="all">
                                <span class="icon">📋</span>
                                <span class="name">All Sources</span>
                                <span class="count" id="count-all">0</span>
                            </li>
                        </ul>
                        
                        <div class="filter-section">
                            <h4>Filters</h4>
                            <select class="filter-select" id="filter-department">
                                <option value="">All Departments</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Procurement">Procurement</option>
                                <option value="Cleaning">Cleaning</option>
                            </select>
                            <select class="filter-select" id="filter-status">
                                <option value="">All Status</option>
                                <option value="Overdue">Overdue</option>
                                <option value="Open">Open</option>
                                <option value="InProgress">In Progress</option>
                            </select>
                            <select class="filter-select" id="filter-priority">
                                <option value="">All Priority</option>
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="main-content">
                        <div class="content-header">
                            <h2 id="content-title">All Action Items</h2>
                            <div class="actions">
                                <button class="btn btn-primary" onclick="refreshData()">🔄 Refresh</button>
                            </div>
                        </div>
                        
                        <div id="items-container">
                            <div class="loading">Loading action items...</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Escalation Modal -->
            <div class="modal" id="escalate-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🔴 Escalate Action Item</h3>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="info-row">
                            <div class="form-group">
                                <label>Source</label>
                                <input type="text" id="esc-source" class="readonly" readonly>
                            </div>
                            <div class="form-group">
                                <label>Store</label>
                                <input type="text" id="esc-store" class="readonly" readonly>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Finding</label>
                            <textarea id="esc-finding" class="readonly" readonly></textarea>
                        </div>
                        <div class="form-group">
                            <label>Action Required</label>
                            <textarea id="esc-action" class="readonly" readonly></textarea>
                        </div>
                        <div class="info-row">
                            <div class="form-group">
                                <label>Department</label>
                                <input type="text" id="esc-department" class="readonly" readonly>
                            </div>
                            <div class="form-group">
                                <label>Deadline</label>
                                <input type="text" id="esc-deadline" class="readonly" readonly>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Escalation Reason *</label>
                            <textarea id="esc-reason" placeholder="Why is this item being escalated?" required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Priority</label>
                            <select id="esc-priority">
                                <option value="Critical">Critical</option>
                                <option value="High" selected>High</option>
                                <option value="Medium">Medium</option>
                            </select>
                        </div>
                        <input type="hidden" id="esc-data">
                    </div>
                    <div class="modal-footer">
                        <button class="btn" onclick="closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="submitEscalation()">🔴 Escalate</button>
                    </div>
                </div>
            </div>
            
            <script>
                let sources = [];
                let currentSource = 'all';
                let items = [];
                
                async function loadStats() {
                    try {
                        const res = await fetch('/escalation/api/stats');
                        const data = await res.json();
                        if (data.success) {
                            document.getElementById('stat-total').textContent = data.data.totalItems;
                            document.getElementById('stat-overdue').textContent = data.data.overdueItems;
                            document.getElementById('stat-high').textContent = data.data.highPriorityItems;
                            document.getElementById('stat-escalated').textContent = data.data.escalatedItems;
                        }
                    } catch (err) {
                        console.error('Error loading stats:', err);
                    }
                }
                
                async function loadSources() {
                    try {
                        const res = await fetch('/escalation/api/sources');
                        const data = await res.json();
                        if (data.success) {
                            sources = data.data;
                            renderSources();
                        }
                    } catch (err) {
                        console.error('Error loading sources:', err);
                    }
                }
                
                function renderSources() {
                    const list = document.getElementById('source-list');
                    const allItem = list.querySelector('[data-source="all"]');
                    
                    // Icon mapping for sources
                    const sourceIcons = {
                        'OHS_INSPECTION': '🛡️',
                        'OE_INSPECTION': '🔍',
                        'COMPLAINTS': '📢',
                        'SECURITY': '🔒'
                    };
                    
                    // Remove existing source items (except "all")
                    list.querySelectorAll('.source-item:not([data-source="all"])').forEach(el => el.remove());
                    
                    sources.forEach(source => {
                        const icon = sourceIcons[source.SourceCode] || '📋';
                        const li = document.createElement('li');
                        li.className = 'source-item';
                        li.dataset.source = source.SourceCode;
                        li.innerHTML = \`
                            <span class="icon">\${icon}</span>
                            <span class="name">\${source.SourceName}</span>
                            <span class="count" id="count-\${source.SourceCode}">0</span>
                        \`;
                        li.onclick = () => selectSource(source.SourceCode, source.SourceName);
                        list.appendChild(li);
                    });
                }
                
                function selectSource(sourceCode, sourceName) {
                    currentSource = sourceCode;
                    document.querySelectorAll('.source-item').forEach(el => {
                        el.classList.toggle('active', el.dataset.source === sourceCode);
                    });
                    document.getElementById('content-title').textContent = 
                        sourceCode === 'all' ? 'All Action Items' : sourceName + ' Action Items';
                    loadItems();
                }
                
                async function loadItems() {
                    const container = document.getElementById('items-container');
                    container.innerHTML = '<div class="loading">Loading action items...</div>';
                    
                    try {
                        const department = document.getElementById('filter-department').value;
                        const status = document.getElementById('filter-status').value;
                        const priority = document.getElementById('filter-priority').value;
                        
                        let url = '/escalation/api/action-items?';
                        if (currentSource !== 'all') url += 'sourceCode=' + currentSource + '&';
                        if (department) url += 'department=' + department + '&';
                        if (status) url += 'status=' + status + '&';
                        if (priority) url += 'priority=' + priority + '&';
                        
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        if (data.success) {
                            items = data.data;
                            renderItems();
                            updateCounts();
                        }
                    } catch (err) {
                        console.error('Error loading items:', err);
                        container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Error loading items</p></div>';
                    }
                }
                
                function renderItems() {
                    const container = document.getElementById('items-container');
                    
                    // Icon mapping for sources
                    const sourceIcons = {
                        'OHS_INSPECTION': '🛡️',
                        'OE_INSPECTION': '🔍',
                        'COMPLAINTS': '📢',
                        'SECURITY': '🔒'
                    };
                    
                    if (items.length === 0) {
                        container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No action items found</p></div>';
                        return;
                    }
                    
                    container.innerHTML = \`
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th>Store</th>
                                    <th>Finding</th>
                                    <th>Department</th>
                                    <th>Deadline</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${items.map(item => {
                                    const icon = sourceIcons[item.SourceCode] || '📋';
                                    return \`
                                    <tr>
                                        <td>
                                            <span class="source-badge" style="background: \${item.SourceColor}20; color: \${item.SourceColor}">
                                                \${icon} \${item.SourceName}
                                            </span>
                                        </td>
                                        <td>\${item.StoreName || '-'}</td>
                                        <td class="truncate" title="\${escapeHtml(item.Finding || '')}">\${item.Finding || '-'}</td>
                                        <td>\${item.Department || '-'}</td>
                                        <td>
                                            \${formatDate(item.Deadline)}
                                            \${item.IsOverdue ? '<span class="badge badge-overdue">Overdue</span>' : ''}
                                            \${item.DaysOverdue > 0 ? '<br><small style="color:#dc2626">' + item.DaysOverdue + ' days</small>' : ''}
                                        </td>
                                        <td><span class="badge badge-\${(item.Priority || 'medium').toLowerCase()}">\${item.Priority || 'Medium'}</span></td>
                                        <td>
                                            \${item.IsEscalated 
                                                ? '<span class="badge badge-escalated">Escalated</span>' 
                                                : '<span class="badge">' + (item.Status || 'Open') + '</span>'}
                                        </td>
                                        <td>
                                            \${!item.IsEscalated 
                                                ? '<button class="action-btn escalate" onclick="openEscalateModal(' + JSON.stringify(item).replace(/"/g, '&quot;') + ')">🔴 Escalate</button>'
                                                : '<span style="color:#7c3aed;font-size:12px">Escalated</span>'}
                                        </td>
                                    </tr>
                                \`;}).join('')}
                            </tbody>
                        </table>
                    \`;
                }
                
                function updateCounts() {
                    // Update "All" count
                    document.getElementById('count-all').textContent = items.length;
                    
                    // Update per-source counts
                    sources.forEach(source => {
                        const count = items.filter(i => i.SourceCode === source.SourceCode).length;
                        const el = document.getElementById('count-' + source.SourceCode);
                        if (el) el.textContent = count;
                    });
                }
                
                function openEscalateModal(item) {
                    document.getElementById('esc-source').value = item.SourceName;
                    document.getElementById('esc-store').value = item.StoreName || '';
                    document.getElementById('esc-finding').value = item.Finding || '';
                    document.getElementById('esc-action').value = item.Action || '';
                    document.getElementById('esc-department').value = item.Department || '';
                    document.getElementById('esc-deadline').value = formatDate(item.Deadline);
                    document.getElementById('esc-reason').value = '';
                    document.getElementById('esc-priority').value = item.Priority || 'High';
                    document.getElementById('esc-data').value = JSON.stringify(item);
                    document.getElementById('escalate-modal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('escalate-modal').classList.remove('active');
                }
                
                async function submitEscalation() {
                    const item = JSON.parse(document.getElementById('esc-data').value);
                    const reason = document.getElementById('esc-reason').value.trim();
                    const priority = document.getElementById('esc-priority').value;
                    
                    if (!reason) {
                        alert('Please enter an escalation reason');
                        return;
                    }
                    
                    try {
                        const res = await fetch('/escalation/api/escalate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sourceId: item.SourceId,
                                sourceItemId: item.Id,
                                sourceInspectionId: item.InspectionId,
                                department: item.Department,
                                storeName: item.StoreName,
                                finding: item.Finding,
                                actionRequired: item.Action,
                                deadline: item.Deadline,
                                responsible: item.Responsible,
                                priority: priority,
                                reason: reason
                            })
                        });
                        
                        const data = await res.json();
                        if (data.success) {
                            alert('Item escalated successfully');
                            closeModal();
                            refreshData();
                        } else {
                            alert('Error: ' + data.error);
                        }
                    } catch (err) {
                        console.error('Error escalating:', err);
                        alert('Error escalating item');
                    }
                }
                
                function refreshData() {
                    loadStats();
                    loadItems();
                }
                
                function formatDate(dateStr) {
                    if (!dateStr) return '-';
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                }
                
                function escapeHtml(str) {
                    if (!str) return '';
                    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                }
                
                // Event listeners
                document.getElementById('filter-department').onchange = loadItems;
                document.getElementById('filter-status').onchange = loadItems;
                document.getElementById('filter-priority').onchange = loadItems;
                
                // Initialize
                loadStats();
                loadSources();
                loadItems();
            </script>
        </body>
        </html>
    `);
};
