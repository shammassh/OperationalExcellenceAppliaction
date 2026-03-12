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
const multer = require('multer');
const sharp = require('sharp');

// Configure multer for OHS inspection photo uploads
const ohsUploadDir = path.join(__dirname, '..', '..', 'uploads', 'ohs-inspection');
if (!fs.existsSync(ohsUploadDir)) {
    fs.mkdirSync(ohsUploadDir, { recursive: true });
}

const ohsStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, ohsUploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'ohs-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const ohsUpload = multer({
    storage: ohsStorage,
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

// Image compression settings - optimized for storage
const COMPRESSION_CONFIG = {
    maxWidth: 1280,
    maxHeight: 960,
    quality: 70,
    pngCompressionLevel: 9
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
        
        const s = stats.recordset[0] || { total: 0, drafts: 0, completed: 0, today: 0 };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'pages', 'audit-list.html'));
});

// Action Plan Page (single inspection)
router.get('/action-plan/:id', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'pages', 'action-plan.html'));
});

// Action Plans List (shows completed audits to select from)
router.get('/action-plans', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
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

// Get department reports summary data
router.get('/api/reports/summary', async (req, res) => {
    try {
        const { storeId, fromDate, toDate } = req.query;
        const pool = await sql.connect(dbConfig);
        
        // Build WHERE clauses
        let whereClause = 'WHERE 1=1';
        if (storeId) whereClause += ' AND i.StoreId = @storeId';
        if (fromDate) whereClause += ' AND i.InspectionDate >= @fromDate';
        if (toDate) whereClause += ' AND i.InspectionDate <= @toDate';
        
        const request = pool.request();
        if (storeId) request.input('storeId', sql.Int, storeId);
        if (fromDate) request.input('fromDate', sql.Date, fromDate);
        if (toDate) request.input('toDate', sql.Date, toDate);
        
        // Get total inspections and average score
        const summaryResult = await request.query(`
            SELECT 
                COUNT(*) as totalInspections,
                AVG(CAST(i.OverallScore as FLOAT)) as avgScore
            FROM OHS_Inspections i
            ${whereClause}
        `);
        
        // Get store performance
        const storeRequest = pool.request();
        if (storeId) storeRequest.input('storeId', sql.Int, storeId);
        if (fromDate) storeRequest.input('fromDate', sql.Date, fromDate);
        if (toDate) storeRequest.input('toDate', sql.Date, toDate);
        
        const storeResult = await storeRequest.query(`
            SELECT 
                i.StoreId,
                i.StoreName as storeName,
                COUNT(*) as inspectionCount,
                AVG(CAST(i.OverallScore as FLOAT)) as avgScore,
                MAX(i.InspectionDate) as lastInspection,
                (SELECT COUNT(*) FROM OHS_InspectionItems it 
                 JOIN OHS_Inspections ins ON it.InspectionId = ins.Id 
                 WHERE ins.StoreId = i.StoreId AND it.Status NOT IN ('Completed', 'N/A')) as openIssues
            FROM OHS_Inspections i
            ${whereClause}
            GROUP BY i.StoreId, i.StoreName
            ORDER BY storeName
        `);
        
        // Get section analysis
        const sectionRequest = pool.request();
        if (storeId) sectionRequest.input('storeId', sql.Int, storeId);
        if (fromDate) sectionRequest.input('fromDate', sql.Date, fromDate);
        if (toDate) sectionRequest.input('toDate', sql.Date, toDate);
        
        const sectionResult = await sectionRequest.query(`
            SELECT 
                it.SectionName as sectionName,
                COUNT(*) as totalItems,
                SUM(CASE WHEN it.SelectedChoice = 'Yes' THEN 1 ELSE 0 END) as passedItems,
                CAST(SUM(CASE WHEN it.SelectedChoice = 'Yes' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as FLOAT) as avgScore
            FROM OHS_InspectionItems it
            JOIN OHS_Inspections i ON it.InspectionId = i.Id
            ${whereClause}
            GROUP BY it.SectionName
            ORDER BY avgScore ASC
        `);
        
        // Calculate open issues total
        const openIssuesResult = await pool.request().query(`
            SELECT COUNT(*) as openIssues
            FROM OHS_InspectionItems it
            WHERE it.Status NOT IN ('Completed', 'N/A')
            AND it.SelectedChoice IN ('No', 'Partial')
        `);
        
        // Calculate compliance rate (stores with avg > 80%)
        const totalStores = storeResult.recordset.length;
        const compliantStores = storeResult.recordset.filter(s => s.avgScore >= 80).length;
        const complianceRate = totalStores > 0 ? (compliantStores / totalStores) * 100 : 0;
        
        res.json({
            success: true,
            data: {
                totalInspections: summaryResult.recordset[0]?.totalInspections || 0,
                avgScore: summaryResult.recordset[0]?.avgScore || 0,
                complianceRate: complianceRate,
                openIssues: openIssuesResult.recordset[0]?.openIssues || 0,
                storePerformance: storeResult.recordset,
                sectionAnalysis: sectionResult.recordset
            }
        });
    } catch (error) {
        console.error('Error fetching reports summary:', error);
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
                (SELECT COUNT(*) FROM OHS_InspectionTemplateSections ts WHERE ts.TemplateId = t.Id AND ts.IsActive = 1) as sectionCount
            FROM OHS_InspectionTemplates t
            LEFT JOIN Users u ON t.CreatedBy = u.Id
            WHERE t.IsActive = 1
            ORDER BY t.TemplateName
        `);
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
                INSERT INTO OHS_InspectionTemplates (TemplateName, Description, CreatedBy, CreatedAt, IsActive)
                OUTPUT INSERTED.Id as schemaId
                VALUES (@name, @desc, @createdBy, GETDATE(), 1)
            `);
        res.json({ success: true, data: { schemaId: result.recordset[0].schemaId } });
    } catch (error) {
        console.error('Error creating template:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get full template with departments, sections and items
router.get('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const schemaId = parseInt(req.params.schemaId);
        const pool = await sql.connect(dbConfig);
        
        const templateResult = await pool.request()
            .input('id', sql.Int, schemaId)
            .query(`SELECT Id as schemaId, TemplateName as schemaName, Description as description FROM OHS_InspectionTemplates WHERE Id = @id`);
        
        if (templateResult.recordset.length === 0) {
            return res.json({ success: false, error: 'Template not found' });
        }
        
        const template = templateResult.recordset[0];
        
        // Get departments
        const departmentsResult = await pool.request()
            .input('templateId', sql.Int, schemaId)
            .query(`
                SELECT Id as departmentId, DepartmentName as departmentName, DepartmentIcon as departmentIcon, 
                       DepartmentOrder as departmentOrder, PassingGrade as passingGrade
                FROM OHS_InspectionTemplateDepartments 
                WHERE TemplateId = @templateId AND IsActive = 1
                ORDER BY DepartmentOrder
            `);
        
        template.departments = [];
        for (const department of departmentsResult.recordset) {
            // Get sections for this department
            const sectionsResult = await pool.request()
                .input('departmentId', sql.Int, department.departmentId)
                .query(`
                    SELECT Id as sectionId, SectionName as sectionName, SectionIcon as sectionIcon, SectionOrder as sectionNumber, DepartmentId as departmentId
                    FROM OHS_InspectionTemplateSections 
                    WHERE DepartmentId = @departmentId AND IsActive = 1
                    ORDER BY SectionOrder
                `);
            
            department.sections = [];
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
                department.sections.push(section);
            }
            template.departments.push(department);
        }
        
        // Also get sections without department (legacy support)
        const orphanSectionsResult = await pool.request()
            .input('templateId', sql.Int, schemaId)
            .query(`
                SELECT Id as sectionId, SectionName as sectionName, SectionIcon as sectionIcon, SectionOrder as sectionNumber
                FROM OHS_InspectionTemplateSections 
                WHERE TemplateId = @templateId AND DepartmentId IS NULL AND IsActive = 1
                ORDER BY SectionOrder
            `);
        
        template.sections = [];
        for (const section of orphanSectionsResult.recordset) {
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
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// Department API Routes
// ==========================================

// Get all departments for a template
router.get('/api/templates/schemas/:schemaId/departments', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('templateId', sql.Int, req.params.schemaId)
            .query(`
                SELECT 
                    d.Id as departmentId, 
                    d.DepartmentName as departmentName, 
                    d.DepartmentIcon as departmentIcon, 
                    d.DepartmentOrder as departmentOrder,
                    d.PassingGrade as passingGrade,
                    (SELECT COUNT(*) FROM OHS_InspectionTemplateSections s WHERE s.DepartmentId = d.Id AND s.IsActive = 1) as sectionCount
                FROM OHS_InspectionTemplateDepartments d
                WHERE d.TemplateId = @templateId AND d.IsActive = 1
                ORDER BY d.DepartmentOrder
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.json({ success: true, data: [] });
    }
});

// Create department
router.post('/api/templates/schemas/:schemaId/departments', async (req, res) => {
    try {
        const { departmentName, departmentIcon, departmentOrder, passingGrade } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('templateId', sql.Int, req.params.schemaId)
            .input('name', sql.NVarChar, departmentName)
            .input('icon', sql.NVarChar, departmentIcon || '🏬')
            .input('order', sql.Int, departmentOrder || 1)
            .input('grade', sql.Int, passingGrade || 80)
            .query(`
                INSERT INTO OHS_InspectionTemplateDepartments (TemplateId, DepartmentName, DepartmentIcon, DepartmentOrder, PassingGrade, IsActive)
                OUTPUT INSERTED.Id as departmentId
                VALUES (@templateId, @name, @icon, @order, @grade, 1)
            `);
        res.json({ success: true, data: { departmentId: result.recordset[0].departmentId } });
    } catch (error) {
        console.error('Error creating department:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update department
router.put('/api/templates/departments/:departmentId', async (req, res) => {
    try {
        const { departmentName, departmentIcon, departmentOrder, passingGrade } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.departmentId)
            .input('name', sql.NVarChar, departmentName)
            .input('icon', sql.NVarChar, departmentIcon || '🏬')
            .input('order', sql.Int, departmentOrder || 1)
            .input('grade', sql.Int, passingGrade || 80)
            .query(`UPDATE OHS_InspectionTemplateDepartments SET DepartmentName = @name, DepartmentIcon = @icon, DepartmentOrder = @order, PassingGrade = @grade, UpdatedAt = GETDATE() WHERE Id = @id`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating department:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete department
router.delete('/api/templates/departments/:departmentId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        // Soft delete department and its sections
        await pool.request()
            .input('id', sql.Int, req.params.departmentId)
            .query(`
                UPDATE OHS_InspectionTemplateDepartments SET IsActive = 0 WHERE Id = @id;
                UPDATE OHS_InspectionTemplateSections SET IsActive = 0 WHERE DepartmentId = @id;
            `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get sections for a department
router.get('/api/templates/departments/:departmentId/sections', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('departmentId', sql.Int, req.params.departmentId)
            .query(`
                SELECT 
                    s.Id as sectionId, 
                    s.SectionName as sectionName, 
                    s.SectionIcon as sectionIcon, 
                    s.SectionOrder as sectionNumber,
                    s.DepartmentId as departmentId,
                    (SELECT COUNT(*) FROM OHS_InspectionTemplateItems i WHERE i.SectionId = s.Id AND i.IsActive = 1) as itemCount
                FROM OHS_InspectionTemplateSections s
                WHERE s.DepartmentId = @departmentId AND s.IsActive = 1
                ORDER BY s.SectionOrder
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching sections for department:', error);
        res.json({ success: true, data: [] });
    }
});

// Create section under department
router.post('/api/templates/departments/:departmentId/sections', async (req, res) => {
    try {
        const { sectionNumber, sectionName, sectionIcon, templateId } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('templateId', sql.Int, templateId)
            .input('departmentId', sql.Int, req.params.departmentId)
            .input('name', sql.NVarChar, sectionName)
            .input('icon', sql.NVarChar, sectionIcon || '📋')
            .input('order', sql.Int, sectionNumber)
            .query(`
                INSERT INTO OHS_InspectionTemplateSections (TemplateId, DepartmentId, SectionName, SectionIcon, SectionOrder, IsActive)
                OUTPUT INSERTED.Id as sectionId
                VALUES (@templateId, @departmentId, @name, @icon, @order, 1)
            `);
        res.json({ success: true, data: { sectionId: result.recordset[0].sectionId } });
    } catch (error) {
        console.error('Error creating section:', error);
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
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating section:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update section department (for settings page)
router.put('/api/section/:sectionId/department', async (req, res) => {
    try {
        const { departmentId } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.sectionId)
            .input('departmentId', sql.Int, departmentId || null)
            .query(`UPDATE OHS_InspectionTemplateSections SET DepartmentId = @departmentId WHERE Id = @id`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating section department:', error);
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
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.json({ success: false, error: error.message });
    }
});

// Create store
router.post('/api/stores', async (req, res) => {
    try {
        const { storeCode, storeName, location, templateId } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('storeCode', sql.NVarChar, storeCode)
            .input('storeName', sql.NVarChar, storeName)
            .input('location', sql.NVarChar, location || null)
            .input('templateId', sql.Int, templateId || null)
            .query(`
                INSERT INTO Stores (StoreCode, StoreName, Location, TemplateId, IsActive, CreatedDate, CreatedBy)
                VALUES (@storeCode, @storeName, @location, @templateId, 1, GETDATE(), 'System')
            `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error creating store:', error);
        res.json({ success: false, error: error.message });
    }
});

// Update store
router.put('/api/stores/:storeId', async (req, res) => {
    try {
        const { storeCode, storeName, location, templateId, isActive } = req.body;
        const storeId = parseInt(req.params.storeId);
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('storeId', sql.Int, storeId)
            .input('storeCode', sql.NVarChar, storeCode)
            .input('storeName', sql.NVarChar, storeName)
            .input('location', sql.NVarChar, location || null)
            .input('templateId', sql.Int, templateId || null)
            .input('isActive', sql.Bit, isActive)
            .query(`
                UPDATE Stores 
                SET StoreCode = @storeCode, StoreName = @storeName, Location = @location, 
                    TemplateId = @templateId, IsActive = @isActive
                WHERE Id = @storeId
            `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating store:', error);
        res.json({ success: false, error: error.message });
    }
});

// Delete store
router.delete('/api/stores/:storeId', async (req, res) => {
    try {
        const storeId = parseInt(req.params.storeId);
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('storeId', sql.Int, storeId)
            .query('DELETE FROM Stores WHERE Id = @storeId');
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
            SELECT DISTINCT u.Id as userId, u.Email as email, u.DisplayName as displayName, r.RoleName as role
            FROM Users u
            JOIN UserRoles ur ON u.Id = ur.UserId
            JOIN Roles r ON ur.RoleId = r.Id
            WHERE r.RoleName IN ('Store Manager', 'System Administrator', 'Senior Inspector')
            ORDER BY u.DisplayName
        `);
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
        
        // Delete existing assignments
        await pool.request()
            .input('storeId', sql.Int, storeId)
            .query('DELETE FROM StoreManagerAssignments WHERE StoreId = @storeId');
        
        // Insert new assignments
        for (let i = 0; i < userIds.length; i++) {
            await pool.request()
                .input('storeId', sql.Int, storeId)
                .input('userId', sql.Int, userIds[i])
                .input('isPrimary', sql.Bit, i === 0)
                .input('assignedBy', sql.Int, req.session?.user?.id || 1)
                .query(`
                    INSERT INTO StoreManagerAssignments (StoreId, UserId, IsPrimary, AssignedAt, AssignedBy)
                    VALUES (@storeId, @userId, @isPrimary, GETDATE(), @assignedBy)
                `);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error assigning managers:', error);
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
            // Copy departments from template
            const templateDepartments = await pool.request()
                .input('templateId', sql.Int, useTemplateId)
                .query(`
                    SELECT Id, DepartmentName, DepartmentIcon, DepartmentOrder, PassingGrade
                    FROM OHS_InspectionTemplateDepartments
                    WHERE TemplateId = @templateId AND IsActive = 1
                    ORDER BY DepartmentOrder
                `);
            
            for (const dept of templateDepartments.recordset) {
                // Insert department
                const deptResult = await pool.request()
                    .input('inspectionId', sql.Int, inspectionId)
                    .input('departmentName', sql.NVarChar, dept.DepartmentName)
                    .input('departmentIcon', sql.NVarChar, dept.DepartmentIcon || '🏬')
                    .input('departmentOrder', sql.Int, dept.DepartmentOrder)
                    .input('passingGrade', sql.Int, dept.PassingGrade || 80)
                    .query(`
                        INSERT INTO OHS_InspectionDepartments (InspectionId, DepartmentName, DepartmentIcon, DepartmentOrder, PassingGrade, IsNA)
                        OUTPUT INSERTED.Id
                        VALUES (@inspectionId, @departmentName, @departmentIcon, @departmentOrder, @passingGrade, 0)
                    `);
                
                const newDeptId = deptResult.recordset[0].Id;
                
                // Copy sections for this department
                const templateSections = await pool.request()
                    .input('departmentId', sql.Int, dept.Id)
                    .query(`
                        SELECT Id, SectionName, SectionIcon, SectionOrder
                        FROM OHS_InspectionTemplateSections
                        WHERE DepartmentId = @departmentId AND IsActive = 1
                        ORDER BY SectionOrder
                    `);
                
                for (const section of templateSections.recordset) {
                    // Insert section with department info
                    await pool.request()
                        .input('inspectionId', sql.Int, inspectionId)
                        .input('sectionName', sql.NVarChar, section.SectionName)
                        .input('sectionIcon', sql.NVarChar, section.SectionIcon)
                        .input('sectionOrder', sql.Int, section.SectionOrder)
                        .input('departmentName', sql.NVarChar, dept.DepartmentName)
                        .input('departmentOrder', sql.Int, dept.DepartmentOrder)
                        .query(`
                            INSERT INTO OHS_InspectionSections (InspectionId, SectionName, SectionIcon, SectionOrder, DepartmentName, DepartmentOrder, DepartmentIsNA)
                            VALUES (@inspectionId, @sectionName, @sectionIcon, @sectionOrder, @departmentName, @departmentOrder, 0)
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
                            .input('departmentName', sql.NVarChar, dept.DepartmentName)
                            .input('departmentOrder', sql.Int, dept.DepartmentOrder)
                            .query(`
                                INSERT INTO OHS_InspectionItems 
                                    (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, AnswerOptions, Criteria, DepartmentName, DepartmentOrder, DepartmentIsNA)
                                VALUES 
                                    (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @answerOptions, @criteria, @departmentName, @departmentOrder, 0)
                            `);
                    }
                }
            }
            
            // Also handle sections without departments (legacy templates)
            const orphanSections = await pool.request()
                .input('templateId', sql.Int, useTemplateId)
                .query(`
                    SELECT Id, SectionName, SectionIcon, SectionOrder
                    FROM OHS_InspectionTemplateSections
                    WHERE TemplateId = @templateId AND DepartmentId IS NULL AND IsActive = 1
                    ORDER BY SectionOrder
                `);
            
            for (const section of orphanSections.recordset) {
                // Insert section without department
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
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Get departments for this inspection
        const departmentsResult = await pool.request()
            .input('inspectionId', sql.Int, auditId)
            .query(`
                SELECT 
                    Id as departmentId,
                    DepartmentName as departmentName,
                    DepartmentIcon as departmentIcon,
                    DepartmentOrder as departmentOrder,
                    PassingGrade as passingGrade,
                    IsNA as isNA,
                    Score as score,
                    TotalPoints as totalPoints,
                    MaxPoints as maxPoints
                FROM OHS_InspectionDepartments
                WHERE InspectionId = @inspectionId
                ORDER BY DepartmentOrder
            `);
        
        const departments = departmentsResult.recordset;
        
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
                    s.MaxPoints as maxPoints,
                    s.DepartmentName as departmentName,
                    s.DepartmentOrder as departmentOrder,
                    s.DepartmentIsNA as departmentIsNA
                FROM OHS_InspectionSections s
                WHERE s.InspectionId = @inspectionId
                ORDER BY ISNULL(s.DepartmentOrder, 999), s.SectionOrder
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
                .input('departmentName', sql.NVarChar, section.departmentName || null)
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
                        DepartmentName as department,
                        Criteria as criteria,
                        IsRepetitive as isRepetitive
                    FROM OHS_InspectionItems
                    WHERE InspectionId = @inspectionId 
                        AND SectionName = @sectionName
                        AND ((@departmentName IS NULL AND DepartmentName IS NULL) OR DepartmentName = @departmentName)
                    ORDER BY ItemOrder
                `);
            section.items = itemsResult.recordset;
            sections.push(section);
        }
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
                departments,
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
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OHS_InspectionDepartments WHERE InspectionId = @id`);
        
        const result = await pool.request()
            .input('id', sql.Int, auditId)
            .query(`DELETE FROM OHS_Inspections WHERE Id = @id; SELECT @@ROWCOUNT as deleted`);
        
        if (result.recordset[0].deleted === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        res.json({ success: true, message: 'Audit deleted successfully' });
    } catch (error) {
        console.error('Error deleting audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle department NA status (when user marks department as Not Applicable during inspection)
router.put('/api/audits/:auditId/departments/:departmentId/toggle-na', async (req, res) => {
    try {
        const { auditId, departmentId } = req.params;
        const { isNA } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        // Get department name first
        const deptResult = await pool.request()
            .input('id', sql.Int, departmentId)
            .query(`SELECT DepartmentName FROM OHS_InspectionDepartments WHERE Id = @id`);
        
        if (deptResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }
        
        const departmentName = deptResult.recordset[0].DepartmentName;
        
        // Update department NA status
        await pool.request()
            .input('id', sql.Int, departmentId)
            .input('isNA', sql.Bit, isNA ? 1 : 0)
            .query(`UPDATE OHS_InspectionDepartments SET IsNA = @isNA WHERE Id = @id`);
        
        // Update all sections for this department
        await pool.request()
            .input('inspectionId', sql.Int, auditId)
            .input('departmentName', sql.NVarChar, departmentName)
            .input('isNA', sql.Bit, isNA ? 1 : 0)
            .query(`UPDATE OHS_InspectionSections SET DepartmentIsNA = @isNA WHERE InspectionId = @inspectionId AND DepartmentName = @departmentName`);
        
        // Update all items for this department
        await pool.request()
            .input('inspectionId', sql.Int, auditId)
            .input('departmentName', sql.NVarChar, departmentName)
            .input('isNA', sql.Bit, isNA ? 1 : 0)
            .query(`UPDATE OHS_InspectionItems SET DepartmentIsNA = @isNA WHERE InspectionId = @inspectionId AND DepartmentName = @departmentName`);
        res.json({ success: true, message: `Department ${isNA ? 'marked as N/A' : 'restored'}` });
    } catch (error) {
        console.error('Error toggling department NA:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update audit response item
router.put('/api/audits/response/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const { selectedChoice, coeff, finding, comment, cr, priority, escalate, department, isRepetitive } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        const currentResult = await pool.request()
            .input('id', sql.Int, responseId)
            .query(`SELECT Answer, Score, Finding, Comment, CorrectedAction, Priority, Escalate, Department, IsRepetitive FROM OHS_InspectionItems WHERE Id = @id`);
        
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
        const finalIsRepetitive = isRepetitive !== undefined ? (isRepetitive ? 1 : 0) : current.IsRepetitive;
        
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
            .input('isRepetitive', sql.Bit, finalIsRepetitive)
            .query(`
                UPDATE OHS_InspectionItems 
                SET Answer = @selectedChoice,
                    Score = @value,
                    Finding = @finding,
                    Comment = @comment,
                    CorrectedAction = @cr,
                    Priority = @priority,
                    Escalate = @escalate,
                    Department = @department,
                    IsRepetitive = @isRepetitive
                WHERE Id = @id
            `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating response:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload picture for audit item (file storage with compression)
router.post('/api/audits/pictures', ohsUpload.single('picture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const { responseId, auditId, pictureType } = req.body;
        
        // Compress the uploaded image
        const fullPath = path.join(ohsUploadDir, req.file.filename);
        await compressImage(fullPath);
        
        // Get compressed file size
        const stats = fs.statSync(fullPath);
        const filePath = '/uploads/ohs-inspection/' + req.file.filename;
        
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
                INSERT INTO OHS_InspectionPictures (ItemId, InspectionId, FileName, OriginalName, ContentType, PictureType, FilePath, FileSize, CreatedAt)
                OUTPUT INSERTED.Id as pictureId
                VALUES (@responseId, @auditId, @fileName, @originalName, @contentType, @pictureType, @filePath, @fileSize, GETDATE())
            `);
        
        await pool.request()
            .input('id', sql.Int, responseId)
            .query(`UPDATE OHS_InspectionItems SET HasPicture = 1 WHERE Id = @id`);
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
                FROM OHS_InspectionPictures
                WHERE ItemId = @responseId
                ORDER BY CreatedAt
            `);
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
            .query(`SELECT FilePath FROM OHS_InspectionPictures WHERE Id = @id`);
        
        if (fileResult.recordset.length > 0 && fileResult.recordset[0].FilePath) {
            const filePath = path.join(__dirname, '..', '..', fileResult.recordset[0].FilePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        await pool.request()
            .input('id', sql.Int, pictureId)
            .query(`DELETE FROM OHS_InspectionPictures WHERE Id = @id`);
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
        
        // Generate action items from findings (items with No/Partially answers, findings, or escalation flag)
        const findingsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    InspectionId,
                    ReferenceValue,
                    SectionName,
                    Question,
                    Finding,
                    CorrectedAction as SuggestedAction,
                    Priority,
                    Department,
                    Answer
                FROM OHS_InspectionItems
                WHERE InspectionId = @auditId
                  AND (Answer IN ('No', 'Partially') OR (Finding IS NOT NULL AND Finding != '') OR Escalate = 1)
            `);
        
        let actionItemsCreated = 0;
        for (const finding of findingsResult.recordset) {
            // Check if action item already exists
            const existingCheck = await pool.request()
                .input('inspectionId', sql.Int, auditId)
                .input('referenceValue', sql.NVarChar, finding.ReferenceValue)
                .input('sectionName', sql.NVarChar, finding.SectionName)
                .query(`
                    SELECT Id FROM OHS_InspectionActionItems 
                    WHERE InspectionId = @inspectionId 
                      AND ReferenceValue = @referenceValue 
                      AND SectionName = @sectionName
                `);
            
            if (existingCheck.recordset.length === 0) {
                // Use Finding if available, otherwise use Question with Answer
                const findingText = finding.Finding || `${finding.Question} (Answer: ${finding.Answer})`;
                
                await pool.request()
                    .input('inspectionId', sql.Int, auditId)
                    .input('referenceValue', sql.NVarChar, finding.ReferenceValue)
                    .input('sectionName', sql.NVarChar, finding.SectionName)
                    .input('finding', sql.NVarChar, findingText)
                    .input('suggestedAction', sql.NVarChar, finding.SuggestedAction)
                    .input('priority', sql.NVarChar, finding.Priority || 'Medium')
                    .input('department', sql.NVarChar, finding.Department)
                    .query(`
                        INSERT INTO OHS_InspectionActionItems 
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
                    .query("SELECT SettingValue FROM OHS_EscalationSettings WHERE SettingKey = 'ActionPlanDeadlineDays'");
                const deadlineDays = settingsResult.recordset.length > 0 ? parseInt(settingsResult.recordset[0].SettingValue) || 7 : 7;
                
                await pool.request()
                    .input('auditId', sql.Int, auditId)
                    .input('days', sql.Int, deadlineDays)
                    .query(`
                        UPDATE OHS_Inspections 
                        SET ActionPlanDeadline = DATEADD(DAY, @days, GETDATE())
                        WHERE Id = @auditId
                    `);
                console.log(`[OHS Inspection] Set ActionPlanDeadline to ${deadlineDays} days for inspection ${auditId}`);
            } catch (err) {
                console.error('Error setting OHS action plan deadline:', err);
                // Non-critical, continue
            }
        }
        res.json({ success: true, data: { totalScore, actionItemsCreated } });
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
        
        // Get audit header with brand and region info
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT i.*, t.TemplateName, t.Description as TemplateDescription,
                       s.BrandId, b.BrandName, b.BrandCode,
                       s.Location as Region
                FROM OHS_Inspections i
                LEFT JOIN OHS_InspectionTemplates t ON i.TemplateId = t.Id
                LEFT JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        const audit = auditResult.recordset[0];
        
        // Get departments for this inspection
        const departmentsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT Id, DepartmentName, DepartmentIcon, DepartmentOrder, PassingGrade, IsNA, Score
                FROM OHS_InspectionDepartments
                WHERE InspectionId = @auditId
                ORDER BY DepartmentOrder
            `);
        const departments = departmentsResult.recordset;
        
        // Get all items with department info
        const itemsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT * FROM OHS_InspectionItems
                WHERE InspectionId = @auditId
                ORDER BY DepartmentName, SectionOrder, ItemOrder
            `);
        
        // Group items by department then by section
        const departmentMap = new Map();
        for (const item of itemsResult.recordset) {
            const deptName = item.DepartmentName || 'General';
            const sectionName = item.SectionName || 'General';
            
            if (!departmentMap.has(deptName)) {
                const deptInfo = departments.find(d => d.DepartmentName === deptName) || {};
                departmentMap.set(deptName, {
                    DepartmentName: deptName,
                    DepartmentIcon: deptInfo.DepartmentIcon || '📁',
                    DepartmentOrder: deptInfo.DepartmentOrder || 999,
                    PassingGrade: deptInfo.PassingGrade || 80,
                    IsNA: deptInfo.IsNA || false,
                    sections: new Map(),
                    earnedScore: 0,
                    maxScore: 0
                });
            }
            
            const dept = departmentMap.get(deptName);
            
            if (!dept.sections.has(sectionName)) {
                dept.sections.set(sectionName, {
                    SectionName: sectionName,
                    SectionIcon: item.SectionIcon || '📋',
                    SectionOrder: item.SectionOrder || 0,
                    items: [],
                    earnedScore: 0,
                    maxScore: 0
                });
            }
            
            const section = dept.sections.get(sectionName);
            section.items.push(item);
            
            if (item.Answer && item.Answer !== 'NA') {
                const coeff = parseFloat(item.Coefficient || 0);
                const score = parseFloat(item.Score || 0);
                section.maxScore += coeff;
                section.earnedScore += score;
                dept.maxScore += coeff;
                dept.earnedScore += score;
            }
        }
        
        // Convert to array and sort
        const departmentsData = Array.from(departmentMap.values())
            .sort((a, b) => a.DepartmentOrder - b.DepartmentOrder)
            .map(dept => ({
                ...dept,
                Percentage: dept.maxScore > 0 ? Math.round((dept.earnedScore / dept.maxScore) * 100) : 0,
                sections: Array.from(dept.sections.values())
                    .sort((a, b) => a.SectionOrder - b.SectionOrder)
                    .map(s => ({
                        ...s,
                        Percentage: s.maxScore > 0 ? Math.round((s.earnedScore / s.maxScore) * 100) : 0
                    }))
            }));
        
        // Calculate overall score (excluding NA departments)
        let totalEarned = 0, totalMax = 0;
        for (const dept of departmentsData) {
            if (!dept.IsNA) {
                totalEarned += dept.earnedScore;
                totalMax += dept.maxScore;
            }
        }
        const overallScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
        
        // Get settings for threshold
        const settingsResult = await pool.request().query(`SELECT SettingValue FROM OHS_InspectionSettings WHERE SettingKey = 'PASSING_SCORE'`);
        const threshold = parseInt(settingsResult.recordset[0]?.SettingValue) || 80;
        
        // Get pictures for all items
        const picturesResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT p.Id, p.ItemId, p.FileName, p.ContentType, p.PictureType, p.FilePath, p.OriginalName, p.FileSize
                FROM OHS_InspectionPictures p
                INNER JOIN OHS_InspectionItems i ON p.ItemId = i.Id
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
                dataUrl: pic.FilePath
            });
        }
        
        // Build report data
        const reportData = {
            audit,
            departments: departmentsData,
            pictures: picturesByItem,
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

// Get departments with assigned findings for an audit
router.get('/api/audits/:auditId/departments', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT Department, COUNT(*) as ItemCount
                FROM OHS_InspectionItems
                WHERE InspectionId = @auditId 
                  AND Department IS NOT NULL 
                  AND Department != ''
                  AND (Answer = 'No' OR Answer = 'Partially')
                GROUP BY Department
                ORDER BY Department
            `);
        res.json({ success: true, departments: result.recordset });
    } catch (error) {
        console.error('Error getting departments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate department-specific report
router.post('/api/audits/:auditId/generate-department-report', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { department } = req.body;
        
        if (!department) {
            return res.status(400).json({ success: false, error: 'Department is required' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Get audit header
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT i.*, s.StoreName, b.BrandName
                FROM OHS_Inspections i
                LEFT JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (!auditResult.recordset.length) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Get items for specific department
        const itemsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .input('department', sql.NVarChar, department)
            .query(`
                SELECT *, ISNULL(IsRepetitive, 0) as IsRepetitive
                FROM OHS_InspectionItems
                WHERE InspectionId = @auditId 
                  AND Department = @department
                  AND (Answer = 'No' OR Answer = 'Partially')
                ORDER BY DepartmentName, SectionName, ItemOrder
            `);
        
        const items = itemsResult.recordset;
        
        // Get pictures for these items
        const itemIds = items.map(i => i.Id);
        let pictures = {};
        
        if (itemIds.length > 0) {
            const picturesResult = await pool.request()
                .query(`
                    SELECT p.ItemId, p.FileName, p.OriginalName, p.ContentType, p.PictureType, p.FilePath
                    FROM OHS_InspectionPictures p
                    WHERE p.ItemId IN (${itemIds.join(',')})
                    ORDER BY p.ItemId, p.Id
                `);
            
            for (const pic of picturesResult.recordset) {
                if (!pictures[pic.ItemId]) pictures[pic.ItemId] = [];
                pictures[pic.ItemId].push({
                    fileName: pic.OriginalName || pic.FileName,
                    pictureType: pic.PictureType || 'issue',
                    dataUrl: pic.FilePath
                });
            }
        }
        
        // Generate HTML report
        const html = generateDepartmentReportHTML({
            audit,
            department,
            items,
            pictures,
            generatedAt: new Date().toISOString()
        });
        
        // Save report
        const reportsDir = path.join(__dirname, '..', '..', 'reports', 'ohs-inspection');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        
        const fileName = `OHS_Dept_${department}_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        const filePath = path.join(reportsDir, fileName);
        fs.writeFileSync(filePath, html);
        
        console.log(`✅ Department Report generated: ${fileName}`);
        res.json({ success: true, fileName });
        
    } catch (error) {
        console.error('Error generating department report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to generate Department Report HTML
function generateDepartmentReportHTML(data) {
    const { audit, department, items, pictures, generatedAt } = data;
    
    // Group items by DepartmentName (OHS section) then SectionName
    const sections = {};
    for (const item of items) {
        const sectionKey = `${item.DepartmentName || 'General'} - ${item.SectionName || 'General'}`;
        if (!sections[sectionKey]) {
            sections[sectionKey] = {
                deptName: item.DepartmentName || 'General',
                sectionName: item.SectionName || 'General',
                items: []
            };
        }
        sections[sectionKey].items.push(item);
    }
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Department Report - ${department} - ${audit.DocumentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
        .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px; }
        .header h1 { font-size: 20px; margin-bottom: 5px; }
        .header-subtitle { font-size: 14px; opacity: 0.9; }
        .header-info { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 12px; }
        .header-item { background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 6px; }
        .header-item label { font-size: 10px; opacity: 0.8; display: block; }
        .header-item span { font-size: 13px; font-weight: 600; }
        .summary-card { background: white; border-radius: 10px; padding: 15px 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; align-items: center; gap: 20px; }
        .summary-count { font-size: 36px; font-weight: bold; color: #ef4444; }
        .summary-label { font-size: 14px; color: #6b7280; }
        .section-card { background: white; border-radius: 10px; margin-bottom: 15px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .section-header { background: #f8fafc; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #374151; }
        .finding-item { padding: 15px; border-bottom: 1px solid #f3f4f6; }
        .finding-item:last-child { border-bottom: none; }
        .finding-ref { display: inline-block; font-weight: 600; color: #e17055; font-size: 12px; margin-right: 8px; }
        .finding-badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
        .finding-badge.repetitive { background: #fef3c7; color: #92400e; }
        .finding-badge.first-time { background: #dbeafe; color: #1e40af; }
        .finding-question { font-size: 14px; margin: 8px 0; color: #1f2937; }
        .finding-detail { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
        .finding-detail strong { color: #374151; }
        .choice-no { color: #ef4444; }
        .choice-partial { color: #f59e0b; }
        .finding-cr { background: #ecfdf5; border-left: 3px solid #10b981; padding: 8px 12px; border-radius: 4px; font-size: 13px; color: #065f46; margin-top: 8px; }
        .finding-pictures { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
        .finding-pictures img { max-width: 80px; max-height: 60px; border-radius: 4px; cursor: pointer; border: 2px solid #e2e8f0; object-fit: cover; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 13px; }
        .action-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 1000; }
        .action-bar button { padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .btn-back { background: #64748b; color: white; }
        .btn-print { background: #3b82f6; color: white; }
        .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; justify-content: center; align-items: center; }
        .lightbox.active { display: flex; }
        .lightbox img { max-width: 90%; max-height: 90%; border-radius: 8px; }
        .lightbox-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 40px; cursor: pointer; }
        @media print { 
            @page { size: A4; margin: 15mm; }
            .action-bar { display: none !important; } 
            .lightbox { display: none !important; }
            .finding-item { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn-back" onclick="history.back()">← Back</button>
        <button class="btn-print" onclick="window.print()">🖨️ Print</button>
    </div>
    
    <div class="container">
        <div class="header">
            <h1>🏢 Department Report: ${department}</h1>
            <div class="header-subtitle">Action items assigned to ${department} department</div>
            <div class="header-info">
                <div class="header-item"><label>Document #</label><span>${audit.DocumentNumber}</span></div>
                <div class="header-item"><label>Store</label><span>${audit.StoreName}</span></div>
                <div class="header-item"><label>Brand</label><span>${audit.BrandName || 'N/A'}</span></div>
                <div class="header-item"><label>Inspection Date</label><span>${new Date(audit.InspectionDate).toLocaleDateString()}</span></div>
            </div>
        </div>
        
        <div class="summary-card">
            <div class="summary-count">${items.length}</div>
            <div class="summary-label">Action Items for ${department}</div>
        </div>
        
        ${Object.values(sections).map(section => `
        <div class="section-card">
            <div class="section-header">📋 ${section.deptName} - ${section.sectionName}</div>
            ${section.items.map(item => {
                const itemPics = pictures[item.Id] || [];
                return `
            <div class="finding-item">
                <span class="finding-ref">[${item.ReferenceValue || 'N/A'}]</span>
                ${item.IsRepetitive ? '<span class="finding-badge repetitive">🔁 Repetitive</span>' : '<span class="finding-badge first-time">1st Time</span>'}
                <div class="finding-question">${item.Question}</div>
                <div class="finding-detail">
                    Answer: <strong class="${item.Answer === 'No' ? 'choice-no' : 'choice-partial'}">${item.Answer}</strong> 
                    | Finding: ${item.Finding || 'N/A'}
                </div>
                ${item.CorrectedAction ? `<div class="finding-cr">✅ Corrective Action: ${item.CorrectedAction}</div>` : ''}
                ${itemPics.length > 0 ? `
                <div class="finding-pictures">
                    ${itemPics.map(p => `<img src="${p.dataUrl}" alt="${p.fileName}" onclick="openLightbox(this.src)">`).join('')}
                </div>
                ` : ''}
            </div>
                `;
            }).join('')}
        </div>
        `).join('')}
        
        <div class="footer">
            Report generated on ${new Date(generatedAt).toLocaleString()} | OHS Inspection System - ${department} Department
        </div>
    </div>
    
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close">&times;</span>
        <img id="lightbox-img" src="" alt="Enlarged">
    </div>
    
    <script>
        function openLightbox(src) {
            document.getElementById('lightbox-img').src = src;
            document.getElementById('lightbox').classList.add('active');
        }
        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
    </script>
</body>
</html>`;
}

// Helper function to generate HTML report
function generateOHSReportHTML(data) {
    const { audit, departments, pictures, overallScore, threshold, generatedAt } = data;
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
        .header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px; }
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
        .section-card { background: white; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section-header { background: #fff5f5; padding: 15px 20px; border-bottom: 1px solid #fecaca; display: flex; justify-content: space-between; align-items: center; }
        .section-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .section-score { font-size: 20px; font-weight: bold; }
        .section-score.pass { color: #10b981; }
        .section-score.fail { color: #ef4444; }
        .department-card { background: white; border-radius: 12px; margin-bottom: 25px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .department-header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
        .department-header:hover { filter: brightness(1.05); }
        .department-header.na { background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); opacity: 0.7; }
        .department-title { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .department-score { text-align: right; display: flex; align-items: center; gap: 15px; }
        .department-score-value { font-size: 32px; font-weight: bold; }
        .department-score-label { font-size: 12px; opacity: 0.9; }
        .collapse-icon { font-size: 24px; transition: transform 0.3s ease; }
        .collapse-icon.collapsed { transform: rotate(-90deg); }
        .na-badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-left: 10px; }
        .department-sections { padding: 15px; transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease; overflow: hidden; }
        .department-sections.collapsed { max-height: 0 !important; padding: 0 15px; opacity: 0; }
        .toggle-controls { display: flex; gap: 10px; margin-bottom: 20px; justify-content: flex-end; }
        .toggle-btn { background: #4a90a4; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; }
        .toggle-btn:hover { background: #3a7a94; }
        .summary-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .summary-title { background: linear-gradient(135deg, #4a90a4 0%, #357a8c 100%); color: white; margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; }
        .summary-table { width: 100%; border-collapse: collapse; }
        .summary-table th, .summary-table td { padding: 10px 15px; }
        .summary-table th:first-child, .summary-table td:first-child { width: 1%; white-space: nowrap; }
        .summary-table th:nth-child(3), .summary-table td:nth-child(3) { width: 1%; white-space: nowrap; text-align: right !important; }
        .summary-table th { background: #64748b; color: white; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #475569; }
        .summary-table td { border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        .summary-table .dept-row td:first-child { background: #f8fafc; border-right: 1px solid #e2e8f0; vertical-align: top; }
        .summary-table .na-row { background: #f8fafc; color: #94a3b8; }
        .summary-table .na-row td:nth-child(2) { text-align: right !important; }
        .score-pass { color: #10b981; }
        .score-fail { color: #ef4444; }
        
        /* Chart Styles - Horizontal Bar Chart */
        .chart-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .chart-title { background: linear-gradient(135deg, #4a90a4 0%, #357a8c 100%); color: white; margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; }
        .chart-simple { padding: 20px; max-height: 600px; overflow-y: auto; }
        .chart-row { display: flex; align-items: center; margin-bottom: 6px; gap: 10px; }
        .chart-row-dept { background: #f8fafc; padding: 8px 10px; border-radius: 6px; margin-top: 12px; margin-bottom: 4px; }
        .chart-row-dept:first-child { margin-top: 0; }
        .chart-row-section { padding-left: 15px; }
        .chart-row-label { width: 250px; font-size: 12px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chart-row-label.dept-label { font-weight: 600; font-size: 13px; }
        .chart-row-label.section-label { font-weight: 400; color: #64748b; font-size: 11px; }
        .chart-row-bar-container { flex: 1; height: 16px; background: #e2e8f0; border-radius: 3px; position: relative; overflow: visible; }
        .chart-row-dept .chart-row-bar-container { height: 20px; }
        .chart-row-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        .chart-row-bar.bar-pass { background: linear-gradient(90deg, #10b981 0%, #059669 100%); }
        .chart-row-bar.bar-fail { background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); }
        .chart-row-threshold { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #f59e0b; }
        .chart-row-value { width: 45px; font-size: 12px; font-weight: 600; text-align: right; }
        .chart-row-dept .chart-row-value { font-size: 14px; font-weight: 700; }
        .chart-row-value.bar-pass { color: #10b981; }
        .chart-row-value.bar-fail { color: #ef4444; }
        .chart-legend { display: flex; gap: 20px; justify-content: center; padding: 15px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569; }
        .legend-color { width: 14px; height: 14px; border-radius: 3px; }
        .legend-color.pass { background: #10b981; }
        .legend-color.fail { background: #ef4444; }
        .legend-line { width: 20px; height: 2px; background: #f59e0b; }
        
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .status-badge.pass { background: #d1fae5; color: #065f46; }
        .status-badge.fail { background: #fee2e2; color: #991b1b; }
        .status-badge.na { background: #e2e8f0; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        th { background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }
        tr:hover { background: #f8fafc; }
        .choice-yes { color: #10b981; font-weight: 600; }
        .choice-no { color: #ef4444; font-weight: 600; }
        .choice-partial { color: #f59e0b; font-weight: 600; }
        .choice-na { color: #94a3b8; }
        .good-obs-thumb { max-width: 50px; max-height: 40px; border-radius: 4px; cursor: pointer; border: 2px solid #10b981; object-fit: cover; }
        .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; justify-content: center; align-items: center; }
        .lightbox.active { display: flex; }
        .lightbox img { max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); }
        .lightbox-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 40px; font-weight: bold; cursor: pointer; transition: color 0.2s; }
        .lightbox-close:hover { color: #f59e0b; }
        @media print { .lightbox { display: none !important; } }
        .finding-item { background: #fef2f2; border-radius: 8px; padding: 12px; margin-bottom: 8px; border-left: 4px solid #ef4444; }
        .finding-ref { font-weight: 600; color: #e17055; font-size: 12px; display: inline-block; }
        .finding-badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-left: 8px; font-weight: 600; }
        .finding-badge.repetitive { background: #fef3c7; color: #92400e; }
        .finding-badge.first-time { background: #dbeafe; color: #1e40af; }
        .finding-question { margin: 5px 0; font-size: 14px; }
        .finding-detail { color: #64748b; font-size: 13px; }
        .finding-cr { background: #ecfdf5; border-left: 4px solid #10b981; padding: 10px; margin-top: 8px; border-radius: 4px; font-size: 13px; color: #065f46; }
        .finding-pictures { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        .pictures-wrapper { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
        .section-findings { background: #fef2f2; border-top: 2px solid #fecaca; padding: 12px 15px; margin-top: 10px; border-radius: 0 0 8px 8px; }
        .section-findings-title { color: #dc2626; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
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
        .gallery-dept { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .gallery-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; display: inline-block; }
        .gallery-type.good { background: #d1fae5; color: #065f46; }
        .gallery-type.issue { background: #fee2e2; color: #991b1b; }
        .gallery-type.corrective { background: #d1fae5; color: #065f46; }
        .gallery-empty { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 16px; }
        .action-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 1000; }
        .action-bar button { padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s; }
        .action-bar button:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .btn-email { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; }
        .btn-print { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; }
        .btn-pdf { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }
        .btn-back { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; }
        .section-block { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
        @media print { 
            @page { size: landscape; margin: 10mm; }
            body { background: white; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
            .container { max-width: 100%; padding: 0; } 
            .action-bar { display: none !important; } 
            .department-card { break-inside: avoid; page-break-inside: avoid; }
            .section-block { break-inside: avoid; page-break-inside: avoid; }
            .gallery-section { break-before: page; }
            .summary-section, .chart-section { break-inside: avoid; }
            .chart-simple { max-height: none !important; overflow: visible !important; }
            .header { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
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
    <script>
        function goBack() {
            if (document.referrer && document.referrer.includes(window.location.hostname)) {
                history.back();
            } else {
                window.location.href = '/ohs-inspection/reports';
            }
        }
        
        // Export to PDF using browser print with PDF option
        function exportToPDF() {
            // Add a message overlay
            const overlay = document.createElement('div');
            overlay.id = 'pdf-overlay';
            overlay.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10000;"><div style="background:white;padding:30px 50px;border-radius:12px;text-align:center;"><h3 style="margin:0 0 15px 0;">📄 Export to PDF</h3><p style="margin:0 0 20px 0;color:#666;">In the print dialog, select <strong>"Save as PDF"</strong> as the destination.</p><p style="margin:0;color:#888;font-size:13px;">Tip: Layout is set to Landscape for better fit.</p></div></div>';
            document.body.appendChild(overlay);
            
            setTimeout(() => {
                overlay.remove();
                window.print();
            }, 2000);
        }
    </script>
    <div class="container">
        <div class="header">
            <h1>🦺 OHS Inspection Report</h1>
            <div class="header-info">
                <div class="header-item"><label>Document #</label><span>${audit.DocumentNumber}</span></div>
                <div class="header-item"><label>Store</label><span>${audit.StoreName}</span></div>
                <div class="header-item"><label>Brand</label><span>${audit.BrandName || 'N/A'}</span></div>
                <div class="header-item"><label>Date</label><span>${new Date(audit.InspectionDate).toLocaleDateString()}</span></div>
                <div class="header-item"><label>Inspectors</label><span>${audit.Inspectors || 'N/A'}</span></div>
                <div class="header-item"><label>Accompanied By</label><span>${audit.AccompaniedBy || 'N/A'}</span></div>
            </div>
        </div>
        
        <div class="score-card">
            <div class="score-value ${passedClass}">${overallScore}%</div>
            <div class="score-label ${passedClass}">${passedText}</div>
            <div class="score-threshold">Threshold: ${threshold}%</div>
        </div>
        
        <div class="summary-section">
            <h2 class="summary-title">📊 Audit Summary</h2>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Section</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${departments.map(dept => {
                        if (dept.IsNA) {
                            return `<tr class="dept-row na-row">
                                <td colspan="2"><strong>${dept.DepartmentIcon || '📁'} ${dept.DepartmentName}</strong></td>
                                <td>N/A</td>
                            </tr>`;
                        }
                        const rows = [];
                        const deptPassed = dept.Percentage >= dept.PassingGrade;
                        const deptScoreClass = deptPassed ? 'score-pass' : 'score-fail';
                        dept.sections.forEach((section, idx) => {
                            const sectionPassed = section.Percentage >= dept.PassingGrade;
                            const sectionScoreClass = sectionPassed ? 'score-pass' : 'score-fail';
                            if (idx === 0) {
                                rows.push(`<tr class="dept-row">
                                    <td rowspan="${dept.sections.length}"><strong>${dept.DepartmentIcon || '📁'} ${dept.DepartmentName}</strong><br><small class="${deptScoreClass}">Overall: ${dept.Percentage}%</small></td>
                                    <td>${section.SectionName}</td>
                                    <td><strong class="${sectionScoreClass}">${section.Percentage}%</strong></td>
                                </tr>`);
                            } else {
                                rows.push(`<tr>
                                    <td>${section.SectionName}</td>
                                    <td><strong class="${sectionScoreClass}">${section.Percentage}%</strong></td>
                                </tr>`);
                            }
                        });
                        return rows.join('');
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="chart-section">
            <h2 class="chart-title">📊 Department Scores Overview</h2>
            <div class="chart-simple">
                ${departments.filter(d => !d.IsNA).map(dept => {
                    const deptBarClass = dept.Percentage >= dept.PassingGrade ? 'bar-pass' : 'bar-fail';
                    const sectionRows = dept.sections.map(section => {
                        const secBarClass = section.Percentage >= dept.PassingGrade ? 'bar-pass' : 'bar-fail';
                        return `
                        <div class="chart-row chart-row-section">
                            <div class="chart-row-label section-label">↳ ${section.SectionName}</div>
                            <div class="chart-row-bar-container">
                                <div class="chart-row-bar ${secBarClass}" style="width: ${section.Percentage}%;"></div>
                                <div class="chart-row-threshold" style="left: ${dept.PassingGrade}%;"></div>
                            </div>
                            <div class="chart-row-value ${secBarClass}">${section.Percentage}%</div>
                        </div>
                        `;
                    }).join('');
                    return `
                    <div class="chart-row chart-row-dept">
                        <div class="chart-row-label dept-label">${dept.DepartmentIcon || '📁'} ${dept.DepartmentName}</div>
                        <div class="chart-row-bar-container">
                            <div class="chart-row-bar ${deptBarClass}" style="width: ${dept.Percentage}%;"></div>
                            <div class="chart-row-threshold" style="left: ${dept.PassingGrade}%;"></div>
                        </div>
                        <div class="chart-row-value ${deptBarClass}">${dept.Percentage}%</div>
                    </div>
                    ${sectionRows}
                    `;
                }).join('')}
            </div>
            <div class="chart-legend">
                <span class="legend-item"><span class="legend-color pass"></span> Pass (≥threshold)</span>
                <span class="legend-item"><span class="legend-color fail"></span> Fail (&lt;threshold)</span>
                <span class="legend-item"><span class="legend-line"></span> Threshold</span>
            </div>
        </div>
        
        <div class="toggle-controls">
            <button class="toggle-btn" onclick="expandAll()">📂 Expand All</button>
            <button class="toggle-btn" onclick="collapseAll()">📁 Collapse All</button>
        </div>
        
        ${departments.map((dept, deptIdx) => `
        <div class="department-card">
            <div class="department-header ${dept.IsNA ? 'na' : ''}" onclick="toggleDepartment(${deptIdx})">
                <div class="department-title">
                    <span class="collapse-icon" id="icon-${deptIdx}">▼</span>
                    ${dept.DepartmentIcon || '📁'} ${dept.DepartmentName}
                    ${dept.IsNA ? '<span class="na-badge">N/A - Excluded</span>' : ''}
                </div>
                ${!dept.IsNA ? `
                <div class="department-score">
                    <div class="department-score-value">${dept.Percentage}%</div>
                    <div class="department-score-label">Pass: ${dept.PassingGrade}%</div>
                </div>
                ` : ''}
            </div>
            <div class="department-sections" id="dept-${deptIdx}">
                ${dept.sections.map(section => {
                    // Get ALL items with No or Partially answers (not just those with finding text)
                    const sectionFindings = (section.items || []).filter(item => 
                        item.Answer === 'No' || item.Answer === 'Partially'
                    );
                    
                    return `
                <div class="section-block">
                    <div class="section-header">
                        <div class="section-title">${section.SectionIcon || '📋'} ${section.SectionName}</div>
                        <div class="section-score ${section.Percentage >= dept.PassingGrade ? 'pass' : 'fail'}">${section.Percentage}%</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:60px">#</th>
                                <th>Question</th>
                                <th style="width:80px">Answer</th>
                                <th style="width:70px">Score</th>
                                <th style="width:90px">Observation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(section.items || []).map(item => {
                                const itemPics = pictures[item.Id] || [];
                                const goodPics = itemPics.filter(p => p.pictureType === 'Good');
                                return `
                            <tr>
                                <td>${item.ReferenceValue || '-'}</td>
                                <td>${item.Question || '-'}</td>
                                <td class="${item.Answer === 'Yes' ? 'choice-yes' : item.Answer === 'No' ? 'choice-no' : item.Answer === 'Partially' ? 'choice-partial' : 'choice-na'}">${item.Answer || '-'}</td>
                                <td>${item.Score ?? '-'} / ${item.Coefficient || 0}</td>
                                <td>${goodPics.length > 0 ? goodPics.map(p => `<img src="${p.dataUrl}" alt="Good" title="Good Observation" class="good-obs-thumb" onclick="openLightbox(this.src)">`).join('') : '-'}</td>
                            </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                    ${sectionFindings.length > 0 ? `
                    <div class="section-findings">
                        <div class="section-findings-title">⚠️ Findings (${sectionFindings.length})</div>
                        ${sectionFindings.map(f => {
                            const itemPics = pictures[f.Id] || [];
                            return `
                        <div class="finding-item">
                            <div class="finding-ref">[${f.ReferenceValue || 'N/A'}]${f.IsRepetitive ? '<span class="finding-badge repetitive">🔁 Repetitive</span>' : '<span class="finding-badge first-time">1st Time</span>'}</div>
                            <div class="finding-question">${f.Question}</div>
                            <div class="finding-detail">Answer: <strong class="${f.Answer === 'No' ? 'choice-no' : 'choice-partial'}">${f.Answer}</strong> | Finding: ${f.Finding || 'N/A'}</div>
                            ${f.CorrectiveAction ? `<div class="finding-cr">✅ Corrective Action: ${f.CorrectiveAction}</div>` : ''}
                            ${itemPics.length > 0 ? `
                            <div class="finding-pictures">
                                <strong>Photos:</strong>
                                <div class="pictures-wrapper">
                                    ${itemPics.map(p => `<img src="${p.dataUrl}" alt="${p.fileName || 'Photo'}" title="${p.pictureType || 'Photo'}" style="max-width:100px;max-height:75px;border-radius:4px;cursor:pointer;border:2px solid ${p.pictureType === 'Good' || p.pictureType === 'corrective' ? '#10b981' : '#ef4444'};" onclick="openLightbox(this.src)">`).join('')}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        `}).join('')}
                    </div>
                    ` : ''}
                </div>
                `}).join('')}
            </div>
        </div>
        `).join('')}
        
        <!-- Good Observations Gallery -->
        ${(() => {
            const goodObsItems = [];
            departments.forEach(dept => {
                (dept.sections || []).forEach(section => {
                    (section.items || []).forEach(item => {
                        const itemPics = pictures[item.Id] || [];
                        const goodPics = itemPics.filter(p => p.pictureType === 'Good');
                        goodPics.forEach(pic => {
                            goodObsItems.push({
                                ref: item.ReferenceValue || 'N/A',
                                dept: dept.DepartmentName,
                                section: section.SectionName,
                                question: item.Question,
                                dataUrl: pic.dataUrl,
                                fileName: pic.fileName
                            });
                        });
                    });
                });
            });
            
            return `
        <div class="gallery-section">
            <h2 class="gallery-title good">✅ Good Observations Gallery (${goodObsItems.length})</h2>
            ${goodObsItems.length > 0 ? `
            <div class="gallery-grid">
                ${goodObsItems.map(item => `
                <div class="gallery-card good">
                    <img src="${item.dataUrl}" alt="Good Observation" class="gallery-img" onclick="openLightbox(this.src)">
                    <div class="gallery-info">
                        <div class="gallery-ref good">[${item.ref}]</div>
                        <div class="gallery-dept">📁 ${item.dept} / ${item.section}</div>
                        <span class="gallery-type good">✅ Good Observation</span>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `<div class="gallery-empty">No good observations captured</div>`}
        </div>`;
        })()}
        
        <!-- Findings Gallery -->
        ${(() => {
            const findingItems = [];
            departments.forEach(dept => {
                (dept.sections || []).forEach(section => {
                    (section.items || []).forEach(item => {
                        if (item.Answer === 'No' || item.Answer === 'Partially') {
                            const itemPics = pictures[item.Id] || [];
                            const issuePics = itemPics.filter(p => p.pictureType !== 'Good');
                            issuePics.forEach(pic => {
                                findingItems.push({
                                    ref: item.ReferenceValue || 'N/A',
                                    dept: dept.DepartmentName,
                                    section: section.SectionName,
                                    question: item.Question,
                                    answer: item.Answer,
                                    finding: item.Finding,
                                    dataUrl: pic.dataUrl,
                                    fileName: pic.fileName,
                                    pictureType: pic.pictureType
                                });
                            });
                        }
                    });
                });
            });
            
            return `
        <div class="gallery-section">
            <h2 class="gallery-title findings">⚠️ Findings Gallery (${findingItems.length})</h2>
            ${findingItems.length > 0 ? `
            <div class="gallery-grid">
                ${findingItems.map(item => `
                <div class="gallery-card finding">
                    <img src="${item.dataUrl}" alt="Finding" class="gallery-img" onclick="openLightbox(this.src)">
                    <div class="gallery-info">
                        <div class="gallery-ref finding">[${item.ref}]</div>
                        <div class="gallery-dept">📁 ${item.dept} / ${item.section}</div>
                        <span class="gallery-type ${item.pictureType === 'corrective' ? 'corrective' : 'issue'}">${item.pictureType === 'corrective' ? '✅ Corrective' : item.pictureType === 'Issue' ? '❌ Issue' : '📷 ' + (item.pictureType || 'Photo')}</span>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `<div class="gallery-empty">No finding photos captured</div>`}
        </div>`;
        })()}
        
        <div class="footer">
            Report generated on ${new Date(generatedAt).toLocaleString()} | OHS Inspection System
        </div>
    </div>
    <script>
        const inspectionId = ${audit.Id};
        
        // Toggle department collapse/expand
        function toggleDepartment(index) {
            const sections = document.getElementById('dept-' + index);
            const icon = document.getElementById('icon-' + index);
            
            if (sections.classList.contains('collapsed')) {
                sections.classList.remove('collapsed');
                icon.classList.remove('collapsed');
            } else {
                sections.classList.add('collapsed');
                icon.classList.add('collapsed');
            }
        }
        
        // Expand/Collapse All buttons
        function expandAll() {
            document.querySelectorAll('.department-sections').forEach(el => el.classList.remove('collapsed'));
            document.querySelectorAll('.collapse-icon').forEach(el => el.classList.remove('collapsed'));
        }
        
        function collapseAll() {
            document.querySelectorAll('.department-sections').forEach(el => el.classList.add('collapsed'));
            document.querySelectorAll('.collapse-icon').forEach(el => el.classList.add('collapsed'));
        }
        
        async function openEmailModal(reportType) {
            try {
                const btn = document.querySelector('.btn-email');
                const originalText = btn.innerHTML;
                btn.innerHTML = '⏳ Loading...';
                btn.disabled = true;
                
                const recipientsRes = await fetch('/ohs-inspection/api/inspections/' + inspectionId + '/email-recipients?reportType=' + reportType);
                const recipientsData = await recipientsRes.json();
                
                if (!recipientsData.success) {
                    throw new Error(recipientsData.error || 'Failed to load recipients');
                }
                
                const previewRes = await fetch('/ohs-inspection/api/inspections/' + inspectionId + '/email-preview?reportType=' + reportType);
                const previewData = await previewRes.json();
                
                if (!previewData.success) {
                    throw new Error(previewData.error || 'Failed to generate preview');
                }
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                EmailModal.show({
                    module: 'OHS',
                    from: recipientsData.from,
                    to: recipientsData.to,
                    ccSuggestions: recipientsData.ccSuggestions,
                    subject: previewData.subject,
                    bodyHtml: previewData.bodyHtml,
                    reportType: reportType,
                    auditId: inspectionId,
                    sendUrl: '/ohs-inspection/api/inspections/' + inspectionId + '/send-report-email',
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
    
    <!-- Lightbox Modal -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
        <img id="lightbox-img" src="" alt="Enlarged view">
    </div>
    <script>
        function openLightbox(src) {
            document.getElementById('lightbox-img').src = src;
            document.getElementById('lightbox').classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
            document.body.style.overflow = '';
        }
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeLightbox();
        });
    </script>
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

// Serve report files at /reports/:fileName (for direct report links)
router.get('/reports/:fileName', (req, res) => {
    const { fileName } = req.params;
    const reportsDir = path.join(__dirname, '..', '..', 'reports', 'ohs-inspection');
    const filePath = path.join(reportsDir, fileName);
    
    // Security check - prevent directory traversal
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
            // Get sections with department info
            const sectionsResult = await pool.request()
                .input('templateId', sql.Int, schema.SchemaID)
                .query(`
                    SELECT 
                        ts.Id as SectionID,
                        ts.SectionName,
                        ts.SectionOrder,
                        ts.SectionIcon,
                        ISNULL(ts.PassingGrade, 80) as PassingGrade,
                        ts.DepartmentId,
                        d.DepartmentName
                    FROM OHS_InspectionTemplateSections ts
                    LEFT JOIN OHS_InspectionTemplateDepartments d ON ts.DepartmentId = d.Id
                    WHERE ts.TemplateId = @templateId
                    ORDER BY ts.SectionOrder
                `);
            
            // Get available departments for this template
            const departmentsResult = await pool.request()
                .input('templateId', sql.Int, schema.SchemaID)
                .query(`
                    SELECT Id as DepartmentId, DepartmentName, DepartmentIcon
                    FROM OHS_InspectionTemplateDepartments
                    WHERE TemplateId = @templateId AND IsActive = 1
                    ORDER BY DepartmentOrder
                `);
            
            schemas.push({
                ...schema,
                sections: sectionsResult.recordset,
                departments: departmentsResult.recordset
            });
        }
        res.json({ success: true, schemas });
    } catch (error) {
        console.error('Error fetching schemas:', error);
        res.json({ success: true, schemas: [] });
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
                FROM OHS_InspectionSettings 
                WHERE SettingKey LIKE 'CHECKLIST_%_' + CAST(@schemaId AS VARCHAR)
            `);
        
        const info = {
            creationDate: '',
            revisionDate: '',
            edition: '',
            reportTitle: 'OHS Inspection Report',
            documentPrefix: 'GMRL-OHS'
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
        res.json({ success: true, info: { creationDate: '', revisionDate: '', edition: '', reportTitle: 'OHS Inspection Report', documentPrefix: 'GMRL-OHS' } });
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
                    IF EXISTS (SELECT 1 FROM OHS_InspectionSettings WHERE SettingKey = @key)
                        UPDATE OHS_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO OHS_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
                `);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving checklist info:', error);
        res.json({ success: false, error: error.message });
    }
});

// Save schema settings (grades)
router.post('/api/schema/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const schemaId = req.params.schemaId;
        const { overallPassingGrade, sections } = req.body;
        
        // Save overall passing grade
        await pool.request()
            .input('key', sql.NVarChar, 'PASSING_SCORE_' + schemaId)
            .input('value', sql.NVarChar, String(overallPassingGrade))
            .query(`
                IF EXISTS (SELECT 1 FROM OHS_InspectionSettings WHERE SettingKey = @key)
                    UPDATE OHS_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                ELSE
                    INSERT INTO OHS_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
            `);
        
        // Save section grades
        if (sections && Array.isArray(sections)) {
            for (const sg of sections) {
                await pool.request()
                    .input('sectionId', sql.Int, sg.sectionId)
                    .input('grade', sql.Int, sg.passingGrade)
                    .query(`
                        UPDATE OHS_InspectionTemplateSections 
                        SET PassingGrade = @grade 
                        WHERE Id = @sectionId
                    `);
            }
        }
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
                        UPDATE OHS_InspectionTemplateSections 
                        SET SectionIcon = @icon 
                        WHERE Id = @sectionId
                    `);
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving section icons:', error);
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// ACTION ITEMS API
// ==========================================

// Get action items (for action plan page)
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
                ai.Notes as notes,
                ai.CreatedAt as createdAt,
                ai.UpdatedAt as updatedAt,
                ai.CompletedAt as completedAt,
                i.DocumentNumber as documentNumber,
                i.StoreName as storeName,
                i.StoreId as storeId,
                i.InspectionDate as inspectionDate
            FROM OHS_InspectionActionItems ai
            INNER JOIN OHS_Inspections i ON ai.InspectionId = i.Id
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
                updateFields.push('CompletedAt = GETDATE()');
            }
        }
        if (dueDate !== undefined) {
            updateFields.push('Deadline = @dueDate');
            request.input('dueDate', sql.Date, dueDate || null);
        }
        if (notes !== undefined) {
            updateFields.push('Notes = @notes');
            request.input('notes', sql.NVarChar, notes);
        }
        
        updateFields.push('UpdatedAt = GETDATE()');
        
        await request.query(`
            UPDATE OHS_InspectionActionItems 
            SET ${updateFields.join(', ')} 
            WHERE Id = @id
        `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating action item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create action items from inspection findings (called when inspection is completed)
router.post('/api/action-items/generate/:inspectionId', async (req, res) => {
    try {
        const { inspectionId } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get inspection items that have findings or are marked for escalation
        const findingsResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT 
                    Id,
                    InspectionId,
                    ReferenceValue,
                    SectionName,
                    Finding,
                    CorrectedAction as SuggestedAction,
                    Priority,
                    Department
                FROM OHS_InspectionItems
                WHERE InspectionId = @inspectionId
                  AND ((Finding IS NOT NULL AND Finding != '') OR Escalate = 1)
            `);
        
        if (findingsResult.recordset.length === 0) {
            return res.json({ success: true, message: 'No findings to create action items for', count: 0 });
        }
        
        // Insert action items
        let insertedCount = 0;
        for (const finding of findingsResult.recordset) {
            // Check if action item already exists for this inspection item
            const existingCheck = await pool.request()
                .input('inspectionId', sql.Int, inspectionId)
                .input('referenceValue', sql.NVarChar, finding.ReferenceValue)
                .input('sectionName', sql.NVarChar, finding.SectionName)
                .query(`
                    SELECT Id FROM OHS_InspectionActionItems 
                    WHERE InspectionId = @inspectionId 
                      AND ReferenceValue = @referenceValue 
                      AND SectionName = @sectionName
                `);
            
            if (existingCheck.recordset.length === 0) {
                await pool.request()
                    .input('inspectionId', sql.Int, finding.InspectionId)
                    .input('referenceValue', sql.NVarChar, finding.ReferenceValue)
                    .input('sectionName', sql.NVarChar, finding.SectionName)
                    .input('finding', sql.NVarChar, finding.Finding)
                    .input('suggestedAction', sql.NVarChar, finding.SuggestedAction)
                    .input('priority', sql.NVarChar, finding.Priority || 'Medium')
                    .input('department', sql.NVarChar, finding.Department)
                    .query(`
                        INSERT INTO OHS_InspectionActionItems 
                        (InspectionId, ReferenceValue, SectionName, Finding, SuggestedAction, Priority, Status, Department, CreatedAt)
                        VALUES (@inspectionId, @referenceValue, @sectionName, @finding, @suggestedAction, @priority, 'Open', @department, GETDATE())
                    `);
                insertedCount++;
            }
        }
        res.json({ success: true, message: `Created ${insertedCount} action items`, count: insertedCount });
    } catch (error) {
        console.error('Error generating action items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Action Plan API Routes (per inspection)
// ==========================================

// Get action plan responses for a specific document number
router.get('/api/action-plan/:documentNumber', async (req, res) => {
    try {
        const { documentNumber } = req.params;
        const pool = await sql.connect(dbConfig);
        
        // Get all responses for this document
        const result = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .query(`
                SELECT * FROM OHS_ActionPlanResponses
                WHERE DocumentNumber = @documentNumber
            `);
        
        console.log(`[Action Plan] Loaded ${result.recordset.length} responses for ${documentNumber}`);
        res.json({ success: true, actions: result.recordset });
    } catch (error) {
        // Table might not exist yet - that's ok
        console.warn('Action plan responses not found:', error.message);
        res.json({ success: true, actions: [] });
    }
});

// Save action plan responses
router.post('/api/action-plan/save', async (req, res) => {
    try {
        const { documentNumber, actions } = req.body;
        console.log(`[Action Plan Save] Saving ${actions?.length || 0} items for ${documentNumber}`);
        
        // Dedupe actions - keep only the first item for each referenceValue + department
        const actionMap = new Map();
        for (const action of actions) {
            const key = `${action.referenceValue}|${action.department || ''}`;
            if (!actionMap.has(key)) {
                actionMap.set(key, action);
            }
        }
        const dedupedActions = Array.from(actionMap.values());
        console.log(`[Action Plan Save] Deduped from ${actions.length} to ${dedupedActions.length} items`);
        
        // Log a sample item to debug
        if (dedupedActions.length > 0) {
            const sample = dedupedActions.find(a => a.actionTaken) || dedupedActions[0];
            console.log(`[Action Plan Save] Sample item:`, JSON.stringify(sample, null, 2));
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Create table if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHS_ActionPlanResponses')
            CREATE TABLE OHS_ActionPlanResponses (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                DocumentNumber NVARCHAR(50),
                ReferenceValue NVARCHAR(50),
                Department NVARCHAR(255),
                SectionName NVARCHAR(255),
                Question NVARCHAR(MAX),
                Finding NVARCHAR(MAX),
                SelectedChoice NVARCHAR(50),
                Priority NVARCHAR(50),
                ActionTaken NVARCHAR(MAX),
                Deadline DATE,
                PersonInCharge NVARCHAR(255),
                Status NVARCHAR(50),
                Pictures NVARCHAR(MAX),
                Notes NVARCHAR(MAX),
                CreatedAt DATETIME DEFAULT GETDATE(),
                UpdatedAt DATETIME DEFAULT GETDATE()
            )
        `);
        
        // Use simple UPDATE then INSERT if not exists
        let updated = 0, inserted = 0;
        for (const action of dedupedActions) {
            // Log first item update
            if (action.referenceValue === '1.1') {
                console.log(`[Action Plan Save] Updating 1.1 with actionTaken: "${action.actionTaken}"`);
            }
            
            // First try to update
            const updateResult = await pool.request()
                .input('documentNumber', sql.NVarChar, documentNumber)
                .input('referenceValue', sql.NVarChar, action.referenceValue)
                .input('department', sql.NVarChar, action.department || '')
                .input('sectionName', sql.NVarChar, action.sectionName)
                .input('question', sql.NVarChar, action.question)
                .input('finding', sql.NVarChar, action.finding)
                .input('selectedChoice', sql.NVarChar, action.selectedChoice)
                .input('priority', sql.NVarChar, action.priority)
                .input('actionTaken', sql.NVarChar, action.actionTaken || '')
                .input('deadline', sql.Date, action.deadline || null)
                .input('personInCharge', sql.NVarChar, action.personInCharge || '')
                .input('status', sql.NVarChar, action.status || 'Pending')
                .input('pictures', sql.NVarChar, JSON.stringify(action.pictures || []))
                .input('notes', sql.NVarChar, action.notes || '')
                .query(`
                    UPDATE OHS_ActionPlanResponses 
                    SET SectionName = @sectionName,
                        Question = @question,
                        Finding = @finding,
                        SelectedChoice = @selectedChoice,
                        Priority = @priority,
                        ActionTaken = @actionTaken,
                        Deadline = @deadline,
                        PersonInCharge = @personInCharge,
                        Status = @status,
                        Pictures = @pictures,
                        Notes = @notes,
                        UpdatedAt = GETDATE()
                    WHERE DocumentNumber = @documentNumber AND ReferenceValue = @referenceValue AND (Department = @department OR (Department IS NULL AND @department = ''))
                `);
            
            // Log first item result
            if (action.referenceValue === '1.1') {
                console.log(`[Action Plan Save] 1.1 update result: ${updateResult.rowsAffected[0]} rows affected`);
            }
            
            // If no rows updated, insert new
            if (updateResult.rowsAffected[0] === 0) {
                inserted++;
                await pool.request()
                    .input('documentNumber', sql.NVarChar, documentNumber)
                    .input('referenceValue', sql.NVarChar, action.referenceValue)
                    .input('department', sql.NVarChar, action.department || '')
                    .input('sectionName', sql.NVarChar, action.sectionName)
                    .input('question', sql.NVarChar, action.question)
                    .input('finding', sql.NVarChar, action.finding)
                    .input('selectedChoice', sql.NVarChar, action.selectedChoice)
                    .input('priority', sql.NVarChar, action.priority)
                    .input('actionTaken', sql.NVarChar, action.actionTaken || '')
                    .input('deadline', sql.Date, action.deadline || null)
                    .input('personInCharge', sql.NVarChar, action.personInCharge || '')
                    .input('status', sql.NVarChar, action.status || 'Pending')
                    .input('pictures', sql.NVarChar, JSON.stringify(action.pictures || []))
                    .input('notes', sql.NVarChar, action.notes || '')
                    .query(`
                        INSERT INTO OHS_ActionPlanResponses 
                        (DocumentNumber, ReferenceValue, Department, SectionName, Question, Finding, SelectedChoice, Priority, ActionTaken, Deadline, PersonInCharge, Status, Pictures, Notes)
                        VALUES (@documentNumber, @referenceValue, @department, @sectionName, @question, @finding, @selectedChoice, @priority, @actionTaken, @deadline, @personInCharge, @status, @pictures, @notes)
                    `);
            } else {
                updated++;
            }
        }
        
        console.log(`[Action Plan Save] Successfully saved ${dedupedActions.length} items (${updated} updated, ${inserted} inserted) for ${documentNumber}`);
        res.json({ success: true, message: 'Action plan saved successfully' });
    } catch (error) {
        console.error('Error saving action plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload action plan picture (returns file path for use in action-plan.html)
router.post('/api/action-plan/upload-picture', ohsUpload.single('picture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const fullPath = path.join(ohsUploadDir, req.file.filename);
        const originalSize = req.file.size;
        
        // Compress the uploaded image
        await compressImage(fullPath);
        
        // Get compressed file size
        const stats = fs.statSync(fullPath);
        const compressedSize = stats.size;
        
        console.log(`[Action Plan] Picture uploaded: ${req.file.originalname} | Original: ${(originalSize/1024).toFixed(1)}KB | Compressed: ${(compressedSize/1024).toFixed(1)}KB | Saved: ${((1 - compressedSize/originalSize) * 100).toFixed(0)}%`);
        
        res.json({ 
            success: true, 
            url: `/uploads/ohs-inspection/${req.file.filename}`,
            fileName: req.file.originalname,
            originalSize: originalSize,
            compressedSize: compressedSize
        });
    } catch (error) {
        console.error('Error uploading action plan picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send action plan email to store manager
router.post('/api/action-plan/send-email', async (req, res) => {
    try {
        const { documentNumber, storeName, auditDate, score, recipientEmail, actionItems } = req.body;
        
        if (!recipientEmail) {
            return res.status(400).json({ success: false, error: 'Recipient email is required' });
        }

        // Build HTML email content
        const emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">🛡️ OHS Inspection Action Plan</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px;">
                    <table style="width: 100%;">
                        <tr>
                            <td><strong>Document Number:</strong> ${documentNumber}</td>
                            <td><strong>Store:</strong> ${storeName}</td>
                        </tr>
                        <tr>
                            <td><strong>Inspection Date:</strong> ${new Date(auditDate).toLocaleDateString('en-GB')}</td>
                            <td><strong>Score:</strong> ${score ? Math.round(score) + '%' : 'N/A'}</td>
                        </tr>
                    </table>
                </div>

                <div style="padding: 20px;">
                    <h2 style="color: #d63031;">Action Items (${actionItems.length})</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #d63031; color: white;">
                                <th style="padding: 10px; text-align: left;">Ref#</th>
                                <th style="padding: 10px; text-align: left;">Section</th>
                                <th style="padding: 10px; text-align: left;">Finding</th>
                                <th style="padding: 10px; text-align: left;">Priority</th>
                                <th style="padding: 10px; text-align: left;">Action Required</th>
                                <th style="padding: 10px; text-align: left;">Deadline</th>
                                <th style="padding: 10px; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${actionItems.map((item, idx) => `
                                <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f8f9fa'}; border-bottom: 1px solid #e9ecef;">
                                    <td style="padding: 10px;">${item.referenceValue || '-'}</td>
                                    <td style="padding: 10px;">${item.sectionName || '-'}</td>
                                    <td style="padding: 10px;">${item.finding || '-'}</td>
                                    <td style="padding: 10px;">
                                        <span style="padding: 3px 8px; border-radius: 12px; font-size: 11px; background: ${item.priority === 'High' ? '#fee2e2' : item.priority === 'Medium' ? '#fef3c7' : '#dbeafe'}; color: ${item.priority === 'High' ? '#991b1b' : item.priority === 'Medium' ? '#92400e' : '#1e40af'};">
                                            ${item.priority || 'Medium'}
                                        </span>
                                    </td>
                                    <td style="padding: 10px;">${item.actionTaken || '<em style="color:#999;">Pending response</em>'}</td>
                                    <td style="padding: 10px;">${item.deadline ? new Date(item.deadline).toLocaleDateString('en-GB') : '-'}</td>
                                    <td style="padding: 10px;">${item.status || 'Pending'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="background: #fff3e0; border-left: 4px solid #e17055; padding: 15px; margin: 20px;">
                    <h3 style="color: #d63031; margin-top: 0;">📝 Instructions</h3>
                    <ol style="margin: 0; padding-left: 20px;">
                        <li>Review each finding and understand the corrective action needed</li>
                        <li>Fill in the Action to be Taken for each item</li>
                        <li>Set realistic deadlines based on priority</li>
                        <li>Assign responsible persons for each action</li>
                        <li>Update status as actions progress</li>
                    </ol>
                </div>

                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p>This is an automated email from the OHS Inspection System.</p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        `;

        // Get access token from session if available
        const accessToken = req.session?.accessToken;
        
        if (!accessToken) {
            // If no access token, try to save and show message
            return res.json({ 
                success: false, 
                error: 'Email sending requires authentication. Please ensure you are logged in.' 
            });
        }

        // Use email service
        const EmailService = require('../../services/email-service');
        const emailService = new EmailService();
        
        const result = await emailService.sendEmail({
            to: recipientEmail,
            subject: `OHS Action Plan - ${documentNumber} - ${storeName}`,
            body: emailHtml,
            accessToken: accessToken
        });

        res.json(result);
    } catch (error) {
        console.error('Error sending action plan email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Email Report Endpoints
// ==========================================

const emailService = require('../../services/email-service');
const emailTemplateBuilder = require('../../services/email-template-builder');
const { getFreshAccessToken } = require('../../auth/auth-server');

// Get email recipients for an OHS inspection (store manager + brand responsibles for CC)
// For action-plan reports, the To recipient is the inspector who created the inspection
// For full reports, the To recipient is the store manager
router.get('/api/inspections/:inspectionId/email-recipients', async (req, res) => {
    try {
        const { inspectionId } = req.params;
        const { reportType } = req.query; // 'full' or 'action-plan'
        const pool = await sql.connect(dbConfig);
        
        // Get inspection info with store and brand
        const inspectionResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT 
                    i.Id as inspectionId,
                    i.DocumentNumber,
                    i.StoreId,
                    s.StoreName,
                    s.StoreCode,
                    s.BrandId,
                    b.BrandName,
                    b.BrandCode,
                    b.PrimaryColor as BrandColor,
                    i.Score as TotalScore,
                    i.InspectionDate,
                    i.Inspectors,
                    i.Status,
                    i.CreatedBy
                FROM OHS_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @inspectionId
            `);
        
        if (inspectionResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Inspection not found' });
        }
        
        const inspection = inspectionResult.recordset[0];
        
        let toRecipient = null;
        
        // For action-plan reports, send to the inspector who created the inspection
        if (reportType === 'action-plan' && inspection.CreatedBy) {
            const inspectorResult = await pool.request()
                .input('userId', sql.Int, inspection.CreatedBy)
                .query(`
                    SELECT Id, Email, DisplayName
                    FROM Users
                    WHERE Id = @userId AND IsActive = 1
                `);
            
            if (inspectorResult.recordset.length > 0) {
                const inspector = inspectorResult.recordset[0];
                toRecipient = {
                    email: inspector.Email,
                    name: inspector.DisplayName
                };
            }
        } else {
            // For full reports, send to store manager
            const storeManagerResult = await pool.request()
                .input('storeId', sql.Int, inspection.StoreId)
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
        
        if (inspection.BrandId) {
            const brandResponsiblesResult = await pool.request()
                .input('brandId', sql.Int, inspection.BrandId)
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
        
        // Build response
        res.json({
            success: true,
            inspection: {
                inspectionId: inspection.inspectionId,
                documentNumber: inspection.DocumentNumber,
                storeName: inspection.StoreName,
                storeCode: inspection.StoreCode,
                brandName: inspection.BrandName,
                brandCode: inspection.BrandCode,
                brandColor: inspection.BrandColor,
                totalScore: inspection.TotalScore,
                inspectionDate: inspection.InspectionDate,
                inspectors: inspection.Inspectors,
                status: inspection.Status
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

// Get email preview for OHS inspection (subject and body HTML)
router.get('/api/inspections/:inspectionId/email-preview', async (req, res) => {
    try {
        const { inspectionId } = req.params;
        const { reportType } = req.query; // 'full' or 'action-plan'
        
        const pool = await sql.connect(dbConfig);
        
        // Get inspection details
        const inspectionResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, s.StoreName, s.StoreCode,
                    b.BrandCode, i.Score as TotalScore, i.InspectionDate, i.Inspectors, i.Status,
                    i.Cycle, i.Year
                FROM OHS_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @inspectionId
            `);
        
        if (inspectionResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Inspection not found' });
        }
        
        const inspection = inspectionResult.recordset[0];
        
        // Build report URL
        const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
        const reportUrl = reportType === 'action-plan' 
            ? `${appUrl}/ohs-inspection/api/inspections/reports/OHS_ActionPlan_${inspection.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`
            : `${appUrl}/ohs-inspection/api/inspections/reports/OHS_Report_${inspection.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        // Get findings stats for action plan
        let findingsStats = null;
        if (reportType === 'action-plan') {
            const findingsResult = await pool.request()
                .input('inspectionId', sql.Int, inspectionId)
                .query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN Priority = 'Critical' THEN 1 ELSE 0 END) as critical,
                        SUM(CASE WHEN Priority = 'High' THEN 1 ELSE 0 END) as high,
                        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) as medium,
                        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) as low
                    FROM OHS_InspectionItems
                    WHERE InspectionId = @inspectionId AND Finding IS NOT NULL AND Finding != ''
                `);
            findingsStats = findingsResult.recordset[0];
        }
        
        // Build email using template builder
        const inspectionData = {
            documentNumber: inspection.DocumentNumber,
            storeName: inspection.StoreName,
            storeCode: inspection.StoreCode,
            brandCode: inspection.BrandCode,
            inspectionDate: inspection.InspectionDate,
            auditDate: inspection.InspectionDate,
            inspectors: inspection.Inspectors,
            auditors: inspection.Inspectors,
            totalScore: inspection.TotalScore,
            status: inspection.Status,
            cycle: inspection.Cycle,
            year: inspection.Year,
            passingGrade: 80
        };
        
        // Use database template (falls back to hardcoded if not found)
        const emailContent = await emailTemplateBuilder.buildEmailFromDB('OHS', reportType, inspectionData, reportUrl, findingsStats);
        
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

// Send OHS report email
router.post('/api/inspections/:inspectionId/send-report-email', async (req, res) => {
    try {
        const { inspectionId } = req.params;
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
        
        // Get inspection details
        const inspectionResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, s.StoreName, s.StoreCode,
                    s.BrandId, b.BrandName, b.BrandCode, 
                    i.Score as TotalScore, i.InspectionDate, i.Inspectors, i.Status, i.Cycle, i.Year
                FROM OHS_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @inspectionId
            `);
        
        if (inspectionResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Inspection not found' });
        }
        
        const inspection = inspectionResult.recordset[0];
        
        // Build report URL
        const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
        const reportUrl = reportType === 'action-plan' 
            ? `${appUrl}/ohs-inspection/api/inspections/reports/OHS_ActionPlan_${inspection.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`
            : `${appUrl}/ohs-inspection/api/inspections/reports/OHS_Report_${inspection.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        // Get findings stats for action plan
        let findingsStats = null;
        if (reportType === 'action-plan') {
            const findingsResult = await pool.request()
                .input('inspectionId', sql.Int, inspectionId)
                .query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN Priority = 'Critical' THEN 1 ELSE 0 END) as critical,
                        SUM(CASE WHEN Priority = 'High' THEN 1 ELSE 0 END) as high,
                        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) as medium,
                        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) as low
                    FROM OHS_InspectionItems
                    WHERE InspectionId = @inspectionId AND Finding IS NOT NULL AND Finding != ''
                `);
            findingsStats = findingsResult.recordset[0];
        }
        
        // Build email content
        const inspectionData = {
            documentNumber: inspection.DocumentNumber,
            storeName: inspection.StoreName,
            storeCode: inspection.StoreCode,
            brandCode: inspection.BrandCode,
            inspectionDate: inspection.InspectionDate,
            auditDate: inspection.InspectionDate,
            inspectors: inspection.Inspectors,
            auditors: inspection.Inspectors,
            totalScore: inspection.TotalScore,
            status: inspection.Status,
            cycle: inspection.Cycle,
            year: inspection.Year,
            passingGrade: 80
        };
        
        // Use database template (falls back to hardcoded if not found)
        const emailContent = await emailTemplateBuilder.buildEmailFromDB('OHS', reportType, inspectionData, reportUrl, findingsStats);
        
        // Build CC string
        const ccEmails = cc && cc.length > 0 ? cc.map(c => c.email).join(',') : null;
        
        // Get fresh access token for the current user (refreshes if expired)
        let accessToken;
        try {
            accessToken = await getFreshAccessToken(req.currentUser);
        } catch (tokenError) {
            console.error('[OHS] Token refresh failed:', tokenError.message);
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
            .input('auditId', sql.Int, inspectionId)
            .input('documentNumber', sql.NVarChar, inspection.DocumentNumber)
            .input('module', sql.NVarChar, 'OHS')
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
            .input('storeId', sql.Int, inspection.StoreId)
            .input('storeName', sql.NVarChar, inspection.StoreName)
            .input('brandId', sql.Int, inspection.BrandId)
            .input('brandName', sql.NVarChar, inspection.BrandName)
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
// OHS Escalation Settings API
// ==========================================

// Get OHS escalation settings
router.get('/api/escalation-settings', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT SettingKey, SettingValue, Description 
            FROM OHS_EscalationSettings
        `);
        
        const settings = {};
        result.recordset.forEach(s => {
            settings[s.SettingKey] = s.SettingValue;
        });
        
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error loading OHS escalation settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update OHS escalation settings
router.post('/api/escalation-settings', async (req, res) => {
    try {
        const { 
            ActionPlanDeadlineDays, 
            EscalationEnabled, 
            ReminderDaysBefore, 
            EmailNotifications, 
            InAppNotifications 
        } = req.body;
        
        const pool = await sql.connect(dbConfig);
        
        // Update each setting
        const settings = [
            { key: 'ActionPlanDeadlineDays', value: ActionPlanDeadlineDays },
            { key: 'EscalationEnabled', value: EscalationEnabled },
            { key: 'ReminderDaysBefore', value: ReminderDaysBefore },
            { key: 'EmailNotifications', value: EmailNotifications },
            { key: 'InAppNotifications', value: InAppNotifications }
        ];
        
        for (const s of settings) {
            if (s.value !== undefined) {
                await pool.request()
                    .input('key', sql.NVarChar, s.key)
                    .input('value', sql.NVarChar, String(s.value))
                    .query(`
                        UPDATE OHS_EscalationSettings 
                        SET SettingValue = @value, UpdatedAt = GETDATE() 
                        WHERE SettingKey = @key
                    `);
            }
        }
        res.json({ success: true, message: 'OHS escalation settings saved' });
    } catch (error) {
        console.error('Error saving OHS escalation settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
