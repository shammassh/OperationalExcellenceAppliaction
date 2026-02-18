const express = require('express');
const router = express.Router();
const sql = require('mssql');
const ExcelJS = require('exceljs');
const config = require('../../config/default');
const SharePointUsersService = require('../../gmrl-auth/admin/services/sharepoint-users-service');

const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

// Check if user is System Administrator OR has form-based permission
const requireSysAdmin = async (req, res, next) => {
    // System Administrator (roleId 31) has full access to all admin pages
    if (req.currentUser && req.currentUser.roleId === 31) {
        return next();
    }
    
    // Check for dynamic form-based permission
    // Map URL to FormCode
    const urlToFormCode = {
        '/admin': 'ADMIN_DASHBOARD',
        '/admin/users': 'ADMIN_USERS',
        '/admin/roles': 'ADMIN_ROLES',
        '/admin/forms': 'ADMIN_FORMS',
        '/admin/stores': 'ADMIN_STORES',
        '/admin/impersonate': 'ADMIN_IMPERSONATE',
        '/admin/sessions': 'ADMIN_SESSIONS',
        '/admin/notification-history': 'ADMIN_NOTIFICATIONS'
    };
    
    // Find matching form code
    const currentPath = req.originalUrl.split('?')[0].replace(/\/$/, '');
    let formCode = null;
    
    // Check for exact match first
    if (urlToFormCode[currentPath]) {
        formCode = urlToFormCode[currentPath];
    } else {
        // Check for prefix match (e.g., /admin/users/123 -> ADMIN_USERS)
        for (const [path, code] of Object.entries(urlToFormCode)) {
            if (currentPath.startsWith(path + '/') || currentPath === path) {
                formCode = code;
                break;
            }
        }
    }
    
    if (formCode && req.currentUser && req.currentUser.permissions) {
        const permission = req.currentUser.permissions[formCode];
        if (permission && permission.canView) {
            return next();
        }
    }
    
    // No access
    res.status(403).send(`
        <script>
            alert('Access Denied. You do not have permission to access this page.');
            window.location.href = '/dashboard';
        </script>
    `);
};

// Apply sysadmin check to all routes
router.use(requireSysAdmin);

// Download Permission Matrix as Excel
router.get('/roles/download-matrix', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all data
        const roles = await pool.request().query('SELECT Id, RoleName, Description FROM UserRoles ORDER BY RoleName');
        const forms = await pool.request().query('SELECT Id, FormCode, FormName, ModuleName FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
        const permissions = await pool.request().query('SELECT RoleId, FormCode, CanView, CanCreate, CanEdit, CanDelete FROM RoleFormAccess');
        
        await pool.close();
        
        // Build permission lookup
        const permLookup = {};
        permissions.recordset.forEach(p => {
            const key = `${p.RoleId}-${p.FormCode}`;
            permLookup[key] = p;
        });
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'OE Application';
        workbook.created = new Date();
        
        // Create main matrix sheet
        const matrixSheet = workbook.addWorksheet('Permission Matrix');
        
        // Header row: Form Code | Form Name | Module | Role1 | Role2 | ...
        const headerRow = ['Form Code', 'Form Name', 'Module'];
        roles.recordset.forEach(r => headerRow.push(r.RoleName));
        matrixSheet.addRow(headerRow);
        
        // Style header
        const headerRowObj = matrixSheet.getRow(1);
        headerRowObj.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6f42c1' } };
        headerRowObj.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRowObj.height = 25;
        
        // Data rows
        forms.recordset.forEach(form => {
            const row = [form.FormCode, form.FormName, form.ModuleName];
            roles.recordset.forEach(role => {
                const perm = permLookup[`${role.Id}-${form.FormCode}`];
                if (perm) {
                    const perms = [];
                    if (perm.CanView) perms.push('V');
                    if (perm.CanCreate) perms.push('C');
                    if (perm.CanEdit) perms.push('E');
                    if (perm.CanDelete) perms.push('D');
                    row.push(perms.join(',') || '-');
                } else {
                    row.push('-');
                }
            });
            matrixSheet.addRow(row);
        });
        
        // Style data rows
        for (let i = 2; i <= forms.recordset.length + 1; i++) {
            const row = matrixSheet.getRow(i);
            row.alignment = { horizontal: 'center', vertical: 'middle' };
            
            // Color code permissions
            for (let j = 4; j <= roles.recordset.length + 3; j++) {
                const cell = row.getCell(j);
                const val = cell.value;
                if (val && val !== '-') {
                    if (val.includes('V') && val.includes('C') && val.includes('E') && val.includes('D')) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF28a745' } };
                        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                    } else if (val.includes('E') || val.includes('D')) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFffc107' } };
                    } else if (val.includes('V') || val.includes('C')) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFd4edda' } };
                    }
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf8f9fa' } };
                    cell.font = { color: { argb: 'FF999999' } };
                }
            }
        }
        
        // Set column widths
        matrixSheet.getColumn(1).width = 25;
        matrixSheet.getColumn(2).width = 30;
        matrixSheet.getColumn(3).width = 15;
        for (let i = 4; i <= roles.recordset.length + 3; i++) {
            matrixSheet.getColumn(i).width = 12;
        }
        
        // Freeze panes
        matrixSheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];
        
        // Add legend sheet
        const legendSheet = workbook.addWorksheet('Legend');
        legendSheet.addRow(['Permission Legend']);
        legendSheet.addRow(['V = View', 'C = Create', 'E = Edit', 'D = Delete']);
        legendSheet.addRow([]);
        legendSheet.addRow(['Color Legend']);
        legendSheet.addRow(['Green (VCED)', 'Full Access']);
        legendSheet.addRow(['Yellow (E or D)', 'Edit/Delete Access']);
        legendSheet.addRow(['Light Green (V or C)', 'View/Create Only']);
        legendSheet.addRow(['Gray (-)', 'No Access']);
        legendSheet.getRow(1).font = { bold: true, size: 14 };
        legendSheet.getRow(4).font = { bold: true, size: 14 };
        
        // Set response headers
        const filename = `Role-Permission-Matrix-${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Error generating permission matrix:', err);
        res.status(500).send('Error generating permission matrix: ' + err.message);
    }
});

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
                    <a href="/admin/impersonate" class="admin-card">
                        <div class="card-icon">👤</div>
                        <div class="card-title">Impersonate User</div>
                        <div class="card-desc">Test permissions as another user</div>
                    </a>
                    <a href="/admin/sessions" class="admin-card">
                        <div class="card-icon">🔐</div>
                        <div class="card-title">Session Monitor</div>
                        <div class="card-desc">View active sessions & detect duplicates</div>
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
            SELECT u.Id, u.Email, u.DisplayName, u.IsActive, u.IsApproved, u.CreatedAt,
                   (SELECT COUNT(*) FROM UserFormAccess WHERE UserId = u.Id) as FormCount,
                   (SELECT STRING_AGG(r.RoleName, ', ') FROM UserRoleAssignments ura 
                    JOIN UserRoles r ON ura.RoleId = r.Id WHERE ura.UserId = u.Id) as RoleNames,
                   (SELECT STRING_AGG(CAST(ura.RoleId AS VARCHAR), ',') FROM UserRoleAssignments ura 
                    WHERE ura.UserId = u.Id) as RoleIds
            FROM Users u
            ORDER BY u.DisplayName
        `);
        
        const roles = await pool.request().query(`
            SELECT r.Id, r.RoleName, r.CategoryId, c.CategoryName, c.AccessLevel,
                   (SELECT COUNT(*) FROM RoleFormAccess WHERE RoleId = r.Id) as FormCount
            FROM UserRoles r
            JOIN RoleCategories c ON r.CategoryId = c.Id
            ORDER BY c.Id, r.RoleName
        `);
        const categories = await pool.request().query('SELECT Id, CategoryName, AccessLevel FROM RoleCategories ORDER BY Id');
        
        await pool.close();
        
        // Helper to escape strings for JS
        const escapeJs = (str) => (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
        
        let userRows = users.recordset.map(u => {
            const roleDisplay = u.RoleNames ? u.RoleNames.split(', ').map(r => 
                `<span class="role-badge">${r}</span>`
            ).join(' ') : '<span class="role-badge no-role">No Role</span>';
            
            const approvalBadge = u.IsApproved 
                ? '' 
                : '<span class="status-badge pending">⏳ Pending Approval</span>';
            
            const approveBtn = u.IsApproved 
                ? '' 
                : `<button class="btn btn-sm btn-warning" onclick="approveUser(${u.Id}, '${escapeJs(u.DisplayName)}')">✓ Approve</button>`;
            
            return `
            <tr data-user-id="${u.Id}" data-approved="${u.IsApproved ? '1' : '0'}">
                <td>${escapeJs(u.DisplayName) || 'N/A'} ${approvalBadge}</td>
                <td>${u.Email}</td>
                <td class="roles-cell">${roleDisplay}</td>
                <td><span class="form-count">${u.FormCount} forms</span></td>
                <td><span class="status-badge ${u.IsActive ? 'active' : 'inactive'}">${u.IsActive ? 'Active' : 'Inactive'}</span></td>
                <td class="actions-cell">
                    ${approveBtn}
                    <a href="/admin/users/${u.Id}/forms" class="btn btn-sm btn-primary">Manage Forms</a>
                    <button class="btn btn-sm btn-secondary" onclick="editRoles(${u.Id}, '${u.RoleIds || ''}', '${escapeJs(u.DisplayName)}')">Manage Roles</button>
                </td>
            </tr>
        `}).join('');
        
        // Group roles by category for the modal
        const rolesByCategory = {};
        categories.recordset.forEach(c => {
            rolesByCategory[c.Id] = { name: c.CategoryName, accessLevel: c.AccessLevel, roles: [] };
        });
        roles.recordset.forEach(r => {
            if (rolesByCategory[r.CategoryId]) {
                rolesByCategory[r.CategoryId].roles.push(r);
            }
        });
        
        const rolesJson = JSON.stringify(roles.recordset);
        const categoriesJson = JSON.stringify(categories.recordset);
        
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
                    .status-badge.pending { background: #fff3e0; color: #e65100; font-size: 10px; margin-left: 8px; }
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
                    .btn-warning { background: #ff9800; color: white; }
                    .btn-warning:hover { background: #f57c00; }
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
                    .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid #eee; }
                    .tab { padding: 10px 20px; cursor: pointer; border-radius: 8px 8px 0 0; transition: all 0.2s; }
                    .tab:hover { background: #f0f0f0; }
                    .tab.active { background: #0078d4; color: white; }
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    .role-card { background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
                    .role-card:hover { border-color: #0078d4; transform: translateX(5px); }
                    .role-card.selected { border-color: #28a745; background: #e8f5e9; }
                    .role-card-header { display: flex; justify-content: space-between; align-items: center; }
                    .role-card-title { font-weight: 600; color: #333; }
                    .role-card-category { font-size: 11px; color: #666; background: #e3f2fd; padding: 3px 8px; border-radius: 10px; }
                    .role-card-desc { font-size: 12px; color: #666; margin-top: 8px; }
                    .role-card-forms { font-size: 11px; color: #0078d4; margin-top: 5px; }
                    .perm-table { width: 100%; font-size: 13px; margin-top: 15px; }
                    .perm-table th { background: #f0f0f0; padding: 8px; text-align: left; }
                    .perm-table td { padding: 8px; border-bottom: 1px solid #eee; }
                    .perm-check { color: #28a745; font-weight: bold; }
                    .perm-x { color: #dc3545; }
                    .quick-stats { display: flex; gap: 20px; margin-bottom: 20px; }
                    .stat-card { background: white; padding: 20px; border-radius: 12px; flex: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
                    .stat-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
                    .stat-card.selected { border-color: #0078d4; background: #f0f7ff; }
                    .stat-card.with-roles .stat-number { color: #28a745; }
                    .stat-card.with-roles.selected { border-color: #28a745; background: #f0fff4; }
                    .stat-card.no-roles .stat-number { color: #dc3545; }
                    .stat-card.no-roles.selected { border-color: #dc3545; background: #fff5f5; }
                    .stat-card.pending-approval .stat-number { color: #ff9800; }
                    .stat-card.pending-approval.selected { border-color: #ff9800; background: #fff8e1; }
                    .stat-card.roles-count .stat-number { color: #6f42c1; }
                    .stat-number { font-size: 28px; font-weight: bold; color: #0078d4; }
                    .stat-label { font-size: 13px; color: #666; margin-top: 5px; }
                    .actions-cell { white-space: nowrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>👥 User Management</h1>
                    <div class="header-nav">
                        <button class="btn" style="background:#6f42c1;color:white;margin-right:15px;" onclick="showRolePermissions()">📋 View Role Permissions</button>
                        <a href="/admin">← Admin Panel</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <!-- Quick Stats -->
                    <div class="quick-stats">
                        <div class="stat-card selected" onclick="filterByCard('all')" title="Click to show all users">
                            <div class="stat-number">${users.recordset.length}</div>
                            <div class="stat-label">Total Users</div>
                        </div>
                        <div class="stat-card pending-approval" onclick="filterByCard('pending')" title="Click to show pending approval">
                            <div class="stat-number">${users.recordset.filter(u => !u.IsApproved).length}</div>
                            <div class="stat-label">⏳ Pending Approval</div>
                        </div>
                        <div class="stat-card" onclick="filterByCard('active')" title="Click to show active users">
                            <div class="stat-number">${users.recordset.filter(u => u.IsActive).length}</div>
                            <div class="stat-label">Active Users</div>
                        </div>
                        <div class="stat-card with-roles" onclick="filterByCard('with-roles')" title="Click to show users with roles">
                            <div class="stat-number">${users.recordset.filter(u => u.RoleNames).length}</div>
                            <div class="stat-label">Users with Roles</div>
                        </div>
                        <div class="stat-card no-roles" onclick="filterByCard('no-roles')" title="Click to show users without roles">
                            <div class="stat-number">${users.recordset.filter(u => !u.RoleNames).length}</div>
                            <div class="stat-label">No Roles Assigned</div>
                        </div>
                    </div>
                    
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
                
                <!-- Role Permissions Modal -->
                <div class="modal" id="rolePermissionsModal">
                    <div class="modal-content" style="width:900px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
                        <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>📋 Role Permissions Guide</span>
                            <button onclick="closeRolePermissionsModal()" style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
                        </div>
                        <div style="display:flex;gap:20px;flex:1;overflow:hidden;">
                            <!-- Left: Role List -->
                            <div style="width:300px;overflow-y:auto;padding-right:10px;">
                                <div id="rolesList"></div>
                            </div>
                            <!-- Right: Permission Details -->
                            <div style="flex:1;overflow-y:auto;padding:15px;background:#f8f9fa;border-radius:10px;">
                                <div id="roleDetails">
                                    <div style="text-align:center;color:#666;padding:40px;">
                                        ← Select a role to see its permissions
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Role Change Modal -->
                <div class="modal" id="roleModal">
                    <div class="modal-content" style="width:900px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
                        <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>🎭 Manage User Roles</span>
                            <button onclick="closeModal()" style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
                        </div>
                        <input type="hidden" id="userId">
                        <div class="form-group">
                            <label id="userNameLabel" style="font-weight:600;font-size:18px;color:#0078d4;">User</label>
                        </div>
                        <div style="display:flex;gap:20px;flex:1;overflow:hidden;">
                            <!-- Left: Role Selection -->
                            <div style="width:350px;display:flex;flex-direction:column;">
                                <label style="margin-bottom:10px;display:block;font-weight:600;">Select Roles:</label>
                                <div id="rolesCheckboxes" style="flex:1;overflow-y:auto;border:1px solid #ddd;border-radius:8px;padding:15px;background:#fafafa;">
                                    <!-- Roles will be inserted here by JS -->
                                </div>
                            </div>
                            <!-- Right: Permissions Preview -->
                            <div style="flex:1;display:flex;flex-direction:column;">
                                <label style="margin-bottom:10px;display:block;font-weight:600;">📋 Permissions Preview:</label>
                                <div id="permissionsPreview" style="flex:1;overflow-y:auto;border:1px solid #ddd;border-radius:8px;padding:15px;background:#f8f9fa;">
                                    <div style="text-align:center;color:#666;padding:30px;">
                                        ← Select roles to see permissions
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions" style="margin-top:15px;padding-top:15px;border-top:1px solid #eee;">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="button" class="btn btn-success" onclick="saveRoles()" id="saveRolesBtn">💾 Save Roles & Sync Permissions</button>
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
                    let currentFilter = 'all';
                    
                    function filterByCard(filterType) {
                        currentFilter = filterType;
                        const rows = document.querySelectorAll('#usersTable tbody tr');
                        const cards = document.querySelectorAll('.stat-card');
                        
                        // Update card selection
                        cards.forEach((card, idx) => {
                            card.classList.remove('selected');
                            if ((filterType === 'all' && idx === 0) ||
                                (filterType === 'pending' && idx === 1) ||
                                (filterType === 'active' && idx === 2) ||
                                (filterType === 'with-roles' && idx === 3) ||
                                (filterType === 'no-roles' && idx === 4)) {
                                card.classList.add('selected');
                            }
                        });
                        
                        // Filter rows
                        rows.forEach(row => {
                            const isActive = row.querySelector('.status-badge.active') !== null;
                            const hasRoles = row.querySelector('.role-badge.no-role') === null;
                            const isPending = row.getAttribute('data-approved') === '0';
                            
                            let show = true;
                            if (filterType === 'pending') show = isPending;
                            else if (filterType === 'active') show = isActive;
                            else if (filterType === 'with-roles') show = hasRoles;
                            else if (filterType === 'no-roles') show = !hasRoles;
                            
                            row.style.display = show ? '' : 'none';
                        });
                        
                        // Clear search box
                        document.querySelector('.search-box').value = '';
                    }
                    
                    async function approveUser(userId, userName) {
                        if (!confirm('Approve user "' + userName + '"? They will be able to access the system.')) return;
                        
                        try {
                            const response = await fetch('/admin/users/' + userId + '/approve', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                alert('✅ User approved successfully!');
                                location.reload();
                            } else {
                                alert('Error: ' + (data.error || 'Failed to approve user'));
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    function filterUsers(query) {
                        const rows = document.querySelectorAll('#usersTable tbody tr');
                        query = query.toLowerCase();
                        rows.forEach(row => {
                            const text = row.textContent.toLowerCase();
                            row.style.display = text.includes(query) ? '' : 'none';
                        });
                        // Reset card selection when searching
                        if (query) {
                            document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('selected'));
                        }
                    }
                    
                    function editRoles(userId, currentRoleIds, userName) {
                        currentUserId = userId;
                        document.getElementById('userId').value = userId;
                        document.getElementById('userNameLabel').textContent = '👤 ' + userName;
                        
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
                        
                        // Build checkboxes HTML with onchange handler
                        let html = '';
                        Object.keys(rolesByCategory).forEach(catId => {
                            const roles = rolesByCategory[catId];
                            html += '<div class="role-category">';
                            html += '<div class="role-category-title">' + (roles[0]?.CategoryName || 'Other') + '</div>';
                            roles.forEach(r => {
                                const checked = selectedRoles.includes(r.Id) ? 'checked' : '';
                                html += '<div class="role-checkbox">';
                                html += '<input type="checkbox" id="role_' + r.Id + '" value="' + r.Id + '" ' + checked + ' onchange="updatePermissionsPreview()">';
                                html += '<label for="role_' + r.Id + '">' + r.RoleName + '</label>';
                                html += '</div>';
                            });
                            html += '</div>';
                        });
                        
                        document.getElementById('rolesCheckboxes').innerHTML = html;
                        document.getElementById('roleModal').classList.add('show');
                        
                        // Show initial permissions preview
                        updatePermissionsPreview();
                    }
                    
                    async function updatePermissionsPreview() {
                        const checkboxes = document.querySelectorAll('#rolesCheckboxes input[type="checkbox"]:checked');
                        const roleIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
                        
                        const previewDiv = document.getElementById('permissionsPreview');
                        
                        if (roleIds.length === 0) {
                            previewDiv.innerHTML = '<div style="text-align:center;color:#666;padding:30px;">← Select roles to see permissions</div>';
                            return;
                        }
                        
                        previewDiv.innerHTML = '<div style="text-align:center;padding:20px;"><span style="font-size:20px;">⏳</span> Loading...</div>';
                        
                        try {
                            const response = await fetch('/admin/api/preview-permissions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roleIds })
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                let html = '<div style="margin-bottom:15px;padding:10px;background:#e3f2fd;border-radius:8px;">';
                                html += '<strong>Summary:</strong> ' + data.summary.total + ' forms access<br>';
                                html += '<span style="color:#28a745;">👁 View: ' + data.summary.canView + '</span> | ';
                                html += '<span style="color:#17a2b8;">➕ Create: ' + data.summary.canCreate + '</span> | ';
                                html += '<span style="color:#fd7e14;">✏️ Edit: ' + data.summary.canEdit + '</span> | ';
                                html += '<span style="color:#dc3545;">🗑️ Delete: ' + data.summary.canDelete + '</span>';
                                html += '</div>';
                                
                                // Group by module
                                const byModule = {};
                                data.permissions.forEach(p => {
                                    const mod = p.ModuleName || 'Other';
                                    if (!byModule[mod]) byModule[mod] = [];
                                    byModule[mod].push(p);
                                });
                                
                                Object.keys(byModule).forEach(mod => {
                                    html += '<div style="margin-bottom:12px;">';
                                    html += '<div style="font-weight:600;color:#333;margin-bottom:5px;font-size:13px;">' + mod + '</div>';
                                    byModule[mod].forEach(p => {
                                        html += '<div style="font-size:12px;padding:3px 0;padding-left:10px;border-left:2px solid #ddd;">';
                                        html += p.FormName + ' ';
                                        html += p.CanView ? '<span title="View" style="color:#28a745;">👁</span>' : '';
                                        html += p.CanCreate ? '<span title="Create" style="color:#17a2b8;">➕</span>' : '';
                                        html += p.CanEdit ? '<span title="Edit" style="color:#fd7e14;">✏️</span>' : '';
                                        html += p.CanDelete ? '<span title="Delete" style="color:#dc3545;">🗑️</span>' : '';
                                        html += '</div>';
                                    });
                                    html += '</div>';
                                });
                                
                                previewDiv.innerHTML = html;
                            }
                        } catch (err) {
                            previewDiv.innerHTML = '<div style="color:#dc3545;">Error loading preview</div>';
                        }
                    }
                    
                    function closeModal() {
                        document.getElementById('roleModal').classList.remove('show');
                    }
                    
                    async function saveRoles() {
                        const btn = document.getElementById('saveRolesBtn');
                        btn.disabled = true;
                        btn.textContent = '⏳ Saving...';
                        
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
                                alert('✅ Roles saved and permissions synced successfully!');
                                window.location.reload();
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (err) {
                            alert('Error saving roles: ' + err.message);
                        } finally {
                            btn.disabled = false;
                            btn.textContent = '💾 Save Roles & Sync Permissions';
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
                    
                    // Role Permissions Modal Functions
                    const allCategories = ${categoriesJson};
                    let selectedRoleId = null;
                    
                    function showRolePermissions() {
                        document.getElementById('rolePermissionsModal').classList.add('show');
                        buildRolesList();
                    }
                    
                    function closeRolePermissionsModal() {
                        document.getElementById('rolePermissionsModal').classList.remove('show');
                        selectedRoleId = null;
                    }
                    
                    function buildRolesList() {
                        // Group roles by category
                        const byCategory = {};
                        allRoles.forEach(r => {
                            if (!byCategory[r.CategoryId]) {
                                const cat = allCategories.find(c => c.Id === r.CategoryId);
                                byCategory[r.CategoryId] = { name: cat?.CategoryName || 'Other', accessLevel: cat?.AccessLevel || '', roles: [] };
                            }
                            byCategory[r.CategoryId].roles.push(r);
                        });
                        
                        let html = '';
                        Object.values(byCategory).forEach(cat => {
                            html += '<div style="margin-bottom:20px;">';
                            html += '<div style="font-weight:600;color:#555;margin-bottom:10px;font-size:12px;text-transform:uppercase;">' + cat.name + '</div>';
                            cat.roles.forEach(r => {
                                html += '<div class="role-card" onclick="loadRolePermissions(' + r.Id + ', this)">';
                                html += '<div class="role-card-header">';
                                html += '<span class="role-card-title">' + r.RoleName + '</span>';
                                html += '<span class="role-card-forms">' + (r.FormCount || 0) + ' forms</span>';
                                html += '</div>';
                                html += '</div>';
                            });
                            html += '</div>';
                        });
                        
                        document.getElementById('rolesList').innerHTML = html;
                    }
                    
                    async function loadRolePermissions(roleId, cardElement) {
                        // Update selection
                        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
                        cardElement.classList.add('selected');
                        selectedRoleId = roleId;
                        
                        document.getElementById('roleDetails').innerHTML = '<div style="text-align:center;padding:40px;">Loading...</div>';
                        
                        try {
                            const response = await fetch('/admin/api/role-permissions/' + roleId);
                            const data = await response.json();
                            
                            if (!data.success) {
                                throw new Error(data.error);
                            }
                            
                            let html = '';
                            html += '<h3 style="margin-bottom:10px;">' + data.role.RoleName + '</h3>';
                            html += '<div style="background:#e3f2fd;padding:10px;border-radius:8px;margin-bottom:15px;">';
                            html += '<strong>Category:</strong> ' + data.role.CategoryName + '<br>';
                            html += '<strong>Access Level:</strong> ' + (data.role.AccessLevel || 'Not defined');
                            html += '</div>';
                            
                            if (data.permissions.length === 0) {
                                html += '<div style="color:#999;text-align:center;padding:30px;">No specific form permissions defined for this role.</div>';
                            } else {
                                // Group by module
                                const byModule = {};
                                data.permissions.forEach(p => {
                                    if (!byModule[p.ModuleName]) byModule[p.ModuleName] = [];
                                    byModule[p.ModuleName].push(p);
                                });
                                
                                Object.entries(byModule).forEach(([module, perms]) => {
                                    html += '<div style="margin-bottom:15px;">';
                                    html += '<div style="font-weight:600;color:#333;margin-bottom:8px;">📁 ' + module + '</div>';
                                    html += '<table class="perm-table"><thead><tr><th>Form</th><th style="width:60px;text-align:center;">View</th><th style="width:60px;text-align:center;">Create</th><th style="width:60px;text-align:center;">Edit</th><th style="width:60px;text-align:center;">Delete</th></tr></thead><tbody>';
                                    perms.forEach(p => {
                                        html += '<tr>';
                                        html += '<td>' + p.FormName + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanView ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanCreate ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanEdit ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanDelete ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '</tr>';
                                    });
                                    html += '</tbody></table></div>';
                                });
                            }
                            
                            document.getElementById('roleDetails').innerHTML = html;
                        } catch (err) {
                            document.getElementById('roleDetails').innerHTML = '<div style="color:#dc3545;padding:20px;">Error loading permissions: ' + err.message + '</div>';
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

// API: Get role permissions for a specific role
router.get('/api/role-permissions/:roleId', async (req, res) => {
    try {
        const roleId = parseInt(req.params.roleId);
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                SELECT rfa.FormCode, f.FormName, f.ModuleName, 
                       rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete
                FROM RoleFormAccess rfa
                JOIN Forms f ON rfa.FormCode = f.FormCode
                WHERE rfa.RoleId = @roleId
                ORDER BY f.ModuleName, f.FormName
            `);
        
        const roleInfo = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                SELECT r.Id, r.RoleName, c.CategoryName, c.AccessLevel
                FROM UserRoles r
                JOIN RoleCategories c ON r.CategoryId = c.Id
                WHERE r.Id = @roleId
            `);
        
        await pool.close();
        
        res.json({
            success: true,
            role: roleInfo.recordset[0],
            permissions: result.recordset
        });
    } catch (err) {
        console.error('Error getting role permissions:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Get all roles with their categories
router.get('/api/roles-with-categories', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT r.Id, r.RoleName, c.Id as CategoryId, c.CategoryName, c.AccessLevel,
                   (SELECT COUNT(*) FROM RoleFormAccess WHERE RoleId = r.Id) as FormCount
            FROM UserRoles r
            JOIN RoleCategories c ON r.CategoryId = c.Id
            ORDER BY c.Id, r.RoleName
        `);
        
        await pool.close();
        res.json({ success: true, roles: result.recordset });
    } catch (err) {
        console.error('Error getting roles:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Preview merged permissions for selected roles
router.post('/api/preview-permissions', async (req, res) => {
    try {
        const { roleIds } = req.body;
        const pool = await sql.connect(dbConfig);
        
        if (!roleIds || roleIds.length === 0) {
            await pool.close();
            return res.json({ success: true, permissions: [], summary: { total: 0, canView: 0, canCreate: 0, canEdit: 0, canDelete: 0 } });
        }
        
        // Get merged permissions from selected roles
        const roleIdList = roleIds.join(',');
        const result = await pool.request()
            .query(`
                SELECT f.FormCode, f.FormName, f.ModuleName,
                       MAX(CAST(rfa.CanView AS INT)) as CanView,
                       MAX(CAST(rfa.CanCreate AS INT)) as CanCreate,
                       MAX(CAST(rfa.CanEdit AS INT)) as CanEdit,
                       MAX(CAST(rfa.CanDelete AS INT)) as CanDelete
                FROM RoleFormAccess rfa
                JOIN Forms f ON rfa.FormCode = f.FormCode
                WHERE rfa.RoleId IN (${roleIdList})
                GROUP BY f.FormCode, f.FormName, f.ModuleName
                ORDER BY f.ModuleName, f.FormName
            `);
        
        const permissions = result.recordset;
        const summary = {
            total: permissions.length,
            canView: permissions.filter(p => p.CanView).length,
            canCreate: permissions.filter(p => p.CanCreate).length,
            canEdit: permissions.filter(p => p.CanEdit).length,
            canDelete: permissions.filter(p => p.CanDelete).length
        };
        
        await pool.close();
        res.json({ success: true, permissions, summary });
    } catch (err) {
        console.error('Error previewing permissions:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========== ROLE PERMISSIONS EDITOR ==========

// Page: Edit Role Permissions
router.get('/roles/:roleId/permissions', async (req, res) => {
    try {
        const roleId = parseInt(req.params.roleId);
        const pool = await sql.connect(dbConfig);
        
        // Get role info
        const roleResult = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                SELECT r.Id, r.RoleName, c.CategoryName
                FROM UserRoles r
                JOIN RoleCategories c ON r.CategoryId = c.Id
                WHERE r.Id = @roleId
            `);
        
        if (!roleResult.recordset.length) {
            await pool.close();
            return res.status(404).send('Role not found');
        }
        
        const role = roleResult.recordset[0];
        
        // Get all forms
        const forms = await pool.request().query('SELECT * FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
        
        // Get current role permissions
        const currentPerms = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query('SELECT * FROM RoleFormAccess WHERE RoleId = @roleId');
        
        await pool.close();
        
        const permMap = {};
        currentPerms.recordset.forEach(p => {
            permMap[p.FormCode] = p;
        });
        
        let formRows = forms.recordset.map(f => {
            const perm = permMap[f.FormCode];
            return `
                <tr>
                    <td><span class="module-badge">${f.ModuleName}</span></td>
                    <td><strong>${f.FormName}</strong><br><small style="color:#888">${f.FormCode}</small></td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canView]" value="1" ${perm?.CanView ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canCreate]" value="1" ${perm?.CanCreate ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canEdit]" value="1" ${perm?.CanEdit ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canDelete]" value="1" ${perm?.CanDelete ? 'checked' : ''}>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Edit Role Permissions - ${role.RoleName} - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #6f42c1 0%, #8e44ad 100%);
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
                    .role-info {
                        background: white;
                        border-radius: 15px;
                        padding: 20px 25px;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .role-icon {
                        width: 60px;
                        height: 60px;
                        background: #6f42c1;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 28px;
                    }
                    .role-details h2 { font-size: 20px; margin-bottom: 5px; }
                    .role-details p { color: #666; }
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
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
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
                    .btn-primary { background: #6f42c1; color: white; }
                    .btn-primary:hover { background: #5a32a3; }
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
                    .alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .alert-info { background: #e3f2fd; color: #1565c0; }
                    .search-box {
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        width: 300px;
                        margin-bottom: 15px;
                        transition: border-color 0.3s;
                    }
                    .search-box:focus {
                        outline: none;
                        border-color: #6f42c1;
                    }
                    .filter-row {
                        display: flex;
                        gap: 15px;
                        align-items: center;
                        margin-bottom: 15px;
                        flex-wrap: wrap;
                    }
                    .filter-row label {
                        font-weight: 500;
                        color: #555;
                    }
                    .module-filter {
                        padding: 10px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        min-width: 200px;
                    }
                    .results-count {
                        color: #666;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>✏️ Edit Role Permissions</h1>
                    <div class="header-nav">
                        <a href="/admin/roles">← Back to Roles</a>
                        <a href="/admin/users">User Management</a>
                        <a href="/admin">Admin Panel</a>
                    </div>
                </div>
                <div class="container">
                    <div class="role-info">
                        <div class="role-icon">🎭</div>
                        <div class="role-details">
                            <h2>${role.RoleName}</h2>
                            <p>Category: ${role.CategoryName}</p>
                        </div>
                    </div>
                    
                    <div class="alert alert-info">
                        💡 <strong>Tip:</strong> Changes here affect what forms users with this role can access. After saving, users with this role will get updated permissions on their next role assignment.
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Form Permissions for this Role</div>
                        </div>
                        
                        <div class="filter-row">
                            <label>🔍 Search:</label>
                            <input type="text" class="search-box" id="searchForms" placeholder="Search by form name, module, or code..." oninput="filterForms()">
                            <label>📁 Module:</label>
                            <select class="module-filter" id="moduleFilter" onchange="filterForms()">
                                <option value="">All Modules</option>
                            </select>
                            <span class="results-count" id="resultsCount"></span>
                        </div>
                        
                        <div class="quick-actions">
                            <button type="button" onclick="selectAll()">✓ Select All</button>
                            <button type="button" onclick="deselectAll()">✗ Deselect All</button>
                            <button type="button" onclick="selectViewOnly()">👁 View Only</button>
                            <button type="button" onclick="selectViewCreate()">👁➕ View + Create</button>
                            <button type="button" onclick="selectFullAccess()">🔓 Full Access</button>
                        </div>
                        
                        <form action="/admin/roles/${roleId}/permissions" method="POST">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Module</th>
                                        <th>Form</th>
                                        <th style="text-align:center">👁 View</th>
                                        <th style="text-align:center">➕ Create</th>
                                        <th style="text-align:center">✏️ Edit</th>
                                        <th style="text-align:center">🗑️ Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${formRows}
                                </tbody>
                            </table>
                            
                            <div class="btn-row">
                                <button type="submit" class="btn btn-primary">💾 Save Permissions</button>
                                <a href="/admin/roles" class="btn btn-secondary">Cancel</a>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    // Populate module filter dropdown
                    document.addEventListener('DOMContentLoaded', function() {
                        const modules = new Set();
                        document.querySelectorAll('.module-badge').forEach(badge => {
                            modules.add(badge.textContent.trim());
                        });
                        const select = document.getElementById('moduleFilter');
                        Array.from(modules).sort().forEach(mod => {
                            const option = document.createElement('option');
                            option.value = mod;
                            option.textContent = mod;
                            select.appendChild(option);
                        });
                        updateResultsCount();
                    });

                    function filterForms() {
                        const searchTerm = document.getElementById('searchForms').value.toLowerCase();
                        const moduleFilter = document.getElementById('moduleFilter').value;
                        const rows = document.querySelectorAll('tbody tr');
                        
                        rows.forEach(row => {
                            const module = row.querySelector('.module-badge')?.textContent.toLowerCase() || '';
                            const formName = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
                            
                            const matchesSearch = !searchTerm || 
                                module.includes(searchTerm) || 
                                formName.includes(searchTerm);
                            const matchesModule = !moduleFilter || module.includes(moduleFilter.toLowerCase());
                            
                            row.style.display = (matchesSearch && matchesModule) ? '' : 'none';
                        });
                        updateResultsCount();
                    }

                    function updateResultsCount() {
                        const total = document.querySelectorAll('tbody tr').length;
                        const visible = document.querySelectorAll('tbody tr:not([style*="display: none"])').length;
                        document.getElementById('resultsCount').textContent = 
                            visible === total ? \`Showing all \${total} forms\` : \`Showing \${visible} of \${total} forms\`;
                    }

                    function selectAll() {
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[type="checkbox"]').forEach(cb => cb.checked = true);
                    }
                    function deselectAll() {
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[type="checkbox"]').forEach(cb => cb.checked = false);
                    }
                    function selectViewOnly() {
                        deselectAll();
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[name*="[canView]"]').forEach(cb => cb.checked = true);
                    }
                    function selectViewCreate() {
                        deselectAll();
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[name*="[canView]"], tbody tr:not([style*="display: none"]) input[name*="[canCreate]"]').forEach(cb => cb.checked = true);
                    }
                    function selectFullAccess() {
                        selectAll();
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading role permissions editor:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Save Role Permissions
router.post('/roles/:roleId/permissions', async (req, res) => {
    try {
        const roleId = parseInt(req.params.roleId);
        const forms = req.body.forms || {};
        
        const pool = await sql.connect(dbConfig);
        
        // Delete existing permissions for this role
        await pool.request()
            .input('roleId', sql.Int, roleId)
            .query('DELETE FROM RoleFormAccess WHERE RoleId = @roleId');
        
        // Insert new permissions
        for (const [formCode, perms] of Object.entries(forms)) {
            const canView = perms.canView === '1' ? 1 : 0;
            const canCreate = perms.canCreate === '1' ? 1 : 0;
            const canEdit = perms.canEdit === '1' ? 1 : 0;
            const canDelete = perms.canDelete === '1' ? 1 : 0;
            
            // Only insert if at least one permission is granted
            if (canView || canCreate || canEdit || canDelete) {
                await pool.request()
                    .input('roleId', sql.Int, roleId)
                    .input('formCode', sql.NVarChar, formCode)
                    .input('canView', sql.Bit, canView)
                    .input('canCreate', sql.Bit, canCreate)
                    .input('canEdit', sql.Bit, canEdit)
                    .input('canDelete', sql.Bit, canDelete)
                    .query(`
                        INSERT INTO RoleFormAccess (RoleId, FormCode, CanView, CanCreate, CanEdit, CanDelete, CreatedAt)
                        VALUES (@roleId, @formCode, @canView, @canCreate, @canEdit, @canDelete, GETDATE())
                    `);
            }
        }
        
        // Re-sync permissions for all users who have this role
        await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                DECLARE @UserId INT;
                DECLARE user_cursor CURSOR FOR 
                    SELECT UserId FROM UserRoleAssignments WHERE RoleId = @roleId;
                
                OPEN user_cursor;
                FETCH NEXT FROM user_cursor INTO @UserId;
                
                WHILE @@FETCH_STATUS = 0
                BEGIN
                    EXEC SyncUserPermissions @UserId;
                    FETCH NEXT FROM user_cursor INTO @UserId;
                END;
                
                CLOSE user_cursor;
                DEALLOCATE user_cursor;
            `);
        
        await pool.close();
        
        console.log(`✅ Updated permissions for role ${roleId} and synced affected users`);
        res.redirect('/admin/roles?success=1');
    } catch (err) {
        console.error('Error saving role permissions:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Approve a user
router.post('/users/:userId/approve', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('UPDATE Users SET IsApproved = 1 WHERE Id = @userId');
        
        // Get user info for logging
        const user = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT DisplayName, Email FROM Users WHERE Id = @userId');
        
        await pool.close();
        
        console.log(`✅ User approved: ${user.recordset[0]?.DisplayName} (${user.recordset[0]?.Email})`);
        res.json({ success: true, message: 'User approved successfully' });
    } catch (err) {
        console.error('Error approving user:', err);
        res.status(500).json({ success: false, error: err.message });
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
        
        // AUTO-SYNC: Sync form permissions from assigned roles
        await pool.request()
            .input('userId', sql.Int, userId)
            .execute('SyncUserPermissions');
        
        console.log(`✅ Synced permissions for user ${userId} based on ${roleIds?.length || 0} role(s)`);
        
        await pool.close();
        res.json({ success: true, message: 'Roles and permissions synced successfully' });
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
                    .filter-section {
                        display: flex;
                        gap: 15px;
                        margin-bottom: 20px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        align-items: center;
                        flex-wrap: wrap;
                    }
                    .filter-section label {
                        font-weight: 500;
                        color: #555;
                    }
                    .filter-section select, .filter-section input {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        min-width: 200px;
                    }
                    .filter-section select:focus, .filter-section input:focus {
                        outline: none;
                        border-color: #0078d4;
                    }
                    .form-count {
                        margin-left: auto;
                        color: #666;
                        font-size: 14px;
                    }
                    tr.hidden-row { display: none; }
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
                        
                        <div class="filter-section">
                            <label>🔍 Filter by Module:</label>
                            <select id="moduleFilter" onchange="filterByModule()">
                                <option value="">All Modules</option>
                            </select>
                            <label>Search:</label>
                            <input type="text" id="searchFilter" placeholder="Search form name..." oninput="filterBySearch()">
                            <label>
                                <input type="checkbox" id="showEnabledOnly" onchange="filterForms()"> Show enabled only
                            </label>
                            <span class="form-count" id="formCount"></span>
                        </div>
                        
                        <div class="quick-actions">
                            <button type="button" onclick="selectAll()">Select All (Visible)</button>
                            <button type="button" onclick="deselectAll()">Deselect All (Visible)</button>
                            <button type="button" onclick="selectAllViewCreate()">Enable View & Create (Visible)</button>
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
                    // Populate module filter dropdown
                    function initFilters() {
                        const modules = new Set();
                        document.querySelectorAll('tbody tr').forEach(row => {
                            const moduleCell = row.querySelector('td:first-child .module-badge');
                            if (moduleCell) {
                                modules.add(moduleCell.textContent.trim());
                            }
                        });
                        
                        const select = document.getElementById('moduleFilter');
                        Array.from(modules).sort().forEach(mod => {
                            const option = document.createElement('option');
                            option.value = mod;
                            option.textContent = mod;
                            select.appendChild(option);
                        });
                        
                        updateFormCount();
                    }
                    
                    // Filter forms
                    function filterForms() {
                        const moduleFilter = document.getElementById('moduleFilter').value.toLowerCase();
                        const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
                        const showEnabledOnly = document.getElementById('showEnabledOnly').checked;
                        
                        document.querySelectorAll('tbody tr').forEach(row => {
                            const moduleCell = row.querySelector('td:first-child .module-badge');
                            const formCell = row.querySelector('td:nth-child(2)');
                            const enabledCheckbox = row.querySelector('input[name*="[enabled]"]');
                            
                            if (!moduleCell || !formCell) return;
                            
                            const module = moduleCell.textContent.trim().toLowerCase();
                            const formName = formCell.textContent.trim().toLowerCase();
                            const isEnabled = enabledCheckbox && enabledCheckbox.checked;
                            
                            let show = true;
                            
                            if (moduleFilter && !module.includes(moduleFilter)) show = false;
                            if (searchFilter && !formName.includes(searchFilter)) show = false;
                            if (showEnabledOnly && !isEnabled) show = false;
                            
                            row.classList.toggle('hidden-row', !show);
                        });
                        
                        updateFormCount();
                    }
                    
                    function filterByModule() { filterForms(); }
                    function filterBySearch() { filterForms(); }
                    
                    function updateFormCount() {
                        const total = document.querySelectorAll('tbody tr').length;
                        const visible = document.querySelectorAll('tbody tr:not(.hidden-row)').length;
                        const enabled = document.querySelectorAll('tbody tr input[name*="[enabled]"]:checked').length;
                        document.getElementById('formCount').textContent = \`Showing \${visible} of \${total} forms (\${enabled} enabled)\`;
                    }
                    
                    function selectAll() {
                        document.querySelectorAll('tbody tr:not(.hidden-row) input[type="checkbox"]').forEach(cb => cb.checked = true);
                        updateFormCount();
                    }
                    function deselectAll() {
                        document.querySelectorAll('tbody tr:not(.hidden-row) input[type="checkbox"]').forEach(cb => cb.checked = false);
                        updateFormCount();
                    }
                    function selectAllViewCreate() {
                        document.querySelectorAll('tbody tr:not(.hidden-row) input[name*="[enabled]"], tbody tr:not(.hidden-row) input[name*="[canView]"], tbody tr:not(.hidden-row) input[name*="[canCreate]"]').forEach(cb => cb.checked = true);
                        updateFormCount();
                    }
                    
                    // Update count when checkboxes change
                    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        cb.addEventListener('change', updateFormCount);
                    });
                    
                    // Initialize on page load
                    initFilters();
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
        
        // Clear form access cache so changes take effect immediately
        // (User will need to re-login for session permissions to update, but this helps for testing)
        try {
            const { clearFormMappingsCache } = require('../../gmrl-auth/middleware/require-form-access');
            clearFormMappingsCache();
        } catch (e) { /* ignore */ }
        
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
                   (SELECT COUNT(*) FROM UserRoleAssignments WHERE RoleId = r.Id) as UserCount,
                   (SELECT COUNT(*) FROM RoleFormAccess WHERE RoleId = r.Id) as FormCount
            FROM UserRoles r
            LEFT JOIN RoleCategories rc ON r.CategoryId = rc.Id
            ORDER BY rc.CategoryName, r.RoleName
        `);
        
        const categories = await pool.request().query('SELECT Id, CategoryName FROM RoleCategories ORDER BY Id');
        await pool.close();
        
        const successMsg = req.query.success ? '<div class="alert alert-success">✅ ' + (req.query.msg || 'Operation completed successfully!') + '</div>' : '';
        const errorMsg = req.query.error ? '<div class="alert alert-error">❌ ' + req.query.error + '</div>' : '';
        
        let roleRows = roles.recordset.map(r => `
            <tr data-role-id="${r.Id}">
                <td>${r.Id}</td>
                <td><strong>${r.RoleName}</strong></td>
                <td><span class="category-badge">${r.CategoryName || 'Uncategorized'}</span></td>
                <td><span class="form-count">${r.FormCount} forms</span></td>
                <td><span class="user-count">${r.UserCount} users</span></td>
                <td class="actions-cell">
                    <a href="/admin/roles/${r.Id}/permissions" class="btn btn-primary btn-sm">✏️ Permissions</a>
                    <button class="btn btn-secondary btn-sm" onclick="editRole(${r.Id}, '${r.RoleName.replace(/'/g, "\\'")}', ${r.CategoryId || 'null'})">📝 Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRole(${r.Id}, '${r.RoleName.replace(/'/g, "\\'")}', ${r.UserCount})" ${r.UserCount > 0 ? 'disabled title=\"Cannot delete: role has users assigned\"' : ''}>🗑️</button>
                </td>
            </tr>
        `).join('');
        
        let categoryOptions = categories.recordset.map(c => 
            `<option value="${c.Id}">${c.CategoryName}</option>`
        ).join('');
        
        let categoryFilterOptions = categories.recordset.map(c => 
            `<option value="${c.CategoryName}">${c.CategoryName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Role Management - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #6f42c1 0%, #8e44ad 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a, .header-nav button {
                        color: white;
                        text-decoration: none;
                        margin-left: 15px;
                        opacity: 0.9;
                        background: rgba(255,255,255,0.15);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .header-nav a:hover, .header-nav button:hover { opacity: 1; background: rgba(255,255,255,0.25); }
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
                    .form-count {
                        background: #f3e5f5;
                        color: #7b1fa2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 13px;
                        display: inline-block;
                    }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
                    .btn-primary { background: #6f42c1; color: white; }
                    .btn-primary:hover { background: #5a32a3; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-secondary:hover { background: #545b62; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn-danger:hover { background: #c82333; }
                    .btn-danger:disabled { background: #e9a3a9; cursor: not-allowed; }
                    .alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .alert-success { background: #d4edda; color: #155724; }
                    .alert-error { background: #f8d7da; color: #721c24; }
                    .actions-cell { white-space: nowrap; }
                    .actions-cell .btn { margin-right: 5px; }
                    
                    /* Modal Styles */
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
                        width: 500px;
                        max-width: 90%;
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                    }
                    .modal-title { font-size: 20px; font-weight: 600; }
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
                    .form-group input, .form-group select {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .form-group input:focus, .form-group select:focus {
                        outline: none;
                        border-color: #6f42c1;
                    }
                    .modal-actions {
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                        margin-top: 25px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔐 Role Management</h1>
                    <div class="header-nav">
                        <a href="/admin/roles/download-matrix" style="background:#28a745;">📥 Download Matrix</a>
                        <button onclick="openCreateModal()">➕ Create New Role</button>
                        <a href="/admin">← Admin Panel</a>
                        <a href="/admin/users">User Management</a>
                    </div>
                </div>
                <div class="container">
                    ${successMsg}
                    ${errorMsg}
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">System Roles</div>
                            <div>Total: <span id="roleCount">${roles.recordset.length}</span> roles</div>
                        </div>
                        
                        <!-- Filter Section -->
                        <div style="display:flex; gap:15px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:10px; flex-wrap:wrap; align-items:center;">
                            <div style="flex:1; min-width:200px;">
                                <input type="text" id="searchFilter" placeholder="🔍 Search role name..." 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;"
                                    onkeyup="filterRoles()">
                            </div>
                            <div style="min-width:180px;">
                                <select id="categoryFilter" onchange="filterRoles()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All Categories</option>
                                    ${categoryFilterOptions}
                                </select>
                            </div>
                            <div style="min-width:150px;">
                                <select id="formsFilter" onchange="filterRoles()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All Form Counts</option>
                                    <option value="0">No forms (0)</option>
                                    <option value="1-5">1-5 forms</option>
                                    <option value="6-20">6-20 forms</option>
                                    <option value="21+">21+ forms</option>
                                </select>
                            </div>
                            <div style="min-width:150px;">
                                <select id="usersFilter" onchange="filterRoles()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All User Counts</option>
                                    <option value="0">No users (0)</option>
                                    <option value="1-5">1-5 users</option>
                                    <option value="6+">6+ users</option>
                                </select>
                            </div>
                            <button onclick="clearFilters()" style="padding:10px 20px; background:#6c757d; color:white; border:none; border-radius:8px; cursor:pointer;">
                                ✖ Clear
                            </button>
                        </div>
                        
                        <table id="rolesTable">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Role Name</th>
                                    <th>Category</th>
                                    <th>Forms Access</th>
                                    <th>Users</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roleRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Create/Edit Role Modal -->
                <div class="modal" id="roleModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title" id="modalTitle">Create New Role</div>
                            <button class="modal-close" onclick="closeModal()">×</button>
                        </div>
                        <form id="roleForm">
                            <input type="hidden" id="roleId" name="roleId">
                            <div class="form-group">
                                <label for="roleName">Role Name *</label>
                                <input type="text" id="roleName" name="roleName" required placeholder="e.g., Quality Inspector">
                            </div>
                            <div class="form-group">
                                <label for="categoryId">Category *</label>
                                <select id="categoryId" name="categoryId" required>
                                    <option value="">-- Select Category --</option>
                                    ${categoryOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="description">Description</label>
                                <input type="text" id="description" name="description" placeholder="Brief description of this role">
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                                <button type="submit" class="btn btn-success" id="submitBtn">💾 Create Role</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    let isEditMode = false;
                    
                    // Filter functions
                    function filterRoles() {
                        const searchText = document.getElementById('searchFilter').value.toLowerCase();
                        const categoryFilter = document.getElementById('categoryFilter').value;
                        const formsFilter = document.getElementById('formsFilter').value;
                        const usersFilter = document.getElementById('usersFilter').value;
                        
                        const rows = document.querySelectorAll('#rolesTable tbody tr');
                        let visibleCount = 0;
                        
                        rows.forEach(row => {
                            const roleName = row.cells[1].textContent.toLowerCase();
                            const category = row.cells[2].textContent.trim();
                            const formCount = parseInt(row.cells[3].textContent) || 0;
                            const userCount = parseInt(row.cells[4].textContent) || 0;
                            
                            let show = true;
                            
                            // Search filter
                            if (searchText && !roleName.includes(searchText)) {
                                show = false;
                            }
                            
                            // Category filter
                            if (categoryFilter && !category.includes(categoryFilter)) {
                                show = false;
                            }
                            
                            // Forms count filter
                            if (formsFilter) {
                                if (formsFilter === '0' && formCount !== 0) show = false;
                                else if (formsFilter === '1-5' && (formCount < 1 || formCount > 5)) show = false;
                                else if (formsFilter === '6-20' && (formCount < 6 || formCount > 20)) show = false;
                                else if (formsFilter === '21+' && formCount < 21) show = false;
                            }
                            
                            // Users count filter
                            if (usersFilter) {
                                if (usersFilter === '0' && userCount !== 0) show = false;
                                else if (usersFilter === '1-5' && (userCount < 1 || userCount > 5)) show = false;
                                else if (usersFilter === '6+' && userCount < 6) show = false;
                            }
                            
                            row.style.display = show ? '' : 'none';
                            if (show) visibleCount++;
                        });
                        
                        document.getElementById('roleCount').textContent = visibleCount;
                    }
                    
                    function clearFilters() {
                        document.getElementById('searchFilter').value = '';
                        document.getElementById('categoryFilter').value = '';
                        document.getElementById('formsFilter').value = '';
                        document.getElementById('usersFilter').value = '';
                        filterRoles();
                    }
                    
                    function openCreateModal() {
                        isEditMode = false;
                        document.getElementById('modalTitle').textContent = 'Create New Role';
                        document.getElementById('submitBtn').textContent = '💾 Create Role';
                        document.getElementById('roleId').value = '';
                        document.getElementById('roleName').value = '';
                        document.getElementById('categoryId').value = '';
                        document.getElementById('description').value = '';
                        document.getElementById('roleModal').classList.add('show');
                    }
                    
                    function editRole(id, name, categoryId) {
                        isEditMode = true;
                        document.getElementById('modalTitle').textContent = 'Edit Role';
                        document.getElementById('submitBtn').textContent = '💾 Save Changes';
                        document.getElementById('roleId').value = id;
                        document.getElementById('roleName').value = name;
                        document.getElementById('categoryId').value = categoryId || '';
                        document.getElementById('roleModal').classList.add('show');
                    }
                    
                    function closeModal() {
                        document.getElementById('roleModal').classList.remove('show');
                    }
                    
                    document.getElementById('roleForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const roleId = document.getElementById('roleId').value;
                        const roleName = document.getElementById('roleName').value.trim();
                        const categoryId = document.getElementById('categoryId').value;
                        const description = document.getElementById('description').value.trim();
                        
                        if (!roleName || !categoryId) {
                            alert('Please fill in all required fields');
                            return;
                        }
                        
                        const submitBtn = document.getElementById('submitBtn');
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Saving...';
                        
                        try {
                            const url = isEditMode ? '/admin/api/roles/' + roleId : '/admin/api/roles';
                            const method = isEditMode ? 'PUT' : 'POST';
                            
                            const response = await fetch(url, {
                                method: method,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roleName, categoryId, description })
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = '/admin/roles?success=1&msg=' + encodeURIComponent(data.message);
                            } else {
                                alert('Error: ' + (data.error || 'Failed to save role'));
                                submitBtn.disabled = false;
                                submitBtn.textContent = isEditMode ? '💾 Save Changes' : '💾 Create Role';
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                            submitBtn.disabled = false;
                            submitBtn.textContent = isEditMode ? '💾 Save Changes' : '💾 Create Role';
                        }
                    });
                    
                    async function deleteRole(id, name, userCount) {
                        if (userCount > 0) {
                            alert('Cannot delete role "' + name + '" because it has ' + userCount + ' users assigned.');
                            return;
                        }
                        
                        if (!confirm('Are you sure you want to delete the role "' + name + '"?\\n\\nThis will also delete all form permissions for this role.')) {
                            return;
                        }
                        
                        try {
                            const response = await fetch('/admin/api/roles/' + id, {
                                method: 'DELETE'
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = '/admin/roles?success=1&msg=' + encodeURIComponent('Role deleted successfully');
                            } else {
                                alert('Error: ' + (data.error || 'Failed to delete role'));
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    // Close modal on outside click
                    document.getElementById('roleModal').addEventListener('click', function(e) {
                        if (e.target === this) closeModal();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading roles:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// Role API Endpoints
// ==========================================

// Create new role
router.post('/api/roles', async (req, res) => {
    try {
        const { roleName, categoryId, description } = req.body;
        
        if (!roleName || !categoryId) {
            return res.json({ success: false, error: 'Role name and category are required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Check if role name already exists
        const existing = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .query('SELECT Id FROM UserRoles WHERE RoleName = @roleName');
        
        if (existing.recordset.length > 0) {
            await pool.close();
            return res.json({ success: false, error: 'A role with this name already exists' });
        }
        
        // Insert new role
        const result = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .input('categoryId', sql.Int, categoryId)
            .input('description', sql.NVarChar, description || null)
            .query(`
                INSERT INTO UserRoles (RoleName, CategoryId, Description, CreatedAt)
                OUTPUT INSERTED.Id
                VALUES (@roleName, @categoryId, @description, GETDATE())
            `);
        
        await pool.close();
        
        const newId = result.recordset[0].Id;
        console.log(`✅ Role created: ${roleName} (ID: ${newId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Role created successfully', roleId: newId });
        
    } catch (err) {
        console.error('Error creating role:', err);
        res.json({ success: false, error: err.message });
    }
});

// Update existing role
router.put('/api/roles/:id', async (req, res) => {
    try {
        const roleId = req.params.id;
        const { roleName, categoryId, description } = req.body;
        
        if (!roleName || !categoryId) {
            return res.json({ success: false, error: 'Role name and category are required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Check if role exists
        const existing = await pool.request()
            .input('id', sql.Int, roleId)
            .query('SELECT Id FROM UserRoles WHERE Id = @id');
        
        if (existing.recordset.length === 0) {
            await pool.close();
            return res.json({ success: false, error: 'Role not found' });
        }
        
        // Check if new name conflicts with another role
        const nameConflict = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .input('id', sql.Int, roleId)
            .query('SELECT Id FROM UserRoles WHERE RoleName = @roleName AND Id != @id');
        
        if (nameConflict.recordset.length > 0) {
            await pool.close();
            return res.json({ success: false, error: 'Another role with this name already exists' });
        }
        
        // Update role
        await pool.request()
            .input('id', sql.Int, roleId)
            .input('roleName', sql.NVarChar, roleName)
            .input('categoryId', sql.Int, categoryId)
            .input('description', sql.NVarChar, description || null)
            .query(`
                UPDATE UserRoles 
                SET RoleName = @roleName, CategoryId = @categoryId, Description = @description
                WHERE Id = @id
            `);
        
        await pool.close();
        
        console.log(`✅ Role updated: ${roleName} (ID: ${roleId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Role updated successfully' });
        
    } catch (err) {
        console.error('Error updating role:', err);
        res.json({ success: false, error: err.message });
    }
});

// Delete role
router.delete('/api/roles/:id', async (req, res) => {
    try {
        const roleId = req.params.id;
        
        const pool = await sql.connect(dbConfig);
        
        // Check if role has users assigned
        const userCheck = await pool.request()
            .input('id', sql.Int, roleId)
            .query('SELECT COUNT(*) as cnt FROM UserRoleAssignments WHERE RoleId = @id');
        
        if (userCheck.recordset[0].cnt > 0) {
            await pool.close();
            return res.json({ success: false, error: 'Cannot delete role: it has users assigned' });
        }
        
        // Delete role permissions first
        await pool.request()
            .input('id', sql.Int, roleId)
            .query('DELETE FROM RoleFormAccess WHERE RoleId = @id');
        
        // Delete the role
        await pool.request()
            .input('id', sql.Int, roleId)
            .query('DELETE FROM UserRoles WHERE Id = @id');
        
        await pool.close();
        
        console.log(`✅ Role deleted (ID: ${roleId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Role deleted successfully' });
        
    } catch (err) {
        console.error('Error deleting role:', err);
        res.json({ success: false, error: err.message });
    }
});

// ==========================================
// Cache Management API
// ==========================================

// Clear form access cache (call after updating Forms table or UserFormAccess)
router.post('/api/clear-cache', (req, res) => {
    try {
        const { clearFormMappingsCache } = require('../../gmrl-auth/middleware/require-form-access');
        clearFormMappingsCache();
        res.json({ success: true, message: 'Form access cache cleared' });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ==========================================
// User Impersonation (Admin Only)
// ==========================================

// Impersonate user page
router.get('/impersonate', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const users = await pool.request().query(`
            SELECT u.Id, u.Email, u.DisplayName, u.IsActive, u.IsApproved,
                   (SELECT STRING_AGG(r.RoleName, ', ') FROM UserRoleAssignments ura 
                    JOIN UserRoles r ON ura.RoleId = r.Id WHERE ura.UserId = u.Id) as RoleNames
            FROM Users u
            WHERE u.IsActive = 1 AND u.IsApproved = 1
            ORDER BY u.DisplayName
        `);
        await pool.close();
        
        const currentImpersonation = req.cookies.impersonate_user_id;
        const isImpersonating = !!currentImpersonation;
        
        // Create JSON array for search
        const usersJson = JSON.stringify(users.recordset.map(u => ({
            id: u.Id,
            name: u.DisplayName,
            email: u.Email,
            roles: u.RoleNames || 'No roles'
        })));
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Impersonate User - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
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
                    .container { max-width: 800px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .warning-box {
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 25px;
                    }
                    .warning-box h3 { color: #856404; margin-bottom: 10px; }
                    .warning-box p { color: #856404; font-size: 14px; }
                    .form-group { margin-bottom: 25px; }
                    .form-group label { display: block; margin-bottom: 10px; font-weight: 600; font-size: 16px; }
                    .search-container { position: relative; }
                    .search-input {
                        width: 100%;
                        padding: 15px;
                        border: 2px solid #ddd;
                        border-radius: 10px;
                        font-size: 14px;
                    }
                    .search-input:focus { border-color: #e74c3c; outline: none; }
                    .search-results {
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        background: white;
                        border: 2px solid #e74c3c;
                        border-top: none;
                        border-radius: 0 0 10px 10px;
                        max-height: 300px;
                        overflow-y: auto;
                        display: none;
                        z-index: 100;
                    }
                    .search-results.show { display: block; }
                    .search-item {
                        padding: 12px 15px;
                        cursor: pointer;
                        border-bottom: 1px solid #eee;
                    }
                    .search-item:hover { background: #f8f9fa; }
                    .search-item.selected { background: #e8f4f8; }
                    .search-item-name { font-weight: 600; color: #333; }
                    .search-item-email { font-size: 12px; color: #666; }
                    .search-item-roles { font-size: 11px; color: #888; margin-top: 3px; }
                    .selected-user {
                        background: #d4edda;
                        border: 2px solid #28a745;
                        border-radius: 10px;
                        padding: 15px;
                        margin-top: 15px;
                        display: none;
                    }
                    .selected-user.show { display: block; }
                    .selected-user strong { color: #155724; }
                    .btn {
                        padding: 15px 30px;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        margin-right: 10px;
                    }
                    .btn-danger { background: #e74c3c; color: white; }
                    .btn-danger:hover { background: #c0392b; }
                    .btn-success { background: #27ae60; color: white; }
                    .btn-success:hover { background: #1e8449; }
                    .btn-secondary { background: #95a5a6; color: white; }
                    .btn-secondary:hover { background: #7f8c8d; }
                    .current-status {
                        background: ${isImpersonating ? '#d4edda' : '#f8f9fa'};
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 25px;
                    }
                    .current-status h4 { margin-bottom: 10px; color: ${isImpersonating ? '#155724' : '#333'}; }
                    .user-count { font-size: 12px; color: #888; margin-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎭 User Impersonation</h1>
                    <div class="header-nav">
                        <a href="/admin">← Admin Panel</a>
                        <a href="/admin/users">User Management</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="warning-box">
                            <h3>⚠️ Admin Testing Feature</h3>
                            <p>This allows you to view the app as another user to test their permissions. 
                               Your admin session remains active - you're just seeing what they would see.</p>
                        </div>
                        
                        <div class="current-status">
                            <h4>${isImpersonating ? '🎭 Currently Impersonating' : '👤 Normal Mode'}</h4>
                            <p>${isImpersonating ? 'You are viewing the app as another user. Click "Stop Impersonating" to return to normal.' : 'Search for a user below to test their permissions.'}</p>
                        </div>
                        
                        <form action="/admin/impersonate/start" method="POST" id="impersonateForm">
                            <div class="form-group">
                                <label>🔍 Search User to Impersonate:</label>
                                <div class="search-container">
                                    <input type="text" class="search-input" id="userSearch" placeholder="Type name or email to search..." autocomplete="off">
                                    <input type="hidden" name="userId" id="selectedUserId" required>
                                    <div class="search-results" id="searchResults"></div>
                                </div>
                                <div class="user-count">${users.recordset.length} users available</div>
                                <div class="selected-user" id="selectedUserDisplay">
                                    <strong>Selected:</strong> <span id="selectedUserName"></span>
                                </div>
                            </div>
                            <div>
                                <button type="submit" class="btn btn-danger" id="submitBtn" disabled>🎭 Start Impersonating</button>
                                ${isImpersonating ? '<a href="/admin/impersonate/stop" class="btn btn-success">✓ Stop Impersonating</a>' : ''}
                                <a href="/admin" class="btn btn-secondary">Cancel</a>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    const users = ${usersJson};
                    const searchInput = document.getElementById('userSearch');
                    const searchResults = document.getElementById('searchResults');
                    const selectedUserId = document.getElementById('selectedUserId');
                    const selectedUserDisplay = document.getElementById('selectedUserDisplay');
                    const selectedUserName = document.getElementById('selectedUserName');
                    const submitBtn = document.getElementById('submitBtn');
                    
                    searchInput.addEventListener('input', function() {
                        const query = this.value.toLowerCase().trim();
                        
                        if (query.length < 2) {
                            searchResults.classList.remove('show');
                            return;
                        }
                        
                        const filtered = users.filter(u => 
                            u.name.toLowerCase().includes(query) || 
                            u.email.toLowerCase().includes(query)
                        ).slice(0, 20);
                        
                        if (filtered.length === 0) {
                            searchResults.innerHTML = '<div class="search-item" style="color:#999;">No users found</div>';
                        } else {
                            searchResults.innerHTML = filtered.map(u => \`
                                <div class="search-item" data-id="\${u.id}" data-name="\${u.name}" data-email="\${u.email}">
                                    <div class="search-item-name">\${u.name}</div>
                                    <div class="search-item-email">\${u.email}</div>
                                    <div class="search-item-roles">\${u.roles}</div>
                                </div>
                            \`).join('');
                        }
                        
                        searchResults.classList.add('show');
                    });
                    
                    searchResults.addEventListener('click', function(e) {
                        const item = e.target.closest('.search-item');
                        if (item && item.dataset.id) {
                            selectedUserId.value = item.dataset.id;
                            searchInput.value = item.dataset.name + ' (' + item.dataset.email + ')';
                            selectedUserName.textContent = item.dataset.name + ' (' + item.dataset.email + ')';
                            selectedUserDisplay.classList.add('show');
                            searchResults.classList.remove('show');
                            submitBtn.disabled = false;
                        }
                    });
                    
                    // Close dropdown when clicking outside
                    document.addEventListener('click', function(e) {
                        if (!e.target.closest('.search-container')) {
                            searchResults.classList.remove('show');
                        }
                    });
                    
                    // Show all users on focus if empty
                    searchInput.addEventListener('focus', function() {
                        if (this.value.length < 2) {
                            searchResults.innerHTML = users.slice(0, 20).map(u => \`
                                <div class="search-item" data-id="\${u.id}" data-name="\${u.name}" data-email="\${u.email}">
                                    <div class="search-item-name">\${u.name}</div>
                                    <div class="search-item-email">\${u.email}</div>
                                    <div class="search-item-roles">\${u.roles}</div>
                                </div>
                            \`).join('') + '<div class="search-item" style="color:#999;font-size:11px;">Type to search more...</div>';
                            searchResults.classList.add('show');
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading impersonate page:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Start impersonation
router.post('/impersonate/start', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.redirect('/admin/impersonate?error=No user selected');
        }
        
        // Set impersonation cookie (admin session stays, but we'll load this user's permissions)
        res.cookie('impersonate_user_id', userId, {
            httpOnly: true,
            secure: process.env.APP_URL?.startsWith('https'),
            maxAge: 60 * 60 * 1000 // 1 hour
        });
        
        console.log(`🎭 Admin ${req.currentUser.email} started impersonating user ID ${userId}`);
        
        res.redirect('/dashboard');
        
    } catch (err) {
        console.error('Error starting impersonation:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Stop impersonation
router.get('/impersonate/stop', (req, res) => {
    res.clearCookie('impersonate_user_id');
    console.log(`🎭 Admin ${req.currentUser.email} stopped impersonating`);
    res.redirect('/admin/impersonate');
});

module.exports = router;
