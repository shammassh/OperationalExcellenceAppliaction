-- ==========================================
-- Add ORA (Overall Risk Assessment) Forms to Registry
-- Run this on both UAT and Live databases
-- ==========================================

-- Insert ORA forms using MERGE
MERGE INTO Forms AS target
USING (VALUES
    ('OHS_ORA', 'Risk Assessment (ORA)', 'OHS', '/ohs/ora', 'Overall Risk Assessment management'),
    ('OHS_ORA_ADMIN', 'ORA Admin Setup', 'OHS', '/ohs/ora/admin', 'Configure hazard categories and risk matrix')
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

PRINT 'ORA forms added to registry';
GO

-- Verify the forms were added
SELECT FormCode, FormName, ModuleName, FormUrl, IsActive 
FROM Forms 
WHERE FormCode LIKE 'OHS_ORA%'
ORDER BY FormCode;
GO
