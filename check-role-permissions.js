/**
 * Show Role Permissions for OE/OHS Inspection
 */
const sql = require('mssql');
const config = require('./config/default');

async function showRolePermissions() {
    const pool = await sql.connect(config.database);
    
    console.log('========== OE/OHS INSPECTION FORMS ==========');
    const forms = await pool.request().query(`
        SELECT FormCode, FormName, ModuleName 
        FROM Forms 
        WHERE ModuleName IN ('OE Inspection', 'OHS Inspection')
        ORDER BY ModuleName, FormCode
    `);
    console.table(forms.recordset);
    
    console.log('\n========== RELEVANT ROLES ==========');
    const roles = await pool.request().query(`
        SELECT Id, RoleName 
        FROM UserRoles 
        WHERE RoleName IN ('System Administrator', 'Senior Inspector', 'Inspector', 'Implementation Inspector', 'OHS Manager', 'OHS Officer', 'Head of Operational Excellence')
        ORDER BY Id
    `);
    console.table(roles.recordset);
    
    console.log('\n========== CURRENT ROLE FORM ACCESS (OE/OHS Inspection) ==========');
    const roleAccess = await pool.request().query(`
        SELECT r.RoleName, rfa.FormCode, 
               CASE WHEN rfa.CanView = 1 THEN 'Y' ELSE '-' END as [View],
               CASE WHEN rfa.CanCreate = 1 THEN 'Y' ELSE '-' END as [Create],
               CASE WHEN rfa.CanEdit = 1 THEN 'Y' ELSE '-' END as [Edit],
               CASE WHEN rfa.CanDelete = 1 THEN 'Y' ELSE '-' END as [Delete]
        FROM RoleFormAccess rfa 
        JOIN UserRoles r ON rfa.RoleId = r.Id
        WHERE rfa.FormCode LIKE 'OE_%' OR rfa.FormCode LIKE 'OHS_%'
        ORDER BY r.Id, rfa.FormCode
    `);
    
    if (roleAccess.recordset.length === 0) {
        console.log('No role permissions defined yet for OE/OHS Inspection forms.');
        console.log('You need to add entries to RoleFormAccess table.');
    } else {
        console.table(roleAccess.recordset);
    }
    
    await pool.close();
}

showRolePermissions().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
