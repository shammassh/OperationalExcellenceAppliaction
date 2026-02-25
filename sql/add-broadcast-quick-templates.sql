-- Add Broadcast Quick Template Email Templates

-- 5 Days Check Reminder Template
INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
VALUES (
    'BROADCAST_5DAYS',
    'Broadcast - 5 Days Check Reminder',
    'OE',
    'broadcast-5days',
    '📅 5 Days Expired Items Check Reminder',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(102, 126, 234, 0.15); color: #667eea; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
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
            <h1>📅 5 Days Expired Items Check</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Daily Compliance Reminder</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">⏰ Action Required</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="checklist">
                <strong>📋 Checklist:</strong>
                <div class="checklist-item">✅ Check all products within 5 days of expiry</div>
                <div class="checklist-item">✅ Update inventory system</div>
                <div class="checklist-item">✅ Mark down items as needed</div>
                <div class="checklist-item">✅ Submit daily report</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
    1,
    GETDATE()
);

-- Inspection Reminder Template
INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
VALUES (
    'BROADCAST_INSPECTION',
    'Broadcast - Inspection Reminder',
    'OE',
    'broadcast-inspection',
    '🔍 Inspection Due Reminder',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0078d4 0%, #00bcf2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(0, 120, 212, 0.15); color: #0078d4; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #0078d4; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .btn { display: inline-block; padding: 14px 30px; background: #0078d4; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .prep-list { background: #e3f2fd; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .prep-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .prep-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Inspection Reminder</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Prepare Your Store</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">📋 Inspection Due</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="prep-list">
                <strong>🔍 Preparation Checklist:</strong>
                <div class="prep-item">📁 Gather all required documentation</div>
                <div class="prep-item">🧹 Ensure all areas are clean and organized</div>
                <div class="prep-item">✅ Verify compliance with all standards</div>
                <div class="prep-item">👥 Brief your team on inspection expectations</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">View Inspection Schedule</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
    1,
    GETDATE()
);

-- Cleaning Checklist Reminder Template
INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
VALUES (
    'BROADCAST_CLEANING',
    'Broadcast - Cleaning Checklist Reminder',
    'OE',
    'broadcast-cleaning',
    '🧹 Cleaning Checklist Reminder',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(23, 162, 184, 0.15); color: #17a2b8; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #17a2b8; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .btn { display: inline-block; padding: 14px 30px; background: #17a2b8; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .cleaning-areas { background: #e0f7fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .area-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .area-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧹 Cleaning Checklist</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Daily Hygiene Standards</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">🧼 Cleanliness Matters</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="cleaning-areas">
                <strong>🏪 Key Areas to Clean:</strong>
                <div class="area-item">🚪 Entrance & Customer Areas</div>
                <div class="area-item">🍽️ Food Preparation Surfaces</div>
                <div class="area-item">🚿 Restrooms & Washrooms</div>
                <div class="area-item">🗑️ Waste Disposal Areas</div>
                <div class="area-item">❄️ Refrigeration Units</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Submit Cleaning Report</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
    1,
    GETDATE()
);

-- Safety Reminder Template
INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
VALUES (
    'BROADCAST_SAFETY',
    'Broadcast - Safety Reminder',
    'OE',
    'broadcast-safety',
    '⚠️ Safety Compliance Reminder',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(220, 53, 69, 0.15); color: #dc3545; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .btn { display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .safety-tips { background: #ffebee; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffcdd2; }
        .tip-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .tip-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Safety First</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Your Safety is Our Priority</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">🦺 Safety Alert</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="safety-tips">
                <strong>🛡️ Safety Reminders:</strong>
                <div class="tip-item">🔥 Know your fire exit locations</div>
                <div class="tip-item">🧤 Use proper PPE when required</div>
                <div class="tip-item">⚡ Report electrical hazards immediately</div>
                <div class="tip-item">🚫 Keep emergency exits clear at all times</div>
                <div class="tip-item">📞 Know emergency contact numbers</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Review Safety Guidelines</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
    1,
    GETDATE()
);

-- Verify templates were added
SELECT TemplateKey, TemplateName FROM EmailTemplates WHERE TemplateKey LIKE 'BROADCAST_%';
