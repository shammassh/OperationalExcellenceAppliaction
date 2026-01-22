-- =====================================================
-- OE Inspection Module - Database Tables
-- Run this on OEApp_UAT and OEApp_Live databases
-- =====================================================

USE OEApp_UAT;
GO

-- =====================================================
-- OE Inspection Settings Table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionSettings')
BEGIN
    CREATE TABLE OE_InspectionSettings (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(500),
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    -- Insert default settings
    INSERT INTO OE_InspectionSettings (SettingKey, SettingValue, Description) VALUES 
        ('DOCUMENT_PREFIX', 'GMRL-OEI', 'Document number prefix for inspections'),
        ('PASSING_SCORE', '83', 'Minimum passing score percentage'),
        ('SECTION_PASSING_SCORE', '83', 'Minimum section passing score percentage'),
        ('DEFAULT_DEADLINE_DAYS', '7', 'Default days for action plan deadline');
    
    PRINT 'OE_InspectionSettings table created with defaults';
END
GO

-- =====================================================
-- OE Inspections Table (Main inspection records)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_Inspections')
BEGIN
    CREATE TABLE OE_Inspections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        DocumentNumber NVARCHAR(50) NOT NULL UNIQUE,
        StoreId INT,
        StoreName NVARCHAR(200),
        InspectionDate DATE NOT NULL,
        TimeIn TIME,
        TimeOut TIME,
        Inspectors NVARCHAR(500),
        AccompaniedBy NVARCHAR(500),
        Cycle NVARCHAR(10),
        Year INT,
        Status NVARCHAR(50) DEFAULT 'Draft', -- Draft, InProgress, Completed, Approved
        Score DECIMAL(5,2),
        TotalPoints DECIMAL(10,2),
        MaxPoints DECIMAL(10,2),
        Comments NVARCHAR(MAX),
        CreatedBy INT,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        CompletedAt DATETIME2,
        ApprovedBy INT,
        ApprovedAt DATETIME2,
        
        CONSTRAINT FK_OE_Inspections_Store FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        CONSTRAINT FK_OE_Inspections_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id),
        CONSTRAINT FK_OE_Inspections_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES Users(Id)
    );
    
    CREATE INDEX IX_OE_Inspections_DocumentNumber ON OE_Inspections(DocumentNumber);
    CREATE INDEX IX_OE_Inspections_StoreId ON OE_Inspections(StoreId);
    CREATE INDEX IX_OE_Inspections_Status ON OE_Inspections(Status);
    CREATE INDEX IX_OE_Inspections_InspectionDate ON OE_Inspections(InspectionDate);
    
    PRINT 'OE_Inspections table created';
END
GO

-- =====================================================
-- OE Inspection Sections Table (Section scores)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionSections')
BEGIN
    CREATE TABLE OE_InspectionSections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL,
        SectionName NVARCHAR(200) NOT NULL,
        SectionOrder INT DEFAULT 0,
        SectionIcon NVARCHAR(10),
        TotalPoints DECIMAL(10,2),
        MaxPoints DECIMAL(10,2),
        Score DECIMAL(5,2),
        Status NVARCHAR(50), -- Pass, Fail, NotStarted
        
        CONSTRAINT FK_OE_InspectionSections_Inspection FOREIGN KEY (InspectionId) REFERENCES OE_Inspections(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_OE_InspectionSections_InspectionId ON OE_InspectionSections(InspectionId);
    
    PRINT 'OE_InspectionSections table created';
END
GO

-- =====================================================
-- OE Inspection Items Table (Individual checklist items)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionItems')
BEGIN
    CREATE TABLE OE_InspectionItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL,
        SectionName NVARCHAR(200),
        SectionOrder INT DEFAULT 0,
        ItemOrder INT DEFAULT 0,
        ReferenceValue NVARCHAR(50),
        Question NVARCHAR(MAX),
        Coefficient DECIMAL(5,2) DEFAULT 1,
        Answer NVARCHAR(50), -- Yes, Partially, No, NA
        Score DECIMAL(5,2),
        Finding NVARCHAR(MAX),
        Comment NVARCHAR(MAX),
        CorrectedAction NVARCHAR(MAX),
        Priority NVARCHAR(20), -- High, Medium, Low
        HasPicture BIT DEFAULT 0,
        PictureUrl NVARCHAR(500),
        
        CONSTRAINT FK_OE_InspectionItems_Inspection FOREIGN KEY (InspectionId) REFERENCES OE_Inspections(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_OE_InspectionItems_InspectionId ON OE_InspectionItems(InspectionId);
    
    PRINT 'OE_InspectionItems table created';
END
GO

-- =====================================================
-- OE Inspection Action Items Table (Action plan tracking)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionActionItems')
BEGIN
    CREATE TABLE OE_InspectionActionItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL,
        SectionName NVARCHAR(200),
        ReferenceValue NVARCHAR(50),
        Finding NVARCHAR(MAX),
        SuggestedAction NVARCHAR(MAX),
        Action NVARCHAR(MAX),
        Responsible NVARCHAR(200),
        Department NVARCHAR(100),
        Deadline DATE,
        Priority NVARCHAR(20) DEFAULT 'Medium', -- High, Medium, Low
        Status NVARCHAR(50) DEFAULT 'Open', -- Open, InProgress, Completed, Overdue
        CompletionDate DATE,
        CompletionNotes NVARCHAR(MAX),
        BeforeImageUrl NVARCHAR(500),
        AfterImageUrl NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        CONSTRAINT FK_OE_InspectionActionItems_Inspection FOREIGN KEY (InspectionId) REFERENCES OE_Inspections(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_OE_InspectionActionItems_InspectionId ON OE_InspectionActionItems(InspectionId);
    CREATE INDEX IX_OE_InspectionActionItems_Status ON OE_InspectionActionItems(Status);
    CREATE INDEX IX_OE_InspectionActionItems_Deadline ON OE_InspectionActionItems(Deadline);
    
    PRINT 'OE_InspectionActionItems table created';
END
GO

-- =====================================================
-- OE Inspection Checklist Templates (Master questions)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionTemplates')
BEGIN
    CREATE TABLE OE_InspectionTemplates (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        IsDefault BIT DEFAULT 0,
        CreatedBy INT,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        CONSTRAINT FK_OE_InspectionTemplates_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );
    
    -- Insert default template
    INSERT INTO OE_InspectionTemplates (TemplateName, Description, IsActive, IsDefault) VALUES 
        ('Standard OE Inspection', 'Default operational excellence inspection checklist', 1, 1);
    
    PRINT 'OE_InspectionTemplates table created';
END
GO

-- =====================================================
-- OE Inspection Template Sections (Section definitions)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionTemplateSections')
BEGIN
    CREATE TABLE OE_InspectionTemplateSections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateId INT NOT NULL,
        SectionName NVARCHAR(200) NOT NULL,
        SectionIcon NVARCHAR(10),
        SectionOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        
        CONSTRAINT FK_OE_InspectionTemplateSections_Template FOREIGN KEY (TemplateId) REFERENCES OE_InspectionTemplates(Id) ON DELETE CASCADE
    );
    
    -- Insert default sections for template 1
    INSERT INTO OE_InspectionTemplateSections (TemplateId, SectionName, SectionIcon, SectionOrder) VALUES 
        (1, 'General Store Condition', '🏪', 1),
        (1, 'Staff & Uniforms', '👔', 2),
        (1, 'Cleaning & Hygiene', '🧹', 3),
        (1, 'Equipment & Maintenance', '🛠️', 4),
        (1, 'Safety & Compliance', '⚠️', 5),
        (1, 'Customer Service', '😊', 6),
        (1, 'Documentation', '📋', 7);
    
    PRINT 'OE_InspectionTemplateSections table created';
END
GO

-- =====================================================
-- OE Inspection Template Items (Master checklist questions)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionTemplateItems')
BEGIN
    CREATE TABLE OE_InspectionTemplateItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SectionId INT NOT NULL,
        ReferenceValue NVARCHAR(50),
        Question NVARCHAR(MAX) NOT NULL,
        Coefficient DECIMAL(5,2) DEFAULT 1,
        AnswerOptions NVARCHAR(200) DEFAULT 'Yes,Partially,No,NA',
        Criteria NVARCHAR(MAX),
        ItemOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        
        CONSTRAINT FK_OE_InspectionTemplateItems_Section FOREIGN KEY (SectionId) REFERENCES OE_InspectionTemplateSections(Id) ON DELETE CASCADE
    );
    
    -- Insert sample questions for each section
    -- Section 1: General Store Condition
    INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, ItemOrder) VALUES 
        (1, '1.1', 'Store exterior is clean and well-maintained', 2, 1),
        (1, '1.2', 'Entrance area is clear and welcoming', 2, 2),
        (1, '1.3', 'Lighting is adequate throughout the store', 2, 3),
        (1, '1.4', 'Aisles are clear of obstructions', 2, 4),
        (1, '1.5', 'Shelves are properly stocked and organized', 2, 5);
    
    -- Section 2: Staff & Uniforms
    INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, ItemOrder) VALUES 
        (2, '2.1', 'Staff wearing proper uniforms', 2, 1),
        (2, '2.2', 'Name badges visible and correct', 1, 2),
        (2, '2.3', 'Staff grooming meets standards', 2, 3),
        (2, '2.4', 'Adequate staff coverage during visit', 2, 4);
    
    -- Section 3: Cleaning & Hygiene
    INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, ItemOrder) VALUES 
        (3, '3.1', 'Floors are clean and dry', 2, 1),
        (3, '3.2', 'Restrooms are clean and stocked', 4, 2),
        (3, '3.3', 'Waste bins are not overflowing', 2, 3),
        (3, '3.4', 'Cleaning schedule is followed', 2, 4),
        (3, '3.5', 'No unpleasant odors', 2, 5);
    
    -- Section 4: Equipment & Maintenance
    INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, ItemOrder) VALUES 
        (4, '4.1', 'All equipment is functioning properly', 4, 1),
        (4, '4.2', 'Refrigerators at correct temperature', 4, 2),
        (4, '4.3', 'No visible maintenance issues', 2, 3),
        (4, '4.4', 'Emergency equipment accessible', 4, 4);
    
    -- Section 5: Safety & Compliance
    INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, ItemOrder) VALUES 
        (5, '5.1', 'Fire exits clearly marked and accessible', 4, 1),
        (5, '5.2', 'Safety signage properly displayed', 2, 2),
        (5, '5.3', 'First aid kit available and stocked', 2, 3),
        (5, '5.4', 'No safety hazards observed', 4, 4);
    
    -- Section 6: Customer Service
    INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, ItemOrder) VALUES 
        (6, '6.1', 'Staff greet customers appropriately', 2, 1),
        (6, '6.2', 'Staff are helpful and knowledgeable', 2, 2),
        (6, '6.3', 'Customer complaints handled properly', 2, 3),
        (6, '6.4', 'Checkout process is efficient', 2, 4);
    
    -- Section 7: Documentation
    INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, ItemOrder) VALUES 
        (7, '7.1', 'Required permits are displayed', 2, 1),
        (7, '7.2', 'Logs and records are up to date', 2, 2),
        (7, '7.3', 'Previous action items addressed', 4, 3);
    
    PRINT 'OE_InspectionTemplateItems table created with sample questions';
END
GO

PRINT '';
PRINT '=====================================================';
PRINT 'OE Inspection Module tables created successfully!';
PRINT '=====================================================';
GO
