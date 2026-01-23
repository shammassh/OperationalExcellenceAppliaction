/**
 * Department Mappings Configuration
 * Defines department combinations and filtering logic
 */

const DEPARTMENTS = {
    MAINTENANCE: 'Maintenance',
    PROCUREMENT: 'Procurement',
    CLEANING: 'Cleaning'
};

/**
 * All possible department combinations from PowerApps
 * Used to match against Department field in Checklist FollowUps
 */
const DEPARTMENT_COMBINATIONS = [
    { Value: "" },
    { Value: "Maintenance" },
    { Value: "Procurement" },
    { Value: "Cleaning" },
    { Value: "Procurement, Maintenance" },
    { Value: "Maintenance,Cleaning" },
    { Value: "Procurement,Cleaning" },
    { Value: "Procurement, Maintenance,Cleaning" }
];

/**
 * Check if a department field contains a specific department
 * Handles various formats: "Maintenance", "Procurement, Maintenance", "Maintenance,Cleaning"
 * 
 * @param {string} departmentField - The Department field value from SharePoint
 * @param {string} targetDepartment - The department to check for (e.g., "Maintenance")
 * @returns {boolean} - True if the department is found
 */
function isDepartmentMatch(departmentField, targetDepartment) {
    if (!departmentField || !targetDepartment) return false;
    
    // Normalize the field: remove extra spaces, split by comma
    const departments = departmentField
        .split(',')
        .map(d => d.trim().toLowerCase());
    
    return departments.includes(targetDepartment.toLowerCase());
}

/**
 * Get department icon
 * @param {string} department - Department name
 * @returns {string} - Emoji icon
 */
function getDepartmentIcon(department) {
    const icons = {
        'Maintenance': '🔧',
        'Procurement': '📦',
        'Cleaning': '🧹'
    };
    return icons[department] || '📋';
}

/**
 * Get department color
 * @param {string} department - Department name
 * @returns {string} - Hex color code
 */
function getDepartmentColor(department) {
    const colors = {
        'Maintenance': '#FF9800',  // Orange
        'Procurement': '#2196F3',  // Blue
        'Cleaning': '#4CAF50'      // Green
    };
    return colors[department] || '#757575';
}

/**
 * Section mappings to match with audit sections
 */
const SECTION_MAPPINGS = {
    'Food Storage': '🥫 Food Storage and Dry Storage',
    'Fridges': '❄️ Fridges and Freezers',
    'Utensils': '🍽️ Utensils and Equipment',
    'Food Handling': '👨‍🍳 Food Handling',
    'Cleaning': '🧹 Cleaning and Disinfection',
    'Hygiene': '🧼 Personal Hygiene',
    'Restrooms': '🚻 Restrooms',
    'Garbage': '🗑️ Garbage Storage and Disposal',
    'Maintenance': '🛠️ Maintenance',
    'Chemicals': '🧪 Chemicals Available',
    'Monitoring': '📋 Monitoring Sheets',
    'Culture': '🏛️ Food Safety Culture',
    'Policies': '📜 Policies & Procedures'
};

module.exports = {
    DEPARTMENTS,
    DEPARTMENT_COMBINATIONS,
    SECTION_MAPPINGS,
    isDepartmentMatch,
    getDepartmentIcon,
    getDepartmentColor
};
