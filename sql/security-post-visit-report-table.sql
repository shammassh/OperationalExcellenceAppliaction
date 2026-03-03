-- Post Visit Report Table
-- Run on both UAT and Live databases

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SecurityPostVisitReports')
BEGIN
    CREATE TABLE SecurityPostVisitReports (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Basic Info
        StoreId INT,
        StoreName NVARCHAR(200),
        VisitDate DATE,
        
        -- Overall Rating (1-5 stars)
        OverallRating INT,
        
        -- In-house Guards Matrix (1=Not well at all, 2=Not very well, 3=Somewhat well, 4=Very well, 5=Extremely well)
        InHouseUniform INT,
        InHousePosition INT,
        InHouseControlRoom INT,
        InHouseControlSheets INT,
        InHouseBehavior INT,
        InHouseComments NVARCHAR(MAX),
        
        -- Third-Party Guards
        ThirdPartyAvailable BIT,
        SecurityCompany NVARCHAR(100),
        
        -- Third-Party Guards Matrix
        ThirdPartyUniform INT,
        ThirdPartyPosition INT,
        ThirdPartyControlSheets INT,
        ThirdPartyBehavior INT,
        ThirdPartyAttendance INT,
        ThirdPartyJobDescription INT,
        ThirdPartyComments NVARCHAR(MAX),
        
        -- Incident (when Third-Party = No)
        HasIncident BIT,
        IncidentType NVARCHAR(50), -- 'staff_related' or 'other'
        IncidentDescription NVARCHAR(MAX),
        IncidentAttachmentPath NVARCHAR(500),
        IncidentComments NVARCHAR(MAX),
        
        -- Health and Safety
        HealthSafetyObservation BIT,
        
        -- Metadata
        CreatedBy INT,
        CreatedByName NVARCHAR(200),
        CreatedByEmail NVARCHAR(200),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME,
        UpdatedBy INT
    );
    
    PRINT 'SecurityPostVisitReports table created successfully!';
END
ELSE
BEGIN
    PRINT 'SecurityPostVisitReports table already exists.';
END
