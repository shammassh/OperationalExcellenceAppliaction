-- Fix ReportType column size and add missing escalation templates
-- Run on UAT and Live databases

-- Expand ReportType column to fit 'inspection-escalation' (21 chars)
ALTER TABLE EmailTemplates ALTER COLUMN ReportType NVARCHAR(50);
GO

-- OE Inspection Escalation Template
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OE_INSPECTION_ESCALATION')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OE_INSPECTION_ESCALATION',
        'OE Inspection Escalation Alert',
        'OE',
        'inspection-escalation',
        N'🚨 [OE] ESCALATION: Action Plan Requires Attention - {{storeName}} ({{daysOverdue}} days overdue)',
        N'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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

-- OHS Inspection Escalation Template
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OHS_INSPECTION_ESCALATION')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'OHS_INSPECTION_ESCALATION',
        'OHS Safety Inspection Escalation Alert',
        'OHS',
        'inspection-escalation',
        N'🚨 [OHS] SAFETY ESCALATION: Immediate Attention Required - {{storeName}} ({{daysOverdue}} days overdue)',
        N'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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

-- Verify all templates
SELECT TemplateKey, TemplateName, Module, ReportType, IsActive FROM EmailTemplates ORDER BY Module, ReportType;
GO
