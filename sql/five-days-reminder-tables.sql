-- 5 Days Reminder System Tables
-- Created: 2026-02-27

-- Table to log reminders sent (prevent duplicates)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FiveDaysReminderLog')
BEGIN
    CREATE TABLE FiveDaysReminderLog (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CycleKey NVARCHAR(50) NOT NULL,          -- e.g., "2026-2-C1" for Feb cycle 1
        ReminderType NVARCHAR(50) NOT NULL,       -- INITIATE, DAY_1, DAY_2, etc.
        StoreId INT NOT NULL,
        RecipientEmail NVARCHAR(200),
        SentAt DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_FiveDaysReminderLog_Store 
            FOREIGN KEY (StoreId) REFERENCES Stores(Id)
    );
    
    CREATE INDEX IX_FiveDaysReminderLog_Cycle ON FiveDaysReminderLog(CycleKey, ReminderType, StoreId);
    CREATE INDEX IX_FiveDaysReminderLog_Date ON FiveDaysReminderLog(SentAt);
    
    PRINT 'Created FiveDaysReminderLog table';
END
GO

-- Table to track 5 Days cycle status per store
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FiveDaysCycleStatus')
BEGIN
    CREATE TABLE FiveDaysCycleStatus (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CycleKey NVARCHAR(50) NOT NULL,
        StoreId INT NOT NULL,
        Status NVARCHAR(20) DEFAULT 'Pending',    -- Pending, InProgress, Completed, Overdue
        EntryCount INT DEFAULT 0,
        StartedAt DATETIME,
        CompletedAt DATETIME,
        ClosedAt DATETIME,
        Notes NVARCHAR(500),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_FiveDaysCycleStatus_Store 
            FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        CONSTRAINT UQ_FiveDaysCycleStatus_CycleStore 
            UNIQUE (CycleKey, StoreId)
    );
    
    CREATE INDEX IX_FiveDaysCycleStatus_Cycle ON FiveDaysCycleStatus(CycleKey);
    CREATE INDEX IX_FiveDaysCycleStatus_Status ON FiveDaysCycleStatus(Status);
    
    PRINT 'Created FiveDaysCycleStatus table';
END
GO

-- Settings table for 5 Days reminder configuration
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FiveDaysSettings')
BEGIN
    CREATE TABLE FiveDaysSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(500),
        Description NVARCHAR(500),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        UpdatedBy INT
    );
    
    -- Insert default settings
    INSERT INTO FiveDaysSettings (SettingKey, SettingValue, Description) VALUES
    ('ReminderEnabled', 'true', 'Enable/disable automatic reminders'),
    ('EmailEnabled', 'true', 'Enable/disable email notifications'),
    ('BroadcastEnabled', 'true', 'Enable/disable broadcast notifications'),
    ('ReminderTime', '08:00', 'Time to send daily reminders (24h format)'),
    ('TargetRoles', 'Store Manager', 'Roles to receive reminders'),
    ('SendInitiateReminder', 'true', 'Send reminder when cycle starts'),
    ('Send48HourReminder', 'true', 'Send 48 hour warning'),
    ('SendDailyReminders', 'true', 'Send Day 1-5 reminders'),
    ('SendFinalReminder', 'true', 'Send final reminder after cycle ends'),
    ('SendOverdueWarning', 'true', 'Send overdue warning with audit impact');
    
    PRINT 'Created FiveDaysSettings table with defaults';
END
GO

-- Add email templates for 5 Days reminders if not exist
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'FIVEDAYS_INITIATE')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
    VALUES (
        'FIVEDAYS_INITIATE',
        '5 Days - Cycle Start Notification',
        'OE',
        'fivedays-initiate',
        '📅 5 Days Cycle Started - Begin Recording Expired Items',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .message-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .btn { display: inline-block; padding: 14px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .checklist { background: #e8f5e9; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .checklist-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .checklist-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 5 Days Cycle Started</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Time to Record Expired Items</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <p>The 5 Days Expired Items cycle has <strong>officially started</strong> for {{storeName}}!</p>
            
            <div class="message-box">
                <strong>📋 Your Task:</strong><br>
                Record ALL expired items found in your store during this 5-day period.
            </div>
            
            <div class="checklist">
                <strong>Daily Checklist:</strong>
                <div class="checklist-item">✅ Check all shelves for expired products</div>
                <div class="checklist-item">✅ Check refrigerated items</div>
                <div class="checklist-item">✅ Check backstock area</div>
                <div class="checklist-item">✅ Record findings in the system</div>
            </div>
            
            <p><strong>Cycle End Date:</strong> {{cycleEndDate}}</p>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Open 5 Days Form</a>
            </div>
        </div>
        <div class="footer">
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
        1,
        GETDATE()
    );
    
    PRINT 'Added FIVEDAYS_INITIATE email template';
END
GO

IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'FIVEDAYS_DAILY')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
    VALUES (
        'FIVEDAYS_DAILY',
        '5 Days - Daily Reminder',
        'OE',
        'fivedays-daily',
        '📋 Day {{dayNumber}} Reminder - 5 Days Expired Items',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .day-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 18px; font-weight: 600; background: rgba(102, 126, 234, 0.15); color: #667eea; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .btn { display: inline-block; padding: 14px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .progress { background: #e9ecef; border-radius: 10px; height: 20px; margin: 20px 0; }
        .progress-bar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; border-radius: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Day {{dayNumber}} of 5</h1>
            <div style="margin-top: 8px; opacity: 0.9;">5 Days Expired Items Check</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="day-badge">Day {{dayNumber}} / 5</div>
            </div>
            
            <div class="progress">
                <div class="progress-bar" style="width: {{progressPercent}}%;"></div>
            </div>
            
            <div class="message-box">
                {{message}}
            </div>
            
            <p><strong>Your entries so far:</strong> {{entryCount}} items recorded</p>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Continue Recording</a>
            </div>
        </div>
        <div class="footer">
            <p>Store: {{storeName}} | Sent: {{sentDate}}</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
        1,
        GETDATE()
    );
    
    PRINT 'Added FIVEDAYS_DAILY email template';
END
GO

IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'FIVEDAYS_OVERDUE')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
    VALUES (
        'FIVEDAYS_OVERDUE',
        '5 Days - Overdue Warning',
        'OE',
        'fivedays-overdue',
        '🚨 WARNING: Missing 5 Days Data - Audit Impact',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .warning-box { background: #ffebee; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .btn { display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .impact-list { background: #fff3cd; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107; }
        .impact-item { padding: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 OVERDUE WARNING</h1>
            <div style="margin-top: 8px; opacity: 0.9;">5 Days Entries Missing</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div class="warning-box">
                <strong>⚠️ Your 5 Days cycle submissions are OVERDUE!</strong><br><br>
                The cycle ended on {{cycleEndDate}} and we have not received complete submissions from {{storeName}}.
            </div>
            
            <div class="impact-list">
                <strong>⚡ This WILL affect your store:</strong>
                <div class="impact-item">❌ Negative mark on upcoming store audit</div>
                <div class="impact-item">❌ Compliance score reduction</div>
                <div class="impact-item">❌ Area Manager notification</div>
            </div>
            
            <p><strong>Days overdue:</strong> {{daysOverdue}}</p>
            <p><strong>Entries recorded:</strong> {{entryCount}} ({{status}})</p>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Complete Now</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated compliance warning.</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
        1,
        GETDATE()
    );
    
    PRINT 'Added FIVEDAYS_OVERDUE email template';
END
GO

-- Verify templates
SELECT TemplateKey, TemplateName FROM EmailTemplates WHERE TemplateKey LIKE 'FIVEDAYS_%' OR TemplateKey LIKE 'BROADCAST_5DAYS%';
