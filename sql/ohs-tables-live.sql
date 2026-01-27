-- =====================================================
-- OHS (Occupational Health & Safety) Tables - LIVE
-- Database: OEApp_Live
-- Environment: Production (https://oeapp.gmrlapps.com)
-- =====================================================

USE OEApp_Live;
GO

-- =====================================================
-- OHS Stores Configuration
-- Stores enabled for OHS reporting
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSStores')
BEGIN
    CREATE TABLE OHSStores (
        Id INT PRIMARY KEY IDENTITY(1,1),
        StoreId INT NOT NULL,
        StoreName NVARCHAR(200) NOT NULL,
        StoreCode NVARCHAR(50),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CreatedBy NVARCHAR(255),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255)
    );
    
    CREATE INDEX IX_OHSStores_StoreId ON OHSStores(StoreId);
    CREATE INDEX IX_OHSStores_IsActive ON OHSStores(IsActive);
    
    PRINT 'OHSStores table created';
END
GO

-- =====================================================
-- OHS Event Types
-- e.g., Accident, Incident, Near Miss, Hazard Report
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSEventTypes')
BEGIN
    CREATE TABLE OHSEventTypes (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EventTypeName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500),
        DisplayOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CreatedBy NVARCHAR(255),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255)
    );
    
    -- Insert default event types
    INSERT INTO OHSEventTypes (EventTypeName, Description, DisplayOrder) VALUES 
        ('Accident', 'An unplanned event that results in injury, illness, or damage', 1),
        ('Incident', 'An unplanned event that could have resulted in injury but did not', 2),
        ('Near Miss', 'An event that could have caused harm but was avoided', 3),
        ('Hazard Report', 'Identification of a potential hazard before an incident occurs', 4);
    
    PRINT 'OHSEventTypes table created with default values';
END
GO

-- =====================================================
-- OHS Event Categories
-- e.g., Physical Hazards, Chemical Hazards, Biological Hazards
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSEventCategories')
BEGIN
    CREATE TABLE OHSEventCategories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryName NVARCHAR(150) NOT NULL,
        Description NVARCHAR(500),
        DisplayOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CreatedBy NVARCHAR(255),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255)
    );
    
    -- Insert default categories
    INSERT INTO OHSEventCategories (CategoryName, Description, DisplayOrder) VALUES 
        ('Physical Hazards', 'Hazards related to physical conditions and activities', 1),
        ('Chemical Hazards', 'Hazards from chemical substances and materials', 2),
        ('Biological Hazards', 'Hazards from biological agents and organisms', 3),
        ('Ergonomic Hazards', 'Hazards related to workplace ergonomics and posture', 4),
        ('Psychosocial Hazards', 'Hazards affecting mental health and wellbeing', 5),
        ('Environmental Hazards', 'Hazards from environmental conditions', 6);
    
    PRINT 'OHSEventCategories table created with default values';
END
GO

-- =====================================================
-- OHS Event Sub-Categories
-- e.g., Under Physical Hazards: Slip/Trip/Fall, Moving Machinery, etc.
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSEventSubCategories')
BEGIN
    CREATE TABLE OHSEventSubCategories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryId INT NOT NULL FOREIGN KEY REFERENCES OHSEventCategories(Id) ON DELETE CASCADE,
        SubCategoryName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500),
        DisplayOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CreatedBy NVARCHAR(255),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255)
    );
    
    CREATE INDEX IX_OHSEventSubCategories_CategoryId ON OHSEventSubCategories(CategoryId);
    
    -- Insert default sub-categories for Physical Hazards (CategoryId = 1)
    INSERT INTO OHSEventSubCategories (CategoryId, SubCategoryName, Description, DisplayOrder) VALUES 
        (1, 'Slip, trip, and fall hazards', 'Wet floors, uneven surfaces, obstructions', 1),
        (1, 'Moving machinery and equipment', 'Hazards from moving mechanical parts', 2),
        (1, 'Contact with sharp edges or tools', 'Cuts and lacerations from sharp objects', 3),
        (1, 'Caught between / pinch points', 'Body parts caught in machinery or between objects', 4),
        (1, 'Falling objects', 'Objects falling from height or shelves', 5),
        (1, 'Working at height', 'Falls from ladders, platforms, or elevated areas', 6),
        (1, 'Walking under suspended loads', 'Hazards from overhead lifting operations', 7),
        (1, 'Manual handling and lifting', 'Injuries from lifting, carrying, pushing, or pulling', 8),
        (1, 'Noise and vibration', 'Exposure to excessive noise or vibration', 9),
        (1, 'Extreme temperatures', 'Exposure to hot or cold conditions', 10),
        (1, 'Electrical hazards', 'Exposed wiring, faulty equipment, electric shock', 11),
        (1, 'Radiation', 'Exposure to ionizing or non-ionizing radiation', 12);
    
    -- Insert default sub-categories for Chemical Hazards (CategoryId = 2)
    INSERT INTO OHSEventSubCategories (CategoryId, SubCategoryName, Description, DisplayOrder) VALUES 
        (2, 'Exposure to toxic substances', 'Contact with poisonous chemicals', 1),
        (2, 'Inhalation of fumes or vapors', 'Breathing in harmful gases', 2),
        (2, 'Skin contact with chemicals', 'Burns or irritation from chemical contact', 3),
        (2, 'Spills and leaks', 'Uncontrolled release of chemicals', 4);
    
    -- Insert default sub-categories for Biological Hazards (CategoryId = 3)
    INSERT INTO OHSEventSubCategories (CategoryId, SubCategoryName, Description, DisplayOrder) VALUES 
        (3, 'Exposure to infectious agents', 'Contact with bacteria, viruses, or pathogens', 1),
        (3, 'Animal or insect bites/stings', 'Injuries from animals or insects', 2),
        (3, 'Contaminated materials', 'Contact with biologically contaminated items', 3);
    
    -- Insert default sub-categories for Ergonomic Hazards (CategoryId = 4)
    INSERT INTO OHSEventSubCategories (CategoryId, SubCategoryName, Description, DisplayOrder) VALUES 
        (4, 'Repetitive motion injuries', 'Strain from repeated movements', 1),
        (4, 'Poor workstation setup', 'Incorrect desk, chair, or equipment positioning', 2),
        (4, 'Prolonged standing or sitting', 'Physical strain from static postures', 3);
    
    -- Insert default sub-categories for Psychosocial Hazards (CategoryId = 5)
    INSERT INTO OHSEventSubCategories (CategoryId, SubCategoryName, Description, DisplayOrder) VALUES 
        (5, 'Workplace violence or aggression', 'Physical or verbal abuse', 1),
        (5, 'Harassment or bullying', 'Unwanted behavior causing distress', 2),
        (5, 'Work-related stress', 'Excessive workload or pressure', 3);
    
    -- Insert default sub-categories for Environmental Hazards (CategoryId = 6)
    INSERT INTO OHSEventSubCategories (CategoryId, SubCategoryName, Description, DisplayOrder) VALUES 
        (6, 'Poor lighting conditions', 'Insufficient or excessive lighting', 1),
        (6, 'Poor ventilation', 'Inadequate air circulation', 2),
        (6, 'Weather-related hazards', 'Storms, floods, extreme weather', 3);
    
    PRINT 'OHSEventSubCategories table created with default values';
END
GO

-- =====================================================
-- OHS Injury Types
-- Types of injuries that can be reported
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSInjuryTypes')
BEGIN
    CREATE TABLE OHSInjuryTypes (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InjuryTypeName NVARCHAR(150) NOT NULL,
        Description NVARCHAR(500),
        DisplayOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CreatedBy NVARCHAR(255),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255)
    );
    
    -- Insert default injury types
    INSERT INTO OHSInjuryTypes (InjuryTypeName, Description, DisplayOrder) VALUES 
        ('Cuts / Lacerations', 'Open wounds from sharp objects', 1),
        ('Bruises / Contusions', 'Injuries from impact without breaking skin', 2),
        ('Fractures', 'Broken bones', 3),
        ('Sprains / Strains', 'Muscle or ligament injuries', 4),
        ('Burns', 'Thermal, chemical, or electrical burns', 5),
        ('Eye Injuries', 'Injuries to eyes from objects or chemicals', 6),
        ('Hearing Damage', 'Hearing loss or damage from noise', 7),
        ('Respiratory Issues', 'Breathing problems from inhalation', 8),
        ('Skin Irritation / Rash', 'Allergic or chemical skin reactions', 9),
        ('Crush Injuries', 'Injuries from compression or crushing', 10),
        ('Electric Shock', 'Injuries from electrical current', 11),
        ('Psychological Trauma', 'Mental health impact from incident', 12),
        ('Fatality', 'Death resulting from incident', 13),
        ('Other', 'Other types of injuries not listed', 99);
    
    PRINT 'OHSInjuryTypes table created with default values';
END
GO

-- =====================================================
-- OHS Body Parts
-- Body parts that can be affected
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSBodyParts')
BEGIN
    CREATE TABLE OHSBodyParts (
        Id INT PRIMARY KEY IDENTITY(1,1),
        BodyPartName NVARCHAR(100) NOT NULL,
        DisplayOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert default body parts
    INSERT INTO OHSBodyParts (BodyPartName, DisplayOrder) VALUES 
        ('Head', 1),
        ('Face', 2),
        ('Eyes', 3),
        ('Ears', 4),
        ('Neck', 5),
        ('Shoulder (Left)', 6),
        ('Shoulder (Right)', 7),
        ('Upper Arm (Left)', 8),
        ('Upper Arm (Right)', 9),
        ('Elbow (Left)', 10),
        ('Elbow (Right)', 11),
        ('Forearm (Left)', 12),
        ('Forearm (Right)', 13),
        ('Wrist (Left)', 14),
        ('Wrist (Right)', 15),
        ('Hand (Left)', 16),
        ('Hand (Right)', 17),
        ('Fingers (Left)', 18),
        ('Fingers (Right)', 19),
        ('Chest', 20),
        ('Back (Upper)', 21),
        ('Back (Lower)', 22),
        ('Abdomen', 23),
        ('Hip (Left)', 24),
        ('Hip (Right)', 25),
        ('Thigh (Left)', 26),
        ('Thigh (Right)', 27),
        ('Knee (Left)', 28),
        ('Knee (Right)', 29),
        ('Lower Leg (Left)', 30),
        ('Lower Leg (Right)', 31),
        ('Ankle (Left)', 32),
        ('Ankle (Right)', 33),
        ('Foot (Left)', 34),
        ('Foot (Right)', 35),
        ('Toes (Left)', 36),
        ('Toes (Right)', 37),
        ('Multiple Body Parts', 98),
        ('Whole Body', 99);
    
    PRINT 'OHSBodyParts table created with default values';
END
GO

-- =====================================================
-- OHS Incidents Table (Main reporting table)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSIncidents')
BEGIN
    CREATE TABLE OHSIncidents (
        Id INT PRIMARY KEY IDENTITY(1,1),
        IncidentNumber NVARCHAR(50) NOT NULL UNIQUE,
        
        -- Store Information
        StoreId INT,
        StoreName NVARCHAR(200),
        
        -- Event Details
        EventTypeId INT FOREIGN KEY REFERENCES OHSEventTypes(Id),
        CategoryId INT FOREIGN KEY REFERENCES OHSEventCategories(Id),
        SubCategoryId INT FOREIGN KEY REFERENCES OHSEventSubCategories(Id),
        
        -- Date/Time of Incident
        IncidentDate DATE NOT NULL,
        IncidentTime TIME,
        ReportedDate DATETIME2 DEFAULT GETDATE(),
        
        -- Location within store
        ExactLocation NVARCHAR(500),
        
        -- Description
        IncidentDescription NVARCHAR(MAX),
        
        -- Injury Details (if applicable)
        InjuryOccurred BIT DEFAULT 0,
        InjuryTypeId INT FOREIGN KEY REFERENCES OHSInjuryTypes(Id),
        BodyPartId INT FOREIGN KEY REFERENCES OHSBodyParts(Id),
        InjuryDescription NVARCHAR(MAX),
        
        -- Injured Person Details
        InjuredPersonName NVARCHAR(255),
        InjuredPersonType NVARCHAR(50), -- Employee, Customer, Contractor, Visitor
        InjuredPersonEmployeeId NVARCHAR(50),
        
        -- Witnesses
        WitnessNames NVARCHAR(MAX),
        
        -- Immediate Actions Taken
        ImmediateActions NVARCHAR(MAX),
        
        -- Medical Treatment
        MedicalTreatmentRequired BIT DEFAULT 0,
        MedicalTreatmentDetails NVARCHAR(MAX),
        HospitalVisit BIT DEFAULT 0,
        
        -- Reporter Information
        ReportedByUserId NVARCHAR(255),
        ReportedByName NVARCHAR(255),
        ReportedByRole NVARCHAR(100),
        ReportedByEmail NVARCHAR(255),
        
        -- Status
        Status NVARCHAR(50) DEFAULT 'Submitted', -- Submitted, Under Review, Investigating, Closed
        
        -- Attachments (photos, documents)
        Attachments NVARCHAR(MAX), -- JSON array of file paths
        
        -- Audit
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255)
    );
    
    CREATE INDEX IX_OHSIncidents_StoreId ON OHSIncidents(StoreId);
    CREATE INDEX IX_OHSIncidents_EventTypeId ON OHSIncidents(EventTypeId);
    CREATE INDEX IX_OHSIncidents_Status ON OHSIncidents(Status);
    CREATE INDEX IX_OHSIncidents_IncidentDate ON OHSIncidents(IncidentDate);
    CREATE INDEX IX_OHSIncidents_IncidentNumber ON OHSIncidents(IncidentNumber);
    
    PRINT 'OHSIncidents table created';
END
GO

PRINT 'OHS Tables setup completed successfully for OEApp_Live';
GO
