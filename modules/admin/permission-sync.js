const express = require('express');
const router = express.Router();
const sql = require('mssql');
const config = require('../../config/default');

const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

const liveDbConfig = {
    server: config.database.server,
    database: 'OEApp_Live',
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

const uatDbConfig = {
    server: config.database.server,
    database: 'OEApp_UAT',
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

router.get('/', async (req, res) => {
    let uatPool = null;
    let livePool = null;
    try {
        uatPool = await new sql.ConnectionPool(uatDbConfig).connect();
        livePool = await new sql.ConnectionPool(liveDbConfig).connect();
        
        // Get Forms from both
        const uatForms = await uatPool.request().query(`
            SELECT FormCode, FormName, ModuleName, FormUrl, Description, IsActive,
                   MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon,
                   DashboardCategoryColor, DashboardTitle, DashboardDescription,
                   ShowOnDashboard, CategorySortOrder, DashboardSortOrder
            FROM Forms ORDER BY FormCode
        `);
        const liveForms = await livePool.request().query(`
            SELECT FormCode, FormName, ModuleName, FormUrl, Description, IsActive,
                   MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon,
                   DashboardCategoryColor, DashboardTitle, DashboardDescription,
                   ShowOnDashboard, CategorySortOrder, DashboardSortOrder
            FROM Forms ORDER BY FormCode
        `);
        
        // Get UserRoles from both
        const uatRoles = await uatPool.request().query('SELECT Id, RoleName, Description, CategoryId FROM UserRoles ORDER BY RoleName');
        const liveRoles = await livePool.request().query('SELECT Id, RoleName, Description, CategoryId FROM UserRoles ORDER BY RoleName');
        
        // Get RoleFormAccess from both
        const uatRoleAccess = await uatPool.request().query(`
            SELECT rfa.RoleId, r.RoleName, rfa.FormCode, rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete
            FROM RoleFormAccess rfa
            JOIN UserRoles r ON rfa.RoleId = r.Id
            ORDER BY r.RoleName, rfa.FormCode
        `);
        const liveRoleAccess = await livePool.request().query(`
            SELECT rfa.RoleId, r.RoleName, rfa.FormCode, rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete
            FROM RoleFormAccess rfa
            JOIN UserRoles r ON rfa.RoleId = r.Id
            ORDER BY r.RoleName, rfa.FormCode
        `);
        
        // Get Active Users from both
        const uatUsers = await uatPool.request().query(`
            SELECT u.Id, u.Email, u.DisplayName, u.RoleId, r.RoleName, u.IsActive, u.IsApproved, u.LastLoginAt
            FROM Users u
            LEFT JOIN UserRoles r ON u.RoleId = r.Id
            WHERE u.IsActive = 1
            ORDER BY u.DisplayName
        `);
        const liveUsers = await livePool.request().query(`
            SELECT u.Id, u.Email, u.DisplayName, u.RoleId, r.RoleName, u.IsActive, u.IsApproved, u.LastLoginAt
            FROM Users u
            LEFT JOIN UserRoles r ON u.RoleId = r.Id
            WHERE u.IsActive = 1
            ORDER BY u.DisplayName
        `);
        
        // Get Stores from both
        const uatStores = await uatPool.request().query(`
            SELECT s.Id, s.StoreCode, s.StoreName, s.Location, s.StoreSize, s.IsActive, s.BrandId, b.BrandName
            FROM Stores s
            LEFT JOIN Brands b ON s.BrandId = b.Id
            ORDER BY s.StoreName
        `);
        const liveStores = await livePool.request().query(`
            SELECT s.Id, s.StoreCode, s.StoreName, s.Location, s.StoreSize, s.IsActive, s.BrandId, b.BrandName
            FROM Stores s
            LEFT JOIN Brands b ON s.BrandId = b.Id
            ORDER BY s.StoreName
        `);
        
        // Get Brands from both
        const uatBrands = await uatPool.request().query(`
            SELECT Id, BrandCode, BrandName, LogoUrl, PrimaryColor, IsActive
            FROM Brands ORDER BY BrandCode
        `);
        const liveBrands = await livePool.request().query(`
            SELECT Id, BrandCode, BrandName, LogoUrl, PrimaryColor, IsActive
            FROM Brands ORDER BY BrandCode
        `);
        
        // Get Store Responsibles from both
        const uatStoreResponsibles = await uatPool.request().query(`
            SELECT sr.Id, sr.StoreId, s.StoreName, sr.AreaManagerId, am.DisplayName as AreaManager, am.Email as AreaManagerEmail,
                   sr.HeadOfOpsId, ho.DisplayName as HeadOfOps, ho.Email as HeadOfOpsEmail, sr.IsActive, sr.Notes
            FROM OE_StoreResponsibles sr
            LEFT JOIN Stores s ON sr.StoreId = s.Id
            LEFT JOIN Users am ON sr.AreaManagerId = am.Id
            LEFT JOIN Users ho ON sr.HeadOfOpsId = ho.Id
            ORDER BY s.StoreName
        `);
        const liveStoreResponsibles = await livePool.request().query(`
            SELECT sr.Id, sr.StoreId, s.StoreName, sr.AreaManagerId, am.DisplayName as AreaManager, am.Email as AreaManagerEmail,
                   sr.HeadOfOpsId, ho.DisplayName as HeadOfOps, ho.Email as HeadOfOpsEmail, sr.IsActive, sr.Notes
            FROM OE_StoreResponsibles sr
            LEFT JOIN Stores s ON sr.StoreId = s.Id
            LEFT JOIN Users am ON sr.AreaManagerId = am.Id
            LEFT JOIN Users ho ON sr.HeadOfOpsId = ho.Id
            ORDER BY s.StoreName
        `);
        
        // Build comparison data
        const uatFormsMap = new Map(uatForms.recordset.map(f => [f.FormCode, f]));
        const liveFormsMap = new Map(liveForms.recordset.map(f => [f.FormCode, f]));
        const uatRolesMap = new Map(uatRoles.recordset.map(r => [r.RoleName, r]));
        const liveRolesMap = new Map(liveRoles.recordset.map(r => [r.RoleName, r]));
        
        // Forms comparison
        const formsComparison = [];
        const allFormCodes = new Set([...uatFormsMap.keys(), ...liveFormsMap.keys()]);
        allFormCodes.forEach(code => {
            const uat = uatFormsMap.get(code);
            const live = liveFormsMap.get(code);
            let status = 'same';
            let diff = [];
            
            if (!live) {
                status = 'missing-live';
            } else if (!uat) {
                status = 'missing-uat';
            } else {
                if (uat.FormName !== live.FormName) diff.push('FormName');
                if (uat.FormUrl !== live.FormUrl) diff.push('FormUrl');
                if (uat.MenuId !== live.MenuId) diff.push('MenuId');
                if (uat.DashboardTitle !== live.DashboardTitle) diff.push('DashboardTitle');
                if (uat.DashboardCategory !== live.DashboardCategory) diff.push('DashboardCategory');
                if (uat.ShowOnDashboard !== live.ShowOnDashboard) diff.push('ShowOnDashboard');
                if (uat.CategorySortOrder !== live.CategorySortOrder) diff.push('CategorySortOrder');
                if (uat.DashboardSortOrder !== live.DashboardSortOrder) diff.push('DashboardSortOrder');
                if (diff.length > 0) status = 'different';
            }
            
            formsComparison.push({ code, uat, live, status, diff });
        });
        
        // Roles comparison
        const rolesComparison = [];
        const allRoleNames = new Set([...uatRolesMap.keys(), ...liveRolesMap.keys()]);
        allRoleNames.forEach(name => {
            const uat = uatRolesMap.get(name);
            const live = liveRolesMap.get(name);
            let status = 'same';
            
            if (!live) {
                status = 'missing-live';
            } else if (!uat) {
                status = 'missing-uat';
            } else if (uat.Description !== live.Description || uat.CategoryId !== live.CategoryId) {
                status = 'different';
            }
            
            rolesComparison.push({ name, uat, live, status });
        });
        
        // RoleFormAccess comparison
        const uatAccessMap = new Map();
        uatRoleAccess.recordset.forEach(a => {
            uatAccessMap.set(`${a.RoleName}|${a.FormCode}`, a);
        });
        const liveAccessMap = new Map();
        liveRoleAccess.recordset.forEach(a => {
            liveAccessMap.set(`${a.RoleName}|${a.FormCode}`, a);
        });
        
        const accessComparison = [];
        const allAccessKeys = new Set([...uatAccessMap.keys(), ...liveAccessMap.keys()]);
        allAccessKeys.forEach(key => {
            const [roleName, formCode] = key.split('|');
            const uat = uatAccessMap.get(key);
            const live = liveAccessMap.get(key);
            let status = 'same';
            let diff = [];
            
            if (!live) {
                status = 'missing-live';
            } else if (!uat) {
                status = 'missing-uat';
            } else {
                if (uat.CanView !== live.CanView) diff.push('CanView');
                if (uat.CanCreate !== live.CanCreate) diff.push('CanCreate');
                if (uat.CanEdit !== live.CanEdit) diff.push('CanEdit');
                if (uat.CanDelete !== live.CanDelete) diff.push('CanDelete');
                if (diff.length > 0) status = 'different';
            }
            
            accessComparison.push({ roleName, formCode, uat, live, status, diff });
        });
        
        // Users comparison
        const uatUsersMap = new Map(uatUsers.recordset.map(u => [u.Email.toLowerCase(), u]));
        const liveUsersMap = new Map(liveUsers.recordset.map(u => [u.Email.toLowerCase(), u]));
        
        const usersComparison = [];
        const allUserEmails = new Set([...uatUsersMap.keys(), ...liveUsersMap.keys()]);
        allUserEmails.forEach(email => {
            const uat = uatUsersMap.get(email);
            const live = liveUsersMap.get(email);
            let status = 'same';
            let diff = [];
            
            if (!live) {
                status = 'missing-live';
            } else if (!uat) {
                status = 'missing-uat';
            } else {
                if (uat.RoleName !== live.RoleName) diff.push('Role');
                if (uat.DisplayName !== live.DisplayName) diff.push('DisplayName');
                if (uat.IsApproved !== live.IsApproved) diff.push('IsApproved');
                if (diff.length > 0) status = 'different';
            }
            
            usersComparison.push({ email, uat, live, status, diff });
        });
        
        // Stores comparison
        const uatStoresMap = new Map(uatStores.recordset.map(s => [s.StoreName, s]));
        const liveStoresMap = new Map(liveStores.recordset.map(s => [s.StoreName, s]));
        
        const storesComparison = [];
        const allStoreNames = new Set([...uatStoresMap.keys(), ...liveStoresMap.keys()]);
        allStoreNames.forEach(name => {
            const uat = uatStoresMap.get(name);
            const live = liveStoresMap.get(name);
            let status = 'same';
            let diff = [];
            
            if (!live) {
                status = 'missing-live';
            } else if (!uat) {
                status = 'missing-uat';
            } else {
                if (uat.StoreName !== live.StoreName) diff.push('StoreName');
                if (uat.Location !== live.Location) diff.push('Location');
                if (uat.StoreSize !== live.StoreSize) diff.push('StoreSize');
                if (uat.IsActive !== live.IsActive) diff.push('IsActive');
                if (uat.BrandName !== live.BrandName) diff.push('Brand');
                if (diff.length > 0) status = 'different';
            }
            
            storesComparison.push({ name, uat, live, status, diff });
        });
        
        // Brands comparison
        const uatBrandsMap = new Map(uatBrands.recordset.map(b => [b.BrandCode, b]));
        const liveBrandsMap = new Map(liveBrands.recordset.map(b => [b.BrandCode, b]));
        
        const brandsComparison = [];
        const allBrandCodes = new Set([...uatBrandsMap.keys(), ...liveBrandsMap.keys()]);
        allBrandCodes.forEach(code => {
            const uat = uatBrandsMap.get(code);
            const live = liveBrandsMap.get(code);
            let status = 'same';
            let diff = [];
            
            if (!live) {
                status = 'missing-live';
            } else if (!uat) {
                status = 'missing-uat';
            } else {
                if (uat.BrandName !== live.BrandName) diff.push('BrandName');
                if (uat.LogoUrl !== live.LogoUrl) diff.push('LogoUrl');
                if (uat.PrimaryColor !== live.PrimaryColor) diff.push('PrimaryColor');
                if (uat.IsActive !== live.IsActive) diff.push('IsActive');
                if (diff.length > 0) status = 'different';
            }
            
            brandsComparison.push({ code, uat, live, status, diff });
        });
        
        // Store Responsibles comparison (use StoreName as key)
        const uatStoreRespMap = new Map(uatStoreResponsibles.recordset.map(sr => [sr.StoreName, sr]));
        const liveStoreRespMap = new Map(liveStoreResponsibles.recordset.map(sr => [sr.StoreName, sr]));
        
        const storeResponsiblesComparison = [];
        const allStoreRespNames = new Set([...uatStoreRespMap.keys(), ...liveStoreRespMap.keys()]);
        allStoreRespNames.forEach(storeName => {
            const uat = uatStoreRespMap.get(storeName);
            const live = liveStoreRespMap.get(storeName);
            let status = 'same';
            let diff = [];
            
            if (!live) {
                status = 'missing-live';
            } else if (!uat) {
                status = 'missing-uat';
            } else {
                if (uat.AreaManagerEmail !== live.AreaManagerEmail) diff.push('AreaManager');
                if (uat.HeadOfOpsEmail !== live.HeadOfOpsEmail) diff.push('HeadOfOps');
                if (uat.IsActive !== live.IsActive) diff.push('IsActive');
                if (diff.length > 0) status = 'different';
            }
            
            storeResponsiblesComparison.push({ storeName, uat, live, status, diff });
        });
        
        // Stats
        const stats = {
            forms: {
                total: formsComparison.length,
                same: formsComparison.filter(f => f.status === 'same').length,
                missingLive: formsComparison.filter(f => f.status === 'missing-live').length,
                different: formsComparison.filter(f => f.status === 'different').length
            },
            roles: {
                total: rolesComparison.length,
                same: rolesComparison.filter(r => r.status === 'same').length,
                missingLive: rolesComparison.filter(r => r.status === 'missing-live').length,
                different: rolesComparison.filter(r => r.status === 'different').length
            },
            access: {
                total: accessComparison.length,
                same: accessComparison.filter(a => a.status === 'same').length,
                missingLive: accessComparison.filter(a => a.status === 'missing-live').length,
                different: accessComparison.filter(a => a.status === 'different').length
            },
            users: {
                total: usersComparison.length,
                same: usersComparison.filter(u => u.status === 'same').length,
                missingLive: usersComparison.filter(u => u.status === 'missing-live').length,
                missingUat: usersComparison.filter(u => u.status === 'missing-uat').length,
                different: usersComparison.filter(u => u.status === 'different').length
            },
            stores: {
                total: storesComparison.length,
                same: storesComparison.filter(s => s.status === 'same').length,
                missingLive: storesComparison.filter(s => s.status === 'missing-live').length,
                missingUat: storesComparison.filter(s => s.status === 'missing-uat').length,
                different: storesComparison.filter(s => s.status === 'different').length
            },
            brands: {
                total: brandsComparison.length,
                same: brandsComparison.filter(b => b.status === 'same').length,
                missingLive: brandsComparison.filter(b => b.status === 'missing-live').length,
                missingUat: brandsComparison.filter(b => b.status === 'missing-uat').length,
                different: brandsComparison.filter(b => b.status === 'different').length
            },
            storeResponsibles: {
                total: storeResponsiblesComparison.length,
                same: storeResponsiblesComparison.filter(sr => sr.status === 'same').length,
                missingLive: storeResponsiblesComparison.filter(sr => sr.status === 'missing-live').length,
                missingUat: storeResponsiblesComparison.filter(sr => sr.status === 'missing-uat').length,
                different: storeResponsiblesComparison.filter(sr => sr.status === 'different').length
            }
        };
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
                <title>Permission Sync Tool - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 1.5rem; }
                    .header-nav a { color: white; text-decoration: none; margin-left: 20px; padding: 8px 16px; 
                                    background: rgba(255,255,255,0.1); border-radius: 6px; }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1600px; margin: 0 auto; padding: 30px; }
                    
                    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .stat-card h3 { color: #333; margin-bottom: 15px; font-size: 16px; }
                    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
                    .stat-item { text-align: center; padding: 10px; border-radius: 8px; }
                    .stat-item.total { background: #e3f2fd; color: #1565c0; }
                    .stat-item.same { background: #e8f5e9; color: #2e7d32; }
                    .stat-item.missing { background: #fff3e0; color: #ef6c00; }
                    .stat-item.different { background: #fce4ec; color: #c2185b; }
                    .stat-number { font-size: 24px; font-weight: 700; }
                    .stat-label { font-size: 11px; margin-top: 5px; }
                    
                    .tabs { display: flex; gap: 5px; margin-bottom: 20px; }
                    .tab { padding: 12px 24px; background: white; border: none; border-radius: 8px 8px 0 0; 
                           cursor: pointer; font-size: 14px; color: #666; position: relative; }
                    .tab.active { background: #0078d4; color: white; }
                    .tab .badge { position: absolute; top: 5px; right: 5px; background: #e74c3c; color: white;
                                  font-size: 10px; padding: 2px 6px; border-radius: 10px; }
                    
                    .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
                    .card-header { padding: 20px; border-bottom: 1px solid #eee; font-weight: 600; 
                                   display: flex; justify-content: space-between; align-items: center; }
                    .card-body { padding: 20px; max-height: 500px; overflow-y: auto; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #333; position: sticky; top: 0; z-index: 10; }
                    tr:hover { background: #f8f9fa; }
                    
                    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
                    .status-same { background: #e8f5e9; color: #2e7d32; }
                    .status-missing-live { background: #fff3e0; color: #ef6c00; }
                    .status-missing-uat { background: #e3f2fd; color: #1565c0; }
                    .status-different { background: #fce4ec; color: #c2185b; }
                    
                    .diff-list { font-size: 10px; color: #888; }
                    
                    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
                    .btn-primary { background: #0078d4; color: white; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-warning { background: #f39c12; color: white; }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                    .btn-sm { padding: 5px 10px; font-size: 12px; }
                    
                    .checkbox-col { width: 40px; }
                    .action-bar { padding: 15px 20px; background: #f8f9fa; border-top: 1px solid #eee;
                                  display: flex; justify-content: space-between; align-items: center; }
                    
                    .filter-row { display: flex; gap: 10px; margin-bottom: 15px; }
                    .filter-row select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; }
                    
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    
                    .perm-cell { text-align: center; }
                    .perm-yes { color: #28a745; font-weight: bold; }
                    .perm-no { color: #ccc; }
                    
                    .sync-progress { display: none; padding: 20px; background: #e3f2fd; border-radius: 8px; margin-bottom: 20px; }
                    .sync-progress.active { display: block; }
                    .progress-bar { height: 20px; background: #ddd; border-radius: 10px; overflow: hidden; }
                    .progress-fill { height: 100%; background: #0078d4; transition: width 0.3s; }
                    
                    .legend { display: flex; gap: 20px; padding: 10px 0; font-size: 12px; }
                    .legend-item { display: flex; align-items: center; gap: 5px; }
                    .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>&#128260; Permission Sync Tool</h1>
                    <div class="header-nav">
                        <a href="/admin">&#11013; Admin Panel</a>
                        <a href="/dashboard">&#127968; Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="stats-row">
                        <div class="stat-card">
                            <h3>&#128203; Forms Registry</h3>
                            <div class="stat-grid">
                                <div class="stat-item total">
                                    <div class="stat-number">${stats.forms.total}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                                <div class="stat-item same">
                                    <div class="stat-number">${stats.forms.same}</div>
                                    <div class="stat-label">In Sync</div>
                                </div>
                                <div class="stat-item missing">
                                    <div class="stat-number">${stats.forms.missingLive}</div>
                                    <div class="stat-label">Missing Live</div>
                                </div>
                                <div class="stat-item different">
                                    <div class="stat-number">${stats.forms.different}</div>
                                    <div class="stat-label">Different</div>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <h3>&#128274; Roles</h3>
                            <div class="stat-grid">
                                <div class="stat-item total">
                                    <div class="stat-number">${stats.roles.total}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                                <div class="stat-item same">
                                    <div class="stat-number">${stats.roles.same}</div>
                                    <div class="stat-label">In Sync</div>
                                </div>
                                <div class="stat-item missing">
                                    <div class="stat-number">${stats.roles.missingLive}</div>
                                    <div class="stat-label">Missing Live</div>
                                </div>
                                <div class="stat-item different">
                                    <div class="stat-number">${stats.roles.different}</div>
                                    <div class="stat-label">Different</div>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <h3>&#128273; Role-Form Access</h3>
                            <div class="stat-grid">
                                <div class="stat-item total">
                                    <div class="stat-number">${stats.access.total}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                                <div class="stat-item same">
                                    <div class="stat-number">${stats.access.same}</div>
                                    <div class="stat-label">In Sync</div>
                                </div>
                                <div class="stat-item missing">
                                    <div class="stat-number">${stats.access.missingLive}</div>
                                    <div class="stat-label">Missing Live</div>
                                </div>
                                <div class="stat-item different">
                                    <div class="stat-number">${stats.access.different}</div>
                                    <div class="stat-label">Different</div>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <h3>&#128100; Active Users</h3>
                            <div class="stat-grid">
                                <div class="stat-item total">
                                    <div class="stat-number">${stats.users.total}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                                <div class="stat-item same">
                                    <div class="stat-number">${stats.users.same}</div>
                                    <div class="stat-label">In Sync</div>
                                </div>
                                <div class="stat-item missing">
                                    <div class="stat-number">${stats.users.missingLive}</div>
                                    <div class="stat-label">Missing Live</div>
                                </div>
                                <div class="stat-item different">
                                    <div class="stat-number">${stats.users.different}</div>
                                    <div class="stat-label">Different</div>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <h3>&#127978; Stores</h3>
                            <div class="stat-grid">
                                <div class="stat-item total">
                                    <div class="stat-number">${stats.stores.total}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                                <div class="stat-item same">
                                    <div class="stat-number">${stats.stores.same}</div>
                                    <div class="stat-label">In Sync</div>
                                </div>
                                <div class="stat-item missing">
                                    <div class="stat-number">${stats.stores.missingLive}</div>
                                    <div class="stat-label">Missing Live</div>
                                </div>
                                <div class="stat-item different">
                                    <div class="stat-number">${stats.stores.different}</div>
                                    <div class="stat-label">Different</div>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <h3>&#127991; Brands</h3>
                            <div class="stat-grid">
                                <div class="stat-item total">
                                    <div class="stat-number">${stats.brands.total}</div>
                                    <div class="stat-label">Total</div>
                                </div>
                                <div class="stat-item same">
                                    <div class="stat-number">${stats.brands.same}</div>
                                    <div class="stat-label">In Sync</div>
                                </div>
                                <div class="stat-item missing">
                                    <div class="stat-number">${stats.brands.missingLive}</div>
                                    <div class="stat-label">Missing Live</div>
                                </div>
                                <div class="stat-item different">
                                    <div class="stat-number">${stats.brands.different}</div>
                                    <div class="stat-label">Different</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="legend">
                        <div class="legend-item"><div class="legend-dot" style="background: #2e7d32;"></div> In Sync</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #ef6c00;"></div> Missing on Live</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #c2185b;"></div> Different</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #1565c0;"></div> Only on Live</div>
                    </div>
                    
                    <div class="sync-progress" id="syncProgress">
                        <h4 style="margin-bottom: 10px;">&#128260; Syncing...</h4>
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill" style="width: 0%;"></div>
                        </div>
                        <p id="progressText" style="margin-top: 10px; font-size: 13px;">Preparing...</p>
                    </div>
                    
                    <div class="tabs">
                        <button class="tab active" onclick="showTab('forms')">
                            &#128203; Forms
                            ${stats.forms.missingLive + stats.forms.different > 0 ? `<span class="badge">${stats.forms.missingLive + stats.forms.different}</span>` : ''}
                        </button>
                        <button class="tab" onclick="showTab('roles')">
                            &#128274; Roles
                            ${stats.roles.missingLive + stats.roles.different > 0 ? `<span class="badge">${stats.roles.missingLive + stats.roles.different}</span>` : ''}
                        </button>
                        <button class="tab" onclick="showTab('access')">
                            &#128273; Access
                            ${stats.access.missingLive + stats.access.different > 0 ? `<span class="badge">${stats.access.missingLive + stats.access.different}</span>` : ''}
                        </button>
                        <button class="tab" onclick="showTab('users')">
                            &#128100; Users
                            ${stats.users.missingLive + stats.users.different > 0 ? `<span class="badge">${stats.users.missingLive + stats.users.different}</span>` : ''}
                        </button>
                        <button class="tab" onclick="showTab('stores')">
                            &#127978; Stores
                            ${stats.stores.missingLive + stats.stores.different > 0 ? `<span class="badge">${stats.stores.missingLive + stats.stores.different}</span>` : ''}
                        </button>
                        <button class="tab" onclick="showTab('brands')">
                            &#127991; Brands
                            ${stats.brands.missingLive + stats.brands.different > 0 ? `<span class="badge">${stats.brands.missingLive + stats.brands.different}</span>` : ''}
                        </button>
                        <button class="tab" onclick="showTab('storeResponsibles')">
                            &#128101; Store Responsibles
                            ${stats.storeResponsibles.missingLive + stats.storeResponsibles.different > 0 ? `<span class="badge">${stats.storeResponsibles.missingLive + stats.storeResponsibles.different}</span>` : ''}
                        </button>
                    </div>
                    
                    <div class="tab-content active" id="tab-forms">
                        <div class="card">
                            <div class="card-header">
                                <span>&#128203; Forms Registry Comparison</span>
                                <select id="filterFormsStatus" onchange="filterForms()">
                                    <option value="">All Status</option>
                                    <option value="missing-live">Missing on Live</option>
                                    <option value="different">Different</option>
                                    <option value="same">In Sync</option>
                                </select>
                            </div>
                            <div class="card-body">
                                <table id="formsTable">
                                    <thead>
                                        <tr>
                                            <th class="checkbox-col"><input type="checkbox" id="selectAllForms" onchange="toggleSelectAll('forms')"></th>
                                            <th>Form Code</th>
                                            <th>Form Name</th>
                                            <th>Module</th>
                                            <th>Status</th>
                                            <th>Differences</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${formsComparison.map(f => `
                                            <tr data-status="${f.status}" data-code="${f.code}">
                                                <td class="checkbox-col">
                                                    ${f.status !== 'same' && f.status !== 'missing-uat' ? 
                                                        `<input type="checkbox" class="form-checkbox" data-code="${f.code}">` : ''}
                                                </td>
                                                <td><code>${f.code}</code></td>
                                                <td>${f.uat?.FormName || f.live?.FormName || '-'}</td>
                                                <td>${f.uat?.ModuleName || f.live?.ModuleName || '-'}</td>
                                                <td><span class="status-badge status-${f.status}">${
                                                    f.status === 'same' ? '&#10004; In Sync' :
                                                    f.status === 'missing-live' ? '&#9888; Missing' :
                                                    f.status === 'missing-uat' ? '&#128204; Only Live' :
                                                    '&#9889; Different'
                                                }</span></td>
                                                <td class="diff-list">${f.diff?.join(', ') || ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="action-bar">
                                <span id="formsSelected">0 selected</span>
                                <div>
                                    <button class="btn btn-warning" onclick="selectAllNeedSync('forms')">Select All Needing Sync</button>
                                    <button class="btn btn-success" onclick="syncSelected('forms')">&#128260; Sync to Live</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="tab-roles">
                        <div class="card">
                            <div class="card-header">
                                <span>&#128274; Roles Comparison</span>
                            </div>
                            <div class="card-body">
                                <table id="rolesTable">
                                    <thead>
                                        <tr>
                                            <th class="checkbox-col"><input type="checkbox" id="selectAllRoles" onchange="toggleSelectAll('roles')"></th>
                                            <th>Role Name</th>
                                            <th>UAT Description</th>
                                            <th>Live Description</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${rolesComparison.map(r => `
                                            <tr data-status="${r.status}" data-name="${r.name}">
                                                <td class="checkbox-col">
                                                    ${r.status !== 'same' && r.status !== 'missing-uat' ? 
                                                        `<input type="checkbox" class="role-checkbox" data-name="${r.name}">` : ''}
                                                </td>
                                                <td><strong>${r.name}</strong></td>
                                                <td>${r.uat?.Description || '-'}</td>
                                                <td>${r.live?.Description || '<em style="color:#ef6c00">Missing</em>'}</td>
                                                <td><span class="status-badge status-${r.status}">${
                                                    r.status === 'same' ? '&#10004; In Sync' :
                                                    r.status === 'missing-live' ? '&#9888; Missing' :
                                                    r.status === 'missing-uat' ? '&#128204; Only Live' :
                                                    '&#9889; Different'
                                                }</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="action-bar">
                                <span id="rolesSelected">0 selected</span>
                                <div>
                                    <button class="btn btn-warning" onclick="selectAllNeedSync('roles')">Select All Needing Sync</button>
                                    <button class="btn btn-success" onclick="syncSelected('roles')">&#128260; Sync to Live</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="tab-access">
                        <div class="card">
                            <div class="card-header">
                                <span>&#128273; Role-Form Access Comparison</span>
                                <div>
                                    <select id="filterAccessRole" onchange="filterAccess()">
                                        <option value="">All Roles</option>
                                        ${[...new Set(accessComparison.map(a => a.roleName))].sort().map(r => 
                                            `<option value="${r}">${r}</option>`
                                        ).join('')}
                                    </select>
                                    <select id="filterAccessStatus" onchange="filterAccess()">
                                        <option value="">All Status</option>
                                        <option value="missing-live">Missing on Live</option>
                                        <option value="different">Different</option>
                                        <option value="same">In Sync</option>
                                    </select>
                                </div>
                            </div>
                            <div class="card-body">
                                <table id="accessTable">
                                    <thead>
                                        <tr>
                                            <th class="checkbox-col"><input type="checkbox" id="selectAllAccess" onchange="toggleSelectAll('access')"></th>
                                            <th>Role</th>
                                            <th>Form Code</th>
                                            <th>UAT Perms</th>
                                            <th>Live Perms</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${accessComparison.map(a => `
                                            <tr data-status="${a.status}" data-role="${a.roleName}" data-form="${a.formCode}">
                                                <td class="checkbox-col">
                                                    ${a.status !== 'same' && a.status !== 'missing-uat' ? 
                                                        `<input type="checkbox" class="access-checkbox" data-role="${a.roleName}" data-form="${a.formCode}">` : ''}
                                                </td>
                                                <td>${a.roleName}</td>
                                                <td><code>${a.formCode}</code></td>
                                                <td class="perm-cell">${a.uat ? `V:${a.uat.CanView?'Y':'N'} C:${a.uat.CanCreate?'Y':'N'} E:${a.uat.CanEdit?'Y':'N'} D:${a.uat.CanDelete?'Y':'N'}` : '-'}</td>
                                                <td class="perm-cell">${a.live ? `V:${a.live.CanView?'Y':'N'} C:${a.live.CanCreate?'Y':'N'} E:${a.live.CanEdit?'Y':'N'} D:${a.live.CanDelete?'Y':'N'}` : '-'}</td>
                                                <td><span class="status-badge status-${a.status}">${
                                                    a.status === 'same' ? '&#10004;' :
                                                    a.status === 'missing-live' ? '&#9888;' :
                                                    a.status === 'missing-uat' ? '&#128204;' :
                                                    '&#9889;'
                                                }</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="action-bar">
                                <span id="accessSelected">0 selected</span>
                                <div>
                                    <button class="btn btn-warning" onclick="selectAllNeedSync('access')">Select All Needing Sync</button>
                                    <button class="btn btn-success" onclick="syncSelected('access')">&#128260; Sync to Live</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="tab-users">
                        <div class="card">
                            <div class="card-header">
                                <span>&#128100; Active Users Comparison</span>
                                <select id="filterUsersStatus" onchange="filterUsers()">
                                    <option value="">All Status</option>
                                    <option value="missing-live">Missing on Live</option>
                                    <option value="missing-uat">Only on Live</option>
                                    <option value="different">Different</option>
                                    <option value="same">In Sync</option>
                                </select>
                            </div>
                            <div class="card-body">
                                <table id="usersTable">
                                    <thead>
                                        <tr>
                                            <th class="checkbox-col"><input type="checkbox" id="selectAllUsers" onchange="toggleSelectAll('users')"></th>
                                            <th>Email</th>
                                            <th>Display Name</th>
                                            <th>UAT Role</th>
                                            <th>Live Role</th>
                                            <th>Status</th>
                                            <th>Differences</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${usersComparison.map(u => `
                                            <tr data-status="${u.status}" data-email="${u.email}">
                                                <td class="checkbox-col">
                                                    ${u.status !== 'same' && u.status !== 'missing-uat' ? 
                                                        `<input type="checkbox" class="user-checkbox" data-email="${u.email}">` : ''}
                                                </td>
                                                <td>${u.email}</td>
                                                <td>${u.uat?.DisplayName || u.live?.DisplayName || '-'}</td>
                                                <td>${u.uat?.RoleName || '<em style="color:#1565c0">N/A</em>'}</td>
                                                <td>${u.live?.RoleName || '<em style="color:#ef6c00">Missing</em>'}</td>
                                                <td><span class="status-badge status-${u.status}">${
                                                    u.status === 'same' ? '&#10004; In Sync' :
                                                    u.status === 'missing-live' ? '&#9888; Missing' :
                                                    u.status === 'missing-uat' ? '&#128204; Only Live' :
                                                    '&#9889; Different'
                                                }</span></td>
                                                <td class="diff-list">${u.diff?.join(', ') || ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="action-bar">
                                <span id="usersSelected">0 selected</span>
                                <div>
                                    <button class="btn btn-warning" onclick="selectAllNeedSync('users')">Select All Needing Sync</button>
                                    <button class="btn btn-success" onclick="syncSelected('users')">&#128260; Sync to Live</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="tab-stores">
                        <div class="card">
                            <div class="card-header">
                                <span>&#127978; Stores Comparison</span>
                                <select id="filterStoresStatus" onchange="filterStores()">
                                    <option value="">All Status</option>
                                    <option value="missing-live">Missing on Live</option>
                                    <option value="missing-uat">Only on Live</option>
                                    <option value="different">Different</option>
                                    <option value="same">In Sync</option>
                                </select>
                            </div>
                            <div class="card-body">
                                <table id="storesTable">
                                    <thead>
                                        <tr>
                                            <th class="checkbox-col"><input type="checkbox" id="selectAllStores" onchange="toggleSelectAll('stores')"></th>
                                            <th>Store Name</th>
                                            <th>Store Code</th>
                                            <th>Brand</th>
                                            <th>Location</th>
                                            <th>Size</th>
                                            <th>Status</th>
                                            <th>Differences</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${storesComparison.map(s => `
                                            <tr data-status="${s.status}" data-name="${s.name}">
                                                <td class="checkbox-col">
                                                    ${s.status !== 'same' && s.status !== 'missing-uat' ? 
                                                        `<input type="checkbox" class="store-checkbox" data-name="${s.name}">` : ''}
                                                </td>
                                                <td>${s.name}</td>
                                                <td><code>${s.uat?.StoreCode || s.live?.StoreCode || '-'}</code></td>
                                                <td>${s.uat?.BrandName || s.live?.BrandName || '-'}</td>
                                                <td>${s.uat?.Location || s.live?.Location || '-'}</td>
                                                <td>${s.uat?.StoreSize || s.live?.StoreSize || '-'}</td>
                                                <td><span class="status-badge status-${s.status}">${
                                                    s.status === 'same' ? '&#10004; In Sync' :
                                                    s.status === 'missing-live' ? '&#9888; Missing' :
                                                    s.status === 'missing-uat' ? '&#128204; Only Live' :
                                                    '&#9889; Different'
                                                }</span></td>
                                                <td class="diff-list">${s.diff?.join(', ') || ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="action-bar">
                                <span id="storesSelected">0 selected</span>
                                <div>
                                    <button class="btn btn-warning" onclick="selectAllNeedSync('stores')">Select All Needing Sync</button>
                                    <button class="btn btn-success" onclick="syncSelected('stores')">&#128260; Sync to Live</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="tab-brands">
                        <div class="card">
                            <div class="card-header">
                                <span>&#127991; Brands Comparison</span>
                                <select id="filterBrandsStatus" onchange="filterBrands()">
                                    <option value="">All Status</option>
                                    <option value="missing-live">Missing on Live</option>
                                    <option value="missing-uat">Only on Live</option>
                                    <option value="different">Different</option>
                                    <option value="same">In Sync</option>
                                </select>
                            </div>
                            <div class="card-body">
                                <table id="brandsTable">
                                    <thead>
                                        <tr>
                                            <th class="checkbox-col"><input type="checkbox" id="selectAllBrands" onchange="toggleSelectAll('brands')"></th>
                                            <th>Brand Code</th>
                                            <th>Brand Name</th>
                                            <th>Primary Color</th>
                                            <th>Active</th>
                                            <th>Status</th>
                                            <th>Differences</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${brandsComparison.map(b => `
                                            <tr data-status="${b.status}" data-code="${b.code}">
                                                <td class="checkbox-col">
                                                    ${b.status !== 'same' && b.status !== 'missing-uat' ? 
                                                        `<input type="checkbox" class="brand-checkbox" data-code="${b.code}">` : ''}
                                                </td>
                                                <td><code>${b.code}</code></td>
                                                <td>${b.uat?.BrandName || b.live?.BrandName || '-'}</td>
                                                <td>${b.uat?.PrimaryColor || b.live?.PrimaryColor || '-'}</td>
                                                <td>${(b.uat?.IsActive ?? b.live?.IsActive) ? '&#10004;' : '&#10008;'}</td>
                                                <td><span class="status-badge status-${b.status}">${
                                                    b.status === 'same' ? '&#10004; In Sync' :
                                                    b.status === 'missing-live' ? '&#9888; Missing' :
                                                    b.status === 'missing-uat' ? '&#128204; Only Live' :
                                                    '&#9889; Different'
                                                }</span></td>
                                                <td class="diff-list">${b.diff?.join(', ') || ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="action-bar">
                                <span id="brandsSelected">0 selected</span>
                                <div>
                                    <button class="btn btn-warning" onclick="selectAllNeedSync('brands')">Select All Needing Sync</button>
                                    <button class="btn btn-success" onclick="syncSelected('brands')">&#128260; Sync to Live</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="tab-storeResponsibles">
                        <div class="card">
                            <div class="card-header">
                                <span>&#128101; Store Responsibles Comparison</span>
                                <select id="filterStoreResponsiblesStatus" onchange="filterStoreResponsibles()">
                                    <option value="">All Status</option>
                                    <option value="missing-live">Missing on Live</option>
                                    <option value="missing-uat">Only on Live</option>
                                    <option value="different">Different</option>
                                    <option value="same">In Sync</option>
                                </select>
                            </div>
                            <div class="card-body">
                                <table id="storeResponsiblesTable">
                                    <thead>
                                        <tr>
                                            <th class="checkbox-col"><input type="checkbox" id="selectAllStoreResponsibles" onchange="toggleSelectAll('storeResponsibles')"></th>
                                            <th>Store Name</th>
                                            <th>Area Manager</th>
                                            <th>Head of Ops</th>
                                            <th>Active</th>
                                            <th>Status</th>
                                            <th>Differences</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${storeResponsiblesComparison.map(sr => `
                                            <tr data-status="${sr.status}" data-storename="${sr.storeName}">
                                                <td class="checkbox-col">
                                                    ${sr.status !== 'same' && sr.status !== 'missing-uat' ? 
                                                        `<input type="checkbox" class="storeResponsible-checkbox" data-storename="${sr.storeName}">` : ''}
                                                </td>
                                                <td>${sr.storeName || '-'}</td>
                                                <td>${sr.uat?.AreaManager || sr.live?.AreaManager || '-'}</td>
                                                <td>${sr.uat?.HeadOfOps || sr.live?.HeadOfOps || '-'}</td>
                                                <td>${(sr.uat?.IsActive ?? sr.live?.IsActive) ? '&#10004;' : '&#10008;'}</td>
                                                <td><span class="status-badge status-${sr.status}">${
                                                    sr.status === 'same' ? '&#10004; In Sync' :
                                                    sr.status === 'missing-live' ? '&#9888; Missing' :
                                                    sr.status === 'missing-uat' ? '&#128204; Only Live' :
                                                    '&#9889; Different'
                                                }</span></td>
                                                <td class="diff-list">${sr.diff?.join(', ') || ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="action-bar">
                                <span id="storeResponsiblesSelected">0 selected</span>
                                <div>
                                    <button class="btn btn-warning" onclick="selectAllNeedSync('storeResponsibles')">Select All Needing Sync</button>
                                    <button class="btn btn-success" onclick="syncSelected('storeResponsibles')">&#128260; Sync to Live</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <div class="card-body" style="text-align: center; padding: 30px;">
                            <h3 style="margin-bottom: 10px;">&#128640; Quick Sync All</h3>
                            <p style="margin-bottom: 20px; opacity: 0.9;">Sync all missing and different items from UAT to Live</p>
                            <button class="btn" style="background: white; color: #667eea; font-size: 16px; padding: 15px 40px;" onclick="syncAll()">
                                &#128260; Sync Everything to Live
                            </button>
                        </div>
                    </div>
                </div>
                
                <script>
                    const formsData = ${JSON.stringify(formsComparison)};
                    const rolesData = ${JSON.stringify(rolesComparison)};
                    const accessData = ${JSON.stringify(accessComparison)};
                    const usersData = ${JSON.stringify(usersComparison)};
                    const storesData = ${JSON.stringify(storesComparison)};
                    const brandsData = ${JSON.stringify(brandsComparison)};
                    const storeResponsiblesData = ${JSON.stringify(storeResponsiblesComparison)};
                    
                    function showTab(tab) {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                        document.querySelector('[onclick="showTab(\\'' + tab + '\\')"]').classList.add('active');
                        document.getElementById('tab-' + tab).classList.add('active');
                    }
                    
                    function toggleSelectAll(type) {
                        const checked = document.getElementById('selectAll' + type.charAt(0).toUpperCase() + type.slice(1)).checked;
                        document.querySelectorAll('.' + type.slice(0, -1) + '-checkbox').forEach(cb => {
                            if (cb.closest('tr').style.display !== 'none') cb.checked = checked;
                        });
                        updateSelectedCount(type);
                    }
                    
                    function selectAllNeedSync(type) {
                        document.querySelectorAll('#' + type + 'Table tbody tr').forEach(row => {
                            const status = row.dataset.status;
                            const cb = row.querySelector('input[type="checkbox"]');
                            if (cb && (status === 'missing-live' || status === 'different')) cb.checked = true;
                        });
                        updateSelectedCount(type);
                    }
                    
                    function updateSelectedCount(type) {
                        const count = document.querySelectorAll('.' + type.slice(0, -1) + '-checkbox:checked').length;
                        document.getElementById(type + 'Selected').textContent = count + ' selected';
                    }
                    
                    document.querySelectorAll('.form-checkbox, .role-checkbox, .access-checkbox, .user-checkbox, .store-checkbox, .brand-checkbox, .storeResponsible-checkbox').forEach(cb => {
                        cb.addEventListener('change', function() {
                            const type = this.classList.contains('form-checkbox') ? 'forms' :
                                         this.classList.contains('role-checkbox') ? 'roles' : 
                                         this.classList.contains('access-checkbox') ? 'access' : 
                                         this.classList.contains('user-checkbox') ? 'users' :
                                         this.classList.contains('store-checkbox') ? 'stores' : 
                                         this.classList.contains('brand-checkbox') ? 'brands' : 'storeResponsibles';
                            updateSelectedCount(type);
                        });
                    });
                    
                    function filterForms() {
                        const status = document.getElementById('filterFormsStatus').value;
                        document.querySelectorAll('#formsTable tbody tr').forEach(row => {
                            row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
                        });
                    }
                    
                    function filterAccess() {
                        const role = document.getElementById('filterAccessRole').value;
                        const status = document.getElementById('filterAccessStatus').value;
                        document.querySelectorAll('#accessTable tbody tr').forEach(row => {
                            const matchRole = !role || row.dataset.role === role;
                            const matchStatus = !status || row.dataset.status === status;
                            row.style.display = matchRole && matchStatus ? '' : 'none';
                        });
                    }
                    
                    function filterUsers() {
                        const status = document.getElementById('filterUsersStatus').value;
                        document.querySelectorAll('#usersTable tbody tr').forEach(row => {
                            row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
                        });
                    }
                    
                    function filterStores() {
                        const status = document.getElementById('filterStoresStatus').value;
                        document.querySelectorAll('#storesTable tbody tr').forEach(row => {
                            row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
                        });
                    }
                    
                    function filterBrands() {
                        const status = document.getElementById('filterBrandsStatus').value;
                        document.querySelectorAll('#brandsTable tbody tr').forEach(row => {
                            row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
                        });
                    }
                    
                    function filterStoreResponsibles() {
                        const status = document.getElementById('filterStoreResponsiblesStatus').value;
                        document.querySelectorAll('#storeResponsiblesTable tbody tr').forEach(row => {
                            row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
                        });
                    }
                    
                    async function syncSelected(type) {
                        let items = [];
                        if (type === 'forms') {
                            document.querySelectorAll('.form-checkbox:checked').forEach(cb => {
                                const form = formsData.find(f => f.code === cb.dataset.code);
                                if (form) items.push(form);
                            });
                        } else if (type === 'roles') {
                            document.querySelectorAll('.role-checkbox:checked').forEach(cb => {
                                const role = rolesData.find(r => r.name === cb.dataset.name);
                                if (role) items.push(role);
                            });
                        } else if (type === 'access') {
                            document.querySelectorAll('.access-checkbox:checked').forEach(cb => {
                                const access = accessData.find(a => a.roleName === cb.dataset.role && a.formCode === cb.dataset.form);
                                if (access) items.push(access);
                            });
                        } else if (type === 'users') {
                            document.querySelectorAll('.user-checkbox:checked').forEach(cb => {
                                const user = usersData.find(u => u.email === cb.dataset.email);
                                if (user) items.push(user);
                            });
                        } else if (type === 'stores') {
                            document.querySelectorAll('.store-checkbox:checked').forEach(cb => {
                                const store = storesData.find(s => s.name === cb.dataset.name);
                                if (store) items.push(store);
                            });
                        } else if (type === 'brands') {
                            document.querySelectorAll('.brand-checkbox:checked').forEach(cb => {
                                const brand = brandsData.find(b => b.code === cb.dataset.code);
                                if (brand) items.push(brand);
                            });
                        } else if (type === 'storeResponsibles') {
                            document.querySelectorAll('.storeResponsible-checkbox:checked').forEach(cb => {
                                const sr = storeResponsiblesData.find(sr => sr.storeName === cb.dataset.storename);
                                if (sr) items.push(sr);
                            });
                        }
                        
                        if (items.length === 0) { alert('Please select items to sync'); return; }
                        if (!confirm('Sync ' + items.length + ' ' + type + ' to Live database?')) return;
                        
                        showProgress();
                        try {
                            const res = await fetch('/admin/permission-sync/sync', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type, items })
                            });
                            const result = await res.json();
                            hideProgress();
                            if (result.success) {
                                alert('Successfully synced ' + result.count + ' ' + type + '!');
                                location.reload();
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (err) {
                            hideProgress();
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    async function syncAll() {
                        const formsToSync = formsData.filter(f => f.status === 'missing-live' || f.status === 'different');
                        const rolesToSync = rolesData.filter(r => r.status === 'missing-live' || r.status === 'different');
                        const accessToSync = accessData.filter(a => a.status === 'missing-live' || a.status === 'different');
                        const usersToSync = usersData.filter(u => u.status === 'missing-live' || u.status === 'different');
                        
                        const total = formsToSync.length + rolesToSync.length + accessToSync.length + usersToSync.length;
                        if (total === 0) { alert('Everything is already in sync!'); return; }
                        
                        if (!confirm('Sync ALL to Live?\\n\\n' + formsToSync.length + ' Forms\\n' + rolesToSync.length + ' Roles\\n' + accessToSync.length + ' Access\\n' + usersToSync.length + ' Users\\n\\nTotal: ' + total + ' items')) return;
                        
                        showProgress();
                        try {
                            const res = await fetch('/admin/permission-sync/sync-all', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ forms: formsToSync, roles: rolesToSync, access: accessToSync, users: usersToSync })
                            });
                            const result = await res.json();
                            hideProgress();
                            if (result.success) {
                                alert('Sync Complete!\\n\\n' + result.forms + ' Forms\\n' + result.roles + ' Roles\\n' + result.access + ' Access\\n' + result.users + ' Users');
                                location.reload();
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (err) {
                            hideProgress();
                            alert('Error: ' + err.message);
                        }
                    }
                    
                    function showProgress() { document.getElementById('syncProgress').classList.add('active'); }
                    function hideProgress() { document.getElementById('syncProgress').classList.remove('active'); }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading permission sync:', err);
        res.status(500).send('Error: ' + err.message);
    } finally {
        try { if (uatPool) await uatPool.close(); } catch(e) {}
        try { if (livePool) await livePool.close(); } catch(e) {}
    }
});

// Sync selected items
router.post('/sync', async (req, res) => {
    let uatPool = null;
    let livePool = null;
    try {
        const { type, items } = req.body;
        if (!items || items.length === 0) return res.json({ success: false, error: 'No items to sync' });
        
        uatPool = await new sql.ConnectionPool(uatDbConfig).connect();
        livePool = await new sql.ConnectionPool(liveDbConfig).connect();
        
        let count = 0;
        
        if (type === 'forms') {
            for (const form of items) {
                const uatForm = form.uat;
                if (!uatForm) continue;
                
                const exists = await livePool.request()
                    .input('code', sql.NVarChar, form.code)
                    .query('SELECT Id FROM Forms WHERE FormCode = @code');
                
                if (exists.recordset.length > 0) {
                    await livePool.request()
                        .input('code', sql.NVarChar, form.code)
                        .input('formName', sql.NVarChar, uatForm.FormName)
                        .input('moduleName', sql.NVarChar, uatForm.ModuleName)
                        .input('formUrl', sql.NVarChar, uatForm.FormUrl)
                        .input('description', sql.NVarChar, uatForm.Description)
                        .input('isActive', sql.Bit, uatForm.IsActive)
                        .input('menuId', sql.NVarChar, uatForm.MenuId)
                        .input('dashboardIcon', sql.NVarChar, uatForm.DashboardIcon)
                        .input('dashboardCategory', sql.NVarChar, uatForm.DashboardCategory)
                        .input('dashboardCategoryIcon', sql.NVarChar, uatForm.DashboardCategoryIcon)
                        .input('dashboardCategoryColor', sql.NVarChar, uatForm.DashboardCategoryColor)
                        .input('dashboardTitle', sql.NVarChar, uatForm.DashboardTitle)
                        .input('dashboardDescription', sql.NVarChar, uatForm.DashboardDescription)
                        .input('showOnDashboard', sql.Bit, uatForm.ShowOnDashboard)
                        .input('categorySortOrder', sql.Int, uatForm.CategorySortOrder)
                        .input('dashboardSortOrder', sql.Int, uatForm.DashboardSortOrder)
                        .query(`UPDATE Forms SET FormName=@formName, ModuleName=@moduleName, FormUrl=@formUrl,
                            Description=@description, IsActive=@isActive, MenuId=@menuId,
                            DashboardIcon=@dashboardIcon, DashboardCategory=@dashboardCategory,
                            DashboardCategoryIcon=@dashboardCategoryIcon, DashboardCategoryColor=@dashboardCategoryColor,
                            DashboardTitle=@dashboardTitle, DashboardDescription=@dashboardDescription,
                            ShowOnDashboard=@showOnDashboard, CategorySortOrder=@categorySortOrder,
                            DashboardSortOrder=@dashboardSortOrder, UpdatedAt=GETDATE() WHERE FormCode=@code`);
                } else {
                    await livePool.request()
                        .input('code', sql.NVarChar, form.code)
                        .input('formName', sql.NVarChar, uatForm.FormName)
                        .input('moduleName', sql.NVarChar, uatForm.ModuleName)
                        .input('formUrl', sql.NVarChar, uatForm.FormUrl)
                        .input('description', sql.NVarChar, uatForm.Description)
                        .input('isActive', sql.Bit, uatForm.IsActive)
                        .input('menuId', sql.NVarChar, uatForm.MenuId)
                        .input('dashboardIcon', sql.NVarChar, uatForm.DashboardIcon)
                        .input('dashboardCategory', sql.NVarChar, uatForm.DashboardCategory)
                        .input('dashboardCategoryIcon', sql.NVarChar, uatForm.DashboardCategoryIcon)
                        .input('dashboardCategoryColor', sql.NVarChar, uatForm.DashboardCategoryColor)
                        .input('dashboardTitle', sql.NVarChar, uatForm.DashboardTitle)
                        .input('dashboardDescription', sql.NVarChar, uatForm.DashboardDescription)
                        .input('showOnDashboard', sql.Bit, uatForm.ShowOnDashboard)
                        .input('categorySortOrder', sql.Int, uatForm.CategorySortOrder)
                        .input('dashboardSortOrder', sql.Int, uatForm.DashboardSortOrder)
                        .query(`INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive,
                            MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor,
                            DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
                            VALUES (@code, @formName, @moduleName, @formUrl, @description, @isActive,
                            @menuId, @dashboardIcon, @dashboardCategory, @dashboardCategoryIcon, @dashboardCategoryColor,
                            @dashboardTitle, @dashboardDescription, @showOnDashboard, @categorySortOrder, @dashboardSortOrder)`);
                }
                count++;
            }
        } else if (type === 'roles') {
            for (const role of items) {
                const uatRole = role.uat;
                if (!uatRole) continue;
                
                const exists = await livePool.request()
                    .input('name', sql.NVarChar, role.name)
                    .query('SELECT Id FROM UserRoles WHERE RoleName = @name');
                
                if (exists.recordset.length > 0) {
                    await livePool.request()
                        .input('name', sql.NVarChar, role.name)
                        .input('description', sql.NVarChar, uatRole.Description)
                        .input('categoryId', sql.Int, uatRole.CategoryId)
                        .query('UPDATE UserRoles SET Description=@description, CategoryId=@categoryId WHERE RoleName=@name');
                } else {
                    await livePool.request()
                        .input('name', sql.NVarChar, role.name)
                        .input('description', sql.NVarChar, uatRole.Description)
                        .input('categoryId', sql.Int, uatRole.CategoryId)
                        .query('INSERT INTO UserRoles (RoleName, Description, CategoryId) VALUES (@name, @description, @categoryId)');
                }
                count++;
            }
        } else if (type === 'access') {
            for (const access of items) {
                const uatAccess = access.uat;
                if (!uatAccess) continue;
                
                const liveRole = await livePool.request()
                    .input('name', sql.NVarChar, access.roleName)
                    .query('SELECT Id FROM UserRoles WHERE RoleName = @name');
                
                if (liveRole.recordset.length === 0) continue;
                const liveRoleId = liveRole.recordset[0].Id;
                
                const exists = await livePool.request()
                    .input('roleId', sql.Int, liveRoleId)
                    .input('formCode', sql.NVarChar, access.formCode)
                    .query('SELECT Id FROM RoleFormAccess WHERE RoleId=@roleId AND FormCode=@formCode');
                
                if (exists.recordset.length > 0) {
                    await livePool.request()
                        .input('roleId', sql.Int, liveRoleId)
                        .input('formCode', sql.NVarChar, access.formCode)
                        .input('canView', sql.Bit, uatAccess.CanView)
                        .input('canCreate', sql.Bit, uatAccess.CanCreate)
                        .input('canEdit', sql.Bit, uatAccess.CanEdit)
                        .input('canDelete', sql.Bit, uatAccess.CanDelete)
                        .query('UPDATE RoleFormAccess SET CanView=@canView, CanCreate=@canCreate, CanEdit=@canEdit, CanDelete=@canDelete WHERE RoleId=@roleId AND FormCode=@formCode');
                } else {
                    await livePool.request()
                        .input('roleId', sql.Int, liveRoleId)
                        .input('formCode', sql.NVarChar, access.formCode)
                        .input('canView', sql.Bit, uatAccess.CanView)
                        .input('canCreate', sql.Bit, uatAccess.CanCreate)
                        .input('canEdit', sql.Bit, uatAccess.CanEdit)
                        .input('canDelete', sql.Bit, uatAccess.CanDelete)
                        .query('INSERT INTO RoleFormAccess (RoleId, FormCode, CanView, CanCreate, CanEdit, CanDelete) VALUES (@roleId, @formCode, @canView, @canCreate, @canEdit, @canDelete)');
                }
                count++;
            }
        } else if (type === 'users') {
            for (const user of items) {
                const uatUser = user.uat;
                if (!uatUser) continue;
                
                // Get the Live RoleId that matches the UAT RoleName
                let liveRoleId = null;
                if (uatUser.RoleName) {
                    const liveRole = await livePool.request()
                        .input('roleName', sql.NVarChar, uatUser.RoleName)
                        .query('SELECT Id FROM UserRoles WHERE RoleName = @roleName');
                    if (liveRole.recordset.length > 0) {
                        liveRoleId = liveRole.recordset[0].Id;
                    }
                }
                
                const exists = await livePool.request()
                    .input('email', sql.NVarChar, user.email)
                    .query('SELECT Id FROM Users WHERE Email = @email');
                
                if (exists.recordset.length > 0) {
                    await livePool.request()
                        .input('email', sql.NVarChar, user.email)
                        .input('displayName', sql.NVarChar, uatUser.DisplayName)
                        .input('roleId', sql.Int, liveRoleId)
                        .input('isActive', sql.Bit, uatUser.IsActive)
                        .input('isApproved', sql.Bit, uatUser.IsApproved)
                        .query('UPDATE Users SET DisplayName=@displayName, RoleId=@roleId, IsActive=@isActive, IsApproved=@isApproved WHERE Email=@email');
                } else {
                    await livePool.request()
                        .input('email', sql.NVarChar, user.email)
                        .input('displayName', sql.NVarChar, uatUser.DisplayName)
                        .input('roleId', sql.Int, liveRoleId)
                        .input('isActive', sql.Bit, uatUser.IsActive)
                        .input('isApproved', sql.Bit, uatUser.IsApproved)
                        .query('INSERT INTO Users (Email, DisplayName, RoleId, IsActive, IsApproved) VALUES (@email, @displayName, @roleId, @isActive, @isApproved)');
                }
                count++;
            }
        } else if (type === 'stores') {
            for (const store of items) {
                const uatStore = store.uat;
                if (!uatStore) continue;
                
                // Get the Live BrandId that matches the UAT BrandName
                let liveBrandId = null;
                if (uatStore.BrandName) {
                    const liveBrand = await livePool.request()
                        .input('brandName', sql.NVarChar, uatStore.BrandName)
                        .query('SELECT Id FROM Brands WHERE BrandName = @brandName');
                    if (liveBrand.recordset.length > 0) {
                        liveBrandId = liveBrand.recordset[0].Id;
                    }
                }
                
                const exists = await livePool.request()
                    .input('storeName', sql.NVarChar, store.name)
                    .query('SELECT Id FROM Stores WHERE StoreName = @storeName');
                
                if (exists.recordset.length > 0) {
                    await livePool.request()
                        .input('storeName', sql.NVarChar, store.name)
                        .input('storeCode', sql.NVarChar, uatStore.StoreCode)
                        .input('location', sql.NVarChar, uatStore.Location)
                        .input('storeSize', sql.NVarChar, uatStore.StoreSize)
                        .input('isActive', sql.Bit, uatStore.IsActive)
                        .input('brandId', sql.Int, liveBrandId)
                        .query('UPDATE Stores SET StoreCode=@storeCode, Location=@location, StoreSize=@storeSize, IsActive=@isActive, BrandId=@brandId WHERE StoreName=@storeName');
                } else {
                    await livePool.request()
                        .input('storeName', sql.NVarChar, store.name)
                        .input('storeCode', sql.NVarChar, uatStore.StoreCode)
                        .input('location', sql.NVarChar, uatStore.Location)
                        .input('storeSize', sql.NVarChar, uatStore.StoreSize)
                        .input('isActive', sql.Bit, uatStore.IsActive)
                        .input('brandId', sql.Int, liveBrandId)
                        .query('INSERT INTO Stores (StoreName, StoreCode, Location, StoreSize, IsActive, BrandId, CreatedDate) VALUES (@storeName, @storeCode, @location, @storeSize, @isActive, @brandId, GETDATE())');
                }
                count++;
            }
        } else if (type === 'brands') {
            for (const brand of items) {
                const uatBrand = brand.uat;
                if (!uatBrand) continue;
                
                const exists = await livePool.request()
                    .input('code', sql.NVarChar, brand.code)
                    .query('SELECT Id FROM Brands WHERE BrandCode = @code');
                
                if (exists.recordset.length > 0) {
                    await livePool.request()
                        .input('code', sql.NVarChar, brand.code)
                        .input('brandName', sql.NVarChar, uatBrand.BrandName)
                        .input('logoUrl', sql.NVarChar, uatBrand.LogoUrl)
                        .input('primaryColor', sql.NVarChar, uatBrand.PrimaryColor)
                        .input('isActive', sql.Bit, uatBrand.IsActive)
                        .query('UPDATE Brands SET BrandName=@brandName, LogoUrl=@logoUrl, PrimaryColor=@primaryColor, IsActive=@isActive, UpdatedAt=GETDATE() WHERE BrandCode=@code');
                } else {
                    await livePool.request()
                        .input('code', sql.NVarChar, brand.code)
                        .input('brandName', sql.NVarChar, uatBrand.BrandName)
                        .input('logoUrl', sql.NVarChar, uatBrand.LogoUrl)
                        .input('primaryColor', sql.NVarChar, uatBrand.PrimaryColor)
                        .input('isActive', sql.Bit, uatBrand.IsActive)
                        .query('INSERT INTO Brands (BrandCode, BrandName, LogoUrl, PrimaryColor, IsActive, CreatedAt) VALUES (@code, @brandName, @logoUrl, @primaryColor, @isActive, GETDATE())');
                }
                count++;
            }
        } else if (type === 'storeResponsibles') {
            for (const sr of items) {
                const uatSR = sr.uat;
                if (!uatSR) continue;
                
                // Get Live StoreId by StoreName
                const liveStore = await livePool.request()
                    .input('storeName', sql.NVarChar, sr.storeName)
                    .query('SELECT Id FROM Stores WHERE StoreName = @storeName');
                if (liveStore.recordset.length === 0) continue;
                const liveStoreId = liveStore.recordset[0].Id;
                
                // Get Live AreaManagerId by Email
                let liveAreaManagerId = null;
                if (uatSR.AreaManagerEmail) {
                    const liveAM = await livePool.request()
                        .input('email', sql.NVarChar, uatSR.AreaManagerEmail)
                        .query('SELECT Id FROM Users WHERE Email = @email');
                    if (liveAM.recordset.length > 0) liveAreaManagerId = liveAM.recordset[0].Id;
                }
                
                // Get Live HeadOfOpsId by Email
                let liveHeadOfOpsId = null;
                if (uatSR.HeadOfOpsEmail) {
                    const liveHO = await livePool.request()
                        .input('email', sql.NVarChar, uatSR.HeadOfOpsEmail)
                        .query('SELECT Id FROM Users WHERE Email = @email');
                    if (liveHO.recordset.length > 0) liveHeadOfOpsId = liveHO.recordset[0].Id;
                }
                
                const exists = await livePool.request()
                    .input('storeId', sql.Int, liveStoreId)
                    .query('SELECT Id FROM OE_StoreResponsibles WHERE StoreId = @storeId');
                
                if (exists.recordset.length > 0) {
                    await livePool.request()
                        .input('storeId', sql.Int, liveStoreId)
                        .input('areaManagerId', sql.Int, liveAreaManagerId)
                        .input('headOfOpsId', sql.Int, liveHeadOfOpsId)
                        .input('isActive', sql.Bit, uatSR.IsActive)
                        .input('notes', sql.NVarChar, uatSR.Notes)
                        .query('UPDATE OE_StoreResponsibles SET AreaManagerId=@areaManagerId, HeadOfOpsId=@headOfOpsId, IsActive=@isActive, Notes=@notes, UpdatedAt=GETDATE() WHERE StoreId=@storeId');
                } else {
                    await livePool.request()
                        .input('storeId', sql.Int, liveStoreId)
                        .input('areaManagerId', sql.Int, liveAreaManagerId)
                        .input('headOfOpsId', sql.Int, liveHeadOfOpsId)
                        .input('isActive', sql.Bit, uatSR.IsActive)
                        .input('notes', sql.NVarChar, uatSR.Notes)
                        .query('INSERT INTO OE_StoreResponsibles (StoreId, AreaManagerId, HeadOfOpsId, IsActive, Notes, CreatedBy, CreatedAt) VALUES (@storeId, @areaManagerId, @headOfOpsId, @isActive, @notes, \'System\', GETDATE())');
                }
                count++;
            }
        }
        
        res.json({ success: true, count });
    } catch (err) {
        console.error('Error syncing:', err);
        res.json({ success: false, error: err.message });
    } finally {
        try { if (uatPool) await uatPool.close(); } catch(e) {}
        try { if (livePool) await livePool.close(); } catch(e) {}
    }
});

// Sync all
router.post('/sync-all', async (req, res) => {
    let uatPool = null;
    let livePool = null;
    try {
        const { forms, roles, access, users } = req.body;
        
        uatPool = await new sql.ConnectionPool(uatDbConfig).connect();
        livePool = await new sql.ConnectionPool(liveDbConfig).connect();
        
        let formsCount = 0, rolesCount = 0, accessCount = 0, usersCount = 0;
        
        // Sync Roles first
        for (const role of roles || []) {
            const uatRole = role.uat;
            if (!uatRole) continue;
            
            const exists = await livePool.request()
                .input('name', sql.NVarChar, role.name)
                .query('SELECT Id FROM UserRoles WHERE RoleName = @name');
            
            if (exists.recordset.length > 0) {
                await livePool.request()
                    .input('name', sql.NVarChar, role.name)
                    .input('description', sql.NVarChar, uatRole.Description)
                    .input('categoryId', sql.Int, uatRole.CategoryId)
                    .query('UPDATE UserRoles SET Description=@description, CategoryId=@categoryId WHERE RoleName=@name');
            } else {
                await livePool.request()
                    .input('name', sql.NVarChar, role.name)
                    .input('description', sql.NVarChar, uatRole.Description)
                    .input('categoryId', sql.Int, uatRole.CategoryId)
                    .query('INSERT INTO UserRoles (RoleName, Description, CategoryId) VALUES (@name, @description, @categoryId)');
            }
            rolesCount++;
        }
        
        // Sync Forms
        for (const form of forms || []) {
            const uatForm = form.uat;
            if (!uatForm) continue;
            
            const exists = await livePool.request()
                .input('code', sql.NVarChar, form.code)
                .query('SELECT Id FROM Forms WHERE FormCode = @code');
            
            if (exists.recordset.length > 0) {
                await livePool.request()
                    .input('code', sql.NVarChar, form.code)
                    .input('formName', sql.NVarChar, uatForm.FormName)
                    .input('moduleName', sql.NVarChar, uatForm.ModuleName)
                    .input('formUrl', sql.NVarChar, uatForm.FormUrl)
                    .input('description', sql.NVarChar, uatForm.Description)
                    .input('isActive', sql.Bit, uatForm.IsActive)
                    .input('menuId', sql.NVarChar, uatForm.MenuId)
                    .input('dashboardIcon', sql.NVarChar, uatForm.DashboardIcon)
                    .input('dashboardCategory', sql.NVarChar, uatForm.DashboardCategory)
                    .input('dashboardCategoryIcon', sql.NVarChar, uatForm.DashboardCategoryIcon)
                    .input('dashboardCategoryColor', sql.NVarChar, uatForm.DashboardCategoryColor)
                    .input('dashboardTitle', sql.NVarChar, uatForm.DashboardTitle)
                    .input('dashboardDescription', sql.NVarChar, uatForm.DashboardDescription)
                    .input('showOnDashboard', sql.Bit, uatForm.ShowOnDashboard)
                    .input('categorySortOrder', sql.Int, uatForm.CategorySortOrder)
                    .input('dashboardSortOrder', sql.Int, uatForm.DashboardSortOrder)
                    .query(`UPDATE Forms SET FormName=@formName, ModuleName=@moduleName, FormUrl=@formUrl,
                        Description=@description, IsActive=@isActive, MenuId=@menuId,
                        DashboardIcon=@dashboardIcon, DashboardCategory=@dashboardCategory,
                        DashboardCategoryIcon=@dashboardCategoryIcon, DashboardCategoryColor=@dashboardCategoryColor,
                        DashboardTitle=@dashboardTitle, DashboardDescription=@dashboardDescription,
                        ShowOnDashboard=@showOnDashboard, CategorySortOrder=@categorySortOrder,
                        DashboardSortOrder=@dashboardSortOrder, UpdatedAt=GETDATE() WHERE FormCode=@code`);
            } else {
                await livePool.request()
                    .input('code', sql.NVarChar, form.code)
                    .input('formName', sql.NVarChar, uatForm.FormName)
                    .input('moduleName', sql.NVarChar, uatForm.ModuleName)
                    .input('formUrl', sql.NVarChar, uatForm.FormUrl)
                    .input('description', sql.NVarChar, uatForm.Description)
                    .input('isActive', sql.Bit, uatForm.IsActive)
                    .input('menuId', sql.NVarChar, uatForm.MenuId)
                    .input('dashboardIcon', sql.NVarChar, uatForm.DashboardIcon)
                    .input('dashboardCategory', sql.NVarChar, uatForm.DashboardCategory)
                    .input('dashboardCategoryIcon', sql.NVarChar, uatForm.DashboardCategoryIcon)
                    .input('dashboardCategoryColor', sql.NVarChar, uatForm.DashboardCategoryColor)
                    .input('dashboardTitle', sql.NVarChar, uatForm.DashboardTitle)
                    .input('dashboardDescription', sql.NVarChar, uatForm.DashboardDescription)
                    .input('showOnDashboard', sql.Bit, uatForm.ShowOnDashboard)
                    .input('categorySortOrder', sql.Int, uatForm.CategorySortOrder)
                    .input('dashboardSortOrder', sql.Int, uatForm.DashboardSortOrder)
                    .query(`INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive,
                        MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor,
                        DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
                        VALUES (@code, @formName, @moduleName, @formUrl, @description, @isActive,
                        @menuId, @dashboardIcon, @dashboardCategory, @dashboardCategoryIcon, @dashboardCategoryColor,
                        @dashboardTitle, @dashboardDescription, @showOnDashboard, @categorySortOrder, @dashboardSortOrder)`);
            }
            formsCount++;
        }
        
        // Sync Access
        for (const acc of access || []) {
            const uatAccess = acc.uat;
            if (!uatAccess) continue;
            
            const liveRole = await livePool.request()
                .input('name', sql.NVarChar, acc.roleName)
                .query('SELECT Id FROM UserRoles WHERE RoleName = @name');
            
            if (liveRole.recordset.length === 0) continue;
            const liveRoleId = liveRole.recordset[0].Id;
            
            const exists = await livePool.request()
                .input('roleId', sql.Int, liveRoleId)
                .input('formCode', sql.NVarChar, acc.formCode)
                .query('SELECT Id FROM RoleFormAccess WHERE RoleId=@roleId AND FormCode=@formCode');
            
            if (exists.recordset.length > 0) {
                await livePool.request()
                    .input('roleId', sql.Int, liveRoleId)
                    .input('formCode', sql.NVarChar, acc.formCode)
                    .input('canView', sql.Bit, uatAccess.CanView)
                    .input('canCreate', sql.Bit, uatAccess.CanCreate)
                    .input('canEdit', sql.Bit, uatAccess.CanEdit)
                    .input('canDelete', sql.Bit, uatAccess.CanDelete)
                    .query('UPDATE RoleFormAccess SET CanView=@canView, CanCreate=@canCreate, CanEdit=@canEdit, CanDelete=@canDelete WHERE RoleId=@roleId AND FormCode=@formCode');
            } else {
                await livePool.request()
                    .input('roleId', sql.Int, liveRoleId)
                    .input('formCode', sql.NVarChar, acc.formCode)
                    .input('canView', sql.Bit, uatAccess.CanView)
                    .input('canCreate', sql.Bit, uatAccess.CanCreate)
                    .input('canEdit', sql.Bit, uatAccess.CanEdit)
                    .input('canDelete', sql.Bit, uatAccess.CanDelete)
                    .query('INSERT INTO RoleFormAccess (RoleId, FormCode, CanView, CanCreate, CanEdit, CanDelete) VALUES (@roleId, @formCode, @canView, @canCreate, @canEdit, @canDelete)');
            }
            accessCount++;
        }
        
        // Sync Users
        for (const user of users || []) {
            const uatUser = user.uat;
            if (!uatUser) continue;
            
            // Get the Live RoleId that matches the UAT RoleName
            let liveRoleId = null;
            if (uatUser.RoleName) {
                const liveRole = await livePool.request()
                    .input('roleName', sql.NVarChar, uatUser.RoleName)
                    .query('SELECT Id FROM UserRoles WHERE RoleName = @roleName');
                if (liveRole.recordset.length > 0) {
                    liveRoleId = liveRole.recordset[0].Id;
                }
            }
            
            const exists = await livePool.request()
                .input('email', sql.NVarChar, user.email)
                .query('SELECT Id FROM Users WHERE Email = @email');
            
            if (exists.recordset.length > 0) {
                await livePool.request()
                    .input('email', sql.NVarChar, user.email)
                    .input('displayName', sql.NVarChar, uatUser.DisplayName)
                    .input('roleId', sql.Int, liveRoleId)
                    .input('isActive', sql.Bit, uatUser.IsActive)
                    .input('isApproved', sql.Bit, uatUser.IsApproved)
                    .query('UPDATE Users SET DisplayName=@displayName, RoleId=@roleId, IsActive=@isActive, IsApproved=@isApproved WHERE Email=@email');
            } else {
                await livePool.request()
                    .input('email', sql.NVarChar, user.email)
                    .input('displayName', sql.NVarChar, uatUser.DisplayName)
                    .input('roleId', sql.Int, liveRoleId)
                    .input('isActive', sql.Bit, uatUser.IsActive)
                    .input('isApproved', sql.Bit, uatUser.IsApproved)
                    .query('INSERT INTO Users (Email, DisplayName, RoleId, IsActive, IsApproved) VALUES (@email, @displayName, @roleId, @isActive, @isApproved)');
            }
            usersCount++;
        }
        
        res.json({ success: true, forms: formsCount, roles: rolesCount, access: accessCount, users: usersCount });
    } catch (err) {
        console.error('Error syncing all:', err);
        res.json({ success: false, error: err.message });
    } finally {
        try { if (uatPool) await uatPool.close(); } catch(e) {}
        try { if (livePool) await livePool.close(); } catch(e) {}
    }
});

module.exports = router;
