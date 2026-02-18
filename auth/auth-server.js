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

// In-memory cache for sessions (reduces DB queries, synced with SQL)
const sessionCache = new Map();

/**
 * Session Manager - SQL-based storage with in-memory cache
 */
const SessionStore = {
    /**
     * Create a new session in SQL database
     */
    async create(userId, sessionId, sessionData) {
        let pool;
        try {
            pool = await sql.connect(dbConfig);
            
            // Remove any existing sessions for this user (prevent duplicates)
            await pool.request()
                .input('userId', sql.Int, userId)
                .query('DELETE FROM Sessions WHERE UserId = @userId');
            
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            // Insert new session
            await pool.request()
                .input('sessionId', sql.NVarChar, sessionId)
                .input('userId', sql.Int, userId)
                .input('token', sql.NVarChar, JSON.stringify(sessionData))
                .input('expiresAt', sql.DateTime2, expiresAt)
                .query(`
                    INSERT INTO Sessions (SessionId, UserId, Token, ExpiresAt, CreatedAt)
                    VALUES (@sessionId, @userId, @token, @expiresAt, GETDATE())
                `);
            
            // Cache the session
            sessionCache.set(sessionId, {
                ...sessionData,
                expiresAt: expiresAt
            });
            
            console.log(`✅ Session created in SQL for user ${userId} (expires in 24h)`);
            return true;
        } catch (err) {
            console.error('Error creating session:', err);
            return false;
        } finally {
            if (pool) await pool.close();
        }
    },
    
    /**
     * Get session from cache or SQL
     */
    async get(sessionId) {
        // Check cache first
        if (sessionCache.has(sessionId)) {
            const cached = sessionCache.get(sessionId);
            if (new Date(cached.expiresAt) > new Date()) {
                return cached;
            } else {
                sessionCache.delete(sessionId);
            }
        }
        
        // Fetch from SQL
        let pool;
        try {
            pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('sessionId', sql.NVarChar, sessionId)
                .query(`
                    SELECT s.*, u.Email, u.DisplayName, u.IsApproved, u.IsActive, u.RoleId
                    FROM Sessions s
                    JOIN Users u ON s.UserId = u.Id
                    WHERE s.SessionId = @sessionId AND s.ExpiresAt > GETDATE()
                `);
            
            if (result.recordset.length === 0) {
                return null;
            }
            
            const row = result.recordset[0];
            const sessionData = JSON.parse(row.Token);
            sessionData.expiresAt = row.ExpiresAt;
            
            // Cache it
            sessionCache.set(sessionId, sessionData);
            
            return sessionData;
        } catch (err) {
            console.error('Error getting session:', err);
            return null;
        } finally {
            if (pool) await pool.close();
        }
    },
    
    /**
     * Delete session from SQL and cache
     */
    async delete(sessionId) {
        sessionCache.delete(sessionId);
        
        let pool;
        try {
            pool = await sql.connect(dbConfig);
            await pool.request()
                .input('sessionId', sql.NVarChar, sessionId)
                .query('DELETE FROM Sessions WHERE SessionId = @sessionId');
            return true;
        } catch (err) {
            console.error('Error deleting session:', err);
            return false;
        } finally {
            if (pool) await pool.close();
        }
    },
    
    /**
     * Check if session exists
     */
    async has(sessionId) {
        if (sessionCache.has(sessionId)) {
            return true;
        }
        const session = await this.get(sessionId);
        return session !== null;
    },
    
    /**
     * Get all sessions from SQL (for admin)
     */
    async getAll() {
        let pool;
        try {
            pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .query(`
                    SELECT 
                        s.SessionId as session_id,
                        s.UserId as user_id,
                        s.ExpiresAt as expires_at,
                        s.CreatedAt as created_at,
                        u.Email as email,
                        u.DisplayName as display_name,
                        r.RoleName as role,
                        CASE WHEN s.ExpiresAt > GETDATE() THEN 1 ELSE 0 END as is_active
                    FROM Sessions s
                    LEFT JOIN Users u ON s.UserId = u.Id
                    LEFT JOIN UserRoles r ON u.RoleId = r.Id
                    ORDER BY s.CreatedAt DESC
                `);
            return result.recordset;
        } catch (err) {
            console.error('Error getting all sessions:', err);
            return [];
        } finally {
            if (pool) await pool.close();
        }
    },
    
    /**
     * Get statistics
     */
    async getStatistics() {
        let pool;
        try {
            pool = await sql.connect(dbConfig);
            
            const activeResult = await pool.request()
                .query(`SELECT COUNT(*) as count FROM Sessions WHERE ExpiresAt > GETDATE()`);
            
            const uniqueUsersResult = await pool.request()
                .query(`SELECT COUNT(DISTINCT UserId) as count FROM Sessions WHERE ExpiresAt > GETDATE()`);
            
            const duplicatesResult = await pool.request()
                .query(`
                    SELECT COUNT(*) as count FROM (
                        SELECT UserId FROM Sessions WHERE ExpiresAt > GETDATE() 
                        GROUP BY UserId HAVING COUNT(*) > 1
                    ) as dup
                `);
            
            const expiredResult = await pool.request()
                .query(`
                    SELECT COUNT(*) as count FROM Sessions 
                    WHERE ExpiresAt < GETDATE() AND ExpiresAt > DATEADD(hour, -24, GETDATE())
                `);
            
            return {
                totalActive: activeResult.recordset[0].count,
                uniqueUsers: uniqueUsersResult.recordset[0].count,
                duplicates: duplicatesResult.recordset[0].count,
                expiredLast24h: expiredResult.recordset[0].count
            };
        } catch (err) {
            console.error('Error getting statistics:', err);
            return { totalActive: 0, uniqueUsers: 0, duplicates: 0, expiredLast24h: 0 };
        } finally {
            if (pool) await pool.close();
        }
    },
    
    /**
     * Cleanup expired sessions
     */
    async cleanup() {
        // Clear expired from cache
        const now = new Date();
        sessionCache.forEach((session, id) => {
            if (new Date(session.expiresAt) <= now) {
                sessionCache.delete(id);
            }
        });
        
        let pool;
        try {
            pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .query('DELETE FROM Sessions WHERE ExpiresAt < GETDATE()');
            return result.rowsAffected[0];
        } catch (err) {
            console.error('Error cleaning up sessions:', err);
            return 0;
        } finally {
            if (pool) await pool.close();
        }
    }
};

/**
 * Initialize authentication routes on the Express app
 */
function initializeAuth(app) {
    // Middleware
    app.use(cookieParser());
    
    // Session info endpoint
    app.get('/auth/session', requireAuth, (req, res) => {
        res.json({
            user: {
                id: req.currentUser.userId,
                email: req.currentUser.email,
                displayName: req.currentUser.displayName,
                role: req.currentUser.role,
                assignedStores: req.currentUser.assignedStores,
                assignedDepartment: req.currentUser.assignedDepartment,
                department: req.currentUser.department,
                isActive: req.currentUser.isActive,
                isApproved: req.currentUser.isApproved
            }
        });
    });
    
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
    
    // OAuth callback - NEVER CACHE THIS!
    app.get('/auth/callback', async (req, res) => {
        // Prevent caching of auth responses
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        });
        
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
                
                // Load user's form permissions from UserFormAccess
                const userPermResult = await pool.request()
                    .input('userId', sql.Int, user.Id)
                    .query(`SELECT FormCode, CanView, CanCreate, CanEdit, CanDelete FROM UserFormAccess WHERE UserId = @userId`);
                
                const permissions = {};
                userPermResult.recordset.forEach(p => {
                    permissions[p.FormCode] = { 
                        canView: p.CanView, 
                        canCreate: p.CanCreate, 
                        canEdit: p.CanEdit, 
                        canDelete: p.CanDelete,
                        source: 'user'
                    };
                });
                
                // Also load role-based permissions from RoleFormAccess
                const roleIds = roles.map(r => r.Id);
                if (roleIds.length > 0) {
                    const rolePermResult = await pool.request()
                        .query(`
                            SELECT DISTINCT FormCode, 
                                   MAX(CAST(CanView AS INT)) as CanView,
                                   MAX(CAST(CanCreate AS INT)) as CanCreate,
                                   MAX(CAST(CanEdit AS INT)) as CanEdit,
                                   MAX(CAST(CanDelete AS INT)) as CanDelete
                            FROM RoleFormAccess 
                            WHERE RoleId IN (${roleIds.join(',')}) 
                            GROUP BY FormCode
                        `);
                    
                    rolePermResult.recordset.forEach(p => {
                        if (!permissions[p.FormCode]) {
                            permissions[p.FormCode] = { 
                                canView: p.CanView === 1, 
                                canCreate: p.CanCreate === 1, 
                                canEdit: p.CanEdit === 1, 
                                canDelete: p.CanDelete === 1,
                                source: 'role'
                            };
                        }
                    });
                }
                
                console.log(`✅ [AUTH] Loaded ${Object.keys(permissions).length} permissions for ${user.Email}`);
                
                // Create session with user ID embedded in token
                const sessionId = generateSessionId(user.Id);
                const sessionData = {
                    userId: user.Id,
                    email: user.Email,
                    displayName: user.DisplayName,
                    role: displayRole,
                    roleId: user.RoleId,
                    roles: roles,
                    roleNames: roleNames,
                    permissions: permissions,  // Include permissions in session!
                    accessToken: response.accessToken,
                    isApproved: user.IsApproved,
                    isActive: user.IsActive,
                    createdAt: new Date()
                };
                
                // Store session in SQL database (removes existing sessions for user)
                await SessionStore.create(user.Id, sessionId, sessionData);
                
                // IMPORTANT: Clear old session cookie FIRST before setting new one
                res.clearCookie('session_id', { path: '/' });
                
                // Set session cookie with explicit path
                res.cookie('session_id', sessionId, {
                    httpOnly: true,
                    secure: true,  // Always secure for HTTPS
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                });
                
                // Clear any impersonation cookie on fresh login
                res.clearCookie('impersonate_user_id', { path: '/' });
                
                console.log(`🍪 [AUTH] Cookie set: session_id=${sessionId.substring(0, 20)}... for ${user.Email}`);
                
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
    app.get('/auth/logout', async (req, res) => {
        const sessionId = req.cookies.session_id;
        if (sessionId) {
            await SessionStore.delete(sessionId);
        }
        res.clearCookie('session_id');
        res.redirect('/');
    });

    // ==========================================
    // Session Activity Monitoring (Admin Only)
    // ==========================================

    // Helper: Check if user has admin access for sessions
    const requireSessionAdmin = (req, res, next) => {
        if (!req.currentUser) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        // System Administrator (roleId 31) has full access
        if (req.currentUser.roleId === 31) {
            return next();
        }
        // Check for Admin role
        if (req.currentUser.roleNames && req.currentUser.roleNames.includes('Admin')) {
            return next();
        }
        // Check for form-based permission
        if (req.currentUser.permissions && req.currentUser.permissions['ADMIN_SESSIONS']?.canView) {
            return next();
        }
        return res.status(403).json({ success: false, message: 'Access denied' });
    };

    // Session Activity Page
    app.get('/admin/sessions', requireAuth, (req, res, next) => {
        // Check access
        if (req.currentUser.roleId !== 31 && 
            !req.currentUser.roleNames?.includes('Admin') && 
            !req.currentUser.permissions?.['ADMIN_SESSIONS']?.canView) {
            return res.status(403).send(`
                <script>
                    alert('Access Denied. You do not have permission to access this page.');
                    window.location.href = '/dashboard';
                </script>
            `);
        }
        const filePath = path.join(__dirname, '../gmrl-auth/admin/pages/session-activity.html');
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error serving session activity page:', err);
                res.status(404).send('<h1>Page Not Found</h1><a href="/dashboard">Back to Dashboard</a>');
            }
        });
    });

    // API: Get all sessions with statistics
    app.get('/api/admin/sessions', requireAuth, requireSessionAdmin, async (req, res) => {
        try {
            console.log(`🔐 [API] Fetching session activity from SQL (User: ${req.currentUser.email})`);

            // Get sessions from SQL database
            const sessionsArray = await SessionStore.getAll();
            const statistics = await SessionStore.getStatistics();

            res.json({
                success: true,
                sessions: sessionsArray,
                statistics: statistics
            });

        } catch (error) {
            console.error('Error fetching sessions:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch sessions', error: error.message });
        }
    });

    // API: Revoke a specific session
    app.delete('/api/admin/sessions/:sessionId', requireAuth, requireSessionAdmin, async (req, res) => {
        try {
            const sessionId = req.params.sessionId;
            console.log(`🔐 [API] Revoking session from SQL (Admin: ${req.currentUser.email})`);

            const deleted = await SessionStore.delete(sessionId);
            if (deleted) {
                res.json({ success: true, message: 'Session revoked successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Session not found' });
            }
        } catch (error) {
            console.error('Error revoking session:', error);
            res.status(500).json({ success: false, message: 'Failed to revoke session', error: error.message });
        }
    });

    // API: Cleanup expired sessions
    app.post('/api/admin/sessions/cleanup', requireAuth, requireSessionAdmin, async (req, res) => {
        try {
            console.log(`🔐 [API] Cleaning up expired sessions from SQL (Admin: ${req.currentUser.email})`);

            const deletedCount = await SessionStore.cleanup();

            res.json({ success: true, deletedCount: deletedCount, message: `Cleaned up ${deletedCount} expired sessions` });
        } catch (error) {
            console.error('Error cleaning up sessions:', error);
            res.status(500).json({ success: false, message: 'Failed to cleanup sessions', error: error.message });
        }
    });
    
    console.log('✅ Authentication routes initialized');
}

/**
 * Middleware to require authentication
 */
async function requireAuth(req, res, next) {
    const sessionId = req.cookies?.session_id;
    
    // DEBUG: Log session ID being used
    console.log(`🔐 [AUTH] Session check: ${sessionId ? sessionId.substring(0, 20) + '...' : 'NO SESSION'} for ${req.path}`);
    
    // Helper to check if request is an API/AJAX call
    const isApiRequest = req.path.includes('/api/') || 
                         req.xhr || 
                         req.headers.accept?.includes('application/json') ||
                         req.headers['content-type']?.includes('application/json');
    
    if (!sessionId) {
        if (isApiRequest) {
            return res.status(401).json({ success: false, error: 'Session expired. Please refresh the page to login again.', sessionExpired: true });
        }
        return res.redirect('/auth/login');
    }
    
    // Get session from SQL (with cache)
    const session = await SessionStore.get(sessionId);
    
    if (!session) {
        res.clearCookie('session_id');
        if (isApiRequest) {
            return res.status(401).json({ success: false, error: 'Session expired. Please refresh the page to login again.', sessionExpired: true });
        }
        return res.redirect('/auth/login');
    }
    
    // Check if session expired (handled by SQL query, but double-check)
    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
        await SessionStore.delete(sessionId);
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
    
    // DEBUG: Log what user was found in session
    console.log(`✅ [AUTH] Session resolved to: ${session.email} (ID: ${session.userId})`);
    
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
 * Generate random session ID with user ID embedded
 * Format: {random8}_{userId}_{random48}
 * Example: mlr1pn4y_123_894a8cb2464f7799d4951017e07146aed780429678f80c50
 */
function generateSessionId(userId) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let prefix = '';
    let suffix = '';
    
    // Generate 8 character prefix
    for (let i = 0; i < 8; i++) {
        prefix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Generate 48 character suffix (hex-like)
    for (let i = 0; i < 48; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Format: prefix_userId_suffix
    return `${prefix}_${userId}_${suffix}`;
}

module.exports = {
    initializeAuth,
    requireAuth,
    requireRole
};
