/**
 * Template Generator Service
 * Generates HTML reports from template and data
 */

const fs = require('fs').promises;
const path = require('path');
const { getDepartmentIcon, getDepartmentColor } = require('../config/department-mappings');

class TemplateGenerator {
    constructor() {
        this.templatePath = path.join(__dirname, '../templates/department-report-template.html');
    }

    /**
     * Generate HTML report for department follow-ups
     * @param {string} department - Department name
     * @param {Array} followupItems - Follow-up items with images
     * @param {Object} statistics - Statistics object
     * @returns {Promise<string>} - Generated HTML
     */
    async generateReport(department, followupItems, statistics) {
        try {
            console.log(`\n🎨 Generating HTML report for ${department}...`);

            // Load template
            const template = await fs.readFile(this.templatePath, 'utf-8');

            // Prepare data
            const departmentIcon = getDepartmentIcon(department);
            const departmentColor = getDepartmentColor(department);
            const generatedDate = new Date().toLocaleDateString();
            const generatedTime = new Date().toLocaleTimeString();

            // Group items by section
            const itemsBySection = this.groupBySection(followupItems);

            // Generate sections HTML
            const sectionsHtml = this.generateSectionsHtml(itemsBySection, departmentColor);

            // Generate statistics HTML
            const statisticsHtml = this.generateStatisticsHtml(statistics, departmentColor);

            // Replace placeholders
            let html = template
                .replace(/\{\{departmentName\}\}/g, department)
                .replace(/\{\{departmentIcon\}\}/g, departmentIcon)
                .replace(/\{\{departmentColor\}\}/g, departmentColor)
                .replace(/\{\{generatedDate\}\}/g, generatedDate)
                .replace(/\{\{generatedTime\}\}/g, generatedTime)
                .replace(/\{\{totalItems\}\}/g, followupItems.length.toString())
                .replace(/\{\{statistics\}\}/g, statisticsHtml)
                .replace(/\{\{followupSections\}\}/g, sectionsHtml);

            console.log(`✅ HTML report generated successfully`);

            return html;

        } catch (error) {
            console.error('❌ Error generating report:', error.message);
            throw error;
        }
    }

    /**
     * Group follow-up items by section
     * @param {Array} items - Follow-up items
     * @returns {Object} - Items grouped by section
     */
    groupBySection(items) {
        const grouped = {};

        for (const item of items) {
            const section = item.section || 'General';
            
            if (!grouped[section]) {
                grouped[section] = [];
            }
            
            grouped[section].push(item);
        }

        return grouped;
    }

    /**
     * Generate statistics HTML
     * @param {Object} stats - Statistics object
     * @param {string} color - Department color
     * @returns {string} - Statistics HTML
     */
    generateStatisticsHtml(stats, color) {
        return `
            <div class="statistics">
                <div class="stat-card">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">Total Follow-ups</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.byPriority.High || 0}</div>
                    <div class="stat-label">High Priority</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.byPriority.Medium || 0}</div>
                    <div class="stat-label">Medium Priority</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.byPriority.Low || 0}</div>
                    <div class="stat-label">Low Priority</div>
                </div>
            </div>
        `;
    }

    /**
     * Generate sections HTML
     * @param {Object} itemsBySection - Items grouped by section
     * @param {string} color - Department color
     * @returns {string} - Sections HTML
     */
    generateSectionsHtml(itemsBySection, color) {
        const sections = Object.keys(itemsBySection).sort();
        
        if (sections.length === 0) {
            return `
                <div class="empty-section">
                    <p>No follow-up items found for this department.</p>
                </div>
            `;
        }

        return sections.map(section => {
            const items = itemsBySection[section];
            const tableHtml = this.generateTableHtml(items);

            return `
                <div class="section-group">
                    <div class="section-header">${section}</div>
                    ${tableHtml}
                </div>
            `;
        }).join('');
    }

    /**
     * Generate table HTML for a section
     * @param {Array} items - Follow-up items
     * @returns {string} - Table HTML
     */
    generateTableHtml(items) {
        const rowsHtml = items.map((item, index) => {
            return `
                <tr>
                    <td class="ref-col">${this.escapeHtml(item.referenceValue)}</td>
                    <td class="section-col">${this.escapeHtml(item.section)}</td>
                    <td class="title-col">${this.escapeHtml(item.itemTitle)}</td>
                    <td class="finding-col">${this.escapeHtml(item.finding)}</td>
                    <td class="action-col">${this.escapeHtml(item.correctiveAction)}</td>
                    <td class="priority-col">${this.generatePriorityBadge(item.priority)}</td>
                    <td class="pictures-col">${this.generateImagesHtml(item.correctiveImages)}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="followup-table">
                <thead>
                    <tr>
                        <th class="ref-col">#</th>
                        <th class="section-col">Section</th>
                        <th class="title-col">Item Title</th>
                        <th class="finding-col">Finding</th>
                        <th class="action-col">Corrective Action</th>
                        <th class="priority-col">Priority</th>
                        <th class="pictures-col">Corrective Pictures</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    }

    /**
     * Generate priority badge HTML
     * @param {string} priority - Priority level
     * @returns {string} - Badge HTML
     */
    generatePriorityBadge(priority) {
        const priorityLower = (priority || '').toLowerCase();
        let className = 'priority-low';
        
        if (priorityLower.includes('high')) {
            className = 'priority-high';
        } else if (priorityLower.includes('medium')) {
            className = 'priority-medium';
        }

        return `<span class="priority-badge ${className}">${this.escapeHtml(priority) || 'Low'}</span>`;
    }

    /**
     * Generate images HTML
     * @param {Array} images - Corrective images array
     * @returns {string} - Images HTML
     */
    generateImagesHtml(images) {
        if (!images || images.length === 0) {
            return '<span class="no-images">No images</span>';
        }

        const imagesHtml = images.map(img => {
            return `<img src="${img.dataUrl}" 
                         class="image-thumbnail" 
                         onclick="openImageModal('${img.dataUrl}')" 
                         alt="${this.escapeHtml(img.fileName)}" 
                         title="Click to enlarge: ${this.escapeHtml(img.fileName)}">`;
        }).join('');

        return `<div class="image-gallery">${imagesHtml}</div>`;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';
        
        return text
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Save report to file
     * @param {string} html - HTML content
     * @param {string} department - Department name
     * @param {string} outputDir - Output directory
     * @returns {Promise<string>} - File path
     */
    async saveReport(html, department, outputDir) {
        try {
            // Ensure output directory exists
            await fs.mkdir(outputDir, { recursive: true });

            // Generate filename
            const date = new Date().toISOString().split('T')[0];
            const filename = `${department}_Followup_Report_${date}.html`;
            const filePath = path.join(outputDir, filename);

            // Write file
            await fs.writeFile(filePath, html, 'utf-8');

            console.log(`✅ Report saved to: ${filePath}`);

            return filePath;

        } catch (error) {
            console.error('❌ Error saving report:', error.message);
            throw error;
        }
    }
}

module.exports = TemplateGenerator;
