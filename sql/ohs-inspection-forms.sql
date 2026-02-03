-- OHS Inspection Forms Registration
-- Run this script on both OEApp_UAT and OEApp_Live databases

USE OEApp_UAT;
GO

-- Insert OHS Inspection forms into Forms registry
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'OHS_INSPECTION_START')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, IsActive)
    VALUES ('OHS_INSPECTION_START', 'Start New OHS Inspection', 'OHS Inspection', '/ohs-inspection/start', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'OHS_INSPECTION_LIST')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, IsActive)
    VALUES ('OHS_INSPECTION_LIST', 'OHS Inspection List', 'OHS Inspection', '/ohs-inspection/list', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'OHS_INSPECTION_TEMPLATES')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, IsActive)
    VALUES ('OHS_INSPECTION_TEMPLATES', 'OHS Template Builder', 'OHS Inspection', '/ohs-inspection/template-builder', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'OHS_INSPECTION_ACTION_PLANS')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, IsActive)
    VALUES ('OHS_INSPECTION_ACTION_PLANS', 'OHS Action Plans', 'OHS Inspection', '/ohs-inspection/action-plans', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'OHS_INSPECTION_DEPT_REPORTS')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, IsActive)
    VALUES ('OHS_INSPECTION_DEPT_REPORTS', 'OHS Department Follow-up Reports', 'OHS Inspection', '/ohs-inspection/department-reports', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'OHS_INSPECTION_SETTINGS')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, IsActive)
    VALUES ('OHS_INSPECTION_SETTINGS', 'OHS Inspection Settings', 'OHS Inspection', '/ohs-inspection/settings', 1);

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'OHS_INSPECTION_STORES')
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, IsActive)
    VALUES ('OHS_INSPECTION_STORES', 'OHS Store Management', 'OHS Inspection', '/ohs-inspection/store-management', 1);

PRINT 'OHS Inspection forms registered in OEApp_UAT';
GO
