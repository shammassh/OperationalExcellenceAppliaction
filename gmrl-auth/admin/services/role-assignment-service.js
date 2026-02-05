/**
 * Role Assignment Service
 * Handles user role and approval management
 */

const sql = require('mssql');
const config = require('../../../config/default');

class RoleAssignmentService {
    static async getAllUsers() {
        const pool = await sql.connect(config.database);
        const result = await pool.request().query(`
            SELECT 
                Id as id, 
                AzureId as azure_user_id, 
                Email as email, 
                DisplayName as display_name, 
                CASE 
                    WHEN RoleId = 1 THEN 'Admin'
                    WHEN RoleId = 2 THEN 'SuperAuditor'
                    WHEN RoleId = 3 THEN 'Auditor'
                    ELSE 'Pending'
                END as role,
                IsActive as is_active, 
                IsApproved as is_approved,
                CreatedAt as created_at, 
                LastLoginAt as last_login
            FROM Users
            ORDER BY CreatedAt DESC
        `);
        return result.recordset;
    }

    static getRoleId(roleName) {
        const roleMap = {
            'Admin': 1,
            'SuperAuditor': 2,
            'Auditor': 3,
            'Pending': null
        };
        return roleMap[roleName] || null;
    }

    static async updateUser(userId, updateData) {
        const pool = await sql.connect(config.database);
        
        const updates = [];
        const request = pool.request().input('userId', sql.Int, userId);
        
        if (updateData.role !== undefined) {
            const roleId = this.getRoleId(updateData.role);
            updates.push('RoleId = @roleId');
            request.input('roleId', sql.Int, roleId);
            
            // When assigning a role, also approve the user
            if (roleId !== null) {
                updates.push('IsApproved = 1');
            }
        }
        if (updateData.display_name !== undefined) {
            updates.push('DisplayName = @displayName');
            request.input('displayName', sql.NVarChar, updateData.display_name);
        }
        if (updateData.is_approved !== undefined) {
            updates.push('IsApproved = @isApproved');
            request.input('isApproved', sql.Bit, updateData.is_approved ? 1 : 0);
        }
        if (updateData.is_active !== undefined) {
            updates.push('IsActive = @isActive');
            request.input('isActive', sql.Bit, updateData.is_active ? 1 : 0);
        }
        
        if (updates.length === 0) {
            return await this.getUserById(userId);
        }
        
        await request.query(`
            UPDATE Users 
            SET ${updates.join(', ')}, UpdatedAt = GETDATE()
            WHERE Id = @userId
        `);
        
        return await this.getUserById(userId);
    }

    static async getUserById(userId) {
        const pool = await sql.connect(config.database);
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    Id as id, 
                    AzureId as azure_user_id, 
                    Email as email, 
                    DisplayName as display_name, 
                    CASE 
                        WHEN RoleId = 1 THEN 'Admin'
                        WHEN RoleId = 2 THEN 'SuperAuditor'
                        WHEN RoleId = 3 THEN 'Auditor'
                        ELSE 'Pending'
                    END as role,
                    IsActive as is_active, 
                    IsApproved as is_approved,
                    CreatedAt as created_at, 
                    LastLoginAt as last_login
                FROM Users WHERE Id = @userId
            `);
        return result.recordset[0];
    }

    static async updateUserRole(userId, newRole) {
        const pool = await sql.connect(config.database);
        
        // If assigning a real role (not Pending), approve and activate the user
        const roleId = this.getRoleId(newRole);
        const isApproved = newRole !== 'Pending' ? 1 : 0;
        const isActive = newRole !== 'Pending' ? 1 : 0;
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('roleId', sql.Int, roleId)
            .input('isApproved', sql.Bit, isApproved)
            .input('isActive', sql.Bit, isActive)
            .query(`
                UPDATE Users 
                SET RoleId = @roleId, IsApproved = @isApproved, IsActive = @isActive, UpdatedAt = GETDATE()
                WHERE Id = @userId
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
                SET IsActive = @isActive, UpdatedAt = GETDATE()
                WHERE Id = @userId
            `);
        
        return await this.getUserById(userId);
    }

    static async approveUser(userId, role = 'Auditor') {
        const pool = await sql.connect(config.database);
        const roleId = this.getRoleId(role);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('roleId', sql.Int, roleId)
            .query(`
                UPDATE Users 
                SET RoleId = @roleId, IsApproved = 1, IsActive = 1, UpdatedAt = GETDATE()
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
                SET IsApproved = 0, IsActive = 0, UpdatedAt = GETDATE()
                WHERE Id = @userId
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
