-- Migration script: Convert OHS_InspectionPictures from BLOB to file storage
-- Run this on both OEApp_UAT and OEApp_Live databases
-- 
-- This adds new columns for file storage while keeping old FileData column
-- for backward compatibility with existing data

-- Add new columns if they don't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OHS_InspectionPictures' AND COLUMN_NAME = 'FilePath')
BEGIN
    ALTER TABLE OHS_InspectionPictures ADD FilePath NVARCHAR(500) NULL;
    PRINT 'Added FilePath column';
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OHS_InspectionPictures' AND COLUMN_NAME = 'OriginalName')
BEGIN
    ALTER TABLE OHS_InspectionPictures ADD OriginalName NVARCHAR(255) NULL;
    PRINT 'Added OriginalName column';
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OHS_InspectionPictures' AND COLUMN_NAME = 'FileSize')
BEGIN
    ALTER TABLE OHS_InspectionPictures ADD FileSize INT NULL;
    PRINT 'Added FileSize column';
END
GO

-- Note: The old FileData column is kept for backward compatibility
-- Once all existing pictures are migrated to file storage, you can remove it:
-- ALTER TABLE OHS_InspectionPictures DROP COLUMN FileData;

PRINT 'Migration complete - OHS_InspectionPictures table updated for file storage';
