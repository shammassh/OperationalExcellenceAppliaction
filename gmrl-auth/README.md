# GMRL Auth Module

Reusable Azure AD authentication with User Management for all GMRL Node.js apps.

## Features

- **Azure AD SSO Login** - Single Sign-On with Microsoft 365
- **Role-Based Access Control** - Admin, Auditor, Super Auditor roles
- **User Management Admin Panel** - Manage users, roles, and approvals
- **Azure AD User Sync** - Import users from Azure AD directory
- **Session Management** - Secure cookie-based sessions with SQL storage

## Quick Start (New Project)

### Step 1: Copy auth folder to your new project

`powershell
Copy-Item -Path "F:\shared-modules\gmrl-auth\*" -Destination "YOUR_PROJECT\auth\" -Recurse
`

### Step 2: Add to your .env file

`env
# Azure AD Configuration
AZURE_TENANT_ID=b99fc2f6-d65e-4b48-935b-118659097da7
AZURE_CLIENT_ID=9c916e84-9ff1-4e15-9d76-0a87cb974c30
AZURE_CLIENT_SECRET=your-client-secret-here

# App URL (change for each app)
APP_URL=https://your-app.gmrlapps.com
REDIRECT_URI=https://your-app.gmrlapps.com/auth/callback

# SQL Server (for session/user storage)
SQL_SERVER=localhost
SQL_DATABASE=YourAppDB
SQL_USER=sa
SQL_PASSWORD=your-password
SQL_ENCRYPT=false
SQL_TRUST_CERT=true

# Session
SESSION_SECRET=generate-random-string-here
`

### Step 3: Add to Azure AD

Go to Azure Portal -> App Registrations -> Your App -> Authentication

Add redirect URI:
`
https://your-new-app.gmrlapps.com/auth/callback
`

### Step 4: Use in your app.js

`javascript
const express = require('express');
const { initializeAuth, requireAuth, requireRole } = require('./auth/auth-server');

const app = express();

// Initialize authentication
initializeAuth(app);

// Public route
app.get('/', (req, res) => {
    res.send('Welcome! <a href="/auth/login">Login</a>');
});

// Protected route (any logged-in user)
app.get('/dashboard', requireAuth, (req, res) => {
    res.send('Hello ' + req.currentUser.displayName + '!');
});

// Admin-only route
app.get('/admin', requireAuth, requireRole('admin', 'super_auditor'), (req, res) => {
    res.send('Admin Panel');
});

// Start server
app.listen(3001, () => {
    console.log('Server running on port 3001');
});
`

### Step 5: Create database tables

Run the SQL script to create Users, Sessions, and UserRoles tables:

`powershell
sqlcmd -S localhost -U sa -P "YOUR_PASSWORD" -d YourAppDB -i "auth/sql/auth-tables.sql"
`

## User Management Admin Panel

The module includes a complete User Management interface for admins.

### Features:
- **Dashboard Cards** - Total users, role breakdown, pending/active/inactive counts
- **Clickable Filters** - Click stat cards to filter the table
- **Azure AD Sync** - Import users from your organization's Azure AD
- **Role Assignment** - Assign auditor, admin, or super_auditor roles
- **User Approval** - Approve or reject pending user requests
- **Activate/Deactivate** - Enable or disable user access

### Accessing User Management:
Navigate to: /admin/users

Only users with dmin or super_auditor role can access this page.

### User Roles:

| Role | Description |
|------|-------------|
| pending | New users waiting for approval |
| uditor | Standard user with form access |
| dmin | Can manage users and settings |
| super_auditor | Full access including user management |

## Available Functions

| Function | Description |
|----------|-------------|
| initializeAuth(app) | Sets up all auth routes |
| equireAuth | Middleware - must be logged in |
| equireRole('admin') | Middleware - must have specific role |
| equireRole('admin', 'super_auditor') | Middleware - must have one of the roles |

## Auth Routes (auto-created)

| Route | Description |
|-------|-------------|
| /auth/login | Login page |
| /auth/callback | OAuth callback (Azure redirects here) |
| /auth/logout | Logout |
| /auth/session | Get current user info (JSON) |
| /admin/users | User management page (Admin only) |
| /api/admin/users | API - List all users |
| /api/admin/users/:id | API - Update user |
| /api/admin/users/:id/role | API - Update user role |
| /api/admin/users/:id/status | API - Update user status |
| /api/admin/sync-users | API - Sync users from Azure AD |

## Folder Structure

`
auth/
|-- auth-server.js              # Main entry point
|-- middleware/
|   |-- require-auth.js         # Auth middleware
|   |-- require-role.js         # Role middleware
|-- pages/
|   |-- login.js                # Login page
|   |-- pending-approval.js     # Pending approval page
|-- services/
|   |-- session-manager.js      # Session handling
|   |-- oauth-callback-handler.js  # OAuth flow
|   |-- logout-handler.js       # Logout handling
|-- scripts/                    # Frontend JS
|-- styles/                     # CSS
|-- sql/
|   |-- auth-tables.sql         # Database schema
|
admin/                          # User Management Module
|-- pages/
|   |-- user-management.html    # Admin UI page
|   |-- user-management.js      # Page route handler
|-- scripts/
|   |-- user-management.js      # Frontend JS
|-- services/
|   |-- role-assignment-service.js    # User CRUD operations
|   |-- sharepoint-users-service.js   # Azure AD user sync
|   |-- graph-users-service.js        # Microsoft Graph API client
|-- styles/
|   |-- user-management.css     # Admin page styles
`

## Azure AD Permissions Required

For User Sync to work, the Azure AD app needs these **delegated** permissions:
- User.ReadBasic.All - Read all users' basic profiles
- Sites.Read.All - (Optional) Read SharePoint site data

## Notes

- All apps share the SAME Azure AD app registration
- Just add new redirect URIs for each app
- Users table can be shared or separate per app
- Roles are app-specific (configure in each app's database)
- User sync requires a logged-in admin to provide the access token


