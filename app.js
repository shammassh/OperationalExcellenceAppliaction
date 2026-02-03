/**
 * Operational Excellence App
 * Main application entry point
 */

const path = require('path');

// Load the correct .env file based on NODE_ENV
// Support both 'live' and 'production' for .env.live
const isProduction = process.env.NODE_ENV === 'live' || process.env.NODE_ENV === 'production';
const envFile = isProduction ? '.env.live' : '.env.uat';
require('dotenv').config({ path: path.join(__dirname, envFile) });

const express = require('express');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Import auth module
const { initializeAuth, requireAuth, requireRole } = require('./auth/auth-server');

// Import modules
const storesModule = require('./modules/stores');
const adminModule = require('./modules/admin');
const operationalExcellenceModule = require('./modules/operational-excellence');
const hrModule = require('./modules/hr');
const personnelModule = require('./modules/personnel');
const oeInspectionModule = require('./modules/oe-inspection');
const ohsModule = require('./modules/ohs');
const ohsInspectionModule = require('./modules/ohs-inspection');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize Authentication
initializeAuth(app);

// ==========================================
// Public Email Approval Routes (no auth required)
// ==========================================
const publicApprovalRoutes = require('./routes/public-approval');
app.use('/public/approve', publicApprovalRoutes);

// ==========================================
// Notifications Routes
// ==========================================
const notificationsRoutes = require('./routes/notifications');
app.use('/notifications', requireAuth, notificationsRoutes);

// Mount Modules
app.use('/stores', requireAuth, storesModule);
app.use('/admin', requireAuth, adminModule);
app.use('/operational-excellence', requireAuth, operationalExcellenceModule);
app.use('/oe-inspection', requireAuth, oeInspectionModule);
app.use('/hr', requireAuth, hrModule);
app.use('/personnel', requireAuth, personnelModule);
app.use('/ohs', requireAuth, ohsModule);
app.use('/ohs-inspection', requireAuth, ohsInspectionModule);

// ==========================================
// Routes
// ==========================================

// Public home page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${process.env.APP_NAME || 'Operational Excellence App'}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    max-width: 900px; 
                    margin: 50px auto; 
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                }
                h1 { color: #0078d4; margin-bottom: 10px; }
                .subtitle { color: #666; margin-bottom: 30px; }
                .btn { 
                    padding: 12px 30px; 
                    background: #0078d4; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px;
                    display: inline-block;
                    font-size: 16px;
                }
                .btn:hover { background: #005a9e; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${process.env.APP_NAME || 'Operational Excellence App'}</h1>
                <p class="subtitle">GMRL Operational Excellence Management System</p>
                <p>Welcome! Please login with your Microsoft account to continue.</p>
                <br>
                <a href="/auth/login" class="btn">Login with Microsoft</a>
            </div>
        </body>
        </html>
    `);
});

// Protected dashboard
app.get('/dashboard', requireAuth, (req, res) => {
    const role = req.currentUser.role;
    
    // Define which roles can see which departments
    const rolePermissions = {
        // System Admin and OE Department can see all
        'System Administrator': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Senior Inspector': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Inspector': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Implementation Inspector': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Head of Operational Excellence': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        
        // Executives can see all
        'Chief People & Support Officer': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Head of Talent Management': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Head of Operational Assurance and Support': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Lead Support and Execution Coordinator': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        'Head of Operations': ['stores', 'ohs', 'ohs-inspection', 'oe', 'oe-inspection', 'thirdparty', 'security', 'hr', 'personnel'],
        
        // Store-Level Users
        'Area Manager': ['stores', 'personnel'],
        'Store Manager': ['stores', 'personnel'],
        'Duty Manager': ['stores', 'personnel'],
        'Personnel Supervisor': ['stores', 'personnel'],
        
        // OHS Department
        'OHS Manager': ['ohs', 'ohs-inspection'],
        'OHS Officer': ['ohs', 'ohs-inspection'],
        
        // Third-Party Services
        'Senior Coordinator': ['thirdparty'],
        'Compliance Inspector': ['thirdparty'],
        'Payroll Officer': ['thirdparty'],
        
        // Security Department
        'Program Lead': ['security'],
        'Regional Security Manager': ['security'],
        'Security Compliance Inspector': ['security'],
        
        // HR & Talent
        'HR Officer': ['hr'],
        'Employee Relations Officer': ['hr'],
        
        // Facilities & Maintenance
        'Facility Services Supervisor': ['stores'],
        'Head of Maintenance': ['stores'],
        'Assistant Head of Maintenance': ['stores'],
        
        // External Providers
        'Cleaning Service Provider': ['thirdparty'],
        'Security Service Provider': ['security'],
        'Valet Service Provider': ['thirdparty'],
        'Other Service Provider': ['thirdparty']
    };
    
    const userPermissions = rolePermissions[role] || [];
    
    // Build menu items based on permissions
    const allMenuItems = [
        { id: 'stores', icon: '🏪', title: 'Stores', href: '/stores', desc: 'Store operations & management' },
        { id: 'personnel', icon: '👤', title: 'Personnel', href: '/personnel', desc: 'Personnel forms & requests' },
        { id: 'ohs', icon: '🦺', title: 'Occupational Health & Safety', href: '/ohs', desc: 'OHS incidents & inspections' },
        { id: 'ohs-inspection', icon: '🛡️', title: 'OHS Inspection', href: '/ohs-inspection', desc: 'OHS safety inspections & audits' },
        { id: 'oe', icon: '📋', title: 'Operational Excellence', href: '/operational-excellence', desc: 'Audits, action plans & reports' },
        { id: 'oe-inspection', icon: '🔍', title: 'OE Inspection', href: '/oe-inspection', desc: 'OE inspections, reports & action plans' },
        { id: 'thirdparty', icon: '🤝', title: 'Third-Party Services', href: '/third-party', desc: 'Service providers & compliance' },
        { id: 'security', icon: '🔒', title: 'Security Department', href: '/security', desc: 'Security incidents & inspections' },
        { id: 'hr', icon: '👥', title: 'HR & Talent', href: '/hr', desc: 'Employee relations & cases' }
    ];
    
    const visibleMenuItems = allMenuItems.filter(item => userPermissions.includes(item.id));
    
    const menuHtml = visibleMenuItems.map(item => `
        <a href="${item.href}" class="menu-item">
            <div class="menu-icon">${item.icon}</div>
            <div class="menu-title">${item.title}</div>
            <div class="menu-desc">${item.desc}</div>
        </a>
    `).join('');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - ${process.env.APP_NAME}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    max-width: 1200px; 
                    margin: 0 auto; 
                    padding: 20px;
                    background: #f5f5f5;
                }
                .header {
                    background: #0078d4;
                    color: white;
                    padding: 20px;
                    border-radius: 10px 10px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .content {
                    background: white;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .user-card {
                    background: #f0f7ff;
                    padding: 20px;
                    border-radius: 8px;
                    border-left: 4px solid #0078d4;
                    margin-bottom: 20px;
                }
                .logout-btn {
                    background: white;
                    color: #0078d4;
                    padding: 8px 20px;
                    border-radius: 5px;
                    text-decoration: none;
                }
                .menu-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .menu-item {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 25px;
                    border-radius: 12px;
                    text-align: center;
                    text-decoration: none;
                    color: #333;
                    transition: all 0.3s ease;
                    border: 1px solid #dee2e6;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .menu-item:hover {
                    background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
                    color: white;
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,120,212,0.3);
                }
                .menu-icon {
                    font-size: 48px;
                    margin-bottom: 15px;
                }
                .menu-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .menu-desc {
                    font-size: 13px;
                    opacity: 0.8;
                }
                .no-access {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                .notification-bell {
                    position: relative;
                    background: rgba(255,255,255,0.15);
                    padding: 10px 15px;
                    border-radius: 8px;
                    text-decoration: none;
                    color: white;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                }
                .notification-bell:hover {
                    background: rgba(255,255,255,0.25);
                }
                .notification-badge {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #e74c3c;
                    color: white;
                    font-size: 11px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 10px;
                    min-width: 18px;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Operational Excellence Dashboard</h1>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <a href="/notifications" class="notification-bell" id="notificationBell">
                        🔔
                        <span class="notification-badge" id="notificationCount" style="display: none;">0</span>
                    </a>
                    ${req.currentUser.roleId === 31 ? '<a href="/admin" style="background:#1a1a2e;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">⚙️ Admin Panel</a>' : ''}
                    <a href="/auth/logout" class="logout-btn">Logout</a>
                </div>
            </div>
            <div class="content">
                <div class="user-card">
                    <p><strong>Welcome:</strong> ${req.currentUser.displayName}</p>
                    <p><strong>Email:</strong> ${req.currentUser.email}</p>
                    <p><strong>Role:</strong> ${req.currentUser.role}</p>
                </div>
                
                <h2>Departments</h2>
                <div class="menu-grid">
                    ${menuHtml || '<div class="no-access">No departments assigned. Please contact your administrator.</div>'}
                </div>
            </div>
            
            <script>
                // Load notification count
                async function loadNotificationCount() {
                    try {
                        const res = await fetch('/notifications/count');
                        const data = await res.json();
                        const badge = document.getElementById('notificationCount');
                        if (data.count > 0) {
                            badge.textContent = data.count > 99 ? '99+' : data.count;
                            badge.style.display = 'block';
                        } else {
                            badge.style.display = 'none';
                        }
                    } catch (err) {
                        console.error('Error loading notifications:', err);
                    }
                }
                
                // Load on page load
                loadNotificationCount();
                
                // Refresh every 60 seconds
                setInterval(loadNotificationCount, 60000);
            </script>
        </body>
        </html>
    `);
});

// API endpoints
app.get('/api/user', requireAuth, (req, res) => {
    res.json({ 
        success: true,
        user: {
            displayName: req.currentUser.displayName,
            email: req.currentUser.email,
            role: req.currentUser.role
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        app: process.env.APP_NAME,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// Start Server
// ==========================================

const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

const USE_HTTPS = SSL_KEY_PATH && SSL_CERT_PATH && 
                  fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);

if (USE_HTTPS) {
    const httpsOptions = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH)
    };
    
    if (process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH)) {
        httpsOptions.ca = fs.readFileSync(process.env.SSL_CA_PATH);
    }
    
    https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log('='.repeat(60));
        console.log(`🚀 ${process.env.APP_NAME} (HTTPS)`);
        console.log('='.repeat(60));
        console.log(`✅ Server running on ${APP_URL}`);
        console.log(`🔒 SSL Certificate: ${SSL_CERT_PATH}`);
        console.log('='.repeat(60));
    });
} else {
    http.createServer(app).listen(PORT, () => {
        console.log('='.repeat(60));
        console.log(`🚀 ${process.env.APP_NAME} (HTTP)`);
        console.log('='.repeat(60));
        console.log(`✅ Server running on ${APP_URL}`);
        console.log('⚠️  Running in HTTP mode (behind IIS reverse proxy)');
        if (SSL_KEY_PATH) console.log(`   Key path: ${SSL_KEY_PATH} (exists: ${fs.existsSync(SSL_KEY_PATH)})`);
        if (SSL_CERT_PATH) console.log(`   Cert path: ${SSL_CERT_PATH} (exists: ${fs.existsSync(SSL_CERT_PATH)})`);
        console.log('='.repeat(60));
    });
}

module.exports = app;
