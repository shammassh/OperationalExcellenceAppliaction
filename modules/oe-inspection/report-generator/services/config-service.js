/**
 * Configuration Service
 * Fetches and caches system settings from SQL Server SystemSettings table
 */

const sql = require('mssql');

class ConfigService {
    constructor(pool) {
        this.pool = pool;
        this.cache = null;
        this.cacheExpiry = null;
        this.cacheDurationMs = 5 * 60 * 1000; // 5 minutes cache
        
        // Default values (fallback if DB unavailable)
        this.defaults = {
            overallPassingGrade: 83,
            sectionPassingGrade: 83,
            categoryPassingGrade: 83
        };
    }

    /**
     * Set the database pool
     * @param {Object} pool - SQL connection pool
     */
    setPool(pool) {
        this.pool = pool;
    }

    /**
     * Fetch settings for a specific schema from SQL Server
     * @param {number} schemaId - Schema ID
     * @returns {Promise<Object>} Settings object
     */
    async fetchSchemaSettings(schemaId) {
        try {
            console.log(`📋 Fetching settings for schema ${schemaId}...`);
            
            if (!this.pool) {
                console.log('⚠️ No database pool, using defaults');
                return this.defaults;
            }

            // Get overall passing grade for schema
            const overallResult = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT PassingGrade 
                    FROM SystemSettings 
                    WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                `);

            const overallPassingGrade = overallResult.recordset[0]?.PassingGrade || this.defaults.overallPassingGrade;

            // Get section passing grades
            const sectionsResult = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT s.SectionID, s.SectionName, s.SectionNumber,
                           ISNULL(ss.PassingGrade, 83) as PassingGrade
                    FROM AuditSections s
                    LEFT JOIN SystemSettings ss ON ss.SchemaID = s.SchemaID 
                        AND ss.SettingType = 'Section' 
                        AND ss.EntityID = s.SectionID
                    WHERE s.SchemaID = @SchemaID AND s.IsActive = 1
                    ORDER BY s.SectionNumber
                `);

            const sectionSettings = {};
            for (const section of sectionsResult.recordset) {
                sectionSettings[section.SectionID] = {
                    sectionId: section.SectionID,
                    sectionName: section.SectionName,
                    sectionNumber: section.SectionNumber,
                    passingGrade: section.PassingGrade
                };
            }

            console.log(`✅ Loaded settings: Overall=${overallPassingGrade}%, ${Object.keys(sectionSettings).length} sections`);

            return {
                overallPassingGrade,
                sectionPassingGrade: this.defaults.sectionPassingGrade,
                categoryPassingGrade: this.defaults.categoryPassingGrade,
                sections: sectionSettings
            };

        } catch (error) {
            console.error('❌ Error fetching settings from SQL:', error.message);
            console.log('⚠️ Using default settings');
            return this.defaults;
        }
    }

    /**
     * Get all settings for a schema (with caching)
     * @param {number} schemaId - Schema ID
     * @param {boolean} forceRefresh - Force refresh from database
     * @returns {Promise<Object>} All settings
     */
    async getSettings(schemaId, forceRefresh = false) {
        const cacheKey = `schema_${schemaId}`;
        const now = Date.now();
        
        // Return cached if valid
        if (!forceRefresh && this.cache?.[cacheKey] && this.cacheExpiry?.[cacheKey] && now < this.cacheExpiry[cacheKey]) {
            return this.cache[cacheKey];
        }

        // Fetch fresh settings
        if (!this.cache) this.cache = {};
        if (!this.cacheExpiry) this.cacheExpiry = {};
        
        this.cache[cacheKey] = await this.fetchSchemaSettings(schemaId);
        this.cacheExpiry[cacheKey] = now + this.cacheDurationMs;
        
        return this.cache[cacheKey];
    }

    /**
     * Get passing thresholds
     * @param {number} schemaId - Schema ID
     * @returns {Promise<Object>} Thresholds { overall, section, category }
     */
    async getThresholds(schemaId) {
        const settings = await this.getSettings(schemaId);
        return {
            overall: settings.overallPassingGrade,
            section: settings.sectionPassingGrade,
            category: settings.categoryPassingGrade
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache = null;
        this.cacheExpiry = null;
        console.log('🗑️ Config cache cleared');
    }
}

module.exports = ConfigService;
