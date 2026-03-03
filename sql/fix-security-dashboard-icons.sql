-- Fix Security Department Dashboard Icons and add Post Visit Report
-- Run on both UAT and Live databases

-- Fix Legal Cases icon
UPDATE Forms SET DashboardIcon = N'⚖️' WHERE FormCode = 'SECURITY_LEGAL_CASES';

-- Fix Blacklist icon
UPDATE Forms SET DashboardIcon = N'🚫' WHERE FormCode = 'SECURITY_BLACKLIST';

-- Fix Daily Reporting icon  
UPDATE Forms SET DashboardIcon = N'📝' WHERE FormCode = 'SECURITY_DAILY_REPORTING';

-- Fix Visit Calendar icon
UPDATE Forms SET DashboardIcon = N'📅' WHERE FormCode = 'SECURITY_VISIT_CALENDAR';

-- Fix Camera Request icon
UPDATE Forms SET DashboardIcon = N'📹' WHERE FormCode = 'SECURITY_CAMERA_REQUEST';

-- Fix Post Visit Report icon (use clipboard with checkmark)
UPDATE Forms SET DashboardIcon = N'📝' WHERE FormCode = 'SECURITY_POST_VISIT_REPORT';

-- Actually let's use unique icons:
-- Legal Cases: ⚖️ (scales)
-- Blacklist: 🚫 (no entry)
-- Daily Reporting: 📋 (clipboard)
-- Visit Calendar: 📅 (calendar)
-- Camera Request: 📹 (video camera)
-- Post Visit Report: 🔍 (magnifying glass - for inspection/visit)

UPDATE Forms SET DashboardIcon = N'🔍' WHERE FormCode = 'SECURITY_POST_VISIT_REPORT';

PRINT 'Security Department dashboard icons updated!';

-- Show current state
SELECT FormCode, DashboardTitle, DashboardIcon, DashboardSortOrder 
FROM Forms 
WHERE DashboardCategory = 'Security Department' 
ORDER BY DashboardSortOrder;
