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
                        
                        <a href="/oe-inspection/cycle-dashboard" class="card">
                            <div class="card-icon">🔄</div>
                            <div class="card-title">Cycle Dashboard</div>
                            <div class="card-desc">Track inspection progress per brand and cycle. View pending stores.</div>
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

// Cycle Dashboard Page
router.get('/cycle-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'cycle-dashboard.html'));
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
            .input('createdBy', sql.Int, req.currentUser?.userId || 1)
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
                    ORDER BY 
                        CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 2) AS INT),
                        CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 1) AS INT)
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

// Update section
router.put('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const { sectionNumber, sectionName, sectionIcon } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .input('name', sql.NVarChar, sectionName)
            .input('icon', sql.NVarChar, sectionIcon || '📋')
            .input('order', sql.Int, sectionNumber)
            .query(`
                UPDATE OE_InspectionTemplateSections 
                SET SectionName = @name, SectionIcon = @icon, SectionOrder = @order
                WHERE Id = @sectionId
            `);
        await pool.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating section:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete section (and its items)
router.delete('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        // Delete items first
        await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .query('DELETE FROM OE_InspectionTemplateItems WHERE SectionId = @sectionId');
        // Delete section
        await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .query('DELETE FROM OE_InspectionTemplateSections WHERE Id = @sectionId');
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
                SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, Quantity as quantity, AnswerOptions as answer, Criteria as cr, DefaultSeverity as defaultSeverity,
                       IsQuantitative as isQuantitative, Range1From as range1From, Range1To as range1To, Range2From as range2From, Range2To as range2To, Range3From as range3From
                FROM OE_InspectionTemplateItems
                WHERE SectionId = @sectionId AND IsActive = 1
                ORDER BY 
                    CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 2) AS INT),
                    CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 1) AS INT)
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
        const { referenceValue, title, coeff, quantity, answer, cr, defaultSeverity, isQuantitative, range1From, range1To, range2From, range2To, range3From } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .input('ref', sql.NVarChar, referenceValue)
            .input('question', sql.NVarChar, title)
            .input('coeff', sql.Decimal(5,2), coeff || 2)
            .input('quantity', sql.Int, quantity || null)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('criteria', sql.NVarChar, cr || '')
            .input('defaultSeverity', sql.NVarChar, defaultSeverity || null)
            .input('isQuantitative', sql.Bit, isQuantitative ? 1 : 0)
            .input('range1From', sql.Int, range1From || null)
            .input('range1To', sql.Int, range1To || null)
            .input('range2From', sql.Int, range2From || null)
            .input('range2To', sql.Int, range2To || null)
            .input('range3From', sql.Int, range3From || null)
            .query(`
                INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, DefaultSeverity, IsActive, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From)
                OUTPUT INSERTED.Id as itemId
                VALUES (@sectionId, @ref, @question, @coeff, @quantity, @answer, @criteria, @defaultSeverity, 1, @isQuantitative, @range1From, @range1To, @range2From, @range2To, @range3From)
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
                .input('defaultSeverity', sql.NVarChar, item.defaultSeverity || null)
                .query(`INSERT INTO OE_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, DefaultSeverity, IsActive) VALUES (@sectionId, @ref, @question, @coeff, @quantity, @answer, @criteria, @defaultSeverity, 1)`);
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
        const { referenceValue, title, coeff, quantity, answer, cr, defaultSeverity, isQuantitative, range1From, range1To, range2From, range2To, range3From } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.itemId)
            .input('ref', sql.NVarChar, referenceValue)
            .input('question', sql.NVarChar, title)
            .input('coeff', sql.Int, coeff || 2)
            .input('quantity', sql.Int, quantity || null)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('criteria', sql.NVarChar, cr || '')
            .input('defaultSeverity', sql.NVarChar, defaultSeverity || null)
            .input('isQuantitative', sql.Bit, isQuantitative ? 1 : 0)
            .input('range1From', sql.Int, range1From || null)
            .input('range1To', sql.Int, range1To || null)
            .input('range2From', sql.Int, range2From || null)
            .input('range2To', sql.Int, range2To || null)
            .input('range3From', sql.Int, range3From || null)
            .query(`UPDATE OE_InspectionTemplateItems SET ReferenceValue = @ref, Question = @question, Coefficient = @coeff, Quantity = @quantity, AnswerOptions = @answer, Criteria = @criteria, DefaultSeverity = @defaultSeverity, IsQuantitative = @isQuantitative, Range1From = @range1From, Range1To = @range1To, Range2From = @range2From, Range2To = @range2To, Range3From = @range3From WHERE Id = @id`);
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
                .input('assignedBy', sql.Int, req.currentUser?.userId || null)
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
        const userId = req.currentUser?.userId || 1;
        
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
                        SELECT ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, ItemOrder, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From, DefaultSeverity
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
                        .input('defaultSeverity', sql.NVarChar, item.DefaultSeverity || null)
                        .input('isQuantitative', sql.Bit, item.IsQuantitative || 0)
                        .input('range1From', sql.Int, item.Range1From || null)
                        .input('range1To', sql.Int, item.Range1To || null)
                        .input('range2From', sql.Int, item.Range2From || null)
                        .input('range2To', sql.Int, item.Range2To || null)
                        .input('range3From', sql.Int, item.Range3From || null)
                        .query(`
                            INSERT INTO OE_InspectionItems 
                                (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, DefaultSeverity, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From)
                            VALUES 
                                (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @quantity, @answerOptions, @criteria, @defaultSeverity, @isQuantitative, @range1From, @range1To, @range2From, @range2To, @range3From)
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
                        SELECT ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, ItemOrder, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From, DefaultSeverity
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
                        .input('defaultSeverity', sql.NVarChar, item.DefaultSeverity || null)
                        .input('isQuantitative', sql.Bit, item.IsQuantitative || 0)
                        .input('range1From', sql.Int, item.Range1From || null)
                        .input('range1To', sql.Int, item.Range1To || null)
                        .input('range2From', sql.Int, item.Range2From || null)
                        .input('range2To', sql.Int, item.Range2To || null)
                        .input('range3From', sql.Int, item.Range3From || null)
                        .query(`
                            INSERT INTO OE_InspectionItems 
                                (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, DefaultSeverity, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From)
                            VALUES 
                                (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @quantity, @answerOptions, @criteria, @defaultSeverity, @isQuantitative, @range1From, @range1To, @range2From, @range2To, @range3From)
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
                        DefaultSeverity as defaultSeverity,
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
                    ORDER BY 
                        CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 2) AS INT),
                        CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 1) AS INT)
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
        
        // Sort items within each section by ReferenceValue (natural sort for numbers like 1.1, 1.2, 1.10)
        for (const section of sections) {
            section.items.sort((a, b) => {
                const refA = a.ReferenceValue || '';
                const refB = b.ReferenceValue || '';
                // Natural sort: split by dots and compare numerically
                const partsA = refA.split('.').map(p => parseInt(p) || 0);
                const partsB = refB.split('.').map(p => parseInt(p) || 0);
                for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                    const numA = partsA[i] || 0;
                    const numB = partsB[i] || 0;
                    if (numA !== numB) return numA - numB;
                }
                return 0;
            });
        }
        
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
        
        // Get settings for threshold - based on schema/template
        const settingsResult = await pool.request()
            .input('templateId', sql.Int, audit.TemplateId)
            .query(`
                SELECT ISNULL(s.SettingValue, '80') as PassingGrade
                FROM OE_InspectionSettings s
                WHERE s.SettingKey = 'PASSING_SCORE_' + CAST(@templateId AS VARCHAR)
            `);
        const threshold = settingsResult.recordset.length > 0 
            ? parseInt(settingsResult.recordset[0].PassingGrade) || 80 
            : 80;
        
        // Also get section-level passing grades
        const sectionGradesResult = await pool.request()
            .input('templateId', sql.Int, audit.TemplateId)
            .query(`
                SELECT SectionName, ISNULL(PassingGrade, 80) as PassingGrade
                FROM OE_InspectionTemplateSections
                WHERE TemplateId = @templateId
            `);
        const sectionPassingGrades = {};
        for (const sg of sectionGradesResult.recordset) {
            sectionPassingGrades[sg.SectionName] = sg.PassingGrade;
        }
        
        // Update sections with their specific passing grades
        for (const section of sections) {
            section.PassingGrade = sectionPassingGrades[section.SectionName] || threshold;
        }
        
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
    
    // Collect all pictures for galleries
    const goodObsItems = [];
    const findingPicItems = [];
    
    sections.forEach(section => {
        (section.items || []).forEach(item => {
            const itemPics = pictures[item.Id] || [];
            itemPics.forEach(pic => {
                if (pic.pictureType === 'Good') {
                    goodObsItems.push({
                        ref: item.ReferenceValue || 'N/A',
                        section: section.SectionName,
                        question: item.Question,
                        dataUrl: pic.dataUrl,
                        fileName: pic.fileName
                    });
                } else if (item.Answer === 'No' || item.Answer === 'Partially') {
                    findingPicItems.push({
                        ref: item.ReferenceValue || 'N/A',
                        section: section.SectionName,
                        question: item.Question,
                        answer: item.Answer,
                        finding: item.Finding,
                        dataUrl: pic.dataUrl,
                        fileName: pic.fileName,
                        pictureType: pic.pictureType
                    });
                }
            });
        });
    });
    
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
        .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px; }
        .header h1 { font-size: 20px; margin-bottom: 8px; }
        .header-info { display: flex; flex-wrap: wrap; gap: 10px; }
        .header-item { background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 6px; }
        .header-item label { font-size: 10px; opacity: 0.8; display: block; }
        .header-item span { font-size: 13px; font-weight: 600; }
        .score-card { background: white; border-radius: 10px; padding: 12px 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; gap: 20px; }
        .score-value { font-size: 36px; font-weight: bold; }
        .score-value.pass { color: #10b981; }
        .score-value.fail { color: #ef4444; }
        .score-label { font-size: 18px; font-weight: 600; }
        .score-label.pass { color: #10b981; }
        .score-label.fail { color: #ef4444; }
        .score-threshold { color: #64748b; font-size: 14px; border-left: 1px solid #e2e8f0; padding-left: 20px; }
        
        /* Summary Section */
        .summary-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .summary-title { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; }
        .summary-table { width: 100%; border-collapse: collapse; }
        .summary-table th, .summary-table td { padding: 10px 15px; }
        .summary-table th { background: #64748b; color: white; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #475569; }
        .summary-table td { border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        .summary-table tr:hover { background: #f8fafc; }
        .score-pass { color: #10b981; font-weight: 600; }
        .score-fail { color: #ef4444; font-weight: 600; }
        
        /* Chart Styles */
        .chart-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .chart-title { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; }
        .chart-simple { padding: 20px; }
        .chart-row { display: flex; align-items: center; margin-bottom: 8px; gap: 10px; }
        .chart-row-label { width: 200px; font-size: 12px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
        .chart-row-bar-container { flex: 1; height: 20px; background: #e2e8f0; border-radius: 4px; position: relative; overflow: visible; }
        .chart-row-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
        .chart-row-bar.bar-pass { background: linear-gradient(90deg, #10b981 0%, #059669 100%); }
        .chart-row-bar.bar-fail { background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); }
        .chart-row-threshold { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #f59e0b; }
        .chart-row-value { width: 50px; font-size: 13px; font-weight: 700; text-align: right; }
        .chart-row-value.bar-pass { color: #10b981; }
        .chart-row-value.bar-fail { color: #ef4444; }
        .chart-legend { display: flex; gap: 20px; justify-content: center; padding: 15px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569; }
        .legend-color { width: 14px; height: 14px; border-radius: 3px; }
        .legend-color.pass { background: #10b981; }
        .legend-color.fail { background: #ef4444; }
        .legend-line { width: 20px; height: 2px; background: #f59e0b; }
        
        /* Toggle controls */
        .toggle-controls { display: flex; gap: 10px; margin-bottom: 20px; justify-content: flex-end; }
        .toggle-btn { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; }
        .toggle-btn:hover { background: #1d4ed8; }
        
        /* Section Styles */
        .section-card { background: white; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section-header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
        .section-header:hover { filter: brightness(1.05); }
        .section-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .section-score { font-size: 20px; font-weight: bold; display: flex; align-items: center; gap: 10px; }
        .collapse-icon { font-size: 20px; transition: transform 0.3s ease; }
        .collapse-icon.collapsed { transform: rotate(-90deg); }
        .section-content { padding: 0; transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease; overflow: hidden; }
        .section-content.collapsed { max-height: 0 !important; padding: 0; opacity: 0; }
        
        /* Table Styles */
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        th { background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }
        tr:hover { background: #f8fafc; }
        .choice-yes { color: #10b981; font-weight: 600; }
        .choice-no { color: #ef4444; font-weight: 600; }
        .choice-partial { color: #f59e0b; font-weight: 600; }
        .choice-na { color: #94a3b8; }
        
        /* Section Findings */
        .section-findings { background: #fef2f2; border-top: 2px solid #fecaca; padding: 12px 15px; }
        .section-findings-title { color: #dc2626; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .finding-item { background: white; border-radius: 8px; padding: 12px; margin-bottom: 8px; border-left: 4px solid #ef4444; }
        .finding-ref { font-weight: 600; color: #1e40af; font-size: 12px; }
        .finding-question { margin: 5px 0; font-size: 14px; }
        .finding-detail { color: #64748b; font-size: 13px; }
        .finding-cr { background: #ecfdf5; border-left: 4px solid #10b981; padding: 10px; margin-top: 8px; border-radius: 4px; font-size: 13px; color: #065f46; }
        .finding-pictures { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        .pictures-wrapper { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
        
        /* Fridge Readings */
        .fridge-section { background: white; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .fridge-header { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; padding: 15px 20px; }
        .fridge-title { font-size: 18px; font-weight: 600; }
        
        /* Gallery Styles */
        .gallery-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .gallery-title { margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; color: white; }
        .gallery-title.good { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .gallery-title.findings { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; padding: 20px; }
        .gallery-card { background: #f8fafc; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; transition: transform 0.2s, box-shadow 0.2s; }
        .gallery-card:hover { transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
        .gallery-card.good { border-left: 4px solid #10b981; }
        .gallery-card.finding { border-left: 4px solid #ef4444; }
        .gallery-img { width: 100%; height: 180px; object-fit: cover; cursor: pointer; background: #e2e8f0; }
        .gallery-info { padding: 12px; }
        .gallery-ref { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .gallery-ref.good { color: #059669; }
        .gallery-ref.finding { color: #dc2626; }
        .gallery-section-name { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .gallery-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; display: inline-block; }
        .gallery-type.good { background: #d1fae5; color: #065f46; }
        .gallery-type.issue { background: #fee2e2; color: #991b1b; }
        .gallery-type.corrective { background: #d1fae5; color: #065f46; }
        .gallery-empty { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 16px; }
        
        /* Lightbox */
        .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; justify-content: center; align-items: center; }
        .lightbox.active { display: flex; }
        .lightbox img { max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); }
        .lightbox-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 40px; font-weight: bold; cursor: pointer; transition: color 0.2s; }
        .lightbox-close:hover { color: #3b82f6; }
        
        /* Filter Toolbar */
        .filter-toolbar {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 12px 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            position: sticky;
            top: 80px;
            z-index: 100;
        }
        .filter-toolbar-title { font-weight: 600; color: #475569; font-size: 14px; }
        .filter-group { display: flex; gap: 8px; }
        .filter-btn {
            padding: 6px 14px;
            border: 2px solid #cbd5e1;
            border-radius: 20px;
            background: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .filter-btn:hover { background: #f1f5f9; }
        .filter-btn.active { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; }
        .filter-btn.filter-yes.active { border-color: #10b981; background: #ecfdf5; color: #059669; }
        .filter-btn.filter-partial.active { border-color: #f59e0b; background: #fffbeb; color: #d97706; }
        .filter-btn.filter-no.active { border-color: #ef4444; background: #fef2f2; color: #dc2626; }
        .filter-btn.filter-na.active { border-color: #64748b; background: #f1f5f9; color: #475569; }
        .filter-divider { width: 1px; height: 30px; background: #cbd5e1; }
        .hidden-by-filter { display: none !important; }
        .section-hidden { display: none !important; }
        
        /* Action Bar */
        .action-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 1000; }
        .action-bar button { padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s; }
        .action-bar button:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .btn-email { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; }
        .btn-print { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; }
        .btn-pdf { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }
        .btn-back { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; }
        
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        
        @media print { 
            @page { size: landscape; margin: 10mm; }
            body { background: white; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { max-width: 100%; padding: 0; }
            .action-bar { display: none !important; }
            .filter-toolbar { display: none !important; }
            .section-card { break-inside: avoid; page-break-inside: avoid; }
            .gallery-section { break-before: page; }
            .lightbox { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn-back" onclick="goBack()">← Back</button>
        <button class="btn-pdf" onclick="exportToPDF()">📄 PDF</button>
        <button class="btn-email" onclick="openEmailModal('full')">📧 Send Report</button>
        <button class="btn-print" onclick="window.print()">🖨️ Print</button>
    </div>
    
    <!-- Lightbox for images -->
    <div class="lightbox" id="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close">&times;</span>
        <img id="lightbox-img" src="" alt="Full size image">
    </div>
    
    <script>
        function goBack() {
            if (document.referrer && document.referrer.includes(window.location.hostname)) {
                history.back();
            } else {
                window.location.href = '/oe-inspection/reports';
            }
        }
        
        function exportToPDF() {
            const overlay = document.createElement('div');
            overlay.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10000;"><div style="background:white;padding:30px 50px;border-radius:12px;text-align:center;"><h3 style="margin:0 0 15px 0;">📄 Export to PDF</h3><p style="margin:0 0 20px 0;color:#666;">In the print dialog, select <strong>"Save as PDF"</strong> as the destination.</p></div></div>';
            document.body.appendChild(overlay);
            setTimeout(() => { overlay.remove(); window.print(); }, 2000);
        }
        
        function openLightbox(src) {
            document.getElementById('lightbox-img').src = src;
            document.getElementById('lightbox').classList.add('active');
        }
        
        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
        }
    </script>
    
    <div class="container">
        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
            <span class="filter-toolbar-title">🔍 Filter:</span>
            <div class="filter-group">
                <button class="filter-btn filter-yes active" onclick="toggleFilter('yes', this)" title="Show/Hide Yes answers">✓ Yes</button>
                <button class="filter-btn filter-partial active" onclick="toggleFilter('partial', this)" title="Show/Hide Partially answers">◐ Partially</button>
                <button class="filter-btn filter-no active" onclick="toggleFilter('no', this)" title="Show/Hide No answers">✗ No</button>
                <button class="filter-btn filter-na active" onclick="toggleFilter('na', this)" title="Show/Hide N/A answers">— N/A</button>
            </div>
            <div class="filter-divider"></div>
            <div class="filter-group">
                <button class="filter-btn" onclick="showOnlyFindings()" title="Show only items with findings">⚠️ Findings Only</button>
                <button class="filter-btn" onclick="resetFilters()" title="Reset all filters">🔄 Reset</button>
            </div>
        </div>
        
        <div class="header">
            <h1>📋 OE Inspection Report</h1>
            <div class="header-info">
                <div class="header-item"><label>Document #</label><span>${audit.DocumentNumber}</span></div>
                <div class="header-item"><label>Store</label><span>${audit.StoreName}</span></div>
                <div class="header-item"><label>Date</label><span>${new Date(audit.InspectionDate).toLocaleDateString()}</span></div>
                <div class="header-item"><label>Inspectors</label><span>${audit.Inspectors || 'N/A'}</span></div>
                <div class="header-item"><label>Accompanied By</label><span>${audit.AccompaniedBy || 'N/A'}</span></div>
                <div class="header-item"><label>Status</label><span>${audit.Status}</span></div>
            </div>
        </div>
        
        <div class="score-card">
            <div class="score-value ${passedClass}">${overallScore}%</div>
            <div class="score-label ${passedClass}">${passedText}</div>
            <div class="score-threshold">Threshold: ${threshold}%</div>
        </div>
        
        <!-- Summary Table -->
        <div class="summary-section">
            <h2 class="summary-title">📊 Audit Summary</h2>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Section</th>
                        <th style="text-align:right;">Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${sections.map(section => {
                        const sectionThreshold = section.PassingGrade || threshold;
                        const sectionPassed = section.Percentage >= sectionThreshold;
                        const scoreClass = sectionPassed ? 'score-pass' : 'score-fail';
                        return `
                        <tr>
                            <td><strong>${section.SectionName}</strong></td>
                            <td style="text-align:right;"><strong class="${scoreClass}">${section.Percentage}%</strong></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Chart -->
        <div class="chart-section">
            <h2 class="chart-title">📊 Section Scores Overview</h2>
            <div class="chart-simple">
                ${sections.map(section => {
                    const sectionThreshold = section.PassingGrade || threshold;
                    const barClass = section.Percentage >= sectionThreshold ? 'bar-pass' : 'bar-fail';
                    return `
                    <div class="chart-row">
                        <div class="chart-row-label">${section.SectionName}</div>
                        <div class="chart-row-bar-container">
                            <div class="chart-row-bar ${barClass}" style="width: ${section.Percentage}%;"></div>
                            <div class="chart-row-threshold" style="left: ${sectionThreshold}%;"></div>
                        </div>
                        <div class="chart-row-value ${barClass}">${section.Percentage}%</div>
                    </div>
                    `;
                }).join('')}
            </div>
            <div class="chart-legend">
                <span class="legend-item"><span class="legend-color pass"></span> Pass (≥threshold)</span>
                <span class="legend-item"><span class="legend-color fail"></span> Fail (&lt;threshold)</span>
                <span class="legend-item"><span class="legend-line"></span> Section Threshold</span>
            </div>
        </div>
        
        <div class="toggle-controls">
            <button class="toggle-btn" onclick="expandAll()">📂 Expand All</button>
            <button class="toggle-btn" onclick="collapseAll()">📁 Collapse All</button>
        </div>
        
        ${sections.map((section, sectionIdx) => {
            const sectionFindings = (section.items || []).filter(item => 
                item.Answer === 'No' || item.Answer === 'Partially'
            );
            
            return `
        <div class="section-card">
            <div class="section-header" onclick="toggleSection(${sectionIdx})">
                <div class="section-title">
                    <span class="collapse-icon" id="icon-${sectionIdx}">▼</span>
                    ${section.SectionName}
                </div>
                <div class="section-score">${section.Percentage}%</div>
            </div>
            <div class="section-content" id="section-${sectionIdx}">
                <table>
                    <thead>
                        <tr>
                            <th style="width:60px">#</th>
                            <th>Question</th>
                            <th style="width:80px">Answer</th>
                            <th style="width:80px">Score</th>
                            <th style="width:90px">Observation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(section.items || []).map(item => {
                            const answerType = item.Answer === 'Yes' ? 'Yes' : item.Answer === 'No' ? 'No' : item.Answer === 'Partially' ? 'Partially' : 'NA';
                            const itemPics = pictures[item.Id] || [];
                            const goodPics = itemPics.filter(p => p.pictureType === 'Good');
                            const goodPicsHtml = goodPics.length > 0 
                                ? goodPics.map(p => '<img src="' + p.dataUrl + '" alt="Good" title="Good Observation" style="max-width:50px;max-height:40px;border-radius:4px;cursor:pointer;border:2px solid #10b981;object-fit:cover;" onclick="openLightbox(this.src)">').join('') 
                                : '-';
                            return `
                        <tr data-answer="${answerType}">
                            <td>${item.ReferenceValue || '-'}</td>
                            <td>${item.Question || '-'}</td>
                            <td class="${item.Answer === 'Yes' ? 'choice-yes' : item.Answer === 'No' ? 'choice-no' : item.Answer === 'Partially' ? 'choice-partial' : 'choice-na'}">${item.Answer || '-'}</td>
                            <td>${item.Score ?? '-'} / ${item.Coefficient || 0}</td>
                            <td>${goodPicsHtml}</td>
                        </tr>
                        `}).join('')}
                    </tbody>
                </table>
                ${sectionFindings.length > 0 ? `
                <div class="section-findings">
                    <div class="section-findings-title">⚠️ Findings (${sectionFindings.length})</div>
                    ${sectionFindings.map(f => {
                        const itemPics = pictures[f.Id] || [];
                        const correctiveHtml = f.CorrectedAction ? '<div class="finding-cr">✅ Corrective Action: ' + f.CorrectedAction + '</div>' : '';
                        const picsHtml = itemPics.length > 0 
                            ? '<div class="finding-pictures"><strong>Photos:</strong><div class="pictures-wrapper">' + 
                              itemPics.map(p => '<img src="' + p.dataUrl + '" alt="' + (p.fileName || 'Photo') + '" title="' + (p.pictureType || 'Photo') + '" style="max-width:100px;max-height:75px;border-radius:4px;cursor:pointer;border:2px solid ' + (p.pictureType === 'Good' || p.pictureType === 'corrective' ? '#10b981' : '#ef4444') + ';" onclick="openLightbox(this.src)">').join('') + 
                              '</div></div>' 
                            : '';
                        return `
                    <div class="finding-item">
                        <div class="finding-ref">[${f.ReferenceValue || 'N/A'}]</div>
                        <div class="finding-question">${f.Question}</div>
                        <div class="finding-detail">Answer: <strong class="${f.Answer === 'No' ? 'choice-no' : 'choice-partial'}">${f.Answer}</strong> | Finding: ${f.Finding || 'N/A'}</div>
                        ${correctiveHtml}
                        ${picsHtml}
                    </div>
                    `}).join('')}
                </div>
                ` : ''}
            </div>
        </div>
        `}).join('')}
        
        ${fridgeReadings.length > 0 ? `
        <div class="fridge-section">
            <div class="fridge-header">
                <div class="fridge-title">🌡️ Fridge Temperature Readings</div>
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
        
        <!-- Good Observations Gallery -->
        <div class="gallery-section">
            <h2 class="gallery-title good">✅ Good Observations Gallery (${goodObsItems.length})</h2>
            ${goodObsItems.length > 0 ? `
            <div class="gallery-grid">
                ${goodObsItems.map(item => `
                <div class="gallery-card good">
                    <img src="${item.dataUrl}" alt="Good Observation" class="gallery-img" onclick="openLightbox(this.src)">
                    <div class="gallery-info">
                        <div class="gallery-ref good">[${item.ref}]</div>
                        <div class="gallery-section-name">📋 ${item.section}</div>
                        <span class="gallery-type good">✅ Good Observation</span>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `<div class="gallery-empty">No good observations captured</div>`}
        </div>
        
        <!-- Findings Gallery -->
        <div class="gallery-section">
            <h2 class="gallery-title findings">⚠️ Findings Gallery (${findingPicItems.length})</h2>
            ${findingPicItems.length > 0 ? `
            <div class="gallery-grid">
                ${findingPicItems.map(item => `
                <div class="gallery-card finding">
                    <img src="${item.dataUrl}" alt="Finding" class="gallery-img" onclick="openLightbox(this.src)">
                    <div class="gallery-info">
                        <div class="gallery-ref finding">[${item.ref}]</div>
                        <div class="gallery-section-name">📋 ${item.section}</div>
                        <span class="gallery-type ${item.pictureType === 'corrective' ? 'corrective' : 'issue'}">${item.pictureType === 'corrective' ? '✅ Corrective' : '⚠️ Issue'}</span>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `<div class="gallery-empty">No finding photos captured</div>`}
        </div>
        
        <div class="footer">
            Report generated on ${new Date(generatedAt).toLocaleString()} | OE Inspection System
        </div>
    </div>
    
    <script>
        const auditId = ${audit.Id};
        
        // Section collapse/expand
        function toggleSection(index) {
            const content = document.getElementById('section-' + index);
            const icon = document.getElementById('icon-' + index);
            
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                icon.classList.remove('collapsed');
            } else {
                content.classList.add('collapsed');
                icon.classList.add('collapsed');
            }
        }
        
        function expandAll() {
            document.querySelectorAll('.section-content').forEach(el => el.classList.remove('collapsed'));
            document.querySelectorAll('.collapse-icon').forEach(el => el.classList.remove('collapsed'));
        }
        
        function collapseAll() {
            document.querySelectorAll('.section-content').forEach(el => el.classList.add('collapsed'));
            document.querySelectorAll('.collapse-icon').forEach(el => el.classList.add('collapsed'));
        }
        
        // Filter functionality
        const filters = { yes: true, partial: true, no: true, na: true };
        
        function toggleFilter(type, btn) {
            filters[type] = !filters[type];
            btn.classList.toggle('active', filters[type]);
            applyFilters();
        }
        
        function applyFilters() {
            document.querySelectorAll('tr[data-answer]').forEach(row => {
                const answer = row.dataset.answer;
                let show = false;
                
                if (answer === 'Yes' && filters.yes) show = true;
                if (answer === 'Partially' && filters.partial) show = true;
                if (answer === 'No' && filters.no) show = true;
                if (answer === 'NA' && filters.na) show = true;
                
                row.classList.toggle('hidden-by-filter', !show);
            });
            
            // Hide sections that have no visible rows
            document.querySelectorAll('.section-card').forEach(section => {
                const visibleRows = section.querySelectorAll('tr[data-answer]:not(.hidden-by-filter)');
                section.classList.toggle('section-hidden', visibleRows.length === 0);
            });
        }
        
        function showOnlyFindings() {
            filters.yes = false;
            filters.na = false;
            filters.partial = true;
            filters.no = true;
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                if (btn.classList.contains('filter-yes')) btn.classList.remove('active');
                if (btn.classList.contains('filter-na')) btn.classList.remove('active');
                if (btn.classList.contains('filter-partial')) btn.classList.add('active');
                if (btn.classList.contains('filter-no')) btn.classList.add('active');
            });
            
            applyFilters();
        }
        
        function resetFilters() {
            filters.yes = true;
            filters.partial = true;
            filters.no = true;
            filters.na = true;
            
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.add('active'));
            document.querySelectorAll('tr[data-answer]').forEach(row => row.classList.remove('hidden-by-filter'));
            document.querySelectorAll('.section-card').forEach(section => section.classList.remove('section-hidden'));
        }
        
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
                    .query("SELECT SettingValue FROM OE_EscalationSettings WHERE SettingKey = 'ActionPlanDeadlineDays'");
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
                ORDER BY a.Priority DESC, 
                    CAST(PARSENAME(REPLACE(a.ReferenceValue, '-', '.'), 2) AS INT),
                    CAST(PARSENAME(REPLACE(a.ReferenceValue, '-', '.'), 1) AS INT)
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

// Get email template for verification notification
router.get('/api/verification/email-template/:actionItemId', async (req, res) => {
    try {
        const { actionItemId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get action item details with inspection and store info
        const itemResult = await pool.request()
            .input('actionItemId', sql.Int, actionItemId)
            .query(`
                SELECT ai.*, i.DocumentNumber, i.StoreName, i.StoreCode, i.InspectionDate,
                       s.SectionName, v.VerificationStatus, v.VerificationNotes, v.VerifiedAt,
                       u.DisplayName as VerifiedByName, u.Email as VerifiedByEmail,
                       sm.Email as StoreManagerEmail, sm.DisplayName as StoreManagerName
                FROM OE_InspectionActionItems ai
                JOIN OE_Inspections i ON ai.InspectionId = i.Id
                LEFT JOIN OE_InspectionSections s ON ai.SectionId = s.Id
                LEFT JOIN OE_ActionItemVerification v ON ai.Id = v.ActionItemId
                LEFT JOIN Users u ON v.VerifiedBy = u.Id
                LEFT JOIN Stores st ON i.StoreId = st.Id
                LEFT JOIN Users sm ON st.ManagerId = sm.Id
                WHERE ai.Id = @actionItemId
            `);
        
        if (itemResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Action item not found' });
        }
        
        const item = itemResult.recordset[0];
        
        // Get email template
        const templateResult = await pool.request()
            .input('templateKey', sql.NVarChar, 'OE_VERIFICATION_SUBMITTED')
            .query('SELECT SubjectTemplate, BodyTemplate FROM EmailTemplates WHERE TemplateKey = @templateKey');
        
        await pool.close();
        
        if (templateResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Email template not found' });
        }
        
        const template = templateResult.recordset[0];
        
        // Prepare template variables
        const variables = {
            storeName: item.StoreName || '',
            storeCode: item.StoreCode || '',
            documentNumber: item.DocumentNumber || '',
            sectionName: item.SectionName || 'N/A',
            findingDescription: item.Finding || item.ReferenceValue || 'N/A',
            submittedBy: item.VerifiedByName || req.session?.user?.name || 'Inspector',
            submittedAt: item.VerifiedAt ? new Date(item.VerifiedAt).toLocaleString('en-GB') : new Date().toLocaleString('en-GB'),
            verificationNotes: item.VerificationNotes || 'No notes provided',
            verificationUrl: `https://oeapp.gmrlapps.com/oe-inspection/implementation-verification/${item.InspectionId}`,
            recipientName: item.StoreManagerName || 'Store Manager',
            year: new Date().getFullYear().toString()
        };
        
        // Replace variables in template
        let subject = template.SubjectTemplate;
        let html = template.BodyTemplate;
        
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            html = html.replace(regex, value);
        }
        
        res.json({ 
            success: true, 
            subject, 
            html, 
            storeManagerEmail: item.StoreManagerEmail || '' 
        });
    } catch (error) {
        console.error('Error loading email template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send verification email
router.post('/api/verification/send-email', async (req, res) => {
    try {
        const { actionItemId, toEmail, subject, html } = req.body;
        
        if (!toEmail || !subject || !html) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Use email service to send email
        const emailService = require('../../services/email-service');
        
        await emailService.sendEmail({
            to: toEmail,
            subject: subject,
            html: html,
            from: req.session?.user?.email || 'noreply@gmrlapps.com'
        }, req);
        
        // Log the email
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('actionItemId', sql.Int, actionItemId)
            .input('toEmail', sql.NVarChar, toEmail)
            .input('subject', sql.NVarChar, subject)
            .input('sentBy', sql.Int, req.session?.user?.id || null)
            .query(`
                INSERT INTO OE_VerificationEmailLog (ActionItemId, ToEmail, Subject, SentBy, SentAt)
                VALUES (@actionItemId, @toEmail, @subject, @sentBy, GETDATE())
            `);
        await pool.close();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get email template for FULL inspection verification (all action items)
router.get('/api/verification/email-template-full/:inspectionId', async (req, res) => {
    try {
        const { inspectionId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get inspection details with store manager from StoreManagerAssignments
        const inspectionResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT i.*, 
                       sm.Email as StoreManagerEmail, sm.DisplayName as StoreManagerName
                FROM OE_Inspections i
                LEFT JOIN Stores st ON i.StoreId = st.Id
                LEFT JOIN StoreManagerAssignments sma ON st.Id = sma.StoreId AND sma.IsPrimary = 1
                LEFT JOIN Users sm ON sma.UserId = sm.Id
                WHERE i.Id = @inspectionId
            `);
        
        if (inspectionResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Inspection not found' });
        }
        
        const inspection = inspectionResult.recordset[0];
        
        // Get all action items with verification status
        const actionItemsResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT ai.Id, ai.SectionName, ai.ReferenceValue, ai.Finding, ai.Action, 
                       ai.Status, ai.Priority, ai.Deadline,
                       v.VerificationStatus, v.VerificationNotes, v.VerifiedAt,
                       u.DisplayName as VerifiedByName
                FROM OE_InspectionActionItems ai
                LEFT JOIN OE_ActionItemVerification v ON ai.Id = v.ActionItemId
                LEFT JOIN Users u ON v.VerifiedBy = u.Id
                WHERE ai.InspectionId = @inspectionId
                ORDER BY ai.SectionName, ai.Id
            `);
        
        await pool.close();
        
        const actionItems = actionItemsResult.recordset;
        const verifiedComplete = actionItems.filter(i => i.VerificationStatus === 'Verified Complete').length;
        const verifiedNotComplete = actionItems.filter(i => i.VerificationStatus === 'Verified Not Complete').length;
        const pending = actionItems.filter(i => !i.VerificationStatus).length;
        
        // Build custom HTML email with all action items
        const subject = '[OE] Verification Summary - ' + inspection.StoreName + ' - ' + inspection.DocumentNumber;
        
        const html = buildVerificationSummaryEmail(inspection, actionItems, {
            verifiedComplete,
            verifiedNotComplete,
            pending,
            submittedBy: req.session?.user?.name || 'Inspector'
        });
        
        res.json({ 
            success: true, 
            subject, 
            html, 
            storeManagerEmail: inspection.StoreManagerEmail || '' 
        });
    } catch (error) {
        console.error('Error loading full email template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to build verification summary email
function buildVerificationSummaryEmail(inspection, actionItems, stats) {
    const itemsHtml = actionItems.map(item => {
        let statusBadge = '<span style="background:#fef3c7;color:#d97706;padding:4px 10px;border-radius:12px;font-size:12px;">⏳ Pending</span>';
        if (item.VerificationStatus === 'Verified Complete') {
            statusBadge = '<span style="background:#d1fae5;color:#059669;padding:4px 10px;border-radius:12px;font-size:12px;">✅ Complete</span>';
        } else if (item.VerificationStatus === 'Verified Not Complete') {
            statusBadge = '<span style="background:#fee2e2;color:#dc2626;padding:4px 10px;border-radius:12px;font-size:12px;">❌ Not Complete</span>';
        }
        
        return '<tr style="border-bottom:1px solid #eee;">' +
            '<td style="padding:12px;">' + (item.SectionName || 'N/A') + '</td>' +
            '<td style="padding:12px;">' + (item.Finding || item.ReferenceValue || 'N/A') + '</td>' +
            '<td style="padding:12px;">' + statusBadge + '</td>' +
            '<td style="padding:12px;font-size:12px;color:#666;">' + (item.VerificationNotes || '-') + '</td>' +
            '</tr>';
    }).join('');
    
    return '<!DOCTYPE html>' +
        '<html><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;">' +
        '<div style="max-width:700px;margin:20px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
        '<div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;padding:30px;text-align:center;">' +
        '<h1 style="margin:0;font-size:24px;">✅ Verification Summary</h1>' +
        '<div style="margin-top:8px;opacity:0.9;">' + inspection.StoreName + '</div>' +
        '</div>' +
        '<div style="padding:30px;">' +
        '<p>Dear Store Manager,</p>' +
        '<p>Please find below the verification summary for the following inspection:</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:20px 0;">' +
        '<tr><td style="padding:12px;border-bottom:1px solid #eee;color:#666;width:40%;">Document Number</td><td style="padding:12px;border-bottom:1px solid #eee;font-weight:600;">' + inspection.DocumentNumber + '</td></tr>' +
        '<tr><td style="padding:12px;border-bottom:1px solid #eee;color:#666;">Store</td><td style="padding:12px;border-bottom:1px solid #eee;font-weight:600;">' + inspection.StoreName + '</td></tr>' +
        '<tr><td style="padding:12px;border-bottom:1px solid #eee;color:#666;">Inspection Date</td><td style="padding:12px;border-bottom:1px solid #eee;font-weight:600;">' + new Date(inspection.InspectionDate).toLocaleDateString('en-GB') + '</td></tr>' +
        '</table>' +
        '<div style="display:flex;gap:15px;margin:25px 0;text-align:center;">' +
        '<div style="flex:1;background:#d1fae5;padding:15px;border-radius:10px;"><div style="font-size:28px;font-weight:700;color:#059669;">' + stats.verifiedComplete + '</div><div style="font-size:12px;color:#059669;">Verified Complete</div></div>' +
        '<div style="flex:1;background:#fee2e2;padding:15px;border-radius:10px;"><div style="font-size:28px;font-weight:700;color:#dc2626;">' + stats.verifiedNotComplete + '</div><div style="font-size:12px;color:#dc2626;">Not Complete</div></div>' +
        '<div style="flex:1;background:#fef3c7;padding:15px;border-radius:10px;"><div style="font-size:28px;font-weight:700;color:#d97706;">' + stats.pending + '</div><div style="font-size:12px;color:#d97706;">Pending</div></div>' +
        '</div>' +
        '<h3 style="margin-top:30px;border-bottom:2px solid #10b981;padding-bottom:10px;">📋 Action Items</h3>' +
        '<table style="width:100%;border-collapse:collapse;margin-top:15px;">' +
        '<thead><tr style="background:#f8f9fa;"><th style="padding:12px;text-align:left;font-size:13px;color:#555;">Section</th><th style="padding:12px;text-align:left;font-size:13px;color:#555;">Finding</th><th style="padding:12px;text-align:left;font-size:13px;color:#555;">Status</th><th style="padding:12px;text-align:left;font-size:13px;color:#555;">Notes</th></tr></thead>' +
        '<tbody>' + itemsHtml + '</tbody></table>' +
        '<div style="text-align:center;margin:30px 0;">' +
        '<a href="https://oeapp.gmrlapps.com/oe-inspection/implementation-verification/' + inspection.Id + '" style="display:inline-block;padding:14px 30px;background:#10b981;color:white;text-decoration:none;border-radius:8px;font-weight:600;">🔍 View Full Details</a>' +
        '</div>' +
        '<p style="color:#666;font-size:14px;">Verified by: ' + stats.submittedBy + '</p>' +
        '</div>' +
        '<div style="background:#f8f9fa;padding:20px;text-align:center;color:#666;font-size:13px;">' +
        '<p>This is an automated message from the Operational Excellence Application.</p>' +
        '<p>© ' + new Date().getFullYear() + ' GMRL Apps</p>' +
        '</div></div></body></html>';
}

// Send FULL inspection verification email
router.post('/api/verification/send-email-full', async (req, res) => {
    try {
        const { inspectionId, toEmail, subject, html } = req.body;
        
        if (!toEmail || !subject || !html) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Use email service to send email
        const emailService = require('../../services/email-service');
        
        await emailService.sendEmail({
            to: toEmail,
            subject: subject,
            html: html,
            from: req.session?.user?.email || 'noreply@gmrlapps.com'
        }, req);
        
        // Log the email
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .input('toEmail', sql.NVarChar, toEmail)
            .input('subject', sql.NVarChar, subject)
            .input('sentBy', sql.Int, req.session?.user?.id || null)
            .query(`
                INSERT INTO OE_VerificationEmailLog (InspectionId, ToEmail, Subject, SentBy, SentAt)
                VALUES (@inspectionId, @toEmail, @subject, @sentBy, GETDATE())
            `);
        await pool.close();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Email Report Endpoints
// ==========================================

const emailService = require('../../services/email-service');
const emailTemplateBuilder = require('../../services/email-template-builder');
const { getFreshAccessToken } = require('../../auth/auth-server');

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
        
        // Handle both array format (from email modal) and object format
        let toRecipient;
        if (Array.isArray(to) && to.length > 0) {
            toRecipient = to[0]; // Take first recipient
        } else if (to && to.email) {
            toRecipient = to;
        }
        
        if (!toRecipient || !toRecipient.email) {
            return res.status(400).json({ error: 'Recipient (to) is required' });
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
        
        // Get fresh access token for the current user (refreshes if expired)
        let accessToken;
        try {
            accessToken = await getFreshAccessToken(req.currentUser);
        } catch (tokenError) {
            console.error('[OE] Token refresh failed:', tokenError.message);
            return res.status(401).json({ 
                success: false, 
                error: 'Your session has expired. Please log out and log in again.',
                needsRelogin: true 
            });
        }
        
        // Send email from the logged-in user's account
        const emailResult = await emailService.sendEmail({
            to: toRecipient.email,
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
            .input('sentBy', sql.Int, req.currentUser?.userId || 0)
            .input('sentByEmail', sql.NVarChar, req.currentUser?.email || 'Unknown')
            .input('sentByName', sql.NVarChar, req.currentUser?.displayName || 'Unknown')
            .input('sentTo', sql.NVarChar, JSON.stringify([toRecipient]))
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

// ==========================================
// Cycle Dashboard API Routes
// ==========================================

// Get cycle progress per brand
router.get('/api/cycle/progress', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all brands with their store counts (including stores WITH brands assigned)
        const brandsResult = await pool.request().query(`
            SELECT b.Id as BrandId, b.BrandName, b.BrandCode,
                   COUNT(DISTINCT s.Id) as TotalStores
            FROM Brands b
            LEFT JOIN Stores s ON b.Id = s.BrandId AND s.IsActive = 1
            WHERE b.IsActive = 1
            GROUP BY b.Id, b.BrandName, b.BrandCode
            ORDER BY b.BrandName
        `);
        
        // Also get count of stores WITHOUT a brand (NULL BrandId)
        const unassignedResult = await pool.request().query(`
            SELECT COUNT(*) as TotalStores
            FROM Stores s
            WHERE s.BrandId IS NULL AND s.IsActive = 1
        `);
        const unassignedCount = unassignedResult.recordset[0].TotalStores;
        
        // For each brand, calculate current cycle based on completed audits
        // Cycle = minimum number of times any store has been audited + 1 (current working cycle)
        // Stores with audits = min are "pending", stores with audits > min are "done for current cycle"
        const progress = [];
        
        for (const brand of brandsResult.recordset) {
            if (brand.TotalStores === 0) {
                progress.push({
                    brandId: brand.BrandId,
                    brandName: brand.BrandName,
                    brandCode: brand.BrandCode,
                    totalStores: 0,
                    auditedStores: 0,
                    pendingStores: 0,
                    currentCycle: 1,
                    completedCycles: 0,
                    percentage: 0
                });
                continue;
            }
            
            // Count completed audits per store for this brand
            const storeAuditsResult = await pool.request()
                .input('brandId', sql.Int, brand.BrandId)
                .query(`
                    SELECT s.Id as StoreId, s.StoreName,
                           COUNT(i.Id) as AuditCount
                    FROM Stores s
                    LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                    WHERE s.BrandId = @brandId AND s.IsActive = 1
                    GROUP BY s.Id, s.StoreName
                `);
            
            const storeAudits = storeAuditsResult.recordset;
            
            // Find minimum audit count across all stores (completed cycles)
            const minAudits = Math.min(...storeAudits.map(s => s.AuditCount));
            const currentCycle = minAudits + 1;
            
            // Count stores that have been audited in the current cycle
            // (stores with AuditCount > minAudits are done for current cycle)
            const auditedInCurrentCycle = storeAudits.filter(s => s.AuditCount > minAudits).length;
            const pendingInCurrentCycle = brand.TotalStores - auditedInCurrentCycle;
            
            const percentage = brand.TotalStores > 0 
                ? Math.round(auditedInCurrentCycle / brand.TotalStores * 100) 
                : 0;
            
            progress.push({
                brandId: brand.BrandId,
                brandName: brand.BrandName,
                brandCode: brand.BrandCode,
                totalStores: brand.TotalStores,
                auditedStores: auditedInCurrentCycle,
                pendingStores: pendingInCurrentCycle,
                currentCycle: currentCycle,
                completedCycles: minAudits,
                percentage: percentage
            });
        }
        
        // Add "Unassigned" category for stores without a brand
        if (unassignedCount > 0) {
            const unassignedAuditsResult = await pool.request().query(`
                SELECT s.Id as StoreId, s.StoreName,
                       COUNT(i.Id) as AuditCount
                FROM Stores s
                LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                WHERE s.BrandId IS NULL AND s.IsActive = 1
                GROUP BY s.Id, s.StoreName
            `);
            
            const unassignedAudits = unassignedAuditsResult.recordset;
            const minUnassignedAudits = unassignedAudits.length > 0 
                ? Math.min(...unassignedAudits.map(s => s.AuditCount)) 
                : 0;
            const unassignedCurrentCycle = minUnassignedAudits + 1;
            const unassignedAuditedInCycle = unassignedAudits.filter(s => s.AuditCount > minUnassignedAudits).length;
            const unassignedPending = unassignedCount - unassignedAuditedInCycle;
            
            progress.push({
                brandId: 0,  // Special ID for unassigned
                brandName: '⚠️ Unassigned Stores',
                brandCode: 'UNASSIGNED',
                totalStores: unassignedCount,
                auditedStores: unassignedAuditedInCycle,
                pendingStores: unassignedPending,
                currentCycle: unassignedCurrentCycle,
                completedCycles: minUnassignedAudits,
                percentage: unassignedCount > 0 ? Math.round(unassignedAuditedInCycle / unassignedCount * 100) : 0
            });
        }
        
        // Calculate overall stats
        const totalStores = progress.reduce((sum, b) => sum + b.totalStores, 0);
        const totalAudited = progress.reduce((sum, b) => sum + b.auditedStores, 0);
        const totalPending = progress.reduce((sum, b) => sum + b.pendingStores, 0);
        const overallPercentage = totalStores > 0 ? Math.round(totalAudited / totalStores * 100) : 0;
        
        res.json({
            success: true,
            data: {
                brands: progress,
                overall: {
                    totalStores,
                    auditedStores: totalAudited,
                    pendingStores: totalPending,
                    percentage: overallPercentage
                }
            }
        });
    } catch (error) {
        console.error('Error getting cycle progress:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending stores for a brand's current cycle
router.get('/api/cycle/pending-stores', async (req, res) => {
    try {
        const { brandId } = req.query;
        const pool = await sql.connect(dbConfig);
        
        if (brandId === undefined || brandId === '') {
            return res.status(400).json({ success: false, error: 'brandId is required' });
        }
        
        const brandIdInt = parseInt(brandId);
        const isUnassigned = brandIdInt === 0;
        
        // Get all stores for this brand (or unassigned) with their audit counts
        let storeAuditsResult;
        if (isUnassigned) {
            storeAuditsResult = await pool.request().query(`
                SELECT s.Id as StoreId, s.StoreName, s.StoreCode, s.Location,
                       'Unassigned' as BrandName, 'N/A' as BrandCode, 0 as BrandId,
                       COUNT(i.Id) as AuditCount
                FROM Stores s
                LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                WHERE s.BrandId IS NULL AND s.IsActive = 1
                GROUP BY s.Id, s.StoreName, s.StoreCode, s.Location
            `);
        } else {
            storeAuditsResult = await pool.request()
                .input('brandId', sql.Int, brandIdInt)
                .query(`
                    SELECT s.Id as StoreId, s.StoreName, s.StoreCode, s.Location,
                           b.BrandName, b.BrandCode, b.Id as BrandId,
                           COUNT(i.Id) as AuditCount
                    FROM Stores s
                    INNER JOIN Brands b ON s.BrandId = b.Id
                    LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                    WHERE s.BrandId = @brandId AND s.IsActive = 1 AND b.IsActive = 1
                    GROUP BY s.Id, s.StoreName, s.StoreCode, s.Location, b.BrandName, b.BrandCode, b.Id
                `);
        }
        
        const storeAudits = storeAuditsResult.recordset;
        
        if (storeAudits.length === 0) {
            return res.json({
                success: true,
                data: {
                    currentCycle: 1,
                    pendingStores: []
                }
            });
        }
        
        // Find minimum audit count (completed cycles)
        const minAudits = Math.min(...storeAudits.map(s => s.AuditCount));
        const currentCycle = minAudits + 1;
        
        // Pending stores are those with AuditCount = minAudits (not yet audited in current cycle)
        const pendingStores = storeAudits
            .filter(s => s.AuditCount === minAudits)
            .map(s => ({
                StoreId: s.StoreId,
                StoreName: s.StoreName,
                StoreCode: s.StoreCode,
                Location: s.Location,
                BrandName: s.BrandName,
                BrandCode: s.BrandCode,
                BrandId: s.BrandId,
                TotalAudits: s.AuditCount
            }));
        
        res.json({
            success: true,
            data: {
                currentCycle: currentCycle,
                pendingStores: pendingStores
            }
        });
    } catch (error) {
        console.error('Error getting pending stores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get audited stores for a brand's current cycle
router.get('/api/cycle/audited-stores', async (req, res) => {
    try {
        const { brandId } = req.query;
        const pool = await sql.connect(dbConfig);
        
        if (brandId === undefined || brandId === '') {
            return res.status(400).json({ success: false, error: 'brandId is required' });
        }
        
        const brandIdInt = parseInt(brandId);
        const isUnassigned = brandIdInt === 0;
        
        // First, find the current cycle for this brand
        let storeAuditsResult;
        if (isUnassigned) {
            storeAuditsResult = await pool.request().query(`
                SELECT s.Id as StoreId, COUNT(i.Id) as AuditCount
                FROM Stores s
                LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                WHERE s.BrandId IS NULL AND s.IsActive = 1
                GROUP BY s.Id
            `);
        } else {
            storeAuditsResult = await pool.request()
                .input('brandId', sql.Int, brandIdInt)
                .query(`
                    SELECT s.Id as StoreId, COUNT(i.Id) as AuditCount
                    FROM Stores s
                    LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                    WHERE s.BrandId = @brandId AND s.IsActive = 1
                    GROUP BY s.Id
                `);
        }
        
        const storeAudits = storeAuditsResult.recordset;
        
        if (storeAudits.length === 0) {
            return res.json({
                success: true,
                data: {
                    currentCycle: 1,
                    auditedStores: []
                }
            });
        }
        
        // Find minimum audit count (completed cycles)
        const minAudits = Math.min(...storeAudits.map(s => s.AuditCount));
        const currentCycle = minAudits + 1;
        
        // Get stores that have been audited in current cycle (AuditCount > minAudits)
        // We need to get the LAST audit for each store that pushed them into current cycle completion
        let auditedResult;
        if (isUnassigned) {
            auditedResult = await pool.request()
                .input('minAudits', sql.Int, minAudits)
                .query(`
                    WITH StoreAuditCounts AS (
                        SELECT s.Id as StoreId, COUNT(i.Id) as AuditCount
                        FROM Stores s
                        LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                        WHERE s.BrandId IS NULL AND s.IsActive = 1
                        GROUP BY s.Id
                        HAVING COUNT(i.Id) > @minAudits
                    ),
                    LatestAudits AS (
                        SELECT i.*, ROW_NUMBER() OVER (PARTITION BY i.StoreId ORDER BY i.CompletedAt DESC, i.Id DESC) as rn
                        FROM OE_Inspections i
                        INNER JOIN StoreAuditCounts sac ON i.StoreId = sac.StoreId
                        WHERE i.Status = 'Completed'
                    )
                    SELECT la.Id as InspectionId, la.DocumentNumber, la.StoreId, la.StoreName,
                           la.InspectionDate, la.Score, la.Inspectors, la.CompletedAt,
                           s.StoreCode, s.Location,
                           'Unassigned' as BrandName, 'N/A' as BrandCode, 0 as BrandId
                    FROM LatestAudits la
                    INNER JOIN Stores s ON la.StoreId = s.Id
                    WHERE la.rn = 1
                    ORDER BY la.CompletedAt DESC, la.InspectionDate DESC
                `);
        } else {
            auditedResult = await pool.request()
                .input('brandId', sql.Int, brandIdInt)
                .input('minAudits', sql.Int, minAudits)
                .query(`
                    WITH StoreAuditCounts AS (
                        SELECT s.Id as StoreId, COUNT(i.Id) as AuditCount
                        FROM Stores s
                        LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                        WHERE s.BrandId = @brandId AND s.IsActive = 1
                        GROUP BY s.Id
                        HAVING COUNT(i.Id) > @minAudits
                    ),
                    LatestAudits AS (
                        SELECT i.*, ROW_NUMBER() OVER (PARTITION BY i.StoreId ORDER BY i.CompletedAt DESC, i.Id DESC) as rn
                        FROM OE_Inspections i
                        INNER JOIN StoreAuditCounts sac ON i.StoreId = sac.StoreId
                        WHERE i.Status = 'Completed'
                    )
                    SELECT la.Id as InspectionId, la.DocumentNumber, la.StoreId, la.StoreName,
                           la.InspectionDate, la.Score, la.Inspectors, la.CompletedAt,
                           s.StoreCode, s.Location,
                           b.BrandName, b.BrandCode, b.Id as BrandId
                    FROM LatestAudits la
                    INNER JOIN Stores s ON la.StoreId = s.Id
                    INNER JOIN Brands b ON s.BrandId = b.Id
                    WHERE la.rn = 1
                    ORDER BY la.CompletedAt DESC, la.InspectionDate DESC
                `);
        }
        
        res.json({
            success: true,
            data: {
                currentCycle: currentCycle,
                auditedStores: auditedResult.recordset
            }
        });
    } catch (error) {
        console.error('Error getting audited stores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current cycle info for a specific store
router.get('/api/cycle/store/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get the store's brand
        const storeResult = await pool.request()
            .input('storeId', sql.Int, storeId)
            .query(`
                SELECT s.Id as StoreId, s.StoreName, s.BrandId, b.BrandName
                FROM Stores s
                INNER JOIN Brands b ON s.BrandId = b.Id
                WHERE s.Id = @storeId
            `);
        
        if (storeResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }
        
        const store = storeResult.recordset[0];
        
        // Get audit counts for all stores in this brand
        const storeAuditsResult = await pool.request()
            .input('brandId', sql.Int, store.BrandId)
            .query(`
                SELECT s.Id as StoreId, COUNT(i.Id) as AuditCount
                FROM Stores s
                LEFT JOIN OE_Inspections i ON s.Id = i.StoreId AND i.Status = 'Completed'
                WHERE s.BrandId = @brandId AND s.IsActive = 1
                GROUP BY s.Id
            `);
        
        const storeAudits = storeAuditsResult.recordset;
        
        if (storeAudits.length === 0) {
            return res.json({
                success: true,
                data: {
                    storeId: parseInt(storeId),
                    storeName: store.StoreName,
                    brandName: store.BrandName,
                    currentCycle: 1,
                    completedCycles: 0,
                    storeAuditCount: 0,
                    isPendingInCurrentCycle: true
                }
            });
        }
        
        // Find minimum audit count (completed cycles for the brand)
        const minAudits = Math.min(...storeAudits.map(s => s.AuditCount));
        const currentCycle = minAudits + 1;
        
        // Get this specific store's audit count
        const thisStoreAudits = storeAudits.find(s => s.StoreId === parseInt(storeId));
        const storeAuditCount = thisStoreAudits ? thisStoreAudits.AuditCount : 0;
        
        // Is this store pending in current cycle?
        const isPendingInCurrentCycle = storeAuditCount === minAudits;
        
        res.json({
            success: true,
            data: {
                storeId: parseInt(storeId),
                storeName: store.StoreName,
                brandName: store.BrandName,
                currentCycle: currentCycle,
                completedCycles: minAudits,
                storeAuditCount: storeAuditCount,
                isPendingInCurrentCycle: isPendingInCurrentCycle
            }
        });
    } catch (error) {
        console.error('Error getting store cycle info:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
