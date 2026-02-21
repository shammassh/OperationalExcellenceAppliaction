/**
 * OE Inspection Module
 * Operational Excellence Inspection App
 * Handles inspections, reports, and action plans
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const sql = require('mssql');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

// Configure multer for verification photo uploads
const verificationUploadDir = path.join(__dirname, '..', '..', 'uploads', 'verification');
if (!fs.existsSync(verificationUploadDir)) {
    fs.mkdirSync(verificationUploadDir, { recursive: true });
}

const verificationStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, verificationUploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'verification-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const verificationUpload = multer({
    storage: verificationStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Configure multer for OE inspection audit photo uploads
const oeAuditUploadDir = path.join(__dirname, '..', '..', 'uploads', 'oe-inspection');
if (!fs.existsSync(oeAuditUploadDir)) {
    fs.mkdirSync(oeAuditUploadDir, { recursive: true });
}

const oeAuditStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, oeAuditUploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'oe-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const oeAuditUpload = multer({
    storage: oeAuditStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Image compression settings
const COMPRESSION_CONFIG = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    pngCompressionLevel: 8
};

// Compress and resize image
async function compressImage(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const tempPath = filePath + '.tmp';
        
        let sharpInstance = sharp(filePath)
            .resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        
        if (ext === '.jpg' || ext === '.jpeg') {
            sharpInstance = sharpInstance.jpeg({ quality: COMPRESSION_CONFIG.quality });
        } else if (ext === '.png') {
            sharpInstance = sharpInstance.png({ compressionLevel: COMPRESSION_CONFIG.pngCompressionLevel });
        } else if (ext === '.webp') {
            sharpInstance = sharpInstance.webp({ quality: COMPRESSION_CONFIG.quality });
        } else if (ext === '.gif') {
            sharpInstance = sharpInstance.gif();
        }
        
        await sharpInstance.toFile(tempPath);
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
        
        return true;
    } catch (err) {
        console.error('Image compression error:', err);
        return false;
    }
}

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

// Middleware to prevent caching on API routes
router.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Middleware to prevent caching on HTML pages
router.use((req, res, next) => {
    if (req.path.endsWith('.html') || !req.path.includes('.') || req.path === '/') {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

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
                <meta charset="UTF-8">
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
                        
                        <a href="/oe-inspection/store-management" class="card">
                            <div class="card-icon">🏪</div>
                            <div class="card-title">Store Management</div>
                            <div class="card-desc">Add, edit, and manage stores. Assign store managers.</div>
                        </a>
                        
                        <a href="/oe-inspection/department-reports" class="card">
                            <div class="card-icon">📋</div>
                            <div class="card-title">Department Reports</div>
                            <div class="card-desc">View reports filtered by department (Maintenance, Procurement, Cleaning).</div>
                        </a>
                        
                        <a href="/oe-inspection/schedule" class="card">
                            <div class="card-icon">📅</div>
                            <div class="card-title">Inspection Schedule</div>
                            <div class="card-desc">Create and manage inspection schedules for inspectors by store and template.</div>
                        </a>
                        
                        <a href="/oe-inspection/implementation-verification" class="card">
                            <div class="card-icon">✅</div>
                            <div class="card-title">Implementation Verification</div>
                            <div class="card-desc">Verify completed action plans submitted by store managers.</div>
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

// Store Management Page
router.get('/store-management', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'pages', 'store-management.html'));
});

// Department Reports Page
router.get('/department-reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'department-reports.html'));
});

// Schedule Page
router.get('/schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'schedule.html'));
});

// Implementation Verification List Page
router.get('/implementation-verification', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'implementation-verification.html'));
});

// Implementation Verification Form Page
router.get('/implementation-verification/:inspectionId', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'verification-form.html'));
});

// ==========================================
// Department Reports API Routes
// ==========================================

// Get department reports list
router.get('/api/department-reports/list/:department', async (req, res) => {
    try {
        const { department } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get all completed inspections with department-specific action items
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
                    (SELECT COUNT(*) FROM OE_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department) as totalItems,
                    (SELECT COUNT(*) FROM OE_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department AND it.Priority = 'High') as highPriority,
                    (SELECT COUNT(*) FROM OE_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department AND it.Priority = 'Medium') as mediumPriority,
                    (SELECT COUNT(*) FROM OE_InspectionItems it 
                     WHERE it.InspectionId = i.Id AND it.Department = @department AND it.Priority = 'Low') as lowPriority
                FROM OE_Inspections i
                WHERE EXISTS (
                    SELECT 1 FROM OE_InspectionItems it 
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

// Get department report details
router.get('/api/department-reports/view/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const department = req.query.department || 'Maintenance';
        const pool = await sql.connect(dbConfig);
        
        // Get audit info
        const auditResult = await pool.request()
            .input('reportId', sql.Int, reportId)
            .query(`SELECT * FROM OE_Inspections WHERE Id = @reportId`);
        
        if (auditResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Get department-specific items
        const itemsResult = await pool.request()
            .input('reportId', sql.Int, reportId)
            .input('department', sql.NVarChar, department)
            .query(`
                SELECT * FROM OE_InspectionItems 
                WHERE InspectionId = @reportId AND Department = @department
                ORDER BY SectionOrder, ItemOrder
            `);
        
        const items = itemsResult.recordset.map(item => ({
            referenceValue: item.ReferenceValue || '',
            section: item.SectionName || '',
            title: item.Question || '',
            finding: item.Finding || '',
            correctiveAction: item.CorrectedAction || '',
            priority: item.Priority || 'Medium',
            pictures: [] // TODO: Add pictures support
        }));
        
        // Calculate priority counts
        const highCount = items.filter(i => i.priority === 'High').length;
        const mediumCount = items.filter(i => i.priority === 'Medium').length;
        const lowCount = items.filter(i => i.priority === 'Low').length;
        
        // Build report data structure matching expected format
        const reportData = {
            department,
            departmentDisplayName: department,
            audit: {
                documentNumber: audit.DocumentNumber || '',
                storeName: audit.StoreName || '',
                storeCode: audit.StoreId || '',
                auditDate: audit.InspectionDate,
                cycle: audit.Cycle || 'C1',
                year: audit.Year || new Date().getFullYear(),
                auditors: audit.Inspectors || ''
            },
            items,
            totalItems: items.length,
            byPriority: {
                high: highCount,
                medium: mediumCount,
                low: lowCount
            },
            generatedAt: new Date().toISOString()
        };
        
        res.json({ success: true, data: { reportData } });
    } catch (error) {
        console.error('Error fetching department report:', error);
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
                ISNULL(u.DisplayName, 'Unknown') as createdBy,
                t.CreatedAt as createdDate,
                (SELECT COUNT(*) FROM OE_InspectionTemplateSections ts WHERE ts.TemplateId = t.Id AND ts.IsActive = 1) as sectionCount
            FROM OE_InspectionTemplates t
            LEFT JOIN Users u ON t.CreatedBy = u.Id
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
                    SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, AnswerOptions as answer, Criteria as cr
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
                SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, Quantity as quantity, AnswerOptions as answer, Criteria as cr,
                       IsQuantitative as isQuantitative, Range1From as range1From, Range1To as range1To, Range2From as range2From, Range2To as range2To, Range3From as range3From
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
        const { referenceValue, title, coeff, quantity, answer, cr, isQuantitative, range1From, range1To, range2From, range2To, range3From } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .input('ref', sql.NVarChar, referenceValue)
            .input('question', sql.NVarChar, title)
            .input('coeff', sql.Decimal(5,2), coeff || 2)
            .input('quantity', sql.Int, quantity || null)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('criteria', sql.NVarChar, cr || '')
            .input('isQuantitative', sql.Bit, isQuantitative ? 1 : 0)
            .input('range1From', sql.Int, range1From || null)
            .input('range1To', sql.Int, range1To || null)
            .input('range2From', sql.Int, range2From || null)
            .input('range2To', sql.Int, range2To || null)
            .input('range3From', sql.Int, range3From || null)
            .query(`
                INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, IsActive, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From)
                OUTPUT INSERTED.Id as itemId
                VALUES (@sectionId, @ref, @question, @coeff, @quantity, @answer, @criteria, 1, @isQuantitative, @range1From, @range1To, @range2From, @range2To, @range3From)
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
                .input('question', sql.NVarChar, item.title)
                .input('coeff', sql.Int, item.coeff || 2)
                .input('quantity', sql.Int, item.quantity || null)
                .input('answer', sql.NVarChar, item.answer || 'Yes,Partially,No,NA')
                .input('criteria', sql.NVarChar, item.cr || '')
                .query(`INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, IsActive) VALUES (@sectionId, @ref, @question, @coeff, @quantity, @answer, @criteria, 1)`);
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
        const { referenceValue, title, coeff, quantity, answer, cr, isQuantitative, range1From, range1To, range2From, range2To, range3From } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.itemId)
            .input('ref', sql.NVarChar, referenceValue)
            .input('question', sql.NVarChar, title)
            .input('coeff', sql.Int, coeff || 2)
            .input('quantity', sql.Int, quantity || null)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('criteria', sql.NVarChar, cr || '')
            .input('isQuantitative', sql.Bit, isQuantitative ? 1 : 0)
            .input('range1From', sql.Int, range1From || null)
            .input('range1To', sql.Int, range1To || null)
            .input('range2From', sql.Int, range2From || null)
            .input('range2To', sql.Int, range2To || null)
            .input('range3From', sql.Int, range3From || null)
            .query(`UPDATE OE_InspectionTemplateItems SET ReferenceValue = @ref, Question = @question, Coefficient = @coeff, Quantity = @quantity, AnswerOptions = @answer, Criteria = @criteria, IsQuantitative = @isQuantitative, Range1From = @range1From, Range1To = @range1To, Range2From = @range2From, Range2To = @range2To, Range3From = @range3From WHERE Id = @id`);
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
                s.BrandId as brandId,
                b.BrandName as brandName,
                b.BrandCode as brandCode,
                s.Location as location,
                s.StoreSize as storeSize,
                s.TemplateId as templateId,
                t.TemplateName as templateName,
                s.IsActive as isActive,
                s.CreatedDate as createdDate
            FROM Stores s
            LEFT JOIN OE_InspectionTemplates t ON s.TemplateId = t.Id
            LEFT JOIN Brands b ON s.BrandId = b.Id
            ORDER BY s.StoreName
        `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.json({ success: false, error: error.message });
    }
});

// Create store
router.post('/api/stores', async (req, res) => {
    try {
        const { storeCode, storeName, brandId, location, storeSize, templateId } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('code', sql.NVarChar, storeCode)
            .input('name', sql.NVarChar, storeName)
            .input('brandId', sql.Int, brandId || null)
            .input('location', sql.NVarChar, location || null)
            .input('storeSize', sql.NVarChar, storeSize || null)
            .input('templateId', sql.Int, templateId || null)
            .input('createdBy', sql.NVarChar, req.currentUser?.email || 'System')
            .query(`
                INSERT INTO Stores (StoreCode, StoreName, BrandId, Location, StoreSize, TemplateId, IsActive, CreatedDate, CreatedBy)
                OUTPUT INSERTED.Id as storeId
                VALUES (@code, @name, @brandId, @location, @storeSize, @templateId, 1, GETDATE(), @createdBy)
            `);
        await pool.close();
        res.json({ success: true, data: { storeId: result.recordset[0].storeId } });
    } catch (error) {
        console.error('Error creating store:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update store
router.put('/api/stores/:storeId', async (req, res) => {
    try {
        const { storeCode, storeName, brandId, location, storeSize, templateId, isActive } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.storeId)
            .input('code', sql.NVarChar, storeCode)
            .input('name', sql.NVarChar, storeName)
            .input('brandId', sql.Int, brandId || null)
            .input('location', sql.NVarChar, location || null)
            .input('storeSize', sql.NVarChar, storeSize || null)
            .input('templateId', sql.Int, templateId || null)
            .input('isActive', sql.Bit, isActive)
            .query(`
                UPDATE Stores 
                SET StoreCode = @code, StoreName = @name, BrandId = @brandId, Location = @location, 
                    StoreSize = @storeSize, TemplateId = @templateId, IsActive = @isActive
                WHERE Id = @id
            `);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating store:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete store
router.delete('/api/stores/:storeId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.storeId)
            .query(`DELETE FROM Stores WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting store:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get available managers (users with Store Manager role)
router.get('/api/stores/available-managers', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                u.Id as userId,
                u.Email as email,
                u.DisplayName as displayName,
                r.RoleName as role
            FROM Users u
            JOIN UserRoles r ON u.RoleId = r.Id
            WHERE u.IsActive = 1 AND u.IsApproved = 1
            AND r.RoleName IN ('Store Manager', 'Duty Manager', 'Area Manager')
            ORDER BY u.DisplayName
        `);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching available managers:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get manager assignments (grouped by store)
router.get('/api/stores/manager-assignments', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                sma.StoreId as storeId,
                sma.UserId as userId,
                sma.IsPrimary as isPrimary,
                u.Email as email,
                u.DisplayName as displayName
            FROM StoreManagerAssignments sma
            JOIN Users u ON sma.UserId = u.Id
            ORDER BY sma.StoreId, sma.IsPrimary DESC
        `);
        await pool.close();
        
        // Group by storeId
        const assignments = {};
        result.recordset.forEach(row => {
            if (!assignments[row.storeId]) {
                assignments[row.storeId] = [];
            }
            assignments[row.storeId].push({
                userId: row.userId,
                email: row.email,
                displayName: row.displayName,
                isPrimary: row.isPrimary
            });
        });
        
        res.json({ success: true, data: assignments });
    } catch (error) {
        console.error('Error fetching manager assignments:', error);
        res.json({ success: false, error: error.message });
    }
});

// Assign managers to store
router.post('/api/stores/:storeId/managers', async (req, res) => {
    try {
        const { userIds } = req.body;
        const storeId = parseInt(req.params.storeId);
        const pool = await sql.connect(dbConfig);
        
        // Remove existing assignments
        await pool.request()
            .input('storeId', sql.Int, storeId)
            .query(`DELETE FROM StoreManagerAssignments WHERE StoreId = @storeId`);
        
        // Add new assignments
        for (let i = 0; i < userIds.length; i++) {
            await pool.request()
                .input('storeId', sql.Int, storeId)
                .input('userId', sql.Int, userIds[i])
                .input('isPrimary', sql.Bit, i === 0) // First one is primary
                .input('assignedBy', sql.Int, req.currentUser?.id || null)
                .query(`
                    INSERT INTO StoreManagerAssignments (StoreId, UserId, IsPrimary, AssignedAt, AssignedBy)
                    VALUES (@storeId, @userId, @isPrimary, GETDATE(), @assignedBy)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error assigning managers:', error);
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

// Get stores list (simple list for dropdowns)
router.get('/api/stores-list', async (req, res) => {
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
        
        // Get max document number - extract number after last hyphen
        const maxResult = await pool.request()
            .input('prefix', sql.NVarChar, prefix + '-%')
            .query(`
                SELECT MAX(CAST(RIGHT(DocumentNumber, 4) AS INT)) as maxNum
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
            .query(`
                INSERT INTO OE_Inspections (DocumentNumber, StoreId, StoreName, InspectionDate, Inspectors, AccompaniedBy, Status, CreatedBy, CreatedAt)
                OUTPUT INSERTED.Id
                VALUES (@documentNumber, @storeId, @storeName, @inspectionDate, @inspectors, @accompaniedBy, 'Draft', @createdBy, GETDATE())
            `);
        
        const inspectionId = result.recordset[0].Id;
        
        // Get template ID (use provided or get default)
        let useTemplateId = templateId;
        if (!useTemplateId) {
            const defaultTemplate = await pool.request().query(`
                SELECT TOP 1 Id FROM OE_InspectionTemplates WHERE IsDefault = 1 AND IsActive = 1
            `);
            useTemplateId = defaultTemplate.recordset[0]?.Id;
        }
        
        if (useTemplateId) {
            // Copy sections from template
            const templateSections = await pool.request()
                .input('templateId', sql.Int, useTemplateId)
                .query(`
                    SELECT Id, SectionName, SectionIcon, SectionOrder, PassingGrade
                    FROM OE_InspectionTemplateSections
                    WHERE TemplateId = @templateId AND IsActive = 1
                    ORDER BY SectionOrder
                `);
            
            for (const section of templateSections.recordset) {
                // Insert section
                const sectionResult = await pool.request()
                    .input('inspectionId', sql.Int, inspectionId)
                    .input('sectionName', sql.NVarChar, section.SectionName)
                    .input('sectionIcon', sql.NVarChar, section.SectionIcon)
                    .input('sectionOrder', sql.Int, section.SectionOrder)
                    .query(`
                        INSERT INTO OE_InspectionSections (InspectionId, SectionName, SectionIcon, SectionOrder)
                        OUTPUT INSERTED.Id
                        VALUES (@inspectionId, @sectionName, @sectionIcon, @sectionOrder)
                    `);
                
                // Copy items for this section
                const templateItems = await pool.request()
                    .input('sectionId', sql.Int, section.Id)
                    .query(`
                        SELECT ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, ItemOrder, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From
                        FROM OE_InspectionTemplateItems
                        WHERE SectionId = @sectionId AND IsActive = 1
                        ORDER BY ItemOrder
                    `);
                
                for (const item of templateItems.recordset) {
                    await pool.request()
                        .input('inspectionId', sql.Int, inspectionId)
                        .input('sectionName', sql.NVarChar, section.SectionName)
                        .input('sectionOrder', sql.Int, section.SectionOrder)
                        .input('itemOrder', sql.Int, item.ItemOrder)
                        .input('referenceValue', sql.NVarChar, item.ReferenceValue)
                        .input('question', sql.NVarChar, item.Question)
                        .input('coefficient', sql.Decimal(5,2), item.Coefficient || 1)
                        .input('quantity', sql.Int, item.Quantity || null)
                        .input('answerOptions', sql.NVarChar, item.AnswerOptions || 'Yes,Partially,No,NA')
                        .input('criteria', sql.NVarChar, item.Criteria)
                        .input('isQuantitative', sql.Bit, item.IsQuantitative || 0)
                        .input('range1From', sql.Int, item.Range1From || null)
                        .input('range1To', sql.Int, item.Range1To || null)
                        .input('range2From', sql.Int, item.Range2From || null)
                        .input('range2To', sql.Int, item.Range2To || null)
                        .input('range3From', sql.Int, item.Range3From || null)
                        .query(`
                            INSERT INTO OE_InspectionItems 
                                (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From)
                            VALUES 
                                (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @quantity, @answerOptions, @criteria, @isQuantitative, @range1From, @range1To, @range2From, @range2To, @range3From)
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

// Get action plan items for an inspection (with verification status)
router.get('/api/action-plan/:inspectionId', async (req, res) => {
    try {
        const { inspectionId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT ai.*, 
                    v.Id as VerificationId,
                    v.VerificationStatus,
                    v.VerificationNotes,
                    v.VerificationPictureUrl,
                    v.VerifiedAt,
                    u.DisplayName as VerifiedByName
                FROM OE_InspectionActionItems ai
                LEFT JOIN OE_ActionItemVerification v ON v.ActionItemId = ai.Id
                LEFT JOIN Users u ON v.VerifiedBy = u.Id
                WHERE ai.InspectionId = @inspectionId
                ORDER BY ai.Priority DESC, ai.CreatedAt
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
// Audit API Routes (for audit-list.html compatibility)
// ==========================================

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
                ISNULL(s.SettingValue, '83') as PassingGrade
            FROM OE_Inspections i
            LEFT JOIN Users u ON i.CreatedBy = u.Id
            LEFT JOIN OE_InspectionTemplates t ON t.IsDefault = 1 AND t.IsActive = 1
            LEFT JOIN OE_InspectionSettings s ON s.SettingKey = 'PASSING_SCORE'
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
        
        // Get audit details
        const auditResult = await pool.request()
            .input('id', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, i.StoreName, i.InspectionDate,
                    i.TimeIn, i.TimeOut, i.Inspectors, i.AccompaniedBy, i.Cycle, i.Year,
                    i.Status, i.Score, i.TotalPoints, i.MaxPoints, i.Comments,
                    i.CreatedBy, i.CreatedAt, i.UpdatedAt, i.CompletedAt, i.ApprovedBy, i.ApprovedAt,
                    COALESCE(i.TemplateId, t.Id) as TemplateId,
                    t.TemplateName
                FROM OE_Inspections i
                LEFT JOIN OE_InspectionTemplates t ON t.IsDefault = 1 AND t.IsActive = 1
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
                FROM OE_InspectionSections s
                WHERE s.InspectionId = @inspectionId
                ORDER BY s.SectionOrder
            `);
        
        // If no sections exist, populate from template
        const templateId = audit.TemplateId ? parseInt(audit.TemplateId) : null;
        if (sectionsResult.recordset.length === 0 && templateId) {
            // Get template sections
            const templateSections = await pool.request()
                .input('templateId', sql.Int, templateId)
                .query(`
                    SELECT Id, SectionName, SectionIcon, SectionOrder, PassingGrade
                    FROM OE_InspectionTemplateSections
                    WHERE TemplateId = @templateId AND IsActive = 1
                    ORDER BY SectionOrder
                `);
            
            for (const section of templateSections.recordset) {
                // Insert section
                await pool.request()
                    .input('inspectionId', sql.Int, auditId)
                    .input('sectionName', sql.NVarChar, section.SectionName)
                    .input('sectionIcon', sql.NVarChar, section.SectionIcon)
                    .input('sectionOrder', sql.Int, section.SectionOrder)
                    .query(`
                        INSERT INTO OE_InspectionSections (InspectionId, SectionName, SectionIcon, SectionOrder)
                        VALUES (@inspectionId, @sectionName, @sectionIcon, @sectionOrder)
                    `);
                
                // Copy items for this section
                const templateItems = await pool.request()
                    .input('sectionId', sql.Int, section.Id)
                    .query(`
                        SELECT ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, ItemOrder, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From
                        FROM OE_InspectionTemplateItems
                        WHERE SectionId = @sectionId AND IsActive = 1
                        ORDER BY ItemOrder
                    `);
                
                for (const item of templateItems.recordset) {
                    await pool.request()
                        .input('inspectionId', sql.Int, auditId)
                        .input('sectionName', sql.NVarChar, section.SectionName)
                        .input('sectionOrder', sql.Int, section.SectionOrder)
                        .input('itemOrder', sql.Int, item.ItemOrder)
                        .input('referenceValue', sql.NVarChar, item.ReferenceValue)
                        .input('question', sql.NVarChar, item.Question)
                        .input('coefficient', sql.Decimal(5,2), item.Coefficient || 1)
                        .input('quantity', sql.Int, item.Quantity || null)
                        .input('answerOptions', sql.NVarChar, item.AnswerOptions || 'Yes,Partially,No,NA')
                        .input('criteria', sql.NVarChar, item.Criteria)
                        .input('isQuantitative', sql.Bit, item.IsQuantitative || 0)
                        .input('range1From', sql.Int, item.Range1From || null)
                        .input('range1To', sql.Int, item.Range1To || null)
                        .input('range2From', sql.Int, item.Range2From || null)
                        .input('range2To', sql.Int, item.Range2To || null)
                        .input('range3From', sql.Int, item.Range3From || null)
                        .query(`
                            INSERT INTO OE_InspectionItems 
                                (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From)
                            VALUES 
                                (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @quantity, @answerOptions, @criteria, @isQuantitative, @range1From, @range1To, @range2From, @range2To, @range3From)
                        `);
                }
            }
            
            // Re-fetch sections
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
                    FROM OE_InspectionSections s
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
                        Quantity as quantity,
                        ActualQuantity as actualQuantity,
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
                        Criteria as criteria,
                        IsQuantitative as isQuantitative,
                        Range1From as range1From,
                        Range1To as range1To,
                        Range2From as range2From,
                        Range2To as range2To,
                        Range3From as range3From
                    FROM OE_InspectionItems
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
        
        // Delete related records first
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OE_FridgeReadings WHERE InspectionId = @id`);
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OE_InspectionActionItems WHERE InspectionId = @id`);
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OE_InspectionItems WHERE InspectionId = @id`);
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OE_InspectionSections WHERE InspectionId = @id`);
        
        // Finally delete the audit itself
        const result = await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OE_Inspections WHERE Id = @id; SELECT @@ROWCOUNT as deleted`);
        
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

// Get published report for an audit
router.get('/api/audits/:auditId/published-report', async (req, res) => {
    try {
        const { auditId } = req.params;
        const fs = require('fs');
        const reportsDir = path.join(__dirname, '..', '..', 'reports', 'oe-inspection');
        
        // Look for existing report files for this audit
        if (fs.existsSync(reportsDir)) {
            const files = fs.readdirSync(reportsDir);
            const reportFile = files.find(f => f.includes(`audit-${auditId}`) && f.endsWith('.html'));
            if (reportFile) {
                return res.json({ success: true, fileName: reportFile });
            }
        }
        
        res.json({ success: false, message: 'No published report found' });
    } catch (error) {
        console.error('Error fetching published report:', error);
        res.json({ success: false, error: error.message });
    }
});

// Serve report files
router.get('/api/audits/reports/:fileName', (req, res) => {
    const { fileName } = req.params;
    const reportsDir = path.join(__dirname, '..', '..', 'reports', 'oe-inspection');
    const filePath = path.join(reportsDir, fileName);
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(reportsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Report not found' });
    }
});

// Generate report for an audit
router.post('/api/audits/:auditId/generate-report', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // 1. Get audit header
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT i.*, t.TemplateName, t.Description as TemplateDescription
                FROM OE_Inspections i
                LEFT JOIN OE_InspectionTemplates t ON i.TemplateId = t.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        const audit = auditResult.recordset[0];
        
        // 2. Get all items for this audit
        const itemsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT * FROM OE_InspectionItems
                WHERE InspectionId = @auditId
                ORDER BY SectionOrder, ItemOrder
            `);
        
        // 3. Group items by section and calculate scores
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
            
            // Calculate scores
            if (item.Answer && item.Answer !== 'NA') {
                section.maxScore += parseFloat(item.Coefficient || 0);
                section.earnedScore += parseFloat(item.Score || 0);
            }
        }
        
        const sections = Array.from(sectionMap.values()).sort((a, b) => a.SectionOrder - b.SectionOrder);
        
        // 4. Get findings (non-compliant items)
        const findings = itemsResult.recordset.filter(item => 
            item.Answer === 'No' || item.Answer === 'Partially' || item.Finding
        );
        
        // 5. Get fridge readings if any
        const fridgeResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT * FROM OE_FridgeReadings 
                WHERE InspectionId = @auditId
                ORDER BY Id
            `);
        
        // Calculate overall score
        const totalEarned = sections.reduce((sum, s) => sum + s.earnedScore, 0);
        const totalMax = sections.reduce((sum, s) => sum + s.maxScore, 0);
        const overallScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
        
        // Get settings for threshold
        const settingsResult = await pool.request().query(`SELECT TOP 1 * FROM OE_InspectionSettings`);
        const threshold = settingsResult.recordset[0]?.PassingGrade || 83;
        
        // 6. Get pictures for all items
        const picturesResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT p.Id, p.ItemId, p.FileName, p.ContentType, p.PictureType, p.FilePath, p.OriginalName, p.FileSize
                FROM OE_InspectionPictures p
                INNER JOIN OE_InspectionItems i ON p.ItemId = i.Id
                WHERE i.InspectionId = @auditId
                ORDER BY p.ItemId, p.Id
            `);
        
        // Group pictures by ItemId
        const picturesByItem = {};
        for (const pic of picturesResult.recordset) {
            if (!picturesByItem[pic.ItemId]) {
                picturesByItem[pic.ItemId] = [];
            }
            picturesByItem[pic.ItemId].push({
                id: pic.Id,
                fileName: pic.OriginalName || pic.FileName,
                contentType: pic.ContentType,
                pictureType: pic.PictureType || 'issue',
                dataUrl: pic.FilePath // FilePath contains the URL like /uploads/oe-inspection/...
            });
        }
        
        // Build report data
        const reportData = {
            audit,
            sections: sections.map(s => ({
                ...s,
                Percentage: s.maxScore > 0 ? Math.round((s.earnedScore / s.maxScore) * 100) : 0
            })),
            findings,
            pictures: picturesByItem,
            fridgeReadings: fridgeResult.recordset,
            overallScore,
            threshold,
            generatedAt: new Date().toISOString()
        };
        
        // Generate HTML report
        const html = generateReportHTML(reportData);
        
        // Save report to file
        const reportsDir = path.join(__dirname, '..', '..', 'reports', 'oe-inspection');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const fileName = `OE_Report_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        const filePath = path.join(reportsDir, fileName);
        fs.writeFileSync(filePath, html, 'utf8');
        
        // Update audit with report info
        await pool.request()
            .input('auditId', sql.Int, auditId)
            .input('fileName', sql.NVarChar, fileName)
            .query(`UPDATE OE_Inspections SET ReportFileName = @fileName, ReportGeneratedAt = GETDATE() WHERE Id = @auditId`);
        
        console.log(`✅ Report generated: ${fileName}`);
        res.json({ success: true, fileName, overallScore });
        
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to generate HTML report
function generateReportHTML(data) {
    const { audit, sections, findings, pictures, fridgeReadings, overallScore, threshold, generatedAt } = data;
    const passedClass = overallScore >= threshold ? 'pass' : 'fail';
    const passedText = overallScore >= threshold ? 'PASS ✅' : 'FAIL ❌';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OE Inspection Report - ${audit.DocumentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
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
        .section-header { background: #f8fafc; padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
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
        .finding-ref { font-weight: 600; color: #1e40af; }
        .finding-question { margin: 5px 0; }
        .finding-pictures { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        .picture-group { margin-bottom: 8px; }
        .pictures-wrapper { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
        .finding-detail { color: #64748b; font-size: 14px; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        .action-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 1000; }
        .action-bar button { padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s; }
        .action-bar button:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .btn-email { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; }
        .btn-print { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; }
        .btn-back { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; }
        @media print { body { background: white; } .container { max-width: 100%; padding: 0; } .action-bar { display: none !important; } }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn-back" onclick="goBack()">← Back</button>
        <button class="btn-email" onclick="openEmailModal('full')">📧 Send Report</button>
        <button class="btn-print" onclick="window.print()">🖨️ Print</button>
    </div>
    <script>
        function goBack() {
            if (document.referrer && document.referrer.includes(window.location.hostname)) {
                history.back();
            } else {
                window.location.href = '/oe-inspection/reports';
            }
        }
    </script>
    <div class="container">
        <div class="header">
            <h1>📋 OE Inspection Report</h1>
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
            ${findings.map(f => {
                const itemPics = pictures[f.Id] || [];
                
                return `
            <div class="finding-item">
                <div class="finding-ref">[${f.ReferenceValue || 'N/A'}] ${f.SectionName}</div>
                <div class="finding-question">${f.Question}</div>
                <div class="finding-detail">Answer: ${f.Answer} | Finding: ${f.Finding || 'N/A'}</div>
                ${itemPics.length > 0 ? `
                <div class="finding-pictures">
                    <strong>Photos (${itemPics.length}):</strong>
                    <div class="pictures-wrapper">
                        ${itemPics.map(p => `<img src="${p.dataUrl}" alt="${p.fileName || p.pictureType || 'Photo'}" title="${p.pictureType || 'Photo'}" style="max-width:120px;max-height:90px;margin:4px;border-radius:4px;cursor:pointer;border:2px solid ${p.pictureType === 'Good' || p.pictureType === 'corrective' ? '#10b981' : '#ef4444'};" onclick="window.open(this.src,'_blank')">`).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            `}).join('')}
        </div>
        ` : ''}
        
        ${fridgeReadings.length > 0 ? `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title">🌡️ Fridge Temperature Readings</div>
            </div>
            <table>
                <thead>
                    <tr><th>Unit</th><th>Display (°C)</th><th>Probe (°C)</th><th>Status</th><th>Issue</th></tr>
                </thead>
                <tbody>
                    ${fridgeReadings.map(r => `
                    <tr>
                        <td>${r.UnitName || 'N/A'}</td>
                        <td>${r.DisplayTemp ?? 'N/A'}</td>
                        <td>${r.ProbeTemp ?? 'N/A'}</td>
                        <td>${r.IsCompliant ? '✅ OK' : '❌ Issue'}</td>
                        <td>${r.Issue || '-'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div class="footer">
            Report generated on ${new Date(generatedAt).toLocaleString()}
        </div>
    </div>
    <script>
        const auditId = ${audit.Id};
        
        async function openEmailModal(reportType) {
            try {
                const btn = document.querySelector('.btn-email');
                const originalText = btn.innerHTML;
                btn.innerHTML = '⏳ Loading...';
                btn.disabled = true;
                
                const recipientsRes = await fetch('/oe-inspection/api/audits/' + auditId + '/email-recipients?reportType=' + reportType);
                const recipientsData = await recipientsRes.json();
                
                if (!recipientsData.success) {
                    throw new Error(recipientsData.error || 'Failed to load recipients');
                }
                
                const previewRes = await fetch('/oe-inspection/api/audits/' + auditId + '/email-preview?reportType=' + reportType);
                const previewData = await previewRes.json();
                
                if (!previewData.success) {
                    throw new Error(previewData.error || 'Failed to generate preview');
                }
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                EmailModal.show({
                    module: 'OE',
                    from: recipientsData.from,
                    to: recipientsData.to,
                    ccSuggestions: recipientsData.ccSuggestions,
                    subject: previewData.subject,
                    bodyHtml: previewData.bodyHtml,
                    reportType: reportType,
                    auditId: auditId,
                    sendUrl: '/oe-inspection/api/audits/' + auditId + '/send-report-email',
                    searchEndpoint: '/operational-excellence/api/users'
                });
            } catch (error) {
                console.error('Error:', error);
                alert('Error preparing email: ' + error.message);
                const btn = document.querySelector('.btn-email');
                if (btn) { btn.innerHTML = '📧 Send Report'; btn.disabled = false; }
            }
        }
    </script>
    <script src="/js/email-modal.js"></script>
</body>
</html>`;
}

// Get department report
router.get('/api/audits/:auditId/department-report/:department', async (req, res) => {
    try {
        const { auditId, department } = req.params;
        
        const pool = await sql.connect(dbConfig);
        
        // Get audit info
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT i.*, s.StoreName 
                FROM OE_Inspections i
                LEFT JOIN Stores s ON i.StoreId = s.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Get items for this department with escalate flag
        const itemsResult = await pool.request()
            .input('inspectionId', sql.Int, auditId)
            .input('department', sql.NVarChar, department)
            .query(`
                SELECT Id, SectionName, ReferenceValue, Question, Answer, Score, 
                       Finding, Comment, CorrectedAction, Priority, Escalate, Department,
                       HasPicture, PictureUrl
                FROM OE_InspectionItems 
                WHERE InspectionId = @inspectionId 
                  AND Department = @department
                  AND Escalate = 1
                ORDER BY SectionOrder, ItemOrder
            `);
        
        // Build items array (pictures stored as URLs, not separate table)
        const items = itemsResult.recordset.map(item => ({
            id: item.Id,
            section: item.SectionName,
            referenceValue: item.ReferenceValue || '-',
            title: item.Question,
            answer: item.Answer,
            finding: item.Finding,
            correctiveAction: item.CorrectedAction,
            priority: item.Priority || 'Medium',
            // PictureUrl may contain comma-separated URLs or JSON array
            pictures: item.PictureUrl ? [{
                fileName: 'picture',
                contentType: 'image/jpeg',
                pictureType: 'finding',
                url: item.PictureUrl
            }] : [],
            goodPictures: [],
            correctivePictures: []
        }));
        
        await pool.close();
        
        // Calculate statistics
        const byPriority = {
            high: items.filter(i => i.priority === 'High').length,
            medium: items.filter(i => i.priority === 'Medium').length,
            low: items.filter(i => i.priority === 'Low').length
        };
        
        const departmentDisplayNames = {
            'Maintenance': 'Maintenance',
            'Procurement': 'Procurement',
            'Cleaning': 'Cleaning'
        };
        
        res.json({
            success: true,
            data: {
                department: department,
                departmentDisplayName: departmentDisplayNames[department] || department,
                audit: {
                    id: audit.Id,
                    documentNumber: audit.DocumentNumber,
                    storeName: audit.StoreName,
                    auditDate: audit.InspectionDate,
                    cycle: audit.Cycle,
                    year: audit.Year,
                    auditors: audit.Auditors
                },
                items: items,
                totalItems: items.length,
                byPriority: byPriority
            }
        });
    } catch (error) {
        console.error('Error generating department report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update audit response item
router.put('/api/audits/response/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const { selectedChoice, coeff, finding, comment, cr, priority, escalate, department, quantity, actualQuantity } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        // First get current values to preserve unset fields
        const currentResult = await pool.request()
            .input('id', sql.Int, responseId)
            .query(`SELECT Answer, Score, Finding, Comment, CorrectedAction, Priority, Escalate, Department, Quantity, ActualQuantity FROM OE_InspectionItems WHERE Id = @id`);
        
        const current = currentResult.recordset[0] || {};
        
        // Calculate value based on choice
        let value = 0;
        const choice = selectedChoice !== undefined ? selectedChoice : current.Answer;
        const coefficient = coeff !== undefined ? coeff : 1;
        if (choice === 'Yes') value = coefficient;
        else if (choice === 'Partially') value = coefficient * 0.5;
        else if (choice === 'No' || choice === 'NA') value = 0;
        
        // Use provided values or keep existing
        const finalEscalate = escalate !== undefined ? (escalate ? 1 : 0) : current.Escalate;
        const finalDepartment = department !== undefined ? (department || null) : current.Department;
        const finalFinding = finding !== undefined ? (finding || null) : current.Finding;
        const finalComment = comment !== undefined ? (comment || null) : current.Comment;
        const finalCr = cr !== undefined ? (cr || null) : current.CorrectedAction;
        const finalPriority = priority !== undefined ? (priority || null) : current.Priority;
        const finalQuantity = quantity !== undefined ? (quantity || null) : current.Quantity;
        const finalActualQuantity = actualQuantity !== undefined ? (actualQuantity || null) : current.ActualQuantity;
        
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
            .input('quantity', sql.Int, finalQuantity)
            .input('actualQuantity', sql.Int, finalActualQuantity)
            .query(`
                UPDATE OE_InspectionItems 
                SET Answer = @selectedChoice,
                    Score = @value,
                    Finding = @finding,
                    Comment = @comment,
                    CorrectedAction = @cr,
                    Priority = @priority,
                    Escalate = @escalate,
                    Department = @department,
                    Quantity = @quantity,
                    ActualQuantity = @actualQuantity
                WHERE Id = @id
            `);
        
        await pool.close();
        res.json({ success: true, data: { score: value } });
    } catch (error) {
        console.error('Error updating response:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload picture for audit item (file storage with compression)
router.post('/api/audits/pictures', oeAuditUpload.single('picture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const { responseId, auditId, pictureType } = req.body;
        
        // Compress the uploaded image
        const fullPath = path.join(oeAuditUploadDir, req.file.filename);
        await compressImage(fullPath);
        
        // Get compressed file size
        const stats = fs.statSync(fullPath);
        const filePath = '/uploads/oe-inspection/' + req.file.filename;
        
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('responseId', sql.Int, responseId)
            .input('auditId', sql.Int, auditId)
            .input('fileName', sql.NVarChar, req.file.filename)
            .input('originalName', sql.NVarChar, req.file.originalname)
            .input('contentType', sql.NVarChar, req.file.mimetype)
            .input('pictureType', sql.NVarChar, pictureType)
            .input('filePath', sql.NVarChar, filePath)
            .input('fileSize', sql.Int, stats.size)
            .query(`
                INSERT INTO OE_InspectionPictures (ItemId, InspectionId, FileName, OriginalName, ContentType, PictureType, FilePath, FileSize, CreatedAt)
                OUTPUT INSERTED.Id as pictureId
                VALUES (@responseId, @auditId, @fileName, @originalName, @contentType, @pictureType, @filePath, @fileSize, GETDATE())
            `);
        
        // Update the item to mark it has picture
        await pool.request()
            .input('id', sql.Int, responseId)
            .query(`UPDATE OE_InspectionItems SET HasPicture = 1 WHERE Id = @id`);
        
        await pool.close();
        res.json({ success: true, data: { pictureId: result.recordset[0].pictureId, filePath: filePath } });
    } catch (error) {
        console.error('Error uploading picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pictures for a response (returns file URLs, not base64)
router.get('/api/audits/pictures/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('responseId', sql.Int, responseId)
            .query(`
                SELECT Id as pictureId, FileName as fileName, OriginalName as originalName,
                       ContentType as contentType, PictureType as pictureType, FilePath as filePath
                FROM OE_InspectionPictures
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

// Delete a picture (also deletes file from disk)
router.delete('/api/audits/pictures/:pictureId', async (req, res) => {
    try {
        const { pictureId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get file path before deleting record
        const fileResult = await pool.request()
            .input('id', sql.Int, pictureId)
            .query(`SELECT FilePath FROM OE_InspectionPictures WHERE Id = @id`);
        
        if (fileResult.recordset.length > 0 && fileResult.recordset[0].FilePath) {
            const diskPath = path.join(__dirname, '..', '..', fileResult.recordset[0].FilePath);
            if (fs.existsSync(diskPath)) {
                fs.unlinkSync(diskPath);
            }
        }
        
        await pool.request()
            .input('id', sql.Int, pictureId)
            .query(`DELETE FROM OE_InspectionPictures WHERE Id = @id`);
        
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
        
        // Calculate total score
        const scoreResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    ISNULL(SUM(Score), 0) as totalPoints,
                    ISNULL(SUM(Coefficient), 0) as maxPoints
                FROM OE_InspectionItems
                WHERE InspectionId = @auditId AND Answer IS NOT NULL AND Answer != 'NA'
            `);
        
        const { totalPoints, maxPoints } = scoreResult.recordset[0];
        const totalScore = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
        
        // Update audit status
        await pool.request()
            .input('auditId', sql.Int, auditId)
            .input('score', sql.Decimal(5,2), totalScore)
            .input('totalPoints', sql.Decimal(10,2), totalPoints)
            .input('maxPoints', sql.Decimal(10,2), maxPoints)
            .query(`
                UPDATE OE_Inspections 
                SET Status = 'Completed', 
                    Score = @score,
                    TotalPoints = @totalPoints,
                    MaxPoints = @maxPoints,
                    CompletedAt = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE Id = @auditId
            `);
        
        // Generate action items from findings
        const findingsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    InspectionId,
                    ReferenceValue,
                    SectionName,
                    Finding,
                    CorrectedAction as SuggestedAction,
                    Priority,
                    Department
                FROM OE_InspectionItems
                WHERE InspectionId = @auditId
                  AND ((Finding IS NOT NULL AND Finding != '') OR Escalate = 1)
            `);
        
        let actionItemsCreated = 0;
        for (const finding of findingsResult.recordset) {
            // Check if action item already exists
            const existingCheck = await pool.request()
                .input('inspectionId', sql.Int, auditId)
                .input('referenceValue', sql.NVarChar, finding.ReferenceValue)
                .input('sectionName', sql.NVarChar, finding.SectionName)
                .query(`
                    SELECT Id FROM OE_InspectionActionItems 
                    WHERE InspectionId = @inspectionId 
                      AND ReferenceValue = @referenceValue 
                      AND SectionName = @sectionName
                `);
            
            if (existingCheck.recordset.length === 0) {
                await pool.request()
                    .input('inspectionId', sql.Int, auditId)
                    .input('referenceValue', sql.NVarChar, finding.ReferenceValue)
                    .input('sectionName', sql.NVarChar, finding.SectionName)
                    .input('finding', sql.NVarChar, finding.Finding)
                    .input('suggestedAction', sql.NVarChar, finding.SuggestedAction)
                    .input('priority', sql.NVarChar, finding.Priority || 'Medium')
                    .input('department', sql.NVarChar, finding.Department)
                    .query(`
                        INSERT INTO OE_InspectionActionItems 
                        (InspectionId, ReferenceValue, SectionName, Finding, SuggestedAction, Priority, Status, Department, CreatedAt)
                        VALUES (@inspectionId, @referenceValue, @sectionName, @finding, @suggestedAction, @priority, 'Open', @department, GETDATE())
                    `);
                actionItemsCreated++;
            }
        }
        
        // If action items were created, set the ActionPlanDeadline based on escalation settings
        if (actionItemsCreated > 0) {
            try {
                const settingsResult = await pool.request()
                    .query("SELECT SettingValue FROM OE_EscalationSettings WHERE SettingKey = 'DeadlineDays'");
                const deadlineDays = settingsResult.recordset.length > 0 ? parseInt(settingsResult.recordset[0].SettingValue) || 7 : 7;
                
                await pool.request()
                    .input('auditId', sql.Int, auditId)
                    .input('days', sql.Int, deadlineDays)
                    .query(`
                        UPDATE OE_Inspections 
                        SET ActionPlanDeadline = DATEADD(DAY, @days, GETDATE())
                        WHERE Id = @auditId
                    `);
            } catch (err) {
                console.error('Error setting action plan deadline:', err);
                // Non-critical, continue
            }
        }
        
        await pool.close();
        res.json({ success: true, data: { totalScore, actionItemsCreated } });
    } catch (error) {
        console.error('Error completing audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save fridge readings
router.post('/api/audits/:auditId/fridge-readings', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { documentNumber, goodReadings, badReadings, enabledSections } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        // Delete existing readings
        await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`DELETE FROM OE_FridgeReadings WHERE InspectionId = @auditId`);
        
        // Insert good readings
        for (const reading of (goodReadings || [])) {
            await pool.request()
                .input('auditId', sql.Int, auditId)
                .input('documentNumber', sql.NVarChar, documentNumber)
                .input('readingType', sql.NVarChar, 'Good')
                .input('unitTemp', sql.NVarChar, reading.unit || null)
                .input('displayTemp', sql.NVarChar, reading.display || null)
                .input('probeTemp', sql.NVarChar, reading.probe || null)
                .input('sectionName', sql.NVarChar, reading.sectionName || null)
                .query(`
                    INSERT INTO OE_FridgeReadings (InspectionId, DocumentNumber, ReadingType, UnitTemp, DisplayTemp, ProbeTemp, SectionName, CreatedAt)
                    VALUES (@auditId, @documentNumber, @readingType, @unitTemp, @displayTemp, @probeTemp, @sectionName, GETDATE())
                `);
        }
        
        // Insert bad readings
        for (const reading of (badReadings || [])) {
            await pool.request()
                .input('auditId', sql.Int, auditId)
                .input('documentNumber', sql.NVarChar, documentNumber)
                .input('readingType', sql.NVarChar, 'Bad')
                .input('unitTemp', sql.NVarChar, reading.unit || null)
                .input('displayTemp', sql.NVarChar, reading.display || null)
                .input('probeTemp', sql.NVarChar, reading.probe || null)
                .input('issue', sql.NVarChar, reading.issue || null)
                .input('sectionName', sql.NVarChar, reading.sectionName || null)
                .query(`
                    INSERT INTO OE_FridgeReadings (InspectionId, DocumentNumber, ReadingType, UnitTemp, DisplayTemp, ProbeTemp, Issue, SectionName, CreatedAt)
                    VALUES (@auditId, @documentNumber, @readingType, @unitTemp, @displayTemp, @probeTemp, @issue, @sectionName, GETDATE())
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving fridge readings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get fridge readings
router.get('/api/audits/:auditId/fridge-readings', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT Id, FridgeNumber, UnitTemp as unit, DisplayTemp as display, 
                       ProbeTemp as probe, Issue as issue, IsCompliant
                FROM OE_FridgeReadings
                WHERE InspectionId = @auditId
                ORDER BY CreatedAt
            `);
        
        await pool.close();
        
        const goodReadings = result.recordset.filter(r => r.IsCompliant === true || r.IsCompliant === 1);
        const badReadings = result.recordset.filter(r => r.IsCompliant === false || r.IsCompliant === 0);
        
        res.json({ success: true, data: { goodReadings, badReadings, enabledSections: {} } });
    } catch (error) {
        console.error('Error fetching fridge readings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get action plan for a document (with verification status)
router.get('/api/action-plan/by-doc/:documentNumber', async (req, res) => {
    try {
        const { documentNumber } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .query(`
                SELECT 
                    a.Id, a.ReferenceValue, a.SectionName, a.Finding, 
                    a.SuggestedAction, a.Action as ActionTaken, a.Responsible as PersonInCharge, 
                    a.Deadline, a.Priority, a.Status, a.Department,
                    v.VerificationStatus, v.VerificationNotes, v.VerificationPictureUrl, v.VerifiedAt,
                    u.DisplayName as VerifiedByName
                FROM OE_InspectionActionItems a
                INNER JOIN OE_Inspections i ON a.InspectionId = i.Id
                LEFT JOIN OE_ActionItemVerification v ON v.ActionItemId = a.Id
                LEFT JOIN Users u ON v.VerifiedBy = u.Id
                WHERE i.DocumentNumber = @documentNumber
                ORDER BY a.Priority DESC, a.ReferenceValue
            `);
        
        await pool.close();
        res.json({ success: true, actions: result.recordset });
    } catch (error) {
        console.error('Error fetching action plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save action plan
router.post('/api/action-plan/save', async (req, res) => {
    try {
        const { documentNumber, actions, updatedBy } = req.body;
        const pool = await sql.connect(dbConfig);
        
        // Get the inspection ID
        const inspResult = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .query(`SELECT Id FROM OE_Inspections WHERE DocumentNumber = @documentNumber`);
        
        if (inspResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ success: false, error: 'Inspection not found' });
        }
        
        const inspectionId = inspResult.recordset[0].Id;
        
        for (const action of (actions || [])) {
            // Check if action exists
            const existingResult = await pool.request()
                .input('inspectionId', sql.Int, inspectionId)
                .input('referenceValue', sql.NVarChar, action.referenceValue)
                .query(`
                    SELECT Id FROM OE_InspectionActionItems 
                    WHERE InspectionId = @inspectionId AND ReferenceValue = @referenceValue
                `);
            
            if (existingResult.recordset.length > 0) {
                // Update existing
                await pool.request()
                    .input('id', sql.Int, existingResult.recordset[0].Id)
                    .input('action', sql.NVarChar, action.actionTaken || action.action || null)
                    .input('responsible', sql.NVarChar, action.personInCharge || null)
                    .input('deadline', sql.Date, action.deadline || null)
                    .input('status', sql.NVarChar, action.status || 'Open')
                    .query(`
                        UPDATE OE_InspectionActionItems 
                        SET Action = @action, Responsible = @responsible, 
                            Deadline = @deadline, Status = @status, UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);
            } else {
                // Insert new
                await pool.request()
                    .input('inspectionId', sql.Int, inspectionId)
                    .input('referenceValue', sql.NVarChar, action.referenceValue)
                    .input('sectionName', sql.NVarChar, action.section || null)
                    .input('finding', sql.NVarChar, action.finding || null)
                    .input('suggestedAction', sql.NVarChar, action.suggestedAction || null)
                    .input('action', sql.NVarChar, action.actionTaken || action.action || null)
                    .input('responsible', sql.NVarChar, action.personInCharge || null)
                    .input('deadline', sql.Date, action.deadline || null)
                    .input('priority', sql.NVarChar, action.priority || 'Medium')
                    .input('status', sql.NVarChar, action.status || 'Open')
                    .query(`
                        INSERT INTO OE_InspectionActionItems 
                            (InspectionId, ReferenceValue, SectionName, Finding, SuggestedAction, 
                             Action, Responsible, Deadline, Priority, Status, CreatedAt)
                        VALUES 
                            (@inspectionId, @referenceValue, @sectionName, @finding, @suggestedAction,
                             @action, @responsible, @deadline, @priority, @status, GETDATE())
                    `);
            }
        }
        
        // Check if all action items are now completed (Completed status)
        const completionCheck = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT 
                    COUNT(*) as TotalItems,
                    SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as CompletedItems
                FROM OE_InspectionActionItems 
                WHERE InspectionId = @inspectionId
            `);
        
        const { TotalItems, CompletedItems } = completionCheck.recordset[0];
        
        // If all items are completed, mark the action plan as completed
        if (TotalItems > 0 && TotalItems === CompletedItems) {
            await pool.request()
                .input('inspectionId', sql.Int, inspectionId)
                .query(`
                    UPDATE OE_Inspections 
                    SET ActionPlanCompletedAt = GETDATE()
                    WHERE Id = @inspectionId AND ActionPlanCompletedAt IS NULL
                `);
            
            // Resolve any pending escalations
            await pool.request()
                .input('inspectionId', sql.Int, inspectionId)
                .query(`
                    UPDATE OE_ActionPlanEscalations 
                    SET Status = 'Resolved', ResolvedAt = GETDATE()
                    WHERE InspectionId = @inspectionId AND Status = 'Pending'
                `);
            
            console.log(`[Action Plan] All items completed for inspection ${inspectionId}, marked as completed`);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving action plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload action plan picture (returns file path for use in action-plan.html)
router.post('/api/action-plan/upload-picture', oeAuditUpload.single('picture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        // Compress the uploaded image
        const fullPath = path.join(oeAuditUploadDir, req.file.filename);
        await compressImage(fullPath);
        
        res.json({ 
            success: true, 
            url: `/uploads/oe-inspection/${req.file.filename}`,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
    } catch (error) {
        console.error('Error uploading action plan picture:', error);
        res.status(500).json({ success: false, error: error.message });
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

// ==========================================
// ACTION ITEMS API (for Action Plans page)
// ==========================================

// Get all action items across all inspections
router.get('/api/action-items', async (req, res) => {
    try {
        const { storeId, priority, status, fromDate, toDate } = req.query;
        const pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT 
                ai.Id as id,
                ai.InspectionId as inspectionId,
                ai.ReferenceValue as referenceValue,
                ai.SectionName as sectionName,
                ai.Finding as finding,
                ai.SuggestedAction as suggestedAction,
                ai.Action as cr,
                ai.Responsible as assignedTo,
                ai.Deadline as dueDate,
                ai.Priority as priority,
                ai.Status as status,
                ai.Department as department,
                ai.CreatedAt as createdAt,
                ai.UpdatedAt as updatedAt,
                ai.CompletionDate as completedAt,
                ai.CompletionNotes as notes,
                i.DocumentNumber as documentNumber,
                i.StoreName as storeName,
                i.StoreId as storeId,
                i.InspectionDate as inspectionDate
            FROM OE_InspectionActionItems ai
            INNER JOIN OE_Inspections i ON ai.InspectionId = i.Id
            WHERE 1=1
        `;
        
        const request = pool.request();
        
        if (storeId) {
            query += ` AND i.StoreId = @storeId`;
            request.input('storeId', sql.Int, storeId);
        }
        if (priority) {
            query += ` AND ai.Priority = @priority`;
            request.input('priority', sql.NVarChar, priority);
        }
        if (status) {
            query += ` AND ai.Status = @status`;
            request.input('status', sql.NVarChar, status);
        }
        if (fromDate) {
            query += ` AND i.InspectionDate >= @fromDate`;
            request.input('fromDate', sql.Date, fromDate);
        }
        if (toDate) {
            query += ` AND i.InspectionDate <= @toDate`;
            request.input('toDate', sql.Date, toDate);
        }
        
        query += ` ORDER BY 
            CASE WHEN ai.Deadline < CAST(GETDATE() AS DATE) AND ai.Status != 'Closed' THEN 0 ELSE 1 END,
            CASE ai.Priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END,
            ai.Deadline`;
        
        const result = await request.query(query);
        await pool.close();
        
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching action items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update action item
router.put('/api/action-items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { cr, assignedTo, priority, status, dueDate, notes } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        let updateFields = [];
        const request = pool.request().input('id', sql.Int, id);
        
        if (cr !== undefined) {
            updateFields.push('Action = @cr');
            request.input('cr', sql.NVarChar, cr);
        }
        if (assignedTo !== undefined) {
            updateFields.push('Responsible = @assignedTo');
            request.input('assignedTo', sql.NVarChar, assignedTo);
        }
        if (priority !== undefined) {
            updateFields.push('Priority = @priority');
            request.input('priority', sql.NVarChar, priority);
        }
        if (status !== undefined) {
            updateFields.push('Status = @status');
            request.input('status', sql.NVarChar, status);
            if (status === 'Closed') {
                updateFields.push('CompletionDate = GETDATE()');
            }
        }
        if (dueDate !== undefined) {
            updateFields.push('Deadline = @dueDate');
            request.input('dueDate', sql.Date, dueDate || null);
        }
        if (notes !== undefined) {
            updateFields.push('CompletionNotes = @notes');
            request.input('notes', sql.NVarChar, notes);
        }
        
        updateFields.push('UpdatedAt = GETDATE()');
        
        await request.query(`
            UPDATE OE_InspectionActionItems 
            SET ${updateFields.join(', ')} 
            WHERE Id = @id
        `);
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating action item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Schedule API Routes
// ==========================================

// Get all schedules for a month
router.get('/api/schedules', async (req, res) => {
    try {
        const { year, month } = req.query;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('year', sql.Int, parseInt(year))
            .input('month', sql.Int, parseInt(month))
            .query(`
                SELECT 
                    s.Id,
                    s.InspectorId,
                    u.DisplayName as InspectorName,
                    s.StoreId,
                    st.StoreName,
                    s.TemplateId,
                    t.TemplateName,
                    s.ScheduledDate,
                    s.Notes,
                    s.Status,
                    s.CreatedBy,
                    cb.DisplayName as CreatedByName,
                    s.CreatedAt,
                    s.UpdatedAt
                FROM OE_InspectionSchedule s
                JOIN Users u ON s.InspectorId = u.Id
                JOIN Stores st ON s.StoreId = st.Id
                JOIN OE_InspectionTemplates t ON s.TemplateId = t.Id
                JOIN Users cb ON s.CreatedBy = cb.Id
                WHERE YEAR(s.ScheduledDate) = @year AND MONTH(s.ScheduledDate) = @month
                ORDER BY s.ScheduledDate, st.StoreName
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get schedules for a specific inspector
router.get('/api/schedules/inspector/:inspectorId', async (req, res) => {
    try {
        const { inspectorId } = req.params;
        const { year, month } = req.query;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('inspectorId', sql.Int, parseInt(inspectorId))
            .input('year', sql.Int, parseInt(year))
            .input('month', sql.Int, parseInt(month))
            .query(`
                SELECT 
                    s.Id,
                    s.InspectorId,
                    u.DisplayName as InspectorName,
                    s.StoreId,
                    st.StoreName,
                    s.TemplateId,
                    t.TemplateName,
                    s.ScheduledDate,
                    s.Notes,
                    s.Status,
                    s.CreatedAt
                FROM OE_InspectionSchedule s
                JOIN Users u ON s.InspectorId = u.Id
                JOIN Stores st ON s.StoreId = st.Id
                JOIN OE_InspectionTemplates t ON s.TemplateId = t.Id
                WHERE s.InspectorId = @inspectorId
                  AND YEAR(s.ScheduledDate) = @year 
                  AND MONTH(s.ScheduledDate) = @month
                ORDER BY s.ScheduledDate, st.StoreName
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching inspector schedules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new schedule
router.post('/api/schedules', async (req, res) => {
    try {
        const { inspectorId, storeId, templateId, scheduledDate, notes } = req.body;
        const createdBy = req.session?.user?.id || 1;
        
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('inspectorId', sql.Int, inspectorId)
            .input('storeId', sql.Int, storeId)
            .input('templateId', sql.Int, templateId)
            .input('scheduledDate', sql.Date, scheduledDate)
            .input('notes', sql.NVarChar, notes || null)
            .input('createdBy', sql.Int, createdBy)
            .query(`
                INSERT INTO OE_InspectionSchedule (InspectorId, StoreId, TemplateId, ScheduledDate, Notes, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES (@inspectorId, @storeId, @templateId, @scheduledDate, @notes, @createdBy)
            `);
        
        await pool.close();
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update a schedule
router.put('/api/schedules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { inspectorId, storeId, templateId, scheduledDate, notes, status } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        let updateFields = ['UpdatedAt = GETDATE()'];
        const request = pool.request().input('id', sql.Int, id);
        
        if (inspectorId !== undefined) {
            updateFields.push('InspectorId = @inspectorId');
            request.input('inspectorId', sql.Int, inspectorId);
        }
        if (storeId !== undefined) {
            updateFields.push('StoreId = @storeId');
            request.input('storeId', sql.Int, storeId);
        }
        if (templateId !== undefined) {
            updateFields.push('TemplateId = @templateId');
            request.input('templateId', sql.Int, templateId);
        }
        if (scheduledDate !== undefined) {
            updateFields.push('ScheduledDate = @scheduledDate');
            request.input('scheduledDate', sql.Date, scheduledDate);
        }
        if (notes !== undefined) {
            updateFields.push('Notes = @notes');
            request.input('notes', sql.NVarChar, notes);
        }
        if (status !== undefined) {
            updateFields.push('Status = @status');
            request.input('status', sql.NVarChar, status);
        }
        
        await request.query(`
            UPDATE OE_InspectionSchedule 
            SET ${updateFields.join(', ')} 
            WHERE Id = @id
        `);
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a schedule
router.delete('/api/schedules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM OE_InspectionSchedule WHERE Id = @id');
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get inspectors list (users with Inspector role)
router.get('/api/schedules/data/inspectors', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`
                SELECT DISTINCT u.Id, u.DisplayName, u.Email, r.RoleName
                FROM Users u
                JOIN UserRoles r ON u.RoleId = r.Id
                WHERE u.IsActive = 1 AND u.IsApproved = 1
                  AND r.RoleName = 'Inspector'
                ORDER BY u.DisplayName
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching inspectors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get stores list
router.get('/api/schedules/data/stores', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`
                SELECT Id, StoreName, StoreCode
                FROM Stores
                WHERE IsActive = 1
                ORDER BY StoreName
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get templates list
router.get('/api/schedules/data/templates', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`
                SELECT Id, TemplateName
                FROM OE_InspectionTemplates
                WHERE IsActive = 1
                ORDER BY TemplateName
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Implementation Verification API Routes
// ==========================================

// Get inspections with action plans for verification (completed by store managers)
router.get('/api/verification/inspections', async (req, res) => {
    try {
        const { status } = req.query; // 'pending', 'verified', 'all'
        const pool = await sql.connect(dbConfig);
        
        let statusFilter = '';
        if (status === 'pending') {
            // Inspections where at least one action item is not yet verified
            statusFilter = `AND EXISTS (
                SELECT 1 FROM OE_InspectionActionItems ai 
                WHERE ai.InspectionId = i.Id
                AND NOT EXISTS (SELECT 1 FROM OE_ActionItemVerification v WHERE v.ActionItemId = ai.Id)
            )`;
        } else if (status === 'verified') {
            // Inspections where all action items have been verified
            statusFilter = `AND NOT EXISTS (
                SELECT 1 FROM OE_InspectionActionItems ai 
                WHERE ai.InspectionId = i.Id
                AND NOT EXISTS (SELECT 1 FROM OE_ActionItemVerification v WHERE v.ActionItemId = ai.Id)
            ) AND EXISTS (SELECT 1 FROM OE_ActionItemVerification v WHERE v.InspectionId = i.Id)`;
        }
        
        const result = await pool.request()
            .query(`
                SELECT 
                    i.Id,
                    i.DocumentNumber,
                    i.StoreName,
                    i.InspectionDate,
                    i.Status as InspectionStatus,
                    (SELECT COUNT(*) FROM OE_InspectionActionItems ai WHERE ai.InspectionId = i.Id) as TotalActionItems,
                    (SELECT COUNT(*) FROM OE_InspectionActionItems ai WHERE ai.InspectionId = i.Id AND ai.Status IN ('Completed', 'In Progress', 'Deferred')) as RespondedItems,
                    (SELECT COUNT(*) FROM OE_ActionItemVerification v WHERE v.InspectionId = i.Id) as VerifiedItems,
                    (SELECT COUNT(*) FROM OE_ActionItemVerification v WHERE v.InspectionId = i.Id AND v.VerificationStatus = 'Verified Complete') as VerifiedComplete,
                    (SELECT COUNT(*) FROM OE_ActionItemVerification v WHERE v.InspectionId = i.Id AND v.VerificationStatus = 'Verified Not Complete') as VerifiedNotComplete
                FROM OE_Inspections i
                WHERE i.Status = 'Completed'
                  AND EXISTS (SELECT 1 FROM OE_InspectionActionItems ai WHERE ai.InspectionId = i.Id)
                  ${statusFilter}
                ORDER BY i.InspectionDate DESC
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching verification inspections:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get action items for a specific inspection (for verification)
router.get('/api/verification/inspection/:inspectionId', async (req, res) => {
    try {
        const { inspectionId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get inspection details
        const inspectionResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT Id, DocumentNumber, StoreName, InspectionDate, Inspectors
                FROM OE_Inspections WHERE Id = @inspectionId
            `);
        
        // Get action items with verification status
        const actionItemsResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT 
                    ai.Id,
                    ai.SectionName,
                    ai.ReferenceValue,
                    COALESCE(ai.Finding, ii.Finding, ii.Question) as Finding,
                    ai.SuggestedAction,
                    ai.Action,
                    ai.Responsible,
                    ai.Department,
                    ai.Deadline,
                    ai.Priority,
                    ai.Status,
                    ai.CompletionDate,
                    ai.CompletionNotes,
                    ai.BeforeImageUrl,
                    ai.AfterImageUrl,
                    ii.Answer as InspectionAnswer,
                    v.Id as VerificationId,
                    v.VerificationStatus,
                    v.VerificationNotes,
                    v.VerificationPictureUrl,
                    v.VerifiedAt,
                    u.DisplayName as VerifiedByName
                FROM OE_InspectionActionItems ai
                LEFT JOIN OE_InspectionItems ii ON ii.InspectionId = ai.InspectionId AND ii.ReferenceValue = ai.ReferenceValue
                LEFT JOIN OE_ActionItemVerification v ON v.ActionItemId = ai.Id
                LEFT JOIN Users u ON v.VerifiedBy = u.Id
                WHERE ai.InspectionId = @inspectionId
                ORDER BY ai.SectionName, ai.Id
            `);
        
        await pool.close();
        res.json({ 
            success: true, 
            inspection: inspectionResult.recordset[0],
            actionItems: actionItemsResult.recordset 
        });
    } catch (error) {
        console.error('Error fetching inspection for verification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit verification for an action item
router.post('/api/verification/submit', async (req, res) => {
    try {
        const { actionItemId, inspectionId, verificationStatus, verificationNotes, verificationPictureUrl } = req.body;
        const verifiedBy = req.session?.user?.id || 1;
        
        const pool = await sql.connect(dbConfig);
        
        // Check if verification already exists
        const existingResult = await pool.request()
            .input('actionItemId', sql.Int, actionItemId)
            .query('SELECT Id FROM OE_ActionItemVerification WHERE ActionItemId = @actionItemId');
        
        if (existingResult.recordset.length > 0) {
            // Update existing verification
            await pool.request()
                .input('id', sql.Int, existingResult.recordset[0].Id)
                .input('verificationStatus', sql.NVarChar, verificationStatus)
                .input('verificationNotes', sql.NVarChar, verificationNotes || null)
                .input('verificationPictureUrl', sql.NVarChar, verificationPictureUrl || null)
                .input('verifiedBy', sql.Int, verifiedBy)
                .query(`
                    UPDATE OE_ActionItemVerification 
                    SET VerificationStatus = @verificationStatus,
                        VerificationNotes = @verificationNotes,
                        VerificationPictureUrl = @verificationPictureUrl,
                        VerifiedBy = @verifiedBy,
                        VerifiedAt = GETDATE(),
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            // Insert new verification
            await pool.request()
                .input('actionItemId', sql.Int, actionItemId)
                .input('inspectionId', sql.Int, inspectionId)
                .input('verifiedBy', sql.Int, verifiedBy)
                .input('verificationStatus', sql.NVarChar, verificationStatus)
                .input('verificationNotes', sql.NVarChar, verificationNotes || null)
                .input('verificationPictureUrl', sql.NVarChar, verificationPictureUrl || null)
                .query(`
                    INSERT INTO OE_ActionItemVerification 
                    (ActionItemId, InspectionId, VerifiedBy, VerificationStatus, VerificationNotes, VerificationPictureUrl, VerifiedAt)
                    VALUES (@actionItemId, @inspectionId, @verifiedBy, @verificationStatus, @verificationNotes, @verificationPictureUrl, GETDATE())
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error submitting verification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload verification picture
router.post('/api/verification/upload-picture', verificationUpload.single('picture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        // Compress the uploaded image
        const fullPath = path.join(verificationUploadDir, req.file.filename);
        await compressImage(fullPath);
        
        res.json({ success: true, url: `/uploads/verification/${req.file.filename}` });
    } catch (error) {
        console.error('Error uploading verification picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get verification summary stats
router.get('/api/verification/stats', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`
                SELECT 
                    (SELECT COUNT(DISTINCT i.Id) FROM OE_Inspections i
                     WHERE i.Status = 'Completed'
                     AND EXISTS (
                         SELECT 1 FROM OE_InspectionActionItems ai 
                         WHERE ai.InspectionId = i.Id
                         AND NOT EXISTS (SELECT 1 FROM OE_ActionItemVerification v WHERE v.ActionItemId = ai.Id)
                     )) as PendingVerification,
                    (SELECT COUNT(DISTINCT i.Id) FROM OE_Inspections i
                     WHERE EXISTS (SELECT 1 FROM OE_ActionItemVerification v WHERE v.InspectionId = i.Id)) as Verified,
                    (SELECT COUNT(*) FROM OE_ActionItemVerification WHERE VerificationStatus = 'Verified Complete') as VerifiedComplete,
                    (SELECT COUNT(*) FROM OE_ActionItemVerification WHERE VerificationStatus = 'Verified Not Complete') as VerifiedNotComplete
            `);
        
        await pool.close();
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error('Error fetching verification stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Email Report Endpoints
// ==========================================

const emailService = require('../../services/email-service');
const emailTemplateBuilder = require('../../services/email-template-builder');

// Get email recipients for an audit (store manager + brand responsibles for CC)
// For action-plan reports, the To recipient is the auditor who created the inspection
// For full reports, the To recipient is the store manager
router.get('/api/audits/:auditId/email-recipients', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { reportType } = req.query; // 'full' or 'action-plan'
        const pool = await sql.connect(dbConfig);
        
        // Get audit info with store and brand
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id as auditId,
                    i.DocumentNumber,
                    i.StoreId,
                    s.StoreName,
                    s.StoreCode,
                    s.BrandId,
                    b.BrandName,
                    b.BrandCode,
                    b.PrimaryColor as BrandColor,
                    i.Score as TotalScore,
                    i.InspectionDate as AuditDate,
                    i.Inspectors as Auditors,
                    i.Status,
                    i.CreatedBy
                FROM OE_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        let toRecipient = null;
        
        // For action-plan reports, send to the auditor/inspector who created the inspection
        if (reportType === 'action-plan' && audit.CreatedBy) {
            const auditorResult = await pool.request()
                .input('userId', sql.Int, audit.CreatedBy)
                .query(`
                    SELECT Id, Email, DisplayName
                    FROM Users
                    WHERE Id = @userId AND IsActive = 1
                `);
            
            if (auditorResult.recordset.length > 0) {
                const auditor = auditorResult.recordset[0];
                toRecipient = {
                    email: auditor.Email,
                    name: auditor.DisplayName
                };
            }
        } else {
            // For full reports, send to store manager
            const storeManagerResult = await pool.request()
                .input('storeId', sql.Int, audit.StoreId)
                .query(`
                    SELECT TOP 1 u.Id, u.Email, u.DisplayName
                    FROM StoreManagerAssignments sma
                    INNER JOIN Users u ON sma.UserId = u.Id
                    WHERE sma.StoreId = @storeId AND sma.IsPrimary = 1 AND u.IsActive = 1
                `);
            
            if (storeManagerResult.recordset.length > 0) {
                const storeManager = storeManagerResult.recordset[0];
                toRecipient = {
                    email: storeManager.Email,
                    name: storeManager.DisplayName
                };
            }
        }
        
        // Get brand responsibles (CC suggestions)
        const ccSuggestions = [];
        
        if (audit.BrandId) {
            const brandResponsiblesResult = await pool.request()
                .input('brandId', sql.Int, audit.BrandId)
                .query(`
                    SELECT 
                        br.AreaManagerId, am.Email as AreaManagerEmail, am.DisplayName as AreaManagerName,
                        br.HeadOfOpsId, ho.Email as HeadOfOpsEmail, ho.DisplayName as HeadOfOpsName
                    FROM OE_BrandResponsibles br
                    LEFT JOIN Users am ON br.AreaManagerId = am.Id AND am.IsActive = 1
                    LEFT JOIN Users ho ON br.HeadOfOpsId = ho.Id AND ho.IsActive = 1
                    WHERE br.BrandId = @brandId AND br.IsActive = 1
                `);
            
            if (brandResponsiblesResult.recordset.length > 0) {
                const br = brandResponsiblesResult.recordset[0];
                if (br.AreaManagerEmail) {
                    ccSuggestions.push({
                        email: br.AreaManagerEmail,
                        name: br.AreaManagerName,
                        role: 'Area Manager'
                    });
                }
                if (br.HeadOfOpsEmail) {
                    ccSuggestions.push({
                        email: br.HeadOfOpsEmail,
                        name: br.HeadOfOpsName,
                        role: 'Head of Operations'
                    });
                }
            }
        }
        
        await pool.close();
        
        // Build response
        res.json({
            success: true,
            audit: {
                auditId: audit.auditId,
                documentNumber: audit.DocumentNumber,
                storeName: audit.StoreName,
                storeCode: audit.StoreCode,
                brandName: audit.BrandName,
                brandCode: audit.BrandCode,
                brandColor: audit.BrandColor,
                totalScore: audit.TotalScore,
                auditDate: audit.AuditDate,
                auditors: audit.Auditors,
                status: audit.Status
            },
            to: toRecipient,
            ccSuggestions: ccSuggestions,
            from: req.currentUser ? {
                email: req.currentUser.email,
                name: req.currentUser.displayName || req.currentUser.name || req.currentUser.email
            } : null
        });
    } catch (error) {
        console.error('Error fetching email recipients:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get email preview (subject and body HTML)
router.get('/api/audits/:auditId/email-preview', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { reportType } = req.query; // 'full' or 'action-plan'
        
        const pool = await sql.connect(dbConfig);
        
        // Get audit details
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, s.StoreName, s.StoreCode,
                    b.BrandCode, i.Score as TotalScore, i.InspectionDate as AuditDate, i.Inspectors as Auditors, i.Status,
                    i.Cycle, i.Year
                FROM OE_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Build report URL
        const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
        const reportUrl = reportType === 'action-plan' 
            ? `${appUrl}/oe-inspection/api/audits/reports/OE_ActionPlan_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`
            : `${appUrl}/oe-inspection/api/audits/reports/OE_Report_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        // Get findings stats for action plan
        let findingsStats = null;
        if (reportType === 'action-plan') {
            const findingsResult = await pool.request()
                .input('auditId', sql.Int, auditId)
                .query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN Priority = 'High' THEN 1 ELSE 0 END) as high,
                        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) as medium,
                        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) as low
                    FROM OE_InspectionItems
                    WHERE InspectionId = @auditId AND Finding IS NOT NULL AND Finding != ''
                `);
            findingsStats = findingsResult.recordset[0];
        }
        
        await pool.close();
        
        // Build email using template builder
        const auditData = {
            documentNumber: audit.DocumentNumber,
            storeName: audit.StoreName,
            storeCode: audit.StoreCode,
            brandCode: audit.BrandCode,
            auditDate: audit.AuditDate,
            auditors: audit.Auditors,
            totalScore: audit.TotalScore,
            status: audit.Status,
            cycle: audit.Cycle,
            year: audit.Year,
            passingGrade: 85
        };
        
        // Use database template (falls back to hardcoded if not found)
        const emailContent = await emailTemplateBuilder.buildEmailFromDB('OE', reportType, auditData, reportUrl, findingsStats);
        
        res.json({
            success: true,
            subject: emailContent.subject,
            bodyHtml: emailContent.body,
            reportUrl: reportUrl
        });
    } catch (error) {
        console.error('Error generating email preview:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send report email
router.post('/api/audits/:auditId/send-report-email', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { reportType, to, cc } = req.body;
        
        if (!to || !to.email) {
            return res.status(400).json({ error: 'Recipient (to) is required' });
        }
        
        const accessToken = req.session?.accessToken;
        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated. Please log in again.' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Get audit details
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, s.StoreName, s.StoreCode,
                    s.BrandId, b.BrandName, b.BrandCode, 
                    i.Score as TotalScore, i.InspectionDate as AuditDate, i.Inspectors as Auditors, i.Status, i.Cycle, i.Year
                FROM OE_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Build report URL
        const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
        const reportUrl = reportType === 'action-plan' 
            ? `${appUrl}/oe-inspection/api/audits/reports/OE_ActionPlan_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`
            : `${appUrl}/oe-inspection/api/audits/reports/OE_Report_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        // Get findings stats for action plan
        let findingsStats = null;
        if (reportType === 'action-plan') {
            const findingsResult = await pool.request()
                .input('auditId', sql.Int, auditId)
                .query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN Priority = 'High' THEN 1 ELSE 0 END) as high,
                        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) as medium,
                        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) as low
                    FROM OE_InspectionItems
                    WHERE InspectionId = @auditId AND Finding IS NOT NULL AND Finding != ''
                `);
            findingsStats = findingsResult.recordset[0];
        }
        
        // Build email content
        const auditData = {
            documentNumber: audit.DocumentNumber,
            storeName: audit.StoreName,
            storeCode: audit.StoreCode,
            brandCode: audit.BrandCode,
            auditDate: audit.AuditDate,
            auditors: audit.Auditors,
            totalScore: audit.TotalScore,
            status: audit.Status,
            cycle: audit.Cycle,
            year: audit.Year,
            passingGrade: 85
        };
        
        // Use database template (falls back to hardcoded if not found)
        const emailContent = await emailTemplateBuilder.buildEmailFromDB('OE', reportType, auditData, reportUrl, findingsStats);
        
        // Build CC string
        const ccEmails = cc && cc.length > 0 ? cc.map(c => c.email).join(',') : null;
        
        // Send email
        const emailResult = await emailService.sendEmail({
            to: to.email,
            subject: emailContent.subject,
            body: emailContent.body,
            cc: ccEmails,
            accessToken: accessToken
        });
        
        // Log the email
        await pool.request()
            .input('auditId', sql.Int, auditId)
            .input('documentNumber', sql.NVarChar, audit.DocumentNumber)
            .input('module', sql.NVarChar, 'OE')
            .input('reportType', sql.NVarChar, reportType)
            .input('sentBy', sql.Int, req.currentUser?.Id || null)
            .input('sentByEmail', sql.NVarChar, req.currentUser?.email || 'Unknown')
            .input('sentByName', sql.NVarChar, req.currentUser?.DisplayName || 'Unknown')
            .input('sentTo', sql.NVarChar, JSON.stringify([to]))
            .input('ccRecipients', sql.NVarChar, cc ? JSON.stringify(cc) : null)
            .input('subject', sql.NVarChar, emailContent.subject)
            .input('reportUrl', sql.NVarChar, reportUrl)
            .input('status', sql.NVarChar, emailResult.success ? 'sent' : 'failed')
            .input('errorMessage', sql.NVarChar, emailResult.error || null)
            .input('storeId', sql.Int, audit.StoreId)
            .input('storeName', sql.NVarChar, audit.StoreName)
            .input('brandId', sql.Int, audit.BrandId)
            .input('brandName', sql.NVarChar, audit.BrandName)
            .query(`
                INSERT INTO ReportEmailLog 
                (AuditId, DocumentNumber, Module, ReportType, SentBy, SentByEmail, SentByName, 
                 SentTo, CcRecipients, Subject, ReportUrl, Status, ErrorMessage, 
                 StoreId, StoreName, BrandId, BrandName, SentAt)
                VALUES 
                (@auditId, @documentNumber, @module, @reportType, @sentBy, @sentByEmail, @sentByName,
                 @sentTo, @ccRecipients, @subject, @reportUrl, @status, @errorMessage,
                 @storeId, @storeName, @brandId, @brandName, GETDATE())
            `);
        
        await pool.close();
        
        if (emailResult.success) {
            res.json({ success: true, message: 'Email sent successfully' });
        } else {
            res.status(500).json({ success: false, error: emailResult.error || 'Failed to send email' });
        }
    } catch (error) {
        console.error('Error sending report email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
