#!/usr/bin/env node

/**
 * Department Follow-up Reports Generator
 * Main entry point for generating department-specific follow-up action reports
 * 
 * Usage:
 *   node department-followup-reports/index.js <DEPARTMENT>
 *   
 * Examples:
 *   node department-followup-reports/index.js Maintenance
 *   node department-followup-reports/index.js Procurement
 *   node department-followup-reports/index.js Cleaning
 */

const path = require('path');
require('dotenv').config();

// Import services
const SimpleGraphConnector = require('../src/simple-graph-connector');
const FollowupDataService = require('./services/followup-data-service');
const ImageService = require('./services/image-service');
const TemplateGenerator = require('./services/template-generator');
const { DEPARTMENTS } = require('./config/department-mappings');

class DepartmentFollowupReportGenerator {
    constructor(config = {}) {
        this.config = {
            outputDir: config.outputDir || './reports',
            siteUrl: process.env.SHAREPOINT_SITE_URL || 'https://spinneysleb.sharepoint.com/operations/',
            ...config
        };

        // Initialize connector
        this.connector = new SimpleGraphConnector();
        
        // Initialize services
        this.followupService = new FollowupDataService(this.connector);
        this.imageService = new ImageService(this.connector);
        this.templateGenerator = new TemplateGenerator();
    }

    /**
     * Generate follow-up report for a specific department
     * @param {string} department - Department name (Maintenance, Procurement, Cleaning)
     * @returns {Promise<Object>} - Result object
     */
    async generateReport(department) {
        try {
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║     Department Follow-up Actions Report Generator            ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log(`📋 Department: ${department}`);
            console.log(`📁 Output Directory: ${this.config.outputDir}`);
            console.log('');

            // Validate department
            const validDepartments = Object.values(DEPARTMENTS);
            if (!validDepartments.includes(department)) {
                throw new Error(`Invalid department: ${department}. Valid: ${validDepartments.join(', ')}`);
            }

            // Connect to SharePoint
            console.log('🚀 Connecting to SharePoint...');
            await this.connector.connect();
            console.log('✅ Connected to SharePoint\n');

            // Step 1: Get follow-up items for department
            const followupItems = await this.followupService.getFollowupItemsForDepartment(department);

            if (followupItems.length === 0) {
                console.log('⚠️ No follow-up items found for this department');
                return {
                    success: true,
                    message: 'No follow-up items found',
                    itemsCount: 0
                };
            }

            // Step 2: Get corrective images
            const imagesByItemKey = await this.imageService.getCorrectiveImagesForItems(followupItems);
            const base64Images = await this.imageService.downloadAndConvertImages(imagesByItemKey);
            
            // Step 3: Attach images to items
            const itemsWithImages = this.imageService.attachImagesToItems(followupItems, base64Images);

            // Step 4: Generate statistics
            const statistics = this.followupService.getStatistics(itemsWithImages);
            console.log('\n📊 Report Statistics:');
            console.log(`   Total Items: ${statistics.total}`);
            console.log(`   High Priority: ${statistics.byPriority.High || 0}`);
            console.log(`   Medium Priority: ${statistics.byPriority.Medium || 0}`);
            console.log(`   Low Priority: ${statistics.byPriority.Low || 0}`);

            // Step 5: Generate HTML report
            const html = await this.templateGenerator.generateReport(
                department,
                itemsWithImages,
                statistics
            );

            // Step 6: Save report
            const filePath = await this.templateGenerator.saveReport(
                html,
                department,
                this.config.outputDir
            );

            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║                    ✅ SUCCESS!                                ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log(`📁 Report saved to: ${filePath}`);
            console.log(`📊 Total Items: ${statistics.total}`);
            console.log(`🏢 Department: ${department}`);
            console.log('');

            return {
                success: true,
                filePath: filePath,
                itemsCount: statistics.total,
                statistics: statistics
            };

        } catch (error) {
            console.error('');
            console.error('╔═══════════════════════════════════════════════════════════════╗');
            console.error('║                    ❌ ERROR                                   ║');
            console.error('╚═══════════════════════════════════════════════════════════════╝');
            console.error('');
            console.error('Error:', error.message);
            console.error(error.stack);

            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Main execution
async function main() {
    const department = process.argv[2];

    if (!department) {
        console.error('❌ Error: Department name is required');
        console.error('');
        console.error('Usage:');
        console.error('  node department-followup-reports/index.js <DEPARTMENT>');
        console.error('');
        console.error('Examples:');
        console.error('  node department-followup-reports/index.js Maintenance');
        console.error('  node department-followup-reports/index.js Procurement');
        console.error('  node department-followup-reports/index.js Cleaning');
        console.error('');
        process.exit(1);
    }

    const generator = new DepartmentFollowupReportGenerator();
    const result = await generator.generateReport(department);

    if (result.success) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

// Export for use as module
module.exports = DepartmentFollowupReportGenerator;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
