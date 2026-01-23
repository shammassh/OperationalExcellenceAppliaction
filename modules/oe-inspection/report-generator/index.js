/**
 * Report Generator - Main Entry Point
 * Orchestrates all services to generate audit reports
 */

const sql = require('mssql');
const fs = require('fs').promises;
const path = require('path');

// Import services
const ConfigService = require('./services/config-service');
const DataService = require('./services/data-service');
const ScoringService = require('./services/scoring-service');
const ImageService = require('./services/image-service');
const TemplateEngine = require('./services/template-engine');
const SchemaColorsService = require('../services/schema-colors-service');

class ReportGenerator {
    constructor(options = {}) {
        this.pool = options.pool || null;
        this.outputDir = options.outputDir || path.join(__dirname, '..', '..', 'reports');
        
        // Initialize services
        this.configService = new ConfigService(this.pool);
        this.dataService = new DataService(this.pool);
        this.scoringService = new ScoringService();
        this.imageService = new ImageService();
        this.templateEngine = new TemplateEngine();
        this.schemaColorsService = new SchemaColorsService(this.pool);
        
        // DB config for standalone use
        this.dbConfig = options.dbConfig || {
            server: process.env.SQL_SERVER || 'PowerApps-Repor',
            database: process.env.SQL_DATABASE || 'FoodSafetyDB',
            user: process.env.SQL_USER || 'sa',
            password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };
    }

    /**
     * Set database pool (for use with existing connection)
     * @param {Object} pool - SQL connection pool
     */
    setPool(pool) {
        this.pool = pool;
        this.configService.setPool(pool);
        this.dataService.setPool(pool);
        this.schemaColorsService.setPool(pool);
    }

    /**
     * Ensure database connection
     */
    async ensureConnection() {
        if (!this.pool) {
            console.log('🔌 Connecting to database...');
            this.pool = await sql.connect(this.dbConfig);
            this.configService.setPool(this.pool);
            this.dataService.setPool(this.pool);
            this.schemaColorsService.setPool(this.pool);
            console.log('   ✅ Database connected');
        }
        return this.pool;
    }

    /**
     * Generate complete audit report
     * @param {number} auditId - Audit ID
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - Result with filePath and data
     */
    async generateReport(auditId, options = {}) {
        try {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🚀 Generating Report for Audit ID: ${auditId}`);
            console.log(`${'='.repeat(60)}\n`);

            // Ensure database connection
            await this.ensureConnection();

            // 1. Fetch audit data
            console.log('📊 Step 1: Fetching audit data...');
            const auditData = await this.dataService.getAuditData(auditId);
            
            // 2. Get settings/thresholds for this schema
            console.log('⚙️ Step 2: Loading settings...');
            const settings = await this.configService.getSettings(auditData.schemaId);
            const threshold = settings.overallPassingGrade;

            // 3. Fetch section scores
            console.log('📈 Step 3: Fetching section scores...');
            const sectionScores = await this.dataService.getSectionScores(auditId);

            // 4. Fetch all responses grouped by section
            console.log('📝 Step 4: Fetching responses...');
            const sections = await this.dataService.getAuditResponses(auditId);

            // Merge section scores with sections
            for (const section of sections) {
                const scoreData = sectionScores.find(s => s.sectionId === section.sectionId);
                if (scoreData) {
                    section.percentage = scoreData.percentage;
                    section.earnedScore = scoreData.earnedScore;
                    section.maxScore = scoreData.maxScore;
                }
            }

            // 5. Fetch pictures
            console.log('🖼️ Step 5: Fetching pictures...');
            const pictures = await this.dataService.getAuditPictures(auditId);

            // 6. Fetch findings
            console.log('🔍 Step 6: Fetching findings...');
            const findings = await this.dataService.getFindings(auditId);

            // 7. Fetch temperature readings (optional)
            console.log('🌡️ Step 7: Fetching temperature readings...');
            const temperatureReadings = await this.dataService.getTemperatureReadings(auditId);

            // 7.5 Fetch historical audits for same store (for C1-C6 display)
            console.log('📜 Step 7.5: Fetching historical audits...');
            const historicalAudits = await this.dataService.getHistoricalAudits(auditData.storeId, auditId);

            // 7.6 Fetch categories for data table grouping
            console.log('📂 Step 7.6: Fetching categories...');
            const categories = await this.dataService.getCategoriesWithSections(auditData.schemaId);

            // 7.7 Fetch historical findings for repetitive issue detection
            console.log('🔄 Step 7.7: Fetching historical findings...');
            const historicalFindings = await this.dataService.getHistoricalFindings(auditData.storeId, auditId);

            // 7.8 Fetch schema colors
            console.log('🎨 Step 7.8: Fetching schema colors...');
            const schemaColors = await this.schemaColorsService.getSchemaColors(auditData.schemaId);

            // 8. Build report data structure
            console.log('📦 Step 8: Building report data...');
            const reportData = {
                // Audit info
                auditId: auditData.auditId,
                documentNumber: auditData.documentNumber,
                storeCode: auditData.storeCode,
                storeName: auditData.storeName,
                schemaId: auditData.schemaId,
                schemaName: auditData.schemaName,
                reportTitle: auditData.reportTitle,
                documentPrefix: auditData.documentPrefix,
                edition: auditData.edition,
                creationDate: auditData.creationDate,
                revisionDate: auditData.revisionDate,
                auditDate: auditData.auditDate,
                timeIn: auditData.timeIn,
                timeOut: auditData.timeOut,
                cycle: auditData.cycle,
                year: auditData.year,
                auditors: auditData.auditors,
                accompaniedBy: auditData.accompaniedBy,
                status: auditData.status,
                
                // Scores
                totalScore: auditData.totalScore,
                threshold,
                sectionScores,
                
                // Data
                sections,
                pictures,
                findings,
                temperatureReadings,
                historicalAudits,
                categories,
                historicalFindings,
                schemaColors,
                
                // Metadata
                generatedAt: new Date().toISOString()
            };

            // 9. Generate HTML
            console.log('🎨 Step 9: Generating HTML...');
            const html = await this.templateEngine.buildDocument(reportData, options);

            // 10. Save report
            console.log('💾 Step 10: Saving report...');
            const fileName = `Audit_Report_${auditData.documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.outputDir, fileName);

            // Ensure output directory exists
            await fs.mkdir(this.outputDir, { recursive: true });

            // Write file
            await fs.writeFile(filePath, html, 'utf8');

            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ Report generated successfully!`);
            console.log(`📄 File: ${filePath}`);
            console.log(`📊 Score: ${auditData.totalScore}% (${auditData.totalScore >= threshold ? 'PASS ✅' : 'FAIL ❌'})`);
            console.log(`🏪 Store: ${auditData.storeName}`);
            console.log(`${'='.repeat(60)}\n`);

            return {
                success: true,
                filePath,
                fileName,
                html,
                data: reportData
            };

        } catch (error) {
            console.error('❌ Error generating report:', error);
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    /**
     * Generate action plan report
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Result with findings and file path
     */
    async generateActionPlan(auditId) {
        try {
            console.log(`\n📋 Generating Action Plan for Audit ID: ${auditId}`);

            await this.ensureConnection();

            // Fetch data
            const auditData = await this.dataService.getAuditData(auditId);
            const findings = await this.dataService.getFindings(auditId);
            const pictures = await this.dataService.getAuditPictures(auditId);

            // Build action plan HTML
            const html = this.buildActionPlanHtml({
                ...auditData,
                findings,
                pictures
            });

            // Save
            const fileName = `Action_Plan_${auditData.documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.outputDir, fileName);

            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(filePath, html, 'utf8');

            console.log(`✅ Action plan generated: ${filePath}`);

            return {
                success: true,
                filePath,
                fileName,
                html,
                findings,
                totalFindings: findings.length,
                highPriority: findings.filter(f => f.priority === 'High').length,
                mediumPriority: findings.filter(f => f.priority === 'Medium').length,
                lowPriority: findings.filter(f => f.priority === 'Low').length
            };

        } catch (error) {
            console.error('❌ Error generating action plan:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Build action plan HTML
     */
    buildActionPlanHtml(data) {
        const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
        const sortedFindings = [...data.findings].sort((a, b) => 
            (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
        );

        const rows = sortedFindings.map((f, idx) => {
            const pics = data.pictures[f.responseId] || [];
            const picsHtml = pics.map(p => 
                `<img src="${p.dataUrl}" style="max-width:80px;max-height:60px;margin:2px;border-radius:4px;cursor:pointer;" onclick="openImageModal(this.src)">`
            ).join('');

            const priorityClass = f.priority ? `priority-${f.priority.toLowerCase()}` : '';
            
            return `
                <tr class="${priorityClass}">
                    <td>${idx + 1}</td>
                    <td>${f.referenceValue || ''}</td>
                    <td>${f.sectionName || ''}</td>
                    <td>${f.title || ''}</td>
                    <td>${f.finding || ''}</td>
                    <td>${f.correctiveAction || f.cr || ''}</td>
                    <td><span class="priority-badge ${priorityClass}">${f.priority || '-'}</span></td>
                    <td>${picsHtml || '-'}</td>
                </tr>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Action Plan - ${data.documentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; background: white; }
        .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 1.5rem; margin-bottom: 10px; }
        .header-info { display: flex; gap: 30px; flex-wrap: wrap; font-size: 0.9rem; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-card { flex: 1; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.high { background: #fee2e2; color: #991b1b; }
        .stat-card.medium { background: #fef3c7; color: #92400e; }
        .stat-card.low { background: #dbeafe; color: #1e40af; }
        .stat-card.total { background: #f1f5f9; color: #334155; }
        .stat-value { font-size: 2rem; font-weight: bold; }
        .stat-label { font-size: 0.85rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; }
        .priority-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
        .priority-high { background: #fee2e2; color: #991b1b; }
        .priority-medium { background: #fef3c7; color: #92400e; }
        .priority-low { background: #dbeafe; color: #1e40af; }
        tr.priority-high { background: #fef2f2; }
        tr.priority-medium { background: #fffbeb; }
        tr.priority-low { background: #eff6ff; }
        .image-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { max-width: 90%; max-height: 90%; border-radius: 8px; }
        .modal-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 2rem; cursor: pointer; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Action Plan Report</h1>
            <div class="header-info">
                <span><strong>Document:</strong> ${data.documentNumber}</span>
                <span><strong>Store:</strong> ${data.storeName} (${data.storeCode})</span>
                <span><strong>Date:</strong> ${new Date(data.auditDate).toLocaleDateString()}</span>
                <span><strong>Auditor:</strong> ${data.auditors}</span>
            </div>
        </div>

        <div class="stats">
            <div class="stat-card total">
                <div class="stat-value">${data.findings.length}</div>
                <div class="stat-label">Total Findings</div>
            </div>
            <div class="stat-card high">
                <div class="stat-value">${data.findings.filter(f => f.priority === 'High').length}</div>
                <div class="stat-label">High Priority</div>
            </div>
            <div class="stat-card medium">
                <div class="stat-value">${data.findings.filter(f => f.priority === 'Medium').length}</div>
                <div class="stat-label">Medium Priority</div>
            </div>
            <div class="stat-card low">
                <div class="stat-value">${data.findings.filter(f => f.priority === 'Low').length}</div>
                <div class="stat-label">Low Priority</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Ref</th>
                    <th>Section</th>
                    <th>Question</th>
                    <th>Finding</th>
                    <th>Corrective Action</th>
                    <th>Priority</th>
                    <th>Pictures</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()} | Food Safety Audit System</p>
        </div>
    </div>

    <div id="imageModal" class="image-modal" onclick="closeImageModal()">
        <span class="modal-close">&times;</span>
        <img id="modalImage" class="modal-content">
    </div>

    <script>
        function openImageModal(src) {
            document.getElementById('imageModal').style.display = 'flex';
            document.getElementById('modalImage').src = src;
        }
        function closeImageModal() {
            document.getElementById('imageModal').style.display = 'none';
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageModal(); });
    </script>
</body>
</html>`;
    }

    /**
     * Generate department report
     * @param {number} auditId - Audit ID
     * @param {string} department - Department name
     * @returns {Promise<Object>} - Result
     */
    async generateDepartmentReport(auditId, department) {
        try {
            console.log(`\n🏢 Generating ${department} Department Report for Audit ID: ${auditId}`);

            await this.ensureConnection();

            // Fetch data
            const auditData = await this.dataService.getAuditData(auditId);
            
            // Get findings for this department
            const allFindings = await this.dataService.getFindings(auditId);
            const deptFindings = allFindings.filter(f => 
                f.department && f.department.toLowerCase().includes(department.toLowerCase())
            );

            const pictures = await this.dataService.getAuditPictures(auditId);

            // Build department report HTML (similar to action plan but filtered)
            const html = this.buildDepartmentReportHtml({
                ...auditData,
                department,
                findings: deptFindings,
                pictures
            });

            // Save
            const fileName = `${department}_Report_${auditData.documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.outputDir, fileName);

            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(filePath, html, 'utf8');

            console.log(`✅ Department report generated: ${filePath}`);

            return {
                success: true,
                filePath,
                fileName,
                html,
                department,
                findings: deptFindings,
                totalFindings: deptFindings.length
            };

        } catch (error) {
            console.error('❌ Error generating department report:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Build department report HTML
     */
    buildDepartmentReportHtml(data) {
        const deptColors = {
            'Maintenance': { bg: '#dbeafe', text: '#1e40af', header: '#3b82f6' },
            'Procurement': { bg: '#f3e8ff', text: '#7c3aed', header: '#8b5cf6' },
            'Cleaning': { bg: '#dcfce7', text: '#166534', header: '#22c55e' }
        };
        const colors = deptColors[data.department] || { bg: '#f1f5f9', text: '#334155', header: '#64748b' };

        const rows = data.findings.map((f, idx) => {
            const pics = data.pictures[f.responseId] || [];
            const picsHtml = pics.map(p => 
                `<img src="${p.dataUrl}" style="max-width:80px;max-height:60px;margin:2px;border-radius:4px;cursor:pointer;" onclick="openImageModal(this.src)">`
            ).join('');

            const priorityClass = f.priority ? `priority-${f.priority.toLowerCase()}` : '';
            
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${f.referenceValue || ''}</td>
                    <td>${f.title || ''}</td>
                    <td>${f.finding || ''}</td>
                    <td>${f.correctiveAction || f.cr || ''}</td>
                    <td><span class="priority-badge ${priorityClass}">${f.priority || '-'}</span></td>
                    <td>${picsHtml || '-'}</td>
                </tr>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.department} Report - ${data.documentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; background: white; }
        .header { background: ${colors.header}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 1.5rem; margin-bottom: 10px; }
        .header-info { display: flex; gap: 30px; flex-wrap: wrap; font-size: 0.9rem; }
        .dept-badge { display: inline-block; padding: 5px 15px; background: rgba(255,255,255,0.2); border-radius: 20px; margin-bottom: 10px; }
        .summary { background: ${colors.bg}; color: ${colors.text}; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .summary-value { font-size: 2.5rem; font-weight: bold; }
        .summary-label { font-size: 0.9rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border: 1px solid #e2e8f0; }
        th { background: ${colors.bg}; font-weight: 600; color: ${colors.text}; }
        .priority-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
        .priority-high { background: #fee2e2; color: #991b1b; }
        .priority-medium { background: #fef3c7; color: #92400e; }
        .priority-low { background: #dbeafe; color: #1e40af; }
        .image-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { max-width: 90%; max-height: 90%; border-radius: 8px; }
        .modal-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 2rem; cursor: pointer; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem; margin-top: 30px; }
        .no-items { text-align: center; padding: 40px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="dept-badge">🏢 ${data.department} Department</span>
            <h1>Follow-up Report</h1>
            <div class="header-info">
                <span><strong>Document:</strong> ${data.documentNumber}</span>
                <span><strong>Store:</strong> ${data.storeName}</span>
                <span><strong>Date:</strong> ${new Date(data.auditDate).toLocaleDateString()}</span>
            </div>
        </div>

        <div class="summary">
            <div class="summary-value">${data.findings.length}</div>
            <div class="summary-label">Items Assigned to ${data.department}</div>
        </div>

        ${data.findings.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Ref</th>
                    <th>Question</th>
                    <th>Finding</th>
                    <th>Corrective Action</th>
                    <th>Priority</th>
                    <th>Pictures</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        ` : '<div class="no-items">No items assigned to this department.</div>'}

        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()} | Food Safety Audit System</p>
        </div>
    </div>

    <div id="imageModal" class="image-modal" onclick="closeImageModal()">
        <span class="modal-close">&times;</span>
        <img id="modalImage" class="modal-content">
    </div>

    <script>
        function openImageModal(src) {
            document.getElementById('imageModal').style.display = 'flex';
            document.getElementById('modalImage').src = src;
        }
        function closeImageModal() {
            document.getElementById('imageModal').style.display = 'none';
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageModal(); });
    </script>
</body>
</html>`;
    }

    /**
     * Get report data without generating file (for API response)
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Report data
     */
    async getReportData(auditId) {
        try {
            await this.ensureConnection();

            const auditData = await this.dataService.getAuditData(auditId);
            const settings = await this.configService.getSettings(auditData.schemaId);
            const sectionScores = await this.dataService.getSectionScores(auditId);
            const sections = await this.dataService.getAuditResponses(auditId);
            const pictures = await this.dataService.getAuditPictures(auditId);
            const findings = await this.dataService.getFindings(auditId);

            return {
                success: true,
                data: {
                    ...auditData,
                    threshold: settings.overallPassingGrade,
                    sectionScores,
                    sections,
                    pictures,
                    findings,
                    generatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('❌ Error getting report data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ReportGenerator;
