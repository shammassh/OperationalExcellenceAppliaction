-- Add Post Visit Report Form to Registry
-- Run on both UAT and Live databases

-- Add the form to Forms registry
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_POST_VISIT_REPORT')
BEGIN
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_POST_VISIT_REPORT', 'Post Visit Report', 'Security Department', '/security-emp/post-visit-report', 'Post-visit reports for security assessments', 1, 'post-visit-report', N'📋', 'Security Department', N'🔒', '#343a40', 'Post Visit Report', 'Post-visit reports for security assessments', 1, 4, 6);
    
    PRINT 'Post Visit Report form added to Forms registry successfully!';
END
ELSE
BEGIN
    PRINT 'Post Visit Report form already exists in Forms registry.';
END
