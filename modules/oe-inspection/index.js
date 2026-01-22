/**
 * OE Inspection Module
 * Operational Excellence Inspection App
 * Handles inspections, reports, and action plans
 */

const express = require('express');
const router = express.Router();
const path = require('path');
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

// ==========================================
// Page Routes
// ==========================================

// Landing page - Inspection Dashboard
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
            FROM OE_Inspections
        `);
        
        await pool.close();
        
        const s = stats.recordset[0] || { total: 0, drafts: 0, completed: 0, today: 0 };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>OE Inspection - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
                    .stat-value { font-size: 36px; font-weight: 700; color: #10b981; }
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
                        border-left: 4px solid #10b981;
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
                    <h1>🔍 OE Inspection</h1>
                    <div class="header-nav">
                        <a href="/dashboard">🏠 Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Operational Excellence Inspection</h2>
                        <p>Conduct inspections, generate reports, and track action plans</p>
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
                        <a href="/oe-inspection/start" class="card">
                            <div class="card-icon">🚀</div>
                            <div class="card-title">Start New Inspection</div>
                            <div class="card-desc">Begin a new OE inspection. Select store and start filling the checklist.</div>
                        </a>
                        
                        <a href="/oe-inspection/list" class="card">
                            <div class="card-icon">📋</div>
                            <div class="card-title">View Inspections</div>
                            <div class="card-desc">View all inspections, filter by status, store, or date range.</div>
                        </a>
                        
                        <a href="/oe-inspection/action-plans" class="card">
                            <div class="card-icon">🎯</div>
                            <div class="card-title">Action Plans</div>
                            <div class="card-desc">Track and manage action plans from completed inspections.</div>
                        </a>
                        
                        <a href="/oe-inspection/settings" class="card">
                            <div class="card-icon">⚙️</div>
                            <div class="card-title">Settings</div>
                            <div class="card-desc">Configure inspection settings, document prefix, and thresholds.</div>
                        </a>
                        
                        <a href="/oe-inspection/template-builder" class="card">
                            <div class="card-icon">🔧</div>
                            <div class="card-title">Template Builder</div>
                            <div class="card-desc">Create and manage inspection templates with sections and questions.</div>
                        </a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('OE Inspection dashboard error:', error);
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
                (SELECT COUNT(*) FROM OE_InspectionTemplateSections ts WHERE ts.TemplateId = t.Id AND ts.IsActive = 1) as sectionCount
            FROM OE_InspectionTemplates t
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
            .input('createdBy', sql.NVarChar, req.currentUser?.email || 'System')
            .query(`
                INSERT INTO OE_InspectionTemplates (TemplateName, Description, CreatedBy, CreatedAt, IsActive)
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
        
        // Get template
        const templateResult = await pool.request()
            .input('id', sql.Int, schemaId)
            .query(`SELECT Id as schemaId, TemplateName as schemaName, Description as description FROM OE_InspectionTemplates WHERE Id = @id`);
        
        if (templateResult.recordset.length === 0) {
            await pool.close();
            return res.json({ success: false, error: 'Template not found' });
        }
        
        const template = templateResult.recordset[0];
        
        // Get sections
        const sectionsResult = await pool.request()
            .input('templateId', sql.Int, schemaId)
            .query(`
                SELECT Id as sectionId, SectionName as sectionName, SectionIcon as sectionIcon, SectionOrder as sectionNumber
                FROM OE_InspectionTemplateSections 
                WHERE TemplateId = @templateId AND IsActive = 1
                ORDER BY SectionOrder
            `);
        
        // Get items for each section
        template.sections = [];
        for (const section of sectionsResult.recordset) {
            const itemsResult = await pool.request()
                .input('sectionId', sql.Int, section.sectionId)
                .query(`
                    SELECT Id as itemId, ReferenceValue as referenceValue, Title as title, Coeff as coeff, Answer as answer, CR as cr
                    FROM OE_InspectionTemplateItems
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
            .query(`UPDATE OE_InspectionTemplates SET TemplateName = @name, Description = @desc WHERE Id = @id`);
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
            .query(`UPDATE OE_InspectionTemplates SET IsActive = 0 WHERE Id = @id`);
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
                    (SELECT COUNT(*) FROM OE_InspectionTemplateItems i WHERE i.SectionId = s.Id AND i.IsActive = 1) as itemCount
                FROM OE_InspectionTemplateSections s
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
                INSERT INTO OE_InspectionTemplateSections (TemplateId, SectionName, SectionIcon, SectionOrder, IsActive)
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

// Get items for a section
router.get('/api/templates/sections/:sectionId/items', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .query(`
                SELECT Id as itemId, ReferenceValue as referenceValue, Title as title, Coeff as coeff, Answer as answer, CR as cr
                FROM OE_InspectionTemplateItems
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
            .input('title', sql.NVarChar, title)
            .input('coeff', sql.Int, coeff || 2)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('cr', sql.NVarChar, cr || '')
            .query(`
                INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Title, Coeff, Answer, CR, IsActive)
                OUTPUT INSERTED.Id as itemId
                VALUES (@sectionId, @ref, @title, @coeff, @answer, @cr, 1)
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
        
        // Get existing items
        const existingResult = await pool.request()
            .input('sectionId', sql.Int, sectionId)
            .query(`SELECT ReferenceValue FROM OE_InspectionTemplateItems WHERE SectionId = @sectionId AND IsActive = 1`);
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
                .input('title', sql.NVarChar, item.title)
                .input('coeff', sql.Int, item.coeff || 2)
                .input('answer', sql.NVarChar, item.answer || 'Yes,Partially,No,NA')
                .input('cr', sql.NVarChar, item.cr || '')
                .query(`INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Title, Coeff, Answer, CR, IsActive) VALUES (@sectionId, @ref, @title, @coeff, @answer, @cr, 1)`);
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
            .input('title', sql.NVarChar, title)
            .input('coeff', sql.Int, coeff || 2)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('cr', sql.NVarChar, cr || '')
            .query(`UPDATE OE_InspectionTemplateItems SET ReferenceValue = @ref, Title = @title, Coeff = @coeff, Answer = @answer, CR = @cr WHERE Id = @id`);
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
            .query(`UPDATE OE_InspectionTemplateItems SET IsActive = 0 WHERE Id = @id`);
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
            .query(`UPDATE OE_InspectionTemplateItems SET IsActive = 0 WHERE SectionId = @sectionId; SELECT @@ROWCOUNT as deleted`);
        await pool.close();
        res.json({ success: true, data: { deleted: result.recordset[0].deleted } });
    } catch (error) {
        console.error('Error deleting items:', error);
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// API Routes
// ==========================================

// Get system settings
router.get('/api/settings', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT SettingKey, SettingValue, Description
            FROM OE_InspectionSettings
            WHERE IsActive = 1
        `);
        await pool.close();
        
        const settings = {};
        result.recordset.forEach(row => {
            settings[row.SettingKey] = row.SettingValue;
        });
        
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.json({ success: false, error: error.message });
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
                    IF EXISTS (SELECT 1 FROM OE_InspectionSettings WHERE SettingKey = @key)
                        UPDATE OE_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO OE_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get stores list
router.get('/api/stores', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT Id as storeId, StoreCode as storeCode, StoreName as storeName
            FROM Stores
            WHERE IsActive = 1
            ORDER BY StoreName
        `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.json({ success: false, error: error.message });
    }
});

// Generate next document number
router.get('/api/next-document-number', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get prefix from settings (default: GMRL-OEI)
        const prefixResult = await pool.request().query(`
            SELECT SettingValue FROM OE_InspectionSettings WHERE SettingKey = 'DOCUMENT_PREFIX'
        `);
        const prefix = prefixResult.recordset[0]?.SettingValue || 'GMRL-OEI';
        
        // Get max document number
        const maxResult = await pool.request()
            .input('prefix', sql.NVarChar, prefix + '-%')
            .query(`
                SELECT MAX(CAST(SUBSTRING(DocumentNumber, LEN(@prefix), 10) AS INT)) as maxNum
                FROM OE_Inspections
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

// Start new inspection
router.post('/api/inspections', async (req, res) => {
    try {
        const { storeId, storeName, documentNumber, inspectionDate, inspectors, accompaniedBy } = req.body;
        const userId = req.currentUser?.id || 1;
        
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .input('storeId', sql.Int, storeId)
            .input('storeName', sql.NVarChar, storeName)
            .input('inspectionDate', sql.Date, inspectionDate)
            .input('inspectors', sql.NVarChar, inspectors)
            .input('accompaniedBy', sql.NVarChar, accompaniedBy || null)
            .input('createdBy', sql.Int, userId)
            .query(`
                INSERT INTO OE_Inspections (DocumentNumber, StoreId, StoreName, InspectionDate, Inspectors, AccompaniedBy, Status, CreatedBy, CreatedAt)
                OUTPUT INSERTED.Id
                VALUES (@documentNumber, @storeId, @storeName, @inspectionDate, @inspectors, @accompaniedBy, 'Draft', @createdBy, GETDATE())
            `);
        
        const inspectionId = result.recordset[0].Id;
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
            FROM OE_Inspections i
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

// Get single inspection
router.get('/api/inspections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const inspection = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT * FROM OE_Inspections WHERE Id = @id`);
        
        const items = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT * FROM OE_InspectionItems WHERE InspectionId = @id ORDER BY SectionOrder, ItemOrder`);
        
        await pool.close();
        
        if (inspection.recordset.length === 0) {
            return res.json({ success: false, error: 'Inspection not found' });
        }
        
        res.json({ 
            success: true, 
            data: {
                ...inspection.recordset[0],
                items: items.recordset
            }
        });
    } catch (error) {
        console.error('Error fetching inspection:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update inspection
router.put('/api/inspections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, score, items } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        // Update inspection
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .input('score', sql.Decimal(5,2), score || null)
            .query(`
                UPDATE OE_Inspections 
                SET Status = @status, Score = @score, UpdatedAt = GETDATE(),
                    CompletedAt = CASE WHEN @status = 'Completed' THEN GETDATE() ELSE CompletedAt END
                WHERE Id = @id
            `);
        
        // Update items if provided
        if (items && items.length > 0) {
            for (const item of items) {
                await pool.request()
                    .input('inspectionId', sql.Int, id)
                    .input('sectionName', sql.NVarChar, item.sectionName)
                    .input('itemOrder', sql.Int, item.itemOrder)
                    .input('question', sql.NVarChar, item.question)
                    .input('answer', sql.NVarChar, item.answer)
                    .input('score', sql.Decimal(5,2), item.score)
                    .input('finding', sql.NVarChar, item.finding || null)
                    .input('priority', sql.NVarChar, item.priority || null)
                    .query(`
                        IF EXISTS (SELECT 1 FROM OE_InspectionItems WHERE InspectionId = @inspectionId AND SectionName = @sectionName AND ItemOrder = @itemOrder)
                            UPDATE OE_InspectionItems SET Answer = @answer, Score = @score, Finding = @finding, Priority = @priority WHERE InspectionId = @inspectionId AND SectionName = @sectionName AND ItemOrder = @itemOrder
                        ELSE
                            INSERT INTO OE_InspectionItems (InspectionId, SectionName, ItemOrder, Question, Answer, Score, Finding, Priority) VALUES (@inspectionId, @sectionName, @itemOrder, @question, @answer, @score, @finding, @priority)
                    `);
            }
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating inspection:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get action plan items for an inspection
router.get('/api/action-plan/:inspectionId', async (req, res) => {
    try {
        const { inspectionId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT * FROM OE_InspectionActionItems
                WHERE InspectionId = @inspectionId
                ORDER BY Priority DESC, CreatedAt
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching action plan:', error);
        res.json({ success: false, error: error.message });
    }
});

// Save action plan items
router.post('/api/action-plan', async (req, res) => {
    try {
        const { inspectionId, items } = req.body;
        const pool = await sql.connect(dbConfig);
        
        for (const item of items) {
            if (item.id) {
                // Update existing
                await pool.request()
                    .input('id', sql.Int, item.id)
                    .input('action', sql.NVarChar, item.action)
                    .input('responsible', sql.NVarChar, item.responsible)
                    .input('deadline', sql.Date, item.deadline)
                    .input('status', sql.NVarChar, item.status)
                    .query(`
                        UPDATE OE_InspectionActionItems 
                        SET Action = @action, Responsible = @responsible, Deadline = @deadline, Status = @status, UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);
            } else {
                // Insert new
                await pool.request()
                    .input('inspectionId', sql.Int, inspectionId)
                    .input('finding', sql.NVarChar, item.finding)
                    .input('action', sql.NVarChar, item.action)
                    .input('responsible', sql.NVarChar, item.responsible)
                    .input('deadline', sql.Date, item.deadline)
                    .input('priority', sql.NVarChar, item.priority)
                    .input('status', sql.NVarChar, item.status || 'Open')
                    .query(`
                        INSERT INTO OE_InspectionActionItems (InspectionId, Finding, Action, Responsible, Deadline, Priority, Status, CreatedAt)
                        VALUES (@inspectionId, @finding, @action, @responsible, @deadline, @priority, @status, GETDATE())
                    `);
            }
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving action plan:', error);
        res.json({ success: false, error: error.message });
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
            FROM OE_Inspections
        `);
        await pool.close();
        res.json({ success: true, data: stats.recordset[0] });
    } catch (error) {
        res.json({ success: true, data: { total: 0, drafts: 0, completed: 0, today: 0 } });
    }
});

// ==========================================
// Schema Settings API (for Settings Page)
// ==========================================

// Get all schemas with settings
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
            FROM OE_InspectionTemplates t
            LEFT JOIN OE_InspectionSettings s ON s.SettingKey = 'PASSING_SCORE_' + CAST(t.Id AS VARCHAR)
            WHERE t.IsActive = 1
            ORDER BY t.TemplateName
        `);
        
        // Get sections for each schema
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
                    FROM OE_InspectionTemplateSections ts
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

// Get schema colors
router.get('/api/schema-colors/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('schemaId', sql.Int, req.params.schemaId)
            .query(`
                SELECT SettingKey, SettingValue 
                FROM OE_InspectionSettings 
                WHERE SettingKey LIKE 'COLOR_%_' + CAST(@schemaId AS VARCHAR)
            `);
        await pool.close();
        
        const colors = {
            passColor: '#10b981',
            failColor: '#ef4444',
            headerColor: '#1e3a5f',
            accentColor: '#10b981'
        };
        
        result.recordset.forEach(row => {
            const key = row.SettingKey.replace(/_\d+$/, '').replace('COLOR_', '').toLowerCase() + 'Color';
            if (colors.hasOwnProperty(key)) {
                colors[key] = row.SettingValue;
            }
        });
        
        res.json({ success: true, colors });
    } catch (error) {
        console.error('Error fetching schema colors:', error);
        res.json({ success: true, colors: { passColor: '#10b981', failColor: '#ef4444', headerColor: '#1e3a5f', accentColor: '#10b981' } });
    }
});

// Save schema colors
router.post('/api/schema-colors/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const schemaId = req.params.schemaId;
        const colors = req.body;
        
        for (const [key, value] of Object.entries(colors)) {
            const settingKey = 'COLOR_' + key.replace('Color', '').toUpperCase() + '_' + schemaId;
            await pool.request()
                .input('key', sql.NVarChar, settingKey)
                .input('value', sql.NVarChar, value)
                .query(`
                    IF EXISTS (SELECT 1 FROM OE_InspectionSettings WHERE SettingKey = @key)
                        UPDATE OE_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO OE_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving schema colors:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get schema checklist info
router.get('/api/schema-checklist-info/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('schemaId', sql.Int, req.params.schemaId)
            .query(`
                SELECT SettingKey, SettingValue 
                FROM OE_InspectionSettings 
                WHERE SettingKey LIKE 'CHECKLIST_%_' + CAST(@schemaId AS VARCHAR)
            `);
        await pool.close();
        
        const info = {
            creationDate: '',
            revisionDate: '',
            edition: '',
            reportTitle: 'OE Inspection Report',
            documentPrefix: 'GMRL-OEI'
        };
        
        result.recordset.forEach(row => {
            const key = row.SettingKey.replace(/_\d+$/, '').replace('CHECKLIST_', '');
            const camelKey = key.toLowerCase().replace(/_([a-z])/g, (m, c) => c.toUpperCase());
            if (info.hasOwnProperty(camelKey)) {
                info[camelKey] = row.SettingValue;
            }
        });
        
        res.json({ success: true, info });
    } catch (error) {
        console.error('Error fetching checklist info:', error);
        res.json({ success: true, info: { creationDate: '', revisionDate: '', edition: '', reportTitle: 'OE Inspection Report', documentPrefix: 'GMRL-OEI' } });
    }
});

// Save schema checklist info
router.post('/api/schema-checklist-info/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const schemaId = req.params.schemaId;
        const info = req.body;
        
        for (const [key, value] of Object.entries(info)) {
            const settingKey = 'CHECKLIST_' + key.replace(/([A-Z])/g, '_$1').toUpperCase() + '_' + schemaId;
            await pool.request()
                .input('key', sql.NVarChar, settingKey)
                .input('value', sql.NVarChar, value || '')
                .query(`
                    IF EXISTS (SELECT 1 FROM OE_InspectionSettings WHERE SettingKey = @key)
                        UPDATE OE_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO OE_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving checklist info:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get department names
router.get('/api/schema-department-names/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('schemaId', sql.Int, req.params.schemaId)
            .query(`
                SELECT SettingKey, SettingValue 
                FROM OE_InspectionSettings 
                WHERE SettingKey LIKE 'DEPT_%_' + CAST(@schemaId AS VARCHAR)
            `);
        await pool.close();
        
        const names = {
            Maintenance: 'Maintenance',
            Procurement: 'Procurement',
            Cleaning: 'Cleaning'
        };
        
        result.recordset.forEach(row => {
            const key = row.SettingKey.replace(/_\d+$/, '').replace('DEPT_', '');
            if (names.hasOwnProperty(key)) {
                names[key] = row.SettingValue;
            }
        });
        
        res.json({ success: true, names });
    } catch (error) {
        console.error('Error fetching department names:', error);
        res.json({ success: true, names: { Maintenance: 'Maintenance', Procurement: 'Procurement', Cleaning: 'Cleaning' } });
    }
});

// Save department names
router.post('/api/schema-department-names/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const schemaId = req.params.schemaId;
        const names = req.body;
        
        for (const [key, value] of Object.entries(names)) {
            const settingKey = 'DEPT_' + key + '_' + schemaId;
            await pool.request()
                .input('key', sql.NVarChar, settingKey)
                .input('value', sql.NVarChar, value)
                .query(`
                    IF EXISTS (SELECT 1 FROM OE_InspectionSettings WHERE SettingKey = @key)
                        UPDATE OE_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO OE_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving department names:', error);
        res.json({ success: false, error: error.message });
    }
});

// Save schema settings (grades)
router.post('/api/schema/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const schemaId = req.params.schemaId;
        const { overallPassingGrade, sectionGrades } = req.body;
        
        // Save overall passing grade
        await pool.request()
            .input('key', sql.NVarChar, 'PASSING_SCORE_' + schemaId)
            .input('value', sql.NVarChar, String(overallPassingGrade))
            .query(`
                IF EXISTS (SELECT 1 FROM OE_InspectionSettings WHERE SettingKey = @key)
                    UPDATE OE_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                ELSE
                    INSERT INTO OE_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
            `);
        
        // Save section grades
        if (sectionGrades && Array.isArray(sectionGrades)) {
            for (const sg of sectionGrades) {
                await pool.request()
                    .input('sectionId', sql.Int, sg.sectionId)
                    .input('grade', sql.Int, sg.passingGrade)
                    .query(`
                        UPDATE OE_InspectionTemplateSections 
                        SET PassingGrade = @grade 
                        WHERE Id = @sectionId
                    `);
            }
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving schema settings:', error);
        res.json({ success: false, error: error.message });
    }
});

// Save section icons
router.post('/api/section-icons/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { icons } = req.body;
        
        if (icons && Array.isArray(icons)) {
            for (const icon of icons) {
                await pool.request()
                    .input('sectionId', sql.Int, icon.sectionId)
                    .input('icon', sql.NVarChar, icon.icon)
                    .query(`
                        UPDATE OE_InspectionTemplateSections 
                        SET SectionIcon = @icon 
                        WHERE Id = @sectionId
                    `);
            }
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving section icons:', error);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
