-- GMRL Auth Tables
-- Run this script to create the required tables for authentication

-- User Roles Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
BEGIN
    CREATE TABLE UserRoles (
        Id INT PRIMARY KEY IDENTITY(1,1),
        RoleName NVARCHAR(50) NOT NULL UNIQUE,
        Description NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert default roles
    INSERT INTO UserRoles (RoleName, Description) VALUES 
        ('Admin', 'Full system access'),
        ('User', 'Standard user access'),
        ('Manager', 'Manager level access'),
        ('Viewer', 'Read-only access');
    
    PRINT 'UserRoles table created with default roles';
END
GO

-- Users Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Email NVARCHAR(255) NOT NULL UNIQUE,
        DisplayName NVARCHAR(255),
        AzureOid NVARCHAR(255),
        RoleId INT FOREIGN KEY REFERENCES UserRoles(Id) DEFAULT 2, -- Default: User
        IsApproved BIT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        LastLoginAt DATETIME2,
        UpdatedAt DATETIME2
    );
    
    PRINT 'Users table created';
END
GO

-- Sessions Table (for persistent sessions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sessions')
BEGIN
    CREATE TABLE Sessions (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SessionId NVARCHAR(255) NOT NULL UNIQUE,
        UserId INT FOREIGN KEY REFERENCES Users(Id),
        Token NVARCHAR(MAX),
        ExpiresAt DATETIME2,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_Sessions_SessionId ON Sessions(SessionId);
    CREATE INDEX IX_Sessions_ExpiresAt ON Sessions(ExpiresAt);
    
    PRINT 'Sessions table created';
END
GO

-- Add your first admin user (change email!)
-- INSERT INTO Users (Email, DisplayName, RoleId, IsApproved, IsActive)
-- VALUES ('your.email@gmrlgroup.com', 'Your Name', 1, 1, 1);

PRINT 'Auth tables setup complete!';
