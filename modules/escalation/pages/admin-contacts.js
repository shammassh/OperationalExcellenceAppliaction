/**
 * Admin Department Contacts Page
 * Manage department contacts for escalation notifications
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
            <title>Department Contacts - ${process.env.APP_NAME}</title>
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
                    transition: all 0.2s;
                }
                .btn-primary { background: #7c3aed; color: white; }
                .btn-primary:hover { background: #6d28d9; }
                .btn-danger { background: #dc2626; color: white; }
                .btn-danger:hover { background: #b91c1c; }
                .btn-sm { padding: 6px 12px; font-size: 12px; }
                
                .dept-section {
                    margin-bottom: 25px;
                }
                .dept-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 15px;
                    background: #f9fafb;
                    border-radius: 8px 8px 0 0;
                    border: 1px solid #e5e7eb;
                    border-bottom: none;
                }
                .dept-header h3 {
                    flex: 1;
                    color: #1f2937;
                }
                .dept-icon {
                    font-size: 24px;
                }
                .dept-contacts {
                    border: 1px solid #e5e7eb;
                    border-radius: 0 0 8px 8px;
                }
                
                .contact-row {
                    display: flex;
                    align-items: center;
                    padding: 12px 15px;
                    border-bottom: 1px solid #e5e7eb;
                    gap: 15px;
                }
                .contact-row:last-child { border-bottom: none; }
                .contact-row:hover { background: #f9fafb; }
                
                .contact-info { flex: 1; }
                .contact-name { font-weight: 500; color: #1f2937; }
                .contact-email { font-size: 13px; color: #6b7280; }
                .contact-role {
                    background: #e5e7eb;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    color: #4b5563;
                }
                
                .alert-badges { display: flex; gap: 8px; }
                .alert-badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 500;
                }
                .alert-badge.overdue { background: #fee2e2; color: #dc2626; }
                .alert-badge.escalation { background: #ede9fe; color: #7c3aed; }
                .alert-badge.disabled { background: #f3f4f6; color: #9ca3af; }
                
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
                    max-width: 500px;
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
                .checkbox-group {
                    display: flex;
                    gap: 20px;
                    margin-top: 10px;
                }
                .checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: normal;
                    cursor: pointer;
                }
                
                .empty-state {
                    padding: 40px;
                    text-align: center;
                    color: #6b7280;
                }
                
                .dept-icons {
                    display: flex;
                    gap: 5px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>👥 Department Contacts</h1>
                <div class="header-nav">
                    <a href="/escalation">Dashboard</a>
                    <a href="/escalation/admin/sources">Sources</a>
                    <a href="/escalation/admin/templates">Email Templates</a>
                    <a href="/escalation/admin/contacts" class="active">Contacts</a>
                    <a href="/dashboard">← Back to Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="card">
                    <div class="card-header">
                        <h2>👥 Department Contacts</h2>
                        <button class="btn btn-primary" onclick="openModal()">+ Add Contact</button>
                    </div>
                    <div class="card-body" id="contacts-container">
                        <div class="empty-state">Loading...</div>
                    </div>
                </div>
            </div>
            
            <!-- Add/Edit Modal -->
            <div class="modal" id="contact-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Add Department Contact</h3>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="contact-id">
                        
                        <div class="form-group">
                            <label>Department *</label>
                            <select id="department-name">
                                <option value="">Select or type new...</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Procurement">Procurement</option>
                                <option value="Cleaning">Cleaning</option>
                                <option value="Operations">Operations</option>
                                <option value="HR">HR</option>
                                <option value="Security">Security</option>
                                <option value="IT">IT</option>
                                <option value="__custom__">+ Add Custom Department</option>
                            </select>
                            <input type="text" id="custom-department" placeholder="Enter custom department name" style="display: none; margin-top: 10px;">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Contact Name *</label>
                                <input type="text" id="contact-name" placeholder="e.g., John Doe">
                            </div>
                            <div class="form-group">
                                <label>Role</label>
                                <select id="contact-role">
                                    <option value="Head">Head</option>
                                    <option value="Deputy">Deputy</option>
                                    <option value="Coordinator">Coordinator</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Supervisor">Supervisor</option>
                                    <option value="Officer">Officer</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Email Address *</label>
                            <input type="email" id="contact-email" placeholder="e.g., john.doe@example.com">
                        </div>
                        
                        <div class="form-group">
                            <label>Notification Preferences</label>
                            <div class="checkbox-group">
                                <label>
                                    <input type="checkbox" id="receive-overdue" checked>
                                    ⚠️ Overdue Alerts
                                </label>
                                <label>
                                    <input type="checkbox" id="receive-escalation" checked>
                                    🔴 Escalation Alerts
                                </label>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Sort Order</label>
                                <input type="number" id="sort-order" value="0">
                            </div>
                            <div class="form-group">
                                <label>&nbsp;</label>
                                <label style="display: flex; align-items: center; gap: 8px; padding-top: 10px;">
                                    <input type="checkbox" id="is-active" checked>
                                    Active
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn" onclick="closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveContact()">Save</button>
                    </div>
                </div>
            </div>
            
            <script>
                let contacts = [];
                const deptIcons = {
                    'Maintenance': '🔧',
                    'Procurement': '📦',
                    'Cleaning': '🧹',
                    'Operations': '📋',
                    'HR': '👥',
                    'Security': '🛡️',
                    'IT': '💻'
                };
                
                async function loadContacts() {
                    try {
                        const res = await fetch('/escalation/api/admin/contacts');
                        const data = await res.json();
                        if (data.success) {
                            contacts = data.data;
                            renderContacts();
                        }
                    } catch (err) {
                        console.error('Error:', err);
                    }
                }
                
                function renderContacts() {
                    const container = document.getElementById('contacts-container');
                    
                    if (contacts.length === 0) {
                        container.innerHTML = '<div class="empty-state">No contacts configured. Click "Add Contact" to add department contacts who will receive escalation notifications.</div>';
                        return;
                    }
                    
                    // Group by department
                    const departments = {};
                    contacts.forEach(c => {
                        if (!departments[c.DepartmentName]) {
                            departments[c.DepartmentName] = [];
                        }
                        departments[c.DepartmentName].push(c);
                    });
                    
                    container.innerHTML = Object.keys(departments).sort().map(dept => \`
                        <div class="dept-section">
                            <div class="dept-header">
                                <span class="dept-icon">\${deptIcons[dept] || '🏢'}</span>
                                <h3>\${dept}</h3>
                                <span style="color: #6b7280; font-size: 14px;">\${departments[dept].length} contact(s)</span>
                            </div>
                            <div class="dept-contacts">
                                \${departments[dept].map(c => \`
                                    <div class="contact-row">
                                        <div class="contact-info">
                                            <div class="contact-name">\${c.ContactName || 'No name'}</div>
                                            <div class="contact-email">\${c.ContactEmail}</div>
                                        </div>
                                        <span class="contact-role">\${c.ContactRole || 'Contact'}</span>
                                        <div class="alert-badges">
                                            <span class="alert-badge \${c.ReceiveOverdueAlerts ? 'overdue' : 'disabled'}">
                                                ⚠️ Overdue \${c.ReceiveOverdueAlerts ? '✓' : '✗'}
                                            </span>
                                            <span class="alert-badge \${c.ReceiveEscalationAlerts ? 'escalation' : 'disabled'}">
                                                🔴 Escalation \${c.ReceiveEscalationAlerts ? '✓' : '✗'}
                                            </span>
                                        </div>
                                        <span class="badge \${c.IsActive ? 'badge-active' : 'badge-inactive'}">\${c.IsActive ? 'Active' : 'Inactive'}</span>
                                        <button class="btn btn-sm" onclick="editContact(\${c.Id})">Edit</button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteContact(\${c.Id})">Delete</button>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`).join('');
                }
                
                function openModal(contact = null) {
                    document.getElementById('modal-title').textContent = contact ? 'Edit Department Contact' : 'Add Department Contact';
                    document.getElementById('contact-id').value = contact?.Id || '';
                    document.getElementById('contact-name').value = contact?.ContactName || '';
                    document.getElementById('contact-email').value = contact?.ContactEmail || '';
                    document.getElementById('contact-role').value = contact?.ContactRole || 'Head';
                    document.getElementById('receive-overdue').checked = contact?.ReceiveOverdueAlerts !== false;
                    document.getElementById('receive-escalation').checked = contact?.ReceiveEscalationAlerts !== false;
                    document.getElementById('sort-order').value = contact?.SortOrder || 0;
                    document.getElementById('is-active').checked = contact?.IsActive !== false;
                    
                    // Handle department select
                    const deptSelect = document.getElementById('department-name');
                    const customInput = document.getElementById('custom-department');
                    if (contact?.DepartmentName) {
                        const optionExists = Array.from(deptSelect.options).some(o => o.value === contact.DepartmentName);
                        if (optionExists) {
                            deptSelect.value = contact.DepartmentName;
                            customInput.style.display = 'none';
                        } else {
                            deptSelect.value = '__custom__';
                            customInput.value = contact.DepartmentName;
                            customInput.style.display = 'block';
                        }
                    } else {
                        deptSelect.value = '';
                        customInput.style.display = 'none';
                    }
                    
                    document.getElementById('contact-modal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('contact-modal').classList.remove('active');
                }
                
                function editContact(id) {
                    const contact = contacts.find(c => c.Id === id);
                    if (contact) openModal(contact);
                }
                
                // Handle custom department
                document.getElementById('department-name').addEventListener('change', function() {
                    const customInput = document.getElementById('custom-department');
                    if (this.value === '__custom__') {
                        customInput.style.display = 'block';
                        customInput.focus();
                    } else {
                        customInput.style.display = 'none';
                        customInput.value = '';
                    }
                });
                
                async function saveContact() {
                    let departmentName = document.getElementById('department-name').value;
                    if (departmentName === '__custom__') {
                        departmentName = document.getElementById('custom-department').value.trim();
                    }
                    
                    const data = {
                        id: document.getElementById('contact-id').value || null,
                        departmentName: departmentName,
                        contactName: document.getElementById('contact-name').value,
                        contactEmail: document.getElementById('contact-email').value,
                        contactRole: document.getElementById('contact-role').value,
                        receiveOverdueAlerts: document.getElementById('receive-overdue').checked,
                        receiveEscalationAlerts: document.getElementById('receive-escalation').checked,
                        sortOrder: parseInt(document.getElementById('sort-order').value) || 0,
                        isActive: document.getElementById('is-active').checked
                    };
                    
                    if (!data.departmentName || !data.contactName || !data.contactEmail) {
                        alert('Please fill in all required fields');
                        return;
                    }
                    
                    // Validate email
                    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.contactEmail)) {
                        alert('Please enter a valid email address');
                        return;
                    }
                    
                    try {
                        const res = await fetch('/escalation/api/admin/contacts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();
                        if (result.success) {
                            closeModal();
                            loadContacts();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        alert('Error saving contact');
                    }
                }
                
                async function deleteContact(id) {
                    if (!confirm('Are you sure you want to delete this contact?')) return;
                    
                    try {
                        const res = await fetch('/escalation/api/admin/contacts/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) {
                            loadContacts();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        alert('Error deleting contact');
                    }
                }
                
                loadContacts();
            </script>
        </body>
        </html>
    `);
};
