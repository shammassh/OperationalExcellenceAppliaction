-- Delivery Log Sheet Tables for Security Services
-- Run on both OEApp_UAT and OEApp_Live databases

-- Main Delivery Log table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_DeliveryLogs')
BEGIN
    CREATE TABLE Security_DeliveryLogs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LogDate DATE NOT NULL,
        Premises NVARCHAR(50) NOT NULL, -- 'HO Dbayeh Block A', 'HO Dbayeh Block B', 'Zouk HO'
        FilledBy NVARCHAR(200) NOT NULL,
        FilledById INT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        Status NVARCHAR(20) DEFAULT 'Active' -- 'Active', 'Deleted'
    );
    
    CREATE INDEX IX_Security_DeliveryLogs_LogDate ON Security_DeliveryLogs(LogDate);
    CREATE INDEX IX_Security_DeliveryLogs_Premises ON Security_DeliveryLogs(Premises);
    
    PRINT 'Security_DeliveryLogs table created';
END
GO

-- Delivery Log Items (multiple entries per log)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Security_DeliveryLogItems')
BEGIN
    CREATE TABLE Security_DeliveryLogItems (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DeliveryLogId INT NOT NULL,
        EmployeeName NVARCHAR(200) NOT NULL,
        ReceivedFrom NVARCHAR(200) NOT NULL,
        DeliveryTime TIME NOT NULL,
        Notes NVARCHAR(500) NULL,
        ItemOrder INT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_DeliveryLogItems_DeliveryLog FOREIGN KEY (DeliveryLogId) 
            REFERENCES Security_DeliveryLogs(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Security_DeliveryLogItems_DeliveryLogId ON Security_DeliveryLogItems(DeliveryLogId);
    
    PRINT 'Security_DeliveryLogItems table created';
END
GO

PRINT 'Security Delivery Log tables setup complete';
