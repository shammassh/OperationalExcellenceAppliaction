/**
 * Check Cesar's store assignment for 5 Days upload issue
 */

const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || 'localhost',
    database: 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function check() {
    const pool = await sql.connect(config);
    
    const userId = 3744; // Cesar Kanaan (spinneys)
    console.log('=== CHECKING CESAR (USER ID:', userId, ') STORE ASSIGNMENT ===\n');
    
    // Get user info
    const user = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT Id, Email, DisplayName FROM Users WHERE Id = @userId');
    console.log('User:', user.recordset[0]);
    
    // Check StoreManagerAssignments
    console.log('\n=== STORE MANAGER ASSIGNMENTS ===');
    const assignments = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`SELECT * FROM StoreManagerAssignments WHERE UserId = @userId`);
    console.log(assignments.recordset);
    
    if (assignments.recordset.length === 0) {
        console.log('\n>>> NO STORE ASSIGNED TO CESAR! <<<');
        console.log('This is why the 5 Days upload fails with "Store not assigned to user"');
    }
    
    // Check what columns exist in StoreManagerAssignments
    console.log('\n=== STORE MANAGER ASSIGNMENTS TABLE STRUCTURE ===');
    const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'StoreManagerAssignments'
    `);
    console.log(cols.recordset);
    
    // Check if there are any stores available
    console.log('\n=== AVAILABLE STORES (first 10) ===');
    const stores = await pool.request().query(`SELECT TOP 10 * FROM Stores`);
    console.log(stores.recordset);
    
    pool.close();
}

check().catch(console.error);
