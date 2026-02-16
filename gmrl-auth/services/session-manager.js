/**
 * Session Manager Module
 * Handles user session management (24-hour expiration)
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const sql = require('mssql');
const crypto = require('crypto');
const config = require('../../config/default');

class SessionManager {
    /**
     * Create a new session for user
     */
    static async createSession(userId, azureTokens) {
        const pool = await sql.connect(config.database);
        
        const sessionToken = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        const result = await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .input('userId', sql.Int, userId)
            .input('accessToken', sql.NVarChar, azureTokens.accessToken)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query(`
                INSERT INTO Sessions (
                    SessionId, UserId, Token, ExpiresAt
                )
                OUTPUT INSERTED.*
                VALUES (
                    @sessionToken, @userId, @accessToken, @expiresAt
                )
            `);
        
        console.log(`✅ Session created for user ${userId}, expires in 24 hours`);
        return result.recordset[0];
    }
    
    /**
     * Get session by token
     */
    static async getSession(sessionToken) {
        const pool = await sql.connect(config.database);
        
        // Get main session and user info
        const result = await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .query(`
                SELECT 
                    s.Id AS session_id,
                    s.SessionId AS session_token,
                    s.UserId AS user_id,
                    s.Token AS azure_access_token,
                    s.ExpiresAt AS expires_at,
                    s.CreatedAt AS session_created_at,
                    u.Id AS user_db_id,
                    u.AzureOid AS azure_user_id,
                    u.Email AS email,
                    u.DisplayName AS display_name,
                    r.RoleName AS role,
                    u.IsActive AS is_active,
                    u.IsApproved AS is_approved,
                    u.CreatedAt AS user_created_at,
                    u.LastLoginAt AS last_login
                FROM Sessions s
                INNER JOIN Users u ON s.UserId = u.Id
                LEFT JOIN UserRoles r ON u.RoleId = r.Id
                WHERE s.SessionId = @sessionToken
                AND s.ExpiresAt > GETDATE()
                AND u.IsActive = 1
            `);
        
        if (!result.recordset[0]) {
            return null;
        }
        
        const session = result.recordset[0];
        session.role_id = session.user_db_id ? (await pool.request().input('userId', sql.Int, session.user_db_id).query('SELECT RoleId FROM Users WHERE Id = @userId')).recordset[0]?.RoleId : null;
        
        // Get all user roles (multi-role support)
        const rolesResult = await pool.request()
            .input('userId', sql.Int, session.user_db_id)
            .query(`
                SELECT r.Id, r.RoleName, c.CategoryName
                FROM UserRoleAssignments ura
                JOIN UserRoles r ON ura.RoleId = r.Id
                JOIN RoleCategories c ON r.CategoryId = c.Id
                WHERE ura.UserId = @userId
                ORDER BY c.Id, r.Id
            `);
        
        session.roles = rolesResult.recordset;
        session.roleNames = rolesResult.recordset.map(r => r.RoleName);
        
        // Get user's form permissions from UserFormAccess (user-specific overrides)
        const permissionsResult = await pool.request()
            .input('userId', sql.Int, session.user_db_id)
            .query(`
                SELECT FormCode, CanView, CanCreate, CanEdit, CanDelete
                FROM UserFormAccess
                WHERE UserId = @userId
            `);
        
        session.permissions = {};
        permissionsResult.recordset.forEach(p => {
            session.permissions[p.FormCode] = {
                canView: p.CanView,
                canCreate: p.CanCreate,
                canEdit: p.CanEdit,
                canDelete: p.CanDelete,
                source: 'user'  // Mark as user-specific permission
            };
        });
        
        // Get role-based permissions from RoleFormAccess (for all user's roles)
        // These are merged - if any role has permission, user gets it
        const roleIds = rolesResult.recordset.map(r => r.Id);
        if (roleIds.length > 0) {
            const rolePermissionsResult = await pool.request()
                .query(`
                    SELECT DISTINCT FormCode, 
                           MAX(CAST(CanView AS INT)) as CanView,
                           MAX(CAST(CanCreate AS INT)) as CanCreate,
                           MAX(CAST(CanEdit AS INT)) as CanEdit,
                           MAX(CAST(CanDelete AS INT)) as CanDelete
                    FROM RoleFormAccess
                    WHERE RoleId IN (${roleIds.join(',')})
                    GROUP BY FormCode
                `);
            
            // Add role permissions only if user doesn't have specific override
            rolePermissionsResult.recordset.forEach(p => {
                if (!session.permissions[p.FormCode]) {
                    session.permissions[p.FormCode] = {
                        canView: p.CanView === 1,
                        canCreate: p.CanCreate === 1,
                        canEdit: p.CanEdit === 1,
                        canDelete: p.CanDelete === 1,
                        source: 'role'  // Mark as role-based permission
                    };
                }
            });
        }
        
        return session;
    }
    
    /**
     * Update session last activity
     */
    static async updateActivity(sessionToken) {
        const pool = await sql.connect(config.database);
        
        // Sessions table doesn't have last_activity column, skip this update
        // Can be added later if needed
    }
    
    /**
     * Get impersonated user permissions
     * Used when admin impersonates another user for testing
     */
    static async getImpersonatedUserPermissions(userId) {
        const pool = await sql.connect(config.database);
        
        // Get user info
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT u.Id, u.Email, u.DisplayName
                FROM Users u
                WHERE u.Id = @userId AND u.IsActive = 1
            `);
        
        if (!userResult.recordset[0]) {
            return null;
        }
        
        const user = userResult.recordset[0];
        
        // Get all user roles
        const rolesResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT r.Id, r.RoleName, c.CategoryName
                FROM UserRoleAssignments ura
                JOIN UserRoles r ON ura.RoleId = r.Id
                JOIN RoleCategories c ON r.CategoryId = c.Id
                WHERE ura.UserId = @userId
                ORDER BY c.Id, r.Id
            `);
        
        // Get user's form permissions from UserFormAccess
        const permissionsResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT FormCode, CanView, CanCreate, CanEdit, CanDelete
                FROM UserFormAccess
                WHERE UserId = @userId
            `);
        
        const permissions = {};
        permissionsResult.recordset.forEach(p => {
            permissions[p.FormCode] = {
                canView: p.CanView,
                canCreate: p.CanCreate,
                canEdit: p.CanEdit,
                canDelete: p.CanDelete,
                source: 'user'
            };
        });
        
        // Get role-based permissions
        const roleIds = rolesResult.recordset.map(r => r.Id);
        if (roleIds.length > 0) {
            const rolePermissionsResult = await pool.request()
                .query(`
                    SELECT DISTINCT FormCode, 
                           MAX(CAST(CanView AS INT)) as CanView,
                           MAX(CAST(CanCreate AS INT)) as CanCreate,
                           MAX(CAST(CanEdit AS INT)) as CanEdit,
                           MAX(CAST(CanDelete AS INT)) as CanDelete
                    FROM RoleFormAccess
                    WHERE RoleId IN (${roleIds.join(',')})
                    GROUP BY FormCode
                `);
            
            rolePermissionsResult.recordset.forEach(p => {
                if (!permissions[p.FormCode]) {
                    permissions[p.FormCode] = {
                        canView: p.CanView === 1,
                        canCreate: p.CanCreate === 1,
                        canEdit: p.CanEdit === 1,
                        canDelete: p.CanDelete === 1,
                        source: 'role'
                    };
                }
            });
        }
        
        return {
            id: user.Id,
            email: user.Email,
            displayName: user.DisplayName,
            roles: rolesResult.recordset,
            roleNames: rolesResult.recordset.map(r => r.RoleName),
            permissions: permissions
        };
    }
    
    /**
     * Delete session (logout)
     */
    static async deleteSession(sessionToken) {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .query('DELETE FROM Sessions WHERE SessionId = @sessionToken');
        
        console.log('✅ Session deleted');
    }
    
    /**
     * Cleanup expired sessions
     */
    static async cleanupExpiredSessions() {
        const pool = await sql.connect(config.database);
        
        const result = await pool.request()
            .query('DELETE FROM Sessions WHERE ExpiresAt < GETDATE()');
        
        const count = result.rowsAffected[0];
        if (count > 0) {
            console.log(`✅ Cleaned up ${count} expired session(s)`);
        }
        
        return count;
    }
    
    /**
     * Generate secure random session token
     */
    static generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Validate session token format
     */
    static isValidTokenFormat(token) {
        return typeof token === 'string' && token.length === 64 && /^[0-9a-f]+$/.test(token);
    }
}

module.exports = SessionManager;
