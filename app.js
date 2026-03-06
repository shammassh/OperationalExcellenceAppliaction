/**
 * Operational Excellence App
 * Main application entry point
 */

const path = require('path');

// Load the correct .env file based on NODE_ENV
// Support both 'live' and 'production' for .env.live
const isProduction = process.env.NODE_ENV === 'live' || process.env.NODE_ENV === 'production';
const envFile = isProduction ? '.env.live' : '.env.uat';
require('dotenv').config({ path: path.join(__dirname, envFile) });

const express = require('express');
const fs = require('fs');
const https = require('https');
const http = require('http');
const sql = require('mssql');

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

// Import auth module
const { initializeAuth, requireAuth, requireRole } = require('./auth/auth-server');

// Import dynamic form access middleware (SQL-driven permissions)
const { requireFormAccess, clearFormMappingsCache } = require('./gmrl-auth/middleware/require-form-access');

// Import modules
const storesModule = require('./modules/stores');
const adminModule = require('./modules/admin');
const operationalExcellenceModule = require('./modules/operational-excellence');
const hrModule = require('./modules/hr');
const personnelModule = require('./modules/personnel');
const oeInspectionModule = require('./modules/oe-inspection');
const ohsModule = require('./modules/ohs');
const ohsInspectionModule = require('./modules/ohs-inspection');
const securityServicesModule = require('./modules/security-services');
const securityModule = require('./modules/security');
const securityEmpModule = require('./modules/security-emp');
const escalationModule = require('./modules/escalation');

// Import escalation service for scheduled tasks
const actionPlanEscalation = require('./services/action-plan-escalation');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize Authentication
initializeAuth(app);

// ==========================================
// Dynamic Form Access Middleware (SQL-Driven)
// ==========================================
// This middleware checks UserFormAccess table based on URL patterns from Forms table
// Bypass: /admin (has its own check), /dashboard, /auth, /notifications
const formAccessMiddleware = requireFormAccess({
    bypass: ['/admin', '/dashboard', '/auth', '/api/user', '/notifications', '/public'],
    defaultAllow: true,  // Allow if form not in registry (safe for transition period)
    logAccess: true      // Log all access checks to console
});

// ==========================================
// Public Email Approval Routes (no auth required)
// ==========================================
const publicApprovalRoutes = require('./routes/public-approval');
app.use('/public/approve', publicApprovalRoutes);

// ==========================================
// Notifications Routes
// ==========================================
const notificationsRoutes = require('./routes/notifications');
app.use('/notifications', requireAuth, notificationsRoutes);

// Mount Modules (with form access enforcement)
app.use('/stores', requireAuth, formAccessMiddleware, storesModule);
app.use('/admin', requireAuth, adminModule);  // Admin has its own requireSysAdmin check
app.use('/operational-excellence', requireAuth, formAccessMiddleware, operationalExcellenceModule);
app.use('/oe-inspection', requireAuth, formAccessMiddleware, oeInspectionModule);
app.use('/hr', requireAuth, formAccessMiddleware, hrModule);
app.use('/personnel', requireAuth, formAccessMiddleware, personnelModule);
app.use('/ohs', requireAuth, formAccessMiddleware, ohsModule);
app.use('/ohs-inspection', requireAuth, formAccessMiddleware, ohsInspectionModule);
app.use('/security-services', requireAuth, formAccessMiddleware, securityServicesModule);
app.use('/security', requireAuth, formAccessMiddleware, securityModule);
app.use('/security-emp', requireAuth, formAccessMiddleware, securityEmpModule);
app.use('/escalation', requireAuth, formAccessMiddleware, escalationModule);

// Redirect common mistaken routes
app.get('/permission-sync', (req, res) => res.redirect('/admin/permission-sync'));

// ==========================================
// Routes
// ==========================================

// Public home page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${process.env.APP_NAME || 'Operational Excellence App'}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    max-width: 900px; 
                    margin: 50px auto; 
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                }
                h1 { color: #0078d4; margin-bottom: 10px; }
                .subtitle { color: #666; margin-bottom: 30px; }
                .btn { 
                    padding: 12px 30px; 
                    background: #0078d4; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px;
                    display: inline-block;
                    font-size: 16px;
                }
                .btn:hover { background: #005a9e; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${process.env.APP_NAME || 'Operational Excellence App'}</h1>
                <p class="subtitle">GMRL Operational Excellence Management System</p>
                <p>Welcome! Please login with your Microsoft account to continue.</p>
                <br>
                <a href="/auth/login" class="btn">Login with Microsoft</a>
            </div>
        </body>
        </html>
    `);
});

// Protected dashboard
app.get('/dashboard', requireAuth, async (req, res) => {
    const permissions = req.currentUser.permissions || {};
    const roleNames = req.currentUser.roleNames || [];
    const primaryRole = req.currentUser.role;
    
    // Map form codes to menu sections
    const formToMenu = {
        // Stores module
        'THEFT_INCIDENT': 'stores', 'COMPLAINT': 'stores', 'EXTRA_CLEANING': 'stores',
        'WEEKLY_FEEDBACK': 'stores', 'FIVE_DAYS_ENTRY': 'stores', 'STORES_LOST_AND_FOUND': 'stores',
        
        // Maknezi F&B module
        'PRODUCTION_EXTRAS': 'maknezi-fnb',
        
        // Security Services module
        'SECURITY_SCHEDULE': 'security-services',
        
        // Personnel module  
        'THIRDPARTY_SCHEDULE': 'personnel', 'THIRDPARTY_ATTENDANCE': 'personnel',
        'PERSONNEL_DASHBOARD': 'personnel',
        
        // OHS module (main OHS incidents)
        'OHS_DASHBOARD': 'ohs', 'OHS_INCIDENT': 'ohs', 'OHS_SETTINGS': 'ohs',
        'OHS_FIRE_EQUIPMENT': 'fire-equipment', 'OHS_FIRE_EQUIPMENT_ADMIN': 'fire-equipment',
        
        // OHS Inspection module
        'OHS_INSPECTION': 'ohs-inspection', 'OHS_INSPECTION_START': 'ohs-inspection', 
        'OHS_INSPECTION_LIST': 'ohs-inspection', 'OHS_INSPECTION_VIEW': 'ohs-inspection',
        'OHS_INSPECTION_TEMPLATES': 'ohs-inspection', 'OHS_INSPECTION_STORES': 'ohs-inspection',
        'OHS_INSPECTION_ACTION_PLANS': 'ohs-inspection', 'OHS_INSPECTION_DEPT_REPORTS': 'ohs-inspection',
        'OHS_INSPECTION_SETTINGS': 'ohs-inspection', 'OHS_INSPECTION_REPORT': 'ohs-inspection',
        'OHS_TEMPLATE_BUILDER': 'ohs-inspection',
        
        // OE module (dashboards)
        'OP_EXCELLENCE': 'oe', 'OP_THEFT': 'oe', 'OP_COMPLAINTS': 'oe', 'OP_EXTRA_CLEANING': 'oe',
        'OP_FEEDBACK': 'oe', 'OP_PRODUCTION': 'oe', 'OP_FIVE_DAYS': 'oe', 'OP_ATTENDANCE': 'oe',
        'OP_THIRDPARTY': 'oe', 'OP_SECURITY': 'oe',
        'THEFT_DASHBOARD': 'oe', 'COMPLAINTS_DASHBOARD': 'oe', 'EXTRA_CLEANING_REVIEW': 'oe',
        'FEEDBACK_DASHBOARD': 'oe', 'PRODUCTION_DASHBOARD': 'oe', 'FIVE_DAYS_DASHBOARD': 'oe',
        'ATTENDANCE_DASHBOARD': 'oe', 'THIRDPARTY_DASHBOARD': 'oe', 'SECURITY_DASHBOARD': 'oe',
        'MASTER_TABLE': 'master-table',
        'STORE_VISIT_CALENDAR': 'store-visit-calendar',
        
        // OE Inspection module
        'OE_INSPECTION': 'oe-inspection', 'OE_INSPECTION_START': 'oe-inspection', 
        'OE_INSPECTION_LIST': 'oe-inspection', 'OE_INSPECTION_VIEW': 'oe-inspection',
        'OE_INSPECTION_ACTION_PLANS': 'oe-inspection', 'OE_INSPECTION_DEPT_REPORTS': 'oe-inspection',
        'OE_INSPECTION_TEMPLATES': 'oe-inspection', 'OE_INSPECTION_STORES': 'oe-inspection',
        'OE_INSPECTION_SETTINGS': 'oe-inspection', 'OE_INSPECTION_REPORT': 'oe-inspection',
        'OE_TEMPLATE_BUILDER': 'oe-inspection',
        
        // Third-Party module (also in personnel)
        
        // Security / Facility Management module
        'SECURITY_CLEANING': 'security',
        'LEGAL_CASES': 'legal-cases',
        'THIRDPARTY_BLACKLIST': 'thirdparty-blacklist',
        'SECURITY_DAILY_REPORTING': 'security-daily-reporting',
        'SEC_VISIT_CALENDAR': 'sec-visit-calendar',
        'CAMERA_REQUEST': 'camera-request',
        // Security Department forms (security-emp)
        'SECURITY_LEGAL_CASES': 'legal-cases',
        'SECURITY_BLACKLIST': 'thirdparty-blacklist',
        'SECURITY_VISIT_CALENDAR': 'sec-visit-calendar',
        'SECURITY_CAMERA_REQUEST': 'camera-request',
        'SECURITY_POST_VISIT_REPORT': 'post-visit-report',
        
        // HR module (HR_DASHBOARD is required for HR access)
        'HR_DASHBOARD': 'hr',
        
        // Escalation module
        'ESCALATION_DASHBOARD': 'escalation', 'ESCALATION_MANAGEMENT': 'escalation', 'ESCALATION_ADMIN': 'escalation',
        
        // Broadcast module
        'BROADCAST_SEND': 'broadcast', 'BROADCAST_VIEW': 'broadcast'
    };
    
    // Calculate which menus user can access based on their form permissions
    const accessibleMenus = new Set();
    
    // If user has permissions from database, use those
    if (Object.keys(permissions).length > 0) {
        Object.keys(permissions).forEach(formCode => {
            const perm = permissions[formCode];
            if (perm.canView) {
                const menu = formToMenu[formCode];
                if (menu) accessibleMenus.add(menu);
            }
        });
    }
    
    // System Administrator always has full access - will be handled below from database
    const isSystemAdmin = roleNames.includes('System Administrator');
    
    // Build menu items dynamically from Forms table
    let menuCategories = [];
    let pool;
    try {
        // Fetch dashboard menu items from Forms table
        pool = await sql.connect(dbConfig);
        const dashboardForms = await pool.request().query(`
            SELECT 
                FormCode,
                MenuId,
                FormUrl,
                DashboardIcon,
                DashboardCategory,
                DashboardCategoryIcon,
                DashboardCategoryColor,
                DashboardTitle,
                DashboardDescription,
                CategorySortOrder,
                DashboardSortOrder
            FROM Forms 
            WHERE ShowOnDashboard = 1 AND IsActive = 1 AND MenuId IS NOT NULL
            ORDER BY CategorySortOrder, DashboardSortOrder
        `);
        
        // System Admin gets all menu items
        if (isSystemAdmin) {
            dashboardForms.recordset.forEach(f => {
                if (f.MenuId) accessibleMenus.add(f.MenuId);
            });
        }
        
        // Group forms by category
        const categoryMap = new Map();
        dashboardForms.recordset.forEach(form => {
            if (!categoryMap.has(form.DashboardCategory)) {
                categoryMap.set(form.DashboardCategory, {
                    category: form.DashboardCategory,
                    icon: form.DashboardCategoryIcon || '📁',
                    color: form.DashboardCategoryColor || '#666',
                    sortOrder: form.CategorySortOrder || 100,
                    items: []
                });
            }
            categoryMap.get(form.DashboardCategory).items.push({
                id: form.MenuId,
                icon: form.DashboardIcon || '📄',
                title: form.DashboardTitle || form.FormCode,
                href: form.FormUrl,
                desc: form.DashboardDescription || ''
            });
        });
        
        // Convert map to sorted array
        menuCategories = Array.from(categoryMap.values())
            .sort((a, b) => a.sortOrder - b.sortOrder);
            
    } catch (dbErr) {
        console.error('Error loading dashboard menu from DB:', dbErr);
        // Fallback to empty - admin needs to set up the forms
        menuCategories = [];
    }
    
    // Filter categories - show all categories, filter items based on access
    const visibleCategories = menuCategories
        .map(cat => ({
            ...cat,
            items: cat.items.filter(item => accessibleMenus.has(item.id))
        }));
    
    // Generate HTML for categorized menu with collapsible sections
    const menuHtml = visibleCategories.map((cat, index) => `
        <div class="category-section${cat.items.length === 0 ? ' empty-category' : ''}">
            <div class="category-header" style="border-left-color: ${cat.color};" onclick="toggleCategory(${index})">
                <div class="category-header-left">
                    <span class="category-icon">${cat.icon}</span>
                    <span class="category-title">${cat.category}</span>
                    <span class="category-count">${cat.items.length} app${cat.items.length !== 1 ? 's' : ''}</span>
                </div>
                <span class="category-toggle" id="toggle-${index}">▼</span>
            </div>
            <div class="category-items" id="items-${index}">
                ${cat.items.length > 0 ? cat.items.map(item => `
                    <a href="${item.href}" class="menu-item" style="--hover-color: ${cat.color};">
                        <div class="menu-icon">${item.icon}</div>
                        <div class="menu-content">
                            <div class="menu-title">${item.title}</div>
                            <div class="menu-desc">${item.desc}</div>
                        </div>
                    </a>
                `).join('') : `<div class="empty-message">🚧 Coming soon - No apps available yet</div>`}
            </div>
        </div>
    `).join('');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - ${process.env.APP_NAME}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    max-width: 1200px; 
                    margin: 0 auto; 
                    padding: 20px;
                    background: #f5f5f5;
                }
                .header {
                    background: #0078d4;
                    color: white;
                    padding: 20px;
                    border-radius: 10px 10px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .content {
                    background: white;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .user-card {
                    background: #f0f7ff;
                    padding: 20px;
                    border-radius: 8px;
                    border-left: 4px solid #0078d4;
                    margin-bottom: 20px;
                }
                .logout-btn {
                    background: white;
                    color: #0078d4;
                    padding: 8px 20px;
                    border-radius: 5px;
                    text-decoration: none;
                }
                .menu-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                    margin-top: 20px;
                }
                .category-section {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .category-header {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 15px 20px;
                    border-left: 4px solid #0078d4;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .category-header:hover {
                    background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
                }
                .category-header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .category-icon {
                    font-size: 24px;
                }
                .category-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                }
                .category-count {
                    font-size: 12px;
                    color: #666;
                    background: #e9ecef;
                    padding: 3px 10px;
                    border-radius: 12px;
                }
                .category-toggle {
                    font-size: 14px;
                    color: #666;
                    transition: transform 0.3s ease;
                }
                .category-toggle.collapsed {
                    transform: rotate(-90deg);
                }
                .category-items {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 15px;
                    padding: 20px;
                }
                .menu-item {
                    background: #f8f9fa;
                    padding: 18px;
                    border-radius: 10px;
                    text-decoration: none;
                    color: #333;
                    transition: all 0.3s ease;
                    border: 1px solid #e9ecef;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .menu-item:hover {
                    background: var(--hover-color, #0078d4);
                    color: white;
                    transform: translateX(5px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                }
                .menu-icon {
                    font-size: 32px;
                    flex-shrink: 0;
                }
                .menu-content {
                    flex: 1;
                }
                .menu-title {
                    font-size: 15px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                .menu-desc {
                    font-size: 12px;
                    opacity: 0.75;
                }
                .empty-category {
                    opacity: 0.7;
                }
                .empty-message {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 30px;
                    color: #888;
                    font-style: italic;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                .no-access {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                .notification-bell {
                    position: relative;
                    background: rgba(255,255,255,0.15);
                    padding: 10px 15px;
                    border-radius: 8px;
                    text-decoration: none;
                    color: white;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                }
                .notification-bell:hover {
                    background: rgba(255,255,255,0.25);
                }
                .notification-badge {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #e74c3c;
                    color: white;
                    font-size: 11px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 10px;
                    min-width: 18px;
                    text-align: center;
                }
                .impersonation-banner {
                    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: 600;
                    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
                }
                .impersonation-banner a {
                    background: white;
                    color: #e74c3c;
                    padding: 6px 15px;
                    border-radius: 5px;
                    text-decoration: none;
                    font-weight: 600;
                }
                .broadcast-panel {
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    border: 1px solid #ffc107;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 25px;
                }
                .broadcast-panel.high-priority {
                    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
                    border-color: #dc3545;
                }
                .broadcast-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .broadcast-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                }
                .broadcast-item {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                .broadcast-item:last-child { margin-bottom: 0; }
                .broadcast-item-title {
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #333;
                }
                .broadcast-item-message {
                    color: #555;
                    font-size: 14px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                }
                .broadcast-item-meta {
                    margin-top: 10px;
                    font-size: 12px;
                    color: #888;
                }
                .broadcast-dismiss {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    font-size: 18px;
                }
                .broadcast-dismiss:hover { color: #333; }
            </style>
        </head>
        <body>
            ${req.currentUser.isImpersonating ? `
            <div class="impersonation-banner">
                <span>👤 Impersonating: ${req.currentUser.impersonatedUser?.displayName} (${req.currentUser.impersonatedUser?.email})</span>
                <a href="/admin/impersonate/stop">Stop Impersonating</a>
            </div>
            ` : ''}
            <div class="header">
                <h1>Operational Excellence Dashboard</h1>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <a href="/notifications" class="notification-bell" id="notificationBell">
                        🔔
                        <span class="notification-badge" id="notificationCount" style="display: none;">0</span>
                    </a>
                    ${req.currentUser.hasRole('System Administrator') ? '<a href="/admin" style="background:#1a1a2e;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">⚙️ Admin Panel</a>' : ''}
                    <a href="/auth/logout" class="logout-btn">Logout</a>
                </div>
            </div>
            <div class="content">
                <div class="user-card">
                    <p><strong>Welcome:</strong> ${req.currentUser.displayName}</p>
                    <p><strong>Email:</strong> ${req.currentUser.email}</p>
                    <p><strong>Role:</strong> ${req.currentUser.role}</p>
                </div>
                
                <!-- Broadcasts Panel -->
                <div id="broadcastPanel" style="display:none;"></div>
                
                <h2>Departments</h2>
                <div class="menu-grid">
                    ${menuHtml || '<div class="no-access">No departments assigned. Please contact your administrator.</div>'}
                </div>
            </div>
            
            <script>
                // Toggle category collapse/expand
                function toggleCategory(index) {
                    const items = document.getElementById('items-' + index);
                    const toggle = document.getElementById('toggle-' + index);
                    
                    if (items.style.display === 'none') {
                        items.style.display = 'grid';
                        toggle.classList.remove('collapsed');
                        localStorage.setItem('cat-' + index, 'open');
                    } else {
                        items.style.display = 'none';
                        toggle.classList.add('collapsed');
                        localStorage.setItem('cat-' + index, 'closed');
                    }
                }
                
                // Restore collapsed state from localStorage
                function restoreCollapseState() {
                    const categories = document.querySelectorAll('.category-section');
                    categories.forEach((cat, index) => {
                        const state = localStorage.getItem('cat-' + index);
                        if (state === 'closed') {
                            const items = document.getElementById('items-' + index);
                            const toggle = document.getElementById('toggle-' + index);
                            if (items && toggle) {
                                items.style.display = 'none';
                                toggle.classList.add('collapsed');
                            }
                        }
                    });
                }
                
                // Restore state on page load
                restoreCollapseState();
                
                // Load notification count
                async function loadNotificationCount() {
                    try {
                        const res = await fetch('/notifications/count');
                        const data = await res.json();
                        const badge = document.getElementById('notificationCount');
                        if (data.count > 0) {
                            badge.textContent = data.count > 99 ? '99+' : data.count;
                            badge.style.display = 'block';
                        } else {
                            badge.style.display = 'none';
                        }
                    } catch (err) {
                        console.error('Error loading notifications:', err);
                    }
                }
                
                // Load broadcasts
                async function loadBroadcasts() {
                    try {
                        const res = await fetch('/admin/api/broadcasts/my');
                        const data = await res.json();
                        const panel = document.getElementById('broadcastPanel');
                        
                        if (data.success && data.data && data.data.length > 0) {
                            const unread = data.data.filter(b => !b.IsRead);
                            if (unread.length > 0) {
                                const hasHigh = unread.some(b => b.Priority === 'High');
                                panel.className = 'broadcast-panel' + (hasHigh ? ' high-priority' : '');
                                panel.innerHTML = \`
                                    <div class="broadcast-header">
                                        <div class="broadcast-title">📢 Announcements (\${unread.length})</div>
                                    </div>
                                    \${unread.map(b => \`
                                        <div class="broadcast-item" id="broadcast-\${b.Id}">
                                            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                                                <div class="broadcast-item-title">\${b.Title}</div>
                                                <button class="broadcast-dismiss" onclick="dismissBroadcast(\${b.Id})" title="Mark as read">✕</button>
                                            </div>
                                            <div class="broadcast-item-message">\${b.Message}</div>
                                            <div class="broadcast-item-meta">
                                                From: \${b.SentBy} • \${new Date(b.CreatedAt).toLocaleString()}
                                                \${b.Priority === 'High' ? ' • <span style="color:#dc3545;font-weight:600;">⚠️ URGENT</span>' : ''}
                                            </div>
                                        </div>
                                    \`).join('')}
                                \`;
                                panel.style.display = 'block';
                            }
                        }
                    } catch (err) {
                        console.error('Error loading broadcasts:', err);
                    }
                }
                
                async function dismissBroadcast(id) {
                    try {
                        await fetch('/admin/api/broadcasts/' + id + '/read', { method: 'POST' });
                        const item = document.getElementById('broadcast-' + id);
                        if (item) item.remove();
                        
                        // Check if any broadcasts left
                        const panel = document.getElementById('broadcastPanel');
                        if (!panel.querySelector('.broadcast-item')) {
                            panel.style.display = 'none';
                        }
                    } catch (err) {
                        console.error('Error dismissing broadcast:', err);
                    }
                }
                
                // Load on page load
                loadNotificationCount();
                loadBroadcasts();
                
                // Refresh every 60 seconds
                setInterval(loadNotificationCount, 60000);
                setInterval(loadBroadcasts, 120000);
            </script>
        </body>
        </html>
    `);
});

// API endpoints
app.get('/api/user', requireAuth, (req, res) => {
    res.json({ 
        success: true,
        user: {
            displayName: req.currentUser.displayName,
            email: req.currentUser.email,
            role: req.currentUser.role
        }
    });
});

// User search API for email forms - uses dbConfig from top of file

app.get('/api/users/search', requireAuth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ success: true, users: [] });
        }
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('search', sql.NVarChar, `%${q}%`)
            .query(`
                SELECT TOP 20 Id, Email, DisplayName as name
                FROM Users 
                WHERE IsActive = 1 
                  AND IsApproved = 1
                  AND (DisplayName LIKE @search OR Email LIKE @search)
                ORDER BY DisplayName
            `);
        
        await pool.close();
        
        res.json({ 
            success: true, 
            users: result.recordset.map(u => ({
                id: u.Id,
                email: u.Email,
                name: u.name || u.Email
            }))
        });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        app: process.env.APP_NAME,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// Start Server
// ==========================================

const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

const USE_HTTPS = SSL_KEY_PATH && SSL_CERT_PATH && 
                  fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);

if (USE_HTTPS) {
    const httpsOptions = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH)
    };
    
    if (process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH)) {
        httpsOptions.ca = fs.readFileSync(process.env.SSL_CA_PATH);
    }
    
    https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log('='.repeat(60));
        console.log(`🚀 ${process.env.APP_NAME} (HTTPS)`);
        console.log('='.repeat(60));
        console.log(`✅ Server running on ${APP_URL}`);
        console.log(`🔒 SSL Certificate: ${SSL_CERT_PATH}`);
        console.log('='.repeat(60));
        
        // Start escalation scheduler
        startEscalationScheduler();
    });
} else {
    http.createServer(app).listen(PORT, () => {
        console.log('='.repeat(60));
        console.log(`🚀 ${process.env.APP_NAME} (HTTP)`);
        console.log('='.repeat(60));
        console.log(`✅ Server running on ${APP_URL}`);
        console.log('⚠️  Running in HTTP mode (behind IIS reverse proxy)');
        if (SSL_KEY_PATH) console.log(`   Key path: ${SSL_KEY_PATH} (exists: ${fs.existsSync(SSL_KEY_PATH)})`);
        if (SSL_CERT_PATH) console.log(`   Cert path: ${SSL_CERT_PATH} (exists: ${fs.existsSync(SSL_CERT_PATH)})`);
        console.log('='.repeat(60));
        
        // Start escalation scheduler
        startEscalationScheduler();
    });
}

// ==========================================
// Escalation Scheduler
// ==========================================
function startEscalationScheduler() {
    console.log('[Escalation Scheduler] Starting action plan escalation scheduler...');
    
    // Run immediately on startup
    setTimeout(async () => {
        try {
            await actionPlanEscalation.sendDeadlineReminders();
            await actionPlanEscalation.checkOverdueActionPlans();
        } catch (err) {
            console.error('[Escalation Scheduler] Initial run error:', err.message);
        }
    }, 10000); // Wait 10 seconds after startup
    
    // Run every hour
    setInterval(async () => {
        try {
            console.log('[Escalation Scheduler] Running scheduled escalation check...');
            await actionPlanEscalation.sendDeadlineReminders();
            await actionPlanEscalation.checkOverdueActionPlans();
        } catch (err) {
            console.error('[Escalation Scheduler] Scheduled run error:', err.message);
        }
    }, 60 * 60 * 1000); // Every hour
}

module.exports = app;
