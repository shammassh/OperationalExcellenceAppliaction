/**
 * Security Services Module - Main Router
 * Internal & Third Party Security Management
 */

const express = require('express');
const router = express.Router();

// Import form handlers
const deliveryLogRoutes = require('./delivery-log/routes');

// Mount sub-routes
router.use('/delivery-log', deliveryLogRoutes);

// Landing Page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Security Services - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    min-height: 100vh;
                }
                .header {
                    background: rgba(0,0,0,0.3);
                    backdrop-filter: blur(10px);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .header h1 { 
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    margin-left: 20px;
                    opacity: 0.8;
                    transition: opacity 0.3s;
                }
                .header-nav a:hover { opacity: 1; }
                .container { 
                    max-width: 1200px; 
                    margin: 0 auto; 
                    padding: 40px 20px; 
                }
                .welcome-card {
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 15px;
                    padding: 30px;
                    color: white;
                    margin-bottom: 30px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .welcome-card h2 {
                    margin-bottom: 10px;
                    font-size: 28px;
                }
                .welcome-card p {
                    opacity: 0.8;
                    font-size: 16px;
                }
                .section-title {
                    color: white;
                    margin-bottom: 20px;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .menu-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 40px;
                }
                .menu-card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    text-decoration: none;
                    color: #333;
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    border: 2px solid transparent;
                }
                .menu-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 40px rgba(0,0,0,0.3);
                    border-color: #3498db;
                }
                .menu-card.internal { border-left: 5px solid #3498db; }
                .menu-card.thirdparty { border-left: 5px solid #e67e22; }
                .card-icon {
                    font-size: 40px;
                    margin-bottom: 15px;
                }
                .card-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .card-desc {
                    color: #666;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .card-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                    margin-top: 15px;
                    width: fit-content;
                }
                .card-badge.internal { 
                    background: #e3f2fd; 
                    color: #1976d2; 
                }
                .card-badge.thirdparty { 
                    background: #fff3e0; 
                    color: #e65100; 
                }
                .divider {
                    height: 1px;
                    background: rgba(255,255,255,0.2);
                    margin: 30px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🛡️ Security Services</h1>
                <div class="header-nav">
                    <a href="/dashboard">← Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="welcome-card">
                    <h2>Welcome, ${user.displayName}</h2>
                    <p>Manage Internal Security and Third Party Security operations</p>
                </div>
                
                <h3 class="section-title">👮 Internal Security</h3>
                <div class="menu-grid">
                    <a href="/security-services/delivery-log" class="menu-card internal">
                        <div class="card-icon">📦</div>
                        <div class="card-title">Delivery Log Sheet</div>
                        <div class="card-desc">Record and track all deliveries received at security checkpoints</div>
                        <span class="card-badge internal">Internal</span>
                    </a>
                    <a href="/security-services/internal/schedule" class="menu-card internal">
                        <div class="card-icon">📅</div>
                        <div class="card-title">Security Schedule</div>
                        <div class="card-desc">View and manage internal security officer schedules and shift assignments</div>
                        <span class="card-badge internal">Internal</span>
                    </a>
                    <a href="/security-services/internal/attendance" class="menu-card internal">
                        <div class="card-icon">✅</div>
                        <div class="card-title">Attendance Tracking</div>
                        <div class="card-desc">Track internal security officer attendance and timekeeping</div>
                        <span class="card-badge internal">Internal</span>
                    </a>
                    <a href="/security-services/internal/incidents" class="menu-card internal">
                        <div class="card-icon">⚠️</div>
                        <div class="card-title">Incident Reports</div>
                        <div class="card-desc">Log and manage internal security incident reports</div>
                        <span class="card-badge internal">Internal</span>
                    </a>
                </div>
                
                <div class="divider"></div>
                
                <h3 class="section-title">🤝 Third Party Security</h3>
                <div class="menu-grid">
                    <a href="/security-services/thirdparty/schedule" class="menu-card thirdparty">
                        <div class="card-icon">📅</div>
                        <div class="card-title">Third Party Schedule</div>
                        <div class="card-desc">View and manage third party security provider schedules</div>
                        <span class="card-badge thirdparty">Third Party</span>
                    </a>
                    <a href="/security-services/thirdparty/attendance" class="menu-card thirdparty">
                        <div class="card-icon">✅</div>
                        <div class="card-title">Attendance Tracking</div>
                        <div class="card-desc">Track third party security attendance and hours</div>
                        <span class="card-badge thirdparty">Third Party</span>
                    </a>
                    <a href="/security-services/thirdparty/providers" class="menu-card thirdparty">
                        <div class="card-icon">🏢</div>
                        <div class="card-title">Service Providers</div>
                        <div class="card-desc">Manage third party security service provider information</div>
                        <span class="card-badge thirdparty">Third Party</span>
                    </a>
                    <a href="/security-services/thirdparty/compliance" class="menu-card thirdparty">
                        <div class="card-icon">📋</div>
                        <div class="card-title">Compliance & Audits</div>
                        <div class="card-desc">Monitor third party security compliance and audit reports</div>
                        <span class="card-badge thirdparty">Third Party</span>
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Placeholder routes for sub-sections
router.get('/internal/:section', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Internal Security - ${req.params.section} - ${process.env.APP_NAME}</title>
            <style>
                body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
                .header h1 { font-size: 22px; }
                .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; }
                .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
                .coming-soon { background: white; border-radius: 15px; padding: 60px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
                .coming-soon h2 { color: #1976d2; margin-bottom: 15px; }
                .coming-soon p { color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>👮 Internal Security - ${req.params.section.charAt(0).toUpperCase() + req.params.section.slice(1)}</h1>
                <div class="header-nav">
                    <a href="/security-services">← Security Services</a>
                    <a href="/dashboard">Dashboard</a>
                </div>
            </div>
            <div class="container">
                <div class="coming-soon">
                    <h2>🚧 Coming Soon</h2>
                    <p>This feature is currently under development.</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

router.get('/thirdparty/:section', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Third Party Security - ${req.params.section} - ${process.env.APP_NAME}</title>
            <style>
                body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
                .header h1 { font-size: 22px; }
                .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; }
                .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
                .coming-soon { background: white; border-radius: 15px; padding: 60px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
                .coming-soon h2 { color: #e65100; margin-bottom: 15px; }
                .coming-soon p { color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🤝 Third Party Security - ${req.params.section.charAt(0).toUpperCase() + req.params.section.slice(1)}</h1>
                <div class="header-nav">
                    <a href="/security-services">← Security Services</a>
                    <a href="/dashboard">Dashboard</a>
                </div>
            </div>
            <div class="container">
                <div class="coming-soon">
                    <h2>🚧 Coming Soon</h2>
                    <p>This feature is currently under development.</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
