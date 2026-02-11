-- Cleaning Checklist Tables for Facility Management
-- Run on both OEApp_UAT and OEApp_Live databases

-- Cleaning Locations (Dbayeh, Zouk)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_CleaningLocations')
BEGIN
    CREATE TABLE Security_CleaningLocations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LocationName NVARCHAR(100) NOT NULL,
        LocationNameAr NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(200) NULL
    );
    
    -- Insert default locations
    INSERT INTO Security_CleaningLocations (LocationName, LocationNameAr, SortOrder) VALUES 
    ('Dbayeh', N'ضبية', 1),
    ('Zouk', N'زوق', 2);
    
    PRINT 'Security_CleaningLocations table created';
END
GO

-- Cleaning Categories (Toilets, Canteens per location)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_CleaningCategories')
BEGIN
    CREATE TABLE Security_CleaningCategories (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LocationId INT NOT NULL,
        CategoryName NVARCHAR(100) NOT NULL,
        CategoryNameAr NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(200) NULL,
        
        CONSTRAINT FK_CleaningCategories_Location FOREIGN KEY (LocationId) 
            REFERENCES Security_CleaningLocations(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Security_CleaningCategories_LocationId ON Security_CleaningCategories(LocationId);
    
    -- Insert default categories for Dbayeh (LocationId = 1)
    INSERT INTO Security_CleaningCategories (LocationId, CategoryName, CategoryNameAr, SortOrder) VALUES 
    (1, 'Toilets', N'دورات المياه', 1),
    (1, 'Canteens', N'المقاصف', 2);
    
    -- Insert default categories for Zouk (LocationId = 2)
    INSERT INTO Security_CleaningCategories (LocationId, CategoryName, CategoryNameAr, SortOrder) VALUES 
    (2, 'Toilets', N'دورات المياه', 1),
    (2, 'Canteens', N'المقاصف', 2);
    
    PRINT 'Security_CleaningCategories table created';
END
GO

-- Cleaning Items (Reference items per category)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_CleaningItems')
BEGIN
    CREATE TABLE Security_CleaningItems (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CategoryId INT NOT NULL,
        ItemName NVARCHAR(200) NOT NULL,
        ItemNameAr NVARCHAR(200) NULL,
        Frequency NVARCHAR(100) NOT NULL, -- 'Daily', 'Every 4 hours', etc.
        FrequencyAr NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CreatedBy NVARCHAR(200) NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy NVARCHAR(200) NULL,
        
        CONSTRAINT FK_CleaningItems_Category FOREIGN KEY (CategoryId) 
            REFERENCES Security_CleaningCategories(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Security_CleaningItems_CategoryId ON Security_CleaningItems(CategoryId);
    
    PRINT 'Security_CleaningItems table created';
END
GO

-- Main Cleaning Checklist (header record per week/location/category)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_CleaningChecklists')
BEGIN
    CREATE TABLE Security_CleaningChecklists (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LocationId INT NOT NULL,
        CategoryId INT NOT NULL,
        WeekStartDate DATE NOT NULL, -- Monday of the week
        FilledBy NVARCHAR(200) NOT NULL,
        FilledById INT NULL,
        Status NVARCHAR(20) DEFAULT 'Active', -- 'Active', 'Completed', 'Deleted'
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        CONSTRAINT FK_CleaningChecklists_Location FOREIGN KEY (LocationId) 
            REFERENCES Security_CleaningLocations(Id),
        CONSTRAINT FK_CleaningChecklists_Category FOREIGN KEY (CategoryId) 
            REFERENCES Security_CleaningCategories(Id)
    );
    
    CREATE INDEX IX_Security_CleaningChecklists_WeekStartDate ON Security_CleaningChecklists(WeekStartDate);
    CREATE INDEX IX_Security_CleaningChecklists_LocationId ON Security_CleaningChecklists(LocationId);
    CREATE INDEX IX_Security_CleaningChecklists_CategoryId ON Security_CleaningChecklists(CategoryId);
    CREATE UNIQUE INDEX IX_Security_CleaningChecklists_Unique ON Security_CleaningChecklists(LocationId, CategoryId, WeekStartDate) WHERE Status = 'Active';
    
    PRINT 'Security_CleaningChecklists table created';
END
GO

-- Cleaning Checklist Entries (checkmarks per item per day)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_CleaningChecklistEntries')
BEGIN
    CREATE TABLE Security_CleaningChecklistEntries (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ChecklistId INT NOT NULL,
        ItemId INT NOT NULL,
        Monday BIT DEFAULT 0,
        Tuesday BIT DEFAULT 0,
        Wednesday BIT DEFAULT 0,
        Thursday BIT DEFAULT 0,
        Friday BIT DEFAULT 0,
        Notes NVARCHAR(500) NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy NVARCHAR(200) NULL,
        
        CONSTRAINT FK_CleaningChecklistEntries_Checklist FOREIGN KEY (ChecklistId) 
            REFERENCES Security_CleaningChecklists(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CleaningChecklistEntries_Item FOREIGN KEY (ItemId) 
            REFERENCES Security_CleaningItems(Id)
    );
    
    CREATE INDEX IX_Security_CleaningChecklistEntries_ChecklistId ON Security_CleaningChecklistEntries(ChecklistId);
    CREATE UNIQUE INDEX IX_Security_CleaningChecklistEntries_Unique ON Security_CleaningChecklistEntries(ChecklistId, ItemId);
    
    PRINT 'Security_CleaningChecklistEntries table created';
END
GO

PRINT 'Cleaning Checklist tables setup complete';
