/**
 * Pending Approval Page Module
 * Shown to users who haven't been assigned a role yet
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

class PendingApprovalPage {
    /**
     * Render the pending approval page
     */
    static render(req, res) {
        const user = req.currentUser;
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pending Approval - Food Safety Audit System</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .pending-container {
            background: white;
            border-radius: 20px;
            padding: 50px;
            max-width: 700px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .icon {
            font-size: 6em;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.1);
            }
        }
        
        h1 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 2.5em;
        }
        
        .subtitle {
            color: #f39c12;
            font-size: 1.5em;
            font-weight: 600;
            margin-bottom: 30px;
        }
        
        p {
            color: #666;
            font-size: 1.2em;
            margin-bottom: 20px;
            line-height: 1.8;
        }
        
        .user-info {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            text-align: left;
        }
        
        .user-info h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .info-label {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .info-value {
            color: #666;
        }
        
        .status-badge {
            display: inline-block;
            background: #f39c12;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 600;
        }
        
        .instructions {
            background: #e8f4f8;
            border-left: 4px solid #3498db;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
            text-align: left;
        }
        
        .instructions h4 {
            color: #2c3e50;
            margin-bottom: 15px;
        }
        
        .instructions ul {
            color: #666;
            line-height: 1.8;
            padding-left: 20px;
        }
        
        .logout-btn {
            display: inline-block;
            background: #e74c3c;
            color: white;
            padding: 15px 40px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 30px;
            transition: all 0.3s ease;
        }
        
        .logout-btn:hover {
            background: #c0392b;
            transform: translateY(-2px);
        }
        
        .refresh-btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            margin: 30px 10px 0 10px;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .refresh-btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="pending-container">
        <div class="icon">⏳</div>
        <h1>Pending Administrator Approval</h1>
        <div class="subtitle">Your account is awaiting activation</div>
        
        <p>Thank you for logging in to the Food Safety Audit System. Your account has been created successfully, but access is pending approval from an administrator.</p>
        
        <div class="user-info">
            <h3>Your Account Information</h3>
            <div class="info-row">
                <span class="info-label">Name:</span>
                <span class="info-value">${user.displayName || 'Not available'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${user.email}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Department:</span>
                <span class="info-value">${user.department || 'Not specified'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value"><span class="status-badge">Pending Approval</span></span>
            </div>
        </div>
        
        <div class="instructions">
            <h4>📋 What happens next?</h4>
            <ul>
                <li>An administrator has been notified of your account</li>
                <li>They will review and assign you an appropriate role</li>
                <li>You will receive an email once your account is activated</li>
                <li>Once approved, you can access the system features</li>
            </ul>
        </div>
        
        <p><strong>Need immediate access?</strong><br>Please contact your administrator or IT support.</p>
        
        <div>
            <button onclick="location.reload()" class="refresh-btn">🔄 Refresh Page</button>
            <a href="/auth/logout" class="logout-btn">Logout</a>
        </div>
    </div>
</body>
</html>
        `;
        
        res.send(html);
    }
}

module.exports = PendingApprovalPage;
