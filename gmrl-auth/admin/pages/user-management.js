/**
 * User Management Page
 * Admin page for managing user roles and approvals
 */

class UserManagementPage {
    static render(users, currentUser) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management - FS Monitoring</title>
    <link rel="stylesheet" href="/admin/styles/user-management.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>User Management</h1>
            <p>Logged in as: ${currentUser.display_name}</p>
        </header>
        
        <main>
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.display_name}</td>
                            <td>${user.email}</td>
                            <td>${user.role}</td>
                            <td>${user.status}</td>
                            <td>
                                <select onchange="updateRole('${user.id}', this.value)">
                                    <option value="pending" ${user.role === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="auditor" ${user.role === 'auditor' ? 'selected' : ''}>Auditor</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </main>
    </div>
    <script src="/admin/scripts/user-management.js"></script>
</body>
</html>`;
    }
}

module.exports = UserManagementPage;
