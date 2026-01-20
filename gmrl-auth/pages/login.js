/**
 * Login Page Module
 * Handles Microsoft authentication for Food Safety Audit System
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const path = require('path');
const fs = require('fs');

class LoginPage {
    /**
     * Render the login page HTML
     */
    static render(req, res) {
        const returnUrl = req.query.returnUrl || '';
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Food Safety Audit System</title>
    <link rel="stylesheet" href="/auth/styles/login.css">
    <script>
        window.LOGIN_RETURN_URL = '${returnUrl.replace(/'/g, "\\'")}' || '';
    </script>
</head>
<body>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <div class="logo">🏪</div>
                <h1>Food Safety Audit System</h1>
                <p>GMRL</p>
            </div>
            
            <div class="login-body">
                <h2>Welcome Back</h2>
                <p class="subtitle">Please sign in to continue</p>
                
                <button id="loginButton" class="microsoft-login-btn">
                    <svg class="microsoft-icon" viewBox="0 0 23 23">
                        <path fill="#f35325" d="M0 0h11v11H0z"/>
                        <path fill="#81bc06" d="M12 0h11v11H12z"/>
                        <path fill="#05a6f0" d="M0 12h11v11H0z"/>
                        <path fill="#ffba08" d="M12 12h11v11H12z"/>
                    </svg>
                    <span>Sign in with Microsoft</span>
                </button>
                
                <div class="login-info">
                    <p>🔒 Secure authentication using your Microsoft account</p>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/auth/scripts/login.js"></script>
</body>
</html>
        `;
        
        res.send(html);
    }
    
    /**
     * Get login configuration
     */
    static getConfig() {
        return {
            clientId: process.env.AZURE_CLIENT_ID,
            tenantId: process.env.AZURE_TENANT_ID,
            redirectUri: process.env.REDIRECT_URI || 'http://localhost:3001/auth/callback',
            scopes: ['User.Read', 'User.ReadBasic.All']
        };
    }
}

module.exports = LoginPage;
