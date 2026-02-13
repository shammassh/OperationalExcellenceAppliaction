/**
 * OHS (Occupational Health & Safety) Module
 * Handles OHS incidents and inspections
 */

const express = require('express');
const router = express.Router();

// Import sub-modules
const ohsSettings = require('./settings');

// Mount sub-routes
router.use('/settings', ohsSettings);

// OHS Landing Page
router.get('/', (req, res) => {
    const user = req.currentUser;
    
    // Settings cards for OHS Manager
    const settingsCards = [
        { id: 'stores', icon: '🏪', title: 'Stores Management', href: '/ohs/settings/stores', desc: 'Configure stores enabled for OHS reporting', color: '#0984e3' },
        { id: 'event-types', icon: '📋', title: 'Event Types', href: '/ohs/settings/event-types', desc: 'Manage event types (Accident, Incident, Near Miss)', color: '#6c5ce7' },
        { id: 'categories', icon: '📁', title: 'Event Categories', href: '/ohs/settings/categories', desc: 'Manage categories and sub-categories', color: '#00b894' },
        { id: 'injury-types', icon: '🩹', title: 'Injury Types', href: '/ohs/settings/injury-types', desc: 'Configure injury types for reporting', color: '#e17055' },
        { id: 'body-parts', icon: '🦴', title: 'Body Parts', href: '/ohs/settings/body-parts', desc: 'Manage body part options for injuries', color: '#fdcb6e' },
    ];
    
    // Dashboard cards
    const dashboardCards = [
        { id: 'all-incidents', icon: '📊', title: 'All Incidents', href: '/stores/ohs-incident/history', desc: 'View and manage all reported incidents', color: '#e17055' },
        { id: 'pending-review', icon: '⏳', title: 'Pending Review', href: '/stores/ohs-incident/history?status=pending', desc: 'Incidents awaiting review', color: '#fdcb6e' },
        { id: 'reports', icon: '📈', title: 'Reports & Analytics', href: '/ohs/reports', desc: 'Generate OHS reports and statistics', color: '#00cec9' },
    ];
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Occupational Health & Safety - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                    min-height: 100vh;
                }
                .header {
                    background: rgba(0,0,0,0.2);
                    color: white;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { font-size: 24px; }
                .header-nav { display: flex; gap: 15px; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    background: rgba(255,255,255,0.1);
                    transition: background 0.2s;
                }
                .header-nav a:hover { background: rgba(255,255,255,0.2); }
                
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 30px;
                }
                
                .page-title {
                    color: white;
                    margin-bottom: 30px;
                    text-align: center;
                }
                .page-title h2 {
                    font-size: 32px;
                    margin-bottom: 10px;
                }
                .page-title p {
                    opacity: 0.9;
                    font-size: 18px;
                }
                
                .section-title {
                    color: white;
                    font-size: 20px;
                    margin: 30px 0 20px 0;
                    padding-bottom: 10px;
                    border-bottom: 2px solid rgba(255,255,255,0.3);
                }
                
                .cards-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                }
                
                .card {
                    background: white;
                    border-radius: 12px;
                    padding: 25px;
                    text-decoration: none;
                    color: inherit;
                    transition: transform 0.2s, box-shadow 0.2s;
                    display: flex;
                    flex-direction: column;
                    border-top: 4px solid #e17055;
                }
                .card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                .card-icon {
                    font-size: 40px;
                    margin-bottom: 15px;
                }
                .card-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 10px;
                }
                .card-desc {
                    color: #666;
                    font-size: 14px;
                    flex-grow: 1;
                }
                
                .user-info {
                    background: rgba(255,255,255,0.1);
                    padding: 8px 15px;
                    border-radius: 20px;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🦺 Occupational Health & Safety</h1>
                <div class="header-nav">
                    <span class="user-info">👤 ${user?.displayName || 'User'}</span>
                    <a href="/">🏠 Home</a>
                    <a href="/auth/logout">🚪 Logout</a>
                </div>
            </div>
            
            <div class="container">
                <div class="page-title">
                    <h2>OHS Management</h2>
                    <p>Manage occupational health and safety incidents, inspections, and compliance</p>
                </div>
                
                <h3 class="section-title">⚙️ Settings & Configuration</h3>
                <div class="cards-grid">
                    ${settingsCards.map(card => `
                        <a href="${card.href}" class="card" style="border-top-color: ${card.color}">
                            <div class="card-icon">${card.icon}</div>
                            <div class="card-title">${card.title}</div>
                            <div class="card-desc">${card.desc}</div>
                        </a>
                    `).join('')}
                </div>
                
                <h3 class="section-title">📊 Dashboard & Reports</h3>
                <div class="cards-grid">
                    ${dashboardCards.map(card => `
                        <a href="${card.href}" class="card" style="border-top-color: ${card.color}">
                            <div class="card-icon">${card.icon}</div>
                            <div class="card-title">${card.title}</div>
                            <div class="card-desc">${card.desc}</div>
                        </a>
                    `).join('')}
                </div>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
