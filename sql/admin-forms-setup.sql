-- ==========================================
-- Add Admin Module Forms to Registry
-- Run this script on both UAT and Live databases
-- ==========================================

-- Insert Admin module forms if they don't exist
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_DASHBOARD')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_DASHBOARD', 'Admin Dashboard', 'Admin', '/admin', 'Main admin panel', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_USERS')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_USERS', 'User Management', 'Admin', '/admin/users', 'Manage users and permissions', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_ROLES')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_ROLES', 'Role Management', 'Admin', '/admin/roles', 'Manage user roles', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_FORMS')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_FORMS', 'Form Registry', 'Admin', '/admin/forms', 'Manage form registry', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_STORES')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_STORES', 'Store Management', 'Admin', '/admin/stores', 'Manage stores', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_IMPERSONATE')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_IMPERSONATE', 'Impersonate User', 'Admin', '/admin/impersonate', 'Impersonate another user', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_SESSIONS')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_SESSIONS', 'Session Monitor', 'Admin', '/admin/sessions', 'Monitor active sessions and detect duplicates', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'ADMIN_NOTIFICATIONS')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES ('ADMIN_NOTIFICATIONS', 'Notification History', 'Admin', '/admin/notification-history', 'View notification history', 1);

-- Verify the forms were added
SELECT FormCode, FormName, ModuleName, FormUrl, IsActive 
FROM Forms 
WHERE ModuleName = 'Admin'
ORDER BY FormCode;

PRINT 'Admin module forms added successfully!';
PRINT 'Now go to Admin > Role Management to assign permissions to roles.';
