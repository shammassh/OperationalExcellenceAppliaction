const sql = require('mssql');
const config = require('./config/default');

async function check() {
    await sql.connect({ 
        server: config.database.server, 
        database: config.database.database, 
        user: config.database.user, 
        password: config.database.password, 
        options: config.database.options 
    });
    
    const cols = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UserRoles' ORDER BY ORDINAL_POSITION");
    console.log('UserRoles:', cols.recordset.map(c => c.COLUMN_NAME).join(', '));
    
    const cols2 = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RoleFormAccess' ORDER BY ORDINAL_POSITION");
    console.log('RoleFormAccess:', cols2.recordset.map(c => c.COLUMN_NAME).join(', '));
    
    const cols3 = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Forms' ORDER BY ORDINAL_POSITION");
    console.log('Forms:', cols3.recordset.map(c => c.COLUMN_NAME).join(', '));
    
    await sql.close();
}
check();
