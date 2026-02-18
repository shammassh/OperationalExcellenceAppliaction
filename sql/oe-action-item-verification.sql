-- OE Action Item Verification Table
-- This table stores verification records from Implementation Inspectors

-- Check if table exists and create if not
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OE_ActionItemVerification')
BEGIN
    CREATE TABLE OE_ActionItemVerification (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ActionItemId INT NOT NULL,
        InspectionId INT NOT NULL,
        VerifiedBy INT NOT NULL,
        VerificationStatus NVARCHAR(50) NOT NULL, -- 'Verified Complete', 'Verified Not Complete'
        VerificationNotes NVARCHAR(1000) NULL,
        VerificationPictureUrl NVARCHAR(500) NULL,
        VerifiedAt DATETIME NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (ActionItemId) REFERENCES OE_InspectionActionItems(Id),
        FOREIGN KEY (InspectionId) REFERENCES OE_Inspections(Id),
        FOREIGN KEY (VerifiedBy) REFERENCES Users(Id)
    );

    CREATE INDEX IX_OE_ActionItemVerification_ActionItemId ON OE_ActionItemVerification(ActionItemId);
    CREATE INDEX IX_OE_ActionItemVerification_InspectionId ON OE_ActionItemVerification(InspectionId);
    CREATE INDEX IX_OE_ActionItemVerification_VerifiedBy ON OE_ActionItemVerification(VerifiedBy);
    CREATE INDEX IX_OE_ActionItemVerification_Status ON OE_ActionItemVerification(VerificationStatus);

    PRINT 'OE_ActionItemVerification table created successfully';
END
ELSE
BEGIN
    PRINT 'OE_ActionItemVerification table already exists';
END
GO
