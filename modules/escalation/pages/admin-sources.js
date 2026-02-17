/**
 * Admin Sources Page
 * Manage escalation sources (apps with action plans)
 */

module.exports = async (req, res) => {
    if (!req.currentUser?.roleNames?.includes('System Administrator')) {
        return res.status(403).send('Access denied. System Administrator role required.');
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Escalation Sources - ${process.env.APP_NAME}</title>
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
                .header-nav a.active { background: rgba(255,255,255,0.3); }
                
                .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                
                .card {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .card-header {
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .card-header h2 { color: #1f2937; }
                .card-body { padding: 20px; }
                
                .btn {
                    padding: 10px 20px;
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
                .btn-sm { padding: 6px 12px; font-size: 12px; }
                
                .table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .table th, .table td {
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }
                .table th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #6b7280;
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .table tr:hover { background: #f9fafb; }
                
                .badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge-active { background: #d1fae5; color: #059669; }
                .badge-inactive { background: #fee2e2; color: #dc2626; }
                
                .source-icon {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 18px;
                }
                .color-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    display: inline-block;
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
                    max-width: 700px;
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
                .form-group input, .form-group select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                .form-row-3 {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 15px;
                }
                .help-text {
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 4px;
                }
                .section-title {
                    font-weight: 600;
                    color: #374151;
                    margin: 20px 0 10px 0;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .empty-state {
                    padding: 40px;
                    text-align: center;
                    color: #6b7280;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>⚙️ Escalation Sources</h1>
                <div class="header-nav">
                    <a href="/escalation">Dashboard</a>
                    <a href="/escalation/admin/sources" class="active">Sources</a>
                    <a href="/escalation/admin/templates">Email Templates</a>
                    <a href="/escalation/admin/contacts">Contacts</a>
                    <a href="/dashboard">← Back to Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="card">
                    <div class="card-header">
                        <h2>📂 Escalation Sources</h2>
                        <button class="btn btn-primary" onclick="openModal()">+ Add Source</button>
                    </div>
                    <div class="card-body">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th>Module</th>
                                    <th>Action Items Table</th>
                                    <th>Form Code</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="sources-table">
                                <tr><td colspan="6" class="empty-state">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Add/Edit Modal -->
            <div class="modal" id="source-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Add Escalation Source</h3>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="source-id">
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Source Code *</label>
                                <input type="text" id="source-code" placeholder="e.g., OHS_INSPECTION">
                                <div class="help-text">Unique identifier (no spaces)</div>
                            </div>
                            <div class="form-group">
                                <label>Source Name *</label>
                                <input type="text" id="source-name" placeholder="e.g., OHS Inspection">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Module Name *</label>
                                <input type="text" id="module-name" placeholder="e.g., ohs-inspection">
                                <div class="help-text">URL path segment</div>
                            </div>
                            <div class="form-group">
                                <label>Form Code</label>
                                <input type="text" id="form-code" placeholder="e.g., OHS_INSPECTION">
                                <div class="help-text">For permission checking</div>
                            </div>
                        </div>
                        
                        <div class="section-title">📊 Table Configuration</div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Action Items Table *</label>
                                <input type="text" id="action-items-table" placeholder="e.g., OHS_InspectionActionItems">
                            </div>
                            <div class="form-group">
                                <label>Inspection Table</label>
                                <input type="text" id="inspection-table" placeholder="e.g., OHS_Inspections">
                            </div>
                        </div>
                        
                        <div class="section-title">📋 Column Mappings</div>
                        
                        <div class="form-row-3">
                            <div class="form-group">
                                <label>ID Column</label>
                                <input type="text" id="id-column" value="Id">
                            </div>
                            <div class="form-group">
                                <label>Inspection ID Column</label>
                                <input type="text" id="inspection-id-column" value="InspectionId">
                            </div>
                            <div class="form-group">
                                <label>Store Name Column</label>
                                <input type="text" id="store-name-column" value="StoreName">
                            </div>
                        </div>
                        
                        <div class="form-row-3">
                            <div class="form-group">
                                <label>Department Column</label>
                                <input type="text" id="department-column" value="Department">
                            </div>
                            <div class="form-group">
                                <label>Deadline Column</label>
                                <input type="text" id="deadline-column" value="Deadline">
                            </div>
                            <div class="form-group">
                                <label>Responsible Column</label>
                                <input type="text" id="responsible-column" value="Responsible">
                            </div>
                        </div>
                        
                        <div class="form-row-3">
                            <div class="form-group">
                                <label>Status Column</label>
                                <input type="text" id="status-column" value="Status">
                            </div>
                            <div class="form-group">
                                <label>Priority Column</label>
                                <input type="text" id="priority-column" value="Priority">
                            </div>
                            <div class="form-group">
                                <label>Finding Column</label>
                                <input type="text" id="finding-column" value="Finding">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Action Column</label>
                            <input type="text" id="action-column" value="Action">
                        </div>
                        
                        <div class="section-title">🎨 Display Settings</div>
                        
                        <div class="form-row-3">
                            <div class="form-group">
                                <label>Icon Emoji</label>
                                <input type="text" id="icon-emoji" value="📋">
                            </div>
                            <div class="form-group">
                                <label>Color (Hex)</label>
                                <input type="color" id="color-hex" value="#0078d4">
                            </div>
                            <div class="form-group">
                                <label>Sort Order</label>
                                <input type="number" id="sort-order" value="0">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="is-active" checked> Active
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn" onclick="closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveSource()">Save</button>
                    </div>
                </div>
            </div>
            
            <script>
                let sources = [];
                
                async function loadSources() {
                    try {
                        const res = await fetch('/escalation/api/admin/sources');
                        const data = await res.json();
                        if (data.success) {
                            sources = data.data;
                            renderSources();
                        }
                    } catch (err) {
                        console.error('Error:', err);
                    }
                }
                
                function renderSources() {
                    const tbody = document.getElementById('sources-table');
                    
                    if (sources.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No sources configured. Click "Add Source" to add one.</td></tr>';
                        return;
                    }
                    
                    tbody.innerHTML = sources.map(s => \`
                        <tr>
                            <td>
                                <div class="source-icon">
                                    <span>\${s.IconEmoji}</span>
                                    <span class="color-dot" style="background: \${s.ColorHex}"></span>
                                    <strong>\${s.SourceName}</strong>
                                </div>
                                <div style="font-size: 12px; color: #6b7280;">\${s.SourceCode}</div>
                            </td>
                            <td>\${s.ModuleName}</td>
                            <td><code style="font-size: 12px; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">\${s.ActionItemsTable}</code></td>
                            <td>\${s.FormCode || '-'}</td>
                            <td><span class="badge \${s.IsActive ? 'badge-active' : 'badge-inactive'}">\${s.IsActive ? 'Active' : 'Inactive'}</span></td>
                            <td>
                                <button class="btn btn-sm" onclick="editSource(\${s.Id})">Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteSource(\${s.Id})">Delete</button>
                            </td>
                        </tr>
                    \`).join('');
                }
                
                function openModal(source = null) {
                    document.getElementById('modal-title').textContent = source ? 'Edit Escalation Source' : 'Add Escalation Source';
                    document.getElementById('source-id').value = source?.Id || '';
                    document.getElementById('source-code').value = source?.SourceCode || '';
                    document.getElementById('source-name').value = source?.SourceName || '';
                    document.getElementById('module-name').value = source?.ModuleName || '';
                    document.getElementById('form-code').value = source?.FormCode || '';
                    document.getElementById('action-items-table').value = source?.ActionItemsTable || '';
                    document.getElementById('inspection-table').value = source?.InspectionTable || '';
                    document.getElementById('id-column').value = source?.IdColumn || 'Id';
                    document.getElementById('inspection-id-column').value = source?.InspectionIdColumn || 'InspectionId';
                    document.getElementById('store-name-column').value = source?.StoreNameColumn || 'StoreName';
                    document.getElementById('department-column').value = source?.DepartmentColumn || 'Department';
                    document.getElementById('deadline-column').value = source?.DeadlineColumn || 'Deadline';
                    document.getElementById('responsible-column').value = source?.ResponsibleColumn || 'Responsible';
                    document.getElementById('status-column').value = source?.StatusColumn || 'Status';
                    document.getElementById('priority-column').value = source?.PriorityColumn || 'Priority';
                    document.getElementById('finding-column').value = source?.FindingColumn || 'Finding';
                    document.getElementById('action-column').value = source?.ActionColumn || 'Action';
                    document.getElementById('icon-emoji').value = source?.IconEmoji || '📋';
                    document.getElementById('color-hex').value = source?.ColorHex || '#0078d4';
                    document.getElementById('sort-order').value = source?.SortOrder || 0;
                    document.getElementById('is-active').checked = source?.IsActive !== false;
                    document.getElementById('source-modal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('source-modal').classList.remove('active');
                }
                
                function editSource(id) {
                    const source = sources.find(s => s.Id === id);
                    if (source) openModal(source);
                }
                
                async function saveSource() {
                    const data = {
                        id: document.getElementById('source-id').value || null,
                        sourceCode: document.getElementById('source-code').value,
                        sourceName: document.getElementById('source-name').value,
                        moduleName: document.getElementById('module-name').value,
                        formCode: document.getElementById('form-code').value,
                        actionItemsTable: document.getElementById('action-items-table').value,
                        inspectionTable: document.getElementById('inspection-table').value,
                        idColumn: document.getElementById('id-column').value,
                        inspectionIdColumn: document.getElementById('inspection-id-column').value,
                        storeNameColumn: document.getElementById('store-name-column').value,
                        departmentColumn: document.getElementById('department-column').value,
                        deadlineColumn: document.getElementById('deadline-column').value,
                        responsibleColumn: document.getElementById('responsible-column').value,
                        statusColumn: document.getElementById('status-column').value,
                        priorityColumn: document.getElementById('priority-column').value,
                        findingColumn: document.getElementById('finding-column').value,
                        actionColumn: document.getElementById('action-column').value,
                        iconEmoji: document.getElementById('icon-emoji').value,
                        colorHex: document.getElementById('color-hex').value,
                        sortOrder: parseInt(document.getElementById('sort-order').value) || 0,
                        isActive: document.getElementById('is-active').checked
                    };
                    
                    if (!data.sourceCode || !data.sourceName || !data.moduleName || !data.actionItemsTable) {
                        alert('Please fill in all required fields');
                        return;
                    }
                    
                    try {
                        const res = await fetch('/escalation/api/admin/sources', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();
                        if (result.success) {
                            closeModal();
                            loadSources();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        alert('Error saving source');
                    }
                }
                
                async function deleteSource(id) {
                    if (!confirm('Are you sure you want to delete this source?')) return;
                    
                    try {
                        const res = await fetch('/escalation/api/admin/sources/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) {
                            loadSources();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        alert('Error deleting source');
                    }
                }
                
                loadSources();
            </script>
        </body>
        </html>
    `);
};
