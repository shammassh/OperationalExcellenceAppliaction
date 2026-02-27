-- ==========================================
-- Overall Risk Assessment (ORA) Tables
-- Run on both UAT and Live databases
-- ==========================================

-- Hazard Categories
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORAHazardCategories')
BEGIN
    CREATE TABLE ORAHazardCategories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryName NVARCHAR(100) NOT NULL,
        Examples NVARCHAR(500),
        PotentialHarm NVARCHAR(500),
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'ORAHazardCategories table created';
END
GO

-- Injury & Illness Categories
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORAInjuryCategories')
BEGIN
    CREATE TABLE ORAInjuryCategories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500),
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'ORAInjuryCategories table created';
END
GO

-- Severity Levels (1-4)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORASeverityLevels')
BEGIN
    CREATE TABLE ORASeverityLevels (
        Id INT PRIMARY KEY IDENTITY(1,1),
        LevelValue INT NOT NULL,
        LevelName NVARCHAR(50) NOT NULL,
        Description NVARCHAR(200),
        Color NVARCHAR(20),
        SortOrder INT DEFAULT 0
    );
    PRINT 'ORASeverityLevels table created';
    
    -- Insert default severity levels
    INSERT INTO ORASeverityLevels (LevelValue, LevelName, Description, Color, SortOrder) VALUES
    (1, 'First Aid', 'Minor injury requiring first aid only', '#28a745', 1),
    (2, 'Recordable', 'Injury requiring medical treatment/recordable', '#ffc107', 2),
    (3, 'Irreversible', 'Permanent disability or irreversible health effect', '#fd7e14', 3),
    (4, 'Fatal', 'Death or life-threatening condition', '#dc3545', 4);
    PRINT 'Severity levels inserted';
END
GO

-- Likelihood Levels (1-4)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORALikelihoodLevels')
BEGIN
    CREATE TABLE ORALikelihoodLevels (
        Id INT PRIMARY KEY IDENTITY(1,1),
        LevelValue INT NOT NULL,
        LevelName NVARCHAR(50) NOT NULL,
        Description NVARCHAR(300),
        FrequencyDescription NVARCHAR(100),
        Color NVARCHAR(20),
        SortOrder INT DEFAULT 0
    );
    PRINT 'ORALikelihoodLevels table created';
    
    -- Insert default likelihood levels
    INSERT INTO ORALikelihoodLevels (LevelValue, LevelName, Description, FrequencyDescription, Color, SortOrder) VALUES
    (1, 'Very Unlikely', 'Safe by design. Nearly impossible to get it wrong.', 'None', '#28a745', 1),
    (2, 'Unlikely', 'Workplace and task are optimized. Reliable controls in place.', 'Rare', '#17a2b8', 2),
    (3, 'Likely', 'Heavily reliant on unreliable organisational or personal controls.', 'Occasional', '#ffc107', 3),
    (4, 'Very Likely', 'Controls are missing or ineffective. Misuse is common.', 'Frequent', '#dc3545', 4);
    PRINT 'Likelihood levels inserted';
END
GO

-- Risk Matrix (pre-calculated risk levels)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORARiskMatrix')
BEGIN
    CREATE TABLE ORARiskMatrix (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SeverityValue INT NOT NULL,
        LikelihoodValue INT NOT NULL,
        RiskScore INT NOT NULL,
        RiskLevel NVARCHAR(20) NOT NULL,
        Color NVARCHAR(20) NOT NULL,
        ActionRequired NVARCHAR(200)
    );
    PRINT 'ORARiskMatrix table created';
    
    -- Insert risk matrix values (Severity x Likelihood)
    INSERT INTO ORARiskMatrix (SeverityValue, LikelihoodValue, RiskScore, RiskLevel, Color, ActionRequired) VALUES
    -- Very Unlikely (1)
    (1, 1, 1, 'Low Risk', '#28a745', 'May be tolerable: Longer term action may be needed'),
    (2, 1, 2, 'Low Risk', '#28a745', 'May be tolerable: Longer term action may be needed'),
    (3, 1, 3, 'Medium Risk', '#ffc107', 'Not tolerable: Management attention required'),
    (4, 1, 4, 'Medium Risk', '#ffc107', 'Not tolerable: Management attention required'),
    -- Unlikely (2)
    (1, 2, 2, 'Low Risk', '#28a745', 'May be tolerable: Longer term action may be needed'),
    (2, 2, 4, 'Medium Risk', '#ffc107', 'Not tolerable: Management attention required'),
    (3, 2, 6, 'High Risk', '#fd7e14', 'Not tolerable: Urgent management attention'),
    (4, 2, 8, 'High Risk', '#fd7e14', 'Not tolerable: Urgent management attention'),
    -- Likely (3)
    (1, 3, 3, 'Medium Risk', '#ffc107', 'Not tolerable: Management attention required'),
    (2, 3, 6, 'High Risk', '#fd7e14', 'Not tolerable: Urgent management attention'),
    (3, 3, 9, 'High Risk', '#fd7e14', 'Not tolerable: Urgent management attention'),
    (4, 3, 12, 'Extreme Risk', '#dc3545', 'Not tolerable: Immediate action required'),
    -- Very Likely (4)
    (1, 4, 4, 'Medium Risk', '#ffc107', 'Not tolerable: Management attention required'),
    (2, 4, 8, 'High Risk', '#fd7e14', 'Not tolerable: Urgent management attention'),
    (3, 4, 12, 'Extreme Risk', '#dc3545', 'Not tolerable: Immediate action required'),
    (4, 4, 16, 'Extreme Risk', '#dc3545', 'Not tolerable: Immediate action required');
    PRINT 'Risk matrix inserted';
END
GO

-- Main ORA Assessments
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORAAssessments')
BEGIN
    CREATE TABLE ORAAssessments (
        Id INT PRIMARY KEY IDENTITY(1,1),
        StoreId INT NOT NULL,
        AssessmentTitle NVARCHAR(200),
        BoundariesDescription NVARCHAR(500),
        LeadAssessorName NVARCHAR(100),
        LeadAssessorId INT,
        TeamMembers NVARCHAR(500),
        AssessmentDate DATE,
        Status NVARCHAR(20) DEFAULT 'Draft', -- Draft, Submitted, Approved, Closed
        HighestRiskLevel NVARCHAR(20),
        TotalRisks INT DEFAULT 0,
        OpenActions INT DEFAULT 0,
        Notes NVARCHAR(MAX),
        CreatedBy INT,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        SubmittedAt DATETIME2,
        SubmittedBy INT,
        ApprovedAt DATETIME2,
        ApprovedBy INT,
        FOREIGN KEY (StoreId) REFERENCES Stores(Id)
    );
    PRINT 'ORAAssessments table created';
END
GO

-- Individual Risk Entries within an Assessment
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORAAssessmentRisks')
BEGIN
    CREATE TABLE ORAAssessmentRisks (
        Id INT PRIMARY KEY IDENTITY(1,1),
        AssessmentId INT NOT NULL,
        
        -- Risk Description
        HazardCategoryId INT,
        HazardCategoryOther NVARCHAR(100),
        HowWhenHarmOccurs NVARCHAR(500),
        SituationRoutine BIT DEFAULT 0,
        SituationNonRoutine BIT DEFAULT 0,
        SituationEmergency BIT DEFAULT 0,
        InjuryCategoryId INT,
        InjuryCategoryOther NVARCHAR(100),
        PeopleExposed NVARCHAR(300),
        
        -- Existing Controls
        CrossRefOtherAssessments NVARCHAR(200),
        TechnicalControls NVARCHAR(500),
        OrganisationalControls NVARCHAR(500),
        PersonalControls NVARCHAR(500),
        
        -- Human Factors
        HumanFactors NVARCHAR(500),
        
        -- Compliance (Non-compliant flags)
        ComplianceLegal BIT DEFAULT 0,
        ComplianceGroup BIT DEFAULT 0,
        ComplianceMarket BIT DEFAULT 0,
        
        -- Existing Risk Assessment
        ExistingSeverity INT,
        ExistingLikelihood INT,
        ExistingRiskScore INT,
        ExistingRiskLevel NVARCHAR(20),
        
        -- Residual Risk (after controls implemented)
        ResidualSeverity INT,
        ResidualLikelihood INT,
        ResidualRiskScore INT,
        ResidualRiskLevel NVARCHAR(20),
        
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        FOREIGN KEY (AssessmentId) REFERENCES ORAAssessments(Id) ON DELETE CASCADE,
        FOREIGN KEY (HazardCategoryId) REFERENCES ORAHazardCategories(Id),
        FOREIGN KEY (InjuryCategoryId) REFERENCES ORAInjuryCategories(Id)
    );
    PRINT 'ORAAssessmentRisks table created';
END
GO

-- Action Plans for each risk
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ORAActionPlans')
BEGIN
    CREATE TABLE ORAActionPlans (
        Id INT PRIMARY KEY IDENTITY(1,1),
        RiskId INT NOT NULL,
        ActionRequired NVARCHAR(500) NOT NULL,
        ResponsiblePerson NVARCHAR(100),
        ResponsiblePersonId INT,
        TargetDate DATE,
        CompletedDate DATE,
        Status NVARCHAR(20) DEFAULT 'Open', -- Open, In Progress, Completed, Overdue
        Notes NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        FOREIGN KEY (RiskId) REFERENCES ORAAssessmentRisks(Id) ON DELETE CASCADE
    );
    PRINT 'ORAActionPlans table created';
END
GO

-- Insert default Hazard Categories
IF NOT EXISTS (SELECT * FROM ORAHazardCategories)
BEGIN
    INSERT INTO ORAHazardCategories (CategoryName, Examples, PotentialHarm, SortOrder) VALUES
    ('STF (Slip, trip, fall) hazards', 'Uneven floors, Materials on floor, Holes/gaps in floors', 'Falls causing impact injuries, fractures, sprains', 1),
    ('Hot surfaces or materials', 'Heat sealing equipment, Hot process equipment, Steam systems', 'Contact burns, scalds', 2),
    ('Ergonomic risk', 'Manual handling, Repetitive tasks, Awkward posture', 'Musculoskeletal disorders, strains', 3),
    ('Chemicals, dusts or gases', 'Sensitizers, Corrosive chemicals, Asphyxiants', 'Acute or chronic health effects, respiratory issues', 4),
    ('Collapse or overturn', 'Racking, Silos, Scaffolding', 'Crush injuries from falling structures/materials', 5),
    ('Pressurized systems', 'Steam, Compressed air, Liquid under pressure', 'Burns, impact injuries from uncontrolled release', 6),
    ('Work at height', 'Platforms, walkways, Scaffolds, Ladders', 'Falls from height, fractures, fatalities', 7),
    ('Lifting operations', 'Cranes and hoists, FIBC handling, Personnel lifts', 'Falling objects, crush injuries', 8),
    ('Stationary objects', 'Sharp edges, Low clearances, Obstructions', 'Cuts, bruises, head injuries', 9),
    ('Hand tools', 'Spanners, screwdrivers, Drills, saws, Hammers', 'Cuts, impact injuries, punctures', 10),
    ('Electricity', 'Portable equipment, Distribution systems, Sockets/plugs', 'Electric shock, burns, fires', 11),
    ('Vehicles', 'Delivery trucks, Passenger vehicles, Onsite vehicles', 'Collision injuries, pedestrian strikes', 12),
    ('MHE (Material Handling Equipment)', 'PITs, Pallet trucks, AGVs', 'Collision with pedestrians/objects, crush injuries', 13),
    ('Machinery', 'Mixers, Rotary valves, Filling/packing equipment', 'Crush, amputation, entanglement', 14),
    ('Noise', 'High noise levels, Hand-arm vibration', 'Hearing impairment, tinnitus', 15),
    ('Vibration', 'Powered hand tools, PITs, Delivery trucks', 'MSDs, chronic health effects', 16),
    ('Explosive atmospheres', 'Flour dust, Natural gas, Flammable liquids', 'Fire, explosion, burns', 17),
    ('Combustible materials', 'Combustible wastes, Fuels, Bulk storage', 'Fires, burns, smoke inhalation', 18),
    ('Biological hazards', 'Bacteria, Viruses, Pests', 'Infections, allergic reactions', 19),
    ('Cold surfaces or materials', 'Refrigeration equipment, Frozen products', 'Frostbite, cold burns', 20);
    PRINT 'Hazard categories inserted';
END
GO

-- Insert default Injury/Illness Categories
IF NOT EXISTS (SELECT * FROM ORAInjuryCategories)
BEGIN
    INSERT INTO ORAInjuryCategories (CategoryName, SortOrder) VALUES
    ('Amputation', 1),
    ('Burn (chemical)', 2),
    ('Burn (thermal)', 3),
    ('Concussion', 4),
    ('Cut, abrasion, or bruise', 5),
    ('MST (Musculo-Skeletal Trauma)', 6),
    ('Foreign Body', 7),
    ('Fracture', 8),
    ('Puncture/Splinter', 9),
    ('Respiratory disorder', 10),
    ('Skin disorder', 11),
    ('Hearing impairment', 12),
    ('Mental ill health', 13),
    ('MSD (Musculo-Skeletal Disease)', 14),
    ('Poisoning', 15),
    ('Vision impairment', 16),
    ('Digestive system disorder', 17),
    ('Cancer', 18),
    ('Multiple injuries or illnesses', 19),
    ('Other', 20);
    PRINT 'Injury categories inserted';
END
GO

PRINT 'ORA tables created successfully!';
