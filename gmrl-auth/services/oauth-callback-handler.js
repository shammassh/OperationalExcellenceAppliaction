/**
 * OAuth Callback Handler Module
 * Handles Microsoft OAuth2 callback and token exchange
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const msal = require('@azure/msal-node');
const sql = require('mssql');
const config = require('../../config/default');

class OAuthCallbackHandler {
    constructor() {
        // Initialize MSAL configuration
        this.msalConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };
        
        this.msalClient = new msal.ConfidentialClientApplication(this.msalConfig);
    }
    
    /**
     * Handle OAuth2 callback
     */
    async handleCallback(req, res) {
        try {
            const { code, state, error, error_description } = req.query;
            
            // Check for errors from Microsoft
            if (error) {
                console.error('OAuth error:', error, error_description);
                return res.redirect(`/auth/login?error=${encodeURIComponent(error_description || error)}`);
            }
            
            // Validate state (CSRF protection)
            // Extract returnUrl from state if present
            let returnUrl = null;
            if (state) {
                try {
                    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
                    returnUrl = stateData.returnUrl;
                } catch (e) {
                    console.log('Could not parse state, ignoring returnUrl');
                }
            }
            
            if (!code) {
                return res.redirect('/auth/login?error=No authorization code received');
            }
            
            // Exchange code for token
            const tokenResponse = await this.exchangeCodeForToken(code, req);
            
            // Get user profile from Microsoft Graph
            const userProfile = await this.getUserProfile(tokenResponse.accessToken);
            
            // Check/create user in database
            const user = await this.checkOrCreateUser(userProfile);
            
            // Create session
            const session = await this.createSession(user, tokenResponse);
            
            // Store returnUrl in res.locals for redirection
            res.locals.returnUrl = returnUrl;
            
            // Set session cookie
            res.cookie('auth_token', session.session_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            // Log login action
            await this.logAuditAction(user.id, 'LOGIN', req);
            
            // Redirect to returnUrl if present, otherwise redirect based on role
            if (res.locals.returnUrl) {
                console.log(`🔄 Redirecting to return URL: ${res.locals.returnUrl}`);
                res.redirect(res.locals.returnUrl);
            } else {
                this.redirectByRole(user.role, res);
            }
            
        } catch (error) {
            console.error('Callback handling error:', error);
            res.redirect('/auth/login?error=Authentication failed. Please try again.');
        }
    }
    
    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code, req) {
        const redirectUri = process.env.REDIRECT_URI || 'http://localhost:3001/auth/callback';
        
        const tokenRequest = {
            code,
            scopes: ['User.Read', 'User.ReadBasic.All'],
            redirectUri
        };
        
        return await this.msalClient.acquireTokenByCode(tokenRequest);
    }
    
    /**
     * Get user profile from Microsoft Graph API
     */
    async getUserProfile(accessToken) {
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user profile from Microsoft Graph');
        }
        
        const profile = await response.json();
        
        // Get photo URL
        let photoUrl = null;
        try {
            const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (photoResponse.ok) {
                const photoBlob = await photoResponse.blob();
                // In production, save this to storage and use URL
                photoUrl = `https://graph.microsoft.com/v1.0/users/${profile.id}/photo/$value`;
            }
        } catch (photoError) {
            console.log('Could not fetch user photo:', photoError.message);
        }
        
        return {
            azureUserId: profile.id,
            email: profile.mail || profile.userPrincipalName,
            displayName: profile.displayName,
            jobTitle: profile.jobTitle,
            department: profile.department,
            photoUrl
        };
    }
    
    /**
     * Check if user exists, create if not
     */
    async checkOrCreateUser(userProfile) {
        const pool = await sql.connect(config.database);
        
        // Check if user exists
        let result = await pool.request()
            .input('email', sql.NVarChar, userProfile.email)
            .query('SELECT * FROM Users WHERE email = @email');
        
        if (result.recordset.length > 0) {
            // User exists - update Azure ID and last login
            const user = result.recordset[0];
            
            await pool.request()
                .input('id', sql.Int, user.id)
                .input('azureUserId', sql.NVarChar, userProfile.azureUserId)
                .input('displayName', sql.NVarChar, userProfile.displayName)
                .input('photoUrl', sql.NVarChar, userProfile.photoUrl)
                .input('jobTitle', sql.NVarChar, userProfile.jobTitle)
                .input('department', sql.NVarChar, userProfile.department)
                .query(`
                    UPDATE Users 
                    SET 
                        azure_user_id = @azureUserId,
                        display_name = @displayName,
                        photo_url = @photoUrl,
                        job_title = @jobTitle,
                        department = @department,
                        last_login = GETDATE(),
                        updated_at = GETDATE()
                    WHERE id = @id
                `);
            
            // Fetch updated user
            result = await pool.request()
                .input('id', sql.Int, user.id)
                .query('SELECT * FROM Users WHERE id = @id');
            
            return result.recordset[0];
            
        } else {
            // Create new user with 'Pending' role
            result = await pool.request()
                .input('azureUserId', sql.NVarChar, userProfile.azureUserId)
                .input('email', sql.NVarChar, userProfile.email)
                .input('displayName', sql.NVarChar, userProfile.displayName)
                .input('photoUrl', sql.NVarChar, userProfile.photoUrl)
                .input('jobTitle', sql.NVarChar, userProfile.jobTitle)
                .input('department', sql.NVarChar, userProfile.department)
                .query(`
                    INSERT INTO Users (
                        azure_user_id, email, display_name, photo_url,
                        job_title, department, role, is_active, is_approved, last_login
                    )
                    OUTPUT INSERTED.*
                    VALUES (
                        @azureUserId, @email, @displayName, @photoUrl,
                        @jobTitle, @department, 'Pending', 1, 0, GETDATE()
                    )
                `);
            
            return result.recordset[0];
        }
    }
    
    /**
     * Create session for user (24 hours)
     */
    async createSession(user, tokenResponse) {
        const pool = await sql.connect(config.database);
        
        const sessionToken = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        const result = await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .input('userId', sql.Int, user.id)
            .input('accessToken', sql.NVarChar, tokenResponse.accessToken)
            .input('refreshToken', sql.NVarChar, tokenResponse.refreshToken || null)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query(`
                INSERT INTO Sessions (
                    session_token, user_id, azure_access_token,
                    azure_refresh_token, expires_at
                )
                OUTPUT INSERTED.*
                VALUES (
                    @sessionToken, @userId, @accessToken,
                    @refreshToken, @expiresAt
                )
            `);
        
        return result.recordset[0];
    }
    
    /**
     * Generate random session token
     */
    generateSessionToken() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Log audit action
     */
    async logAuditAction(userId, action, req) {
        try {
            const pool = await sql.connect(config.database);
            
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('action', sql.NVarChar, action)
                .input('ipAddress', sql.NVarChar, req.ip || req.connection.remoteAddress)
                .input('userAgent', sql.NVarChar, req.headers['user-agent'])
                .query(`
                    INSERT INTO AuditLog (user_id, action, ip_address, user_agent)
                    VALUES (@userId, @action, @ipAddress, @userAgent)
                `);
        } catch (error) {
            console.error('Failed to log audit action:', error);
        }
    }
    
    /**
     * Redirect based on user role
     */
    redirectByRole(role, res) {
        switch (role) {
            case 'Admin':
                res.redirect('/dashboard');
                break;
            
            case 'Auditor':
                res.redirect('/auditor/selection');
                break;
            
            case 'StoreManager':
                res.redirect('/dashboard');
                break;
            
            case 'CleaningHead':
            case 'ProcurementHead':
            case 'MaintenanceHead':
                res.redirect('/dashboard');
                break;
            
            case 'Pending':
            default:
                res.redirect('/auth/pending-approval');
                break;
        }
    }
}

module.exports = OAuthCallbackHandler;
