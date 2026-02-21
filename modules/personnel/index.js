/**
 * Personnel Module
 * Handles personnel-related forms and requests
 */

const express = require('express');
const router = express.Router();

// Import sub-routes
const securityScheduleRoutes = require('./security-schedule/routes');
const thirdpartyScheduleRoutes = require('./thirdparty-schedule/routes');
const thirdpartyAttendanceRoutes = require('./thirdparty-attendance/routes');

// Mount sub-routes
router.use('/security-schedule', securityScheduleRoutes);
router.use('/thirdparty-schedule', thirdpartyScheduleRoutes);
router.use('/thirdparty-attendance', thirdpartyAttendanceRoutes);

// Personnel main page
router.get('/', (req, res) => {
    const forms = [
        { id: 'security-schedule', icon: '🛡️', title: 'Employees Schedule - Security', href: '/personnel/security-schedule', desc: 'Fill weekly attendance schedule for security employees', color: '#2c3e50' },
        { id: 'thirdparty-schedule', icon: '🏢', title: 'Employees Schedule - Thirdparty', href: '/personnel/thirdparty-schedule', desc: 'Fill weekly attendance schedule for thirdparty employees', color: '#8e44ad' },
        { id: 'thirdparty-attendance', icon: '📋', title: 'Third-Parties Attendance', href: '/personnel/thirdparty-attendance', desc: 'Download CSV template, fill attendance data, and upload', color: '#e67e22' },
    ];
    
    const formsHtml = forms.length > 0 ? forms.map(form => `
        <a href="${form.href}" class="form-card" style="border-top: 4px solid ${form.color || '#6c5ce7'}">
            <div class="form-icon">${form.icon}</div>
            <div class="form-title" style="color: ${form.color || '#6c5ce7'}">${form.title}</div>
            <div class="form-desc">${form.desc}</div>
        </a>
    `).join('') : `
        <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>No Forms Available Yet</h3>
            <p>Personnel forms will be added here soon.</p>
        </div>
    `;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Personnel - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    margin: 0;
                    padding: 0;
                    background: #f5f5f5;
                }
                .header {
                    background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
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
                    color: #6c5ce7;
                    text-decoration: none;
                }
                .page-title {
                    font-size: 28px;
                    margin-bottom: 30px;
                    color: #333;
                }
                .forms-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 25px;
                }
                .form-card {
                    background: white;
                    border-radius: 12px;
                    padding: 25px;
                    text-decoration: none;
                    color: inherit;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    transition: all 0.3s ease;
                }
                .form-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.12);
                }
                .form-icon {
                    font-size: 48px;
                    margin-bottom: 15px;
                }
                .form-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 10px;
                }
                .form-desc {
                    color: #666;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                }
                .empty-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .empty-state h3 {
                    color: #333;
                    margin-bottom: 10px;
                }
                .empty-state p {
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>👤 Personnel</h1>
                <div class="header-nav">
                    <a href="/dashboard">← Back to Dashboard</a>
                </div>
            </div>
            <div class="container">
                <div class="breadcrumb">
                    <a href="/dashboard">Dashboard</a> / Personnel
                </div>
                <h2 class="page-title">Personnel Forms & Requests</h2>
                <div class="forms-grid">
                    ${formsHtml}
                </div>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
