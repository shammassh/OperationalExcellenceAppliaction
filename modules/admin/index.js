const express = require('express');
const router = express.Router();
const sql = require('mssql');
const config = require('../../config/default');
const SharePointUsersService = require('../../gmrl-auth/admin/services/sharepoint-users-service');

const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

// Check if user is System Administrator
const requireSysAdmin = (req, res, next) => {
    if (req.currentUser && req.currentUser.roleId === 31) {
        next();
    } else {
        res.status(403).send(`
            <script>
                alert('Access Denied. System Administrator role required.');
                window.location.href = '/dashboard';
            </script>
        `);
    }
};

// Apply sysadmin check to all routes
router.use(requireSysAdmin);

// Admin Dashboard
router.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Panel - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                .header {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { font-size: 24px; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    margin-left: 20px;
                    opacity: 0.8;
                }
                .header-nav a:hover { opacity: 1; }
                .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
                .admin-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 25px;
                }
                .admin-card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    text-decoration: none;
                    color: inherit;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .admin-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.12);
                }
                .card-icon { font-size: 48px; margin-bottom: 15px; }
                .card-title { font-size: 20px; font-weight: 600; margin-bottom: 10px; color: #333; }
                .card-desc { color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>⚙️ Admin Panel</h1>
                <div class="header-nav">
                    <a href="/dashboard">← Dashboard</a>
                </div>
            </div>
            <div class="container">
                <div class="admin-grid">
                    <a href="/admin/users" class="admin-card">
                        <div class="card-icon">👥</div>
                        <div class="card-title">User Management</div>
                        <div class="card-desc">View all users, assign forms and permissions</div>
                    </a>
                    <a href="/admin/forms" class="admin-card">
                        <div class="card-icon">📋</div>
                        <div class="card-title">Form Registry</div>
                        <div class="card-desc">Manage available forms in the system</div>
                    </a>
                    <a href="/admin/roles" class="admin-card">
                        <div class="card-icon">🔐</div>
                        <div class="card-title">Role Management</div>
                        <div class="card-desc">View and manage user roles</div>
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// User Management - List all users
router.get('/users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get users with their assigned roles (supports multiple roles)
        const users = await pool.request().query(`
            SELECT u.Id, u.Email, u.DisplayName, u.IsActive, u.CreatedAt,
                   (SELECT COUNT(*) FROM UserFormAccess WHERE UserId = u.Id) as FormCount,
                   (SELECT STRING_AGG(r.RoleName, ', ') FROM UserRoleAssignments ura 
                    JOIN UserRoles r ON ura.RoleId = r.Id WHERE ura.UserId = u.Id) as RoleNames,
                   (SELECT STRING_AGG(CAST(ura.RoleId AS VARCHAR), ',') FROM UserRoleAssignments ura 
                    WHERE ura.UserId = u.Id) as RoleIds
            FROM Users u
            ORDER BY u.DisplayName
        `);
        
        const roles = await pool.request().query('SELECT Id, RoleName, CategoryId FROM UserRoles ORDER BY RoleName');
        const categories = await pool.request().query('SELECT Id, CategoryName FROM RoleCategories ORDER BY CategoryName');
        
        await pool.close();
        
        let userRows = users.recordset.map(u => {
            const roleDisplay = u.RoleNames ? u.RoleNames.split(', ').map(r => 
                `<span class="role-badge">${r}</span>`
            ).join(' ') : '<span class="role-badge no-role">No Role</span>';
            
            return `
            <tr>
                <td>${u.DisplayName || 'N/A'}</td>
                <td>${u.Email}</td>
                <td class="roles-cell">${roleDisplay}</td>
                <td><span class="form-count">${u.FormCount} forms</span></td>
                <td><span class="status-badge ${u.IsActive ? 'active' : 'inactive'}">${u.IsActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <a href="/admin/users/${u.Id}/forms" class="btn btn-sm btn-primary">Manage Forms</a>
                    <button class="btn btn-sm btn-secondary" onclick="editRoles(${u.Id}, '${u.RoleIds || ''}', '${(u.DisplayName || '').replace(/'/g, "\\'")}')">Manage Roles</button>
                </td>
            </tr>
        `}).join('');
        
        // Group roles by category for the modal
        const rolesByCategory = {};
        categories.recordset.forEach(c => {
            rolesByCategory[c.Id] = { name: c.CategoryName, roles: [] };
        });
        roles.recordset.forEach(r => {
            if (rolesByCategory[r.CategoryId]) {
                rolesByCategory[r.CategoryId].roles.push(r);
            }
        });
        
        const rolesJson = JSON.stringify(roles.recordset);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>User Management - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    .search-box {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        width: 300px;
                    }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .roles-cell { max-width: 300px; }
                    .role-badge {
                        background: #e3f2fd;
                        color: #1976d2;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 11px;
                        display: inline-block;
                        margin: 2px;
                    }
                    .role-badge.no-role {
                        background: #f5f5f5;
                        color: #999;
                    }
                    .form-count {
                        background: #f3e5f5;
                        color: #7b1fa2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .status-badge.active { background: #e8f5e9; color: #2e7d32; }
                    .status-badge.inactive { background: #ffebee; color: #c62828; }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 13px;
                        margin-right: 5px;
                    }
                    .btn-sm { padding: 6px 12px; }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-primary:hover { background: #005a9e; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-secondary:hover { background: #545b62; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-success:disabled { background: #94d3a2; cursor: wait; }
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        justify-content: center;
                        align-items: center;
                        z-index: 1000;
                    }
                    .modal.show { display: flex; }
                    .modal-content {
                        background: white;
                        padding: 30px;
                        border-radius: 15px;
                        width: 400px;
                        max-width: 90%;
                    }
                    .modal-title { font-size: 20px; margin-bottom: 20px; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
                    .form-group select {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>👥 User Management</h1>
                    <div class="header-nav">
                        <a href="/admin">← Admin Panel</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">All Users</div>
                            <div style="display: flex; gap: 15px; align-items: center;">
                                <button class="btn btn-success" onclick="syncUsers()">🔄 Sync from Azure AD</button>
                                <input type="text" class="search-box" placeholder="Search users..." onkeyup="filterUsers(this.value)">
                            </div>
                        </div>
                        <table id="usersTable">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Forms Assigned</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${userRows || '<tr><td colspan="6" style="text-align:center;color:#666;">No users found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Role Change Modal -->
                <div class="modal" id="roleModal">
                    <div class="modal-content" style="width:550px;max-height:80vh;overflow-y:auto;">
                        <div class="modal-title">Manage User Roles</div>
                        <input type="hidden" id="userId">
                        <div class="form-group">
                            <label id="userNameLabel" style="font-weight:600;font-size:16px;">User</label>
                        </div>
                        <div class="form-group">
                            <label style="margin-bottom:10px;display:block;">Select Roles (multiple allowed):</label>
                            <div id="rolesCheckboxes" style="max-height:400px;overflow-y:auto;border:1px solid #ddd;border-radius:8px;padding:15px;">
                                <!-- Roles will be inserted here by JS -->
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="saveRoles()">Save Roles</button>
                        </div>
                    </div>
                </div>
                
                <style>
                    .role-category { margin-bottom: 15px; }
                    .role-category-title { font-weight: 600; color: #333; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
                    .role-checkbox { display: flex; align-items: center; padding: 6px 0; }
                    .role-checkbox input { margin-right: 10px; width: 18px; height: 18px; cursor: pointer; }
                    .role-checkbox label { cursor: pointer; flex: 1; }
                </style>
                
                <script>
                    const allRoles = ${rolesJson};
                    let currentUserId = null;
                    
                    function filterUsers(query) {
                        const rows = document.querySelectorAll('#usersTable tbody tr');
                        query = query.toLowerCase();
                        rows.forEach(row => {
                            const text = row.textContent.toLowerCase();
                            row.style.display = text.includes(query) ? '' : 'none';
                        });
                    }
                    
                    function editRoles(userId, currentRoleIds, userName) {
                        currentUserId = userId;
                        document.getElementById('userId').value = userId;
                        document.getElementById('userNameLabel').textContent = userName;
                        
                        // Parse current role IDs
                        const selectedRoles = currentRoleIds ? currentRoleIds.split(',').map(id => parseInt(id)) : [];
                        
                        // Group roles by category
                        const rolesByCategory = {};
                        allRoles.forEach(r => {
                            if (!rolesByCategory[r.CategoryId]) {
                                rolesByCategory[r.CategoryId] = [];
                            }
                            rolesByCategory[r.CategoryId].push(r);
                        });
                        
                        // Build checkboxes HTML
                        let html = '';
                        Object.keys(rolesByCategory).forEach(catId => {
                            const roles = rolesByCategory[catId];
                            html += '<div class="role-category">';
                            html += '<div class="role-category-title">' + (roles[0]?.CategoryName || 'Other') + '</div>';
                            roles.forEach(r => {
                                const checked = selectedRoles.includes(r.Id) ? 'checked' : '';
                                html += '<div class="role-checkbox">';
                                html += '<input type="checkbox" id="role_' + r.Id + '" value="' + r.Id + '" ' + checked + '>';
                                html += '<label for="role_' + r.Id + '">' + r.RoleName + '</label>';
                                html += '</div>';
                            });
                            html += '</div>';
                        });
                        
                        document.getElementById('rolesCheckboxes').innerHTML = html;
                        document.getElementById('roleModal').classList.add('show');
                    }
                    
                    function closeModal() {
                        document.getElementById('roleModal').classList.remove('show');
                    }
                    
                    async function saveRoles() {
                        const checkboxes = document.querySelectorAll('#rolesCheckboxes input[type="checkbox"]:checked');
                        const roleIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
                        
                        try {
                            const response = await fetch('/admin/users/update-roles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: currentUserId, roleIds: roleIds })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (err) {
                            alert('Error saving roles: ' + err.message);
                        }
                    }
                    
                    async function syncUsers() {
                        const btn = event.target;
                        btn.disabled = true;
                        btn.textContent = '⏳ Syncing...';
                        
                        try {
                            const response = await fetch('/admin/users/sync', { method: 'POST' });
                            const result = await response.json();
                            
                            if (result.success) {
                                alert('Sync completed! Added: ' + result.added + ', Updated: ' + result.updated + ', Skipped: ' + result.skipped);
                                window.location.reload();
                            } else {
                                alert('Sync failed: ' + result.error);
                            }
                        } catch (err) {
                            alert('Sync error: ' + err.message);
                        } finally {
                            btn.disabled = false;
                            btn.textContent = '🔄 Sync from Azure AD';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading users:', err);
        res.status(500).send('Error loading users: ' + err.message);
    }
});

// Update user roles (multi-role support)
router.post('/users/update-roles', async (req, res) => {
    try {
        const { userId, roleIds } = req.body;
        const pool = await sql.connect(dbConfig);
        
        // Delete existing role assignments
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM UserRoleAssignments WHERE UserId = @userId');
        
        // Insert new role assignments
        if (roleIds && roleIds.length > 0) {
            for (const roleId of roleIds) {
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('roleId', sql.Int, roleId)
                    .query('INSERT INTO UserRoleAssignments (UserId, RoleId) VALUES (@userId, @roleId)');
            }
            
            // Also update the legacy RoleId column with the first role for backward compatibility
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('roleId', sql.Int, roleIds[0])
                .query('UPDATE Users SET RoleId = @roleId WHERE Id = @userId');
        } else {
            // Clear the legacy RoleId if no roles selected
            await pool.request()
                .input('userId', sql.Int, userId)
                .query('UPDATE Users SET RoleId = NULL WHERE Id = @userId');
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating roles:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Change user role (legacy - single role)
router.post('/users/change-role', async (req, res) => {
    try {
        const { userId, roleId } = req.body;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('roleId', sql.Int, roleId)
            .query('UPDATE Users SET RoleId = @roleId WHERE Id = @userId');
        
        await pool.close();
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Error changing role:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Sync users from SharePoint/Azure AD
router.post('/users/sync', async (req, res) => {
    try {
        console.log('[SYNC] Starting SharePoint user sync...');
        console.log('[SYNC] Using delegated token from logged-in user:', req.currentUser.email);
        
        // Get user's access token for delegated permissions
        const userToken = req.currentUser.accessToken;
        if (!userToken) {
            return res.json({
                success: false,
                error: 'No access token available. Please log out and log in again.'
            });
        }
        
        // Use SharePoint Users Service with user's token
        const spService = new SharePointUsersService(userToken);
        const allUsers = await spService.getUsers();
        
        console.log(`[SYNC] Fetched ${allUsers.length} users from SharePoint/Azure AD`);
        
        // Sync to database
        const pool = await sql.connect(dbConfig);
        let added = 0, updated = 0, skipped = 0;
        
        for (const spUser of allUsers) {
            const email = spUser.mail || spUser.userPrincipalName;
            if (!email || !email.includes('@')) {
                skipped++;
                continue;
            }
            
            // Check if user exists
            const existing = await pool.request()
                .input('email', sql.NVarChar, email.toLowerCase())
                .query('SELECT Id, DisplayName FROM Users WHERE LOWER(Email) = @email');
            
            if (existing.recordset.length > 0) {
                // Update existing user
                await pool.request()
                    .input('id', sql.Int, existing.recordset[0].Id)
                    .input('displayName', sql.NVarChar, spUser.displayName || email.split('@')[0])
                    .input('azureId', sql.NVarChar, spUser.id)
                    .query('UPDATE Users SET DisplayName = @displayName, AzureId = @azureId WHERE Id = @id');
                updated++;
            } else {
                // Insert new user
                await pool.request()
                    .input('email', sql.NVarChar, email.toLowerCase())
                    .input('displayName', sql.NVarChar, spUser.displayName || email.split('@')[0])
                    .input('azureId', sql.NVarChar, spUser.id)
                    .query(`
                        INSERT INTO Users (Email, DisplayName, AzureId, IsActive, IsApproved, CreatedAt)
                        VALUES (@email, @displayName, @azureId, 1, 1, GETDATE())
                    `);
                added++;
            }
        }
        
        await pool.close();
        
        console.log(`[SYNC] Complete - Added: ${added}, Updated: ${updated}, Skipped: ${skipped}`);
        res.json({ success: true, added, updated, skipped, total: allUsers.length });
        
    } catch (err) {
        console.error('[SYNC] Error:', err);
        res.json({ success: false, error: err.message });
    }
});

// User Form Access Management
router.get('/users/:id/forms', async (req, res) => {
    try {
        const userId = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        // Get user info
        const user = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Id, Email, DisplayName FROM Users WHERE Id = @userId');
        
        if (!user.recordset.length) {
            await pool.close();
            return res.status(404).send('User not found');
        }
        
        // Get all forms
        const forms = await pool.request().query('SELECT * FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
        
        // Get user's current form access
        const userAccess = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM UserFormAccess WHERE UserId = @userId');
        
        await pool.close();
        
        const accessMap = {};
        userAccess.recordset.forEach(a => {
            accessMap[a.FormCode] = a;
        });
        
        let formRows = forms.recordset.map(f => {
            const access = accessMap[f.FormCode];
            return `
                <tr>
                    <td><span class="module-badge">${f.ModuleName}</span></td>
                    <td><strong>${f.FormName}</strong><br><small style="color:#888">${f.FormUrl}</small></td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][enabled]" value="1" ${access ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canView]" value="1" ${access?.CanView ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canCreate]" value="1" ${access?.CanCreate ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canEdit]" value="1" ${access?.CanEdit ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canDelete]" value="1" ${access?.CanDelete ? 'checked' : ''}>
                    </td>
                </tr>
            `;
        }).join('');
        
        const userData = user.recordset[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Form Access - ${userData.DisplayName} - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
                    .user-info {
                        background: white;
                        border-radius: 15px;
                        padding: 20px 25px;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .user-avatar {
                        width: 60px;
                        height: 60px;
                        background: #0078d4;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 24px;
                        font-weight: 600;
                    }
                    .user-details h2 { font-size: 20px; margin-bottom: 5px; }
                    .user-details p { color: #666; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .checkbox-cell { text-align: center; }
                    .checkbox-cell input[type="checkbox"] {
                        width: 20px;
                        height: 20px;
                        cursor: pointer;
                    }
                    .module-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-primary:hover { background: #005a9e; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-secondary:hover { background: #545b62; }
                    .btn-row { margin-top: 25px; display: flex; gap: 15px; }
                    .quick-actions { margin-bottom: 15px; }
                    .quick-actions button {
                        padding: 8px 15px;
                        margin-right: 10px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    .quick-actions button:hover { background: #f5f5f5; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Manage Form Access</h1>
                    <div class="header-nav">
                        <a href="/admin/users">← Back to Users</a>
                        <a href="/admin">Admin Panel</a>
                    </div>
                </div>
                <div class="container">
                    <div class="user-info">
                        <div class="user-avatar">${(userData.DisplayName || 'U').charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <h2>${userData.DisplayName || 'Unknown User'}</h2>
                            <p>${userData.Email}</p>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Form Access Permissions</div>
                        </div>
                        
                        <div class="quick-actions">
                            <button type="button" onclick="selectAll()">Select All</button>
                            <button type="button" onclick="deselectAll()">Deselect All</button>
                            <button type="button" onclick="selectAllViewCreate()">Enable View & Create</button>
                        </div>
                        
                        <form action="/admin/users/${userId}/forms" method="POST">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Module</th>
                                        <th>Form</th>
                                        <th style="text-align:center">Access</th>
                                        <th style="text-align:center">View</th>
                                        <th style="text-align:center">Create</th>
                                        <th style="text-align:center">Edit</th>
                                        <th style="text-align:center">Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${formRows || '<tr><td colspan="7" style="text-align:center;color:#666;">No forms available</td></tr>'}
                                </tbody>
                            </table>
                            
                            <div class="btn-row">
                                <button type="submit" class="btn btn-primary">Save Permissions</button>
                                <a href="/admin/users" class="btn btn-secondary">Cancel</a>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    function selectAll() {
                        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
                    }
                    function deselectAll() {
                        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                    }
                    function selectAllViewCreate() {
                        document.querySelectorAll('input[name*="[enabled]"], input[name*="[canView]"], input[name*="[canCreate]"]').forEach(cb => cb.checked = true);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading form access:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Save User Form Access
router.post('/users/:id/forms', async (req, res) => {
    try {
        const userId = req.params.id;
        const forms = req.body.forms || {};
        
        const pool = await sql.connect(dbConfig);
        
        // Delete existing access
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM UserFormAccess WHERE UserId = @userId');
        
        // Insert new access
        for (const [formCode, permissions] of Object.entries(forms)) {
            if (permissions.enabled) {
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('formCode', sql.NVarChar, formCode)
                    .input('canView', sql.Bit, permissions.canView ? 1 : 0)
                    .input('canCreate', sql.Bit, permissions.canCreate ? 1 : 0)
                    .input('canEdit', sql.Bit, permissions.canEdit ? 1 : 0)
                    .input('canDelete', sql.Bit, permissions.canDelete ? 1 : 0)
                    .input('assignedBy', sql.Int, req.currentUser.userId)
                    .query(`
                        INSERT INTO UserFormAccess (UserId, FormCode, CanView, CanCreate, CanEdit, CanDelete, AssignedBy, AssignedAt)
                        VALUES (@userId, @formCode, @canView, @canCreate, @canEdit, @canDelete, @assignedBy, GETDATE())
                    `);
            }
        }
        
        await pool.close();
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Error saving form access:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Form Registry
router.get('/forms', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const forms = await pool.request().query('SELECT * FROM Forms ORDER BY ModuleName, FormName');
        await pool.close();
        
        let formRows = forms.recordset.map(f => `
            <tr>
                <td>${f.FormCode}</td>
                <td>${f.FormName}</td>
                <td><span class="module-badge">${f.ModuleName}</span></td>
                <td>${f.FormUrl}</td>
                <td><span class="status-badge ${f.IsActive ? 'active' : 'inactive'}">${f.IsActive ? 'Active' : 'Inactive'}</span></td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Form Registry - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .module-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .status-badge.active { background: #e8f5e9; color: #2e7d32; }
                    .status-badge.inactive { background: #ffebee; color: #c62828; }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                    }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-primary:hover { background: #005a9e; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Form Registry</h1>
                    <div class="header-nav">
                        <a href="/admin">← Admin Panel</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Available Forms</div>
                            <button class="btn btn-primary" onclick="alert('Add form functionality coming soon')">+ Add Form</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Form Code</th>
                                    <th>Form Name</th>
                                    <th>Module</th>
                                    <th>URL</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${formRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading forms:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Role Management
router.get('/roles', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const roles = await pool.request().query(`
            SELECT r.*, rc.CategoryName,
                   (SELECT COUNT(*) FROM Users WHERE RoleId = r.Id) as UserCount
            FROM UserRoles r
            LEFT JOIN RoleCategories rc ON r.CategoryId = rc.Id
            ORDER BY rc.CategoryName, r.RoleName
        `);
        await pool.close();
        
        let roleRows = roles.recordset.map(r => `
            <tr>
                <td>${r.Id}</td>
                <td><strong>${r.RoleName}</strong></td>
                <td><span class="category-badge">${r.CategoryName || 'Uncategorized'}</span></td>
                <td><span class="user-count">${r.UserCount} users</span></td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Role Management - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1000px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .category-badge {
                        background: #fff3e0;
                        color: #e65100;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .user-count {
                        background: #e3f2fd;
                        color: #1976d2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔐 Role Management</h1>
                    <div class="header-nav">
                        <a href="/admin">← Admin Panel</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">System Roles</div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Role Name</th>
                                    <th>Category</th>
                                    <th>Users</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roleRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading roles:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
