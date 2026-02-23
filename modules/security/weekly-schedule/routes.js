/**
 * Weekly Cleaning Schedule - Admin Configuration Routes
 * Supervisor manages shifts, time slots, tasks, and agent assignments
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');

// Database config
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

// Main config page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'config.html'));
});

// =============================================
// SHIFTS CRUD
// =============================================

// Get all shifts
router.get('/api/shifts', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                s.Id,
                s.ShiftName,
                s.ShiftDescription,
                s.StartTime,
                s.EndTime,
                s.IsActive,
                s.SortOrder,
                (SELECT COUNT(*) FROM WeeklySchedule_TimeSlots WHERE ShiftId = s.Id AND IsActive = 1) AS TimeSlotCount,
                (SELECT COUNT(*) FROM WeeklySchedule_AgentAssignments WHERE ShiftId = s.Id AND IsActive = 1) AS AgentCount
            FROM WeeklySchedule_Shifts s
            WHERE s.IsActive = 1
            ORDER BY s.SortOrder
        `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching shifts:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add shift
router.post('/api/shifts', async (req, res) => {
    const { shiftName, shiftDescription, startTime, endTime } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('shiftName', sql.NVarChar, shiftName)
            .input('shiftDescription', sql.NVarChar, shiftDescription || '')
            .input('startTime', sql.Time, startTime)
            .input('endTime', sql.Time, endTime)
            .query(`
                DECLARE @maxSort INT;
                SELECT @maxSort = ISNULL(MAX(SortOrder), 0) FROM WeeklySchedule_Shifts;
                
                INSERT INTO WeeklySchedule_Shifts (ShiftName, ShiftDescription, StartTime, EndTime, SortOrder)
                OUTPUT INSERTED.*
                VALUES (@shiftName, @shiftDescription, @startTime, @endTime, @maxSort + 1);
            `);
        await pool.close();
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error adding shift:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update shift
router.put('/api/shifts/:id', async (req, res) => {
    const { id } = req.params;
    const { shiftName, shiftDescription, startTime, endTime } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .input('shiftName', sql.NVarChar, shiftName)
            .input('shiftDescription', sql.NVarChar, shiftDescription || '')
            .input('startTime', sql.Time, startTime)
            .input('endTime', sql.Time, endTime)
            .query(`
                UPDATE WeeklySchedule_Shifts 
                SET ShiftName = @shiftName, 
                    ShiftDescription = @shiftDescription,
                    StartTime = @startTime,
                    EndTime = @endTime,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating shift:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete shift (soft delete)
router.delete('/api/shifts/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`
                UPDATE WeeklySchedule_Shifts SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @id;
                UPDATE WeeklySchedule_TimeSlots SET IsActive = 0, UpdatedAt = GETDATE() WHERE ShiftId = @id;
                UPDATE WeeklySchedule_AgentAssignments SET IsActive = 0 WHERE ShiftId = @id;
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting shift:', err);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// TIME SLOTS CRUD
// =============================================

// Get time slots for a shift
router.get('/api/shifts/:shiftId/timeslots', async (req, res) => {
    const { shiftId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .query(`
                SELECT Id, ShiftId, SlotName, StartTime, EndTime, TaskDescription, IsBreak, IsActive, SortOrder
                FROM WeeklySchedule_TimeSlots
                WHERE ShiftId = @shiftId AND IsActive = 1
                ORDER BY SortOrder
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching time slots:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add time slot
router.post('/api/shifts/:shiftId/timeslots', async (req, res) => {
    const { shiftId } = req.params;
    const { slotName, startTime, endTime, taskDescription, isBreak } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .input('slotName', sql.NVarChar, slotName)
            .input('startTime', sql.Time, startTime)
            .input('endTime', sql.Time, endTime)
            .input('taskDescription', sql.NVarChar, taskDescription)
            .input('isBreak', sql.Bit, isBreak || false)
            .query(`
                DECLARE @maxSort INT;
                SELECT @maxSort = ISNULL(MAX(SortOrder), 0) FROM WeeklySchedule_TimeSlots WHERE ShiftId = @shiftId;
                
                INSERT INTO WeeklySchedule_TimeSlots (ShiftId, SlotName, StartTime, EndTime, TaskDescription, IsBreak, SortOrder)
                OUTPUT INSERTED.*
                VALUES (@shiftId, @slotName, @startTime, @endTime, @taskDescription, @isBreak, @maxSort + 1);
            `);
        await pool.close();
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error adding time slot:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update time slot
router.put('/api/timeslots/:id', async (req, res) => {
    const { id } = req.params;
    const { slotName, startTime, endTime, taskDescription, isBreak } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .input('slotName', sql.NVarChar, slotName)
            .input('startTime', sql.Time, startTime)
            .input('endTime', sql.Time, endTime)
            .input('taskDescription', sql.NVarChar, taskDescription)
            .input('isBreak', sql.Bit, isBreak || false)
            .query(`
                UPDATE WeeklySchedule_TimeSlots 
                SET SlotName = @slotName,
                    StartTime = @startTime,
                    EndTime = @endTime,
                    TaskDescription = @taskDescription,
                    IsBreak = @isBreak,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating time slot:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete time slot (soft delete)
router.delete('/api/timeslots/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE WeeklySchedule_TimeSlots SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting time slot:', err);
        res.status(500).json({ error: err.message });
    }
});

// Reorder time slots
router.post('/api/shifts/:shiftId/timeslots/reorder', async (req, res) => {
    const { shiftId } = req.params;
    const { order } = req.body; // Array of { id, sortOrder }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        for (const item of order) {
            await pool.request()
                .input('id', sql.Int, item.id)
                .input('sortOrder', sql.Int, item.sortOrder)
                .query(`UPDATE WeeklySchedule_TimeSlots SET SortOrder = @sortOrder WHERE Id = @id`);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error reordering time slots:', err);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// AGENT ASSIGNMENTS
// =============================================

// Get all users (for assignment dropdown)
router.get('/api/users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT Id, DisplayName, Email
            FROM Users
            WHERE IsActive = 1
            ORDER BY DisplayName
        `);
        await pool.close();
        res.json(result.recordset || []);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.json([]); // Return empty array instead of 500
    }
});

// Get agents assigned to a shift
router.get('/api/shifts/:shiftId/agents', async (req, res) => {
    const { shiftId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .query(`
                SELECT 
                    aa.Id AS AssignmentId,
                    aa.UserId,
                    u.DisplayName,
                    u.Email,
                    aa.AssignedBy,
                    aa.AssignedAt
                FROM WeeklySchedule_AgentAssignments aa
                JOIN Users u ON aa.UserId = u.Id
                WHERE aa.ShiftId = @shiftId AND aa.IsActive = 1
                ORDER BY u.DisplayName
            `);
        await pool.close();
        res.json(result.recordset || []);
    } catch (err) {
        console.error('Error fetching shift agents:', err);
        res.json([]); // Return empty array instead of 500
    }
});

// Assign agent to shift
router.post('/api/shifts/:shiftId/agents', async (req, res) => {
    const { shiftId } = req.params;
    const { userId } = req.body;
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Check if already assigned
        const existing = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT Id FROM WeeklySchedule_AgentAssignments 
                WHERE ShiftId = @shiftId AND UserId = @userId AND IsActive = 1
            `);
        
        if (existing.recordset.length > 0) {
            await pool.close();
            return res.status(400).json({ error: 'User already assigned to this shift' });
        }
        
        // Check if was previously assigned (reactivate)
        const inactive = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT Id FROM WeeklySchedule_AgentAssignments 
                WHERE ShiftId = @shiftId AND UserId = @userId AND IsActive = 0
            `);
        
        if (inactive.recordset.length > 0) {
            await pool.request()
                .input('id', sql.Int, inactive.recordset[0].Id)
                .input('assignedBy', sql.NVarChar, user?.displayName || 'System')
                .query(`
                    UPDATE WeeklySchedule_AgentAssignments 
                    SET IsActive = 1, AssignedBy = @assignedBy, AssignedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            await pool.request()
                .input('shiftId', sql.Int, shiftId)
                .input('userId', sql.Int, userId)
                .input('assignedBy', sql.NVarChar, user?.displayName || 'System')
                .query(`
                    INSERT INTO WeeklySchedule_AgentAssignments (ShiftId, UserId, AssignedBy)
                    VALUES (@shiftId, @userId, @assignedBy)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error assigning agent:', err);
        res.status(500).json({ error: err.message });
    }
});

// Remove agent from shift
router.delete('/api/shifts/:shiftId/agents/:assignmentId', async (req, res) => {
    const { assignmentId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, assignmentId)
            .query(`UPDATE WeeklySchedule_AgentAssignments SET IsActive = 0 WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error removing agent:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
