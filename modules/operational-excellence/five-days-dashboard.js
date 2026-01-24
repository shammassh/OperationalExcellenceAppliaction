/**
 * 5 Days Dashboard for Operational Excellence
 * View all store entries for expired items tracking
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise = null;
async function getPool() {
    try {
        if (!poolPromise) {
            poolPromise = sql.connect(dbConfig);
        }
        const pool = await poolPromise;
        if (!pool.connected) {
            poolPromise = null;
            poolPromise = sql.connect(dbConfig);
            return await poolPromise;
        }
        return pool;
    } catch (err) {
        poolPromise = null;
        throw err;
    }
}

// Stats API
router.get('/api/stats', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT StoreId) as stores,
                SUM(CASE WHEN CAST(CreatedAt as DATE) = CAST(GETDATE() as DATE) THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN CreatedAt >= DATEADD(day, -7, GETDATE()) THEN 1 ELSE 0 END) as thisWeek
            FROM FiveDaysEntries
        `);
        
        const stats = result.recordset[0] || {};
        res.json({
            total: stats.total || 0,
            stores: stats.stores || 0,
            today: stats.today || 0,
            thisWeek: stats.thisWeek || 0
        });
    } catch (err) {
        console.error('Error loading 5 days stats:', err);
        res.json({ total: 0, stores: 0, today: 0, thisWeek: 0 });
    }
});

// Main dashboard page
router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    
    try {
        const pool = await getPool();
        
        // Get filter params
        const storeId = req.query.store || '';
        const cycle = req.query.cycle || '';
        const day = req.query.day || '';
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        
        // Build query
        let query = `
            SELECT f.*, s.StoreName, u.DisplayName as CreatedByName
            FROM FiveDaysEntries f
            LEFT JOIN Stores s ON f.StoreId = s.Id
            LEFT JOIN Users u ON f.CreatedBy = u.Id
            WHERE 1=1
        `;
        
        const request = pool.request();
        
        if (storeId) {
            query += ` AND f.StoreId = @storeId`;
            request.input('storeId', sql.Int, storeId);
        }
        if (cycle) {
            query += ` AND f.CycleNumber = @cycle`;
            request.input('cycle', sql.Int, cycle);
        }
        if (day) {
            query += ` AND f.DayNumber = @day`;
            request.input('day', sql.Int, day);
        }
        if (month) {
            query += ` AND FORMAT(f.CreatedAt, 'yyyy-MM') = @month`;
            request.input('month', sql.NVarChar, month);
        }
        
        query += ` ORDER BY f.CreatedAt DESC`;
        
        const entries = await request.query(query);
        
        // Get stores for filter
        const stores = await pool.request().query(`SELECT Id, StoreName FROM Stores ORDER BY StoreName`);
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.Id}" ${storeId == s.Id ? 'selected' : ''}>${s.StoreName}</option>`
        ).join('');
        
        const rows = entries.recordset.map(e => `
            <tr>
                <td>${new Date(e.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>${e.StoreName || '-'}</td>
                <td>${e.CreatedByName || '-'}</td>
                <td><span class="badge badge-cycle">C${e.CycleNumber}</span></td>
                <td><span class="badge badge-day">D${e.DayNumber}</span></td>
                <td>${e.ItemNo}</td>
                <td>${e.ItemVariant || '-'}</td>
                <td>${e.Barcode || '-'}</td>
                <td>${e.Family || '-'}</td>
                <td>${e.Description || '-'}</td>
                <td>${e.Size || '-'}</td>
                <td>${e.Qty || '-'}</td>
                <td>${e.ExpiryDate ? new Date(e.ExpiryDate).toLocaleDateString('en-GB') : '-'}</td>
                <td>${e.DateFound ? new Date(e.DateFound).toLocaleDateString('en-GB') : '-'}</td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>5 Days Dashboard - OE</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; }
                    .header-nav a:hover { opacity: 1; }
                    .container { max-width: 1800px; margin: 0 auto; padding: 30px 20px; }
                    
                    .stats-row {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-bottom: 25px;
                    }
                    .stat-card {
                        background: white;
                        border-radius: 12px;
                        padding: 20px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                        text-align: center;
                    }
                    .stat-card .number { font-size: 36px; font-weight: 700; color: #667eea; }
                    .stat-card .label { color: #888; font-size: 13px; text-transform: uppercase; margin-top: 5px; }
                    
                    .filters {
                        background: white;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 20px;
                        display: flex;
                        gap: 15px;
                        flex-wrap: wrap;
                        align-items: end;
                    }
                    .filter-group { display: flex; flex-direction: column; }
                    .filter-group label { font-size: 12px; color: #888; margin-bottom: 5px; }
                    .filter-group select, .filter-group input { padding: 10px; border: 1px solid #ddd; border-radius: 6px; min-width: 150px; }
                    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
                    .btn-primary { background: #667eea; color: white; }
                    .btn-secondary { background: #6c757d; color: white; }
                    
                    .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); overflow-x: auto; }
                    table { width: 100%; border-collapse: collapse; min-width: 1400px; }
                    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
                    th { background: #f8f9fa; font-weight: 600; position: sticky; top: 0; }
                    tr:hover { background: #f8f9fa; }
                    
                    .badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
                    .badge-day { background: #667eea; color: white; }
                    .badge-cycle { background: #28a745; color: white; }
                    
                    .empty-state { text-align: center; padding: 60px; color: #888; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📅 5 Days - Expired Items Dashboard</h1>
                    <div class="header-nav">
                        <a href="/operational-excellence">← Back to OE</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="stats-row">
                        <div class="stat-card">
                            <div class="number" id="statTotal">-</div>
                            <div class="label">Total Entries</div>
                        </div>
                        <div class="stat-card">
                            <div class="number" id="statStores">-</div>
                            <div class="label">Stores Reporting</div>
                        </div>
                        <div class="stat-card">
                            <div class="number" id="statToday">-</div>
                            <div class="label">Today</div>
                        </div>
                        <div class="stat-card">
                            <div class="number" id="statWeek">-</div>
                            <div class="label">This Week</div>
                        </div>
                    </div>
                    
                    <form class="filters" method="GET">
                        <div class="filter-group">
                            <label>Store</label>
                            <select name="store">
                                <option value="">All Stores</option>
                                ${storeOptions}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Cycle</label>
                            <select name="cycle">
                                <option value="">All Cycles</option>
                                <option value="1" ${cycle == '1' ? 'selected' : ''}>Cycle 1</option>
                                <option value="2" ${cycle == '2' ? 'selected' : ''}>Cycle 2</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Day</label>
                            <select name="day">
                                <option value="">All Days</option>
                                <option value="1" ${day == '1' ? 'selected' : ''}>Day 1</option>
                                <option value="2" ${day == '2' ? 'selected' : ''}>Day 2</option>
                                <option value="3" ${day == '3' ? 'selected' : ''}>Day 3</option>
                                <option value="4" ${day == '4' ? 'selected' : ''}>Day 4</option>
                                <option value="5" ${day == '5' ? 'selected' : ''}>Day 5</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Month</label>
                            <input type="month" name="month" value="${month}">
                        </div>
                        <button type="submit" class="btn btn-primary">🔍 Filter</button>
                        <a href="/operational-excellence/five-days-dashboard" class="btn btn-secondary">Clear</a>
                    </form>
                    
                    <div class="card">
                        ${entries.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Store</th>
                                        <th>Submitted By</th>
                                        <th>Cycle</th>
                                        <th>Day</th>
                                        <th>Item No</th>
                                        <th>Variant</th>
                                        <th>Barcode</th>
                                        <th>Family</th>
                                        <th>Description</th>
                                        <th>Size</th>
                                        <th>Qty</th>
                                        <th>Expiry Date</th>
                                        <th>Date Found</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div style="font-size:48px;margin-bottom:15px;">📭</div>
                                <p>No entries found for the selected filters.</p>
                            </div>
                        `}
                    </div>
                </div>
                
                <script>
                    fetch('/operational-excellence/five-days-dashboard/api/stats')
                        .then(r => r.json())
                        .then(data => {
                            document.getElementById('statTotal').textContent = data.total || 0;
                            document.getElementById('statStores').textContent = data.stores || 0;
                            document.getElementById('statToday').textContent = data.today || 0;
                            document.getElementById('statWeek').textContent = data.thisWeek || 0;
                        });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading 5 days dashboard:', err);
        poolPromise = null;
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
