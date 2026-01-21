/**
 * Weekly Feedback Dashboard
 * View and analyze all weekly third party feedback submissions
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

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

// API: Get stats for dashboard card
router.get('/api/stats', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 END) as today,
                COUNT(CASE WHEN CreatedAt >= DATEADD(DAY, 1 - DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE)) THEN 1 END) as thisWeek,
                COUNT(CASE WHEN YEAR(CreatedAt) = YEAR(GETDATE()) AND MONTH(CreatedAt) = MONTH(GETDATE()) THEN 1 END) as thisMonth
            FROM WeeklyThirdPartyFeedback
        `);
        
        const stats = result.recordset[0];
        res.json(stats);
    } catch (err) {
        console.error('Error getting feedback stats:', err);
        res.json({ total: 0, today: 0, thisWeek: 0, thisMonth: 0 });
    } finally {
        if (pool) await pool.close();
    }
});

// Main dashboard page
router.get('/', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get all feedback with filters
        const storeFilter = req.query.store || '';
        const weekFilter = req.query.week || '';
        const ratingFilter = req.query.rating || '';
        
        let whereClause = '1=1';
        if (storeFilter) whereClause += ` AND StoreId = ${parseInt(storeFilter)}`;
        if (weekFilter) whereClause += ` AND WeekStartDate = '${weekFilter}'`;
        if (ratingFilter) whereClause += ` AND OverallRating = ${parseInt(ratingFilter)}`;
        
        const feedbackResult = await pool.request()
            .query(`SELECT * FROM WeeklyThirdPartyFeedback 
                    WHERE ${whereClause}
                    ORDER BY CreatedAt DESC`);
        
        // Get stores for filter
        const storesResult = await pool.request()
            .query(`SELECT DISTINCT StoreId, StoreName FROM WeeklyThirdPartyFeedback ORDER BY StoreName`);
        
        // Get weeks for filter
        const weeksResult = await pool.request()
            .query(`SELECT DISTINCT WeekStartDate, WeekEndDate FROM WeeklyThirdPartyFeedback ORDER BY WeekStartDate DESC`);
        
        // Calculate averages
        const avgResult = await pool.request()
            .query(`SELECT 
                    AVG(CAST(OverallRating AS FLOAT)) as avgOverall,
                    AVG(CAST(CleanlinessRating AS FLOAT)) as avgCleanliness,
                    AVG(CAST(PunctualityRating AS FLOAT)) as avgPunctuality,
                    AVG(CAST(CommunicationRating AS FLOAT)) as avgCommunication
                    FROM WeeklyThirdPartyFeedback`);
        
        const avgs = avgResult.recordset[0];
        
        const storeOptions = storesResult.recordset.map(s => 
            `<option value="${s.StoreId}" ${storeFilter == s.StoreId ? 'selected' : ''}>${s.StoreName}</option>`
        ).join('');
        
        const weekOptions = weeksResult.recordset.map(w => {
            const start = new Date(w.WeekStartDate).toLocaleDateString('en-GB');
            const end = new Date(w.WeekEndDate).toLocaleDateString('en-GB');
            const val = w.WeekStartDate.toISOString().split('T')[0];
            return `<option value="${val}" ${weekFilter === val ? 'selected' : ''}>${start} - ${end}</option>`;
        }).join('');
        
        const tableRows = feedbackResult.recordset.map(r => `
            <tr>
                <td><strong>WF-${r.Id}</strong></td>
                <td>${r.StoreName}</td>
                <td>${new Date(r.WeekStartDate).toLocaleDateString('en-GB')} - ${new Date(r.WeekEndDate).toLocaleDateString('en-GB')}</td>
                <td>${r.StoreManagerName || '-'}</td>
                <td class="rating-cell">${'★'.repeat(r.OverallRating || 0)}${'☆'.repeat(5 - (r.OverallRating || 0))}</td>
                <td class="rating-cell">${'★'.repeat(r.CleanlinessRating || 0)}${'☆'.repeat(5 - (r.CleanlinessRating || 0))}</td>
                <td class="rating-cell">${'★'.repeat(r.PunctualityRating || 0)}${'☆'.repeat(5 - (r.PunctualityRating || 0))}</td>
                <td class="rating-cell">${'★'.repeat(r.CommunicationRating || 0)}${'☆'.repeat(5 - (r.CommunicationRating || 0))}</td>
                <td>${new Date(r.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>
                    <a href="/operational-excellence/feedback-dashboard/view/${r.Id}" class="btn-view">View</a>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Weekly Feedback Dashboard - ${process.env.APP_NAME}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .header-nav a:hover { background: rgba(255,255,255,0.25); }
                    
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    
                    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 15px rgba(0,0,0,0.08); text-align: center; }
                    .stat-card .value { font-size: 32px; font-weight: 700; color: #6c5ce7; }
                    .stat-card .label { color: #666; font-size: 13px; margin-top: 5px; }
                    .stat-card .stars { font-size: 24px; color: #ffc107; }
                    
                    .filters { background: white; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 2px 15px rgba(0,0,0,0.08); display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
                    .filters label { font-weight: 600; color: #333; margin-right: 5px; }
                    .filters select { padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; min-width: 180px; }
                    .filters button { padding: 10px 20px; background: #6c5ce7; color: white; border: none; border-radius: 6px; cursor: pointer; }
                    .filters button:hover { background: #5b4bd5; }
                    .filters .btn-reset { background: #dfe6e9; color: #333; }
                    
                    .table-container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f8f9fa; padding: 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #dee2e6; white-space: nowrap; }
                    td { padding: 15px; border-bottom: 1px solid #eee; }
                    tr:hover { background: #f8f9fa; }
                    
                    .rating-cell { color: #ffc107; font-size: 14px; white-space: nowrap; }
                    
                    .btn-view { padding: 6px 14px; background: #6c5ce7; color: white; text-decoration: none; border-radius: 5px; font-size: 13px; }
                    .btn-view:hover { background: #5b4bd5; }
                    
                    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
                    .empty-state .icon { font-size: 64px; margin-bottom: 15px; opacity: 0.5; }
                    
                    @media (max-width: 768px) {
                        .stats-grid { grid-template-columns: repeat(2, 1fr); }
                        .filters { flex-direction: column; }
                        .filters select { width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Weekly Feedback Dashboard</h1>
                    <div class="header-nav">
                        <a href="/operational-excellence">← Back to OE</a>
                        <a href="/dashboard">🏠 Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="value">${feedbackResult.recordset.length}</div>
                            <div class="label">Total Submissions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stars">${'★'.repeat(Math.round(avgs.avgOverall || 0))}${'☆'.repeat(5 - Math.round(avgs.avgOverall || 0))}</div>
                            <div class="label">Avg Overall (${(avgs.avgOverall || 0).toFixed(1)})</div>
                        </div>
                        <div class="stat-card">
                            <div class="stars">${'★'.repeat(Math.round(avgs.avgCleanliness || 0))}${'☆'.repeat(5 - Math.round(avgs.avgCleanliness || 0))}</div>
                            <div class="label">Avg Cleanliness (${(avgs.avgCleanliness || 0).toFixed(1)})</div>
                        </div>
                        <div class="stat-card">
                            <div class="stars">${'★'.repeat(Math.round(avgs.avgPunctuality || 0))}${'☆'.repeat(5 - Math.round(avgs.avgPunctuality || 0))}</div>
                            <div class="label">Avg Punctuality (${(avgs.avgPunctuality || 0).toFixed(1)})</div>
                        </div>
                    </div>
                    
                    <div class="filters">
                        <div>
                            <label>Store:</label>
                            <select id="storeFilter">
                                <option value="">All Stores</option>
                                ${storeOptions}
                            </select>
                        </div>
                        <div>
                            <label>Week:</label>
                            <select id="weekFilter">
                                <option value="">All Weeks</option>
                                ${weekOptions}
                            </select>
                        </div>
                        <div>
                            <label>Rating:</label>
                            <select id="ratingFilter">
                                <option value="">All Ratings</option>
                                <option value="5" ${ratingFilter === '5' ? 'selected' : ''}>⭐⭐⭐⭐⭐ (5)</option>
                                <option value="4" ${ratingFilter === '4' ? 'selected' : ''}>⭐⭐⭐⭐ (4)</option>
                                <option value="3" ${ratingFilter === '3' ? 'selected' : ''}>⭐⭐⭐ (3)</option>
                                <option value="2" ${ratingFilter === '2' ? 'selected' : ''}>⭐⭐ (2)</option>
                                <option value="1" ${ratingFilter === '1' ? 'selected' : ''}>⭐ (1)</option>
                            </select>
                        </div>
                        <button onclick="applyFilters()">🔍 Filter</button>
                        <button class="btn-reset" onclick="resetFilters()">↺ Reset</button>
                    </div>
                    
                    <div class="table-container">
                        ${feedbackResult.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Week</th>
                                        <th>Submitted By</th>
                                        <th>Overall</th>
                                        <th>Cleanliness</th>
                                        <th>Punctuality</th>
                                        <th>Communication</th>
                                        <th>Date</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div class="icon">📋</div>
                                <p>No feedback submissions found</p>
                            </div>
                        `}
                    </div>
                </div>
                
                <script>
                    function applyFilters() {
                        const store = document.getElementById('storeFilter').value;
                        const week = document.getElementById('weekFilter').value;
                        const rating = document.getElementById('ratingFilter').value;
                        
                        let url = '/operational-excellence/feedback-dashboard?';
                        if (store) url += 'store=' + store + '&';
                        if (week) url += 'week=' + week + '&';
                        if (rating) url += 'rating=' + rating + '&';
                        
                        window.location.href = url;
                    }
                    
                    function resetFilters() {
                        window.location.href = '/operational-excellence/feedback-dashboard';
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading feedback dashboard:', err);
        res.status(500).send('Error loading dashboard: ' + err.message);
    } finally {
        if (pool) await pool.close();
    }
});

// View single feedback details
router.get('/view/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const feedbackId = req.params.id;
        
        const result = await pool.request()
            .input('id', sql.Int, feedbackId)
            .query(`SELECT * FROM WeeklyThirdPartyFeedback WHERE Id = @id`);
        
        if (result.recordset.length === 0) {
            return res.status(404).send('Feedback not found');
        }
        
        const feedback = result.recordset[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Feedback Details - ${process.env.APP_NAME}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { font-size: 24px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    
                    .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); margin-bottom: 25px; }
                    .card-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #eee; }
                    .card-header h2 { font-size: 18px; color: #333; display: flex; align-items: center; gap: 10px; }
                    .card-body { padding: 25px; }
                    
                    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
                    .info-item { padding: 15px; background: #f8f9fa; border-radius: 8px; }
                    .info-item label { display: block; font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
                    .info-item .value { font-size: 16px; color: #333; font-weight: 500; }
                    
                    .ratings-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0; }
                    .rating-box { text-align: center; padding: 20px; background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%); border-radius: 10px; }
                    .rating-box .stars { font-size: 24px; color: #ffc107; }
                    .rating-box .label { font-size: 12px; color: #666; margin-top: 8px; }
                    
                    .text-section { margin-top: 20px; }
                    .text-section h4 { color: #6c5ce7; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
                    .text-section p { background: #f8f9fa; padding: 15px; border-radius: 8px; color: #333; line-height: 1.6; }
                    .text-section p.empty { color: #999; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Feedback Details - WF-${feedback.Id}</h1>
                    <div class="header-nav">
                        <a href="/operational-excellence/feedback-dashboard">← Back to Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <h2>📍 Store & Week Information</h2>
                        </div>
                        <div class="card-body">
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Store</label>
                                    <div class="value">${feedback.StoreName}</div>
                                </div>
                                <div class="info-item">
                                    <label>Week Period</label>
                                    <div class="value">${new Date(feedback.WeekStartDate).toLocaleDateString('en-GB')} - ${new Date(feedback.WeekEndDate).toLocaleDateString('en-GB')}</div>
                                </div>
                                <div class="info-item">
                                    <label>Submitted By</label>
                                    <div class="value">${feedback.StoreManagerName || '-'}</div>
                                </div>
                                <div class="info-item">
                                    <label>Submission Date</label>
                                    <div class="value">${new Date(feedback.CreatedAt).toLocaleString('en-GB')}</div>
                                </div>
                                <div class="info-item">
                                    <label>Area Manager</label>
                                    <div class="value">${feedback.AreaManagerName || '-'}</div>
                                </div>
                                <div class="info-item">
                                    <label>Head of Operations</label>
                                    <div class="value">${feedback.HeadOfOperationsName || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h2>⭐ Ratings</h2>
                        </div>
                        <div class="card-body">
                            <div class="ratings-grid">
                                <div class="rating-box">
                                    <div class="stars">${'★'.repeat(feedback.OverallRating || 0)}${'☆'.repeat(5 - (feedback.OverallRating || 0))}</div>
                                    <div class="label">Overall</div>
                                </div>
                                <div class="rating-box">
                                    <div class="stars">${'★'.repeat(feedback.CleanlinessRating || 0)}${'☆'.repeat(5 - (feedback.CleanlinessRating || 0))}</div>
                                    <div class="label">Cleanliness</div>
                                </div>
                                <div class="rating-box">
                                    <div class="stars">${'★'.repeat(feedback.PunctualityRating || 0)}${'☆'.repeat(5 - (feedback.PunctualityRating || 0))}</div>
                                    <div class="label">Punctuality</div>
                                </div>
                                <div class="rating-box">
                                    <div class="stars">${'★'.repeat(feedback.CommunicationRating || 0)}${'☆'.repeat(5 - (feedback.CommunicationRating || 0))}</div>
                                    <div class="label">Communication</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h2>💬 Feedback Details</h2>
                        </div>
                        <div class="card-body">
                            <div class="text-section">
                                <h4>General Comments</h4>
                                <p class="${!feedback.Comments ? 'empty' : ''}">${feedback.Comments || 'No comments provided'}</p>
                            </div>
                            <div class="text-section">
                                <h4>Issues Reported</h4>
                                <p class="${!feedback.IssuesReported ? 'empty' : ''}">${feedback.IssuesReported || 'No issues reported'}</p>
                            </div>
                            <div class="text-section">
                                <h4>Recommendations</h4>
                                <p class="${!feedback.Recommendations ? 'empty' : ''}">${feedback.Recommendations || 'No recommendations provided'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading feedback details:', err);
        res.status(500).send('Error loading feedback: ' + err.message);
    } finally {
        if (pool) await pool.close();
    }
});

module.exports = router;
