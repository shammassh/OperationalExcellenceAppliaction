/**
 * Follow-up Data Service
 * Fetches and processes data from Checklist FollowUps list
 */

const { isDepartmentMatch } = require('../config/department-mappings');

class FollowupDataService {
    constructor(connector) {
        this.connector = connector;
        this.listName = 'Checklist FollowUps';
    }

    /**
     * Get all follow-up items for a specific department
     * Filters by department and returns items grouped by section
     * 
     * @param {string} department - Department name (Maintenance, Procurement, Cleaning)
     * @returns {Promise<Array>} - Array of follow-up items
     */
    async getFollowupItemsForDepartment(department) {
        try {
            console.log(`\n📋 Fetching follow-up items for ${department} department...`);

            // Fetch all items from Checklist FollowUps list
            const items = await this.connector.getListItems(this.listName, {
                top: 5000,  // Get all items
                orderby: 'Created desc'
            });

            if (!items || items.length === 0) {
                console.log('⚠️ No follow-up items found in Checklist FollowUps list');
                return [];
            }

            console.log(`✅ Retrieved ${items.length} total follow-up items`);

            // Filter items for this department
            const departmentItems = items.filter(item => {
                const departmentField = item.Department || '';
                return isDepartmentMatch(departmentField, department);
            });

            console.log(`✅ Found ${departmentItems.length} items for ${department} department`);

            // Process and enrich items
            const processedItems = departmentItems.map(item => this.processFollowupItem(item));

            // Sort by Reference Value (1.1, 1.2, 2.1, etc.)
            processedItems.sort((a, b) => {
                return this.compareReferenceValues(a.referenceValue, b.referenceValue);
            });

            return processedItems;

        } catch (error) {
            console.error('❌ Error fetching follow-up items:', error.message);
            throw error;
        }
    }

    /**
     * Process a single follow-up item
     * @param {Object} item - Raw SharePoint item
     * @returns {Object} - Processed item
     */
    processFollowupItem(item) {
        const referenceValue = item.Reference_x0020_Value || '';
        
        return {
            id: item.ID || item.Id,
            documentNumber: item.Document_x0020_Number || '',
            itemKey: item.ItemKey || '',
            itemTitle: item.ItemTitle || item.Title || '',
            referenceValue: referenceValue,
            section: this.extractSection(referenceValue),  // Extract from reference value
            finding: item.Finding || '',
            correctiveAction: item.CorrectiveAction || '',
            priority: item.Priority || '',
            status: item.Status || 'New',
            department: item.Department || '',
            created: item.Created || '',
            modified: item.Modified || '',
            hasAttachments: item.Attachments || false,
            // Will be populated later with corrective images
            correctiveImages: []
        };
    }

    /**
     * Extract section name from reference value
     * Reference values map to audit sections based on numbering
     * @param {string} referenceValue - Reference value (e.g., "1.1", "2.26")
     * @returns {string} - Section name
     */
    extractSection(referenceValue) {
        if (!referenceValue) return 'General';
        
        // Extract major number (before the dot)
        const majorNum = parseInt(referenceValue.split('.')[0]);
        
        // Map reference numbers to sections based on audit structure
        const sectionMap = {
            1: '🥫 Food Storage and Dry Storage',
            2: '❄️ Fridges and Freezers',
            3: '🍽️ Utensils and Equipment',
            4: '👨‍🍳 Food Handling',
            5: '🧹 Cleaning and Disinfection',
            6: '🧼 Personal Hygiene',
            7: '🚻 Restrooms',
            8: '🗑️ Garbage Storage and Disposal',
            9: '🛠️ Maintenance',
            10: '🧪 Chemicals Available',
            11: '📋 Monitoring Sheets',
            12: '🏛️ Food Safety Culture',
            13: '📜 Policies & Procedures'
        };
        
        return sectionMap[majorNum] || 'General';
    }

    /**
     * Compare two reference values for sorting (1.1, 1.2, 2.1, etc.)
     * @param {string} a - First reference value
     * @param {string} b - Second reference value
     * @returns {number} - Comparison result
     */
    compareReferenceValues(a, b) {
        if (!a) return 1;
        if (!b) return -1;

        // Split by dot: "2.26" -> [2, 26]
        const aParts = a.split('.').map(n => parseInt(n) || 0);
        const bParts = b.split('.').map(n => parseInt(n) || 0);

        // Compare major number first
        if (aParts[0] !== bParts[0]) {
            return aParts[0] - bParts[0];
        }

        // Then compare minor number
        return (aParts[1] || 0) - (bParts[1] || 0);
    }

    /**
     * Group items by section
     * @param {Array} items - Follow-up items
     * @returns {Object} - Items grouped by section
     */
    groupBySection(items) {
        const grouped = {};

        for (const item of items) {
            const section = item.section || 'General';
            
            if (!grouped[section]) {
                grouped[section] = [];
            }
            
            grouped[section].push(item);
        }

        return grouped;
    }

    /**
     * Get statistics for department follow-ups
     * @param {Array} items - Follow-up items
     * @returns {Object} - Statistics
     */
    getStatistics(items) {
        const stats = {
            total: items.length,
            byPriority: {
                High: 0,
                Medium: 0,
                Low: 0
            },
            byStatus: {
                New: 0,
                'In Progress': 0,
                Completed: 0
            },
            sections: new Set()
        };

        for (const item of items) {
            // Count by priority
            if (item.priority) {
                stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
            }

            // Count by status
            if (item.status) {
                stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
            }

            // Track unique sections
            if (item.section) {
                stats.sections.add(item.section);
            }
        }

        stats.sectionsCount = stats.sections.size;
        delete stats.sections;  // Don't need the set in final stats

        return stats;
    }
}

module.exports = FollowupDataService;
