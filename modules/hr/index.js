/**
 * HR & Talent Module
 * Handles HR-related tasks including Extra Cleaning approvals where HR is responsible
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

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

// HR Dashboard
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get counts for Extra Cleaning requests where HR is in the approval chain
        const hrPendingResult = await pool.request()
            .query(`
                SELECT COUNT(*) as count 
                FROM ExtraCleaningRequests 
                WHERE SelectedHRId IS NOT NULL 
                AND CurrentApproverRole = 'HR' 
                AND OverallStatus = 'PendingApproval'
            `);
        
        const hrApprovedResult = await pool.request()
            .query(`
                SELECT COUNT(*) as count 
                FROM ExtraCleaningRequests 
                WHERE SelectedHRId IS NOT NULL 
                AND OverallStatus = 'FullyApproved'
            `);
        
        const hrRejectedResult = await pool.request()
            .query(`
                SELECT COUNT(*) as count 
                FROM ExtraCleaningRequests 
                WHERE SelectedHRId IS NOT NULL 
                AND OverallStatus = 'Rejected'
            `);
        
        const hrTotalResult = await pool.request()
            .query(`
                SELECT COUNT(*) as count 
                FROM ExtraCleaningRequests 
                WHERE SelectedHRId IS NOT NULL
            `);
        
        await pool.close();
        
        const hrPending = hrPendingResult.recordset[0].count;
        const hrApproved = hrApprovedResult.recordset[0].count;
        const hrRejected = hrRejectedResult.recordset[0].count;
        const hrTotal = hrTotalResult.recordset[0].count;
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>HR & Talent - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .header {
                        background: linear-gradient(135deg, #6B5B95 0%, #8B7CB3 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 10px;
                        margin-bottom: 25px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 28px; }
                    .header-subtitle { opacity: 0.9; margin-top: 5px; }
                    .back-link {
                        color: white;
                        text-decoration: none;
                        padding: 10px 20px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 6px;
                    }
                    .back-link:hover { background: rgba(255,255,255,0.3); }
                    
                    .cards-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-decoration: none;
                        color: inherit;
                        display: block;
                    }
                    .card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
                    }
                    .card-icon {
                        font-size: 40px;
                        margin-bottom: 15px;
                    }
                    .card-title {
                        font-size: 18px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: #333;
                    }
                    .card-desc {
                        color: #666;
                        font-size: 14px;
                        margin-bottom: 15px;
                    }
                    .card-stats {
                        display: flex;
                        gap: 15px;
                        flex-wrap: wrap;
                    }
                    .stat {
                        background: #f5f5f5;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-size: 12px;
                    }
                    .stat-value {
                        font-weight: 700;
                        font-size: 16px;
                        display: block;
                    }
                    .stat-pending { color: #ffc107; background: #fff8e1; }
                    .stat-approved { color: #28a745; background: #e8f5e9; }
                    .stat-rejected { color: #dc3545; background: #ffebee; }
                    .stat-total { color: #6B5B95; background: #f3e5f5; }
                    
                    .section-title {
                        font-size: 20px;
                        font-weight: 600;
                        margin-bottom: 15px;
                        color: #333;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>👥 HR & Talent</h1>
                        <div class="header-subtitle">Employee relations & HR approvals</div>
                    </div>
                    <a href="/dashboard" class="back-link">← Back to Dashboard</a>
                </div>
                
                <h2 class="section-title">HR Forms & Approvals</h2>
                
                <div class="cards-grid">
                    <!-- Extra Cleaning HR Requests -->
                    <a href="/hr/extra-cleaning" class="card">
                        <div class="card-icon">🧹</div>
                        <div class="card-title">Extra Cleaning Requests</div>
                        <div class="card-desc">View all Extra Cleaning requests where HR is responsible in the approval chain</div>
                        <div class="card-stats">
                            <div class="stat stat-pending">
                                <span class="stat-value">${hrPending}</span>
                                Pending HR
                            </div>
                            <div class="stat stat-approved">
                                <span class="stat-value">${hrApproved}</span>
                                Approved
                            </div>
                            <div class="stat stat-rejected">
                                <span class="stat-value">${hrRejected}</span>
                                Rejected
                            </div>
                            <div class="stat stat-total">
                                <span class="stat-value">${hrTotal}</span>
                                Total
                            </div>
                        </div>
                    </a>
                    
                    <!-- Parking Violations History -->
                    <a href="/hr/parking-violations" class="card">
                        <div class="card-icon">🅿️</div>
                        <div class="card-title">Parking Violations</div>
                        <div class="card-desc">View all parking violation reports submitted by security</div>
                        <div class="card-stats">
                            <div class="stat stat-total">
                                <span class="stat-value">View History</span>
                            </div>
                        </div>
                    </a>
                    
                    <!-- Placeholder for future HR modules -->
                    <div class="card" style="opacity: 0.5; cursor: not-allowed;">
                        <div class="card-icon">📝</div>
                        <div class="card-title">Employee Cases</div>
                        <div class="card-desc">Manage employee relations cases and documentation</div>
                        <div class="card-stats">
                            <div class="stat">Coming Soon</div>
                        </div>
                    </div>
                    
                    <div class="card" style="opacity: 0.5; cursor: not-allowed;">
                        <div class="card-icon">📊</div>
                        <div class="card-title">HR Reports</div>
                        <div class="card-desc">View HR analytics and generate reports</div>
                        <div class="card-stats">
                            <div class="stat">Coming Soon</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading HR dashboard:', err);
        res.status(500).send('Error loading HR dashboard: ' + err.message);
    }
});

// Extra Cleaning HR Requests List
router.get('/extra-cleaning', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all Extra Cleaning requests where HR is in the approval chain
        const requests = await pool.request()
            .query(`
                SELECT 
                    r.*,
                    u.DisplayName as CreatedByName,
                    hr.DisplayName as HRResponsibleName
                FROM ExtraCleaningRequests r
                LEFT JOIN Users u ON r.CreatedBy = u.Id
                LEFT JOIN Users hr ON r.SelectedHRId = hr.Id
                WHERE r.SelectedHRId IS NOT NULL
                ORDER BY r.CreatedAt DESC
            `);
        
        await pool.close();
        
        // Build table rows
        const tableRows = requests.recordset.map(r => {
            const statusClass = r.OverallStatus === 'FullyApproved' ? 'status-approved' 
                : r.OverallStatus === 'Rejected' ? 'status-rejected' 
                : 'status-pending';
            
            const statusText = r.OverallStatus === 'FullyApproved' ? 'Approved' 
                : r.OverallStatus === 'Rejected' ? 'Rejected' 
                : r.CurrentApproverRole === 'HR' ? 'Pending HR' : 'Pending ' + (r.CurrentApproverRole || 'Approval');
            
            const startDate = new Date(r.StartDate).toLocaleDateString('en-GB');
            const endDate = new Date(r.EndDate).toLocaleDateString('en-GB');
            
            return `
                <tr onclick="viewRequest(${r.Id})" style="cursor:pointer;">
                    <td>#${r.Id}</td>
                    <td>${r.Store || '-'}</td>
                    <td>${r.Category || '-'}</td>
                    <td>${r.ThirdParty || '-'}</td>
                    <td>${r.NumberOfAgents || '-'}</td>
                    <td>${startDate} - ${endDate}</td>
                    <td>${r.HRResponsibleName || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${r.CreatedByName || 'Unknown'}</td>
                    <td>${new Date(r.CreatedAt).toLocaleDateString('en-GB')}</td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Extra Cleaning HR Requests - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        max-width: 1400px; 
                        margin: 0 auto; 
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .header {
                        background: linear-gradient(135deg, #6B5B95 0%, #8B7CB3 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 10px;
                        margin-bottom: 25px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .back-link {
                        color: white;
                        text-decoration: none;
                        padding: 10px 20px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 6px;
                    }
                    .back-link:hover { background: rgba(255,255,255,0.3); }
                    
                    .content {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    
                    .filters {
                        display: flex;
                        gap: 15px;
                        margin-bottom: 20px;
                        flex-wrap: wrap;
                    }
                    .filter-group {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .filter-group label { font-weight: 600; color: #555; }
                    .filter-group select, .filter-group input {
                        padding: 8px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th, td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #eee;
                    }
                    th {
                        background: #f8f9fa;
                        font-weight: 600;
                        color: #333;
                    }
                    tr:hover {
                        background: #f5f5f5;
                    }
                    
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .status-approved { background: #e8f5e9; color: #28a745; }
                    .status-rejected { background: #ffebee; color: #dc3545; }
                    .status-pending { background: #fff8e1; color: #f57c00; }
                    
                    .empty-state {
                        text-align: center;
                        padding: 50px;
                        color: #666;
                    }
                    .empty-state-icon {
                        font-size: 50px;
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧹 Extra Cleaning HR Requests</h1>
                    <a href="/hr" class="back-link">← Back to HR</a>
                </div>
                
                <div class="content">
                    <div class="filters">
                        <div class="filter-group">
                            <label>Status:</label>
                            <select id="filterStatus" onchange="filterTable()">
                                <option value="">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Search:</label>
                            <input type="text" id="searchBox" placeholder="Store, Category..." onkeyup="filterTable()">
                        </div>
                    </div>
                    
                    ${requests.recordset.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <h3>No HR Requests Found</h3>
                            <p>There are no Extra Cleaning requests with HR involvement yet.</p>
                        </div>
                    ` : `
                        <table id="requestsTable">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Store</th>
                                    <th>Category</th>
                                    <th>Provider</th>
                                    <th>Agents</th>
                                    <th>Period</th>
                                    <th>HR Responsible</th>
                                    <th>Status</th>
                                    <th>Created By</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    `}
                </div>
                
                <script>
                    function viewRequest(id) {
                        window.location.href = '/stores/extra-cleaning/approve/' + id;
                    }
                    
                    function filterTable() {
                        const status = document.getElementById('filterStatus').value.toLowerCase();
                        const search = document.getElementById('searchBox').value.toLowerCase();
                        const rows = document.querySelectorAll('#requestsTable tbody tr');
                        
                        rows.forEach(row => {
                            const text = row.textContent.toLowerCase();
                            const statusBadge = row.querySelector('.status-badge');
                            const rowStatus = statusBadge ? statusBadge.textContent.toLowerCase() : '';
                            
                            const matchesStatus = !status || rowStatus.includes(status);
                            const matchesSearch = !search || text.includes(search);
                            
                            row.style.display = matchesStatus && matchesSearch ? '' : 'none';
                        });
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading Extra Cleaning HR requests:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Parking Violations History for HR
router.get('/parking-violations', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`
                SELECT v.*, 
                       (SELECT COUNT(*) FROM Security_ParkingViolation_Images WHERE ViolationId = v.Id) as ImageCount
                FROM Security_ParkingViolations v
                ORDER BY v.ViolationDate DESC, v.CreatedAt DESC
            `);
        
        await pool.close();
        
        const violations = result.recordset;
        
        let tableRows = violations.map(v => {
            const violationDate = new Date(v.ViolationDate).toLocaleDateString('en-GB', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });
            const createdAt = new Date(v.CreatedAt).toLocaleDateString('en-GB');
            const imageCount = v.ImageCount || (v.ImagePath ? 1 : 0);
            
            return `
                <tr onclick="window.location.href='/hr/parking-violations/${v.Id}'" style="cursor: pointer;">
                    <td>${v.Id}</td>
                    <td>${violationDate}</td>
                    <td>${v.Location}</td>
                    <td>${v.ParkingLotInfo || '-'}</td>
                    <td>${imageCount} 📷</td>
                    <td>${v.CreatedBy}</td>
                    <td>${createdAt}</td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Parking Violations - HR - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        max-width: 1400px; 
                        margin: 0 auto; 
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .header {
                        background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 10px;
                        margin-bottom: 25px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.9;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .filters {
                        display: flex;
                        gap: 15px;
                        margin-bottom: 20px;
                        flex-wrap: wrap;
                    }
                    .filters input, .filters select {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                    }
                    .filters input { min-width: 200px; }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th {
                        background: #f8f9fa;
                        padding: 12px 15px;
                        text-align: left;
                        font-weight: 600;
                        color: #333;
                        border-bottom: 2px solid #dee2e6;
                    }
                    td {
                        padding: 12px 15px;
                        border-bottom: 1px solid #eee;
                    }
                    tr:hover {
                        background: #fff5f5;
                    }
                    .empty-state {
                        text-align: center;
                        padding: 60px;
                        color: #666;
                    }
                    .stats-bar {
                        display: flex;
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .stat-item {
                        background: #f8f9fa;
                        padding: 15px 25px;
                        border-radius: 8px;
                        text-align: center;
                    }
                    .stat-value {
                        font-size: 28px;
                        font-weight: 700;
                        color: #c62828;
                    }
                    .stat-label {
                        font-size: 12px;
                        color: #666;
                        text-transform: uppercase;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🅿️ Parking Violations History</h1>
                    <div class="header-nav">
                        <a href="/hr">← Back to HR</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="stats-bar">
                    <div class="stat-item">
                        <div class="stat-value">${violations.length}</div>
                        <div class="stat-label">Total Violations</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="filters">
                        <input type="text" id="searchBox" placeholder="🔍 Search..." onkeyup="filterTable()">
                        <select id="filterLocation" onchange="filterTable()">
                            <option value="">All Locations</option>
                            <option value="HO Zouk">HO Zouk</option>
                            <option value="HO Dbayeh">HO Dbayeh</option>
                        </select>
                    </div>
                    
                    ${violations.length > 0 ? `
                        <table id="violationsTable">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Info</th>
                                    <th>Photos</th>
                                    <th>Reported By</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    ` : `
                        <div class="empty-state">
                            <div style="font-size: 60px; margin-bottom: 15px;">🅿️</div>
                            <p>No parking violations found</p>
                        </div>
                    `}
                </div>
                
                <script>
                    function filterTable() {
                        const search = document.getElementById('searchBox').value.toLowerCase();
                        const location = document.getElementById('filterLocation').value.toLowerCase();
                        const rows = document.querySelectorAll('#violationsTable tbody tr');
                        
                        rows.forEach(row => {
                            const text = row.textContent.toLowerCase();
                            const matchesSearch = !search || text.includes(search);
                            const matchesLocation = !location || text.includes(location);
                            row.style.display = matchesSearch && matchesLocation ? '' : 'none';
                        });
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading parking violations:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// View Single Parking Violation (HR)
router.get('/parking-violations/:id', async (req, res) => {
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
        
        // Get all images
        const imagesResult = await pool.request()
            .input('violationId', sql.Int, violationId)
            .query(`SELECT ImagePath FROM Security_ParkingViolation_Images WHERE ViolationId = @violationId ORDER BY Id`);
        
        await pool.close();
        
        const violation = result.recordset[0];
        const images = imagesResult.recordset;
        
        // Fall back to legacy ImagePath if no images in new table
        if (images.length === 0 && violation.ImagePath) {
            images.push({ ImagePath: violation.ImagePath });
        }
        
        const violationDate = new Date(violation.ViolationDate).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
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
                <title>Parking Violation #${violation.Id} - HR - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        max-width: 900px; 
                        margin: 0 auto; 
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .header {
                        background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 10px;
                        margin-bottom: 25px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 20px;
                        opacity: 0.9;
                    }
                    .header-nav a:hover { opacity: 1; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
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
                        margin-bottom: 15px;
                    }
                    .info-text {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        margin-bottom: 25px;
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
                    .gallery-item:hover { transform: scale(1.02); }
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
                        margin-top: 25px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 13px;
                        color: #888;
                    }
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
                    .lightbox.active { display: flex; }
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
                <div class="header">
                    <h1>🅿️ Parking Violation #${violation.Id}</h1>
                    <div class="header-nav">
                        <a href="/hr/parking-violations">← Back to Violations</a>
                        <a href="/hr">HR Dashboard</a>
                    </div>
                </div>
                
                <div class="card">
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
                            <label>Reported By</label>
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
        console.error('Error viewing parking violation:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
