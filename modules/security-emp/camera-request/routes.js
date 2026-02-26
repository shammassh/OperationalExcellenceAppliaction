/**
 * Camera Request / Malfunction Report
 * Request new cameras or report camera malfunctions
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    },
    pool: {
        max: 50,
        min: 5,
        idleTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000
    }
};

let poolPromise = null;
let pool = null;

async function getPool() {
    if (pool && pool.connected) return pool;
    if (pool && !pool.connected) { poolPromise = null; pool = null; }
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).then(newPool => {
            pool = newPool;
            pool.on('error', err => { poolPromise = null; pool = null; });
            return pool;
        }).catch(err => { poolPromise = null; pool = null; throw err; });
    }
    return poolPromise;
}

// Main page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Camera Request / Malfunction Report - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; min-height: 100vh; }
                
                .header {
                    background: linear-gradient(135deg, #37474f 0%, #455a64 100%);
                    color: white;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { font-size: 22px; }
                .header-nav { display: flex; gap: 15px; align-items: center; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.15);
                }
                .header-nav a:hover { background: rgba(255,255,255,0.25); }
                
                .container { padding: 20px; max-width: 1400px; margin: 0 auto; }
                
                .tabs {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 20px;
                }
                .tab {
                    padding: 12px 24px;
                    cursor: pointer;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-weight: 500;
                    color: #666;
                }
                .tab:hover { background: #f5f5f5; }
                .tab.active { background: #37474f; color: white; border-color: #37474f; }
                
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                
                .card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    padding: 25px;
                    margin-bottom: 20px;
                }
                .card h3 { margin-bottom: 20px; color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                
                .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 15px; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .form-group textarea { min-height: 80px; resize: vertical; }
                .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
                    outline: none;
                    border-color: #37474f;
                }
                
                .type-section { display: none; padding: 20px; background: #f8f9fa; border-radius: 8px; margin-top: 15px; }
                .type-section.active { display: block; }
                
                .dynamic-list { margin-top: 10px; }
                .dynamic-item {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .dynamic-item input { flex: 1; }
                .btn-remove {
                    background: #f44336;
                    color: white;
                    border: none;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                }
                .btn-add-item {
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    margin-top: 5px;
                }
                
                .btn-submit {
                    background: #37474f;
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                }
                .btn-submit:hover { background: #263238; }
                
                /* Table styles */
                .table-container { overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
                th { background: #f8f9fa; font-weight: 600; color: #333; }
                tr:hover { background: #f5f8ff; }
                
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-pending { background: #fff3e0; color: #e65100; }
                .status-in-progress { background: #e3f2fd; color: #1565c0; }
                .status-completed { background: #e8f5e9; color: #2e7d32; }
                .status-rejected { background: #ffebee; color: #c62828; }
                
                .type-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .type-request { background: #e8f5e9; color: #2e7d32; }
                .type-report { background: #fff3e0; color: #e65100; }
                
                .btn-view {
                    background: #2196F3;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                /* Modal */
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal.active { display: flex; }
                .modal-content {
                    background: white;
                    padding: 25px;
                    border-radius: 12px;
                    width: 600px;
                    max-width: 95%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .modal h3 { margin-bottom: 20px; color: #333; }
                .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; }
                .detail-label { width: 150px; font-weight: 500; color: #666; }
                .detail-value { flex: 1; color: #333; }
                .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
                .modal-actions button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .btn-close { background: #f5f5f5; color: #333; }
                
                .notification {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    padding: 15px 25px;
                    border-radius: 8px;
                    color: white;
                    z-index: 2000;
                    animation: slideIn 0.3s ease;
                }
                .notification.success { background: #4CAF50; }
                .notification.error { background: #f44336; }
                @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                
                .loading { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.8); display: flex; justify-content: center; align-items: center; z-index: 3000; }
                .loading.hidden { display: none; }
                .spinner { width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #37474f; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                
                .filters {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }
                .filter-group { display: flex; flex-direction: column; gap: 5px; }
                .filter-group label { font-size: 12px; font-weight: 500; color: #666; }
                .filter-group select, .filter-group input {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📹 Camera Request / Malfunction Report</h1>
                <div class="header-nav">
                    <span>Welcome, ${user ? (user.displayName || user.name || 'User') : 'User'}</span>
                    <a href="/dashboard">🏠 Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="tabs">
                    <div class="tab active" data-tab="new">➕ New Request/Report</div>
                    <div class="tab" data-tab="list">📋 All Requests</div>
                </div>
                
                <!-- New Request Tab -->
                <div class="tab-content active" id="tab-new">
                    <div class="card">
                        <h3>📹 Camera Request / Malfunction Report</h3>
                        <form id="cameraForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Store *</label>
                                    <select id="storeSelect" required>
                                        <option value="">-- Select Store --</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Type *</label>
                                    <select id="requestType" required onchange="toggleTypeSection()">
                                        <option value="">-- Select Type --</option>
                                        <option value="Request">📥 Request (New Cameras)</option>
                                        <option value="Report">🔧 Report (Malfunction)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Request Section -->
                            <div class="type-section" id="requestSection">
                                <h4 style="margin-bottom: 15px; color: #2e7d32;">📥 Camera Request Details</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Number of Cameras Requested *</label>
                                        <input type="number" id="numberOfCameras" min="1" placeholder="Enter number">
                                    </div>
                                    <div class="form-group">
                                        <label>Reason for Request *</label>
                                        <select id="requestReason">
                                            <option value="">-- Select Reason --</option>
                                            <option value="New Store Opening">New Store Opening</option>
                                            <option value="Expansion">Expansion</option>
                                            <option value="Security Enhancement">Security Enhancement</option>
                                            <option value="Replacement">Replacement</option>
                                            <option value="Blind Spot Coverage">Blind Spot Coverage</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Area of Coverage *</label>
                                    <textarea id="requestAreaCoverage" placeholder="Describe the areas that need camera coverage (e.g., Main entrance, Back storage, Cashier area)"></textarea>
                                </div>
                            </div>
                            
                            <!-- Report Section -->
                            <div class="type-section" id="reportSection">
                                <h4 style="margin-bottom: 15px; color: #e65100;">🔧 Malfunction Report Details</h4>
                                
                                <div class="form-group">
                                    <label>NVR Numbers (Add all affected NVRs)</label>
                                    <div class="dynamic-list" id="nvrList">
                                        <div class="dynamic-item">
                                            <input type="text" name="nvr[]" placeholder="Enter NVR number">
                                            <button type="button" class="btn-remove" onclick="removeItem(this)">×</button>
                                        </div>
                                    </div>
                                    <button type="button" class="btn-add-item" onclick="addItem('nvrList', 'nvr[]', 'Enter NVR number')">+ Add NVR</button>
                                </div>
                                
                                <div class="form-group">
                                    <label>Camera Numbers (Add all affected cameras)</label>
                                    <div class="dynamic-list" id="cameraList">
                                        <div class="dynamic-item">
                                            <input type="text" name="camera[]" placeholder="Enter camera number">
                                            <button type="button" class="btn-remove" onclick="removeItem(this)">×</button>
                                        </div>
                                    </div>
                                    <button type="button" class="btn-add-item" onclick="addItem('cameraList', 'camera[]', 'Enter camera number')">+ Add Camera</button>
                                </div>
                                
                                <div class="form-group">
                                    <label>Areas of Coverage (Add all affected areas)</label>
                                    <div class="dynamic-list" id="areaList">
                                        <div class="dynamic-item">
                                            <input type="text" name="area[]" placeholder="Enter area (e.g., Main entrance)">
                                            <button type="button" class="btn-remove" onclick="removeItem(this)">×</button>
                                        </div>
                                    </div>
                                    <button type="button" class="btn-add-item" onclick="addItem('areaList', 'area[]', 'Enter area')">+ Add Area</button>
                                </div>
                            </div>
                            
                            <div class="form-group" style="margin-top: 20px;">
                                <label>Additional Notes</label>
                                <textarea id="notes" placeholder="Any additional information..."></textarea>
                            </div>
                            
                            <button type="submit" class="btn-submit">📤 Submit</button>
                        </form>
                    </div>
                </div>
                
                <!-- List Tab -->
                <div class="tab-content" id="tab-list">
                    <div class="card">
                        <h3>📋 All Camera Requests & Reports</h3>
                        <div class="filters">
                            <div class="filter-group">
                                <label>Type</label>
                                <select id="filterType" onchange="loadRequests()">
                                    <option value="">All Types</option>
                                    <option value="Request">Request</option>
                                    <option value="Report">Report</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Status</label>
                                <select id="filterStatus" onchange="loadRequests()">
                                    <option value="">All Status</option>
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Store</label>
                                <select id="filterStore" onchange="loadRequests()">
                                    <option value="">All Stores</option>
                                </select>
                            </div>
                        </div>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Date</th>
                                        <th>Store</th>
                                        <th>Type</th>
                                        <th>Details</th>
                                        <th>Status</th>
                                        <th>Created By</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="requestsTable">
                                    <!-- Data loaded dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="loading hidden" id="loading"><div class="spinner"></div></div>
            
            <!-- View Detail Modal -->
            <div class="modal" id="detailModal">
                <div class="modal-content">
                    <h3 id="modalTitle">📹 Request Details</h3>
                    <div id="modalBody">
                        <!-- Details loaded dynamically -->
                    </div>
                    <div class="modal-actions">
                        <button class="btn-close" onclick="closeModal()">Close</button>
                    </div>
                </div>
            </div>
            
            <script>
                let stores = [];
                let requests = [];
                
                // Tab switching
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        tab.classList.add('active');
                        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
                        if (tab.dataset.tab === 'list') {
                            loadRequests();
                        }
                    });
                });
                
                window.addEventListener('DOMContentLoaded', async () => {
                    await loadStores();
                });
                
                function showLoading() { document.getElementById('loading').classList.remove('hidden'); }
                function hideLoading() { document.getElementById('loading').classList.add('hidden'); }
                
                function showNotification(message, type = 'success') {
                    const notif = document.createElement('div');
                    notif.className = 'notification ' + type;
                    notif.textContent = message;
                    document.body.appendChild(notif);
                    setTimeout(() => notif.remove(), 3000);
                }
                
                async function loadStores() {
                    try {
                        const res = await fetch('/operational-excellence/system-settings/api/stores');
                        stores = await res.json();
                        
                        const storeSelect = document.getElementById('storeSelect');
                        const filterStore = document.getElementById('filterStore');
                        
                        stores.forEach(store => {
                            storeSelect.innerHTML += '<option value="' + store.StoreName + '" data-id="' + store.Id + '">' + store.StoreName + '</option>';
                            filterStore.innerHTML += '<option value="' + store.StoreName + '">' + store.StoreName + '</option>';
                        });
                    } catch (error) {
                        console.error('Error loading stores:', error);
                    }
                }
                
                function toggleTypeSection() {
                    const type = document.getElementById('requestType').value;
                    document.getElementById('requestSection').classList.remove('active');
                    document.getElementById('reportSection').classList.remove('active');
                    
                    if (type === 'Request') {
                        document.getElementById('requestSection').classList.add('active');
                    } else if (type === 'Report') {
                        document.getElementById('reportSection').classList.add('active');
                    }
                }
                
                function addItem(listId, name, placeholder) {
                    const list = document.getElementById(listId);
                    const div = document.createElement('div');
                    div.className = 'dynamic-item';
                    div.innerHTML = '<input type="text" name="' + name + '" placeholder="' + placeholder + '"><button type="button" class="btn-remove" onclick="removeItem(this)">×</button>';
                    list.appendChild(div);
                }
                
                function removeItem(btn) {
                    const list = btn.closest('.dynamic-list');
                    if (list.querySelectorAll('.dynamic-item').length > 1) {
                        btn.closest('.dynamic-item').remove();
                    }
                }
                
                function getListValues(listId) {
                    const inputs = document.getElementById(listId).querySelectorAll('input');
                    return Array.from(inputs).map(i => i.value.trim()).filter(v => v);
                }
                
                document.getElementById('cameraForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const type = document.getElementById('requestType').value;
                    const store = document.getElementById('storeSelect').value;
                    
                    if (!type || !store) {
                        showNotification('Please fill required fields', 'error');
                        return;
                    }
                    
                    const data = {
                        storeName: store,
                        requestType: type,
                        notes: document.getElementById('notes').value
                    };
                    
                    if (type === 'Request') {
                        data.numberOfCameras = document.getElementById('numberOfCameras').value;
                        data.requestReason = document.getElementById('requestReason').value;
                        data.requestAreaCoverage = document.getElementById('requestAreaCoverage').value;
                        
                        if (!data.numberOfCameras || !data.requestReason || !data.requestAreaCoverage) {
                            showNotification('Please fill all request details', 'error');
                            return;
                        }
                    } else {
                        data.nvrNumbers = getListValues('nvrList').join(', ');
                        data.cameraNumbers = getListValues('cameraList').join(', ');
                        data.reportAreaCoverage = getListValues('areaList').join(', ');
                        
                        if (!data.nvrNumbers && !data.cameraNumbers) {
                            showNotification('Please add at least one NVR or Camera number', 'error');
                            return;
                        }
                    }
                    
                    showLoading();
                    try {
                        const res = await fetch('/security-emp/camera-request/api/requests', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await res.json();
                        if (result.success) {
                            showNotification('Request submitted successfully!');
                            document.getElementById('cameraForm').reset();
                            document.getElementById('requestSection').classList.remove('active');
                            document.getElementById('reportSection').classList.remove('active');
                            // Reset dynamic lists
                            ['nvrList', 'cameraList', 'areaList'].forEach(listId => {
                                const list = document.getElementById(listId);
                                list.innerHTML = '<div class="dynamic-item"><input type="text" name="' + (listId === 'nvrList' ? 'nvr[]' : listId === 'cameraList' ? 'camera[]' : 'area[]') + '" placeholder="' + (listId === 'nvrList' ? 'Enter NVR number' : listId === 'cameraList' ? 'Enter camera number' : 'Enter area') + '"><button type="button" class="btn-remove" onclick="removeItem(this)">×</button></div>';
                            });
                        } else {
                            showNotification(result.error || 'Error submitting request', 'error');
                        }
                    } catch (error) {
                        showNotification('Error submitting request', 'error');
                    }
                    hideLoading();
                });
                
                async function loadRequests() {
                    const type = document.getElementById('filterType').value;
                    const status = document.getElementById('filterStatus').value;
                    const store = document.getElementById('filterStore').value;
                    
                    const params = new URLSearchParams();
                    if (type) params.append('type', type);
                    if (status) params.append('status', status);
                    if (store) params.append('store', store);
                    
                    showLoading();
                    try {
                        const res = await fetch('/security-emp/camera-request/api/requests?' + params);
                        requests = await res.json();
                        
                        const tbody = document.getElementById('requestsTable');
                        tbody.innerHTML = '';
                        
                        requests.forEach(req => {
                            const statusClass = 'status-' + req.Status.toLowerCase().replace(' ', '-');
                            const typeClass = 'type-' + req.RequestType.toLowerCase();
                            const details = req.RequestType === 'Request' 
                                ? req.NumberOfCameras + ' cameras - ' + req.RequestReason
                                : (req.CameraNumbers ? 'Cameras: ' + req.CameraNumbers : 'NVRs: ' + req.NVRNumbers);
                            
                            tbody.innerHTML += \`
                                <tr>
                                    <td>#\${req.Id}</td>
                                    <td>\${new Date(req.CreatedAt).toLocaleDateString()}</td>
                                    <td>\${req.StoreName}</td>
                                    <td><span class="type-badge \${typeClass}">\${req.RequestType}</span></td>
                                    <td>\${details}</td>
                                    <td><span class="status-badge \${statusClass}">\${req.Status}</span></td>
                                    <td>\${req.CreatedBy || '-'}</td>
                                    <td><button class="btn-view" onclick="viewDetails(\${req.Id})">View</button></td>
                                </tr>
                            \`;
                        });
                        
                        if (requests.length === 0) {
                            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;">No requests found</td></tr>';
                        }
                    } catch (error) {
                        console.error('Error loading requests:', error);
                    }
                    hideLoading();
                }
                
                function viewDetails(id) {
                    const req = requests.find(r => r.Id === id);
                    if (!req) return;
                    
                    const statusClass = 'status-' + req.Status.toLowerCase().replace(' ', '-');
                    const typeClass = 'type-' + req.RequestType.toLowerCase();
                    
                    let html = \`
                        <div class="detail-row">
                            <div class="detail-label">ID</div>
                            <div class="detail-value">#\${req.Id}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Date</div>
                            <div class="detail-value">\${new Date(req.CreatedAt).toLocaleString()}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Store</div>
                            <div class="detail-value">\${req.StoreName}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Type</div>
                            <div class="detail-value"><span class="type-badge \${typeClass}">\${req.RequestType}</span></div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Status</div>
                            <div class="detail-value"><span class="status-badge \${statusClass}">\${req.Status}</span></div>
                        </div>
                    \`;
                    
                    if (req.RequestType === 'Request') {
                        html += \`
                            <div class="detail-row">
                                <div class="detail-label">Cameras</div>
                                <div class="detail-value">\${req.NumberOfCameras}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Reason</div>
                                <div class="detail-value">\${req.RequestReason}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Area Coverage</div>
                                <div class="detail-value">\${req.RequestAreaCoverage}</div>
                            </div>
                        \`;
                    } else {
                        html += \`
                            <div class="detail-row">
                                <div class="detail-label">NVR Numbers</div>
                                <div class="detail-value">\${req.NVRNumbers || '-'}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Camera Numbers</div>
                                <div class="detail-value">\${req.CameraNumbers || '-'}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Areas Affected</div>
                                <div class="detail-value">\${req.ReportAreaCoverage || '-'}</div>
                            </div>
                        \`;
                    }
                    
                    html += \`
                        <div class="detail-row">
                            <div class="detail-label">Notes</div>
                            <div class="detail-value">\${req.Notes || '-'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Created By</div>
                            <div class="detail-value">\${req.CreatedBy || '-'}</div>
                        </div>
                    \`;
                    
                    document.getElementById('modalTitle').textContent = req.RequestType === 'Request' ? '📥 Camera Request Details' : '🔧 Malfunction Report Details';
                    document.getElementById('modalBody').innerHTML = html;
                    document.getElementById('detailModal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('detailModal').classList.remove('active');
                }
            </script>
        </body>
        </html>
    `);
});

// API: Get all requests
router.get('/api/requests', async (req, res) => {
    try {
        const { type, status, store } = req.query;
        const pool = await getPool();
        
        let query = 'SELECT * FROM CameraRequests WHERE IsActive = 1';
        const request = pool.request();
        
        if (type) {
            query += ' AND RequestType = @type';
            request.input('type', sql.NVarChar, type);
        }
        if (status) {
            query += ' AND Status = @status';
            request.input('status', sql.NVarChar, status);
        }
        if (store) {
            query += ' AND StoreName = @store';
            request.input('store', sql.NVarChar, store);
        }
        
        query += ' ORDER BY CreatedAt DESC';
        
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error loading requests:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Create request
router.post('/api/requests', async (req, res) => {
    try {
        const { storeName, requestType, numberOfCameras, requestReason, requestAreaCoverage,
                nvrNumbers, cameraNumbers, reportAreaCoverage, notes } = req.body;
        const user = req.currentUser;
        const pool = await getPool();
        
        await pool.request()
            .input('storeName', sql.NVarChar, storeName)
            .input('requestType', sql.NVarChar, requestType)
            .input('numberOfCameras', sql.Int, numberOfCameras || null)
            .input('requestReason', sql.NVarChar, requestReason || null)
            .input('requestAreaCoverage', sql.NVarChar, requestAreaCoverage || null)
            .input('nvrNumbers', sql.NVarChar, nvrNumbers || null)
            .input('cameraNumbers', sql.NVarChar, cameraNumbers || null)
            .input('reportAreaCoverage', sql.NVarChar, reportAreaCoverage || null)
            .input('notes', sql.NVarChar, notes || null)
            .input('createdBy', sql.NVarChar, user ? user.displayName : 'Unknown')
            .input('createdByEmail', sql.NVarChar, user ? user.mail : null)
            .query(`
                INSERT INTO CameraRequests 
                (StoreName, RequestType, NumberOfCameras, RequestReason, RequestAreaCoverage,
                 NVRNumbers, CameraNumbers, ReportAreaCoverage, Notes, CreatedBy, CreatedByEmail)
                VALUES 
                (@storeName, @requestType, @numberOfCameras, @requestReason, @requestAreaCoverage,
                 @nvrNumbers, @cameraNumbers, @reportAreaCoverage, @notes, @createdBy, @createdByEmail)
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Update request status
router.put('/api/requests/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const pool = await getPool();
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query('UPDATE CameraRequests SET Status = @status, UpdatedAt = GETDATE() WHERE Id = @id');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
