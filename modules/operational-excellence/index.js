/**
 * Operational Excellence Module
 * Main router for OE features
 */

const express = require('express');
const router = express.Router();

// Import sub-modules
const theftDashboard = require('./theft-dashboard');
const systemSettings = require('./system-settings');
const extraCleaningReview = require('./extra-cleaning-review');
const productionDashboard = require('./production-dashboard');

// Mount sub-routes
router.use('/theft-dashboard', theftDashboard);
router.use('/system-settings', systemSettings);
router.use('/extra-cleaning-review', extraCleaningReview);
router.use('/production-dashboard', productionDashboard);

// Landing page
router.get('/', (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Operational Excellence - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                    font-size: 16px;
                }
                
                .cards-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 25px;
                }
                
                .card {
                    background: white;
                    border-radius: 16px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    transition: transform 0.3s, box-shadow 0.3s;
                    text-decoration: none;
                    color: inherit;
                    display: block;
                }
                .card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 50px rgba(0,0,0,0.3);
                }
                
                .card-icon {
                    font-size: 48px;
                    margin-bottom: 20px;
                }
                
                .card-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .card-desc {
                    color: #666;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 20px;
                }
                
                .card-stats {
                    display: flex;
                    gap: 20px;
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                }
                
                .stat {
                    text-align: center;
                }
                
                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #667eea;
                }
                
                .stat-label {
                    font-size: 11px;
                    color: #888;
                    text-transform: uppercase;
                }
                
                .card.theft { border-left: 4px solid #dc3545; }
                .card.theft .stat-value { color: #dc3545; }
                
                .card.audit { border-left: 4px solid #28a745; }
                .card.audit .stat-value { color: #28a745; }
                
                .card.action { border-left: 4px solid #fd7e14; }
                .card.action .stat-value { color: #fd7e14; }
                
                .badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .badge-warning { background: #fff3cd; color: #856404; }
                .badge-danger { background: #f8d7da; color: #721c24; }
                .badge-success { background: #d4edda; color: #155724; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 Operational Excellence</h1>
                <div class="header-nav">
                    <a href="/dashboard">🏠 Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="page-title">
                    <h2>Operational Excellence Hub</h2>
                    <p>Audits, action plans, and performance monitoring</p>
                </div>
                
                <div class="cards-grid">
                    <!-- Extra Cleaning Review -->
                    <a href="/operational-excellence/extra-cleaning-review" class="card" style="border-left: 4px solid #17a2b8;">
                        <div class="card-icon">🧹</div>
                        <div class="card-title">Extra Cleaning Review</div>
                        <div class="card-desc">
                            Review and approve extra cleaning agent requests from stores. 
                            Track approvals and manage third-party cleaning services.
                        </div>
                        <div class="card-stats">
                            <div class="stat">
                                <div class="stat-value" id="cleaningPending" style="color: #ffc107;">-</div>
                                <div class="stat-label">Pending</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" id="cleaningToday" style="color: #17a2b8;">-</div>
                                <div class="stat-label">Today</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" id="cleaningMonth" style="color: #28a745;">-</div>
                                <div class="stat-label">This Month</div>
                            </div>
                        </div>
                    </a>
                    
                    <!-- Production Extras Dashboard -->
                    <a href="/operational-excellence/production-dashboard" class="card" style="border-left: 4px solid #667eea;">
                        <div class="card-icon">👷</div>
                        <div class="card-title">Production Extras Dashboard</div>
                        <div class="card-desc">
                            Review and approve production extras requests. 
                            Manage third-party production agents and track costs.
                        </div>
                        <div class="card-stats">
                            <div class="stat">
                                <div class="stat-value" id="productionPending" style="color: #ffc107;">-</div>
                                <div class="stat-label">Pending</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" id="productionToday" style="color: #667eea;">-</div>
                                <div class="stat-label">Today</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" id="productionMonth" style="color: #28a745;">-</div>
                                <div class="stat-label">This Month</div>
                            </div>
                        </div>
                    </a>
                    
                    <!-- System Settings -->
                    <a href="/operational-excellence/system-settings" class="card" style="border-left: 4px solid #667eea;">
                        <div class="card-icon">⚙️</div>
                        <div class="card-title">System Settings</div>
                        <div class="card-desc">
                            Manage global settings: Stores, Cleaning Categories, and Third Party Providers 
                            used across all modules.
                        </div>
                        <div class="card-stats">
                            <div class="stat">
                                <div class="stat-value" style="color: #667eea;">🏪</div>
                                <div class="stat-label">Stores</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" style="color: #667eea;">📁</div>
                                <div class="stat-label">Categories</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" style="color: #667eea;">🏢</div>
                                <div class="stat-label">Providers</div>
                            </div>
                        </div>
                    </a>
                    
                    <!-- Theft Incident Dashboard -->
                    <a href="/operational-excellence/theft-dashboard" class="card theft">
                        <div class="card-icon">🚨</div>
                        <div class="card-title">Theft Incident Dashboard</div>
                        <div class="card-desc">
                            Review and process theft incident reports from all stores. 
                            Verify details, approve, or request additional information.
                        </div>
                        <div class="card-stats">
                            <div class="stat">
                                <div class="stat-value" id="pendingCount">-</div>
                                <div class="stat-label">Pending Review</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" id="todayCount">-</div>
                                <div class="stat-label">Today</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value" id="monthCount">-</div>
                                <div class="stat-label">This Month</div>
                            </div>
                        </div>
                    </a>
                    
                    <!-- Future: Store Audits -->
                    <div class="card audit" style="opacity: 0.6; cursor: not-allowed;">
                        <div class="card-icon">📝</div>
                        <div class="card-title">Store Audits</div>
                        <div class="card-desc">
                            Conduct and review store audit reports. Track compliance scores 
                            and follow-up on action items.
                        </div>
                        <div class="card-stats">
                            <div class="stat">
                                <div class="stat-value">-</div>
                                <div class="stat-label">Coming Soon</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Future: Action Plans -->
                    <div class="card action" style="opacity: 0.6; cursor: not-allowed;">
                        <div class="card-icon">📊</div>
                        <div class="card-title">Action Plans</div>
                        <div class="card-desc">
                            Create and track action plans. Monitor progress and ensure 
                            timely completion of improvement initiatives.
                        </div>
                        <div class="card-stats">
                            <div class="stat">
                                <div class="stat-value">-</div>
                                <div class="stat-label">Coming Soon</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                // Load stats for theft dashboard card
                fetch('/operational-excellence/theft-dashboard/api/stats')
                    .then(r => r.json())
                    .then(data => {
                        document.getElementById('pendingCount').textContent = data.pending || 0;
                        document.getElementById('todayCount').textContent = data.today || 0;
                        document.getElementById('monthCount').textContent = data.month || 0;
                    })
                    .catch(err => {
                        console.error('Error loading theft stats:', err);
                    });
                
                // Load stats for extra cleaning review card
                fetch('/operational-excellence/extra-cleaning-review/api/stats')
                    .then(r => r.json())
                    .then(data => {
                        document.getElementById('cleaningPending').textContent = data.pending || 0;
                        document.getElementById('cleaningToday').textContent = data.today || 0;
                        document.getElementById('cleaningMonth').textContent = data.thisMonth || 0;
                    })
                    .catch(err => {
                        console.error('Error loading cleaning stats:', err);
                    });
                
                // Load stats for production dashboard card
                fetch('/operational-excellence/production-dashboard/api/stats')
                    .then(r => r.json())
                    .then(data => {
                        document.getElementById('productionPending').textContent = data.pending || 0;
                        document.getElementById('productionToday').textContent = data.today || 0;
                        document.getElementById('productionMonth').textContent = data.thisMonth || 0;
                    })
                    .catch(err => {
                        console.error('Error loading production stats:', err);
                    });
            </script>
        </body>
        </html>
    `);
});

module.exports = router;
