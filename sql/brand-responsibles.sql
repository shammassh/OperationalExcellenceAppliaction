-- =============================================
-- Brand Responsibles Setup Script
-- Creates OE_BrandResponsibles table for
-- Area Manager and Head of Operations per Brand
-- Run on both UAT and LIVE databases
-- =============================================

-- =============================================
-- 1. Create OE_BrandResponsibles Table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_BrandResponsibles')
BEGIN
    CREATE TABLE OE_BrandResponsibles (
        Id INT PRIMARY KEY IDENTITY(1,1),
        BrandId INT NOT NULL,
        AreaManagerId INT NULL,           -- FK to Users table
        HeadOfOpsId INT NULL,             -- FK to Users table
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME2 NULL,
        UpdatedBy INT NULL,
        
        -- Foreign key constraints
        CONSTRAINT FK_BrandResponsibles_Brand FOREIGN KEY (BrandId) REFERENCES Brands(Id),
        CONSTRAINT FK_BrandResponsibles_AreaManager FOREIGN KEY (AreaManagerId) REFERENCES Users(Id),
        CONSTRAINT FK_BrandResponsibles_HeadOfOps FOREIGN KEY (HeadOfOpsId) REFERENCES Users(Id)
    );

    -- Create unique index to ensure one responsible record per brand
    CREATE UNIQUE INDEX IX_BrandResponsibles_BrandId ON OE_BrandResponsibles(BrandId) WHERE IsActive = 1;
    
    -- Create index for faster lookups
    CREATE INDEX IX_BrandResponsibles_AreaManager ON OE_BrandResponsibles(AreaManagerId);
    CREATE INDEX IX_BrandResponsibles_HeadOfOps ON OE_BrandResponsibles(HeadOfOpsId);
    
    PRINT 'OE_BrandResponsibles table created successfully';
END
ELSE
BEGIN
    PRINT 'OE_BrandResponsibles table already exists';
END
GO

-- =============================================
-- 2. Create View for Easy Querying
-- =============================================
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_BrandResponsibles')
BEGIN
    DROP VIEW vw_BrandResponsibles;
END
GO

CREATE VIEW vw_BrandResponsibles AS
SELECT 
    br.Id,
    br.BrandId,
    b.BrandName,
    b.BrandCode,
    br.AreaManagerId,
    am.DisplayName AS AreaManagerName,
    am.Email AS AreaManagerEmail,
    br.HeadOfOpsId,
    ho.DisplayName AS HeadOfOpsName,
    ho.Email AS HeadOfOpsEmail,
    br.Notes,
    br.IsActive,
    br.CreatedAt,
    br.UpdatedAt
FROM OE_BrandResponsibles br
INNER JOIN Brands b ON br.BrandId = b.Id
LEFT JOIN Users am ON br.AreaManagerId = am.Id
LEFT JOIN Users ho ON br.HeadOfOpsId = ho.Id
WHERE br.IsActive = 1;
GO

PRINT 'vw_BrandResponsibles view created successfully';
GO

-- =============================================
-- 3. Sample Query for Getting CC Recipients
-- =============================================
/*
-- Get CC recipients for an inspection by AuditId
-- This query is used in the email recipients endpoint

SELECT 
    br.AreaManagerId,
    am.DisplayName AS AreaManagerName,
    am.Email AS AreaManagerEmail,
    br.HeadOfOpsId,
    ho.DisplayName AS HeadOfOpsName,
    ho.Email AS HeadOfOpsEmail
FROM OE_Inspections i
INNER JOIN Stores s ON i.StoreId = s.Id
INNER JOIN Brands b ON s.BrandId = b.Id
INNER JOIN OE_BrandResponsibles br ON br.BrandId = b.Id AND br.IsActive = 1
LEFT JOIN Users am ON br.AreaManagerId = am.Id AND am.IsActive = 1
LEFT JOIN Users ho ON br.HeadOfOpsId = ho.Id AND ho.IsActive = 1
WHERE i.Id = @AuditId;
*/

PRINT '';
PRINT 'Brand Responsibles setup completed successfully!';
PRINT 'Remember to run this script on both UAT and LIVE databases.';
GO
