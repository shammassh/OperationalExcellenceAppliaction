# Audit App Report Generator

A modular, standalone report generation system for the Food Safety Audit application. This module generates HTML reports from SQL Server data without requiring SharePoint.

## Architecture

```
report-generator/
├── index.js                    ← Main orchestrator class
├── services/
│   ├── config-service.js       ← Fetches dynamic thresholds from SQL
│   ├── data-service.js         ← Fetches audit data from SQL
│   ├── scoring-service.js      ← Scoring calculations
│   ├── image-service.js        ← Image processing (base64)
│   ├── template-engine.js      ← HTML template building
│   └── utilities.js            ← Helper functions
├── templates/
│   ├── main-layout.html        ← Main HTML wrapper
│   ├── header.html             ← Report header
│   ├── audit-info.html         ← Store info section
│   ├── performance-banner.html ← Score banner
│   ├── section.html            ← Section template
│   ├── image-modal.html        ← Image modal
│   └── footer.html             ← Report footer
└── styles/
    └── report-styles.css       ← Report styling
```

## Usage

### Basic Usage

```javascript
const ReportGenerator = require('./audit-app/report-generator');

// Create instance
const reportGenerator = new ReportGenerator();

// Generate full report
const result = await reportGenerator.generateReport(auditId);
console.log(result.filePath); // Path to generated HTML file

// Generate action plan
const actionPlan = await reportGenerator.generateActionPlan(auditId);

// Generate department report
const deptReport = await reportGenerator.generateDepartmentReport(auditId, 'Maintenance');

// Get report data (JSON only, no file)
const data = await reportGenerator.getReportData(auditId);
```

### With Existing Database Pool

```javascript
const reportGenerator = new ReportGenerator();
reportGenerator.setPool(existingPool); // Use existing SQL connection
```

### Custom Output Directory

```javascript
const reportGenerator = new ReportGenerator({
    outputDir: './custom-reports'
});
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audits/:auditId/generate-report` | Generate full HTML report |
| POST | `/api/audits/:auditId/generate-action-plan` | Generate action plan report |
| POST | `/api/audits/:auditId/generate-department-report/:department` | Generate department report |
| GET | `/api/audits/:auditId/report-data` | Get report data as JSON |
| GET | `/api/audits/reports/:fileName` | Serve generated report file |

## Services

### ConfigService
Fetches dynamic passing thresholds from the `SystemSettings` SQL table.
- 5-minute cache for performance
- Fallback to defaults (83%) if unavailable
- Schema-specific settings support

### DataService
Fetches all audit data from SQL Server:
- `getAuditData(auditId)` - Audit header info
- `getSectionScores(auditId)` - Section scores
- `getAuditResponses(auditId)` - All responses grouped by section
- `getAuditPictures(auditId)` - Pictures as base64
- `getFindings(auditId)` - Issues/findings for action plan
- `getTemperatureReadings(auditId)` - Fridge temperature data

### ScoringService
Handles all scoring calculations:
- `calculateValue(choice, coeff)` - Yes=coeff, Partially=coeff/2, No=0, NA=null
- `calculateSectionScore(items)` - Section percentage
- `calculateOverallScore(sections)` - Total percentage
- `getStatus(score, threshold)` - PASS/FAIL
- `getChartColor(score, threshold)` - Green (#10b981) or Red (#ef4444)

### ImageService
Processes images for HTML reports:
- `filterPictures(pictures, type)` - Filter by type
- `generatePictureHtml(pictures)` - Generate HTML
- `generateBeforeAfterHtml(pictures)` - Before/after comparison

### TemplateEngine
Builds complete HTML documents:
- Loads templates from `templates/` folder
- Loads CSS from `styles/` folder
- Replaces `{{placeholders}}` with data
- Generates Chart.js configuration
- Built-in defaults if templates not found

## Generated Reports

### Full Audit Report
- Header with document number
- Audit info (store, date, auditor)
- Performance banner (PASS/FAIL)
- Section scores chart
- All sections with details table
- Findings summary
- Image modal for viewing pictures

### Action Plan Report
- Summary stats (total, high/medium/low priority)
- Color-coded priority badges
- Corrective actions
- Pictures

### Department Reports
- Filtered by department (Maintenance, Procurement, Cleaning)
- Color-coded by department
- Priority indicators
- Pictures

## Data Sources

All data comes from SQL Server tables:
- `AuditInstances` - Audit header
- `AuditResponses` - Question responses
- `AuditSectionScores` - Calculated section scores
- `AuditPictures` - Attached images
- `AuditSections` - Section metadata
- `SystemSettings` - Passing thresholds
- `FridgeReadings` - Temperature monitoring

## Styling

Reports use embedded CSS for standalone viewing:
- Professional design with gradients
- Color-coded scores (green=pass, red=fail)
- Priority badges (high=red, medium=yellow, low=blue)
- Responsive layout
- Print-friendly styles
- Image modal for enlarging pictures

## Example Output

Generated reports are saved to `./reports/` with naming:
- `Audit_Report_GMRL-FSACR-0001_2026-01-11.html`
- `Action_Plan_GMRL-FSACR-0001_2026-01-11.html`
- `Maintenance_Report_GMRL-FSACR-0001_2026-01-11.html`
