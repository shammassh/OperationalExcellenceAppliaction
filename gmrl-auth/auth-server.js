/**
 * Authentication Server Module
 * Main server that wires together all authentication components
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import authentication modules
const LoginPage = require('./pages/login');
const PendingApprovalPage = require('./pages/pending-approval');
const OAuthCallbackHandler = require('./services/oauth-callback-handler');
const LogoutHandler = require('./services/logout-handler');
const SessionManager = require('./services/session-manager');
const requireAuth = require('./middleware/require-auth');
const requireRole = require('./middleware/require-role');

// Import admin modules
const UserManagementPage = require('../admin/pages/user-management');
const GraphUsersService = require('../admin/services/graph-users-service');
const RoleAssignmentService = require('../admin/services/role-assignment-service');

// Import auditor modules
const AuditorSelectionPage = require('../auditor/pages/selection-page');
const StoresService = require('../auditor/services/stores-service');
const ChecklistsService = require('../auditor/services/checklists-service');

// Import notification modules
const NotificationHistoryService = require('../services/notification-history-service');

class AuthServer {
    constructor(app) {
        this.app = app;
        this.oauthHandler = new OAuthCallbackHandler();
        this.logoutHandler = new LogoutHandler();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSessionCleanup();
    }
    
    /**
     * Setup middleware
     */
    setupMiddleware() {
        // Cookie parser for session tokens
        this.app.use(cookieParser());
        
        // Serve static files (CSS, JS)
        this.app.use('/auth/styles', express.static(path.join(__dirname, 'styles')));
        this.app.use('/auth/scripts', express.static(path.join(__dirname, 'scripts')));
        this.app.use('/admin/styles', express.static(path.join(__dirname, '../admin/styles')));
        this.app.use('/admin/scripts', express.static(path.join(__dirname, '../admin/scripts')));
        this.app.use('/auditor/styles', express.static(path.join(__dirname, '../auditor/styles')));
        this.app.use('/auditor/scripts', express.static(path.join(__dirname, '../auditor/scripts')));
        
        console.log('[AUTH] Middleware configured');
    }
    
    /**
     * Setup authentication routes
     */
    setupRoutes() {
        // ==========================================
        // Public Routes (no authentication required)
        // ==========================================
        
        // Login page
        this.app.get('/auth/login', (req, res) => {
            LoginPage.render(req, res);
        });
        
        // Login configuration endpoint (for client-side auth URL building)
        this.app.get('/auth/config', (req, res) => {
            const config = LoginPage.getConfig();
            res.json(config);
        });
        
        // OAuth callback handler
        this.app.get('/auth/callback', async (req, res) => {
            await this.oauthHandler.handleCallback(req, res);
        });
        
        // ==========================================
        // Protected Routes (authentication required)
        // ==========================================
        
        // Logout
        this.app.get('/auth/logout', requireAuth, async (req, res) => {
            await this.logoutHandler.handleLogout(req, res);
        });
        
        // Pending approval page (for users with 'Pending' role)
        this.app.get('/auth/pending', requireAuth, (req, res) => {
            // Only show to users with Pending role
            if (req.currentUser.role !== 'Pending') {
                return res.redirect('/dashboard');
            }
            PendingApprovalPage.render(req, res);
        });
        
        // Session info endpoint (for debugging)
        this.app.get('/auth/session', requireAuth, (req, res) => {
            res.json({
                user: {
                    id: req.currentUser.id,
                    email: req.currentUser.email,
                    displayName: req.currentUser.displayName,
                    role: req.currentUser.role,
                    assignedStores: req.currentUser.assignedStores,
                    assignedDepartment: req.currentUser.assignedDepartment,
                    department: req.currentUser.department,
                    isActive: req.currentUser.isActive,
                    isApproved: req.currentUser.isApproved
                },
                session: {
                    createdAt: req.currentUser.sessionCreatedAt,
                    expiresAt: req.currentUser.sessionExpiresAt,
                    lastActivity: req.currentUser.sessionLastActivity
                }
            });
        });
        
        // ==========================================
        // Admin-only Routes
        // ==========================================
        
        // Admin user management page
        this.app.get('/admin/users', requireAuth, requireRole('Admin'), (req, res) => {
            UserManagementPage.render(req, res);
        });
        
        // Alias: /admin/user-management -> /admin/users
        this.app.get('/admin/user-management', requireAuth, requireRole('Admin'), (req, res) => {
            res.redirect('/admin/users');
        });

        // Admin notification history page (Admin & Auditor)
        this.app.get('/admin/notification-history', requireAuth, requireRole('Admin', 'Auditor'), (req, res) => {
            try {
                const filePath = path.join(__dirname, '../admin/pages/notification-history.html');
                console.log(`📧 Serving notification history page: ${filePath}`);
                res.sendFile(filePath, (err) => {
                    if (err) {
                        console.error('❌ Error serving notification history page:', err);
                        res.status(404).send(`
                            <html>
                                <head><title>Page Not Found</title></head>
                                <body style="font-family: Arial; padding: 50px; text-align: center;">
                                    <h1>🔍 Page Not Found</h1>
                                    <p>The notification history page could not be loaded.</p>
                                    <p>File path: ${filePath}</p>
                                    <p><a href="/dashboard">← Back to Dashboard</a></p>
                                </body>
                            </html>
                        `);
                    }
                });
            } catch (error) {
                console.error('❌ Error in notification history route:', error);
                res.status(500).send('Internal server error');
            }
        });

        // ==========================================
        // Notification History API Routes (Admin & Auditor)
        // ==========================================

        // API: Get notifications with filtering and pagination
        this.app.get('/api/notifications', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                const { status, dateFrom, dateTo, recipient, documentNumber, sentBy, page, pageSize, sortBy, sortOrder } = req.query;

                console.log(`📋 [API] Fetching notification history (User: ${req.currentUser.email})`);

                const sql = require('mssql');
                const config = require('../config/default');
                const pool = await sql.connect(config.database);
                
                const notificationService = new NotificationHistoryService();

                const filters = {
                    status,
                    dateFrom,
                    dateTo,
                    recipient,
                    documentNumber,
                    sentBy
                };

                const options = {
                    page: page ? parseInt(page) : 1,
                    pageSize: pageSize ? parseInt(pageSize) : 50,
                    sortBy,
                    sortOrder
                };

                const result = await notificationService.getNotifications(pool, filters, options);

                console.log(`✅ [API] Retrieved ${result.notifications.length} notifications (Total: ${result.total})`);

                res.json({
                    success: true,
                    data: result.notifications,
                    pagination: {
                        page: result.page,
                        pageSize: result.pageSize,
                        total: result.total,
                        totalPages: result.totalPages
                    }
                });

            } catch (error) {
                console.error('❌ [API] Error fetching notifications:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch notification history',
                    error: error.message
                });
            }
        });

        // API: Get notification statistics
        this.app.get('/api/notifications/statistics', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                console.log(`📊 [API] Fetching notification statistics (User: ${req.currentUser.email})`);

                const sql = require('mssql');
                const config = require('../config/default');
                const pool = await sql.connect(config.database);
                
                const notificationService = new NotificationHistoryService();

                const stats = await notificationService.getStatistics(pool);

                console.log(`✅ [API] Retrieved statistics: ${stats.total} total notifications`);

                res.json({
                    success: true,
                    data: stats
                });

            } catch (error) {
                console.error('❌ [API] Error fetching statistics:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch statistics',
                    error: error.message
                });
            }
        });

        // API: Get recent notifications (last 24 hours)
        this.app.get('/api/notifications/recent', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                const limit = req.query.limit ? parseInt(req.query.limit) : 10;

                console.log(`🕐 [API] Fetching ${limit} recent notifications (User: ${req.currentUser.email})`);

                const sql = require('mssql');
                const config = require('../config/default');
                const pool = await sql.connect(config.database);
                
                const notificationService = new NotificationHistoryService();

                const notifications = await notificationService.getRecentNotifications(pool, limit);

                console.log(`✅ [API] Retrieved ${notifications.length} recent notifications`);

                res.json({
                    success: true,
                    data: notifications
                });

            } catch (error) {
                console.error('❌ [API] Error fetching recent notifications:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch recent notifications',
                    error: error.message
                });
            }
        });

        // API: Mark notification as read
        this.app.patch('/api/notifications/:id/read', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                const notificationId = parseInt(req.params.id);

                console.log(`✅ [API] Marking notification ${notificationId} as read (User: ${req.currentUser.email})`);

                const sql = require('mssql');
                const config = require('../config/default');
                const pool = await sql.connect(config.database);
                
                const notificationService = new NotificationHistoryService();

                await notificationService.markAsRead(pool, notificationId);

                res.json({
                    success: true,
                    message: 'Notification marked as read'
                });

            } catch (error) {
                console.error('❌ [API] Error marking notification as read:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to mark notification as read',
                    error: error.message
                });
            }
        });
        
        // API: Get all users
        this.app.get('/api/admin/users', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const users = await RoleAssignmentService.getAllUsers();
                res.json({ users });
            } catch (error) {
                console.error('[API] Error fetching users:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Update user
        this.app.patch('/api/admin/users/:userId', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const userId = parseInt(req.params.userId);
                const updateData = req.body;
                
                const updatedUser = await RoleAssignmentService.updateUser(userId, updateData);
                
                // Log action
                await RoleAssignmentService.logAction(
                    req.currentUser.id,
                    'UPDATE_USER',
                    { targetUserId: userId, changes: updateData }
                );
                
                res.json({ user: updatedUser });
            } catch (error) {
                console.error('[API] Error updating user:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Update user status (active/inactive)
        this.app.patch('/api/admin/users/:userId/status', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const userId = parseInt(req.params.userId);
                const { is_active } = req.body;
                
                const updatedUser = await RoleAssignmentService.updateUserStatus(userId, is_active);
                
                // Log action
                await RoleAssignmentService.logAction(
                    req.currentUser.id,
                    is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
                    { targetUserId: userId }
                );
                
                res.json({ user: updatedUser });
            } catch (error) {
                console.error('[API] Error updating user status:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Sync users from Microsoft Graph
        this.app.post('/api/admin/sync-graph', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const graphService = new GraphUsersService();
                const graphUsers = await graphService.getAllUsers();
                
                const result = await RoleAssignmentService.syncUsersFromGraph(graphUsers);
                
                // Log action
                await RoleAssignmentService.logAction(
                    req.currentUser.id,
                    'SYNC_GRAPH_USERS',
                    { newUsers: result.newUsers, updatedUsers: result.updatedUsers }
                );
                
                res.json(result);
            } catch (error) {
                console.error('[API] Error syncing from Graph:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Get stores list (active only)
        this.app.get('/api/admin/stores', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const stores = await RoleAssignmentService.getStoresList();
                res.json({ stores });
            } catch (error) {
                console.error('[API] Error fetching stores:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Get all stores (including inactive) - for management
        this.app.get('/api/admin/stores/all', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const stores = await RoleAssignmentService.getAllStores();
                res.json({ stores });
            } catch (error) {
                console.error('[API] Error fetching all stores:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Create new store
        this.app.post('/api/admin/stores', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const { store_code, store_name, location } = req.body;
                const createdBy = req.currentUser.email;
                
                const newStore = await RoleAssignmentService.createStore({
                    store_code,
                    store_name,
                    location
                }, createdBy);
                
                await RoleAssignmentService.logAction(
                    req.currentUser.id,
                    req.currentUser.email,
                    'CREATE_STORE',
                    'Store',
                    newStore.id.toString(),
                    `Created store: ${store_name}`
                );
                
                res.json({ store: newStore });
            } catch (error) {
                console.error('[API] Error creating store:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Update store
        this.app.patch('/api/admin/stores/:storeId', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const { storeId } = req.params;
                const { store_code, store_name, location } = req.body;
                
                const updatedStore = await RoleAssignmentService.updateStore(parseInt(storeId), {
                    store_code,
                    store_name,
                    location
                });
                
                await RoleAssignmentService.logAction(
                    req.currentUser.id,
                    req.currentUser.email,
                    'UPDATE_STORE',
                    'Store',
                    storeId,
                    `Updated store: ${store_name}`
                );
                
                res.json({ store: updatedStore });
            } catch (error) {
                console.error('[API] Error updating store:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Toggle store status
        this.app.patch('/api/admin/stores/:storeId/status', requireAuth, requireRole('Admin'), async (req, res) => {
            try {
                const { storeId } = req.params;
                const { is_active } = req.body;
                
                const updatedStore = await RoleAssignmentService.toggleStoreStatus(parseInt(storeId), is_active);
                
                await RoleAssignmentService.logAction(
                    req.currentUser.id,
                    req.currentUser.email,
                    'TOGGLE_STORE_STATUS',
                    'Store',
                    storeId,
                    `Set store ${updatedStore.store_name} to ${is_active ? 'active' : 'inactive'}`
                );
                
                res.json({ store: updatedStore });
            } catch (error) {
                console.error('[API] Error toggling store status:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Store Management Page
        this.app.get('/admin/stores', requireAuth, requireRole('Admin'), (req, res) => {
            const StoresManagementPage = require('../admin/pages/stores-management');
            StoresManagementPage.render(req, res);
        });
        
        // ==========================================
        // Auditor Routes
        // ==========================================
        
        // Auditor selection page
        this.app.get('/auditor/select', requireAuth, requireRole('Admin', 'Auditor'), (req, res) => {
            AuditorSelectionPage.render(req, res);
        });
        
        // API: Get stores list for auditors
        this.app.get('/api/auditor/stores', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                const storesService = new StoresService();
                const stores = await storesService.getStoresList();
                res.json({ stores });
            } catch (error) {
                console.error('[API] Error fetching stores:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Get checklists list
        this.app.get('/api/auditor/checklists', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                const checklistsService = new ChecklistsService();
                const checklists = await checklistsService.getChecklistsList();
                res.json({ checklists });
            } catch (error) {
                console.error('[API] Error fetching checklists:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Get recent audits
        this.app.get('/api/auditor/recent-audits', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                // TODO: Implement fetching recent audits from FS Survey list
                // For now, return empty array
                res.json({ audits: [] });
            } catch (error) {
                console.error('[API] Error fetching recent audits:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Get auditor statistics
        this.app.get('/api/auditor/statistics', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                // TODO: Calculate statistics from FS Survey list
                // For now, return placeholder data
                res.json({
                    totalAudits: 0,
                    completedAudits: 0,
                    avgScore: 0,
                    totalStores: 0
                });
            } catch (error) {
                console.error('[API] Error fetching statistics:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Start new audit
        this.app.post('/api/auditor/start-audit', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
            try {
                const { store, checklistId, checklistName, auditDate, auditTime, notes } = req.body;
                
                // TODO: Create new audit document in FS Survey
                // TODO: Initialize response lists for each section
                // For now, return placeholder
                
                const documentNumber = `AUDIT-${Date.now()}`;
                
                console.log(`[AUDIT] Starting new audit: ${documentNumber} for ${store}`);
                
                res.json({
                    success: true,
                    documentNumber: documentNumber,
                    message: 'Audit started successfully'
                });
                
            } catch (error) {
                console.error('[API] Error starting audit:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        console.log('[AUTH] Routes configured');
    }
    
    /**
     * Setup periodic session cleanup
     * Runs every hour to remove expired sessions
     */
    setupSessionCleanup() {
        // Clean up immediately on start
        SessionManager.cleanupExpiredSessions();
        
        // Then every hour
        setInterval(() => {
            SessionManager.cleanupExpiredSessions();
        }, 60 * 60 * 1000); // 1 hour
        
        console.log('[AUTH] Session cleanup configured (runs every hour)');
    }
    
    /**
     * Get authentication middleware (for protecting other routes)
     */
    getAuthMiddleware() {
        return requireAuth;
    }
    
    /**
     * Get role middleware (for protecting other routes)
     */
    getRoleMiddleware() {
        return requireRole;
    }
}

/**
 * Initialize authentication system
 */
function initializeAuth(app) {
    const authServer = new AuthServer(app);
    
    console.log('[AUTH] ✅ Authentication system initialized');
    console.log('[AUTH] Available routes:');
    console.log('[AUTH]   - GET  /auth/login              (public)');
    console.log('[AUTH]   - GET  /auth/config             (public)');
    console.log('[AUTH]   - GET  /auth/callback           (public)');
    console.log('[AUTH]   - GET  /auth/logout             (protected)');
    console.log('[AUTH]   - GET  /auth/pending            (protected)');
    console.log('[AUTH]   - GET  /auth/session            (protected)');
    console.log('[AUTH]   - GET  /admin/users             (admin only)');
    console.log('[AUTH]   - GET  /api/admin/users         (admin only)');
    console.log('[AUTH]   - PATCH /api/admin/users/:id    (admin only)');
    console.log('[AUTH]   - PATCH /api/admin/users/:id/status (admin only)');
    console.log('[AUTH]   - POST /api/admin/sync-graph    (admin only)');
    console.log('[AUTH]   - GET  /api/admin/stores        (admin only)');
    console.log('[AUTH]   - GET  /auditor/select          (admin/auditor)');
    console.log('[AUTH]   - GET  /api/auditor/stores      (admin/auditor)');
    console.log('[AUTH]   - GET  /api/auditor/checklists  (admin/auditor)');
    console.log('[AUTH]   - GET  /api/auditor/recent-audits (admin/auditor)');
    console.log('[AUTH]   - GET  /api/auditor/statistics  (admin/auditor)');
    console.log('[AUTH]   - POST /api/auditor/start-audit (admin/auditor)');
    
    return authServer;
}

module.exports = { AuthServer, initializeAuth, requireAuth, requireRole };
