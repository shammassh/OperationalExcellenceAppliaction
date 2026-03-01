-- ==========================================
-- Add Dashboard Menu Fields to Forms Table
-- This allows admin to control which forms appear on dashboard
-- ==========================================

-- Add new columns for dashboard display
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'MenuId')
    ALTER TABLE Forms ADD MenuId NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'DashboardIcon')
    ALTER TABLE Forms ADD DashboardIcon NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'DashboardCategory')
    ALTER TABLE Forms ADD DashboardCategory NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'DashboardCategoryIcon')
    ALTER TABLE Forms ADD DashboardCategoryIcon NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'DashboardCategoryColor')
    ALTER TABLE Forms ADD DashboardCategoryColor NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'DashboardTitle')
    ALTER TABLE Forms ADD DashboardTitle NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'DashboardDescription')
    ALTER TABLE Forms ADD DashboardDescription NVARCHAR(255) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'ShowOnDashboard')
    ALTER TABLE Forms ADD ShowOnDashboard BIT DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'DashboardSortOrder')
    ALTER TABLE Forms ADD DashboardSortOrder INT DEFAULT 100;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'CategorySortOrder')
    ALTER TABLE Forms ADD CategorySortOrder INT DEFAULT 100;

PRINT 'Dashboard columns added to Forms table';
GO

-- ==========================================
-- Update existing forms with dashboard menu data
-- ==========================================

-- Operational Excellence Category (Sort 1)
UPDATE Forms SET 
    MenuId = 'oe', 
    DashboardIcon = N'📊', 
    DashboardCategory = 'Operational Excellence',
    DashboardCategoryIcon = N'📊',
    DashboardCategoryColor = '#0078d4',
    DashboardTitle = 'Dashboard', 
    DashboardDescription = 'Operational Excellence reports & analytics',
    ShowOnDashboard = 1,
    CategorySortOrder = 1,
    DashboardSortOrder = 1
WHERE FormCode = 'OP_EXCELLENCE';

UPDATE Forms SET 
    MenuId = 'oe-inspection', 
    DashboardIcon = N'🔍', 
    DashboardCategory = 'Operational Excellence',
    DashboardCategoryIcon = N'📊',
    DashboardCategoryColor = '#0078d4',
    DashboardTitle = 'OE Inspection', 
    DashboardDescription = 'OE site inspections & audits',
    ShowOnDashboard = 1,
    CategorySortOrder = 1,
    DashboardSortOrder = 2
WHERE FormCode = 'OE_INSPECTION';

UPDATE Forms SET 
    MenuId = 'master-table', 
    DashboardIcon = N'📊', 
    DashboardCategory = 'Operational Excellence',
    DashboardCategoryIcon = N'📊',
    DashboardCategoryColor = '#0078d4',
    DashboardTitle = 'Master Table', 
    DashboardDescription = 'Third-party staff master data',
    ShowOnDashboard = 1,
    CategorySortOrder = 1,
    DashboardSortOrder = 3
WHERE FormCode = 'MASTER_TABLE';

-- Add Store Visit Calendar if not exists
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'STORE_VISIT_CALENDAR')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('STORE_VISIT_CALENDAR', 'Store Visit Calendar', 'Operational Excellence', '/operational-excellence/calendar', 'Schedule & track employee store visits', 1, 'store-visit-calendar', N'📅', 'Operational Excellence', N'📊', '#0078d4', 'Store Visit Calendar', 'Schedule & track employee store visits', 1, 1, 4);
ELSE
    UPDATE Forms SET 
        MenuId = 'store-visit-calendar', 
        DashboardIcon = N'📅', 
        DashboardCategory = 'Operational Excellence',
        DashboardCategoryIcon = N'📊',
        DashboardCategoryColor = '#0078d4',
        DashboardTitle = 'Store Visit Calendar', 
        DashboardDescription = 'Schedule & track employee store visits',
        ShowOnDashboard = 1,
        CategorySortOrder = 1,
        DashboardSortOrder = 4
    WHERE FormCode = 'STORE_VISIT_CALENDAR';

-- OHS Category (Sort 2)
UPDATE Forms SET 
    MenuId = 'ohs', 
    DashboardIcon = N'🦺', 
    DashboardCategory = 'Occupational Health & Safety',
    DashboardCategoryIcon = N'🦺',
    DashboardCategoryColor = '#28a745',
    DashboardTitle = 'OHS Incidents', 
    DashboardDescription = 'OHS incidents & reports',
    ShowOnDashboard = 1,
    CategorySortOrder = 2,
    DashboardSortOrder = 1
WHERE FormCode = 'OHS_DASHBOARD';

UPDATE Forms SET 
    MenuId = 'ohs-inspection', 
    DashboardIcon = N'🛡️', 
    DashboardCategory = 'Occupational Health & Safety',
    DashboardCategoryIcon = N'🦺',
    DashboardCategoryColor = '#28a745',
    DashboardTitle = 'OHS Inspection', 
    DashboardDescription = 'OHS safety inspections & audits',
    ShowOnDashboard = 1,
    CategorySortOrder = 2,
    DashboardSortOrder = 2
WHERE FormCode = 'OHS_INSPECTION';

UPDATE Forms SET 
    MenuId = 'fire-equipment', 
    DashboardIcon = N'🧯', 
    DashboardCategory = 'Occupational Health & Safety',
    DashboardCategoryIcon = N'🦺',
    DashboardCategoryColor = '#28a745',
    DashboardTitle = 'Fire Equipment', 
    DashboardDescription = 'Fire fighting equipment register',
    ShowOnDashboard = 1,
    CategorySortOrder = 2,
    DashboardSortOrder = 3
WHERE FormCode = 'OHS_FIRE_EQUIPMENT';

UPDATE Forms SET 
    MenuId = 'ora', 
    DashboardIcon = N'📋', 
    DashboardCategory = 'Occupational Health & Safety',
    DashboardCategoryIcon = N'🦺',
    DashboardCategoryColor = '#28a745',
    DashboardTitle = 'Risk Assessment (ORA)', 
    DashboardDescription = 'Overall Risk Assessment',
    ShowOnDashboard = 1,
    CategorySortOrder = 2,
    DashboardSortOrder = 4
WHERE FormCode = 'OHS_ORA';

-- Facility Management Category (Sort 3)
UPDATE Forms SET 
    MenuId = 'security-services', 
    DashboardIcon = N'🏢', 
    DashboardCategory = 'Facility Management',
    DashboardCategoryIcon = N'🏢',
    DashboardCategoryColor = '#6f42c1',
    DashboardTitle = 'Facility Services', 
    DashboardDescription = 'Facility services & management',
    ShowOnDashboard = 1,
    CategorySortOrder = 3,
    DashboardSortOrder = 1
WHERE FormCode = 'SEC_SERVICES_DASHBOARD';

UPDATE Forms SET 
    MenuId = 'security', 
    DashboardIcon = N'🔧', 
    DashboardCategory = 'Facility Management',
    DashboardCategoryIcon = N'🏢',
    DashboardCategoryColor = '#6f42c1',
    DashboardTitle = 'Facility Department', 
    DashboardDescription = 'Facility incidents & inspections',
    ShowOnDashboard = 1,
    CategorySortOrder = 3,
    DashboardSortOrder = 2
WHERE FormCode = 'SECURITY_DASHBOARD';

-- Security Department Category (Sort 4)
-- Add Legal Cases if not exists
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_LEGAL_CASES')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_LEGAL_CASES', 'Legal Cases', 'Security Department', '/security-emp/legal-cases', 'Track and manage security legal cases', 1, 'legal-cases', N'⚖️', 'Security Department', N'🔒', '#343a40', 'Legal Cases', 'Track and manage security legal cases', 1, 4, 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_BLACKLIST')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_BLACKLIST', 'Third Party Blacklist', 'Security Department', '/security-emp/blacklist', 'Blacklisted third-party staff', 1, 'thirdparty-blacklist', N'🚫', 'Security Department', N'🔒', '#343a40', 'Third Party Blacklist', 'Blacklisted third-party staff', 1, 4, 2);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_DAILY_REPORTING')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_DAILY_REPORTING', 'Daily Reporting', 'Security Department', '/security-emp/daily-reporting', 'Security guard daily reports', 1, 'security-daily-reporting', N'📋', 'Security Department', N'🔒', '#343a40', 'Daily Reporting', 'Security guard daily reports', 1, 4, 3);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_VISIT_CALENDAR')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_VISIT_CALENDAR', 'Visit Schedule', 'Security Department', '/security-emp/calendar', 'View and update store visit schedules', 1, 'sec-visit-calendar', N'📅', 'Security Department', N'🔒', '#343a40', 'Visit Schedule', 'View and update store visit schedules', 1, 4, 4);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_CAMERA_REQUEST')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_CAMERA_REQUEST', 'Camera Request', 'Security Department', '/security-emp/camera-request', 'Camera requests and malfunction reports', 1, 'camera-request', N'📹', 'Security Department', N'🔒', '#343a40', 'Camera Request', 'Camera requests and malfunction reports', 1, 4, 5);

-- Store Operations Category (Sort 5)
UPDATE Forms SET 
    MenuId = 'stores', 
    DashboardIcon = N'🏪', 
    DashboardCategory = 'Store Operations',
    DashboardCategoryIcon = N'🏪',
    DashboardCategoryColor = '#fd7e14',
    DashboardTitle = 'Store Forms', 
    DashboardDescription = 'Store operations & management',
    ShowOnDashboard = 1,
    CategorySortOrder = 5,
    DashboardSortOrder = 1
WHERE FormCode = 'STORES_DASHBOARD';

UPDATE Forms SET 
    MenuId = 'personnel', 
    DashboardIcon = N'👤', 
    DashboardCategory = 'Store Operations',
    DashboardCategoryIcon = N'🏪',
    DashboardCategoryColor = '#fd7e14',
    DashboardTitle = 'Personnel', 
    DashboardDescription = 'Personnel forms & requests',
    ShowOnDashboard = 1,
    CategorySortOrder = 5,
    DashboardSortOrder = 2
WHERE FormCode = 'PERSONNEL_DASHBOARD';

-- Add Third Party if not exists
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'THIRDPARTY_SERVICES')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('THIRDPARTY_SERVICES', 'Third-Party Services', 'Store Operations', '/third-party', 'Service providers & compliance', 1, 'thirdparty', N'🤝', 'Store Operations', N'🏪', '#fd7e14', 'Third-Party Services', 'Service providers & compliance', 1, 5, 3);

-- Mackenzie F&B Category (Sort 6)
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'MAKNEZI_FNB')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('MAKNEZI_FNB', 'Production Extras Request', 'Mackenzie F&B', '/stores/production-extras', 'Request extra production items', 1, 'maknezi-fnb', N'👷', 'Mackenzie F&B and GMRL', N'🍽️', '#dc3545', 'Production Extras Request', 'Request extra production items', 1, 6, 1);

-- HR & Talent Category (Sort 7)
UPDATE Forms SET 
    MenuId = 'hr', 
    DashboardIcon = N'👥', 
    DashboardCategory = 'HR & Talent',
    DashboardCategoryIcon = N'👥',
    DashboardCategoryColor = '#e83e8c',
    DashboardTitle = 'HR Dashboard', 
    DashboardDescription = 'Employee relations & cases',
    ShowOnDashboard = 1,
    CategorySortOrder = 7,
    DashboardSortOrder = 1
WHERE FormCode = 'HR_DASHBOARD';

-- Communication Category (Sort 8)
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'BROADCAST')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('BROADCAST', 'Broadcast', 'Communication', '/admin/broadcast', 'Send announcements to users', 1, 'broadcast', N'📢', 'Communication', N'📢', '#17a2b8', 'Broadcast', 'Send announcements to users', 1, 8, 1);

PRINT 'Dashboard menu data populated';
GO

-- Verify the results
SELECT 
    FormCode, 
    MenuId, 
    DashboardCategory, 
    DashboardTitle, 
    DashboardIcon,
    ShowOnDashboard,
    CategorySortOrder,
    DashboardSortOrder
FROM Forms 
WHERE ShowOnDashboard = 1 
ORDER BY CategorySortOrder, DashboardSortOrder;
