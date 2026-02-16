/**
 * Dynamic Form Access Middleware
 * SQL-Driven Permission Enforcement
 * 
 * Automatically checks UserFormAccess based on URL patterns from Forms table
 * No hardcoding - all permissions come from database
 */

const sql = require('mssql');
const config = require('../../config/default');

// Cache for form URL mappings (refreshed every 5 minutes)
let formMappingsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load form URL mappings from database
 */
async function loadFormMappings() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (formMappingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return formMappingsCache;
    }
    
    try {
        const pool = await sql.connect(config.database);
        const result = await pool.request().query(`
            SELECT FormCode, FormName, ModuleName, FormUrl, IsActive
            FROM Forms
            WHERE IsActive = 1
            ORDER BY LEN(FormUrl) DESC
        `);
        
        formMappingsCache = result.recordset;
        cacheTimestamp = now;
        
        console.log(`[FORM-ACCESS] Loaded ${formMappingsCache.length} form mappings from database`);
        return formMappingsCache;
        
    } catch (error) {
        console.error('[FORM-ACCESS] Error loading form mappings:', error.message);
        return formMappingsCache || []; // Return old cache if available
    }
}

/**
 * Clear the cache (call this when forms are updated in admin)
 */
function clearFormMappingsCache() {
    formMappingsCache = null;
    cacheTimestamp = 0;
    console.log('[FORM-ACCESS] Cache cleared');
}

/**
 * Match URL to FormCode
 * Returns the FormCode if matched, null otherwise
 */
function matchUrlToForm(url, formMappings) {
    // Normalize URL - remove query string and trailing slash
    const normalizedUrl = url.split('?')[0].replace(/\/$/, '').toLowerCase();
    
    for (const form of formMappings) {
        if (!form.FormUrl) continue;
        
        const formUrl = form.FormUrl.toLowerCase().replace(/\/$/, '');
        
        // Exact match
        if (normalizedUrl === formUrl) {
            return form;
        }
        
        // Prefix match (e.g., /ohs-inspection matches /ohs-inspection/new)
        if (normalizedUrl.startsWith(formUrl + '/') || normalizedUrl.startsWith(formUrl)) {
            return form;
        }
        
        // Pattern match with wildcards (e.g., /ohs-inspection/* matches /ohs-inspection/123)
        if (formUrl.includes('*')) {
            const pattern = formUrl.replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(normalizedUrl)) {
                return form;
            }
        }
    }
    
    return null;
}

/**
 * Determine required action based on HTTP method
 */
function getRequiredAction(method, url) {
    const lowerUrl = url.toLowerCase();
    
    // Check URL patterns for action hints
    if (lowerUrl.includes('/delete') || lowerUrl.includes('/remove')) {
        return 'delete';
    }
    if (lowerUrl.includes('/edit') || lowerUrl.includes('/update')) {
        return 'edit';
    }
    if (lowerUrl.includes('/new') || lowerUrl.includes('/create') || lowerUrl.includes('/add')) {
        return 'create';
    }
    
    // Fall back to HTTP method
    switch (method.toUpperCase()) {
        case 'DELETE':
            return 'delete';
        case 'PUT':
        case 'PATCH':
            return 'edit';
        case 'POST':
            // POST could be create or action, check URL
            if (lowerUrl.includes('/api/')) {
                // API POST is usually create unless it's a specific action
                return 'create';
            }
            return 'create';
        case 'GET':
        default:
            return 'view';
    }
}

/**
 * Generate Access Denied HTML
 */
function generateAccessDeniedHTML(formName, action, userEmail) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 50px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .icon { font-size: 80px; margin-bottom: 20px; }
        h1 { color: #e74c3c; margin-bottom: 15px; font-size: 28px; }
        p { color: #666; font-size: 16px; margin-bottom: 10px; line-height: 1.6; }
        .details {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 25px 0;
            text-align: left;
        }
        .details-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .details-row:last-child { border-bottom: none; }
        .details-label { color: #888; font-size: 14px; }
        .details-value { color: #333; font-weight: 500; font-size: 14px; }
        .btn {
            display: inline-block;
            padding: 12px 30px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 5px;
            font-weight: 500;
            transition: background 0.2s;
        }
        .btn:hover { background: #2980b9; }
        .btn-secondary { background: #95a5a6; }
        .btn-secondary:hover { background: #7f8c8d; }
        .contact { margin-top: 25px; font-size: 14px; color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🚫</div>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this form.</p>
        
        <div class="details">
            <div class="details-row">
                <span class="details-label">Form:</span>
                <span class="details-value">${formName}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Required Permission:</span>
                <span class="details-value">${action.charAt(0).toUpperCase() + action.slice(1)}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Your Account:</span>
                <span class="details-value">${userEmail}</span>
            </div>
        </div>
        
        <a href="/dashboard" class="btn">← Back to Dashboard</a>
        <a href="javascript:history.back()" class="btn btn-secondary">Go Back</a>
        
        <p class="contact">
            Need access? Contact your System Administrator.
        </p>
    </div>
</body>
</html>
`;
}

/**
 * Require Form Access Middleware
 * Use AFTER requireAuth middleware
 * 
 * Checks if user has permission to access the form based on:
 * 1. URL matching to FormCode in Forms table
 * 2. UserFormAccess permissions for that FormCode
 * 
 * Options:
 *   - bypass: Array of URL prefixes to skip checking (e.g., ['/admin', '/dashboard'])
 *   - defaultAllow: If true, allow access when form not found in registry (default: false)
 */
function requireFormAccess(options = {}) {
    const {
        bypass = ['/admin', '/dashboard', '/auth', '/api/user', '/notifications'],
        defaultAllow = true,  // Allow by default if form not in registry (safer for transition)
        logAccess = true
    } = options;
    
    return async function(req, res, next) {
        try {
            // Skip if no user (shouldn't happen if requireAuth is used first)
            if (!req.currentUser) {
                console.log('[FORM-ACCESS] No currentUser - skipping');
                return next();
            }
            
            const url = req.originalUrl || req.url;
            
            // Check bypass list
            for (const prefix of bypass) {
                if (url.toLowerCase().startsWith(prefix.toLowerCase())) {
                    return next();
                }
            }
            
            // System Administrators always have access (but NOT when impersonating another user)
            const isImpersonating = req.currentUser.isImpersonating === true;
            if (!isImpersonating && req.currentUser.hasRole && req.currentUser.hasRole('System Administrator')) {
                if (logAccess) {
                    console.log(`[FORM-ACCESS] ✅ System Administrator bypass: ${req.currentUser.email}`);
                }
                return next();
            }
            
            // Load form mappings from database
            const formMappings = await loadFormMappings();
            
            // Match URL to form
            const matchedForm = matchUrlToForm(url, formMappings);
            
            if (logAccess) {
                console.log(`[FORM-ACCESS] Checking URL: ${url} | Method: ${req.method} | Matched: ${matchedForm ? matchedForm.FormCode : 'NONE'}`);
            }
            
            if (!matchedForm) {
                // Form not in registry
                if (defaultAllow) {
                    if (logAccess) {
                        console.log(`[FORM-ACCESS] ⚠️ Form not in registry (allowed by default): ${url}`);
                    }
                    return next();
                } else {
                    console.log(`[FORM-ACCESS] ❌ Form not in registry (blocked): ${url}`);
                    return res.status(403).send(generateAccessDeniedHTML('Unknown Form', 'access', req.currentUser.email));
                }
            }
            
            // Determine required action
            const action = getRequiredAction(req.method, url);
            
            // Check permission
            const perm = req.currentUser.permissions ? req.currentUser.permissions[matchedForm.FormCode] : null;
            console.log(`[FORM-ACCESS] Permission for ${matchedForm.FormCode}: ${JSON.stringify(perm)} | Action: ${action}`);
            
            const hasAccess = req.currentUser.canAccess ? req.currentUser.canAccess(matchedForm.FormCode, action) : false;
            
            if (hasAccess) {
                if (logAccess) {
                    console.log(`[FORM-ACCESS] ✅ ${req.currentUser.email} -> ${matchedForm.FormCode} (${action})`);
                }
                return next();
            }
            
            // Access denied
            console.log(`[FORM-ACCESS] ❌ DENIED: ${req.currentUser.email} -> ${matchedForm.FormCode} (${action})`);
            
            // Return JSON for API requests
            if (url.includes('/api/')) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: `You don't have ${action} permission for ${matchedForm.FormName}`,
                    formCode: matchedForm.FormCode,
                    requiredAction: action
                });
            }
            
            // Return HTML for page requests
            return res.status(403).send(generateAccessDeniedHTML(matchedForm.FormName, action, req.currentUser.email));
            
        } catch (error) {
            console.error('[FORM-ACCESS] Error:', error);
            // On error, allow access (fail-open) to prevent lockout
            return next();
        }
    };
}

/**
 * Require specific form permission middleware
 * Use for explicit permission checks on specific routes
 * 
 * Usage:
 *   router.post('/api/create', requireFormPermission('OHS_INSPECTION', 'create'), handler);
 */
function requireFormPermission(formCode, action = 'view') {
    return function(req, res, next) {
        if (!req.currentUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        // System Administrators always have access
        if (req.currentUser.hasRole && req.currentUser.hasRole('System Administrator')) {
            return next();
        }
        
        const hasAccess = req.currentUser.canAccess(formCode, action);
        
        if (hasAccess) {
            return next();
        }
        
        // Access denied
        const url = req.originalUrl || req.url;
        
        if (url.includes('/api/')) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: `You don't have ${action} permission for this form`,
                formCode: formCode,
                requiredAction: action
            });
        }
        
        return res.status(403).send(generateAccessDeniedHTML(formCode, action, req.currentUser.email));
    };
}

module.exports = {
    requireFormAccess,
    requireFormPermission,
    clearFormMappingsCache,
    loadFormMappings
};
