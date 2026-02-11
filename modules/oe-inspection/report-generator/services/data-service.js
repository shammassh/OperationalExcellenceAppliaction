/**
 * Data Service
 * Handles fetching audit data from SQL Server database
 */

const sql = require('mssql');

class DataService {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Set the database pool
     * @param {Object} pool - SQL connection pool
     */
    setPool(pool) {
        this.pool = pool;
    }

    /**
     * Get complete audit data by ID
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Complete audit data
     */
    async getAuditData(auditId) {
        try {
            console.log(`📊 Fetching audit data for ID: ${auditId}`);

            // Get audit header
            const auditResult = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT a.*, s.SchemaName, s.Description as SchemaDescription,
                           s.ReportTitle, s.DocumentPrefix, s.Edition, s.CreationDate, s.RevisionDate
                    FROM AuditInstances a
                    INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
                    WHERE a.AuditID = @AuditID
                `);

            if (auditResult.recordset.length === 0) {
                throw new Error(`Audit not found: ${auditId}`);
            }

            const audit = auditResult.recordset[0];
            console.log(`   ✅ Found audit: ${audit.DocumentNumber}`);

            return {
                auditId: audit.AuditID,
                documentNumber: audit.DocumentNumber,
                storeId: audit.StoreID,
                storeCode: audit.StoreCode,
                storeName: audit.StoreName,
                schemaId: audit.SchemaID,
                schemaName: audit.SchemaName,
                schemaDescription: audit.SchemaDescription,
                reportTitle: audit.ReportTitle || 'Food Safety Audit Report',
                documentPrefix: audit.DocumentPrefix || '',
                edition: audit.Edition || '',
                creationDate: audit.CreationDate,
                revisionDate: audit.RevisionDate,
                auditDate: audit.AuditDate,
                timeIn: audit.TimeIn,
                timeOut: audit.TimeOut,
                cycle: audit.Cycle,
                year: audit.Year,
                auditors: audit.Auditors,
                accompaniedBy: audit.AccompaniedBy,
                status: audit.Status,
                totalScore: audit.TotalScore,
                createdAt: audit.CreatedAt,
                completedAt: audit.CompletedAt
            };
        } catch (error) {
            console.error('❌ Error fetching audit data:', error);
            throw error;
        }
    }

    /**
     * Get section scores for an audit
     * @param {number} auditId - Audit ID
     * @returns {Promise<Array>} - Section scores
     */
    async getSectionScores(auditId) {
        try {
            console.log(`📈 Fetching section scores for audit: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT ss.*, s.SectionIcon
                    FROM AuditSectionScores ss
                    LEFT JOIN AuditSections s ON ss.SectionID = s.SectionID
                    WHERE ss.AuditID = @AuditID
                    ORDER BY ss.SectionNumber
                `);

            console.log(`   ✅ Found ${result.recordset.length} section scores`);

            return result.recordset.map(row => ({
                sectionId: row.SectionID,
                sectionNumber: row.SectionNumber,
                sectionName: row.SectionName,
                sectionIcon: row.SectionIcon,
                earnedScore: row.EarnedScore,
                maxScore: row.MaxScore,
                percentage: parseFloat((row.Percentage || 0).toFixed(2)),
                totalQuestions: row.TotalQuestions,
                answeredQuestions: row.AnsweredQuestions,
                naQuestions: row.NAQuestions
            }));
        } catch (error) {
            console.error('❌ Error fetching section scores:', error);
            throw error;
        }
    }

    /**
     * Get all responses for an audit grouped by section
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Responses grouped by section
     */
    async getAuditResponses(auditId) {
        try {
            console.log(`📝 Fetching audit responses for: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT r.*, s.SectionIcon
                    FROM AuditResponses r
                    LEFT JOIN AuditSections s ON r.SectionID = s.SectionID
                    WHERE r.AuditID = @AuditID
                    ORDER BY r.SectionNumber, r.ReferenceValue
                `);

            // Group by section
            const sections = {};
            for (const row of result.recordset) {
                const sectionId = row.SectionID;
                
                if (!sections[sectionId]) {
                    sections[sectionId] = {
                        sectionId: row.SectionID,
                        sectionNumber: row.SectionNumber,
                        sectionName: row.SectionName,
                        sectionIcon: row.SectionIcon,
                        items: []
                    };
                }

                sections[sectionId].items.push({
                    responseId: row.ResponseID,
                    itemId: row.ItemID,
                    referenceValue: row.ReferenceValue,
                    title: row.Title,
                    coeff: row.Coeff,
                    answerOptions: row.AnswerOptions,
                    cr: row.CR,
                    selectedChoice: row.SelectedChoice,
                    value: row.Value,
                    finding: row.Finding,
                    comment: row.Comment,
                    correctiveAction: row.CorrectiveAction,
                    priority: row.Priority,
                    hasPicture: row.HasPicture,
                    escalate: row.Escalate,
                    department: row.Department
                });
            }

            // Natural sort helper for reference values (1.1, 1.2, ... 1.10, 1.11)
            const sortByRefValue = (a, b) => {
                const partsA = (a.referenceValue || '').split('.').map(p => parseFloat(p) || 0);
                const partsB = (b.referenceValue || '').split('.').map(p => parseFloat(p) || 0);
                for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                    const numA = partsA[i] || 0;
                    const numB = partsB[i] || 0;
                    if (numA !== numB) return numA - numB;
                }
                return 0;
            };

            // Sort items within each section by reference value naturally
            for (const sectionId in sections) {
                sections[sectionId].items.sort(sortByRefValue);
            }

            console.log(`   ✅ Found ${Object.keys(sections).length} sections with responses`);

            return Object.values(sections);
        } catch (error) {
            console.error('❌ Error fetching audit responses:', error);
            throw error;
        }
    }

    /**
     * Get all pictures for an audit
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Pictures grouped by responseId
     */
    async getAuditPictures(auditId) {
        try {
            console.log(`🖼️ Fetching pictures for audit: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT Id as PictureID, ItemId as ResponseID, FileName, FileData, ContentType, PictureType, CreatedAt
                    FROM OE_InspectionPictures
                    WHERE InspectionId = @AuditID
                    ORDER BY ItemId, CreatedAt
                `);

            // Group by responseId
            const pictures = {};
            for (const row of result.recordset) {
                const responseId = row.ResponseID;
                
                if (!pictures[responseId]) {
                    pictures[responseId] = [];
                }

                // FileData is stored as base64 string, not binary
                const pic = {
                    pictureId: row.PictureID,
                    fileName: row.FileName,
                    contentType: row.ContentType,
                    pictureType: row.PictureType,
                    createdAt: row.CreatedAt,
                    // FileData is already base64 string
                    dataUrl: `data:${row.ContentType};base64,${row.FileData}`
                };
                
                console.log(`   📷 Picture ${row.PictureID}: ResponseID=${responseId}, Type="${row.PictureType}"`);
                pictures[responseId].push(pic);
            }

            console.log(`   ✅ Found pictures for ${Object.keys(pictures).length} responses`);

            return pictures;
        } catch (error) {
            console.error('❌ Error fetching pictures:', error);
            throw error;
        }
    }

    /**
     * Get findings/issues for action plan
     * @param {number} auditId - Audit ID
     * @returns {Promise<Array>} - Array of findings
     */
    async getFindings(auditId) {
        try {
            console.log(`🔍 Fetching findings for audit: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT r.*, s.SectionIcon
                    FROM AuditResponses r
                    LEFT JOIN AuditSections s ON r.SectionID = s.SectionID
                    WHERE r.AuditID = @AuditID
                      AND (
                          r.SelectedChoice IN ('No', 'Partially')
                          OR r.Finding IS NOT NULL
                          OR r.Priority IS NOT NULL
                          OR r.Escalate = 1
                      )
                    ORDER BY 
                        CASE r.Priority 
                            WHEN 'High' THEN 1 
                            WHEN 'Medium' THEN 2 
                            WHEN 'Low' THEN 3 
                            ELSE 4 
                        END,
                        r.SectionNumber, r.ReferenceValue
                `);

            console.log(`   ✅ Found ${result.recordset.length} findings`);

            return result.recordset.map(row => ({
                responseId: row.ResponseID,
                sectionNumber: row.SectionNumber,
                sectionName: row.SectionName,
                sectionIcon: row.SectionIcon,
                referenceValue: row.ReferenceValue,
                title: row.Title,
                selectedChoice: row.SelectedChoice,
                finding: row.Finding,
                cr: row.CR,
                correctiveAction: row.CorrectiveAction || row.CR, // Fallback to CR
                priority: row.Priority,
                hasPicture: row.HasPicture,
                escalate: row.Escalate,
                department: row.Department
            }));
        } catch (error) {
            console.error('❌ Error fetching findings:', error);
            throw error;
        }
    }

    /**
     * Get temperature readings for an audit
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Temperature readings grouped by type
     */
    async getTemperatureReadings(auditId) {
        try {
            console.log(`🌡️ Fetching temperature readings for audit: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT *
                    FROM FridgeReadings
                    WHERE AuditID = @AuditID
                    ORDER BY Section, ReadingType, CreatedAt
                `);

            // Group by section and type
            const readings = {
                good: [],
                bad: []
            };

            for (const row of result.recordset) {
                const reading = {
                    readingId: row.ReadingID,
                    responseId: row.ResponseID,
                    documentNumber: row.DocumentNumber,
                    section: row.Section,
                    unit: row.Unit,
                    displayTemp: row.DisplayTemp,
                    probeTemp: row.ProbeTemp,
                    issue: row.Issue,
                    picture: row.Picture,
                    readingType: row.ReadingType,
                    createdAt: row.CreatedAt
                };

                if (row.ReadingType === 'Good') {
                    readings.good.push(reading);
                } else {
                    readings.bad.push(reading);
                }
            }

            console.log(`   ✅ Found ${readings.good.length} good, ${readings.bad.length} bad readings`);

            return readings;
        } catch (error) {
            console.error('❌ Error fetching temperature readings:', error);
            // Return empty if table doesn't exist
            return { good: [], bad: [] };
        }
    }

    /**
     * Get historical findings for a store to detect repetitive issues
     * Returns findings from previous audits grouped by ReferenceValue
     * @param {number} storeId - Store ID
     * @param {number} currentAuditId - Current audit ID to exclude
     * @returns {Promise<Object>} - Map of ReferenceValue -> occurrence count and details
     */
    async getHistoricalFindings(storeId, currentAuditId) {
        try {
            console.log(`🔄 Fetching historical findings for store: ${storeId}`);

            const result = await this.pool.request()
                .input('StoreID', sql.Int, storeId)
                .input('CurrentAuditID', sql.Int, currentAuditId)
                .query(`
                    SELECT 
                        r.ReferenceValue,
                        r.Title,
                        r.SectionName,
                        r.SelectedChoice,
                        ai.DocumentNumber,
                        ai.AuditDate,
                        ai.AuditID
                    FROM AuditResponses r
                    INNER JOIN AuditInstances ai ON r.AuditID = ai.AuditID
                    WHERE ai.StoreID = @StoreID
                        AND ai.AuditID != @CurrentAuditID
                        AND ai.Status = 'Completed'
                        AND r.SelectedChoice IN ('No', 'Partially')
                    ORDER BY r.ReferenceValue, ai.AuditDate DESC
                `);

            // Group findings by ReferenceValue
            const findingsMap = {};
            for (const row of result.recordset) {
                const refVal = row.ReferenceValue || row.Title; // Use Title as fallback
                if (!findingsMap[refVal]) {
                    findingsMap[refVal] = {
                        referenceValue: refVal,
                        title: row.Title,
                        sectionName: row.SectionName,
                        occurrences: [],
                        count: 0
                    };
                }
                findingsMap[refVal].occurrences.push({
                    auditId: row.AuditID,
                    documentNumber: row.DocumentNumber,
                    auditDate: row.AuditDate,
                    selectedChoice: row.SelectedChoice
                });
                findingsMap[refVal].count++;
            }

            console.log(`   ✅ Found ${Object.keys(findingsMap).length} unique historical findings`);

            return findingsMap;
        } catch (error) {
            console.error('❌ Error fetching historical findings:', error);
            return {};
        }
    }

    /**
     * Get historical audits for a store (for C1-C6 display)
     * Returns the last 6 audits for the store, ordered by date (oldest first)
     * @param {number} storeId - Store ID
     * @param {number} currentAuditId - Current audit ID to exclude
     * @returns {Promise<Array>} - Array of historical audit data with section scores
     */
    async getHistoricalAudits(storeId, currentAuditId) {
        try {
            console.log(`📜 Fetching historical audits for store: ${storeId}`);

            // Get last 5 audits before the current one (C2-C6)
            const auditsResult = await this.pool.request()
                .input('StoreID', sql.Int, storeId)
                .input('CurrentAuditID', sql.Int, currentAuditId)
                .query(`
                    SELECT TOP 5 
                        ai.AuditID, ai.DocumentNumber, ai.TotalScore, ai.AuditDate, ai.Cycle
                    FROM AuditInstances ai
                    WHERE ai.StoreID = @StoreID 
                        AND ai.AuditID != @CurrentAuditID
                        AND ai.Status = 'Completed'
                    ORDER BY ai.AuditDate ASC
                `);

            const historicalAudits = [];

            for (const audit of auditsResult.recordset) {
                // Get section scores for each historical audit (including earned/max for weighted calculation)
                const scoresResult = await this.pool.request()
                    .input('AuditID', sql.Int, audit.AuditID)
                    .query(`
                        SELECT SectionName, Percentage, EarnedScore, MaxScore
                        FROM AuditSectionScores
                        WHERE AuditID = @AuditID
                    `);

                const sectionScores = {};
                const sectionEarned = {};
                const sectionMax = {};
                for (const score of scoresResult.recordset) {
                    sectionScores[score.SectionName] = parseFloat((score.Percentage || 0).toFixed(2));
                    sectionEarned[score.SectionName] = score.EarnedScore || 0;
                    sectionMax[score.SectionName] = score.MaxScore || 0;
                }

                historicalAudits.push({
                    auditId: audit.AuditID,
                    documentNumber: audit.DocumentNumber,
                    totalScore: Math.round(audit.TotalScore || 0),
                    auditDate: audit.AuditDate,
                    cycle: audit.Cycle,
                    sectionScores,
                    sectionEarned,
                    sectionMax
                });
            }

            console.log(`   ✅ Found ${historicalAudits.length} historical audits`);

            return historicalAudits;
        } catch (error) {
            console.error('❌ Error fetching historical audits:', error);
            return [];
        }
    }

    /**
     * Get categories with sections for a schema
     * @param {number} schemaId - Schema ID
     * @returns {Promise<Array>} - Categories with sections
     */
    async getCategoriesWithSections(schemaId) {
        try {
            console.log(`📂 Fetching categories for schema: ${schemaId}`);

            const result = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT 
                        c.CategoryID,
                        c.CategoryName,
                        c.DisplayOrder as CategoryOrder,
                        cs.DisplayOrder as SectionOrder,
                        s.SectionID,
                        s.SectionName,
                        s.SectionNumber
                    FROM AuditCategories c
                    LEFT JOIN CategorySections cs ON c.CategoryID = cs.CategoryID
                    LEFT JOIN AuditSections s ON cs.SectionID = s.SectionID AND s.SchemaID = @SchemaID
                    WHERE c.SchemaID = @SchemaID AND c.IsActive = 1
                    ORDER BY c.DisplayOrder, cs.DisplayOrder
                `);

            // Group by category
            const categoriesMap = new Map();
            
            for (const row of result.recordset) {
                if (!categoriesMap.has(row.CategoryID)) {
                    categoriesMap.set(row.CategoryID, {
                        categoryId: row.CategoryID,
                        categoryName: row.CategoryName,
                        displayOrder: row.CategoryOrder,
                        sections: []
                    });
                }
                
                if (row.SectionID) {
                    categoriesMap.get(row.CategoryID).sections.push({
                        sectionId: row.SectionID,
                        sectionName: row.SectionName,
                        sectionNumber: row.SectionNumber,
                        displayOrder: row.SectionOrder
                    });
                }
            }

            const categories = Array.from(categoriesMap.values());
            console.log(`   ✅ Found ${categories.length} categories`);

            return categories;
        } catch (error) {
            console.error('❌ Error fetching categories:', error);
            return [];
        }
    }
}

module.exports = DataService;
