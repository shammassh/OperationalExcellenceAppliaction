/**
 * Role Authorization Middleware Module
 * Checks if user has required role(s)
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

/**
 * Require specific role(s) middleware
 * Must be used AFTER requireAuth middleware
 * 
 * Usage:
 *   app.get('/admin/users', requireAuth, requireRole('Admin'), (req, res) => { ... });
 *   app.get('/reports', requireAuth, requireRole('Admin', 'Auditor'), (req, res) => { ... });
 * 
 * @param {...string} allowedRoles - One or more roles that are allowed
 */
function requireRole(...allowedRoles) {
    return function(req, res, next) {
        // Check if user is authenticated (should be set by requireAuth middleware)
        if (!req.currentUser) {
            console.error('❌ requireRole called without requireAuth middleware');
            return res.status(500).send('Server configuration error');
        }
        
        const userRole = req.currentUser.role;
        
        // Check if user has one of the allowed roles
        if (allowedRoles.includes(userRole)) {
            console.log(`✅ Authorized: ${req.currentUser.email} has role ${userRole}`);
            return next();
        }
        
        // User does not have required role
        console.log(`❌ Access denied: ${req.currentUser.email} (${userRole}) tried to access ${req.path}`);
        console.log(`   Required roles: ${allowedRoles.join(', ')}`);
        
        // For API requests, return JSON
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                error: 'Access denied',
                message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
                userRole: userRole,
                requiredRoles: allowedRoles
            });
        }
        
        // For page requests, show access denied page
        return res.status(403).send(generateAccessDeniedHTML(userRole, allowedRoles));
    };
}

/**
 * Generate access denied HTML page
 */
function generateAccessDeniedHTML(userRole, requiredRoles) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied</title>
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
        .access-denied-container {
            background: white;
            border-radius: 20px;
            padding: 50px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .icon {
            font-size: 5em;
            margin-bottom: 20px;
        }
        h1 {
            color: #e74c3c;
            margin-bottom: 20px;
            font-size: 2.5em;
        }
        p {
            color: #666;
            font-size: 1.2em;
            margin-bottom: 15px;
            line-height: 1.6;
        }
        .role-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
        }
        .role-info strong {
            color: #2c3e50;
        }
        .back-btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.3s ease;
        }
        .back-btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="access-denied-container">
        <div class="icon">🚫</div>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        
        <div class="role-info">
            <p><strong>Your Role:</strong> ${userRole}</p>
            <p><strong>Required Role(s):</strong> ${requiredRoles.join(', ')}</p>
        </div>
        
        <p>If you believe this is an error, please contact your administrator.</p>
        
        <a href="/dashboard" class="back-btn">← Back to Dashboard</a>
    </div>
</body>
</html>
    `;
}

module.exports = requireRole;
