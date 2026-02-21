-- =============================================
-- Report Email Log Setup Script
-- Creates ReportEmailLog table for audit trail
-- of all emails sent from inspection reports
-- Run on both UAT and LIVE databases
-- =============================================

-- =============================================
-- 1. Create ReportEmailLog Table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReportEmailLog')
BEGIN
    CREATE TABLE ReportEmailLog (
        Id INT PRIMARY KEY IDENTITY(1,1),
        
        -- Audit/Report Reference
        AuditId INT NOT NULL,                    -- FK to OE_Inspections or OHS_Inspections
        DocumentNumber NVARCHAR(50) NULL,        -- e.g., GMRL-OEI-0030
        Module NVARCHAR(20) NOT NULL,            -- 'OE' or 'OHS'
        ReportType NVARCHAR(20) NOT NULL,        -- 'full' or 'action-plan'
        
        -- Email Details
        SentBy INT NOT NULL,                     -- FK to Users (who sent)
        SentByEmail NVARCHAR(255) NOT NULL,      -- Email address of sender
        SentByName NVARCHAR(255) NULL,           -- Display name of sender
        
        SentTo NVARCHAR(MAX) NOT NULL,           -- JSON array of recipients
        CcRecipients NVARCHAR(MAX) NULL,         -- JSON array of CC recipients
        
        Subject NVARCHAR(500) NOT NULL,
        ReportUrl NVARCHAR(1000) NULL,           -- Link to the report
        
        -- Status Tracking
        Status NVARCHAR(20) NOT NULL DEFAULT 'sent',  -- 'sent', 'failed', 'pending'
        ErrorMessage NVARCHAR(MAX) NULL,         -- Error details if failed
        
        -- Timestamps
        SentAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Store/Brand Info for reporting
        StoreId INT NULL,
        StoreName NVARCHAR(100) NULL,
        BrandId INT NULL,
        BrandName NVARCHAR(100) NULL
    );

    -- Create indexes for common queries
    CREATE INDEX IX_ReportEmailLog_AuditId ON ReportEmailLog(AuditId);
    CREATE INDEX IX_ReportEmailLog_Module ON ReportEmailLog(Module);
    CREATE INDEX IX_ReportEmailLog_SentBy ON ReportEmailLog(SentBy);
    CREATE INDEX IX_ReportEmailLog_SentAt ON ReportEmailLog(SentAt DESC);
    CREATE INDEX IX_ReportEmailLog_StoreId ON ReportEmailLog(StoreId);
    CREATE INDEX IX_ReportEmailLog_BrandId ON ReportEmailLog(BrandId);
    CREATE INDEX IX_ReportEmailLog_DocumentNumber ON ReportEmailLog(DocumentNumber);
    
    PRINT 'ReportEmailLog table created successfully';
END
ELSE
BEGIN
    PRINT 'ReportEmailLog table already exists';
END
GO

-- =============================================
-- 2. Create View for Email Log with Details
-- =============================================
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_ReportEmailLog')
BEGIN
    DROP VIEW vw_ReportEmailLog;
END
GO

CREATE VIEW vw_ReportEmailLog AS
SELECT 
    rel.Id,
    rel.AuditId,
    rel.DocumentNumber,
    rel.Module,
    rel.ReportType,
    rel.SentBy,
    rel.SentByEmail,
    rel.SentByName,
    rel.SentTo,
    rel.CcRecipients,
    rel.Subject,
    rel.ReportUrl,
    rel.Status,
    rel.ErrorMessage,
    rel.SentAt,
    rel.StoreId,
    rel.StoreName,
    rel.BrandId,
    rel.BrandName,
    -- Computed columns
    CASE rel.Module 
        WHEN 'OE' THEN 'Operational Excellence'
        WHEN 'OHS' THEN 'Occupational Health & Safety'
        ELSE rel.Module
    END AS ModuleDisplayName,
    CASE rel.ReportType
        WHEN 'full' THEN 'Full Report'
        WHEN 'action-plan' THEN 'Action Plan'
        ELSE rel.ReportType
    END AS ReportTypeDisplayName,
    FORMAT(rel.SentAt, 'yyyy-MM-dd HH:mm') AS SentAtFormatted
FROM ReportEmailLog rel;
GO

PRINT 'vw_ReportEmailLog view created successfully';
GO

-- =============================================
-- 3. Sample Queries
-- =============================================
/*
-- Get email history for a specific audit
SELECT * FROM vw_ReportEmailLog 
WHERE AuditId = @AuditId 
ORDER BY SentAt DESC;

-- Get all emails sent by a user
SELECT * FROM vw_ReportEmailLog 
WHERE SentBy = @UserId 
ORDER BY SentAt DESC;

-- Get email statistics by brand
SELECT 
    BrandName,
    Module,
    ReportType,
    COUNT(*) AS EmailCount,
    SUM(CASE WHEN Status = 'sent' THEN 1 ELSE 0 END) AS SuccessCount,
    SUM(CASE WHEN Status = 'failed' THEN 1 ELSE 0 END) AS FailedCount
FROM ReportEmailLog
GROUP BY BrandName, Module, ReportType
ORDER BY BrandName, Module, ReportType;
*/

PRINT '';
PRINT 'Report Email Log setup completed successfully!';
PRINT 'Remember to run this script on both UAT and LIVE databases.';
GO
