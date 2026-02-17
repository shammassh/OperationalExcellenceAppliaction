/**
 * Escalation Module Database Schema
 * SQL-Driven Escalation App for Action Plans
 * Created: 2026-02-17
 */

-- ==========================================
-- 1. ESCALATION SOURCES REGISTRY
-- Stores which apps/modules have action plans that can be escalated
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EscalationSources')
BEGIN
    CREATE TABLE EscalationSources (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SourceCode NVARCHAR(50) NOT NULL UNIQUE,        -- e.g., 'OHS_INSPECTION', 'OE_INSPECTION'
        SourceName NVARCHAR(100) NOT NULL,              -- Display name
        ModuleName NVARCHAR(100) NOT NULL,              -- Module path e.g., 'ohs-inspection'
        ActionItemsTable NVARCHAR(200) NOT NULL,        -- Table name for action items
        IdColumn NVARCHAR(100) DEFAULT 'Id',            -- Primary key column
        InspectionIdColumn NVARCHAR(100) DEFAULT 'InspectionId',  -- Foreign key to inspection
        DepartmentColumn NVARCHAR(100) DEFAULT 'Department',
        DeadlineColumn NVARCHAR(100) DEFAULT 'Deadline',
        ResponsibleColumn NVARCHAR(100) DEFAULT 'Responsible',
        StatusColumn NVARCHAR(100) DEFAULT 'Status',
        PriorityColumn NVARCHAR(100) DEFAULT 'Priority',
        FindingColumn NVARCHAR(100) DEFAULT 'Finding',
        ActionColumn NVARCHAR(100) DEFAULT 'Action',
        FormCode NVARCHAR(100),                         -- For permission checking
        InspectionTable NVARCHAR(200),                  -- Parent inspection table
        StoreNameColumn NVARCHAR(100) DEFAULT 'StoreName',  -- Store name in inspection table
        IconEmoji NVARCHAR(10) DEFAULT '📋',
        ColorHex NVARCHAR(10) DEFAULT '#0078d4',
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    PRINT 'EscalationSources table created';
END
GO

-- ==========================================
-- 2. ESCALATED ITEMS
-- Tracks items that have been escalated
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EscalatedItems')
BEGIN
    CREATE TABLE EscalatedItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SourceId INT NOT NULL FOREIGN KEY REFERENCES EscalationSources(Id),
        SourceItemId INT NOT NULL,                      -- ID in the source action items table
        SourceInspectionId INT,                         -- Inspection ID for reference
        Department NVARCHAR(100) NOT NULL,
        StoreName NVARCHAR(200),
        Finding NVARCHAR(MAX),
        ActionRequired NVARCHAR(MAX),
        OriginalDeadline DATE,
        OriginalResponsible NVARCHAR(255),
        OriginalPriority NVARCHAR(20),
        
        -- Escalation details
        EscalatedBy INT,                                -- User ID who escalated
        EscalatedByName NVARCHAR(255),
        EscalatedAt DATETIME2 DEFAULT GETDATE(),
        EscalationReason NVARCHAR(MAX),
        EscalationLevel INT DEFAULT 1,                  -- For future multi-level escalation
        
        -- Assignment & Resolution
        Status NVARCHAR(50) DEFAULT 'Escalated',        -- Escalated, Acknowledged, InProgress, Resolved, Closed
        Priority NVARCHAR(20) DEFAULT 'High',           -- High, Medium, Low, Critical
        AssignedTo INT,                                 -- User ID
        AssignedToName NVARCHAR(255),
        AssignedAt DATETIME2,
        NewDeadline DATE,
        
        -- Resolution
        ResolvedAt DATETIME2,
        ResolvedBy INT,
        ResolvedByName NVARCHAR(255),
        ResolutionNotes NVARCHAR(MAX),
        
        -- Audit
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        -- Prevent duplicate escalations
        CONSTRAINT UQ_EscalatedItems_Source UNIQUE (SourceId, SourceItemId)
    );
    PRINT 'EscalatedItems table created';
    
    -- Indexes
    CREATE INDEX IX_EscalatedItems_Department ON EscalatedItems(Department);
    CREATE INDEX IX_EscalatedItems_Status ON EscalatedItems(Status);
    CREATE INDEX IX_EscalatedItems_EscalatedAt ON EscalatedItems(EscalatedAt);
END
GO

-- ==========================================
-- 3. ESCALATION EMAIL TEMPLATES
-- Configurable email templates
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EscalationEmailTemplates')
BEGIN
    CREATE TABLE EscalationEmailTemplates (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateCode NVARCHAR(50) NOT NULL UNIQUE,      -- e.g., 'OVERDUE_NOTIFICATION', 'ESCALATION_ALERT'
        TemplateName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500),
        Subject NVARCHAR(500) NOT NULL,                 -- Email subject with placeholders
        Body NVARCHAR(MAX) NOT NULL,                    -- Email body (HTML) with placeholders
        PlaceholdersJson NVARCHAR(MAX),                 -- JSON array of available placeholders
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255)
    );
    PRINT 'EscalationEmailTemplates table created';
END
GO

-- ==========================================
-- 4. ESCALATION NOTIFICATION LOG
-- Tracks sent emails to prevent duplicates
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EscalationNotificationLog')
BEGIN
    CREATE TABLE EscalationNotificationLog (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateCode NVARCHAR(50) NOT NULL,
        SourceId INT,
        SourceItemId INT,
        EscalatedItemId INT,
        RecipientEmail NVARCHAR(255) NOT NULL,
        RecipientName NVARCHAR(255),
        Subject NVARCHAR(500),
        SentAt DATETIME2 DEFAULT GETDATE(),
        Status NVARCHAR(50) DEFAULT 'Sent',             -- Sent, Failed, Pending
        ErrorMessage NVARCHAR(MAX),
        NotificationDate DATE DEFAULT CAST(GETDATE() AS DATE),  -- For daily duplicate check
        
        -- Index for duplicate prevention
        CONSTRAINT UQ_NotificationLog_Daily UNIQUE (TemplateCode, SourceId, SourceItemId, RecipientEmail, NotificationDate)
    );
    PRINT 'EscalationNotificationLog table created';
END
GO

-- ==========================================
-- 5. DEPARTMENT CONTACTS
-- Multiple contacts per department
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DepartmentContacts')
BEGIN
    CREATE TABLE DepartmentContacts (
        Id INT PRIMARY KEY IDENTITY(1,1),
        DepartmentName NVARCHAR(100) NOT NULL,
        ContactEmail NVARCHAR(255) NOT NULL,
        ContactName NVARCHAR(255),
        ContactRole NVARCHAR(100),                      -- Head, Deputy, Coordinator, etc.
        ReceiveOverdueAlerts BIT DEFAULT 1,
        ReceiveEscalationAlerts BIT DEFAULT 1,
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        CONSTRAINT UQ_DepartmentContacts UNIQUE (DepartmentName, ContactEmail)
    );
    PRINT 'DepartmentContacts table created';
    
    CREATE INDEX IX_DepartmentContacts_Dept ON DepartmentContacts(DepartmentName);
END
GO

-- ==========================================
-- 6. ESCALATION RULES (Placeholder for future)
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EscalationRules')
BEGIN
    CREATE TABLE EscalationRules (
        Id INT PRIMARY KEY IDENTITY(1,1),
        RuleName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500),
        RuleType NVARCHAR(50) NOT NULL,                 -- 'AUTO_ESCALATE', 'NOTIFICATION', 'ASSIGNMENT'
        ConditionJson NVARCHAR(MAX),                    -- JSON conditions
        ActionJson NVARCHAR(MAX),                       -- JSON actions to take
        Priority INT DEFAULT 0,                         -- Rule execution order
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    PRINT 'EscalationRules table created';
END
GO

-- ==========================================
-- INSERT DEFAULT DATA
-- ==========================================

-- Default Escalation Sources
IF NOT EXISTS (SELECT 1 FROM EscalationSources WHERE SourceCode = 'OHS_INSPECTION')
BEGIN
    INSERT INTO EscalationSources (
        SourceCode, SourceName, ModuleName, ActionItemsTable, 
        IdColumn, InspectionIdColumn, DepartmentColumn, DeadlineColumn, ResponsibleColumn,
        StatusColumn, PriorityColumn, FindingColumn, ActionColumn,
        FormCode, InspectionTable, StoreNameColumn, IconEmoji, ColorHex, SortOrder
    ) VALUES (
        'OHS_INSPECTION', 'OHS Inspection', 'ohs-inspection', 'OHS_InspectionActionItems',
        'Id', 'InspectionId', 'Department', 'Deadline', 'Responsible',
        'Status', 'Priority', 'Finding', 'Action',
        'OHS_INSPECTION', 'OHS_Inspections', 'StoreName', '🛡️', '#dc2626', 1
    );
    PRINT 'Added OHS_INSPECTION source';
END

IF NOT EXISTS (SELECT 1 FROM EscalationSources WHERE SourceCode = 'OE_INSPECTION')
BEGIN
    INSERT INTO EscalationSources (
        SourceCode, SourceName, ModuleName, ActionItemsTable, 
        IdColumn, InspectionIdColumn, DepartmentColumn, DeadlineColumn, ResponsibleColumn,
        StatusColumn, PriorityColumn, FindingColumn, ActionColumn,
        FormCode, InspectionTable, StoreNameColumn, IconEmoji, ColorHex, SortOrder
    ) VALUES (
        'OE_INSPECTION', 'OE Inspection', 'oe-inspection', 'OE_InspectionActionItems',
        'Id', 'InspectionId', 'Department', 'Deadline', 'Responsible',
        'Status', 'Priority', 'Finding', 'Action',
        'OE_INSPECTION', 'OE_Inspections', 'StoreName', '🔍', '#10b981', 2
    );
    PRINT 'Added OE_INSPECTION source';
END
GO

-- Default Email Templates
IF NOT EXISTS (SELECT 1 FROM EscalationEmailTemplates WHERE TemplateCode = 'OVERDUE_NOTIFICATION')
BEGIN
    INSERT INTO EscalationEmailTemplates (TemplateCode, TemplateName, Description, Subject, Body, PlaceholdersJson)
    VALUES (
        'OVERDUE_NOTIFICATION',
        'Overdue Action Item Notification',
        'Sent when an action item deadline has passed',
        '⚠️ Overdue Action Item: {{finding}} - {{storeName}}',
        N'<html>
<body style="font-family: Segoe UI, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ Overdue Action Item</h2>
    </div>
    <div style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>Dear {{responsibleName}},</p>
        <p>The following action item is <strong style="color: #dc2626;">overdue</strong> and requires immediate attention:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Store</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Source</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{sourceName}}</td>
            </tr>
            <tr style="background: #f9fafb;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Finding</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{finding}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Action Required</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{action}}</td>
            </tr>
            <tr style="background: #fef2f2;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Deadline</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">{{deadline}} ({{daysOverdue}} days overdue)</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Department</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{department}}</td>
            </tr>
            <tr style="background: #f9fafb;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Priority</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{priority}}</td>
            </tr>
        </table>
        
        <p>Please take immediate action to complete this item or update its status.</p>
        
        <p style="margin-top: 30px;">
            <a href="{{appUrl}}/escalation" style="background: #0078d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View in Escalation Dashboard</a>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated notification from {{appName}}.</p>
    </div>
</body>
</html>',
        '["responsibleName", "storeName", "sourceName", "finding", "action", "deadline", "daysOverdue", "department", "priority", "appUrl", "appName"]'
    );
    PRINT 'Added OVERDUE_NOTIFICATION template';
END

IF NOT EXISTS (SELECT 1 FROM EscalationEmailTemplates WHERE TemplateCode = 'ESCALATION_ALERT')
BEGIN
    INSERT INTO EscalationEmailTemplates (TemplateCode, TemplateName, Description, Subject, Body, PlaceholdersJson)
    VALUES (
        'ESCALATION_ALERT',
        'Escalation Alert',
        'Sent when an item is escalated to a department',
        '🔴 Escalated: {{finding}} - {{storeName}}',
        N'<html>
<body style="font-family: Segoe UI, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🔴 Action Item Escalated</h2>
    </div>
    <div style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>Dear {{recipientName}},</p>
        <p>An action item has been <strong style="color: #7c3aed;">escalated</strong> to the {{department}} department:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Store</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Source</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{sourceName}}</td>
            </tr>
            <tr style="background: #f9fafb;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Finding</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{finding}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Action Required</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{action}}</td>
            </tr>
            <tr style="background: #f9fafb;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Deadline</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{deadline}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Priority</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{priority}}</td>
            </tr>
            <tr style="background: #faf5ff;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Escalated By</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{escalatedBy}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Reason</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">{{escalationReason}}</td>
            </tr>
        </table>
        
        <p>Please review and take appropriate action.</p>
        
        <p style="margin-top: 30px;">
            <a href="{{appUrl}}/escalation" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View in Escalation Dashboard</a>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated notification from {{appName}}.</p>
    </div>
</body>
</html>',
        '["recipientName", "department", "storeName", "sourceName", "finding", "action", "deadline", "priority", "escalatedBy", "escalationReason", "appUrl", "appName"]'
    );
    PRINT 'Added ESCALATION_ALERT template';
END
GO

-- Default Department Contacts (empty, admin will fill)
-- Just create sample structure
IF NOT EXISTS (SELECT 1 FROM DepartmentContacts WHERE DepartmentName = 'Maintenance')
BEGIN
    INSERT INTO DepartmentContacts (DepartmentName, ContactEmail, ContactName, ContactRole, SortOrder)
    VALUES 
        ('Maintenance', 'maintenance.head@example.com', 'Maintenance Head', 'Head', 1),
        ('Procurement', 'procurement.head@example.com', 'Procurement Head', 'Head', 1),
        ('Cleaning', 'cleaning.head@example.com', 'Cleaning Head', 'Head', 1);
    PRINT 'Added sample department contacts (update with real emails)';
END
GO

PRINT '';
PRINT '==========================================';
PRINT '  Escalation Tables Setup Complete!';
PRINT '==========================================';
PRINT '';
PRINT 'Tables created:';
PRINT '  - EscalationSources (registry of apps with action plans)';
PRINT '  - EscalatedItems (tracking escalated items)';
PRINT '  - EscalationEmailTemplates (configurable email templates)';
PRINT '  - EscalationNotificationLog (sent email log)';
PRINT '  - DepartmentContacts (multiple contacts per department)';
PRINT '  - EscalationRules (placeholder for future)';
PRINT '';
PRINT 'Next steps:';
PRINT '  1. Update DepartmentContacts with real email addresses';
PRINT '  2. Customize email templates via admin UI';
PRINT '  3. Add more escalation sources as needed';
GO
