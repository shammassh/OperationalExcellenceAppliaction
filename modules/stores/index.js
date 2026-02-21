/**
 * Stores Module - Main Router
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// Import form handlers
const theftIncidentRoutes = require('./theft-incident/routes');
const extraCleaningRoutes = require('./extra-cleaning/routes');
const productionExtrasRoutes = require('./production-extras/routes');
const weeklyFeedbackRoutes = require('./weekly-feedback/routes');
const complaintRoutes = require('./complaint/routes');
const fiveDaysRoutes = require('./five-days/routes');
const ohsIncidentRoutes = require('./ohs-incident/routes');

// Stores main page
router.get('/', (req, res) => {
    const forms = [
        { id: 'theft-incident', icon: '🚨', title: 'Theft Incident Report', href: '/stores/theft-incident', desc: 'Report theft incidents at stores', color: '#dc3545' },
        { id: 'extra-cleaning', icon: '🧹', title: 'Extra Cleaning Agents Request', href: '/stores/extra-cleaning', desc: 'Request extra cleaning agents for your store', color: '#17a2b8' },
        { id: 'production-extras', icon: '👷', title: 'Production Extras Request', href: '/stores/production-extras', desc: 'Request extra production agents', color: '#667eea' },
        { id: 'weekly-feedback', icon: '📋', title: 'Weekly Third Party Feedback', href: '/stores/weekly-feedback', desc: 'Submit weekly feedback about third party services', color: '#6c5ce7' },
        { id: 'complaint', icon: '📝', title: 'Complaint', href: '/stores/complaint', desc: 'Submit and track complaints', color: '#e17055' },
        { id: 'five-days', icon: '📅', title: '5 Days - Expired Items', href: '/stores/five-days', desc: 'Track expired items during 5-day cycles', color: '#667eea' },
        { id: 'ohs-incident', icon: '🦺', title: 'OHS A&I Reporting', href: '/stores/ohs-incident', desc: 'Report accidents, incidents, and near misses', color: '#e17055' },
        // More forms will be added here
    ];
    
    const formsHtml = forms.map(form => `
        <a href="${form.href}" class="form-card" style="border-top: 4px solid ${form.color || '#0078d4'}">
            <div class="form-icon">${form.icon}</div>
            <div class="form-title" style="color: ${form.color || '#0078d4'}">${form.title}</div>
            <div class="form-desc">${form.desc}</div>
        </a>
    `).join('');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Stores - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    margin: 0;
                    padding: 0;
                    background: #f5f5f5;
                }
                .header {
                    background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { margin: 0; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    margin-left: 20px;
                    padding: 8px 16px;
                    border-radius: 5px;
                    background: rgba(255,255,255,0.1);
                }
                .header-nav a:hover {
                    background: rgba(255,255,255,0.2);
                }
                .container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 30px;
                }
                .breadcrumb {
                    margin-bottom: 20px;
                    color: #666;
                }
                .breadcrumb a {
                    color: #0078d4;
                    text-decoration: none;
                }
                .page-title {
                    font-size: 28px;
                    color: #333;
                    margin-bottom: 30px;
                }
                .forms-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 25px;
                }
                .form-card {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    text-decoration: none;
                    color: #333;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    transition: all 0.3s ease;
                    border: 1px solid #e0e0e0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }
                .form-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,120,212,0.2);
                    border-color: #0078d4;
                }
                .form-icon {
                    font-size: 48px;
                    margin-bottom: 15px;
                }
                .form-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #0078d4;
                }
                .form-desc {
                    font-size: 14px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏪 Stores</h1>
                <div class="header-nav">
                    <a href="/dashboard">← Dashboard</a>
                    <a href="/auth/logout">Logout</a>
                </div>
            </div>
            <div class="container">
                <div class="breadcrumb">
                    <a href="/dashboard">Dashboard</a> / <span>Stores</span>
                </div>
                <h2 class="page-title">Store Forms & Reports</h2>
                <div class="forms-grid">
                    ${formsHtml}
                </div>
            </div>
        </body>
        </html>
    `);
});

// Mount form routes
router.use('/theft-incident', theftIncidentRoutes);
router.use('/extra-cleaning', extraCleaningRoutes);
router.use('/production-extras', productionExtrasRoutes);
router.use('/weekly-feedback', weeklyFeedbackRoutes);
router.use('/complaint', complaintRoutes);
router.use('/five-days', fiveDaysRoutes);
router.use('/ohs-incident', ohsIncidentRoutes);

module.exports = router;
