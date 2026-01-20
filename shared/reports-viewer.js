/**
 * Modular Reports Viewer Component
 * Reusable component for viewing reports across different modules
 */

/**
 * Generate the common CSS for reports viewer
 * @param {string} accentColor - Primary accent color (e.g., '#dc3545')
 * @returns {string} CSS styles
 */
function getReportsViewerStyles(accentColor = '#dc3545') {
    return `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; }
        
        .header {
            background: linear-gradient(135deg, ${accentColor} 0%, ${adjustColor(accentColor, -20)} 100%);
            color: white;
            padding: 20px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 { font-size: 24px; }
        .header-nav { display: flex; gap: 15px; }
        .header-nav a {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 5px;
            background: rgba(255,255,255,0.1);
            transition: all 0.2s;
        }
        .header-nav a:hover { background: rgba(255,255,255,0.2); }
        
        .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
        
        .breadcrumb { margin-bottom: 20px; color: #666; }
        .breadcrumb a { color: #0078d4; text-decoration: none; }
        
        /* Stats Cards */
        .stats-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            text-align: center;
        }
        .stat-card .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: ${accentColor};
        }
        .stat-card .stat-label {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
        }
        
        /* Filters */
        .filters-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            margin-bottom: 25px;
        }
        .filters-row {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: flex-end;
        }
        .filter-group {
            display: flex;
            flex-direction: column;
            min-width: 150px;
        }
        .filter-group label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .filter-group input,
        .filter-group select {
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        .filter-group input:focus,
        .filter-group select:focus {
            outline: none;
            border-color: ${accentColor};
        }
        
        /* Table */
        .table-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            overflow: hidden;
        }
        .table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #eee;
        }
        .table-header h2 { font-size: 18px; color: #333; }
        .table-actions { display: flex; gap: 10px; }
        
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #eee; }
        th { 
            background: #f8f9fa; 
            font-weight: 600; 
            color: #555;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        tr:hover { background: #fafafa; }
        td { font-size: 14px; }
        
        .table-responsive { overflow-x: auto; }
        
        /* Status Badges */
        .badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .badge-danger { background: #f8d7da; color: #721c24; }
        .badge-info { background: #d1ecf1; color: #0c5460; }
        .badge-secondary { background: #e2e3e5; color: #383d41; }
        
        /* Buttons */
        .btn {
            padding: 10px 18px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-primary { background: ${accentColor}; color: white; }
        .btn-primary:hover { background: ${adjustColor(accentColor, -15)}; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn-secondary:hover { background: #545b62; }
        .btn-outline { background: white; border: 1px solid #ddd; color: #333; }
        .btn-outline:hover { background: #f5f5f5; }
        .btn-sm { padding: 6px 12px; font-size: 12px; }
        .btn-icon { padding: 8px; min-width: 36px; justify-content: center; }
        
        /* Pagination */
        .pagination {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-top: 1px solid #eee;
        }
        .pagination-info { color: #666; font-size: 14px; }
        .pagination-buttons { display: flex; gap: 5px; }
        .page-btn {
            padding: 8px 14px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }
        .page-btn:hover { background: #f5f5f5; }
        .page-btn.active { background: ${accentColor}; color: white; border-color: ${accentColor}; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        /* Modal */
        .modal {
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
            overflow-y: auto;
            padding: 20px;
        }
        .modal.show { display: flex; }
        .modal-content {
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #eee;
            position: sticky;
            top: 0;
            background: white;
        }
        .modal-header h3 { font-size: 18px; color: #333; }
        .modal-close {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #999;
            line-height: 1;
        }
        .modal-close:hover { color: #333; }
        .modal-body { padding: 20px; }
        
        /* Detail View */
        .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        .detail-group {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .detail-group.full-width { grid-column: span 2; }
        .detail-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .detail-value { font-size: 15px; color: #333; font-weight: 500; }
        
        /* Photos Grid */
        .photos-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .photo-thumb {
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .photo-thumb:hover { transform: scale(1.05); }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #888;
        }
        .empty-state .icon { font-size: 64px; margin-bottom: 15px; }
        .empty-state h3 { color: #666; margin-bottom: 10px; }
        
        /* Loading */
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .spinner {
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid ${accentColor};
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Print Styles */
        @media print {
            .header, .filters-card, .pagination, .btn, .modal { display: none !important; }
            .container { max-width: 100%; padding: 0; }
            .table-card { box-shadow: none; }
        }
    `;
}

/**
 * Adjust color brightness
 * @param {string} color - Hex color
 * @param {number} amount - Amount to adjust (-100 to 100)
 * @returns {string} Adjusted hex color
 */
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate filter controls HTML
 * @param {Array} filters - Array of filter definitions
 * @returns {string} HTML for filters
 */
function generateFilters(filters) {
    return filters.map(f => {
        if (f.type === 'select') {
            const options = f.options.map(o => 
                `<option value="${o.value}">${o.label}</option>`
            ).join('');
            return `
                <div class="filter-group">
                    <label for="${f.id}">${f.label}</label>
                    <select id="${f.id}" name="${f.name}" onchange="${f.onChange || 'applyFilters()'}">
                        ${options}
                    </select>
                </div>
            `;
        } else if (f.type === 'date') {
            return `
                <div class="filter-group">
                    <label for="${f.id}">${f.label}</label>
                    <input type="date" id="${f.id}" name="${f.name}" onchange="${f.onChange || 'applyFilters()'}">
                </div>
            `;
        } else if (f.type === 'search') {
            return `
                <div class="filter-group" style="flex-grow: 1;">
                    <label for="${f.id}">${f.label}</label>
                    <input type="text" id="${f.id}" name="${f.name}" placeholder="${f.placeholder || 'Search...'}" oninput="${f.onChange || 'debounceSearch()'}">
                </div>
            `;
        }
        return '';
    }).join('');
}

/**
 * Generate the common JavaScript for reports viewer
 * @param {Object} config - Configuration object
 * @returns {string} JavaScript code
 */
function getReportsViewerScript(config = {}) {
    return `
        let currentPage = 1;
        let totalPages = 1;
        let searchTimeout;
        
        function debounceSearch() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 300);
        }
        
        function applyFilters() {
            const params = new URLSearchParams();
            document.querySelectorAll('.filter-group input, .filter-group select').forEach(el => {
                if (el.value) params.set(el.name, el.value);
            });
            params.set('page', 1);
            window.location.search = params.toString();
        }
        
        function changePage(page) {
            const params = new URLSearchParams(window.location.search);
            params.set('page', page);
            window.location.search = params.toString();
        }
        
        function viewReport(id) {
            document.getElementById('reportModal').classList.add('show');
            document.getElementById('modalContent').innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
            
            fetch('${config.detailEndpoint || ''}/' + id)
                .then(res => res.json())
                .then(data => {
                    document.getElementById('modalContent').innerHTML = formatReportDetail(data);
                })
                .catch(err => {
                    document.getElementById('modalContent').innerHTML = '<p>Error loading report: ' + err.message + '</p>';
                });
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
        
        // Close modal on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
        });
        
        // Close modal on backdrop click
        document.getElementById('reportModal')?.addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    `;
}

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format currency for display
 * @param {number} amount - Amount
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'USD') {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}

module.exports = {
    getReportsViewerStyles,
    getReportsViewerScript,
    generateFilters,
    adjustColor,
    formatDate,
    formatCurrency
};
