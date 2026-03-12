/**
 * OHS Inspection Report Generator
 * Generates HTML reports for OHS inspections
 */

const fs = require('fs');
const path = require('path');

class OHSReportGenerator {
    constructor(reportsDir) {
        this.reportsDir = reportsDir || path.join(__dirname, '../../reports/ohs-inspection');
        
        // Ensure reports directory exists
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    /**
     * Generate HTML report for an OHS inspection
     * @param {Object} auditData - Complete audit data with sections and items
     * @returns {Object} - { success, fileName, filePath, overallScore }
     */
    async generateReport(auditData) {
        try {
            const overallScore = this.calculateOverallScore(auditData);
            const reportHtml = this.buildReportHtml(auditData, overallScore);
            
            const fileName = `OHS_Report_${auditData.documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.reportsDir, fileName);
            
            fs.writeFileSync(filePath, reportHtml, 'utf8');
            
            return {
                success: true,
                fileName,
                filePath,
                overallScore
            };
        } catch (error) {
            console.error('Error generating OHS report:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    calculateOverallScore(auditData) {
        let totalEarned = 0;
        let totalMax = 0;
        
        // Get list of NA department names
        const naDepartments = (auditData.departments || [])
            .filter(d => d.isNA)
            .map(d => d.departmentName);

        for (const section of auditData.sections || []) {
            // Skip sections in NA departments
            if (section.departmentName && naDepartments.includes(section.departmentName)) {
                continue;
            }
            
            for (const item of section.items || []) {
                if (item.selectedChoice && item.selectedChoice !== 'NA') {
                    const coeff = parseFloat(item.coeff) || 1;
                    totalMax += coeff;
                    
                    if (item.selectedChoice === 'Yes') {
                        totalEarned += coeff;
                    } else if (item.selectedChoice === 'Partially') {
                        totalEarned += coeff * 0.5;
                    }
                }
            }
        }

        return totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
    }
    
    calculateDepartmentScore(auditData, departmentName) {
        let earned = 0;
        let max = 0;
        
        for (const section of auditData.sections || []) {
            if (section.departmentName !== departmentName) continue;
            
            for (const item of section.items || []) {
                if (item.selectedChoice && item.selectedChoice !== 'NA') {
                    const coeff = parseFloat(item.coeff) || 1;
                    max += coeff;
                    
                    if (item.selectedChoice === 'Yes') {
                        earned += coeff;
                    } else if (item.selectedChoice === 'Partially') {
                        earned += coeff * 0.5;
                    }
                }
            }
        }
        
        return max > 0 ? (earned / max) * 100 : 0;
    }

    calculateSectionScore(section) {
        let earned = 0;
        let max = 0;

        for (const item of section.items || []) {
            if (item.selectedChoice && item.selectedChoice !== 'NA') {
                const coeff = parseFloat(item.coeff) || 1;
                max += coeff;
                
                if (item.selectedChoice === 'Yes') {
                    earned += coeff;
                } else if (item.selectedChoice === 'Partially') {
                    earned += coeff * 0.5;
                }
            }
        }

        return max > 0 ? (earned / max) * 100 : 0;
    }

    buildReportHtml(auditData, overallScore) {
        const scoreClass = overallScore >= 80 ? 'score-pass' : overallScore >= 60 ? 'score-warning' : 'score-fail';
        const scoreStatus = overallScore >= 80 ? 'PASS' : 'FAIL';
        
        // Get list of NA department names
        const naDepartments = (auditData.departments || [])
            .filter(d => d.isNA)
            .map(d => d.departmentName);
        
        const findings = [];
        for (const section of auditData.sections || []) {
            // Skip findings from NA departments
            if (section.departmentName && naDepartments.includes(section.departmentName)) {
                continue;
            }
            
            for (const item of section.items || []) {
                if (item.finding && (item.selectedChoice === 'No' || item.selectedChoice === 'Partially')) {
                    findings.push({
                        section: section.sectionName,
                        department: section.departmentName,
                        reference: item.referenceValue,
                        question: item.title,
                        answer: item.selectedChoice,
                        finding: item.finding,
                        cr: item.cr,
                        priority: item.priority || 'Medium'
                    });
                }
            }
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OHS Inspection Report - ${auditData.documentNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }
        
        .report-container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .report-header {
            background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
            color: white;
            padding: 2rem;
            border-radius: 16px;
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .report-title {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .report-subtitle {
            font-size: 1rem;
            opacity: 0.9;
        }
        
        .report-score {
            text-align: center;
            padding: 1.5rem;
            background: rgba(255,255,255,0.2);
            border-radius: 12px;
            min-width: 150px;
        }
        
        .score-value {
            font-size: 2.5rem;
            font-weight: 700;
        }
        
        .score-label {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        
        /* Filter Toolbar */
        .filter-toolbar {
            background: white;
            border: 1px solid rgba(225, 112, 85, 0.2);
            border-radius: 12px;
            padding: 1rem 1.5rem;
            margin-bottom: 1.5rem;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 1rem;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .filter-toolbar-title {
            font-weight: 600;
            color: #64748b;
            font-size: 0.9rem;
            margin-right: 0.5rem;
        }
        
        .filter-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        
        .filter-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .filter-btn:hover {
            border-color: #e17055;
        }
        
        .filter-btn.active {
            background: #e17055;
            border-color: #e17055;
            color: white;
        }
        
        .filter-btn.filter-yes { border-left: 4px solid #10b981; }
        .filter-btn.filter-partial { border-left: 4px solid #f59e0b; }
        .filter-btn.filter-no { border-left: 4px solid #ef4444; }
        .filter-btn.filter-na { border-left: 4px solid #94a3b8; }
        .filter-btn.filter-na-dept { border-left: 4px solid #6366f1; }
        
        .filter-divider {
            width: 1px;
            height: 24px;
            background: #e2e8f0;
            margin: 0 0.5rem;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .info-card {
            background: white;
            border: 1px solid rgba(225, 112, 85, 0.2);
            border-radius: 12px;
            padding: 1rem 1.25rem;
        }
        
        .info-label {
            font-size: 0.8rem;
            color: #64748b;
            margin-bottom: 0.25rem;
        }
        
        .info-value {
            font-size: 1rem;
            font-weight: 600;
            color: #1e293b;
        }
        
        .section-block {
            background: white;
            border: 1px solid rgba(225, 112, 85, 0.2);
            border-radius: 12px;
            margin-bottom: 1.5rem;
            overflow: hidden;
        }
        
        .section-header {
            background: rgba(225, 112, 85, 0.1);
            padding: 1rem 1.25rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .section-score {
            font-size: 1.25rem;
            font-weight: 700;
        }
        
        .score-pass { color: #10b981; }
        .score-warning { color: #f59e0b; }
        .score-fail { color: #ef4444; }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .items-table th,
        .items-table td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .items-table th {
            background: #f8fafc;
            font-weight: 600;
            font-size: 0.85rem;
            color: #475569;
        }
        
        .answer-yes { color: #10b981; font-weight: 600; }
        .answer-partial { color: #f59e0b; font-weight: 600; }
        .answer-no { color: #ef4444; font-weight: 600; }
        .answer-na { color: #94a3b8; font-weight: 600; }
        
        .findings-section {
            background: white;
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 12px;
            margin-bottom: 2rem;
            overflow: hidden;
        }
        
        .findings-header {
            background: rgba(239, 68, 68, 0.1);
            padding: 1rem 1.25rem;
            font-size: 1.1rem;
            font-weight: 600;
            color: #ef4444;
        }
        
        .finding-item {
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .finding-item:last-child { border-bottom: none; }
        
        .finding-ref {
            display: inline-block;
            background: #e17055;
            color: white;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-right: 0.5rem;
        }
        
        .finding-priority {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .priority-high { background: #fef2f2; color: #ef4444; }
        .priority-medium { background: #fffbeb; color: #f59e0b; }
        .priority-low { background: #eff6ff; color: #3b82f6; }
        
        .finding-question {
            font-weight: 500;
            margin: 0.5rem 0;
        }
        
        .finding-text {
            background: #fef2f2;
            padding: 0.75rem;
            border-radius: 8px;
            margin-top: 0.5rem;
            font-size: 0.9rem;
        }
        
        .finding-cr {
            background: #ecfdf5;
            padding: 0.75rem;
            border-radius: 8px;
            margin-top: 0.5rem;
            font-size: 0.9rem;
        }
        
        .report-footer {
            text-align: center;
            padding: 2rem;
            color: #64748b;
            font-size: 0.85rem;
        }
        
        @media print {
            .report-container { padding: 0; }
            .section-block { break-inside: avoid; }
            .filter-toolbar { display: none !important; }
            .hidden-by-filter { display: table-row !important; }
            .dept-hidden { display: block !important; opacity: 1 !important; }
        }
        
        /* Hidden states */
        .hidden-by-filter { display: none; }
        .dept-hidden { display: none; }
        .section-hidden { display: none; }
    </style>
</head>
<body>
    <div class="report-container">
        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
            <span class="filter-toolbar-title">🔍 Filter:</span>
            <div class="filter-group">
                <button class="filter-btn filter-yes active" onclick="toggleFilter('yes', this)" title="Show/Hide Yes answers">
                    ✓ Yes
                </button>
                <button class="filter-btn filter-partial active" onclick="toggleFilter('partial', this)" title="Show/Hide Partially answers">
                    ◐ Partially
                </button>
                <button class="filter-btn filter-no active" onclick="toggleFilter('no', this)" title="Show/Hide No answers">
                    ✗ No
                </button>
                <button class="filter-btn filter-na active" onclick="toggleFilter('na', this)" title="Show/Hide N/A answers">
                    — N/A
                </button>
            </div>
            <div class="filter-divider"></div>
            <div class="filter-group">
                <button class="filter-btn filter-na-dept active" onclick="toggleNADepartments(this)" title="Show/Hide N/A Departments">
                    🏬 N/A Departments
                </button>
            </div>
            <div class="filter-divider"></div>
            <div class="filter-group">
                <button class="filter-btn" onclick="showOnlyFindings()" title="Show only items with findings">
                    ⚠️ Findings Only
                </button>
                <button class="filter-btn" onclick="resetFilters()" title="Reset all filters">
                    🔄 Reset
                </button>
            </div>
        </div>
        
        <div class="report-header">
            <div>
                <div class="report-title">🦺 OHS Inspection Report</div>
                <div class="report-subtitle">${auditData.documentNumber}</div>
            </div>
            <div class="report-score">
                <div class="score-value">${Math.round(overallScore)}%</div>
                <div class="score-label">${scoreStatus}</div>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-card">
                <div class="info-label">Store</div>
                <div class="info-value">${auditData.storeName || '-'}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Inspector</div>
                <div class="info-value">${auditData.inspectorName || '-'}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Inspection Date</div>
                <div class="info-value">${auditData.inspectionDate ? new Date(auditData.inspectionDate).toLocaleDateString() : '-'}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Status</div>
                <div class="info-value">${auditData.status || 'In Progress'}</div>
            </div>
        </div>
        
        ${this.renderSectionsGroupedByDepartment(auditData)}
        
        ${findings.length > 0 ? `
        <div class="findings-section">
            <div class="findings-header">⚠️ Findings & Action Items (${findings.length})</div>
            ${findings.map(f => `
            <div class="finding-item">
                <span class="finding-ref">${f.reference || '-'}</span>
                <span class="finding-priority priority-${(f.priority || 'medium').toLowerCase()}">${f.priority || 'Medium'}</span>
                <div class="finding-question">${f.question}</div>
                <div class="finding-text"><strong>Finding:</strong> ${f.finding}</div>
                ${f.cr ? `<div class="finding-cr"><strong>Corrective Action:</strong> ${f.cr}</div>` : ''}
            </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="report-footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>OHS Inspection System - Occupational Health & Safety</p>
        </div>
    </div>
    
    <script>
        // Filter state
        const filters = { yes: true, partial: true, no: true, na: true, naDepts: true };
        
        function toggleFilter(type, btn) {
            filters[type] = !filters[type];
            btn.classList.toggle('active', filters[type]);
            applyFilters();
        }
        
        function toggleNADepartments(btn) {
            filters.naDepts = !filters.naDepts;
            btn.classList.toggle('active', filters.naDepts);
            
            document.querySelectorAll('[data-na-dept="true"]').forEach(dept => {
                dept.classList.toggle('dept-hidden', !filters.naDepts);
            });
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
            document.querySelectorAll('.section-block').forEach(section => {
                const visibleRows = section.querySelectorAll('tr[data-answer]:not(.hidden-by-filter)');
                section.classList.toggle('section-hidden', visibleRows.length === 0);
            });
        }
        
        function showOnlyFindings() {
            // Uncheck Yes and NA
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
            filters.naDepts = true;
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.add('active');
            });
            
            document.querySelectorAll('tr[data-answer]').forEach(row => {
                row.classList.remove('hidden-by-filter');
            });
            
            document.querySelectorAll('[data-na-dept="true"]').forEach(dept => {
                dept.classList.remove('dept-hidden');
            });
            
            document.querySelectorAll('.section-block').forEach(section => {
                section.classList.remove('section-hidden');
            });
        }
    </script>
</body>
</html>`;
    }
    
    renderSectionsGroupedByDepartment(auditData) {
        const hasDepartments = auditData.departments && auditData.departments.length > 0;
        
        if (hasDepartments) {
            // Group by department
            let html = '';
            
            for (const dept of auditData.departments) {
                const deptSections = (auditData.sections || []).filter(s => s.departmentName === dept.departmentName);
                const deptScore = this.calculateDepartmentScore(auditData, dept.departmentName);
                const deptScoreClass = dept.isNA ? 'score-na' : (deptScore >= 80 ? 'score-pass' : deptScore >= 60 ? 'score-warning' : 'score-fail');
                const passingGrade = dept.passingGrade || 80;
                
                // Department header
                html += `
                <div style="margin-bottom: 2rem;" data-na-dept="${dept.isNA ? 'true' : 'false'}">
                    <div style="background: linear-gradient(135deg, rgba(225, 112, 85, 0.15) 0%, rgba(214, 48, 49, 0.1) 100%); 
                                border: 1px solid rgba(225, 112, 85, 0.3); border-radius: 12px; padding: 1rem 1.5rem; margin-bottom: 1rem;
                                display: flex; justify-content: space-between; align-items: center; ${dept.isNA ? 'opacity: 0.5;' : ''}">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">${dept.departmentIcon || '🏬'}</span>
                            <span style="font-weight: 700; font-size: 1.1rem;">${dept.departmentName}</span>
                            ${dept.isNA ? '<span style="background: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; margin-left: 10px;">N/A - Excluded</span>' : ''}
                        </div>
                        ${!dept.isNA ? `
                        <div style="text-align: center;">
                            <div class="${deptScoreClass}" style="font-size: 1.5rem; font-weight: 700;">${Math.round(deptScore)}%</div>
                            <div style="font-size: 0.75rem; color: #64748b;">Pass: ${passingGrade}%</div>
                        </div>
                        ` : ''}
                    </div>
                `;
                
                // Sections within this department
                for (const section of deptSections) {
                    const sectionScore = this.calculateSectionScore(section);
                    const sectionScoreClass = sectionScore >= 80 ? 'score-pass' : sectionScore >= 60 ? 'score-warning' : 'score-fail';
                    
                    html += `
                    <div class="section-block" style="${dept.isNA ? 'opacity: 0.5;' : ''}">
                        <div class="section-header">
                            <div class="section-title">
                                <span>${section.sectionIcon || '📋'}</span>
                                <span>${section.sectionName}</span>
                            </div>
                            <div class="section-score ${sectionScoreClass}">${Math.round(sectionScore)}%</div>
                        </div>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th style="width: 60px;">Ref</th>
                                    <th>Question</th>
                                    <th style="width: 80px;">Answer</th>
                                    <th style="width: 50px;">Coeff</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(section.items || []).map(item => {
                                    const answerClass = item.selectedChoice === 'Yes' ? 'answer-yes' :
                                                       item.selectedChoice === 'Partially' ? 'answer-partial' :
                                                       item.selectedChoice === 'No' ? 'answer-no' : 'answer-na';
                                    const answerType = item.selectedChoice === 'Yes' ? 'Yes' :
                                                      item.selectedChoice === 'Partially' ? 'Partially' :
                                                      item.selectedChoice === 'No' ? 'No' : 'NA';
                                    return `
                                    <tr data-answer="${answerType}">
                                        <td>${item.referenceValue || '-'}</td>
                                        <td>${item.title || '-'}</td>
                                        <td class="${answerClass}">${item.selectedChoice || '-'}</td>
                                        <td>${item.coeff || 1}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    `;
                }
                
                html += '</div>';
            }
            
            // Also render sections without department (legacy)
            const orphanSections = (auditData.sections || []).filter(s => !s.departmentName);
            if (orphanSections.length > 0) {
                html += '<div style="margin-top: 2rem; padding-top: 1rem; border-top: 2px dashed #ccc;"><h3 style="color: #64748b; margin-bottom: 1rem;">Other Sections</h3>';
                
                for (const section of orphanSections) {
                    const sectionScore = this.calculateSectionScore(section);
                    const sectionScoreClass = sectionScore >= 80 ? 'score-pass' : sectionScore >= 60 ? 'score-warning' : 'score-fail';
                    
                    html += `
                    <div class="section-block">
                        <div class="section-header">
                            <div class="section-title">
                                <span>${section.sectionIcon || '📋'}</span>
                                <span>${section.sectionName}</span>
                            </div>
                            <div class="section-score ${sectionScoreClass}">${Math.round(sectionScore)}%</div>
                        </div>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th style="width: 60px;">Ref</th>
                                    <th>Question</th>
                                    <th style="width: 80px;">Answer</th>
                                    <th style="width: 50px;">Coeff</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(section.items || []).map(item => {
                                    const answerClass = item.selectedChoice === 'Yes' ? 'answer-yes' :
                                                       item.selectedChoice === 'Partially' ? 'answer-partial' :
                                                       item.selectedChoice === 'No' ? 'answer-no' : 'answer-na';
                                    const answerType = item.selectedChoice === 'Yes' ? 'Yes' :
                                                      item.selectedChoice === 'Partially' ? 'Partially' :
                                                      item.selectedChoice === 'No' ? 'No' : 'NA';
                                    return `
                                    <tr data-answer="${answerType}">
                                        <td>${item.referenceValue || '-'}</td>
                                        <td>${item.title || '-'}</td>
                                        <td class="${answerClass}">${item.selectedChoice || '-'}</td>
                                        <td>${item.coeff || 1}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    `;
                }
                
                html += '</div>';
            }
            
            return html;
        } else {
            // No departments - legacy behavior
            return (auditData.sections || []).map(section => {
                const sectionScore = this.calculateSectionScore(section);
                const sectionScoreClass = sectionScore >= 80 ? 'score-pass' : sectionScore >= 60 ? 'score-warning' : 'score-fail';
                
                return `
                <div class="section-block">
                    <div class="section-header">
                        <div class="section-title">
                            <span>${section.sectionIcon || '📋'}</span>
                            <span>${section.sectionName}</span>
                        </div>
                        <div class="section-score ${sectionScoreClass}">${Math.round(sectionScore)}%</div>
                    </div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 60px;">Ref</th>
                                <th>Question</th>
                                <th style="width: 80px;">Answer</th>
                                <th style="width: 50px;">Coeff</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(section.items || []).map(item => {
                                const answerClass = item.selectedChoice === 'Yes' ? 'answer-yes' :
                                                   item.selectedChoice === 'Partially' ? 'answer-partial' :
                                                   item.selectedChoice === 'No' ? 'answer-no' : 'answer-na';
                                const answerType = item.selectedChoice === 'Yes' ? 'Yes' :
                                                  item.selectedChoice === 'Partially' ? 'Partially' :
                                                  item.selectedChoice === 'No' ? 'No' : 'NA';
                                return `
                                <tr data-answer="${answerType}">
                                    <td>${item.referenceValue || '-'}</td>
                                    <td>${item.title || '-'}</td>
                                    <td class="${answerClass}">${item.selectedChoice || '-'}</td>
                                    <td>${item.coeff || 1}</td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                `;
            }).join('');
        }
    }
}

module.exports = OHSReportGenerator;
