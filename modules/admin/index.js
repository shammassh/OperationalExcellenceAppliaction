const express = require('express');
const router = express.Router();
const sql = require('mssql');
const ExcelJS = require('exceljs');
const config = require('../../config/default');
const SharePointUsersService = require('../../gmrl-auth/admin/services/sharepoint-users-service');
const escalationService = require('../../services/action-plan-escalation');
const fiveDaysReminderService = require('../../services/five-days-reminder-service');
const departmentEscalationService = require('../../services/department-escalation-service');

const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

// Check if user is System Administrator OR has form-based permission
const requireSysAdmin = async (req, res, next) => {
    const currentPath = req.originalUrl.split('?')[0].replace(/\/$/, '');
    console.log(`[ADMIN] Checking access for ${currentPath}, roleId: ${req.currentUser?.roleId}, roleNames: ${JSON.stringify(req.currentUser?.roleNames)}`);
    
    // System Administrator (roleId 31) has full access to all admin pages
    if (req.currentUser && req.currentUser.roleId === 31) {
        console.log(`[ADMIN] Access granted via roleId 31`);
        return next();
    }
    
    // Also check roleNames array for System Administrator
    if (req.currentUser && req.currentUser.roleNames && req.currentUser.roleNames.includes('System Administrator')) {
        console.log(`[ADMIN] Access granted via roleNames includes System Administrator`);
        return next();
    }
    
    // Check for dynamic form-based permission
    // Map URL to FormCode
    const urlToFormCode = {
        '/admin': 'ADMIN_DASHBOARD',
        '/admin/users': 'ADMIN_USERS',
        '/admin/roles': 'ADMIN_ROLES',
        '/admin/forms': 'ADMIN_FORMS',
        '/admin/stores': 'ADMIN_STORES',
        '/admin/impersonate': 'ADMIN_IMPERSONATE',
        '/admin/sessions': 'ADMIN_SESSIONS',
        '/admin/notification-history': 'ADMIN_NOTIFICATIONS',
        '/admin/email-templates': 'ADMIN_EMAIL_TEMPLATES',
        '/admin/job-monitor': 'ADMIN_JOB_MONITOR',
        '/admin/org-tree': 'ADMIN_ORG_TREE',
        '/admin/dashboard-menu': 'ADMIN_DASHBOARD_MENU',
        '/admin/permission-sync': 'ADMIN_PERMISSION_SYNC'
    };
    
    // Find matching form code (currentPath already declared above)
    let formCode = null;
    
    // Check for exact match first
    if (urlToFormCode[currentPath]) {
        formCode = urlToFormCode[currentPath];
    } else {
        // Check for prefix match (e.g., /admin/users/123 -> ADMIN_USERS)
        for (const [path, code] of Object.entries(urlToFormCode)) {
            if (currentPath.startsWith(path + '/') || currentPath === path) {
                formCode = code;
                break;
            }
        }
    }
    
    if (formCode && req.currentUser && req.currentUser.permissions) {
        const permission = req.currentUser.permissions[formCode];
        if (permission && permission.canView) {
            return next();
        }
    }
    
    // No access
    res.status(403).send(`
        <script>
            alert('Access Denied. You do not have permission to access this page.');
            window.location.href = '/dashboard';
        </script>
    `);
};

// Apply sysadmin check to all routes
router.use(requireSysAdmin);

// ============================================================================
// JOB MONITOR API ROUTES
// ============================================================================

// Get scheduler status
router.get('/api/job-monitor', async (req, res) => {
    try {
        const status = escalationService.getSchedulerStatus();
        const stats = await escalationService.getEscalationStats();
        
        res.json({
            success: true,
            scheduler: status,
            escalationStats: stats
        });
    } catch (err) {
        console.error('Error getting job monitor status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Manually trigger a run
router.post('/api/job-monitor/run-now', async (req, res) => {
    try {
        const status = escalationService.getSchedulerStatus();
        
        if (status.isRunning) {
            return res.status(400).json({ 
                success: false, 
                error: 'A job is already running. Please wait for it to complete.' 
            });
        }
        
        // Run asynchronously
        escalationService.runAllInspectionChecks()
            .then(results => {
                console.log('[Job Monitor] Manual run completed:', results);
            })
            .catch(err => {
                console.error('[Job Monitor] Manual run failed:', err);
            });
        
        res.json({ 
            success: true, 
            message: 'Job started successfully. Refresh to see results.' 
        });
    } catch (err) {
        console.error('Error triggering manual run:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start the scheduler
router.post('/api/job-monitor/start-scheduler', async (req, res) => {
    try {
        const status = escalationService.getSchedulerStatus();
        
        if (status.schedulerRunning) {
            return res.json({ 
                success: true, 
                message: 'Scheduler is already running.' 
            });
        }
        
        escalationService.startScheduler();
        
        res.json({ 
            success: true, 
            message: 'Scheduler started successfully.' 
        });
    } catch (err) {
        console.error('Error starting scheduler:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Stop the scheduler
router.post('/api/job-monitor/stop-scheduler', async (req, res) => {
    try {
        escalationService.stopScheduler();
        
        res.json({ 
            success: true, 
            message: 'Scheduler stopped successfully.' 
        });
    } catch (err) {
        console.error('Error stopping scheduler:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 5 DAYS REMINDER API ROUTES
// ============================================================================

// Get 5 Days reminder status
router.get('/api/job-monitor/five-days/status', async (req, res) => {
    try {
        const status = fiveDaysReminderService.getSchedulerStatus();
        res.json({ success: true, ...status });
    } catch (err) {
        console.error('Error getting 5 Days status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Run 5 Days reminders now
router.post('/api/job-monitor/five-days/run-now', async (req, res) => {
    try {
        const status = fiveDaysReminderService.getSchedulerStatus();
        
        if (status.isRunning) {
            return res.status(400).json({ 
                success: false, 
                error: '5 Days job is already running. Please wait for it to complete.' 
            });
        }
        
        // Run asynchronously
        fiveDaysReminderService.runFiveDaysReminders()
            .then(results => {
                console.log('[5 Days Job] Manual run completed:', results);
            })
            .catch(err => {
                console.error('[5 Days Job] Manual run failed:', err);
            });
        
        res.json({ 
            success: true, 
            message: '5 Days reminder job started. Refresh to see results.' 
        });
    } catch (err) {
        console.error('Error triggering 5 Days run:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Dry run 5 Days - preview what would be sent
router.get('/api/job-monitor/five-days/dry-run', async (req, res) => {
    try {
        const preview = await fiveDaysReminderService.getDryRunPreview();
        res.json({ success: true, ...preview });
    } catch (err) {
        console.error('Error getting 5 Days dry run:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get 5 Days cycle info
router.get('/api/job-monitor/five-days/cycle-info', async (req, res) => {
    try {
        const cycleInfo = fiveDaysReminderService.getCurrentCycleInfo();
        const reminderType = fiveDaysReminderService.getReminderType(cycleInfo);
        res.json({ success: true, cycleInfo, reminderType });
    } catch (err) {
        console.error('Error getting cycle info:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get 5 Days settings
router.get('/api/job-monitor/five-days/settings', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT SettingKey, SettingValue, Description 
            FROM FiveDaysSettings
            ORDER BY SettingKey
        `);
        res.json({ success: true, settings: result.recordset });
    } catch (err) {
        // Table might not exist yet
        res.json({ success: true, settings: [] });
    } finally {
        if (pool) await pool.close();
    }
});

// Update 5 Days setting
router.put('/api/job-monitor/five-days/settings/:key', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const { value } = req.body;
        
        await pool.request()
            .input('key', sql.NVarChar, req.params.key)
            .input('value', sql.NVarChar, value)
            .input('updatedBy', sql.Int, req.currentUser?.userId || 1)
            .query(`
                UPDATE FiveDaysSettings 
                SET SettingValue = @value, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
                WHERE SettingKey = @key
            `);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating 5 Days setting:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Get 5 Days reminder history
router.get('/api/job-monitor/five-days/history', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT TOP 100
                l.Id, l.CycleKey, l.ReminderType, l.RecipientEmail, l.SentAt,
                s.StoreName
            FROM FiveDaysReminderLog l
            LEFT JOIN Stores s ON l.StoreId = s.Id
            ORDER BY l.SentAt DESC
        `);
        res.json({ success: true, history: result.recordset });
    } catch (err) {
        // Table might not exist yet
        res.json({ success: true, history: [] });
    } finally {
        if (pool) await pool.close();
    }
});

// Get active or latest cycle data (for step tracker)
router.get('/api/job-monitor/five-days/active-cycle', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get the most recent cycle that has data
        const latestCycleResult = await pool.request().query(`
            SELECT TOP 1 CycleKey, MAX(SentAt) as LastSentAt
            FROM FiveDaysReminderLog
            GROUP BY CycleKey
            ORDER BY MAX(SentAt) DESC
        `);
        
        const cycleKey = latestCycleResult.recordset[0]?.CycleKey || null;
        
        if (!cycleKey) {
            return res.json({ success: true, cycleKey: null, sentSteps: [], message: 'No cycle data found' });
        }
        
        // Get all reminder types sent for this cycle
        const sentStepsResult = await pool.request()
            .input('cycleKey', sql.NVarChar, cycleKey)
            .query(`
                SELECT DISTINCT ReminderType, MIN(SentAt) as FirstSentAt, COUNT(*) as StoreCount
                FROM FiveDaysReminderLog
                WHERE CycleKey = @cycleKey
                GROUP BY ReminderType
                ORDER BY MIN(SentAt)
            `);
        
        // Get summary by reminder type
        const summaryResult = await pool.request()
            .input('cycleKey', sql.NVarChar, cycleKey)
            .query(`
                SELECT 
                    ReminderType,
                    COUNT(*) as EmailCount,
                    COUNT(DISTINCT StoreId) as StoreCount,
                    MAX(SentAt) as LastSentAt
                FROM FiveDaysReminderLog
                WHERE CycleKey = @cycleKey
                GROUP BY ReminderType
            `);
        
        res.json({ 
            success: true, 
            cycleKey: cycleKey,
            sentSteps: sentStepsResult.recordset.map(r => r.ReminderType),
            summary: summaryResult.recordset
        });
    } catch (err) {
        console.error('Error getting active cycle:', err);
        res.json({ success: true, cycleKey: null, sentSteps: [] });
    } finally {
        if (pool) await pool.close();
    }
});

// ============================================================================
// DEPARTMENT ESCALATION API ROUTES
// ============================================================================

// Get department escalation stats
router.get('/api/job-monitor/department-escalations', async (req, res) => {
    try {
        const stats = await departmentEscalationService.getDepartmentEscalationStats();
        const serviceStatus = departmentEscalationService.getServiceStatus();
        
        res.json({
            success: true,
            stats: stats,
            serviceStatus: serviceStatus
        });
    } catch (err) {
        console.error('Error getting department escalation stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get pending department escalations list
router.get('/api/job-monitor/department-escalations/pending', async (req, res) => {
    try {
        const { module, limit } = req.query;
        const escalations = await departmentEscalationService.getPendingDepartmentEscalations(
            module || null,
            parseInt(limit) || 50
        );
        
        res.json({
            success: true,
            data: escalations
        });
    } catch (err) {
        console.error('Error getting pending department escalations:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Run department escalation check now
router.post('/api/job-monitor/department-escalations/run-now', async (req, res) => {
    try {
        const result = await departmentEscalationService.checkDepartmentEscalations();
        
        res.json({
            success: true,
            message: 'Department escalation check completed',
            result: result
        });
    } catch (err) {
        console.error('Error running department escalation check:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get department contacts
router.get('/api/job-monitor/department-contacts', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT * FROM DepartmentContacts
            WHERE IsActive = 1
            ORDER BY DepartmentName, SortOrder
        `);
        
        res.json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Error getting department contacts:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Update department contact
router.put('/api/job-monitor/department-contacts/:id', async (req, res) => {
    let pool;
    try {
        const { id } = req.params;
        const { contactEmail, contactName, contactRole, receiveOverdueAlerts, receiveEscalationAlerts, isActive } = req.body;
        
        pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('contactEmail', sql.NVarChar, contactEmail)
            .input('contactName', sql.NVarChar, contactName)
            .input('contactRole', sql.NVarChar, contactRole)
            .input('receiveOverdueAlerts', sql.Bit, receiveOverdueAlerts ? 1 : 0)
            .input('receiveEscalationAlerts', sql.Bit, receiveEscalationAlerts ? 1 : 0)
            .input('isActive', sql.Bit, isActive !== false ? 1 : 0)
            .query(`
                UPDATE DepartmentContacts
                SET ContactEmail = @contactEmail,
                    ContactName = @contactName,
                    ContactRole = @contactRole,
                    ReceiveOverdueAlerts = @receiveOverdueAlerts,
                    ReceiveEscalationAlerts = @receiveEscalationAlerts,
                    IsActive = @isActive,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        
        res.json({ success: true, message: 'Contact updated' });
    } catch (err) {
        console.error('Error updating department contact:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Add new department contact
router.post('/api/job-monitor/department-contacts', async (req, res) => {
    let pool;
    try {
        const { departmentName, contactEmail, contactName, contactRole } = req.body;
        
        pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('departmentName', sql.NVarChar, departmentName)
            .input('contactEmail', sql.NVarChar, contactEmail)
            .input('contactName', sql.NVarChar, contactName)
            .input('contactRole', sql.NVarChar, contactRole)
            .query(`
                INSERT INTO DepartmentContacts (DepartmentName, ContactEmail, ContactName, ContactRole)
                VALUES (@departmentName, @contactEmail, @contactName, @contactRole)
            `);
        
        res.json({ success: true, message: 'Contact added' });
    } catch (err) {
        console.error('Error adding department contact:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Dry run all - preview all pending notifications
router.get('/api/job-monitor/dry-run-all', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Helper to get settings from key-value table
        const getSettings = async (tableName) => {
            const result = await pool.request().query(`SELECT SettingKey, SettingValue FROM ${tableName}`);
            const settings = {};
            result.recordset.forEach(r => { settings[r.SettingKey] = r.SettingValue; });
            return {
                reminderDays: parseInt(settings.ReminderDaysBefore?.split(',')[0]) || 3,
                overdueDays: 1
            };
        };
        
        const oeSettings = await getSettings('OE_EscalationSettings');
        const ohsSettings = await getSettings('OHS_EscalationSettings');
        
        const results = {
            oe: { reminders: [], overdue: [] },
            ohs: { reminders: [], overdue: [] }
        };
        
        // OE Reminders
        const oeReminders = await pool.request()
            .input('reminderDays', sql.Int, oeSettings.reminderDays)
            .query(`
                SELECT TOP 20
                    i.DocumentNumber, i.StoreName, i.ActionPlanDeadline,
                    DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) as DaysUntilDeadline,
                    ISNULL(u.Email, 'N/A') as RecipientEmail
                FROM OE_Inspections i
                LEFT JOIN StoreManagerAssignments sma ON sma.StoreId = i.StoreId AND sma.IsPrimary = 1
                LEFT JOIN Users u ON sma.UserId = u.Id
                WHERE i.ActionPlanDeadline IS NOT NULL
                  AND i.ActionPlanCompletedAt IS NULL
                  AND DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) BETWEEN 0 AND @reminderDays
                ORDER BY i.ActionPlanDeadline
            `);
        results.oe.reminders = oeReminders.recordset.map(r => ({
            documentNumber: r.DocumentNumber,
            storeName: r.StoreName,
            daysUntilDeadline: r.DaysUntilDeadline,
            recipientEmail: r.RecipientEmail
        }));
        
        // OE Overdue
        const oeOverdue = await pool.request()
            .query(`
                SELECT TOP 20
                    i.DocumentNumber, i.StoreName, i.ActionPlanDeadline,
                    DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) as DaysOverdue,
                    ISNULL(u.Email, 'N/A') as RecipientEmail
                FROM OE_Inspections i
                LEFT JOIN StoreManagerAssignments sma ON sma.StoreId = i.StoreId AND sma.IsPrimary = 1
                LEFT JOIN Users u ON sma.UserId = u.Id
                WHERE i.ActionPlanDeadline IS NOT NULL
                  AND i.ActionPlanCompletedAt IS NULL
                  AND i.ActionPlanDeadline < GETDATE()
                ORDER BY i.ActionPlanDeadline
            `);
        results.oe.overdue = oeOverdue.recordset.map(r => ({
            documentNumber: r.DocumentNumber,
            storeName: r.StoreName,
            daysOverdue: r.DaysOverdue,
            recipientEmail: r.RecipientEmail
        }));
        
        // OHS Reminders
        const ohsReminders = await pool.request()
            .input('reminderDays', sql.Int, ohsSettings.reminderDays)
            .query(`
                SELECT TOP 20
                    i.DocumentNumber, i.StoreName, i.ActionPlanDeadline,
                    DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) as DaysUntilDeadline,
                    ISNULL(u.Email, 'N/A') as RecipientEmail
                FROM OHS_Inspections i
                LEFT JOIN StoreManagerAssignments sma ON sma.StoreId = i.StoreId AND sma.IsPrimary = 1
                LEFT JOIN Users u ON sma.UserId = u.Id
                WHERE i.ActionPlanDeadline IS NOT NULL
                  AND i.ActionPlanCompletedAt IS NULL
                  AND DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) BETWEEN 0 AND @reminderDays
                ORDER BY i.ActionPlanDeadline
            `);
        results.ohs.reminders = ohsReminders.recordset.map(r => ({
            documentNumber: r.DocumentNumber,
            storeName: r.StoreName,
            daysUntilDeadline: r.DaysUntilDeadline,
            recipientEmail: r.RecipientEmail
        }));
        
        // OHS Overdue
        const ohsOverdue = await pool.request()
            .query(`
                SELECT TOP 20
                    i.DocumentNumber, i.StoreName, i.ActionPlanDeadline,
                    DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) as DaysOverdue,
                    ISNULL(u.Email, 'N/A') as RecipientEmail
                FROM OHS_Inspections i
                LEFT JOIN StoreManagerAssignments sma ON sma.StoreId = i.StoreId AND sma.IsPrimary = 1
                LEFT JOIN Users u ON sma.UserId = u.Id
                WHERE i.ActionPlanDeadline IS NOT NULL
                  AND i.ActionPlanCompletedAt IS NULL
                  AND i.ActionPlanDeadline < GETDATE()
                ORDER BY i.ActionPlanDeadline
            `);
        results.ohs.overdue = ohsOverdue.recordset.map(r => ({
            documentNumber: r.DocumentNumber,
            storeName: r.StoreName,
            daysOverdue: r.DaysOverdue,
            recipientEmail: r.RecipientEmail
        }));
        
        res.json({ success: true, results });
    } catch (err) {
        console.error('Error running dry-run-all:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Get email template preview for job monitor
router.get('/api/job-monitor/preview-template/:templateKey', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const { templateKey } = req.params;
        
        const result = await pool.request()
            .input('templateKey', sql.NVarChar, templateKey)
            .query(`
                SELECT TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate
                FROM EmailTemplates
                WHERE TemplateKey = @templateKey AND IsActive = 1
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        
        const template = result.recordset[0];
        
        // Sample data for preview
        const sampleData = {
            recipientName: 'John Smith',
            storeName: 'Spinneys Marina Mall',
            documentNumber: 'OE-2026-001',
            inspectionDate: new Date().toLocaleDateString(),
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            daysUntilDeadline: 3,
            daysOverdue: 2,
            storeManagerName: 'Jane Doe',
            actionPlanUrl: '#'
        };
        
        // Replace placeholders
        let subject = template.SubjectTemplate;
        let body = template.BodyTemplate;
        
        for (const [key, value] of Object.entries(sampleData)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            body = body.replace(regex, value);
        }
        
        res.json({
            success: true,
            template: {
                key: template.TemplateKey,
                name: template.TemplateName,
                module: template.Module,
                type: template.ReportType
            },
            preview: {
                subject: subject,
                bodyHtml: body
            }
        });
    } catch (err) {
        console.error('Error previewing template:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Preview email for a specific inspection
router.post('/api/job-monitor/preview-inspection-email', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const { module, type, inspection, templateKey } = req.body;
        
        // Get the template
        const result = await pool.request()
            .input('templateKey', sql.NVarChar, templateKey)
            .query(`
                SELECT TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate
                FROM EmailTemplates
                WHERE TemplateKey = @templateKey AND IsActive = 1
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Template not found: ' + templateKey });
        }
        
        const template = result.recordset[0];
        
        // Get store manager from StoreManagerAssignments
        let storeManagerEmail = 'N/A';
        let storeManagerName = inspection.createdBy || 'Store Manager';
        
        if (inspection.storeId) {
            const smResult = await pool.request()
                .input('storeId', sql.Int, inspection.storeId)
                .query(`
                    SELECT u.Email, u.DisplayName 
                    FROM StoreManagerAssignments sma
                    INNER JOIN Users u ON sma.UserId = u.Id
                    WHERE sma.StoreId = @storeId AND sma.IsPrimary = 1
                `);
            if (smResult.recordset.length > 0) {
                storeManagerEmail = smResult.recordset[0].Email;
                storeManagerName = smResult.recordset[0].DisplayName;
            }
        }
        
        // Build data from the inspection
        const data = {
            recipientName: storeManagerName,
            storeName: inspection.storeName || 'Unknown Store',
            documentNumber: inspection.documentNumber || 'N/A',
            inspectionDate: inspection.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : 'N/A',
            deadline: inspection.deadline ? new Date(inspection.deadline).toLocaleDateString() : 'Not Set',
            daysUntilDeadline: inspection.daysLeft || 0,
            daysOverdue: inspection.daysOverdue || 0,
            storeManagerName: storeManagerName,
            actionPlanUrl: '#'
        };
        
        // Replace placeholders
        let subject = template.SubjectTemplate;
        let body = template.BodyTemplate;
        
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            body = body.replace(regex, value);
        }
        
        res.json({
            success: true,
            preview: {
                from: 'spnotification@spinneys-lebanon.com',
                to: storeManagerEmail,
                toName: storeManagerName,
                subject: subject,
                bodyHtml: body
            }
        });
    } catch (err) {
        console.error('Error previewing inspection email:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Send test email to any address
router.post('/api/job-monitor/send-test-email', async (req, res) => {
    try {
        const { to, subject, bodyHtml } = req.body;
        
        if (!to || !subject || !bodyHtml) {
            return res.status(400).json({ success: false, error: 'Missing required fields: to, subject, bodyHtml' });
        }
        
        // Send the email
        const emailService = require('../../services/email-service');
        await emailService.sendEmail({
            to: to,
            subject: '[TEST] ' + subject,
            htmlContent: bodyHtml
        });
        
        console.log(`[Job Monitor] Test email sent to ${to} by ${req.currentUser?.email || 'unknown'}`);
        
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (err) {
        console.error('Error sending test email:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Resend theft incident email
router.post('/api/job-monitor/resend-theft-email/:incidentId', async (req, res) => {
    let pool;
    try {
        const incidentId = parseInt(req.params.incidentId);
        if (!incidentId) {
            return res.status(400).json({ success: false, error: 'Invalid incident ID' });
        }
        
        pool = await sql.connect(dbConfig);
        
        // Get the incident details
        const incidentResult = await pool.request()
            .input('incidentId', sql.Int, incidentId)
            .query(`
                SELECT * FROM TheftIncidents WHERE Id = @incidentId
            `);
        
        if (incidentResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Incident not found' });
        }
        
        const incident = incidentResult.recordset[0];
        
        // Get the email template
        const templateResult = await pool.request()
            .input('templateKey', sql.NVarChar, 'THEFT_INCIDENT_REPORT')
            .query('SELECT SubjectTemplate, BodyTemplate FROM EmailTemplates WHERE TemplateKey = @templateKey AND IsActive = 1');
        
        if (templateResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Email template not found' });
        }
        
        const template = templateResult.recordset[0];
        const baseUrl = process.env.APP_URL || 'https://oeapp-uat.gmrlapps.com';
        const THEFT_INCIDENT_NOTIFICATION_EMAIL = 'shammas.sh@gmrl.com'; // TODO: Get from settings
        
        // Format values
        const stolenValue = parseFloat(incident.StolenValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const valueCollected = parseFloat(incident.ValueCollected || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const amountToHO = parseFloat(incident.AmountToHO || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const incidentDate = incident.IncidentDate ? new Date(incident.IncidentDate).toLocaleDateString('en-GB') : '';
        const dateOfBirth = incident.DateOfBirth ? new Date(incident.DateOfBirth).toLocaleDateString('en-GB') : 'Not Available';
        
        // Build template data
        const templateData = {
            incidentId: incidentId.toString(),
            storeName: incident.Store || '',
            incidentDate: incidentDate,
            storeManager: incident.StoreManager || '',
            staffName: incident.StaffName || 'N/A',
            stolenItems: incident.StolenItems || '',
            stolenValue: stolenValue,
            valueCollected: valueCollected,
            thiefName: incident.ThiefName || 'Unknown',
            thiefSurname: incident.ThiefSurname || '',
            idCard: incident.IDCard || 'Not Available',
            dateOfBirth: dateOfBirth,
            placeOfBirth: incident.PlaceOfBirth || 'Not Available',
            fatherName: incident.FatherName || 'Not Available',
            motherName: incident.MotherName || 'Not Available',
            maritalStatus: incident.MaritalStatus || 'Unknown',
            captureMethod: incident.CaptureMethod || '',
            securityType: incident.SecurityType || '',
            outsourceCompany: incident.OutsourceCompany || 'N/A',
            amountToHO: amountToHO,
            currency: incident.Currency || 'USD',
            reportUrl: `${baseUrl}/stores/theft-incident/reports/${incidentId}`,
            recipientName: 'Team',
            submittedAt: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        };
        
        // Replace variables in template
        let subject = template.SubjectTemplate;
        let body = template.BodyTemplate;
        
        for (const [key, value] of Object.entries(templateData)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            body = body.replace(regex, value);
        }
        
        // Send email
        const emailService = require('../../services/email-service');
        await emailService.sendEmail({
            to: THEFT_INCIDENT_NOTIFICATION_EMAIL,
            subject: subject,
            body: body
        });
        
        // Log the email
        await pool.request()
            .input('incidentId', sql.Int, incidentId)
            .input('toEmail', sql.NVarChar, THEFT_INCIDENT_NOTIFICATION_EMAIL)
            .input('subject', sql.NVarChar, subject)
            .input('status', sql.NVarChar, 'Sent')
            .input('sentBy', sql.Int, req.currentUser?.userId)
            .query(`
                INSERT INTO TheftIncidentEmailLog (IncidentId, ToEmail, Subject, Status, SentBy, SentAt)
                VALUES (@incidentId, @toEmail, @subject, @status, @sentBy, GETDATE())
            `);
        
        console.log(`[Job Monitor] Theft incident email resent for #${incidentId} to ${THEFT_INCIDENT_NOTIFICATION_EMAIL} by ${req.currentUser?.email || 'unknown'}`);
        
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (err) {
        console.error('Error resending theft email:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Dry run API - check what notifications would be sent
router.get('/api/job-monitor/dry-run', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const { module, type } = req.query;
        
        let results = [];
        
        // Helper to get settings from key-value table
        const getSettings = async (tableName) => {
            const result = await pool.request().query(`SELECT SettingKey, SettingValue FROM ${tableName}`);
            const settings = {};
            result.recordset.forEach(r => { settings[r.SettingKey] = r.SettingValue; });
            return {
                reminderDays: parseInt(settings.ReminderDaysBefore?.split(',')[0]) || 3,
                overdueDays: parseInt(settings.ActionPlanDeadlineDays) || 7,
                escalationDays: parseInt(settings.ActionPlanDeadlineDays) || 7
            };
        };
        
        if (module === 'OE') {
            // Get OE settings from key-value table
            const settings = await getSettings('OE_EscalationSettings');
            
            if (type === 'inspection-reminder') {
                const result = await pool.request()
                    .input('reminderDays', sql.Int, settings.reminderDays)
                    .query(`
                        SELECT TOP 10
                            i.DocumentNumber,
                            i.InspectionDate,
                            i.ActionPlanDeadline as Deadline,
                            i.StoreName,
                            i.CreatedBy as RecipientName,
                            DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) as DaysUntilDeadline
                        FROM OE_Inspections i
                        WHERE i.ActionPlanDeadline IS NOT NULL
                          AND i.ActionPlanCompletedAt IS NULL
                          AND DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) BETWEEN 0 AND @reminderDays
                        ORDER BY i.ActionPlanDeadline
                    `);
                results = result.recordset.map(r => ({
                    documentNumber: r.DocumentNumber,
                    inspectionDate: r.InspectionDate,
                    deadline: r.Deadline,
                    storeName: r.StoreName,
                    recipientName: r.RecipientName,
                    recipientEmail: 'Store Manager',
                    daysUntilDeadline: r.DaysUntilDeadline
                }));
            } else if (type === 'inspection-overdue') {
                const result = await pool.request()
                    .input('overdueDays', sql.Int, 1)
                    .query(`
                        SELECT TOP 10
                            i.DocumentNumber,
                            i.InspectionDate,
                            i.ActionPlanDeadline as Deadline,
                            i.StoreName,
                            i.CreatedBy as RecipientName,
                            DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) as DaysOverdue
                        FROM OE_Inspections i
                        WHERE i.ActionPlanDeadline IS NOT NULL
                          AND i.ActionPlanCompletedAt IS NULL
                          AND i.ActionPlanDeadline < GETDATE()
                          AND DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) >= @overdueDays
                        ORDER BY i.ActionPlanDeadline
                    `);
                results = result.recordset.map(r => ({
                    documentNumber: r.DocumentNumber,
                    inspectionDate: r.InspectionDate,
                    deadline: r.Deadline,
                    storeName: r.StoreName,
                    recipientName: r.RecipientName,
                    recipientEmail: 'Store Manager',
                    daysOverdue: r.DaysOverdue
                }));
            } else if (type === 'inspection-escalation' || type === 'escalation') {
                const result = await pool.request()
                    .input('escalationDays', sql.Int, settings.escalationDays)
                    .query(`
                        SELECT TOP 10
                            i.DocumentNumber,
                            i.InspectionDate,
                            i.ActionPlanDeadline as Deadline,
                            i.StoreName,
                            i.CreatedBy as RecipientName,
                            DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) as DaysOverdue
                        FROM OE_Inspections i
                        WHERE i.ActionPlanDeadline IS NOT NULL
                          AND i.ActionPlanCompletedAt IS NULL
                          AND i.ActionPlanDeadline < GETDATE()
                          AND DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) >= @escalationDays
                        ORDER BY i.ActionPlanDeadline
                    `);
                results = result.recordset.map(r => ({
                    documentNumber: r.DocumentNumber,
                    inspectionDate: r.InspectionDate,
                    deadline: r.Deadline,
                    storeName: r.StoreName,
                    recipientName: r.RecipientName,
                    recipientEmail: 'Operations Manager',
                    daysOverdue: r.DaysOverdue
                }));
            }
        } else if (module === 'OHS') {
            // Get OHS settings from key-value table
            const settings = await getSettings('OHS_EscalationSettings');
            
            if (type === 'inspection-reminder') {
                const result = await pool.request()
                    .input('reminderDays', sql.Int, settings.reminderDays)
                    .query(`
                        SELECT TOP 10
                            i.DocumentNumber,
                            i.InspectionDate,
                            i.ActionPlanDeadline as Deadline,
                            i.StoreName,
                            i.CreatedBy as RecipientName,
                            DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) as DaysUntilDeadline
                        FROM OHS_Inspections i
                        WHERE i.ActionPlanDeadline IS NOT NULL
                          AND i.ActionPlanCompletedAt IS NULL
                          AND DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) BETWEEN 0 AND @reminderDays
                        ORDER BY i.ActionPlanDeadline
                    `);
                results = result.recordset.map(r => ({
                    documentNumber: r.DocumentNumber,
                    inspectionDate: r.InspectionDate,
                    deadline: r.Deadline,
                    storeName: r.StoreName,
                    recipientName: r.RecipientName,
                    recipientEmail: 'Store Manager',
                    daysUntilDeadline: r.DaysUntilDeadline
                }));
            } else if (type === 'inspection-overdue') {
                const result = await pool.request()
                    .input('overdueDays', sql.Int, 1)
                    .query(`
                        SELECT TOP 10
                            i.DocumentNumber,
                            i.InspectionDate,
                            i.ActionPlanDeadline as Deadline,
                            i.StoreName,
                            i.CreatedBy as RecipientName,
                            DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) as DaysOverdue
                        FROM OHS_Inspections i
                        WHERE i.ActionPlanDeadline IS NOT NULL
                          AND i.ActionPlanCompletedAt IS NULL
                          AND i.ActionPlanDeadline < GETDATE()
                          AND DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) >= @overdueDays
                        ORDER BY i.ActionPlanDeadline
                    `);
                results = result.recordset.map(r => ({
                    documentNumber: r.DocumentNumber,
                    inspectionDate: r.InspectionDate,
                    deadline: r.Deadline,
                    storeName: r.StoreName,
                    recipientName: r.RecipientName,
                    recipientEmail: 'Store Manager',
                    daysOverdue: r.DaysOverdue
                }));
            } else if (type === 'inspection-escalation' || type === 'escalation') {
                const result = await pool.request()
                    .input('escalationDays', sql.Int, settings.escalationDays)
                    .query(`
                        SELECT TOP 10
                            i.DocumentNumber,
                            i.InspectionDate,
                            i.ActionPlanDeadline as Deadline,
                            i.StoreName,
                            i.CreatedBy as RecipientName,
                            DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) as DaysOverdue
                        FROM OHS_Inspections i
                        WHERE i.ActionPlanDeadline IS NOT NULL
                          AND i.ActionPlanCompletedAt IS NULL
                          AND i.ActionPlanDeadline < GETDATE()
                          AND DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) >= @escalationDays
                        ORDER BY i.ActionPlanDeadline
                    `);
                results = result.recordset.map(r => ({
                    documentNumber: r.DocumentNumber,
                    inspectionDate: r.InspectionDate,
                    deadline: r.Deadline,
                    storeName: r.StoreName,
                    recipientName: r.RecipientName,
                    recipientEmail: 'Operations Manager',
                    daysOverdue: r.DaysOverdue
                }));
            }
        }
        
        res.json({ success: true, module, type, results });
    } catch (err) {
        console.error('Error in dry run:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Download Permission Matrix as Excel
router.get('/roles/download-matrix', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all data
        const roles = await pool.request().query('SELECT Id, RoleName, Description FROM UserRoles ORDER BY RoleName');
        const forms = await pool.request().query('SELECT Id, FormCode, FormName, ModuleName FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
        const permissions = await pool.request().query('SELECT RoleId, FormCode, CanView, CanCreate, CanEdit, CanDelete FROM RoleFormAccess');
        
        await pool.close();
        
        // Build permission lookup
        const permLookup = {};
        permissions.recordset.forEach(p => {
            const key = `${p.RoleId}-${p.FormCode}`;
            permLookup[key] = p;
        });
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'OE Application';
        workbook.created = new Date();
        
        // Create main matrix sheet
        const matrixSheet = workbook.addWorksheet('Permission Matrix');
        
        // Header row: Form Code | Form Name | Module | Role1 | Role2 | ...
        const headerRow = ['Form Code', 'Form Name', 'Module'];
        roles.recordset.forEach(r => headerRow.push(r.RoleName));
        matrixSheet.addRow(headerRow);
        
        // Style header
        const headerRowObj = matrixSheet.getRow(1);
        headerRowObj.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6f42c1' } };
        headerRowObj.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRowObj.height = 25;
        
        // Data rows
        forms.recordset.forEach(form => {
            const row = [form.FormCode, form.FormName, form.ModuleName];
            roles.recordset.forEach(role => {
                const perm = permLookup[`${role.Id}-${form.FormCode}`];
                if (perm) {
                    const perms = [];
                    if (perm.CanView) perms.push('V');
                    if (perm.CanCreate) perms.push('C');
                    if (perm.CanEdit) perms.push('E');
                    if (perm.CanDelete) perms.push('D');
                    row.push(perms.join(',') || '-');
                } else {
                    row.push('-');
                }
            });
            matrixSheet.addRow(row);
        });
        
        // Style data rows
        for (let i = 2; i <= forms.recordset.length + 1; i++) {
            const row = matrixSheet.getRow(i);
            row.alignment = { horizontal: 'center', vertical: 'middle' };
            
            // Color code permissions
            for (let j = 4; j <= roles.recordset.length + 3; j++) {
                const cell = row.getCell(j);
                const val = cell.value;
                if (val && val !== '-') {
                    if (val.includes('V') && val.includes('C') && val.includes('E') && val.includes('D')) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF28a745' } };
                        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                    } else if (val.includes('E') || val.includes('D')) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFffc107' } };
                    } else if (val.includes('V') || val.includes('C')) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFd4edda' } };
                    }
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf8f9fa' } };
                    cell.font = { color: { argb: 'FF999999' } };
                }
            }
        }
        
        // Set column widths
        matrixSheet.getColumn(1).width = 25;
        matrixSheet.getColumn(2).width = 30;
        matrixSheet.getColumn(3).width = 15;
        for (let i = 4; i <= roles.recordset.length + 3; i++) {
            matrixSheet.getColumn(i).width = 12;
        }
        
        // Freeze panes
        matrixSheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];
        
        // Add legend sheet
        const legendSheet = workbook.addWorksheet('Legend');
        legendSheet.addRow(['Permission Legend']);
        legendSheet.addRow(['V = View', 'C = Create', 'E = Edit', 'D = Delete']);
        legendSheet.addRow([]);
        legendSheet.addRow(['Color Legend']);
        legendSheet.addRow(['Green (VCED)', 'Full Access']);
        legendSheet.addRow(['Yellow (E or D)', 'Edit/Delete Access']);
        legendSheet.addRow(['Light Green (V or C)', 'View/Create Only']);
        legendSheet.addRow(['Gray (-)', 'No Access']);
        legendSheet.getRow(1).font = { bold: true, size: 14 };
        legendSheet.getRow(4).font = { bold: true, size: 14 };
        
        // Set response headers
        const filename = `Role-Permission-Matrix-${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Error generating permission matrix:', err);
        res.status(500).send('Error generating permission matrix: ' + err.message);
    }
});

// Export Users by Role to CSV
router.get('/roles/export-users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const data = await pool.request().query(`
            SELECT 
                r.RoleName,
                rc.CategoryName,
                u.DisplayName,
                u.Email,
                u.Department,
                u.JobTitle,
                CASE WHEN u.IsActive = 1 THEN 'Active' ELSE 'Inactive' END as UserStatus,
                FORMAT(ura.AssignedAt, 'yyyy-MM-dd') as AssignedDate
            FROM UserRoles r
            LEFT JOIN RoleCategories rc ON r.CategoryId = rc.Id
            LEFT JOIN UserRoleAssignments ura ON r.Id = ura.RoleId
            LEFT JOIN Users u ON ura.UserId = u.Id
            ORDER BY rc.CategoryName, r.RoleName, u.DisplayName
        `);
        
        await pool.close();
        
        // Generate CSV
        const headers = ['Role Name', 'Category', 'User Name', 'Email', 'Department', 'Job Title', 'Status', 'Assigned Date'];
        let csv = headers.join(',') + '\\n';
        
        data.recordset.forEach(row => {
            csv += [
                '"' + (row.RoleName || '').replace(/"/g, '""') + '"',
                '"' + (row.CategoryName || 'Uncategorized').replace(/"/g, '""') + '"',
                '"' + (row.DisplayName || 'No users assigned').replace(/"/g, '""') + '"',
                '"' + (row.Email || '').replace(/"/g, '""') + '"',
                '"' + (row.Department || '').replace(/"/g, '""') + '"',
                '"' + (row.JobTitle || '').replace(/"/g, '""') + '"',
                row.UserStatus || '',
                row.AssignedDate || ''
            ].join(',') + '\\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users-by-role-' + new Date().toISOString().split('T')[0] + '.csv');
        res.send(csv);
        
    } catch (err) {
        console.error('Error exporting users by role:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Admin Dashboard
router.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Admin Panel - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                .header {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { font-size: 24px; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    margin-left: 20px;
                    opacity: 0.8;
                }
                .header-nav a:hover { opacity: 1; }
                .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
                .admin-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 25px;
                }
                .admin-card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    text-decoration: none;
                    color: inherit;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .admin-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.12);
                }
                .card-icon { font-size: 48px; margin-bottom: 15px; }
                .card-title { font-size: 20px; font-weight: 600; margin-bottom: 10px; color: #333; }
                .card-desc { color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>⚙️ Admin Panel</h1>
                <div class="header-nav">
                    <a href="/dashboard">← Dashboard</a>
                </div>
            </div>
            <div class="container">
                <div class="admin-grid">
                    <a href="/admin/users" class="admin-card">
                        <div class="card-icon">👥</div>
                        <div class="card-title">User Management</div>
                        <div class="card-desc">View all users, assign forms and permissions</div>
                    </a>
                    <a href="/admin/forms" class="admin-card">
                        <div class="card-icon">📋</div>
                        <div class="card-title">Form Registry</div>
                        <div class="card-desc">Manage available forms in the system</div>
                    </a>
                    <a href="/admin/roles" class="admin-card">
                        <div class="card-icon">🔐</div>
                        <div class="card-title">Role Management</div>
                        <div class="card-desc">View and manage user roles</div>
                    </a>
                    <a href="/admin/impersonate" class="admin-card">
                        <div class="card-icon">👤</div>
                        <div class="card-title">Impersonate User</div>
                        <div class="card-desc">Test permissions as another user</div>
                    </a>
                    <a href="/admin/sessions" class="admin-card">
                        <div class="card-icon">🔐</div>
                        <div class="card-title">Session Monitor</div>
                        <div class="card-desc">View active sessions & detect duplicates</div>
                    </a>
                    <a href="/admin/email-templates" class="admin-card">
                        <div class="card-icon">📧</div>
                        <div class="card-title">Email Templates</div>
                        <div class="card-desc">View & edit OE/OHS report email templates</div>
                    </a>
                    <a href="/admin/job-monitor" class="admin-card">
                        <div class="card-icon">⏱️</div>
                        <div class="card-title">Job Monitor</div>
                        <div class="card-desc">View scheduler status & notification jobs</div>
                    </a>
                    <a href="/admin/org-tree" class="admin-card">
                        <div class="card-icon">🌳</div>
                        <div class="card-title">Org Tree</div>
                        <div class="card-desc">View organization hierarchy: Brands → Managers → Stores</div>
                    </a>
                    <a href="/admin/dashboard-menu" class="admin-card">
                        <div class="card-icon">🎛️</div>
                        <div class="card-title">Dashboard Menu</div>
                        <div class="card-desc">Configure dashboard categories, icons & menu items</div>
                    </a>
                    <a href="/admin/permission-sync" class="admin-card">
                        <div class="card-icon">🔄</div>
                        <div class="card-title">Permission Sync</div>
                        <div class="card-desc">Compare & sync permissions from UAT to Live database</div>
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// User Management - List all users
router.get('/users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Check if Department column exists
        const colCheck = await pool.request().query(`
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Department'
        `);
        const hasDeptColumn = colCheck.recordset.length > 0;
        
        // Get users with their assigned roles (supports multiple roles)
        const usersQuery = hasDeptColumn 
            ? `SELECT u.Id, u.Email, u.DisplayName, u.Department, u.IsActive, u.IsApproved, u.CreatedAt,
                   (SELECT COUNT(*) FROM UserFormAccess WHERE UserId = u.Id) as FormCount,
                   (SELECT STRING_AGG(r.RoleName, ', ') FROM UserRoleAssignments ura 
                    JOIN UserRoles r ON ura.RoleId = r.Id WHERE ura.UserId = u.Id) as RoleNames,
                   (SELECT STRING_AGG(CAST(ura.RoleId AS VARCHAR), ',') FROM UserRoleAssignments ura 
                    WHERE ura.UserId = u.Id) as RoleIds
               FROM Users u
               ORDER BY u.DisplayName`
            : `SELECT u.Id, u.Email, u.DisplayName, NULL as Department, u.IsActive, u.IsApproved, u.CreatedAt,
                   (SELECT COUNT(*) FROM UserFormAccess WHERE UserId = u.Id) as FormCount,
                   (SELECT STRING_AGG(r.RoleName, ', ') FROM UserRoleAssignments ura 
                    JOIN UserRoles r ON ura.RoleId = r.Id WHERE ura.UserId = u.Id) as RoleNames,
                   (SELECT STRING_AGG(CAST(ura.RoleId AS VARCHAR), ',') FROM UserRoleAssignments ura 
                    WHERE ura.UserId = u.Id) as RoleIds
               FROM Users u
               ORDER BY u.DisplayName`;
        
        const users = await pool.request().query(usersQuery);
        
        // Get available departments (defensive - check if columns exist)
        let departments = [];
        try {
            const depts = await pool.request().query(`
                SELECT DISTINCT Department FROM (
                    SELECT Department FROM DepartmentContacts WHERE Department IS NOT NULL
                    UNION
                    SELECT Department FROM Users WHERE Department IS NOT NULL AND Department != ''
                ) AS depts
                ORDER BY Department
            `);
            departments = depts.recordset.map(r => r.Department);
        } catch (deptErr) {
            console.log('Department query failed, using empty list:', deptErr.message);
        }
        
        const roles = await pool.request().query(`
            SELECT r.Id, r.RoleName, r.CategoryId, c.CategoryName, c.AccessLevel,
                   (SELECT COUNT(*) FROM RoleFormAccess WHERE RoleId = r.Id) as FormCount
            FROM UserRoles r
            JOIN RoleCategories c ON r.CategoryId = c.Id
            ORDER BY c.Id, r.RoleName
        `);
        const categories = await pool.request().query('SELECT Id, CategoryName, AccessLevel FROM RoleCategories ORDER BY Id');
        
        await pool.close();
        
        // Helper to escape strings for JS
        const escapeJs = (str) => (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
        
        const departmentsJson = JSON.stringify(departments);
        
        let userRows = users.recordset.map(u => {
            const roleDisplay = u.RoleNames ? u.RoleNames.split(', ').map(r => 
                `<span class="role-badge">${r}</span>`
            ).join(' ') : '<span class="role-badge no-role">No Role</span>';
            
            const deptDisplay = u.Department 
                ? `<span class="dept-badge">${u.Department}</span>`
                : '<span class="dept-badge no-dept">No Dept</span>';
            
            const approvalBadge = u.IsApproved 
                ? '' 
                : '<span class="status-badge pending">⏳ Pending Approval</span>';
            
            const approveBtn = u.IsApproved 
                ? '' 
                : `<button class="btn btn-sm btn-warning" onclick="approveUser(${u.Id}, '${escapeJs(u.DisplayName)}')">✓ Approve</button>`;
            
            return `
            <tr data-user-id="${u.Id}" data-approved="${u.IsApproved ? '1' : '0'}" data-department="${u.Department || ''}">
                <td>${escapeJs(u.DisplayName) || 'N/A'} ${approvalBadge}</td>
                <td>${u.Email}</td>
                <td class="roles-cell">${roleDisplay}</td>
                <td class="dept-cell" onclick="editDepartment(${u.Id}, '${escapeJs(u.Department || '')}', '${escapeJs(u.DisplayName)}')" style="cursor:pointer;">${deptDisplay}</td>
                <td><span class="form-count">${u.FormCount} forms</span></td>
                <td><span class="status-badge ${u.IsActive ? 'active' : 'inactive'}">${u.IsActive ? 'Active' : 'Inactive'}</span></td>
                <td class="actions-cell">
                    ${approveBtn}
                    <a href="/admin/users/${u.Id}/forms" class="btn btn-sm btn-primary">Manage Forms</a>
                    <button class="btn btn-sm btn-secondary" onclick="editRoles(${u.Id}, '${u.RoleIds || ''}', '${escapeJs(u.DisplayName)}')">Manage Roles</button>
                </td>
            </tr>
        `}).join('');
        
        // Group roles by category for the modal
        const rolesByCategory = {};
        categories.recordset.forEach(c => {
            rolesByCategory[c.Id] = { name: c.CategoryName, accessLevel: c.AccessLevel, roles: [] };
        });
        roles.recordset.forEach(r => {
            if (rolesByCategory[r.CategoryId]) {
                rolesByCategory[r.CategoryId].roles.push(r);
            }
        });
        
        const rolesJson = JSON.stringify(roles.recordset);
        const categoriesJson = JSON.stringify(categories.recordset);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>User Management - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    .search-box {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        width: 300px;
                    }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .roles-cell { max-width: 300px; }
                    .role-badge {
                        background: #e3f2fd;
                        color: #1976d2;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 11px;
                        display: inline-block;
                        margin: 2px;
                    }
                    .role-badge.no-role {
                        background: #f5f5f5;
                        color: #999;
                    }
                    .dept-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 11px;
                    }
                    .dept-badge.no-dept {
                        background: #f5f5f5;
                        color: #999;
                    }
                    .dept-cell:hover .dept-badge {
                        background: #c8e6c9;
                    }
                    .form-count {
                        background: #f3e5f5;
                        color: #7b1fa2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .status-badge.active { background: #e8f5e9; color: #2e7d32; }
                    .status-badge.inactive { background: #ffebee; color: #c62828; }
                    .status-badge.pending { background: #fff3e0; color: #e65100; font-size: 10px; margin-left: 8px; }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 13px;
                        margin-right: 5px;
                    }
                    .btn-sm { padding: 6px 12px; }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-primary:hover { background: #005a9e; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-secondary:hover { background: #545b62; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-success:disabled { background: #94d3a2; cursor: wait; }
                    .btn-warning { background: #ff9800; color: white; }
                    .btn-warning:hover { background: #f57c00; }
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        justify-content: center;
                        align-items: center;
                        z-index: 1000;
                    }
                    .modal.show { display: flex; }
                    .modal-content {
                        background: white;
                        padding: 30px;
                        border-radius: 15px;
                        width: 400px;
                        max-width: 90%;
                    }
                    .modal-title { font-size: 20px; margin-bottom: 20px; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
                    .form-group select {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
                    .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid #eee; }
                    .tab { padding: 10px 20px; cursor: pointer; border-radius: 8px 8px 0 0; transition: all 0.2s; }
                    .tab:hover { background: #f0f0f0; }
                    .tab.active { background: #0078d4; color: white; }
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    .role-card { background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
                    .role-card:hover { border-color: #0078d4; transform: translateX(5px); }
                    .role-card.selected { border-color: #28a745; background: #e8f5e9; }
                    .role-card-header { display: flex; justify-content: space-between; align-items: center; }
                    .role-card-title { font-weight: 600; color: #333; }
                    .role-card-category { font-size: 11px; color: #666; background: #e3f2fd; padding: 3px 8px; border-radius: 10px; }
                    .role-card-desc { font-size: 12px; color: #666; margin-top: 8px; }
                    .role-card-forms { font-size: 11px; color: #0078d4; margin-top: 5px; }
                    .perm-table { width: 100%; font-size: 13px; margin-top: 15px; }
                    .perm-table th { background: #f0f0f0; padding: 8px; text-align: left; }
                    .perm-table td { padding: 8px; border-bottom: 1px solid #eee; }
                    .perm-check { color: #28a745; font-weight: bold; }
                    .perm-x { color: #dc3545; }
                    .quick-stats { display: flex; gap: 20px; margin-bottom: 20px; }
                    .stat-card { background: white; padding: 20px; border-radius: 12px; flex: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
                    .stat-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
                    .stat-card.selected { border-color: #0078d4; background: #f0f7ff; }
                    .stat-card.with-roles .stat-number { color: #28a745; }
                    .stat-card.with-roles.selected { border-color: #28a745; background: #f0fff4; }
                    .stat-card.no-roles .stat-number { color: #dc3545; }
                    .stat-card.no-roles.selected { border-color: #dc3545; background: #fff5f5; }
                    .stat-card.pending-approval .stat-number { color: #ff9800; }
                    .stat-card.pending-approval.selected { border-color: #ff9800; background: #fff8e1; }
                    .stat-card.roles-count .stat-number { color: #6f42c1; }
                    .stat-number { font-size: 28px; font-weight: bold; color: #0078d4; }
                    .stat-label { font-size: 13px; color: #666; margin-top: 5px; }
                    .actions-cell { white-space: nowrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>👥 User Management</h1>
                    <div class="header-nav">
                        <button class="btn" style="background:#6f42c1;color:white;margin-right:15px;" onclick="showRolePermissions()">📋 View Role Permissions</button>
                        <a href="/admin">← Admin Panel</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <!-- Quick Stats -->
                    <div class="quick-stats">
                        <div class="stat-card selected" onclick="filterByCard('all')" title="Click to show all users">
                            <div class="stat-number">${users.recordset.length}</div>
                            <div class="stat-label">Total Users</div>
                        </div>
                        <div class="stat-card pending-approval" onclick="filterByCard('pending')" title="Click to show pending approval">
                            <div class="stat-number">${users.recordset.filter(u => !u.IsApproved).length}</div>
                            <div class="stat-label">⏳ Pending Approval</div>
                        </div>
                        <div class="stat-card" onclick="filterByCard('active')" title="Click to show active users">
                            <div class="stat-number">${users.recordset.filter(u => u.IsActive).length}</div>
                            <div class="stat-label">Active Users</div>
                        </div>
                        <div class="stat-card with-roles" onclick="filterByCard('with-roles')" title="Click to show users with roles">
                            <div class="stat-number">${users.recordset.filter(u => u.RoleNames).length}</div>
                            <div class="stat-label">Users with Roles</div>
                        </div>
                        <div class="stat-card no-roles" onclick="filterByCard('no-roles')" title="Click to show users without roles">
                            <div class="stat-number">${users.recordset.filter(u => !u.RoleNames).length}</div>
                            <div class="stat-label">No Roles Assigned</div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">All Users</div>
                            <div style="display: flex; gap: 15px; align-items: center;">
                                <button class="btn btn-success" onclick="syncUsers()">🔄 Sync from Azure AD</button>
                                <input type="text" class="search-box" placeholder="Search users..." onkeyup="filterUsers(this.value)">
                            </div>
                        </div>
                        <table id="usersTable">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    <th>Forms Assigned</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${userRows || '<tr><td colspan="7" style="text-align:center;color:#666;">No users found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Role Permissions Modal -->
                <div class="modal" id="rolePermissionsModal">
                    <div class="modal-content" style="width:900px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
                        <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>📋 Role Permissions Guide</span>
                            <button onclick="closeRolePermissionsModal()" style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
                        </div>
                        <div style="display:flex;gap:20px;flex:1;overflow:hidden;">
                            <!-- Left: Role List -->
                            <div style="width:300px;overflow-y:auto;padding-right:10px;">
                                <div id="rolesList"></div>
                            </div>
                            <!-- Right: Permission Details -->
                            <div style="flex:1;overflow-y:auto;padding:15px;background:#f8f9fa;border-radius:10px;">
                                <div id="roleDetails">
                                    <div style="text-align:center;color:#666;padding:40px;">
                                        ← Select a role to see its permissions
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Department Change Modal -->
                <div class="modal" id="deptModal">
                    <div class="modal-content" style="width:400px;">
                        <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>🏢 Set Department</span>
                            <button onclick="closeDeptModal()" style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
                        </div>
                        <input type="hidden" id="deptUserId">
                        <div class="form-group">
                            <label id="deptUserNameLabel" style="font-weight:600;font-size:16px;color:#0078d4;margin-bottom:15px;display:block;">User</label>
                            <label style="margin-bottom:8px;display:block;">Department:</label>
                            <select id="departmentSelect" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:14px;" onchange="handleDeptChange(this)">
                            </select>
                            <input type="text" id="customDeptInput" placeholder="Enter new department name" style="display:none;width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-top:10px;">
                        </div>
                        <div class="modal-actions" style="margin-top:20px;">
                            <button type="button" class="btn btn-secondary" onclick="closeDeptModal()">Cancel</button>
                            <button type="button" class="btn btn-success" onclick="saveDepartment()">💾 Save Department</button>
                        </div>
                    </div>
                </div>
                
                <!-- Role Change Modal -->
                <div class="modal" id="roleModal">
                    <div class="modal-content" style="width:900px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
                        <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>🎭 Manage User Roles</span>
                            <button onclick="closeModal()" style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
                        </div>
                        <input type="hidden" id="userId">
                        <div class="form-group">
                            <label id="userNameLabel" style="font-weight:600;font-size:18px;color:#0078d4;">User</label>
                        </div>
                        <div style="display:flex;gap:20px;flex:1;overflow:hidden;">
                            <!-- Left: Role Selection -->
                            <div style="width:350px;display:flex;flex-direction:column;">
                                <label style="margin-bottom:10px;display:block;font-weight:600;">Select Roles:</label>
                                <div id="rolesCheckboxes" style="flex:1;overflow-y:auto;border:1px solid #ddd;border-radius:8px;padding:15px;background:#fafafa;">
                                    <!-- Roles will be inserted here by JS -->
                                </div>
                            </div>
                            <!-- Right: Permissions Preview -->
                            <div style="flex:1;display:flex;flex-direction:column;">
                                <label style="margin-bottom:10px;display:block;font-weight:600;">📋 Permissions Preview:</label>
                                <div id="permissionsPreview" style="flex:1;overflow-y:auto;border:1px solid #ddd;border-radius:8px;padding:15px;background:#f8f9fa;">
                                    <div style="text-align:center;color:#666;padding:30px;">
                                        ← Select roles to see permissions
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions" style="margin-top:15px;padding-top:15px;border-top:1px solid #eee;">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="button" class="btn btn-success" onclick="saveRoles()" id="saveRolesBtn">💾 Save Roles & Sync Permissions</button>
                        </div>
                    </div>
                </div>
                
                <style>
                    .role-category { margin-bottom: 15px; }
                    .role-category-title { font-weight: 600; color: #333; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
                    .role-checkbox { display: flex; align-items: center; padding: 6px 0; }
                    .role-checkbox input { margin-right: 10px; width: 18px; height: 18px; cursor: pointer; }
                    .role-checkbox label { cursor: pointer; flex: 1; }
                </style>
                
                <script>
                    const allRoles = ${rolesJson};
                    let currentUserId = null;
                    let currentFilter = 'all';
                    
                    function filterByCard(filterType) {
                        currentFilter = filterType;
                        const rows = document.querySelectorAll('#usersTable tbody tr');
                        const cards = document.querySelectorAll('.stat-card');
                        
                        // Update card selection
                        cards.forEach((card, idx) => {
                            card.classList.remove('selected');
                            if ((filterType === 'all' && idx === 0) ||
                                (filterType === 'pending' && idx === 1) ||
                                (filterType === 'active' && idx === 2) ||
                                (filterType === 'with-roles' && idx === 3) ||
                                (filterType === 'no-roles' && idx === 4)) {
                                card.classList.add('selected');
                            }
                        });
                        
                        // Filter rows
                        rows.forEach(row => {
                            const isActive = row.querySelector('.status-badge.active') !== null;
                            const hasRoles = row.querySelector('.role-badge.no-role') === null;
                            const isPending = row.getAttribute('data-approved') === '0';
                            
                            let show = true;
                            if (filterType === 'pending') show = isPending;
                            else if (filterType === 'active') show = isActive;
                            else if (filterType === 'with-roles') show = hasRoles;
                            else if (filterType === 'no-roles') show = !hasRoles;
                            
                            row.style.display = show ? '' : 'none';
                        });
                        
                        // Clear search box
                        document.querySelector('.search-box').value = '';
                    }
                    
                    async function approveUser(userId, userName) {
                        if (!confirm('Approve user "' + userName + '"? They will be able to access the system.')) return;
                        
                        try {
                            const response = await fetch('/admin/users/' + userId + '/approve', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                alert('✅ User approved successfully!');
                                location.reload();
                            } else {
                                alert('Error: ' + (data.error || 'Failed to approve user'));
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    function filterUsers(query) {
                        const rows = document.querySelectorAll('#usersTable tbody tr');
                        query = query.toLowerCase();
                        rows.forEach(row => {
                            const text = row.textContent.toLowerCase();
                            row.style.display = text.includes(query) ? '' : 'none';
                        });
                        // Reset card selection when searching
                        if (query) {
                            document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('selected'));
                        }
                    }
                    
                    const departments = ${departmentsJson};
                    
                    function editDepartment(userId, currentDept, userName) {
                        document.getElementById('deptUserId').value = userId;
                        document.getElementById('deptUserNameLabel').textContent = '👤 ' + userName;
                        
                        // Build department select options
                        let options = '<option value="">-- No Department --</option>';
                        departments.forEach(d => {
                            const selected = d === currentDept ? 'selected' : '';
                            options += '<option value="' + d + '" ' + selected + '>' + d + '</option>';
                        });
                        // Add option for custom entry
                        options += '<option value="__custom__">+ Add New Department</option>';
                        
                        document.getElementById('departmentSelect').innerHTML = options;
                        document.getElementById('departmentSelect').value = currentDept || '';
                        document.getElementById('customDeptInput').style.display = 'none';
                        document.getElementById('deptModal').classList.add('show');
                    }
                    
                    function handleDeptChange(select) {
                        const customInput = document.getElementById('customDeptInput');
                        if (select.value === '__custom__') {
                            customInput.style.display = 'block';
                            customInput.focus();
                        } else {
                            customInput.style.display = 'none';
                        }
                    }
                    
                    async function saveDepartment() {
                        const userId = document.getElementById('deptUserId').value;
                        const select = document.getElementById('departmentSelect');
                        let department = select.value;
                        
                        if (department === '__custom__') {
                            department = document.getElementById('customDeptInput').value.trim();
                            if (!department) {
                                alert('Please enter a department name');
                                return;
                            }
                        }
                        
                        try {
                            const response = await fetch('/admin/users/' + userId + '/department', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ department })
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                // Update the table row
                                const row = document.querySelector('tr[data-user-id="' + userId + '"]');
                                if (row) {
                                    const deptCell = row.querySelector('.dept-cell');
                                    if (department) {
                                        deptCell.innerHTML = '<span class="dept-badge">' + department + '</span>';
                                    } else {
                                        deptCell.innerHTML = '<span class="dept-badge no-dept">No Dept</span>';
                                    }
                                    row.setAttribute('data-department', department);
                                }
                                closeDeptModal();
                            } else {
                                alert('Error: ' + data.error);
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    function closeDeptModal() {
                        document.getElementById('deptModal').classList.remove('show');
                    }
                    
                    function editRoles(userId, currentRoleIds, userName) {
                        currentUserId = userId;
                        document.getElementById('userId').value = userId;
                        document.getElementById('userNameLabel').textContent = '👤 ' + userName;
                        
                        // Parse current role IDs
                        const selectedRoles = currentRoleIds ? currentRoleIds.split(',').map(id => parseInt(id)) : [];
                        
                        // Group roles by category
                        const rolesByCategory = {};
                        allRoles.forEach(r => {
                            if (!rolesByCategory[r.CategoryId]) {
                                rolesByCategory[r.CategoryId] = [];
                            }
                            rolesByCategory[r.CategoryId].push(r);
                        });
                        
                        // Build checkboxes HTML with onchange handler
                        let html = '';
                        Object.keys(rolesByCategory).forEach(catId => {
                            const roles = rolesByCategory[catId];
                            html += '<div class="role-category">';
                            html += '<div class="role-category-title">' + (roles[0]?.CategoryName || 'Other') + '</div>';
                            roles.forEach(r => {
                                const checked = selectedRoles.includes(r.Id) ? 'checked' : '';
                                html += '<div class="role-checkbox">';
                                html += '<input type="checkbox" id="role_' + r.Id + '" value="' + r.Id + '" ' + checked + ' onchange="updatePermissionsPreview()">';
                                html += '<label for="role_' + r.Id + '">' + r.RoleName + '</label>';
                                html += '</div>';
                            });
                            html += '</div>';
                        });
                        
                        document.getElementById('rolesCheckboxes').innerHTML = html;
                        document.getElementById('roleModal').classList.add('show');
                        
                        // Show initial permissions preview
                        updatePermissionsPreview();
                    }
                    
                    async function updatePermissionsPreview() {
                        const checkboxes = document.querySelectorAll('#rolesCheckboxes input[type="checkbox"]:checked');
                        const roleIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
                        
                        const previewDiv = document.getElementById('permissionsPreview');
                        
                        if (roleIds.length === 0) {
                            previewDiv.innerHTML = '<div style="text-align:center;color:#666;padding:30px;">← Select roles to see permissions</div>';
                            return;
                        }
                        
                        previewDiv.innerHTML = '<div style="text-align:center;padding:20px;"><span style="font-size:20px;">⏳</span> Loading...</div>';
                        
                        try {
                            const response = await fetch('/admin/api/preview-permissions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roleIds })
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                let html = '<div style="margin-bottom:15px;padding:10px;background:#e3f2fd;border-radius:8px;">';
                                html += '<strong>Summary:</strong> ' + data.summary.total + ' forms access<br>';
                                html += '<span style="color:#28a745;">👁 View: ' + data.summary.canView + '</span> | ';
                                html += '<span style="color:#17a2b8;">➕ Create: ' + data.summary.canCreate + '</span> | ';
                                html += '<span style="color:#fd7e14;">✏️ Edit: ' + data.summary.canEdit + '</span> | ';
                                html += '<span style="color:#dc3545;">🗑️ Delete: ' + data.summary.canDelete + '</span>';
                                html += '</div>';
                                
                                // Group by module
                                const byModule = {};
                                data.permissions.forEach(p => {
                                    const mod = p.ModuleName || 'Other';
                                    if (!byModule[mod]) byModule[mod] = [];
                                    byModule[mod].push(p);
                                });
                                
                                Object.keys(byModule).forEach(mod => {
                                    html += '<div style="margin-bottom:12px;">';
                                    html += '<div style="font-weight:600;color:#333;margin-bottom:5px;font-size:13px;">' + mod + '</div>';
                                    byModule[mod].forEach(p => {
                                        html += '<div style="font-size:12px;padding:3px 0;padding-left:10px;border-left:2px solid #ddd;">';
                                        html += p.FormName + ' ';
                                        html += p.CanView ? '<span title="View" style="color:#28a745;">👁</span>' : '';
                                        html += p.CanCreate ? '<span title="Create" style="color:#17a2b8;">➕</span>' : '';
                                        html += p.CanEdit ? '<span title="Edit" style="color:#fd7e14;">✏️</span>' : '';
                                        html += p.CanDelete ? '<span title="Delete" style="color:#dc3545;">🗑️</span>' : '';
                                        html += '</div>';
                                    });
                                    html += '</div>';
                                });
                                
                                previewDiv.innerHTML = html;
                            }
                        } catch (err) {
                            previewDiv.innerHTML = '<div style="color:#dc3545;">Error loading preview</div>';
                        }
                    }
                    
                    function closeModal() {
                        document.getElementById('roleModal').classList.remove('show');
                    }
                    
                    async function saveRoles() {
                        const btn = document.getElementById('saveRolesBtn');
                        btn.disabled = true;
                        btn.textContent = '⏳ Saving...';
                        
                        const checkboxes = document.querySelectorAll('#rolesCheckboxes input[type="checkbox"]:checked');
                        const roleIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
                        
                        try {
                            const response = await fetch('/admin/users/update-roles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: currentUserId, roleIds: roleIds })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                alert('✅ Roles saved and permissions synced successfully!');
                                window.location.reload();
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (err) {
                            alert('Error saving roles: ' + err.message);
                        } finally {
                            btn.disabled = false;
                            btn.textContent = '💾 Save Roles & Sync Permissions';
                        }
                    }
                    
                    async function syncUsers() {
                        const btn = event.target;
                        btn.disabled = true;
                        btn.textContent = '⏳ Syncing...';
                        
                        try {
                            const response = await fetch('/admin/users/sync', { method: 'POST' });
                            const result = await response.json();
                            
                            if (result.success) {
                                alert('Sync completed! Added: ' + result.added + ', Updated: ' + result.updated + ', Skipped: ' + result.skipped);
                                window.location.reload();
                            } else {
                                alert('Sync failed: ' + result.error);
                            }
                        } catch (err) {
                            alert('Sync error: ' + err.message);
                        } finally {
                            btn.disabled = false;
                            btn.textContent = '🔄 Sync from Azure AD';
                        }
                    }
                    
                    // Role Permissions Modal Functions
                    const allCategories = ${categoriesJson};
                    let selectedRoleId = null;
                    
                    function showRolePermissions() {
                        document.getElementById('rolePermissionsModal').classList.add('show');
                        buildRolesList();
                    }
                    
                    function closeRolePermissionsModal() {
                        document.getElementById('rolePermissionsModal').classList.remove('show');
                        selectedRoleId = null;
                    }
                    
                    function buildRolesList() {
                        // Group roles by category
                        const byCategory = {};
                        allRoles.forEach(r => {
                            if (!byCategory[r.CategoryId]) {
                                const cat = allCategories.find(c => c.Id === r.CategoryId);
                                byCategory[r.CategoryId] = { name: cat?.CategoryName || 'Other', accessLevel: cat?.AccessLevel || '', roles: [] };
                            }
                            byCategory[r.CategoryId].roles.push(r);
                        });
                        
                        let html = '';
                        Object.values(byCategory).forEach(cat => {
                            html += '<div style="margin-bottom:20px;">';
                            html += '<div style="font-weight:600;color:#555;margin-bottom:10px;font-size:12px;text-transform:uppercase;">' + cat.name + '</div>';
                            cat.roles.forEach(r => {
                                html += '<div class="role-card" onclick="loadRolePermissions(' + r.Id + ', this)">';
                                html += '<div class="role-card-header">';
                                html += '<span class="role-card-title">' + r.RoleName + '</span>';
                                html += '<span class="role-card-forms">' + (r.FormCount || 0) + ' forms</span>';
                                html += '</div>';
                                html += '</div>';
                            });
                            html += '</div>';
                        });
                        
                        document.getElementById('rolesList').innerHTML = html;
                    }
                    
                    async function loadRolePermissions(roleId, cardElement) {
                        // Update selection
                        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
                        cardElement.classList.add('selected');
                        selectedRoleId = roleId;
                        
                        document.getElementById('roleDetails').innerHTML = '<div style="text-align:center;padding:40px;">Loading...</div>';
                        
                        try {
                            const response = await fetch('/admin/api/role-permissions/' + roleId);
                            const data = await response.json();
                            
                            if (!data.success) {
                                throw new Error(data.error);
                            }
                            
                            let html = '';
                            html += '<h3 style="margin-bottom:10px;">' + data.role.RoleName + '</h3>';
                            html += '<div style="background:#e3f2fd;padding:10px;border-radius:8px;margin-bottom:15px;">';
                            html += '<strong>Category:</strong> ' + data.role.CategoryName + '<br>';
                            html += '<strong>Access Level:</strong> ' + (data.role.AccessLevel || 'Not defined');
                            html += '</div>';
                            
                            if (data.permissions.length === 0) {
                                html += '<div style="color:#999;text-align:center;padding:30px;">No specific form permissions defined for this role.</div>';
                            } else {
                                // Group by module
                                const byModule = {};
                                data.permissions.forEach(p => {
                                    if (!byModule[p.ModuleName]) byModule[p.ModuleName] = [];
                                    byModule[p.ModuleName].push(p);
                                });
                                
                                Object.entries(byModule).forEach(([module, perms]) => {
                                    html += '<div style="margin-bottom:15px;">';
                                    html += '<div style="font-weight:600;color:#333;margin-bottom:8px;">📁 ' + module + '</div>';
                                    html += '<table class="perm-table"><thead><tr><th>Form</th><th style="width:60px;text-align:center;">View</th><th style="width:60px;text-align:center;">Create</th><th style="width:60px;text-align:center;">Edit</th><th style="width:60px;text-align:center;">Delete</th></tr></thead><tbody>';
                                    perms.forEach(p => {
                                        html += '<tr>';
                                        html += '<td>' + p.FormName + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanView ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanCreate ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanEdit ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '<td style="text-align:center;">' + (p.CanDelete ? '<span class="perm-check">✓</span>' : '<span class="perm-x">✗</span>') + '</td>';
                                        html += '</tr>';
                                    });
                                    html += '</tbody></table></div>';
                                });
                            }
                            
                            document.getElementById('roleDetails').innerHTML = html;
                        } catch (err) {
                            document.getElementById('roleDetails').innerHTML = '<div style="color:#dc3545;padding:20px;">Error loading permissions: ' + err.message + '</div>';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading users:', err);
        res.status(500).send('Error loading users: ' + err.message);
    }
});

// API: Get role permissions for a specific role
router.get('/api/role-permissions/:roleId', async (req, res) => {
    try {
        const roleId = parseInt(req.params.roleId);
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                SELECT rfa.FormCode, f.FormName, f.ModuleName, 
                       rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete
                FROM RoleFormAccess rfa
                JOIN Forms f ON rfa.FormCode = f.FormCode
                WHERE rfa.RoleId = @roleId
                ORDER BY f.ModuleName, f.FormName
            `);
        
        const roleInfo = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                SELECT r.Id, r.RoleName, c.CategoryName, c.AccessLevel
                FROM UserRoles r
                JOIN RoleCategories c ON r.CategoryId = c.Id
                WHERE r.Id = @roleId
            `);
        
        await pool.close();
        
        res.json({
            success: true,
            role: roleInfo.recordset[0],
            permissions: result.recordset
        });
    } catch (err) {
        console.error('Error getting role permissions:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Get all roles with their categories
router.get('/api/roles-with-categories', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT r.Id, r.RoleName, c.Id as CategoryId, c.CategoryName, c.AccessLevel,
                   (SELECT COUNT(*) FROM RoleFormAccess WHERE RoleId = r.Id) as FormCount
            FROM UserRoles r
            JOIN RoleCategories c ON r.CategoryId = c.Id
            ORDER BY c.Id, r.RoleName
        `);
        
        await pool.close();
        res.json({ success: true, roles: result.recordset });
    } catch (err) {
        console.error('Error getting roles:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Preview merged permissions for selected roles
router.post('/api/preview-permissions', async (req, res) => {
    try {
        const { roleIds } = req.body;
        const pool = await sql.connect(dbConfig);
        
        if (!roleIds || roleIds.length === 0) {
            await pool.close();
            return res.json({ success: true, permissions: [], summary: { total: 0, canView: 0, canCreate: 0, canEdit: 0, canDelete: 0 } });
        }
        
        // Get merged permissions from selected roles
        const roleIdList = roleIds.join(',');
        const result = await pool.request()
            .query(`
                SELECT f.FormCode, f.FormName, f.ModuleName,
                       MAX(CAST(rfa.CanView AS INT)) as CanView,
                       MAX(CAST(rfa.CanCreate AS INT)) as CanCreate,
                       MAX(CAST(rfa.CanEdit AS INT)) as CanEdit,
                       MAX(CAST(rfa.CanDelete AS INT)) as CanDelete
                FROM RoleFormAccess rfa
                JOIN Forms f ON rfa.FormCode = f.FormCode
                WHERE rfa.RoleId IN (${roleIdList})
                GROUP BY f.FormCode, f.FormName, f.ModuleName
                ORDER BY f.ModuleName, f.FormName
            `);
        
        const permissions = result.recordset;
        const summary = {
            total: permissions.length,
            canView: permissions.filter(p => p.CanView).length,
            canCreate: permissions.filter(p => p.CanCreate).length,
            canEdit: permissions.filter(p => p.CanEdit).length,
            canDelete: permissions.filter(p => p.CanDelete).length
        };
        
        await pool.close();
        res.json({ success: true, permissions, summary });
    } catch (err) {
        console.error('Error previewing permissions:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========== ROLE PERMISSIONS EDITOR ==========

// Page: Edit Role Permissions
router.get('/roles/:roleId/permissions', async (req, res) => {
    try {
        const roleId = parseInt(req.params.roleId);
        const pool = await sql.connect(dbConfig);
        
        // Get role info
        const roleResult = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                SELECT r.Id, r.RoleName, c.CategoryName
                FROM UserRoles r
                JOIN RoleCategories c ON r.CategoryId = c.Id
                WHERE r.Id = @roleId
            `);
        
        if (!roleResult.recordset.length) {
            await pool.close();
            return res.status(404).send('Role not found');
        }
        
        const role = roleResult.recordset[0];
        
        // Get all forms
        const forms = await pool.request().query('SELECT * FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
        
        // Get current role permissions
        const currentPerms = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query('SELECT * FROM RoleFormAccess WHERE RoleId = @roleId');
        
        await pool.close();
        
        const permMap = {};
        currentPerms.recordset.forEach(p => {
            permMap[p.FormCode] = p;
        });
        
        let formRows = forms.recordset.map(f => {
            const perm = permMap[f.FormCode];
            return `
                <tr>
                    <td><span class="module-badge">${f.ModuleName}</span></td>
                    <td><strong>${f.FormName}</strong><br><small style="color:#888">${f.FormCode}</small></td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canView]" value="1" ${perm?.CanView ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canCreate]" value="1" ${perm?.CanCreate ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canEdit]" value="1" ${perm?.CanEdit ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canDelete]" value="1" ${perm?.CanDelete ? 'checked' : ''}>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
<meta charset="UTF-8">
                <title>Edit Role Permissions - ${role.RoleName} - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #6f42c1 0%, #8e44ad 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
                    .role-info {
                        background: white;
                        border-radius: 15px;
                        padding: 20px 25px;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .role-icon {
                        width: 60px;
                        height: 60px;
                        background: #6f42c1;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 28px;
                    }
                    .role-details h2 { font-size: 20px; margin-bottom: 5px; }
                    .role-details p { color: #666; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .checkbox-cell { text-align: center; }
                    .checkbox-cell input[type="checkbox"] {
                        width: 20px;
                        height: 20px;
                        cursor: pointer;
                    }
                    .module-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .btn-primary { background: #6f42c1; color: white; }
                    .btn-primary:hover { background: #5a32a3; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-secondary:hover { background: #545b62; }
                    .btn-row { margin-top: 25px; display: flex; gap: 15px; }
                    .quick-actions { margin-bottom: 15px; }
                    .quick-actions button {
                        padding: 8px 15px;
                        margin-right: 10px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    .quick-actions button:hover { background: #f5f5f5; }
                    .alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .alert-info { background: #e3f2fd; color: #1565c0; }
                    .search-box {
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        width: 300px;
                        margin-bottom: 15px;
                        transition: border-color 0.3s;
                    }
                    .search-box:focus {
                        outline: none;
                        border-color: #6f42c1;
                    }
                    .filter-row {
                        display: flex;
                        gap: 15px;
                        align-items: center;
                        margin-bottom: 15px;
                        flex-wrap: wrap;
                    }
                    .filter-row label {
                        font-weight: 500;
                        color: #555;
                    }
                    .module-filter {
                        padding: 10px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        min-width: 200px;
                    }
                    .results-count {
                        color: #666;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>✏️ Edit Role Permissions</h1>
                    <div class="header-nav">
                        <a href="/admin/roles">← Back to Roles</a>
                        <a href="/admin/users">User Management</a>
                        <a href="/admin">Admin Panel</a>
                    </div>
                </div>
                <div class="container">
                    <div class="role-info">
                        <div class="role-icon">🎭</div>
                        <div class="role-details">
                            <h2>${role.RoleName}</h2>
                            <p>Category: ${role.CategoryName}</p>
                        </div>
                    </div>
                    
                    <div class="alert alert-info">
                        💡 <strong>Tip:</strong> Changes here affect what forms users with this role can access. After saving, users with this role will get updated permissions on their next role assignment.
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Form Permissions for this Role</div>
                        </div>
                        
                        <div class="filter-row">
                            <label>🔍 Search:</label>
                            <input type="text" class="search-box" id="searchForms" placeholder="Search by form name, module, or code..." oninput="filterForms()">
                            <label>📁 Module:</label>
                            <select class="module-filter" id="moduleFilter" onchange="filterForms()">
                                <option value="">All Modules</option>
                            </select>
                            <span class="results-count" id="resultsCount"></span>
                        </div>
                        
                        <div class="quick-actions">
                            <button type="button" onclick="selectAll()">✓ Select All</button>
                            <button type="button" onclick="deselectAll()">✗ Deselect All</button>
                            <button type="button" onclick="selectViewOnly()">👁 View Only</button>
                            <button type="button" onclick="selectViewCreate()">👁➕ View + Create</button>
                            <button type="button" onclick="selectFullAccess()">🔓 Full Access</button>
                        </div>
                        
                        <form action="/admin/roles/${roleId}/permissions" method="POST">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Module</th>
                                        <th>Form</th>
                                        <th style="text-align:center">👁 View</th>
                                        <th style="text-align:center">➕ Create</th>
                                        <th style="text-align:center">✏️ Edit</th>
                                        <th style="text-align:center">🗑️ Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${formRows}
                                </tbody>
                            </table>
                            
                            <div class="btn-row">
                                <button type="submit" class="btn btn-primary">💾 Save Permissions</button>
                                <a href="/admin/roles" class="btn btn-secondary">Cancel</a>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    // Populate module filter dropdown
                    document.addEventListener('DOMContentLoaded', function() {
                        const modules = new Set();
                        document.querySelectorAll('.module-badge').forEach(badge => {
                            modules.add(badge.textContent.trim());
                        });
                        const select = document.getElementById('moduleFilter');
                        Array.from(modules).sort().forEach(mod => {
                            const option = document.createElement('option');
                            option.value = mod;
                            option.textContent = mod;
                            select.appendChild(option);
                        });
                        updateResultsCount();
                    });

                    function filterForms() {
                        const searchTerm = document.getElementById('searchForms').value.toLowerCase();
                        const moduleFilter = document.getElementById('moduleFilter').value;
                        const rows = document.querySelectorAll('tbody tr');
                        
                        rows.forEach(row => {
                            const module = row.querySelector('.module-badge')?.textContent.toLowerCase() || '';
                            const formName = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
                            
                            const matchesSearch = !searchTerm || 
                                module.includes(searchTerm) || 
                                formName.includes(searchTerm);
                            const matchesModule = !moduleFilter || module.includes(moduleFilter.toLowerCase());
                            
                            row.style.display = (matchesSearch && matchesModule) ? '' : 'none';
                        });
                        updateResultsCount();
                    }

                    function updateResultsCount() {
                        const total = document.querySelectorAll('tbody tr').length;
                        const visible = document.querySelectorAll('tbody tr:not([style*="display: none"])').length;
                        document.getElementById('resultsCount').textContent = 
                            visible === total ? \`Showing all \${total} forms\` : \`Showing \${visible} of \${total} forms\`;
                    }

                    function selectAll() {
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[type="checkbox"]').forEach(cb => cb.checked = true);
                    }
                    function deselectAll() {
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[type="checkbox"]').forEach(cb => cb.checked = false);
                    }
                    function selectViewOnly() {
                        deselectAll();
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[name*="[canView]"]').forEach(cb => cb.checked = true);
                    }
                    function selectViewCreate() {
                        deselectAll();
                        document.querySelectorAll('tbody tr:not([style*="display: none"]) input[name*="[canView]"], tbody tr:not([style*="display: none"]) input[name*="[canCreate]"]').forEach(cb => cb.checked = true);
                    }
                    function selectFullAccess() {
                        selectAll();
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading role permissions editor:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Save Role Permissions
router.post('/roles/:roleId/permissions', async (req, res) => {
    try {
        const roleId = parseInt(req.params.roleId);
        const forms = req.body.forms || {};
        
        const pool = await sql.connect(dbConfig);
        
        // Delete existing permissions for this role
        await pool.request()
            .input('roleId', sql.Int, roleId)
            .query('DELETE FROM RoleFormAccess WHERE RoleId = @roleId');
        
        // Insert new permissions
        for (const [formCode, perms] of Object.entries(forms)) {
            const canView = perms.canView === '1' ? 1 : 0;
            const canCreate = perms.canCreate === '1' ? 1 : 0;
            const canEdit = perms.canEdit === '1' ? 1 : 0;
            const canDelete = perms.canDelete === '1' ? 1 : 0;
            
            // Only insert if at least one permission is granted
            if (canView || canCreate || canEdit || canDelete) {
                await pool.request()
                    .input('roleId', sql.Int, roleId)
                    .input('formCode', sql.NVarChar, formCode)
                    .input('canView', sql.Bit, canView)
                    .input('canCreate', sql.Bit, canCreate)
                    .input('canEdit', sql.Bit, canEdit)
                    .input('canDelete', sql.Bit, canDelete)
                    .query(`
                        INSERT INTO RoleFormAccess (RoleId, FormCode, CanView, CanCreate, CanEdit, CanDelete, CreatedAt)
                        VALUES (@roleId, @formCode, @canView, @canCreate, @canEdit, @canDelete, GETDATE())
                    `);
            }
        }
        
        // Re-sync permissions for all users who have this role
        await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                DECLARE @UserId INT;
                DECLARE user_cursor CURSOR FOR 
                    SELECT UserId FROM UserRoleAssignments WHERE RoleId = @roleId;
                
                OPEN user_cursor;
                FETCH NEXT FROM user_cursor INTO @UserId;
                
                WHILE @@FETCH_STATUS = 0
                BEGIN
                    EXEC SyncUserPermissions @UserId;
                    FETCH NEXT FROM user_cursor INTO @UserId;
                END;
                
                CLOSE user_cursor;
                DEALLOCATE user_cursor;
            `);
        
        await pool.close();
        
        console.log(`✅ Updated permissions for role ${roleId} and synced affected users`);
        res.redirect('/admin/roles?success=1');
    } catch (err) {
        console.error('Error saving role permissions:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Approve a user
router.post('/users/:userId/approve', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('UPDATE Users SET IsApproved = 1 WHERE Id = @userId');
        
        // Get user info for logging
        const user = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT DisplayName, Email FROM Users WHERE Id = @userId');
        
        await pool.close();
        
        console.log(`✅ User approved: ${user.recordset[0]?.DisplayName} (${user.recordset[0]?.Email})`);
        res.json({ success: true, message: 'User approved successfully' });
    } catch (err) {
        console.error('Error approving user:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update user department
router.post('/users/:userId/department', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { department } = req.body;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('department', sql.NVarChar, department || null)
            .query('UPDATE Users SET Department = @department WHERE Id = @userId');
        
        await pool.close();
        
        console.log(`✅ User ${userId} department updated to: ${department || 'None'}`);
        res.json({ success: true, message: 'Department updated successfully' });
    } catch (err) {
        console.error('Error updating user department:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get available departments
router.get('/departments', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get departments from DepartmentContacts + existing user departments
        const result = await pool.request().query(`
            SELECT DISTINCT Department FROM (
                SELECT Department FROM DepartmentContacts WHERE Department IS NOT NULL
                UNION
                SELECT Department FROM Users WHERE Department IS NOT NULL AND Department != ''
            ) AS depts
            ORDER BY Department
        `);
        
        await pool.close();
        
        res.json({ success: true, departments: result.recordset.map(r => r.Department) });
    } catch (err) {
        console.error('Error getting departments:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update user roles (multi-role support)
router.post('/users/update-roles', async (req, res) => {
    try {
        const { userId, roleIds } = req.body;
        const pool = await sql.connect(dbConfig);
        
        // Delete existing role assignments
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM UserRoleAssignments WHERE UserId = @userId');
        
        // Insert new role assignments
        if (roleIds && roleIds.length > 0) {
            for (const roleId of roleIds) {
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('roleId', sql.Int, roleId)
                    .query('INSERT INTO UserRoleAssignments (UserId, RoleId) VALUES (@userId, @roleId)');
            }
            
            // Also update the legacy RoleId column with the first role for backward compatibility
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('roleId', sql.Int, roleIds[0])
                .query('UPDATE Users SET RoleId = @roleId WHERE Id = @userId');
        } else {
            // Clear the legacy RoleId if no roles selected
            await pool.request()
                .input('userId', sql.Int, userId)
                .query('UPDATE Users SET RoleId = NULL WHERE Id = @userId');
        }
        
        // AUTO-SYNC: Sync form permissions from assigned roles
        await pool.request()
            .input('userId', sql.Int, userId)
            .execute('SyncUserPermissions');
        
        console.log(`✅ Synced permissions for user ${userId} based on ${roleIds?.length || 0} role(s)`);
        
        await pool.close();
        res.json({ success: true, message: 'Roles and permissions synced successfully' });
    } catch (err) {
        console.error('Error updating roles:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Change user role (legacy - single role)
router.post('/users/change-role', async (req, res) => {
    try {
        const { userId, roleId } = req.body;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('roleId', sql.Int, roleId)
            .query('UPDATE Users SET RoleId = @roleId WHERE Id = @userId');
        
        await pool.close();
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Error changing role:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Sync users from SharePoint/Azure AD
router.post('/users/sync', async (req, res) => {
    try {
        console.log('[SYNC] Starting SharePoint user sync...');
        console.log('[SYNC] Using delegated token from logged-in user:', req.currentUser.email);
        
        // Get user's access token for delegated permissions
        const userToken = req.currentUser.accessToken;
        if (!userToken) {
            return res.json({
                success: false,
                error: 'No access token available. Please log out and log in again.'
            });
        }
        
        // Use SharePoint Users Service with user's token
        const spService = new SharePointUsersService(userToken);
        const allUsers = await spService.getUsers();
        
        console.log(`[SYNC] Fetched ${allUsers.length} users from SharePoint/Azure AD`);
        
        // Sync to database
        const pool = await sql.connect(dbConfig);
        let added = 0, updated = 0, skipped = 0;
        
        for (const spUser of allUsers) {
            const email = spUser.mail || spUser.userPrincipalName;
            if (!email || !email.includes('@')) {
                skipped++;
                continue;
            }
            
            // Check if user exists
            const existing = await pool.request()
                .input('email', sql.NVarChar, email.toLowerCase())
                .query('SELECT Id, DisplayName FROM Users WHERE LOWER(Email) = @email');
            
            if (existing.recordset.length > 0) {
                // Update existing user
                await pool.request()
                    .input('id', sql.Int, existing.recordset[0].Id)
                    .input('displayName', sql.NVarChar, spUser.displayName || email.split('@')[0])
                    .input('azureId', sql.NVarChar, spUser.id)
                    .query('UPDATE Users SET DisplayName = @displayName, AzureId = @azureId WHERE Id = @id');
                updated++;
            } else {
                // Insert new user
                await pool.request()
                    .input('email', sql.NVarChar, email.toLowerCase())
                    .input('displayName', sql.NVarChar, spUser.displayName || email.split('@')[0])
                    .input('azureId', sql.NVarChar, spUser.id)
                    .query(`
                        INSERT INTO Users (Email, DisplayName, AzureId, IsActive, IsApproved, CreatedAt)
                        VALUES (@email, @displayName, @azureId, 1, 1, GETDATE())
                    `);
                added++;
            }
        }
        
        await pool.close();
        
        console.log(`[SYNC] Complete - Added: ${added}, Updated: ${updated}, Skipped: ${skipped}`);
        res.json({ success: true, added, updated, skipped, total: allUsers.length });
        
    } catch (err) {
        console.error('[SYNC] Error:', err);
        res.json({ success: false, error: err.message });
    }
});

// User Form Access Management
router.get('/users/:id/forms', async (req, res) => {
    try {
        const userId = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        // Get user info
        const user = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Id, Email, DisplayName FROM Users WHERE Id = @userId');
        
        if (!user.recordset.length) {
            await pool.close();
            return res.status(404).send('User not found');
        }
        
        // Get all forms
        const forms = await pool.request().query('SELECT * FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
        
        // Get user's current form access
        const userAccess = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM UserFormAccess WHERE UserId = @userId');
        
        await pool.close();
        
        const accessMap = {};
        userAccess.recordset.forEach(a => {
            accessMap[a.FormCode] = a;
        });
        
        let formRows = forms.recordset.map(f => {
            const access = accessMap[f.FormCode];
            return `
                <tr>
                    <td><span class="module-badge">${f.ModuleName}</span></td>
                    <td><strong>${f.FormName}</strong><br><small style="color:#888">${f.FormUrl}</small></td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][enabled]" value="1" ${access ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canView]" value="1" ${access?.CanView ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canCreate]" value="1" ${access?.CanCreate ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canEdit]" value="1" ${access?.CanEdit ? 'checked' : ''}>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" name="forms[${f.FormCode}][canDelete]" value="1" ${access?.CanDelete ? 'checked' : ''}>
                    </td>
                </tr>
            `;
        }).join('');
        
        const userData = user.recordset[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
<meta charset="UTF-8">
                <title>Form Access - ${userData.DisplayName} - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
                    .user-info {
                        background: white;
                        border-radius: 15px;
                        padding: 20px 25px;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .user-avatar {
                        width: 60px;
                        height: 60px;
                        background: #0078d4;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 24px;
                        font-weight: 600;
                    }
                    .user-details h2 { font-size: 20px; margin-bottom: 5px; }
                    .user-details p { color: #666; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .checkbox-cell { text-align: center; }
                    .checkbox-cell input[type="checkbox"] {
                        width: 20px;
                        height: 20px;
                        cursor: pointer;
                    }
                    .module-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-primary:hover { background: #005a9e; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-secondary:hover { background: #545b62; }
                    .btn-row { margin-top: 25px; display: flex; gap: 15px; }
                    .quick-actions { margin-bottom: 15px; }
                    .quick-actions button {
                        padding: 8px 15px;
                        margin-right: 10px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    .quick-actions button:hover { background: #f5f5f5; }
                    .filter-section {
                        display: flex;
                        gap: 15px;
                        margin-bottom: 20px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        align-items: center;
                        flex-wrap: wrap;
                    }
                    .filter-section label {
                        font-weight: 500;
                        color: #555;
                    }
                    .filter-section select, .filter-section input {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        min-width: 200px;
                    }
                    .filter-section select:focus, .filter-section input:focus {
                        outline: none;
                        border-color: #0078d4;
                    }
                    .form-count {
                        margin-left: auto;
                        color: #666;
                        font-size: 14px;
                    }
                    tr.hidden-row { display: none; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Manage Form Access</h1>
                    <div class="header-nav">
                        <a href="/admin/users">← Back to Users</a>
                        <a href="/admin">Admin Panel</a>
                    </div>
                </div>
                <div class="container">
                    <div class="user-info">
                        <div class="user-avatar">${(userData.DisplayName || 'U').charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <h2>${userData.DisplayName || 'Unknown User'}</h2>
                            <p>${userData.Email}</p>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Form Access Permissions</div>
                        </div>
                        
                        <div class="filter-section">
                            <label>🔍 Filter by Module:</label>
                            <select id="moduleFilter" onchange="filterByModule()">
                                <option value="">All Modules</option>
                            </select>
                            <label>Search:</label>
                            <input type="text" id="searchFilter" placeholder="Search form name..." oninput="filterBySearch()">
                            <label>
                                <input type="checkbox" id="showEnabledOnly" onchange="filterForms()"> Show enabled only
                            </label>
                            <span class="form-count" id="formCount"></span>
                        </div>
                        
                        <div class="quick-actions">
                            <button type="button" onclick="selectAll()">Select All (Visible)</button>
                            <button type="button" onclick="deselectAll()">Deselect All (Visible)</button>
                            <button type="button" onclick="selectAllViewCreate()">Enable View & Create (Visible)</button>
                        </div>
                        
                        <form action="/admin/users/${userId}/forms" method="POST">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Module</th>
                                        <th>Form</th>
                                        <th style="text-align:center">Access</th>
                                        <th style="text-align:center">View</th>
                                        <th style="text-align:center">Create</th>
                                        <th style="text-align:center">Edit</th>
                                        <th style="text-align:center">Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${formRows || '<tr><td colspan="7" style="text-align:center;color:#666;">No forms available</td></tr>'}
                                </tbody>
                            </table>
                            
                            <div class="btn-row">
                                <button type="submit" class="btn btn-primary">Save Permissions</button>
                                <a href="/admin/users" class="btn btn-secondary">Cancel</a>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    // Populate module filter dropdown
                    function initFilters() {
                        const modules = new Set();
                        document.querySelectorAll('tbody tr').forEach(row => {
                            const moduleCell = row.querySelector('td:first-child .module-badge');
                            if (moduleCell) {
                                modules.add(moduleCell.textContent.trim());
                            }
                        });
                        
                        const select = document.getElementById('moduleFilter');
                        Array.from(modules).sort().forEach(mod => {
                            const option = document.createElement('option');
                            option.value = mod;
                            option.textContent = mod;
                            select.appendChild(option);
                        });
                        
                        updateFormCount();
                    }
                    
                    // Filter forms
                    function filterForms() {
                        const moduleFilter = document.getElementById('moduleFilter').value.toLowerCase();
                        const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
                        const showEnabledOnly = document.getElementById('showEnabledOnly').checked;
                        
                        document.querySelectorAll('tbody tr').forEach(row => {
                            const moduleCell = row.querySelector('td:first-child .module-badge');
                            const formCell = row.querySelector('td:nth-child(2)');
                            const enabledCheckbox = row.querySelector('input[name*="[enabled]"]');
                            
                            if (!moduleCell || !formCell) return;
                            
                            const module = moduleCell.textContent.trim().toLowerCase();
                            const formName = formCell.textContent.trim().toLowerCase();
                            const isEnabled = enabledCheckbox && enabledCheckbox.checked;
                            
                            let show = true;
                            
                            if (moduleFilter && !module.includes(moduleFilter)) show = false;
                            if (searchFilter && !formName.includes(searchFilter)) show = false;
                            if (showEnabledOnly && !isEnabled) show = false;
                            
                            row.classList.toggle('hidden-row', !show);
                        });
                        
                        updateFormCount();
                    }
                    
                    function filterByModule() { filterForms(); }
                    function filterBySearch() { filterForms(); }
                    
                    function updateFormCount() {
                        const total = document.querySelectorAll('tbody tr').length;
                        const visible = document.querySelectorAll('tbody tr:not(.hidden-row)').length;
                        const enabled = document.querySelectorAll('tbody tr input[name*="[enabled]"]:checked').length;
                        document.getElementById('formCount').textContent = \`Showing \${visible} of \${total} forms (\${enabled} enabled)\`;
                    }
                    
                    function selectAll() {
                        document.querySelectorAll('tbody tr:not(.hidden-row) input[type="checkbox"]').forEach(cb => cb.checked = true);
                        updateFormCount();
                    }
                    function deselectAll() {
                        document.querySelectorAll('tbody tr:not(.hidden-row) input[type="checkbox"]').forEach(cb => cb.checked = false);
                        updateFormCount();
                    }
                    function selectAllViewCreate() {
                        document.querySelectorAll('tbody tr:not(.hidden-row) input[name*="[enabled]"], tbody tr:not(.hidden-row) input[name*="[canView]"], tbody tr:not(.hidden-row) input[name*="[canCreate]"]').forEach(cb => cb.checked = true);
                        updateFormCount();
                    }
                    
                    // Update count when checkboxes change
                    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        cb.addEventListener('change', updateFormCount);
                    });
                    
                    // Initialize on page load
                    initFilters();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading form access:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Save User Form Access
router.post('/users/:id/forms', async (req, res) => {
    try {
        const userId = req.params.id;
        const forms = req.body.forms || {};
        
        const pool = await sql.connect(dbConfig);
        
        // Delete existing access
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM UserFormAccess WHERE UserId = @userId');
        
        // Insert new access
        for (const [formCode, permissions] of Object.entries(forms)) {
            if (permissions.enabled) {
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('formCode', sql.NVarChar, formCode)
                    .input('canView', sql.Bit, permissions.canView ? 1 : 0)
                    .input('canCreate', sql.Bit, permissions.canCreate ? 1 : 0)
                    .input('canEdit', sql.Bit, permissions.canEdit ? 1 : 0)
                    .input('canDelete', sql.Bit, permissions.canDelete ? 1 : 0)
                    .input('assignedBy', sql.Int, req.currentUser.userId)
                    .query(`
                        INSERT INTO UserFormAccess (UserId, FormCode, CanView, CanCreate, CanEdit, CanDelete, AssignedBy, AssignedAt)
                        VALUES (@userId, @formCode, @canView, @canCreate, @canEdit, @canDelete, @assignedBy, GETDATE())
                    `);
            }
        }
        
        await pool.close();
        
        // Clear form access cache so changes take effect immediately
        // (User will need to re-login for session permissions to update, but this helps for testing)
        try {
            const { clearFormMappingsCache } = require('../../gmrl-auth/middleware/require-form-access');
            clearFormMappingsCache();
        } catch (e) { /* ignore */ }
        
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Error saving form access:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Form Registry - Full CRUD
router.get('/forms', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const forms = await pool.request().query(`
            SELECT f.*, 
                   (SELECT COUNT(*) FROM RoleFormAccess WHERE FormCode = f.FormCode) as RoleCount
            FROM Forms f 
            ORDER BY f.ModuleName, f.FormName
        `);
        
        // Get distinct modules for filter
        const modules = await pool.request().query('SELECT DISTINCT ModuleName FROM Forms ORDER BY ModuleName');
        await pool.close();
        
        const successMsg = req.query.success ? '<div class="alert alert-success">✅ ' + (req.query.msg || 'Operation completed successfully!') + '</div>' : '';
        const errorMsg = req.query.error ? '<div class="alert alert-error">❌ ' + req.query.error + '</div>' : '';
        
        let formRows = forms.recordset.map(f => `
            <tr data-form-id="${f.Id}" data-module="${f.ModuleName}">
                <td>${f.Id}</td>
                <td><code style="background:#f0f0f0;padding:3px 8px;border-radius:4px;">${f.FormCode}</code></td>
                <td><strong>${f.FormName}</strong></td>
                <td><span class="module-badge">${f.ModuleName}</span></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${f.FormUrl || ''}">${f.FormUrl || '-'}</td>
                <td><span class="role-count">${f.RoleCount} roles</span></td>
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" ${f.IsActive ? 'checked' : ''} onchange="toggleFormStatus(${f.Id}, this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-primary btn-sm" onclick="editForm(${f.Id})">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteForm(${f.Id}, '${f.FormCode.replace(/'/g, "\\'")}', ${f.RoleCount})" ${f.RoleCount > 0 ? 'title="Warning: This form has role assignments"' : ''}>🗑️</button>
                </td>
            </tr>
        `).join('');
        
        let moduleOptions = modules.recordset.map(m => 
            `<option value="${m.ModuleName}">${m.ModuleName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
<meta charset="UTF-8">
                <title>Form Registry - ${process.env.APP_NAME}</title>
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a, .header-nav button {
                        color: white;
                        text-decoration: none;
                        margin-left: 15px;
                        opacity: 0.9;
                        background: rgba(255,255,255,0.15);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .header-nav a:hover, .header-nav button:hover { opacity: 1; background: rgba(255,255,255,0.25); }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; font-size: 13px; }
                    tr:hover { background: #f8f9fa; }
                    .module-badge {
                        background: #e8f5e9;
                        color: #2e7d32;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .role-count {
                        background: #e3f2fd;
                        color: #1976d2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 13px;
                        display: inline-block;
                    }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-primary:hover { background: #005a9e; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn-danger:hover { background: #c82333; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .alert-success { background: #d4edda; color: #155724; }
                    .alert-error { background: #f8d7da; color: #721c24; }
                    .actions-cell { white-space: nowrap; }
                    .actions-cell .btn { margin-right: 5px; }
                    
                    /* Toggle Switch */
                    .toggle-switch {
                        position: relative;
                        display: inline-block;
                        width: 50px;
                        height: 26px;
                    }
                    .toggle-switch input { opacity: 0; width: 0; height: 0; }
                    .toggle-slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background-color: #ccc;
                        transition: .3s;
                        border-radius: 26px;
                    }
                    .toggle-slider:before {
                        position: absolute;
                        content: "";
                        height: 20px;
                        width: 20px;
                        left: 3px;
                        bottom: 3px;
                        background-color: white;
                        transition: .3s;
                        border-radius: 50%;
                    }
                    input:checked + .toggle-slider { background-color: #28a745; }
                    input:checked + .toggle-slider:before { transform: translateX(24px); }
                    
                    /* Modal */
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0; left: 0;
                        width: 100%; height: 100%;
                        background: rgba(0,0,0,0.5);
                        justify-content: center;
                        align-items: center;
                        z-index: 1000;
                    }
                    .modal.show { display: flex; }
                    .modal-content {
                        background: white;
                        padding: 30px;
                        border-radius: 15px;
                        width: 600px;
                        max-width: 90%;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                    }
                    .modal-title { font-size: 20px; font-weight: 600; }
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
                    .form-group input, .form-group select, .form-group textarea {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
                        outline: none;
                        border-color: #0078d4;
                    }
                    .form-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                    }
                    .modal-actions {
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                        margin-top: 25px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .help-text { font-size: 12px; color: #666; margin-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Form Registry</h1>
                    <div class="header-nav">
                        <a href="/admin/forms/export" style="background:#28a745;">📥 Export CSV</a>
                        <button onclick="openCreateModal()">➕ Add New Form</button>
                        <a href="/admin">← Admin Panel</a>
                        <a href="/admin/roles">Role Management</a>
                    </div>
                </div>
                <div class="container">
                    ${successMsg}
                    ${errorMsg}
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Available Forms</div>
                            <div>Total: <span id="formCount">${forms.recordset.length}</span> forms</div>
                        </div>
                        
                        <!-- Filter Section -->
                        <div style="display:flex; gap:15px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:10px; flex-wrap:wrap; align-items:center;">
                            <div style="flex:1; min-width:200px;">
                                <input type="text" id="searchFilter" placeholder="🔍 Search form name or code..." 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;"
                                    onkeyup="filterForms()">
                            </div>
                            <div style="min-width:150px;">
                                <select id="moduleFilter" onchange="filterForms()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All Modules</option>
                                    ${moduleOptions}
                                </select>
                            </div>
                            <div style="min-width:130px;">
                                <select id="statusFilter" onchange="filterForms()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All Status</option>
                                    <option value="active">Active Only</option>
                                    <option value="inactive">Inactive Only</option>
                                </select>
                            </div>
                            <button onclick="clearFilters()" style="padding:10px 20px; background:#6c757d; color:white; border:none; border-radius:8px; cursor:pointer;">
                                ✖ Clear
                            </button>
                        </div>
                        
                        <table id="formsTable">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Form Code</th>
                                    <th>Form Name</th>
                                    <th>Module</th>
                                    <th>URL</th>
                                    <th>Roles</th>
                                    <th>Active</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${formRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Create/Edit Form Modal -->
                <div class="modal" id="formModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title" id="modalTitle">Add New Form</div>
                            <button class="modal-close" onclick="closeModal()">×</button>
                        </div>
                        <form id="formForm">
                            <input type="hidden" id="formId">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Form Code *</label>
                                    <input type="text" id="formCode" required placeholder="e.g., OHS_INSPECTION" style="text-transform:uppercase;">
                                    <div class="help-text">Unique identifier (uppercase, underscores)</div>
                                </div>
                                <div class="form-group">
                                    <label>Module Name *</label>
                                    <input type="text" id="moduleName" required placeholder="e.g., OHS" list="moduleList">
                                    <datalist id="moduleList">
                                        ${moduleOptions}
                                    </datalist>
                                    <div class="help-text">Module this form belongs to</div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Form Name *</label>
                                <input type="text" id="formName" required placeholder="e.g., OHS Inspection">
                            </div>
                            <div class="form-group">
                                <label>Form URL</label>
                                <input type="text" id="formUrl" placeholder="e.g., /ohs-inspection">
                                <div class="help-text">URL pattern for route matching (optional)</div>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea id="formDescription" rows="2" placeholder="Brief description of this form"></textarea>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="formIsActive" checked> Active
                                </label>
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                                <button type="submit" class="btn btn-success" id="submitBtn">💾 Create Form</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    let isEditMode = false;
                    let formsData = ${JSON.stringify(forms.recordset)};
                    
                    function filterForms() {
                        const searchText = document.getElementById('searchFilter').value.toLowerCase();
                        const moduleFilter = document.getElementById('moduleFilter').value;
                        const statusFilter = document.getElementById('statusFilter').value;
                        
                        const rows = document.querySelectorAll('#formsTable tbody tr');
                        let visibleCount = 0;
                        
                        rows.forEach(row => {
                            const formCode = row.cells[1].textContent.toLowerCase();
                            const formName = row.cells[2].textContent.toLowerCase();
                            const module = row.dataset.module;
                            const isActive = row.querySelector('input[type="checkbox"]').checked;
                            
                            let show = true;
                            
                            if (searchText && !formCode.includes(searchText) && !formName.includes(searchText)) {
                                show = false;
                            }
                            if (moduleFilter && module !== moduleFilter) {
                                show = false;
                            }
                            if (statusFilter === 'active' && !isActive) show = false;
                            if (statusFilter === 'inactive' && isActive) show = false;
                            
                            row.style.display = show ? '' : 'none';
                            if (show) visibleCount++;
                        });
                        
                        document.getElementById('formCount').textContent = visibleCount;
                    }
                    
                    function clearFilters() {
                        document.getElementById('searchFilter').value = '';
                        document.getElementById('moduleFilter').value = '';
                        document.getElementById('statusFilter').value = '';
                        filterForms();
                    }
                    
                    function openCreateModal() {
                        isEditMode = false;
                        document.getElementById('modalTitle').textContent = 'Add New Form';
                        document.getElementById('submitBtn').textContent = '💾 Create Form';
                        document.getElementById('formId').value = '';
                        document.getElementById('formCode').value = '';
                        document.getElementById('formCode').disabled = false;
                        document.getElementById('moduleName').value = '';
                        document.getElementById('formName').value = '';
                        document.getElementById('formUrl').value = '';
                        document.getElementById('formDescription').value = '';
                        document.getElementById('formIsActive').checked = true;
                        document.getElementById('formModal').classList.add('show');
                    }
                    
                    function editForm(id) {
                        const form = formsData.find(f => f.Id === id);
                        if (!form) return;
                        
                        isEditMode = true;
                        document.getElementById('modalTitle').textContent = 'Edit Form';
                        document.getElementById('submitBtn').textContent = '💾 Save Changes';
                        document.getElementById('formId').value = id;
                        document.getElementById('formCode').value = form.FormCode;
                        document.getElementById('formCode').disabled = true; // Can't change code
                        document.getElementById('moduleName').value = form.ModuleName;
                        document.getElementById('formName').value = form.FormName;
                        document.getElementById('formUrl').value = form.FormUrl || '';
                        document.getElementById('formDescription').value = form.Description || '';
                        document.getElementById('formIsActive').checked = form.IsActive;
                        document.getElementById('formModal').classList.add('show');
                    }
                    
                    function closeModal() {
                        document.getElementById('formModal').classList.remove('show');
                    }
                    
                    async function toggleFormStatus(id, isActive) {
                        try {
                            const response = await fetch('/admin/api/forms/' + id + '/toggle', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isActive })
                            });
                            const data = await response.json();
                            if (!data.success) {
                                alert('Error: ' + data.error);
                                // Revert toggle
                                document.querySelector('tr[data-form-id="' + id + '"] input[type="checkbox"]').checked = !isActive;
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    document.getElementById('formForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const formId = document.getElementById('formId').value;
                        const formCode = document.getElementById('formCode').value.trim().toUpperCase();
                        const moduleName = document.getElementById('moduleName').value.trim();
                        const formName = document.getElementById('formName').value.trim();
                        const formUrl = document.getElementById('formUrl').value.trim();
                        const description = document.getElementById('formDescription').value.trim();
                        const isActive = document.getElementById('formIsActive').checked;
                        
                        if (!formCode || !moduleName || !formName) {
                            alert('Please fill in all required fields');
                            return;
                        }
                        
                        const submitBtn = document.getElementById('submitBtn');
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Saving...';
                        
                        try {
                            const url = isEditMode ? '/admin/api/forms/' + formId : '/admin/api/forms';
                            const method = isEditMode ? 'PUT' : 'POST';
                            
                            const response = await fetch(url, {
                                method: method,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ formCode, moduleName, formName, formUrl, description, isActive })
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = '/admin/forms?success=1&msg=' + encodeURIComponent(data.message);
                            } else {
                                alert('Error: ' + (data.error || 'Failed to save form'));
                                submitBtn.disabled = false;
                                submitBtn.textContent = isEditMode ? '💾 Save Changes' : '💾 Create Form';
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                            submitBtn.disabled = false;
                            submitBtn.textContent = isEditMode ? '💾 Save Changes' : '💾 Create Form';
                        }
                    });
                    
                    async function deleteForm(id, code, roleCount) {
                        let msg = 'Are you sure you want to delete form "' + code + '"?';
                        if (roleCount > 0) {
                            msg += '\\n\\n⚠️ Warning: This form has ' + roleCount + ' role assignments that will also be deleted.';
                        }
                        
                        if (!confirm(msg)) return;
                        
                        try {
                            const response = await fetch('/admin/api/forms/' + id, { method: 'DELETE' });
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = '/admin/forms?success=1&msg=' + encodeURIComponent('Form deleted successfully');
                            } else {
                                alert('Error: ' + (data.error || 'Failed to delete form'));
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    // Auto-uppercase form code
                    document.getElementById('formCode').addEventListener('input', function() {
                        this.value = this.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                    });
                    
                    document.getElementById('formModal').addEventListener('click', function(e) {
                        if (e.target === this) closeModal();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading forms:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Role Management
router.get('/roles', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const roles = await pool.request().query(`
            SELECT r.*, rc.CategoryName,
                   (SELECT COUNT(*) FROM UserRoleAssignments WHERE RoleId = r.Id) as UserCount,
                   (SELECT COUNT(*) FROM RoleFormAccess WHERE RoleId = r.Id) as FormCount
            FROM UserRoles r
            LEFT JOIN RoleCategories rc ON r.CategoryId = rc.Id
            ORDER BY rc.CategoryName, r.RoleName
        `);
        
        const categories = await pool.request().query('SELECT Id, CategoryName FROM RoleCategories ORDER BY Id');
        await pool.close();
        
        const successMsg = req.query.success ? '<div class="alert alert-success">✅ ' + (req.query.msg || 'Operation completed successfully!') + '</div>' : '';
        const errorMsg = req.query.error ? '<div class="alert alert-error">❌ ' + req.query.error + '</div>' : '';
        
        let roleRows = roles.recordset.map(r => `
            <tr data-role-id="${r.Id}">
                <td>${r.Id}</td>
                <td><strong>${r.RoleName}</strong></td>
                <td><span class="category-badge">${r.CategoryName || 'Uncategorized'}</span></td>
                <td><span class="form-count">${r.FormCount} forms</span></td>
                <td><span class="user-count">${r.UserCount} users</span></td>
                <td class="actions-cell">
                    <a href="/admin/roles/${r.Id}/permissions" class="btn btn-primary btn-sm">✏️ Permissions</a>
                    <button class="btn btn-secondary btn-sm" onclick="editRole(${r.Id}, '${r.RoleName.replace(/'/g, "\\'")}', ${r.CategoryId || 'null'})">📝 Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRole(${r.Id}, '${r.RoleName.replace(/'/g, "\\'")}', ${r.UserCount})" ${r.UserCount > 0 ? 'disabled title=\"Cannot delete: role has users assigned\"' : ''}>🗑️</button>
                </td>
            </tr>
        `).join('');
        
        let categoryOptions = categories.recordset.map(c => 
            `<option value="${c.Id}">${c.CategoryName}</option>`
        ).join('');
        
        let categoryFilterOptions = categories.recordset.map(c => 
            `<option value="${c.CategoryName}">${c.CategoryName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
<meta charset="UTF-8">
                <title>Role Management - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #6f42c1 0%, #8e44ad 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a, .header-nav button {
                        color: white;
                        text-decoration: none;
                        margin-left: 15px;
                        opacity: 0.9;
                        background: rgba(255,255,255,0.15);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .header-nav a:hover, .header-nav button:hover { opacity: 1; background: rgba(255,255,255,0.25); }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-title { font-size: 20px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .category-badge {
                        background: #fff3e0;
                        color: #e65100;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .user-count {
                        background: #e3f2fd;
                        color: #1976d2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .form-count {
                        background: #f3e5f5;
                        color: #7b1fa2;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                    }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 13px;
                        display: inline-block;
                    }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
                    .btn-primary { background: #6f42c1; color: white; }
                    .btn-primary:hover { background: #5a32a3; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-secondary:hover { background: #545b62; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn-danger:hover { background: #c82333; }
                    .btn-danger:disabled { background: #e9a3a9; cursor: not-allowed; }
                    .alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .alert-success { background: #d4edda; color: #155724; }
                    .alert-error { background: #f8d7da; color: #721c24; }
                    .actions-cell { white-space: nowrap; }
                    .actions-cell .btn { margin-right: 5px; }
                    
                    /* Modal Styles */
                    .modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        justify-content: center;
                        align-items: center;
                        z-index: 1000;
                    }
                    .modal.show { display: flex; }
                    .modal-content {
                        background: white;
                        padding: 30px;
                        border-radius: 15px;
                        width: 500px;
                        max-width: 90%;
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                    }
                    .modal-title { font-size: 20px; font-weight: 600; }
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
                    .form-group input, .form-group select {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .form-group input:focus, .form-group select:focus {
                        outline: none;
                        border-color: #6f42c1;
                    }
                    .modal-actions {
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                        margin-top: 25px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔐 Role Management</h1>
                    <div class="header-nav">
                        <a href="/admin/roles/download-matrix" style="background:#28a745;">📥 Permission Matrix</a>
                        <a href="/admin/roles/export-users" style="background:#17a2b8;">📤 Export Users</a>
                        <button onclick="openCreateModal()">➕ Create New Role</button>
                        <a href="/admin">← Admin Panel</a>
                        <a href="/admin/users">User Management</a>
                    </div>
                </div>
                <div class="container">
                    ${successMsg}
                    ${errorMsg}
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">System Roles</div>
                            <div>Total: <span id="roleCount">${roles.recordset.length}</span> roles</div>
                        </div>
                        
                        <!-- Filter Section -->
                        <div style="display:flex; gap:15px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:10px; flex-wrap:wrap; align-items:center;">
                            <div style="flex:1; min-width:200px;">
                                <input type="text" id="searchFilter" placeholder="🔍 Search role name..." 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;"
                                    onkeyup="filterRoles()">
                            </div>
                            <div style="min-width:180px;">
                                <select id="categoryFilter" onchange="filterRoles()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All Categories</option>
                                    ${categoryFilterOptions}
                                </select>
                            </div>
                            <div style="min-width:150px;">
                                <select id="formsFilter" onchange="filterRoles()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All Form Counts</option>
                                    <option value="0">No forms (0)</option>
                                    <option value="1-5">1-5 forms</option>
                                    <option value="6-20">6-20 forms</option>
                                    <option value="21+">21+ forms</option>
                                </select>
                            </div>
                            <div style="min-width:150px;">
                                <select id="usersFilter" onchange="filterRoles()" 
                                    style="width:100%; padding:10px 15px; border:1px solid #ddd; border-radius:8px; font-size:14px;">
                                    <option value="">All User Counts</option>
                                    <option value="0">No users (0)</option>
                                    <option value="1-5">1-5 users</option>
                                    <option value="6+">6+ users</option>
                                </select>
                            </div>
                            <button onclick="clearFilters()" style="padding:10px 20px; background:#6c757d; color:white; border:none; border-radius:8px; cursor:pointer;">
                                ✖ Clear
                            </button>
                        </div>
                        
                        <table id="rolesTable">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Role Name</th>
                                    <th>Category</th>
                                    <th>Forms Access</th>
                                    <th>Users</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roleRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Create/Edit Role Modal -->
                <div class="modal" id="roleModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title" id="modalTitle">Create New Role</div>
                            <button class="modal-close" onclick="closeModal()">×</button>
                        </div>
                        <form id="roleForm">
                            <input type="hidden" id="roleId" name="roleId">
                            <div class="form-group">
                                <label for="roleName">Role Name *</label>
                                <input type="text" id="roleName" name="roleName" required placeholder="e.g., Quality Inspector">
                            </div>
                            <div class="form-group">
                                <label for="categoryId">Category *</label>
                                <select id="categoryId" name="categoryId" required>
                                    <option value="">-- Select Category --</option>
                                    ${categoryOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="description">Description</label>
                                <input type="text" id="description" name="description" placeholder="Brief description of this role">
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                                <button type="submit" class="btn btn-success" id="submitBtn">💾 Create Role</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    let isEditMode = false;
                    
                    // Filter functions
                    function filterRoles() {
                        const searchText = document.getElementById('searchFilter').value.toLowerCase();
                        const categoryFilter = document.getElementById('categoryFilter').value;
                        const formsFilter = document.getElementById('formsFilter').value;
                        const usersFilter = document.getElementById('usersFilter').value;
                        
                        const rows = document.querySelectorAll('#rolesTable tbody tr');
                        let visibleCount = 0;
                        
                        rows.forEach(row => {
                            const roleName = row.cells[1].textContent.toLowerCase();
                            const category = row.cells[2].textContent.trim();
                            const formCount = parseInt(row.cells[3].textContent) || 0;
                            const userCount = parseInt(row.cells[4].textContent) || 0;
                            
                            let show = true;
                            
                            // Search filter
                            if (searchText && !roleName.includes(searchText)) {
                                show = false;
                            }
                            
                            // Category filter
                            if (categoryFilter && !category.includes(categoryFilter)) {
                                show = false;
                            }
                            
                            // Forms count filter
                            if (formsFilter) {
                                if (formsFilter === '0' && formCount !== 0) show = false;
                                else if (formsFilter === '1-5' && (formCount < 1 || formCount > 5)) show = false;
                                else if (formsFilter === '6-20' && (formCount < 6 || formCount > 20)) show = false;
                                else if (formsFilter === '21+' && formCount < 21) show = false;
                            }
                            
                            // Users count filter
                            if (usersFilter) {
                                if (usersFilter === '0' && userCount !== 0) show = false;
                                else if (usersFilter === '1-5' && (userCount < 1 || userCount > 5)) show = false;
                                else if (usersFilter === '6+' && userCount < 6) show = false;
                            }
                            
                            row.style.display = show ? '' : 'none';
                            if (show) visibleCount++;
                        });
                        
                        document.getElementById('roleCount').textContent = visibleCount;
                    }
                    
                    function clearFilters() {
                        document.getElementById('searchFilter').value = '';
                        document.getElementById('categoryFilter').value = '';
                        document.getElementById('formsFilter').value = '';
                        document.getElementById('usersFilter').value = '';
                        filterRoles();
                    }
                    
                    function openCreateModal() {
                        isEditMode = false;
                        document.getElementById('modalTitle').textContent = 'Create New Role';
                        document.getElementById('submitBtn').textContent = '💾 Create Role';
                        document.getElementById('roleId').value = '';
                        document.getElementById('roleName').value = '';
                        document.getElementById('categoryId').value = '';
                        document.getElementById('description').value = '';
                        document.getElementById('roleModal').classList.add('show');
                    }
                    
                    function editRole(id, name, categoryId) {
                        isEditMode = true;
                        document.getElementById('modalTitle').textContent = 'Edit Role';
                        document.getElementById('submitBtn').textContent = '💾 Save Changes';
                        document.getElementById('roleId').value = id;
                        document.getElementById('roleName').value = name;
                        document.getElementById('categoryId').value = categoryId || '';
                        document.getElementById('roleModal').classList.add('show');
                    }
                    
                    function closeModal() {
                        document.getElementById('roleModal').classList.remove('show');
                    }
                    
                    document.getElementById('roleForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const roleId = document.getElementById('roleId').value;
                        const roleName = document.getElementById('roleName').value.trim();
                        const categoryId = document.getElementById('categoryId').value;
                        const description = document.getElementById('description').value.trim();
                        
                        if (!roleName || !categoryId) {
                            alert('Please fill in all required fields');
                            return;
                        }
                        
                        const submitBtn = document.getElementById('submitBtn');
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Saving...';
                        
                        try {
                            const url = isEditMode ? '/admin/api/roles/' + roleId : '/admin/api/roles';
                            const method = isEditMode ? 'PUT' : 'POST';
                            
                            const response = await fetch(url, {
                                method: method,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roleName, categoryId, description })
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = '/admin/roles?success=1&msg=' + encodeURIComponent(data.message);
                            } else {
                                alert('Error: ' + (data.error || 'Failed to save role'));
                                submitBtn.disabled = false;
                                submitBtn.textContent = isEditMode ? '💾 Save Changes' : '💾 Create Role';
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                            submitBtn.disabled = false;
                            submitBtn.textContent = isEditMode ? '💾 Save Changes' : '💾 Create Role';
                        }
                    });
                    
                    async function deleteRole(id, name, userCount) {
                        if (userCount > 0) {
                            alert('Cannot delete role "' + name + '" because it has ' + userCount + ' users assigned.');
                            return;
                        }
                        
                        if (!confirm('Are you sure you want to delete the role "' + name + '"?\\n\\nThis will also delete all form permissions for this role.')) {
                            return;
                        }
                        
                        try {
                            const response = await fetch('/admin/api/roles/' + id, {
                                method: 'DELETE'
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = '/admin/roles?success=1&msg=' + encodeURIComponent('Role deleted successfully');
                            } else {
                                alert('Error: ' + (data.error || 'Failed to delete role'));
                            }
                        } catch (err) {
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    // Close modal on outside click
                    document.getElementById('roleModal').addEventListener('click', function(e) {
                        if (e.target === this) closeModal();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading roles:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// Role API Endpoints
// ==========================================

// Create new role
router.post('/api/roles', async (req, res) => {
    try {
        const { roleName, categoryId, description } = req.body;
        
        if (!roleName || !categoryId) {
            return res.json({ success: false, error: 'Role name and category are required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Check if role name already exists
        const existing = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .query('SELECT Id FROM UserRoles WHERE RoleName = @roleName');
        
        if (existing.recordset.length > 0) {
            await pool.close();
            return res.json({ success: false, error: 'A role with this name already exists' });
        }
        
        // Insert new role
        const result = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .input('categoryId', sql.Int, categoryId)
            .input('description', sql.NVarChar, description || null)
            .query(`
                INSERT INTO UserRoles (RoleName, CategoryId, Description, CreatedAt)
                OUTPUT INSERTED.Id
                VALUES (@roleName, @categoryId, @description, GETDATE())
            `);
        
        await pool.close();
        
        const newId = result.recordset[0].Id;
        console.log(`✅ Role created: ${roleName} (ID: ${newId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Role created successfully', roleId: newId });
        
    } catch (err) {
        console.error('Error creating role:', err);
        res.json({ success: false, error: err.message });
    }
});

// Update existing role
router.put('/api/roles/:id', async (req, res) => {
    try {
        const roleId = req.params.id;
        const { roleName, categoryId, description } = req.body;
        
        if (!roleName || !categoryId) {
            return res.json({ success: false, error: 'Role name and category are required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Check if role exists
        const existing = await pool.request()
            .input('id', sql.Int, roleId)
            .query('SELECT Id FROM UserRoles WHERE Id = @id');
        
        if (existing.recordset.length === 0) {
            await pool.close();
            return res.json({ success: false, error: 'Role not found' });
        }
        
        // Check if new name conflicts with another role
        const nameConflict = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .input('id', sql.Int, roleId)
            .query('SELECT Id FROM UserRoles WHERE RoleName = @roleName AND Id != @id');
        
        if (nameConflict.recordset.length > 0) {
            await pool.close();
            return res.json({ success: false, error: 'Another role with this name already exists' });
        }
        
        // Update role
        await pool.request()
            .input('id', sql.Int, roleId)
            .input('roleName', sql.NVarChar, roleName)
            .input('categoryId', sql.Int, categoryId)
            .input('description', sql.NVarChar, description || null)
            .query(`
                UPDATE UserRoles 
                SET RoleName = @roleName, CategoryId = @categoryId, Description = @description
                WHERE Id = @id
            `);
        
        await pool.close();
        
        console.log(`✅ Role updated: ${roleName} (ID: ${roleId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Role updated successfully' });
        
    } catch (err) {
        console.error('Error updating role:', err);
        res.json({ success: false, error: err.message });
    }
});

// Delete role
router.delete('/api/roles/:id', async (req, res) => {
    try {
        const roleId = req.params.id;
        
        const pool = await sql.connect(dbConfig);
        
        // Check if role has users assigned
        const userCheck = await pool.request()
            .input('id', sql.Int, roleId)
            .query('SELECT COUNT(*) as cnt FROM UserRoleAssignments WHERE RoleId = @id');
        
        if (userCheck.recordset[0].cnt > 0) {
            await pool.close();
            return res.json({ success: false, error: 'Cannot delete role: it has users assigned' });
        }
        
        // Delete role permissions first
        await pool.request()
            .input('id', sql.Int, roleId)
            .query('DELETE FROM RoleFormAccess WHERE RoleId = @id');
        
        // Delete the role
        await pool.request()
            .input('id', sql.Int, roleId)
            .query('DELETE FROM UserRoles WHERE Id = @id');
        
        await pool.close();
        
        console.log(`✅ Role deleted (ID: ${roleId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Role deleted successfully' });
        
    } catch (err) {
        console.error('Error deleting role:', err);
        res.json({ success: false, error: err.message });
    }
});

// ==========================================
// Forms API Endpoints
// ==========================================

// Create new form
router.post('/api/forms', async (req, res) => {
    try {
        const { formCode, moduleName, formName, formUrl, description, isActive } = req.body;
        
        if (!formCode || !moduleName || !formName) {
            return res.json({ success: false, error: 'Form code, module name, and form name are required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Check if form code already exists
        const existing = await pool.request()
            .input('formCode', sql.NVarChar, formCode)
            .query('SELECT Id FROM Forms WHERE FormCode = @formCode');
        
        if (existing.recordset.length > 0) {
            await pool.close();
            return res.json({ success: false, error: 'A form with this code already exists' });
        }
        
        // Insert new form
        await pool.request()
            .input('formCode', sql.NVarChar, formCode)
            .input('formName', sql.NVarChar, formName)
            .input('moduleName', sql.NVarChar, moduleName)
            .input('formUrl', sql.NVarChar, formUrl || null)
            .input('description', sql.NVarChar, description || null)
            .input('isActive', sql.Bit, isActive !== false)
            .query(`
                INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, CreatedAt)
                VALUES (@formCode, @formName, @moduleName, @formUrl, @description, @isActive, GETDATE())
            `);
        
        await pool.close();
        
        console.log(`✅ Form created (${formCode}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Form created successfully' });
        
    } catch (err) {
        console.error('Error creating form:', err);
        res.json({ success: false, error: err.message });
    }
});

// Update form
router.put('/api/forms/:id', async (req, res) => {
    try {
        const formId = req.params.id;
        const { moduleName, formName, formUrl, description, isActive } = req.body;
        
        if (!moduleName || !formName) {
            return res.json({ success: false, error: 'Module name and form name are required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, formId)
            .input('formName', sql.NVarChar, formName)
            .input('moduleName', sql.NVarChar, moduleName)
            .input('formUrl', sql.NVarChar, formUrl || null)
            .input('description', sql.NVarChar, description || null)
            .input('isActive', sql.Bit, isActive !== false)
            .query(`
                UPDATE Forms 
                SET FormName = @formName, 
                    ModuleName = @moduleName, 
                    FormUrl = @formUrl, 
                    Description = @description, 
                    IsActive = @isActive,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        
        await pool.close();
        
        console.log(`✅ Form updated (ID: ${formId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Form updated successfully' });
        
    } catch (err) {
        console.error('Error updating form:', err);
        res.json({ success: false, error: err.message });
    }
});

// Toggle form active status
router.post('/api/forms/:id/toggle', async (req, res) => {
    try {
        const formId = req.params.id;
        const { isActive } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, formId)
            .input('isActive', sql.Bit, isActive)
            .query('UPDATE Forms SET IsActive = @isActive, UpdatedAt = GETDATE() WHERE Id = @id');
        
        await pool.close();
        
        console.log(`✅ Form ${isActive ? 'activated' : 'deactivated'} (ID: ${formId}) by ${req.currentUser.email}`);
        
        res.json({ success: true });
        
    } catch (err) {
        console.error('Error toggling form status:', err);
        res.json({ success: false, error: err.message });
    }
});

// Delete form
router.delete('/api/forms/:id', async (req, res) => {
    try {
        const formId = req.params.id;
        
        const pool = await sql.connect(dbConfig);
        
        // Get the FormCode for this form
        const formResult = await pool.request()
            .input('id', sql.Int, formId)
            .query('SELECT FormCode FROM Forms WHERE Id = @id');
        
        if (formResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ success: false, error: 'Form not found' });
        }
        
        const formCode = formResult.recordset[0].FormCode;
        
        // Delete role permissions for this form first
        await pool.request()
            .input('formCode', sql.NVarChar, formCode)
            .query('DELETE FROM RoleFormAccess WHERE FormCode = @formCode');
        
        // Delete user form access
        await pool.request()
            .input('formCode', sql.NVarChar, formCode)
            .query('DELETE FROM UserFormAccess WHERE FormCode = @formCode');
        
        // Delete the form
        await pool.request()
            .input('id', sql.Int, formId)
            .query('DELETE FROM Forms WHERE Id = @id');
        
        await pool.close();
        
        console.log(`✅ Form deleted (ID: ${formId}) by ${req.currentUser.email}`);
        
        res.json({ success: true, message: 'Form deleted successfully' });
        
    } catch (err) {
        console.error('Error deleting form:', err);
        res.json({ success: false, error: err.message });
    }
});

// Export forms to CSV
router.get('/forms/export', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const forms = await pool.request().query(`
            SELECT 
                f.Id,
                f.FormCode,
                f.FormName,
                f.ModuleName,
                f.FormUrl,
                f.Description,
                CASE WHEN f.IsActive = 1 THEN 'Active' ELSE 'Inactive' END as Status,
                (SELECT COUNT(*) FROM RoleFormAccess WHERE FormCode = f.FormCode) as RoleCount,
                FORMAT(f.CreatedAt, 'yyyy-MM-dd HH:mm') as CreatedAt
            FROM Forms f 
            ORDER BY f.ModuleName, f.FormName
        `);
        await pool.close();
        
        // Generate CSV
        const headers = ['ID', 'Form Code', 'Form Name', 'Module', 'URL', 'Description', 'Status', 'Roles Assigned', 'Created At'];
        let csv = headers.join(',') + '\\n';
        
        forms.recordset.forEach(f => {
            csv += [
                f.Id,
                '"' + (f.FormCode || '').replace(/"/g, '""') + '"',
                '"' + (f.FormName || '').replace(/"/g, '""') + '"',
                '"' + (f.ModuleName || '').replace(/"/g, '""') + '"',
                '"' + (f.FormUrl || '').replace(/"/g, '""') + '"',
                '"' + (f.Description || '').replace(/"/g, '""') + '"',
                f.Status,
                f.RoleCount,
                f.CreatedAt || ''
            ].join(',') + '\\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=forms-registry-' + new Date().toISOString().split('T')[0] + '.csv');
        res.send(csv);
        
    } catch (err) {
        console.error('Error exporting forms:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// Cache Management API
// ==========================================

// Clear form access cache (call after updating Forms table or UserFormAccess)
router.post('/api/clear-cache', (req, res) => {
    try {
        const { clearFormMappingsCache } = require('../../gmrl-auth/middleware/require-form-access');
        clearFormMappingsCache();
        res.json({ success: true, message: 'Form access cache cleared' });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ==========================================
// User Impersonation (Admin Only)
// ==========================================

// Impersonate user page
router.get('/impersonate', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const users = await pool.request().query(`
            SELECT u.Id, u.Email, u.DisplayName, u.IsActive, u.IsApproved,
                   (SELECT STRING_AGG(r.RoleName, ', ') FROM UserRoleAssignments ura 
                    JOIN UserRoles r ON ura.RoleId = r.Id WHERE ura.UserId = u.Id) as RoleNames
            FROM Users u
            WHERE u.IsActive = 1 AND u.IsApproved = 1
            ORDER BY u.DisplayName
        `);
        await pool.close();
        
        const currentImpersonation = req.cookies.impersonate_user_id;
        const isImpersonating = !!currentImpersonation;
        
        // Create JSON array for search
        const usersJson = JSON.stringify(users.recordset.map(u => ({
            id: u.Id,
            name: u.DisplayName,
            email: u.Email,
            roles: u.RoleNames || 'No roles'
        })));
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
<meta charset="UTF-8">
                <title>Impersonate User - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.8;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 800px; margin: 0 auto; padding: 30px 20px; }
                    .card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }
                    .warning-box {
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 25px;
                    }
                    .warning-box h3 { color: #856404; margin-bottom: 10px; }
                    .warning-box p { color: #856404; font-size: 14px; }
                    .form-group { margin-bottom: 25px; }
                    .form-group label { display: block; margin-bottom: 10px; font-weight: 600; font-size: 16px; }
                    .search-container { position: relative; }
                    .search-input {
                        width: 100%;
                        padding: 15px;
                        border: 2px solid #ddd;
                        border-radius: 10px;
                        font-size: 14px;
                    }
                    .search-input:focus { border-color: #e74c3c; outline: none; }
                    .search-results {
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        background: white;
                        border: 2px solid #e74c3c;
                        border-top: none;
                        border-radius: 0 0 10px 10px;
                        max-height: 300px;
                        overflow-y: auto;
                        display: none;
                        z-index: 100;
                    }
                    .search-results.show { display: block; }
                    .search-item {
                        padding: 12px 15px;
                        cursor: pointer;
                        border-bottom: 1px solid #eee;
                    }
                    .search-item:hover { background: #f8f9fa; }
                    .search-item.selected { background: #e8f4f8; }
                    .search-item-name { font-weight: 600; color: #333; }
                    .search-item-email { font-size: 12px; color: #666; }
                    .search-item-roles { font-size: 11px; color: #888; margin-top: 3px; }
                    .selected-user {
                        background: #d4edda;
                        border: 2px solid #28a745;
                        border-radius: 10px;
                        padding: 15px;
                        margin-top: 15px;
                        display: none;
                    }
                    .selected-user.show { display: block; }
                    .selected-user strong { color: #155724; }
                    .btn {
                        padding: 15px 30px;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        margin-right: 10px;
                    }
                    .btn-danger { background: #e74c3c; color: white; }
                    .btn-danger:hover { background: #c0392b; }
                    .btn-success { background: #27ae60; color: white; }
                    .btn-success:hover { background: #1e8449; }
                    .btn-secondary { background: #95a5a6; color: white; }
                    .btn-secondary:hover { background: #7f8c8d; }
                    .current-status {
                        background: ${isImpersonating ? '#d4edda' : '#f8f9fa'};
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 25px;
                    }
                    .current-status h4 { margin-bottom: 10px; color: ${isImpersonating ? '#155724' : '#333'}; }
                    .user-count { font-size: 12px; color: #888; margin-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎭 User Impersonation</h1>
                    <div class="header-nav">
                        <a href="/admin">← Admin Panel</a>
                        <a href="/admin/users">User Management</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="warning-box">
                            <h3>⚠️ Admin Testing Feature</h3>
                            <p>This allows you to view the app as another user to test their permissions. 
                               Your admin session remains active - you're just seeing what they would see.</p>
                        </div>
                        
                        <div class="current-status">
                            <h4>${isImpersonating ? '🎭 Currently Impersonating' : '👤 Normal Mode'}</h4>
                            <p>${isImpersonating ? 'You are viewing the app as another user. Click "Stop Impersonating" to return to normal.' : 'Search for a user below to test their permissions.'}</p>
                        </div>
                        
                        <form action="/admin/impersonate/start" method="POST" id="impersonateForm">
                            <div class="form-group">
                                <label>🔍 Search User to Impersonate:</label>
                                <div class="search-container">
                                    <input type="text" class="search-input" id="userSearch" placeholder="Type name or email to search..." autocomplete="off">
                                    <input type="hidden" name="userId" id="selectedUserId" required>
                                    <div class="search-results" id="searchResults"></div>
                                </div>
                                <div class="user-count">${users.recordset.length} users available</div>
                                <div class="selected-user" id="selectedUserDisplay">
                                    <strong>Selected:</strong> <span id="selectedUserName"></span>
                                </div>
                            </div>
                            <div>
                                <button type="submit" class="btn btn-danger" id="submitBtn" disabled>🎭 Start Impersonating</button>
                                ${isImpersonating ? '<a href="/admin/impersonate/stop" class="btn btn-success">✓ Stop Impersonating</a>' : ''}
                                <a href="/admin" class="btn btn-secondary">Cancel</a>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    const users = ${usersJson};
                    const searchInput = document.getElementById('userSearch');
                    const searchResults = document.getElementById('searchResults');
                    const selectedUserId = document.getElementById('selectedUserId');
                    const selectedUserDisplay = document.getElementById('selectedUserDisplay');
                    const selectedUserName = document.getElementById('selectedUserName');
                    const submitBtn = document.getElementById('submitBtn');
                    
                    searchInput.addEventListener('input', function() {
                        const query = this.value.toLowerCase().trim();
                        
                        if (query.length < 2) {
                            searchResults.classList.remove('show');
                            return;
                        }
                        
                        const filtered = users.filter(u => 
                            u.name.toLowerCase().includes(query) || 
                            u.email.toLowerCase().includes(query)
                        ).slice(0, 20);
                        
                        if (filtered.length === 0) {
                            searchResults.innerHTML = '<div class="search-item" style="color:#999;">No users found</div>';
                        } else {
                            searchResults.innerHTML = filtered.map(u => \`
                                <div class="search-item" data-id="\${u.id}" data-name="\${u.name}" data-email="\${u.email}">
                                    <div class="search-item-name">\${u.name}</div>
                                    <div class="search-item-email">\${u.email}</div>
                                    <div class="search-item-roles">\${u.roles}</div>
                                </div>
                            \`).join('');
                        }
                        
                        searchResults.classList.add('show');
                    });
                    
                    searchResults.addEventListener('click', function(e) {
                        const item = e.target.closest('.search-item');
                        if (item && item.dataset.id) {
                            selectedUserId.value = item.dataset.id;
                            searchInput.value = item.dataset.name + ' (' + item.dataset.email + ')';
                            selectedUserName.textContent = item.dataset.name + ' (' + item.dataset.email + ')';
                            selectedUserDisplay.classList.add('show');
                            searchResults.classList.remove('show');
                            submitBtn.disabled = false;
                        }
                    });
                    
                    // Close dropdown when clicking outside
                    document.addEventListener('click', function(e) {
                        if (!e.target.closest('.search-container')) {
                            searchResults.classList.remove('show');
                        }
                    });
                    
                    // Show all users on focus if empty
                    searchInput.addEventListener('focus', function() {
                        if (this.value.length < 2) {
                            searchResults.innerHTML = users.slice(0, 20).map(u => \`
                                <div class="search-item" data-id="\${u.id}" data-name="\${u.name}" data-email="\${u.email}">
                                    <div class="search-item-name">\${u.name}</div>
                                    <div class="search-item-email">\${u.email}</div>
                                    <div class="search-item-roles">\${u.roles}</div>
                                </div>
                            \`).join('') + '<div class="search-item" style="color:#999;font-size:11px;">Type to search more...</div>';
                            searchResults.classList.add('show');
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading impersonate page:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Start impersonation
router.post('/impersonate/start', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.redirect('/admin/impersonate?error=No user selected');
        }
        
        // Set impersonation cookie (admin session stays, but we'll load this user's permissions)
        res.cookie('impersonate_user_id', userId, {
            httpOnly: true,
            secure: process.env.APP_URL?.startsWith('https'),
            maxAge: 60 * 60 * 1000 // 1 hour
        });
        
        console.log(`🎭 Admin ${req.currentUser.email} started impersonating user ID ${userId}`);
        
        res.redirect('/dashboard');
        
    } catch (err) {
        console.error('Error starting impersonation:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Stop impersonation
router.get('/impersonate/stop', (req, res) => {
    res.clearCookie('impersonate_user_id');
    console.log(`🎭 Admin ${req.currentUser.email} stopped impersonating`);
    res.redirect('/admin/impersonate');
});

// ==========================================
// Broadcast Routes
// ==========================================

// Broadcast page
router.get('/broadcast', requireSysAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get available roles
        const rolesResult = await pool.request().query(`
            SELECT Id, RoleName FROM UserRoles ORDER BY RoleName
        `);
        
        // Get recent broadcasts
        const broadcastsResult = await pool.request().query(`
            SELECT TOP 20 
                b.Id, b.Title, b.Message, b.TargetRoles, b.Priority,
                b.CreatedAt, b.ExpiresAt, b.IsActive,
                u.DisplayName as CreatedByName,
                (SELECT COUNT(*) FROM BroadcastReadStatus brs WHERE brs.BroadcastId = b.Id) as ReadCount
            FROM Broadcasts b
            JOIN Users u ON b.CreatedBy = u.Id
            ORDER BY b.CreatedAt DESC
        `);
        
        await pool.close();
        
        const roleOptions = rolesResult.recordset.map(r => 
            `<option value="${r.RoleName}">${r.RoleName}</option>`
        ).join('');
        
        const broadcastRows = broadcastsResult.recordset.map(b => `
            <tr>
                <td><strong>${b.Title}</strong></td>
                <td><span class="role-badges">${b.TargetRoles.split(',').map(r => `<span class="role-badge">${r.trim()}</span>`).join('')}</span></td>
                <td><span class="priority-${b.Priority.toLowerCase()}">${b.Priority}</span></td>
                <td>${b.CreatedByName}</td>
                <td>${new Date(b.CreatedAt).toLocaleString()}</td>
                <td>${b.ReadCount} read</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteBroadcast(${b.Id})">Delete</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center;color:#666;">No broadcasts yet</td></tr>';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
<meta charset="UTF-8">
                <title>Send Broadcast - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        margin-bottom: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    }
                    .card-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
                    .form-group input, .form-group select, .form-group textarea {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .form-group textarea { min-height: 120px; resize: vertical; }
                    .checkbox-group { display: flex; flex-wrap: wrap; gap: 15px; }
                    .checkbox-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 15px;
                        background: #f5f5f5;
                        border-radius: 6px;
                        cursor: pointer;
                    }
                    .checkbox-item:hover { background: #e8e8e8; }
                    .checkbox-item input { width: auto; }
                    .btn {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; }
                    .role-badge {
                        display: inline-block;
                        padding: 3px 10px;
                        background: #e3f2fd;
                        color: #1976d2;
                        border-radius: 12px;
                        font-size: 12px;
                        margin: 2px;
                    }
                    .priority-high { color: #dc3545; font-weight: 600; }
                    .priority-normal { color: #6c757d; }
                    .priority-low { color: #28a745; }
                    .quick-templates { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
                    .template-btn {
                        padding: 8px 15px;
                        background: #f0f0f0;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    .template-btn:hover { background: #e0e0e0; }
                    .toast {
                        position: fixed;
                        bottom: 30px;
                        right: 30px;
                        padding: 15px 25px;
                        border-radius: 8px;
                        color: white;
                        z-index: 1000;
                        display: none;
                    }
                    .toast-success { background: #28a745; }
                    .toast-error { background: #dc3545; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📢 Send Broadcast</h1>
                    <div class="header-nav">
                        <a href="/admin">← Admin Panel</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-title">📤 New Broadcast Message</div>
                        
                        <div class="quick-templates">
                            <span style="color:#666;margin-right:10px;">Quick Templates:</span>
                            <button type="button" class="template-btn" data-template="inspection" onclick="useTemplate('inspection')">🔍 Inspection</button>
                            <button type="button" class="template-btn" data-template="cleaning" onclick="useTemplate('cleaning')">🧹 Cleaning</button>
                            <button type="button" class="template-btn" data-template="safety" onclick="useTemplate('safety')">⚠️ Safety</button>
                        </div>
                        
                        <!-- 5 Days Workflow Templates -->
                        <div class="quick-templates" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ddd;">
                            <span style="color:#667eea;margin-right:10px;font-weight:600;">📅 5 Days Workflow:</span>
                            <button type="button" class="template-btn" data-template="5days_initiate" onclick="useTemplate('5days_initiate')" style="background:#e8f5e9;border-color:#4caf50;">📢 Initiate</button>
                            <button type="button" class="template-btn" data-template="5days" onclick="useTemplate('5days')" style="background:#e3f2fd;border-color:#2196f3;">📋 Daily</button>
                            <button type="button" class="template-btn" data-template="5days_48h" onclick="useTemplate('5days_48h')" style="background:#fff3e0;border-color:#ff9800;">⏰ 48H</button>
                            <button type="button" class="template-btn" data-template="5days_final" onclick="useTemplate('5days_final')" style="background:#ffebee;border-color:#f44336;">⚠️ Final</button>
                            <button type="button" class="template-btn" data-template="5days_overdue" onclick="useTemplate('5days_overdue')" style="background:#d32f2f;border-color:#b71c1c;color:white;">🚨 Overdue</button>
                        </div>
                        
                        <form id="broadcastForm" onsubmit="sendBroadcast(event)">
                            <div class="form-group">
                                <label>Title *</label>
                                <input type="text" id="title" required placeholder="Enter broadcast title">
                            </div>
                            
                            <div class="form-group">
                                <label>Message *</label>
                                <textarea id="message" required placeholder="Enter your message..."></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label>Target Roles * (Select who should receive this)</label>
                                <div class="checkbox-group">
                                    <label class="checkbox-item">
                                        <input type="checkbox" name="roles" value="Store Manager"> Store Manager
                                    </label>
                                    <label class="checkbox-item">
                                        <input type="checkbox" name="roles" value="Inspector"> Inspector
                                    </label>
                                    <label class="checkbox-item">
                                        <input type="checkbox" name="roles" value="Senior Inspector"> Senior Inspector
                                    </label>
                                    <label class="checkbox-item">
                                        <input type="checkbox" name="roles" value="Area Manager"> Area Manager
                                    </label>
                                    <label class="checkbox-item">
                                        <input type="checkbox" name="roles" value="Duty Manager"> Duty Manager
                                    </label>
                                    <label class="checkbox-item">
                                        <input type="checkbox" name="roles" value="OHS Manager"> OHS Manager
                                    </label>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div class="form-group">
                                    <label>Priority</label>
                                    <select id="priority">
                                        <option value="Normal">Normal</option>
                                        <option value="High">High - Urgent</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Expires At (Optional)</label>
                                    <input type="datetime-local" id="expiresAt">
                                </div>
                            </div>
                            
                            <div class="form-group" style="margin-top: 15px;">
                                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                    <input type="checkbox" id="sendEmail" style="width: 20px; height: 20px;">
                                    <span>📧 Also send email to all target users</span>
                                </label>
                                <p style="font-size: 12px; color: #666; margin-top: 5px;">Check this to send the broadcast via email using the Broadcast Message template</p>
                            </div>
                            
                            <!-- 5 Days Tracking -->
                            <div class="form-group" id="fiveDaysTracking" style="margin-top: 15px; display: none; background: #f0f4ff; padding: 15px; border-radius: 8px; border: 1px solid #667eea;">
                                <label style="font-weight: 600; color: #667eea; margin-bottom: 10px; display: block;">📅 5 Days Job Monitor Tracking</label>
                                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">This broadcast will be tracked in Job Monitor. Select the reminder step:</p>
                                <select id="fiveDaysReminderType" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #667eea; width: 100%;">
                                    <option value="">-- Auto-detect from title --</option>
                                    <option value="INITIATE">📢 INITIATE - Cycle Started (Day 1)</option>
                                    <option value="DAY_2">📋 DAY 2 - Continue Recording</option>
                                    <option value="REMINDER_48H">⏰ 48H REMINDER - 48 Hours Left (Day 3)</option>
                                    <option value="DAY_4">📋 DAY 4 - Almost Done</option>
                                    <option value="DAY_5">📋 DAY 5 - Final Day of Cycle</option>
                                    <option value="FINAL_REMINDER">⚠️ FINAL REMINDER - Present Findings (Day 6)</option>
                                    <option value="OVERDUE_WARNING">🚨 OVERDUE WARNING - Affects Audit (Day 7+)</option>
                                </select>
                            </div>
                            
                            <button type="submit" class="btn btn-primary">📢 Send Broadcast</button>
                        </form>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">📋 Recent Broadcasts</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Target Roles</th>
                                    <th>Priority</th>
                                    <th>Sent By</th>
                                    <th>Sent At</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="broadcastsTable">
                                ${broadcastRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    let selectedTemplate = 'custom'; // Track which template is selected
                    
                    const templates = {
                        '5days': {
                            title: '📅 5 Days Expired Items Check Reminder',
                            message: 'Dear Team,\\n\\nThis is a friendly reminder to complete the 5 Days Expired Items Check for your store.\\n\\nPlease ensure all products within 5 days of expiry are properly identified and managed.\\n\\nThank you for your cooperation!',
                            templateKey: 'BROADCAST_5DAYS',
                            is5Days: true
                        },
                        '5days_initiate': {
                            title: '📅 5 Days INITIATE - Cycle Started',
                            message: 'Dear Team,\\n\\nThe 5 Days Expired Items Check cycle has started today.\\n\\nPlease begin recording all products within 5 days of expiry in your store.\\n\\nYou have 5 days to complete this check.\\n\\nThank you!',
                            templateKey: 'BROADCAST_5DAYS',
                            is5Days: true,
                            reminderType: 'INITIATE'
                        },
                        '5days_48h': {
                            title: '⏰ 5 Days 48H REMINDER - 2 Days Left',
                            message: 'Dear Team,\\n\\n⏰ REMINDER: You have 48 hours left to complete the 5 Days Expired Items Check.\\n\\nPlease ensure all items are recorded before the deadline.\\n\\nThank you!',
                            templateKey: 'BROADCAST_5DAYS',
                            is5Days: true,
                            reminderType: 'REMINDER_48H'
                        },
                        '5days_final': {
                            title: '⚠️ 5 Days FINAL REMINDER - Present Findings',
                            message: 'Dear Team,\\n\\n⚠️ FINAL REMINDER: The 5 Days cycle has ended.\\n\\nPlease present your findings to the Area Manager today.\\n\\nEnsure all documentation is complete.\\n\\nThank you!',
                            templateKey: 'BROADCAST_5DAYS',
                            is5Days: true,
                            reminderType: 'FINAL_REMINDER'
                        },
                        '5days_overdue': {
                            title: '🚨 5 Days OVERDUE - Action Required',
                            message: 'Dear Team,\\n\\n🚨 OVERDUE WARNING: The 5 Days Expired Items Check for this cycle is overdue.\\n\\nFailure to complete will affect your audit score.\\n\\nPlease complete immediately and present to your Area Manager.\\n\\nThank you!',
                            templateKey: 'BROADCAST_5DAYS',
                            is5Days: true,
                            reminderType: 'OVERDUE_WARNING'
                        },
                        'inspection': {
                            title: '🔍 Inspection Due Reminder',
                            message: 'Dear Team,\\n\\nPlease be reminded that your store inspection is due soon.\\n\\nKindly prepare all required documentation and ensure all areas are in compliance.\\n\\nThank you!',
                            templateKey: 'BROADCAST_INSPECTION'
                        },
                        'cleaning': {
                            title: '🧹 Cleaning Checklist Reminder',
                            message: 'Dear Team,\\n\\nPlease ensure the daily cleaning checklist is completed and submitted.\\n\\nMaintaining cleanliness standards is essential for food safety compliance.\\n\\nThank you!',
                            templateKey: 'BROADCAST_CLEANING'
                        },
                        'safety': {
                            title: '⚠️ Safety Compliance Reminder',
                            message: 'Dear Team,\\n\\nThis is a reminder to review and ensure all safety protocols are being followed in your store.\\n\\nSafety is our top priority!\\n\\nThank you for your attention to this matter.',
                            templateKey: 'BROADCAST_SAFETY'
                        }
                    };
                    
                    function useTemplate(key) {
                        const template = templates[key];
                        if (template) {
                            document.getElementById('title').value = template.title;
                            document.getElementById('message').value = template.message;
                            selectedTemplate = key;
                            updateTemplateButtons(key);
                            
                            // Show/hide 5 Days tracking section
                            const fiveDaysTracking = document.getElementById('fiveDaysTracking');
                            const reminderTypeSelect = document.getElementById('fiveDaysReminderType');
                            
                            if (template.is5Days) {
                                fiveDaysTracking.style.display = 'block';
                                // Pre-select the reminder type if specified
                                if (template.reminderType) {
                                    reminderTypeSelect.value = template.reminderType;
                                } else {
                                    reminderTypeSelect.value = '';
                                }
                            } else {
                                fiveDaysTracking.style.display = 'none';
                                reminderTypeSelect.value = '';
                            }
                        }
                    }
                    
                    function updateTemplateButtons(activeKey) {
                        // Update button styles to show which is selected
                        document.querySelectorAll('.template-btn').forEach(btn => {
                            btn.style.background = btn.dataset.template === activeKey ? '#0078d4' : '#f8f9fa';
                            btn.style.color = btn.dataset.template === activeKey ? 'white' : '#333';
                        });
                    }
                    
                    // Reset to custom when user manually edits
                    document.addEventListener('DOMContentLoaded', function() {
                        const titleInput = document.getElementById('title');
                        const messageInput = document.getElementById('message');
                        
                        [titleInput, messageInput].forEach(input => {
                            input.addEventListener('input', function() {
                                selectedTemplate = 'custom';
                                updateTemplateButtons(null);
                            });
                        });
                    });
                    
                    async function sendBroadcast(e) {
                        e.preventDefault();
                        
                        const selectedRoles = Array.from(document.querySelectorAll('input[name="roles"]:checked')).map(cb => cb.value);
                        
                        if (selectedRoles.length === 0) {
                            showToast('Please select at least one target role', 'error');
                            return;
                        }
                        
                        const sendEmailChecked = document.getElementById('sendEmail').checked;
                        
                        // Get the template key for the email
                        let emailTemplateKey = 'BROADCAST_MESSAGE'; // default
                        if (selectedTemplate && templates[selectedTemplate]) {
                            emailTemplateKey = templates[selectedTemplate].templateKey;
                        }
                        
                        const data = {
                            title: document.getElementById('title').value,
                            message: document.getElementById('message').value,
                            targetRoles: selectedRoles.join(', '),
                            priority: document.getElementById('priority').value,
                            expiresAt: document.getElementById('expiresAt').value || null,
                            sendEmail: sendEmailChecked,
                            emailTemplateKey: emailTemplateKey,
                            fiveDaysReminderType: document.getElementById('fiveDaysReminderType').value || null
                        };
                        
                        try {
                            const response = await fetch('/admin/api/broadcast', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showToast('Broadcast sent successfully!' + (sendEmailChecked ? ' Emails are being sent.' : ''), 'success');
                                document.getElementById('broadcastForm').reset();
                                selectedTemplate = 'custom';
                                updateTemplateButtons(null);
                                setTimeout(() => location.reload(), 1500);
                            } else {
                                showToast(result.error || 'Failed to send broadcast', 'error');
                            }
                        } catch (error) {
                            showToast('Error sending broadcast', 'error');
                        }
                    }
                    
                    async function deleteBroadcast(id) {
                        if (!confirm('Are you sure you want to delete this broadcast?')) return;
                        
                        try {
                            const response = await fetch('/admin/api/broadcast/' + id, { method: 'DELETE' });
                            const result = await response.json();
                            
                            if (result.success) {
                                showToast('Broadcast deleted', 'success');
                                setTimeout(() => location.reload(), 1000);
                            }
                        } catch (error) {
                            showToast('Error deleting broadcast', 'error');
                        }
                    }
                    
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast toast-' + type;
                        toast.style.display = 'block';
                        setTimeout(() => toast.style.display = 'none', 3000);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading broadcast page:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Send broadcast API
router.post('/api/broadcast', requireSysAdmin, async (req, res) => {
    try {
        const { title, message, targetRoles, priority, expiresAt, sendEmail, emailTemplateKey, fiveDaysReminderType } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        // Insert the broadcast
        const broadcastResult = await pool.request()
            .input('title', sql.NVarChar, title)
            .input('message', sql.NVarChar, message)
            .input('targetRoles', sql.NVarChar, targetRoles)
            .input('priority', sql.NVarChar, priority || 'Normal')
            .input('expiresAt', sql.DateTime, expiresAt || null)
            .input('createdBy', sql.Int, req.currentUser.userId)
            .query(`
                INSERT INTO Broadcasts (Title, Message, TargetRoles, Priority, ExpiresAt, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES (@title, @message, @targetRoles, @priority, @expiresAt, @createdBy)
            `);
        
        const broadcastId = broadcastResult.recordset[0]?.Id;
        
        // Only track as 5 Days broadcast when user explicitly selects a reminder type
        const is5DaysBroadcast = fiveDaysReminderType && fiveDaysReminderType.trim() !== '';
        
        let emailsSentCount = 0;
        const recipientEmails = [];
        
        // If sendEmail is enabled, send emails to target users using the template
        if (sendEmail) {
            try {
                // Get the appropriate template (use provided key or default)
                const templateKey = emailTemplateKey || 'BROADCAST_MESSAGE';
                const templateResult = await pool.request()
                    .input('templateKey', sql.NVarChar, templateKey)
                    .query('SELECT * FROM EmailTemplates WHERE TemplateKey = @templateKey AND IsActive = 1');
                
                if (templateResult.recordset.length > 0) {
                    const template = templateResult.recordset[0];
                    
                    // Get target users based on roles
                    let userQuery = 'SELECT DISTINCT u.Email, u.DisplayName FROM Users u WHERE u.IsActive = 1';
                    if (targetRoles && targetRoles.trim()) {
                        const rolesList = targetRoles.split(',').map(r => r.trim());
                        userQuery = `
                            SELECT DISTINCT u.Email, u.DisplayName 
                            FROM Users u
                            JOIN UserRoleAssignments ura ON u.Id = ura.UserId
                            JOIN UserRoles r ON ura.RoleId = r.Id
                            WHERE u.IsActive = 1 AND r.RoleName IN (${rolesList.map((_, i) => '@role' + i).join(',')})
                        `;
                    }
                    
                    const usersRequest = pool.request();
                    if (targetRoles && targetRoles.trim()) {
                        const rolesList = targetRoles.split(',').map(r => r.trim());
                        rolesList.forEach((role, i) => {
                            usersRequest.input('role' + i, sql.NVarChar, role);
                        });
                    }
                    const usersResult = await usersRequest.query(userQuery);
                    
                    // Prepare email data
                    const isHighPriority = priority === 'High';
                    const baseUrl = process.env.BASE_URL || 'https://oeapp.gmrlapps.com';
                    
                    // Send emails to each user
                    const emailService = require('../../services/email-service');
                    for (const user of usersResult.recordset) {
                        let subject = template.SubjectTemplate
                            .replace(/{{title}}/g, title);
                        
                        let body = template.BodyTemplate
                            .replace(/{{title}}/g, title)
                            .replace(/{{message}}/g, message)
                            .replace(/{{recipientName}}/g, user.DisplayName)
                            .replace(/{{senderName}}/g, req.currentUser.displayName)
                            .replace(/{{sentDate}}/g, new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }))
                            .replace(/{{priority}}/g, priority || 'Normal')
                            .replace(/{{priorityClass}}/g, isHighPriority ? 'high-priority' : '')
                            .replace(/{{priorityBadgeClass}}/g, isHighPriority ? 'priority-high' : 'priority-normal')
                            .replace(/{{priorityBoxClass}}/g, isHighPriority ? 'high-priority' : '')
                            .replace(/{{priorityLabel}}/g, isHighPriority ? '⚠️ HIGH PRIORITY' : '📌 Announcement')
                            .replace(/{{dashboardUrl}}/g, baseUrl + '/dashboard')
                            .replace(/{{year}}/g, new Date().getFullYear());
                        
                        await emailService.sendEmail({
                            to: user.Email,
                            subject: subject,
                            html: body
                        });
                        
                        emailsSentCount++;
                        recipientEmails.push(user.Email);
                    }
                    
                    console.log(`Broadcast email sent to ${usersResult.recordset.length} users`);
                }
            } catch (emailErr) {
                console.error('Error sending broadcast emails:', emailErr);
                // Don't fail the request if email fails
            }
        }
        
        // If this is a 5 Days broadcast, log it to FiveDaysReminderLog for tracking
        if (is5DaysBroadcast) {
            try {
                // Generate cycle key (current month and cycle number)
                const today = new Date();
                const day = today.getDate();
                const month = today.getMonth() + 1;
                const year = today.getFullYear();
                
                // Determine cycle number based on day
                let cycleNumber = 0;
                if (day >= 1 && day <= 10) cycleNumber = 1;
                else if (day >= 15 && day <= 24) cycleNumber = 2;
                else cycleNumber = day < 15 ? 1 : 2; // Default to nearest cycle
                
                const cycleKey = `${year}-${month}-C${cycleNumber}`;
                
                // Use the explicitly selected reminder type
                const reminderType = fiveDaysReminderType;
                
                // Get all stores to log
                const storesResult = await pool.request().query(`
                    SELECT Id, StoreName FROM Stores WHERE IsActive = 1
                `);
                
                // Log for all stores (broadcast was sent to all)
                for (const store of storesResult.recordset) {
                    await pool.request()
                        .input('cycleKey', sql.NVarChar, cycleKey)
                        .input('reminderType', sql.NVarChar, reminderType)
                        .input('storeId', sql.Int, store.Id)
                        .input('recipientEmail', sql.NVarChar, 'broadcast-all')
                        .query(`
                            INSERT INTO FiveDaysReminderLog (CycleKey, ReminderType, StoreId, RecipientEmail, SentAt)
                            VALUES (@cycleKey, @reminderType, @storeId, @recipientEmail, GETDATE())
                        `);
                }
                
                console.log(`[5 Days] Broadcast logged: ${reminderType} for cycle ${cycleKey}, ${storesResult.recordset.length} stores`);
            } catch (logErr) {
                console.error('Error logging 5 Days broadcast:', logErr);
                // Don't fail the request if logging fails
            }
        }
        
        await pool.close();
        
        res.json({ success: true, emailsSent: emailsSentCount });
    } catch (err) {
        console.error('Error sending broadcast:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete broadcast API
router.delete('/api/broadcast/:id', requireSysAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM BroadcastReadStatus WHERE BroadcastId = @id; DELETE FROM Broadcasts WHERE Id = @id');
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting broadcast:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get broadcasts for current user (to show on dashboard)
router.get('/api/broadcasts/my', async (req, res) => {
    try {
        const userRole = req.currentUser.role;
        const userId = req.currentUser.userId;
        
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    b.Id, b.Title, b.Message, b.Priority, b.CreatedAt, b.TargetRoles,
                    u.DisplayName as SentBy,
                    CASE WHEN brs.Id IS NOT NULL THEN 1 ELSE 0 END as IsRead
                FROM Broadcasts b
                JOIN Users u ON b.CreatedBy = u.Id
                LEFT JOIN BroadcastReadStatus brs ON brs.BroadcastId = b.Id AND brs.UserId = @userId
                WHERE b.IsActive = 1
                AND (b.ExpiresAt IS NULL OR b.ExpiresAt > GETDATE())
                ORDER BY b.CreatedAt DESC
            `);
        
        // Filter by user's role
        const broadcasts = result.recordset.filter(b => {
            const targetRoles = b.TargetRoles ? b.TargetRoles.split(',').map(r => r.trim().toLowerCase()) : [];
            return targetRoles.includes(userRole.toLowerCase()) || targetRoles.length === 0;
        });
        
        await pool.close();
        
        res.json({ success: true, data: broadcasts });
    } catch (err) {
        console.error('Error fetching broadcasts:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mark broadcast as read
router.post('/api/broadcasts/:id/read', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('broadcastId', sql.Int, req.params.id)
            .input('userId', sql.Int, req.currentUser.userId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM BroadcastReadStatus WHERE BroadcastId = @broadcastId AND UserId = @userId)
                INSERT INTO BroadcastReadStatus (BroadcastId, UserId) VALUES (@broadcastId, @userId)
            `);
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking broadcast as read:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// Email Templates Management
// ==========================================

const emailTemplateBuilder = require('../../services/email-template-builder');
const fs = require('fs');
const path = require('path');

// Email Templates Page
router.get('/email-templates', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT Id, TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, 
                   IsActive, UpdatedAt, UpdatedBy
            FROM EmailTemplates
            ORDER BY Module, ReportType
        `);
        
        const templates = result.recordset;
        
        // Group templates by module
        const oeTemplates = templates.filter(t => t.Module === 'OE');
        const ohsTemplates = templates.filter(t => t.Module === 'OHS');
        const storesTemplates = templates.filter(t => t.Module === 'Stores');
        
        // Helper to get description based on report type
        const getDescription = (reportType) => {
            const descriptions = {
                'full': 'Sent when sharing the complete inspection report.',
                'action-plan': 'Sent with findings requiring corrective actions.',
                'escalation': 'Sent to Area Manager when action plan is overdue.',
                'inspection-reminder': 'Sent X days before action plan deadline.',
                'inspection-overdue': 'Sent to Store Manager when deadline passed.',
                'inspection-escalation': 'Escalated to Area Manager for overdue action plans.',
                'verification-submitted': 'Sent to Store Manager when action item verification is submitted.',
                'theft-incident': 'Sent when a theft incident report is submitted.'
            };
            return descriptions[reportType] || 'Email notification template.';
        };
        
        // Helper to get icon based on report type
        const getIcon = (reportType) => {
            const icons = {
                'full': '📊',
                'action-plan': '📋',
                'escalation': '🚨',
                'inspection-reminder': '⏰',
                'inspection-overdue': '⚠️',
                'inspection-escalation': '🚨',
                'verification-submitted': '✅',
                'theft-incident': '🚨'
            };
            return icons[reportType] || '📧';
        };
        
        // Helper to render template card
        const renderCard = (t) => `
            <div class="template-card">
                <h3>${getIcon(t.ReportType)} ${t.TemplateName}</h3>
                <span class="report-type">${t.ReportType}</span>
                <p>${getDescription(t.ReportType)}</p>
                <div class="meta">
                    ${t.UpdatedAt ? `Last updated: ${new Date(t.UpdatedAt).toLocaleDateString('en-GB')}` : 'Never edited'}
                    ${t.UpdatedBy ? ` by ${t.UpdatedBy}` : ''}
                </div>
                <button class="btn btn-preview" onclick="previewTemplate('${t.TemplateKey}')">👁️ Preview</button>
                <button class="btn btn-edit" onclick="editTemplate('${t.TemplateKey}')">✏️ Edit</button>
            </div>
        `;
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Email Templates - Admin</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 30px; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header a { color: white; text-decoration: none; opacity: 0.8; }
                    .header a:hover { opacity: 1; }
                    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                    .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px; }
                    .info-box h3 { color: #1565c0; margin-bottom: 8px; }
                    .info-box p { color: #1976d2; font-size: 14px; }
                    
                    /* Module Sections */
                    .module-section { margin-bottom: 35px; }
                    .module-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #eee; }
                    .module-header h2 { font-size: 22px; font-weight: 600; }
                    .module-badge { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
                    .module-badge.oe { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); color: #2e7d32; }
                    .module-badge.ohs { background: linear-gradient(135deg, #ffebee, #ffcdd2); color: #c62828; }
                    .module-badge.stores { background: linear-gradient(135deg, #fff3e0, #ffe0b2); color: #e65100; }
                    .template-count { font-size: 13px; color: #888; margin-left: auto; }
                    
                    .templates-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
                    .template-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); transition: transform 0.2s, box-shadow 0.2s; }
                    .template-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
                    .template-card h3 { color: #333; margin-bottom: 8px; font-size: 16px; display: flex; align-items: center; gap: 8px; }
                    .template-card .report-type { display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: #f0f0f0; color: #666; margin-bottom: 10px; }
                    .template-card p { color: #666; font-size: 13px; margin-bottom: 12px; line-height: 1.5; }
                    .template-card .meta { font-size: 11px; color: #999; margin-bottom: 15px; }
                    
                    .btn { display: inline-block; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px; cursor: pointer; border: none; margin-right: 8px; transition: all 0.2s; }
                    .btn-preview { background: #e3f2fd; color: #1976d2; }
                    .btn-preview:hover { background: #bbdefb; }
                    .btn-edit { background: #667eea; color: white; }
                    .btn-edit:hover { background: #5a6fd6; }
                    .btn-save { background: #28a745; color: white; }
                    .btn-save:hover { background: #218838; }
                    .btn-cancel { background: #6c757d; color: white; }
                    .btn-cancel:hover { background: #5a6268; }
                    
                    .preview-modal, .editor-modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
                    .preview-content { background: white; border-radius: 12px; width: 90%; max-width: 800px; max-height: 90vh; overflow: auto; }
                    .editor-content { background: white; border-radius: 12px; width: 95%; max-width: 1200px; max-height: 95vh; overflow: auto; }
                    .modal-header { padding: 15px 20px; background: #f5f5f5; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; }
                    .modal-header h3 { margin: 0; }
                    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
                    .modal-body { padding: 20px; }
                    .preview-iframe { width: 100%; height: 500px; border: 1px solid #eee; border-radius: 8px; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: #333; }
                    .form-group input, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-family: inherit; }
                    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #667eea; }
                    .form-group textarea { min-height: 400px; font-family: 'Consolas', monospace; font-size: 13px; }
                    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .variables-box { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
                    .variables-box h4 { margin-bottom: 10px; color: #333; }
                    .variables-box code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin: 2px; display: inline-block; cursor: pointer; }
                    .variables-box code:hover { background: #667eea; color: white; }
                    .btn-container { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
                    .toast { position: fixed; bottom: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: 600; z-index: 2000; animation: slideIn 0.3s ease; }
                    .toast.success { background: #28a745; }
                    .toast.error { background: #dc3545; }
                    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1><a href="/admin">← Admin</a> / 📧 Email Templates</h1>
                </div>
                <div class="container">
                    <div class="info-box">
                        <h3>📝 About Email Templates</h3>
                        <p>Email templates are used for sending inspection reports, reminders, and escalation notifications. 
                           Click "Edit" to customize the subject and body HTML. Changes take effect immediately.</p>
                    </div>
                    
                    <!-- OE Templates Section -->
                    <div class="module-section">
                        <div class="module-header">
                            <span class="module-badge oe">OE</span>
                            <h2>Operational Excellence Templates</h2>
                            <span class="template-count">${oeTemplates.length} templates</span>
                        </div>
                        <div class="templates-grid">
                            ${oeTemplates.map(renderCard).join('')}
                        </div>
                    </div>
                    
                    <!-- OHS Templates Section -->
                    <div class="module-section">
                        <div class="module-header">
                            <span class="module-badge ohs">OHS</span>
                            <h2>Occupational Health & Safety Templates</h2>
                            <span class="template-count">${ohsTemplates.length} templates</span>
                        </div>
                        <div class="templates-grid">
                            ${ohsTemplates.map(renderCard).join('')}
                        </div>
                    </div>
                    
                    <!-- Stores Templates Section -->
                    <div class="module-section">
                        <div class="module-header">
                            <span class="module-badge stores">Stores</span>
                            <h2>Stores Module Templates</h2>
                            <span class="template-count">${storesTemplates.length} templates</span>
                        </div>
                        <div class="templates-grid">
                            ${storesTemplates.map(renderCard).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="preview-modal" id="previewModal">
                    <div class="preview-content">
                        <div class="modal-header">
                            <h3 id="previewTitle">Email Preview</h3>
                            <button class="modal-close" onclick="closeModal('previewModal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
                                <strong>Subject:</strong> <span id="previewSubject"></span>
                            </div>
                            <iframe id="previewIframe" class="preview-iframe"></iframe>
                        </div>
                    </div>
                </div>
                
                <div class="editor-modal" id="editorModal">
                    <div class="editor-content">
                        <div class="modal-header">
                            <h3 id="editorTitle">Edit Template</h3>
                            <button class="modal-close" onclick="closeModal('editorModal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="editTemplateKey">
                            
                            <div class="variables-box">
                                <h4>📌 Available Variables (click to copy)</h4>
                                <code onclick="copyVar('storeName')">{{storeName}}</code>
                                <code onclick="copyVar('storeCode')">{{storeCode}}</code>
                                <code onclick="copyVar('documentNumber')">{{documentNumber}}</code>
                                <code onclick="copyVar('totalScore')">{{totalScore}}</code>
                                <code onclick="copyVar('auditDate')">{{auditDate}}</code>
                                <code onclick="copyVar('inspectionDate')">{{inspectionDate}}</code>
                                <code onclick="copyVar('auditors')">{{auditors}}</code>
                                <code onclick="copyVar('inspectors')">{{inspectors}}</code>
                                <code onclick="copyVar('status')">{{status}}</code>
                                <code onclick="copyVar('reportUrl')">{{reportUrl}}</code>
                                <code onclick="copyVar('actionPlanUrl')">{{actionPlanUrl}}</code>
                                <code onclick="copyVar('recipientName')">{{recipientName}}</code>
                                <code onclick="copyVar('deadline')">{{deadline}}</code>
                                <code onclick="copyVar('daysUntilDeadline')">{{daysUntilDeadline}}</code>
                                <code onclick="copyVar('daysOverdue')">{{daysOverdue}}</code>
                                <code onclick="copyVar('storeManagerName')">{{storeManagerName}}</code>
                                <code onclick="copyVar('brandColor')">{{brandColor}}</code>
                                <code onclick="copyVar('brandGradient')">{{brandGradient}}</code>
                                <code onclick="copyVar('totalFindings')">{{totalFindings}}</code>
                                <code onclick="copyVar('highFindings')">{{highFindings}}</code>
                                <code onclick="copyVar('mediumFindings')">{{mediumFindings}}</code>
                                <code onclick="copyVar('lowFindings')">{{lowFindings}}</code>
                                <code onclick="copyVar('criticalFindings')">{{criticalFindings}}</code>
                                <code onclick="copyVar('year')">{{year}}</code>
                                <br><strong style="font-size:11px; color:#666; margin-top:8px; display:inline-block;">Verification Variables:</strong><br>
                                <code onclick="copyVar('sectionName')">{{sectionName}}</code>
                                <code onclick="copyVar('findingDescription')">{{findingDescription}}</code>
                                <code onclick="copyVar('submittedBy')">{{submittedBy}}</code>
                                <code onclick="copyVar('submittedAt')">{{submittedAt}}</code>
                                <code onclick="copyVar('verificationNotes')">{{verificationNotes}}</code>
                                <code onclick="copyVar('verificationUrl')">{{verificationUrl}}</code>
                                <br><strong style="font-size:11px; color:#666; margin-top:8px; display:inline-block;">Theft Incident Variables:</strong><br>
                                <code onclick="copyVar('incidentId')">{{incidentId}}</code>
                                <code onclick="copyVar('incidentDate')">{{incidentDate}}</code>
                                <code onclick="copyVar('storeManager')">{{storeManager}}</code>
                                <code onclick="copyVar('staffName')">{{staffName}}</code>
                                <code onclick="copyVar('stolenItems')">{{stolenItems}}</code>
                                <code onclick="copyVar('stolenValue')">{{stolenValue}}</code>
                                <code onclick="copyVar('valueCollected')">{{valueCollected}}</code>
                                <code onclick="copyVar('thiefName')">{{thiefName}}</code>
                                <code onclick="copyVar('thiefSurname')">{{thiefSurname}}</code>
                                <code onclick="copyVar('idCard')">{{idCard}}</code>
                                <code onclick="copyVar('dateOfBirth')">{{dateOfBirth}}</code>
                                <code onclick="copyVar('placeOfBirth')">{{placeOfBirth}}</code>
                                <code onclick="copyVar('fatherName')">{{fatherName}}</code>
                                <code onclick="copyVar('motherName')">{{motherName}}</code>
                                <code onclick="copyVar('maritalStatus')">{{maritalStatus}}</code>
                                <code onclick="copyVar('captureMethod')">{{captureMethod}}</code>
                                <code onclick="copyVar('securityType')">{{securityType}}</code>
                                <code onclick="copyVar('outsourceCompany')">{{outsourceCompany}}</code>
                                <code onclick="copyVar('amountToHO')">{{amountToHO}}</code>
                                <code onclick="copyVar('currency')">{{currency}}</code>
                            </div>
                            
                            <div class="form-group">
                                <label>Subject Line Template</label>
                                <input type="text" id="editSubject" placeholder="Email subject line with {{variables}}">
                            </div>
                            
                            <div class="form-group">
                                <label>Email Body (HTML)</label>
                                <textarea id="editBody" placeholder="HTML email body template"></textarea>
                            </div>
                            
                            <div class="btn-container">
                                <button class="btn btn-preview" onclick="previewEditing()">👁️ Preview Changes</button>
                                <button class="btn btn-cancel" onclick="closeModal('editorModal')">Cancel</button>
                                <button class="btn btn-save" onclick="saveTemplate()">💾 Save Template</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    function copyVar(varName) {
                        navigator.clipboard.writeText('{{' + varName + '}}');
                        showToast('Copied {{' + varName + '}}', 'success');
                    }
                    
                    async function previewTemplate(templateKey) {
                        try {
                            const res = await fetch('/admin/api/email-templates/preview?templateKey=' + templateKey);
                            const data = await res.json();
                            
                            if (data.success) {
                                document.getElementById('previewTitle').textContent = 'Email Preview - ' + templateKey;
                                document.getElementById('previewSubject').textContent = data.subject;
                                
                                const iframe = document.getElementById('previewIframe');
                                const doc = iframe.contentDocument || iframe.contentWindow.document;
                                doc.open();
                                // Ensure UTF-8 encoding for emojis
                                const htmlWithCharset = data.html.includes('<head>') 
                                    ? data.html.replace('<head>', '<head><meta charset="UTF-8">')
                                    : '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' + data.html + '</body></html>';
                                doc.write(htmlWithCharset);
                                doc.close();
                                document.getElementById('previewModal').style.display = 'flex';
                            } else {
                                showToast('Error: ' + data.error, 'error');
                            }
                        } catch (err) {
                            showToast('Error loading preview: ' + err.message, 'error');
                        }
                    }
                    
                    async function editTemplate(templateKey) {
                        try {
                            const res = await fetch('/admin/api/email-templates/' + templateKey);
                            const data = await res.json();
                            
                            if (data.success) {
                                document.getElementById('editTemplateKey').value = templateKey;
                                document.getElementById('editorTitle').textContent = 'Edit Template - ' + data.template.TemplateName;
                                document.getElementById('editSubject').value = data.template.SubjectTemplate;
                                document.getElementById('editBody').value = data.template.BodyTemplate;
                                document.getElementById('editorModal').style.display = 'flex';
                            } else {
                                showToast('Error: ' + data.error, 'error');
                            }
                        } catch (err) {
                            showToast('Error loading template: ' + err.message, 'error');
                        }
                    }
                    
                    async function previewEditing() {
                        const subject = document.getElementById('editSubject').value;
                        const body = document.getElementById('editBody').value;
                        
                        try {
                            const res = await fetch('/admin/api/email-templates/preview-custom', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ subject, body })
                            });
                            const data = await res.json();
                            
                            if (data.success) {
                                const previewWin = window.open('', 'Preview', 'width=800,height=600');
                                previewWin.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>');
                                previewWin.document.write('<h3 style="font-family:sans-serif;padding:10px;background:#f5f5f5;margin:0;">Subject: ' + data.subject + '</h3>');
                                previewWin.document.write(data.html);
                                previewWin.document.write('</body></html>');
                            } else {
                                showToast('Error: ' + data.error, 'error');
                            }
                        } catch (err) {
                            showToast('Error previewing: ' + err.message, 'error');
                        }
                    }
                    
                    async function saveTemplate() {
                        const templateKey = document.getElementById('editTemplateKey').value;
                        const subject = document.getElementById('editSubject').value;
                        const body = document.getElementById('editBody').value;
                        
                        if (!subject.trim() || !body.trim()) {
                            showToast('Subject and body are required', 'error');
                            return;
                        }
                        
                        try {
                            const res = await fetch('/admin/api/email-templates/' + templateKey, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ subject, body })
                            });
                            const data = await res.json();
                            
                            if (data.success) {
                                showToast('Template saved successfully!', 'success');
                                closeModal('editorModal');
                                setTimeout(() => location.reload(), 1000);
                            } else {
                                showToast('Error: ' + data.error, 'error');
                            }
                        } catch (err) {
                            showToast('Error saving template: ' + err.message, 'error');
                        }
                    }
                    
                    function closeModal(modalId) {
                        document.getElementById(modalId).style.display = 'none';
                    }
                    
                    function showToast(message, type) {
                        const toast = document.createElement('div');
                        toast.className = 'toast ' + type;
                        toast.textContent = message;
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 3000);
                    }
                    
                    document.querySelectorAll('.preview-modal, .editor-modal').forEach(modal => {
                        modal.addEventListener('click', function(e) {
                            if (e.target === this) closeModal(this.id);
                        });
                    });
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading email templates:', error);
        res.status(500).send('Error loading email templates: ' + error.message);
    }
});

// API to preview template with sample data (MUST be before /:templateKey route)
router.get('/api/email-templates/preview', async (req, res) => {
    try {
        const { templateKey, module, type } = req.query;
        const pool = await sql.connect(dbConfig);
        
        // Get template from database
        let template;
        if (templateKey) {
            const result = await pool.request()
                .input('templateKey', templateKey)
                .query('SELECT * FROM EmailTemplates WHERE TemplateKey = @templateKey');
            template = result.recordset[0];
        } else {
            // Fallback to module/type lookup
            const key = `${module.toUpperCase()}_${type === 'action-plan' ? 'ACTION_PLAN' : 'FULL'}`;
            const result = await pool.request()
                .input('templateKey', key)
                .query('SELECT * FROM EmailTemplates WHERE TemplateKey = @templateKey');
            template = result.recordset[0];
        }
        
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        
        // Sample data for preview
        const sampleData = {
            storeName: 'Spinneys - Motor City',
            storeCode: 'SP-MC-001',
            documentNumber: 'GMRL-OEI-0001',
            totalScore: '87',
            auditDate: new Date().toLocaleDateString('en-GB'),
            inspectionDate: new Date().toLocaleDateString('en-GB'),
            auditors: 'John Smith',
            inspectors: 'John Smith',
            status: 'Completed',
            reportUrl: 'https://oeapp.gmrlapps.com/sample-report',
            brandColor: '#1a5f2a',
            brandGradient: 'linear-gradient(135deg, #1a5f2a 0%, #2d8f42 100%)',
            scoreClass: 'score-pass',
            scoreIcon: '✅',
            scoreStatus: 'PASS',
            totalFindings: '12',
            highFindings: '3',
            mediumFindings: '5',
            lowFindings: '4',
            criticalFindings: '1',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
            daysOverdue: '3',
            recipientName: 'Ahmed Al Maktoum',
            actionPlanUrl: 'https://oeapp.gmrlapps.com/oe-inspection/action-plan/1',
            year: new Date().getFullYear().toString(),
            // Verification template variables
            sectionName: 'Food Safety & Hygiene',
            findingDescription: 'Temperature logs not properly maintained',
            submittedBy: 'Mohamed Hassan',
            submittedAt: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            verificationNotes: 'All temperature logs have been updated and properly documented. Training conducted for staff on correct recording procedures.',
            verificationUrl: 'https://oeapp.gmrlapps.com/oe-inspection/action-plan/1?verification=123',
            // Theft incident template variables
            incidentId: '123',
            incidentDate: new Date().toLocaleDateString('en-GB'),
            storeManager: 'Ahmed Hassan',
            staffName: 'Mohamed Ali',
            stolenItems: 'Various food items including chocolates, beverages, and snacks. Total of 15 items were taken from different shelves.',
            stolenValue: '2,500.00',
            valueCollected: '1,800.00',
            thiefName: 'Unknown',
            thiefSurname: 'Unknown',
            idCard: 'Not Available',
            dateOfBirth: 'Not Available',
            placeOfBirth: 'Not Available',
            fatherName: 'Not Available',
            motherName: 'Not Available',
            maritalStatus: 'Unknown',
            captureMethod: 'CCTV Camera',
            securityType: 'In-House',
            outsourceCompany: 'N/A',
            amountToHO: '700.00',
            currency: 'USD'
        };
        
        // Replace variables in template
        let subject = template.SubjectTemplate;
        let html = template.BodyTemplate;
        
        for (const [key, value] of Object.entries(sampleData)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            html = html.replace(regex, value);
        }
        
        res.json({ success: true, subject, html });
    } catch (error) {
        console.error('Error previewing template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API to preview custom template (for editor) - MUST be before /:templateKey route
router.post('/api/email-templates/preview-custom', (req, res) => {
    try {
        const { subject, body } = req.body;
        
        // Sample data for preview
        const sampleData = {
            storeName: 'Spinneys - Motor City',
            storeCode: 'SP-MC-001',
            documentNumber: 'GMRL-OEI-0001',
            totalScore: '87',
            auditDate: new Date().toLocaleDateString('en-GB'),
            inspectionDate: new Date().toLocaleDateString('en-GB'),
            auditors: 'John Smith',
            inspectors: 'John Smith',
            status: 'Completed',
            reportUrl: 'https://oeapp.gmrlapps.com/sample-report',
            brandColor: '#1a5f2a',
            brandGradient: 'linear-gradient(135deg, #1a5f2a 0%, #2d8f42 100%)',
            scoreClass: 'score-pass',
            scoreIcon: '✅',
            scoreStatus: 'PASS',
            totalFindings: '12',
            highFindings: '3',
            mediumFindings: '5',
            lowFindings: '4',
            criticalFindings: '1',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
            daysOverdue: '3',
            recipientName: 'Ahmed Al Maktoum',
            actionPlanUrl: 'https://oeapp.gmrlapps.com/oe-inspection/action-plan/1',
            year: new Date().getFullYear().toString(),
            // Verification template variables
            sectionName: 'Food Safety & Hygiene',
            findingDescription: 'Temperature logs not properly maintained',
            submittedBy: 'Mohamed Hassan',
            submittedAt: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            verificationNotes: 'All temperature logs have been updated and properly documented. Training conducted for staff on correct recording procedures.',
            verificationUrl: 'https://oeapp.gmrlapps.com/oe-inspection/action-plan/1?verification=123',
            // Theft incident template variables
            incidentId: '123',
            incidentDate: new Date().toLocaleDateString('en-GB'),
            storeManager: 'Ahmed Hassan',
            staffName: 'Mohamed Ali',
            stolenItems: 'Various food items including chocolates, beverages, and snacks. Total of 15 items were taken from different shelves.',
            stolenValue: '2,500.00',
            valueCollected: '1,800.00',
            thiefName: 'Unknown',
            thiefSurname: 'Unknown',
            idCard: 'Not Available',
            dateOfBirth: 'Not Available',
            placeOfBirth: 'Not Available',
            fatherName: 'Not Available',
            motherName: 'Not Available',
            maritalStatus: 'Unknown',
            captureMethod: 'CCTV Camera',
            securityType: 'In-House',
            outsourceCompany: 'N/A',
            amountToHO: '700.00',
            currency: 'USD'
        };
        
        // Replace variables in template
        let processedSubject = subject;
        let processedHtml = body;
        
        for (const [key, value] of Object.entries(sampleData)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            processedSubject = processedSubject.replace(regex, value);
            processedHtml = processedHtml.replace(regex, value);
        }
        
        res.json({ success: true, subject: processedSubject, html: processedHtml });
    } catch (error) {
        console.error('Error previewing custom template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API to get single template (MUST be after /preview routes due to :templateKey param)
router.get('/api/email-templates/:templateKey', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('templateKey', req.params.templateKey)
            .query('SELECT * FROM EmailTemplates WHERE TemplateKey = @templateKey');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        
        res.json({ success: true, template: result.recordset[0] });
    } catch (error) {
        console.error('Error getting template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API to update template
router.put('/api/email-templates/:templateKey', async (req, res) => {
    try {
        const { subject, body } = req.body;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('templateKey', req.params.templateKey)
            .input('subject', subject)
            .input('body', body)
            .input('updatedBy', req.user?.name || 'Admin')
            .query(`
                UPDATE EmailTemplates 
                SET SubjectTemplate = @subject, 
                    BodyTemplate = @body, 
                    UpdatedAt = GETDATE(),
                    UpdatedBy = @updatedBy
                WHERE TemplateKey = @templateKey
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// JOB MONITOR PAGE - Action Plan Tracker
// ============================================================================
router.get('/job-monitor', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get notification templates
        const templatesResult = await pool.request().query(`
            SELECT TemplateKey, TemplateName, Module, ReportType FROM EmailTemplates
            WHERE ReportType IN ('inspection-reminder', 'inspection-overdue', 'inspection-escalation', 'escalation') AND IsActive = 1
            ORDER BY Module, ReportType
        `);
        
        const templates = templatesResult.recordset;
        const oeTemplates = templates.filter(t => t.Module === 'OE');
        const ohsTemplates = templates.filter(t => t.Module === 'OHS');
        
        // Get OE Inspections with action plan tracking
        const oeInspectionsResult = await pool.request().query(`
            SELECT i.Id, i.StoreId, i.DocumentNumber, i.StoreName, i.InspectionDate, i.Status, i.ActionPlanDeadline, i.ActionPlanCompletedAt,
                ISNULL(u.DisplayName, 'Unknown') as CreatedByName,
                CASE WHEN i.ActionPlanCompletedAt IS NOT NULL THEN 'Completed'
                     WHEN i.ActionPlanDeadline IS NULL THEN 'No Deadline'
                     WHEN i.ActionPlanDeadline < GETDATE() THEN 'Overdue'
                     WHEN DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) <= 3 THEN 'Due Soon'
                     ELSE 'On Track' END as ActionPlanStatus,
                CASE WHEN i.ActionPlanDeadline IS NOT NULL AND i.ActionPlanCompletedAt IS NULL AND i.ActionPlanDeadline < GETDATE() 
                     THEN DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) ELSE NULL END as DaysOverdue,
                CASE WHEN i.ActionPlanDeadline IS NOT NULL AND i.ActionPlanCompletedAt IS NULL AND i.ActionPlanDeadline >= GETDATE() 
                     THEN DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) ELSE NULL END as DaysUntilDeadline
            FROM OE_Inspections i
            LEFT JOIN Users u ON i.CreatedBy = u.Id
            WHERE i.Status = 'Completed' AND i.ActionPlanCompletedAt IS NULL
            ORDER BY CASE WHEN i.ActionPlanDeadline < GETDATE() THEN 0 ELSE 1 END, i.ActionPlanDeadline
        `);
        const oeInspections = oeInspectionsResult.recordset;
        
        // Get OHS Inspections with action plan tracking
        const ohsInspectionsResult = await pool.request().query(`
            SELECT i.Id, i.StoreId, i.DocumentNumber, i.StoreName, i.InspectionDate, i.Status, i.ActionPlanDeadline, i.ActionPlanCompletedAt,
                ISNULL(u.DisplayName, 'Unknown') as CreatedByName,
                CASE WHEN i.ActionPlanCompletedAt IS NOT NULL THEN 'Completed'
                     WHEN i.ActionPlanDeadline IS NULL THEN 'No Deadline'
                     WHEN i.ActionPlanDeadline < GETDATE() THEN 'Overdue'
                     WHEN DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) <= 3 THEN 'Due Soon'
                     ELSE 'On Track' END as ActionPlanStatus,
                CASE WHEN i.ActionPlanDeadline IS NOT NULL AND i.ActionPlanCompletedAt IS NULL AND i.ActionPlanDeadline < GETDATE() 
                     THEN DATEDIFF(DAY, i.ActionPlanDeadline, GETDATE()) ELSE NULL END as DaysOverdue,
                CASE WHEN i.ActionPlanDeadline IS NOT NULL AND i.ActionPlanCompletedAt IS NULL AND i.ActionPlanDeadline >= GETDATE() 
                     THEN DATEDIFF(DAY, GETDATE(), i.ActionPlanDeadline) ELSE NULL END as DaysUntilDeadline
            FROM OHS_Inspections i
            LEFT JOIN Users u ON i.CreatedBy = u.Id
            WHERE i.Status = 'Completed' AND i.ActionPlanCompletedAt IS NULL
            ORDER BY CASE WHEN i.ActionPlanDeadline < GETDATE() THEN 0 ELSE 1 END, i.ActionPlanDeadline
        `);
        const ohsInspections = ohsInspectionsResult.recordset;
        
        // Get Theft Incidents with email log
        const theftIncidentsResult = await pool.request().query(`
            SELECT 
                ti.Id,
                ti.Store as StoreName,
                ti.IncidentDate,
                ti.StoreManager,
                ti.StolenItems,
                ti.StolenValue,
                ti.ValueCollected,
                ti.Currency,
                ti.CaptureMethod,
                ti.SecurityType,
                ti.CreatedAt,
                ISNULL(u.DisplayName, 'Unknown') as CreatedByName,
                (SELECT COUNT(*) FROM TheftIncidentEmailLog WHERE IncidentId = ti.Id AND Status = 'Sent') as EmailsSent,
                (SELECT COUNT(*) FROM TheftIncidentEmailLog WHERE IncidentId = ti.Id AND Status = 'Failed') as EmailsFailed,
                (SELECT TOP 1 SentAt FROM TheftIncidentEmailLog WHERE IncidentId = ti.Id AND Status = 'Sent' ORDER BY SentAt DESC) as LastEmailSent
            FROM TheftIncidents ti
            LEFT JOIN Users u ON ti.CreatedBy = u.Id
            ORDER BY ti.CreatedAt DESC
        `);
        const theftIncidents = theftIncidentsResult.recordset;
        
        // Get theft incident email log
        const theftEmailLogResult = await pool.request().query(`
            SELECT TOP 50
                el.Id,
                el.IncidentId,
                ti.Store as StoreName,
                ti.StolenValue,
                ti.Currency,
                el.ToEmail,
                el.Subject,
                el.Status,
                el.ErrorMessage,
                el.SentAt,
                ISNULL(u.DisplayName, 'System') as SentByName
            FROM TheftIncidentEmailLog el
            INNER JOIN TheftIncidents ti ON el.IncidentId = ti.Id
            LEFT JOIN Users u ON el.SentBy = u.Id
            ORDER BY el.SentAt DESC
        `);
        const theftEmailLog = theftEmailLogResult.recordset;
        
        // Calculate theft stats
        const theftTotal = theftIncidents.length;
        const theftToday = theftIncidents.filter(t => {
            const today = new Date();
            const incDate = new Date(t.CreatedAt);
            return incDate.toDateString() === today.toDateString();
        }).length;
        const theftThisWeek = theftIncidents.filter(t => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return new Date(t.CreatedAt) >= weekAgo;
        }).length;
        const theftEmailsSent = theftEmailLog.filter(e => e.Status === 'Sent').length;
        const theftEmailsFailed = theftEmailLog.filter(e => e.Status === 'Failed').length;
        
        // Calculate stats
        const oeOverdue = oeInspections.filter(i => i.ActionPlanStatus === 'Overdue').length;
        const oeDueSoon = oeInspections.filter(i => i.ActionPlanStatus === 'Due Soon').length;
        const oeNoDeadline = oeInspections.filter(i => i.ActionPlanStatus === 'No Deadline').length;
        const ohsOverdue = ohsInspections.filter(i => i.ActionPlanStatus === 'Overdue').length;
        const ohsDueSoon = ohsInspections.filter(i => i.ActionPlanStatus === 'Due Soon').length;
        const ohsNoDeadline = ohsInspections.filter(i => i.ActionPlanStatus === 'No Deadline').length;
        
        // Render helper for inspection rows
        const renderRow = (i, idx, arr, module) => {
            const statusClass = i.ActionPlanStatus === 'Overdue' ? 'overdue' : 
                               i.ActionPlanStatus === 'Due Soon' ? 'due-soon' : 
                               i.ActionPlanStatus === 'Completed' ? 'completed' : 'no-deadline';
            const statusIcon = i.ActionPlanStatus === 'Overdue' ? '🔴' : 
                              i.ActionPlanStatus === 'Due Soon' ? '🟡' : 
                              i.ActionPlanStatus === 'Completed' ? '✅' : '⚪';
            const emailType = i.ActionPlanStatus === 'Overdue' ? 'overdue' : 
                             i.ActionPlanStatus === 'Due Soon' ? 'reminder' : 'reminder';
            // Use Base64 encoding to safely pass data
            const inspectionData = Buffer.from(JSON.stringify({
                storeId: i.StoreId,
                documentNumber: i.DocumentNumber,
                storeName: i.StoreName,
                inspectionDate: i.InspectionDate,
                deadline: i.ActionPlanDeadline,
                daysOverdue: i.DaysOverdue,
                daysLeft: i.DaysUntilDeadline,
                createdBy: i.CreatedByName,
                status: i.ActionPlanStatus
            })).toString('base64');
            return `
                <tr class="${statusClass}">
                    <td><strong>${i.DocumentNumber}</strong></td>
                    <td>${i.StoreName}</td>
                    <td>${i.InspectionDate ? new Date(i.InspectionDate).toLocaleDateString() : '-'}</td>
                    <td>${i.ActionPlanDeadline ? new Date(i.ActionPlanDeadline).toLocaleDateString() : '<span class="no-deadline">Not Set</span>'}</td>
                    <td>
                        <span class="status-pill ${statusClass}">
                            ${statusIcon} ${i.ActionPlanStatus}
                            ${i.DaysOverdue ? `<small>(${i.DaysOverdue} days)</small>` : ''}
                            ${i.DaysUntilDeadline !== null && i.DaysUntilDeadline >= 0 ? `<small>(${i.DaysUntilDeadline} days left)</small>` : ''}
                        </span>
                    </td>
                    <td>${i.CreatedByName || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="previewInspectionEmail('${module}', '${emailType}', '${inspectionData}')">📧 Preview</button>
                    </td>
                </tr>
            `;
        };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Action Plan Tracker - Admin</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px 30px; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header a { color: white; text-decoration: none; opacity: 0.8; }
                    .header a:hover { opacity: 1; }
                    .container { max-width: 1600px; margin: 0 auto; padding: 20px; }
                    
                    .info-banner { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #1565c0; }
                    
                    .scheduler-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
                    .scheduler-card { background: white; border-radius: 10px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 12px; }
                    .scheduler-card .icon { font-size: 24px; }
                    .scheduler-card .info { flex: 1; }
                    .scheduler-card .label { font-size: 11px; color: #888; }
                    .scheduler-card .value { font-size: 14px; font-weight: 600; color: #333; }
                    .scheduler-card.ok { border-left: 3px solid #28a745; }
                    .scheduler-card.error { border-left: 3px solid #dc3545; }
                    .scheduler-card.idle { border-left: 3px solid #6c757d; }
                    
                    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 25px; }
                    .summary-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
                    .summary-card h3 { font-size: 14px; color: #666; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
                    .summary-card .badge { padding: 4px 10px; border-radius: 15px; font-size: 11px; font-weight: 600; }
                    .summary-card .badge.oe { background: #e8f5e9; color: #2e7d32; }
                    .summary-card .badge.ohs { background: #ffebee; color: #c62828; }
                    .summary-card .badge.theft { background: #fff3e0; color: #e65100; }
                    .summary-stats { display: flex; gap: 20px; }
                    .summary-stat { text-align: center; flex: 1; }
                    .summary-stat .value { font-size: 28px; font-weight: 700; }
                    .summary-stat .label { font-size: 11px; color: #888; margin-top: 4px; }
                    .summary-stat.overdue .value { color: #dc3545; }
                    .summary-stat.due-soon .value { color: #ffc107; }
                    .summary-stat.pending .value { color: #6c757d; }
                    
                    .action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
                    .action-bar .meta { font-size: 12px; color: #888; }
                    .action-buttons { display: flex; gap: 10px; }
                    
                    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; text-decoration: none; transition: all 0.2s; }
                    .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
                    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(102,126,234,0.4); }
                    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                    .btn-secondary { background: #e9ecef; color: #495057; }
                    .btn-secondary:hover { background: #dee2e6; }
                    .btn-sm { padding: 6px 12px; font-size: 11px; }
                    .btn-outline { background: white; color: #667eea; border: 1px solid #667eea; }
                    .btn-outline:hover { background: #667eea; color: white; }
                    
                    .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 0; }
                    .tab { padding: 10px 20px; cursor: pointer; font-weight: 600; font-size: 13px; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
                    .tab:hover { color: #333; }
                    .tab.active { color: #667eea; border-bottom-color: #667eea; }
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    
                    .section { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
                    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
                    .section-header h2 { font-size: 16px; color: #333; display: flex; align-items: center; gap: 10px; }
                    
                    .tracking-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    .tracking-table th { background: #f8f9fa; padding: 12px 10px; text-align: left; font-weight: 600; color: #555; border-bottom: 2px solid #eee; }
                    .tracking-table td { padding: 10px; border-bottom: 1px solid #eee; }
                    .tracking-table tr:hover { background: #f8f9fa; }
                    .tracking-table tr.overdue { background: #fff5f5; }
                    .tracking-table tr.overdue:hover { background: #ffe0e0; }
                    .tracking-table tr.due-soon { background: #fffbf0; }
                    .tracking-table tr.due-soon:hover { background: #fff3cd; }
                    
                    .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 15px; font-size: 12px; font-weight: 600; }
                    .status-pill.overdue { background: #f8d7da; color: #721c24; }
                    .status-pill.due-soon { background: #fff3cd; color: #856404; }
                    .status-pill.completed { background: #d4edda; color: #155724; }
                    .status-pill.no-deadline { background: #e9ecef; color: #6c757d; }
                    .status-pill small { font-weight: 400; opacity: 0.8; }
                    .no-deadline { color: #999; font-style: italic; }
                    
                    .empty-state { text-align: center; padding: 40px; color: #888; }
                    .empty-state .icon { font-size: 48px; margin-bottom: 10px; opacity: 0.5; }
                    
                    .templates-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-top: 15px; }
                    .template-card { background: #f8f9fa; border-radius: 8px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; }
                    .template-card:hover { background: #e9ecef; }
                    .template-info { font-size: 13px; color: #333; }
                    .template-info .type { font-size: 11px; color: #888; }
                    .template-actions { display: flex; gap: 5px; }
                    
                    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
                    .modal-content { background: white; border-radius: 12px; width: 90%; max-width: 900px; max-height: 90vh; overflow: auto; }
                    .modal-header { padding: 15px 20px; background: #f5f5f5; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; }
                    .modal-header h3 { margin: 0; font-size: 16px; }
                    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
                    .modal-body { padding: 20px; }
                    .preview-subject { background: #f8f9fa; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; }
                    .preview-subject label { font-size: 11px; color: #666; display: block; margin-bottom: 4px; }
                    .preview-iframe { width: 100%; height: 400px; border: 1px solid #eee; border-radius: 8px; }
                    
                    .dryrun-results { margin-top: 15px; }
                    .dryrun-item { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #28a745; }
                    .dryrun-item h4 { font-size: 14px; color: #333; margin-bottom: 8px; }
                    .dryrun-item p { font-size: 13px; color: #666; margin: 4px 0; }
                    .dryrun-empty { text-align: center; padding: 30px; color: #888; }
                    
                    .loading { display: inline-block; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; border-top-color: transparent; animation: spin 0.8s linear infinite; }
                    .loading-dark { border-color: #667eea; border-top-color: transparent; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    
                    .toast { position: fixed; bottom: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: 600; z-index: 2000; animation: slideIn 0.3s ease; }
                    .toast.success { background: #28a745; }
                    .toast.error { background: #dc3545; }
                    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1><a href="/admin">← Admin</a> / 📋 Action Plan Tracker</h1>
                </div>
                <div class="container">
                    <div class="info-banner">
                        📋 <strong>Action Plan Tracker</strong> monitors all inspections with pending action plans. Overdue items are highlighted. The scheduler sends automatic reminders and escalations.
                    </div>
                    
                    <!-- Scheduler Status -->
                    <div class="scheduler-row">
                        <div class="scheduler-card idle" id="statusCard">
                            <div class="icon">⚡</div>
                            <div class="info">
                                <div class="label">Scheduler</div>
                                <div class="value" id="schedulerStatus">Loading...</div>
                            </div>
                        </div>
                        <div class="scheduler-card">
                            <div class="icon">🕐</div>
                            <div class="info">
                                <div class="label">Last Run</div>
                                <div class="value" id="lastRunTime">-</div>
                            </div>
                        </div>
                        <div class="scheduler-card">
                            <div class="icon">⏭️</div>
                            <div class="info">
                                <div class="label">Next Run</div>
                                <div class="value" id="nextRunTime">-</div>
                            </div>
                        </div>
                        <div class="scheduler-card">
                            <div class="icon">📤</div>
                            <div class="info">
                                <div class="label">Emails Sent</div>
                                <div class="value" id="emailsSent">0</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Job Controls -->
                    <div class="section" style="margin-bottom: 20px;">
                        <div class="section-header" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
                            <h2>🎛️ Job Controls</h2>
                            <div class="meta">Last refreshed: <span id="lastRefresh">just now</span> | Auto-refresh: 30s</div>
                        </div>
                        <div class="job-controls" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px;">
                            <button class="btn btn-outline" id="previewBtn" onclick="previewDryRun()">
                                👁️ Preview (Dry Run)
                            </button>
                            <button class="btn btn-primary" id="runNowBtn" onclick="runNow()">
                                ▶️ Run Now
                            </button>
                            <button class="btn btn-success" id="startSchedulerBtn" onclick="startScheduler()" style="background: linear-gradient(135deg, #28a745, #20c997); color: white;">
                                ⏵ Start Scheduler
                            </button>
                            <button class="btn btn-danger" id="stopSchedulerBtn" onclick="stopScheduler()" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white;">
                                ⏹ Stop Scheduler
                            </button>
                            <button class="btn btn-secondary" onclick="location.reload()">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                    
                    <!-- Summary Cards -->
                    <div class="summary-grid">
                        <div class="summary-card">
                            <h3><span class="badge oe">OE</span> Operational Excellence</h3>
                            <div class="summary-stats">
                                <div class="summary-stat overdue"><div class="value">${oeOverdue}</div><div class="label">🔴 Overdue</div></div>
                                <div class="summary-stat due-soon"><div class="value">${oeDueSoon}</div><div class="label">🟡 Due Soon</div></div>
                                <div class="summary-stat pending"><div class="value">${oeNoDeadline}</div><div class="label">⚪ No Deadline</div></div>
                            </div>
                        </div>
                        <div class="summary-card">
                            <h3><span class="badge ohs">OHS</span> Occupational Health & Safety</h3>
                            <div class="summary-stats">
                                <div class="summary-stat overdue"><div class="value">${ohsOverdue}</div><div class="label">🔴 Overdue</div></div>
                                <div class="summary-stat due-soon"><div class="value">${ohsDueSoon}</div><div class="label">🟡 Due Soon</div></div>
                                <div class="summary-stat pending"><div class="value">${ohsNoDeadline}</div><div class="label">⚪ No Deadline</div></div>
                            </div>
                        </div>
                        <div class="summary-card">
                            <h3><span class="badge theft">🚨</span> Theft Incidents</h3>
                            <div class="summary-stats">
                                <div class="summary-stat" style="color: #e65100;"><div class="value">${theftToday}</div><div class="label">📅 Today</div></div>
                                <div class="summary-stat" style="color: #ff9800;"><div class="value">${theftThisWeek}</div><div class="label">📊 This Week</div></div>
                                <div class="summary-stat"><div class="value" style="color: #28a745;">${theftEmailsSent}</div><div class="label">✉️ Emails Sent</div></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tabs -->
                    <div class="tabs">
                        <div class="tab active" data-tab="oe-tab">📋 OE Inspections (${oeInspections.length})</div>
                        <div class="tab" data-tab="oe-dept-esc-tab">🏢 OE Dept Esc</div>
                        <div class="tab" data-tab="ohs-tab">📋 OHS Inspections (${ohsInspections.length})</div>
                        <div class="tab" data-tab="ohs-dept-esc-tab">🏢 OHS Dept Esc</div>
                        <div class="tab" data-tab="theft-tab">🚨 Theft Incidents (${theftIncidents.length})</div>
                        <div class="tab" data-tab="fivedays-tab">📅 5 Days Reminders</div>
                        <div class="tab" data-tab="templates-tab">📧 Email Templates</div>
                    </div>
                    
                    <!-- OE Tab -->
                    <div class="tab-content active" id="oe-tab">
                        <div class="section">
                            <div class="section-header"><h2><span class="badge oe">OE</span> Pending Action Plans</h2></div>
                            ${oeInspections.length > 0 ? `
                                <table class="tracking-table">
                                    <thead><tr><th>Document #</th><th>Store</th><th>Inspection Date</th><th>Deadline</th><th>Status</th><th>Created By</th><th>Actions</th></tr></thead>
                                    <tbody>${oeInspections.map((i, idx, arr) => renderRow(i, idx, arr, 'OE')).join('')}</tbody>
                                </table>
                            ` : `<div class="empty-state"><div class="icon">✅</div><p>No pending action plans</p></div>`}
                        </div>
                    </div>
                    
                    <!-- OHS Tab -->
                    <div class="tab-content" id="ohs-tab">
                        <div class="section">
                            <div class="section-header"><h2><span class="badge ohs">OHS</span> Pending Action Plans</h2></div>
                            ${ohsInspections.length > 0 ? `
                                <table class="tracking-table">
                                    <thead><tr><th>Document #</th><th>Store</th><th>Inspection Date</th><th>Deadline</th><th>Status</th><th>Created By</th><th>Actions</th></tr></thead>
                                    <tbody>${ohsInspections.map((i, idx, arr) => renderRow(i, idx, arr, 'OHS')).join('')}</tbody>
                                </table>
                            ` : `<div class="empty-state"><div class="icon">✅</div><p>No pending action plans</p></div>`}
                        </div>
                    </div>
                    
                    <!-- OE Department Escalations Tab -->
                    <div class="tab-content" id="oe-dept-esc-tab">
                        <div class="section">
                            <div class="section-header">
                                <h2><span class="badge oe">OE</span> Department Escalations</h2>
                                <div style="display: flex; gap: 10px;">
                                    <button class="btn btn-primary btn-sm" onclick="runDeptEscalationCheck()">🔄 Check Now</button>
                                    <button class="btn btn-outline btn-sm" onclick="refreshDeptEscalations('OE')">🔃 Refresh</button>
                                </div>
                            </div>
                            
                            <!-- Stats Cards -->
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #10b981;" id="oe-dept-esc-pending">-</div>
                                    <div style="font-size: 12px; color: #64748b;">Pending</div>
                                </div>
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #ef4444;" id="oe-dept-esc-overdue">-</div>
                                    <div style="font-size: 12px; color: #64748b;">Overdue</div>
                                </div>
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #f59e0b;" id="oe-dept-esc-inprogress">-</div>
                                    <div style="font-size: 12px; color: #64748b;">In Progress</div>
                                </div>
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;" id="oe-dept-esc-resolved">-</div>
                                    <div style="font-size: 12px; color: #64748b;">Resolved</div>
                                </div>
                            </div>
                            
                            <!-- Pending Escalations Table -->
                            <h4 style="font-size: 14px; margin: 20px 0 10px; color: #333;">📋 OE Pending Department Escalations</h4>
                            <div id="oe-dept-esc-table">
                                <div class="empty-state"><div class="icon">⏳</div><p>Loading...</p></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- OHS Department Escalations Tab -->
                    <div class="tab-content" id="ohs-dept-esc-tab">
                        <div class="section">
                            <div class="section-header">
                                <h2><span class="badge ohs">OHS</span> Department Escalations</h2>
                                <div style="display: flex; gap: 10px;">
                                    <button class="btn btn-primary btn-sm" onclick="runDeptEscalationCheck()">🔄 Check Now</button>
                                    <button class="btn btn-outline btn-sm" onclick="refreshDeptEscalations('OHS')">🔃 Refresh</button>
                                </div>
                            </div>
                            
                            <!-- Stats Cards -->
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #f97316;" id="ohs-dept-esc-pending">-</div>
                                    <div style="font-size: 12px; color: #64748b;">Pending</div>
                                </div>
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #ef4444;" id="ohs-dept-esc-overdue">-</div>
                                    <div style="font-size: 12px; color: #64748b;">Overdue</div>
                                </div>
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #f59e0b;" id="ohs-dept-esc-inprogress">-</div>
                                    <div style="font-size: 12px; color: #64748b;">In Progress</div>
                                </div>
                                <div class="summary-card" style="padding: 15px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;" id="ohs-dept-esc-resolved">-</div>
                                    <div style="font-size: 12px; color: #64748b;">Resolved</div>
                                </div>
                            </div>
                            
                            <!-- Pending Escalations Table -->
                            <h4 style="font-size: 14px; margin: 20px 0 10px; color: #333;">📋 OHS Pending Department Escalations</h4>
                            <div id="ohs-dept-esc-table">
                                <div class="empty-state"><div class="icon">⏳</div><p>Loading...</p></div>
                            </div>
                            
                            <!-- Department Contacts (show only on OHS tab) -->
                            <h4 style="font-size: 14px; margin: 30px 0 10px; color: #333;">📧 Department Contacts</h4>
                            <div id="dept-contacts-container">
                                <div class="empty-state"><div class="icon">⏳</div><p>Loading...</p></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Theft Incidents Tab -->
                    <div class="tab-content" id="theft-tab">
                        <div class="section">
                            <div class="section-header">
                                <h2><span class="badge theft">🚨</span> Theft Incidents</h2>
                                <div style="font-size: 12px; color: #666;">
                                    Total: ${theftTotal} | This Week: ${theftThisWeek} | Emails Sent: ${theftEmailsSent} | Failed: ${theftEmailsFailed}
                                </div>
                            </div>
                            
                            <!-- Recent Incidents Table -->
                            <h4 style="font-size: 14px; margin: 20px 0 10px; color: #333;">📋 Recent Incidents</h4>
                            ${theftIncidents.length > 0 ? `
                                <table class="tracking-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Store</th>
                                            <th>Incident Date</th>
                                            <th>Stolen Value</th>
                                            <th>Capture Method</th>
                                            <th>Reported By</th>
                                            <th>Emails</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${theftIncidents.slice(0, 20).map(t => `
                                            <tr>
                                                <td><strong>#${t.Id}</strong></td>
                                                <td>${t.StoreName || '-'}</td>
                                                <td>${t.IncidentDate ? new Date(t.IncidentDate).toLocaleDateString('en-GB') : '-'}</td>
                                                <td><strong>${t.Currency} ${parseFloat(t.StolenValue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></td>
                                                <td>${t.CaptureMethod || '-'}</td>
                                                <td>${t.CreatedByName || '-'}</td>
                                                <td>
                                                    <span class="status-pill ${t.EmailsSent > 0 ? 'completed' : 'no-deadline'}">
                                                        ${t.EmailsSent > 0 ? '✅ ' + t.EmailsSent + ' sent' : '⚪ None'}
                                                    </span>
                                                    ${t.EmailsFailed > 0 ? '<span class="status-pill overdue" style="margin-left:5px;">❌ ' + t.EmailsFailed + ' failed</span>' : ''}
                                                </td>
                                                <td>
                                                    <a href="/stores/theft-incident/reports/${t.Id}" class="btn btn-outline btn-sm" target="_blank">👁️ View</a>
                                                    <button class="btn btn-outline btn-sm" onclick="resendTheftEmail(${t.Id})">📧 Resend</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : '<div class="empty-state"><div class="icon">📋</div><p>No theft incidents reported</p></div>'}
                            
                            <!-- Email Log -->
                            <h4 style="font-size: 14px; margin: 30px 0 10px; color: #333;">📧 Email Log (Last 50)</h4>
                            ${theftEmailLog.length > 0 ? `
                                <table class="tracking-table">
                                    <thead>
                                        <tr>
                                            <th>Incident</th>
                                            <th>Store</th>
                                            <th>To</th>
                                            <th>Subject</th>
                                            <th>Status</th>
                                            <th>Sent At</th>
                                            <th>Sent By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${theftEmailLog.map(e => `
                                            <tr class="${e.Status === 'Failed' ? 'overdue' : ''}">
                                                <td><strong>#${e.IncidentId}</strong></td>
                                                <td>${e.StoreName || '-'}</td>
                                                <td>${e.ToEmail}</td>
                                                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.Subject || '-'}</td>
                                                <td>
                                                    <span class="status-pill ${e.Status === 'Sent' ? 'completed' : e.Status === 'Failed' ? 'overdue' : 'no-deadline'}">
                                                        ${e.Status === 'Sent' ? '✅' : e.Status === 'Failed' ? '❌' : '⏳'} ${e.Status}
                                                    </span>
                                                    ${e.ErrorMessage ? '<div style="font-size:10px;color:#dc3545;margin-top:3px;">' + e.ErrorMessage.substring(0, 50) + '</div>' : ''}
                                                </td>
                                                <td>${e.SentAt ? new Date(e.SentAt).toLocaleString('en-GB') : '-'}</td>
                                                <td>${e.SentByName || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : '<div class="empty-state"><div class="icon">📧</div><p>No emails sent yet</p></div>'}
                        </div>
                    </div>
                    
                    <!-- 5 Days Reminders Tab -->
                    <div class="tab-content" id="fivedays-tab">
                        <div class="section">
                            <div class="section-header">
                                <h2><span class="badge" style="background:#667eea20;color:#667eea;">📅</span> 5 Days Expired Items - Reminder System</h2>
                                <button class="btn btn-primary btn-sm" onclick="runFiveDaysNow()">▶️ Run Now</button>
                            </div>
                            
                            <div class="info-banner" style="margin-bottom: 20px;">
                                <strong>📅 5 Days Cycle:</strong> Stores must record expired items during the 1st-5th and 15th-19th of each month.
                                This system sends automatic reminders throughout the cycle.
                            </div>
                            
                            <!-- Cycle Status -->
                            <div class="scheduler-row" style="margin-bottom: 20px;">
                                <div class="scheduler-card" id="fiveDaysCycleCard">
                                    <div class="icon">📅</div>
                                    <div class="info">
                                        <div class="label">Current Cycle</div>
                                        <div class="value" id="fiveDaysCycleInfo">Loading...</div>
                                    </div>
                                </div>
                                <div class="scheduler-card">
                                    <div class="icon">📧</div>
                                    <div class="info">
                                        <div class="label">Today's Reminder</div>
                                        <div class="value" id="fiveDaysReminderType">-</div>
                                    </div>
                                </div>
                                <div class="scheduler-card">
                                    <div class="icon">🕐</div>
                                    <div class="info">
                                        <div class="label">Last Run</div>
                                        <div class="value" id="fiveDaysLastRun">-</div>
                                    </div>
                                </div>
                                <div class="scheduler-card">
                                    <div class="icon">📤</div>
                                    <div class="info">
                                        <div class="label">Emails Sent (Total)</div>
                                        <div class="value" id="fiveDaysEmailsSent">0</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Visual Step Tracker -->
                            <h4 style="font-size: 14px; margin: 20px 0 10px; color: #333;">📊 Cycle Progress Tracker</h4>
                            <div id="fiveDaysStepTracker" style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                                <div style="display: flex; justify-content: space-between; position: relative; margin-bottom: 30px;">
                                    <!-- Progress Line -->
                                    <div style="position: absolute; top: 20px; left: 30px; right: 30px; height: 4px; background: #e0e0e0; z-index: 1;"></div>
                                    <div id="fiveDaysProgressLine" style="position: absolute; top: 20px; left: 30px; height: 4px; background: linear-gradient(90deg, #667eea, #764ba2); z-index: 2; width: 0%; transition: width 0.5s;"></div>
                                    
                                    <!-- Steps -->
                                    <div class="step-item" data-step="INITIATE" style="text-align: center; z-index: 3; flex: 1;">
                                        <div class="step-circle" id="step-INITIATE" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 16px; transition: all 0.3s;">📢</div>
                                        <div style="font-size: 11px; color: #666;">Day 1</div>
                                        <div style="font-size: 10px; font-weight: 600;">INITIATE</div>
                                    </div>
                                    <div class="step-item" data-step="DAY_2" style="text-align: center; z-index: 3; flex: 1;">
                                        <div class="step-circle" id="step-DAY_2" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 16px; transition: all 0.3s;">📋</div>
                                        <div style="font-size: 11px; color: #666;">Day 2</div>
                                        <div style="font-size: 10px; font-weight: 600;">DAY 2</div>
                                    </div>
                                    <div class="step-item" data-step="REMINDER_48H" style="text-align: center; z-index: 3; flex: 1;">
                                        <div class="step-circle" id="step-REMINDER_48H" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 16px; transition: all 0.3s;">⏰</div>
                                        <div style="font-size: 11px; color: #666;">Day 3</div>
                                        <div style="font-size: 10px; font-weight: 600;">48H</div>
                                    </div>
                                    <div class="step-item" data-step="DAY_4" style="text-align: center; z-index: 3; flex: 1;">
                                        <div class="step-circle" id="step-DAY_4" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 16px; transition: all 0.3s;">📋</div>
                                        <div style="font-size: 11px; color: #666;">Day 4</div>
                                        <div style="font-size: 10px; font-weight: 600;">DAY 4</div>
                                    </div>
                                    <div class="step-item" data-step="DAY_5" style="text-align: center; z-index: 3; flex: 1;">
                                        <div class="step-circle" id="step-DAY_5" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 16px; transition: all 0.3s;">📋</div>
                                        <div style="font-size: 11px; color: #666;">Day 5</div>
                                        <div style="font-size: 10px; font-weight: 600;">FINAL DAY</div>
                                    </div>
                                    <div class="step-item" data-step="FINAL_REMINDER" style="text-align: center; z-index: 3; flex: 1;">
                                        <div class="step-circle" id="step-FINAL_REMINDER" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 16px; transition: all 0.3s;">⚠️</div>
                                        <div style="font-size: 11px; color: #666;">Day 6</div>
                                        <div style="font-size: 10px; font-weight: 600;">FINAL</div>
                                    </div>
                                    <div class="step-item" data-step="OVERDUE_WARNING" style="text-align: center; z-index: 3; flex: 1;">
                                        <div class="step-circle" id="step-OVERDUE_WARNING" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 16px; transition: all 0.3s;">🚨</div>
                                        <div style="font-size: 11px; color: #666;">Day 7+</div>
                                        <div style="font-size: 10px; font-weight: 600;">OVERDUE</div>
                                    </div>
                                </div>
                                
                                <!-- Legend -->
                                <div style="display: flex; gap: 20px; justify-content: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px;">
                                    <span><span style="display: inline-block; width: 12px; height: 12px; background: #28a745; border-radius: 50%; margin-right: 5px;"></span> Completed</span>
                                    <span><span style="display: inline-block; width: 12px; height: 12px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; margin-right: 5px;"></span> Current</span>
                                    <span><span style="display: inline-block; width: 12px; height: 12px; background: #e0e0e0; border-radius: 50%; margin-right: 5px;"></span> Upcoming</span>
                                </div>
                            </div>
                            
                            <!-- Sent Reminders for Current Cycle -->
                            <h4 style="font-size: 14px; margin: 20px 0 10px; color: #333;">✅ Sent Reminders (Current Cycle)</h4>
                            <div id="fiveDaysSentReminders" style="margin-bottom: 20px;">Loading...</div>
                            
                            <!-- Reminder Schedule Reference -->
                            <details style="margin-bottom: 20px;">
                                <summary style="cursor: pointer; font-size: 14px; font-weight: 600; color: #333; padding: 10px; background: #f8f9fa; border-radius: 8px;">📋 View Full Reminder Schedule</summary>
                                <table class="tracking-table" style="margin-top: 10px;">
                                    <thead>
                                        <tr><th>Day</th><th>Reminder Type</th><th>Description</th><th>Priority</th><th>Target</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>Day 1 (Cycle Start)</td><td><span class="status-pill completed">INITIATE</span></td><td>Inform stores the cycle has started</td><td>🔴 High</td><td>All Stores</td></tr>
                                        <tr><td>Day 2</td><td><span class="status-pill no-deadline">DAY_2</span></td><td>Continue recording findings</td><td>🟡 Normal</td><td>All Stores</td></tr>
                                        <tr><td>Day 3</td><td><span class="status-pill due-soon">48H REMINDER</span></td><td>48 hours left to complete entries</td><td>🔴 High</td><td>Stores without entries</td></tr>
                                        <tr><td>Day 4</td><td><span class="status-pill no-deadline">DAY_4</span></td><td>Almost done! Continue your checks</td><td>🟡 Normal</td><td>All Stores</td></tr>
                                        <tr><td>Day 5</td><td><span class="status-pill no-deadline">DAY_5</span></td><td>Final day of cycle - complete all entries</td><td>🔴 High</td><td>All Stores</td></tr>
                                        <tr class="due-soon"><td>Day 6 (After Cycle)</td><td><span class="status-pill due-soon">FINAL_REMINDER</span></td><td>Final reminder to present all findings</td><td>🔴 High</td><td>Stores without submissions</td></tr>
                                        <tr class="overdue"><td>Day 7-10</td><td><span class="status-pill overdue">OVERDUE_WARNING</span></td><td>Warning: Missing data affects audit</td><td>🔴 High</td><td>Stores without submissions</td></tr>
                                    </tbody>
                                </table>
                            </details>
                            
                            <!-- Dry Run Preview -->
                            <h4 style="font-size: 14px; margin: 30px 0 10px; color: #333;">🧪 Dry Run Preview</h4>
                            <button class="btn btn-outline btn-sm" onclick="fiveDaysDryRun()" style="margin-bottom: 15px;">👁️ Preview What Would Be Sent</button>
                            <div id="fiveDaysDryRunResults" style="display:none;"></div>
                            
                            <!-- Recent History -->
                            <h4 style="font-size: 14px; margin: 30px 0 10px; color: #333;">📧 Recent Email History</h4>
                            <div id="fiveDaysHistory">Loading...</div>
                        </div>
                    </div>
                    
                    <!-- Templates Tab -->
                    <div class="tab-content" id="templates-tab">
                        <div class="section">
                            <div class="section-header"><h2>📧 Notification Templates</h2></div>
                            <p style="color: #666; margin-bottom: 20px; font-size: 13px;">Preview templates or run a <strong>Dry Run</strong> to see what would be sent.</p>
                            
                            <div style="margin-bottom: 25px;">
                                <h4 style="font-size: 14px; color: #2e7d32; margin-bottom: 10px;">🟢 OE Templates (${oeTemplates.length})</h4>
                                <div class="templates-grid">
                                    ${oeTemplates.map(t => `
                                        <div class="template-card">
                                            <div class="template-info"><div>${t.TemplateName}</div><div class="type">${t.ReportType}</div></div>
                                            <div class="template-actions">
                                                <button class="btn btn-secondary btn-sm" onclick="previewTemplate('${t.TemplateKey}')">👁️</button>
                                                <button class="btn btn-outline btn-sm" onclick="dryRunTemplate('${t.TemplateKey}', '${t.Module}', '${t.ReportType}')">🧪</button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div>
                                <h4 style="font-size: 14px; color: #c62828; margin-bottom: 10px;">🔴 OHS Templates (${ohsTemplates.length})</h4>
                                <div class="templates-grid">
                                    ${ohsTemplates.map(t => `
                                        <div class="template-card">
                                            <div class="template-info"><div>${t.TemplateName}</div><div class="type">${t.ReportType}</div></div>
                                            <div class="template-actions">
                                                <button class="btn btn-secondary btn-sm" onclick="previewTemplate('${t.TemplateKey}')">👁️</button>
                                                <button class="btn btn-outline btn-sm" onclick="dryRunTemplate('${t.TemplateKey}', '${t.Module}', '${t.ReportType}')">🧪</button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Preview Modal -->
                <div class="modal" id="previewModal">
                    <div class="modal-content">
                        <div class="modal-header"><h3 id="previewTitle">Email Preview</h3><button class="modal-close" onclick="closeModal('previewModal')">&times;</button></div>
                        <div class="modal-body">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                                <div class="preview-subject"><label>From</label><div id="previewFrom">-</div></div>
                                <div class="preview-subject"><label>To (Original)</label><div id="previewTo">-</div></div>
                            </div>
                            <div class="preview-subject"><label>Subject</label><div id="previewSubject">-</div></div>
                            <iframe id="previewIframe" class="preview-iframe"></iframe>
                            
                            <!-- Send Test Email Section -->
                            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 2px dashed #667eea;">
                                <h4 style="margin: 0 0 10px; color: #333; font-size: 14px;">📧 Send Test Email</h4>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <input type="email" id="testEmailRecipient" placeholder="Enter test email address..." 
                                        style="flex: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                                    <button class="btn btn-primary" id="sendTestEmailBtn" onclick="sendTestEmail()">
                                        📤 Send Test
                                    </button>
                                </div>
                                <p style="margin: 8px 0 0; font-size: 11px; color: #888;">Enter any email address to receive a test copy of this notification.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Dry Run Modal -->
                <div class="modal" id="dryrunModal">
                    <div class="modal-content">
                        <div class="modal-header"><h3 id="dryrunTitle">🧪 Dry Run Results</h3><button class="modal-close" onclick="closeModal('dryrunModal')">&times;</button></div>
                        <div class="modal-body">
                            <p style="color: #666; margin-bottom: 15px; font-size: 13px;">These notifications <strong>would be sent</strong> if the scheduler runs now.</p>
                            <div id="dryrunResults" class="dryrun-results"></div>
                        </div>
                    </div>
                </div>
                
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        refreshStatus();
                        setInterval(refreshStatus, 30000);
                        
                        document.querySelectorAll('.tab').forEach(tab => {
                            tab.addEventListener('click', () => {
                                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                                tab.classList.add('active');
                                document.getElementById(tab.dataset.tab).classList.add('active');
                            });
                        });
                    });
                    
                    async function refreshStatus() {
                        try {
                            const res = await fetch('/admin/api/job-monitor');
                            const data = await res.json();
                            if (data.success) {
                                const s = data.scheduler;
                                const card = document.getElementById('statusCard');
                                const status = document.getElementById('schedulerStatus');
                                const startBtn = document.getElementById('startSchedulerBtn');
                                const stopBtn = document.getElementById('stopSchedulerBtn');
                                
                                // Update scheduler status display
                                if (s.isRunning) { 
                                    status.textContent = '⏳ Running Job...'; 
                                    card.className = 'scheduler-card idle'; 
                                } else if (s.schedulerRunning) { 
                                    status.textContent = '✅ Active'; 
                                    card.className = 'scheduler-card ok'; 
                                } else { 
                                    status.textContent = '⏹️ Stopped'; 
                                    card.className = 'scheduler-card error'; 
                                }
                                
                                // Toggle start/stop buttons
                                if (s.schedulerRunning) {
                                    startBtn.style.display = 'none';
                                    stopBtn.style.display = 'inline-flex';
                                } else {
                                    startBtn.style.display = 'inline-flex';
                                    stopBtn.style.display = 'none';
                                }
                                
                                document.getElementById('lastRunTime').textContent = s.lastRunTime ? new Date(s.lastRunTime).toLocaleString() : 'Never';
                                document.getElementById('nextRunTime').textContent = s.nextRunTime ? new Date(s.nextRunTime).toLocaleString() : '-';
                                document.getElementById('emailsSent').textContent = s.stats?.emailsSent || 0;
                                document.getElementById('lastRefresh').textContent = 'just now';
                            }
                        } catch (e) { console.error(e); }
                    }
                    
                    async function runNow() {
                        const btn = document.getElementById('runNowBtn');
                        btn.innerHTML = '<span class="loading"></span> Running...'; btn.disabled = true;
                        try {
                            const res = await fetch('/admin/api/job-monitor/run-now', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) { showToast('Scheduler executed successfully!', 'success'); setTimeout(() => location.reload(), 2000); }
                            else { showToast(data.error || 'Failed', 'error'); }
                        } catch (e) { showToast('Error: ' + e.message, 'error'); }
                        finally { btn.innerHTML = '▶️ Run Now'; btn.disabled = false; }
                    }
                    
                    async function startScheduler() {
                        const btn = document.getElementById('startSchedulerBtn');
                        btn.innerHTML = '<span class="loading"></span> Starting...'; btn.disabled = true;
                        try {
                            const res = await fetch('/admin/api/job-monitor/start-scheduler', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) { showToast('Scheduler started!', 'success'); setTimeout(() => location.reload(), 1500); }
                            else { showToast(data.error || 'Failed to start scheduler', 'error'); }
                        } catch (e) { showToast('Error: ' + e.message, 'error'); }
                        finally { btn.innerHTML = '⏵ Start Scheduler'; btn.disabled = false; }
                    }
                    
                    async function stopScheduler() {
                        const btn = document.getElementById('stopSchedulerBtn');
                        btn.innerHTML = '<span class="loading"></span> Stopping...'; btn.disabled = true;
                        try {
                            const res = await fetch('/admin/api/job-monitor/stop-scheduler', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) { showToast('Scheduler stopped!', 'success'); setTimeout(() => location.reload(), 1500); }
                            else { showToast(data.error || 'Failed to stop scheduler', 'error'); }
                        } catch (e) { showToast('Error: ' + e.message, 'error'); }
                        finally { btn.innerHTML = '⏹ Stop Scheduler'; btn.disabled = false; }
                    }
                    
                    async function previewDryRun() {
                        const btn = document.getElementById('previewBtn');
                        btn.innerHTML = '<span class="loading loading-dark"></span> Loading...'; btn.disabled = true;
                        document.getElementById('dryrunTitle').textContent = '👁️ Preview (Dry Run) - Pending Notifications';
                        document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty"><span class="loading loading-dark"></span> Checking all pending notifications...</div>';
                        document.getElementById('dryrunModal').style.display = 'flex';
                        try {
                            const res = await fetch('/admin/api/job-monitor/dry-run-all');
                            const data = await res.json();
                            if (data.success) {
                                const results = data.results || { oe: { reminders: [], overdue: [] }, ohs: { reminders: [], overdue: [] } };
                                let html = '';
                                
                                // OE Section
                                html += '<h4 style="margin: 15px 0 10px; color: #333;">📋 OE Inspections</h4>';
                                if (results.oe.overdue.length > 0) {
                                    html += '<div style="margin-bottom: 10px;"><strong style="color: #dc3545;">🔴 Overdue (' + results.oe.overdue.length + ')</strong></div>';
                                    html += results.oe.overdue.map(i => '<div class="dryrun-item" style="border-left-color: #dc3545;"><h4>' + i.storeName + ' - ' + i.documentNumber + '</h4><p><strong>Days Overdue:</strong> ' + (i.daysOverdue || 0) + '</p><p><strong>To:</strong> ' + (i.recipientEmail || 'N/A') + '</p></div>').join('');
                                }
                                if (results.oe.reminders.length > 0) {
                                    html += '<div style="margin-bottom: 10px;"><strong style="color: #ffc107;">🟡 Reminders (' + results.oe.reminders.length + ')</strong></div>';
                                    html += results.oe.reminders.map(i => '<div class="dryrun-item" style="border-left-color: #ffc107;"><h4>' + i.storeName + ' - ' + i.documentNumber + '</h4><p><strong>Days Until Deadline:</strong> ' + (i.daysUntilDeadline || 0) + '</p><p><strong>To:</strong> ' + (i.recipientEmail || 'N/A') + '</p></div>').join('');
                                }
                                if (results.oe.overdue.length === 0 && results.oe.reminders.length === 0) {
                                    html += '<div class="dryrun-empty" style="padding: 15px;">✅ No pending OE notifications</div>';
                                }
                                
                                // OHS Section
                                html += '<h4 style="margin: 20px 0 10px; color: #333;">🦺 OHS Inspections</h4>';
                                if (results.ohs.overdue.length > 0) {
                                    html += '<div style="margin-bottom: 10px;"><strong style="color: #dc3545;">🔴 Overdue (' + results.ohs.overdue.length + ')</strong></div>';
                                    html += results.ohs.overdue.map(i => '<div class="dryrun-item" style="border-left-color: #dc3545;"><h4>' + i.storeName + ' - ' + i.documentNumber + '</h4><p><strong>Days Overdue:</strong> ' + (i.daysOverdue || 0) + '</p><p><strong>To:</strong> ' + (i.recipientEmail || 'N/A') + '</p></div>').join('');
                                }
                                if (results.ohs.reminders.length > 0) {
                                    html += '<div style="margin-bottom: 10px;"><strong style="color: #ffc107;">🟡 Reminders (' + results.ohs.reminders.length + ')</strong></div>';
                                    html += results.ohs.reminders.map(i => '<div class="dryrun-item" style="border-left-color: #ffc107;"><h4>' + i.storeName + ' - ' + i.documentNumber + '</h4><p><strong>Days Until Deadline:</strong> ' + (i.daysUntilDeadline || 0) + '</p><p><strong>To:</strong> ' + (i.recipientEmail || 'N/A') + '</p></div>').join('');
                                }
                                if (results.ohs.overdue.length === 0 && results.ohs.reminders.length === 0) {
                                    html += '<div class="dryrun-empty" style="padding: 15px;">✅ No pending OHS notifications</div>';
                                }
                                
                                document.getElementById('dryrunResults').innerHTML = html || '<div class="dryrun-empty">✅ No pending notifications</div>';
                            } else { 
                                document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty">❌ ' + (data.error || 'Error') + '</div>'; 
                            }
                        } catch (e) { 
                            document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty">❌ ' + e.message + '</div>'; 
                        }
                        finally { btn.innerHTML = '👁️ Preview (Dry Run)'; btn.disabled = false; }
                    }
                    
                    async function previewTemplate(key) {
                        try {
                            const res = await fetch('/admin/api/job-monitor/preview-template/' + key);
                            const data = await res.json();
                            if (data.success) {
                                document.getElementById('previewTitle').textContent = data.template.name;
                                document.getElementById('previewSubject').textContent = data.preview.subject;
                                document.getElementById('previewIframe').srcdoc = data.preview.bodyHtml;
                                document.getElementById('previewModal').style.display = 'flex';
                            }
                        } catch (e) { showToast('Error: ' + e.message, 'error'); }
                    }
                    
                    // Store current preview data for sending
                    let currentPreviewData = null;
                    
                    async function previewInspectionEmail(module, type, base64Data) {
                        // Decode Base64 data
                        const inspection = JSON.parse(atob(base64Data));
                        const templateKey = module.toLowerCase() + '_inspection_' + type;
                        try {
                            const res = await fetch('/admin/api/job-monitor/preview-inspection-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ module, type, inspection, templateKey })
                            });
                            const data = await res.json();
                            if (data.success) {
                                // Store for sending
                                currentPreviewData = {
                                    subject: data.preview.subject,
                                    bodyHtml: data.preview.bodyHtml,
                                    module: module,
                                    type: type,
                                    documentNumber: inspection.documentNumber
                                };
                                
                                document.getElementById('previewTitle').textContent = '📧 ' + inspection.documentNumber + ' - ' + (type === 'overdue' ? 'Overdue Notice' : 'Reminder');
                                document.getElementById('previewFrom').textContent = data.preview.from || 'N/A';
                                document.getElementById('previewTo').textContent = (data.preview.toName || '') + ' <' + (data.preview.to || 'N/A') + '>';
                                document.getElementById('previewSubject').textContent = data.preview.subject;
                                document.getElementById('previewIframe').srcdoc = data.preview.bodyHtml;
                                document.getElementById('testEmailRecipient').value = '';
                                document.getElementById('previewModal').style.display = 'flex';
                            } else {
                                showToast(data.error || 'Error loading preview', 'error');
                            }
                        } catch (e) { showToast('Error: ' + e.message, 'error'); }
                    }
                    
                    async function sendTestEmail() {
                        const email = document.getElementById('testEmailRecipient').value.trim();
                        if (!email) {
                            showToast('Please enter an email address', 'error');
                            return;
                        }
                        if (!email.includes('@')) {
                            showToast('Please enter a valid email address', 'error');
                            return;
                        }
                        if (!currentPreviewData) {
                            showToast('No email to send. Please preview first.', 'error');
                            return;
                        }
                        
                        const btn = document.getElementById('sendTestEmailBtn');
                        btn.innerHTML = '<span class="loading"></span> Sending...';
                        btn.disabled = true;
                        
                        try {
                            const res = await fetch('/admin/api/job-monitor/send-test-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    to: email,
                                    subject: currentPreviewData.subject,
                                    bodyHtml: currentPreviewData.bodyHtml
                                })
                            });
                            const data = await res.json();
                            if (data.success) {
                                showToast('✅ Test email sent to ' + email, 'success');
                            } else {
                                showToast(data.error || 'Failed to send', 'error');
                            }
                        } catch (e) {
                            showToast('Error: ' + e.message, 'error');
                        } finally {
                            btn.innerHTML = '📤 Send Test';
                            btn.disabled = false;
                        }
                    }
                    
                    async function dryRunTemplate(key, module, type) {
                        document.getElementById('dryrunTitle').textContent = '🧪 Dry Run: ' + module + ' ' + type;
                        document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty"><span class="loading loading-dark"></span> Checking...</div>';
                        document.getElementById('dryrunModal').style.display = 'flex';
                        try {
                            const res = await fetch('/admin/api/job-monitor/dry-run?module=' + module + '&type=' + type);
                            const data = await res.json();
                            if (data.success) {
                                const r = data.results || [];
                                document.getElementById('dryrunResults').innerHTML = r.length > 0 
                                    ? r.map(i => '<div class="dryrun-item"><h4>' + i.storeName + ' - ' + i.documentNumber + '</h4><p><strong>Deadline:</strong> ' + (i.deadline ? new Date(i.deadline).toLocaleDateString() : 'N/A') + '</p><p><strong>' + (i.daysOverdue ? 'Days Overdue: ' + i.daysOverdue : 'Days Left: ' + (i.daysUntilDeadline || 'N/A')) + '</strong></p></div>').join('')
                                    : '<div class="dryrun-empty">✅ No pending notifications</div>';
                            } else { document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty">❌ ' + (data.error || 'Error') + '</div>'; }
                        } catch (e) { document.getElementById('dryrunResults').innerHTML = '<div class="dryrun-empty">❌ ' + e.message + '</div>'; }
                    }
                    
                    function closeModal(id) { document.getElementById(id).style.display = 'none'; }
                    
                    async function resendTheftEmail(incidentId) {
                        if (!confirm('Resend email notification for theft incident #' + incidentId + '?')) return;
                        
                        try {
                            const res = await fetch('/admin/api/job-monitor/resend-theft-email/' + incidentId, { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                                showToast('✅ Email sent successfully!', 'success');
                                setTimeout(() => location.reload(), 2000);
                            } else {
                                showToast(data.error || 'Failed to send email', 'error');
                            }
                        } catch (e) {
                            showToast('Error: ' + e.message, 'error');
                        }
                    }
                    
                    function showToast(msg, type) {
                        const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
                        document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
                    }
                    
                    ['previewModal', 'dryrunModal'].forEach(id => {
                        document.getElementById(id).addEventListener('click', function(e) { if (e.target === this) closeModal(id); });
                    });
                    
                    // ==========================================
                    // DEPARTMENT ESCALATION FUNCTIONS
                    // ==========================================
                    
                    // Load OE department escalation data when tab is clicked
                    document.querySelector('[data-tab="oe-dept-esc-tab"]').addEventListener('click', function() {
                        loadDeptEscalationStats('OE');
                        loadPendingDeptEscalations('OE');
                    });
                    
                    // Load OHS department escalation data when tab is clicked
                    document.querySelector('[data-tab="ohs-dept-esc-tab"]').addEventListener('click', function() {
                        loadDeptEscalationStats('OHS');
                        loadPendingDeptEscalations('OHS');
                        loadDeptContacts();
                    });
                    
                    async function loadDeptEscalationStats(module) {
                        try {
                            const res = await fetch('/admin/api/job-monitor/department-escalations');
                            const data = await res.json();
                            
                            if (data.success) {
                                const stats = data.stats[module] || { pending: 0, overdue: 0, inProgress: 0, resolved: 0 };
                                const prefix = module.toLowerCase();
                                document.getElementById(prefix + '-dept-esc-pending').textContent = stats.pending || 0;
                                document.getElementById(prefix + '-dept-esc-overdue').textContent = stats.overdue || 0;
                                document.getElementById(prefix + '-dept-esc-inprogress').textContent = stats.inProgress || 0;
                                document.getElementById(prefix + '-dept-esc-resolved').textContent = stats.resolved || 0;
                            }
                        } catch (e) {
                            console.error('Error loading dept escalation stats:', e);
                        }
                    }
                    
                    async function loadPendingDeptEscalations(module) {
                        const containerId = module.toLowerCase() + '-dept-esc-table';
                        try {
                            const res = await fetch('/admin/api/job-monitor/department-escalations/pending?module=' + module + '&limit=50');
                            const data = await res.json();
                            
                            if (data.success && data.data.length > 0) {
                                let html = '<table class="tracking-table"><thead><tr>';
                                html += '<th>Department</th><th>Store</th><th>Document #</th>';
                                html += '<th>Finding</th><th>Priority</th><th>Deadline</th><th>Status</th><th>Escalated</th>';
                                html += '</tr></thead><tbody>';
                                
                                data.data.forEach(e => {
                                    const isOverdue = e.DaysOverdue > 0;
                                    const statusClass = isOverdue ? 'overdue' : (e.Status === 'Pending' ? 'due-soon' : 'on-track');
                                    const deadline = e.Deadline ? new Date(e.Deadline).toLocaleDateString('en-GB') : 'Not set';
                                    const escalatedAt = new Date(e.EscalatedAt).toLocaleDateString('en-GB');
                                    
                                    html += '<tr>';
                                    html += '<td><strong>' + e.Department + '</strong></td>';
                                    html += '<td>' + (e.StoreName || '-') + '</td>';
                                    html += '<td>' + (e.DocumentNumber || '-') + '</td>';
                                    html += '<td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + (e.Finding || '') + '">' + (e.Finding || '-') + '</td>';
                                    html += '<td><span class="priority-' + (e.Priority || 'medium').toLowerCase() + '">' + (e.Priority || 'Medium') + '</span></td>';
                                    html += '<td>' + deadline + (isOverdue ? ' <span class="status-pill overdue">(' + e.DaysOverdue + 'd overdue)</span>' : '') + '</td>';
                                    html += '<td><span class="status-pill ' + statusClass + '">' + e.Status + '</span></td>';
                                    html += '<td>' + escalatedAt + '</td>';
                                    html += '</tr>';
                                });
                                
                                html += '</tbody></table>';
                                document.getElementById(containerId).innerHTML = html;
                            } else {
                                document.getElementById(containerId).innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No pending ' + module + ' department escalations</p></div>';
                            }
                        } catch (e) {
                            document.getElementById(containerId).innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Error: ' + e.message + '</p></div>';
                        }
                    }
                    
                    async function loadDeptContacts() {
                        try {
                            const res = await fetch('/admin/api/job-monitor/department-contacts');
                            const data = await res.json();
                            
                            if (data.success && data.data.length > 0) {
                                let html = '<table class="tracking-table"><thead><tr>';
                                html += '<th>Department</th><th>Contact Name</th><th>Email</th><th>Role</th>';
                                html += '<th>Escalation Alerts</th><th>Overdue Alerts</th><th>Active</th>';
                                html += '</tr></thead><tbody>';
                                
                                data.data.forEach(c => {
                                    html += '<tr>';
                                    html += '<td><strong>' + c.DepartmentName + '</strong></td>';
                                    html += '<td>' + (c.ContactName || '-') + '</td>';
                                    html += '<td>' + c.ContactEmail + '</td>';
                                    html += '<td>' + (c.ContactRole || '-') + '</td>';
                                    html += '<td>' + (c.ReceiveEscalationAlerts ? '✅' : '❌') + '</td>';
                                    html += '<td>' + (c.ReceiveOverdueAlerts ? '✅' : '❌') + '</td>';
                                    html += '<td>' + (c.IsActive ? '✅ Active' : '❌ Inactive') + '</td>';
                                    html += '</tr>';
                                });
                                
                                html += '</tbody></table>';
                                document.getElementById('dept-contacts-container').innerHTML = html;
                            } else {
                                document.getElementById('dept-contacts-container').innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No department contacts configured</p></div>';
                            }
                        } catch (e) {
                            document.getElementById('dept-contacts-container').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Error: ' + e.message + '</p></div>';
                        }
                    }
                    
                    async function runDeptEscalationCheck() {
                        if (!confirm('Run department escalation check now? This will send reminder emails to departments with pending items.')) return;
                        
                        try {
                            const res = await fetch('/admin/api/job-monitor/department-escalations/run-now', { method: 'POST' });
                            const data = await res.json();
                            
                            if (data.success) {
                                showToast('✅ Check completed! ' + (data.result.remindersSent || 0) + ' reminders sent.', 'success');
                                loadDeptEscalationStats('OE');
                                loadDeptEscalationStats('OHS');
                                loadPendingDeptEscalations('OE');
                                loadPendingDeptEscalations('OHS');
                            } else {
                                showToast(data.error || 'Check failed', 'error');
                            }
                        } catch (e) {
                            showToast('Error: ' + e.message, 'error');
                        }
                    }
                    
                    function refreshDeptEscalations(module) {
                        if (module) {
                            loadDeptEscalationStats(module);
                            loadPendingDeptEscalations(module);
                            if (module === 'OHS') loadDeptContacts();
                        } else {
                            loadDeptEscalationStats('OE');
                            loadDeptEscalationStats('OHS');
                            loadPendingDeptEscalations('OE');
                            loadPendingDeptEscalations('OHS');
                            loadDeptContacts();
                        }
                        showToast('✅ Refreshed!', 'success');
                    }
                    
                    // ==========================================
                    // 5 DAYS REMINDER FUNCTIONS
                    // ==========================================
                    
                    // Load 5 Days status on page load
                    loadFiveDaysStatus();
                    
                    async function loadFiveDaysStatus() {
                        try {
                            const res = await fetch('/admin/api/job-monitor/five-days/status');
                            const data = await res.json();
                            
                            if (data.success) {
                                const cycle = data.currentCycle;
                                
                                // Update cycle info
                                if (cycle && cycle.cycleKey) {
                                    document.getElementById('fiveDaysCycleInfo').textContent = 
                                        'Cycle ' + cycle.cycleNumber + ' (' + (cycle.isInCycle ? 'Day ' + cycle.daysIntoCycle : 'Day ' + (5 + cycle.daysAfterCycle)) + ')';
                                    document.getElementById('fiveDaysCycleCard').className = 'scheduler-card ' + (cycle.isInCycle ? 'ok' : 'idle');
                                } else {
                                    document.getElementById('fiveDaysCycleInfo').textContent = 'Between Cycles';
                                    document.getElementById('fiveDaysCycleCard').className = 'scheduler-card idle';
                                }
                                
                                // Update last run and stats
                                document.getElementById('fiveDaysLastRun').textContent = data.lastRunTime ? new Date(data.lastRunTime).toLocaleString() : 'Never';
                                document.getElementById('fiveDaysEmailsSent').textContent = data.stats?.emailsSent || 0;
                            }
                            
                            // Get reminder type from current cycle info
                            const cycleRes = await fetch('/admin/api/job-monitor/five-days/cycle-info');
                            const cycleData = await cycleRes.json();
                            if (cycleData.success && cycleData.reminderType) {
                                document.getElementById('fiveDaysReminderType').textContent = cycleData.reminderType.replace(/_/g, ' ');
                            } else {
                                document.getElementById('fiveDaysReminderType').textContent = 'None scheduled';
                            }
                            
                            // Load ACTUAL sent data from database (this is the key change!)
                            const activeCycleRes = await fetch('/admin/api/job-monitor/five-days/active-cycle');
                            const activeCycleData = await activeCycleRes.json();
                            
                            if (activeCycleData.success && activeCycleData.cycleKey) {
                                // Update step tracker based on what was ACTUALLY sent
                                updateStepTrackerFromSentData(activeCycleData.sentSteps);
                                
                                // Load sent reminders for this cycle
                                loadFiveDaysSentReminders(activeCycleData.cycleKey, activeCycleData.summary);
                            } else {
                                // No data yet
                                updateStepTrackerFromSentData([]);
                                loadFiveDaysSentReminders(null, []);
                            }
                            
                            // Load history
                            loadFiveDaysHistory();
                        } catch (e) {
                            console.error('Error loading 5 Days status:', e);
                        }
                    }
                    
                    function updateStepTrackerFromSentData(sentSteps) {
                        const steps = ['INITIATE', 'DAY_2', 'REMINDER_48H', 'DAY_4', 'DAY_5', 'FINAL_REMINDER', 'OVERDUE_WARNING'];
                        
                        // Normalize sent steps (DAY_1 = INITIATE)
                        const normalizedSentSteps = sentSteps.map(s => s === 'DAY_1' ? 'INITIATE' : s);
                        
                        // Calculate progress percentage based on completed steps
                        const completedCount = steps.filter(s => normalizedSentSteps.includes(s)).length;
                        const progressPercent = completedCount > 0 ? ((completedCount) / steps.length) * 100 : 0;
                        
                        // Update progress line
                        const progressLine = document.getElementById('fiveDaysProgressLine');
                        if (progressLine) {
                            progressLine.style.width = progressPercent + '%';
                        }
                        
                        // Update each step circle
                        steps.forEach((step) => {
                            const circle = document.getElementById('step-' + step);
                            if (circle) {
                                if (normalizedSentSteps.includes(step)) {
                                    // Completed - this step was sent
                                    circle.style.background = '#28a745';
                                    circle.style.color = 'white';
                                    circle.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.4)';
                                    circle.style.transform = 'scale(1.1)';
                                } else {
                                    // Not sent yet
                                    circle.style.background = '#e0e0e0';
                                    circle.style.color = '#666';
                                    circle.style.boxShadow = 'none';
                                    circle.style.transform = 'scale(1)';
                                }
                            }
                        });
                    }
                    
                    function updateStepTracker(cycleInfo, currentReminderType, cycleKey) {
                        // This function is now secondary - updateStepTrackerFromSentData is primary
                        // Keep for backward compatibility
                    }
                    
                    async function loadFiveDaysSentReminders(cycleKey, summary) {
                        const container = document.getElementById('fiveDaysSentReminders');
                        
                        if (!cycleKey || !summary || summary.length === 0) {
                            container.innerHTML = '<div style="padding: 15px; background: #f8f9fa; border-radius: 8px; color: #666;">No reminders sent yet. Use the Broadcast page to send 5 Days reminders.</div>';
                            return;
                        }
                        
                        const typeColors = {
                            'INITIATE': '#28a745', 'DAY_1': '#28a745',
                            'DAY_2': '#667eea', 'DAY_3': '#667eea', 'DAY_4': '#667eea', 'DAY_5': '#667eea',
                            'REMINDER_48H': '#ffc107',
                            'FINAL_REMINDER': '#fd7e14',
                            'OVERDUE_WARNING': '#dc3545'
                        };
                        
                        container.innerHTML = \`
                            <div style="margin-bottom: 10px; font-size: 12px; color: #666;">Cycle: <strong>\${cycleKey}</strong></div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                \${summary.map(item => \`
                                    <div style="background: #fff; border-left: 4px solid \${typeColors[item.ReminderType] || '#667eea'}; padding: 12px 15px; border-radius: 0 8px 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                        <div style="font-weight: 600; color: #333; margin-bottom: 5px;">\${item.ReminderType.replace(/_/g, ' ')}</div>
                                        <div style="font-size: 12px; color: #666;">
                                            <div>✅ <strong>\${item.EmailCount}</strong> emails sent</div>
                                            <div>📍 \${item.StoreCount} stores</div>
                                            <div>🕐 \${new Date(item.LastSentAt).toLocaleString()}</div>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }
                    
                    async function loadFiveDaysHistory() {
                        try {
                            const res = await fetch('/admin/api/job-monitor/five-days/history');
                            const data = await res.json();
                            const container = document.getElementById('fiveDaysHistory');
                            
                            if (data.success && data.history && data.history.length > 0) {
                                container.innerHTML = \`
                                    <table class="tracking-table">
                                        <thead><tr><th>Date</th><th>Cycle</th><th>Type</th><th>Store</th><th>Recipient</th></tr></thead>
                                        <tbody>
                                            \${data.history.slice(0, 50).map(h => \`
                                                <tr>
                                                    <td>\${new Date(h.SentAt).toLocaleString()}</td>
                                                    <td>\${h.CycleKey || '-'}</td>
                                                    <td><span class="status-pill no-deadline">\${h.ReminderType || '-'}</span></td>
                                                    <td>\${h.StoreName || '-'}</td>
                                                    <td>\${h.RecipientEmail || '-'}</td>
                                                </tr>
                                            \`).join('')}
                                        </tbody>
                                    </table>
                                \`;
                            } else {
                                container.innerHTML = '<div class="empty-state"><div class="icon">📧</div><p>No reminder history yet</p></div>';
                            }
                        } catch (e) {
                            document.getElementById('fiveDaysHistory').innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Error loading history</p></div>';
                        }
                    }
                    
                    async function runFiveDaysNow() {
                        if (!confirm('Run 5 Days reminder job now? This will send emails to stores based on the current cycle.')) return;
                        
                        try {
                            const res = await fetch('/admin/api/job-monitor/five-days/run-now', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                                showToast('5 Days job started!', 'success');
                                setTimeout(() => location.reload(), 2000);
                            } else {
                                showToast(data.error || 'Failed to run job', 'error');
                            }
                        } catch (e) {
                            showToast('Error: ' + e.message, 'error');
                        }
                    }
                    
                    async function fiveDaysDryRun() {
                        const container = document.getElementById('fiveDaysDryRunResults');
                        container.style.display = 'block';
                        container.innerHTML = '<div class="dryrun-empty"><span class="loading loading-dark"></span> Checking...</div>';
                        
                        try {
                            const res = await fetch('/admin/api/job-monitor/five-days/dry-run');
                            const data = await res.json();
                            
                            if (data.success) {
                                let html = '<div style="background:#f8f9fa;border-radius:8px;padding:15px;margin-bottom:15px;">';
                                
                                // Cycle info
                                if (data.cycleInfo && data.cycleInfo.cycleKey) {
                                    html += '<p><strong>📅 Cycle:</strong> ' + data.cycleInfo.cycleKey + '</p>';
                                    html += '<p><strong>📧 Reminder Type:</strong> ' + (data.reminderType || 'None') + '</p>';
                                } else {
                                    html += '<p><strong>📅 Status:</strong> Between cycles - no reminders scheduled</p>';
                                }
                                
                                html += '<p><strong>📊 Stores:</strong> Total: ' + data.totalStores + ' | Target: ' + data.targetStores + ' | Completed: ' + data.completedStores + '</p>';
                                html += '</div>';
                                
                                // Recipients
                                if (data.recipients && data.recipients.length > 0) {
                                    html += '<h5 style="margin:15px 0 10px;">📧 Would Send To (' + data.recipients.length + '):</h5>';
                                    html += data.recipients.slice(0, 20).map(r => \`
                                        <div class="dryrun-item">
                                            <h4>\${r.store}</h4>
                                            <p><strong>To:</strong> \${r.email} (\${r.name})</p>
                                            <p><strong>Entries:</strong> \${r.entryCount} | <strong>Status:</strong> \${r.hasSubmitted ? '✅ Submitted' : '⏳ Pending'}</p>
                                        </div>
                                    \`).join('');
                                    if (data.recipients.length > 20) {
                                        html += '<p style="color:#888;font-size:12px;">...and ' + (data.recipients.length - 20) + ' more</p>';
                                    }
                                } else {
                                    html += '<div class="dryrun-empty">✅ No emails would be sent (all stores completed or no cycle active)</div>';
                                }
                                
                                // Content preview
                                if (data.content) {
                                    html += '<h5 style="margin:20px 0 10px;">📝 Message Preview:</h5>';
                                    html += '<div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:15px;">';
                                    html += '<p><strong>Title:</strong> ' + data.content.title + '</p>';
                                    html += '<p><strong>Priority:</strong> ' + data.content.priority + '</p>';
                                    html += '<p style="white-space:pre-wrap;background:#f8f9fa;padding:10px;border-radius:4px;margin-top:10px;">' + data.content.message + '</p>';
                                    html += '</div>';
                                }
                                
                                container.innerHTML = html;
                            } else {
                                container.innerHTML = '<div class="dryrun-empty">❌ ' + (data.error || 'Error') + '</div>';
                            }
                        } catch (e) {
                            container.innerHTML = '<div class="dryrun-empty">❌ ' + e.message + '</div>';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading job monitor:', err);
        res.status(500).send('Error loading Job Monitor: ' + err.message);
    }
});

// ============================================================================
// ORG TREE PAGE - Organization Hierarchy View
// ============================================================================

// API to get organization hierarchy data
router.get('/api/org-hierarchy', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const brandFilter = req.query.brand || '';
        const module = req.query.module || 'OE'; // OE or OHS
        
        // Get all brands
        let brandsQuery = 'SELECT Id, BrandName, BrandCode, PrimaryColor, LogoUrl FROM Brands WHERE IsActive = 1';
        if (brandFilter) {
            brandsQuery += " AND BrandName = @brandFilter";
        }
        brandsQuery += ' ORDER BY BrandName';
        
        const brandsRequest = pool.request();
        if (brandFilter) brandsRequest.input('brandFilter', sql.NVarChar, brandFilter);
        const brandsResult = await brandsRequest.query(brandsQuery);
        const brands = brandsResult.recordset;
        
        // Build hierarchy data
        const hierarchyData = [];
        let totalHO = 0, totalAM = 0, totalSM = 0, totalStores = 0;
        
        for (const brand of brands) {
            // Get Head of Operations for this brand
            const hoResult = await pool.request()
                .input('brandId', sql.Int, brand.Id)
                .query(`
                    SELECT DISTINCT br.HeadOfOpsId as userId, u.DisplayName as displayName, u.Email as email
                    FROM OE_BrandResponsibles br
                    INNER JOIN Users u ON br.HeadOfOpsId = u.Id
                    WHERE br.BrandId = @brandId AND br.IsActive = 1 AND br.HeadOfOpsId IS NOT NULL
                `);
            
            // Get Area Managers for this brand
            const amResult = await pool.request()
                .input('brandId', sql.Int, brand.Id)
                .query(`
                    SELECT DISTINCT br.AreaManagerId as userId, u.DisplayName as displayName, u.Email as email
                    FROM OE_BrandResponsibles br
                    INNER JOIN Users u ON br.AreaManagerId = u.Id
                    WHERE br.BrandId = @brandId AND br.IsActive = 1 AND br.AreaManagerId IS NOT NULL
                `);
            
            // Get stores for this brand with their managers
            const storesResult = await pool.request()
                .input('brandId', sql.Int, brand.Id)
                .query(`
                    SELECT 
                        s.Id as storeId,
                        s.StoreName as storeName,
                        s.StoreCode as storeCode,
                        sr.AreaManagerId,
                        am.DisplayName as areaManagerName,
                        am.Email as areaManagerEmail,
                        sr.HeadOfOpsId,
                        ho.DisplayName as headOfOpsName,
                        ho.Email as headOfOpsEmail
                    FROM Stores s
                    ${module === 'OHS' ? "INNER JOIN OHSStores ohs ON s.Id = ohs.StoreId AND ohs.IsActive = 1" : ""}
                    LEFT JOIN OE_StoreResponsibles sr ON s.Id = sr.StoreId AND sr.IsActive = 1
                    LEFT JOIN Users am ON sr.AreaManagerId = am.Id
                    LEFT JOIN Users ho ON sr.HeadOfOpsId = ho.Id
                    WHERE s.BrandId = @brandId AND s.IsActive = 1
                    ORDER BY s.StoreName
                `);
            
            // Get store managers for each store
            const stores = [];
            for (const store of storesResult.recordset) {
                const smResult = await pool.request()
                    .input('storeId', sql.Int, store.storeId)
                    .query(`
                        SELECT 
                            sma.UserId as userId,
                            u.DisplayName as displayName,
                            u.Email as email,
                            sma.IsPrimary as isPrimary
                        FROM StoreManagerAssignments sma
                        INNER JOIN Users u ON sma.UserId = u.Id
                        WHERE sma.StoreId = @storeId
                        ORDER BY sma.IsPrimary DESC, u.DisplayName
                    `);
                
                stores.push({
                    storeId: store.storeId,
                    storeName: store.storeName,
                    storeCode: store.storeCode,
                    areaManager: store.AreaManagerId ? {
                        userId: store.AreaManagerId,
                        displayName: store.areaManagerName,
                        email: store.areaManagerEmail
                    } : null,
                    headOfOps: store.HeadOfOpsId ? {
                        userId: store.HeadOfOpsId,
                        displayName: store.headOfOpsName,
                        email: store.headOfOpsEmail
                    } : null,
                    storeManagers: smResult.recordset
                });
                
                totalSM += smResult.recordset.length;
            }
            
            totalStores += stores.length;
            totalHO += hoResult.recordset.length;
            totalAM += amResult.recordset.length;
            
            hierarchyData.push({
                brandId: brand.Id,
                brandName: brand.BrandName,
                brandCode: brand.BrandCode,
                brandColor: brand.PrimaryColor,
                logoUrl: brand.LogoUrl,
                headsOfOps: hoResult.recordset,
                areaManagers: amResult.recordset,
                stores: stores
            });
        }
        
        res.json({
            success: true,
            data: hierarchyData,
            stats: {
                brands: brands.length,
                headsOfOps: totalHO,
                areaManagers: totalAM,
                stores: totalStores,
                storeManagers: totalSM
            }
        });
        
    } catch (err) {
        console.error('Error getting org hierarchy:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (pool) await pool.close();
    }
});

// Org Tree Page
router.get('/org-tree', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get brands for filter dropdown
        const brandsResult = await pool.request().query(`
            SELECT Id, BrandName, BrandCode, PrimaryColor FROM Brands WHERE IsActive = 1 ORDER BY BrandName
        `);
        const brands = brandsResult.recordset;
        
        await pool.close();
        
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Organization Hierarchy - Admin</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); min-height: 100vh; color: #333; }
                    
                    .page-header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 25px 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
                    .page-header h1 { font-size: 26px; margin-bottom: 5px; }
                    .page-header p { opacity: 0.9; font-size: 14px; }
                    .back-btn { display: inline-flex; align-items: center; gap: 8px; color: white; text-decoration: none; margin-bottom: 12px; padding: 6px 14px; background: rgba(255,255,255,0.15); border-radius: 8px; transition: all 0.2s; font-size: 14px; }
                    .back-btn:hover { background: rgba(255,255,255,0.25); }
                    
                    .container { max-width: 1600px; margin: 0 auto; padding: 25px; }
                    
                    .controls-bar { background: white; border-radius: 12px; padding: 15px 20px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
                    .control-group { display: flex; align-items: center; gap: 8px; }
                    .control-group label { font-weight: 600; color: #374151; font-size: 13px; }
                    .control-group select { padding: 8px 14px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 13px; min-width: 160px; cursor: pointer; }
                    .control-group select:focus { outline: none; border-color: #7c3aed; }
                    
                    .btn { padding: 8px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
                    .btn-primary { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; }
                    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4); }
                    .btn-secondary { background: #f3f4f6; color: #374151; }
                    .btn-secondary:hover { background: #e5e7eb; }
                    
                    .stats-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
                    .stat-card { background: white; border-radius: 10px; padding: 12px 20px; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); flex: 1; min-width: 120px; }
                    .stat-card .icon { font-size: 24px; }
                    .stat-card .info .number { font-size: 22px; font-weight: 700; color: #7c3aed; }
                    .stat-card .info .label { font-size: 11px; color: #6b7280; }
                    
                    .tree-container { background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
                    .tree-header { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 15px 20px; border-bottom: 2px solid #ddd6fe; display: flex; justify-content: space-between; align-items: center; }
                    .tree-header h2 { font-size: 16px; color: #5b21b6; display: flex; align-items: center; gap: 8px; }
                    .tree-body { padding: 30px; min-height: 500px; background: linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%); overflow-x: auto; }
                    
                    .org-chart { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; }
                    .brand-column { display: flex; flex-direction: column; align-items: center; min-width: 350px; }
                    
                    .node-box { background: white; border-radius: 12px; padding: 16px 24px; min-width: 220px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 3px solid #e5e7eb; position: relative; transition: all 0.3s; }
                    .node-box:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
                    .node-box .node-icon { font-size: 36px; margin-bottom: 8px; }
                    .node-box .node-title { font-weight: 700; font-size: 15px; color: #1f2937; margin-bottom: 4px; }
                    .node-box .node-subtitle { font-size: 12px; color: #6b7280; }
                    .node-box .node-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-top: 10px; }
                    
                    .node-brand { border-color: #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); }
                    .node-brand .node-badge { background: #f59e0b; color: white; }
                    .node-ho { border-color: #7c3aed; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); }
                    .node-ho .node-badge { background: #7c3aed; color: white; }
                    .node-am { border-color: #2563eb; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }
                    .node-am .node-badge { background: #2563eb; color: white; }
                    .node-sm { border-color: #059669; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); }
                    .node-sm .node-badge { background: #059669; color: white; }
                    
                    .connector { width: 3px; height: 40px; background: linear-gradient(180deg, #9ca3af 0%, #6b7280 100%); position: relative; }
                    .connector::after { content: '▼'; position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #6b7280; }
                    
                    .level-container { display: flex; flex-direction: column; align-items: center; }
                    .items-row { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; max-width: 600px; }
                    .items-row .node-box { min-width: 180px; padding: 12px 16px; }
                    .items-row .node-box .node-icon { font-size: 28px; }
                    .items-row .node-box .node-title { font-size: 13px; }
                    
                    .sm-card { background: white; border-radius: 10px; padding: 12px 16px; min-width: 220px; text-align: left; box-shadow: 0 2px 10px rgba(0,0,0,0.08); border-left: 4px solid #059669; display: flex; align-items: center; gap: 12px; transition: all 0.2s; }
                    .sm-card:hover { transform: translateX(5px); box-shadow: 0 4px 15px rgba(0,0,0,0.12); }
                    .sm-card .sm-icon { font-size: 28px; }
                    .sm-card .sm-info { flex: 1; }
                    .sm-card .sm-name { font-weight: 600; font-size: 13px; color: #1f2937; }
                    .sm-card .sm-store { font-size: 11px; color: #059669; font-weight: 600; }
                    .sm-card .sm-email { font-size: 10px; color: #9ca3af; }
                    .sm-card.primary { border-left-color: #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, white 100%); }
                    .sm-card.primary::after { content: '⭐'; font-size: 14px; }
                    
                    .empty-slot { background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 10px; padding: 12px 20px; text-align: center; color: #92400e; font-size: 12px; min-width: 180px; }
                    .empty-slot .warning-icon { font-size: 20px; margin-bottom: 5px; }
                    
                    .level-label { background: #e5e7eb; color: #374151; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 600; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px; }
                    
                    .loading { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; gap: 15px; }
                    .spinner { width: 50px; height: 50px; border: 4px solid #e5e7eb; border-top-color: #7c3aed; border-radius: 50%; animation: spin 1s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    
                    .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; }
                    .empty-state .icon { font-size: 64px; margin-bottom: 20px; }
                    .empty-state h3 { font-size: 20px; color: #374151; margin-bottom: 10px; }
                    
                    .legend { display: flex; gap: 25px; flex-wrap: wrap; padding: 15px 20px; background: #f9fafb; border-top: 1px solid #e5e7eb; justify-content: center; }
                    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; }
                    .legend-color { width: 20px; height: 20px; border-radius: 6px; border: 2px solid; }
                    .legend-color.brand { border-color: #f59e0b; background: #fef3c7; }
                    .legend-color.ho { border-color: #7c3aed; background: #ede9fe; }
                    .legend-color.am { border-color: #2563eb; background: #dbeafe; }
                    .legend-color.sm { border-color: #059669; background: #d1fae5; }
                    
                    @media (max-width: 768px) {
                        .org-chart { flex-direction: column; align-items: center; }
                        .brand-column { min-width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div class="page-header">
                    <a href="/admin" class="back-btn">← Back to Admin</a>
                    <h1>🌳 Organization Hierarchy</h1>
                    <p>Brand → Head of Operations → Area Managers → Store Managers</p>
                </div>
                
                <div class="container">
                    <!-- Controls Bar -->
                    <div class="controls-bar">
                        <div class="control-group">
                            <label for="moduleFilter">📱 Module:</label>
                            <select id="moduleFilter" onchange="loadHierarchy()" style="min-width: 180px; font-weight: 600;">
                                <option value="OE">🏆 Operational Excellence (OE)</option>
                                <option value="OHS">🦺 Occupational Health & Safety (OHS)</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label for="brandFilter">🏷️ Filter by Brand:</label>
                            <select id="brandFilter" onchange="loadHierarchy()">
                                <option value="">All Brands</option>
                                ${brands.map(b => `<option value="${b.BrandName}">${b.BrandName}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex: 1;"></div>
                        <button class="btn btn-secondary" onclick="expandAll()">📂 Expand All</button>
                        <button class="btn btn-secondary" onclick="collapseAll()">📁 Collapse All</button>
                        <button class="btn btn-primary" onclick="loadHierarchy()">🔄 Refresh</button>
                    </div>
                    
                    <!-- Stats Row -->
                    <div class="stats-row">
                        <div class="stat-card">
                            <div class="icon">🏷️</div>
                            <div class="info">
                                <div class="number" id="statBrands">0</div>
                                <div class="label">Brands</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="icon">👔</div>
                            <div class="info">
                                <div class="number" id="statHO">0</div>
                                <div class="label">Heads of Ops</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="icon">👥</div>
                            <div class="info">
                                <div class="number" id="statAM">0</div>
                                <div class="label">Area Managers</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="icon">🏪</div>
                            <div class="info">
                                <div class="number" id="statStores">0</div>
                                <div class="label">Stores</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="icon">👤</div>
                            <div class="info">
                                <div class="number" id="statSM">0</div>
                                <div class="label">Store Managers</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tree Container -->
                    <div class="tree-container">
                        <div class="tree-header">
                            <h2>🌳 Organization Tree</h2>
                            <span style="color: #6b7280; font-size: 12px;" id="lastUpdated"></span>
                        </div>
                        <div class="tree-body" id="treeBody">
                            <div class="loading">
                                <div class="spinner"></div>
                                <span style="color: #6b7280;">Loading hierarchy...</span>
                            </div>
                        </div>
                        <div class="legend">
                            <div class="legend-item"><div class="legend-color brand"></div><span>Brand</span></div>
                            <div class="legend-item"><div class="legend-color ho"></div><span>Head of Operations</span></div>
                            <div class="legend-item"><div class="legend-color am"></div><span>Area Manager</span></div>
                            <div class="legend-item"><div class="legend-color sm"></div><span>Store Manager</span></div>
                        </div>
                    </div>
                </div>
                
                <script>
                    let hierarchyData = null;
                    
                    document.addEventListener('DOMContentLoaded', () => {
                        loadHierarchy();
                    });
                    
                    async function loadHierarchy() {
                        const treeBody = document.getElementById('treeBody');
                        treeBody.innerHTML = '<div class="loading"><div class="spinner"></div><span style="color: #6b7280;">Loading hierarchy...</span></div>';
                        
                        const moduleFilter = document.getElementById('moduleFilter').value;
                        const brandFilter = document.getElementById('brandFilter').value;
                        
                        let url = '/admin/api/org-hierarchy?module=' + encodeURIComponent(moduleFilter);
                        if (brandFilter) {
                            url += '&brand=' + encodeURIComponent(brandFilter);
                        }
                        
                        // Update header based on selected module
                        const moduleLabel = moduleFilter === 'OHS' ? '🦺 OHS' : '🏆 OE';
                        document.querySelector('.tree-header h2').innerHTML = '🌳 ' + moduleLabel + ' Organization Tree';
                        
                        try {
                            const response = await fetch(url);
                            const result = await response.json();
                            
                            if (result.success) {
                                hierarchyData = result.data;
                                updateStats(result.stats);
                                renderOrgChart(hierarchyData);
                                document.getElementById('lastUpdated').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
                            } else {
                                throw new Error(result.error || 'Failed to load hierarchy');
                            }
                        } catch (error) {
                            console.error('Error loading hierarchy:', error);
                            treeBody.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Error Loading Data</h3><p>' + error.message + '</p><button class="btn btn-primary" onclick="loadHierarchy()" style="margin-top: 15px;">🔄 Try Again</button></div>';
                        }
                    }
                    
                    function updateStats(stats) {
                        if (!stats) return;
                        document.getElementById('statBrands').textContent = stats.brands || 0;
                        document.getElementById('statHO').textContent = stats.headsOfOps || 0;
                        document.getElementById('statAM').textContent = stats.areaManagers || 0;
                        document.getElementById('statStores').textContent = stats.stores || 0;
                        document.getElementById('statSM').textContent = stats.storeManagers || 0;
                    }
                    
                    function renderOrgChart(data) {
                        const treeBody = document.getElementById('treeBody');
                        
                        if (!data || data.length === 0) {
                            treeBody.innerHTML = '<div class="empty-state"><div class="icon">🏢</div><h3>No Data Found</h3><p>No organizational hierarchy data available.</p></div>';
                            return;
                        }
                        
                        let html = '<div class="org-chart">';
                        data.forEach(brand => {
                            html += renderBrandColumn(brand);
                        });
                        html += '</div>';
                        treeBody.innerHTML = html;
                    }
                    
                    function renderBrandColumn(brand) {
                        // Collect unique area managers and store managers
                        const uniqueAMs = new Map();
                        const allStoreManagers = [];
                        
                        if (brand.stores) {
                            brand.stores.forEach(store => {
                                // Collect area managers from store level
                                if (store.areaManager) {
                                    uniqueAMs.set(store.areaManager.userId, store.areaManager);
                                }
                                // Collect store managers
                                if (store.storeManagers) {
                                    store.storeManagers.forEach(sm => {
                                        allStoreManagers.push({
                                            ...sm,
                                            storeName: store.storeName,
                                            storeCode: store.storeCode
                                        });
                                    });
                                }
                            });
                        }
                        
                        // Also add brand-level area managers
                        if (brand.areaManagers) {
                            brand.areaManagers.forEach(am => {
                                if (!uniqueAMs.has(am.userId)) {
                                    uniqueAMs.set(am.userId, am);
                                }
                            });
                        }
                        
                        let html = '<div class="brand-column">';
                        
                        // LEVEL 1: Brand
                        html += '<div class="level-container">';
                        html += '<div class="level-label">Brand</div>';
                        html += '<div class="node-box node-brand">';
                        html += '<div class="node-icon">🏷️</div>';
                        html += '<div class="node-title">' + brand.brandName + '</div>';
                        html += '<div class="node-subtitle">' + (brand.stores?.length || 0) + ' stores</div>';
                        html += '<span class="node-badge">Brand</span>';
                        html += '</div></div>';
                        
                        // Connector
                        html += '<div class="connector"></div>';
                        
                        // LEVEL 2: Head of Operations
                        html += '<div class="level-container">';
                        html += '<div class="level-label">Head of Operations</div>';
                        if (brand.headsOfOps && brand.headsOfOps.length > 0) {
                            html += '<div class="items-row">';
                            brand.headsOfOps.forEach(ho => {
                                html += '<div class="node-box node-ho">';
                                html += '<div class="node-icon">👔</div>';
                                html += '<div class="node-title">' + (ho.displayName || 'Unknown') + '</div>';
                                html += '<div class="node-subtitle">' + (ho.email || '') + '</div>';
                                html += '<span class="node-badge">Head of Ops</span>';
                                html += '</div>';
                            });
                            html += '</div>';
                        } else {
                            html += '<div class="empty-slot"><div class="warning-icon">⚠️</div><div>No Head of Operations assigned</div></div>';
                        }
                        html += '</div>';
                        
                        // Connector
                        html += '<div class="connector"></div>';
                        
                        // LEVEL 3: Area Managers
                        html += '<div class="level-container">';
                        html += '<div class="level-label">Area Managers</div>';
                        if (uniqueAMs.size > 0) {
                            html += '<div class="items-row">';
                            uniqueAMs.forEach(am => {
                                html += '<div class="node-box node-am">';
                                html += '<div class="node-icon">👥</div>';
                                html += '<div class="node-title">' + (am.displayName || 'Unknown') + '</div>';
                                html += '<div class="node-subtitle">' + (am.email || '') + '</div>';
                                html += '<span class="node-badge">Area Manager</span>';
                                html += '</div>';
                            });
                            html += '</div>';
                        } else {
                            html += '<div class="empty-slot"><div class="warning-icon">⚠️</div><div>No Area Managers assigned</div></div>';
                        }
                        html += '</div>';
                        
                        // Connector
                        html += '<div class="connector"></div>';
                        
                        // LEVEL 4: Store Managers with Store Names
                        html += '<div class="level-container">';
                        html += '<div class="level-label">Store Managers</div>';
                        if (allStoreManagers.length > 0) {
                            html += '<div class="items-row" style="max-width: 900px;">';
                            allStoreManagers.forEach(sm => {
                                html += '<div class="sm-card ' + (sm.isPrimary ? 'primary' : '') + '">';
                                html += '<div class="sm-icon">👤</div>';
                                html += '<div class="sm-info">';
                                html += '<div class="sm-name">' + (sm.displayName || 'Unknown') + '</div>';
                                html += '<div class="sm-store">🏪 ' + sm.storeName + '</div>';
                                html += '<div class="sm-email">' + (sm.email || '') + '</div>';
                                html += '</div></div>';
                            });
                            html += '</div>';
                        } else {
                            html += '<div class="empty-slot"><div class="warning-icon">⚠️</div><div>No Store Managers assigned</div></div>';
                        }
                        html += '</div>';
                        
                        html += '</div>'; // brand-column
                        return html;
                    }
                    
                    function expandAll() {
                        // Future: implement collapsible sections
                        alert('All sections expanded');
                    }
                    
                    function collapseAll() {
                        // Future: implement collapsible sections
                        alert('All sections collapsed');
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading org tree:', err);
        res.status(500).send('Error loading Org Tree: ' + err.message);
    }
});

// ==========================================
// Dashboard Menu Management
// ==========================================
router.get('/dashboard-menu', requireSysAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all forms with dashboard settings
        const forms = await pool.request().query(`
            SELECT Id, FormCode, FormName, ModuleName, FormUrl, 
                   MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, 
                   DashboardCategoryColor, DashboardTitle, DashboardDescription,
                   ShowOnDashboard, CategorySortOrder, DashboardSortOrder, IsActive
            FROM Forms 
            ORDER BY CategorySortOrder, DashboardSortOrder, FormName
        `);
        
        // Get distinct categories
        const categories = await pool.request().query(`
            SELECT DISTINCT DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, CategorySortOrder
            FROM Forms 
            WHERE DashboardCategory IS NOT NULL AND ShowOnDashboard = 1
            ORDER BY CategorySortOrder
        `);
        
        await pool.close();
        
        const successMsg = req.query.success ? `<div class="alert alert-success">✅ ${req.query.msg || 'Changes saved!'}</div>` : '';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Dashboard Menu Setup - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 1.5rem; }
                    .header-nav a { color: white; text-decoration: none; margin-left: 20px; padding: 8px 16px; 
                                    background: rgba(255,255,255,0.1); border-radius: 6px; }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    .alert { padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; }
                    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    
                    .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
                    .tab { padding: 12px 24px; background: white; border: none; border-radius: 8px 8px 0 0; 
                           cursor: pointer; font-size: 14px; color: #666; }
                    .tab.active { background: #0078d4; color: white; }
                    
                    .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
                    .card-header { padding: 20px; border-bottom: 1px solid #eee; font-weight: 600; 
                                   display: flex; justify-content: space-between; align-items: center; }
                    .card-body { padding: 20px; }
                    
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #333; }
                    tr:hover { background: #f8f9fa; }
                    
                    .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-sm { padding: 5px 10px; font-size: 12px; }
                    
                    .toggle-switch { position: relative; display: inline-block; width: 50px; height: 26px; }
                    .toggle-switch input { opacity: 0; width: 0; height: 0; }
                    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                                     background: #ccc; border-radius: 26px; transition: 0.3s; }
                    .toggle-slider:before { position: absolute; content: ""; height: 20px; width: 20px;
                                            left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
                    input:checked + .toggle-slider { background: #28a745; }
                    input:checked + .toggle-slider:before { transform: translateX(24px); }
                    
                    .emoji-picker { display: inline-block; position: relative; }
                    .emoji-btn { font-size: 24px; padding: 8px 12px; background: #f8f9fa; border: 1px solid #ddd; 
                                 border-radius: 6px; cursor: pointer; }
                    .emoji-dropdown { display: none; position: absolute; top: 100%; left: 0; background: white;
                                      border: 1px solid #ddd; border-radius: 8px; padding: 10px; z-index: 100;
                                      box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 280px; }
                    .emoji-dropdown.show { display: block; }
                    .emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; }
                    .emoji-item { font-size: 20px; padding: 5px; cursor: pointer; text-align: center; border-radius: 4px; }
                    .emoji-item:hover { background: #e3f2fd; }
                    
                    .color-picker { width: 50px; height: 30px; border: none; border-radius: 4px; cursor: pointer; }
                    
                    .sort-input { width: 60px; padding: 5px; text-align: center; border: 1px solid #ddd; border-radius: 4px; }
                    
                    .category-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; 
                                      font-size: 12px; color: white; }
                    
                    .preview-section { background: #1a1a2e; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
                    .preview-category { margin-bottom: 15px; }
                    .preview-header { display: flex; align-items: center; gap: 10px; padding: 10px 15px;
                                      background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid; }
                    .preview-icon { font-size: 20px; }
                    .preview-title { color: white; font-weight: 600; }
                    .preview-count { color: rgba(255,255,255,0.6); font-size: 12px; margin-left: auto; }
                    .preview-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); 
                                     gap: 10px; padding: 10px 0 0 20px; }
                    .preview-item { background: rgba(255,255,255,0.08); padding: 12px; border-radius: 8px;
                                    display: flex; align-items: center; gap: 10px; }
                    .preview-item-icon { font-size: 24px; }
                    .preview-item-title { color: white; font-size: 14px; }
                    .preview-item-desc { color: rgba(255,255,255,0.5); font-size: 11px; }
                    
                    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                             background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center; }
                    .modal.active { display: flex; }
                    .modal-content { background: white; border-radius: 12px; padding: 30px; width: 600px; max-height: 80vh; overflow-y: auto; }
                    .modal-content h3 { margin-bottom: 20px; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
                    .form-group input, .form-group select, .form-group textarea { 
                        width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
                    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎛️ Dashboard Menu Setup</h1>
                    <div class="header-nav">
                        <a href="/admin">⬅️ Admin Panel</a>
                        <a href="/dashboard">🏠 Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    ${successMsg}
                    
                    <!-- Preview Section -->
                    <div class="card">
                        <div class="card-header">
                            <span>👁️ Dashboard Preview</span>
                            <button class="btn btn-primary btn-sm" onclick="refreshPreview()">🔄 Refresh Preview</button>
                        </div>
                        <div class="card-body">
                            <div class="preview-section" id="dashboardPreview">
                                ${categories.recordset.map(cat => {
                                    const catForms = forms.recordset.filter(f => 
                                        f.DashboardCategory === cat.DashboardCategory && f.ShowOnDashboard
                                    );
                                    return `
                                        <div class="preview-category">
                                            <div class="preview-header" style="border-left-color: ${cat.DashboardCategoryColor || '#666'}">
                                                <span class="preview-icon">${cat.DashboardCategoryIcon || '📁'}</span>
                                                <span class="preview-title">${cat.DashboardCategory}</span>
                                                <span class="preview-count">${catForms.length} apps</span>
                                            </div>
                                            <div class="preview-items">
                                                ${catForms.map(f => `
                                                    <div class="preview-item">
                                                        <span class="preview-item-icon">${f.DashboardIcon || '📄'}</span>
                                                        <div>
                                                            <div class="preview-item-title">${f.DashboardTitle || f.FormName}</div>
                                                            <div class="preview-item-desc">${f.DashboardDescription || ''}</div>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Forms Table -->
                    <div class="card">
                        <div class="card-header">
                            <span>📋 Dashboard Menu Items</span>
                            <div>
                                <select id="filterCategory" onchange="filterTable()" style="padding: 8px; border-radius: 6px; margin-right: 10px;">
                                    <option value="">All Categories</option>
                                    ${categories.recordset.map(c => `<option value="${c.DashboardCategory}">${c.DashboardCategory}</option>`).join('')}
                                </select>
                                <button class="btn btn-success" onclick="saveAllChanges()">💾 Save All Changes</button>
                            </div>
                        </div>
                        <div class="card-body" style="overflow-x: auto;">
                            <table id="menuTable">
                                <thead>
                                    <tr>
                                        <th>Show</th>
                                        <th>Icon</th>
                                        <th>Title</th>
                                        <th>Description</th>
                                        <th>Category</th>
                                        <th>Cat Icon</th>
                                        <th>Cat Color</th>
                                        <th>Menu ID</th>
                                        <th>URL</th>
                                        <th>Cat Order</th>
                                        <th>Sort Order</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${forms.recordset.map(f => `
                                        <tr data-id="${f.Id}" data-category="${f.DashboardCategory || ''}">
                                            <td>
                                                <label class="toggle-switch">
                                                    <input type="checkbox" class="show-toggle" ${f.ShowOnDashboard ? 'checked' : ''} 
                                                           onchange="markChanged(${f.Id})">
                                                    <span class="toggle-slider"></span>
                                                </label>
                                            </td>
                                            <td>
                                                <div class="emoji-picker">
                                                    <button type="button" class="emoji-btn" onclick="toggleEmojiPicker(this, ${f.Id}, 'icon')">${f.DashboardIcon || '📄'}</button>
                                                    <input type="hidden" class="icon-input" value="${f.DashboardIcon || ''}">
                                                </div>
                                            </td>
                                            <td><input type="text" class="title-input" value="${(f.DashboardTitle || '').replace(/"/g, '&quot;')}" 
                                                       style="width: 150px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;"
                                                       onchange="markChanged(${f.Id})"></td>
                                            <td><input type="text" class="desc-input" value="${(f.DashboardDescription || '').replace(/"/g, '&quot;')}" 
                                                       style="width: 200px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;"
                                                       onchange="markChanged(${f.Id})"></td>
                                            <td><input type="text" class="category-input" value="${(f.DashboardCategory || '').replace(/"/g, '&quot;')}" 
                                                       style="width: 150px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;"
                                                       onchange="markChanged(${f.Id})"></td>
                                            <td>
                                                <div class="emoji-picker">
                                                    <button type="button" class="emoji-btn" onclick="toggleEmojiPicker(this, ${f.Id}, 'catIcon')">${f.DashboardCategoryIcon || '📁'}</button>
                                                    <input type="hidden" class="cat-icon-input" value="${f.DashboardCategoryIcon || ''}">
                                                </div>
                                            </td>
                                            <td><input type="color" class="color-picker cat-color-input" value="${f.DashboardCategoryColor || '#666666'}" 
                                                       onchange="markChanged(${f.Id})"></td>
                                            <td><input type="text" class="menuid-input" value="${f.MenuId || ''}" 
                                                       style="width: 100px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;"
                                                       onchange="markChanged(${f.Id})"></td>
                                            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${f.FormUrl || ''}">${f.FormUrl || '-'}</td>
                                            <td><input type="number" class="sort-input cat-sort-input" value="${f.CategorySortOrder || 100}" 
                                                       onchange="markChanged(${f.Id})"></td>
                                            <td><input type="number" class="sort-input item-sort-input" value="${f.DashboardSortOrder || 100}" 
                                                       onchange="markChanged(${f.Id})"></td>
                                            <td>
                                                <span class="change-indicator" style="display: none; color: #f39c12;">●</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Emoji Picker Dropdown (shared) -->
                <div class="emoji-dropdown" id="emojiDropdown">
                    <div class="emoji-grid">
                        ${['📊', '📋', '📁', '📂', '📄', '📝', '📌', '📍', '🔍', '🔎', '🔐', '🔒', '🔓', '🔑', 
                           '⚙️', '🛠️', '🔧', '🔩', '⚡', '💡', '🎯', '🎨', '🏠', '🏢', '🏪', '🏭', '🏗️', '🏛️',
                           '👤', '👥', '👷', '🧑‍💼', '🤝', '💼', '📈', '📉', '📅', '📆', '🗓️', '⏰', '🕐', '⏱️',
                           '🦺', '🛡️', '⚠️', '🚨', '🚫', '⛔', '✅', '❌', '❓', '❗', '💯', '🔥', '🧯', '🚒',
                           '📢', '📣', '🔔', '🔕', '📧', '📨', '📩', '📤', '📥', '💬', '💭', '🗨️', '📱', '💻',
                           '⚖️', '📜', '📑', '📃', '📰', '🗞️', '📦', '📫', '📪', '📬', '📭', '🗄️', '🗃️', '🗂️',
                           '🍽️', '🍴', '🥄', '🍳', '🥘', '🍕', '🍔', '🥗', '☕', '🧃', '🥤', '🍺', '🍷', '🥂'
                          ].map(e => `<span class="emoji-item" onclick="selectEmoji('${e}')">${e}</span>`).join('')}
                    </div>
                </div>
                
                <script>
                    let changedRows = new Set();
                    let currentEmojiTarget = null;
                    let currentEmojiType = null;
                    
                    function markChanged(id) {
                        changedRows.add(id);
                        document.querySelector(\`tr[data-id="\${id}"] .change-indicator\`).style.display = 'inline';
                    }
                    
                    function toggleEmojiPicker(btn, id, type) {
                        const dropdown = document.getElementById('emojiDropdown');
                        const rect = btn.getBoundingClientRect();
                        
                        if (dropdown.classList.contains('show') && currentEmojiTarget === btn) {
                            dropdown.classList.remove('show');
                            currentEmojiTarget = null;
                            return;
                        }
                        
                        currentEmojiTarget = btn;
                        currentEmojiType = type;
                        dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
                        dropdown.style.left = rect.left + 'px';
                        dropdown.classList.add('show');
                        
                        // Store the row id
                        dropdown.dataset.rowId = id;
                    }
                    
                    function selectEmoji(emoji) {
                        if (!currentEmojiTarget) return;
                        
                        const rowId = document.getElementById('emojiDropdown').dataset.rowId;
                        const row = document.querySelector(\`tr[data-id="\${rowId}"]\`);
                        
                        currentEmojiTarget.textContent = emoji;
                        
                        if (currentEmojiType === 'icon') {
                            row.querySelector('.icon-input').value = emoji;
                        } else if (currentEmojiType === 'catIcon') {
                            row.querySelector('.cat-icon-input').value = emoji;
                        }
                        
                        markChanged(parseInt(rowId));
                        document.getElementById('emojiDropdown').classList.remove('show');
                        currentEmojiTarget = null;
                    }
                    
                    // Close emoji picker when clicking outside
                    document.addEventListener('click', function(e) {
                        if (!e.target.closest('.emoji-picker') && !e.target.closest('.emoji-dropdown')) {
                            document.getElementById('emojiDropdown').classList.remove('show');
                        }
                    });
                    
                    function filterTable() {
                        const category = document.getElementById('filterCategory').value;
                        document.querySelectorAll('#menuTable tbody tr').forEach(row => {
                            if (!category || row.dataset.category === category) {
                                row.style.display = '';
                            } else {
                                row.style.display = 'none';
                            }
                        });
                    }
                    
                    async function saveAllChanges() {
                        if (changedRows.size === 0) {
                            alert('No changes to save');
                            return;
                        }
                        
                        const updates = [];
                        changedRows.forEach(id => {
                            const row = document.querySelector(\`tr[data-id="\${id}"]\`);
                            updates.push({
                                id: id,
                                showOnDashboard: row.querySelector('.show-toggle').checked,
                                dashboardIcon: row.querySelector('.icon-input').value,
                                dashboardTitle: row.querySelector('.title-input').value,
                                dashboardDescription: row.querySelector('.desc-input').value,
                                dashboardCategory: row.querySelector('.category-input').value,
                                dashboardCategoryIcon: row.querySelector('.cat-icon-input').value,
                                dashboardCategoryColor: row.querySelector('.cat-color-input').value,
                                menuId: row.querySelector('.menuid-input').value,
                                categorySortOrder: parseInt(row.querySelector('.cat-sort-input').value) || 100,
                                dashboardSortOrder: parseInt(row.querySelector('.item-sort-input').value) || 100
                            });
                        });
                        
                        try {
                            const res = await fetch('/admin/dashboard-menu/save', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ updates })
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                alert('✅ ' + result.updated + ' items saved successfully!');
                                changedRows.clear();
                                document.querySelectorAll('.change-indicator').forEach(el => el.style.display = 'none');
                                location.reload();
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (err) {
                            alert('Error saving: ' + err.message);
                        }
                    }
                    
                    function refreshPreview() {
                        location.reload();
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading dashboard menu:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Save dashboard menu changes
router.post('/dashboard-menu/save', requireSysAdmin, async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!updates || !Array.isArray(updates)) {
            return res.json({ success: false, error: 'Invalid data' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        for (const item of updates) {
            await pool.request()
                .input('id', sql.Int, item.id)
                .input('showOnDashboard', sql.Bit, item.showOnDashboard ? 1 : 0)
                .input('dashboardIcon', sql.NVarChar, item.dashboardIcon || null)
                .input('dashboardTitle', sql.NVarChar, item.dashboardTitle || null)
                .input('dashboardDescription', sql.NVarChar, item.dashboardDescription || null)
                .input('dashboardCategory', sql.NVarChar, item.dashboardCategory || null)
                .input('dashboardCategoryIcon', sql.NVarChar, item.dashboardCategoryIcon || null)
                .input('dashboardCategoryColor', sql.NVarChar, item.dashboardCategoryColor || null)
                .input('menuId', sql.NVarChar, item.menuId || null)
                .input('categorySortOrder', sql.Int, item.categorySortOrder || 100)
                .input('dashboardSortOrder', sql.Int, item.dashboardSortOrder || 100)
                .query(`
                    UPDATE Forms SET
                        ShowOnDashboard = @showOnDashboard,
                        DashboardIcon = @dashboardIcon,
                        DashboardTitle = @dashboardTitle,
                        DashboardDescription = @dashboardDescription,
                        DashboardCategory = @dashboardCategory,
                        DashboardCategoryIcon = @dashboardCategoryIcon,
                        DashboardCategoryColor = @dashboardCategoryColor,
                        MenuId = @menuId,
                        CategorySortOrder = @categorySortOrder,
                        DashboardSortOrder = @dashboardSortOrder,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        }
        
        await pool.close();
        
        res.json({ success: true, updated: updates.length });
    } catch (err) {
        console.error('Error saving dashboard menu:', err);
        res.json({ success: false, error: err.message });
    }
});

// Permission Sync Tool - moved to separate module
const permissionSyncRouter = require('./permission-sync');
router.use('/permission-sync', permissionSyncRouter);

module.exports = router;