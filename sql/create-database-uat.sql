-- =====================================================
-- Operational Excellence App - UAT Database Setup
-- Database: OEApp_UAT
-- Environment: UAT (https://oeapp-uat.gmrlapps.com)
-- =====================================================

USE master;
GO

-- Create UAT Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'OEApp_UAT')
BEGIN
    CREATE DATABASE OEApp_UAT;
    PRINT 'Database OEApp_UAT created successfully';
END
ELSE
BEGIN
    PRINT 'Database OEApp_UAT already exists';
END
GO

USE OEApp_UAT;
GO

-- =====================================================
-- Role Categories Table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RoleCategories')
BEGIN
    CREATE TABLE RoleCategories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryName NVARCHAR(100) NOT NULL UNIQUE,
        Description NVARCHAR(500),
        AccessLevel NVARCHAR(MAX),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert role categories
    INSERT INTO RoleCategories (CategoryName, Description, AccessLevel) VALUES 
        ('Store-Level Users', 'Store operations personnel', 'Submit issues, receive audit reports, upload action plans, request staffing, track cases, submit schedules and attendances'),
        ('Operational Excellence', 'OE inspection and compliance team', 'Conduct audits, report findings, track action plans, generate performance reports, create calendars'),
        ('Third-Party Services', 'Third-party service management', 'Manage service providers, assign inspections, monitor performance, track cases'),
        ('Facilities Management', 'Facilities and maintenance oversight', 'Report complaints, receive requests, generate reports, track cases, request staffing'),
        ('Security', 'Security operations and compliance', 'Manage incidents (reporting, follow up, filing), conduct inspections, follow up on corrective actions'),
        ('Maintenance', 'Maintenance operations', 'Receive and resolve maintenance complaints, update status'),
        ('Occupational Health Safety', 'OHS compliance and safety', 'Manage incidents (reporting, follow up, filing), inspections, preventive measures'),
        ('HR & Talent', 'Human resources and employee relations', 'Receive complaints, initiate investigations, handle employee-related complaints, disciplinary actions'),
        ('Executives', 'Executive leadership', 'View dashboards, approve reports, access analytics'),
        ('External Service Providers', 'External vendors and contractors', 'Receive notifications, set schedules, dashboard for related complaints'),
        ('System Admin', 'System administration', 'Full system access, user management, configuration');
    
    PRINT 'RoleCategories table created';
END
GO

-- =====================================================
-- User Roles Table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
BEGIN
    CREATE TABLE UserRoles (
        Id INT PRIMARY KEY IDENTITY(1,1),
        RoleName NVARCHAR(100) NOT NULL UNIQUE,
        CategoryId INT FOREIGN KEY REFERENCES RoleCategories(Id),
        Description NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert roles by category
    
    -- Store-Level Users (CategoryId = 1)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Area Manager', 1, 'Oversees multiple store locations'),
        ('Store Manager', 1, 'Manages individual store operations'),
        ('Duty Manager', 1, 'Manages store during assigned shifts'),
        ('Personnel Supervisor', 1, 'Supervises store personnel');
    
    -- Operational Excellence (CategoryId = 2)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Senior Inspector', 2, 'Senior OE inspection role'),
        ('Inspector', 2, 'Conducts OE inspections'),
        ('Implementation Inspector', 2, 'Oversees implementation compliance');
    
    -- Third-Party Services (CategoryId = 3)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Senior Coordinator', 3, 'Senior third-party services coordinator'),
        ('Compliance Inspector', 3, 'Third-party compliance inspector'),
        ('Payroll Officer', 3, 'Manages third-party payroll');
    
    -- Facilities Management (CategoryId = 4)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Facility Services Supervisor', 4, 'Supervises facility services');
    
    -- Security (CategoryId = 5)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Program Lead', 5, 'Leads security programs'),
        ('Regional Security Manager', 5, 'Manages regional security operations'),
        ('Security Compliance Inspector', 5, 'Security compliance inspections');
    
    -- Maintenance (CategoryId = 6)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Head of Maintenance', 6, 'Leads maintenance department'),
        ('Assistant Head of Maintenance', 6, 'Assists head of maintenance');
    
    -- Occupational Health Safety (CategoryId = 7)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('OHS Manager', 7, 'Manages OHS department'),
        ('OHS Officer', 7, 'OHS compliance officer');
    
    -- HR & Talent (CategoryId = 8)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('HR Officer', 8, 'Human resources officer'),
        ('Employee Relations Officer', 8, 'Handles employee relations');
    
    -- Executives (CategoryId = 9)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Chief People & Support Officer', 9, 'Executive - People & Support'),
        ('Head of Talent Management', 9, 'Executive - Talent Management'),
        ('Head of Operational Excellence', 9, 'Executive - Operational Excellence'),
        ('Head of Operational Assurance and Support', 9, 'Executive - Operational Assurance'),
        ('Lead Support and Execution Coordinator', 9, 'Executive - Support Coordination'),
        ('Head of Operations', 9, 'Executive - Operations');
    
    -- External Service Providers (CategoryId = 10)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('Cleaning Service Provider', 10, 'External cleaning company'),
        ('Security Service Provider', 10, 'External security company'),
        ('Valet Service Provider', 10, 'External valet company'),
        ('Other Service Provider', 10, 'Other external service provider');
    
    -- System Admin (CategoryId = 11)
    INSERT INTO UserRoles (RoleName, CategoryId, Description) VALUES 
        ('System Administrator', 11, 'Full system access');
    
    PRINT 'UserRoles table created with all roles';
END
GO

-- =====================================================
-- Users Table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Email NVARCHAR(255) NOT NULL UNIQUE,
        DisplayName NVARCHAR(255),
        AzureOid NVARCHAR(255),
        RoleId INT FOREIGN KEY REFERENCES UserRoles(Id) DEFAULT 2,
        IsApproved BIT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        LastLoginAt DATETIME2,
        UpdatedAt DATETIME2
    );
    
    CREATE INDEX IX_Users_Email ON Users(Email);
    CREATE INDEX IX_Users_AzureOid ON Users(AzureOid);
    
    PRINT 'Users table created';
END
GO

-- =====================================================
-- Sessions Table
-- =====================================================
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

-- =====================================================
-- Operational Excellence Specific Tables
-- =====================================================

-- Categories Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_Categories')
BEGIN
    CREATE TABLE OE_Categories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        CategoryName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        CreatedBy INT FOREIGN KEY REFERENCES Users(Id),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    PRINT 'OE_Categories table created';
END
GO

-- Initiatives Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_Initiatives')
BEGIN
    CREATE TABLE OE_Initiatives (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        CategoryId INT FOREIGN KEY REFERENCES OE_Categories(Id),
        Status NVARCHAR(50) DEFAULT 'Draft',
        Priority NVARCHAR(20) DEFAULT 'Medium',
        StartDate DATE,
        TargetDate DATE,
        CompletedDate DATE,
        OwnerId INT FOREIGN KEY REFERENCES Users(Id),
        CreatedBy INT FOREIGN KEY REFERENCES Users(Id),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    CREATE INDEX IX_OE_Initiatives_Status ON OE_Initiatives(Status);
    CREATE INDEX IX_OE_Initiatives_CategoryId ON OE_Initiatives(CategoryId);
    
    PRINT 'OE_Initiatives table created';
END
GO

-- Action Items Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_ActionItems')
BEGIN
    CREATE TABLE OE_ActionItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InitiativeId INT FOREIGN KEY REFERENCES OE_Initiatives(Id),
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Status NVARCHAR(50) DEFAULT 'Open',
        AssignedTo INT FOREIGN KEY REFERENCES Users(Id),
        DueDate DATE,
        CompletedDate DATE,
        CreatedBy INT FOREIGN KEY REFERENCES Users(Id),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    CREATE INDEX IX_OE_ActionItems_InitiativeId ON OE_ActionItems(InitiativeId);
    CREATE INDEX IX_OE_ActionItems_Status ON OE_ActionItems(Status);
    
    PRINT 'OE_ActionItems table created';
END
GO

PRINT '';
PRINT '=====================================================';
PRINT '  OEApp_UAT Database Setup Complete!';
PRINT '  Environment: UAT';
PRINT '  URL: https://oeapp-uat.gmrlapps.com';
PRINT '=====================================================';
