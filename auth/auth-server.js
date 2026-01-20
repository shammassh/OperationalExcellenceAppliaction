/**
 * Authentication Server Module - Operational Excellence App
 * Simplified version for this application
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const msal = require('@azure/msal-node');
const sql = require('mssql');

// Load configuration - dotenv already loaded by app.js with correct path
// No need to reload here as it overwrites the correct env file with default .env

// MSAL Configuration
const msalConfig = {
    auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET
    }
};

const pca = new msal.ConfidentialClientApplication(msalConfig);

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

// Session store (in-memory for simplicity)
const sessions = new Map();

/**
 * Initialize authentication routes on the Express app
 */
function initializeAuth(app) {
    // Middleware
    app.use(cookieParser());
    
    // Login page
    app.get('/auth/login', (req, res) => {
        const authUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?` +
            `client_id=${process.env.AZURE_CLIENT_ID}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
            `&scope=openid%20profile%20email%20User.Read` +
            `&response_mode=query`;
        
        res.redirect(authUrl);
    });
    
    // OAuth callback
    app.get('/auth/callback', async (req, res) => {
        const { code, error } = req.query;
        
        if (error) {
            console.error('OAuth error:', error);
            return res.redirect('/?error=' + error);
        }
        
        if (!code) {
            return res.redirect('/?error=no_code');
        }
        
        try {
            // Exchange code for token
            const tokenRequest = {
                code: code,
                scopes: ['openid', 'profile', 'email', 'User.Read'],
                redirectUri: process.env.REDIRECT_URI
            };
            
            const response = await pca.acquireTokenByCode(tokenRequest);
            
            // Get user info from token
            const email = response.account.username;
            const displayName = response.account.name || email;
            const azureOid = response.account.homeAccountId.split('.')[0];
            
            // Check/create user in database
            let pool;
            try {
                pool = await sql.connect(dbConfig);
                
                // Check if user exists
                let result = await pool.request()
                    .input('email', sql.NVarChar, email)
                    .query('SELECT * FROM Users WHERE Email = @email');
                
                let user;
                if (result.recordset.length === 0) {
                    // Create new user (pending approval)
                    result = await pool.request()
                        .input('email', sql.NVarChar, email)
                        .input('displayName', sql.NVarChar, displayName)
                        .input('azureOid', sql.NVarChar, azureOid)
                        .query(`
                            INSERT INTO Users (Email, DisplayName, AzureOid, IsApproved, IsActive)
                            OUTPUT INSERTED.*
                            VALUES (@email, @displayName, @azureOid, 0, 1)
                        `);
                    user = result.recordset[0];
                } else {
                    user = result.recordset[0];
                    // Update last login
                    await pool.request()
                        .input('id', sql.Int, user.Id)
                        .query('UPDATE Users SET LastLoginAt = GETDATE() WHERE Id = @id');
                }
                
                // Get user role
                const roleResult = await pool.request()
                    .input('roleId', sql.Int, user.RoleId)
                    .query('SELECT RoleName FROM UserRoles WHERE Id = @roleId');
                
                const roleName = roleResult.recordset[0]?.RoleName || 'User';
                
                // Create session
                const sessionId = generateSessionId();
                sessions.set(sessionId, {
                    userId: user.Id,
                    email: user.Email,
                    displayName: user.DisplayName,
                    role: roleName,
                    roleId: user.RoleId,
                    accessToken: response.accessToken,
                    isApproved: user.IsApproved,
                    isActive: user.IsActive,
                    createdAt: new Date()
                });
                
                // Set session cookie
                res.cookie('session_id', sessionId, {
                    httpOnly: true,
                    secure: process.env.APP_URL?.startsWith('https'),
                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                });
                
                // Check if user is approved
                if (!user.IsApproved) {
                    return res.redirect('/auth/pending-approval');
                }
                
                // Redirect to dashboard
                res.redirect('/dashboard');
                
            } finally {
                if (pool) await pool.close();
            }
            
        } catch (err) {
            console.error('Auth callback error:', err);
            res.redirect('/?error=auth_failed');
        }
    });
    
    // Pending approval page
    app.get('/auth/pending-approval', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pending Approval - ${process.env.APP_NAME}</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        max-width: 600px; 
                        margin: 100px auto; 
                        padding: 20px;
                        text-align: center;
                    }
                    .card {
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        padding: 30px;
                        border-radius: 10px;
                    }
                    h1 { color: #856404; }
                    a { color: #0078d4; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>⏳ Pending Approval</h1>
                    <p>Your account is awaiting administrator approval.</p>
                    <p>Please contact your administrator to get access.</p>
                    <br>
                    <a href="/auth/logout">Logout</a>
                </div>
            </body>
            </html>
        `);
    });
    
    // Logout
    app.get('/auth/logout', (req, res) => {
        const sessionId = req.cookies.session_id;
        if (sessionId) {
            sessions.delete(sessionId);
        }
        res.clearCookie('session_id');
        res.redirect('/');
    });
    
    console.log('✅ Authentication routes initialized');
}

/**
 * Middleware to require authentication
 */
function requireAuth(req, res, next) {
    const sessionId = req.cookies?.session_id;
    
    if (!sessionId || !sessions.has(sessionId)) {
        return res.redirect('/auth/login');
    }
    
    const session = sessions.get(sessionId);
    
    // Check if session expired (24 hours)
    const sessionAge = Date.now() - session.createdAt.getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
        sessions.delete(sessionId);
        res.clearCookie('session_id');
        return res.redirect('/auth/login');
    }
    
    // Check if user is approved
    if (!session.isApproved) {
        return res.redirect('/auth/pending-approval');
    }
    
    // Attach user to request
    req.currentUser = session;
    next();
}

/**
 * Middleware to require specific role
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.currentUser) {
            return res.redirect('/auth/login');
        }
        
        if (!roles.includes(req.currentUser.role)) {
            return res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Access Denied</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>🚫 Access Denied</h1>
                    <p>You don't have permission to access this page.</p>
                    <p>Required role: ${roles.join(' or ')}</p>
                    <a href="/dashboard">Back to Dashboard</a>
                </body>
                </html>
            `);
        }
        
        next();
    };
}

/**
 * Generate random session ID
 */
function generateSessionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

module.exports = {
    initializeAuth,
    requireAuth,
    requireRole
};
