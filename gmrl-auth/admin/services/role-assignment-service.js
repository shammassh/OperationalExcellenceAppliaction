/**
 * Role Assignment Service
 * Handles user role and approval management
 */

const sql = require('mssql');
const config = require('../../config/default');

class RoleAssignmentService {
    static async getAllUsers() {
        const pool = await sql.connect(config.database);
        const result = await pool.request().query(`
            SELECT 
                id, 
                azure_user_id, 
                email, 
                display_name, 
                role, 
                assigned_stores,
                assigned_department,
                is_active, 
                is_approved,
                created_at, 
                last_login
            FROM Users
            ORDER BY created_at DESC
        `);
        return result.recordset;
    }

    static async updateUser(userId, updateData) {
        const pool = await sql.connect(config.database);
        
        const updates = [];
        const request = pool.request().input('userId', sql.Int, userId);
        
        if (updateData.role !== undefined) {
            updates.push('role = @role');
            request.input('role', sql.NVarChar, updateData.role);
        }
        if (updateData.display_name !== undefined) {
            updates.push('display_name = @display_name');
            request.input('display_name', sql.NVarChar, updateData.display_name);
        }
        if (updateData.is_approved !== undefined) {
            updates.push('is_approved = @is_approved');
            request.input('is_approved', sql.Bit, updateData.is_approved ? 1 : 0);
        }
        if (updateData.is_active !== undefined) {
            updates.push('is_active = @is_active');
            request.input('is_active', sql.Bit, updateData.is_active ? 1 : 0);
        }
        if (updateData.assigned_stores !== undefined) {
            updates.push('assigned_stores = @assigned_stores');
            request.input('assigned_stores', sql.NVarChar, JSON.stringify(updateData.assigned_stores));
        }
        if (updateData.assigned_department !== undefined) {
            updates.push('assigned_department = @assigned_department');
            request.input('assigned_department', sql.NVarChar, updateData.assigned_department);
        }
        
        if (updates.length === 0) {
            return await this.getUserById(userId);
        }
        
        await request.query(`
            UPDATE Users 
            SET ${updates.join(', ')}, updated_at = GETDATE()
            WHERE id = @userId
        `);
        
        return await this.getUserById(userId);
    }

    static async getUserById(userId) {
        const pool = await sql.connect(config.database);
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM Users WHERE id = @userId');
        return result.recordset[0];
    }

    static async updateUserRole(userId, newRole) {
        const pool = await sql.connect(config.database);
        
        // If assigning a real role (not Pending), approve and activate the user
        const isApproved = newRole !== 'Pending' ? 1 : 0;
        const isActive = newRole !== 'Pending' ? 1 : 0;
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('role', sql.NVarChar, newRole)
            .input('isApproved', sql.Bit, isApproved)
            .input('isActive', sql.Bit, isActive)
            .query(`
                UPDATE Users 
                SET role = @role, is_approved = @isApproved, is_active = @isActive, updated_at = GETDATE()
                WHERE id = @userId
            `);
        
        return await this.getUserById(userId);
    }

    static async updateUserStatus(userId, isActive) {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('isActive', sql.Bit, isActive ? 1 : 0)
            .query(`
                UPDATE Users 
                SET is_active = @isActive, updated_at = GETDATE()
                WHERE id = @userId
            `);
        
        return await this.getUserById(userId);
    }

    static async approveUser(userId, role = 'Auditor') {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('role', sql.NVarChar, role)
            .query(`
                UPDATE Users 
                SET role = @role, is_approved = 1, is_active = 1, updated_at = GETDATE()
                WHERE id = @userId
            `);
        
        return await this.getUserById(userId);
    }

    static async rejectUser(userId) {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE Users 
                SET is_approved = 0, is_active = 0, updated_at = GETDATE()
                WHERE id = @userId
            `);
        
        return { success: true };
    }

    static async syncUsersFromGraph(graphUsers) {
        const pool = await sql.connect(config.database);
        let newUsers = 0;
        let updatedUsers = 0;

        for (const graphUser of graphUsers) {
            // Skip users without email
            if (!graphUser.mail && !graphUser.userPrincipalName) continue;
            
            const email = graphUser.mail || graphUser.userPrincipalName;
            const displayName = graphUser.displayName || email.split('@')[0];
            const azureId = graphUser.id;

            // Check if user exists
            const existing = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT id FROM Users WHERE email = @email');

            if (existing.recordset.length > 0) {
                // Update existing user
                await pool.request()
                    .input('email', sql.NVarChar, email)
                    .input('displayName', sql.NVarChar, displayName)
                    .input('azureId', sql.NVarChar, azureId)
                    .query(`
                        UPDATE Users 
                        SET display_name = @displayName, azure_user_id = @azureId, updated_at = GETDATE()
                        WHERE email = @email
                    `);
                updatedUsers++;
            } else {
                // Insert new user with Pending role (is_approved = 0)
                await pool.request()
                    .input('email', sql.NVarChar, email)
                    .input('displayName', sql.NVarChar, displayName)
                    .input('azureId', sql.NVarChar, azureId)
                    .query(`
                        INSERT INTO Users (email, display_name, azure_user_id, role, is_active, is_approved, created_at)
                        VALUES (@email, @displayName, @azureId, 'Pending', 1, 0, GETDATE())
                    `);
                newUsers++;
            }
        }

        return { newUsers, updatedUsers };
    }

    static async logAction(userId, action, details) {
        try {
            const pool = await sql.connect(config.database);
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('action', sql.NVarChar, action)
                .input('details', sql.NVarChar, JSON.stringify(details))
                .query(`
                    INSERT INTO audit_logs (user_id, action, details, created_at)
                    VALUES (@userId, @action, @details, GETDATE())
                `);
        } catch (error) {
            // Log error but don't fail the main operation
            console.error('[AUDIT] Error logging action:', error.message);
        }
    }
}

module.exports = RoleAssignmentService;
