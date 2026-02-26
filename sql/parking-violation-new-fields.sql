-- Add ViolatorName and CarPlateNumber fields to Security_ParkingViolations table
-- Run on both UAT and Live databases

-- Add ViolatorName column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Security_ParkingViolations') AND name = 'ViolatorName')
BEGIN
    ALTER TABLE Security_ParkingViolations ADD ViolatorName NVARCHAR(255) NULL;
    PRINT 'Added ViolatorName column';
END
ELSE
BEGIN
    PRINT 'ViolatorName column already exists';
END
GO

-- Add CarPlateNumber column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Security_ParkingViolations') AND name = 'CarPlateNumber')
BEGIN
    ALTER TABLE Security_ParkingViolations ADD CarPlateNumber NVARCHAR(50) NULL;
    PRINT 'Added CarPlateNumber column';
END
ELSE
BEGIN
    PRINT 'CarPlateNumber column already exists';
END
GO

PRINT 'Parking violation new fields migration complete';
