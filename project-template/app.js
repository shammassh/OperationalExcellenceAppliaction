/**
 * GMRL Application Template
 * Copy this as starting point for new apps
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Import auth module
const { initializeAuth, requireAuth, requireRole } = require('./auth/auth-server');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Authentication
initializeAuth(app);

// ==========================================
// Your Routes Here
// ==========================================

// Public home page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${process.env.APP_NAME || 'GMRL App'}</title>
            <style>
                body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
                .btn { padding: 10px 20px; background: #0078d4; color: white; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>${process.env.APP_NAME || 'GMRL App'}</h1>
            <p>Welcome! Please login to continue.</p>
            <a href="/auth/login" class="btn">Login with Microsoft</a>
        </body>
        </html>
    `);
});

// Protected dashboard
app.get('/dashboard', requireAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - ${process.env.APP_NAME}</title>
            <style>
                body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
                .user-info { background: #f0f0f0; padding: 20px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>Dashboard</h1>
            <div class="user-info">
                <p><strong>Welcome:</strong> ${req.currentUser.displayName}</p>
                <p><strong>Email:</strong> ${req.currentUser.email}</p>
                <p><strong>Role:</strong> ${req.currentUser.role}</p>
            </div>
            <p><a href="/auth/logout">Logout</a></p>
        </body>
        </html>
    `);
});

// Admin-only route example
app.get('/admin', requireAuth, requireRole('Admin'), (req, res) => {
    res.send('Admin Panel - Only admins can see this');
});

// API example
app.get('/api/data', requireAuth, (req, res) => {
    res.json({ 
        message: 'Hello from API',
        user: req.currentUser.email
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
        console.log(`🚀 ${process.env.APP_NAME} running on ${APP_URL}`);
    });
} else {
    http.createServer(app).listen(PORT, () => {
        console.log(`🚀 ${process.env.APP_NAME} running on ${APP_URL}`);
        console.log('⚠️  Running in HTTP mode (SSL not configured)');
    });
}

module.exports = app;
