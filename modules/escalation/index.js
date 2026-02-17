/**
 * Escalation Module
 * Dynamic SQL-Driven Escalation App for Action Plans
 * Created: 2026-02-17
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

// Database config
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

// Middleware to prevent caching
router.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// ==========================================
// PAGE ROUTES
// ==========================================

// Main Dashboard
router.get('/', require('./pages/dashboard'));

// Admin Pages
router.get('/admin', require('./pages/admin-sources'));
router.get('/admin/sources', require('./pages/admin-sources'));
router.get('/admin/templates', require('./pages/admin-templates'));
router.get('/admin/contacts', require('./pages/admin-contacts'));

// ==========================================
// API ROUTES - SOURCES
// ==========================================

// Get all escalation sources (filtered by user permissions)
router.get('/api/sources', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const permissions = req.currentUser?.permissions || {};
        
        const result = await pool.request().query(`
            SELECT * FROM EscalationSources 
            WHERE IsActive = 1 
            ORDER BY SortOrder, SourceName
        `);
        
        // Filter by user's form permissions
        const sources = result.recordset.filter(source => {
            // System admin sees all
            if (req.currentUser?.roleNames?.includes('System Administrator')) {
                return true;
            }
            // Check if user has view permission for the source's form
            const perm = permissions[source.FormCode];
            return perm && perm.canView;
        });
        
        await pool.close();
        res.json({ success: true, data: sources });
    } catch (err) {
        console.error('Error fetching sources:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all sources (admin only)
router.get('/api/admin/sources', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT * FROM EscalationSources ORDER BY SortOrder, SourceName
        `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching sources:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get table columns (helper for admin)
router.get('/api/admin/table-columns', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const tableName = req.query.table;
        if (!tableName) {
            return res.status(400).json({ success: false, error: 'Table name required' });
        }
        
        // Sanitize table name to prevent SQL injection
        const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('tableName', sql.NVarChar, sanitizedTableName)
            .query(`
                SELECT COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = @tableName 
                ORDER BY ORDINAL_POSITION
            `);
        await pool.close();
        
        res.json({ success: true, columns: result.recordset });
    } catch (err) {
        console.error('Error fetching table columns:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// List all tables (helper for admin)
router.get('/api/admin/list-tables', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            ORDER BY TABLE_NAME
        `);
        await pool.close();
        
        res.json({ success: true, tables: result.recordset });
    } catch (err) {
        console.error('Error fetching tables:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create/Update source
router.post('/api/admin/sources', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const { id, sourceCode, sourceName, moduleName, actionItemsTable, formCode, 
                inspectionTable, idColumn, inspectionIdColumn, departmentColumn, 
                deadlineColumn, responsibleColumn, statusColumn, priorityColumn,
                findingColumn, actionColumn, storeNameColumn, dateColumn, iconEmoji, colorHex, 
                isActive, sortOrder, displayColumns } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        if (id) {
            // Update
            await pool.request()
                .input('id', sql.Int, id)
                .input('sourceCode', sql.NVarChar, sourceCode)
                .input('sourceName', sql.NVarChar, sourceName)
                .input('moduleName', sql.NVarChar, moduleName)
                .input('actionItemsTable', sql.NVarChar, actionItemsTable)
                .input('formCode', sql.NVarChar, formCode)
                .input('inspectionTable', sql.NVarChar, inspectionTable)
                .input('idColumn', sql.NVarChar, idColumn || 'Id')
                .input('inspectionIdColumn', sql.NVarChar, inspectionIdColumn || 'InspectionId')
                .input('departmentColumn', sql.NVarChar, departmentColumn || 'Department')
                .input('deadlineColumn', sql.NVarChar, deadlineColumn || 'Deadline')
                .input('responsibleColumn', sql.NVarChar, responsibleColumn || 'Responsible')
                .input('statusColumn', sql.NVarChar, statusColumn || 'Status')
                .input('priorityColumn', sql.NVarChar, priorityColumn || 'Priority')
                .input('findingColumn', sql.NVarChar, findingColumn || 'Finding')
                .input('actionColumn', sql.NVarChar, actionColumn || 'Action')
                .input('storeNameColumn', sql.NVarChar, storeNameColumn || 'StoreName')
                .input('dateColumn', sql.NVarChar, dateColumn || 'CreatedAt')
                .input('iconEmoji', sql.NVarChar, iconEmoji || '📋')
                .input('colorHex', sql.NVarChar, colorHex || '#0078d4')
                .input('isActive', sql.Bit, isActive !== false)
                .input('sortOrder', sql.Int, sortOrder || 0)
                .input('displayColumns', sql.NVarChar, displayColumns || null)
                .query(`
                    UPDATE EscalationSources SET
                        SourceCode = @sourceCode, SourceName = @sourceName, ModuleName = @moduleName,
                        ActionItemsTable = @actionItemsTable, FormCode = @formCode, InspectionTable = @inspectionTable,
                        IdColumn = @idColumn, InspectionIdColumn = @inspectionIdColumn, DepartmentColumn = @departmentColumn,
                        DeadlineColumn = @deadlineColumn, ResponsibleColumn = @responsibleColumn, StatusColumn = @statusColumn,
                        PriorityColumn = @priorityColumn, FindingColumn = @findingColumn, ActionColumn = @actionColumn,
                        StoreNameColumn = @storeNameColumn, DateColumn = @dateColumn, IconEmoji = @iconEmoji, ColorHex = @colorHex,
                        IsActive = @isActive, SortOrder = @sortOrder, DisplayColumns = @displayColumns, UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            // Insert
            await pool.request()
                .input('sourceCode', sql.NVarChar, sourceCode)
                .input('sourceName', sql.NVarChar, sourceName)
                .input('moduleName', sql.NVarChar, moduleName)
                .input('actionItemsTable', sql.NVarChar, actionItemsTable)
                .input('formCode', sql.NVarChar, formCode)
                .input('inspectionTable', sql.NVarChar, inspectionTable)
                .input('idColumn', sql.NVarChar, idColumn || 'Id')
                .input('inspectionIdColumn', sql.NVarChar, inspectionIdColumn || 'InspectionId')
                .input('departmentColumn', sql.NVarChar, departmentColumn || 'Department')
                .input('deadlineColumn', sql.NVarChar, deadlineColumn || 'Deadline')
                .input('responsibleColumn', sql.NVarChar, responsibleColumn || 'Responsible')
                .input('statusColumn', sql.NVarChar, statusColumn || 'Status')
                .input('priorityColumn', sql.NVarChar, priorityColumn || 'Priority')
                .input('findingColumn', sql.NVarChar, findingColumn || 'Finding')
                .input('actionColumn', sql.NVarChar, actionColumn || 'Action')
                .input('storeNameColumn', sql.NVarChar, storeNameColumn || 'StoreName')
                .input('dateColumn', sql.NVarChar, dateColumn || 'CreatedAt')
                .input('iconEmoji', sql.NVarChar, iconEmoji || '📋')
                .input('colorHex', sql.NVarChar, colorHex || '#0078d4')
                .input('isActive', sql.Bit, isActive !== false)
                .input('sortOrder', sql.Int, sortOrder || 0)
                .input('displayColumns', sql.NVarChar, displayColumns || null)
                .query(`
                    INSERT INTO EscalationSources (
                        SourceCode, SourceName, ModuleName, ActionItemsTable, FormCode, InspectionTable,
                        IdColumn, InspectionIdColumn, DepartmentColumn, DeadlineColumn, ResponsibleColumn,
                        StatusColumn, PriorityColumn, FindingColumn, ActionColumn, StoreNameColumn, DateColumn,
                        IconEmoji, ColorHex, IsActive, SortOrder, DisplayColumns
                    ) VALUES (
                        @sourceCode, @sourceName, @moduleName, @actionItemsTable, @formCode, @inspectionTable,
                        @idColumn, @inspectionIdColumn, @departmentColumn, @deadlineColumn, @responsibleColumn,
                        @statusColumn, @priorityColumn, @findingColumn, @actionColumn, @storeNameColumn, @dateColumn,
                        @iconEmoji, @colorHex, @isActive, @sortOrder, @displayColumns
                    )
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving source:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete source
router.delete('/api/admin/sources/:id', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM EscalationSources WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting source:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Test source - verify SQL query works
router.get('/api/admin/test-source/:id', async (req, res) => {
    let query = '';
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Get source config
        const sourceResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM EscalationSources WHERE Id = @id');
        
        if (sourceResult.recordset.length === 0) {
            await pool.close();
            return res.json({ success: false, error: 'Source not found' });
        }
        
        const source = sourceResult.recordset[0];
        
        // Build simple test query
        query = buildSimpleQuery(source, {});
        
        // Execute query with TOP 10
        const testQuery = query.replace('SELECT', 'SELECT TOP 10');
        const result = await pool.request().query(testQuery);
        
        // Map results to standard format
        const items = result.recordset.map(row => {
            const item = mapRowToItem(row, source);
            return calculateOverdue(item);
        });
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM ${source.ActionItemsTable}`;
        const countResult = await pool.request().query(countQuery);
        
        await pool.close();
        
        res.json({ 
            success: true, 
            items: items,
            rawData: result.recordset, // Show raw data for debugging
            totalItems: countResult.recordset[0].total,
            query: query
        });
    } catch (err) {
        console.error('Error testing source:', err);
        res.json({ success: false, error: err.message, query: query });
    }
});

// ==========================================
// API ROUTES - ACTION ITEMS
// ==========================================

// Helper function to check if a column mapping is valid (not empty, not a placeholder)
function isValidColumn(col) {
    if (!col) return false;
    const trimmed = col.trim();
    if (!trimmed) return false;
    const invalidValues = ['-- none --', '-- select --', 'none', 'null', 'undefined', ''];
    return !invalidValues.includes(trimmed.toLowerCase());
}

// SIMPLE query builder - just SELECT * from table, no complex column mapping in SQL
// Column mapping is done in JavaScript after fetching results
function buildSimpleQuery(source, filters = {}) {
    const { department, status, priority } = filters;
    
    // Just SELECT * from the main table
    let query = `SELECT * FROM ${source.ActionItemsTable}`;
    
    // Build WHERE clause dynamically - only filter if column exists
    let conditions = [];
    
    // Exclude closed/completed if Status column exists
    if (isValidColumn(source.StatusColumn) && (!status || status === 'Open' || status === 'Overdue')) {
        conditions.push(`${source.StatusColumn} NOT IN ('Completed', 'Closed')`);
    }
    
    // Add filters only if column is valid
    if (department && isValidColumn(source.DepartmentColumn)) {
        conditions.push(`${source.DepartmentColumn} LIKE '%${department.replace(/'/g, "''")}%'`);
    }
    if (status && isValidColumn(source.StatusColumn)) {
        if (status === 'Overdue' && isValidColumn(source.DeadlineColumn)) {
            conditions.push(`${source.DeadlineColumn} < CAST(GETDATE() AS DATE)`);
        } else if (status !== 'Open' && status !== 'Overdue') {
            conditions.push(`${source.StatusColumn} = '${status.replace(/'/g, "''")}'`);
        }
    }
    if (priority && isValidColumn(source.PriorityColumn)) {
        conditions.push(`${source.PriorityColumn} = '${priority.replace(/'/g, "''")}'`);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Simple ORDER BY - use date column if available, otherwise Id
    if (isValidColumn(source.DateColumn)) {
        query += ` ORDER BY ${source.DateColumn} DESC`;
    } else if (isValidColumn(source.DeadlineColumn)) {
        query += ` ORDER BY ${source.DeadlineColumn} DESC`;
    } else {
        query += ` ORDER BY ${source.IdColumn || 'Id'} DESC`;
    }
    
    return query;
}

// Map raw database row to standard escalation item format
function mapRowToItem(row, source) {
    const idCol = source.IdColumn || 'Id';
    const id = row[idCol] || row.Id || row.id;
    
    return {
        Id: id,
        InspectionId: id,
        Department: isValidColumn(source.DepartmentColumn) ? row[source.DepartmentColumn] : null,
        Deadline: isValidColumn(source.DeadlineColumn) ? row[source.DeadlineColumn] : null,
        Responsible: isValidColumn(source.ResponsibleColumn) ? row[source.ResponsibleColumn] : null,
        Status: isValidColumn(source.StatusColumn) ? row[source.StatusColumn] : 'Open',
        Priority: isValidColumn(source.PriorityColumn) ? row[source.PriorityColumn] : 'Medium',
        Finding: isValidColumn(source.FindingColumn) ? row[source.FindingColumn] : '',
        Action: isValidColumn(source.ActionColumn) ? row[source.ActionColumn] : null,
        StoreName: isValidColumn(source.StoreNameColumn) ? row[source.StoreNameColumn] : null,
        InspectionDate: isValidColumn(source.DateColumn) ? row[source.DateColumn] : row.CreatedAt,
        DocumentNumber: `${source.SourceCode}-${id}`,
        SectionName: isValidColumn(source.SectionColumn) ? row[source.SectionColumn] : null,
        ReferenceValue: isValidColumn(source.ReferenceColumn) ? row[source.ReferenceColumn] : null,
        SourceCode: source.SourceCode,
        SourceName: source.SourceName,
        SourceId: source.Id,
        IsEscalated: 0, // Will be updated below
        EscalatedItemId: null,
        EscalationStatus: null,
        IsOverdue: 0,
        DaysOverdue: 0
    };
}

// Calculate overdue status
function calculateOverdue(item) {
    if (item.Deadline && item.Status && !['Completed', 'Closed'].includes(item.Status)) {
        const deadline = new Date(item.Deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (deadline < today) {
            item.IsOverdue = 1;
            item.DaysOverdue = Math.floor((today - deadline) / (1000 * 60 * 60 * 24));
        }
    }
    return item;
}

router.get('/api/action-items/:sourceCode', async (req, res) => {
    try {
        const { sourceCode } = req.params;
        const { department, status, priority } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        // Get source configuration
        const sourceResult = await pool.request()
            .input('sourceCode', sql.NVarChar, sourceCode)
            .query('SELECT * FROM EscalationSources WHERE SourceCode = @sourceCode AND IsActive = 1');
        
        if (sourceResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ success: false, error: 'Source not found' });
        }
        
        const source = sourceResult.recordset[0];
        const query = buildSimpleQuery(source, { department, status, priority });
        
        const result = await pool.request().query(query);
        
        // Get escalation status for these items
        const itemIds = result.recordset.map(r => r[source.IdColumn || 'Id'] || r.Id).filter(id => id);
        let escalatedMap = {};
        if (itemIds.length > 0) {
            const escResult = await pool.request()
                .input('sourceId', sql.Int, source.Id)
                .query(`SELECT SourceItemId, Id, Status FROM EscalatedItems WHERE SourceId = @sourceId`);
            escResult.recordset.forEach(e => {
                escalatedMap[e.SourceItemId] = { id: e.Id, status: e.Status };
            });
        }
        
        // Map rows to standard format
        const items = result.recordset.map(row => {
            const item = mapRowToItem(row, source);
            const esc = escalatedMap[item.Id];
            if (esc) {
                item.IsEscalated = 1;
                item.EscalatedItemId = esc.id;
                item.EscalationStatus = esc.status;
            }
            return calculateOverdue(item);
        });
        
        await pool.close();
        res.json({ success: true, data: items, source, query });
    } catch (err) {
        console.error('Error fetching action items:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all action items across all accessible sources
router.get('/api/action-items', async (req, res) => {
    try {
        const { department, status, priority, sourceCode } = req.query;
        const permissions = req.currentUser?.permissions || {};
        
        const pool = await sql.connect(dbConfig);
        
        // Get all active sources
        const sourcesResult = await pool.request().query(`
            SELECT * FROM EscalationSources WHERE IsActive = 1 ORDER BY SortOrder
        `);
        
        // Filter by permissions
        const accessibleSources = sourcesResult.recordset.filter(source => {
            if (req.currentUser?.roleNames?.includes('System Administrator')) return true;
            const perm = permissions[source.FormCode];
            return perm && perm.canView;
        });
        
        // Filter by sourceCode if specified
        const sourcesToQuery = sourceCode 
            ? accessibleSources.filter(s => s.SourceCode === sourceCode)
            : accessibleSources;
        
        let allItems = [];
        
        for (const source of sourcesToQuery) {
            try {
                const query = buildSimpleQuery(source, { department, status, priority });
                const result = await pool.request().query(query);
                
                // Get escalation status for this source
                const escResult = await pool.request()
                    .input('sourceId', sql.Int, source.Id)
                    .query(`SELECT SourceItemId, Id, Status FROM EscalatedItems WHERE SourceId = @sourceId`);
                const escalatedMap = {};
                escResult.recordset.forEach(e => {
                    escalatedMap[e.SourceItemId] = { id: e.Id, status: e.Status };
                });
                
                // Map rows to standard format
                const items = result.recordset.map(row => {
                    const item = mapRowToItem(row, source);
                    const esc = escalatedMap[item.Id];
                    if (esc) {
                        item.IsEscalated = 1;
                        item.EscalatedItemId = esc.id;
                        item.EscalationStatus = esc.status;
                    }
                    return calculateOverdue(item);
                });
                
                allItems = allItems.concat(items);
            } catch (queryErr) {
                console.error(`Error querying source ${source.SourceCode}:`, queryErr.message);
            }
        }
        
        // Sort combined results
        allItems.sort((a, b) => {
            if (a.IsOverdue !== b.IsOverdue) return b.IsOverdue - a.IsOverdue;
            const priorityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
            const aPriority = priorityOrder[a.Priority] || 0;
            const bPriority = priorityOrder[b.Priority] || 0;
            if (aPriority !== bPriority) return bPriority - aPriority;
            return new Date(a.Deadline) - new Date(b.Deadline);
        });
        
        await pool.close();
        res.json({ success: true, data: allItems, sources: sourcesToQuery });
    } catch (err) {
        console.error('Error fetching all action items:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API ROUTES - ESCALATION
// ==========================================

// Escalate an item
router.post('/api/escalate', async (req, res) => {
    try {
        const { sourceId, sourceItemId, sourceInspectionId, department, storeName, 
                finding, actionRequired, deadline, responsible, priority, reason } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        // Check if already escalated
        const existing = await pool.request()
            .input('sourceId', sql.Int, sourceId)
            .input('sourceItemId', sql.Int, sourceItemId)
            .query('SELECT Id FROM EscalatedItems WHERE SourceId = @sourceId AND SourceItemId = @sourceItemId');
        
        if (existing.recordset.length > 0) {
            await pool.close();
            return res.status(400).json({ success: false, error: 'Item is already escalated' });
        }
        
        // Insert escalated item
        const result = await pool.request()
            .input('sourceId', sql.Int, sourceId)
            .input('sourceItemId', sql.Int, sourceItemId)
            .input('sourceInspectionId', sql.Int, sourceInspectionId)
            .input('department', sql.NVarChar, department)
            .input('storeName', sql.NVarChar, storeName)
            .input('finding', sql.NVarChar, finding)
            .input('actionRequired', sql.NVarChar, actionRequired)
            .input('deadline', sql.Date, deadline)
            .input('responsible', sql.NVarChar, responsible)
            .input('priority', sql.NVarChar, priority || 'High')
            .input('reason', sql.NVarChar, reason)
            .input('escalatedBy', sql.Int, req.currentUser?.id)
            .input('escalatedByName', sql.NVarChar, req.currentUser?.displayName)
            .query(`
                INSERT INTO EscalatedItems (
                    SourceId, SourceItemId, SourceInspectionId, Department, StoreName,
                    Finding, ActionRequired, OriginalDeadline, OriginalResponsible, OriginalPriority,
                    EscalatedBy, EscalatedByName, EscalationReason, Priority
                ) VALUES (
                    @sourceId, @sourceItemId, @sourceInspectionId, @department, @storeName,
                    @finding, @actionRequired, @deadline, @responsible, @priority,
                    @escalatedBy, @escalatedByName, @reason, @priority
                );
                SELECT SCOPE_IDENTITY() as Id;
            `);
        
        const escalatedId = result.recordset[0].Id;
        
        // TODO: Send escalation email to department contacts
        
        await pool.close();
        res.json({ success: true, id: escalatedId });
    } catch (err) {
        console.error('Error escalating item:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get escalated items
router.get('/api/escalated', async (req, res) => {
    try {
        const { department, status } = req.query;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT e.*, s.SourceName, s.SourceCode, s.IconEmoji, s.ColorHex
            FROM EscalatedItems e
            JOIN EscalationSources s ON e.SourceId = s.Id
            WHERE 1=1
        `;
        
        if (department) query += ` AND e.Department LIKE '%${department}%'`;
        if (status) query += ` AND e.Status = '${status}'`;
        
        query += ' ORDER BY e.EscalatedAt DESC';
        
        const result = await pool.request().query(query);
        await pool.close();
        
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching escalated items:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update escalated item status
router.put('/api/escalated/:id', async (req, res) => {
    try {
        const { status, assignedTo, assignedToName, newDeadline, resolutionNotes } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        let updateFields = ['Status = @status', 'UpdatedAt = GETDATE()'];
        const request = pool.request()
            .input('id', sql.Int, req.params.id)
            .input('status', sql.NVarChar, status);
        
        if (assignedTo) {
            updateFields.push('AssignedTo = @assignedTo', 'AssignedToName = @assignedToName', 'AssignedAt = GETDATE()');
            request.input('assignedTo', sql.Int, assignedTo);
            request.input('assignedToName', sql.NVarChar, assignedToName);
        }
        if (newDeadline) {
            updateFields.push('NewDeadline = @newDeadline');
            request.input('newDeadline', sql.Date, newDeadline);
        }
        if (status === 'Resolved' || status === 'Closed') {
            updateFields.push('ResolvedAt = GETDATE()', 'ResolvedBy = @resolvedBy', 'ResolvedByName = @resolvedByName');
            request.input('resolvedBy', sql.Int, req.currentUser?.id);
            request.input('resolvedByName', sql.NVarChar, req.currentUser?.displayName);
            if (resolutionNotes) {
                updateFields.push('ResolutionNotes = @resolutionNotes');
                request.input('resolutionNotes', sql.NVarChar, resolutionNotes);
            }
        }
        
        await request.query(`UPDATE EscalatedItems SET ${updateFields.join(', ')} WHERE Id = @id`);
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating escalated item:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API ROUTES - EMAIL TEMPLATES
// ==========================================

router.get('/api/admin/templates', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM EscalationEmailTemplates ORDER BY TemplateName');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/api/admin/templates', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { id, templateCode, templateName, description, subject, body, placeholdersJson, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        
        if (id) {
            await pool.request()
                .input('id', sql.Int, id)
                .input('templateCode', sql.NVarChar, templateCode)
                .input('templateName', sql.NVarChar, templateName)
                .input('description', sql.NVarChar, description)
                .input('subject', sql.NVarChar, subject)
                .input('body', sql.NVarChar, body)
                .input('placeholdersJson', sql.NVarChar, placeholdersJson)
                .input('isActive', sql.Bit, isActive !== false)
                .input('updatedBy', sql.NVarChar, req.currentUser?.displayName)
                .query(`
                    UPDATE EscalationEmailTemplates SET
                        TemplateCode = @templateCode, TemplateName = @templateName, Description = @description,
                        Subject = @subject, Body = @body, PlaceholdersJson = @placeholdersJson,
                        IsActive = @isActive, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
                    WHERE Id = @id
                `);
        } else {
            await pool.request()
                .input('templateCode', sql.NVarChar, templateCode)
                .input('templateName', sql.NVarChar, templateName)
                .input('description', sql.NVarChar, description)
                .input('subject', sql.NVarChar, subject)
                .input('body', sql.NVarChar, body)
                .input('placeholdersJson', sql.NVarChar, placeholdersJson)
                .input('isActive', sql.Bit, isActive !== false)
                .query(`
                    INSERT INTO EscalationEmailTemplates (TemplateCode, TemplateName, Description, Subject, Body, PlaceholdersJson, IsActive)
                    VALUES (@templateCode, @templateName, @description, @subject, @body, @placeholdersJson, @isActive)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/api/admin/templates/:id', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM EscalationEmailTemplates WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API ROUTES - DEPARTMENT CONTACTS
// ==========================================

router.get('/api/admin/contacts', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM DepartmentContacts ORDER BY DepartmentName, SortOrder');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/api/departments', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT DISTINCT DepartmentName FROM DepartmentContacts WHERE IsActive = 1 ORDER BY DepartmentName');
        await pool.close();
        res.json({ success: true, data: result.recordset.map(r => r.DepartmentName) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/api/admin/contacts', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { id, departmentName, contactEmail, contactName, contactRole, 
                receiveOverdueAlerts, receiveEscalationAlerts, isActive, sortOrder } = req.body;
        const pool = await sql.connect(dbConfig);
        
        if (id) {
            await pool.request()
                .input('id', sql.Int, id)
                .input('departmentName', sql.NVarChar, departmentName)
                .input('contactEmail', sql.NVarChar, contactEmail)
                .input('contactName', sql.NVarChar, contactName)
                .input('contactRole', sql.NVarChar, contactRole)
                .input('receiveOverdueAlerts', sql.Bit, receiveOverdueAlerts !== false)
                .input('receiveEscalationAlerts', sql.Bit, receiveEscalationAlerts !== false)
                .input('isActive', sql.Bit, isActive !== false)
                .input('sortOrder', sql.Int, sortOrder || 0)
                .query(`
                    UPDATE DepartmentContacts SET
                        DepartmentName = @departmentName, ContactEmail = @contactEmail, ContactName = @contactName,
                        ContactRole = @contactRole, ReceiveOverdueAlerts = @receiveOverdueAlerts,
                        ReceiveEscalationAlerts = @receiveEscalationAlerts, IsActive = @isActive,
                        SortOrder = @sortOrder, UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            await pool.request()
                .input('departmentName', sql.NVarChar, departmentName)
                .input('contactEmail', sql.NVarChar, contactEmail)
                .input('contactName', sql.NVarChar, contactName)
                .input('contactRole', sql.NVarChar, contactRole)
                .input('receiveOverdueAlerts', sql.Bit, receiveOverdueAlerts !== false)
                .input('receiveEscalationAlerts', sql.Bit, receiveEscalationAlerts !== false)
                .input('isActive', sql.Bit, isActive !== false)
                .input('sortOrder', sql.Int, sortOrder || 0)
                .query(`
                    INSERT INTO DepartmentContacts (DepartmentName, ContactEmail, ContactName, ContactRole, 
                        ReceiveOverdueAlerts, ReceiveEscalationAlerts, IsActive, SortOrder)
                    VALUES (@departmentName, @contactEmail, @contactName, @contactRole,
                        @receiveOverdueAlerts, @receiveEscalationAlerts, @isActive, @sortOrder)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/api/admin/contacts/:id', async (req, res) => {
    try {
        if (!req.currentUser?.roleNames?.includes('System Administrator')) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM DepartmentContacts WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API ROUTES - STATS
// ==========================================

router.get('/api/stats', async (req, res) => {
    try {
        const permissions = req.currentUser?.permissions || {};
        const pool = await sql.connect(dbConfig);
        
        // Get accessible sources
        const sourcesResult = await pool.request().query(`
            SELECT * FROM EscalationSources WHERE IsActive = 1
        `);
        
        const accessibleSources = sourcesResult.recordset.filter(source => {
            if (req.currentUser?.roleNames?.includes('System Administrator')) return true;
            const perm = permissions[source.FormCode];
            return perm && perm.canView;
        });
        
        let totalItems = 0;
        let overdueItems = 0;
        let highPriorityItems = 0;
        
        for (const source of accessibleSources) {
            try {
                const countResult = await pool.request().query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN ${source.DeadlineColumn} < CAST(GETDATE() AS DATE) 
                            AND ${source.StatusColumn} NOT IN ('Completed', 'Closed') THEN 1 ELSE 0 END) as overdue,
                        SUM(CASE WHEN ${source.PriorityColumn} = 'High' 
                            AND ${source.StatusColumn} NOT IN ('Completed', 'Closed') THEN 1 ELSE 0 END) as highPriority
                    FROM ${source.ActionItemsTable}
                    WHERE ${source.StatusColumn} NOT IN ('Completed', 'Closed')
                `);
                const counts = countResult.recordset[0];
                totalItems += counts.total || 0;
                overdueItems += counts.overdue || 0;
                highPriorityItems += counts.highPriority || 0;
            } catch (err) {
                console.error(`Error counting for ${source.SourceCode}:`, err.message);
            }
        }
        
        // Get escalated count
        const escalatedResult = await pool.request().query(`
            SELECT COUNT(*) as count FROM EscalatedItems WHERE Status NOT IN ('Resolved', 'Closed')
        `);
        
        await pool.close();
        
        res.json({
            success: true,
            data: {
                totalItems,
                overdueItems,
                highPriorityItems,
                escalatedItems: escalatedResult.recordset[0].count,
                sourcesCount: accessibleSources.length
            }
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
