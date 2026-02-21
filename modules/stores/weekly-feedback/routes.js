/**
 * Weekly Third Party Feedback Routes
 * Store managers submit weekly feedback about third party services
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { markFeedbackNotificationsRead } = require('../../../services/notification-scheduler');

// Configure multer for image uploads
const uploadDir = path.join(__dirname, '../../../uploads/weekly-feedback');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'feedback-' + uniqueSuffix + path.extname(file.originalname));
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

// Helper: Get current week's start and end dates
function getCurrentWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    return {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0]
    };
}

// Main page - Weekly Feedback Form
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const currentWeek = getCurrentWeekDates();
        
        // Get stores from database
        const storesResult = await pool.request()
            .query(`SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName`);
        
        // Get users with specific roles (Head of Operations and Area Manager)
        const usersResult = await pool.request()
            .query(`SELECT u.Id, u.DisplayName, u.Email, r.RoleName 
                    FROM Users u 
                    LEFT JOIN UserRoles r ON u.RoleId = r.Id 
                    WHERE r.RoleName IN ('Head of Operations', 'Area Manager', 'Head of Operational Excellence')
                    ORDER BY r.RoleName, u.DisplayName`);
        
        const stores = storesResult.recordset;
        const users = usersResult.recordset;
        
        const headOfOps = users.filter(u => u.RoleName === 'Head of Operations' || u.RoleName === 'Head of Operational Excellence');
        const areaManagers = users.filter(u => u.RoleName === 'Area Manager');
        
        await pool.close();
        
        // Current user info
        const currentUser = req.currentUser || {};
        
        const storeOptions = stores.map(s => 
            `<option value="${s.Id}" data-name="${s.StoreName}">${s.StoreName}</option>`
        ).join('');
        
        const hoOptions = headOfOps.map(u => 
            `<option value="${u.Id}" data-name="${u.DisplayName}" data-email="${u.Email}">${u.DisplayName}</option>`
        ).join('');
        
        const amOptions = areaManagers.map(u => 
            `<option value="${u.Id}" data-name="${u.DisplayName}" data-email="${u.Email}">${u.DisplayName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Weekly Third Party Feedback - ${process.env.APP_NAME}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); transition: all 0.2s; }
                    .header-nav a:hover { background: rgba(255,255,255,0.25); }
                    .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                    .form-card { background: white; border-radius: 12px; box-shadow: 0 2px 15px rgba(0,0,0,0.08); overflow: hidden; }
                    .form-header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 25px; text-align: center; }
                    .form-header h2 { margin: 0; font-size: 22px; }
                    .form-header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
                    .form-body { padding: 30px; }
                    .form-section { margin-bottom: 25px; }
                    .form-section h3 { color: #6c5ce7; font-size: 16px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0; }
                    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px; }
                    .form-group label span.required { color: #e74c3c; }
                    .form-group input, .form-group select, .form-group textarea { 
                        width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; 
                        font-size: 14px; transition: all 0.2s; font-family: inherit;
                    }
                    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
                        outline: none; border-color: #6c5ce7; box-shadow: 0 0 0 3px rgba(108,92,231,0.1); 
                    }
                    .form-group textarea { min-height: 100px; resize: vertical; }
                    .rating-group { display: flex; gap: 10px; flex-wrap: wrap; }
                    .rating-item { flex: 1; min-width: 150px; background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; }
                    .rating-item label { display: block; margin-bottom: 10px; font-weight: 600; color: #333; font-size: 13px; }
                    .stars { display: flex; justify-content: center; gap: 5px; }
                    .stars input { display: none; }
                    .stars label { cursor: pointer; font-size: 28px; color: #ddd; transition: color 0.2s; }
                    .stars label:hover, .stars label:hover ~ label, .stars input:checked ~ label { color: #f1c40f; }
                    .stars:hover label { color: #ddd; }
                    .stars label:hover, .stars label:hover ~ label { color: #f1c40f; }
                    .week-info { background: #e8f4fd; border-radius: 8px; padding: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
                    .week-info .icon { font-size: 24px; }
                    .week-info .text { flex: 1; }
                    .week-info .dates { font-weight: 600; color: #0078d4; }
                    .btn-submit { 
                        width: 100%; padding: 16px; background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); 
                        color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; 
                        cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px;
                    }
                    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(108,92,231,0.3); }
                    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                    .user-info { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
                    .user-info p { margin: 5px 0; font-size: 14px; }
                    .user-info strong { color: #6c5ce7; }
                    .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: 600; display: none; z-index: 1000; }
                    .toast-success { background: #00b894; }
                    .toast-error { background: #d63031; }
                    .image-upload-area { 
                        border: 2px dashed #ddd; border-radius: 12px; padding: 30px; text-align: center; 
                        cursor: pointer; transition: all 0.2s; position: relative; min-height: 150px;
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                    }
                    .image-upload-area:hover { border-color: #6c5ce7; background: #f8f5ff; }
                    .image-upload-area p { margin: 10px 0 5px 0; color: #666; font-size: 14px; }
                    @media (max-width: 600px) {
                        .form-row { grid-template-columns: 1fr; }
                        .rating-group { flex-direction: column; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Weekly Third Party Feedback</h1>
                    <div class="header-nav">
                        <a href="/stores/weekly-feedback/history">📜 My Submissions</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="form-card">
                        <div class="form-header">
                            <h2>Weekly Third Party Feedback Form</h2>
                            <p>Submit your weekly feedback about third party services at your store</p>
                        </div>
                        <div class="form-body">
                            <form id="feedbackForm" method="POST" action="/stores/weekly-feedback/submit">
                                <div class="week-info">
                                    <span class="icon">📅</span>
                                    <div class="text">
                                        <div>Current Week</div>
                                        <div class="dates">${currentWeek.start} to ${currentWeek.end}</div>
                                    </div>
                                </div>
                                
                                <input type="hidden" name="weekStart" value="${currentWeek.start}">
                                <input type="hidden" name="weekEnd" value="${currentWeek.end}">
                                
                                <div class="form-section">
                                    <h3>📍 Store Information</h3>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Store Name <span class="required">*</span></label>
                                            <select name="storeId" id="storeId" required>
                                                <option value="">Select Store</option>
                                                ${storeOptions}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-section">
                                    <h3>👥 Management</h3>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Head of Operations <span class="required">*</span></label>
                                            <select name="headOfOpsId" id="headOfOpsId" required>
                                                <option value="">Select Head of Operations</option>
                                                ${hoOptions}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Area Manager <span class="required">*</span></label>
                                            <select name="areaManagerId" id="areaManagerId" required>
                                                <option value="">Select Area Manager</option>
                                                ${amOptions}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="user-info">
                                    <p><strong>Submitted By:</strong> ${currentUser.displayName || currentUser.email || 'Unknown'}</p>
                                    <p><strong>Email:</strong> ${currentUser.email || 'N/A'}</p>
                                </div>
                                
                                <div class="form-section">
                                    <h3>⭐ Ratings</h3>
                                    <p style="color: #666; font-size: 13px; margin-bottom: 15px;">Rate the third party service for this week (1 = Poor, 5 = Excellent)</p>
                                    <div class="rating-group">
                                        <div class="rating-item">
                                            <label>Overall Performance</label>
                                            <div class="stars" data-rating="overallRating">
                                                <input type="radio" name="overallRating" value="5" id="overall5"><label for="overall5">★</label>
                                                <input type="radio" name="overallRating" value="4" id="overall4"><label for="overall4">★</label>
                                                <input type="radio" name="overallRating" value="3" id="overall3"><label for="overall3">★</label>
                                                <input type="radio" name="overallRating" value="2" id="overall2"><label for="overall2">★</label>
                                                <input type="radio" name="overallRating" value="1" id="overall1"><label for="overall1">★</label>
                                            </div>
                                        </div>
                                        <div class="rating-item">
                                            <label>Cleanliness</label>
                                            <div class="stars" data-rating="cleanlinessRating">
                                                <input type="radio" name="cleanlinessRating" value="5" id="clean5"><label for="clean5">★</label>
                                                <input type="radio" name="cleanlinessRating" value="4" id="clean4"><label for="clean4">★</label>
                                                <input type="radio" name="cleanlinessRating" value="3" id="clean3"><label for="clean3">★</label>
                                                <input type="radio" name="cleanlinessRating" value="2" id="clean2"><label for="clean2">★</label>
                                                <input type="radio" name="cleanlinessRating" value="1" id="clean1"><label for="clean1">★</label>
                                            </div>
                                        </div>
                                        <div class="rating-item">
                                            <label>Punctuality</label>
                                            <div class="stars" data-rating="punctualityRating">
                                                <input type="radio" name="punctualityRating" value="5" id="punct5"><label for="punct5">★</label>
                                                <input type="radio" name="punctualityRating" value="4" id="punct4"><label for="punct4">★</label>
                                                <input type="radio" name="punctualityRating" value="3" id="punct3"><label for="punct3">★</label>
                                                <input type="radio" name="punctualityRating" value="2" id="punct2"><label for="punct2">★</label>
                                                <input type="radio" name="punctualityRating" value="1" id="punct1"><label for="punct1">★</label>
                                            </div>
                                        </div>
                                        <div class="rating-item">
                                            <label>Communication</label>
                                            <div class="stars" data-rating="communicationRating">
                                                <input type="radio" name="communicationRating" value="5" id="comm5"><label for="comm5">★</label>
                                                <input type="radio" name="communicationRating" value="4" id="comm4"><label for="comm4">★</label>
                                                <input type="radio" name="communicationRating" value="3" id="comm3"><label for="comm3">★</label>
                                                <input type="radio" name="communicationRating" value="2" id="comm2"><label for="comm2">★</label>
                                                <input type="radio" name="communicationRating" value="1" id="comm1"><label for="comm1">★</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-section">
                                    <h3>💬 Feedback Details</h3>
                                    <div class="form-group">
                                        <label>General Comments</label>
                                        <textarea name="comments" placeholder="Share your general observations about the third party service this week..."></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Issues Reported</label>
                                        <textarea name="issuesReported" placeholder="List any issues or problems encountered..."></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Recommendations</label>
                                        <textarea name="recommendations" placeholder="Any suggestions for improvement..."></textarea>
                                    </div>
                                </div>
                                
                                <div class="form-section">
                                    <h3>📷 Attach Image (Optional)</h3>
                                    <div class="form-group">
                                        <label>Upload an image to support your feedback</label>
                                        <div class="image-upload-container">
                                            <input type="file" name="feedbackImage" id="feedbackImage" accept="image/*" style="display: none;">
                                            <div class="image-upload-area" onclick="document.getElementById('feedbackImage').click()">
                                                <div id="imagePreviewContainer" style="display: none;">
                                                    <img id="imagePreview" src="" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                                                    <button type="button" onclick="event.stopPropagation(); removeImage();" style="position: absolute; top: 5px; right: 5px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">×</button>
                                                </div>
                                                <div id="uploadPlaceholder">
                                                    <span style="font-size: 40px;">📷</span>
                                                    <p>Click to upload an image</p>
                                                    <small style="color: #999;">Max size: 10MB (JPG, PNG, GIF, WebP)</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="submit" class="btn-submit" id="submitBtn">
                                    <span>📤</span> Submit Weekly Feedback
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
                    
                    // Image preview functionality
                    document.getElementById('feedbackImage').addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                                showToast('Image size must be less than 10MB', 'error');
                                e.target.value = '';
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                document.getElementById('imagePreview').src = e.target.result;
                                document.getElementById('imagePreviewContainer').style.display = 'block';
                                document.getElementById('uploadPlaceholder').style.display = 'none';
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                    
                    function removeImage() {
                        document.getElementById('feedbackImage').value = '';
                        document.getElementById('imagePreviewContainer').style.display = 'none';
                        document.getElementById('uploadPlaceholder').style.display = 'block';
                    }
                    
                    document.getElementById('feedbackForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const btn = document.getElementById('submitBtn');
                        btn.disabled = true;
                        btn.innerHTML = '<span class="spinner"></span> Submitting...';
                        
                        const formData = new FormData(this);
                        
                        // Get selected option names and add them to formData
                        const storeSelect = document.getElementById('storeId');
                        const hoSelect = document.getElementById('headOfOpsId');
                        const amSelect = document.getElementById('areaManagerId');
                        
                        formData.append('storeName', storeSelect.options[storeSelect.selectedIndex]?.dataset.name || '');
                        formData.append('headOfOpsName', hoSelect.options[hoSelect.selectedIndex]?.dataset.name || '');
                        formData.append('headOfOpsEmail', hoSelect.options[hoSelect.selectedIndex]?.dataset.email || '');
                        formData.append('areaManagerName', amSelect.options[amSelect.selectedIndex]?.dataset.name || '');
                        formData.append('areaManagerEmail', amSelect.options[amSelect.selectedIndex]?.dataset.email || '');
                        
                        try {
                            const res = await fetch('/stores/weekly-feedback/submit', {
                                method: 'POST',
                                body: formData  // Send as FormData (no Content-Type header - browser sets it automatically with boundary)
                            });
                            
                            const result = await res.json();
                            
                            if (res.ok && result.success) {
                                showToast('Feedback submitted successfully!', 'success');
                                setTimeout(() => {
                                    window.location.href = '/stores/weekly-feedback/success/' + result.id;
                                }, 1500);
                            } else {
                                showToast(result.error || 'Failed to submit feedback', 'error');
                                btn.disabled = false;
                                btn.innerHTML = '<span>📤</span> Submit Weekly Feedback';
                            }
                        } catch (err) {
                            showToast('Error: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.innerHTML = '<span>📤</span> Submit Weekly Feedback';
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading feedback form:', err);
        res.status(500).send('Error loading form: ' + err.message);
    }
});

// Submit feedback
router.post('/submit', upload.single('feedbackImage'), async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const data = req.body;
        const currentUser = req.currentUser || {};
        const imagePath = req.file ? '/uploads/weekly-feedback/' + req.file.filename : null;
        
        // Check if feedback already submitted for this store this week
        const existingCheck = await pool.request()
            .input('storeId', sql.Int, data.storeId)
            .input('weekStart', sql.Date, data.weekStart)
            .input('weekEnd', sql.Date, data.weekEnd)
            .query(`SELECT Id FROM WeeklyThirdPartyFeedback 
                    WHERE StoreId = @storeId AND WeekStartDate = @weekStart AND WeekEndDate = @weekEnd`);
        
        if (existingCheck.recordset.length > 0) {
            await pool.close();
            return res.status(400).json({ success: false, error: 'Feedback already submitted for this store this week' });
        }
        
        const result = await pool.request()
            .input('storeId', sql.Int, data.storeId)
            .input('storeName', sql.NVarChar(100), data.storeName)
            .input('storeManagerId', sql.Int, currentUser.id || null)
            .input('storeManagerName', sql.NVarChar(200), currentUser.displayName || currentUser.email)
            .input('storeManagerEmail', sql.NVarChar(200), currentUser.email)
            .input('areaManagerId', sql.Int, data.areaManagerId || null)
            .input('areaManagerName', sql.NVarChar(200), data.areaManagerName)
            .input('areaManagerEmail', sql.NVarChar(200), data.areaManagerEmail)
            .input('headOfOpsId', sql.Int, data.headOfOpsId || null)
            .input('headOfOpsName', sql.NVarChar(200), data.headOfOpsName)
            .input('headOfOpsEmail', sql.NVarChar(200), data.headOfOpsEmail)
            .input('weekStart', sql.Date, data.weekStart)
            .input('weekEnd', sql.Date, data.weekEnd)
            .input('overallRating', sql.Int, data.overallRating || null)
            .input('cleanlinessRating', sql.Int, data.cleanlinessRating || null)
            .input('punctualityRating', sql.Int, data.punctualityRating || null)
            .input('communicationRating', sql.Int, data.communicationRating || null)
            .input('comments', sql.NVarChar(sql.MAX), data.comments || null)
            .input('issuesReported', sql.NVarChar(sql.MAX), data.issuesReported || null)
            .input('recommendations', sql.NVarChar(sql.MAX), data.recommendations || null)
            .input('imagePath', sql.NVarChar(500), imagePath)
            .input('createdBy', sql.Int, currentUser.id || null)
            .query(`INSERT INTO WeeklyThirdPartyFeedback 
                    (StoreId, StoreName, StoreManagerId, StoreManagerName, StoreManagerEmail,
                     AreaManagerId, AreaManagerName, AreaManagerEmail,
                     HeadOfOperationsId, HeadOfOperationsName, HeadOfOperationsEmail,
                     WeekStartDate, WeekEndDate, OverallRating, CleanlinessRating, 
                     PunctualityRating, CommunicationRating, Comments, IssuesReported, 
                     Recommendations, ImagePath, CreatedBy)
                    OUTPUT INSERTED.Id
                    VALUES (@storeId, @storeName, @storeManagerId, @storeManagerName, @storeManagerEmail,
                            @areaManagerId, @areaManagerName, @areaManagerEmail,
                            @headOfOpsId, @headOfOpsName, @headOfOpsEmail,
                            @weekStart, @weekEnd, @overallRating, @cleanlinessRating,
                            @punctualityRating, @communicationRating, @comments, @issuesReported,
                            @recommendations, @imagePath, @createdBy)`);
        
        const feedbackId = result.recordset[0].Id;
        
        await pool.close();
        
        // Mark feedback-related notifications as read
        if (currentUser.id || currentUser.email) {
            await markFeedbackNotificationsRead(currentUser.id, currentUser.email);
        }
        
        res.json({ success: true, id: feedbackId, message: 'Feedback submitted successfully' });
    } catch (err) {
        console.error('Error submitting feedback:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Success page
router.get('/success/:id', async (req, res) => {
    const feedbackId = req.params.id;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Feedback Submitted - ${process.env.APP_NAME}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .container { max-width: 500px; background: white; border-radius: 16px; padding: 50px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
                .icon { font-size: 80px; margin-bottom: 20px; }
                h1 { color: #00b894; margin: 0 0 15px 0; }
                p { color: #666; margin-bottom: 30px; font-size: 16px; }
                .ref { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
                .ref strong { color: #6c5ce7; }
                .btn { display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 5px; transition: all 0.2s; }
                .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(108,92,231,0.3); }
                .btn-secondary { background: #dfe6e9; color: #2d3436; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✅</div>
                <h1>Feedback Submitted!</h1>
                <p>Thank you for submitting your weekly third party feedback.</p>
                <div class="ref">
                    <strong>Reference ID:</strong> WF-${feedbackId}
                </div>
                <a href="/stores/weekly-feedback" class="btn">📋 Submit Another</a>
                <a href="/stores/weekly-feedback/history" class="btn btn-secondary">📜 View History</a>
                <a href="/stores" class="btn btn-secondary">← Stores</a>
            </div>
        </body>
        </html>
    `);
});

// History page - My submissions
router.get('/history', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const currentUser = req.currentUser || {};
        
        // Show all feedback records
        const result = await pool.request()
            .query(`SELECT * FROM WeeklyThirdPartyFeedback 
                    ORDER BY CreatedAt DESC`);
        
        await pool.close();
        
        const tableRows = result.recordset.map(r => `
            <tr>
                <td><strong>WF-${r.Id}</strong></td>
                <td>${r.StoreName}</td>
                <td>${new Date(r.WeekStartDate).toLocaleDateString('en-GB')} - ${new Date(r.WeekEndDate).toLocaleDateString('en-GB')}</td>
                <td>${'⭐'.repeat(r.OverallRating || 0)}</td>
                <td>${new Date(r.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>
                    <a href="/stores/weekly-feedback/view/${r.Id}" style="color: #6c5ce7; text-decoration: none;">View</a>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>My Feedback History - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    .table-container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f8f9fa; padding: 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #dee2e6; }
                    td { padding: 15px; border-bottom: 1px solid #eee; }
                    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
                    .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📜 My Feedback History</h1>
                    <div class="header-nav">
                        <a href="/stores/weekly-feedback">➕ New Feedback</a>
                        <a href="/stores">← Back to Stores</a>
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
                                        <th>Week</th>
                                        <th>Rating</th>
                                        <th>Submitted</th>
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
                                <h3>No feedback submitted yet</h3>
                                <p>Start by submitting your weekly feedback.</p>
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

// View single feedback
router.get('/view/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const feedbackId = parseInt(req.params.id);
        
        const result = await pool.request()
            .input('id', sql.Int, feedbackId)
            .query(`SELECT * FROM WeeklyThirdPartyFeedback WHERE Id = @id`);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).send('Feedback not found');
        }
        
        const f = result.recordset[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>View Feedback WF-${f.Id} - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { font-size: 24px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); margin-bottom: 20px; }
                    .card-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #eee; }
                    .card-header h3 { color: #6c5ce7; }
                    .card-body { padding: 20px; }
                    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
                    .detail-label { width: 180px; color: #666; font-weight: 500; }
                    .detail-value { flex: 1; }
                    .rating { color: #f1c40f; font-size: 18px; }
                    .text-block { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Feedback WF-${f.Id}</h1>
                    <div class="header-nav">
                        <a href="/stores/weekly-feedback/history">← Back to History</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header"><h3>📍 Store Information</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Store:</span><span class="detail-value">${f.StoreName}</span></div>
                            <div class="detail-row"><span class="detail-label">Week:</span><span class="detail-value">${new Date(f.WeekStartDate).toLocaleDateString('en-GB')} - ${new Date(f.WeekEndDate).toLocaleDateString('en-GB')}</span></div>
                            <div class="detail-row"><span class="detail-label">Submitted By:</span><span class="detail-value">${f.StoreManagerName}</span></div>
                            <div class="detail-row"><span class="detail-label">Area Manager:</span><span class="detail-value">${f.AreaManagerName || 'N/A'}</span></div>
                            <div class="detail-row"><span class="detail-label">Head of Operations:</span><span class="detail-value">${f.HeadOfOperationsName || 'N/A'}</span></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>⭐ Ratings</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Overall:</span><span class="detail-value rating">${'★'.repeat(f.OverallRating || 0)}${'☆'.repeat(5 - (f.OverallRating || 0))}</span></div>
                            <div class="detail-row"><span class="detail-label">Cleanliness:</span><span class="detail-value rating">${'★'.repeat(f.CleanlinessRating || 0)}${'☆'.repeat(5 - (f.CleanlinessRating || 0))}</span></div>
                            <div class="detail-row"><span class="detail-label">Punctuality:</span><span class="detail-value rating">${'★'.repeat(f.PunctualityRating || 0)}${'☆'.repeat(5 - (f.PunctualityRating || 0))}</span></div>
                            <div class="detail-row"><span class="detail-label">Communication:</span><span class="detail-value rating">${'★'.repeat(f.CommunicationRating || 0)}${'☆'.repeat(5 - (f.CommunicationRating || 0))}</span></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>💬 Feedback Details</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Comments:</span></div>
                            <div class="text-block">${f.Comments || 'No comments'}</div>
                            <div class="detail-row" style="margin-top:20px"><span class="detail-label">Issues Reported:</span></div>
                            <div class="text-block">${f.IssuesReported || 'No issues reported'}</div>
                            <div class="detail-row" style="margin-top:20px"><span class="detail-label">Recommendations:</span></div>
                            <div class="text-block">${f.Recommendations || 'No recommendations'}</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing feedback:', err);
        res.status(500).send('Error viewing feedback: ' + err.message);
    }
});

module.exports = router;
