-- Migration script to add file storage columns to OE_InspectionPictures table
-- This migration supports the transition from base64 BLOB storage to file system storage
-- Run this on both OEApp_UAT and OEApp_Live databases

-- Add FilePath column (stores the URL path to the file)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionPictures') AND name = 'FilePath')
BEGIN
    ALTER TABLE OE_InspectionPictures ADD FilePath NVARCHAR(500) NULL;
    PRINT 'Added FilePath column to OE_InspectionPictures';
END
GO

-- Add OriginalName column (stores the original filename before renaming)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionPictures') AND name = 'OriginalName')
BEGIN
    ALTER TABLE OE_InspectionPictures ADD OriginalName NVARCHAR(255) NULL;
    PRINT 'Added OriginalName column to OE_InspectionPictures';
END
GO

-- Add FileSize column (stores the file size in bytes)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionPictures') AND name = 'FileSize')
BEGIN
    ALTER TABLE OE_InspectionPictures ADD FileSize BIGINT NULL;
    PRINT 'Added FileSize column to OE_InspectionPictures';
END
GO

-- Create index on FilePath for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OE_InspectionPictures_FilePath')
BEGIN
    CREATE INDEX IX_OE_InspectionPictures_FilePath ON OE_InspectionPictures(FilePath);
    PRINT 'Created index IX_OE_InspectionPictures_FilePath';
END
GO

PRINT 'OE_InspectionPictures migration completed successfully';
PRINT 'Note: Existing FileData (base64) column is preserved for backward compatibility';
PRINT 'New uploads will use FilePath, OriginalName, and FileSize columns';
GO
