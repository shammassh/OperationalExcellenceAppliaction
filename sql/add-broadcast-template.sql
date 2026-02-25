-- Add Broadcast Email Template
INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
VALUES (
    'BROADCAST_MESSAGE',
    'Broadcast Message',
    'OE',
    'broadcast',
    '[Announcement] {{title}}',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0078d4 0%, #00bcf2 100%); color: white; padding: 30px; text-align: center; }
        .header.high-priority { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .priority-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
        .priority-normal { background: #e3f2fd; color: #1976d2; }
        .priority-high { background: #ffebee; color: #c62828; }
        .message-box { background: #f8f9fa; border-left: 4px solid #0078d4; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .message-box.high-priority { border-left-color: #dc3545; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 30%; }
        .details-table .value { font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .btn { display: inline-block; padding: 14px 30px; background: #0078d4; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header {{priorityClass}}">
            <h1>📢 {{title}}</h1>
            <div class="subtitle">Announcement from {{senderName}}</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <span class="priority-badge {{priorityBadgeClass}}">{{priorityLabel}}</span>
            </div>
            
            <div class="message-box {{priorityBoxClass}}">{{message}}</div>
            
            <table class="details-table">
                <tr><td class="label">From</td><td class="value">{{senderName}}</td></tr>
                <tr><td class="label">Date</td><td class="value">{{sentDate}}</td></tr>
                <tr><td class="label">Priority</td><td class="value">{{priority}}</td></tr>
            </table>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated announcement from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL - All Rights Reserved</p>
        </div>
    </div>
</body>
</html>',
    1,
    GETDATE()
);

-- Verify the template was added
SELECT * FROM EmailTemplates WHERE TemplateKey = 'BROADCAST_MESSAGE';
