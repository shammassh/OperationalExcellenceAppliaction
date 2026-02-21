-- =============================================
-- Brands Setup Script
-- Creates Brands table, adds BrandId to Stores,
-- seeds initial brands, and auto-migrates stores
-- Run on both UAT and LIVE databases
-- =============================================

-- =============================================
-- 1. Create Brands Table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Brands')
BEGIN
    CREATE TABLE Brands (
        Id INT PRIMARY KEY IDENTITY(1,1),
        BrandName NVARCHAR(100) NOT NULL,
        BrandCode NVARCHAR(20) NOT NULL,
        LogoUrl NVARCHAR(500) NULL,
        PrimaryColor NVARCHAR(20) NULL,  -- For email template styling
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME2 NULL,
        UpdatedBy INT NULL
    );

    -- Create unique index on BrandCode
    CREATE UNIQUE INDEX IX_Brands_BrandCode ON Brands(BrandCode);
    
    PRINT 'Brands table created successfully';
END
ELSE
BEGIN
    PRINT 'Brands table already exists';
END
GO

-- =============================================
-- 2. Seed Initial Brands
-- =============================================
-- Spinneys
IF NOT EXISTS (SELECT 1 FROM Brands WHERE BrandCode = 'SPINNEYS')
BEGIN
    INSERT INTO Brands (BrandName, BrandCode, PrimaryColor, IsActive)
    VALUES ('Spinneys', 'SPINNEYS', '#1a5f2a', 1);
    PRINT 'Inserted brand: Spinneys';
END

-- Happy
IF NOT EXISTS (SELECT 1 FROM Brands WHERE BrandCode = 'HAPPY')
BEGIN
    INSERT INTO Brands (BrandName, BrandCode, PrimaryColor, IsActive)
    VALUES ('Happy', 'HAPPY', '#ff6b00', 1);
    PRINT 'Inserted brand: Happy';
END

-- NokNok
IF NOT EXISTS (SELECT 1 FROM Brands WHERE BrandCode = 'NOKNOK')
BEGIN
    INSERT INTO Brands (BrandName, BrandCode, PrimaryColor, IsActive)
    VALUES ('NokNok', 'NOKNOK', '#7c3aed', 1);
    PRINT 'Inserted brand: NokNok';
END

-- GMRL (Corporate/Default)
IF NOT EXISTS (SELECT 1 FROM Brands WHERE BrandCode = 'GMRL')
BEGIN
    INSERT INTO Brands (BrandName, BrandCode, PrimaryColor, IsActive)
    VALUES ('GMRL', 'GMRL', '#667eea', 1);
    PRINT 'Inserted brand: GMRL';
END
GO

-- =============================================
-- 3. Add BrandId Column to Stores Table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Stores') AND name = 'BrandId')
BEGIN
    ALTER TABLE Stores ADD BrandId INT NULL;
    
    -- Add foreign key constraint
    ALTER TABLE Stores ADD CONSTRAINT FK_Stores_Brands 
        FOREIGN KEY (BrandId) REFERENCES Brands(Id);
    
    PRINT 'BrandId column added to Stores table';
END
ELSE
BEGIN
    PRINT 'BrandId column already exists in Stores table';
END
GO

-- =============================================
-- 4. Auto-Migrate Existing Stores to Brands
-- =============================================
PRINT 'Starting auto-migration of stores to brands...';

-- Migrate Happy stores
UPDATE Stores 
SET BrandId = (SELECT Id FROM Brands WHERE BrandCode = 'HAPPY'),
    UpdatedAt = GETDATE()
WHERE (StoreName LIKE '%Happy%' OR StoreName LIKE '%HAPPY%')
  AND (BrandId IS NULL OR BrandId = 0);

DECLARE @HappyCount INT = @@ROWCOUNT;
PRINT 'Migrated ' + CAST(@HappyCount AS VARCHAR) + ' stores to Happy brand';

-- Migrate NokNok stores
UPDATE Stores 
SET BrandId = (SELECT Id FROM Brands WHERE BrandCode = 'NOKNOK'),
    UpdatedAt = GETDATE()
WHERE (StoreName LIKE '%NokNok%' OR StoreName LIKE '%Nok Nok%' OR StoreName LIKE '%Nok-Nok%')
  AND (BrandId IS NULL OR BrandId = 0);

DECLARE @NokNokCount INT = @@ROWCOUNT;
PRINT 'Migrated ' + CAST(@NokNokCount AS VARCHAR) + ' stores to NokNok brand';

-- Migrate remaining stores to Spinneys (default brand)
UPDATE Stores 
SET BrandId = (SELECT Id FROM Brands WHERE BrandCode = 'SPINNEYS'),
    UpdatedAt = GETDATE()
WHERE BrandId IS NULL OR BrandId = 0;

DECLARE @SpinneysCount INT = @@ROWCOUNT;
PRINT 'Migrated ' + CAST(@SpinneysCount AS VARCHAR) + ' stores to Spinneys brand (default)';

GO

-- =============================================
-- 5. Verification Query
-- =============================================
PRINT '';
PRINT '=== Migration Summary ===';
SELECT 
    b.BrandName,
    b.BrandCode,
    COUNT(s.Id) AS StoreCount
FROM Brands b
LEFT JOIN Stores s ON s.BrandId = b.Id
GROUP BY b.BrandName, b.BrandCode
ORDER BY b.BrandName;

PRINT '';
PRINT 'Brands setup completed successfully!';
PRINT 'Remember to run this script on both UAT and LIVE databases.';
GO
