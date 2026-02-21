/**
 * Theft Incident Reports - View All Reports
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getReportsViewerStyles, formatDate, formatCurrency } = require('../../../shared/reports-viewer');

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

const ITEMS_PER_PAGE = 20;

// Reports List Page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get filter values
        const page = parseInt(req.query.page) || 1;
        const store = req.query.store || '';
        const dateFrom = req.query.dateFrom || '';
        const dateTo = req.query.dateTo || '';
        const search = req.query.search || '';
        const captureMethod = req.query.captureMethod || '';
        
        // Build query
        let whereClause = '1=1';
        const request = pool.request();
        
        if (store) {
            whereClause += ' AND t.Store = @store';
            request.input('store', sql.NVarChar, store);
        }
        if (dateFrom) {
            whereClause += ' AND t.IncidentDate >= @dateFrom';
            request.input('dateFrom', sql.Date, dateFrom);
        }
        if (dateTo) {
            whereClause += ' AND t.IncidentDate <= @dateTo';
            request.input('dateTo', sql.Date, dateTo);
        }
        if (search) {
            whereClause += ' AND (t.ThiefName LIKE @search OR t.ThiefSurname LIKE @search OR t.StolenItems LIKE @search OR t.IDCard LIKE @search)';
            request.input('search', sql.NVarChar, '%' + search + '%');
        }
        if (captureMethod) {
            whereClause += ' AND t.CaptureMethod = @captureMethod';
            request.input('captureMethod', sql.NVarChar, captureMethod);
        }
        
        // Get total count
        const countResult = await request.query(`SELECT COUNT(*) as total FROM TheftIncidents t WHERE ${whereClause}`);
        const totalRecords = countResult.recordset[0].total;
        const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);
        const offset = (page - 1) * ITEMS_PER_PAGE;
        
        // Get records with pagination
        const dataRequest = pool.request();
        if (store) dataRequest.input('store', sql.NVarChar, store);
        if (dateFrom) dataRequest.input('dateFrom', sql.Date, dateFrom);
        if (dateTo) dataRequest.input('dateTo', sql.Date, dateTo);
        if (search) dataRequest.input('search', sql.NVarChar, '%' + search + '%');
        if (captureMethod) dataRequest.input('captureMethod', sql.NVarChar, captureMethod);
        dataRequest.input('offset', sql.Int, offset);
        dataRequest.input('limit', sql.Int, ITEMS_PER_PAGE);
        
        const dataResult = await dataRequest.query(`
            SELECT t.*, u.DisplayName as CreatedByName,
                   (SELECT COUNT(*) FROM TheftIncidentPhotos WHERE IncidentId = t.Id) as PhotoCount
            FROM TheftIncidents t
            LEFT JOIN Users u ON t.CreatedBy = u.Id
            WHERE ${whereClause}
            ORDER BY t.IncidentDate DESC, t.Id DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
        
        // Get stats
        const statsResult = await pool.request().query(`
            SELECT 
                COUNT(*) as TotalReports,
                SUM(StolenValue) as TotalStolenValue,
                SUM(ValueCollected) as TotalCollected,
                COUNT(DISTINCT Store) as StoresAffected
            FROM TheftIncidents
            WHERE IncidentDate >= DATEADD(month, -1, GETDATE())
        `);
        const stats = statsResult.recordset[0];
        
        // Get filter options
        const stores = await pool.request().query('SELECT DISTINCT Store FROM TheftIncidents ORDER BY Store');
        const methods = await pool.request().query('SELECT DISTINCT CaptureMethod FROM TheftIncidents WHERE CaptureMethod IS NOT NULL ORDER BY CaptureMethod');
        
        await pool.close();
        
        // Check for CSV export
        if (req.query.export === 'csv') {
            return exportToCSV(res, dataResult.recordset);
        }
        
        // Generate table rows
        const tableRows = dataResult.recordset.map(r => `
            <tr onclick="viewReport(${r.Id})" style="cursor: pointer;">
                <td><strong>TI-${r.Id}</strong></td>
                <td>${formatDate(r.IncidentDate)}</td>
                <td>${r.Store || '-'}</td>
                <td>${r.ThiefName || ''} ${r.ThiefSurname || ''}</td>
                <td>${r.StolenItems ? (r.StolenItems.length > 40 ? r.StolenItems.substring(0, 40) + '...' : r.StolenItems) : '-'}</td>
                <td>${formatCurrency(r.StolenValue, r.Currency || 'USD')}</td>
                <td><span class="badge badge-info">${r.CaptureMethod || '-'}</span></td>
                <td>${r.PhotoCount > 0 ? '📷 ' + r.PhotoCount : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); viewReport(${r.Id})">View</button>
                </td>
            </tr>
        `).join('');
        
        // Generate store options
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.Store}" ${s.Store === store ? 'selected' : ''}>${s.Store}</option>`
        ).join('');
        
        // Generate method options
        const methodOptions = methods.recordset.map(m => 
            `<option value="${m.CaptureMethod}" ${m.CaptureMethod === captureMethod ? 'selected' : ''}>${m.CaptureMethod}</option>`
        ).join('');
        
        // Generate pagination
        let paginationButtons = '';
        if (totalPages > 1) {
            paginationButtons += `<button class="page-btn" onclick="changePage(1)" ${page === 1 ? 'disabled' : ''}>«</button>`;
            paginationButtons += `<button class="page-btn" onclick="changePage(${page - 1})" ${page === 1 ? 'disabled' : ''}>‹</button>`;
            
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(totalPages, page + 2);
            
            for (let i = startPage; i <= endPage; i++) {
                paginationButtons += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
            }
            
            paginationButtons += `<button class="page-btn" onclick="changePage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>›</button>`;
            paginationButtons += `<button class="page-btn" onclick="changePage(${totalPages})" ${page === totalPages ? 'disabled' : ''}>»</button>`;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Theft Incident Reports - ${process.env.APP_NAME}</title>
                <style>${getReportsViewerStyles('#dc3545')}</style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Theft Incident Reports</h1>
                    <div class="header-nav">
                        <a href="/stores/theft-incident">+ New Report</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="breadcrumb">
                        <a href="/dashboard">Dashboard</a> / <a href="/stores">Stores</a> / <span>Theft Incident Reports</span>
                    </div>
                    
                    <!-- Stats Row -->
                    <div class="stats-row">
                        <div class="stat-card">
                            <div class="stat-value">${totalRecords}</div>
                            <div class="stat-label">Total Reports</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.TotalReports || 0}</div>
                            <div class="stat-label">Last 30 Days</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${formatCurrency(stats.TotalStolenValue || 0, 'USD')}</div>
                            <div class="stat-label">Total Stolen (30d)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${formatCurrency(stats.TotalCollected || 0, 'USD')}</div>
                            <div class="stat-label">Recovered (30d)</div>
                        </div>
                    </div>
                    
                    <!-- Filters -->
                    <div class="filters-card">
                        <div class="filters-row">
                            <div class="filter-group">
                                <label for="store">Store</label>
                                <select id="store" name="store" onchange="applyFilters()">
                                    <option value="">All Stores</option>
                                    ${storeOptions}
                                </select>
                            </div>
                            <div class="filter-group">
                                <label for="captureMethod">Capture Method</label>
                                <select id="captureMethod" name="captureMethod" onchange="applyFilters()">
                                    <option value="">All Methods</option>
                                    ${methodOptions}
                                </select>
                            </div>
                            <div class="filter-group">
                                <label for="dateFrom">From Date</label>
                                <input type="date" id="dateFrom" name="dateFrom" value="${dateFrom}" onchange="applyFilters()">
                            </div>
                            <div class="filter-group">
                                <label for="dateTo">To Date</label>
                                <input type="date" id="dateTo" name="dateTo" value="${dateTo}" onchange="applyFilters()">
                            </div>
                            <div class="filter-group" style="flex-grow: 1;">
                                <label for="search">Search</label>
                                <input type="text" id="search" name="search" value="${search}" placeholder="Search name, ID, items..." oninput="debounceSearch()">
                            </div>
                            <button class="btn btn-outline" onclick="clearFilters()">Clear</button>
                        </div>
                    </div>
                    
                    <!-- Table -->
                    <div class="table-card">
                        <div class="table-header">
                            <h2>📋 Reports (${totalRecords})</h2>
                            <div class="table-actions">
                                <button class="btn btn-outline" onclick="exportToCSV()">📥 Export CSV</button>
                                <button class="btn btn-outline" onclick="printReports()">🖨️ Print</button>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Ref #</th>
                                        <th>Date</th>
                                        <th>Store</th>
                                        <th>Suspect</th>
                                        <th>Stolen Items</th>
                                        <th>Value</th>
                                        <th>Method</th>
                                        <th>Photos</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows || '<tr><td colspan="9"><div class="empty-state"><div class="icon">📋</div><h3>No Reports Found</h3><p>No theft incident reports match your filters</p></div></td></tr>'}
                                </tbody>
                            </table>
                        </div>
                        ${totalPages > 1 ? `
                        <div class="pagination">
                            <div class="pagination-info">
                                Showing ${offset + 1}-${Math.min(offset + ITEMS_PER_PAGE, totalRecords)} of ${totalRecords} reports
                            </div>
                            <div class="pagination-buttons">
                                ${paginationButtons}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Report Detail Modal -->
                <div id="reportModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>📋 Report Details</h3>
                            <button class="modal-close" onclick="closeModal()">&times;</button>
                        </div>
                        <div class="modal-body" id="modalContent">
                            <div class="loading"><div class="spinner"></div><p>Loading...</p></div>
                        </div>
                    </div>
                </div>
                
                <script>
                    let searchTimeout;
                    
                    function debounceSearch() {
                        clearTimeout(searchTimeout);
                        searchTimeout = setTimeout(applyFilters, 400);
                    }
                    
                    function applyFilters() {
                        const params = new URLSearchParams();
                        ['store', 'captureMethod', 'dateFrom', 'dateTo', 'search'].forEach(name => {
                            const el = document.getElementById(name);
                            if (el && el.value) params.set(name, el.value);
                        });
                        params.set('page', 1);
                        window.location.search = params.toString();
                    }
                    
                    function clearFilters() {
                        window.location.search = '';
                    }
                    
                    function changePage(page) {
                        const params = new URLSearchParams(window.location.search);
                        params.set('page', page);
                        window.location.search = params.toString();
                    }
                    
                    function viewReport(id) {
                        document.getElementById('reportModal').classList.add('show');
                        document.getElementById('modalContent').innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
                        
                        fetch('/stores/theft-incident/reports/' + id)
                            .then(res => res.json())
                            .then(data => {
                                document.getElementById('modalContent').innerHTML = formatReportDetail(data);
                            })
                            .catch(err => {
                                document.getElementById('modalContent').innerHTML = '<p style="color:red;">Error loading report: ' + err.message + '</p>';
                            });
                    }
                    
                    function formatReportDetail(r) {
                        const photos = r.photos && r.photos.length > 0 
                            ? r.photos.map(p => \`<img src="\${p.FilePath}" class="photo-thumb" onclick="window.open('\${p.FilePath}', '_blank')">\`).join('')
                            : '<p style="color:#888;">No photos attached</p>';
                        
                        return \`
                            <div class="detail-grid">
                                <div class="detail-group">
                                    <div class="detail-label">Reference Number</div>
                                    <div class="detail-value">TI-\${r.Id}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Incident Date</div>
                                    <div class="detail-value">\${formatDate(r.IncidentDate)}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Store</div>
                                    <div class="detail-value">\${r.Store || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Store Manager</div>
                                    <div class="detail-value">\${r.StoreManager || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Staff Name</div>
                                    <div class="detail-value">\${r.StaffName || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Capture Method</div>
                                    <div class="detail-value">\${r.CaptureMethod || '-'}</div>
                                </div>
                            </div>
                            
                            <h4 style="margin: 25px 0 15px; color: #dc3545;">🕵️ Suspect Information</h4>
                            <div class="detail-grid">
                                <div class="detail-group">
                                    <div class="detail-label">Name</div>
                                    <div class="detail-value">\${r.ThiefName || ''} \${r.ThiefSurname || ''}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">ID Card</div>
                                    <div class="detail-value">\${r.IDCard || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Father's Name</div>
                                    <div class="detail-value">\${r.FatherName || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Mother's Name</div>
                                    <div class="detail-value">\${r.MotherName || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Date of Birth</div>
                                    <div class="detail-value">\${r.DateOfBirth ? formatDate(r.DateOfBirth) : '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Marital Status</div>
                                    <div class="detail-value">\${r.MaritalStatus || '-'}</div>
                                </div>
                            </div>
                            
                            <h4 style="margin: 25px 0 15px; color: #dc3545;">💰 Financial Details</h4>
                            <div class="detail-grid">
                                <div class="detail-group full-width">
                                    <div class="detail-label">Stolen Items</div>
                                    <div class="detail-value">\${r.StolenItems || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Stolen Value</div>
                                    <div class="detail-value" style="color: #dc3545; font-size: 18px;">\${formatCurrency(r.StolenValue, r.Currency)}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Value Collected</div>
                                    <div class="detail-value" style="color: #28a745; font-size: 18px;">\${formatCurrency(r.ValueCollected, r.Currency)}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Amount to HO</div>
                                    <div class="detail-value">\${formatCurrency(r.AmountToHO, r.Currency)}</div>
                                </div>
                                <div class="detail-group">
                                    <div class="detail-label">Security Type</div>
                                    <div class="detail-value">\${r.SecurityType || '-'} \${r.OutsourceCompany ? '(' + r.OutsourceCompany + ')' : ''}</div>
                                </div>
                            </div>
                            
                            <h4 style="margin: 25px 0 15px; color: #dc3545;">📷 Evidence Photos</h4>
                            <div class="photos-grid">\${photos}</div>
                            
                            <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; color: #888; font-size: 12px;">
                                Created by \${r.CreatedByName || 'Unknown'} on \${formatDate(r.CreatedAt)}
                            </div>
                        \`;
                    }
                    
                    function formatDate(dateStr) {
                        if (!dateStr) return '-';
                        const d = new Date(dateStr);
                        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                    
                    function formatCurrency(amount, currency) {
                        if (!amount && amount !== 0) return '-';
                        currency = currency || 'USD';
                        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
                    }
                    
                    function closeModal() {
                        document.getElementById('reportModal').classList.remove('show');
                    }
                    
                    function exportToCSV() {
                        const params = new URLSearchParams(window.location.search);
                        params.set('export', 'csv');
                        window.location.href = window.location.pathname + '?' + params.toString();
                    }
                    
                    function printReports() {
                        window.print();
                    }
                    
                    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
                    document.getElementById('reportModal')?.addEventListener('click', e => { if (e.target.id === 'reportModal') closeModal(); });
                </script>
            </body>
            </html>
        `);
        
    } catch (err) {
        console.error('Error loading reports:', err);
        res.status(500).send('Error loading reports: ' + err.message);
    }
});

// Get single report detail (API)
router.get('/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT t.*, u.DisplayName as CreatedByName
                FROM TheftIncidents t
                LEFT JOIN Users u ON t.CreatedBy = u.Id
                WHERE t.Id = @id
            `);
        
        if (result.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const report = result.recordset[0];
        
        // Get photos
        const photos = await pool.request()
            .input('incidentId', sql.Int, req.params.id)
            .query('SELECT * FROM TheftIncidentPhotos WHERE IncidentId = @incidentId');
        
        report.photos = photos.recordset;
        
        await pool.close();
        
        res.json(report);
        
    } catch (err) {
        console.error('Error getting report:', err);
        res.status(500).json({ error: err.message });
    }
});

// Export to CSV helper
function exportToCSV(res, records) {
    const headers = ['Reference', 'Date', 'Store', 'Thief Name', 'ID Card', 'Stolen Items', 'Stolen Value', 'Value Collected', 'Capture Method', 'Security Type'];
    const rows = records.map(r => [
        'TI-' + r.Id,
        formatDate(r.IncidentDate),
        r.Store || '',
        (r.ThiefName || '') + ' ' + (r.ThiefSurname || ''),
        r.IDCard || '',
        (r.StolenItems || '').replace(/"/g, '""'),
        r.StolenValue || 0,
        r.ValueCollected || 0,
        r.CaptureMethod || '',
        r.SecurityType || ''
    ]);
    
    let csv = headers.join(',') + '\n';
    csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=theft-incidents-' + new Date().toISOString().split('T')[0] + '.csv');
    res.send(csv);
}

module.exports = router;
