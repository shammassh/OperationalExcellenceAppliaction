/**
 * Escalation Dashboard Page
 * Action plans view similar to OE/OHS Inspection Action Plans
 */

module.exports = async (req, res) => {
    const isAdmin = req.currentUser?.roleNames?.includes('System Administrator');
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Escalation Action Plans - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: #f5f5f5;
                    color: #333;
                    line-height: 1.6;
                }

                .action-plan-container {
                    max-width: 1800px;
                    margin: 20px auto;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    overflow: hidden;
                }

                /* Header Styles */
                .report-header {
                    background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
                    color: white;
                    padding: 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 20px;
                }

                .report-header h1 {
                    font-size: 28px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .header-actions {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .header-actions button, .header-actions a {
                    padding: 10px 15px;
                    border: none;
                    border-radius: 5px;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    text-decoration: none;
                }

                .header-actions button:hover, .header-actions a:hover {
                    background: rgba(255,255,255,0.3);
                }

                .back-btn {
                    background: rgba(255,255,255,0.1) !important;
                }

                /* Summary Section */
                .summary-section {
                    padding: 25px;
                    background: #f8f9fa;
                    border-bottom: 1px solid #e9ecef;
                }

                .summary-section h2 {
                    color: #2c3e50;
                    margin-bottom: 15px;
                    font-size: 20px;
                }

                .summary-stats {
                    display: flex;
                    gap: 20px;
                    flex-wrap: wrap;
                }

                .stat-item {
                    background: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    text-align: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    min-width: 120px;
                }

                .stat-number {
                    display: block;
                    font-size: 28px;
                    font-weight: bold;
                    color: #2c3e50;
                }

                .stat-label {
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }

                .stat-item.overdue .stat-number { color: #dc2626; }
                .stat-item.high .stat-number { color: #f59e0b; }
                .stat-item.medium .stat-number { color: #3b82f6; }
                .stat-item.escalated .stat-number { color: #7c3aed; }
                .stat-item.total .stat-number { color: #10b981; }

                /* Filter Section */
                .filter-section {
                    padding: 20px 25px;
                    background: #fff;
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }

                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .filter-group label {
                    font-size: 12px;
                    color: #6b7280;
                    font-weight: 600;
                }

                .filter-group select {
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    min-width: 150px;
                }

                .filter-btn {
                    padding: 8px 16px;
                    background: #7c3aed;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }

                .filter-btn:hover { background: #6d28d9; }

                .filter-btn.secondary {
                    background: #e5e7eb;
                    color: #374151;
                }

                .filter-btn.secondary:hover { background: #d1d5db; }

                /* Table Styles */
                .table-container {
                    overflow-x: auto;
                    padding: 20px;
                }

                .action-plan-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }

                .action-plan-table th {
                    background: #7c3aed;
                    color: white;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 600;
                    white-space: nowrap;
                    font-size: 12px;
                }

                .action-plan-table td {
                    padding: 10px 8px;
                    border-bottom: 1px solid #e9ecef;
                    vertical-align: top;
                    font-size: 13px;
                }

                .action-plan-table tr:hover {
                    background: #f8f9fa;
                }

                .action-plan-table tr.overdue {
                    background: #fef2f2;
                }

                .source-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .source-ohs { background: #fee2e2; color: #991b1b; }
                .source-oe { background: #dbeafe; color: #1e40af; }

                .priority-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .priority-high { background: #fee2e2; color: #991b1b; }
                .priority-medium { background: #fef3c7; color: #92400e; }
                .priority-low { background: #dbeafe; color: #1e40af; }
                .priority-critical { background: #dc2626; color: white; }

                .status-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .status-open { background: #fef3c7; color: #92400e; }
                .status-in-progress { background: #dbeafe; color: #1e40af; }
                .status-closed { background: #d1fae5; color: #065f46; }
                .status-escalated { background: #ede9fe; color: #7c3aed; }

                .overdue-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 600;
                    background: #dc2626;
                    color: white;
                    margin-left: 6px;
                }

                /* Document grouping styles */
                .doc-group-header {
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    font-weight: 600;
                }

                .doc-group-header td {
                    padding: 12px 8px !important;
                    border-bottom: 2px solid #7c3aed !important;
                }

                .doc-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .doc-number {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1f2937;
                }

                .doc-store {
                    font-size: 13px;
                    color: #6b7280;
                }

                .doc-date {
                    font-size: 12px;
                    color: #9ca3af;
                }

                .items-count {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: #7c3aed;
                    color: white;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 3px 10px;
                    border-radius: 12px;
                    margin-left: 10px;
                }

                .group-item-row {
                    background: #fefefe;
                }

                .group-item-row:hover {
                    background: #f5f3ff !important;
                }

                .group-item-row td:first-child {
                    padding-left: 25px !important;
                }

                .finding-col {
                    max-width: 250px;
                    min-width: 200px;
                }

                .finding-text {
                    color: #374151;
                    font-size: 12px;
                    line-height: 1.4;
                }

                .action-col {
                    max-width: 200px;
                    min-width: 150px;
                }

                .input-field {
                    width: 100%;
                    padding: 6px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 11px;
                    font-family: inherit;
                }

                .input-field:focus {
                    outline: none;
                    border-color: #7c3aed;
                    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
                }

                textarea.input-field {
                    resize: vertical;
                    min-height: 50px;
                }

                .action-btns {
                    display: flex;
                    gap: 5px;
                }

                .btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                }

                .btn-primary { background: #7c3aed; color: white; }
                .btn-primary:hover { background: #6d28d9; }
                .btn-danger { background: #dc2626; color: white; }
                .btn-danger:hover { background: #b91c1c; }
                .btn-success { background: #10b981; color: white; }
                .btn-success:hover { background: #059669; }

                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6b7280;
                }

                .empty-state .icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }

                .empty-state p {
                    font-size: 16px;
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: none;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }

                .modal-overlay.show { display: flex; }

                .modal {
                    background: white;
                    padding: 25px;
                    border-radius: 12px;
                    width: 500px;
                    max-width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 20px;
                    color: #1f2937;
                }

                .form-group { margin-bottom: 15px; }
                .form-label { display: block; font-size: 13px; color: #6b7280; margin-bottom: 5px; font-weight: 500; }
                .form-input, .form-select, .form-textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .form-textarea { resize: vertical; min-height: 80px; }

                .modal-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }

                .toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 24px;
                    background: #10b981;
                    color: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    transform: translateY(100px);
                    opacity: 0;
                    transition: all 0.3s;
                }

                .toast.show { transform: translateY(0); opacity: 1; }
                .toast.error { background: #dc2626; }

                ${isAdmin ? `
                .admin-link {
                    margin-left: auto;
                }
                ` : ''}
            </style>
        </head>
        <body>
            <div class="action-plan-container">
                <!-- Header -->
                <div class="report-header">
                    <h1>📋 Escalation Action Plans</h1>
                    <div class="header-actions">
                        <a href="/" class="back-btn">← Dashboard</a>
                        <button onclick="exportToExcel()">📥 Export Excel</button>
                        <button onclick="loadActionItems()">🔄 Refresh</button>
                        ${isAdmin ? '<a href="/escalation/admin/sources" class="admin-link">⚙️ Admin Settings</a>' : ''}
                    </div>
                </div>

                <!-- Summary Stats -->
                <div class="summary-section">
                    <h2>📊 Summary</h2>
                    <div class="summary-stats">
                        <div class="stat-item total">
                            <span class="stat-number" id="statTotal">0</span>
                            <div class="stat-label">Total Items</div>
                        </div>
                        <div class="stat-item overdue">
                            <span class="stat-number" id="statOverdue">0</span>
                            <div class="stat-label">🔴 Overdue</div>
                        </div>
                        <div class="stat-item high">
                            <span class="stat-number" id="statHigh">0</span>
                            <div class="stat-label">🟠 High Priority</div>
                        </div>
                        <div class="stat-item medium">
                            <span class="stat-number" id="statMedium">0</span>
                            <div class="stat-label">🟡 Medium Priority</div>
                        </div>
                        <div class="stat-item escalated">
                            <span class="stat-number" id="statEscalated">0</span>
                            <div class="stat-label">⚡ Escalated</div>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="filter-section">
                    <div class="filter-group">
                        <label>Source</label>
                        <select id="filterSource" onchange="loadActionItems()">
                            <option value="">All Sources</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Priority</label>
                        <select id="filterPriority" onchange="loadActionItems()">
                            <option value="">All Priorities</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Status</label>
                        <select id="filterStatus" onchange="loadActionItems()">
                            <option value="">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Overdue">Overdue</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Department</label>
                        <select id="filterDepartment" onchange="loadActionItems()">
                            <option value="">All Departments</option>
                        </select>
                    </div>
                    <button class="filter-btn secondary" onclick="clearFilters()">Clear Filters</button>
                </div>

                <!-- Table -->
                <div class="table-container">
                    <table class="action-plan-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;">#</th>
                                <th colspan="2">Section</th>
                                <th>Finding</th>
                                <th>Corrective Action</th>
                                <th>Responsible</th>
                                <th>Department</th>
                                <th>Priority</th>
                                <th>Deadline</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="actionItemsBody">
                            <tr>
                                <td colspan="11" class="empty-state">
                                    <div class="icon">📋</div>
                                    <p>Loading action items...</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Edit Modal -->
            <div class="modal-overlay" id="editModal">
                <div class="modal">
                    <h3 class="modal-title">✏️ Update Action Item</h3>
                    <input type="hidden" id="editItemId">
                    <input type="hidden" id="editSourceCode">

                    <div class="form-group">
                        <label class="form-label">Finding</label>
                        <textarea class="form-textarea" id="editFinding" readonly style="background: #f3f4f6;"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Corrective Action</label>
                        <textarea class="form-textarea" id="editAction"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Responsible Person</label>
                        <input type="text" class="form-input" id="editResponsible" placeholder="Person responsible">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select class="form-select" id="editPriority">
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-select" id="editStatus">
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Deadline</label>
                        <input type="date" class="form-input" id="editDeadline">
                    </div>

                    <div class="modal-actions">
                        <button class="btn" style="background: #e5e7eb; color: #374151;" onclick="closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveActionItem()">💾 Save Changes</button>
                    </div>
                </div>
            </div>

            <div class="toast" id="toast"></div>

            <script>
                let actionItems = [];
                let sources = [];

                // Source icon mapping
                const sourceIcons = {
                    'OHS_INSPECTION': '🛡️',
                    'OE_INSPECTION': '🔍'
                };

                async function loadSources() {
                    try {
                        const response = await fetch('/escalation/api/sources');
                        const result = await response.json();
                        if (result.success) {
                            sources = result.data;
                            const select = document.getElementById('filterSource');
                            sources.forEach(source => {
                                const option = document.createElement('option');
                                option.value = source.SourceCode;
                                option.textContent = (sourceIcons[source.SourceCode] || '📋') + ' ' + source.SourceName;
                                select.appendChild(option);
                            });
                        }
                    } catch (error) {
                        console.error('Error loading sources:', error);
                    }
                }

                async function loadActionItems() {
                    const sourceCode = document.getElementById('filterSource').value;
                    const priority = document.getElementById('filterPriority').value;
                    const status = document.getElementById('filterStatus').value;
                    const department = document.getElementById('filterDepartment').value;

                    const params = new URLSearchParams();
                    if (sourceCode) params.append('sourceCode', sourceCode);
                    if (priority) params.append('priority', priority);
                    if (status) params.append('status', status);
                    if (department) params.append('department', department);

                    try {
                        const response = await fetch('/escalation/api/action-items?' + params);
                        const result = await response.json();

                        if (result.success) {
                            actionItems = result.data || [];
                            renderActionItems();
                            updateStats();
                            updateDepartmentFilter();
                        }
                    } catch (error) {
                        console.error('Error loading action items:', error);
                        showToast('Error loading action items', true);
                    }
                }

                function renderActionItems() {
                    const tbody = document.getElementById('actionItemsBody');

                    if (actionItems.length === 0) {
                        tbody.innerHTML = \`
                            <tr>
                                <td colspan="11" class="empty-state">
                                    <div class="icon">✅</div>
                                    <p>No action items found</p>
                                </td>
                            </tr>
                        \`;
                        return;
                    }

                    // Group items by DocumentNumber
                    const grouped = {};
                    actionItems.forEach(item => {
                        const key = item.DocumentNumber || 'Unknown';
                        if (!grouped[key]) {
                            grouped[key] = {
                                documentNumber: item.DocumentNumber,
                                storeName: item.StoreName,
                                sourceCode: item.SourceCode,
                                inspectionDate: item.InspectionDate,
                                items: []
                            };
                        }
                        grouped[key].items.push(item);
                    });

                    // Render grouped items
                    let html = '';
                    Object.keys(grouped).forEach((docNum, groupIndex) => {
                        const group = grouped[docNum];
                        const sourceIcon = sourceIcons[group.sourceCode] || '📋';
                        const sourceClass = group.sourceCode === 'OHS_INSPECTION' ? 'source-ohs' : 'source-oe';
                        const sourceName = group.sourceCode === 'OHS_INSPECTION' ? 'OHS Inspection' : 'OE Inspection';
                        const inspDate = group.inspectionDate ? new Date(group.inspectionDate).toLocaleDateString() : '';

                        // Group header row
                        html += \`
                            <tr class="doc-group-header">
                                <td colspan="12">
                                    <div class="doc-info">
                                        <span class="source-badge \${sourceClass}">
                                            \${sourceIcon} \${group.sourceCode === 'OHS_INSPECTION' ? 'OHS' : 'OE'}
                                        </span>
                                        <span class="doc-number">📄 \${group.documentNumber || 'N/A'}</span>
                                        <span class="doc-store">🏪 \${group.storeName || '-'}</span>
                                        <span class="doc-date">📅 \${inspDate}</span>
                                        <span class="items-count">\${group.items.length} finding\${group.items.length > 1 ? 's' : ''}</span>
                                    </div>
                                </td>
                            </tr>
                        \`;

                        // Item rows
                        group.items.forEach((item, itemIndex) => {
                            const isOverdue = item.Deadline && new Date(item.Deadline) < new Date() && item.Status !== 'Closed';
                            
                            html += \`
                                <tr class="group-item-row \${isOverdue ? 'overdue' : ''}">
                                    <td>
                                        <span style="color: #9ca3af; font-size: 11px;">#\${itemIndex + 1}</span>
                                    </td>
                                    <td colspan="2">\${item.SectionName || '-'}</td>
                                    <td class="finding-col">
                                        <div class="finding-text">\${item.Finding || '-'}</div>
                                    </td>
                                    <td class="action-col">
                                        <div class="finding-text">\${item.Action || '-'}</div>
                                    </td>
                                    <td>\${item.Responsible || '-'}</td>
                                    <td>\${item.Department || '-'}</td>
                                    <td>
                                        <span class="priority-badge priority-\${(item.Priority || 'medium').toLowerCase()}">
                                            \${item.Priority || 'Medium'}
                                        </span>
                                    </td>
                                    <td>
                                        \${item.Deadline ? new Date(item.Deadline).toLocaleDateString() : '-'}
                                        \${isOverdue ? '<span class="overdue-badge">⏰ OVERDUE</span>' : ''}
                                    </td>
                                    <td>
                                        <span class="status-badge status-\${(item.Status || 'open').toLowerCase().replace(' ', '-')}">
                                            \${item.Status || 'Open'}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="action-btns">
                                            <button class="btn btn-primary" onclick="editItem(\${item.Id}, '\${item.SourceCode}')">✏️</button>
                                        </div>
                                    </td>
                                </tr>
                            \`;
                        });
                    });

                    tbody.innerHTML = html;
                }

                function updateStats() {
                    const total = actionItems.length;
                    const overdue = actionItems.filter(i => i.Deadline && new Date(i.Deadline) < new Date() && i.Status !== 'Closed').length;
                    const high = actionItems.filter(i => i.Priority === 'High').length;
                    const medium = actionItems.filter(i => i.Priority === 'Medium').length;
                    const escalated = actionItems.filter(i => i.IsEscalated).length;

                    document.getElementById('statTotal').textContent = total;
                    document.getElementById('statOverdue').textContent = overdue;
                    document.getElementById('statHigh').textContent = high;
                    document.getElementById('statMedium').textContent = medium;
                    document.getElementById('statEscalated').textContent = escalated;
                }

                function updateDepartmentFilter() {
                    const departments = [...new Set(actionItems.map(i => i.Department).filter(d => d))];
                    const select = document.getElementById('filterDepartment');
                    const currentValue = select.value;
                    
                    // Clear and rebuild
                    select.innerHTML = '<option value="">All Departments</option>';
                    departments.forEach(dept => {
                        const option = document.createElement('option');
                        option.value = dept;
                        option.textContent = dept;
                        if (dept === currentValue) option.selected = true;
                        select.appendChild(option);
                    });
                }

                function clearFilters() {
                    document.getElementById('filterSource').value = '';
                    document.getElementById('filterPriority').value = '';
                    document.getElementById('filterStatus').value = '';
                    document.getElementById('filterDepartment').value = '';
                    loadActionItems();
                }

                function editItem(id, sourceCode) {
                    const item = actionItems.find(i => i.Id === id);
                    if (!item) return;

                    document.getElementById('editItemId').value = id;
                    document.getElementById('editSourceCode').value = sourceCode;
                    document.getElementById('editFinding').value = item.Finding || '';
                    document.getElementById('editAction').value = item.Action || '';
                    document.getElementById('editResponsible').value = item.Responsible || '';
                    document.getElementById('editPriority').value = item.Priority || 'Medium';
                    document.getElementById('editStatus').value = item.Status || 'Open';
                    document.getElementById('editDeadline').value = item.Deadline ? item.Deadline.split('T')[0] : '';

                    document.getElementById('editModal').classList.add('show');
                }

                function closeModal() {
                    document.getElementById('editModal').classList.remove('show');
                }

                async function saveActionItem() {
                    const id = document.getElementById('editItemId').value;
                    const sourceCode = document.getElementById('editSourceCode').value;
                    
                    // Determine the correct API endpoint based on source
                    let apiUrl;
                    if (sourceCode === 'OHS_INSPECTION') {
                        apiUrl = '/ohs-inspection/api/action-items/' + id;
                    } else if (sourceCode === 'OE_INSPECTION') {
                        apiUrl = '/oe-inspection/api/action-items/' + id;
                    } else {
                        showToast('Unknown source type', true);
                        return;
                    }

                    const data = {
                        cr: document.getElementById('editAction').value,
                        assignedTo: document.getElementById('editResponsible').value,
                        priority: document.getElementById('editPriority').value,
                        status: document.getElementById('editStatus').value,
                        dueDate: document.getElementById('editDeadline').value || null
                    };

                    try {
                        const response = await fetch(apiUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();
                        if (result.success) {
                            closeModal();
                            showToast('Action item updated successfully!');
                            loadActionItems();
                        } else {
                            showToast('Error: ' + result.error, true);
                        }
                    } catch (error) {
                        console.error('Error saving:', error);
                        showToast('Error saving action item', true);
                    }
                }

                function exportToExcel() {
                    let csv = 'Source,Document No,Store,Section,Finding,Corrective Action,Responsible,Department,Priority,Deadline,Status\\n';
                    actionItems.forEach(item => {
                        csv += \`"\${item.SourceCode || ''}","\${item.DocumentNumber || ''}","\${item.StoreName || ''}","\${item.SectionName || ''}","\${(item.Finding || '').replace(/"/g, '""')}","\${(item.Action || '').replace(/"/g, '""')}","\${item.Responsible || ''}","\${item.Department || ''}","\${item.Priority || ''}","\${item.Deadline ? new Date(item.Deadline).toLocaleDateString() : ''}","\${item.Status || ''}"\\n\`;
                    });

                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'escalation-action-items-' + new Date().toISOString().split('T')[0] + '.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                }

                function showToast(message, isError = false) {
                    const toast = document.getElementById('toast');
                    toast.textContent = message;
                    toast.className = 'toast' + (isError ? ' error' : '');
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 3000);
                }

                // Initialize
                loadSources();
                loadActionItems();
            </script>
        </body>
        </html>
    `);
};
