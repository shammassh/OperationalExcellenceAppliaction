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
        
        return result.recordset[0] || null;
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
