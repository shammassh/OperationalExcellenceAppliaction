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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
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

// Multiple file upload middleware (up to 10 images)
const uploadMultiple = upload.array('images', 10);

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
                .preview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 15px;
                    margin-top: 20px;
                }
                .preview-item {
                    position: relative;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .preview-item img {
                    width: 100%;
                    height: 150px;
                    object-fit: cover;
                }
                .preview-item .remove-btn {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: rgba(198, 40, 40, 0.9);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .preview-item .remove-btn:hover {
                    background: #b71c1c;
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
                        
                        <div class="upload-area" id="uploadArea" onclick="document.getElementById('imageFiles').click()">
                            <input type="file" id="imageFiles" name="images" accept="image/*" multiple>
                            <div class="upload-icon">📷</div>
                            <div class="upload-text">
                                <strong>Click to upload</strong> or drag and drop<br>
                                JPG, PNG, GIF up to 10MB each (max 10 images)
                            </div>
                        </div>
                        <div class="preview-grid" id="previewGrid"></div>
                        
                        <button type="submit" class="btn-submit" id="submitBtn">
                            Submit Violation Report
                        </button>
                    </form>
                </div>
            </div>
            
            <script>
                const imageInput = document.getElementById('imageFiles');
                const uploadArea = document.getElementById('uploadArea');
                const previewGrid = document.getElementById('previewGrid');
                let selectedFiles = [];
                
                function updatePreviews() {
                    previewGrid.innerHTML = '';
                    selectedFiles.forEach((file, index) => {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const div = document.createElement('div');
                            div.className = 'preview-item';
                            div.innerHTML = \`
                                <img src="\${e.target.result}" alt="Preview">
                                <button type="button" class="remove-btn" onclick="removeImage(\${index})">×</button>
                            \`;
                            previewGrid.appendChild(div);
                        };
                        reader.readAsDataURL(file);
                    });
                    
                    if (selectedFiles.length > 0) {
                        uploadArea.classList.add('has-file');
                        uploadArea.querySelector('.upload-text').innerHTML = '<strong>' + selectedFiles.length + ' image(s) selected</strong><br>Click to add more';
                    } else {
                        uploadArea.classList.remove('has-file');
                        uploadArea.querySelector('.upload-text').innerHTML = '<strong>Click to upload</strong> or drag and drop<br>JPG, PNG, GIF up to 10MB each (max 10 images)';
                    }
                }
                
                function removeImage(index) {
                    selectedFiles.splice(index, 1);
                    updatePreviews();
                    updateFileInput();
                }
                
                function updateFileInput() {
                    const dt = new DataTransfer();
                    selectedFiles.forEach(file => dt.items.add(file));
                    imageInput.files = dt.files;
                }
                
                imageInput.addEventListener('change', function(e) {
                    const newFiles = Array.from(e.target.files);
                    const totalFiles = selectedFiles.length + newFiles.length;
                    
                    if (totalFiles > 10) {
                        showAlert('Maximum 10 images allowed', 'error');
                        return;
                    }
                    
                    selectedFiles = [...selectedFiles, ...newFiles];
                    updatePreviews();
                    updateFileInput();
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
                    uploadArea.style.borderColor = '#ddd';
                    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    const totalFiles = selectedFiles.length + droppedFiles.length;
                    
                    if (totalFiles > 10) {
                        showAlert('Maximum 10 images allowed', 'error');
                        return;
                    }
                    
                    selectedFiles = [...selectedFiles, ...droppedFiles];
                    updatePreviews();
                    updateFileInput();
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
router.post('/save', uploadMultiple, async (req, res) => {
    const user = req.currentUser;
    const { violationDate, location, parkingLotInfo } = req.body;
    
    if (!violationDate || !location) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Insert violation record (ImagePath kept for backward compatibility - stores first image)
        const firstImagePath = req.files && req.files.length > 0 ? '/uploads/parking-violations/' + req.files[0].filename : null;
        
        const result = await pool.request()
            .input('violationDate', sql.Date, violationDate)
            .input('location', sql.NVarChar, location)
            .input('parkingLotInfo', sql.NVarChar, parkingLotInfo || '')
            .input('imagePath', sql.NVarChar, firstImagePath)
            .input('createdBy', sql.NVarChar, user.displayName)
            .input('createdById', sql.NVarChar, user.id)
            .query(`
                INSERT INTO Security_ParkingViolations (ViolationDate, Location, ParkingLotInfo, ImagePath, CreatedBy, CreatedById)
                OUTPUT INSERTED.Id
                VALUES (@violationDate, @location, @parkingLotInfo, @imagePath, @createdBy, @createdById)
            `);
        
        const violationId = result.recordset[0].Id;
        
        // Insert all images into the images table
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const imagePath = '/uploads/parking-violations/' + file.filename;
                await pool.request()
                    .input('violationId', sql.Int, violationId)
                    .input('imagePath', sql.NVarChar, imagePath)
                    .query(`
                        INSERT INTO Security_ParkingViolation_Images (ViolationId, ImagePath)
                        VALUES (@violationId, @imagePath)
                    `);
            }
        }
        
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
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, violationId)
            .query(`SELECT * FROM Security_ParkingViolations WHERE Id = @id`);
        
        if (result.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Violation not found');
        }
        
        // Get all images for this violation
        const imagesResult = await pool.request()
            .input('violationId', sql.Int, violationId)
            .query(`SELECT ImagePath FROM Security_ParkingViolation_Images WHERE ViolationId = @violationId ORDER BY Id`);
        
        await pool.close();
        
        const violation = result.recordset[0];
        const images = imagesResult.recordset;
        
        // If no images in new table, fall back to legacy ImagePath
        if (images.length === 0 && violation.ImagePath) {
            images.push({ ImagePath: violation.ImagePath });
        }
        
        const violationDate = new Date(violation.ViolationDate).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        // Build images HTML
        let imagesHtml = '';
        if (images.length > 0) {
            imagesHtml = '<div class="image-gallery">' + 
                images.map(img => `<div class="gallery-item"><img src="${img.ImagePath}" alt="Parking Violation Photo" onclick="openLightbox('${img.ImagePath}')"></div>`).join('') +
                '</div>';
        } else {
            imagesHtml = `
                <div class="no-image">
                    <div style="font-size: 40px; margin-bottom: 10px;">📷</div>
                    No photos uploaded
                </div>
            `;
        }
        
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
                    .container { max-width: 900px; margin: 0 auto; }
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
                    .image-gallery {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 15px;
                    }
                    .gallery-item {
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        cursor: pointer;
                        transition: transform 0.3s;
                    }
                    .gallery-item:hover {
                        transform: scale(1.02);
                    }
                    .gallery-item img {
                        width: 100%;
                        height: 200px;
                        object-fit: cover;
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
                    /* Lightbox */
                    .lightbox {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.9);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .lightbox.active {
                        display: flex;
                    }
                    .lightbox img {
                        max-width: 90%;
                        max-height: 90%;
                        border-radius: 10px;
                    }
                    .lightbox-close {
                        position: absolute;
                        top: 20px;
                        right: 30px;
                        color: white;
                        font-size: 40px;
                        cursor: pointer;
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
                        
                        <div class="section-title">📷 Photo Evidence (${images.length} image${images.length !== 1 ? 's' : ''})</div>
                        ${imagesHtml}
                        
                        <div class="footer-info">
                            Report created on ${new Date(violation.CreatedAt).toLocaleString('en-GB')}
                        </div>
                    </div>
                </div>
                
                <div class="lightbox" id="lightbox" onclick="closeLightbox()">
                    <span class="lightbox-close">&times;</span>
                    <img id="lightboxImg" src="" alt="Full size">
                </div>
                
                <script>
                    function openLightbox(src) {
                        document.getElementById('lightboxImg').src = src;
                        document.getElementById('lightbox').classList.add('active');
                    }
                    function closeLightbox() {
                        document.getElementById('lightbox').classList.remove('active');
                    }
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') closeLightbox();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading parking violation:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
