-- OE Inspection Escalation Settings Tables
-- Created: 2026-02-18

-- Settings table for escalation configuration
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OE_EscalationSettings' AND xtype='U')
BEGIN
    CREATE TABLE OE_EscalationSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(500) NOT NULL,
        Description NVARCHAR(500),
        UpdatedBy INT,
        UpdatedAt DATETIME DEFAULT GETDATE()
    );

    -- Insert default settings
    INSERT INTO OE_EscalationSettings (SettingKey, SettingValue, Description) VALUES 
    ('ActionPlanDeadlineDays', '7', 'Number of days Store Manager has to complete action plan'),
    ('EscalationEnabled', 'true', 'Enable automatic escalation when deadline is passed'),
    ('ReminderDaysBefore', '3,1', 'Send reminder X days before deadline (comma separated)'),
    ('EmailNotifications', 'true', 'Send email notifications for escalations'),
    ('InAppNotifications', 'true', 'Send in-app notifications for escalations');
END
GO

-- Store to Responsible Manager mapping (dynamic assignment)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OE_StoreResponsibles' AND xtype='U')
BEGIN
    CREATE TABLE OE_StoreResponsibles (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        StoreId INT NOT NULL,
        AreaManagerId INT NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedBy NVARCHAR(200) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedBy NVARCHAR(200) NULL,
        UpdatedAt DATETIME NULL,
        IsActive BIT DEFAULT 1,
        CONSTRAINT FK_StoreResponsibles_Store FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        CONSTRAINT FK_StoreResponsibles_User FOREIGN KEY (AreaManagerId) REFERENCES Users(Id)
    );
    
    CREATE INDEX IX_StoreResponsibles_Store ON OE_StoreResponsibles(StoreId);
    CREATE INDEX IX_StoreResponsibles_User ON OE_StoreResponsibles(AreaManagerId);
END
GO

-- Escalation log table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OE_ActionPlanEscalations' AND xtype='U')
BEGIN
    CREATE TABLE OE_ActionPlanEscalations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        InspectionId INT NOT NULL,
        EscalatedToUserId INT NOT NULL,
        EscalationLevel INT DEFAULT 1,
        EscalationReason NVARCHAR(500),
        EscalatedAt DATETIME DEFAULT GETDATE(),
        NotifiedByEmail BIT DEFAULT 0,
        NotifiedInApp BIT DEFAULT 0,
        ResolvedAt DATETIME NULL,
        ResolvedBy INT NULL,
        Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Resolved, Ignored
        Notes NVARCHAR(1000),
        CONSTRAINT FK_Escalations_Inspection FOREIGN KEY (InspectionId) REFERENCES OE_Inspections(Id),
        CONSTRAINT FK_Escalations_User FOREIGN KEY (EscalatedToUserId) REFERENCES Users(Id)
    );
    
    CREATE INDEX IX_Escalations_Inspection ON OE_ActionPlanEscalations(InspectionId);
    CREATE INDEX IX_Escalations_Status ON OE_ActionPlanEscalations(Status);
END
GO

-- Add ActionPlanDeadline column to OE_Inspections if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OE_Inspections') AND name = 'ActionPlanDeadline')
BEGIN
    ALTER TABLE OE_Inspections ADD ActionPlanDeadline DATETIME NULL;
END
GO

-- Add ActionPlanCompletedAt column to OE_Inspections if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OE_Inspections') AND name = 'ActionPlanCompletedAt')
BEGIN
    ALTER TABLE OE_Inspections ADD ActionPlanCompletedAt DATETIME NULL;
END
GO

PRINT 'OE Escalation tables created successfully';
