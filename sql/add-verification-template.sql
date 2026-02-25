-- Add OE Verification Submitted Email Template
INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
VALUES (
    'OE_VERIFICATION_SUBMITTED',
    'OE Verification Submitted',
    'OE',
    'verification-submitted',
    '[OE] Action Item Verification Submitted - {{storeName}} - {{documentNumber}}',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .verification-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 18px; font-weight: 700; background: rgba(40, 167, 69, 0.15); color: #28a745; margin: 15px 0; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .info-box { background: #e8f5e9; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Verification Submitted</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            <p>An action item verification has been submitted for your review:</p>
            
            <div style="text-align: center;">
                <div class="verification-badge">⏳ Pending Review</div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Section</td><td class="value">{{sectionName}}</td></tr>
                <tr><td class="label">Finding</td><td class="value">{{findingDescription}}</td></tr>
                <tr><td class="label">Submitted By</td><td class="value">{{submittedBy}}</td></tr>
                <tr><td class="label">Submitted At</td><td class="value">{{submittedAt}}</td></tr>
            </table>
            
            <div class="info-box">
                <strong>📝 Verification Notes:</strong><br>
                {{verificationNotes}}
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{verificationUrl}}" class="btn">🔍 Review Verification</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Please review the submitted verification and approve or reject it accordingly.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Apps</p>
        </div>
    </div>
</body>
</html>',
    1,
    GETDATE()
);
