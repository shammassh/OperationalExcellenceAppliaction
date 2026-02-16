/**
 * Setup Forms Registry on both UAT and Live databases
 */

const sql = require('mssql');
const config = require('./config/default');

async function runSetup(dbName) {
    const dbConfig = { 
        server: config.database.server,
        user: config.database.user,
        password: config.database.password,
        database: dbName,
        options: config.database.options
    };
    
    console.log(`\nConnecting to ${dbName}...`);
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Check if Forms table exists, create if not
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Forms')
            BEGIN
                CREATE TABLE Forms (
                    Id INT PRIMARY KEY IDENTITY(1,1),
                    FormCode NVARCHAR(100) NOT NULL UNIQUE,
                    FormName NVARCHAR(255) NOT NULL,
                    ModuleName NVARCHAR(100) NOT NULL,
                    FormUrl NVARCHAR(500),
                    Description NVARCHAR(500),
                    IsActive BIT DEFAULT 1,
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    UpdatedAt DATETIME2
                );
                PRINT 'Forms table created';
            END
        `);
        
        // Add Description column if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'Description')
            BEGIN
                ALTER TABLE Forms ADD Description NVARCHAR(500);
            END
        `);
        
        // Add FormUrl column if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'FormUrl')
            BEGIN
                ALTER TABLE Forms ADD FormUrl NVARCHAR(500);
            END
        `);
        
        // Add UpdatedAt column if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Forms') AND name = 'UpdatedAt')
            BEGIN
                ALTER TABLE Forms ADD UpdatedAt DATETIME2;
            END
        `);
        
        console.log('✓ Forms table ready');
        
        // Define all forms
        const forms = [
            // OHS Module
            ['OHS_DASHBOARD', 'OHS Dashboard', 'OHS', '/ohs', 'Main OHS landing page'],
            ['OHS_SETTINGS', 'OHS Settings', 'OHS', '/ohs/settings', 'OHS configuration'],
            ['OHS_INCIDENT', 'OHS Incident Reporting', 'OHS', '/stores/ohs-incident', 'Report OHS incidents'],
            
            // OHS Inspection
            ['OHS_INSPECTION', 'OHS Inspection', 'OHS Inspection', '/ohs-inspection', 'OHS inspection forms'],
            ['OHS_INSPECTION_TEMPLATES', 'OHS Inspection Templates', 'OHS Inspection', '/ohs-inspection/templates', 'Manage templates'],
            
            // OE Inspection
            ['OE_INSPECTION', 'OE Inspection', 'OE Inspection', '/oe-inspection', 'OE inspections'],
            ['OE_INSPECTION_TEMPLATES', 'OE Inspection Templates', 'OE Inspection', '/oe-inspection/templates', 'Manage templates'],
            
            // Operational Excellence
            ['OP_EXCELLENCE', 'Operational Excellence', 'Operational Excellence', '/operational-excellence', 'OE dashboard'],
            ['OP_ATTENDANCE', 'Attendance Dashboard', 'Operational Excellence', '/operational-excellence/attendance', 'Attendance reports'],
            ['OP_COMPLAINTS', 'Complaints Dashboard', 'Operational Excellence', '/operational-excellence/complaints', 'Manage complaints'],
            ['OP_FEEDBACK', 'Feedback Dashboard', 'Operational Excellence', '/operational-excellence/feedback', 'Weekly feedback'],
            ['OP_PRODUCTION', 'Production Dashboard', 'Operational Excellence', '/operational-excellence/production', 'Production extras'],
            ['OP_THIRDPARTY', 'Third Party Dashboard', 'Operational Excellence', '/operational-excellence/thirdparty', 'Third party attendance'],
            ['OP_THEFT', 'Theft Dashboard', 'Operational Excellence', '/operational-excellence/theft', 'Theft incidents'],
            ['OP_EXTRA_CLEANING', 'Extra Cleaning Review', 'Operational Excellence', '/operational-excellence/extra-cleaning', 'Extra cleaning'],
            ['OP_FIVE_DAYS', 'Five Days Dashboard', 'Operational Excellence', '/operational-excellence/five-days', 'Five days entries'],
            ['OP_SECURITY', 'Security Dashboard (OE)', 'Operational Excellence', '/operational-excellence/security', 'Security dashboard'],
            
            // Security Module
            ['SECURITY_DASHBOARD', 'Security Dashboard', 'Security', '/security', 'Security department'],
            ['SECURITY_DELIVERY_LOG', 'Delivery Logs', 'Security', '/security/delivery-logs', 'Delivery logs'],
            ['SECURITY_PATROL', 'Patrol Sheets', 'Security', '/security/patrol-sheets', 'Patrol records'],
            ['SECURITY_ENTRANCE', 'Entrance Forms', 'Security', '/security/entrance-forms', 'Entrance gate'],
            ['SECURITY_ATTENDANCE', 'Security Attendance', 'Security', '/security/attendance', 'Staff attendance'],
            ['SECURITY_VISITOR_CARS', 'Visitor Cars', 'Security', '/security/visitor-cars', 'Visitor vehicles'],
            ['SECURITY_PARKING', 'Parking Violations', 'Security', '/security/parking-violations', 'Parking violations'],
            ['SECURITY_CHECKLIST', 'Security Checklist Reference', 'Security', '/security/checklist-reference', 'Checklist mgmt'],
            ['SECURITY_CLEANING', 'Cleaning Reference', 'Security', '/security/cleaning-reference', 'Cleaning checklist'],
            
            // Security Services (Store-level)
            ['SEC_SERVICES', 'Security Services', 'Security Services', '/security-services', 'Store security'],
            ['SEC_CHECKLIST', 'Security Checklist', 'Security Services', '/security-services/checklist', 'Daily checklist'],
            ['SEC_CLEANING_CHECKLIST', 'Cleaning Checklist', 'Security Services', '/security-services/cleaning-checklist', 'Cleaning inspection'],
            
            // Stores Module
            ['STORES_DASHBOARD', 'Stores Dashboard', 'Stores', '/stores', 'Stores landing'],
            ['STORES_CLEANING', 'Store Cleaning', 'Stores', '/stores/cleaning', 'Cleaning mgmt'],
            ['STORES_COMPLAINTS', 'Store Complaints', 'Stores', '/stores/complaints', 'Complaint submission'],
            ['STORES_FEEDBACK', 'Store Feedback', 'Stores', '/stores/feedback', 'Feedback submission'],
            ['STORES_THEFT', 'Theft Reporting', 'Stores', '/stores/theft', 'Theft incidents'],
            
            // HR Module
            ['HR_DASHBOARD', 'HR Dashboard', 'HR', '/hr', 'Human Resources'],
            
            // Personnel Module
            ['PERSONNEL_DASHBOARD', 'Personnel', 'Personnel', '/personnel', 'Personnel mgmt']
        ];
        
        // Insert or update each form
        let inserted = 0;
        let updated = 0;
        
        for (const [formCode, formName, moduleName, formUrl, description] of forms) {
            const exists = await pool.request()
                .input('formCode', sql.NVarChar, formCode)
                .query('SELECT Id FROM Forms WHERE FormCode = @formCode');
            
            if (exists.recordset.length > 0) {
                await pool.request()
                    .input('formCode', sql.NVarChar, formCode)
                    .input('formName', sql.NVarChar, formName)
                    .input('moduleName', sql.NVarChar, moduleName)
                    .input('formUrl', sql.NVarChar, formUrl)
                    .input('description', sql.NVarChar, description)
                    .query(`
                        UPDATE Forms SET 
                            FormName = @formName, 
                            ModuleName = @moduleName, 
                            FormUrl = @formUrl, 
                            Description = @description,
                            UpdatedAt = GETDATE()
                        WHERE FormCode = @formCode
                    `);
                updated++;
            } else {
                await pool.request()
                    .input('formCode', sql.NVarChar, formCode)
                    .input('formName', sql.NVarChar, formName)
                    .input('moduleName', sql.NVarChar, moduleName)
                    .input('formUrl', sql.NVarChar, formUrl)
                    .input('description', sql.NVarChar, description)
                    .query(`
                        INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive)
                        VALUES (@formCode, @formName, @moduleName, @formUrl, @description, 1)
                    `);
                inserted++;
            }
        }
        
        console.log(`✓ Forms: ${inserted} inserted, ${updated} updated`);
        
        // Show summary
        const result = await pool.request().query(`
            SELECT ModuleName, COUNT(*) as FormCount 
            FROM Forms 
            GROUP BY ModuleName 
            ORDER BY ModuleName
        `);
        console.log('\nForms by Module:');
        result.recordset.forEach(r => {
            console.log(`  ${r.ModuleName}: ${r.FormCount} forms`);
        });
        
        await pool.close();
        return inserted + updated;
        
    } catch (err) {
        console.error(`Error on ${dbName}:`, err.message);
        if (pool) await pool.close();
        throw err;
    }
}

async function main() {
    console.log('=========================================');
    console.log('  Forms Registry Setup Script');
    console.log('=========================================');
    
    try {
        console.log('\n========== UAT DATABASE ==========');
        await runSetup('OEApp_UAT');
        
        console.log('\n========== LIVE DATABASE ==========');
        await runSetup('OEApp_Live');
        
        console.log('\n=========================================');
        console.log('  ✅ Setup complete on both databases!');
        console.log('=========================================');
        console.log('\nNext steps:');
        console.log('1. Restart the app to load the new middleware');
        console.log('2. Go to /admin/users to assign form permissions');
        console.log('3. Users need to log out and log back in for changes to take effect');
        
    } catch (err) {
        console.error('\n❌ Setup failed:', err.message);
        process.exit(1);
    }
    
    process.exit(0);
}

main();
