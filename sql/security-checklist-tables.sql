-- Security Checklist Tables
-- Run on both OEApp_UAT and OEApp_Live databases

-- =============================================
-- REFERENCE TABLES (Setup by Supervisor)
-- =============================================

-- Locations table (e.g., Dbayeh, Zouk)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_Checklist_Locations')
BEGIN
    CREATE TABLE Security_Checklist_Locations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LocationName NVARCHAR(100) NOT NULL,
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(200) NULL,
        UpdatedAt DATETIME NULL
    );
    
    CREATE INDEX IX_Security_Checklist_Locations_Active ON Security_Checklist_Locations(IsActive);
    
    PRINT 'Security_Checklist_Locations table created';
END
GO

-- Sub-categories table (e.g., HO Block A, Block B, Control Room)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_Checklist_SubCategories')
BEGIN
    CREATE TABLE Security_Checklist_SubCategories (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LocationId INT NOT NULL,
        SubCategoryName NVARCHAR(100) NOT NULL,
        HasAMShift BIT DEFAULT 1,
        HasPMShift BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(200) NULL,
        UpdatedAt DATETIME NULL,
        
        CONSTRAINT FK_SubCategories_Location FOREIGN KEY (LocationId) 
            REFERENCES Security_Checklist_Locations(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Security_Checklist_SubCategories_Location ON Security_Checklist_SubCategories(LocationId);
    CREATE INDEX IX_Security_Checklist_SubCategories_Active ON Security_Checklist_SubCategories(IsActive);
    
    PRINT 'Security_Checklist_SubCategories table created';
END
GO

-- Checklist Items table (e.g., Premises Keys: 22, Napkins Keys: 12)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_Checklist_Items')
BEGIN
    CREATE TABLE Security_Checklist_Items (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SubCategoryId INT NOT NULL,
        ItemName NVARCHAR(200) NOT NULL,
        ExpectedCount INT NULL, -- Optional: expected count to verify (e.g., 22 for keys)
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(200) NULL,
        UpdatedAt DATETIME NULL,
        
        CONSTRAINT FK_Items_SubCategory FOREIGN KEY (SubCategoryId) 
            REFERENCES Security_Checklist_SubCategories(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Security_Checklist_Items_SubCategory ON Security_Checklist_Items(SubCategoryId);
    CREATE INDEX IX_Security_Checklist_Items_Active ON Security_Checklist_Items(IsActive);
    
    PRINT 'Security_Checklist_Items table created';
END
GO

-- =============================================
-- ENTRY TABLES (Filled by Security Staff)
-- =============================================

-- Main Checklist Entry (one per week per subcategory)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_Checklist_Entries')
BEGIN
    CREATE TABLE Security_Checklist_Entries (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SubCategoryId INT NOT NULL,
        WeekStartDate DATE NOT NULL, -- Monday of the week
        FilledBy NVARCHAR(200) NOT NULL,
        FilledById NVARCHAR(100) NULL,
        Notes NVARCHAR(500) NULL,
        Status NVARCHAR(20) DEFAULT 'Active', -- 'Active', 'Deleted'
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        CONSTRAINT FK_Entries_SubCategory FOREIGN KEY (SubCategoryId) 
            REFERENCES Security_Checklist_SubCategories(Id)
    );
    
    CREATE INDEX IX_Security_Checklist_Entries_SubCategory ON Security_Checklist_Entries(SubCategoryId);
    CREATE INDEX IX_Security_Checklist_Entries_WeekStart ON Security_Checklist_Entries(WeekStartDate);
    CREATE UNIQUE INDEX IX_Security_Checklist_Entries_Unique ON Security_Checklist_Entries(SubCategoryId, WeekStartDate) WHERE Status = 'Active';
    
    PRINT 'Security_Checklist_Entries table created';
END
GO

-- Checklist Entry Details (checkboxes for each item/day/shift)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_Checklist_EntryDetails')
BEGIN
    CREATE TABLE Security_Checklist_EntryDetails (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EntryId INT NOT NULL,
        ItemId INT NOT NULL,
        DayOfWeek INT NOT NULL, -- 1=Monday, 2=Tuesday, ..., 7=Sunday
        AMChecked BIT DEFAULT 0,
        PMChecked BIT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        CONSTRAINT FK_EntryDetails_Entry FOREIGN KEY (EntryId) 
            REFERENCES Security_Checklist_Entries(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EntryDetails_Item FOREIGN KEY (ItemId) 
            REFERENCES Security_Checklist_Items(Id)
    );
    
    CREATE INDEX IX_Security_Checklist_EntryDetails_Entry ON Security_Checklist_EntryDetails(EntryId);
    CREATE UNIQUE INDEX IX_Security_Checklist_EntryDetails_Unique ON Security_Checklist_EntryDetails(EntryId, ItemId, DayOfWeek);
    
    PRINT 'Security_Checklist_EntryDetails table created';
END
GO

PRINT 'Security Checklist tables setup complete';
