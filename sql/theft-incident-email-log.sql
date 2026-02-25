-- Create Theft Incident Email Log table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TheftIncidentEmailLog')
BEGIN
    CREATE TABLE TheftIncidentEmailLog (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        IncidentId INT NOT NULL,
        ToEmail NVARCHAR(255) NOT NULL,
        Subject NVARCHAR(500),
        Status NVARCHAR(50) DEFAULT 'Sent', -- Sent, Failed, Pending
        ErrorMessage NVARCHAR(MAX),
        SentBy INT,
        SentAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (IncidentId) REFERENCES TheftIncidents(Id)
    );
    
    CREATE INDEX IX_TheftIncidentEmailLog_IncidentId ON TheftIncidentEmailLog(IncidentId);
    CREATE INDEX IX_TheftIncidentEmailLog_SentAt ON TheftIncidentEmailLog(SentAt);
    
    PRINT 'TheftIncidentEmailLog table created successfully';
END
ELSE
BEGIN
    PRINT 'TheftIncidentEmailLog table already exists';
END
