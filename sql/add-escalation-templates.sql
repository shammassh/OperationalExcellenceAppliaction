-- Add Escalation Email Templates for OE and OHS
-- These templates are used when action plans are overdue and escalated
-- Updated: 2026-02-25 - Added inspection-level notification templates

-- ============================================================================
-- PART 1: Add missing columns to OHS_Inspections (OE already has these)
-- ============================================================================

-- Add ActionPlanDeadline column to OHS_Inspections if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OHS_Inspections' AND COLUMN_NAME = 'ActionPlanDeadline')
BEGIN
    ALTER TABLE OHS_Inspections ADD ActionPlanDeadline DATETIME NULL;
    PRINT 'Added ActionPlanDeadline column to OHS_Inspections';
END
ELSE
BEGIN
    PRINT 'ActionPlanDeadline column already exists on OHS_Inspections';
END
GO

-- Add ActionPlanCompletedAt column to OHS_Inspections if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OHS_Inspections' AND COLUMN_NAME = 'ActionPlanCompletedAt')
BEGIN
    ALTER TABLE OHS_Inspections ADD ActionPlanCompletedAt DATETIME NULL;
    PRINT 'Added ActionPlanCompletedAt column to OHS_Inspections';
END
ELSE
BEGIN
    PRINT 'ActionPlanCompletedAt column already exists on OHS_Inspections';
END
GO

-- Create OHS_EscalationSettings table if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'OHS_EscalationSettings')
BEGIN
    CREATE TABLE OHS_EscalationSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(500) NOT NULL,
        Description NVARCHAR(500),
        UpdatedBy INT,
        UpdatedAt DATETIME DEFAULT GETDATE()
    );

    -- Insert default settings (same as OE)
    INSERT INTO OHS_EscalationSettings (SettingKey, SettingValue, Description) VALUES
    ('ActionPlanDeadlineDays', '7', 'Default number of days to complete action plan'),
    ('ReminderDays', '3,1', 'Days before deadline to send reminders (comma-separated)'),
    ('EscalationEnabled', 'true', 'Enable automatic escalation to Area Manager'),
    ('EmailNotifications', 'true', 'Send email notifications for reminders and escalations'),
    ('InAppNotifications', 'true', 'Create in-app notifications for reminders and escalations');

    PRINT 'Created OHS_EscalationSettings table with default values';
END
ELSE
BEGIN
    PRINT 'OHS_EscalationSettings table already exists';
END
GO

-- ============================================================================
-- PART 2: Existing Escalation Templates (OE_ESCALATION, OHS_ESCALATION)
-- ============================================================================

-- OE Escalation Template
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OE_ESCALATION')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OE_ESCALATION',
        'OE Escalation Notification',
        'OE',
        'escalation',
        '[OE] Action Plan Overdue: {{storeName}} - {{documentNumber}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #ff6b6b, #ee5a24); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">OE Action Plan Escalation</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>An OE inspection action plan has exceeded its deadline and requires your attention:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #fff3cd;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
        </table>
        
        <p>Please contact the Store Manager to ensure the action plan is completed promptly.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #ee5a24; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated notification from the OE Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OE_ESCALATION template';
END
ELSE
BEGIN
    PRINT 'OE_ESCALATION template already exists';
END
GO

-- OHS Escalation Template
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OHS_ESCALATION')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OHS_ESCALATION',
        'OHS Escalation Notification',
        'OHS',
        'escalation',
        '[OHS] Action Plan Overdue: {{storeName}} - {{documentNumber}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">OHS Safety Action Plan Escalation</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>An OHS safety inspection action plan has exceeded its deadline and requires <strong>immediate attention</strong>:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #ffebee;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #c0392b; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
        </table>
        
        <p style="color: #c0392b;"><strong>Safety compliance is critical.</strong> Please ensure immediate action is taken to address the outstanding safety findings.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #c0392b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Safety Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated notification from the OHS Safety Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OHS_ESCALATION template';
END
ELSE
BEGIN
    PRINT 'OHS_ESCALATION template already exists';
END
GO

SELECT TemplateKey, TemplateName, Module, ReportType FROM EmailTemplates ORDER BY Module, ReportType;
GO

-- ============================================================================
-- PART 3: NEW Inspection-Level Notification Templates
-- ============================================================================

-- OE Inspection Reminder Template (sent X days before deadline)
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OE_INSPECTION_REMINDER')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OE_INSPECTION_REMINDER',
        'OE Inspection Reminder',
        'OE',
        'inspection-reminder',
        '⏰ [OE] Action Plan Reminder: {{storeName}} - {{documentNumber}} ({{daysUntilDeadline}} days left)',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #3498db, #2980b9); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">⏰ OE Action Plan Reminder</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>This is a reminder that the action plan for the following OE inspection is due soon:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr style="background: #e3f2fd;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #2980b9; font-weight: bold;">{{deadline}}</td>
            </tr>
            <tr style="background: #fff3e0;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Remaining</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e67e22; font-weight: bold;">{{daysUntilDeadline}} day(s)</td>
            </tr>
        </table>
        
        <p>Please ensure all action items are addressed before the deadline to avoid escalation.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated reminder from the OE Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OE_INSPECTION_REMINDER template';
END
GO

-- OE Inspection Overdue Template (sent when deadline passed, before escalation)
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OE_INSPECTION_OVERDUE')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OE_INSPECTION_OVERDUE',
        'OE Inspection Overdue Notice',
        'OE',
        'inspection-overdue',
        '⚠️ [OE] Action Plan OVERDUE: {{storeName}} - {{documentNumber}} ({{daysOverdue}} days overdue)',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #e67e22, #d35400); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">⚠️ OE Action Plan Overdue</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p><strong style="color: #e67e22;">The action plan deadline has passed.</strong> Please complete the outstanding items immediately to avoid escalation to your Area Manager.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #fff3cd;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
        </table>
        
        <p style="color: #e67e22;"><strong>Action Required:</strong> Complete all outstanding action items as soon as possible.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #e67e22; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Action Plan Now</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated notification from the OE Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OE_INSPECTION_OVERDUE template';
END
GO

-- OE Inspection Escalation Template (sent to Area Manager after escalation threshold)
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OE_INSPECTION_ESCALATION')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OE_INSPECTION_ESCALATION',
        'OE Inspection Escalation Alert',
        'OE',
        'inspection-escalation',
        '🚨 [OE] ESCALATION: Action Plan Requires Attention - {{storeName}} ({{daysOverdue}} days overdue)',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">🚨 OE Action Plan Escalation</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>An OE inspection action plan has been <strong style="color: #e74c3c;">escalated to you</strong> as it has exceeded the allowed deadline:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #ffebee;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #c0392b; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store Manager</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeManagerName}}</td>
            </tr>
        </table>
        
        <p style="color: #c0392b;"><strong>Your attention is required.</strong> Please follow up with the Store Manager to ensure the action plan is completed immediately.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #c0392b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated escalation from the OE Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OE_INSPECTION_ESCALATION template';
END
GO

-- ============================================================================
-- OHS Inspection Templates
-- ============================================================================

-- OHS Inspection Reminder Template
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OHS_INSPECTION_REMINDER')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OHS_INSPECTION_REMINDER',
        'OHS Safety Inspection Reminder',
        'OHS',
        'inspection-reminder',
        '⏰ [OHS] Safety Action Plan Reminder: {{storeName}} - {{documentNumber}} ({{daysUntilDeadline}} days left)',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">⏰ OHS Safety Action Plan Reminder</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>This is a reminder that the <strong>safety action plan</strong> for the following OHS inspection is due soon:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr style="background: #e8f5e9;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #27ae60; font-weight: bold;">{{deadline}}</td>
            </tr>
            <tr style="background: #fff3e0;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Remaining</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e67e22; font-weight: bold;">{{daysUntilDeadline}} day(s)</td>
            </tr>
        </table>
        
        <p style="color: #27ae60;"><strong>Safety compliance is critical.</strong> Please ensure all safety action items are addressed before the deadline.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #27ae60; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Safety Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated reminder from the OHS Safety Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OHS_INSPECTION_REMINDER template';
END
GO

-- OHS Inspection Overdue Template
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OHS_INSPECTION_OVERDUE')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OHS_INSPECTION_OVERDUE',
        'OHS Safety Inspection Overdue Notice',
        'OHS',
        'inspection-overdue',
        '⚠️ [OHS] Safety Action Plan OVERDUE: {{storeName}} - {{documentNumber}} ({{daysOverdue}} days overdue)',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #e67e22, #d35400); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">⚠️ OHS Safety Action Plan Overdue</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p><strong style="color: #e74c3c;">URGENT: The safety action plan deadline has passed.</strong> Please complete the outstanding safety items immediately to maintain compliance and avoid escalation.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #ffebee;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
        </table>
        
        <p style="color: #e74c3c;"><strong>⚠️ Safety compliance must not be delayed.</strong> Complete all outstanding safety action items immediately.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #e67e22; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Safety Action Plan Now</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated notification from the OHS Safety Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OHS_INSPECTION_OVERDUE template';
END
GO

-- OHS Inspection Escalation Template
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OHS_INSPECTION_ESCALATION')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OHS_INSPECTION_ESCALATION',
        'OHS Safety Inspection Escalation Alert',
        'OHS',
        'inspection-escalation',
        '🚨 [OHS] SAFETY ESCALATION: Immediate Attention Required - {{storeName}} ({{daysOverdue}} days overdue)',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #c0392b, #922b21); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">🚨 OHS Safety Action Plan Escalation</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>An OHS <strong>safety inspection action plan</strong> has been <strong style="color: #c0392b;">escalated to you</strong> due to non-compliance with the deadline:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #ffebee;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #c0392b; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store Manager</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeManagerName}}</td>
            </tr>
        </table>
        
        <div style="background: #ffebee; border-left: 4px solid #c0392b; padding: 15px; margin: 20px 0;">
            <p style="color: #c0392b; margin: 0;"><strong>🚨 SAFETY COMPLIANCE ALERT</strong></p>
            <p style="margin: 10px 0 0 0;">Outstanding safety findings must be addressed immediately. Please contact the Store Manager and ensure all action items are completed as a priority.</p>
        </div>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #c0392b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Safety Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated safety escalation from the OHS Inspection System.</em>
        </p>
    </div>
</div>',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Added OHS_INSPECTION_ESCALATION template';
END
GO

-- ============================================================================
-- PART 4: Display all templates
-- ============================================================================

PRINT '';
PRINT '=== All Email Templates ===';
SELECT TemplateKey, TemplateName, Module, ReportType, IsActive FROM EmailTemplates ORDER BY Module, ReportType;
GO