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
        req.currentUser = {
            id: session.user_db_id,  // Use the explicit user database ID
            azureUserId: session.azure_user_id,
            email: session.email,
            displayName: session.display_name,
            photoUrl: session.photo_url,
            jobTitle: session.job_title,
            department: session.department,
            role: session.role,
            assignedStores: session.assigned_stores ? JSON.parse(session.assigned_stores) : [],
            assignedDepartment: session.assigned_department,
            isActive: session.is_active,
            isApproved: session.is_approved,
            accessToken: session.azure_access_token // Add user's Azure access token
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
