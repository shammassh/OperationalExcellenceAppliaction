-- Add Theft Incident Report Email Template
INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
VALUES (
    'THEFT_INCIDENT_REPORT',
    'Theft Incident Report',
    'Stores',
    'theft-incident',
    '[Theft Incident] {{storeName}} - {{incidentDate}} - {{currency}} {{stolenValue}}',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .alert-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 18px; font-weight: 700; background: rgba(220, 53, 69, 0.15); color: #dc3545; margin: 15px 0; }
        .section { margin: 25px 0; }
        .section-title { font-size: 16px; font-weight: 600; color: #495057; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #dc3545; }
        .details-table { width: 100%; border-collapse: collapse; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .value-box { display: inline-block; padding: 20px 30px; background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%); color: white; border-radius: 12px; margin: 10px 5px; text-align: center; }
        .value-box .amount { font-size: 28px; font-weight: 700; }
        .value-box .label { font-size: 12px; opacity: 0.9; }
        .collected-box { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); }
        .btn { display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .thief-info { background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Theft Incident Report</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            <p>A theft incident has been reported at <strong>{{storeName}}</strong>. Please review the details below:</p>
            
            <div style="text-align: center; margin: 25px 0;">
                <div class="value-box">
                    <div class="label">STOLEN VALUE</div>
                    <div class="amount">{{currency}} {{stolenValue}}</div>
                </div>
                <div class="value-box collected-box">
                    <div class="label">VALUE COLLECTED</div>
                    <div class="amount">{{currency}} {{valueCollected}}</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">📍 Store Information</div>
                <table class="details-table">
                    <tr><td class="label">Store</td><td class="value">{{storeName}}</td></tr>
                    <tr><td class="label">Incident Date</td><td class="value">{{incidentDate}}</td></tr>
                    <tr><td class="label">Store Manager</td><td class="value">{{storeManager}}</td></tr>
                    <tr><td class="label">Reported By</td><td class="value">{{staffName}}</td></tr>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">📦 Stolen Items</div>
                <div class="info-box">
                    {{stolenItems}}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">👤 Thief Information</div>
                <div class="thief-info">
                    <table class="details-table">
                        <tr><td class="label">Name</td><td class="value">{{thiefName}} {{thiefSurname}}</td></tr>
                        <tr><td class="label">ID Card</td><td class="value">{{idCard}}</td></tr>
                        <tr><td class="label">Date of Birth</td><td class="value">{{dateOfBirth}}</td></tr>
                        <tr><td class="label">Place of Birth</td><td class="value">{{placeOfBirth}}</td></tr>
                        <tr><td class="label">Father''s Name</td><td class="value">{{fatherName}}</td></tr>
                        <tr><td class="label">Mother''s Name</td><td class="value">{{motherName}}</td></tr>
                        <tr><td class="label">Marital Status</td><td class="value">{{maritalStatus}}</td></tr>
                    </table>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">🎯 Capture Details</div>
                <table class="details-table">
                    <tr><td class="label">Capture Method</td><td class="value">{{captureMethod}}</td></tr>
                    <tr><td class="label">Security Type</td><td class="value">{{securityType}}</td></tr>
                    <tr><td class="label">Security Company</td><td class="value">{{outsourceCompany}}</td></tr>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">💰 Financial Details</div>
                <table class="details-table">
                    <tr><td class="label">Amount to HO</td><td class="value">{{currency}} {{amountToHO}}</td></tr>
                </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="{{reportUrl}}" class="btn">View Full Report</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated notification from the Operational Excellence Application.</p>
            <p>Report ID: #{{incidentId}} | Submitted: {{submittedAt}}</p>
        </div>
    </div>
</body>
</html>',
    1,
    GETDATE()
);
