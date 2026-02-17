-- ==========================================
-- Forms Registry Setup for Dynamic Permission System
-- Run this script to populate/update the Forms table
-- ==========================================

-- Make sure Forms table exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Forms')
BEGIN
    CREATE TABLE Forms (
        Id INT PRIMARY KEY IDENTITY(1,1),
        FormCode NVARCHAR(100) NOT NULL UNIQUE,
        FormName NVARCHAR(255) NOT NULL,
        ModuleName NVARCHAR(100) NOT NULL,
        FormUrl NVARCHAR(500),  -- URL pattern for matching
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    PRINT 'Forms table created';
END
GO

-- Clear existing forms (optional - comment out if you want to keep existing)
-- DELETE FROM Forms;
-- DBCC CHECKIDENT ('Forms', RESEED, 0);

-- ==========================================
-- Insert/Update Forms Registry
-- Each form has a URL pattern that the middleware will match
-- ==========================================

-- Helper: Insert or Update form
-- Using MERGE to insert new or update existing

MERGE INTO Forms AS target
USING (VALUES
    -- OHS Module
    ('OHS_DASHBOARD', 'OHS Dashboard', 'OHS', '/ohs', 'Main OHS landing page'),
    ('OHS_SETTINGS', 'OHS Settings', 'OHS', '/ohs/settings', 'OHS configuration and settings'),
    ('OHS_INCIDENT', 'OHS Incident Reporting', 'OHS', '/stores/ohs-incident', 'Report and manage OHS incidents'),
    
    -- OHS Inspection Module
    ('OHS_INSPECTION', 'OHS Inspection', 'OHS Inspection', '/ohs-inspection', 'OHS inspection forms and checklists'),
    ('OHS_INSPECTION_NEW', 'Create OHS Inspection', 'OHS Inspection', '/ohs-inspection/new', 'Create new OHS inspection'),
    ('OHS_INSPECTION_TEMPLATES', 'OHS Inspection Templates', 'OHS Inspection', '/ohs-inspection/templates', 'Manage OHS inspection templates'),
    
    -- OE Inspection Module
    ('OE_INSPECTION', 'OE Inspection', 'OE Inspection', '/oe-inspection', 'Operational Excellence inspections'),
    ('OE_INSPECTION_NEW', 'Create OE Inspection', 'OE Inspection', '/oe-inspection/new', 'Create new OE inspection'),
    ('OE_INSPECTION_TEMPLATES', 'OE Inspection Templates', 'OE Inspection', '/oe-inspection/templates', 'Manage OE inspection templates'),
    
    -- Operational Excellence Module
    ('OP_EXCELLENCE', 'Operational Excellence', 'Operational Excellence', '/operational-excellence', 'Operational Excellence dashboard'),
    ('OP_ATTENDANCE', 'Attendance Dashboard', 'Operational Excellence', '/operational-excellence/attendance', 'View attendance reports'),
    ('OP_COMPLAINTS', 'Complaints Dashboard', 'Operational Excellence', '/operational-excellence/complaints', 'Manage complaints'),
    ('OP_FEEDBACK', 'Feedback Dashboard', 'Operational Excellence', '/operational-excellence/feedback', 'Weekly feedback management'),
    ('OP_PRODUCTION', 'Production Dashboard', 'Operational Excellence', '/operational-excellence/production', 'Production extras management'),
    ('OP_THIRDPARTY', 'Third Party Dashboard', 'Operational Excellence', '/operational-excellence/thirdparty', 'Third party attendance'),
    ('OP_THEFT', 'Theft Dashboard', 'Operational Excellence', '/operational-excellence/theft', 'Theft incident reporting'),
    ('OP_EXTRA_CLEANING', 'Extra Cleaning Review', 'Operational Excellence', '/operational-excellence/extra-cleaning', 'Extra cleaning requests'),
    ('OP_FIVE_DAYS', 'Five Days Dashboard', 'Operational Excellence', '/operational-excellence/five-days', 'Five days entries'),
    
    -- Security Module
    ('SECURITY_DASHBOARD', 'Security Dashboard', 'Security', '/security', 'Main security department dashboard'),
    ('SECURITY_DELIVERY_LOG', 'Delivery Logs', 'Security', '/security/delivery-logs', 'Manage delivery logs'),
    ('SECURITY_PATROL', 'Patrol Sheets', 'Security', '/security/patrol-sheets', 'Security patrol records'),
    ('SECURITY_ENTRANCE', 'Entrance Forms', 'Security', '/security/entrance-forms', 'Entrance gate records'),
    ('SECURITY_ATTENDANCE', 'Security Attendance', 'Security', '/security/attendance', 'Security staff attendance'),
    ('SECURITY_VISITOR_CARS', 'Visitor Cars', 'Security', '/security/visitor-cars', 'Visitor vehicle records'),
    ('SECURITY_PARKING', 'Parking Violations', 'Security', '/security/parking-violations', 'Parking violation records'),
    ('SECURITY_CHECKLIST', 'Security Checklist Reference', 'Security', '/security/checklist-reference', 'Checklist management'),
    ('SECURITY_CLEANING', 'Cleaning Reference', 'Security', '/security/cleaning-reference', 'Cleaning checklist reference'),
    
    -- Security Services Module (Store-level)
    ('SEC_SERVICES_DASHBOARD', 'Security Services', 'Security Services', '/security-services', 'Store-level security services'),
    ('SEC_CHECKLIST', 'Security Checklist', 'Security Services', '/security-services/checklist', 'Daily security checklist'),
    ('SEC_CLEANING_CHECKLIST', 'Cleaning Checklist', 'Security Services', '/security-services/cleaning-checklist', 'Cleaning inspection checklist'),
    
    -- Stores Module
    ('STORES_DASHBOARD', 'Stores Dashboard', 'Stores', '/stores', 'Stores module landing page'),
    ('STORES_CLEANING', 'Store Cleaning', 'Stores', '/stores/cleaning', 'Store cleaning management'),
    ('STORES_COMPLAINTS', 'Store Complaints', 'Stores', '/stores/complaints', 'Store complaint submission'),
    ('STORES_FEEDBACK', 'Store Feedback', 'Stores', '/stores/feedback', 'Weekly feedback submission'),
    ('STORES_THEFT', 'Theft Reporting', 'Stores', '/stores/theft', 'Report theft incidents'),
    
    -- HR Module
    ('HR_DASHBOARD', 'HR Dashboard', 'HR', '/hr', 'Human Resources dashboard'),
    
    -- Personnel Module
    ('PERSONNEL_DASHBOARD', 'Personnel', 'Personnel', '/personnel', 'Personnel management'),
    
    -- Admin Module
    ('ADMIN_DASHBOARD', 'Admin Dashboard', 'Admin', '/admin', 'Main admin panel'),
    ('ADMIN_USERS', 'User Management', 'Admin', '/admin/users', 'Manage users and permissions'),
    ('ADMIN_ROLES', 'Role Management', 'Admin', '/admin/roles', 'Manage user roles'),
    ('ADMIN_FORMS', 'Form Registry', 'Admin', '/admin/forms', 'Manage form registry'),
    ('ADMIN_STORES', 'Store Management', 'Admin', '/admin/stores', 'Manage stores'),
    ('ADMIN_IMPERSONATE', 'Impersonate User', 'Admin', '/admin/impersonate', 'Impersonate another user'),
    ('ADMIN_SESSIONS', 'Session Monitor', 'Admin', '/admin/sessions', 'Monitor active sessions and detect duplicates'),
    ('ADMIN_NOTIFICATIONS', 'Notification History', 'Admin', '/admin/notification-history', 'View notification history')
    
) AS source (FormCode, FormName, ModuleName, FormUrl, Description)
ON target.FormCode = source.FormCode
WHEN MATCHED THEN
    UPDATE SET 
        FormName = source.FormName,
        ModuleName = source.ModuleName,
        FormUrl = source.FormUrl,
        Description = source.Description,
        UpdatedAt = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
    VALUES (source.FormCode, source.FormName, source.ModuleName, source.FormUrl, source.Description, 1);

PRINT 'Forms registry updated';
GO

-- ==========================================
-- View the current forms
-- ==========================================
SELECT FormCode, FormName, ModuleName, FormUrl, IsActive 
FROM Forms 
ORDER BY ModuleName, FormCode;
GO

-- ==========================================
-- Example: Grant a user access to specific forms
-- ==========================================
-- DECLARE @UserId INT = 3744; -- Cesar's user ID
-- 
-- -- Give view access to OHS Inspection
-- INSERT INTO UserFormAccess (UserId, FormCode, CanView, CanCreate, CanEdit, CanDelete, AssignedAt)
-- VALUES (@UserId, 'OHS_INSPECTION', 1, 0, 0, 0, GETDATE());
-- 
-- -- Give full access to Security Dashboard
-- INSERT INTO UserFormAccess (UserId, FormCode, CanView, CanCreate, CanEdit, CanDelete, AssignedAt)
-- VALUES (@UserId, 'SECURITY_DASHBOARD', 1, 1, 1, 1, GETDATE());

PRINT 'Setup complete! The permission system is now SQL-driven.';
PRINT 'Use the Admin Panel > User Management > Manage Forms to assign permissions.';
