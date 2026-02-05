/**
 * Authentication Middleware Module
 * Checks if user is authenticated
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const SessionManager = require('../services/session-manager');

/**
 * Require authentication middleware
 * Use this to protect any route that requires login
 * 
 * Usage:
 *   app.get('/dashboard', requireAuth, (req, res) => { ... });
 */
async function requireAuth(req, res, next) {
    try {
        // Get session token from cookie
        const sessionToken = req.cookies.auth_token;
        
        if (!sessionToken) {
            console.log('❌ No session token found');
            return redirectToLogin(req, res);
        }
        
        // Validate token format
        if (!SessionManager.isValidTokenFormat(sessionToken)) {
            console.log('❌ Invalid session token format');
            return redirectToLogin(req, res);
        }
        
        // Get session from database
        const session = await SessionManager.getSession(sessionToken);
        
        if (!session) {
            console.log('❌ Session not found or expired');
            return redirectToLogin(req, res);
        }
        
        // Update last activity
        await SessionManager.updateActivity(sessionToken);
        
        // Attach user info to request
        const roleNames = session.roleNames || [];
        req.currentUser = {
            id: session.user_db_id,  // Use the explicit user database ID
            azureUserId: session.azure_user_id,
            email: session.email,
            displayName: session.display_name,
            role: roleNames.length > 0 ? roleNames.join(', ') : session.role,  // Show all roles or legacy role
            roleId: session.role_id,  // Legacy role ID for backward compatibility
            roles: session.roles || [],  // All assigned roles
            roleNames: roleNames,  // Role names as array
            permissions: session.permissions || {},  // Form permissions
            isActive: session.is_active,
            isApproved: session.is_approved,
            accessToken: session.azure_access_token
        };
        
        // Add helper functions
        req.currentUser.hasRole = function(roleName) {
            return this.roleNames.includes(roleName);
        };
        
        req.currentUser.hasAnyRole = function(...roleNames) {
            return roleNames.some(r => this.roleNames.includes(r));
        };
        
        req.currentUser.canAccess = function(formCode, action = 'view') {
            const perm = this.permissions[formCode];
            if (!perm) return false;
            switch(action.toLowerCase()) {
                case 'view': return perm.canView;
                case 'create': return perm.canCreate;
                case 'edit': return perm.canEdit;
                case 'delete': return perm.canDelete;
                default: return false;
            }
        };
        
        req.sessionToken = sessionToken;
        
        console.log(`✅ Authenticated: ${session.email} (${session.role})`);
        
        // Continue to next middleware
        next();
        
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).send('Authentication error. Please try again.');
    }
}

/**
 * Redirect to login page
 */
function redirectToLogin(req, res) {
    // For API requests, return JSON
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({
            error: 'Not authenticated',
            message: 'Please login to access this resource'
        });
    }
    
    // For page requests, redirect to login
    const returnUrl = encodeURIComponent(req.originalUrl);
    res.redirect(`/auth/login?returnUrl=${returnUrl}`);
}

module.exports = requireAuth;
