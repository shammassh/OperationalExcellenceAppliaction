/**
 * Admin Email Templates Page
 * Manage escalation email templates
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
            <title>Email Templates - ${process.env.APP_NAME}</title>
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
                .btn-secondary { background: #6b7280; color: white; }
                .btn-secondary:hover { background: #4b5563; }
                .btn-sm { padding: 6px 12px; font-size: 12px; }
                
                .template-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }
                .template-card {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .template-card-header {
                    padding: 15px;
                    background: #f9fafb;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .template-card-header h3 { font-size: 16px; color: #1f2937; }
                .template-card-body { padding: 15px; }
                .template-card-body p { font-size: 14px; color: #6b7280; margin-bottom: 10px; }
                .template-card-body .subject {
                    font-size: 13px;
                    background: #f3f4f6;
                    padding: 8px 12px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                .template-card-footer {
                    padding: 15px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    gap: 10px;
                }
                
                .badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge-active { background: #d1fae5; color: #059669; }
                .badge-inactive { background: #fee2e2; color: #dc2626; }
                
                .placeholder-tag {
                    display: inline-block;
                    background: #ede9fe;
                    color: #7c3aed;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    margin: 2px;
                    cursor: pointer;
                }
                .placeholder-tag:hover { background: #ddd6fe; }
                
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
                    max-width: 900px;
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
                .form-group textarea { 
                    font-family: monospace;
                    resize: vertical; 
                    min-height: 300px; 
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                .help-text {
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 4px;
                }
                
                .placeholder-section {
                    background: #f9fafb;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                }
                .placeholder-section h4 {
                    font-size: 14px;
                    margin-bottom: 10px;
                    color: #374151;
                }
                
                .preview-frame {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    min-height: 300px;
                }
                .preview-frame iframe {
                    width: 100%;
                    height: 400px;
                    border: none;
                }
                
                .tabs {
                    display: flex;
                    border-bottom: 1px solid #e5e7eb;
                    margin-bottom: 15px;
                }
                .tab {
                    padding: 10px 20px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    color: #6b7280;
                }
                .tab.active {
                    color: #7c3aed;
                    border-bottom-color: #7c3aed;
                }
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                
                .empty-state {
                    padding: 40px;
                    text-align: center;
                    color: #6b7280;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📧 Email Templates</h1>
                <div class="header-nav">
                    <a href="/escalation">Dashboard</a>
                    <a href="/escalation/admin/sources">Sources</a>
                    <a href="/escalation/admin/templates" class="active">Email Templates</a>
                    <a href="/escalation/admin/contacts">Contacts</a>
                    <a href="/dashboard">← Back to Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="card">
                    <div class="card-header">
                        <h2>📧 Email Templates</h2>
                        <button class="btn btn-primary" onclick="openModal()">+ Add Template</button>
                    </div>
                    <div class="card-body">
                        <div class="template-grid" id="templates-grid">
                            <div class="empty-state">Loading...</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Add/Edit Modal -->
            <div class="modal" id="template-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Add Email Template</h3>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="template-id">
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Template Code *</label>
                                <input type="text" id="template-code" placeholder="e.g., OVERDUE_NOTIFICATION">
                                <div class="help-text">Unique identifier (no spaces)</div>
                            </div>
                            <div class="form-group">
                                <label>Template Name *</label>
                                <input type="text" id="template-name" placeholder="e.g., Overdue Action Item Notification">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Description</label>
                            <input type="text" id="template-description" placeholder="Brief description of when this template is used">
                        </div>
                        
                        <div class="placeholder-section">
                            <h4>📎 Available Placeholders (click to copy)</h4>
                            <div id="placeholders-display">
                                <span class="placeholder-tag" onclick="copyPlaceholder('responsibleName')">{{responsibleName}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('storeName')">{{storeName}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('sourceName')">{{sourceName}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('finding')">{{finding}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('action')">{{action}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('deadline')">{{deadline}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('daysOverdue')">{{daysOverdue}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('department')">{{department}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('priority')">{{priority}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('escalatedBy')">{{escalatedBy}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('escalationReason')">{{escalationReason}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('recipientName')">{{recipientName}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('appUrl')">{{appUrl}}</span>
                                <span class="placeholder-tag" onclick="copyPlaceholder('appName')">{{appName}}</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Email Subject *</label>
                            <input type="text" id="template-subject" placeholder="e.g., ⚠️ Overdue Action Item: {{finding}}">
                        </div>
                        
                        <div class="tabs">
                            <div class="tab active" onclick="switchTab('edit')">Edit HTML</div>
                            <div class="tab" onclick="switchTab('preview')">Preview</div>
                        </div>
                        
                        <div class="tab-content active" id="tab-edit">
                            <div class="form-group">
                                <label>Email Body (HTML) *</label>
                                <textarea id="template-body" placeholder="<html><body>Your email content here...</body></html>"></textarea>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="tab-preview">
                            <div class="preview-frame">
                                <iframe id="preview-iframe"></iframe>
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
                        <button class="btn btn-secondary" onclick="previewTemplate()">Preview</button>
                        <button class="btn btn-primary" onclick="saveTemplate()">Save</button>
                    </div>
                </div>
            </div>
            
            <script>
                let templates = [];
                
                async function loadTemplates() {
                    try {
                        const res = await fetch('/escalation/api/admin/templates');
                        const data = await res.json();
                        if (data.success) {
                            templates = data.data;
                            renderTemplates();
                        }
                    } catch (err) {
                        console.error('Error:', err);
                    }
                }
                
                function renderTemplates() {
                    const grid = document.getElementById('templates-grid');
                    
                    if (templates.length === 0) {
                        grid.innerHTML = '<div class="empty-state">No templates configured. Click "Add Template" to create one.</div>';
                        return;
                    }
                    
                    grid.innerHTML = templates.map(t => \`
                        <div class="template-card">
                            <div class="template-card-header">
                                <h3>\${t.TemplateName}</h3>
                                <span class="badge \${t.IsActive ? 'badge-active' : 'badge-inactive'}">\${t.IsActive ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div class="template-card-body">
                                <p>\${t.Description || 'No description'}</p>
                                <div class="subject"><strong>Subject:</strong> \${escapeHtml(t.Subject)}</div>
                                <div style="font-size: 11px; color: #6b7280;">Code: \${t.TemplateCode}</div>
                            </div>
                            <div class="template-card-footer">
                                <button class="btn btn-sm" onclick="editTemplate(\${t.Id})">Edit</button>
                                <button class="btn btn-sm btn-secondary" onclick="previewExisting(\${t.Id})">Preview</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteTemplate(\${t.Id})">Delete</button>
                            </div>
                        </div>
                    \`).join('');
                }
                
                function openModal(template = null) {
                    document.getElementById('modal-title').textContent = template ? 'Edit Email Template' : 'Add Email Template';
                    document.getElementById('template-id').value = template?.Id || '';
                    document.getElementById('template-code').value = template?.TemplateCode || '';
                    document.getElementById('template-name').value = template?.TemplateName || '';
                    document.getElementById('template-description').value = template?.Description || '';
                    document.getElementById('template-subject').value = template?.Subject || '';
                    document.getElementById('template-body').value = template?.Body || '';
                    document.getElementById('is-active').checked = template?.IsActive !== false;
                    switchTab('edit');
                    document.getElementById('template-modal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('template-modal').classList.remove('active');
                }
                
                function editTemplate(id) {
                    const template = templates.find(t => t.Id === id);
                    if (template) openModal(template);
                }
                
                function switchTab(tab) {
                    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                    document.querySelector('.tab:nth-child(' + (tab === 'edit' ? 1 : 2) + ')').classList.add('active');
                    document.getElementById('tab-' + tab).classList.add('active');
                    
                    if (tab === 'preview') {
                        previewTemplate();
                    }
                }
                
                function previewTemplate() {
                    const body = document.getElementById('template-body').value;
                    const iframe = document.getElementById('preview-iframe');
                    
                    // Replace placeholders with sample values
                    let preview = body
                        .replace(/\\{\\{responsibleName\\}\\}/g, 'John Doe')
                        .replace(/\\{\\{storeName\\}\\}/g, 'Store ABC')
                        .replace(/\\{\\{sourceName\\}\\}/g, 'OHS Inspection')
                        .replace(/\\{\\{finding\\}\\}/g, 'Fire extinguisher expired')
                        .replace(/\\{\\{action\\}\\}/g, 'Replace fire extinguisher')
                        .replace(/\\{\\{deadline\\}\\}/g, '15 Feb 2026')
                        .replace(/\\{\\{daysOverdue\\}\\}/g, '5')
                        .replace(/\\{\\{department\\}\\}/g, 'Maintenance')
                        .replace(/\\{\\{priority\\}\\}/g, 'High')
                        .replace(/\\{\\{escalatedBy\\}\\}/g, 'Jane Smith')
                        .replace(/\\{\\{escalationReason\\}\\}/g, 'Item has been overdue for too long')
                        .replace(/\\{\\{recipientName\\}\\}/g, 'Department Head')
                        .replace(/\\{\\{appUrl\\}\\}/g, 'https://oeapp-uat.gmrlapps.com')
                        .replace(/\\{\\{appName\\}\\}/g, 'Operational Excellence App');
                    
                    iframe.srcdoc = preview;
                    switchTab('preview');
                }
                
                function previewExisting(id) {
                    const template = templates.find(t => t.Id === id);
                    if (template) {
                        openModal(template);
                        setTimeout(() => switchTab('preview'), 100);
                    }
                }
                
                function copyPlaceholder(name) {
                    navigator.clipboard.writeText('{{' + name + '}}');
                    alert('Copied: {{' + name + '}}');
                }
                
                async function saveTemplate() {
                    const data = {
                        id: document.getElementById('template-id').value || null,
                        templateCode: document.getElementById('template-code').value,
                        templateName: document.getElementById('template-name').value,
                        description: document.getElementById('template-description').value,
                        subject: document.getElementById('template-subject').value,
                        body: document.getElementById('template-body').value,
                        isActive: document.getElementById('is-active').checked
                    };
                    
                    if (!data.templateCode || !data.templateName || !data.subject || !data.body) {
                        alert('Please fill in all required fields');
                        return;
                    }
                    
                    try {
                        const res = await fetch('/escalation/api/admin/templates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();
                        if (result.success) {
                            closeModal();
                            loadTemplates();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        alert('Error saving template');
                    }
                }
                
                async function deleteTemplate(id) {
                    if (!confirm('Are you sure you want to delete this template?')) return;
                    
                    try {
                        const res = await fetch('/escalation/api/admin/templates/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) {
                            loadTemplates();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        alert('Error deleting template');
                    }
                }
                
                function escapeHtml(str) {
                    if (!str) return '';
                    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }
                
                loadTemplates();
            </script>
        </body>
        </html>
    `);
};
