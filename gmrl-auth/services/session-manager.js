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
            .input('refreshToken', sql.NVarChar, azureTokens.refreshToken || null)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query(`
                INSERT INTO Sessions (
                    session_token, user_id, azure_access_token,
                    azure_refresh_token, expires_at
                )
                OUTPUT INSERTED.*
                VALUES (
                    @sessionToken, @userId, @accessToken,
                    @refreshToken, @expiresAt
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
                    s.id AS session_id,
                    s.session_token,
                    s.user_id,
                    s.azure_access_token,
                    s.azure_refresh_token,
                    s.expires_at,
                    s.created_at AS session_created_at,
                    s.last_activity,
                    u.id AS user_db_id,
                    u.azure_user_id,
                    u.email,
                    u.display_name,
                    u.photo_url,
                    u.job_title,
                    u.department,
                    u.role,
                    u.assigned_stores,
                    u.assigned_department,
                    u.is_active,
                    u.is_approved,
                    u.created_at AS user_created_at,
                    u.last_login
                FROM Sessions s
                INNER JOIN Users u ON s.user_id = u.id
                WHERE s.session_token = @sessionToken
                AND s.expires_at > GETDATE()
                AND u.is_active = 1
            `);
        
        return result.recordset[0] || null;
    }
    
    /**
     * Update session last activity
     */
    static async updateActivity(sessionToken) {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .query(`
                UPDATE Sessions
                SET last_activity = GETDATE()
                WHERE session_token = @sessionToken
            `);
    }
    
    /**
     * Delete session (logout)
     */
    static async deleteSession(sessionToken) {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .query('DELETE FROM Sessions WHERE session_token = @sessionToken');
        
        console.log('✅ Session deleted');
    }
    
    /**
     * Cleanup expired sessions
     */
    static async cleanupExpiredSessions() {
        const pool = await sql.connect(config.database);
        
        const result = await pool.request()
            .query('DELETE FROM Sessions WHERE expires_at < GETDATE()');
        
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
