/**
 * OHS Inspection Module
 * Occupational Health & Safety Inspection App
 * Handles OHS inspections, reports, and action plans
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const sql = require('mssql');
const fs = require('fs');

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

// ==========================================
// Page Routes
// ==========================================

// Landing page - OHS Inspection Dashboard
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get inspection stats
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'Draft' THEN 1 ELSE 0 END) as drafts,
                SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as today
            FROM OHS_Inspections
        `);
        
        await pool.close();
        
        const s = stats.recordset[0] || { total: 0, drafts: 0, completed: 0, today: 0 };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>OHS Inspection - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        min-height: 100vh;
                    }
                    .header {
                        background: rgba(0,0,0,0.2);
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
                        transition: background 0.2s;
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .page-title {
                        color: white;
                        margin-bottom: 30px;
                        text-align: center;
                    }
                    .page-title h2 { font-size: 32px; margin-bottom: 10px; }
                    .page-title p { opacity: 0.9; font-size: 16px; }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .stat-card {
                        background: white;
                        padding: 25px;
                        border-radius: 12px;
                        text-align: center;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    }
                    .stat-value { font-size: 36px; font-weight: 700; color: #e17055; }
                    .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
                    
                    .cards-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 25px;
                    }
                    
                    .card {
                        background: white;
                        border-radius: 16px;
                        padding: 30px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        transition: transform 0.3s, box-shadow 0.3s;
                        text-decoration: none;
                        color: inherit;
                        display: block;
                        border-left: 4px solid #e17055;
                    }
                    .card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 15px 50px rgba(0,0,0,0.3);
                    }
                    .card-icon { font-size: 48px; margin-bottom: 15px; }
                    .card-title { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 10px; }
                    .card-desc { color: #666; font-size: 14px; line-height: 1.5; }
                    
                    @media (max-width: 768px) {
                        .stats-grid { grid-template-columns: repeat(2, 1fr); }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🦺 OHS Inspection</h1>
                    <div class="header-nav">
                        <a href="/dashboard">🏠 Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Occupational Health & Safety Inspection</h2>
                        <p>Conduct OHS inspections, generate reports, and track action plans</p>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${s.total}</div>
                            <div class="stat-label">Total Inspections</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" style="color: #f59e0b;">${s.drafts}</div>
                            <div class="stat-label">In Progress</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" style="color: #10b981;">${s.completed}</div>
                            <div class="stat-label">Completed</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" style="color: #3b82f6;">${s.today}</div>
                            <div class="stat-label">Today</div>
                        </div>
                    </div>
                    
                    <div class="cards-grid">
                        <a href="/ohs-inspection/start" class="card">
                            <div class="card-icon">🚀</div>
                            <div class="card-title">Start New Inspection</div>
                            <div class="card-desc">Begin a new OHS inspection. Select store and start filling the checklist.</div>
                        </a>
                        
                        <a href="/ohs-inspection/list" class="card">
                            <div class="card-icon">📋</div>
                            <div class="card-title">View Inspections</div>
                            <div class="card-desc">View all OHS inspections, filter by status, store, or date range.</div>
                        </a>
                        
                        <a href="/ohs-inspection/action-plans" class="card">
                            <div class="card-icon">🎯</div>
                            <div class="card-title">Action Plans</div>
                            <div class="card-desc">Track and manage action plans from completed inspections.</div>
                        </a>
                        
                        <a href="/ohs-inspection/settings" class="card">
                            <div class="card-icon">⚙️</div>
                            <div class="card-title">Settings</div>
                            <div class="card-desc">Configure inspection settings, document prefix, and thresholds.</div>
                        </a>
                        
                        <a href="/ohs-inspection/template-builder" class="card">
                            <div class="card-icon">🔧</div>
                            <div class="card-title">Template Builder</div>
                            <div class="card-desc">Create and manage inspection templates with sections and questions.</div>
                        </a>
                        
                        <a href="/ohs-inspection/store-management" class="card">
                            <div class="card-icon">🏪</div>
                            <div class="card-title">Store Management</div>
                            <div class="card-desc">Add, edit, and manage stores. Assign store managers.</div>
                        </a>
                        
                        <a href="/ohs-inspection/department-reports" class="card">
                            <div class="card-icon">📊</div>
                            <div class="card-title">Department Reports</div>
                            <div class="card-desc">View reports filtered by department (Maintenance, Procurement, Cleaning).</div>
                        </a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('OHS Inspection dashboard error:', error);
        res.status(500).send(`
            <h1>Error loading dashboard</h1>
            <p>${error.message}</p>
            <a href="/dashboard">Back to Dashboard</a>
        `);
    }
});

// Start New Inspection Page
router.get('/start', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'start-audit.html'));
});

// Fill Inspection Page
router.get('/fill/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'fill-audit.html'));
});

// View Inspections List
router.get('/list', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'audit-list.html'));
});

// Action Plan Page
router.get('/action-plan/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'action-plan.html'));
});

// Action Plans List (redirect to list with filter)
router.get('/action-plans', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'audit-list.html'));
});

// Settings Page
router.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'system-settings.html'));
});

// Template Builder Page
router.get('/template-builder', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'template-builder.html'));
});

// Store Management Page
router.get('/store-management', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'store-management.html'));
});

// Department Reports Page
router.get('/department-reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'department-reports.html'));
});

// ==========================================
// Department Reports API Routes
// ==========================================

// Get department reports list
router.get('/api/department-reports/list/:department', async (req, res) => {
    try {
        const { department } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('department', sql.NVarChar, department)
            .query(`
                SELECT DISTINCT 
                    i.Id as reportId,
                    i.DocumentNumber as documentNumber,
                    i.StoreName as storeName,
                    i.InspectionDate as auditDate,
                    i.ReportGeneratedAt as generatedAt,
                    i.Inspectors as generatedBy,
                    (SELECT COUNT(*) FROM OHS_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department) as totalItems,
                    (SELECT COUNT(*) FROM OHS_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department AND it.Priority = 'High') as highPriority,
                    (SELECT COUNT(*) FROM OHS_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department AND it.Priority = 'Medium') as mediumPriority,
                    (SELECT COUNT(*) FROM OHS_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department AND it.Priority = 'Low') as lowPriority
                FROM OHS_Inspections i
                WHERE EXISTS (
                    SELECT 1 FROM OHS_InspectionItems it 
                    WHERE it.InspectionId = i.Id AND it.Department = @department
                )
                ORDER BY i.InspectionDate DESC
            `);
        
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching department reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Template Builder API Routes
// ==========================================

// Get all templates (schemas)
router.get('/api/templates/schemas', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                t.Id as schemaId,
                t.TemplateName as schemaName,
                t.Description as description,
                t.CreatedBy as createdBy,
                t.CreatedAt as createdDate,
                (SELECT COUNT(*) FROM OHS_InspectionTemplateSections ts WHERE ts.TemplateId = t.Id AND ts.IsActive = 1) as sectionCount
            FROM OHS_InspectionTemplates t
            WHERE t.IsActive = 1
            ORDER BY t.TemplateName
        `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.json({ success: true, data: [] });
    }
});

// Create template
router.post('/api/templates/schemas', async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('name', sql.NVarChar, schemaName)
            .input('desc', sql.NVarChar, description || '')
            .input('createdBy', sql.Int, req.currentUser?.id || 1)
            .query(`
                INSERT INTO OHS_InspectionTemplates (TemplateName, Description, CreatedBy, CreatedAt, IsActive)
                OUTPUT INSERTED.Id as schemaId
                VALUES (@name, @desc, @createdBy, GETDATE(), 1)
            `);
        await pool.close();
        res.json({ success: true, data: { schemaId: result.recordset[0].schemaId } });
    } catch (error) {
        console.error('Error creating template:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get full template with sections and items
router.get('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const schemaId = parseInt(req.params.schemaId);
        const pool = await sql.connect(dbConfig);
        
        const templateResult = await pool.request()
            .input('id', sql.Int, schemaId)
            .query(`SELECT Id as schemaId, TemplateName as schemaName, Description as description FROM OHS_InspectionTemplates WHERE Id = @id`);
        
        if (templateResult.recordset.length === 0) {
            await pool.close();
            return res.json({ success: false, error: 'Template not found' });
        }
        
        const template = templateResult.recordset[0];
        
        const sectionsResult = await pool.request()
            .input('templateId', sql.Int, schemaId)
            .query(`
                SELECT Id as sectionId, SectionName as sectionName, SectionIcon as sectionIcon, SectionOrder as sectionNumber
                FROM OHS_InspectionTemplateSections 
                WHERE TemplateId = @templateId AND IsActive = 1
                ORDER BY SectionOrder
            `);
        
        template.sections = [];
        for (const section of sectionsResult.recordset) {
            const itemsResult = await pool.request()
                .input('sectionId', sql.Int, section.sectionId)
                .query(`
                    SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, AnswerOptions as answer, Criteria as cr
                    FROM OHS_InspectionTemplateItems
                    WHERE SectionId = @sectionId AND IsActive = 1
                    ORDER BY ReferenceValue
                `);
            section.items = itemsResult.recordset;
            template.sections.push(section);
        }
        
        await pool.close();
        res.json({ success: true, data: template });
    } catch (error) {
        console.error('Error fetching template:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update template
router.put('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.schemaId)
            .input('name', sql.NVarChar, schemaName)
            .input('desc', sql.NVarChar, description || '')
            .query(`UPDATE OHS_InspectionTemplates SET TemplateName = @name, Description = @desc WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating template:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete template
router.delete('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.schemaId)
            .query(`UPDATE OHS_InspectionTemplates SET IsActive = 0 WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get sections for a template
router.get('/api/templates/schemas/:schemaId/sections', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('templateId', sql.Int, req.params.schemaId)
            .query(`
                SELECT 
                    s.Id as sectionId, 
                    s.SectionName as sectionName, 
                    s.SectionIcon as sectionIcon, 
                    s.SectionOrder as sectionNumber,
                    (SELECT COUNT(*) FROM OHS_InspectionTemplateItems i WHERE i.SectionId = s.Id AND i.IsActive = 1) as itemCount
                FROM OHS_InspectionTemplateSections s
                WHERE s.TemplateId = @templateId AND s.IsActive = 1
                ORDER BY s.SectionOrder
            `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.json({ success: true, data: [] });
    }
});

// Create section
router.post('/api/templates/schemas/:schemaId/sections', async (req, res) => {
    try {
        const { sectionNumber, sectionName, sectionIcon } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('templateId', sql.Int, req.params.schemaId)
            .input('name', sql.NVarChar, sectionName)
            .input('icon', sql.NVarChar, sectionIcon || '📋')
            .input('order', sql.Int, sectionNumber)
            .query(`
                INSERT INTO OHS_InspectionTemplateSections (TemplateId, SectionName, SectionIcon, SectionOrder, IsActive)
                OUTPUT INSERTED.Id as sectionId
                VALUES (@templateId, @name, @icon, @order, 1)
            `);
        await pool.close();
        res.json({ success: true, data: { sectionId: result.recordset[0].sectionId } });
    } catch (error) {
        console.error('Error creating section:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update section
router.put('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const { sectionName, sectionIcon, sectionNumber } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.sectionId)
            .input('name', sql.NVarChar, sectionName)
            .input('icon', sql.NVarChar, sectionIcon || '📋')
            .input('order', sql.Int, sectionNumber)
            .query(`UPDATE OHS_InspectionTemplateSections SET SectionName = @name, SectionIcon = @icon, SectionOrder = @order WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating section:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete section
router.delete('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.sectionId)
            .query(`UPDATE OHS_InspectionTemplateSections SET IsActive = 0 WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting section:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get items for a section
router.get('/api/templates/sections/:sectionId/items', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .query(`
                SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, AnswerOptions as answer, Criteria as cr
                FROM OHS_InspectionTemplateItems
                WHERE SectionId = @sectionId AND IsActive = 1
                ORDER BY ReferenceValue
            `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.json({ success: true, data: [] });
    }
});

// Create item
router.post('/api/templates/sections/:sectionId/items', async (req, res) => {
    try {
        const { referenceValue, title, coeff, answer, cr } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .input('ref', sql.NVarChar, referenceValue)
            .input('question', sql.NVarChar, title)
            .input('coeff', sql.Decimal(5,2), coeff || 2)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('criteria', sql.NVarChar, cr || '')
            .query(`
                INSERT INTO OHS_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, AnswerOptions, Criteria, IsActive)
                OUTPUT INSERTED.Id as itemId
                VALUES (@sectionId, @ref, @question, @coeff, @answer, @criteria, 1)
            `);
        await pool.close();
        res.json({ success: true, data: { itemId: result.recordset[0].itemId } });
    } catch (error) {
        console.error('Error creating item:', error);
        res.json({ success: false, error: error.message });
    }
});

// Bulk create items
router.post('/api/templates/sections/:sectionId/items/bulk', async (req, res) => {
    try {
        const { items, duplicateAction = 'skip' } = req.body;
        const sectionId = parseInt(req.params.sectionId);
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.json({ success: false, error: 'No items provided' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        const existingResult = await pool.request()
            .input('sectionId', sql.Int, sectionId)
            .query(`SELECT ReferenceValue FROM OHS_InspectionTemplateItems WHERE SectionId = @sectionId AND IsActive = 1`);
        const existingRefs = new Set(existingResult.recordset.map(r => r.ReferenceValue?.toLowerCase()));
        
        let created = 0, skipped = 0;
        
        for (const item of items) {
            const refLower = item.referenceValue?.toLowerCase();
            if (existingRefs.has(refLower)) {
                skipped++;
                continue;
            }
            
            await pool.request()
                .input('sectionId', sql.Int, sectionId)
                .input('ref', sql.NVarChar, item.referenceValue)
                .input('question', sql.NVarChar, item.title)
                .input('coeff', sql.Int, item.coeff || 2)
                .input('answer', sql.NVarChar, item.answer || 'Yes,Partially,No,NA')
                .input('criteria', sql.NVarChar, item.cr || '')
                .query(`INSERT INTO OHS_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, AnswerOptions, Criteria, IsActive) VALUES (@sectionId, @ref, @question, @coeff, @answer, @criteria, 1)`);
            created++;
            existingRefs.add(refLower);
        }
        
        await pool.close();
        res.json({ success: true, data: { created, skipped, total: items.length } });
    } catch (error) {
        console.error('Error bulk creating items:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update item
router.put('/api/templates/items/:itemId', async (req, res) => {
    try {
        const { referenceValue, title, coeff, answer, cr } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.itemId)
            .input('ref', sql.NVarChar, referenceValue)
            .input('question', sql.NVarChar, title)
            .input('coeff', sql.Int, coeff || 2)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('criteria', sql.NVarChar, cr || '')
            .query(`UPDATE OHS_InspectionTemplateItems SET ReferenceValue = @ref, Question = @question, Coefficient = @coeff, AnswerOptions = @answer, Criteria = @criteria WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating item:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete item
router.delete('/api/templates/items/:itemId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.itemId)
            .query(`UPDATE OHS_InspectionTemplateItems SET IsActive = 0 WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete all items in section
router.delete('/api/templates/sections/:sectionId/items/all', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .query(`UPDATE OHS_InspectionTemplateItems SET IsActive = 0 WHERE SectionId = @sectionId; SELECT @@ROWCOUNT as deleted`);
        await pool.close();
        res.json({ success: true, data: { deleted: result.recordset[0].deleted } });
    } catch (error) {
        console.error('Error deleting items:', error);
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// Store Management Routes
// ==========================================

// Get all stores
router.get('/api/stores', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                s.Id as storeId,
                s.StoreCode as storeCode,
                s.StoreName as storeName,
                s.Location as location,
                s.TemplateId as templateId,
                t.TemplateName as templateName,
                s.IsActive as isActive,
                s.CreatedDate as createdDate
            FROM Stores s
            LEFT JOIN OHS_InspectionTemplates t ON s.TemplateId = t.Id
            ORDER BY s.StoreName
        `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// API Routes - Settings
// ==========================================

// Get system settings
router.get('/api/settings', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT SettingKey, SettingValue, Description
            FROM OHS_InspectionSettings
            WHERE IsActive = 1
        `);
        await pool.close();
        
        const settings = {};
        result.recordset.forEach(row => {
            settings[row.SettingKey] = row.SettingValue;
        });
        
        // Set defaults if not found
        if (!settings.DOCUMENT_PREFIX) settings.DOCUMENT_PREFIX = 'GMRL-OHS';
        if (!settings.PASSING_SCORE) settings.PASSING_SCORE = '80';
        
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.json({ success: true, data: { DOCUMENT_PREFIX: 'GMRL-OHS', PASSING_SCORE: '80' } });
    }
});

// Save system settings
router.post('/api/settings', async (req, res) => {
    try {
        const { settings } = req.body;
        const pool = await sql.connect(dbConfig);
        
        for (const [key, value] of Object.entries(settings)) {
            await pool.request()
                .input('key', sql.NVarChar, key)
                .input('value', sql.NVarChar, value)
                .query(`
                    IF EXISTS (SELECT 1 FROM OHS_InspectionSettings WHERE SettingKey = @key)
                        UPDATE OHS_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO OHS_InspectionSettings (SettingKey, SettingValue, IsActive) VALUES (@key, @value, 1)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.json({ success: false, error: error.message });
    }
});

// Generate next document number
router.get('/api/next-document-number', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get prefix from settings (default: GMRL-OHS)
        const prefixResult = await pool.request().query(`
            SELECT SettingValue FROM OHS_InspectionSettings WHERE SettingKey = 'DOCUMENT_PREFIX'
        `);
        const prefix = prefixResult.recordset[0]?.SettingValue || 'GMRL-OHS';
        
        // Get max document number
        const maxResult = await pool.request()
            .input('prefix', sql.NVarChar, prefix + '-%')
            .query(`
                SELECT MAX(CAST(RIGHT(DocumentNumber, 4) AS INT)) as maxNum
                FROM OHS_Inspections
                WHERE DocumentNumber LIKE @prefix
            `);
        
        const nextNum = (maxResult.recordset[0]?.maxNum || 0) + 1;
        const documentNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`;
        
        await pool.close();
        res.json({ success: true, documentNumber });
    } catch (error) {
        console.error('Error generating document number:', error);
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// Inspection API Routes
// ==========================================

// Start new inspection
router.post('/api/inspections', async (req, res) => {
    try {
        const { storeId, storeName, documentNumber, inspectionDate, inspectors, accompaniedBy, templateId } = req.body;
        const userId = req.currentUser?.id || 1;
        
        const pool = await sql.connect(dbConfig);
        
        // Create the inspection
        const result = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .input('storeId', sql.Int, storeId)
            .input('storeName', sql.NVarChar, storeName)
            .input('inspectionDate', sql.Date, inspectionDate)
            .input('inspectors', sql.NVarChar, inspectors)
            .input('accompaniedBy', sql.NVarChar, accompaniedBy || null)
            .input('createdBy', sql.Int, userId)
            .input('templateId', sql.Int, templateId || null)
            .query(`
                INSERT INTO OHS_Inspections (DocumentNumber, StoreId, StoreName, InspectionDate, Inspectors, AccompaniedBy, Status, CreatedBy, CreatedAt, TemplateId)
                OUTPUT INSERTED.Id
                VALUES (@documentNumber, @storeId, @storeName, @inspectionDate, @inspectors, @accompaniedBy, 'Draft', @createdBy, GETDATE(), @templateId)
            `);
        
        const inspectionId = result.recordset[0].Id;
        
        // Get template ID (use provided, or get default, or get first active)
        let useTemplateId = templateId;
        if (!useTemplateId) {
            const defaultTemplate = await pool.request().query(`
                SELECT TOP 1 Id FROM OHS_InspectionTemplates 
                WHERE IsActive = 1 
                ORDER BY IsDefault DESC, Id ASC
            `);
            useTemplateId = defaultTemplate.recordset[0]?.Id;
            
            // Update the inspection with the template ID
            if (useTemplateId) {
                await pool.request()
                    .input('id', sql.Int, inspectionId)
                    .input('templateId', sql.Int, useTemplateId)
                    .query('UPDATE OHS_Inspections SET TemplateId = @templateId WHERE Id = @id');
            }
        }
        
        if (useTemplateId) {
            // Copy sections from template
            const templateSections = await pool.request()
                .input('templateId', sql.Int, useTemplateId)
                .query(`
                    SELECT Id, SectionName, SectionIcon, SectionOrder, PassingGrade
                    FROM OHS_InspectionTemplateSections
                    WHERE TemplateId = @templateId AND IsActive = 1
                    ORDER BY SectionOrder
                `);
            
            for (const section of templateSections.recordset) {
                // Insert section
                await pool.request()
                    .input('inspectionId', sql.Int, inspectionId)
                    .input('sectionName', sql.NVarChar, section.SectionName)
                    .input('sectionIcon', sql.NVarChar, section.SectionIcon)
                    .input('sectionOrder', sql.Int, section.SectionOrder)
                    .query(`
                        INSERT INTO OHS_InspectionSections (InspectionId, SectionName, SectionIcon, SectionOrder)
                        VALUES (@inspectionId, @sectionName, @sectionIcon, @sectionOrder)
                    `);
                
                // Copy items for this section
                const templateItems = await pool.request()
                    .input('sectionId', sql.Int, section.Id)
                    .query(`
                        SELECT ReferenceValue, Question, Coefficient, AnswerOptions, Criteria, ISNULL(ItemOrder, 0) as ItemOrder
                        FROM OHS_InspectionTemplateItems
                        WHERE SectionId = @sectionId AND IsActive = 1
                        ORDER BY ISNULL(ItemOrder, 0), ReferenceValue
                    `);
                
                for (const item of templateItems.recordset) {
                    await pool.request()
                        .input('inspectionId', sql.Int, inspectionId)
                        .input('sectionName', sql.NVarChar, section.SectionName)
                        .input('sectionOrder', sql.Int, section.SectionOrder)
                        .input('itemOrder', sql.Int, item.ItemOrder || 0)
                        .input('referenceValue', sql.NVarChar, item.ReferenceValue)
                        .input('question', sql.NVarChar, item.Question)
                        .input('coefficient', sql.Decimal(5,2), item.Coefficient || 1)
                        .input('answerOptions', sql.NVarChar, item.AnswerOptions || 'Yes,Partially,No,NA')
                        .input('criteria', sql.NVarChar, item.Criteria)
                        .query(`
                            INSERT INTO OHS_InspectionItems 
                                (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, AnswerOptions, Criteria)
                            VALUES 
                                (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @answerOptions, @criteria)
                        `);
                }
            }
        }
        
        await pool.close();
        
        res.json({ success: true, data: { id: inspectionId, documentNumber } });
    } catch (error) {
        console.error('Error creating inspection:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get all inspections
router.get('/api/inspections', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                i.Id, i.DocumentNumber, i.StoreId, i.StoreName, 
                i.InspectionDate, i.Inspectors, i.AccompaniedBy,
                i.Status, i.Score, i.CreatedAt, i.CompletedAt,
                u.DisplayName as CreatedByName
            FROM OHS_Inspections i
            LEFT JOIN Users u ON i.CreatedBy = u.Id
            ORDER BY i.CreatedAt DESC
        `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching inspections:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get all audits for list view
router.get('/api/audits/list', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                i.Id as AuditID,
                i.DocumentNumber,
                i.StoreId,
                i.StoreName,
                i.InspectionDate as AuditDate,
                i.Inspectors as Auditors,
                i.AccompaniedBy,
                i.Cycle as AuditCycle,
                i.Year as AuditYear,
                i.Status,
                i.Score as TotalScore,
                i.TotalPoints,
                i.MaxPoints,
                i.Comments,
                i.CreatedAt,
                i.CompletedAt,
                i.TimeIn,
                i.TimeOut,
                u.DisplayName as CreatedByName,
                t.TemplateName as SchemaName,
                ISNULL(s.SettingValue, '80') as PassingGrade
            FROM OHS_Inspections i
            LEFT JOIN Users u ON i.CreatedBy = u.Id
            LEFT JOIN OHS_InspectionTemplates t ON t.IsDefault = 1 AND t.IsActive = 1
            LEFT JOIN OHS_InspectionSettings s ON s.SettingKey = 'PASSING_SCORE'
            ORDER BY i.CreatedAt DESC
        `);
        await pool.close();
        res.json({ success: true, audits: result.recordset });
    } catch (error) {
        console.error('Error fetching audits list:', error);
        res.json({ success: false, audits: [], error: error.message });
    }
});

// Get single audit
router.get('/api/audits/:auditId', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const auditResult = await pool.request()
            .input('id', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, i.StoreName, i.InspectionDate,
                    i.TimeIn, i.TimeOut, i.Inspectors, i.AccompaniedBy, i.Cycle, i.Year,
                    i.Status, i.Score, i.TotalPoints, i.MaxPoints, i.Comments,
                    i.CreatedBy, i.CreatedAt, i.UpdatedAt, i.CompletedAt, i.ApprovedBy, i.ApprovedAt,
                    COALESCE(i.TemplateId, dt.Id, ft.Id) as TemplateId,
                    COALESCE(dt.TemplateName, ft.TemplateName) as TemplateName
                FROM OHS_Inspections i
                LEFT JOIN OHS_InspectionTemplates dt ON dt.IsDefault = 1 AND dt.IsActive = 1
                LEFT JOIN (SELECT TOP 1 * FROM OHS_InspectionTemplates WHERE IsActive = 1 ORDER BY Id) ft ON dt.Id IS NULL
                WHERE i.Id = @id
            `);
        
        if (auditResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Check if sections exist
        let sectionsResult = await pool.request()
            .input('inspectionId', sql.Int, auditId)
            .query(`
                SELECT 
                    s.Id as sectionId,
                    s.SectionName as sectionName,
                    s.SectionOrder as sectionNumber,
                    s.SectionIcon as sectionIcon,
                    s.Score as sectionScore,
                    s.TotalPoints as totalPoints,
                    s.MaxPoints as maxPoints
                FROM OHS_InspectionSections s
                WHERE s.InspectionId = @inspectionId
                ORDER BY s.SectionOrder
            `);
        
        // If no sections exist, populate from template
        const templateId = audit.TemplateId ? parseInt(audit.TemplateId) : null;
        if (sectionsResult.recordset.length === 0 && templateId) {
            const templateSections = await pool.request()
                .input('templateId', sql.Int, templateId)
                .query(`
                    SELECT Id, SectionName, SectionIcon, SectionOrder, PassingGrade
                    FROM OHS_InspectionTemplateSections
                    WHERE TemplateId = @templateId AND IsActive = 1
                    ORDER BY SectionOrder
                `);
            
            for (const section of templateSections.recordset) {
                await pool.request()
                    .input('inspectionId', sql.Int, auditId)
                    .input('sectionName', sql.NVarChar, section.SectionName)
                    .input('sectionIcon', sql.NVarChar, section.SectionIcon)
                    .input('sectionOrder', sql.Int, section.SectionOrder)
                    .query(`
                        INSERT INTO OHS_InspectionSections (InspectionId, SectionName, SectionIcon, SectionOrder)
                        VALUES (@inspectionId, @sectionName, @sectionIcon, @sectionOrder)
                    `);
                
                const templateItems = await pool.request()
                    .input('sectionId', sql.Int, section.Id)
                    .query(`
                        SELECT ReferenceValue, Question, Coefficient, AnswerOptions, Criteria, ISNULL(ItemOrder, 0) as ItemOrder
                        FROM OHS_InspectionTemplateItems
                        WHERE SectionId = @sectionId AND IsActive = 1
                        ORDER BY ISNULL(ItemOrder, 0), ReferenceValue
                    `);
                
                for (const item of templateItems.recordset) {
                    await pool.request()
                        .input('inspectionId', sql.Int, auditId)
                        .input('sectionName', sql.NVarChar, section.SectionName)
                        .input('sectionOrder', sql.Int, section.SectionOrder)
                        .input('itemOrder', sql.Int, item.ItemOrder || 0)
                        .input('referenceValue', sql.NVarChar, item.ReferenceValue)
                        .input('question', sql.NVarChar, item.Question)
                        .input('coefficient', sql.Decimal(5,2), item.Coefficient || 1)
                        .input('answerOptions', sql.NVarChar, item.AnswerOptions || 'Yes,Partially,No,NA')
                        .input('criteria', sql.NVarChar, item.Criteria)
                        .query(`
                            INSERT INTO OHS_InspectionItems 
                                (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, AnswerOptions, Criteria)
                            VALUES 
                                (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @answerOptions, @criteria)
                        `);
                }
            }
            
            sectionsResult = await pool.request()
                .input('inspectionId', sql.Int, auditId)
                .query(`
                    SELECT 
                        s.Id as sectionId,
                        s.SectionName as sectionName,
                        s.SectionOrder as sectionNumber,
                        s.SectionIcon as sectionIcon,
                        s.Score as sectionScore,
                        s.TotalPoints as totalPoints,
                        s.MaxPoints as maxPoints
                    FROM OHS_InspectionSections s
                    WHERE s.InspectionId = @inspectionId
                    ORDER BY s.SectionOrder
                `);
        }
        
        // Get items for each section
        const sections = [];
        for (const section of sectionsResult.recordset) {
            const itemsResult = await pool.request()
                .input('inspectionId', sql.Int, auditId)
                .input('sectionName', sql.NVarChar, section.sectionName)
                .query(`
                    SELECT 
                        Id as responseId,
                        ReferenceValue as referenceValue,
                        Question as title,
                        Coefficient as coeff,
                        AnswerOptions as answerOptions,
                        Answer as selectedChoice,
                        Score as value,
                        Finding as finding,
                        Comment as comment,
                        CorrectedAction as cr,
                        Priority as priority,
                        HasPicture as hasPicture,
                        Escalate as escalate,
                        Department as department,
                        Criteria as criteria
                    FROM OHS_InspectionItems
                    WHERE InspectionId = @inspectionId AND SectionName = @sectionName
                    ORDER BY ItemOrder
                `);
            section.items = itemsResult.recordset;
            sections.push(section);
        }
        
        await pool.close();
        res.json({ 
            success: true, 
            data: {
                auditId: audit.Id,
                documentNumber: audit.DocumentNumber,
                storeId: audit.StoreId,
                storeCode: audit.StoreName?.split(' - ')[0] || '',
                storeName: audit.StoreName,
                auditDate: audit.InspectionDate,
                auditors: audit.Inspectors,
                accompaniedBy: audit.AccompaniedBy,
                cycle: audit.Cycle,
                year: audit.Year,
                status: audit.Status,
                score: audit.Score,
                templateId: audit.TemplateId,
                templateName: audit.TemplateName,
                sections
            }
        });
    } catch (error) {
        console.error('Error fetching audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete audit
router.delete('/api/audits/:auditId', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OHS_InspectionActionItems WHERE InspectionId = @id`);
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OHS_InspectionItems WHERE InspectionId = @id`);
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OHS_InspectionSections WHERE InspectionId = @id`);
        
        const result = await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OHS_Inspections WHERE Id = @id; SELECT @@ROWCOUNT as deleted`);
        
        await pool.close();
        
        if (result.recordset[0].deleted === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        res.json({ success: true, message: 'Audit deleted successfully' });
    } catch (error) {
        console.error('Error deleting audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update audit response item
router.put('/api/audits/response/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const { selectedChoice, coeff, finding, comment, cr, priority, escalate, department } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        const currentResult = await pool.request()
            .input('id', sql.Int, responseId)
            .query(`SELECT Answer, Score, Finding, Comment, CorrectedAction, Priority, Escalate, Department FROM OHS_InspectionItems WHERE Id = @id`);
        
        const current = currentResult.recordset[0] || {};
        
        // Calculate value based on choice
        let value = 0;
        const choice = selectedChoice !== undefined ? selectedChoice : current.Answer;
        const coefficient = coeff !== undefined ? coeff : 1;
        if (choice === 'Yes') value = coefficient;
        else if (choice === 'Partially') value = coefficient * 0.5;
        else if (choice === 'No' || choice === 'NA') value = 0;
        
        const finalEscalate = escalate !== undefined ? (escalate ? 1 : 0) : current.Escalate;
        const finalDepartment = department !== undefined ? (department || null) : current.Department;
        const finalFinding = finding !== undefined ? (finding || null) : current.Finding;
        const finalComment = comment !== undefined ? (comment || null) : current.Comment;
        const finalCr = cr !== undefined ? (cr || null) : current.CorrectedAction;
        const finalPriority = priority !== undefined ? (priority || null) : current.Priority;
        
        await pool.request()
            .input('id', sql.Int, responseId)
            .input('selectedChoice', sql.NVarChar, choice || null)
            .input('value', sql.Decimal(5,2), value)
            .input('finding', sql.NVarChar, finalFinding)
            .input('comment', sql.NVarChar, finalComment)
            .input('cr', sql.NVarChar, finalCr)
            .input('priority', sql.NVarChar, finalPriority)
            .input('escalate', sql.Bit, finalEscalate)
            .input('department', sql.NVarChar, finalDepartment)
            .query(`
                UPDATE OHS_InspectionItems 
                SET Answer = @selectedChoice,
                    Score = @value,
                    Finding = @finding,
                    Comment = @comment,
                    CorrectedAction = @cr,
                    Priority = @priority,
                    Escalate = @escalate,
                    Department = @department
                WHERE Id = @id
            `);
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating response:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload picture for audit item
router.post('/api/audits/pictures', async (req, res) => {
    try {
        const { responseId, auditId, fileName, contentType, pictureType, fileData } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('responseId', sql.Int, responseId)
            .input('auditId', sql.Int, auditId)
            .input('fileName', sql.NVarChar, fileName)
            .input('contentType', sql.NVarChar, contentType)
            .input('pictureType', sql.NVarChar, pictureType)
            .input('fileData', sql.NVarChar(sql.MAX), fileData)
            .query(`
                INSERT INTO OHS_InspectionPictures (ItemId, InspectionId, FileName, ContentType, PictureType, FileData, CreatedAt)
                OUTPUT INSERTED.Id as pictureId
                VALUES (@responseId, @auditId, @fileName, @contentType, @pictureType, @fileData, GETDATE())
            `);
        
        await pool.request()
            .input('id', sql.Int, responseId)
            .query(`UPDATE OHS_InspectionItems SET HasPicture = 1 WHERE Id = @id`);
        
        await pool.close();
        res.json({ success: true, data: { pictureId: result.recordset[0].pictureId } });
    } catch (error) {
        console.error('Error uploading picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pictures for a response
router.get('/api/audits/pictures/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('responseId', sql.Int, responseId)
            .query(`
                SELECT Id as pictureId, FileName as fileName, ContentType as contentType, 
                       PictureType as pictureType, FileData as fileData
                FROM OHS_InspectionPictures
                WHERE ItemId = @responseId
                ORDER BY CreatedAt
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching pictures:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a picture
router.delete('/api/audits/pictures/:pictureId', async (req, res) => {
    try {
        const { pictureId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, pictureId)
            .query(`DELETE FROM OHS_InspectionPictures WHERE Id = @id`);
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete audit
router.post('/api/audits/:auditId/complete', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const scoreResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    ISNULL(SUM(Score), 0) as totalPoints,
                    ISNULL(SUM(Coefficient), 0) as maxPoints
                FROM OHS_InspectionItems
                WHERE InspectionId = @auditId AND Answer IS NOT NULL AND Answer != 'NA'
            `);
        
        const { totalPoints, maxPoints } = scoreResult.recordset[0];
        const totalScore = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
        
        await pool.request()
            .input('auditId', sql.Int, auditId)
            .input('score', sql.Decimal(5,2), totalScore)
            .input('totalPoints', sql.Decimal(10,2), totalPoints)
            .input('maxPoints', sql.Decimal(10,2), maxPoints)
            .query(`
                UPDATE OHS_Inspections 
                SET Status = 'Completed', 
                    Score = @score,
                    TotalPoints = @totalPoints,
                    MaxPoints = @maxPoints,
                    CompletedAt = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE Id = @auditId
            `);
        
        await pool.close();
        res.json({ success: true, data: { totalScore } });
    } catch (error) {
        console.error('Error completing audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate report for an audit
router.post('/api/audits/:auditId/generate-report', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get audit header
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT i.*, t.TemplateName, t.Description as TemplateDescription
                FROM OHS_Inspections i
                LEFT JOIN OHS_InspectionTemplates t ON i.TemplateId = t.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        const audit = auditResult.recordset[0];
        
        // Get all items
        const itemsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT * FROM OHS_InspectionItems
                WHERE InspectionId = @auditId
                ORDER BY SectionOrder, ItemOrder
            `);
        
        // Group items by section and calculate scores
        const sectionMap = new Map();
        for (const item of itemsResult.recordset) {
            const sectionName = item.SectionName || 'General';
            if (!sectionMap.has(sectionName)) {
                sectionMap.set(sectionName, {
                    SectionName: sectionName,
                    SectionOrder: item.SectionOrder || 0,
                    items: [],
                    earnedScore: 0,
                    maxScore: 0
                });
            }
            const section = sectionMap.get(sectionName);
            section.items.push(item);
            
            if (item.Answer && item.Answer !== 'NA') {
                section.maxScore += parseFloat(item.Coefficient || 0);
                section.earnedScore += parseFloat(item.Score || 0);
            }
        }
        
        const sections = Array.from(sectionMap.values()).sort((a, b) => a.SectionOrder - b.SectionOrder);
        
        // Get findings
        const findings = itemsResult.recordset.filter(item => 
            item.Answer === 'No' || item.Answer === 'Partially' || item.Finding
        );
        
        // Calculate overall score
        const totalEarned = sections.reduce((sum, s) => sum + s.earnedScore, 0);
        const totalMax = sections.reduce((sum, s) => sum + s.maxScore, 0);
        const overallScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
        
        // Get settings for threshold
        const settingsResult = await pool.request().query(`SELECT SettingValue FROM OHS_InspectionSettings WHERE SettingKey = 'PASSING_SCORE'`);
        const threshold = parseInt(settingsResult.recordset[0]?.SettingValue) || 80;
        
        // Build report data
        const reportData = {
            audit,
            sections: sections.map(s => ({
                ...s,
                Percentage: s.maxScore > 0 ? Math.round((s.earnedScore / s.maxScore) * 100) : 0
            })),
            findings,
            overallScore,
            threshold,
            generatedAt: new Date().toISOString()
        };
        
        // Generate HTML report
        const html = generateOHSReportHTML(reportData);
        
        // Save report to file
        const reportsDir = path.join(__dirname, '..', '..', 'reports', 'ohs-inspection');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const fileName = `OHS_Report_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        const filePath = path.join(reportsDir, fileName);
        fs.writeFileSync(filePath, html, 'utf8');
        
        // Update audit with report info
        await pool.request()
            .input('auditId', sql.Int, auditId)
            .input('fileName', sql.NVarChar, fileName)
            .query(`UPDATE OHS_Inspections SET ReportFileName = @fileName, ReportGeneratedAt = GETDATE() WHERE Id = @auditId`);
        
        console.log(`✅ OHS Report generated: ${fileName}`);
        res.json({ success: true, fileName, overallScore });
        
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to generate HTML report
function generateOHSReportHTML(data) {
    const { audit, sections, findings, overallScore, threshold, generatedAt } = data;
    const passedClass = overallScore >= threshold ? 'pass' : 'fail';
    const passedText = overallScore >= threshold ? 'PASS ✅' : 'FAIL ❌';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OHS Inspection Report - ${audit.DocumentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
        .header-item { background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: 8px; }
        .header-item label { font-size: 12px; opacity: 0.8; display: block; }
        .header-item span { font-size: 16px; font-weight: 600; }
        .score-card { background: white; border-radius: 12px; padding: 30px; margin-bottom: 20px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .score-value { font-size: 72px; font-weight: bold; }
        .score-value.pass { color: #10b981; }
        .score-value.fail { color: #ef4444; }
        .score-label { font-size: 24px; margin-top: 10px; }
        .score-label.pass { color: #10b981; }
        .score-label.fail { color: #ef4444; }
        .section-card { background: white; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section-header { background: #fff5f5; padding: 20px; border-bottom: 1px solid #fecaca; display: flex; justify-content: space-between; align-items: center; }
        .section-title { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .section-score { font-size: 24px; font-weight: bold; }
        .section-score.pass { color: #10b981; }
        .section-score.fail { color: #ef4444; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748b; }
        tr:hover { background: #f8fafc; }
        .choice-yes { color: #10b981; font-weight: 600; }
        .choice-no { color: #ef4444; font-weight: 600; }
        .choice-partial { color: #f59e0b; font-weight: 600; }
        .choice-na { color: #94a3b8; }
        .findings-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .findings-title { color: #dc2626; font-size: 20px; font-weight: 600; margin-bottom: 15px; }
        .finding-item { background: white; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #ef4444; }
        .finding-ref { font-weight: 600; color: #e17055; }
        .finding-question { margin: 5px 0; }
        .finding-detail { color: #64748b; font-size: 14px; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        @media print { body { background: white; } .container { max-width: 100%; padding: 0; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🦺 OHS Inspection Report</h1>
            <div class="header-info">
                <div class="header-item"><label>Document Number</label><span>${audit.DocumentNumber}</span></div>
                <div class="header-item"><label>Store</label><span>${audit.StoreName}</span></div>
                <div class="header-item"><label>Inspection Date</label><span>${new Date(audit.InspectionDate).toLocaleDateString()}</span></div>
                <div class="header-item"><label>Inspectors</label><span>${audit.Inspectors || 'N/A'}</span></div>
                <div class="header-item"><label>Accompanied By</label><span>${audit.AccompaniedBy || 'N/A'}</span></div>
                <div class="header-item"><label>Status</label><span>${audit.Status}</span></div>
            </div>
        </div>
        
        <div class="score-card">
            <div class="score-value ${passedClass}">${overallScore}%</div>
            <div class="score-label ${passedClass}">${passedText}</div>
            <div style="color: #64748b; margin-top: 10px;">Threshold: ${threshold}%</div>
        </div>
        
        ${sections.map(section => `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title">${section.SectionIcon || '📋'} ${section.SectionName}</div>
                <div class="section-score ${section.Percentage >= threshold ? 'pass' : 'fail'}">${section.Percentage}%</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Question</th>
                        <th>Answer</th>
                        <th>Score</th>
                        <th>Finding</th>
                    </tr>
                </thead>
                <tbody>
                    ${(section.items || []).map(item => `
                    <tr>
                        <td>${item.ReferenceValue || '-'}</td>
                        <td>${item.Question || '-'}</td>
                        <td class="${item.Answer === 'Yes' ? 'choice-yes' : item.Answer === 'No' ? 'choice-no' : item.Answer === 'Partially' ? 'choice-partial' : 'choice-na'}">${item.Answer || '-'}</td>
                        <td>${item.Score ?? '-'} / ${item.Coefficient || 0}</td>
                        <td>${item.Finding || '-'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        `).join('')}
        
        ${findings.length > 0 ? `
        <div class="findings-card">
            <div class="findings-title">⚠️ Findings Summary (${findings.length} items)</div>
            ${findings.map(f => `
            <div class="finding-item">
                <div class="finding-ref">[${f.ReferenceValue || 'N/A'}] ${f.SectionName}</div>
                <div class="finding-question">${f.Question}</div>
                <div class="finding-detail">Answer: ${f.Answer} | Finding: ${f.Finding || 'N/A'}</div>
            </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="footer">
            Report generated on ${new Date(generatedAt).toLocaleString()} | OHS Inspection System
        </div>
    </div>
</body>
</html>`;
}

// Serve report files
router.get('/api/audits/reports/:fileName', (req, res) => {
    const { fileName } = req.params;
    const reportsDir = path.join(__dirname, '..', '..', 'reports', 'ohs-inspection');
    const filePath = path.join(reportsDir, fileName);
    
    if (!filePath.startsWith(reportsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Report not found' });
    }
});

// API Stats for dashboard
router.get('/api/stats', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'Draft' THEN 1 ELSE 0 END) as drafts,
                SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as today
            FROM OHS_Inspections
        `);
        await pool.close();
        res.json({ success: true, data: stats.recordset[0] });
    } catch (error) {
        res.json({ success: true, data: { total: 0, drafts: 0, completed: 0, today: 0 } });
    }
});

// Get all schemas for settings page
router.get('/api/schemas', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                t.Id as SchemaID,
                t.TemplateName as SchemaName,
                t.Description,
                t.IsActive,
                ISNULL(s.SettingValue, '80') as overallPassingGrade
            FROM OHS_InspectionTemplates t
            LEFT JOIN OHS_InspectionSettings s ON s.SettingKey = 'PASSING_SCORE_' + CAST(t.Id AS VARCHAR)
            WHERE t.IsActive = 1
            ORDER BY t.TemplateName
        `);
        
        const schemas = [];
        for (const schema of result.recordset) {
            const sectionsResult = await pool.request()
                .input('templateId', sql.Int, schema.SchemaID)
                .query(`
                    SELECT 
                        ts.Id as SectionID,
                        ts.SectionName,
                        ts.SectionOrder,
                        ts.SectionIcon,
                        ISNULL(ts.PassingGrade, 80) as PassingGrade
                    FROM OHS_InspectionTemplateSections ts
                    WHERE ts.TemplateId = @templateId
                    ORDER BY ts.SectionOrder
                `);
            schemas.push({
                ...schema,
                sections: sectionsResult.recordset
            });
        }
        
        await pool.close();
        res.json({ success: true, schemas });
    } catch (error) {
        console.error('Error fetching schemas:', error);
        res.json({ success: true, schemas: [] });
    }
});

module.exports = router;
