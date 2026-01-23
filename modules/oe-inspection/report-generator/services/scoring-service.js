/**
 * Scoring Service
 * Handles all scoring calculations and performance evaluations
 */

class ScoringService {
    /**
     * Calculate value based on selected choice and coefficient
     * @param {string} selectedChoice - Yes, Partially, No, NA
     * @param {number} coeff - Coefficient/weight
     * @returns {number|null} - Calculated value or null for NA
     */
    calculateValue(selectedChoice, coeff) {
        if (!selectedChoice || selectedChoice === '') return null;
        
        const coefficient = coeff || 2;
        
        switch (selectedChoice) {
            case 'Yes': return 1 * coefficient;
            case 'Partially': return 0.5 * coefficient;
            case 'No': return 0;
            case 'NA': return null;
            default: return null;
        }
    }

    /**
     * Calculate section score percentage
     * @param {Array} items - Section items with Value and Coeff
     * @returns {Object} - { earned, max, percentage }
     */
    calculateSectionScore(items) {
        let earnedScore = 0;
        let maxScore = 0;

        for (const item of items) {
            // Skip NA items
            if (item.selectedChoice === 'NA' || item.selectedChoice === null || item.selectedChoice === '') {
                continue;
            }

            const coeff = item.coeff || 2;
            maxScore += coeff;
            earnedScore += item.value || 0;
        }

        const percentage = maxScore > 0 ? parseFloat(((earnedScore / maxScore) * 100).toFixed(2)) : 0;

        return {
            earned: earnedScore,
            max: maxScore,
            percentage
        };
    }

    /**
     * Calculate overall score from section scores
     * @param {Array} sectionScores - Array of section score objects
     * @returns {Object} - { earned, max, percentage }
     */
    calculateOverallScore(sectionScores) {
        let totalEarned = 0;
        let totalMax = 0;

        for (const section of sectionScores) {
            totalEarned += section.earned || 0;
            totalMax += section.max || 0;
        }

        const percentage = totalMax > 0 ? parseFloat(((totalEarned / totalMax) * 100).toFixed(2)) : 0;

        return {
            earned: totalEarned,
            max: totalMax,
            percentage
        };
    }

    /**
     * Get performance status based on score and threshold
     * @param {number} score - Score percentage
     * @param {number} threshold - Passing threshold
     * @returns {string} - 'PASS' or 'FAIL'
     */
    getStatus(score, threshold = 83) {
        return score >= threshold ? 'PASS' : 'FAIL';
    }

    /**
     * Get performance emoji based on score and threshold
     * @param {number} score - Score percentage
     * @param {number} threshold - Passing threshold
     * @returns {string} - Emoji
     */
    getEmoji(score, threshold = 83) {
        return score >= threshold ? '✅' : '❌';
    }

    /**
     * Get performance text with emoji
     * @param {number} score - Score percentage
     * @param {number} threshold - Passing threshold
     * @returns {string} - Performance text
     */
    getPerformance(score, threshold = 83) {
        const status = this.getStatus(score, threshold);
        const emoji = this.getEmoji(score, threshold);
        return `${status} ${emoji}`;
    }

    /**
     * Get CSS class for score styling
     * @param {number} score - Score percentage
     * @param {number} threshold - Passing threshold
     * @returns {string} - CSS class
     */
    getScoreClass(score, threshold = 83) {
        return score >= threshold ? 'score-pass' : 'score-fail';
    }

    /**
     * Get severity class for priority
     * @param {string} priority - Priority level
     * @returns {string} - CSS class
     */
    getSeverityClass(priority) {
        const classes = {
            'High': 'severity-high',
            'Medium': 'severity-medium',
            'Low': 'severity-low'
        };
        return classes[priority] || 'severity-none';
    }

    /**
     * Get color for chart based on score
     * @param {number} score - Score percentage
     * @param {number} threshold - Passing threshold
     * @returns {string} - Hex color code
     */
    getChartColor(score, threshold = 83) {
        return score >= threshold ? '#10b981' : '#ef4444'; // Green or Red
    }

    /**
     * Generate chart data for sections
     * @param {Array} sections - Array of sections with scores
     * @param {number} threshold - Passing threshold
     * @returns {Object} - Chart.js compatible data
     */
    generateChartData(sections, threshold = 83) {
        const labels = [];
        const data = [];
        const backgroundColor = [];

        for (const section of sections) {
            labels.push(section.sectionName);
            data.push(section.percentage);
            backgroundColor.push(this.getChartColor(section.percentage, threshold));
        }

        return {
            labels,
            datasets: [{
                label: 'Score %',
                data,
                backgroundColor,
                borderColor: backgroundColor,
                borderWidth: 1
            }]
        };
    }
}

module.exports = ScoringService;
