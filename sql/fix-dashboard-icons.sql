-- Fix Dashboard Icons with proper Unicode
-- Run with: sqlcmd -S localhost -d OEApp_Live -U sa -P password -i fix-dashboard-icons.sql -C

UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCCA), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDCCA) WHERE MenuId = 'oe';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDD0D), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDCCA) WHERE MenuId = 'oe-inspection';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCCA), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDCCA) WHERE MenuId = 'master-table';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCC5), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDCCA) WHERE MenuId = 'store-visit-calendar';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83E) + NCHAR(0xDDFA), DashboardCategoryIcon = NCHAR(0xD83E) + NCHAR(0xDDFA) WHERE MenuId = 'ohs';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDEE1), DashboardCategoryIcon = NCHAR(0xD83E) + NCHAR(0xDDFA) WHERE MenuId = 'ohs-inspection';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83E) + NCHAR(0xDDEF), DashboardCategoryIcon = NCHAR(0xD83E) + NCHAR(0xDDFA) WHERE MenuId = 'fire-equipment';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCCB), DashboardCategoryIcon = NCHAR(0xD83E) + NCHAR(0xDDFA) WHERE MenuId = 'ora';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83C) + NCHAR(0xDFE2), DashboardCategoryIcon = NCHAR(0xD83C) + NCHAR(0xDFE2) WHERE MenuId = 'security-services';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDD27), DashboardCategoryIcon = NCHAR(0xD83C) + NCHAR(0xDFE2) WHERE MenuId = 'security';
UPDATE Forms SET DashboardIcon = NCHAR(0x2696), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDD12) WHERE MenuId = 'legal-cases';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDEAB), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDD12) WHERE MenuId = 'thirdparty-blacklist';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCCB), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDD12) WHERE MenuId = 'security-daily-reporting';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCC5), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDD12) WHERE MenuId = 'sec-visit-calendar';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCF9), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDD12) WHERE MenuId = 'camera-request';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83C) + NCHAR(0xDFEA), DashboardCategoryIcon = NCHAR(0xD83C) + NCHAR(0xDFEA) WHERE MenuId = 'stores';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDC64), DashboardCategoryIcon = NCHAR(0xD83C) + NCHAR(0xDFEA) WHERE MenuId = 'personnel';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83E) + NCHAR(0xDD1D), DashboardCategoryIcon = NCHAR(0xD83C) + NCHAR(0xDFEA) WHERE MenuId = 'thirdparty';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDC77), DashboardCategoryIcon = NCHAR(0xD83C) + NCHAR(0xDF7D) WHERE MenuId = 'maknezi-fnb';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDC65), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDC65) WHERE MenuId = 'hr';
UPDATE Forms SET DashboardIcon = NCHAR(0xD83D) + NCHAR(0xDCE2), DashboardCategoryIcon = NCHAR(0xD83D) + NCHAR(0xDCE2) WHERE MenuId = 'broadcast';

PRINT 'Icons updated with Unicode values';
