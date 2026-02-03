-- =====================================================
-- OHS Inspection Tables
-- Database: OEApp_UAT
-- Environment: UAT (https://oeapp-uat.gmrlapps.com)
-- Document Prefix: GMRL-OHS
-- =====================================================

USE OEApp_UAT;
GO

-- =====================================================
-- OHS Inspection Templates (Schemas)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionTemplates')
BEGIN
    CREATE TABLE OHS_InspectionTemplates (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500),
        IsDefault BIT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedBy INT,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    PRINT 'OHS_InspectionTemplates table created';
END
GO

-- =====================================================
-- OHS Inspection Template Sections
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionTemplateSections')
BEGIN
    CREATE TABLE OHS_InspectionTemplateSections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateId INT NOT NULL FOREIGN KEY REFERENCES OHS_InspectionTemplates(Id) ON DELETE CASCADE,
        SectionName NVARCHAR(200) NOT NULL,
        SectionIcon NVARCHAR(10) DEFAULT '📋',
        SectionOrder INT DEFAULT 0,
        PassingGrade INT DEFAULT 80,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_OHS_TemplateSections_TemplateId ON OHS_InspectionTemplateSections(TemplateId);
    
    PRINT 'OHS_InspectionTemplateSections table created';
END
GO

-- =====================================================
-- OHS Inspection Template Items (Questions)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionTemplateItems')
BEGIN
    CREATE TABLE OHS_InspectionTemplateItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SectionId INT NOT NULL FOREIGN KEY REFERENCES OHS_InspectionTemplateSections(Id) ON DELETE CASCADE,
        ReferenceValue NVARCHAR(50),
        Question NVARCHAR(1000) NOT NULL,
        Coefficient DECIMAL(5,2) DEFAULT 1,
        AnswerOptions NVARCHAR(200) DEFAULT 'Yes,Partially,No,NA',
        Criteria NVARCHAR(MAX),
        ItemOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_OHS_TemplateItems_SectionId ON OHS_InspectionTemplateItems(SectionId);
    
    PRINT 'OHS_InspectionTemplateItems table created';
END
GO

-- =====================================================
-- OHS Inspections (Main Table)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_Inspections')
BEGIN
    CREATE TABLE OHS_Inspections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        DocumentNumber NVARCHAR(50) NOT NULL UNIQUE,
        
        -- Store Information
        StoreId INT,
        StoreName NVARCHAR(200),
        
        -- Template Reference
        TemplateId INT FOREIGN KEY REFERENCES OHS_InspectionTemplates(Id),
        
        -- Date/Time
        InspectionDate DATE NOT NULL,
        TimeIn TIME,
        TimeOut TIME,
        Cycle NVARCHAR(10),
        Year INT,
        
        -- Personnel
        Inspectors NVARCHAR(500),
        AccompaniedBy NVARCHAR(500),
        
        -- Scores
        Score DECIMAL(5,2),
        TotalPoints DECIMAL(10,2),
        MaxPoints DECIMAL(10,2),
        
        -- Status
        Status NVARCHAR(50) DEFAULT 'Draft', -- Draft, In Progress, Completed, Approved
        Comments NVARCHAR(MAX),
        
        -- Report
        ReportFileName NVARCHAR(255),
        ReportGeneratedAt DATETIME2,
        
        -- Audit
        CreatedBy INT,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        UpdatedBy INT,
        CompletedAt DATETIME2,
        ApprovedBy INT,
        ApprovedAt DATETIME2
    );
    
    CREATE INDEX IX_OHS_Inspections_StoreId ON OHS_Inspections(StoreId);
    CREATE INDEX IX_OHS_Inspections_Status ON OHS_Inspections(Status);
    CREATE INDEX IX_OHS_Inspections_InspectionDate ON OHS_Inspections(InspectionDate);
    CREATE INDEX IX_OHS_Inspections_DocumentNumber ON OHS_Inspections(DocumentNumber);
    
    PRINT 'OHS_Inspections table created';
END
GO

-- =====================================================
-- OHS Inspection Sections (Per Inspection)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionSections')
BEGIN
    CREATE TABLE OHS_InspectionSections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL FOREIGN KEY REFERENCES OHS_Inspections(Id) ON DELETE CASCADE,
        SectionName NVARCHAR(200) NOT NULL,
        SectionIcon NVARCHAR(10) DEFAULT '📋',
        SectionOrder INT DEFAULT 0,
        Score DECIMAL(5,2),
        TotalPoints DECIMAL(10,2),
        MaxPoints DECIMAL(10,2),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_OHS_InspectionSections_InspectionId ON OHS_InspectionSections(InspectionId);
    
    PRINT 'OHS_InspectionSections table created';
END
GO

-- =====================================================
-- OHS Inspection Items (Responses)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionItems')
BEGIN
    CREATE TABLE OHS_InspectionItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL FOREIGN KEY REFERENCES OHS_Inspections(Id) ON DELETE CASCADE,
        SectionName NVARCHAR(200),
        SectionOrder INT DEFAULT 0,
        ItemOrder INT DEFAULT 0,
        ReferenceValue NVARCHAR(50),
        Question NVARCHAR(1000),
        Coefficient DECIMAL(5,2) DEFAULT 1,
        AnswerOptions NVARCHAR(200) DEFAULT 'Yes,Partially,No,NA',
        Criteria NVARCHAR(MAX),
        
        -- Response
        Answer NVARCHAR(50),
        Score DECIMAL(5,2),
        Finding NVARCHAR(MAX),
        Comment NVARCHAR(MAX),
        CorrectedAction NVARCHAR(MAX),
        Priority NVARCHAR(20), -- High, Medium, Low
        
        -- Escalation
        Escalate BIT DEFAULT 0,
        Department NVARCHAR(100), -- Maintenance, Procurement, Cleaning, etc.
        
        -- Pictures
        HasPicture BIT DEFAULT 0,
        PictureUrl NVARCHAR(MAX),
        
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    CREATE INDEX IX_OHS_InspectionItems_InspectionId ON OHS_InspectionItems(InspectionId);
    CREATE INDEX IX_OHS_InspectionItems_Department ON OHS_InspectionItems(Department);
    
    PRINT 'OHS_InspectionItems table created';
END
GO

-- =====================================================
-- OHS Inspection Pictures
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionPictures')
BEGIN
    CREATE TABLE OHS_InspectionPictures (
        Id INT PRIMARY KEY IDENTITY(1,1),
        ItemId INT FOREIGN KEY REFERENCES OHS_InspectionItems(Id) ON DELETE CASCADE,
        InspectionId INT FOREIGN KEY REFERENCES OHS_Inspections(Id),
        FileName NVARCHAR(255),
        ContentType NVARCHAR(100),
        PictureType NVARCHAR(50), -- finding, corrective, good
        FileData NVARCHAR(MAX), -- Base64 encoded
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_OHS_InspectionPictures_ItemId ON OHS_InspectionPictures(ItemId);
    CREATE INDEX IX_OHS_InspectionPictures_InspectionId ON OHS_InspectionPictures(InspectionId);
    
    PRINT 'OHS_InspectionPictures table created';
END
GO

-- =====================================================
-- OHS Inspection Action Items
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionActionItems')
BEGIN
    CREATE TABLE OHS_InspectionActionItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL FOREIGN KEY REFERENCES OHS_Inspections(Id) ON DELETE CASCADE,
        ReferenceValue NVARCHAR(50),
        SectionName NVARCHAR(200),
        Finding NVARCHAR(MAX),
        SuggestedAction NVARCHAR(MAX),
        Action NVARCHAR(MAX),
        Responsible NVARCHAR(255),
        Deadline DATE,
        Priority NVARCHAR(20) DEFAULT 'Medium',
        Status NVARCHAR(50) DEFAULT 'Open', -- Open, In Progress, Completed
        Department NVARCHAR(100),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        CompletedAt DATETIME2
    );
    
    CREATE INDEX IX_OHS_ActionItems_InspectionId ON OHS_InspectionActionItems(InspectionId);
    CREATE INDEX IX_OHS_ActionItems_Status ON OHS_InspectionActionItems(Status);
    
    PRINT 'OHS_InspectionActionItems table created';
END
GO

-- =====================================================
-- OHS Inspection Settings
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_InspectionSettings')
BEGIN
    CREATE TABLE OHS_InspectionSettings (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(MAX),
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    -- Insert default settings
    INSERT INTO OHS_InspectionSettings (SettingKey, SettingValue, Description) VALUES 
        ('DOCUMENT_PREFIX', 'GMRL-OHS', 'Document number prefix for OHS inspections'),
        ('PASSING_SCORE', '80', 'Overall passing score threshold (%)'),
        ('COMPANY_NAME', 'GMRL', 'Company name for reports');
    
    PRINT 'OHS_InspectionSettings table created with defaults';
END
GO

PRINT '✅ OHS Inspection Tables setup completed successfully';
GO
