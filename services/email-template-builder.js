/**
 * Email Template Builder Service
 * Generates HTML email templates for OE and OHS inspection reports
 * Templates are stored in the database and can be edited via the admin GUI
 */

const sql = require('mssql');
const config = require('../config/default');

const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

class EmailTemplateBuilder {
    constructor() {
        // Brand colors for email templates
        this.brandColors = {
            'SPINNEYS': { primary: '#1a5f2a', secondary: '#2d8f42', gradient: 'linear-gradient(135deg, #1a5f2a 0%, #2d8f42 100%)' },
            'HAPPY': { primary: '#ff6b00', secondary: '#ff8c33', gradient: 'linear-gradient(135deg, #ff6b00 0%, #ff8c33 100%)' },
            'NOKNOK': { primary: '#7c3aed', secondary: '#9f67ff', gradient: 'linear-gradient(135deg, #7c3aed 0%, #9f67ff 100%)' },
            'GMRL': { primary: '#667eea', secondary: '#764ba2', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
            'default': { primary: '#667eea', secondary: '#764ba2', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
        };

        // Module-specific configurations
        this.moduleConfig = {
            'OE': {
                name: 'Operational Excellence',
                icon: '📋',
                actionPlanIcon: '📝',
                passingGrade: 85
            },
            'OHS': {
                name: 'Occupational Health & Safety',
                icon: '🦺',
                actionPlanIcon: '⚠️',
                passingGrade: 80
            }
        };
    }

    /**
     * Get template from database
     * @param {string} templateKey - e.g., 'OE_FULL', 'OHS_ACTION_PLAN'
     */
    async getTemplateFromDB(templateKey) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('templateKey', templateKey)
                .query('SELECT SubjectTemplate, BodyTemplate FROM EmailTemplates WHERE TemplateKey = @templateKey AND IsActive = 1');
            
            if (result.recordset.length > 0) {
                console.log(`Template ${templateKey} loaded from database`);
                return result.recordset[0];
            }
            console.warn(`Template ${templateKey} not found in database`);
            return null;
        } catch (error) {
            console.error('Error fetching template from DB:', error);
            return null;
        }
    }

    /**
     * Replace template variables with actual data
     * @param {string} template - Template string with {{variables}}
     * @param {Object} data - Data object with variable values
     */
    replaceTemplateVariables(template, data) {
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value || '');
        }
        return result;
    }

    /**
     * Build email from database template
     * @param {string} module - 'OE' or 'OHS'
     * @param {string} reportType - 'full' or 'action-plan'
     * @param {Object} auditData - Audit details
     * @param {string} reportUrl - URL to view the report
     * @param {Object} findingsStats - Findings statistics (for action plans)
     */
    async buildEmailFromDB(module, reportType, auditData, reportUrl, findingsStats = null) {
        const templateKey = `${module.toUpperCase()}_${reportType === 'action-plan' ? 'ACTION_PLAN' : 'FULL'}`;
        const template = await this.getTemplateFromDB(templateKey);
        
        if (!template) {
            // Fallback to hardcoded templates if DB template not found
            console.warn(`Template ${templateKey} not found in DB, using fallback`);
            return this.buildEmail(module, reportType, auditData, reportUrl, findingsStats);
        }
        
        const colors = this.getBrandColors(auditData.brandCode);
        const isPassing = (auditData.totalScore || 0) >= (auditData.passingGrade || 85);
        const formattedDate = auditData.auditDate ? new Date(auditData.auditDate).toLocaleDateString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }) : 'N/A';
        
        // Build data object for template replacement
        const templateData = {
            storeName: auditData.storeName || '',
            storeCode: auditData.storeCode || '',
            documentNumber: auditData.documentNumber || '',
            totalScore: auditData.totalScore?.toString() || '0',
            auditDate: formattedDate,
            inspectionDate: formattedDate,
            auditors: auditData.auditors || '',
            inspectors: auditData.auditors || auditData.inspectors || '',
            status: auditData.status || 'Completed',
            reportUrl: reportUrl,
            brandColor: colors.primary,
            brandGradient: colors.gradient,
            scoreClass: isPassing ? 'score-pass' : 'score-fail',
            scoreIcon: isPassing ? '✅' : '❌',
            scoreStatus: isPassing ? 'PASS' : 'FAIL',
            totalFindings: findingsStats?.total?.toString() || '0',
            highFindings: findingsStats?.high?.toString() || '0',
            mediumFindings: findingsStats?.medium?.toString() || '0',
            lowFindings: findingsStats?.low?.toString() || '0',
            criticalFindings: findingsStats?.critical?.toString() || '0',
            deadline: auditData.deadline ? new Date(auditData.deadline).toLocaleDateString('en-GB') : '',
            year: new Date().getFullYear().toString()
        };
        
        const subject = this.replaceTemplateVariables(template.SubjectTemplate, templateData);
        const body = this.replaceTemplateVariables(template.BodyTemplate, templateData);
        
        return { subject, body };
    }

    /**
     * Get brand colors by brand code
     * @param {string} brandCode - e.g., 'SPINNEYS', 'HAPPY', 'NOKNOK'
     */
    getBrandColors(brandCode) {
        return this.brandColors[brandCode?.toUpperCase()] || this.brandColors.default;
    }

    /**
     * Get base email styles
     */
    getBaseStyles() {
        return `
            body { 
                font-family: 'Segoe UI', Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0;
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 650px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .header { 
                color: white; 
                padding: 30px; 
                text-align: center;
            }
            .header h1 { 
                margin: 0; 
                font-size: 26px; 
                font-weight: 600;
            }
            .header .subtitle { 
                margin: 10px 0 0 0; 
                opacity: 0.9; 
                font-size: 16px;
            }
            .content { 
                padding: 30px; 
            }
            .score-badge {
                display: inline-block;
                padding: 8px 20px;
                border-radius: 25px;
                font-size: 18px;
                font-weight: 700;
                margin: 15px 0;
            }
            .score-pass {
                background: rgba(40, 167, 69, 0.2);
                color: #28a745;
            }
            .score-fail {
                background: rgba(220, 53, 69, 0.2);
                color: #dc3545;
            }
            .details-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 20px 0;
                background: #f8f9fa;
                border-radius: 8px;
                overflow: hidden;
            }
            .details-table td { 
                padding: 14px 18px; 
                border-bottom: 1px solid #e9ecef;
            }
            .details-table tr:last-child td {
                border-bottom: none;
            }
            .details-table .label { 
                font-weight: 600; 
                color: #555; 
                width: 40%;
            }
            .details-table .value { 
                color: #333;
            }
            .findings-summary {
                display: flex;
                justify-content: space-around;
                margin: 25px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
            }
            .finding-stat {
                text-align: center;
            }
            .finding-stat .count {
                font-size: 28px;
                font-weight: 700;
            }
            .finding-stat .label {
                font-size: 12px;
                color: #666;
                text-transform: uppercase;
            }
            .high { color: #dc3545; }
            .medium { color: #ffc107; }
            .low { color: #28a745; }
            .total { color: #333; }
            .btn-container {
                text-align: center;
                margin: 30px 0 10px 0;
            }
            .btn {
                display: inline-block;
                padding: 14px 35px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                font-size: 15px;
                margin: 5px;
                transition: opacity 0.2s;
            }
            .btn:hover {
                opacity: 0.9;
            }
            .btn-primary {
                background: #667eea;
                color: white;
            }
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            .footer { 
                padding: 25px; 
                text-align: center; 
                color: #888; 
                font-size: 12px; 
                background: #f8f9fa;
                border-top: 1px solid #e9ecef;
            }
            .footer p { margin: 5px 0; }
        `;
    }

    /**
     * Build OE Full Report Email
     * @param {Object} auditData - Audit details
     * @param {string} reportUrl - URL to view the report
     * @returns {Object} { subject, body }
     */
    buildOEFullReportEmail(auditData, reportUrl) {
        const {
            documentNumber,
            storeName,
            storeCode,
            brandCode,
            auditDate,
            auditors,
            totalScore,
            passingGrade = 85,
            status,
            cycle,
            year
        } = auditData;

        const colors = this.getBrandColors(brandCode);
        const isPassing = totalScore >= passingGrade;
        const formattedDate = auditDate ? new Date(auditDate).toLocaleDateString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }) : 'N/A';

        const subject = `📋 OE Inspection Report - ${storeName} - ${documentNumber} (${totalScore}%)`;

        const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${this.getBaseStyles()}</style>
</head>
<body>
    <div style="padding: 20px; background-color: #f5f5f5;">
        <div class="container">
            <div class="header" style="background: ${colors.gradient};">
                <h1>📋 OE Inspection Report</h1>
                <p class="subtitle">${storeName}</p>
            </div>
            <div class="content">
                <p style="margin-top: 0;">Dear Store Manager,</p>
                <p>Please find below the summary of the Operational Excellence inspection conducted at your store:</p>
                
                <div style="text-align: center;">
                    <div class="score-badge ${isPassing ? 'score-pass' : 'score-fail'}">
                        ${isPassing ? '✅' : '❌'} Score: ${totalScore}% ${isPassing ? '(PASS)' : '(FAIL)'}
                    </div>
                </div>

                <table class="details-table">
                    <tr>
                        <td class="label">Document Number</td>
                        <td class="value">${documentNumber || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Store</td>
                        <td class="value">${storeName}${storeCode ? ` (${storeCode})` : ''}</td>
                    </tr>
                    <tr>
                        <td class="label">Inspection Date</td>
                        <td class="value">${formattedDate}</td>
                    </tr>
                    <tr>
                        <td class="label">Auditor(s)</td>
                        <td class="value">${auditors || 'N/A'}</td>
                    </tr>
                    ${cycle ? `
                    <tr>
                        <td class="label">Cycle</td>
                        <td class="value">${cycle}${year ? ` / ${year}` : ''}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td class="label">Status</td>
                        <td class="value">${status || 'Completed'}</td>
                    </tr>
                    <tr>
                        <td class="label">Passing Grade</td>
                        <td class="value">${passingGrade}%</td>
                    </tr>
                </table>

                <div class="btn-container">
                    <a href="${reportUrl}" class="btn btn-primary" style="background: ${colors.primary};">
                        📄 View Full Report
                    </a>
                </div>

                <p style="color: #666; font-size: 14px; margin-top: 25px;">
                    Please review the report and address any findings within the required timeframe.
                    If you have any questions, please contact the Operational Excellence team.
                </p>
            </div>
            <div class="footer">
                <p>This is an automated message from the Operational Excellence Application.</p>
                <p>Please do not reply to this email.</p>
                <p style="margin-top: 10px; color: #aaa;">© ${new Date().getFullYear()} GMRL Group</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        return { subject, body };
    }

    /**
     * Build OE Action Plan Email
     * @param {Object} auditData - Audit details
     * @param {string} reportUrl - URL to view the action plan report
     * @param {Object} findingsStats - { total, high, medium, low }
     * @returns {Object} { subject, body }
     */
    buildOEActionPlanEmail(auditData, reportUrl, findingsStats) {
        const {
            documentNumber,
            storeName,
            storeCode,
            brandCode,
            auditDate,
            auditors,
            totalScore,
            deadline
        } = auditData;

        const colors = this.getBrandColors(brandCode);
        const { total = 0, high = 0, medium = 0, low = 0 } = findingsStats || {};
        
        const formattedDate = auditDate ? new Date(auditDate).toLocaleDateString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }) : 'N/A';
        
        const formattedDeadline = deadline ? new Date(deadline).toLocaleDateString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }) : 'Within 14 days';

        const subject = `📝 OE Action Plan Required - ${storeName} - ${total} Findings (${high} High)`;

        const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${this.getBaseStyles()}</style>
</head>
<body>
    <div style="padding: 20px; background-color: #f5f5f5;">
        <div class="container">
            <div class="header" style="background: ${colors.gradient};">
                <h1>📝 OE Action Plan</h1>
                <p class="subtitle">${storeName} - ${documentNumber}</p>
            </div>
            <div class="content">
                <p style="margin-top: 0;">Dear Store Manager,</p>
                <p>Following the Operational Excellence inspection at your store, please find below the findings that require your attention and corrective action:</p>
                
                <div class="findings-summary" style="display: table; width: 100%;">
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count total">${total}</div>
                        <div class="label">Total Findings</div>
                    </div>
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count high">${high}</div>
                        <div class="label">High Priority</div>
                    </div>
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count medium">${medium}</div>
                        <div class="label">Medium Priority</div>
                    </div>
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count low">${low}</div>
                        <div class="label">Low Priority</div>
                    </div>
                </div>

                <table class="details-table">
                    <tr>
                        <td class="label">Document Number</td>
                        <td class="value">${documentNumber || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Store</td>
                        <td class="value">${storeName}${storeCode ? ` (${storeCode})` : ''}</td>
                    </tr>
                    <tr>
                        <td class="label">Inspection Date</td>
                        <td class="value">${formattedDate}</td>
                    </tr>
                    <tr>
                        <td class="label">Inspector</td>
                        <td class="value">${auditors || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Overall Score</td>
                        <td class="value">${totalScore ? `${totalScore}%` : 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label" style="color: #dc3545; font-weight: 700;">⏰ Action Required By</td>
                        <td class="value" style="color: #dc3545; font-weight: 700;">${formattedDeadline}</td>
                    </tr>
                </table>

                <div class="btn-container">
                    <a href="${reportUrl}" class="btn btn-primary" style="background: ${colors.primary};">
                        📋 View Action Plan
                    </a>
                </div>

                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-top: 25px;">
                    <strong>⚠️ Important:</strong>
                    <p style="margin: 10px 0 0 0; color: #856404;">
                        Please address all findings, especially high-priority items, by the deadline.
                        Document your corrective actions and submit verification photos where required.
                    </p>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated message from the Operational Excellence Application.</p>
                <p>Please do not reply to this email.</p>
                <p style="margin-top: 10px; color: #aaa;">© ${new Date().getFullYear()} GMRL Group</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        return { subject, body };
    }

    /**
     * Build OHS Full Report Email
     * @param {Object} auditData - Audit details
     * @param {string} reportUrl - URL to view the report
     * @returns {Object} { subject, body }
     */
    buildOHSFullReportEmail(auditData, reportUrl) {
        const {
            documentNumber,
            storeName,
            storeCode,
            brandCode,
            inspectionDate,
            inspectorName,
            totalScore,
            passingGrade = 80,
            status
        } = auditData;

        const colors = this.getBrandColors(brandCode);
        const isPassing = totalScore >= passingGrade;
        const formattedDate = inspectionDate ? new Date(inspectionDate).toLocaleDateString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }) : 'N/A';

        const subject = `🦺 OHS Inspection Report - ${storeName} - ${documentNumber} (${totalScore}%)`;

        const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${this.getBaseStyles()}</style>
</head>
<body>
    <div style="padding: 20px; background-color: #f5f5f5;">
        <div class="container">
            <div class="header" style="background: ${colors.gradient};">
                <h1>🦺 OHS Inspection Report</h1>
                <p class="subtitle">${storeName}</p>
            </div>
            <div class="content">
                <p style="margin-top: 0;">Dear Store Manager,</p>
                <p>Please find below the summary of the Occupational Health & Safety inspection conducted at your store:</p>
                
                <div style="text-align: center;">
                    <div class="score-badge ${isPassing ? 'score-pass' : 'score-fail'}">
                        ${isPassing ? '✅' : '❌'} Score: ${totalScore}% ${isPassing ? '(PASS)' : '(FAIL)'}
                    </div>
                </div>

                <table class="details-table">
                    <tr>
                        <td class="label">Document Number</td>
                        <td class="value">${documentNumber || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Store</td>
                        <td class="value">${storeName}${storeCode ? ` (${storeCode})` : ''}</td>
                    </tr>
                    <tr>
                        <td class="label">Inspection Date</td>
                        <td class="value">${formattedDate}</td>
                    </tr>
                    <tr>
                        <td class="label">Inspector</td>
                        <td class="value">${inspectorName || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Status</td>
                        <td class="value">${status || 'Completed'}</td>
                    </tr>
                    <tr>
                        <td class="label">Passing Grade</td>
                        <td class="value">${passingGrade}%</td>
                    </tr>
                </table>

                <div class="btn-container">
                    <a href="${reportUrl}" class="btn btn-primary" style="background: ${colors.primary};">
                        📄 View Full Report
                    </a>
                </div>

                <p style="color: #666; font-size: 14px; margin-top: 25px;">
                    Please review the report and address any safety findings immediately.
                    Safety is our top priority. If you have questions, contact the OHS team.
                </p>
            </div>
            <div class="footer">
                <p>This is an automated message from the Operational Excellence Application.</p>
                <p>Please do not reply to this email.</p>
                <p style="margin-top: 10px; color: #aaa;">© ${new Date().getFullYear()} GMRL Group</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        return { subject, body };
    }

    /**
     * Build OHS Action Plan Email
     * @param {Object} auditData - Audit details
     * @param {string} reportUrl - URL to view the action plan
     * @param {Object} findingsStats - { total, high, medium, low }
     * @returns {Object} { subject, body }
     */
    buildOHSActionPlanEmail(auditData, reportUrl, findingsStats) {
        const {
            documentNumber,
            storeName,
            storeCode,
            brandCode,
            inspectionDate,
            inspectorName,
            totalScore,
            deadline
        } = auditData;

        const colors = this.getBrandColors(brandCode);
        const { total = 0, high = 0, medium = 0, low = 0 } = findingsStats || {};
        
        const formattedDate = inspectionDate ? new Date(inspectionDate).toLocaleDateString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }) : 'N/A';
        
        const formattedDeadline = deadline ? new Date(deadline).toLocaleDateString('en-GB', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }) : 'Immediate Action Required';

        const subject = `⚠️ OHS Action Plan Required - ${storeName} - ${total} Findings (${high} High)`;

        const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${this.getBaseStyles()}</style>
</head>
<body>
    <div style="padding: 20px; background-color: #f5f5f5;">
        <div class="container">
            <div class="header" style="background: ${colors.gradient};">
                <h1>⚠️ OHS Action Plan</h1>
                <p class="subtitle">${storeName} - ${documentNumber}</p>
            </div>
            <div class="content">
                <p style="margin-top: 0;">Dear Store Manager,</p>
                <p>Following the Occupational Health & Safety inspection at your store, the following safety findings require <strong>immediate attention</strong>:</p>
                
                <div class="findings-summary" style="display: table; width: 100%;">
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count total">${total}</div>
                        <div class="label">Total Findings</div>
                    </div>
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count high">${high}</div>
                        <div class="label">High Priority</div>
                    </div>
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count medium">${medium}</div>
                        <div class="label">Medium Priority</div>
                    </div>
                    <div class="finding-stat" style="display: table-cell; text-align: center; padding: 15px;">
                        <div class="count low">${low}</div>
                        <div class="label">Low Priority</div>
                    </div>
                </div>

                <table class="details-table">
                    <tr>
                        <td class="label">Document Number</td>
                        <td class="value">${documentNumber || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Store</td>
                        <td class="value">${storeName}${storeCode ? ` (${storeCode})` : ''}</td>
                    </tr>
                    <tr>
                        <td class="label">Inspection Date</td>
                        <td class="value">${formattedDate}</td>
                    </tr>
                    <tr>
                        <td class="label">Inspector</td>
                        <td class="value">${inspectorName || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Overall Score</td>
                        <td class="value">${totalScore ? `${totalScore}%` : 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label" style="color: #dc3545; font-weight: 700;">🚨 Action Required By</td>
                        <td class="value" style="color: #dc3545; font-weight: 700;">${formattedDeadline}</td>
                    </tr>
                </table>

                <div class="btn-container">
                    <a href="${reportUrl}" class="btn btn-primary" style="background: ${colors.primary};">
                        📋 View Action Plan
                    </a>
                </div>

                <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin-top: 25px;">
                    <strong>🚨 Safety Critical:</strong>
                    <p style="margin: 10px 0 0 0; color: #721c24;">
                        High-priority safety findings must be addressed <strong>immediately</strong>.
                        Failure to address safety issues may result in workplace incidents.
                        Escalation to Head of Operations will occur if findings remain unresolved.
                    </p>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated message from the Operational Excellence Application.</p>
                <p>Please do not reply to this email.</p>
                <p style="margin-top: 10px; color: #aaa;">© ${new Date().getFullYear()} GMRL Group</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        return { subject, body };
    }

    /**
     * Build email based on module and report type
     * @param {string} module - 'OE' or 'OHS'
     * @param {string} reportType - 'full' or 'action-plan'
     * @param {Object} auditData - Audit details
     * @param {string} reportUrl - URL to view the report
     * @param {Object} findingsStats - Required for action-plan type
     * @returns {Object} { subject, body }
     */
    buildEmail(module, reportType, auditData, reportUrl, findingsStats = null) {
        if (module.toUpperCase() === 'OE') {
            if (reportType === 'full') {
                return this.buildOEFullReportEmail(auditData, reportUrl);
            } else if (reportType === 'action-plan') {
                return this.buildOEActionPlanEmail(auditData, reportUrl, findingsStats);
            }
        } else if (module.toUpperCase() === 'OHS') {
            if (reportType === 'full') {
                return this.buildOHSFullReportEmail(auditData, reportUrl);
            } else if (reportType === 'action-plan') {
                return this.buildOHSActionPlanEmail(auditData, reportUrl, findingsStats);
            }
        }
        
        throw new Error(`Unknown module/reportType combination: ${module}/${reportType}`);
    }
}

// Export singleton instance
module.exports = new EmailTemplateBuilder();
