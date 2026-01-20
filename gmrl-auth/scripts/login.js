/**
 * Login Page Client Script
 * Handles Microsoft authentication on client side
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

(function() {
    'use strict';
    
    const loginButton = document.getElementById('loginButton');
    
    // Handle login button click
    loginButton.addEventListener('click', async function() {
        try {
            // Add loading state
            loginButton.classList.add('loading');
            loginButton.disabled = true;
            
            // Get auth config from server
            const response = await fetch('/auth/config');
            const config = await response.json();
            
            // Build Microsoft OAuth2 URL
            const authUrl = buildAuthUrl(config);
            
            // Redirect to Microsoft login
            window.location.href = authUrl;
            
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
            
            // Remove loading state
            loginButton.classList.remove('loading');
            loginButton.disabled = false;
        }
    });
    
    /**
     * Build Microsoft OAuth2 authorization URL
     */
    function buildAuthUrl(config) {
        const returnUrl = window.LOGIN_RETURN_URL || '';
        const stateData = {
            random: generateState(),
            returnUrl: returnUrl
        };
        const params = new URLSearchParams({
            client_id: config.clientId,
            response_type: 'code',
            redirect_uri: config.redirectUri,
            response_mode: 'query',
            scope: config.scopes.join(' '),
            state: btoa(JSON.stringify(stateData))
        });
        
        return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params}`;
    }
    
    /**
     * Generate random state for CSRF protection
     */
    function generateState() {
        const state = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('oauth_state', state);
        return state;
    }
    
    // Check if there's an error in URL (from failed auth)
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (error) {
        alert(`Authentication failed: ${errorDescription || error}`);
        // Clean URL
        window.history.replaceState({}, document.title, '/auth/login');
    }
    
})();
