/**
 * Template Engine
 * Builds HTML reports from templates with data
 */

const fs = require('fs').promises;
const path = require('path');
const { escapeHtml, formatDate, formatTime, getSectionIcon, cleanText } = require('./utilities');

class TemplateEngine {
    constructor() {
        this.templatesDir = path.join(__dirname, '..', 'templates');
        this.stylesDir = path.join(__dirname, '..', 'styles');
        this.templates = {};
    }

    /**
     * Load all templates from disk
     */
    async loadTemplates() {
        try {
            console.log('📄 Loading report templates...');
            
            const templateFiles = [
                'main-layout.html',
                'header.html',
                'audit-info.html',
                'performance-banner.html',
                'section.html',
                'section-table.html',
                'findings-table.html',
                'chart.html',
                'image-modal.html',
                'footer.html'
            ];

            for (const file of templateFiles) {
                const templatePath = path.join(this.templatesDir, file);
                try {
                    this.templates[file.replace('.html', '')] = await fs.readFile(templatePath, 'utf8');
                } catch (err) {
                    console.warn(`   ⚠️ Template not found: ${file}`);
                    this.templates[file.replace('.html', '')] = '';
                }
            }

            console.log(`   ✅ Loaded ${Object.keys(this.templates).length} templates`);
        } catch (error) {
            console.error('❌ Error loading templates:', error);
            throw error;
        }
    }

    /**
     * Load CSS styles
     * @returns {Promise<string>} - CSS content
     */
    async loadStyles() {
        try {
            const cssPath = path.join(this.stylesDir, 'report-styles.css');
            return await fs.readFile(cssPath, 'utf8');
        } catch (error) {
            console.warn('⚠️ Could not load styles, using defaults');
            return this.getDefaultStyles();
        }
    }

    /**
     * Replace placeholders in template
     * @param {string} template - Template string
     * @param {Object} data - Data object with placeholder values
     * @returns {string} - Processed template
     */
    replacePlaceholders(template, data) {
        if (!template) return '';
        
        let result = template;
        
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value ?? '');
        }
        
        return result;
    }

    /**
     * Build complete HTML document
     * @param {Object} reportData - Complete report data
     * @param {Object} options - Build options
     * @returns {Promise<string>} - Complete HTML document
     */
    async buildDocument(reportData, options = {}) {
        // Load templates if not loaded
        if (Object.keys(this.templates).length === 0) {
            await this.loadTemplates();
        }

        const styles = await this.loadStyles();
        
        // Build each section
        const header = this.buildHeader(reportData);
        const auditInfo = this.buildAuditInfo(reportData);
        const performanceBanner = this.buildPerformanceBanner(reportData);
        const dataTable = this.buildDataTable(reportData);
        const chartSection = this.buildChart(reportData);
        const sectionsHtml = this.buildSections(reportData);
        const findingsHtml = this.buildFindings(reportData);
        const allFindingsPictures = this.buildAllFindingsPictures(reportData);
        const allGoodObservationsPictures = this.buildAllGoodObservationsPictures(reportData);
        const allCorrectiveActionsPictures = this.buildAllCorrectiveActionsPictures(reportData);
        const imageModal = this.templates['image-modal'] || this.getImageModalHtml();
        const footer = this.buildFooter(reportData);

        // Build main layout
        const mainLayout = this.templates['main-layout'] || this.getMainLayoutTemplate();
        
        return this.replacePlaceholders(mainLayout, {
            title: `Audit Report - ${reportData.documentNumber}`,
            styles: `<style>${styles}</style>`,
            header,
            auditInfo,
            performanceBanner,
            dataTable,
            chart: chartSection,
            sections: sectionsHtml,
            findings: findingsHtml,
            allFindingsPictures,
            allGoodObservationsPictures,
            allCorrectiveActionsPictures,
            imageModal,
            footer,
            scripts: this.getScripts(reportData),
            documentNumber: reportData.documentNumber,
            generatedAt: new Date().toLocaleString()
        });
    }

    /**
     * Build header section
     */
    buildHeader(data) {
        const reportTitle = data.reportTitle || 'Food Safety Audit Report';
        const template = this.templates['header'] || `
            <div class="report-header">
                <div class="header-logo">
                    <h1>🍽️ ${reportTitle}</h1>
                </div>
                <div class="header-info">
                    <span class="doc-number">{{documentNumber}}</span>
                </div>
            </div>
        `;

        return this.replacePlaceholders(template, {
            documentNumber: data.documentNumber,
            schemaName: data.schemaName || 'Food Safety Audit',
            reportTitle: reportTitle
        });
    }

    /**
     * Build audit info section
     */
    buildAuditInfo(data) {
        const template = this.templates['audit-info'] || `
            <div class="audit-info-grid">
                <div class="info-item">
                    <label>Store:</label>
                    <span>{{storeName}} ({{storeCode}})</span>
                </div>
                <div class="info-item">
                    <label>Date:</label>
                    <span>{{auditDate}}</span>
                </div>
                <div class="info-item">
                    <label>Time In:</label>
                    <span>{{timeIn}}</span>
                </div>
                <div class="info-item">
                    <label>Time Out:</label>
                    <span>{{timeOut}}</span>
                </div>
                <div class="info-item">
                    <label>Cycle:</label>
                    <span>{{cycle}} {{year}}</span>
                </div>
                <div class="info-item">
                    <label>Auditor(s):</label>
                    <span>{{auditors}}</span>
                </div>
                <div class="info-item">
                    <label>Accompanied By:</label>
                    <span>{{accompaniedBy}}</span>
                </div>
            </div>
        `;

        return this.replacePlaceholders(template, {
            storeName: escapeHtml(data.storeName || 'N/A'),
            storeCode: escapeHtml(data.storeCode || ''),
            auditDate: formatDate(data.auditDate),
            timeIn: formatTime(data.timeIn),
            timeOut: formatTime(data.timeOut),
            cycle: data.cycle || 'N/A',
            year: data.year || '',
            auditors: escapeHtml(data.auditors || 'N/A'),
            accompaniedBy: escapeHtml(data.accompaniedBy || 'N/A')
        });
    }

    /**
     * Build performance banner
     */
    buildPerformanceBanner(data) {
        const score = data.totalScore || 0;
        const threshold = data.threshold || 83;
        const isPassing = score >= threshold;
        
        const statusClass = isPassing ? 'status-pass' : 'status-fail';
        const statusText = isPassing ? 'PASS ✅' : 'FAIL ❌';
        const statusEmoji = isPassing ? '🎉' : '⚠️';

        const template = this.templates['performance-banner'] || `
            <div class="performance-banner {{statusClass}}">
                <div class="score-display">
                    <span class="score-value">{{score}}%</span>
                    <span class="score-label">Overall Score</span>
                </div>
                <div class="status-display">
                    <span class="status-emoji">{{statusEmoji}}</span>
                    <span class="status-text">{{statusText}}</span>
                </div>
                <div class="threshold-info">
                    Passing: {{threshold}}%
                </div>
            </div>
        `;

        return this.replacePlaceholders(template, {
            score: Math.round(score),
            statusClass,
            statusText,
            statusEmoji,
            threshold
        });
    }

    /**
     * Build sections HTML
     */
    buildSections(data) {
        if (!data.sections || data.sections.length === 0) {
            return '<p class="no-data">No section data available.</p>';
        }

        return data.sections.map(section => this.buildSection(section, data)).join('\n');
    }

    /**
     * Build single section
     */
    buildSection(section, reportData) {
        const threshold = reportData.threshold || 83;
        const isPassing = section.percentage >= threshold;
        const scoreClass = isPassing ? 'score-pass' : 'score-fail';
        const emoji = isPassing ? '✅' : '❌';

        const template = this.templates['section'] || `
            <div class="section" id="section-{{sectionNumber}}">
                <div class="section-header">
                    <div class="section-title">
                        <span class="section-icon">{{icon}}</span>
                        <span class="section-name">{{sectionName}}</span>
                    </div>
                    <div class="section-score {{scoreClass}}">
                        {{percentage}}% {{emoji}}
                    </div>
                </div>
                <div class="section-content">
                    {{itemsTable}}
                    {{sectionFindings}}
                    {{temperatureReadings}}
                </div>
            </div>
        `;

        const itemsTable = this.buildSectionTable(section.items, reportData.pictures);
        const sectionFindings = this.buildSectionFindings(section.items, reportData.pictures, reportData.historicalFindings);
        
        // Get temperature readings for this section (based on ResponseID matching section items)
        const sectionTemps = this.filterTemperaturesBySection(reportData.temperatureReadings, section.items);
        const temperatureReadings = this.buildTemperatureReadings(sectionTemps);

        return this.replacePlaceholders(template, {
            sectionNumber: section.sectionNumber,
            sectionName: escapeHtml(section.sectionName),
            icon: getSectionIcon(section.sectionIcon, section.sectionNumber),
            percentage: parseFloat((section.percentage || 0).toFixed(2)),
            emoji,
            scoreClass,
            itemsTable,
            sectionFindings,
            temperatureReadings
        });
    }

    /**
     * Filter temperature readings by section items (match ResponseID)
     * Temperature readings belong to the section that contains the matching ResponseID
     */
    filterTemperaturesBySection(temperatureReadings, sectionItems) {
        if (!temperatureReadings || !sectionItems) return { good: [], bad: [] };
        
        // Get all responseIds from this section's items
        const sectionResponseIds = new Set(sectionItems.map(item => item.responseId));
        
        return {
            good: (temperatureReadings.good || []).filter(r => sectionResponseIds.has(r.responseId)),
            bad: (temperatureReadings.bad || []).filter(r => sectionResponseIds.has(r.responseId))
        };
    }

    /**
     * Build temperature readings tables
     */
    buildTemperatureReadings(temps) {
        if (!temps || (temps.good.length === 0 && temps.bad.length === 0)) {
            return '';
        }

        let html = '<div class="temperature-readings">';
        html += '<h4 class="temperature-title">🌡️ Temperature Readings</h4>';

        // Bad/Finding readings table
        if (temps.bad.length > 0) {
            const badRows = temps.bad.map(reading => {
                const pictureHtml = reading.picture 
                    ? `<img src="${reading.picture}" class="temp-picture" onclick="openImageModal(this.src)" />`
                    : '-';
                return `
                    <tr class="temp-bad">
                        <td>${escapeHtml(reading.section || '')}</td>
                        <td>${escapeHtml(reading.unit || '')}</td>
                        <td>${reading.displayTemp ?? '-'}</td>
                        <td>${reading.probeTemp ?? '-'}</td>
                        <td class="issue-col">${escapeHtml(reading.issue || '')}</td>
                        <td>${pictureHtml}</td>
                    </tr>
                `;
            }).join('\n');

            html += `
                <div class="temp-findings">
                    <h5>❌ Fridges with Findings (${temps.bad.length})</h5>
                    <table class="temp-table temp-bad-table">
                        <thead>
                            <tr>
                                <th>Section</th>
                                <th>Unit</th>
                                <th>Display (°C)</th>
                                <th>Probe (°C)</th>
                                <th>Issue</th>
                                <th>Picture</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${badRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Good readings table
        if (temps.good.length > 0) {
            const goodRows = temps.good.map(reading => {
                const pictureHtml = reading.picture 
                    ? `<img src="${reading.picture}" class="temp-picture" onclick="openImageModal(this.src)" />`
                    : '-';
                return `
                    <tr class="temp-good">
                        <td>${escapeHtml(reading.section || '')}</td>
                        <td>${escapeHtml(reading.unit || '')}</td>
                        <td>${reading.displayTemp ?? '-'}</td>
                        <td>${reading.probeTemp ?? '-'}</td>
                        <td>${pictureHtml}</td>
                    </tr>
                `;
            }).join('\n');

            html += `
                <div class="temp-compliant">
                    <h5>✅ Compliant Fridges (${temps.good.length})</h5>
                    <table class="temp-table temp-good-table">
                        <thead>
                            <tr>
                                <th>Section</th>
                                <th>Unit</th>
                                <th>Display (°C)</th>
                                <th>Probe (°C)</th>
                                <th>Picture</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${goodRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    /**
     * Build section items table - shows all items with good observation pictures
     */
    buildSectionTable(items, pictures = {}) {
        if (!items || items.length === 0) {
            return '<p class="no-items">No items in this section.</p>';
        }

        const rows = items.map(item => {
            // Get "Good" pictures only for main table
            const itemPictures = pictures[item.responseId] || [];
            const goodPictures = itemPictures.filter(p => {
                const type = (p.pictureType || '').toLowerCase();
                return type === 'good';
            });
            const picturesHtml = goodPictures.length > 0 
                ? goodPictures.map(p => `<img src="${p.dataUrl}" class="item-picture" onclick="openImageModal(this.src)" />`).join('')
                : '';

            // Display value (numeric) for Yes/Partially/No, blank for NA
            let answerDisplay = '-';
            if (item.selectedChoice === 'NA') {
                answerDisplay = 'N/A';
            } else if (item.value !== null && item.value !== undefined) {
                answerDisplay = item.value;
            }

            // Coefficient display - blank for NA
            const coeffDisplay = item.selectedChoice === 'NA' ? '' : (item.coeff || '-');

            return `
                <tr>
                    <td class="ref-col">${escapeHtml(item.referenceValue || '')}</td>
                    <td class="criteria-col">${escapeHtml(item.title || '')}</td>
                    <td class="coeff-col">${coeffDisplay}</td>
                    <td class="answer-col">${answerDisplay}</td>
                    <td class="comments-col">${escapeHtml(item.comment || '')}</td>
                    <td class="pictures-col">${picturesHtml}</td>
                </tr>
            `;
        }).join('\n');

        return `
            <table class="section-table">
                <thead>
                    <tr>
                        <th class="ref-col">#</th>
                        <th class="criteria-col">Criteria / Requirement</th>
                        <th class="coeff-col">Coef</th>
                        <th class="answer-col">Answer</th>
                        <th class="comments-col">Comments</th>
                        <th class="pictures-col">Pictures of Comments</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    /**
     * Build section findings - shows No/Partially items with finding pictures
     * @param {Array} items - Section items
     * @param {Object} pictures - Pictures indexed by responseId
     * @param {Object} historicalFindings - Historical findings map by referenceValue
     */
    buildSectionFindings(items, pictures = {}, historicalFindings = {}) {
        // Filter to only No and Partially answers
        const findings = items.filter(item => 
            item.selectedChoice === 'No' || item.selectedChoice === 'Partially'
        );

        if (findings.length === 0) {
            return '';
        }

        const rows = findings.map(item => {
            // Get "Finding" or "Corrective" type pictures (case-insensitive)
            // Note: Database stores "Corrective" for finding pictures
            const itemPictures = pictures[item.responseId] || [];
            const findingPictures = itemPictures.filter(p => {
                const type = (p.pictureType || '').toLowerCase();
                return type === 'finding' || type === 'corrective';
            });
            const picturesHtml = findingPictures.length > 0 
                ? findingPictures.map(p => `<img src="${p.dataUrl}" class="finding-picture" onclick="openImageModal(this.src)" />`).join('')
                : '-';

            const priorityClass = item.priority ? `priority-${item.priority.toLowerCase()}` : '';
            const priorityBadge = item.priority ? `<span class="priority-badge ${priorityClass}">${item.priority}</span>` : '-';
            
            // Answer display for findings (No = 0, Partially = half of coeff)
            const answerText = item.selectedChoice === 'No' ? 'No' : 'Partially';

            // Check if this finding is repetitive (appeared in historical audits)
            const refKey = item.referenceValue || item.title;
            const historicalData = historicalFindings[refKey];
            const isRepetitive = historicalData && historicalData.count > 0;
            
            // Build tooltip with document numbers
            let repetitiveBadge = '';
            if (isRepetitive) {
                const docNumbers = historicalData.occurrences
                    .map(o => o.documentNumber)
                    .filter((v, i, a) => a.indexOf(v) === i) // Unique document numbers
                    .slice(0, 5) // Limit to 5 for readability
                    .join(', ');
                const moreText = historicalData.count > 5 ? ` (+${historicalData.count - 5} more)` : '';
                repetitiveBadge = `<span class="repetitive-badge" title="Found in ${historicalData.count} previous audit(s): ${docNumbers}${moreText}">🔄 ${historicalData.count}x</span>`;
            }

            return `
                <tr id="ref-${(item.referenceValue || '').replace(/\./g, '-')}" class="${priorityClass} ${isRepetitive ? 'repetitive-row' : ''}">
                    <td class="ref-col">${escapeHtml(item.referenceValue || '')} ${repetitiveBadge}</td>
                    <td class="criteria-col">${escapeHtml(item.title || '')}</td>
                    <td class="answer-col"><span class="answer-badge answer-${item.selectedChoice.toLowerCase()}">${answerText}</span></td>
                    <td class="finding-col">${escapeHtml(item.finding || '')}</td>
                    <td class="corrective-col">${escapeHtml(item.correctiveAction || item.cr || '')}</td>
                    <td class="priority-col">${priorityBadge}</td>
                    <td class="pictures-col">${picturesHtml}</td>
                </tr>
            `;
        }).join('\n');

        // Count repetitive findings
        const repetitiveCount = findings.filter(item => {
            const refKey = item.referenceValue || item.title;
            return historicalFindings[refKey] && historicalFindings[refKey].count > 0;
        }).length;
        const repetitiveNote = repetitiveCount > 0 
            ? `<span class="repetitive-summary">🔄 ${repetitiveCount} repetitive issue(s)</span>` 
            : '';

        return `
            <div class="section-findings">
                <h4 class="findings-title">⚠️ Findings (${findings.length}) ${repetitiveNote}</h4>
                <table class="findings-table">
                    <thead>
                        <tr>
                            <th class="ref-col">#</th>
                            <th class="criteria-col">Criteria / Requirement</th>
                            <th class="answer-col">Answer</th>
                            <th class="finding-col">Finding</th>
                            <th class="corrective-col">Corrective Action</th>
                            <th class="priority-col">Priority</th>
                            <th class="pictures-col">Pictures</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Build findings/action plan section - DISABLED (findings shown per section now)
     */
    buildFindings(data) {
        // Return empty - findings are now shown within each section
        return '';
    }

    /**
     * Build consolidated finding pictures gallery
     * Collects all finding pictures from all sections and displays them in large format
     * with their reference values for easy review
     */
    buildAllFindingsPictures(data) {
        if (!data.sections || data.sections.length === 0 || !data.pictures) {
            return '';
        }

        const allFindingPictures = [];

        // Collect finding pictures from all sections
        for (const section of data.sections) {
            if (!section.items) continue;

            // Filter to only No and Partially answers (findings)
            const findings = section.items.filter(item => 
                item.selectedChoice === 'No' || item.selectedChoice === 'Partially'
            );

            for (const item of findings) {
                const itemPictures = data.pictures[item.responseId] || [];
                // Get only "Finding" type pictures (not corrective action pictures)
                const findingPictures = itemPictures.filter(p => {
                    const type = (p.pictureType || '').toLowerCase();
                    return type === 'finding';
                });

                for (const pic of findingPictures) {
                    allFindingPictures.push({
                        referenceValue: item.referenceValue || '-',
                        sectionName: section.sectionName || 'Unknown',
                        title: item.title || '',
                        finding: item.finding || '',
                        priority: item.priority || '',
                        dataUrl: pic.dataUrl
                    });
                }
            }
        }

        // If no finding pictures, return empty
        if (allFindingPictures.length === 0) {
            return '';
        }

        // Sort by reference value (natural sort)
        allFindingPictures.sort((a, b) => {
            const refA = a.referenceValue || '';
            const refB = b.referenceValue || '';
            return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Build the gallery HTML
        const pictureCards = allFindingPictures.map((pic, index) => {
            const priorityClass = pic.priority ? `priority-${pic.priority.toLowerCase()}` : '';
            const priorityBadge = pic.priority 
                ? `<span class="priority-badge ${priorityClass}">${escapeHtml(pic.priority)}</span>` 
                : '';

            return `
                <div class="finding-picture-card">
                    <div class="finding-picture-header">
                        <a href="#ref-${(pic.referenceValue || '').replace(/\./g, '-')}" onclick="scrollToRef('${(pic.referenceValue || '').replace(/\./g, '-')}'); return false;" class="finding-ref-badge" style="text-decoration: none; cursor: pointer;" title="Click to scroll to finding">#${escapeHtml(pic.referenceValue)}</a>
                        ${priorityBadge}
                    </div>
                    <div class="finding-picture-image">
                        <img src="${pic.dataUrl}" alt="Finding ${pic.referenceValue}" onclick="openImageModal(this.src)" />
                    </div>
                </div>
            `;
        }).join('\n');

        return `
            <div class="all-findings-pictures-section">
                <h2>📸 Finding Picture Gallery (${allFindingPictures.length})</h2>
                <p class="gallery-subtitle">All finding pictures collected for easy reference. Click on any image to enlarge.</p>
                <div class="finding-pictures-gallery">
                    ${pictureCards}
                </div>
            </div>
            <style>
                .all-findings-pictures-section {
                    margin: 30px 0;
                    padding: 20px;
                    background: #fef3c7;
                    border: 2px solid #f59e0b;
                    border-radius: 12px;
                }
                .all-findings-pictures-section h2 {
                    color: #92400e;
                    margin-bottom: 10px;
                }
                .gallery-subtitle {
                    color: #78350f;
                    font-size: 0.9rem;
                    margin-bottom: 20px;
                }
                .finding-pictures-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }
                .finding-picture-card {
                    background: white;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border: 1px solid #e5e7eb;
                }
                .finding-picture-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 15px;
                    background: #fef3c7;
                    border-bottom: 1px solid #fcd34d;
                }
                .finding-ref-badge {
                    background: #dc2626;
                    color: white;
                    font-weight: bold;
                    font-size: 1.1rem;
                    padding: 5px 12px;
                    border-radius: 20px;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .finding-ref-badge:hover {
                    transform: scale(1.1);
                    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);
                }
                .finding-picture-image {
                    width: 100%;
                    text-align: center;
                    background: #f5f5f5;
                    padding: 10px;
                }
                .finding-picture-image img {
                    max-width: 100%;
                    max-height: 400px;
                    width: auto;
                    height: auto;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .finding-picture-image img:hover {
                    transform: scale(1.02);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .finding-picture-details {
                    padding: 12px 15px;
                    background: white;
                    border-top: 1px solid #e5e7eb;
                }
                .finding-section-name {
                    font-size: 0.85rem;
                    color: #6b7280;
                    margin-bottom: 4px;
                }
                .finding-title {
                    font-weight: 600;
                    color: #1f2937;
                    font-size: 0.95rem;
                    line-height: 1.4;
                    margin-bottom: 6px;
                }
                .finding-description {
                    font-size: 0.9rem;
                    color: #991b1b;
                    background: #fee2e2;
                    padding: 8px 10px;
                    border-radius: 6px;
                    margin-top: 8px;
                }
                @media print {
                    .all-findings-pictures-section {
                        page-break-before: always;
                    }
                    .finding-pictures-gallery {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .finding-picture-image img {
                        max-height: 300px;
                    }
                }
            </style>
        `;
    }

    /**
     * Build consolidated good observation pictures gallery
     * Collects all "Good" type pictures from all sections and displays them in large format
     * with their reference values for easy review
     */
    buildAllGoodObservationsPictures(data) {
        if (!data.sections || data.sections.length === 0 || !data.pictures) {
            return '';
        }

        const allGoodPictures = [];

        // Collect good observation pictures from all sections
        for (const section of data.sections) {
            if (!section.items) continue;

            for (const item of section.items) {
                const itemPictures = data.pictures[item.responseId] || [];
                // Get only "Good" type pictures
                const goodPictures = itemPictures.filter(p => {
                    const type = (p.pictureType || '').toLowerCase();
                    return type === 'good';
                });

                for (const pic of goodPictures) {
                    allGoodPictures.push({
                        referenceValue: item.referenceValue || '-',
                        sectionName: section.sectionName || 'Unknown',
                        title: item.title || '',
                        comment: item.comment || '',
                        dataUrl: pic.dataUrl
                    });
                }
            }
        }

        // If no good pictures, return empty
        if (allGoodPictures.length === 0) {
            return '';
        }

        // Sort by reference value (natural sort)
        allGoodPictures.sort((a, b) => {
            const refA = a.referenceValue || '';
            const refB = b.referenceValue || '';
            return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Build the gallery HTML
        const pictureCards = allGoodPictures.map((pic, index) => {
            return `
                <div class="good-picture-card">
                    <div class="good-picture-header">
                        <a href="#ref-${(pic.referenceValue || '').replace(/\./g, '-')}" onclick="scrollToRef('${(pic.referenceValue || '').replace(/\./g, '-')}'); return false;" class="good-ref-badge" style="text-decoration: none; cursor: pointer;" title="Click to scroll to item">#${escapeHtml(pic.referenceValue)}</a>
                        <span class="good-section-badge">${escapeHtml(pic.sectionName)}</span>
                    </div>
                    <div class="good-picture-image">
                        <img src="${pic.dataUrl}" alt="Good Observation ${pic.referenceValue}" onclick="openImageModal(this.src)" />
                    </div>
                </div>
            `;
        }).join('\n');

        return `
            <div class="all-good-pictures-section">
                <h2>✅ Good Observation Gallery (${allGoodPictures.length})</h2>
                <p class="good-gallery-subtitle">All good observation pictures collected for easy reference. Click on any image to enlarge.</p>
                <div class="good-pictures-gallery">
                    ${pictureCards}
                </div>
            </div>
            <style>
                .all-good-pictures-section {
                    margin: 30px 0;
                    padding: 20px;
                    background: #d1fae5;
                    border: 2px solid #10b981;
                    border-radius: 12px;
                }
                .all-good-pictures-section h2 {
                    color: #065f46;
                    margin-bottom: 10px;
                }
                .good-gallery-subtitle {
                    color: #047857;
                    font-size: 0.9rem;
                    margin-bottom: 20px;
                }
                .good-pictures-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }
                .good-picture-card {
                    background: white;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border: 1px solid #a7f3d0;
                }
                .good-picture-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 15px;
                    background: #d1fae5;
                    border-bottom: 1px solid #6ee7b7;
                }
                .good-ref-badge {
                    background: #059669;
                    color: white;
                    font-weight: bold;
                    font-size: 1.1rem;
                    padding: 5px 12px;
                    border-radius: 20px;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .good-ref-badge:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
                }
                .good-section-badge {
                    background: #10b981;
                    color: white;
                    font-size: 0.75rem;
                    padding: 3px 8px;
                    border-radius: 12px;
                }
                .good-picture-image {
                    width: 100%;
                    text-align: center;
                    background: #f0fdf4;
                    padding: 10px;
                }
                .good-picture-image img {
                    max-width: 100%;
                    max-height: 400px;
                    width: auto;
                    height: auto;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .good-picture-image img:hover {
                    transform: scale(1.02);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                @media print {
                    .all-good-pictures-section {
                        page-break-before: always;
                    }
                    .good-pictures-gallery {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .good-picture-image img {
                        max-height: 300px;
                    }
                }
            </style>
        `;
    }

    /**
     * Build consolidated corrective action pictures gallery
     * Collects all "Corrective" type pictures from all sections and displays them in large format
     * with their reference values for easy review
     */
    buildAllCorrectiveActionsPictures(data) {
        if (!data.sections || data.sections.length === 0 || !data.pictures) {
            return '';
        }

        const allCorrectivePictures = [];

        // Collect corrective action pictures from all sections
        // Corrective pictures can be uploaded for any item (not just findings)
        for (const section of data.sections) {
            if (!section.items) continue;

            for (const item of section.items) {
                const itemPictures = data.pictures[item.responseId] || [];
                // Get only "Corrective" type pictures
                const correctivePictures = itemPictures.filter(p => {
                    const type = (p.pictureType || '').toLowerCase();
                    return type === 'corrective';
                });

                for (const pic of correctivePictures) {
                    allCorrectivePictures.push({
                        referenceValue: item.referenceValue || '-',
                        sectionName: section.sectionName || 'Unknown',
                        title: item.title || '',
                        finding: item.finding || '',
                        correctiveAction: item.correctiveAction || item.cr || '',
                        priority: item.priority || '',
                        selectedChoice: item.selectedChoice || '',
                        dataUrl: pic.dataUrl
                    });
                }
            }
        }

        // If no corrective pictures, return empty
        if (allCorrectivePictures.length === 0) {
            return '';
        }

        // Sort by reference value (natural sort)
        allCorrectivePictures.sort((a, b) => {
            const refA = a.referenceValue || '';
            const refB = b.referenceValue || '';
            return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Build the gallery HTML
        const pictureCards = allCorrectivePictures.map((pic, index) => {
            const priorityClass = pic.priority ? `priority-${pic.priority.toLowerCase()}` : '';
            const priorityBadge = pic.priority 
                ? `<span class="corrective-priority-badge ${priorityClass}">${escapeHtml(pic.priority)}</span>` 
                : '';

            return `
                <div class="corrective-picture-card">
                    <div class="corrective-picture-header">
                        <a href="#ref-${(pic.referenceValue || '').replace(/\./g, '-')}" onclick="scrollToRef('${(pic.referenceValue || '').replace(/\./g, '-')}'); return false;" class="corrective-ref-badge" style="text-decoration: none; cursor: pointer;" title="Click to scroll to finding">#${escapeHtml(pic.referenceValue)}</a>
                        ${priorityBadge}
                    </div>
                    <div class="corrective-picture-image">
                        <img src="${pic.dataUrl}" alt="Corrective Action ${pic.referenceValue}" onclick="openImageModal(this.src)" />
                    </div>
                </div>
            `;
        }).join('\n');

        return `
            <div class="all-corrective-pictures-section">
                <h2>🔧 Corrective Action Gallery (${allCorrectivePictures.length})</h2>
                <p class="corrective-gallery-subtitle">All corrective action pictures collected for easy reference. Click on any image to enlarge.</p>
                <div class="corrective-pictures-gallery">
                    ${pictureCards}
                </div>
            </div>
            <style>
                .all-corrective-pictures-section {
                    margin: 30px 0;
                    padding: 20px;
                    background: #dbeafe;
                    border: 2px solid #3b82f6;
                    border-radius: 12px;
                }
                .all-corrective-pictures-section h2 {
                    color: #1e40af;
                    margin-bottom: 10px;
                }
                .corrective-gallery-subtitle {
                    color: #1d4ed8;
                    font-size: 0.9rem;
                    margin-bottom: 20px;
                }
                .corrective-pictures-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }
                .corrective-picture-card {
                    background: white;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border: 1px solid #93c5fd;
                }
                .corrective-picture-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 15px;
                    background: #dbeafe;
                    border-bottom: 1px solid #60a5fa;
                }
                .corrective-ref-badge {
                    background: #2563eb;
                    color: white;
                    font-weight: bold;
                    font-size: 1.1rem;
                    padding: 5px 12px;
                    border-radius: 20px;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .corrective-ref-badge:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
                }
                .corrective-priority-badge {
                    font-size: 0.75rem;
                    padding: 3px 8px;
                    border-radius: 12px;
                    font-weight: 600;
                }
                .corrective-priority-badge.priority-high {
                    background: #dc2626;
                    color: white;
                }
                .corrective-priority-badge.priority-medium {
                    background: #f59e0b;
                    color: white;
                }
                .corrective-priority-badge.priority-low {
                    background: #10b981;
                    color: white;
                }
                .corrective-picture-image {
                    width: 100%;
                    text-align: center;
                    background: #eff6ff;
                    padding: 10px;
                }
                .corrective-picture-image img {
                    max-width: 100%;
                    max-height: 400px;
                    width: auto;
                    height: auto;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .corrective-picture-image img:hover {
                    transform: scale(1.02);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                @media print {
                    .all-corrective-pictures-section {
                        page-break-before: always;
                    }
                    .corrective-pictures-gallery {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .corrective-picture-image img {
                        max-height: 300px;
                    }
                }
            </style>
        `;
    }

    /**
     * Build chart section with categories and sections
     */
    buildChart(data) {
        if (!data.sectionScores || data.sectionScores.length === 0) {
            return '';
        }

        const threshold = data.threshold || 83;
        const categories = data.categories || [];

        // Helper to calculate category score (weighted: sum of earned / sum of max)
        const getCategoryScore = (categorySections, sectionScores) => {
            const matchedSections = categorySections
                .map(cs => sectionScores.find(ss => ss.sectionId === cs.sectionId))
                .filter(s => s);
            
            if (matchedSections.length === 0) return 0;
            
            const totalEarned = matchedSections.reduce((sum, s) => sum + (s.earnedScore || 0), 0);
            const totalMax = matchedSections.reduce((sum, s) => sum + (s.maxScore || 0), 0);
            return totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
        };

        // Build chart data with categories first, then sections
        const chartLabels = [];
        const chartValues = [];
        const chartColors = [];
        const chartTypes = []; // 'category' or 'section'
        const chartSectionNumbers = []; // For navigation - section number or null for categories

        if (categories.length > 0) {
            // Add categories and their sections
            for (const category of categories) {
                const categoryScore = getCategoryScore(category.sections, data.sectionScores);
                
                // Add category bar (with special styling)
                chartLabels.push(`📁 ${category.categoryName}`);
                chartValues.push(categoryScore);
                chartColors.push(categoryScore >= threshold ? '#059669' : '#dc2626'); // Darker green/red for categories
                chartTypes.push('category');
                chartSectionNumbers.push(null); // Categories don't link to a specific section

                // Add section bars under this category
                for (const catSection of category.sections) {
                    const sectionScore = data.sectionScores.find(s => s.sectionId === catSection.sectionId);
                    if (sectionScore) {
                        chartLabels.push(`   ${sectionScore.sectionName}`);
                        chartValues.push(sectionScore.percentage);
                        chartColors.push(sectionScore.percentage >= threshold ? '#10b981' : '#ef4444');
                        chartTypes.push('section');
                        chartSectionNumbers.push(sectionScore.sectionNumber);
                    }
                }
            }

            // Add uncategorized sections
            const categorizedSectionIds = new Set();
            categories.forEach(cat => cat.sections.forEach(s => categorizedSectionIds.add(s.sectionId)));
            const uncategorized = data.sectionScores.filter(s => !categorizedSectionIds.has(s.sectionId));
            
            if (uncategorized.length > 0) {
                chartLabels.push('📁 Other');
                const uncatEarned = uncategorized.reduce((sum, s) => sum + (s.earnedScore || 0), 0);
                const uncatMax = uncategorized.reduce((sum, s) => sum + (s.maxScore || 0), 0);
                const uncatScore = uncatMax > 0 ? Math.round((uncatEarned / uncatMax) * 100) : 0;
                chartValues.push(uncatScore);
                chartColors.push(uncatScore >= threshold ? '#059669' : '#dc2626');
                chartTypes.push('category');
                chartSectionNumbers.push(null);

                for (const section of uncategorized) {
                    chartLabels.push(`   ${section.sectionName}`);
                    chartValues.push(section.percentage);
                    chartColors.push(section.percentage >= threshold ? '#10b981' : '#ef4444');
                    chartTypes.push('section');
                    chartSectionNumbers.push(section.sectionNumber);
                }
            }
        } else {
            // No categories - just show sections
            for (const section of data.sectionScores) {
                chartLabels.push(section.sectionName);
                chartValues.push(section.percentage);
                chartColors.push(section.percentage >= threshold ? '#10b981' : '#ef4444');
                chartTypes.push('section');
                chartSectionNumbers.push(section.sectionNumber);
            }
        }

        // Calculate chart height based on number of bars for vertical layout
        const chartHeight = 500;

        return `
            <div class="chart-section">
                <h2>📊 Section Scores</h2>
                <div style="width: 100%; height: ${chartHeight}px;">
                    <canvas id="sectionChart" style="cursor: pointer;"></canvas>
                </div>
            </div>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    const ctx = document.getElementById('sectionChart').getContext('2d');
                    const chartTypes = ${JSON.stringify(chartTypes)};
                    const sectionNumbers = ${JSON.stringify(chartSectionNumbers)};
                    
                    const chart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ${JSON.stringify(chartLabels)},
                            datasets: [{
                                label: 'Score %',
                                data: ${JSON.stringify(chartValues)},
                                backgroundColor: ${JSON.stringify(chartColors)},
                                borderColor: ${JSON.stringify(chartColors)},
                                borderWidth: chartTypes.map(t => t === 'category' ? 2 : 1),
                                barPercentage: 0.85,
                                categoryPercentage: 0.9
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onClick: function(event, elements) {
                                if (elements.length > 0) {
                                    const index = elements[0].index;
                                    const sectionNum = sectionNumbers[index];
                                    if (sectionNum !== null) {
                                        const sectionElement = document.getElementById('section-' + sectionNum);
                                        if (sectionElement) {
                                            sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            // Highlight effect
                                            sectionElement.style.transition = 'background-color 0.3s';
                                            sectionElement.style.backgroundColor = '#fef3c7';
                                            setTimeout(() => {
                                                sectionElement.style.backgroundColor = '';
                                            }, 2000);
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    max: 100,
                                    ticks: { callback: v => v + '%' }
                                },
                                x: {
                                    ticks: {
                                        maxRotation: 90,
                                        minRotation: 45,
                                        autoSkip: false,
                                        font: function(context) {
                                            return chartTypes[context.index] === 'category' 
                                                ? { weight: 'bold', size: 11 } 
                                                : { size: 10 };
                                        }
                                    }
                                }
                            },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    callbacks: {
                                        label: ctx => ctx.raw + '%',
                                        title: ctx => ctx[0].label.trim()
                                    }
                                }
                            }
                        }
                    });
                });
            </script>
        `;
    }

    /**
     * Build Audit Summary Table (Data Table)
     * Shows section scores grouped by categories with C1-C6 historical data
     */
    buildDataTable(data) {
        if (!data.sectionScores || data.sectionScores.length === 0) {
            return '';
        }

        const threshold = data.threshold || 83;
        const categories = data.categories || [];
        const historicalAudits = data.historicalAudits || [];

        // Helper to get historical score for a section (2 decimal places)
        const getHistoricalScore = (sectionName, cycleIndex) => {
            if (cycleIndex >= historicalAudits.length) return '-';
            const audit = historicalAudits[cycleIndex];
            if (!audit || !audit.sectionScores) return '-';
            const score = audit.sectionScores[sectionName];
            return score !== undefined ? `${parseFloat(score).toFixed(2)}%` : '-';
        };

        // Helper to get historical total score (2 decimal places)
        const getHistoricalTotal = (cycleIndex) => {
            if (cycleIndex >= historicalAudits.length) return '-';
            const audit = historicalAudits[cycleIndex];
            return audit && audit.totalScore !== undefined ? `${parseFloat(audit.totalScore).toFixed(2)}%` : '-';
        };

        // Helper to calculate category score from its sections (weighted: sum of earned / sum of max)
        const getCategoryScore = (categorySections, sectionScores) => {
            const matchedSections = categorySections
                .map(cs => sectionScores.find(ss => ss.sectionId === cs.sectionId))
                .filter(s => s);
            
            if (matchedSections.length === 0) return 0;
            
            // Use weighted calculation: total earned / total max × 100 (2 decimal places)
            const totalEarned = matchedSections.reduce((sum, s) => sum + (s.earnedScore || 0), 0);
            const totalMax = matchedSections.reduce((sum, s) => sum + (s.maxScore || 0), 0);
            return totalMax > 0 ? parseFloat(((totalEarned / totalMax) * 100).toFixed(2)) : 0;
        };

        // Helper to get historical category score (weighted: sum of earned / sum of max)
        const getHistoricalCategoryScore = (categorySections, cycleIndex) => {
            if (cycleIndex >= historicalAudits.length) return '-';
            const audit = historicalAudits[cycleIndex];
            if (!audit || !audit.sectionScores) return '-';

            // Historical data may only have percentage, so fall back to weighted average of percentages
            // if earnedScore/maxScore not available
            const sectionData = categorySections
                .map(cs => {
                    const score = audit.sectionScores[cs.sectionName];
                    const earned = audit.sectionEarned?.[cs.sectionName];
                    const max = audit.sectionMax?.[cs.sectionName];
                    return { score, earned, max };
                })
                .filter(s => s.score !== undefined);
            
            if (sectionData.length === 0) return '-';
            
            // If we have earned/max data, use weighted calculation (2 decimal places)
            const hasWeightedData = sectionData.some(s => s.earned !== undefined && s.max !== undefined);
            if (hasWeightedData) {
                const totalEarned = sectionData.reduce((sum, s) => sum + (s.earned || 0), 0);
                const totalMax = sectionData.reduce((sum, s) => sum + (s.max || 0), 0);
                return totalMax > 0 ? `${((totalEarned / totalMax) * 100).toFixed(2)}%` : '-';
            }
            
            // Fallback: use simple average of percentages (for legacy historical data, 2 decimal places)
            const avg = sectionData.reduce((sum, s) => sum + s.score, 0) / sectionData.length;
            return `${avg.toFixed(2)}%`;
        };

        let tableRows = '';

        // If we have categories, use them for grouping
        if (categories.length > 0) {
            for (const category of categories) {
                // Calculate category score (weighted: sum of earned / sum of max × 100)
                const categoryScore = getCategoryScore(category.sections, data.sectionScores);
                const catScoreClass = categoryScore >= threshold ? 'score-pass' : 'score-fail';

                // Category header row
                tableRows += `
                    <tr class="category-row">
                        <td class="category-name"><strong>${escapeHtml(category.categoryName)}</strong></td>
                        <td class="category-score ${catScoreClass}"><strong>${categoryScore}%</strong></td>
                        <td class="category-score"><strong>${getHistoricalCategoryScore(category.sections, 0)}</strong></td>
                        <td class="category-score"><strong>${getHistoricalCategoryScore(category.sections, 1)}</strong></td>
                        <td class="category-score"><strong>${getHistoricalCategoryScore(category.sections, 2)}</strong></td>
                        <td class="category-score"><strong>${getHistoricalCategoryScore(category.sections, 3)}</strong></td>
                        <td class="category-score"><strong>${getHistoricalCategoryScore(category.sections, 4)}</strong></td>
                    </tr>
                `;

                // Section rows under this category
                for (const catSection of category.sections) {
                    const sectionScore = data.sectionScores.find(s => s.sectionId === catSection.sectionId);
                    if (sectionScore) {
                        const scoreClass = sectionScore.percentage >= threshold ? 'score-pass' : 'score-fail';
                        tableRows += `
                            <tr class="section-row">
                                <td class="section-name" style="padding-left: 24px;">${escapeHtml(sectionScore.sectionName)}</td>
                                <td class="${scoreClass}">${parseFloat(sectionScore.percentage).toFixed(2)}%</td>
                                <td>${getHistoricalScore(sectionScore.sectionName, 0)}</td>
                                <td>${getHistoricalScore(sectionScore.sectionName, 1)}</td>
                                <td>${getHistoricalScore(sectionScore.sectionName, 2)}</td>
                                <td>${getHistoricalScore(sectionScore.sectionName, 3)}</td>
                                <td>${getHistoricalScore(sectionScore.sectionName, 4)}</td>
                            </tr>
                        `;
                    }
                }
            }

            // Add uncategorized sections
            const categorizedSectionIds = new Set();
            categories.forEach(cat => cat.sections.forEach(s => categorizedSectionIds.add(s.sectionId)));
            
            const uncategorizedSections = data.sectionScores.filter(s => !categorizedSectionIds.has(s.sectionId));
            
            if (uncategorizedSections.length > 0) {
                tableRows += `
                    <tr class="category-row">
                        <td class="category-name"><strong>Other Sections</strong></td>
                        <td colspan="6"></td>
                    </tr>
                `;
                
                for (const section of uncategorizedSections) {
                    const scoreClass = section.percentage >= threshold ? 'score-pass' : 'score-fail';
                    tableRows += `
                        <tr class="section-row">
                            <td class="section-name" style="padding-left: 24px;">${escapeHtml(section.sectionName)}</td>
                            <td class="${scoreClass}">${parseFloat(section.percentage).toFixed(2)}%</td>
                            <td>${getHistoricalScore(section.sectionName, 0)}</td>
                            <td>${getHistoricalScore(section.sectionName, 1)}</td>
                            <td>${getHistoricalScore(section.sectionName, 2)}</td>
                            <td>${getHistoricalScore(section.sectionName, 3)}</td>
                            <td>${getHistoricalScore(section.sectionName, 4)}</td>
                        </tr>
                    `;
                }
            }
        } else {
            // No categories - just list sections
            for (const section of data.sectionScores) {
                const scoreClass = section.percentage >= threshold ? 'score-pass' : 'score-fail';
                tableRows += `
                    <tr class="section-row">
                        <td class="section-name">${escapeHtml(section.sectionName)}</td>
                        <td class="${scoreClass}">${parseFloat(section.percentage).toFixed(2)}%</td>
                        <td>${getHistoricalScore(section.sectionName, 0)}</td>
                        <td>${getHistoricalScore(section.sectionName, 1)}</td>
                        <td>${getHistoricalScore(section.sectionName, 2)}</td>
                        <td>${getHistoricalScore(section.sectionName, 3)}</td>
                        <td>${getHistoricalScore(section.sectionName, 4)}</td>
                    </tr>
                `;
            }
        }

        // Total row (2 decimal places)
        const overallScore = data.totalScore || 0;
        const overallClass = overallScore >= threshold ? 'score-pass' : 'score-fail';

        return `
            <div class="data-table-section">
                <h2>📊 Audit Summary</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>C1</th>
                            <th>C2</th>
                            <th>C3</th>
                            <th>C4</th>
                            <th>C5</th>
                            <th>C6</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                    <tfoot>
                        <tr class="data-table-total">
                            <td><strong>Total Score</strong></td>
                            <td class="${overallClass}"><strong>${parseFloat(overallScore).toFixed(2)}%</strong></td>
                            <td><strong>${getHistoricalTotal(0)}</strong></td>
                            <td><strong>${getHistoricalTotal(1)}</strong></td>
                            <td><strong>${getHistoricalTotal(2)}</strong></td>
                            <td><strong>${getHistoricalTotal(3)}</strong></td>
                            <td><strong>${getHistoricalTotal(4)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }

    /**
     * Build footer
     */
    buildFooter(data) {
        return `
            <!-- Action Bar for Admin/Auditor to save report -->
            <div class="action-bar no-print" id="actionBar">
                <button class="action-bar-btn save-btn" onclick="saveReportForStoreManager()">
                    💾 Save for Store Manager
                </button>
                <button class="action-bar-btn print-btn" onclick="window.print()">
                    🖨️ Print
                </button>
                <button class="action-bar-btn close-btn" onclick="window.close()">
                    ✖️ Close
                </button>
            </div>
            <div id="saveStatus" class="save-status no-print"></div>
            
            <style>
                .action-bar {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    display: flex;
                    gap: 10px;
                    z-index: 999;
                }
                .action-bar-btn {
                    padding: 12px 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                }
                .save-btn {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                }
                .save-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
                }
                .save-btn:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                    transform: none;
                }
                .print-btn {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                }
                .print-btn:hover {
                    transform: translateY(-2px);
                }
                .close-btn {
                    background: #6b7280;
                    color: white;
                }
                .close-btn:hover {
                    background: #4b5563;
                }
                .save-status {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-weight: 600;
                    z-index: 999;
                    display: none;
                }
                .save-status.success {
                    display: block;
                    background: #dcfce7;
                    color: #166534;
                    border: 1px solid #10b981;
                }
                .save-status.error {
                    display: block;
                    background: #fee2e2;
                    color: #991b1b;
                    border: 1px solid #ef4444;
                }
                @media print {
                    .no-print { display: none !important; }
                }
            </style>
            
            <script>
                // Check user role and hide Save button for StoreManager
                async function checkUserRoleAndHideButton() {
                    try {
                        const response = await fetch('/auth/session');
                        const data = await response.json();
                        if (data.authenticated && data.user && data.user.role === 'StoreManager') {
                            // Hide the Save for Store Manager button for StoreManager
                            const saveBtn = document.querySelector('.save-btn');
                            if (saveBtn) {
                                saveBtn.style.display = 'none';
                            }
                        }
                    } catch (error) {
                        console.log('Could not check user role:', error);
                    }
                }
                
                // Run on page load
                document.addEventListener('DOMContentLoaded', checkUserRoleAndHideButton);
                
                async function saveReportForStoreManager() {
                    const btn = document.querySelector('.save-btn');
                    const status = document.getElementById('saveStatus');
                    const fileName = window.location.pathname.split('/').pop();
                    
                    btn.disabled = true;
                    btn.innerHTML = '⏳ Saving...';
                    
                    try {
                        const response = await fetch('/api/audits/save-report-for-store-manager', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                documentNumber: '${data.documentNumber}',
                                auditId: ${data.auditId},
                                fileName: fileName,
                                storeName: '${(data.storeName || '').replace(/'/g, "\\'")}',
                                totalScore: ${data.totalScore || 0}
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            status.className = 'save-status success';
                            status.innerHTML = '✅ Report saved! Store Manager can now view it.';
                            btn.innerHTML = '✅ Saved';
                        } else {
                            throw new Error(result.error || 'Failed to save');
                        }
                    } catch (error) {
                        status.className = 'save-status error';
                        status.innerHTML = '❌ ' + error.message;
                        btn.disabled = false;
                        btn.innerHTML = '💾 Save for Store Manager';
                    }
                    
                    setTimeout(() => {
                        status.style.display = 'none';
                    }, 5000);
                }
            </script>
        `;
    }

    /**
     * Get answer CSS class
     */
    getAnswerClass(answer) {
        const classes = {
            'Yes': 'answer-yes',
            'Partially': 'answer-partial',
            'No': 'answer-no',
            'NA': 'answer-na'
        };
        return classes[answer] || 'answer-none';
    }

    /**
     * Get image modal HTML
     */
    getImageModalHtml() {
        return `
            <div id="imageModal" class="image-modal" onclick="closeImageModal()">
                <span class="modal-close">&times;</span>
                <img id="modalImage" class="modal-content">
            </div>
        `;
    }

    /**
     * Get scripts for interactivity
     */
    getScripts(data) {
        return `
            <script>
                function openImageModal(src) {
                    const modal = document.getElementById('imageModal');
                    const modalImg = document.getElementById('modalImage');
                    modal.style.display = 'flex';
                    modalImg.src = src;
                }

                function closeImageModal() {
                    document.getElementById('imageModal').style.display = 'none';
                }

                function scrollToRef(refId) {
                    const element = document.getElementById('ref-' + refId);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.style.backgroundColor = '#fef3c7';
                        setTimeout(() => { element.style.backgroundColor = ''; }, 2000);
                    }
                }

                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') closeImageModal();
                });
            </script>
        `;
    }

    /**
     * Get main layout template
     */
    getMainLayoutTemplate() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    {{styles}}
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        {{header}}
        {{auditInfo}}
        {{performanceBanner}}
        {{chart}}
        {{sections}}
        {{findings}}
        {{footer}}
    </div>
    {{imageModal}}
    {{scripts}}
</body>
</html>`;
    }

    /**
     * Get default styles
     */
    getDefaultStyles() {
        return `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; background: white; }
            .report-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #1e40af; color: white; border-radius: 8px; margin-bottom: 20px; }
            .report-header h1 { font-size: 1.5rem; }
            .doc-number { background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; }
            .audit-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 20px; background: #f8fafc; border-radius: 8px; margin-bottom: 20px; }
            .info-item label { font-weight: 600; color: #64748b; display: block; font-size: 0.85rem; }
            .info-item span { color: #1e293b; }
            .performance-banner { display: flex; justify-content: space-around; align-items: center; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
            .performance-banner.status-pass { background: linear-gradient(135deg, #10b981, #059669); color: white; }
            .performance-banner.status-fail { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
            .score-value { font-size: 3rem; font-weight: bold; }
            .score-label { display: block; font-size: 0.9rem; opacity: 0.9; }
            .status-emoji { font-size: 2rem; }
            .status-text { font-size: 1.5rem; font-weight: bold; }
            .section { margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .section-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
            .section-title { display: flex; align-items: center; gap: 10px; font-weight: 600; }
            .section-icon { font-size: 1.5rem; }
            .section-score { font-size: 1.2rem; font-weight: bold; padding: 5px 15px; border-radius: 20px; }
            .section-score.score-pass { background: #dcfce7; color: #166534; }
            .section-score.score-fail { background: #fee2e2; color: #991b1b; }
            .section-content { padding: 15px; }
            .section-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
            .section-table th, .section-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            .section-table th { background: #f1f5f9; font-weight: 600; }
            .ref-col { width: 60px; }
            .coeff-col, .answer-col, .value-col { width: 80px; text-align: center; }
            .pictures-col { width: 120px; }
            .answer-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.85rem; }
            .answer-yes { background: #dcfce7; color: #166534; }
            .answer-partial { background: #fef3c7; color: #92400e; }
            .answer-no { background: #fee2e2; color: #991b1b; }
            .answer-na { background: #f1f5f9; color: #64748b; }
            .priority-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
            .priority-high { background: #fee2e2; color: #991b1b; }
            .priority-medium { background: #fef3c7; color: #92400e; }
            .priority-low { background: #dbeafe; color: #1e40af; }
            .item-picture, .finding-picture { max-width: 60px; max-height: 40px; border-radius: 4px; cursor: pointer; margin: 2px; }
            .findings-section { margin-top: 30px; }
            .findings-section h2 { margin-bottom: 15px; color: #1e293b; }
            .findings-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .findings-table th, .findings-table td { padding: 12px; text-align: left; border: 1px solid #e2e8f0; word-wrap: break-word; overflow-wrap: break-word; }
            .findings-table th { background: #fef3c7; }
            .findings-table .criteria-col { width: 18%; }
            .findings-table .finding-col { width: 22%; white-space: pre-line; line-height: 1.5; }
            .findings-table .corrective-col { width: 22%; white-space: pre-line; line-height: 1.5; }
            .findings-table .priority-col { width: 80px; text-align: center; }
            .chart-section { margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; }
            .chart-section h2 { margin-bottom: 15px; }
            .report-footer { text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem; border-top: 1px solid #e2e8f0; margin-top: 30px; }
            .image-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); justify-content: center; align-items: center; z-index: 1000; }
            .modal-content { max-width: 90%; max-height: 90%; border-radius: 8px; }
            .modal-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 2rem; cursor: pointer; }
            @media print { .container { max-width: 100%; } .image-modal { display: none !important; } }
        `;
    }
}

module.exports = TemplateEngine;
