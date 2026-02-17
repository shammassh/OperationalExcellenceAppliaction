/**
 * Admin Sources Page - SIMPLIFIED
 * Just select a table and map columns
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
                }
                .header-nav a:hover { background: rgba(255,255,255,0.2); }
                
                .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
                
                .card {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
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
                }
                .btn-primary { background: #7c3aed; color: white; }
                .btn-primary:hover { background: #6d28d9; }
                .btn-danger { background: #dc2626; color: white; }
                .btn-success { background: #059669; color: white; }
                .btn-sm { padding: 6px 12px; font-size: 12px; }
                
                /* Sources List */
                .source-card {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .source-card:hover { background: #f9fafb; }
                .source-info { display: flex; align-items: center; gap: 15px; }
                .source-icon { font-size: 24px; }
                .source-name { font-weight: 600; color: #1f2937; }
                .source-table { font-size: 12px; color: #6b7280; font-family: monospace; }
                .source-actions { display: flex; gap: 8px; }
                
                .badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge-active { background: #d1fae5; color: #059669; }
                .badge-inactive { background: #fee2e2; color: #dc2626; }
                
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
                .modal-body { padding: 20px; }
                .modal-footer {
                    padding: 15px 20px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #6b7280;
                }
                
                /* Table Selector */
                .table-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    max-height: 300px;
                    overflow-y: auto;
                    padding: 10px;
                    background: #f9fafb;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .table-item {
                    background: white;
                    padding: 10px 15px;
                    border-radius: 6px;
                    border: 1px solid #e5e7eb;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                }
                .table-item:hover { border-color: #7c3aed; background: #f5f3ff; }
                .table-item.selected { border-color: #7c3aed; background: #ede9fe; }
                
                /* Form */
                .form-group {
                    margin-bottom: 15px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                    color: #374151;
                }
                .form-group select {
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
                
                .section-title {
                    font-weight: 600;
                    color: #4b5563;
                    margin: 20px 0 15px 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .search-box {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    margin-bottom: 10px;
                }
                
                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #6b7280;
                }
                
                .mapping-info {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .mapping-info h4 { color: #166534; margin-bottom: 8px; }
                .mapping-info p { color: #166534; font-size: 13px; margin: 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>⚙️ Escalation Sources</h1>
                <div class="header-nav">
                    <a href="/escalation">Dashboard</a>
                    <a href="/escalation/admin/templates">Email Templates</a>
                    <a href="/escalation/admin/contacts">Contacts</a>
                </div>
            </div>
            
            <div class="container">
                <div class="card">
                    <div class="card-header">
                        <h2>📊 Active Sources</h2>
                        <button class="btn btn-primary" onclick="showAddModal()">+ Add Source</button>
                    </div>
                    <div class="card-body">
                        <div id="sources-list">
                            <div class="empty-state">Loading...</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Add/Edit Modal -->
            <div class="modal" id="source-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Add Source</h3>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="source-id">
                        
                        <!-- Step 1: Select Table -->
                        <div id="step-table">
                            <div class="section-title">📋 Step 1: Select Table</div>
                            <input type="text" class="search-box" id="table-search" placeholder="🔍 Search tables..." oninput="filterTables()">
                            <div class="table-grid" id="tables-grid">
                                <div class="empty-state">Loading tables...</div>
                            </div>
                            <div style="margin-top: 10px;">
                                <strong>Selected:</strong> <span id="selected-table-name" style="color: #7c3aed;">None</span>
                            </div>
                        </div>
                        
                        <!-- Step 2: Map Columns -->
                        <div id="step-columns" style="display: none;">
                            <div class="mapping-info">
                                <h4>📌 Column Mapping</h4>
                                <p>Select which columns from your table map to each field. Only "Description/Finding" is required.</p>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Description/Finding *</label>
                                    <select id="col-finding"></select>
                                </div>
                                <div class="form-group">
                                    <label>Status</label>
                                    <select id="col-status"></select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Deadline</label>
                                    <select id="col-deadline"></select>
                                </div>
                                <div class="form-group">
                                    <label>Responsible Person</label>
                                    <select id="col-responsible"></select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Department</label>
                                    <select id="col-department"></select>
                                </div>
                                <div class="form-group">
                                    <label>Priority</label>
                                    <select id="col-priority"></select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Store/Location Name</label>
                                    <select id="col-store"></select>
                                </div>
                                <div class="form-group">
                                    <label>Date Column</label>
                                    <select id="col-date"></select>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Action/Response</label>
                                <select id="col-action"></select>
                            </div>
                            
                            <div class="section-title">🎨 Display Options</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Icon</label>
                                    <select id="source-icon">
                                        <option value="📋">📋 Checklist</option>
                                        <option value="🔍">🔍 Inspection</option>
                                        <option value="⚠️">⚠️ Warning</option>
                                        <option value="🛡️">🛡️ Security</option>
                                        <option value="🏥">🏥 Safety</option>
                                        <option value="📝">📝 Report</option>
                                        <option value="💬">💬 Feedback</option>
                                        <option value="📊">📊 Data</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Color</label>
                                    <input type="color" id="source-color" value="#7c3aed" style="width: 100%; height: 38px; border: 1px solid #d1d5db; border-radius: 6px;">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn" onclick="closeModal()">Cancel</button>
                        <button class="btn btn-primary" id="btn-next" onclick="nextStep()">Next →</button>
                        <button class="btn btn-success" id="btn-save" onclick="saveSource()" style="display: none;">✓ Save Source</button>
                    </div>
                </div>
            </div>
            
            <script>
                let sources = [];
                let allTables = [];
                let selectedTable = null;
                let currentColumns = [];
                let editingSource = null;
                
                // Load sources on page load
                document.addEventListener('DOMContentLoaded', loadSources);
                
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
                    const container = document.getElementById('sources-list');
                    
                    if (sources.length === 0) {
                        container.innerHTML = '<div class="empty-state">No sources configured. Click "Add Source" to add your first table.</div>';
                        return;
                    }
                    
                    container.innerHTML = sources.map(s => \`
                        <div class="source-card">
                            <div class="source-info">
                                <span class="source-icon">\${s.IconEmoji || '📋'}</span>
                                <div>
                                    <div class="source-name">\${s.SourceName}</div>
                                    <div class="source-table">\${s.ActionItemsTable}</div>
                                </div>
                                <span class="badge \${s.IsActive ? 'badge-active' : 'badge-inactive'}">\${s.IsActive ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div class="source-actions">
                                <button class="btn btn-sm" onclick="testSource(\${s.Id})">🧪 Test</button>
                                <button class="btn btn-sm btn-primary" onclick="editSource(\${s.Id})">Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteSource(\${s.Id})">Delete</button>
                            </div>
                        </div>
                    \`).join('');
                }
                
                async function showAddModal() {
                    editingSource = null;
                    selectedTable = null;
                    currentColumns = [];
                    
                    document.getElementById('modal-title').textContent = 'Add Source';
                    document.getElementById('source-id').value = '';
                    document.getElementById('selected-table-name').textContent = 'None';
                    document.getElementById('step-table').style.display = 'block';
                    document.getElementById('step-columns').style.display = 'none';
                    document.getElementById('btn-next').style.display = 'inline-block';
                    document.getElementById('btn-save').style.display = 'none';
                    
                    // Load tables
                    await loadTables();
                    
                    document.getElementById('source-modal').classList.add('active');
                }
                
                async function loadTables() {
                    const grid = document.getElementById('tables-grid');
                    grid.innerHTML = '<div class="empty-state">Loading...</div>';
                    
                    try {
                        const res = await fetch('/escalation/api/admin/list-tables');
                        const data = await res.json();
                        
                        if (data.success) {
                            allTables = data.tables;
                            renderTables(allTables);
                        }
                    } catch (err) {
                        grid.innerHTML = '<div class="empty-state">Error loading tables</div>';
                    }
                }
                
                function renderTables(tables) {
                    const grid = document.getElementById('tables-grid');
                    grid.innerHTML = tables.map(t => \`
                        <div class="table-item \${selectedTable === t.TABLE_NAME ? 'selected' : ''}" 
                             onclick="selectTable('\${t.TABLE_NAME}')">
                            \${t.TABLE_NAME}
                        </div>
                    \`).join('');
                }
                
                function filterTables() {
                    const search = document.getElementById('table-search').value.toLowerCase();
                    const filtered = allTables.filter(t => t.TABLE_NAME.toLowerCase().includes(search));
                    renderTables(filtered);
                }
                
                async function selectTable(tableName) {
                    selectedTable = tableName;
                    document.getElementById('selected-table-name').textContent = tableName;
                    
                    // Refresh table list to show selection
                    renderTables(allTables.filter(t => {
                        const search = document.getElementById('table-search').value.toLowerCase();
                        return t.TABLE_NAME.toLowerCase().includes(search);
                    }));
                    
                    // Load columns for this table
                    try {
                        const res = await fetch('/escalation/api/admin/table-columns?table=' + encodeURIComponent(tableName));
                        const data = await res.json();
                        
                        if (data.success) {
                            currentColumns = data.columns;
                        }
                    } catch (err) {
                        console.error('Error loading columns:', err);
                    }
                }
                
                function nextStep() {
                    if (!selectedTable) {
                        alert('Please select a table first');
                        return;
                    }
                    
                    if (currentColumns.length === 0) {
                        alert('Could not load columns for this table');
                        return;
                    }
                    
                    // Hide step 1, show step 2
                    document.getElementById('step-table').style.display = 'none';
                    document.getElementById('step-columns').style.display = 'block';
                    document.getElementById('btn-next').style.display = 'none';
                    document.getElementById('btn-save').style.display = 'inline-block';
                    
                    // Populate column dropdowns
                    populateColumnDropdowns();
                    
                    // Auto-map columns
                    autoMapColumns();
                }
                
                function populateColumnDropdowns() {
                    const dropdowns = {
                        'col-finding': { required: true, label: 'Select column...' },
                        'col-status': { required: false, label: '-- None --' },
                        'col-deadline': { required: false, label: '-- None --' },
                        'col-responsible': { required: false, label: '-- None --' },
                        'col-department': { required: false, label: '-- None --' },
                        'col-priority': { required: false, label: '-- None --' },
                        'col-store': { required: false, label: '-- None --' },
                        'col-date': { required: false, label: '-- None --' },
                        'col-action': { required: false, label: '-- None --' }
                    };
                    
                    for (const [id, config] of Object.entries(dropdowns)) {
                        const select = document.getElementById(id);
                        let options = '<option value="">' + config.label + '</option>';
                        
                        currentColumns.forEach(col => {
                            options += '<option value="' + col.COLUMN_NAME + '">' + col.COLUMN_NAME + ' (' + col.DATA_TYPE + ')</option>';
                        });
                        
                        select.innerHTML = options;
                    }
                }
                
                function autoMapColumns() {
                    const colNames = currentColumns.map(c => c.COLUMN_NAME.toLowerCase());
                    const colNamesOriginal = currentColumns.map(c => c.COLUMN_NAME);
                    
                    const mappings = {
                        'col-finding': ['finding', 'findings', 'description', 'issue', 'comment', 'observation', 'details', 'notes', 'remarks', 'text', 'content', 'title', 'subject', 'message', 'question'],
                        'col-status': ['status', 'actionstatus', 'itemstatus', 'state'],
                        'col-deadline': ['deadline', 'duedate', 'due_date', 'targetdate', 'expirydate', 'expiry'],
                        'col-responsible': ['responsible', 'responsibleperson', 'assignedto', 'assigned_to', 'owner'],
                        'col-department': ['department', 'dept', 'transferto', 'section'],
                        'col-priority': ['priority', 'severity', 'urgency'],
                        'col-store': ['storename', 'store', 'location', 'branch', 'site'],
                        'col-date': ['createdat', 'created_at', 'createddate', 'date', 'dateadded', 'submitteddate'],
                        'col-action': ['action', 'correctiveaction', 'actiontaken', 'resolution', 'response']
                    };
                    
                    for (const [selectId, possibleNames] of Object.entries(mappings)) {
                        const select = document.getElementById(selectId);
                        
                        for (const name of possibleNames) {
                            const idx = colNames.indexOf(name);
                            if (idx !== -1) {
                                select.value = colNamesOriginal[idx];
                                select.style.background = '#d1fae5';
                                setTimeout(() => { select.style.background = ''; }, 1500);
                                break;
                            }
                        }
                    }
                }
                
                async function editSource(id) {
                    editingSource = sources.find(s => s.Id === id);
                    if (!editingSource) return;
                    
                    selectedTable = editingSource.ActionItemsTable;
                    
                    document.getElementById('modal-title').textContent = 'Edit Source';
                    document.getElementById('source-id').value = id;
                    document.getElementById('selected-table-name').textContent = selectedTable;
                    
                    // Load columns
                    try {
                        const res = await fetch('/escalation/api/admin/table-columns?table=' + encodeURIComponent(selectedTable));
                        const data = await res.json();
                        if (data.success) {
                            currentColumns = data.columns;
                        }
                    } catch (err) {
                        console.error('Error:', err);
                    }
                    
                    // Go directly to step 2 (columns)
                    document.getElementById('step-table').style.display = 'none';
                    document.getElementById('step-columns').style.display = 'block';
                    document.getElementById('btn-next').style.display = 'none';
                    document.getElementById('btn-save').style.display = 'inline-block';
                    
                    // Populate dropdowns
                    populateColumnDropdowns();
                    
                    // Set saved values
                    document.getElementById('col-finding').value = editingSource.FindingColumn || '';
                    document.getElementById('col-status').value = editingSource.StatusColumn || '';
                    document.getElementById('col-deadline').value = editingSource.DeadlineColumn || '';
                    document.getElementById('col-responsible').value = editingSource.ResponsibleColumn || '';
                    document.getElementById('col-department').value = editingSource.DepartmentColumn || '';
                    document.getElementById('col-priority').value = editingSource.PriorityColumn || '';
                    document.getElementById('col-store').value = editingSource.StoreNameColumn || '';
                    document.getElementById('col-date').value = editingSource.DateColumn || '';
                    document.getElementById('col-action').value = editingSource.ActionColumn || '';
                    document.getElementById('source-icon').value = editingSource.IconEmoji || '📋';
                    document.getElementById('source-color').value = editingSource.ColorHex || '#7c3aed';
                    
                    document.getElementById('source-modal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('source-modal').classList.remove('active');
                }
                
                async function saveSource() {
                    const findingCol = document.getElementById('col-finding').value;
                    if (!findingCol) {
                        alert('Please select a Description/Finding column');
                        return;
                    }
                    
                    // Auto-generate source code and name from table name
                    const sourceCode = selectedTable.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
                    const sourceName = selectedTable.replace(/([a-z])([A-Z])/g, '$1 $2');
                    
                    const data = {
                        id: document.getElementById('source-id').value || null,
                        sourceCode: sourceCode,
                        sourceName: sourceName,
                        moduleName: 'operational-excellence',
                        formCode: sourceCode,
                        actionItemsTable: selectedTable,
                        inspectionTable: '',
                        idColumn: 'Id',
                        inspectionIdColumn: '',
                        storeNameColumn: document.getElementById('col-store').value,
                        departmentColumn: document.getElementById('col-department').value,
                        deadlineColumn: document.getElementById('col-deadline').value,
                        responsibleColumn: document.getElementById('col-responsible').value,
                        statusColumn: document.getElementById('col-status').value,
                        priorityColumn: document.getElementById('col-priority').value,
                        findingColumn: findingCol,
                        actionColumn: document.getElementById('col-action').value,
                        dateColumn: document.getElementById('col-date').value,
                        iconEmoji: document.getElementById('source-icon').value,
                        colorHex: document.getElementById('source-color').value,
                        sortOrder: 0,
                        isActive: true,
                        displayColumns: '[]'
                    };
                    
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
                        alert('Error saving source');
                    }
                }
                
                async function deleteSource(id) {
                    if (!confirm('Delete this source?')) return;
                    
                    try {
                        const res = await fetch('/escalation/api/admin/sources/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) {
                            loadSources();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        alert('Error deleting source');
                    }
                }
                
                async function testSource(id) {
                    try {
                        const res = await fetch('/escalation/api/admin/test-source/' + id);
                        const data = await res.json();
                        
                        if (data.success) {
                            alert('✅ Success!\\n\\nQuery: ' + data.query + '\\n\\nFound ' + data.totalItems + ' total items.\\n\\nFirst item: ' + JSON.stringify(data.items[0], null, 2).substring(0, 500));
                        } else {
                            alert('❌ Error: ' + data.error + '\\n\\nQuery: ' + data.query);
                        }
                    } catch (err) {
                        alert('Error testing source');
                    }
                }
            </script>
        </body>
        </html>
    `);
};
