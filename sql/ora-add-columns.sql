-- ==========================================
-- Add new columns to ORAAssessmentRisks for Excel-style worksheet
-- Run this on both UAT and Live databases
-- ==========================================

-- Add HazardDescription column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ORAAssessmentRisks') AND name = 'HazardDescription')
BEGIN
    ALTER TABLE ORAAssessmentRisks ADD HazardDescription NVARCHAR(500) NULL;
    PRINT 'HazardDescription column added';
END
GO

-- Add ActivityTaskProcess column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ORAAssessmentRisks') AND name = 'ActivityTaskProcess')
BEGIN
    ALTER TABLE ORAAssessmentRisks ADD ActivityTaskProcess NVARCHAR(500) NULL;
    PRINT 'ActivityTaskProcess column added';
END
GO

-- Add InjuryDescription column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ORAAssessmentRisks') AND name = 'InjuryDescription')
BEGIN
    ALTER TABLE ORAAssessmentRisks ADD InjuryDescription NVARCHAR(500) NULL;
    PRINT 'InjuryDescription column added';
END
GO

-- Add ExistingControls column (consolidated)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ORAAssessmentRisks') AND name = 'ExistingControls')
BEGIN
    ALTER TABLE ORAAssessmentRisks ADD ExistingControls NVARCHAR(MAX) NULL;
    PRINT 'ExistingControls column added';
END
GO

-- Add AdditionalControls column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ORAAssessmentRisks') AND name = 'AdditionalControls')
BEGIN
    ALTER TABLE ORAAssessmentRisks ADD AdditionalControls NVARCHAR(MAX) NULL;
    PRINT 'AdditionalControls column added';
END
GO

PRINT 'ORA Assessment Risks table updated with new columns';
