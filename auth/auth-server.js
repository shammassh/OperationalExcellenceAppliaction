/**
 * Authentication Server Module - Operational Excellence App
 * Simplified version for this application
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const msal = require('@azure/msal-node');
const sql = require('mssql');

// Load notification scheduler for login-time checks
const { checkUserNotifications } = require('../services/notification-scheduler');

// Load configuration - dotenv already loaded by app.js with correct path
// No need to reload here as it overwrites the correct env file with default .env

// Debug: Log Azure AD config (mask secret)
console.log('[AUTH] Azure AD Config:', {
    clientId: process.env.AZURE_CLIENT_ID,
    tenantId: process.env.AZURE_TENANT_ID,
    redirectUri: process.env.REDIRECT_URI,
    secretPrefix: process.env.AZURE_CLIENT_SECRET?.substring(0, 10) + '...'
});

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
                
                // Get user role (legacy)
                const roleResult = await pool.request()
                    .input('roleId', sql.Int, user.RoleId)
                    .query('SELECT RoleName FROM UserRoles WHERE Id = @roleId');
                
                const legacyRoleName = roleResult.recordset[0]?.RoleName || 'User';
                
                // Get ALL user roles from UserRoleAssignments (multi-role support)
                const allRolesResult = await pool.request()
                    .input('userId', sql.Int, user.Id)
                    .query(`
                        SELECT r.Id, r.RoleName
                        FROM UserRoleAssignments ura
                        JOIN UserRoles r ON ura.RoleId = r.Id
                        WHERE ura.UserId = @userId
                        ORDER BY r.Id
                    `);
                
                const roles = allRolesResult.recordset || [];
                const roleNames = roles.map(r => r.RoleName);
                const displayRole = roleNames.length > 0 ? roleNames.join(', ') : legacyRoleName;
                
                // Create session
                const sessionId = generateSessionId();
                const sessionData = {
                    userId: user.Id,
                    email: user.Email,
                    displayName: user.DisplayName,
                    role: displayRole,
                    roleId: user.RoleId,
                    roles: roles,
                    roleNames: roleNames,
                    accessToken: response.accessToken,
                    isApproved: user.IsApproved,
                    isActive: user.IsActive,
                    createdAt: new Date()
                };
                
                // Add helper functions
                sessionData.hasRole = function(roleName) {
                    return this.roleNames.includes(roleName);
                };
                sessionData.hasAnyRole = function(...roles) {
                    return roles.some(r => this.roleNames.includes(r));
                };
                
                sessions.set(sessionId, sessionData);
                
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
                
                // Check/create notifications for the user on login
                checkUserNotifications(user.Id, user.Email).catch(err => {
                    console.error('Error checking user notifications:', err);
                });
                
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
async function requireAuth(req, res, next) {
    const sessionId = req.cookies?.session_id;
    
    // Helper to check if request is an API/AJAX call
    const isApiRequest = req.path.includes('/api/') || 
                         req.xhr || 
                         req.headers.accept?.includes('application/json') ||
                         req.headers['content-type']?.includes('application/json');
    
    if (!sessionId || !sessions.has(sessionId)) {
        if (isApiRequest) {
            return res.status(401).json({ success: false, error: 'Session expired. Please refresh the page to login again.', sessionExpired: true });
        }
        return res.redirect('/auth/login');
    }
    
    const session = sessions.get(sessionId);
    
    // Check if session expired (24 hours)
    const sessionAge = Date.now() - session.createdAt.getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
        sessions.delete(sessionId);
        res.clearCookie('session_id');
        if (isApiRequest) {
            return res.status(401).json({ success: false, error: 'Session expired. Please refresh the page to login again.', sessionExpired: true });
        }
        return res.redirect('/auth/login');
    }
    
    // Check if user is approved
    if (!session.isApproved) {
        if (isApiRequest) {
            return res.status(403).json({ success: false, error: 'Your account is pending approval.' });
        }
        return res.redirect('/auth/pending-approval');
    }
    
    // Attach user to request
    req.currentUser = { ...session };
    
    // Re-attach helper functions (spread doesn't copy methods)
    req.currentUser.hasRole = function(roleName) {
        return this.roleNames?.includes(roleName) || false;
    };
    req.currentUser.hasAnyRole = function(...roles) {
        return roles.some(r => this.roleNames?.includes(r)) || false;
    };
    req.currentUser.canAccess = function(formCode, action = 'view') {
        const perm = this.permissions ? this.permissions[formCode] : null;
        if (!perm) return false;
        switch(action.toLowerCase()) {
            case 'view': return perm.canView === true;
            case 'create': return perm.canCreate === true;
            case 'edit': return perm.canEdit === true;
            case 'delete': return perm.canDelete === true;
            default: return false;
        }
    };
    
    // Check for impersonation (System Administrator only)
    const impersonateUserId = req.cookies?.impersonate_user_id;
    if (impersonateUserId && session.roleNames?.includes('System Administrator')) {
        try {
            // Load impersonated user's permissions from database
            const pool = await sql.connect(dbConfig);
            
            // Get user info
            const userResult = await pool.request()
                .input('userId', sql.Int, parseInt(impersonateUserId))
                .query(`SELECT Id, Email, DisplayName FROM Users WHERE Id = @userId AND IsActive = 1`);
            
            if (userResult.recordset[0]) {
                const impersonatedUser = userResult.recordset[0];
                
                // Get roles
                const rolesResult = await pool.request()
                    .input('userId', sql.Int, parseInt(impersonateUserId))
                    .query(`
                        SELECT r.Id, r.RoleName
                        FROM UserRoleAssignments ura
                        JOIN UserRoles r ON ura.RoleId = r.Id
                        WHERE ura.UserId = @userId
                    `);
                
                const roleNames = rolesResult.recordset.map(r => r.RoleName);
                
                // Get permissions
                const permResult = await pool.request()
                    .input('userId', sql.Int, parseInt(impersonateUserId))
                    .query(`SELECT FormCode, CanView, CanCreate, CanEdit, CanDelete FROM UserFormAccess WHERE UserId = @userId`);
                
                const permissions = {};
                permResult.recordset.forEach(p => {
                    permissions[p.FormCode] = { canView: p.CanView, canCreate: p.CanCreate, canEdit: p.CanEdit, canDelete: p.CanDelete };
                });
                
                // Get role permissions too
                const roleIds = rolesResult.recordset.map(r => r.Id);
                if (roleIds.length > 0) {
                    const rolePermResult = await pool.request()
                        .query(`
                            SELECT DISTINCT FormCode, MAX(CAST(CanView AS INT)) as CanView, MAX(CAST(CanCreate AS INT)) as CanCreate,
                                   MAX(CAST(CanEdit AS INT)) as CanEdit, MAX(CAST(CanDelete AS INT)) as CanDelete
                            FROM RoleFormAccess WHERE RoleId IN (${roleIds.join(',')}) GROUP BY FormCode
                        `);
                    rolePermResult.recordset.forEach(p => {
                        if (!permissions[p.FormCode]) {
                            permissions[p.FormCode] = { canView: p.CanView === 1, canCreate: p.CanCreate === 1, canEdit: p.CanEdit === 1, canDelete: p.CanDelete === 1 };
                        }
                    });
                }
                
                await pool.close();
                
                // Store original user and apply impersonation
                req.originalUser = { ...session };
                req.currentUser.roleNames = roleNames;
                req.currentUser.role = roleNames.join(', ') || 'No Role';
                req.currentUser.permissions = permissions;
                req.currentUser.isImpersonating = true;
                req.currentUser.impersonatedUser = {
                    id: impersonatedUser.Id,
                    email: impersonatedUser.Email,
                    displayName: impersonatedUser.DisplayName
                };
                
                console.log(`👤 Impersonating: ${impersonatedUser.Email} (as ${session.email})`);
            }
        } catch (err) {
            console.error('Impersonation error:', err);
        }
    }
    
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
