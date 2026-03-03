/**
 * Fix Security Department Dashboard Icons
 * Run this script to properly set Unicode emoji icons
 */

const sql = require('mssql');
require('dotenv').config({ path: '.env.uat' });

const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const securityIcons = [
    { formCode: 'SECURITY_LEGAL_CASES', icon: '⚖️' },
    { formCode: 'SECURITY_BLACKLIST', icon: '🚫' },
    { formCode: 'SECURITY_DAILY_REPORTING', icon: '📝' },
    { formCode: 'SECURITY_VISIT_CALENDAR', icon: '📅' },
    { formCode: 'SECURITY_CAMERA_REQUEST', icon: '📹' },
    { formCode: 'SECURITY_POST_VISIT_REPORT', icon: '🔍' }
];

async function fixIcons(database) {
    const config = { ...dbConfig, database };
    
    try {
        console.log(`\nConnecting to ${database}...`);
        const pool = await sql.connect(config);
        
        for (const item of securityIcons) {
            await pool.request()
                .input('icon', sql.NVarChar, item.icon)
                .input('formCode', sql.NVarChar, item.formCode)
                .query(`UPDATE Forms SET DashboardIcon = @icon WHERE FormCode = @formCode`);
            console.log(`  ✓ Updated ${item.formCode} with icon: ${item.icon}`);
        }
        
        // Verify
        const result = await pool.request()
            .query(`SELECT FormCode, DashboardIcon, DashboardTitle FROM Forms WHERE DashboardCategory = 'Security Department' ORDER BY DashboardSortOrder`);
        
        console.log(`\n  Current Security Department icons in ${database}:`);
        result.recordset.forEach(r => {
            console.log(`    ${r.FormCode}: ${r.DashboardIcon} - ${r.DashboardTitle}`);
        });
        
        await pool.close();
        console.log(`\n✅ ${database} icons fixed!`);
    } catch (err) {
        console.error(`Error fixing ${database}:`, err.message);
    }
}

async function main() {
    console.log('Fixing Security Department Dashboard Icons...\n');
    
    await fixIcons('OEApp_UAT');
    await sql.close();
    
    await fixIcons('OEApp_Live');
    await sql.close();
    
    console.log('\n🎉 All done!');
    process.exit(0);
}

main();
