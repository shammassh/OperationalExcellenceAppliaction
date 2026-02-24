const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules', 'admin', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start of Job Monitor section - using regex for flexibility
const startRegex = /\/\/ =+\s*\n\/\/ JOB MONITOR PAGE/;
const match = content.match(startRegex);

if (!match) {
    console.log('Could not find JOB MONITOR PAGE marker');
    console.log('Content sample:', content.substring(content.length - 2000, content.length - 1500));
    process.exit(1);
}
const startIndex = match.index;

// Get the content before Job Monitor
const beforeJobMonitor = content.substring(0, startIndex);

// New Job Monitor page code
const newJobMonitorCode = `// ============================================================================
// JOB MONITOR PAGE - Action Plan Tracker
// ============================================================================
router.get('/job-monitor', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get notification templates
        const templatesResult = await pool.request().query(\`
            SELECT TemplateKey, TemplateName, Module, ReportType FROM EmailTemplates
            WHERE ReportType IN ('inspection-reminder', 'inspection-overdue', 'inspection-escalation', 'escalation') AND IsActive = 1
            ORDER BY Module, ReportType
        \`);
        
        const templates = templatesResult.recordset;
        const oeTemplates = templates.filter(t => t.Module === 'OE');
        const ohsTemplates = templates.filter(t => t.Module === 'OHS');
        
        // Get OE Inspections with action plan tracking
        const oeInspectionsResult = await pool.request().query(\`
            SELECT DocumentNumber, StoreName, InspectionDate, Status, ActionPlanDeadline, ActionPlanCompletedAt, CreatedBy,
                CASE WHEN ActionPlanCompletedAt IS NOT NULL THEN 'Completed'
                     WHEN ActionPlanDeadline IS NULL THEN 'No Deadline'
                     WHEN ActionPlanDeadline < GETDATE() THEN 'Overdue'
                     WHEN DATEDIFF(DAY, GETDATE(), ActionPlanDeadline) <= 3 THEN 'Due Soon'
                     ELSE 'On Track' END as ActionPlanStatus,
                CASE WHEN ActionPlanDeadline IS NOT NULL AND ActionPlanCompletedAt IS NULL AND ActionPlanDeadline < GETDATE() 
                     THEN DATEDIFF(DAY, ActionPlanDeadline, GETDATE()) ELSE NULL END as DaysOverdue,
                CASE WHEN ActionPlanDeadline IS NOT NULL AND ActionPlanCompletedAt IS NULL AND ActionPlanDeadline >= GETDATE() 
                     THEN DATEDIFF(DAY, GETDATE(), ActionPlanDeadline) ELSE NULL END as DaysUntilDeadline
            FROM OE_Inspections WHERE Status = 'Completed' AND ActionPlanCompletedAt IS NULL
            ORDER BY CASE WHEN ActionPlanDeadline < GETDATE() THEN 0 ELSE 1 END, ActionPlanDeadline
        \`);
        const oeInspections = oeInspectionsResult.recordset;
        
        // Get OHS Inspections with action plan tracking
        const ohsInspectionsResult = await pool.request().query(\`
            SELECT DocumentNumber, StoreName, InspectionDate, Status, ActionPlanDeadline, ActionPlanCompletedAt, CreatedBy,
                CASE WHEN ActionPlanCompletedAt IS NOT NULL THEN 'Completed'
                     WHEN ActionPlanDeadline IS NULL THEN 'No Deadline'
                     WHEN ActionPlanDeadline < GETDATE() THEN 'Overdue'
                     WHEN DATEDIFF(DAY, GETDATE(), ActionPlanDeadline) <= 3 THEN 'Due Soon'
                     ELSE 'On Track' END as ActionPlanStatus,
                CASE WHEN ActionPlanDeadline IS NOT NULL AND ActionPlanCompletedAt IS NULL AND ActionPlanDeadline < GETDATE() 
                     THEN DATEDIFF(DAY, ActionPlanDeadline, GETDATE()) ELSE NULL END as DaysOverdue,
                CASE WHEN ActionPlanDeadline IS NOT NULL AND ActionPlanCompletedAt IS NULL AND ActionPlanDeadline >= GETDATE() 
                     THEN DATEDIFF(DAY, GETDATE(), ActionPlanDeadline) ELSE NULL END as DaysUntilDeadline
            FROM OHS_Inspections WHERE Status = 'Completed' AND ActionPlanCompletedAt IS NULL
            ORDER BY CASE WHEN ActionPlanDeadline < GETDATE() THEN 0 ELSE 1 END, ActionPlanDeadline
        \`);
        const ohsInspections = ohsInspectionsResult.recordset;
        
        // Calculate stats
        const oeOverdue = oeInspections.filter(i => i.ActionPlanStatus === 'Overdue').length;
        const oeDueSoon = oeInspections.filter(i => i.ActionPlanStatus === 'Due Soon').length;
        const oeNoDeadline = oeInspections.filter(i => i.ActionPlanStatus === 'No Deadline').length;
        const ohsOverdue = ohsInspections.filter(i => i.ActionPlanStatus === 'Overdue').length;
        const ohsDueSoon = ohsInspections.filter(i => i.ActionPlanStatus === 'Due Soon').length;
        const ohsNoDeadline = ohsInspections.filter(i => i.ActionPlanStatus === 'No Deadline').length;
        
        // Render helper for inspection rows
        const renderRow = (i) => {
            const statusClass = i.ActionPlanStatus === 'Overdue' ? 'overdue' : 
                               i.ActionPlanStatus === 'Due Soon' ? 'due-soon' : 
                               i.ActionPlanStatus === 'Completed' ? 'completed' : 'no-deadline';
            const statusIcon = i.ActionPlanStatus === 'Overdue' ? '🔴' : 
                              i.ActionPlanStatus === 'Due Soon' ? '🟡' : 
                              i.ActionPlanStatus === 'Completed' ? '✅' : '⚪';
            return \`
                <tr class="\${statusClass}">
                    <td><strong>\${i.DocumentNumber}</strong></td>
                    <td>\${i.StoreName}</td>
                    <td>\${i.InspectionDate ? new Date(i.InspectionDate).toLocaleDateString() : '-'}</td>
                    <td>\${i.ActionPlanDeadline ? new Date(i.ActionPlanDeadline).toLocaleDateString() : '<span class="no-deadline">Not Set</span>'}</td>
                    <td>
                        <span class="status-pill \${statusClass}">
                            \${statusIcon} \${i.ActionPlanStatus}
                            \${i.DaysOverdue ? \`<small>(\${i.DaysOverdue} days)</small>\` : ''}
                            \${i.DaysUntilDeadline !== null && i.DaysUntilDeadline >= 0 ? \`<small>(\${i.DaysUntilDeadline} days left)</small>\` : ''}
                        </span>
                    </td>
                    <td>\${i.CreatedBy || '-'}</td>
                </tr>
            \`;
        };
        
        res.send(\`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Action Plan Tracker - Admin</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px 30px; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header a { color: white; text-decoration: none; opacity: 0.8; }
                    .header a:hover { opacity: 1; }
                    .container { max-width: 1600px; margin: 0 auto; padding: 20px; }
                    
                    .info-banner { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #1565c0; }
                    
                    .scheduler-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
                    .scheduler-card { background: white; border-radius: 10px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 12px; }
                    .scheduler-card .icon { font-size: 24px; }
                    .scheduler-card .info { flex: 1; }
                    .scheduler-card .label { font-size: 11px; color: #888; }
                    .scheduler-card .value { font-size: 14px; font-weight: 600; color: #333; }
                    .scheduler-card.ok { border-left: 3px solid #28a745; }
                    .scheduler-card.error { border-left: 3px solid #dc3545; }
                    .scheduler-card.idle { border-left: 3px solid #6c757d; }
                    
                    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 25px; }
                    .summary-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
                    .summary-card h3 { font-size: 14px; color: #666; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
                    .summary-card .badge { padding: 4px 10px; border-radius: 15px; font-size: 11px; font-weight: 600; }
                    .summary-card .badge.oe { background: #e8f5e9; color: #2e7d32; }
                    .summary-card .badge.ohs { background: #ffebee; color: #c62828; }
                    .summary-stats { display: flex; gap: 20px; }
                    .summary-stat { text-align: center; flex: 1; }
                    .summary-stat .value { font-size: 28px; font-weight: 700; }
                    .summary-stat .label { font-size: 11px; color: #888; margin-top: 4px; }
                    .summary-stat.overdue .value { color: #dc3545; }
                    .summary-stat.due-soon .value { color: #ffc107; }
                    .summary-stat.pending .value { color: #6c757d; }
                    
                    .action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
                    .action-bar .meta { font-size: 12px; color: #888; }
                    .action-buttons { display: flex; gap: 10px; }
                    
                    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; text-decoration: none; transition: all 0.2s; }
                    .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
                    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(102,126,234,0.4); }
                    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                    .btn-secondary { background: #e9ecef; color: #495057; }
                    .btn-secondary:hover { background: #dee2e6; }
                    .btn-sm { padding: 6px 12px; font-size: 11px; }
                    .btn-outline { background: white; color: #667eea; border: 1px solid #667eea; }
                    .btn-outline:hover { background: #667eea; color: white; }
                    
                    .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 0; }
                    .tab { padding: 10px 20px; cursor: pointer; font-weight: 600; font-size: 13px; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
                    .tab:hover { color: #333; }
                    .tab.active { color: #667eea; border-bottom-color: #667eea; }
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    
                    .section { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
                    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
                    .section-header h2 { font-size: 16px; color: #333; display: flex; align-items: center; gap: 10px; }
                    
                    .tracking-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    .tracking-table th { background: #f8f9fa; padding: 12px 10px; text-align: left; font-weight: 600; color: #555; border-bottom: 2px solid #eee; }
                    .tracking-table td { padding: 10px; border-bottom: 1px solid #eee; }
                    .tracking-table tr:hover { background: #f8f9fa; }
                    .tracking-table tr.overdue { background: #fff5f5; }
                    .tracking-table tr.overdue:hover { background: #ffe0e0; }
                    .tracking-table tr.due-soon { background: #fffbf0; }
                    .tracking-table tr.due-soon:hover { background: #fff3cd; }
                    
                    .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 15px; font-size: 12px; font-weight: 600; }
                    .status-pill.overdue { background: #f8d7da; color: #721c24; }
                    .status-pill.due-soon { background: #fff3cd; color: #856404; }
                    .status-pill.completed { background: #d4edda; color: #155724; }
                    .status-pill.no-deadline { background: #e9ecef; color: #6c757d; }
                    .status-pill small { font-weight: 400; opacity: 0.8; }
                    .no-deadline { color: #999; font-style: italic; }
                    
                    .empty-state { text-align: center; padding: 40px; color: #888; }
                    .empty-state .icon { font-size: 48px; margin-bottom: 10px; opacity: 0.5; }
                    
                    .templates-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-top: 15px; }
                    .template-card { background: #f8f9fa; border-radius: 8px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; }
                    .template-card:hover { background: #e9ecef; }
                    .template-info { font-size: 13px; color: #333; }
                    .template-info .type { font-size: 11px; color: #888; }
                    .template-actions { display: flex; gap: 5px; }
                    
                    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
                    .modal-content { background: white; border-radius: 12px; width: 90%; max-width: 900px; max-height: 90vh; overflow: auto; }
                    .modal-header { padding: 15px 20px; background: #f5f5f5; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; }
                    .modal-header h3 { margin: 0; font-size: 16px; }
                    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
                    .modal-body { padding: 20px; }
                    .preview-subject { background: #f8f9fa; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; }
                    .preview-subject label { font-size: 11px; color: #666; display: block; margin-bottom: 4px; }
                    .preview-iframe { width: 100%; height: 400px; border: 1px solid #eee; border-radius: 8px; }
                    
                    .dryrun-results { margin-top: 15px; }
                    .dryrun-item { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #28a745; }
                    .dryrun-item h4 { font-size: 14px; color: #333; margin-bottom: 8px; }
                    .dryrun-item p { font-size: 13px; color: #666; margin: 4px 0; }
                    .dryrun-empty { text-align: center; padding: 30px; color: #888; }
                    
                    .loading { display: inline-block; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; border-top-color: transparent; animation: spin 0.8s linear infinite; }
                    .loading-dark { border-color: #667eea; border-top-color: transparent; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    
                    .toast { position: fixed; bottom: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: 600; z-index: 2000; animation: slideIn 0.3s ease; }
                    .toast.success { background: #28a745; }
                    .toast.error { background: #dc3545; }
                    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1><a href="/admin">← Admin</a> / 📋 Action Plan Tracker</h1>
                </div>
                <div class="container">
                    <div class="info-banner">
                        📋 <strong>Action Plan Tracker</strong> monitors all inspections with pending action plans. Overdue items are highlighted. The scheduler sends automatic reminders and escalations.
                    </div>
                    
                    <!-- Scheduler Status -->
                    <div class="scheduler-row">
                        <div class="scheduler-card idle" id="statusCard">
                            <div class="icon">⚡</div>
                            <div class="info">
                                <div class="label">Scheduler</div>
                                <div class="value" id="schedulerStatus">Loading...</div>
                            </div>
                        </div>
                        <div class="scheduler-card">
                            <div class="icon">🕐</div>
                            <div class="info">
                                <div class="label">Last Run</div>
                                <div class="value" id="lastRunTime">-</div>
                            </div>
                        </div>
                        <div class="scheduler-card">
                            <div class="icon">⏭️</div>
                            <div class="info">
                                <div class="label">Next Run</div>
                                <div class="value" id="nextRunTime">-</div>
                            </div>
                        </div>
                        <div class="scheduler-card">
                            <div class="icon">📤</div>
                            <div class="info">
                                <div class="label">Emails Sent</div>
                                <div class="value" id="emailsSent">0</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="action-bar">
                        <div class="meta">Last refreshed: <span id="lastRefresh">just now</span> | Auto-refresh: 30s</div>
                        <div class="action-buttons">
                            <button class="btn btn-secondary" onclick="location.reload()">🔄 Refresh</button>
                            <button class="btn btn-primary" id="runNowBtn" onclick="runNow()">▶️ Run Scheduler Now</button>
                        </div>
                    </div>
                    
                    <!-- Summary Cards -->
                    <div class="summary-grid">
                        <div class="summary-card">
                            <h3><span class="badge oe">OE</span> Operational Excellence</h3>
                            <div class="summary-stats">
                                <div class="summary-stat overdue"><div class="value">\${oeOverdue}</div><div class="label">🔴 Overdue</div></div>
                                <div class="summary-stat due-soon"><div class="value">\${oeDueSoon}</div><div class="label">🟡 Due Soon</div></div>
                                <div class="summary-stat pending"><div class="value">\${oeNoDeadline}</div><div class="label">⚪ No Deadline</div></div>
                            </div>
                        </div>
                        <div class="summary-card">
                            <h3><span class="badge ohs">OHS</span> Occupational Health & Safety</h3>
                            <div class="summary-stats">
                                <div class="summary-stat overdue"><div class="value">\${ohsOverdue}</div><div class="label">🔴 Overdue</div></div>
                                <div class="summary-stat due-soon"><div class="value">\${ohsDueSoon}</div><div class="label">🟡 Due Soon</div></div>
                                <div class="summary-stat pending"><div class="value">\${ohsNoDeadline}</div><div class="label">⚪ No Deadline</div></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tabs -->
                    <div class="tabs">
                        <div class="tab active" data-tab="oe-tab">📋 OE Inspections (\${oeInspections.length})</div>
                        <div class="tab" data-tab="ohs-tab">📋 OHS Inspections (\${ohsInspections.length})</div>
                        <div class="tab" data-tab="templates-tab">📧 Email Templates</div>
                    </div>
                    
                    <!-- OE Tab -->
                    <div class="tab-content active" id="oe-tab">
                        <div class="section">
                            <div class="section-header"><h2><span class="badge oe">OE</span> Pending Action Plans</h2></div>
                            \${oeInspections.length > 0 ? \`
                                <table class="tracking-table">
                                    <thead><tr><th>Document #</th><th>Store</th><th>Inspection Date</th><th>Deadline</th><th>Status</th><th>Created By</th></tr></thead>
                                    <tbody>\${oeInspections.map(renderRow).join('')}</tbody>
                                </table>
                            \` : \`<div class="empty-state"><div class="icon">✅</div><p>No pending action plans</p></div>\`}
                        </div>
                    </div>
                    
                    <!-- OHS Tab -->
                    <div class="tab-content" id="ohs-tab">
                        <div class="section">
                            <div class="section-header"><h2><span class="badge ohs">OHS</span> Pending Action Plans</h2></div>
                            \${ohsInspections.length > 0 ? \`
                                <table class="tracking-table">
                                    <thead><tr><th>Document #</th><th>Store</th><th>Inspection Date</th><th>Deadline</th><th>Status</th><th>Created By</th></tr></thead>
                                    <tbody>\${ohsInspections.map(renderRow).join('')}</tbody>
                                </table>
                            \` : \`<div class="empty-state"><div class="icon">✅</div><p>No pending action plans</p></div>\`}
                        </div>
                    </div>
                    
                    <!-- Templates Tab -->
                    <div class="tab-content" id="templates-tab">
                        <div class="section">
                            <div class="section-header"><h2>📧 Notification Templates</h2></div>
                            <p style="color: #666; margin-bottom: 20px; font-size: 13px;">Preview templates or run a <strong>Dry Run</strong> to see what would be sent.</p>
                            
                            <div style="margin-bottom: 25px;">
                                <h4 style="font-size: 14px; color: #2e7d32; margin-bottom: 10px;">🟢 OE Templates (\${oeTemplates.length})</h4>
                                <div class="templates-grid">
                                    \${oeTemplates.map(t => \`
                                        <div class="template-card">
                                            <div class="template-info"><div>\${t.TemplateName}</div><div class="type">\${t.ReportType}</div></div>
                                            <div class="template-actions">
                                                <button class="btn btn-secondary btn-sm" onclick="previewTemplate('\${t.TemplateKey}')">👁️</button>
                                                <button class="btn btn-outline btn-sm" onclick="dryRunTemplate('\${t.TemplateKey}', '\${t.Module}', '\${t.ReportType}')">🧪</button>
                                            </div>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                            
                            <div>
                                <h4 style="font-size: 14px; color: #c62828; margin-bottom: 10px;">🔴 OHS Templates (\${ohsTemplates.length})</h4>
                                <div class="templates-grid">
                                    \${ohsTemplates.map(t => \`
                                        <div class="template-card">
                                            <div class="template-info"><div>\${t.TemplateName}</div><div class="type">\${t.ReportType}</div></div>
                                            <div class="template-actions">
                                                <button class="btn btn-secondary btn-sm" onclick="previewTemplate('\${t.TemplateKey}')">👁️</button>
                                                <button class="btn btn-outline btn-sm" onclick="dryRunTemplate('\${t.TemplateKey}', '\${t.Module}', '\${t.ReportType}')">🧪</button>
                                            </div>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Preview Modal -->
                <div class="modal" id="previewModal">
                    <div class="modal-content">
                        <div class="modal-header"><h3 id="previewTitle">Email Preview</h3><button class="modal-close" onclick="closeModal('previewModal')">&times;</button></div>
                        <div class="modal-body">
                            <div class="preview-subject"><label>Subject</label><div id="previewSubject">-</div></div>
                            <iframe id="previewIframe" class="preview-iframe"></iframe>
                        </div>
                    </div>
                </div>
                
                <!-- Dry Run Modal -->
                <div class="modal" id="dryrunModal">
                    <div class="modal-content">
                        <div class="modal-header"><h3 id="dryrunTitle">🧪 Dry Run Results</h3><button class="modal-close" onclick="closeModal('dryrunModal')">&times;</button></div>
                        <div class="modal-body">
                            <p style="color: #666; margin-bottom: 15px; font-size: 13px;">These notifications <strong>would be sent</strong> if the scheduler runs now.</p>
                            <div id="dryrunResults" class="dryrun-results"></div>
                        </div>
                    </div>
                </div>
                
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        refreshStatus();
                        setInterval(refreshStatus, 30000);
                        
                        document.querySelectorAll('.tab').forEach(tab => {
                            tab.addEventListener('click', () => {
                                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                                tab.classList.add('active');
                                document.getElementById(tab.dataset.tab).classList.add('active');
                            });
                        });
                    });
                    
                    async function refreshStatus() {
                        try {
                            const res = await fetch('/admin/api/job-monitor');
                            const data = await res.json();
                            if (data.success) {
                                const s = data.scheduler;
                                const card = document.getElementById('statusCard');
                                const status = document.getElementById('schedulerStatus');
                                
                                if (s.isRunning) { status.textContent = '⏳ Running...'; card.className = 'scheduler-card idle'; }
                                else if (s.lastRunStatus === 'success') { status.textContent = '✅ OK'; card.className = 'scheduler-card ok'; }
                                else if (s.lastRunStatus === 'error') { status.textContent = '❌ Error'; card.className = 'scheduler-card error'; }
                                else { status.textContent = '⏸️ Idle'; card.className = 'scheduler-card idle'; }
                                
                                document.getElementById('lastRunTime').textContent = s.lastRunTime ? new Date(s.lastRunTime).toLocaleString() : 'Never';
                                document.getElementById('nextRunTime').textContent = s.nextRunTime ? new Date(s.nextRunTime).toLocaleString() : '-';
                                document.getElementById('emailsSent').textContent = s.stats?.emailsSent || 0;
                                document.getElementById('lastRefresh').textContent = 'just now';
                            }
                        } catch (e) { console.error(e); }
                    }
                    
                    async function runNow() {
                        const btn = document.getElementById('runNowBtn');
                        btn.innerHTML = '<span class="loading"></span> Running...'; btn.disabled = true;
                        try {
                            const res = await fetch('/admin/api/job-monitor/run-now', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) { showToast('Scheduler started!', 'success'); setTimeout(() => location.reload(), 3000); }
                            else { showToast(data.error || 'Failed', 'error'); }
                        } catch (e) { showToast('Error: ' + e.message, 'error'); }
                        finally { btn.innerHTML = '▶️ Run Scheduler Now'; btn.disabled = false; }
                    }
                    
                    async function previewTemplate(key) {
                        try {
                            const res = await fetch('/admin/api/job-monitor/preview-template/' + key);
                            const data = await res.json();
                            if (data.success) {
                                document.getElementById('previewTitle').textContent = data.template.name;
                                document.getElementById('previewSubject').textContent = data.preview.subject;
                                document.getElementById('previewIframe').srcdoc = data.preview.bodyHtml;
                                document.getElementById('previewModal').style.display = 'flex';
                            }
                        } catch (e) { showToast('Error: ' + e.message, 'error'); }
                    }
                    
                    async function dryRunTemplate(key, module, type) {
                        document.getElementById('dryrunTitle').textContent = '🧪 Dry Run: ' + module + ' ' + type;
                        document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty"><span class="loading loading-dark"></span> Checking...</div>';
                        document.getElementById('dryrunModal').style.display = 'flex';
                        try {
                            const res = await fetch('/admin/api/job-monitor/dry-run?module=' + module + '&type=' + type);
                            const data = await res.json();
                            if (data.success) {
                                const r = data.results || [];
                                document.getElementById('dryrunResults').innerHTML = r.length > 0 
                                    ? r.map(i => '<div class="dryrun-item"><h4>' + i.storeName + ' - ' + i.documentNumber + '</h4><p><strong>Deadline:</strong> ' + (i.deadline ? new Date(i.deadline).toLocaleDateString() : 'N/A') + '</p><p><strong>' + (i.daysOverdue ? 'Days Overdue: ' + i.daysOverdue : 'Days Left: ' + (i.daysUntilDeadline || 'N/A')) + '</strong></p></div>').join('')
                                    : '<div class="dryrun-empty">✅ No pending notifications</div>';
                            } else { document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty">❌ ' + (data.error || 'Error') + '</div>'; }
                        } catch (e) { document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty">❌ ' + e.message + '</div>'; }
                    }
                    
                    function closeModal(id) { document.getElementById(id).style.display = 'none'; }
                    
                    function showToast(msg, type) {
                        const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
                        document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
                    }
                    
                    ['previewModal', 'dryrunModal'].forEach(id => {
                        document.getElementById(id).addEventListener('click', function(e) { if (e.target === this) closeModal(id); });
                    });
                </script>
            </body>
            </html>
        \`);
    } catch (err) {
        console.error('Error loading job monitor:', err);
        res.status(500).send('Error loading Job Monitor: ' + err.message);
    }
});

module.exports = router;`;

// Combine and write
const newContent = beforeJobMonitor + newJobMonitorCode;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Job Monitor page updated successfully!');
console.log('Original length:', content.length);
console.log('New length:', newContent.length);
