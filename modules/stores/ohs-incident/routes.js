/**
 * OHS A&I (Accident & Incident) Reporting Routes
 * Allows store management to report accidents, incidents, and near misses
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../../uploads/ohs-incidents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'OHS-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type'));
    }
});

// Generate incident number
async function generateIncidentNumber(pool) {
    const result = await pool.request().query(`
        SELECT COUNT(*) + 1 as nextNum FROM OHSIncidents
    `);
    const num = result.recordset[0].nextNum;
    const year = new Date().getFullYear();
    return `OHS-${year}-${String(num).padStart(5, '0')}`;
}

// OHS A&I Reporting Form Page
router.get('/', async (req, res) => {
    try {
        const user = req.currentUser;
        const pool = await sql.connect(dbConfig);
        
        // Load all dropdown data from OHS settings
        const stores = await pool.request().query(`
            SELECT Id, StoreId, StoreName, StoreCode FROM OHSStores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        const eventTypes = await pool.request().query(`
            SELECT Id, EventTypeName, Description FROM OHSEventTypes WHERE IsActive = 1 ORDER BY DisplayOrder
        `);
        
        const categories = await pool.request().query(`
            SELECT Id, CategoryName FROM OHSEventCategories WHERE IsActive = 1 ORDER BY DisplayOrder
        `);
        
        const subCategories = await pool.request().query(`
            SELECT Id, CategoryId, SubCategoryName FROM OHSEventSubCategories WHERE IsActive = 1 ORDER BY DisplayOrder
        `);
        
        const bodyParts = await pool.request().query(`
            SELECT Id, BodyPartName FROM OHSBodyParts WHERE IsActive = 1 ORDER BY DisplayOrder
        `);
        
        const injuryTypes = await pool.request().query(`
            SELECT Id, InjuryTypeName FROM OHSInjuryTypes WHERE IsActive = 1 ORDER BY DisplayOrder
        `);
        
        await pool.close();
        
        // Build sub-categories JSON for cascading dropdown
        const subCategoriesJson = JSON.stringify(subCategories.recordset);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>OHS A&I Reporting - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f5f5f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                    }
                    .header h1 { font-size: 22px; }
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
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .form-card {
                        background: white;
                        border-radius: 12px;
                        padding: 30px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        margin-bottom: 20px;
                    }
                    
                    .form-title {
                        color: #e17055;
                        margin-bottom: 10px;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .form-desc {
                        color: #666;
                        margin-bottom: 25px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #eee;
                    }
                    
                    .section {
                        margin-bottom: 30px;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        border-left: 4px solid #e17055;
                    }
                    
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .form-row {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    
                    .form-group {
                        margin-bottom: 20px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 8px;
                        font-weight: 500;
                        color: #333;
                    }
                    .form-group label .required {
                        color: #e17055;
                    }
                    .form-group input, 
                    .form-group select, 
                    .form-group textarea {
                        width: 100%;
                        padding: 12px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        transition: border-color 0.2s, box-shadow 0.2s;
                    }
                    .form-group input:focus, 
                    .form-group select:focus, 
                    .form-group textarea:focus {
                        outline: none;
                        border-color: #e17055;
                        box-shadow: 0 0 0 3px rgba(225, 112, 85, 0.1);
                    }
                    .form-group textarea {
                        min-height: 100px;
                        resize: vertical;
                    }
                    .form-group small {
                        color: #666;
                        font-size: 12px;
                        margin-top: 5px;
                        display: block;
                    }
                    
                    .radio-group {
                        display: flex;
                        gap: 20px;
                        flex-wrap: wrap;
                    }
                    .radio-group label {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        cursor: pointer;
                        font-weight: normal;
                    }
                    .radio-group input[type="radio"] {
                        width: auto;
                    }
                    
                    .checkbox-label {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        cursor: pointer;
                        font-weight: normal !important;
                    }
                    .checkbox-label input[type="checkbox"] {
                        width: 20px;
                        height: 20px;
                    }
                    
                    .conditional-section {
                        display: none;
                        margin-top: 20px;
                        padding: 20px;
                        background: #fff3e0;
                        border-radius: 8px;
                        border: 1px solid #ffcc80;
                    }
                    .conditional-section.visible {
                        display: block;
                    }
                    
                    .file-upload {
                        border: 2px dashed #ddd;
                        border-radius: 10px;
                        padding: 30px;
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .file-upload:hover {
                        border-color: #e17055;
                        background: #fff5f3;
                    }
                    .file-upload input {
                        display: none;
                    }
                    .file-upload-icon {
                        font-size: 40px;
                        margin-bottom: 10px;
                    }
                    .file-list {
                        margin-top: 15px;
                        text-align: left;
                    }
                    .file-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px;
                        background: #f0f0f0;
                        border-radius: 5px;
                        margin-bottom: 5px;
                    }
                    .file-item button {
                        background: #d63031;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                    
                    .btn {
                        padding: 14px 30px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                    }
                    .btn-primary:hover { 
                        transform: translateY(-2px);
                        box-shadow: 0 4px 15px rgba(214, 48, 49, 0.3);
                    }
                    .btn-primary:disabled {
                        background: #ccc;
                        cursor: not-allowed;
                        transform: none;
                    }
                    .btn-secondary {
                        background: #74b9ff;
                        color: white;
                    }
                    
                    .form-actions {
                        display: flex;
                        gap: 15px;
                        justify-content: flex-end;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    
                    .alert {
                        padding: 15px 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                    .alert-warning { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
                    
                    .loading-overlay {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .loading-overlay.active {
                        display: flex;
                    }
                    .loading-spinner {
                        background: white;
                        padding: 30px 50px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .spinner {
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #e17055;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 15px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🦺 OHS A&I Reporting</h1>
                    <div class="header-nav">
                        <a href="/stores/ohs-incident/history">📋 My Reports</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div id="alertContainer"></div>
                    
                    <form id="ohsForm" enctype="multipart/form-data">
                        <div class="form-card">
                            <h2 class="form-title">📋 Accident & Incident Report</h2>
                            <p class="form-desc">Report accidents, incidents, and near misses. All fields marked with <span style="color: #e17055;">*</span> are required.</p>
                            
                            <!-- Section 1: Event Details -->
                            <div class="section">
                                <h3 class="section-title">📅 Event Details</h3>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Date of Event <span class="required">*</span></label>
                                        <input type="date" name="incidentDate" id="incidentDate" required max="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                    <div class="form-group">
                                        <label>Time of Event <span class="required">*</span></label>
                                        <input type="time" name="incidentTime" id="incidentTime" required>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Store <span class="required">*</span></label>
                                        <select name="storeId" id="storeId" required>
                                            <option value="">-- Select Store --</option>
                                            ${stores.recordset.map(s => `
                                                <option value="${s.StoreId}" data-name="${s.StoreName}">${s.StoreName} ${s.StoreCode ? '(' + s.StoreCode + ')' : ''}</option>
                                            `).join('')}
                                        </select>
                                        ${stores.recordset.length === 0 ? '<small style="color: #d63031;">No stores configured. Please contact OHS admin.</small>' : ''}
                                    </div>
                                    <div class="form-group">
                                        <label>Exact Location in Store</label>
                                        <input type="text" name="exactLocation" id="exactLocation" placeholder="e.g., Bakery section, Warehouse aisle 3">
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Name of Person Reporting <span class="required">*</span></label>
                                    <input type="text" name="reporterName" id="reporterName" required value="${user?.displayName || ''}" readonly style="background: #f0f0f0;">
                                </div>
                            </div>
                            
                            <!-- Section 2: Event Classification -->
                            <div class="section">
                                <h3 class="section-title">🏷️ Event Classification</h3>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Event Type <span class="required">*</span></label>
                                        <select name="eventTypeId" id="eventTypeId" required>
                                            <option value="">-- Select Event Type --</option>
                                            ${eventTypes.recordset.map(et => `
                                                <option value="${et.Id}">${et.EventTypeName}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Hazard Category <span class="required">*</span></label>
                                        <select name="categoryId" id="categoryId" required onchange="updateSubCategories()">
                                            <option value="">-- Select Category --</option>
                                            ${categories.recordset.map(c => `
                                                <option value="${c.Id}">${c.CategoryName}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Sub-Category <span class="required">*</span></label>
                                        <select name="subCategoryId" id="subCategoryId" required>
                                            <option value="">-- Select Category First --</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Section 3: Event Description -->
                            <div class="section">
                                <h3 class="section-title">📝 Event Description</h3>
                                
                                <div class="form-group">
                                    <label>What Happened? <span class="required">*</span></label>
                                    <textarea name="whatHappened" id="whatHappened" required placeholder="Describe what happened in detail..."></textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label>How Did It Happen? <span class="required">*</span></label>
                                    <textarea name="howItHappened" id="howItHappened" required placeholder="Describe the circumstances that led to this event..."></textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label>Immediate Consequences</label>
                                    <textarea name="immediateConsequences" id="immediateConsequences" placeholder="Describe any immediate consequences or damage..."></textarea>
                                </div>
                            </div>
                            
                            <!-- Section 4: Injury Details (Conditional) -->
                            <div class="section">
                                <h3 class="section-title">🩹 Injury & Impact Details</h3>
                                
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="injuryOccurred" id="injuryOccurred" onchange="toggleInjurySection()">
                                        <span>An injury occurred during this event</span>
                                    </label>
                                </div>
                                
                                <div class="conditional-section" id="injurySection">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Injured Person Name <span class="required">*</span></label>
                                            <input type="text" name="injuredPersonName" id="injuredPersonName" placeholder="Full name of injured person">
                                        </div>
                                        <div class="form-group">
                                            <label>Injured Person Type <span class="required">*</span></label>
                                            <select name="injuredPersonType" id="injuredPersonType">
                                                <option value="">-- Select Type --</option>
                                                <option value="Employee">Employee</option>
                                                <option value="Customer">Customer</option>
                                                <option value="Contractor">Contractor</option>
                                                <option value="Visitor">Visitor</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Employee ID (if applicable)</label>
                                            <input type="text" name="injuredPersonEmployeeId" id="injuredPersonEmployeeId" placeholder="Employee ID number">
                                        </div>
                                        <div class="form-group">
                                            <label>Injury Type <span class="required">*</span></label>
                                            <select name="injuryTypeId" id="injuryTypeId">
                                                <option value="">-- Select Injury Type --</option>
                                                ${injuryTypes.recordset.map(it => `
                                                    <option value="${it.Id}">${it.InjuryTypeName}</option>
                                                `).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Body Part Affected <span class="required">*</span></label>
                                        <select name="bodyPartId" id="bodyPartId">
                                            <option value="">-- Select Body Part --</option>
                                            ${bodyParts.recordset.map(bp => `
                                                <option value="${bp.Id}">${bp.BodyPartName}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Injury Description <span class="required">*</span></label>
                                        <textarea name="injuryDescription" id="injuryDescription" placeholder="Brief description of the injury and how it occurred..."></textarea>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Section 5: Medical & Work Impact -->
                            <div class="section" id="medicalSection" style="display: none;">
                                <h3 class="section-title">🏥 Medical & Work Impact</h3>
                                
                                <div class="form-group">
                                    <label>Medical Treatment Required? <span class="required">*</span></label>
                                    <div class="radio-group">
                                        <label><input type="radio" name="medicalTreatmentRequired" value="1" onchange="toggleTreatmentDetails()"> Yes</label>
                                        <label><input type="radio" name="medicalTreatmentRequired" value="0" onchange="toggleTreatmentDetails()"> No</label>
                                    </div>
                                </div>
                                
                                <div class="conditional-section" id="treatmentSection">
                                    <div class="form-group">
                                        <label>Type of Treatment</label>
                                        <div class="radio-group">
                                            <label><input type="radio" name="treatmentType" value="First Aid Only"> First Aid Only</label>
                                            <label><input type="radio" name="treatmentType" value="Clinic"> Clinic</label>
                                            <label><input type="radio" name="treatmentType" value="Hospital"> Hospital</label>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Treatment Details</label>
                                        <textarea name="medicalTreatmentDetails" id="medicalTreatmentDetails" placeholder="Describe the treatment provided..."></textarea>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Return to Work Status</label>
                                    <div class="radio-group">
                                        <label><input type="radio" name="returnToWorkStatus" value="Same Day"> Same Day</label>
                                        <label><input type="radio" name="returnToWorkStatus" value="Restricted Duties"> Restricted Duties</label>
                                        <label><input type="radio" name="returnToWorkStatus" value="Not Returned"> Not Returned</label>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Section 6: Immediate Actions -->
                            <div class="section">
                                <h3 class="section-title">⚡ Immediate Action Taken</h3>
                                
                                <div class="form-group">
                                    <label>Action Taken to Assist Injured Person</label>
                                    <textarea name="actionToAssist" id="actionToAssist" placeholder="Describe actions taken to help the injured person..."></textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label>Action Taken to Make Area Safe</label>
                                    <textarea name="actionToSecure" id="actionToSecure" placeholder="Describe actions taken to secure the area and prevent further incidents..."></textarea>
                                </div>
                            </div>
                            
                            <!-- Section 7: Hazard Status -->
                            <div class="section">
                                <h3 class="section-title">⚠️ Hazard Status</h3>
                                
                                <div class="form-group">
                                    <label>Is the Hazard Still Present? <span class="required">*</span></label>
                                    <div class="radio-group">
                                        <label><input type="radio" name="hazardStatus" value="Yes" required> Yes</label>
                                        <label><input type="radio" name="hazardStatus" value="No"> No</label>
                                        <label><input type="radio" name="hazardStatus" value="Controlled Temporarily"> Controlled Temporarily</label>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Section 8: Witnesses -->
                            <div class="section">
                                <h3 class="section-title">👥 Witnesses</h3>
                                
                                <div class="form-group">
                                    <label>Witness Names</label>
                                    <textarea name="witnessNames" id="witnessNames" placeholder="List names of any witnesses (one per line)..."></textarea>
                                    <small>Enter each witness name on a new line</small>
                                </div>
                            </div>
                            
                            <!-- Section 9: Attachments -->
                            <div class="section">
                                <h3 class="section-title">📎 Attachments</h3>
                                
                                <div class="file-upload" onclick="document.getElementById('fileInput').click()">
                                    <div class="file-upload-icon">📁</div>
                                    <div><strong>Click to upload</strong> or drag and drop</div>
                                    <div style="color: #666; font-size: 12px; margin-top: 5px;">Photos, Videos, Documents (Max 50MB each)</div>
                                    <input type="file" id="fileInput" name="attachments" multiple accept="image/*,video/*,.pdf,.doc,.docx" onchange="handleFileSelect(event)">
                                </div>
                                <div class="file-list" id="fileList"></div>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="window.location.href='/stores'">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="submitBtn">Submit Report</button>
                            </div>
                        </div>
                    </form>
                </div>
                
                <!-- Loading Overlay -->
                <div class="loading-overlay" id="loadingOverlay">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <div>Submitting report...</div>
                    </div>
                </div>
                
                <script>
                    // Sub-categories data
                    const subCategories = ${subCategoriesJson};
                    
                    // Update sub-categories based on selected category
                    function updateSubCategories() {
                        const categoryId = document.getElementById('categoryId').value;
                        const subCategorySelect = document.getElementById('subCategoryId');
                        
                        subCategorySelect.innerHTML = '<option value="">-- Select Sub-Category --</option>';
                        
                        if (categoryId) {
                            const filtered = subCategories.filter(sc => sc.CategoryId == categoryId);
                            filtered.forEach(sc => {
                                const option = document.createElement('option');
                                option.value = sc.Id;
                                option.textContent = sc.SubCategoryName;
                                subCategorySelect.appendChild(option);
                            });
                        }
                    }
                    
                    // Toggle injury section visibility
                    function toggleInjurySection() {
                        const checked = document.getElementById('injuryOccurred').checked;
                        document.getElementById('injurySection').classList.toggle('visible', checked);
                        document.getElementById('medicalSection').style.display = checked ? 'block' : 'none';
                        
                        // Toggle required fields
                        const fields = ['injuredPersonName', 'injuredPersonType', 'injuryTypeId', 'bodyPartId', 'injuryDescription'];
                        fields.forEach(field => {
                            document.getElementById(field).required = checked;
                        });
                    }
                    
                    // Toggle treatment details
                    function toggleTreatmentDetails() {
                        const required = document.querySelector('input[name="medicalTreatmentRequired"]:checked')?.value === '1';
                        document.getElementById('treatmentSection').classList.toggle('visible', required);
                    }
                    
                    // File handling
                    let selectedFiles = [];
                    
                    function handleFileSelect(event) {
                        const files = Array.from(event.target.files);
                        selectedFiles = selectedFiles.concat(files);
                        updateFileList();
                    }
                    
                    function updateFileList() {
                        const fileList = document.getElementById('fileList');
                        if (selectedFiles.length === 0) {
                            fileList.innerHTML = '';
                            return;
                        }
                        
                        fileList.innerHTML = selectedFiles.map((file, index) => \`
                            <div class="file-item">
                                <span>\${file.name} (\${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                <button type="button" onclick="removeFile(\${index})">Remove</button>
                            </div>
                        \`).join('');
                    }
                    
                    function removeFile(index) {
                        selectedFiles.splice(index, 1);
                        updateFileList();
                    }
                    
                    // Show alert
                    function showAlert(message, type) {
                        document.getElementById('alertContainer').innerHTML = 
                            '<div class="alert alert-' + type + '">' + message + '</div>';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    
                    // Form submission
                    document.getElementById('ohsForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const submitBtn = document.getElementById('submitBtn');
                        const loadingOverlay = document.getElementById('loadingOverlay');
                        
                        submitBtn.disabled = true;
                        loadingOverlay.classList.add('active');
                        
                        try {
                            const formData = new FormData(this);
                            
                            // Add files manually
                            selectedFiles.forEach(file => {
                                formData.append('attachments', file);
                            });
                            
                            // Get store name
                            const storeSelect = document.getElementById('storeId');
                            formData.append('storeName', storeSelect.options[storeSelect.selectedIndex]?.dataset.name || '');
                            
                            // Combine description fields
                            const description = [
                                'What happened: ' + document.getElementById('whatHappened').value,
                                'How it happened: ' + document.getElementById('howItHappened').value,
                                'Immediate consequences: ' + document.getElementById('immediateConsequences').value
                            ].join('\\n\\n');
                            formData.append('incidentDescription', description);
                            
                            // Combine immediate actions
                            const actions = [
                                'Action to assist: ' + document.getElementById('actionToAssist').value,
                                'Action to secure area: ' + document.getElementById('actionToSecure').value
                            ].join('\\n\\n');
                            formData.append('immediateActions', actions);
                            
                            const response = await fetch('/stores/ohs-incident/submit', {
                                method: 'POST',
                                body: formData
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showAlert('Report submitted successfully! Incident Number: ' + result.incidentNumber, 'success');
                                setTimeout(() => {
                                    window.location.href = '/stores/ohs-incident/success?id=' + result.incidentNumber;
                                }, 2000);
                            } else {
                                showAlert('Error: ' + (result.error || 'Failed to submit report'), 'error');
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            showAlert('Error submitting report. Please try again.', 'error');
                        } finally {
                            submitBtn.disabled = false;
                            loadingOverlay.classList.remove('active');
                        }
                    });
                    
                    // Set default date to today
                    document.getElementById('incidentDate').value = new Date().toISOString().split('T')[0];
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading OHS form:', error);
        res.status(500).send('Error loading form: ' + error.message);
    }
});

// Submit OHS Incident Report
router.post('/submit', upload.array('attachments', 10), async (req, res) => {
    try {
        const user = req.currentUser;
        const pool = await sql.connect(dbConfig);
        
        // Generate incident number
        const incidentNumber = await generateIncidentNumber(pool);
        
        // Get file paths
        const attachments = req.files ? req.files.map(f => '/uploads/ohs-incidents/' + f.filename) : [];
        
        // Parse time - convert "HH:mm" to a proper time value
        let incidentTimeValue = null;
        if (req.body.incidentTime) {
            // Append seconds to make it "HH:mm:ss" format
            incidentTimeValue = req.body.incidentTime + ':00';
        }
        
        // Insert into database
        await pool.request()
            .input('incidentNumber', sql.NVarChar, incidentNumber)
            .input('storeId', sql.Int, req.body.storeId || null)
            .input('storeName', sql.NVarChar, req.body.storeName || '')
            .input('eventTypeId', sql.Int, req.body.eventTypeId || null)
            .input('categoryId', sql.Int, req.body.categoryId || null)
            .input('subCategoryId', sql.Int, req.body.subCategoryId || null)
            .input('incidentDate', sql.Date, req.body.incidentDate)
            .input('incidentTime', sql.NVarChar, incidentTimeValue)
            .input('exactLocation', sql.NVarChar, req.body.exactLocation || '')
            .input('incidentDescription', sql.NVarChar, req.body.incidentDescription || '')
            .input('injuryOccurred', sql.Bit, req.body.injuryOccurred === 'on' ? 1 : 0)
            .input('injuryTypeId', sql.Int, req.body.injuryTypeId || null)
            .input('bodyPartId', sql.Int, req.body.bodyPartId || null)
            .input('injuryDescription', sql.NVarChar, req.body.injuryDescription || '')
            .input('injuredPersonName', sql.NVarChar, req.body.injuredPersonName || '')
            .input('injuredPersonType', sql.NVarChar, req.body.injuredPersonType || '')
            .input('injuredPersonEmployeeId', sql.NVarChar, req.body.injuredPersonEmployeeId || '')
            .input('witnessNames', sql.NVarChar, req.body.witnessNames || '')
            .input('immediateActions', sql.NVarChar, req.body.immediateActions || '')
            .input('medicalTreatmentRequired', sql.Bit, req.body.medicalTreatmentRequired === '1' ? 1 : 0)
            .input('medicalTreatmentDetails', sql.NVarChar, req.body.medicalTreatmentDetails || '')
            .input('hospitalVisit', sql.Bit, req.body.treatmentType === 'Hospital' ? 1 : 0)
            .input('reportedByUserId', sql.NVarChar, user?.email || '')
            .input('reportedByName', sql.NVarChar, req.body.reporterName || user?.displayName || '')
            .input('reportedByRole', sql.NVarChar, user?.role || '')
            .input('reportedByEmail', sql.NVarChar, user?.email || '')
            .input('attachments', sql.NVarChar, JSON.stringify(attachments))
            .query(`
                INSERT INTO OHSIncidents (
                    IncidentNumber, StoreId, StoreName, EventTypeId, CategoryId, SubCategoryId,
                    IncidentDate, IncidentTime, ExactLocation, IncidentDescription,
                    InjuryOccurred, InjuryTypeId, BodyPartId, InjuryDescription,
                    InjuredPersonName, InjuredPersonType, InjuredPersonEmployeeId,
                    WitnessNames, ImmediateActions, MedicalTreatmentRequired, MedicalTreatmentDetails,
                    HospitalVisit, ReportedByUserId, ReportedByName, ReportedByRole, ReportedByEmail,
                    Attachments, Status
                ) VALUES (
                    @incidentNumber, @storeId, @storeName, @eventTypeId, @categoryId, @subCategoryId,
                    @incidentDate, @incidentTime, @exactLocation, @incidentDescription,
                    @injuryOccurred, @injuryTypeId, @bodyPartId, @injuryDescription,
                    @injuredPersonName, @injuredPersonType, @injuredPersonEmployeeId,
                    @witnessNames, @immediateActions, @medicalTreatmentRequired, @medicalTreatmentDetails,
                    @hospitalVisit, @reportedByUserId, @reportedByName, @reportedByRole, @reportedByEmail,
                    @attachments, 'Submitted'
                )
            `);
        
        await pool.close();
        
        res.json({ success: true, incidentNumber: incidentNumber });
    } catch (error) {
        console.error('Error submitting OHS incident:', error);
        res.json({ success: false, error: error.message });
    }
});

// Success page
router.get('/success', (req, res) => {
    const incidentNumber = req.query.id;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Report Submitted - OHS</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .success-card {
                    background: white;
                    border-radius: 20px;
                    padding: 50px;
                    text-align: center;
                    max-width: 500px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .success-icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                }
                .success-title {
                    font-size: 28px;
                    color: #00b894;
                    margin-bottom: 10px;
                }
                .incident-number {
                    font-size: 24px;
                    color: #333;
                    background: #f0f0f0;
                    padding: 15px 30px;
                    border-radius: 10px;
                    margin: 20px 0;
                    font-family: monospace;
                }
                .success-message {
                    color: #666;
                    margin-bottom: 30px;
                }
                .btn {
                    padding: 12px 30px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    text-decoration: none;
                    display: inline-block;
                    margin: 5px;
                }
                .btn-primary { background: #00b894; color: white; }
                .btn-secondary { background: #74b9ff; color: white; }
            </style>
        </head>
        <body>
            <div class="success-card">
                <div class="success-icon">✅</div>
                <h1 class="success-title">Report Submitted Successfully!</h1>
                <div class="incident-number">${incidentNumber || 'N/A'}</div>
                <p class="success-message">Your incident report has been submitted and will be reviewed by the OHS team.</p>
                <a href="/stores/ohs-incident" class="btn btn-primary">Submit Another Report</a>
                <a href="/stores/ohs-incident/history" class="btn btn-secondary">📋 View My Reports</a>
                <a href="/stores" class="btn btn-secondary">Back to Stores</a>
            </div>
        </body>
        </html>
    `);
});
// History Page - View submitted incident reports
router.get('/history', async (req, res) => {
    try {
        const user = req.currentUser;
        const pool = await sql.connect(dbConfig);
        
        // Get incidents - all incidents for OHS admin/manager, own incidents for stores
        const incidents = await pool.request().query(`
            SELECT i.*, 
                   e.EventTypeName,
                   c.CategoryName,
                   sc.SubCategoryName,
                   it.InjuryTypeName,
                   bp.BodyPartName
            FROM OHSIncidents i
            LEFT JOIN OHSEventTypes e ON i.EventTypeId = e.Id
            LEFT JOIN OHSEventCategories c ON i.CategoryId = c.Id
            LEFT JOIN OHSEventSubCategories sc ON i.SubCategoryId = sc.Id
            LEFT JOIN OHSInjuryTypes it ON i.InjuryTypeId = it.Id
            LEFT JOIN OHSBodyParts bp ON i.BodyPartId = bp.Id
            ORDER BY i.CreatedAt DESC
        `);
        
        await pool.close();
        
        const statusColors = {
            'Pending': '#fdcb6e',
            'Under Review': '#74b9ff',
            'Resolved': '#00b894',
            'Closed': '#636e72'
        };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Incident History - OHS</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f5f5f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 22px; }
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
                        max-width: 1400px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .page-title {
                        margin-bottom: 25px;
                    }
                    .page-title h2 {
                        font-size: 24px;
                        color: #333;
                    }
                    .page-title p {
                        color: #666;
                        margin-top: 5px;
                    }
                    
                    .card {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        overflow: hidden;
                    }
                    
                    .toolbar {
                        padding: 20px;
                        display: flex;
                        gap: 15px;
                        flex-wrap: wrap;
                        border-bottom: 1px solid #eee;
                    }
                    
                    .search-box {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        font-size: 14px;
                        width: 300px;
                    }
                    
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        text-decoration: none;
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .btn-primary { background: #e17055; color: white; }
                    .btn-primary:hover { background: #d63031; }
                    
                    .table-container {
                        overflow-x: auto;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    
                    th, td {
                        padding: 15px;
                        text-align: left;
                        border-bottom: 1px solid #eee;
                    }
                    
                    th {
                        background: #f8f9fa;
                        font-weight: 600;
                        color: #333;
                        white-space: nowrap;
                    }
                    
                    tr:hover {
                        background: #f8f9fa;
                    }
                    
                    .badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    
                    .incident-number {
                        font-family: monospace;
                        font-weight: 600;
                        color: #e17055;
                    }
                    
                    .event-type {
                        padding: 3px 10px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .event-type.accident { background: #ffe6e6; color: #dc3545; }
                    .event-type.incident { background: #fff3cd; color: #856404; }
                    .event-type.near-miss { background: #cce5ff; color: #004085; }
                    
                    .injury-badge {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 3px;
                        font-size: 11px;
                    }
                    .injury-yes { background: #ffe6e6; color: #dc3545; }
                    .injury-no { background: #e8f5e9; color: #2e7d32; }
                    
                    .actions a {
                        color: #0078d4;
                        text-decoration: none;
                        margin-right: 10px;
                    }
                    .actions a:hover {
                        text-decoration: underline;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 60px 20px;
                        color: #666;
                    }
                    .empty-state .icon {
                        font-size: 60px;
                        margin-bottom: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Incident History</h1>
                    <div class="header-nav">
                        <a href="/stores/ohs-incident">+ New Report</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>OHS Incident Reports</h2>
                        <p>View all submitted accident and incident reports</p>
                    </div>
                    
                    <div class="card">
                        <div class="toolbar">
                            <input type="text" class="search-box" placeholder="Search by incident number, store, or description..." id="searchBox" onkeyup="filterTable()">
                            <a href="/stores/ohs-incident" class="btn btn-primary">+ New Report</a>
                        </div>
                        
                        <div class="table-container">
                            ${incidents.recordset.length === 0 ? `
                                <div class="empty-state">
                                    <div class="icon">📭</div>
                                    <h3>No Incidents Reported Yet</h3>
                                    <p>When you submit incident reports, they will appear here.</p>
                                    <br>
                                    <a href="/stores/ohs-incident" class="btn btn-primary">Submit Your First Report</a>
                                </div>
                            ` : `
                                <table id="incidentsTable">
                                    <thead>
                                        <tr>
                                            <th>Incident #</th>
                                            <th>Date</th>
                                            <th>Store</th>
                                            <th>Event Type</th>
                                            <th>Category</th>
                                            <th>Injury</th>
                                            <th>Status</th>
                                            <th>Reported By</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${incidents.recordset.map(inc => {
                                            const eventClass = (inc.EventTypeName || '').toLowerCase().replace(/\s+/g, '-');
                                            const statusColor = statusColors[inc.Status] || '#636e72';
                                            return `
                                                <tr data-id="${inc.Id}">
                                                    <td class="incident-number">${inc.IncidentNumber}</td>
                                                    <td>${new Date(inc.IncidentDate).toLocaleDateString()}</td>
                                                    <td>${inc.StoreName || '-'}</td>
                                                    <td><span class="event-type ${eventClass}">${inc.EventTypeName || '-'}</span></td>
                                                    <td>${inc.CategoryName || '-'}</td>
                                                    <td><span class="injury-badge ${inc.InjuryOccurred ? 'injury-yes' : 'injury-no'}">${inc.InjuryOccurred ? 'Yes' : 'No'}</span></td>
                                                    <td><span class="badge" style="background: ${statusColor}; color: white;">${inc.Status || 'Pending'}</span></td>
                                                    <td>${inc.ReportedByName || '-'}</td>
                                                    <td class="actions">
                                                        <a href="/stores/ohs-incident/view/${inc.Id}">View</a>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            `}
                        </div>
                    </div>
                </div>
                
                <script>
                    function filterTable() {
                        const search = document.getElementById('searchBox').value.toLowerCase();
                        document.querySelectorAll('#incidentsTable tbody tr').forEach(row => {
                            const text = row.textContent.toLowerCase();
                            row.style.display = text.includes(search) ? '' : 'none';
                        });
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading incident history:', error);
        res.status(500).send('Error loading incident history: ' + error.message);
    }
});

// View single incident details
router.get('/view/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT i.*, 
                       e.EventTypeName,
                       c.CategoryName,
                       sc.SubCategoryName,
                       it.InjuryTypeName,
                       bp.BodyPartName
                FROM OHSIncidents i
                LEFT JOIN OHSEventTypes e ON i.EventTypeId = e.Id
                LEFT JOIN OHSEventCategories c ON i.CategoryId = c.Id
                LEFT JOIN OHSEventSubCategories sc ON i.SubCategoryId = sc.Id
                LEFT JOIN OHSInjuryTypes it ON i.InjuryTypeId = it.Id
                LEFT JOIN OHSBodyParts bp ON i.BodyPartId = bp.Id
                WHERE i.Id = @id
            `);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).send('Incident not found');
        }
        
        const inc = result.recordset[0];
        const attachments = inc.Attachments ? JSON.parse(inc.Attachments) : [];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>${inc.IncidentNumber} - OHS Incident</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f5f5f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 22px; }
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
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .incident-header {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 15px;
                    }
                    
                    .incident-number {
                        font-size: 28px;
                        font-family: monospace;
                        color: #e17055;
                    }
                    
                    .badge {
                        padding: 8px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    
                    .section {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        margin-bottom: 20px;
                    }
                    
                    .section-title {
                        font-size: 18px;
                        color: #333;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #e17055;
                    }
                    
                    .detail-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                    }
                    
                    .detail-item label {
                        display: block;
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 5px;
                        text-transform: uppercase;
                    }
                    
                    .detail-item .value {
                        font-size: 16px;
                        color: #333;
                    }
                    
                    .description-box {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        margin-top: 15px;
                        white-space: pre-wrap;
                    }
                    
                    .attachments-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin-top: 15px;
                    }
                    
                    .attachment-item {
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    
                    .attachment-item img {
                        width: 100%;
                        height: 120px;
                        object-fit: cover;
                    }
                    
                    .attachment-item a {
                        display: block;
                        padding: 10px;
                        text-align: center;
                        color: #0078d4;
                        text-decoration: none;
                        font-size: 12px;
                    }
                    
                    .event-type {
                        padding: 5px 15px;
                        border-radius: 5px;
                        font-weight: 500;
                    }
                    .event-type.accident { background: #ffe6e6; color: #dc3545; }
                    .event-type.incident { background: #fff3cd; color: #856404; }
                    .event-type.near-miss { background: #cce5ff; color: #004085; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Incident Details</h1>
                    <div class="header-nav">
                        <a href="/stores/ohs-incident/history">← Back to History</a>
                        <a href="/stores/ohs-incident">+ New Report</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="incident-header">
                        <div>
                            <div class="incident-number">${inc.IncidentNumber}</div>
                            <div style="color: #666; margin-top: 5px;">Reported on ${new Date(inc.CreatedAt).toLocaleString()}</div>
                        </div>
                        <div>
                            <span class="event-type ${(inc.EventTypeName || '').toLowerCase().replace(/\s+/g, '-')}">${inc.EventTypeName || 'N/A'}</span>
                            <span class="badge" style="background: ${inc.Status === 'Resolved' ? '#00b894' : inc.Status === 'Under Review' ? '#74b9ff' : '#fdcb6e'}; color: white; margin-left: 10px;">${inc.Status || 'Pending'}</span>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">📅 Event Details</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Date of Incident</label>
                                <div class="value">${new Date(inc.IncidentDate).toLocaleDateString()}</div>
                            </div>
                            <div class="detail-item">
                                <label>Time of Incident</label>
                                <div class="value">${inc.IncidentTime ? inc.IncidentTime.toString().substring(0, 5) : 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <label>Store</label>
                                <div class="value">${inc.StoreName || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <label>Exact Location</label>
                                <div class="value">${inc.ExactLocation || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <label>Category</label>
                                <div class="value">${inc.CategoryName || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <label>Sub-Category</label>
                                <div class="value">${inc.SubCategoryName || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="description-box">
                            <strong>Description:</strong><br><br>
                            ${inc.IncidentDescription || 'No description provided'}
                        </div>
                    </div>
                    
                    ${inc.InjuryOccurred ? `
                        <div class="section">
                            <h3 class="section-title">🩹 Injury Details</h3>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Injured Person</label>
                                    <div class="value">${inc.InjuredPersonName || 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Person Type</label>
                                    <div class="value">${inc.InjuredPersonType || 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Employee ID</label>
                                    <div class="value">${inc.InjuredPersonEmployeeId || 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Injury Type</label>
                                    <div class="value">${inc.InjuryTypeName || 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Body Part</label>
                                    <div class="value">${inc.BodyPartName || 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Medical Treatment</label>
                                    <div class="value">${inc.MedicalTreatmentRequired ? 'Yes' : 'No'}</div>
                                </div>
                            </div>
                            ${inc.InjuryDescription ? `
                                <div class="description-box">
                                    <strong>Injury Description:</strong><br><br>
                                    ${inc.InjuryDescription}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="section">
                        <h3 class="section-title">📝 Additional Information</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Witnesses</label>
                                <div class="value">${inc.WitnessNames || 'None'}</div>
                            </div>
                            <div class="detail-item">
                                <label>Reported By</label>
                                <div class="value">${inc.ReportedByName || 'N/A'}</div>
                            </div>
                        </div>
                        ${inc.ImmediateActions ? `
                            <div class="description-box">
                                <strong>Immediate Actions Taken:</strong><br><br>
                                ${inc.ImmediateActions}
                            </div>
                        ` : ''}
                    </div>
                    
                    ${attachments.length > 0 ? `
                        <div class="section">
                            <h3 class="section-title">📎 Attachments</h3>
                            <div class="attachments-grid">
                                ${attachments.map(att => {
                                    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(att);
                                    return `
                                        <div class="attachment-item">
                                            ${isImage ? `<img src="${att}" alt="Attachment">` : ''}
                                            <a href="${att}" target="_blank">${isImage ? 'View Full Image' : 'Download File'}</a>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error viewing incident:', error);
        res.status(500).send('Error loading incident: ' + error.message);
    }
});
module.exports = router;
