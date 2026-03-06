-- Lost and Found Items Table
-- Created for tracking lost and found items at stores

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LostAndFoundItems' AND xtype='U')
BEGIN
    CREATE TABLE LostAndFoundItems (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ItemDate DATE NOT NULL,
        StoreId INT NOT NULL,
        ItemName NVARCHAR(200) NOT NULL,
        ItemType NVARCHAR(20) NOT NULL, -- 'Cash' or 'Non-Cash'
        Currency NVARCHAR(10) NULL, -- Only for Cash type: USD, LBP, EUR, GBP, Other
        Amount DECIMAL(18,2) NULL, -- Only for Cash type
        Quantity INT DEFAULT 1,
        Description NVARCHAR(MAX) NULL,
        ItemPicture NVARCHAR(500) NULL, -- Filename of uploaded image
        ReturnedToOwner BIT DEFAULT 0,
        ReturnDescription NVARCHAR(MAX) NULL, -- Details about return (only if ReturnedToOwner = 1)
        CreatedBy NVARCHAR(200) NOT NULL,
        UserId INT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        CONSTRAINT FK_LostAndFound_Store FOREIGN KEY (StoreId) REFERENCES Stores(Id)
    );
    
    -- Create indexes for common queries
    CREATE INDEX IX_LostAndFound_StoreId ON LostAndFoundItems(StoreId);
    CREATE INDEX IX_LostAndFound_ItemDate ON LostAndFoundItems(ItemDate);
    CREATE INDEX IX_LostAndFound_ItemType ON LostAndFoundItems(ItemType);
    CREATE INDEX IX_LostAndFound_ReturnedToOwner ON LostAndFoundItems(ReturnedToOwner);
    
    PRINT 'LostAndFoundItems table created successfully';
END
ELSE
BEGIN
    PRINT 'LostAndFoundItems table already exists';
END
GO

-- Add to Forms registry if not exists
IF NOT EXISTS (SELECT * FROM Forms WHERE FormCode = 'STORES_LOST_AND_FOUND')
BEGIN
    INSERT INTO Forms (FormCode, FormName, Description, Department, Route, IconClass, IsActive, SortOrder, CreatedAt)
    VALUES ('STORES_LOST_AND_FOUND', 'Lost and Found', 'Log lost and found items with return tracking', 'Stores', '/stores/lost-and-found', 'fa-search', 1, 90, GETDATE());
    PRINT 'Lost and Found form added to Forms registry';
END
GO
