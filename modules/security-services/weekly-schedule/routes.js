/**
 * Weekly Cleaning Schedule - User Form Routes
 * Cleaners fill out weekly schedules by shift
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

// Main form page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'fill-form.html'));
});

// History page
router.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'history.html'));
});

// =============================================
// API ENDPOINTS
// =============================================

// Get shifts assigned to current user
router.get('/api/my-shifts', async (req, res) => {
    const user = req.currentUser;
    
    if (!user || !user.id) {
        return res.json([]);
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('userId', sql.Int, user.id)
            .query(`
                SELECT 
                    s.Id AS ShiftId,
                    s.ShiftName,
                    s.ShiftDescription,
                    s.StartTime,
                    s.EndTime
                FROM WeeklySchedule_AgentAssignments aa
                JOIN WeeklySchedule_Shifts s ON aa.ShiftId = s.Id
                WHERE aa.UserId = @userId AND aa.IsActive = 1 AND s.IsActive = 1
                ORDER BY s.SortOrder
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching user shifts:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all shifts (for viewing)
router.get('/api/shifts', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT Id AS ShiftId, ShiftName, ShiftDescription, StartTime, EndTime
            FROM WeeklySchedule_Shifts
            WHERE IsActive = 1
            ORDER BY ISNULL(SortOrder, 0), Id
        `);
        await pool.close();
        res.json(result.recordset || []);
    } catch (err) {
        console.error('Error fetching shifts:', err);
        res.json([]); // Return empty array instead of 500 error
    }
});

// Get form structure for a shift (time slots)
router.get('/api/form/:shiftId', async (req, res) => {
    const { shiftId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get shift info
        const shiftResult = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .query(`
                SELECT Id, ShiftName, ShiftDescription, StartTime, EndTime
                FROM WeeklySchedule_Shifts
                WHERE Id = @shiftId AND IsActive = 1
            `);
        
        if (shiftResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ error: 'Shift not found' });
        }
        
        // Get time slots
        const slotsResult = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .query(`
                SELECT Id, SlotName, StartTime, EndTime, TaskDescription, IsBreak, SortOrder
                FROM WeeklySchedule_TimeSlots
                WHERE ShiftId = @shiftId AND IsActive = 1
                ORDER BY SortOrder
            `);
        
        await pool.close();
        
        res.json({
            shift: shiftResult.recordset[0],
            timeSlots: slotsResult.recordset
        });
    } catch (err) {
        console.error('Error fetching form structure:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get entry for a shift/month (with details)
router.get('/api/entry/:shiftId/:year/:month', async (req, res) => {
    const { shiftId, year, month } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get entry
        const entryResult = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .input('year', sql.Int, year)
            .input('month', sql.Int, month)
            .query(`
                SELECT Id, ShiftId, Year, Month, Status, CreatedByName, CreatedAt, UpdatedAt
                FROM WeeklySchedule_Entries
                WHERE ShiftId = @shiftId AND Year = @year AND Month = @month AND Status = 'Active'
            `);
        
        if (entryResult.recordset.length === 0) {
            await pool.close();
            return res.json({ entry: null, details: [] });
        }
        
        const entry = entryResult.recordset[0];
        
        // Get details
        const detailsResult = await pool.request()
            .input('entryId', sql.Int, entry.Id)
            .query(`
                SELECT 
                    ed.Id,
                    ed.TimeSlotId,
                    ed.WeekNumber,
                    ed.DayOfWeek,
                    ed.IsCompleted,
                    ed.CompletedByName,
                    ed.CompletedAt,
                    ed.Notes
                FROM WeeklySchedule_EntryDetails ed
                WHERE ed.EntryId = @entryId
            `);
        
        await pool.close();
        
        res.json({
            entry,
            details: detailsResult.recordset
        });
    } catch (err) {
        console.error('Error fetching entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save entry for a shift/month
router.post('/api/entry/:shiftId/:year/:month', async (req, res) => {
    const { shiftId, year, month } = req.params;
    const { details } = req.body; // Array of { timeSlotId, weekNumber, dayOfWeek, isCompleted, notes }
    const user = req.currentUser;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get or create entry
        let entryResult = await pool.request()
            .input('shiftId', sql.Int, shiftId)
            .input('year', sql.Int, year)
            .input('month', sql.Int, month)
            .query(`
                SELECT Id FROM WeeklySchedule_Entries
                WHERE ShiftId = @shiftId AND Year = @year AND Month = @month AND Status = 'Active'
            `);
        
        let entryId;
        
        if (entryResult.recordset.length === 0) {
            // Create new entry
            const insertResult = await pool.request()
                .input('shiftId', sql.Int, shiftId)
                .input('year', sql.Int, year)
                .input('month', sql.Int, month)
                .input('createdById', sql.Int, user?.id || null)
                .input('createdByName', sql.NVarChar, user?.displayName || 'Unknown')
                .query(`
                    INSERT INTO WeeklySchedule_Entries (ShiftId, Year, Month, CreatedById, CreatedByName)
                    OUTPUT INSERTED.Id
                    VALUES (@shiftId, @year, @month, @createdById, @createdByName)
                `);
            entryId = insertResult.recordset[0].Id;
        } else {
            entryId = entryResult.recordset[0].Id;
            // Update timestamp
            await pool.request()
                .input('entryId', sql.Int, entryId)
                .query(`UPDATE WeeklySchedule_Entries SET UpdatedAt = GETDATE() WHERE Id = @entryId`);
        }
        
        // Upsert details
        for (const detail of details) {
            await pool.request()
                .input('entryId', sql.Int, entryId)
                .input('timeSlotId', sql.Int, detail.timeSlotId)
                .input('weekNumber', sql.Int, detail.weekNumber)
                .input('dayOfWeek', sql.Int, detail.dayOfWeek)
                .input('isCompleted', sql.Bit, detail.isCompleted)
                .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || 'Unknown') : null)
                .input('completedAt', sql.DateTime, detail.isCompleted ? new Date() : null)
                .input('notes', sql.NVarChar, detail.notes || null)
                .query(`
                    MERGE WeeklySchedule_EntryDetails AS target
                    USING (SELECT @entryId AS EntryId, @timeSlotId AS TimeSlotId, @weekNumber AS WeekNumber, @dayOfWeek AS DayOfWeek) AS source
                    ON target.EntryId = source.EntryId 
                       AND target.TimeSlotId = source.TimeSlotId 
                       AND target.WeekNumber = source.WeekNumber 
                       AND target.DayOfWeek = source.DayOfWeek
                    WHEN MATCHED THEN
                        UPDATE SET 
                            IsCompleted = @isCompleted,
                            CompletedById = CASE WHEN @isCompleted = 1 THEN @completedById ELSE CompletedById END,
                            CompletedByName = CASE WHEN @isCompleted = 1 THEN @completedByName ELSE CompletedByName END,
                            CompletedAt = CASE WHEN @isCompleted = 1 THEN @completedAt ELSE CompletedAt END,
                            Notes = @notes,
                            UpdatedAt = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (EntryId, TimeSlotId, WeekNumber, DayOfWeek, IsCompleted, CompletedById, CompletedByName, CompletedAt, Notes)
                        VALUES (@entryId, @timeSlotId, @weekNumber, @dayOfWeek, @isCompleted, @completedById, @completedByName, @completedAt, @notes);
                `);
        }
        
        await pool.close();
        res.json({ success: true, entryId });
    } catch (err) {
        console.error('Error saving entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get entries history (grouped by shift/month)
router.get('/api/entries', async (req, res) => {
    const { shiftId, year, month } = req.query;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        let whereClause = "e.Status = 'Active'";
        const request = pool.request();
        
        if (shiftId) {
            whereClause += ' AND e.ShiftId = @shiftId';
            request.input('shiftId', sql.Int, shiftId);
        }
        if (year) {
            whereClause += ' AND e.Year = @year';
            request.input('year', sql.Int, year);
        }
        if (month) {
            whereClause += ' AND e.Month = @month';
            request.input('month', sql.Int, month);
        }
        
        const result = await request.query(`
            SELECT 
                e.Id,
                e.ShiftId,
                s.ShiftName,
                e.Year,
                e.Month,
                e.CreatedByName,
                e.CreatedAt,
                e.UpdatedAt,
                (SELECT COUNT(*) FROM WeeklySchedule_EntryDetails WHERE EntryId = e.Id AND IsCompleted = 1) AS CompletedCount,
                (SELECT COUNT(*) FROM WeeklySchedule_EntryDetails WHERE EntryId = e.Id) AS TotalCount,
                (
                    SELECT COUNT(*) * 5 * 4 
                    FROM WeeklySchedule_TimeSlots 
                    WHERE ShiftId = e.ShiftId AND IsActive = 1
                ) AS ExpectedCount,
                (SELECT COUNT(*) FROM WeeklySchedule_EntryDetails WHERE EntryId = e.Id AND WeekNumber = 1 AND IsCompleted = 1) AS Week1Done,
                (SELECT COUNT(*) FROM WeeklySchedule_EntryDetails WHERE EntryId = e.Id AND WeekNumber = 2 AND IsCompleted = 1) AS Week2Done,
                (SELECT COUNT(*) FROM WeeklySchedule_EntryDetails WHERE EntryId = e.Id AND WeekNumber = 3 AND IsCompleted = 1) AS Week3Done,
                (SELECT COUNT(*) FROM WeeklySchedule_EntryDetails WHERE EntryId = e.Id AND WeekNumber = 4 AND IsCompleted = 1) AS Week4Done,
                (SELECT COUNT(*) * 5 FROM WeeklySchedule_TimeSlots WHERE ShiftId = e.ShiftId AND IsActive = 1) AS WeekExpected
            FROM WeeklySchedule_Entries e
            JOIN WeeklySchedule_Shifts s ON e.ShiftId = s.Id
            WHERE ${whereClause}
            ORDER BY e.Year DESC, e.Month DESC, s.SortOrder
        `);
        
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching entries:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get current user info
router.get('/api/current-user', (req, res) => {
    const user = req.currentUser;
    res.json({
        id: user?.id,
        displayName: user?.displayName,
        email: user?.email,
        role: user?.role
    });
});

// Get available months (current + prev 2)
router.get('/api/months', (req, res) => {
    const now = new Date();
    const months = [];
    
    for (let i = -2; i <= 1; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push({
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        });
    }
    
    res.json(months);
});

module.exports = router;
