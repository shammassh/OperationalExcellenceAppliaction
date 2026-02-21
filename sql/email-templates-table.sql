-- Email Templates Table
-- Stores customizable email templates for OE and OHS reports

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmailTemplates')
BEGIN
    CREATE TABLE EmailTemplates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TemplateKey NVARCHAR(50) NOT NULL UNIQUE,  -- e.g., 'OE_FULL', 'OE_ACTION_PLAN', 'OHS_FULL', 'OHS_ACTION_PLAN'
        TemplateName NVARCHAR(100) NOT NULL,
        Module NVARCHAR(10) NOT NULL,  -- 'OE' or 'OHS'
        ReportType NVARCHAR(20) NOT NULL,  -- 'full' or 'action-plan'
        SubjectTemplate NVARCHAR(500) NOT NULL,
        BodyTemplate NVARCHAR(MAX) NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        UpdatedBy NVARCHAR(100)
    );
    
    PRINT 'EmailTemplates table created successfully';
END
ELSE
BEGIN
    PRINT 'EmailTemplates table already exists';
END
GO

-- Insert default templates if they don't exist
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OE_FULL')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate)
    VALUES (
        'OE_FULL',
        'OE Full Report Email',
        'OE',
        'full',
        '📋 OE Inspection Report - {{storeName}} - {{documentNumber}} ({{totalScore}}%)',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: {{brandGradient}}; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .score-badge { display: inline-block; padding: 10px 25px; border-radius: 25px; font-size: 20px; font-weight: 700; margin: 15px 0; }
        .score-pass { background: rgba(40, 167, 69, 0.15); color: #28a745; }
        .score-fail { background: rgba(220, 53, 69, 0.15); color: #dc3545; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: {{brandColor}}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 OE Inspection Report</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Please find below the summary of the Operational Excellence inspection conducted at your store:</p>
            
            <div style="text-align: center;">
                <div class="score-badge {{scoreClass}}">
                    {{scoreIcon}} Score: {{totalScore}}% ({{scoreStatus}})
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{auditors}}</td></tr>
                <tr><td class="label">Status</td><td class="value">{{status}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📄 View Full Report</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Please review the report and address any findings within the required timeframe.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>'
    );
    PRINT 'Inserted OE_FULL template';
END

IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OE_ACTION_PLAN')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate)
    VALUES (
        'OE_ACTION_PLAN',
        'OE Action Plan Email',
        'OE',
        'action-plan',
        '📝 OE Action Plan Required - {{storeName}} - {{totalFindings}} Findings ({{highFindings}} High)',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: {{brandGradient}}; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .findings-grid { display: table; width: 100%; margin: 20px 0; }
        .finding-stat { display: table-cell; text-align: center; padding: 15px; }
        .finding-stat .count { font-size: 32px; font-weight: 700; }
        .finding-stat .count.total { color: #333; }
        .finding-stat .count.high { color: #dc3545; }
        .finding-stat .count.medium { color: #fd7e14; }
        .finding-stat .count.low { color: #ffc107; }
        .finding-stat .label { font-size: 12px; color: #666; margin-top: 5px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: {{brandColor}}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .deadline-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 OE Action Plan</h1>
            <div class="subtitle">{{storeName}} - {{documentNumber}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Following the Operational Excellence inspection at your store, please find below the findings that require your attention:</p>
            
            <div class="findings-grid">
                <div class="finding-stat"><div class="count total">{{totalFindings}}</div><div class="label">Total</div></div>
                <div class="finding-stat"><div class="count high">{{highFindings}}</div><div class="label">High</div></div>
                <div class="finding-stat"><div class="count medium">{{mediumFindings}}</div><div class="label">Medium</div></div>
                <div class="finding-stat"><div class="count low">{{lowFindings}}</div><div class="label">Low</div></div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}}</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{auditors}}</td></tr>
            </table>
            
            <div class="deadline-box">
                ⏰ <strong>Deadline:</strong> Please complete all corrective actions by {{deadline}}
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📋 View Action Plan</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>'
    );
    PRINT 'Inserted OE_ACTION_PLAN template';
END

IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OHS_FULL')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate)
    VALUES (
        'OHS_FULL',
        'OHS Full Report Email',
        'OHS',
        'full',
        '🦺 OHS Inspection Report - {{storeName}} - {{documentNumber}} ({{totalScore}}%)',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .score-badge { display: inline-block; padding: 10px 25px; border-radius: 25px; font-size: 20px; font-weight: 700; margin: 15px 0; }
        .score-pass { background: rgba(40, 167, 69, 0.15); color: #28a745; }
        .score-fail { background: rgba(220, 53, 69, 0.15); color: #dc3545; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #e17055; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🦺 OHS Inspection Report</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Please find below the summary of the Occupational Health & Safety inspection conducted at your store:</p>
            
            <div style="text-align: center;">
                <div class="score-badge {{scoreClass}}">
                    {{scoreIcon}} Score: {{totalScore}}% ({{scoreStatus}})
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{inspectionDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{inspectors}}</td></tr>
                <tr><td class="label">Status</td><td class="value">{{status}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📄 View Full Report</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Please review the report and ensure all safety standards are maintained.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from the OHS Inspection System.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>'
    );
    PRINT 'Inserted OHS_FULL template';
END

IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'OHS_ACTION_PLAN')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate)
    VALUES (
        'OHS_ACTION_PLAN',
        'OHS Action Plan Email',
        'OHS',
        'action-plan',
        '⚠️ OHS Action Plan Required - {{storeName}} - {{totalFindings}} Safety Findings',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .findings-grid { display: table; width: 100%; margin: 20px 0; }
        .finding-stat { display: table-cell; text-align: center; padding: 15px; }
        .finding-stat .count { font-size: 28px; font-weight: 700; }
        .finding-stat .count.total { color: #333; }
        .finding-stat .count.critical { color: #7c3aed; }
        .finding-stat .count.high { color: #dc3545; }
        .finding-stat .count.medium { color: #fd7e14; }
        .finding-stat .count.low { color: #ffc107; }
        .finding-stat .label { font-size: 11px; color: #666; margin-top: 5px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #e17055; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .urgent-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ OHS Action Plan</h1>
            <div class="subtitle">{{storeName}} - {{documentNumber}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Following the OHS inspection at your store, the following safety findings require <strong>immediate attention</strong>:</p>
            
            <div class="findings-grid">
                <div class="finding-stat"><div class="count total">{{totalFindings}}</div><div class="label">Total</div></div>
                <div class="finding-stat"><div class="count critical">{{criticalFindings}}</div><div class="label">Critical</div></div>
                <div class="finding-stat"><div class="count high">{{highFindings}}</div><div class="label">High</div></div>
                <div class="finding-stat"><div class="count medium">{{mediumFindings}}</div><div class="label">Medium</div></div>
                <div class="finding-stat"><div class="count low">{{lowFindings}}</div><div class="label">Low</div></div>
            </div>
            
            <div class="urgent-box">
                🚨 <strong>Safety Priority:</strong> Critical and High priority items must be addressed within 48 hours.
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}}</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{inspectionDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{inspectors}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📋 View Action Plan</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the OHS Inspection System.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>'
    );
    PRINT 'Inserted OHS_ACTION_PLAN template';
END

PRINT 'Email templates setup completed!';
