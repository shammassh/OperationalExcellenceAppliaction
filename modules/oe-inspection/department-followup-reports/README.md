# Department Follow-up Reports

Specialized report generator for department-specific follow-up actions from food safety audits.

## Overview

This module generates follow-up action reports for specific departments (Maintenance, Procurement, Cleaning) based on data from the `Checklist FollowUps` SharePoint list. Each department receives a tailored report showing only their assigned corrective actions with images.

## Features

✅ **Department-Specific Filtering** - Intelligently parses multi-department assignments  
✅ **Corrective Images** - Fetches and embeds Iscorrective=true images from CImages library  
✅ **Section Grouping** - Organizes findings by audit section (Food Storage, Fridges, etc.)  
✅ **Reference Value Sorting** - Orders items by reference number (1.1, 1.2, 2.1, etc.)  
✅ **Priority Indicators** - Visual badges for High/Medium/Low priority items  
✅ **Statistics Dashboard** - Shows total items and priority breakdown  
✅ **Standalone HTML** - Self-contained reports with base64-encoded images  

## Architecture

```
department-followup-reports/
├── index.js                          # Main entry point
├── config/
│   └── department-mappings.js        # Department logic & section mappings
├── services/
│   ├── followup-data-service.js      # Fetches from Checklist FollowUps
│   ├── image-service.js              # Handles corrective images
│   └── template-generator.js         # Generates HTML reports
└── templates/
    └── department-report-template.html   # HTML template
```

## Usage

### Command Line

```bash
# Generate report for Maintenance department
node department-followup-reports/index.js Maintenance

# Generate report for Procurement department
node department-followup-reports/index.js Procurement

# Generate report for Cleaning department
node department-followup-reports/index.js Cleaning
```

### As Module

```javascript
const DepartmentFollowupReportGenerator = require('./department-followup-reports');

const generator = new DepartmentFollowupReportGenerator({
    outputDir: './custom-reports'
});

const result = await generator.generateReport('Maintenance');

if (result.success) {
    console.log(`Report saved: ${result.filePath}`);
    console.log(`Total items: ${result.itemsCount}`);
}
```

## Department Logic

The system handles various department field formats:

| Department Field | Appears in Reports |
|---|---|
| `"Maintenance"` | Maintenance only |
| `"Procurement, Maintenance"` | Both Procurement AND Maintenance |
| `"Maintenance,Cleaning"` | Both Maintenance AND Cleaning |
| `"Procurement, Maintenance,Cleaning"` | All three departments |

## Data Flow

1. **Fetch Follow-ups** → Retrieve all items from `Checklist FollowUps` list
2. **Filter by Department** → Apply department matching logic
3. **Map Sections** → Extract section from Reference Value (1.x → Food Storage, 2.x → Fridges, etc.)
4. **Sort by Reference** → Order items numerically
5. **Fetch Corrective Images** → Query CImages with ItemKey + Iscorrective=true filter
6. **Convert to Base64** → Download and encode images
7. **Generate HTML** → Apply template with data
8. **Save Report** → Write to ./reports/

## Report Structure

### Table Columns

| Column | Description |
|---|---|
| **#** | Reference Value (1.1, 2.26, etc.) |
| **Section** | Audit section name with icon |
| **Item Title** | Question/checklist item text |
| **Finding** | Issue description |
| **Corrective Action** | Suggested remediation |
| **Priority** | High/Medium/Low badge |
| **Corrective Pictures** | Thumbnail gallery of after-action photos |

### Statistics Cards

- Total Follow-ups
- High Priority Count
- Medium Priority Count
- Low Priority Count

## Section Mapping

Reference values map to audit sections:

```javascript
1.x  → 🥫 Food Storage and Dry Storage
2.x  → ❄️ Fridges and Freezers
3.x  → 🍽️ Utensils and Equipment
4.x  → 👨‍🍳 Food Handling
5.x  → 🧹 Cleaning and Disinfection
6.x  → 🧼 Personal Hygiene
7.x  → 🚻 Restrooms
8.x  → 🗑️ Garbage Storage and Disposal
9.x  → 🛠️ Maintenance
10.x → 🧪 Chemicals Available
11.x → 📋 Monitoring Sheets
12.x → 🏛️ Food Safety Culture
13.x → 📜 Policies & Procedures
```

## Image Handling

### Corrective Images (After Photos)

- Fetched from `CImages` document library
- Filtered by: `ItemKey` + `Iscorrective = true`
- Converted to base64 for standalone HTML viewing
- Clickable thumbnails with modal lightbox

### Image ID Format

```
ItemKey: GMRL-FSACR-0001-87
ImageID in CImages: GMRL-FSACR-0001-87
Filter: substringof('GMRL-FSACR-0001-87', ImageID) and Iscorrective eq 1
```

## Output

Reports are saved to: `./reports/`

Filename format: `{Department}_Followup_Report_{YYYY-MM-DD}.html`

Examples:
- `Maintenance_Followup_Report_2025-11-20.html`
- `Procurement_Followup_Report_2025-11-20.html`
- `Cleaning_Followup_Report_2025-11-20.html`

## Requirements

- Node.js 16+
- SharePoint Online access with App Registration
- Environment variables configured (see main README)
- Access to:
  - `Checklist FollowUps` list
  - `CImages` document library

## Error Handling

The system gracefully handles:
- Empty follow-up lists
- Missing corrective images
- Invalid department names
- SharePoint connection issues
- Malformed reference values

## Future Enhancements

- [ ] Email delivery to department heads
- [ ] Status update tracking (New → In Progress → Completed)
- [ ] Deadline/due date management
- [ ] PDF export option
- [ ] PowerApps integration buttons
- [ ] Bulk report generation (all departments at once)

## Testing

```bash
# Test with sample data
node department-followup-reports/index.js Maintenance

# Verify output
start reports\Maintenance_Followup_Report_2025-11-20.html
```

## Related Files

- Dashboard integration: `dashboard.html`
- SharePoint connector: `src/simple-graph-connector.js`
- Main audit reports: `enhanced-report-generator/`

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Last Updated**: November 20, 2025
