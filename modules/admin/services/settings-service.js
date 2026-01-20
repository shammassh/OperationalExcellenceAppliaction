const sql = require('mssql');

class SettingsService {
    constructor(pool) {
        this.pool = pool;
    }

    // ==================== STORES ====================
    async getStores(includeInactive = false) {
        const query = includeInactive 
            ? 'SELECT * FROM Stores ORDER BY StoreName'
            : 'SELECT * FROM Stores WHERE IsActive = 1 ORDER BY StoreName';
        const result = await this.pool.request().query(query);
        return result.recordset;
    }

    async getStoreById(id) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM Stores WHERE Id = @id');
        return result.recordset[0];
    }

    async addStore(storeName, storeCode, createdBy) {
        const result = await this.pool.request()
            .input('storeName', sql.NVarChar(100), storeName)
            .input('storeCode', sql.NVarChar(50), storeCode)
            .input('createdBy', sql.NVarChar(100), createdBy)
            .query(`
                INSERT INTO Stores (StoreName, StoreCode, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (@storeName, @storeCode, @createdBy)
            `);
        return result.recordset[0];
    }

    async updateStore(id, storeName, storeCode, isActive) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .input('storeName', sql.NVarChar(100), storeName)
            .input('storeCode', sql.NVarChar(50), storeCode)
            .input('isActive', sql.Bit, isActive)
            .query(`
                UPDATE Stores 
                SET StoreName = @storeName, StoreCode = @storeCode, IsActive = @isActive
                WHERE Id = @id
            `);
        return result.rowsAffected[0] > 0;
    }

    async deleteStore(id) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Stores WHERE Id = @id');
        return result.rowsAffected[0] > 0;
    }

    // ==================== CAPTURE METHODS ====================
    async getCaptureMethods(includeInactive = false) {
        const query = includeInactive 
            ? 'SELECT * FROM CaptureMethods ORDER BY MethodName'
            : 'SELECT * FROM CaptureMethods WHERE IsActive = 1 ORDER BY MethodName';
        const result = await this.pool.request().query(query);
        return result.recordset;
    }

    async getCaptureMethodById(id) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM CaptureMethods WHERE Id = @id');
        return result.recordset[0];
    }

    async addCaptureMethod(methodName, createdBy) {
        const result = await this.pool.request()
            .input('methodName', sql.NVarChar(100), methodName)
            .input('createdBy', sql.NVarChar(100), createdBy)
            .query(`
                INSERT INTO CaptureMethods (MethodName, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (@methodName, @createdBy)
            `);
        return result.recordset[0];
    }

    async updateCaptureMethod(id, methodName, isActive) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .input('methodName', sql.NVarChar(100), methodName)
            .input('isActive', sql.Bit, isActive)
            .query(`
                UPDATE CaptureMethods 
                SET MethodName = @methodName, IsActive = @isActive
                WHERE Id = @id
            `);
        return result.rowsAffected[0] > 0;
    }

    async deleteCaptureMethod(id) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM CaptureMethods WHERE Id = @id');
        return result.rowsAffected[0] > 0;
    }

    // ==================== OUTSOURCE SECURITY COMPANIES ====================
    async getOutsourceCompanies(includeInactive = false) {
        const query = includeInactive 
            ? 'SELECT * FROM OutsourceSecurityCompanies ORDER BY CompanyName'
            : 'SELECT * FROM OutsourceSecurityCompanies WHERE IsActive = 1 ORDER BY CompanyName';
        const result = await this.pool.request().query(query);
        return result.recordset;
    }

    async getOutsourceCompanyById(id) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM OutsourceSecurityCompanies WHERE Id = @id');
        return result.recordset[0];
    }

    async addOutsourceCompany(companyName, createdBy) {
        const result = await this.pool.request()
            .input('companyName', sql.NVarChar(100), companyName)
            .input('createdBy', sql.NVarChar(100), createdBy)
            .query(`
                INSERT INTO OutsourceSecurityCompanies (CompanyName, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (@companyName, @createdBy)
            `);
        return result.recordset[0];
    }

    async updateOutsourceCompany(id, companyName, isActive) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .input('companyName', sql.NVarChar(100), companyName)
            .input('isActive', sql.Bit, isActive)
            .query(`
                UPDATE OutsourceSecurityCompanies 
                SET CompanyName = @companyName, IsActive = @isActive
                WHERE Id = @id
            `);
        return result.rowsAffected[0] > 0;
    }

    async deleteOutsourceCompany(id) {
        const result = await this.pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM OutsourceSecurityCompanies WHERE Id = @id');
        return result.rowsAffected[0] > 0;
    }
}

module.exports = SettingsService;
