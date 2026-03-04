/**
 * Post Visit Report Routes
 * Security department post-visit reporting form
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../../uploads/post-visit-report');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'incident-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Only image and document files are allowed'));
    }
});

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

// Main page - Post Visit Report Form
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get stores from database
        const storesResult = await pool.request()
            .query(`SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName`);
        
        const stores = storesResult.recordset;
        await pool.close();
        
        // Current user info
        const currentUser = req.currentUser || {};
        
        const storeOptions = stores.map(s => 
            `<option value="${s.Id}" data-name="${s.StoreName}">${s.StoreName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Post Visit Report - ${process.env.APP_NAME}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header-nav { display: flex; gap: 15px; flex-wrap: wrap; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); transition: all 0.2s; }
                    .header-nav a:hover { background: rgba(255,255,255,0.25); }
                    .container { max-width: 1000px; margin: 30px auto; padding: 0 20px; }
                    .form-card { background: white; border-radius: 12px; box-shadow: 0 2px 15px rgba(0,0,0,0.08); overflow: hidden; }
                    .form-header { background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); color: white; padding: 25px; text-align: center; }
                    .form-header h2 { margin: 0; font-size: 22px; }
                    .form-header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
                    .form-body { padding: 30px; }
                    .form-section { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
                    .form-section:last-child { border-bottom: none; }
                    .form-section h3 { color: #2d3436; font-size: 16px; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 2px solid #2d3436; display: inline-block; }
                    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px; }
                    .form-group label span.required { color: #e74c3c; }
                    .form-group input, .form-group select, .form-group textarea { 
                        width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; 
                        font-size: 14px; transition: all 0.2s; font-family: inherit;
                    }
                    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
                        outline: none; border-color: #2d3436; box-shadow: 0 0 0 3px rgba(45,52,54,0.1); 
                    }
                    .form-group textarea { min-height: 80px; resize: vertical; }
                    
                    /* Question Number */
                    .question-number { 
                        display: inline-flex; align-items: center; justify-content: center;
                        width: 24px; height: 24px; background: #2d3436; color: white; 
                        border-radius: 50%; font-size: 12px; font-weight: 600; margin-right: 8px;
                    }
                    
                    /* Star Rating */
                    .rating-container { margin-bottom: 20px; }
                    .rating-label { font-weight: 600; color: #333; margin-bottom: 10px; display: block; }
                    .rating-scale { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                    .rating-scale .scale-label { font-size: 12px; color: #666; min-width: 120px; }
                    .rating-scale .scale-label.left { text-align: right; }
                    .rating-scale .scale-label.right { text-align: left; }
                    .stars { display: flex; gap: 5px; }
                    .stars input { display: none; }
                    .stars label { cursor: pointer; font-size: 36px; color: #ddd; transition: color 0.2s; }
                    .stars label:hover, .stars label:hover ~ label { color: #f1c40f; }
                    .stars input:checked ~ label { color: #f1c40f; }
                    .stars-rtl { direction: rtl; }
                    .stars-rtl input:checked ~ label { color: #f1c40f; }
                    .stars-rtl label:hover, .stars-rtl label:hover ~ label { color: #f1c40f; }
                    
                    /* Matrix Table */
                    .matrix-container { overflow-x: auto; margin-bottom: 20px; }
                    .matrix-table { width: 100%; border-collapse: collapse; min-width: 600px; }
                    .matrix-table th { background: #f8f9fa; padding: 12px 8px; text-align: center; font-size: 12px; color: #666; border-bottom: 2px solid #dee2e6; }
                    .matrix-table th:first-child { text-align: left; min-width: 180px; }
                    .matrix-table td { padding: 12px 8px; text-align: center; border-bottom: 1px solid #eee; }
                    .matrix-table td:first-child { text-align: left; font-weight: 500; color: #333; }
                    .matrix-table input[type="radio"] { width: 20px; height: 20px; cursor: pointer; accent-color: #2d3436; }
                    .matrix-table tr:hover { background: #f8f9fa; }
                    
                    /* Yes/No Toggle */
                    .yes-no-toggle { display: flex; gap: 10px; }
                    .yes-no-btn { 
                        padding: 10px 25px; border: 2px solid #ddd; border-radius: 8px; 
                        cursor: pointer; font-weight: 600; transition: all 0.2s; background: white;
                    }
                    .yes-no-btn:hover { border-color: #2d3436; }
                    .yes-no-btn.yes.selected { background: #00b894; border-color: #00b894; color: white; }
                    .yes-no-btn.no.selected { background: #d63031; border-color: #d63031; color: white; }
                    .yes-no-btn input { display: none; }
                    
                    /* Company Selection */
                    .company-radio-group { display: flex; gap: 15px; flex-wrap: wrap; }
                    .company-radio { 
                        flex: 1; min-width: 120px; padding: 15px; border: 2px solid #ddd; border-radius: 10px; 
                        text-align: center; cursor: pointer; transition: all 0.2s;
                    }
                    .company-radio:hover { border-color: #2d3436; background: #f8f9fa; }
                    .company-radio input { display: none; }
                    .company-radio.selected { border-color: #2d3436; background: #2d3436; color: white; }
                    .company-radio span { font-weight: 600; }
                    
                    /* Incident Type Radio */
                    .incident-type-group { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px; }
                    .incident-type-item { 
                        padding: 12px 20px; border: 2px solid #ddd; border-radius: 8px; 
                        cursor: pointer; transition: all 0.2s;
                    }
                    .incident-type-item:hover { border-color: #2d3436; }
                    .incident-type-item.selected { border-color: #e17055; background: #e17055; color: white; }
                    .incident-type-item input { display: none; }
                    
                    /* Conditional Sections */
                    .conditional-section { display: none; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #2d3436; }
                    .conditional-section.visible { display: block; }
                    
                    /* File Upload */
                    .file-upload-area { 
                        border: 2px dashed #ddd; border-radius: 12px; padding: 30px; text-align: center; 
                        cursor: pointer; transition: all 0.2s; position: relative;
                    }
                    .file-upload-area:hover { border-color: #2d3436; background: #f8f9fa; }
                    .file-upload-area input { display: none; }
                    .file-upload-area .icon { font-size: 40px; margin-bottom: 10px; }
                    .file-upload-area p { color: #666; font-size: 14px; }
                    .file-preview { margin-top: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px; display: none; }
                    .file-preview.visible { display: flex; align-items: center; justify-content: space-between; }
                    .file-preview .file-name { font-weight: 500; color: #2e7d32; }
                    .file-preview .remove-file { background: #ef5350; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
                    
                    .user-info { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
                    .user-info p { margin: 5px 0; font-size: 14px; }
                    .user-info strong { color: #2d3436; }
                    
                    .btn-submit { 
                        width: 100%; padding: 16px; background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); 
                        color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; 
                        cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px;
                    }
                    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(45,52,54,0.3); }
                    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                    
                    .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: 600; display: none; z-index: 1000; }
                    .toast-success { background: #00b894; }
                    .toast-error { background: #d63031; }
                    
                    @media (max-width: 600px) {
                        .form-row { grid-template-columns: 1fr; }
                        .company-radio-group { flex-direction: column; }
                        .rating-scale { flex-direction: column; align-items: flex-start; }
                        .rating-scale .scale-label { text-align: left !important; }
                        .header { padding: 15px; }
                        .header h1 { font-size: 18px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Post Visit Report</h1>
                    <div class="header-nav">
                        <a href="/security-emp/post-visit-report/history">📜 View Reports</a>
                        <a href="/dashboard">← Back to Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="form-card">
                        <div class="form-header">
                            <h2>Post Visit Report Form</h2>
                            <p>Submit your post-visit assessment for the store</p>
                        </div>
                        <div class="form-body">
                            <form id="reportForm" method="POST" action="/security-emp/post-visit-report/submit" enctype="multipart/form-data">
                                
                                <!-- SECTION 1: Basic Information -->
                                <div class="form-section">
                                    <h3>📍 Visit Information</h3>
                                    
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label><span class="question-number">1</span>Store Name <span class="required">*</span></label>
                                            <select name="storeId" id="storeId" required>
                                                <option value="">Select Store</option>
                                                ${storeOptions}
                                            </select>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">2</span>Visit Date <span class="required">*</span></label>
                                            <input type="date" name="visitDate" id="visitDate" required value="${new Date().toISOString().split('T')[0]}">
                                        </div>
                                    </div>
                                    
                                    <div class="user-info">
                                        <p><strong>Submitted By:</strong> ${currentUser.displayName || currentUser.email || 'Unknown'}</p>
                                        <p><strong>Email:</strong> ${currentUser.email || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                <!-- SECTION 2: Overall Rating -->
                                <div class="form-section">
                                    <h3>⭐ Overall Rating</h3>
                                    
                                    <div class="rating-container">
                                        <label class="rating-label"><span class="question-number">3</span>Overall Rating <span class="required">*</span></label>
                                        <div class="rating-scale">
                                            <span class="scale-label left">Extremely dissatisfied</span>
                                            <div class="stars stars-rtl">
                                                <input type="radio" name="overallRating" value="5" id="overall5" required><label for="overall5">★</label>
                                                <input type="radio" name="overallRating" value="4" id="overall4"><label for="overall4">★</label>
                                                <input type="radio" name="overallRating" value="3" id="overall3"><label for="overall3">★</label>
                                                <input type="radio" name="overallRating" value="2" id="overall2"><label for="overall2">★</label>
                                                <input type="radio" name="overallRating" value="1" id="overall1"><label for="overall1">★</label>
                                            </div>
                                            <span class="scale-label right">Extremely satisfied</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- SECTION 3: In-house Guards -->
                                <div class="form-section">
                                    <h3>🛡️ In-house Guards</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">4</span>In-house Guards Assessment <span class="required">*</span></label>
                                        <div class="matrix-container">
                                            <table class="matrix-table">
                                                <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th>Not well at all</th>
                                                        <th>Not very well</th>
                                                        <th>Somewhat well</th>
                                                        <th>Very well</th>
                                                        <th>Extremely well</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td>Uniform</td>
                                                        <td><input type="radio" name="inHouseUniform" value="1" required></td>
                                                        <td><input type="radio" name="inHouseUniform" value="2"></td>
                                                        <td><input type="radio" name="inHouseUniform" value="3"></td>
                                                        <td><input type="radio" name="inHouseUniform" value="4"></td>
                                                        <td><input type="radio" name="inHouseUniform" value="5"></td>
                                                    </tr>
                                                    <tr>
                                                        <td>Position</td>
                                                        <td><input type="radio" name="inHousePosition" value="1" required></td>
                                                        <td><input type="radio" name="inHousePosition" value="2"></td>
                                                        <td><input type="radio" name="inHousePosition" value="3"></td>
                                                        <td><input type="radio" name="inHousePosition" value="4"></td>
                                                        <td><input type="radio" name="inHousePosition" value="5"></td>
                                                    </tr>
                                                    <tr>
                                                        <td>Control Room</td>
                                                        <td><input type="radio" name="inHouseControlRoom" value="1" required></td>
                                                        <td><input type="radio" name="inHouseControlRoom" value="2"></td>
                                                        <td><input type="radio" name="inHouseControlRoom" value="3"></td>
                                                        <td><input type="radio" name="inHouseControlRoom" value="4"></td>
                                                        <td><input type="radio" name="inHouseControlRoom" value="5"></td>
                                                    </tr>
                                                    <tr>
                                                        <td>Control Sheets & Filling</td>
                                                        <td><input type="radio" name="inHouseControlSheets" value="1" required></td>
                                                        <td><input type="radio" name="inHouseControlSheets" value="2"></td>
                                                        <td><input type="radio" name="inHouseControlSheets" value="3"></td>
                                                        <td><input type="radio" name="inHouseControlSheets" value="4"></td>
                                                        <td><input type="radio" name="inHouseControlSheets" value="5"></td>
                                                    </tr>
                                                    <tr>
                                                        <td>Behavior</td>
                                                        <td><input type="radio" name="inHouseBehavior" value="1" required></td>
                                                        <td><input type="radio" name="inHouseBehavior" value="2"></td>
                                                        <td><input type="radio" name="inHouseBehavior" value="3"></td>
                                                        <td><input type="radio" name="inHouseBehavior" value="4"></td>
                                                        <td><input type="radio" name="inHouseBehavior" value="5"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">5</span>Comments on In-house Guards</label>
                                        <textarea name="inHouseComments" placeholder="Enter your comments about in-house guards..."></textarea>
                                    </div>
                                </div>
                                
                                <!-- SECTION 4: Third-Party Guards -->
                                <div class="form-section">
                                    <h3>🔒 Third-Party Guards</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">6</span>Third-Party Guards available? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'thirdPartyAvailable', 'yes'); toggleThirdPartySection(true);">
                                                <input type="radio" name="thirdPartyAvailable" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'thirdPartyAvailable', 'no'); toggleThirdPartySection(false);">
                                                <input type="radio" name="thirdPartyAvailable" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Third-Party = YES Section -->
                                    <div class="conditional-section" id="thirdPartyYesSection">
                                        <div class="form-group">
                                            <label><span class="question-number">7</span>Security Company <span class="required">*</span></label>
                                            <div class="company-radio-group">
                                                <div class="company-radio" onclick="selectCompany(this, 'Protectron')">
                                                    <input type="radio" name="securityCompany" value="Protectron">
                                                    <span>Protectron</span>
                                                </div>
                                                <div class="company-radio" onclick="selectCompany(this, 'Middle East')">
                                                    <input type="radio" name="securityCompany" value="Middle East">
                                                    <span>Middle East</span>
                                                </div>
                                                <div class="company-radio" onclick="selectCompany(this, 'I-Secure')">
                                                    <input type="radio" name="securityCompany" value="I-Secure">
                                                    <span>I-Secure</span>
                                                </div>
                                                <div class="company-radio" onclick="selectCompany(this, 'Forearm')">
                                                    <input type="radio" name="securityCompany" value="Forearm">
                                                    <span>Forearm</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">8</span>Third-Party Guards Assessment <span class="required">*</span></label>
                                            <div class="matrix-container">
                                                <table class="matrix-table">
                                                    <thead>
                                                        <tr>
                                                            <th></th>
                                                            <th>Not well at all</th>
                                                            <th>Not very well</th>
                                                            <th>Somewhat well</th>
                                                            <th>Very well</th>
                                                            <th>Extremely well</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td>Uniform</td>
                                                            <td><input type="radio" name="thirdPartyUniform" value="1"></td>
                                                            <td><input type="radio" name="thirdPartyUniform" value="2"></td>
                                                            <td><input type="radio" name="thirdPartyUniform" value="3"></td>
                                                            <td><input type="radio" name="thirdPartyUniform" value="4"></td>
                                                            <td><input type="radio" name="thirdPartyUniform" value="5"></td>
                                                        </tr>
                                                        <tr>
                                                            <td>Position</td>
                                                            <td><input type="radio" name="thirdPartyPosition" value="1"></td>
                                                            <td><input type="radio" name="thirdPartyPosition" value="2"></td>
                                                            <td><input type="radio" name="thirdPartyPosition" value="3"></td>
                                                            <td><input type="radio" name="thirdPartyPosition" value="4"></td>
                                                            <td><input type="radio" name="thirdPartyPosition" value="5"></td>
                                                        </tr>
                                                        <tr>
                                                            <td>Control Sheets & Filling</td>
                                                            <td><input type="radio" name="thirdPartyControlSheets" value="1"></td>
                                                            <td><input type="radio" name="thirdPartyControlSheets" value="2"></td>
                                                            <td><input type="radio" name="thirdPartyControlSheets" value="3"></td>
                                                            <td><input type="radio" name="thirdPartyControlSheets" value="4"></td>
                                                            <td><input type="radio" name="thirdPartyControlSheets" value="5"></td>
                                                        </tr>
                                                        <tr>
                                                            <td>Behavior</td>
                                                            <td><input type="radio" name="thirdPartyBehavior" value="1"></td>
                                                            <td><input type="radio" name="thirdPartyBehavior" value="2"></td>
                                                            <td><input type="radio" name="thirdPartyBehavior" value="3"></td>
                                                            <td><input type="radio" name="thirdPartyBehavior" value="4"></td>
                                                            <td><input type="radio" name="thirdPartyBehavior" value="5"></td>
                                                        </tr>
                                                        <tr>
                                                            <td>Attendance</td>
                                                            <td><input type="radio" name="thirdPartyAttendance" value="1"></td>
                                                            <td><input type="radio" name="thirdPartyAttendance" value="2"></td>
                                                            <td><input type="radio" name="thirdPartyAttendance" value="3"></td>
                                                            <td><input type="radio" name="thirdPartyAttendance" value="4"></td>
                                                            <td><input type="radio" name="thirdPartyAttendance" value="5"></td>
                                                        </tr>
                                                        <tr>
                                                            <td>Respecting Job Description</td>
                                                            <td><input type="radio" name="thirdPartyJobDescription" value="1"></td>
                                                            <td><input type="radio" name="thirdPartyJobDescription" value="2"></td>
                                                            <td><input type="radio" name="thirdPartyJobDescription" value="3"></td>
                                                            <td><input type="radio" name="thirdPartyJobDescription" value="4"></td>
                                                            <td><input type="radio" name="thirdPartyJobDescription" value="5"></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">9</span>Comments on Third-Party Guards</label>
                                            <textarea name="thirdPartyComments" placeholder="Enter your comments about third-party guards..."></textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- SECTION 4: Incident -->
                                <div class="form-section">
                                    <h3>⚠️ Incident</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">7</span>Was there an Incident? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'hasIncident', 'yes'); toggleIncidentSection(true);">
                                                <input type="radio" name="hasIncident" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'hasIncident', 'no'); toggleIncidentSection(false);">
                                                <input type="radio" name="hasIncident" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Incident = NO Section (Comments) -->
                                    <div class="conditional-section" id="incidentNoSection">
                                        <div class="form-group">
                                            <label>Comments</label>
                                            <textarea name="noIncidentComments" placeholder="Enter any comments..."></textarea>
                                        </div>
                                    </div>
                                    
                                    <!-- Incident = YES Section -->
                                    <div class="conditional-section" id="incidentYesSection">
                                        <div class="form-group">
                                            <label><span class="question-number">8</span>Incident Type <span class="required">*</span></label>
                                            <div class="incident-type-group">
                                                <div class="incident-type-item" onclick="selectIncidentType(this, 'staff_related'); toggleStaffIncident(true); toggleOtherIncident(false);">
                                                    <input type="radio" name="incidentType" value="staff_related">
                                                    <span>Staff Related</span>
                                                </div>
                                                <div class="incident-type-item" onclick="selectIncidentType(this, 'other'); toggleStaffIncident(false); toggleOtherIncident(true);">
                                                    <input type="radio" name="incidentType" value="other">
                                                    <span>Other</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- Staff Related Incident Section -->
                                        <div class="conditional-section" id="staffIncidentSection">
                                            <div class="form-group">
                                                <label><span class="question-number">9</span>Staff Name <span class="required">*</span></label>
                                                <input type="text" name="staffName" placeholder="Enter staff name...">
                                            </div>
                                            
                                            <div class="form-group">
                                                <label><span class="question-number">10</span>Employee ID <span class="required">*</span></label>
                                                <input type="text" name="staffEmployeeId" placeholder="Enter employee ID...">
                                            </div>
                                            
                                            <div class="form-group">
                                                <label><span class="question-number">11</span>Position <span class="required">*</span></label>
                                                <input type="text" name="staffPosition" placeholder="Enter position...">
                                            </div>
                                            
                                            <div class="form-group">
                                                <label><span class="question-number">12</span>Incident Description - Staff <span class="required">*</span></label>
                                                <textarea name="staffIncidentDescription" placeholder="Describe the staff-related incident..."></textarea>
                                            </div>
                                            
                                            <div class="form-group">
                                                <label><span class="question-number">13</span>Add Attachments? <span class="required">*</span></label>
                                                <div class="yes-no-toggle">
                                                    <div class="yes-no-btn yes" onclick="selectYesNo(this, 'staffHasAttachment', 'yes'); toggleStaffAttachment(true);">
                                                        <input type="radio" name="staffHasAttachment" value="yes">Yes
                                                    </div>
                                                    <div class="yes-no-btn no" onclick="selectYesNo(this, 'staffHasAttachment', 'no'); toggleStaffAttachment(false);">
                                                        <input type="radio" name="staffHasAttachment" value="no">No
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- Staff Attachment Section -->
                                            <div class="conditional-section" id="staffAttachmentSection">
                                                <div class="form-group">
                                                    <label>Upload Attachment</label>
                                                    <div class="file-upload-area" onclick="document.getElementById('staffAttachment').click()">
                                                        <input type="file" name="staffAttachment" id="staffAttachment" accept="image/*,.pdf,.doc,.docx">
                                                        <div class="icon">📎</div>
                                                        <p>Click to upload a file</p>
                                                        <small style="color: #999;">Images, PDF, DOC (Max 10MB)</small>
                                                    </div>
                                                    <div class="file-preview" id="staffFilePreview">
                                                        <span class="file-name" id="staffFileName"></span>
                                                        <button type="button" class="remove-file" onclick="removeStaffFile(event)">Remove</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- Other Incident Section -->
                                        <div class="conditional-section" id="otherIncidentSection">
                                            <div class="form-group">
                                                <label><span class="question-number">9</span>Incident Description <span class="required">*</span></label>
                                                <textarea name="incidentDescription" placeholder="Describe the incident..."></textarea>
                                            </div>
                                            
                                            <div class="form-group">
                                                <label><span class="question-number">10</span>Add Attachments? <span class="required">*</span></label>
                                                <div class="yes-no-toggle">
                                                    <div class="yes-no-btn yes" onclick="selectYesNo(this, 'otherHasAttachment', 'yes'); toggleOtherAttachment(true);">
                                                        <input type="radio" name="otherHasAttachment" value="yes">Yes
                                                    </div>
                                                    <div class="yes-no-btn no" onclick="selectYesNo(this, 'otherHasAttachment', 'no'); toggleOtherAttachment(false);">
                                                        <input type="radio" name="otherHasAttachment" value="no">No
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- Other Attachment Section -->
                                            <div class="conditional-section" id="otherAttachmentSection">
                                                <div class="form-group">
                                                    <label>Upload Attachment</label>
                                                    <div class="file-upload-area" onclick="document.getElementById('incidentAttachment').click()">
                                                        <input type="file" name="incidentAttachment" id="incidentAttachment" accept="image/*,.pdf,.doc,.docx">
                                                        <div class="icon">📎</div>
                                                        <p>Click to upload a file</p>
                                                        <small style="color: #999;">Images, PDF, DOC (Max 10MB)</small>
                                                    </div>
                                                    <div class="file-preview" id="filePreview">
                                                        <span class="file-name" id="fileName"></span>
                                                        <button type="button" class="remove-file" onclick="removeFile(event)">Remove</button>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="form-group">
                                                <label>Incident Comments</label>
                                                <textarea name="incidentComments" placeholder="Additional comments about the incident..."></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- SECTION 5: Health and Safety -->
                                <div class="form-section" id="healthSafetySection">
                                    <h3>🏥 Health and Safety</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">14</span>Health and Safety Observation <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'healthSafety', 'yes'); toggleHealthSafetySection(true);">
                                                <input type="radio" name="healthSafety" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'healthSafety', 'no'); toggleHealthSafetySection(false);">
                                                <input type="radio" name="healthSafety" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Health & Safety = YES Section -->
                                    <div class="conditional-section" id="healthSafetyYesSection">
                                        <div class="form-group">
                                            <label>Observation Description <span class="required">*</span></label>
                                            <textarea name="healthSafetyDescription" id="healthSafetyDescription" placeholder="Describe the health and safety observation..." rows="4"></textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="submit" class="btn-submit" id="submitBtn">
                                    <span>📤</span> Submit Report
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast toast-' + type;
                        toast.style.display = 'block';
                        setTimeout(() => { toast.style.display = 'none'; }, 4000);
                    }
                    
                    function selectYesNo(el, name, value) {
                        const parent = el.parentElement;
                        parent.querySelectorAll('.yes-no-btn').forEach(btn => btn.classList.remove('selected'));
                        el.classList.add('selected');
                        el.querySelector('input').checked = true;
                    }
                    
                    function selectCompany(el, value) {
                        document.querySelectorAll('.company-radio').forEach(r => r.classList.remove('selected'));
                        el.classList.add('selected');
                        el.querySelector('input').checked = true;
                    }
                    
                    function selectIncidentType(el, value) {
                        document.querySelectorAll('.incident-type-item').forEach(r => r.classList.remove('selected'));
                        el.classList.add('selected');
                        el.querySelector('input').checked = true;
                    }
                    
                    function toggleThirdPartySection(hasThirdParty) {
                        const yesSection = document.getElementById('thirdPartyYesSection');
                        
                        if (hasThirdParty) {
                            yesSection.classList.add('visible');
                        } else {
                            yesSection.classList.remove('visible');
                            // Clear yes section
                            yesSection.querySelectorAll('input, textarea').forEach(el => {
                                if (el.type === 'radio') el.checked = false;
                                else if (el.tagName === 'TEXTAREA') el.value = '';
                            });
                            yesSection.querySelectorAll('.company-radio').forEach(btn => btn.classList.remove('selected'));
                        }
                    }
                    
                    function toggleIncidentSection(hasIncident) {
                        const yesSection = document.getElementById('incidentYesSection');
                        const noSection = document.getElementById('incidentNoSection');
                        if (hasIncident) {
                            yesSection.classList.add('visible');
                            noSection.classList.remove('visible');
                            // Clear no section
                            noSection.querySelector('textarea').value = '';
                        } else {
                            yesSection.classList.remove('visible');
                            noSection.classList.add('visible');
                            // Clear yes section
                            yesSection.querySelectorAll('input, textarea').forEach(el => {
                                if (el.type === 'radio' || el.type === 'file') el.checked = false;
                                else el.value = '';
                            });
                            yesSection.querySelectorAll('.incident-type-item').forEach(btn => btn.classList.remove('selected'));
                            document.getElementById('otherIncidentSection').classList.remove('visible');
                            document.getElementById('staffIncidentSection').classList.remove('visible');
                            document.getElementById('filePreview').classList.remove('visible');
                            document.getElementById('staffFilePreview').classList.remove('visible');
                        }
                    }
                    
                    function toggleOtherIncident(isOther) {
                        const section = document.getElementById('otherIncidentSection');
                        if (isOther) {
                            section.classList.add('visible');
                        } else {
                            section.classList.remove('visible');
                            section.querySelectorAll('input, textarea').forEach(el => {
                                if (el.type === 'file') {
                                    el.value = '';
                                    document.getElementById('filePreview').classList.remove('visible');
                                } else if (el.tagName === 'TEXTAREA') {
                                    el.value = '';
                                } else if (el.type === 'radio') {
                                    el.checked = false;
                                }
                            });
                            section.querySelectorAll('.yes-no-btn').forEach(btn => btn.classList.remove('selected'));
                            document.getElementById('otherAttachmentSection').classList.remove('visible');
                        }
                    }
                    
                    function toggleStaffIncident(isStaff) {
                        const section = document.getElementById('staffIncidentSection');
                        if (isStaff) {
                            section.classList.add('visible');
                        } else {
                            section.classList.remove('visible');
                            section.querySelectorAll('input, textarea').forEach(el => {
                                if (el.type === 'file') {
                                    el.value = '';
                                    document.getElementById('staffFilePreview').classList.remove('visible');
                                } else if (el.tagName === 'TEXTAREA' || el.type === 'text') {
                                    el.value = '';
                                } else if (el.type === 'radio') {
                                    el.checked = false;
                                }
                            });
                            section.querySelectorAll('.yes-no-btn').forEach(btn => btn.classList.remove('selected'));
                            document.getElementById('staffAttachmentSection').classList.remove('visible');
                        }
                    }
                    
                    function toggleStaffAttachment(hasAttachment) {
                        const section = document.getElementById('staffAttachmentSection');
                        if (hasAttachment) {
                            section.classList.add('visible');
                        } else {
                            section.classList.remove('visible');
                            document.getElementById('staffAttachment').value = '';
                            document.getElementById('staffFilePreview').classList.remove('visible');
                        }
                    }
                    
                    function toggleOtherAttachment(hasAttachment) {
                        const section = document.getElementById('otherAttachmentSection');
                        if (hasAttachment) {
                            section.classList.add('visible');
                        } else {
                            section.classList.remove('visible');
                            document.getElementById('incidentAttachment').value = '';
                            document.getElementById('filePreview').classList.remove('visible');
                        }
                    }
                    
                    function toggleHealthSafetySection(hasObservation) {
                        const section = document.getElementById('healthSafetyYesSection');
                        if (hasObservation) {
                            section.classList.add('visible');
                        } else {
                            section.classList.remove('visible');
                            document.getElementById('healthSafetyDescription').value = '';
                        }
                    }
                    
                    // File upload handling for Other Incident
                    document.getElementById('incidentAttachment').addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                                showToast('File size must be less than 10MB', 'error');
                                e.target.value = '';
                                return;
                            }
                            document.getElementById('fileName').textContent = file.name;
                            document.getElementById('filePreview').classList.add('visible');
                        }
                    });
                    
                    // File upload handling for Staff Incident
                    document.getElementById('staffAttachment').addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                                showToast('File size must be less than 10MB', 'error');
                                e.target.value = '';
                                return;
                            }
                            document.getElementById('staffFileName').textContent = file.name;
                            document.getElementById('staffFilePreview').classList.add('visible');
                        }
                    });
                    
                    function removeFile(e) {
                        e.stopPropagation();
                        document.getElementById('incidentAttachment').value = '';
                        document.getElementById('filePreview').classList.remove('visible');
                    }
                    
                    function removeStaffFile(e) {
                        e.stopPropagation();
                        document.getElementById('staffAttachment').value = '';
                        document.getElementById('staffFilePreview').classList.remove('visible');
                    }
                    
                    // Form submission
                    document.getElementById('reportForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const btn = document.getElementById('submitBtn');
                        btn.disabled = true;
                        btn.innerHTML = '<span>⏳</span> Submitting...';
                        
                        const formData = new FormData(this);
                        
                        // Add store name
                        const storeSelect = document.getElementById('storeId');
                        formData.append('storeName', storeSelect.options[storeSelect.selectedIndex]?.dataset.name || '');
                        
                        try {
                            const res = await fetch('/security-emp/post-visit-report/submit', {
                                method: 'POST',
                                body: formData
                            });
                            
                            const result = await res.json();
                            
                            if (res.ok && result.success) {
                                showToast('Report submitted successfully!', 'success');
                                setTimeout(() => {
                                    window.location.href = '/security-emp/post-visit-report/success/' + result.id;
                                }, 1500);
                            } else {
                                showToast(result.error || 'Failed to submit report', 'error');
                                btn.disabled = false;
                                btn.innerHTML = '<span>📤</span> Submit Report';
                            }
                        } catch (err) {
                            showToast('Error: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.innerHTML = '<span>📤</span> Submit Report';
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading form:', err);
        res.status(500).send('Error loading form: ' + err.message);
    }
});

// Configure upload for multiple file fields
const uploadFields = upload.fields([
    { name: 'incidentAttachment', maxCount: 1 },
    { name: 'staffAttachment', maxCount: 1 }
]);

// Submit report
router.post('/submit', uploadFields, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const data = req.body;
        const currentUser = req.currentUser || {};
        
        // Get attachment paths
        const incidentAttachmentPath = req.files && req.files['incidentAttachment'] 
            ? '/uploads/post-visit-report/' + req.files['incidentAttachment'][0].filename 
            : null;
        const staffAttachmentPath = req.files && req.files['staffAttachment'] 
            ? '/uploads/post-visit-report/' + req.files['staffAttachment'][0].filename 
            : null;
        
        // Convert yes/no to bit values
        const toBit = (val) => val === 'yes' ? 1 : (val === 'no' ? 0 : null);
        
        const result = await pool.request()
            .input('storeId', sql.Int, data.storeId)
            .input('storeName', sql.NVarChar(200), data.storeName)
            .input('visitDate', sql.Date, data.visitDate)
            .input('overallRating', sql.Int, data.overallRating || null)
            // In-house guards
            .input('inHouseUniform', sql.Int, data.inHouseUniform || null)
            .input('inHousePosition', sql.Int, data.inHousePosition || null)
            .input('inHouseControlRoom', sql.Int, data.inHouseControlRoom || null)
            .input('inHouseControlSheets', sql.Int, data.inHouseControlSheets || null)
            .input('inHouseBehavior', sql.Int, data.inHouseBehavior || null)
            .input('inHouseComments', sql.NVarChar(sql.MAX), data.inHouseComments || null)
            // Third-party
            .input('thirdPartyAvailable', sql.Bit, toBit(data.thirdPartyAvailable))
            .input('securityCompany', sql.NVarChar(100), data.securityCompany || null)
            .input('thirdPartyUniform', sql.Int, data.thirdPartyUniform || null)
            .input('thirdPartyPosition', sql.Int, data.thirdPartyPosition || null)
            .input('thirdPartyControlSheets', sql.Int, data.thirdPartyControlSheets || null)
            .input('thirdPartyBehavior', sql.Int, data.thirdPartyBehavior || null)
            .input('thirdPartyAttendance', sql.Int, data.thirdPartyAttendance || null)
            .input('thirdPartyJobDescription', sql.Int, data.thirdPartyJobDescription || null)
            .input('thirdPartyComments', sql.NVarChar(sql.MAX), data.thirdPartyComments || null)
            // Incident - Other
            .input('hasIncident', sql.Bit, toBit(data.hasIncident))
            .input('incidentType', sql.NVarChar(50), data.incidentType || null)
            .input('incidentDescription', sql.NVarChar(sql.MAX), data.incidentDescription || null)
            .input('incidentAttachmentPath', sql.NVarChar(500), incidentAttachmentPath)
            .input('incidentComments', sql.NVarChar(sql.MAX), data.incidentComments || null)
            // Incident - Staff Related
            .input('staffName', sql.NVarChar(200), data.staffName || null)
            .input('staffEmployeeId', sql.NVarChar(50), data.staffEmployeeId || null)
            .input('staffPosition', sql.NVarChar(100), data.staffPosition || null)
            .input('staffIncidentDescription', sql.NVarChar(sql.MAX), data.staffIncidentDescription || null)
            .input('staffAttachmentPath', sql.NVarChar(500), staffAttachmentPath)
            // Health and Safety
            .input('healthSafety', sql.Bit, toBit(data.healthSafety))
            .input('healthSafetyDescription', sql.NVarChar(sql.MAX), data.healthSafetyDescription || null)
            // Metadata
            .input('createdBy', sql.Int, currentUser.id || null)
            .input('createdByName', sql.NVarChar(200), currentUser.displayName || currentUser.email)
            .input('createdByEmail', sql.NVarChar(200), currentUser.email)
            .query(`INSERT INTO SecurityPostVisitReports 
                    (StoreId, StoreName, VisitDate, OverallRating,
                     InHouseUniform, InHousePosition, InHouseControlRoom, InHouseControlSheets, InHouseBehavior, InHouseComments,
                     ThirdPartyAvailable, SecurityCompany,
                     ThirdPartyUniform, ThirdPartyPosition, ThirdPartyControlSheets, ThirdPartyBehavior, ThirdPartyAttendance, ThirdPartyJobDescription, ThirdPartyComments,
                     HasIncident, IncidentType, IncidentDescription, IncidentAttachmentPath, IncidentComments,
                     StaffName, StaffEmployeeId, StaffPosition, StaffIncidentDescription, StaffAttachmentPath,
                     HealthSafetyObservation, HealthSafetyDescription,
                     CreatedBy, CreatedByName, CreatedByEmail)
                    OUTPUT INSERTED.Id
                    VALUES (@storeId, @storeName, @visitDate, @overallRating,
                            @inHouseUniform, @inHousePosition, @inHouseControlRoom, @inHouseControlSheets, @inHouseBehavior, @inHouseComments,
                            @thirdPartyAvailable, @securityCompany,
                            @thirdPartyUniform, @thirdPartyPosition, @thirdPartyControlSheets, @thirdPartyBehavior, @thirdPartyAttendance, @thirdPartyJobDescription, @thirdPartyComments,
                            @hasIncident, @incidentType, @incidentDescription, @incidentAttachmentPath, @incidentComments,
                            @staffName, @staffEmployeeId, @staffPosition, @staffIncidentDescription, @staffAttachmentPath,
                            @healthSafety, @healthSafetyDescription,
                            @createdBy, @createdByName, @createdByEmail)`);
        
        const reportId = result.recordset[0].Id;
        await pool.close();
        
        res.json({ success: true, id: reportId, message: 'Report submitted successfully' });
    } catch (err) {
        console.error('Error submitting report:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Success page
router.get('/success/:id', async (req, res) => {
    const reportId = req.params.id;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Report Submitted - ${process.env.APP_NAME}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .container { max-width: 500px; background: white; border-radius: 16px; padding: 50px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
                .icon { font-size: 80px; margin-bottom: 20px; }
                h1 { color: #00b894; margin: 0 0 15px 0; }
                p { color: #666; margin-bottom: 30px; font-size: 16px; }
                .ref { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
                .ref strong { color: #2d3436; }
                .btn { display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 5px; transition: all 0.2s; }
                .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(45,52,54,0.3); }
                .btn-secondary { background: #dfe6e9; color: #2d3436; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✅</div>
                <h1>Report Submitted!</h1>
                <p>Thank you for submitting your post-visit report.</p>
                <div class="ref">
                    <strong>Reference ID:</strong> PVR-${reportId}
                </div>
                <a href="/security-emp/post-visit-report" class="btn">📋 Submit Another</a>
                <a href="/security-emp/post-visit-report/history" class="btn btn-secondary">📜 View Reports</a>
                <a href="/security-emp" class="btn btn-secondary">← Security</a>
            </div>
        </body>
        </html>
    `);
});

// History page
router.get('/history', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`SELECT * FROM SecurityPostVisitReports ORDER BY CreatedAt DESC`);
        
        await pool.close();
        
        const ratingText = (val) => {
            if (!val) return '-';
            return '⭐'.repeat(val);
        };
        
        const tableRows = result.recordset.map(r => `
            <tr>
                <td><strong>PVR-${r.Id}</strong></td>
                <td>${r.StoreName}</td>
                <td>${new Date(r.VisitDate).toLocaleDateString('en-GB')}</td>
                <td>${ratingText(r.OverallRating)}</td>
                <td>${r.ThirdPartyAvailable ? '✓ Yes' : '✗ No'}</td>
                <td>${r.CreatedByName || '-'}</td>
                <td>${new Date(r.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>
                    <a href="/security-emp/post-visit-report/view/${r.Id}" style="color: #2d3436; text-decoration: none; font-weight: 600;">View</a>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Post Visit Reports - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; flex-wrap: wrap; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .container { max-width: 1400px; margin: 30px auto; padding: 0 20px; }
                    .table-container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); overflow-x: auto; }
                    table { width: 100%; border-collapse: collapse; min-width: 900px; }
                    th { background: #f8f9fa; padding: 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #dee2e6; }
                    td { padding: 15px; border-bottom: 1px solid #eee; }
                    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
                    .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📜 Post Visit Reports</h1>
                    <div class="header-nav">
                        <a href="/security-emp/post-visit-report">➕ New Report</a>
                        <a href="/dashboard">← Back to Dashboard</a>
                    </div>
                </div>
                <div class="container">
                    <div class="table-container">
                        ${result.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Visit Date</th>
                                        <th>Rating</th>
                                        <th>Third-Party</th>
                                        <th>Submitted By</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div class="icon">📋</div>
                                <h3>No reports submitted yet</h3>
                                <p>Start by submitting a post-visit report.</p>
                            </div>
                        `}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading history:', err);
        res.status(500).send('Error loading history: ' + err.message);
    }
});

// View single report
router.get('/view/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const reportId = parseInt(req.params.id);
        
        const result = await pool.request()
            .input('id', sql.Int, reportId)
            .query(`SELECT * FROM SecurityPostVisitReports WHERE Id = @id`);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).send('Report not found');
        }
        
        const r = result.recordset[0];
        
        const ratingLabel = (val) => {
            const labels = ['', 'Not well at all', 'Not very well', 'Somewhat well', 'Very well', 'Extremely well'];
            return val ? labels[val] || '-' : 'N/A';
        };
        
        const yesNo = (val) => val === true || val === 1 ? '<span style="color: #00b894; font-weight: 600;">✓ Yes</span>' : (val === false || val === 0 ? '<span style="color: #d63031; font-weight: 600;">✗ No</span>' : 'N/A');
        const starRating = (val) => val ? '★'.repeat(val) + '☆'.repeat(5 - val) : 'Not rated';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>View Report PVR-${r.Id} - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .header h1 { font-size: 24px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); margin-bottom: 20px; }
                    .card-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #eee; }
                    .card-header h3 { color: #2d3436; }
                    .card-body { padding: 20px; }
                    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { width: 220px; color: #666; font-weight: 500; flex-shrink: 0; }
                    .detail-value { flex: 1; }
                    .rating { color: #f1c40f; font-size: 18px; }
                    .text-block { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; }
                    .matrix-display { margin-top: 10px; }
                    .matrix-display table { width: 100%; border-collapse: collapse; }
                    .matrix-display th, .matrix-display td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
                    .matrix-display th { background: #f8f9fa; font-weight: 600; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Report PVR-${r.Id}</h1>
                    <div class="header-nav">
                        <a href="/security-emp/post-visit-report/history">← Back to Reports</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header"><h3>📍 Visit Information</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Store:</span><span class="detail-value">${r.StoreName}</span></div>
                            <div class="detail-row"><span class="detail-label">Visit Date:</span><span class="detail-value">${new Date(r.VisitDate).toLocaleDateString('en-GB')}</span></div>
                            <div class="detail-row"><span class="detail-label">Overall Rating:</span><span class="detail-value rating">${starRating(r.OverallRating)}</span></div>
                            <div class="detail-row"><span class="detail-label">Submitted By:</span><span class="detail-value">${r.CreatedByName || 'N/A'}</span></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>🛡️ In-house Guards</h3></div>
                        <div class="card-body">
                            <div class="matrix-display">
                                <table>
                                    <tr><th>Criteria</th><th>Rating</th></tr>
                                    <tr><td>Uniform</td><td>${ratingLabel(r.InHouseUniform)}</td></tr>
                                    <tr><td>Position</td><td>${ratingLabel(r.InHousePosition)}</td></tr>
                                    <tr><td>Control Room</td><td>${ratingLabel(r.InHouseControlRoom)}</td></tr>
                                    <tr><td>Control Sheets & Filling</td><td>${ratingLabel(r.InHouseControlSheets)}</td></tr>
                                    <tr><td>Behavior</td><td>${ratingLabel(r.InHouseBehavior)}</td></tr>
                                </table>
                            </div>
                            ${r.InHouseComments ? `<div class="text-block"><strong>Comments:</strong><br>${r.InHouseComments}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>🔒 Third-Party Guards</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Third-Party Available:</span><span class="detail-value">${yesNo(r.ThirdPartyAvailable)}</span></div>
                            ${r.ThirdPartyAvailable ? `
                                <div class="detail-row"><span class="detail-label">Security Company:</span><span class="detail-value">${r.SecurityCompany || 'N/A'}</span></div>
                                <div class="matrix-display">
                                    <table>
                                        <tr><th>Criteria</th><th>Rating</th></tr>
                                        <tr><td>Uniform</td><td>${ratingLabel(r.ThirdPartyUniform)}</td></tr>
                                        <tr><td>Position</td><td>${ratingLabel(r.ThirdPartyPosition)}</td></tr>
                                        <tr><td>Control Sheets & Filling</td><td>${ratingLabel(r.ThirdPartyControlSheets)}</td></tr>
                                        <tr><td>Behavior</td><td>${ratingLabel(r.ThirdPartyBehavior)}</td></tr>
                                        <tr><td>Attendance</td><td>${ratingLabel(r.ThirdPartyAttendance)}</td></tr>
                                        <tr><td>Respecting Job Description</td><td>${ratingLabel(r.ThirdPartyJobDescription)}</td></tr>
                                    </table>
                                </div>
                                ${r.ThirdPartyComments ? `<div class="text-block"><strong>Comments:</strong><br>${r.ThirdPartyComments}</div>` : ''}
                            ` : `
                                <div class="detail-row"><span class="detail-label">Incident:</span><span class="detail-value">${yesNo(r.HasIncident)}</span></div>
                                ${r.HasIncident ? `
                                    <div class="detail-row"><span class="detail-label">Incident Type:</span><span class="detail-value">${r.IncidentType === 'staff_related' ? 'Staff Related' : r.IncidentType === 'other' ? 'Other' : 'N/A'}</span></div>
                                    ${r.IncidentType === 'staff_related' ? `
                                        <div class="detail-row"><span class="detail-label">Staff Name:</span><span class="detail-value">${r.StaffName || 'N/A'}</span></div>
                                        <div class="detail-row"><span class="detail-label">Employee ID:</span><span class="detail-value">${r.StaffEmployeeId || 'N/A'}</span></div>
                                        <div class="detail-row"><span class="detail-label">Position:</span><span class="detail-value">${r.StaffPosition || 'N/A'}</span></div>
                                        ${r.StaffIncidentDescription ? `<div class="text-block"><strong>Incident Description:</strong><br>${r.StaffIncidentDescription}</div>` : ''}
                                        ${r.StaffAttachmentPath ? `<div class="detail-row"><span class="detail-label">Attachment:</span><span class="detail-value"><a href="${r.StaffAttachmentPath}" target="_blank">View Attachment</a></span></div>` : ''}
                                    ` : `
                                        ${r.IncidentDescription ? `<div class="text-block"><strong>Description:</strong><br>${r.IncidentDescription}</div>` : ''}
                                        ${r.IncidentAttachmentPath ? `<div class="detail-row"><span class="detail-label">Attachment:</span><span class="detail-value"><a href="${r.IncidentAttachmentPath}" target="_blank">View Attachment</a></span></div>` : ''}
                                        ${r.IncidentComments ? `<div class="text-block"><strong>Comments:</strong><br>${r.IncidentComments}</div>` : ''}
                                    `}
                                ` : ''}
                            `}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>🏥 Health and Safety</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Health & Safety Observation:</span><span class="detail-value">${yesNo(r.HealthSafetyObservation)}</span></div>
                            ${r.HealthSafetyObservation && r.HealthSafetyDescription ? `<div class="text-block"><strong>Observation Description:</strong><br>${r.HealthSafetyDescription}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>📝 Submission Details</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Submitted At:</span><span class="detail-value">${new Date(r.CreatedAt).toLocaleString('en-GB')}</span></div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing report:', err);
        res.status(500).send('Error viewing report: ' + err.message);
    }
});

module.exports = router;
