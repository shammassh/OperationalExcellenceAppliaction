/**
 * Parking Violation Form
 * Track parking violations with photo upload
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Database config
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
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../uploads/parking-violations');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'parking-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Parking Violation Form Page
router.get('/', (req, res) => {
    const user = req.currentUser;
    const today = new Date().toISOString().split('T')[0];
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Parking Violation - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container { max-width: 800px; margin: 0 auto; }
                .header {
                    background: rgba(255,255,255,0.95);
                    border-radius: 15px;
                    padding: 25px 30px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .header h1 {
                    color: #333;
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .header-nav a {
                    color: #c62828;
                    text-decoration: none;
                    font-weight: 500;
                    margin-left: 20px;
                }
                .header-nav a:hover { text-decoration: underline; }
                .form-card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .form-row {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    margin-bottom: 25px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                }
                .form-group.full-width {
                    grid-column: 1 / -1;
                }
                .form-group label {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .form-group label .required { color: #e74c3c; }
                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 12px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    font-size: 15px;
                    transition: all 0.3s;
                }
                .form-group textarea {
                    min-height: 100px;
                    resize: vertical;
                }
                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: #c62828;
                    box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.1);
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #c62828;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .upload-area {
                    border: 2px dashed #ddd;
                    border-radius: 10px;
                    padding: 40px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                    background: #fafafa;
                }
                .upload-area:hover {
                    border-color: #c62828;
                    background: #fff5f5;
                }
                .upload-area.has-file {
                    border-color: #4caf50;
                    background: #e8f5e9;
                }
                .upload-area input[type="file"] {
                    display: none;
                }
                .upload-icon {
                    font-size: 50px;
                    margin-bottom: 15px;
                }
                .upload-text {
                    color: #666;
                    font-size: 14px;
                }
                .upload-text strong {
                    color: #c62828;
                }
                .preview-container {
                    margin-top: 15px;
                    display: none;
                }
                .preview-container img {
                    max-width: 100%;
                    max-height: 300px;
                    border-radius: 10px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .btn-submit {
                    background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                    color: white;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.3s;
                    margin-top: 20px;
                }
                .btn-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(198, 40, 40, 0.4);
                }
                .btn-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                .alert {
                    padding: 15px 20px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    display: none;
                }
                .alert-success {
                    background: #d1fae5;
                    color: #065f46;
                    border: 1px solid #a7f3d0;
                }
                .alert-error {
                    background: #fee2e2;
                    color: #991b1b;
                    border: 1px solid #fecaca;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🅿️ Parking Violation</h1>
                    <div class="header-nav">
                        <a href="/security">← Back to Security</a>
                    </div>
                </div>
                
                <div class="form-card">
                    <div id="alertBox" class="alert"></div>
                    
                    <form id="violationForm" enctype="multipart/form-data">
                        <div class="section-title">📋 Violation Details</div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Date <span class="required">*</span></label>
                                <input type="date" id="violationDate" name="violationDate" value="${today}" required>
                            </div>
                            <div class="form-group">
                                <label>Location <span class="required">*</span></label>
                                <select id="location" name="location" required>
                                    <option value="">Select Location</option>
                                    <option value="HO Zouk">HO Zouk</option>
                                    <option value="HO Dbayeh">HO Dbayeh</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group full-width">
                                <label>Parking Lot Information</label>
                                <textarea id="parkingLotInfo" name="parkingLotInfo" placeholder="Enter details about the parking violation..."></textarea>
                            </div>
                        </div>
                        
                        <div class="section-title">📷 Photo Evidence</div>
                        
                        <div class="upload-area" id="uploadArea" onclick="document.getElementById('imageFile').click()">
                            <input type="file" id="imageFile" name="image" accept="image/*">
                            <div class="upload-icon">📷</div>
                            <div class="upload-text">
                                <strong>Click to upload</strong> or drag and drop<br>
                                JPG, PNG, GIF up to 10MB
                            </div>
                            <div class="preview-container" id="previewContainer">
                                <img id="imagePreview" src="" alt="Preview">
                            </div>
                        </div>
                        
                        <button type="submit" class="btn-submit" id="submitBtn">
                            Submit Violation Report
                        </button>
                    </form>
                </div>
            </div>
            
            <script>
                const imageInput = document.getElementById('imageFile');
                const uploadArea = document.getElementById('uploadArea');
                const previewContainer = document.getElementById('previewContainer');
                const imagePreview = document.getElementById('imagePreview');
                
                imageInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            imagePreview.src = e.target.result;
                            previewContainer.style.display = 'block';
                            uploadArea.classList.add('has-file');
                            uploadArea.querySelector('.upload-icon').style.display = 'none';
                            uploadArea.querySelector('.upload-text').innerHTML = '<strong>' + file.name + '</strong><br>Click to change';
                        };
                        reader.readAsDataURL(file);
                    }
                });
                
                // Drag and drop
                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.style.borderColor = '#c62828';
                });
                
                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.style.borderColor = '#ddd';
                });
                
                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                        imageInput.files = e.dataTransfer.files;
                        imageInput.dispatchEvent(new Event('change'));
                    }
                });
                
                function showAlert(message, type) {
                    const alertBox = document.getElementById('alertBox');
                    alertBox.textContent = message;
                    alertBox.className = 'alert alert-' + type;
                    alertBox.style.display = 'block';
                    setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
                }
                
                document.getElementById('violationForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const violationDate = document.getElementById('violationDate').value;
                    const location = document.getElementById('location').value;
                    
                    if (!violationDate || !location) {
                        showAlert('Please fill in all required fields', 'error');
                        return;
                    }
                    
                    const submitBtn = document.getElementById('submitBtn');
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Submitting...';
                    
                    try {
                        const formData = new FormData(this);
                        
                        const response = await fetch('/security-services/parking-violation/save', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            showAlert('Violation report submitted successfully!', 'success');
                            setTimeout(() => {
                                window.location.href = '/security-services/parking-violation/' + result.violationId;
                            }, 1500);
                        } else {
                            showAlert(result.message || 'Error submitting report', 'error');
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Submit Violation Report';
                        }
                    } catch (err) {
                        showAlert('Error: ' + err.message, 'error');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit Violation Report';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Save Parking Violation
router.post('/save', upload.single('image'), async (req, res) => {
    const user = req.currentUser;
    const { violationDate, location, parkingLotInfo } = req.body;
    
    if (!violationDate || !location) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const imagePath = req.file ? '/uploads/parking-violations/' + req.file.filename : null;
        
        const result = await pool.request()
            .input('violationDate', sql.Date, violationDate)
            .input('location', sql.NVarChar, location)
            .input('parkingLotInfo', sql.NVarChar, parkingLotInfo || '')
            .input('imagePath', sql.NVarChar, imagePath)
            .input('createdBy', sql.NVarChar, user.displayName)
            .input('createdById', sql.NVarChar, user.id)
            .query(`
                INSERT INTO Security_ParkingViolations (ViolationDate, Location, ParkingLotInfo, ImagePath, CreatedBy, CreatedById)
                OUTPUT INSERTED.Id
                VALUES (@violationDate, @location, @parkingLotInfo, @imagePath, @createdBy, @createdById)
            `);
        
        const violationId = result.recordset[0].Id;
        
        await pool.close();
        
        res.json({ success: true, violationId });
    } catch (err) {
        console.error('Error saving parking violation:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// View Parking Violation
router.get('/:id', async (req, res) => {
    const user = req.currentUser;
    const violationId = req.params.id;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, violationId)
            .query(`SELECT * FROM Security_ParkingViolations WHERE Id = @id`);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).send('Violation not found');
        }
        
        const violation = result.recordset[0];
        const violationDate = new Date(violation.ViolationDate).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>View Parking Violation - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 800px; margin: 0 auto; }
                    .header {
                        background: rgba(255,255,255,0.95);
                        border-radius: 15px;
                        padding: 25px 30px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .header h1 {
                        color: #333;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .header-nav a {
                        color: #c62828;
                        text-decoration: none;
                        font-weight: 500;
                        margin-left: 20px;
                    }
                    .view-card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #eee;
                    }
                    .info-item label {
                        display: block;
                        font-size: 12px;
                        color: #888;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    .info-item span {
                        font-size: 16px;
                        font-weight: 600;
                        color: #333;
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
                    .info-text {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        margin-bottom: 30px;
                        line-height: 1.6;
                    }
                    .image-container {
                        text-align: center;
                    }
                    .image-container img {
                        max-width: 100%;
                        max-height: 500px;
                        border-radius: 10px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    }
                    .no-image {
                        background: #f8f9fa;
                        padding: 60px;
                        border-radius: 10px;
                        text-align: center;
                        color: #888;
                    }
                    .footer-info {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 13px;
                        color: #888;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🅿️ Parking Violation #${violation.Id}</h1>
                        <div class="header-nav">
                            <a href="/security-services/parking-violation">+ New Report</a>
                            <a href="/security/parking-violations">← Back to History</a>
                        </div>
                    </div>
                    
                    <div class="view-card">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Date</label>
                                <span>${violationDate}</span>
                            </div>
                            <div class="info-item">
                                <label>Location</label>
                                <span>${violation.Location}</span>
                            </div>
                            <div class="info-item">
                                <label>Created By</label>
                                <span>${violation.CreatedBy}</span>
                            </div>
                        </div>
                        
                        ${violation.ParkingLotInfo ? `
                            <div class="section-title">📋 Parking Lot Information</div>
                            <div class="info-text">${violation.ParkingLotInfo}</div>
                        ` : ''}
                        
                        <div class="section-title">📷 Photo Evidence</div>
                        <div class="image-container">
                            ${violation.ImagePath ? `
                                <img src="${violation.ImagePath}" alt="Parking Violation Photo">
                            ` : `
                                <div class="no-image">
                                    <div style="font-size: 40px; margin-bottom: 10px;">📷</div>
                                    No photo uploaded
                                </div>
                            `}
                        </div>
                        
                        <div class="footer-info">
                            Report created on ${new Date(violation.CreatedAt).toLocaleString('en-GB')}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading parking violation:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
