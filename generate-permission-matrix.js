/**
 * Generate Role Permission Matrix Excel Report
 * Run: node generate-permission-matrix.js
 */

const sql = require('mssql');
const config = require('./config/default');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function generateMatrix() {
    const dbConfig = {
        server: config.database.server,
        database: config.database.database,
        user: config.database.user,
        password: config.database.password,
        options: config.database.options
    };
    
    console.log('Connecting to database:', config.database.database);
    await sql.connect(dbConfig);
    
    // Get all roles
    const roles = await sql.query('SELECT Id, RoleName, Description FROM UserRoles ORDER BY RoleName');
    console.log(`Found ${roles.recordset.length} roles`);
    
    // Get all forms (ModuleName as Category)
    const forms = await sql.query('SELECT FormCode, FormName, ModuleName as Category FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
    console.log(`Found ${forms.recordset.length} forms`);
    
    // Get all role permissions
    const permissions = await sql.query(`
        SELECT r.RoleName, f.FormCode, f.FormName, f.ModuleName as Category, 
               rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete 
        FROM RoleFormAccess rfa 
        JOIN UserRoles r ON rfa.RoleId = r.Id 
        JOIN Forms f ON rfa.FormCode = f.FormCode 
        WHERE f.IsActive = 1
        ORDER BY f.ModuleName, f.FormName, r.RoleName
    `);
    console.log(`Found ${permissions.recordset.length} permission entries`);
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OE App Permission System';
    workbook.created = new Date();
    
    // ============ Sheet 1: Summary Matrix ============
    const summarySheet = workbook.addWorksheet('Permission Matrix');
    
    // Build header row
    const roleNames = roles.recordset.map(r => r.RoleName);
    summarySheet.addRow(['Category', 'Form Code', 'Form Name', ...roleNames]);
    
    // Style header
    const headerRow = summarySheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    // Freeze header row and first 3 columns
    summarySheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];
    
    // Build permission map
    const permMap = {};
    permissions.recordset.forEach(p => {
        const key = p.FormCode + '|' + p.RoleName;
        let perms = [];
        if (p.CanView) perms.push('V');
        if (p.CanCreate) perms.push('C');
        if (p.CanEdit) perms.push('E');
        if (p.CanDelete) perms.push('D');
        permMap[key] = perms.join('') || '-';
    });
    
    // Add form rows
    let currentCategory = '';
    forms.recordset.forEach(form => {
        const row = [form.Category, form.FormCode, form.FormName];
        roleNames.forEach(role => {
            const key = form.FormCode + '|' + role;
            row.push(permMap[key] || '-');
        });
        const dataRow = summarySheet.addRow(row);
        
        // Add category separator styling
        if (form.Category !== currentCategory) {
            currentCategory = form.Category;
            dataRow.getCell(1).font = { bold: true };
        }
        
        // Color code permissions
        for (let i = 4; i <= row.length; i++) {
            const cell = dataRow.getCell(i);
            const val = cell.value;
            if (val && val !== '-') {
                if (val === 'VCED') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }; // Green - full
                } else if (val.includes('E') || val.includes('C')) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } }; // Yellow - partial write
                } else if (val === 'V') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } }; // Blue - view only
                }
            }
            cell.alignment = { horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
            };
        }
    });
    
    // Auto-fit columns
    summarySheet.columns.forEach((col, i) => {
        if (i === 0) col.width = 18;
        else if (i === 1) col.width = 30;
        else if (i === 2) col.width = 35;
        else col.width = 14;
    });
    
    // ============ Sheet 2: Detailed Permissions ============
    const detailSheet = workbook.addWorksheet('Detailed Permissions');
    detailSheet.addRow(['Role', 'Category', 'Form Code', 'Form Name', 'Can View', 'Can Create', 'Can Edit', 'Can Delete']);
    
    const detailHeader = detailSheet.getRow(1);
    detailHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    detailHeader.height = 25;
    
    detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
    
    // Add auto-filter
    detailSheet.autoFilter = 'A1:H1';
    
    permissions.recordset.forEach(p => {
        const row = detailSheet.addRow([
            p.RoleName, 
            p.Category, 
            p.FormCode, 
            p.FormName, 
            p.CanView ? 'Yes' : 'No', 
            p.CanCreate ? 'Yes' : 'No', 
            p.CanEdit ? 'Yes' : 'No', 
            p.CanDelete ? 'Yes' : 'No'
        ]);
        
        for (let i = 5; i <= 8; i++) {
            const cell = row.getCell(i);
            cell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: cell.value === 'Yes' ? 'FF92D050' : 'FFFFC7CE' } 
            };
            cell.alignment = { horizontal: 'center' };
        }
    });
    
    detailSheet.columns = [
        { width: 25 }, { width: 18 }, { width: 30 }, { width: 35 }, 
        { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }
    ];
    
    // ============ Sheet 3: All Forms Reference ============
    const formsSheet = workbook.addWorksheet('All Forms');
    formsSheet.addRow(['Category', 'Form Code', 'Form Name', 'URL Pattern']);
    
    const formsHeader = formsSheet.getRow(1);
    formsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    formsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    
    formsSheet.views = [{ state: 'frozen', ySplit: 1 }];
    formsSheet.autoFilter = 'A1:D1';
    
    const allForms = await sql.query('SELECT ModuleName as Category, FormCode, FormName, FormUrl as URLPattern FROM Forms WHERE IsActive = 1 ORDER BY ModuleName, FormName');
    allForms.recordset.forEach(f => formsSheet.addRow([f.Category, f.FormCode, f.FormName, f.URLPattern]));
    formsSheet.columns = [{ width: 18 }, { width: 30 }, { width: 35 }, { width: 50 }];
    
    // ============ Sheet 4: All Roles ============
    const rolesSheet = workbook.addWorksheet('All Roles');
    rolesSheet.addRow(['Role ID', 'Role Name', 'Description']);
    
    const rolesHeader = rolesSheet.getRow(1);
    rolesHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rolesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    
    roles.recordset.forEach(r => rolesSheet.addRow([r.Id, r.RoleName, r.Description || '']));
    rolesSheet.columns = [{ width: 10 }, { width: 25 }, { width: 50 }];
    
    // ============ Sheet 5: Legend ============
    const legendSheet = workbook.addWorksheet('Legend');
    
    legendSheet.addRow(['PERMISSION MATRIX LEGEND']);
    legendSheet.getRow(1).font = { bold: true, size: 16 };
    legendSheet.addRow([]);
    
    legendSheet.addRow(['Permission Codes']);
    legendSheet.getRow(3).font = { bold: true, size: 12 };
    
    legendSheet.addRow(['V', 'View - Can view/read the form or data']);
    legendSheet.addRow(['C', 'Create - Can create new records']);
    legendSheet.addRow(['E', 'Edit - Can edit/update existing records']);
    legendSheet.addRow(['D', 'Delete - Can delete records']);
    legendSheet.addRow([]);
    
    legendSheet.addRow(['Color Codes']);
    legendSheet.getRow(9).font = { bold: true, size: 12 };
    
    const greenRow = legendSheet.addRow(['VCED', 'Full Access (View, Create, Edit, Delete)']);
    greenRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
    greenRow.getCell(1).alignment = { horizontal: 'center' };
    
    const yellowRow = legendSheet.addRow(['VCE / VE / VC', 'Partial Write Access']);
    yellowRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
    yellowRow.getCell(1).alignment = { horizontal: 'center' };
    
    const blueRow = legendSheet.addRow(['V', 'View Only']);
    blueRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
    blueRow.getCell(1).alignment = { horizontal: 'center' };
    
    const noPermRow = legendSheet.addRow(['-', 'No Permission Assigned']);
    noPermRow.getCell(1).alignment = { horizontal: 'center' };
    
    legendSheet.addRow([]);
    legendSheet.addRow(['Generated:', new Date().toLocaleString()]);
    legendSheet.addRow(['Database:', config.database.database]);
    
    legendSheet.columns = [{ width: 18 }, { width: 50 }];
    
    // Ensure reports folder exists
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Save
    const fileName = path.join(reportsDir, `Role-Permission-Matrix-${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.writeFile(fileName);
    
    console.log('\n========================================');
    console.log('✅ Excel file created successfully!');
    console.log('📁 File:', fileName);
    console.log('========================================');
    console.log(`📊 Summary:`);
    console.log(`   • ${roles.recordset.length} roles`);
    console.log(`   • ${forms.recordset.length} forms`);
    console.log(`   • ${permissions.recordset.length} permission entries`);
    console.log('========================================\n');
    
    await sql.close();
}

generateMatrix().catch(err => { 
    console.error('Error:', err.message); 
    process.exit(1); 
});
