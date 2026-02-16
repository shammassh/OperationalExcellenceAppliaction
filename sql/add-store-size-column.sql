-- Add StoreSize column to Stores table
-- This column will be used to define store size (Large or Medium) for quantity calculations in template builder

-- Check if column already exists before adding
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Stores' AND COLUMN_NAME = 'StoreSize'
)
BEGIN
    ALTER TABLE Stores ADD StoreSize NVARCHAR(20) NULL;
    PRINT 'StoreSize column added successfully';
END
ELSE
BEGIN
    PRINT 'StoreSize column already exists';
END
GO

-- Optional: Update existing stores with default value (you can customize this)
-- UPDATE Stores SET StoreSize = 'Medium' WHERE StoreSize IS NULL;
