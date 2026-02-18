-- OE Inspection Schedule Table
-- This table stores inspection schedules created by senior inspectors for inspectors

-- Check if table exists and create if not
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_InspectionSchedule')
BEGIN
    CREATE TABLE OE_InspectionSchedule (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        InspectorId INT NOT NULL,
        StoreId INT NOT NULL,
        TemplateId INT NOT NULL,
        ScheduledDate DATE NOT NULL,
        Notes NVARCHAR(500) NULL,
        Status NVARCHAR(50) DEFAULT 'Scheduled',
        CreatedBy INT NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (InspectorId) REFERENCES Users(Id),
        FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        FOREIGN KEY (TemplateId) REFERENCES OE_InspectionTemplates(Id),
        FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );

    CREATE INDEX IX_OE_InspectionSchedule_InspectorId ON OE_InspectionSchedule(InspectorId);
    CREATE INDEX IX_OE_InspectionSchedule_ScheduledDate ON OE_InspectionSchedule(ScheduledDate);
    CREATE INDEX IX_OE_InspectionSchedule_StoreId ON OE_InspectionSchedule(StoreId);

    PRINT 'OE_InspectionSchedule table created successfully';
END
ELSE
BEGIN
    PRINT 'OE_InspectionSchedule table already exists';
END
GO
