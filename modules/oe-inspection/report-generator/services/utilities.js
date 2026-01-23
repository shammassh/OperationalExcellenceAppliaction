/**
 * Utility Functions
 * Common helper functions for text processing, field mapping, and data extraction
 */

/**
 * Clean text by handling escaped newlines and tabs
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text with HTML line breaks
 */
function cleanText(text) {
    if (!text) return text;
    return String(text)
        .replace(/\\n/g, '<br>')
        .replace(/\n/g, '<br>')
        .replace(/\\t/g, '    ')
        .replace(/\t/g, '    ');
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
}

/**
 * Format time for display
 * @param {string} time - Time string (HH:MM format)
 * @returns {string} - Formatted time
 */
function formatTime(time) {
    if (!time) return 'N/A';
    return time;
}

/**
 * Get priority badge HTML
 * @param {string} priority - Priority level
 * @returns {string} - HTML badge
 */
function getPriorityBadge(priority) {
    if (!priority) return '';
    
    const badges = {
        'High': '<span class="priority-badge priority-high">High</span>',
        'Medium': '<span class="priority-badge priority-medium">Medium</span>',
        'Low': '<span class="priority-badge priority-low">Low</span>'
    };
    
    return badges[priority] || '';
}

/**
 * Get answer class for styling
 * @param {string} answer - Selected answer
 * @returns {string} - CSS class name
 */
function getAnswerClass(answer) {
    if (!answer) return 'answer-none';
    
    const classes = {
        'Yes': 'answer-yes',
        'Partially': 'answer-partial',
        'No': 'answer-no',
        'NA': 'answer-na'
    };
    
    return classes[answer] || 'answer-none';
}

/**
 * Get section icon
 * @param {string} iconName - Icon name or emoji
 * @param {number} sectionNumber - Section number fallback
 * @returns {string} - Icon or emoji
 */
function getSectionIcon(iconName, sectionNumber) {
    if (iconName) return iconName;
    
    // Default icons by section number
    const defaultIcons = {
        1: '🥫',  // Food Storage
        2: '❄️',  // Fridges
        3: '🍽️',  // Utensils
        4: '👨‍🍳', // Food Handling
        5: '🧹',  // Cleaning
        6: '🧼',  // Personal Hygiene
        7: '🚻',  // Restrooms
        8: '🗑️',  // Garbage
        9: '🛠️',  // Maintenance
        10: '🧪', // Chemicals
        11: '📋', // Monitoring
        12: '🏛️', // Culture
        13: '📜'  // Policies
    };
    
    return defaultIcons[sectionNumber] || '📋';
}

/**
 * Round percentage to nearest integer
 * @param {number} value - Value to round
 * @returns {number} - Rounded value
 */
function roundPercentage(value) {
    return Math.round(value || 0);
}

/**
 * Generate unique ID
 * @returns {string} - Unique ID
 */
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

module.exports = {
    cleanText,
    escapeHtml,
    formatDate,
    formatTime,
    getPriorityBadge,
    getAnswerClass,
    getSectionIcon,
    roundPercentage,
    generateId,
    truncateText
};
