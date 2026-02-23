-- =============================================
-- Weekly Cleaning Schedule Tables
-- 3 Shifts: Offices 7AM-4PM, Toilets/Kitchens 7AM-4PM, Toilets/Kitchens 4PM-7PM
-- Pre-seeded with task data
-- =============================================

-- Shifts table (3 shifts)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WeeklySchedule_Shifts')
BEGIN
    CREATE TABLE WeeklySchedule_Shifts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ShiftName NVARCHAR(100) NOT NULL,
        ShiftDescription NVARCHAR(255),
        StartTime TIME NOT NULL,
        EndTime TIME NOT NULL,
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- Time Slots table (time periods within each shift)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WeeklySchedule_TimeSlots')
BEGIN
    CREATE TABLE WeeklySchedule_TimeSlots (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ShiftId INT NOT NULL FOREIGN KEY REFERENCES WeeklySchedule_Shifts(Id),
        SlotName NVARCHAR(50) NOT NULL,          -- e.g., "7 AM To 7:20 AM"
        StartTime TIME NOT NULL,
        EndTime TIME NOT NULL,
        TaskDescription NVARCHAR(255) NOT NULL,   -- e.g., "Parking and Entrance"
        IsBreak BIT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- Agent Assignments (many cleaners per shift)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WeeklySchedule_AgentAssignments')
BEGIN
    CREATE TABLE WeeklySchedule_AgentAssignments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ShiftId INT NOT NULL FOREIGN KEY REFERENCES WeeklySchedule_Shifts(Id),
        UserId INT NOT NULL,
        AssignedBy NVARCHAR(100),
        AssignedAt DATETIME DEFAULT GETDATE(),
        IsActive BIT DEFAULT 1
    );
END
GO

-- Entries table (one entry per shift per month)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WeeklySchedule_Entries')
BEGIN
    CREATE TABLE WeeklySchedule_Entries (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ShiftId INT NOT NULL FOREIGN KEY REFERENCES WeeklySchedule_Shifts(Id),
        Year INT NOT NULL,
        Month INT NOT NULL,                       -- 1-12
        Status NVARCHAR(20) DEFAULT 'Active',     -- Active, Archived
        CreatedById INT,
        CreatedByName NVARCHAR(100),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_WeeklySchedule_Entry UNIQUE (ShiftId, Year, Month)
    );
END
GO

-- Entry Details (completion tracking per week/day/timeslot)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WeeklySchedule_EntryDetails')
BEGIN
    CREATE TABLE WeeklySchedule_EntryDetails (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EntryId INT NOT NULL FOREIGN KEY REFERENCES WeeklySchedule_Entries(Id),
        TimeSlotId INT NOT NULL FOREIGN KEY REFERENCES WeeklySchedule_TimeSlots(Id),
        WeekNumber INT NOT NULL,                  -- 1-4 (or 5 for months with 5 weeks)
        DayOfWeek INT NOT NULL,                   -- 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday
        IsCompleted BIT DEFAULT 0,
        CompletedById INT,
        CompletedByName NVARCHAR(100),
        CompletedAt DATETIME,
        Notes NVARCHAR(500),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_WeeklySchedule_Detail UNIQUE (EntryId, TimeSlotId, WeekNumber, DayOfWeek)
    );
END
GO

-- Create indexes for better query performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WeeklySchedule_TimeSlots_ShiftId')
    CREATE INDEX IX_WeeklySchedule_TimeSlots_ShiftId ON WeeklySchedule_TimeSlots(ShiftId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WeeklySchedule_AgentAssignments_ShiftId')
    CREATE INDEX IX_WeeklySchedule_AgentAssignments_ShiftId ON WeeklySchedule_AgentAssignments(ShiftId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WeeklySchedule_AgentAssignments_UserId')
    CREATE INDEX IX_WeeklySchedule_AgentAssignments_UserId ON WeeklySchedule_AgentAssignments(UserId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WeeklySchedule_Entries_ShiftId')
    CREATE INDEX IX_WeeklySchedule_Entries_ShiftId ON WeeklySchedule_Entries(ShiftId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WeeklySchedule_Entries_YearMonth')
    CREATE INDEX IX_WeeklySchedule_Entries_YearMonth ON WeeklySchedule_Entries(Year, Month);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WeeklySchedule_EntryDetails_EntryId')
    CREATE INDEX IX_WeeklySchedule_EntryDetails_EntryId ON WeeklySchedule_EntryDetails(EntryId);
GO

-- =============================================
-- SEED DATA: 3 Shifts with Time Slots and Tasks
-- =============================================

-- Clear existing seed data (for re-running)
DELETE FROM WeeklySchedule_EntryDetails;
DELETE FROM WeeklySchedule_Entries;
DELETE FROM WeeklySchedule_AgentAssignments;
DELETE FROM WeeklySchedule_TimeSlots;
DELETE FROM WeeklySchedule_Shifts;
GO

-- Reset identity columns
DBCC CHECKIDENT ('WeeklySchedule_Shifts', RESEED, 0);
DBCC CHECKIDENT ('WeeklySchedule_TimeSlots', RESEED, 0);
GO

-- Insert Shifts
INSERT INTO WeeklySchedule_Shifts (ShiftName, ShiftDescription, StartTime, EndTime, SortOrder) VALUES
('Offices 7AM-4PM', 'Office cleaning shift - daytime', '07:00', '16:00', 1),
('Toilets and Kitchens 7AM-4PM', 'Toilets and kitchens cleaning - daytime', '07:00', '16:00', 2),
('Toilets and Kitchens 4PM-7PM', 'Toilets and kitchens cleaning - evening', '16:00', '19:00', 3);
GO

-- Insert Time Slots for Shift 1: Offices 7AM-4PM
INSERT INTO WeeklySchedule_TimeSlots (ShiftId, SlotName, StartTime, EndTime, TaskDescription, IsBreak, SortOrder) VALUES
(1, '7 AM To 7:20 AM', '07:00', '07:20', 'Parking and Entrance', 0, 1),
(1, '7:20 AM To 12 PM', '07:20', '12:00', 'Offices', 0, 2),
(1, '12 PM To 1 PM', '12:00', '13:00', 'Break', 1, 3),
(1, '1 PM To 1:30 PM', '13:00', '13:30', 'Stairs', 0, 4),
(1, '1:30 PM To 1:50 PM', '13:30', '13:50', 'Parking and Entrance', 0, 5),
(1, '1:50 PM To 4 PM', '13:50', '16:00', 'Offices - Trashes', 0, 6);
GO

-- Insert Time Slots for Shift 2: Toilets and Kitchens 7AM-4PM
INSERT INTO WeeklySchedule_TimeSlots (ShiftId, SlotName, StartTime, EndTime, TaskDescription, IsBreak, SortOrder) VALUES
(2, '7 AM To 7:20 AM', '07:00', '07:20', 'Parking and Entrance', 0, 1),
(2, '7:20 AM To 12 PM', '07:20', '12:00', 'Toilet and Kitchen', 0, 2),
(2, '12 PM To 1 PM', '12:00', '13:00', 'Break', 1, 3),
(2, '1 PM To 1:30 PM', '13:00', '13:30', 'Stairs', 0, 4),
(2, '1:30 PM To 1:50 PM', '13:30', '13:50', 'Parking and Entrance', 0, 5),
(2, '1:50 PM To 4 PM', '13:50', '16:00', 'Toilet and Kitchen', 0, 6);
GO

-- Insert Time Slots for Shift 3: Toilets and Kitchens 4PM-7PM
INSERT INTO WeeklySchedule_TimeSlots (ShiftId, SlotName, StartTime, EndTime, TaskDescription, IsBreak, SortOrder) VALUES
(3, '4 PM To 5 PM', '16:00', '17:00', 'Offices', 0, 1),
(3, '5 PM To 6 PM', '17:00', '18:00', 'Kitchens - Toilets - Entrances', 0, 2),
(3, '6 PM To 7 PM', '18:00', '19:00', 'Napkins - Soap - Trashes', 0, 3);
GO

-- Verify seed data
SELECT 'Shifts' AS TableName, COUNT(*) AS RecordCount FROM WeeklySchedule_Shifts
UNION ALL
SELECT 'TimeSlots', COUNT(*) FROM WeeklySchedule_TimeSlots;
GO

-- Show shifts with their time slots
SELECT 
    s.Id AS ShiftId,
    s.ShiftName,
    s.StartTime AS ShiftStart,
    s.EndTime AS ShiftEnd,
    ts.SlotName,
    ts.TaskDescription,
    ts.IsBreak
FROM WeeklySchedule_Shifts s
JOIN WeeklySchedule_TimeSlots ts ON s.Id = ts.ShiftId
ORDER BY s.SortOrder, ts.SortOrder;
GO

PRINT 'Weekly Cleaning Schedule tables created and seeded successfully!';
GO
