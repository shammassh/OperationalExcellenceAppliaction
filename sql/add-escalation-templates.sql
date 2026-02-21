-- Add Escalation Email Templates for OE and OHS
-- These templates are used when action plans are overdue and escalated

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
