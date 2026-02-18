/**
 * Logout Handler Module
 * Destroys session and redirects to login
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const SessionManager = require('../services/session-manager');

class LogoutHandler {
    /**
     * Handle logout request
     */
    static async handleLogout(req, res) {
        try {
            // Get session token from cookie
            const sessionToken = req.cookies?.auth_token;
            
            if (sessionToken) {
                // Delete session from database
                await SessionManager.deleteSession(sessionToken);
                
                console.log('[LOGOUT] Session destroyed:', {
                    timestamp: new Date().toISOString(),
                    userEmail: req.currentUser?.email || 'Unknown'
                });
            }
            
            // Clear cookies (auth_token AND impersonation cookie)
            res.clearCookie('auth_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            res.clearCookie('impersonate_user_id', { path: '/' });
            
            console.log('[LOGOUT] Cleared all session cookies');
            
            // Redirect to login with logout message
            res.redirect('/auth/login?message=logged_out');
            
        } catch (error) {
            console.error('[LOGOUT] Error during logout:', error);
            
            // Even if there's an error, clear all cookies and redirect
            res.clearCookie('auth_token');
            res.clearCookie('impersonate_user_id', { path: '/' });
            res.redirect('/auth/login?error=logout_error');
        }
    }
    
    /**
     * Handle force logout (for expired sessions or security)
     */
    static async forceLogout(req, res, reason = 'session_expired') {
        try {
            // Clear all session cookies
            res.clearCookie('auth_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            res.clearCookie('impersonate_user_id', { path: '/' });
            
            console.log('[LOGOUT] Force logout triggered:', {
                timestamp: new Date().toISOString(),
                reason: reason,
                userEmail: req.currentUser?.email || 'Unknown'
            });
            
            // Redirect with reason
            res.redirect(`/auth/login?error=${reason}`);
            
        } catch (error) {
            console.error('[LOGOUT] Error during force logout:', error);
            res.clearCookie('auth_token');
            res.clearCookie('impersonate_user_id', { path: '/' });
            res.redirect('/auth/login?error=logout_error');
        }
    }
}

module.exports = LogoutHandler;
