/**
 * Public Approval Routes
 * These routes handle approval links from emails without requiring login
 * Security is maintained via token verification
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const crypto = require('crypto');
const emailService = require('../services/email-service');

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

// Helper function to generate token for a request
function generateApprovalToken(requestId, approverEmail) {
    const secret = process.env.SESSION_SECRET || 'oe-app-secret';
    return crypto.createHmac('sha256', secret)
        .update(`${requestId}-${approverEmail}`)
        .digest('hex')
        .substring(0, 32);
}

// Verify token
function verifyToken(requestId, approverEmail, token) {
    const expectedToken = generateApprovalToken(requestId, approverEmail);
    return token === expectedToken;
}

// GET: Extra Cleaning approval page from email link
router.get('/extra-cleaning/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const requestId = parseInt(req.params.id);
        const action = req.query.action; // 'approve' or 'reject' from email link
        
        // Get the request details
        const result = await pool.request()
            .input('id', sql.Int, requestId)
            .query(`SELECT r.*, u.DisplayName as CreatedByName 
                    FROM ExtraCleaningRequests r
                    LEFT JOIN Users u ON r.CreatedBy = u.Id
                    WHERE r.Id = @id`);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Not Found - GMRL</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: #f5f5f5; text-align: center; }
                        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                        h2 { color: #dc3545; margin: 0 0 15px 0; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">❌</div>
                        <h2>Request Not Found</h2>
                        <p>The request you're looking for doesn't exist or has been deleted.</p>
                    </div>
                </body>
                </html>
            `);
        }
        
        const request = result.recordset[0];
        const approvalChain = JSON.parse(request.ApprovalChain || '[]');
        const currentApprover = approvalChain[request.CurrentApprovalStep] || {};
        
        // Check if already fully approved or rejected
        if (request.OverallStatus === 'FullyApproved') {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Already Approved - GMRL</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: #f5f5f5; text-align: center; }
                        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                        h2 { color: #28a745; margin: 0 0 15px 0; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✅</div>
                        <h2>Already Approved</h2>
                        <p>This request has already been fully approved.</p>
                    </div>
                </body>
                </html>
            `);
        }
        
        if (request.OverallStatus === 'Rejected') {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Already Rejected - GMRL</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: #f5f5f5; text-align: center; }
                        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                        h2 { color: #dc3545; margin: 0 0 15px 0; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">❌</div>
                        <h2>Already Rejected</h2>
                        <p>This request has already been rejected.</p>
                    </div>
                </body>
                </html>
            `);
        }
        
        const roleNames = {
            'AreaManager': 'Area Manager',
            'HeadOfOperations': 'Head of Operations',
            'HR': 'HR Manager'
        };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Approve Request - GMRL Extra Cleaning</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="icon" href="/favicon.ico">
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); overflow: hidden; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                    .header img { width: 80px; margin-bottom: 15px; }
                    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
                    .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
                    .content { padding: 25px; }
                    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #eee; }
                    .detail-label { font-weight: 600; width: 140px; color: #666; flex-shrink: 0; }
                    .detail-value { flex: 1; color: #333; }
                    .status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                    .status-pending { background: #fff3cd; color: #856404; }
                    .approval-section { margin-top: 25px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
                    .approval-section h3 { margin-top: 0; color: #333; font-size: 18px; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #555; }
                    .form-group textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; min-height: 80px; font-family: inherit; font-size: 14px; resize: vertical; }
                    .form-group textarea:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
                    .buttons { display: flex; gap: 12px; margin-top: 20px; }
                    .btn { flex: 1; padding: 16px 20px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; text-align: center; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
                    .btn-approve { background: #28a745; color: white; }
                    .btn-approve:hover { background: #218838; transform: translateY(-1px); }
                    .btn-reject { background: #dc3545; color: white; }
                    .btn-reject:hover { background: #c82333; transform: translateY(-1px); }
                    .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                    .chain { margin-top: 15px; padding: 15px; background: #e9ecef; border-radius: 8px; }
                    .chain-label { font-weight: 600; margin-bottom: 10px; color: #555; }
                    .chain-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
                    .chain-step { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; }
                    .chain-arrow { color: #999; font-size: 14px; }
                    .chain-done { background: #28a745; color: white; }
                    .chain-current { background: #667eea; color: white; animation: pulse 2s infinite; }
                    .chain-pending { background: #ddd; color: #666; }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                    .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 15px 30px; border-radius: 8px; color: white; font-weight: 600; display: none; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
                    .toast-success { background: #28a745; }
                    .toast-error { background: #dc3545; }
                    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 0.8s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .logo-text { font-size: 28px; font-weight: 700; letter-spacing: 2px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo-text">GMRL</div>
                        <h1>🧹 Extra Cleaning Request</h1>
                        <p>Pending your approval as <strong>${roleNames[request.CurrentApproverRole] || request.CurrentApproverRole}</strong></p>
                    </div>
                    <div class="content">
                        <div class="detail-row">
                            <span class="detail-label">Request ID</span>
                            <span class="detail-value"><strong>#${request.Id}</strong></span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Store</span>
                            <span class="detail-value">${request.Store || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Category</span>
                            <span class="detail-value">${request.Category || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Third Party</span>
                            <span class="detail-value">${request.ThirdParty || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">No. of Agents</span>
                            <span class="detail-value">${request.NumberOfAgents || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Start Date</span>
                            <span class="detail-value">${request.StartDate ? new Date(request.StartDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">End Date</span>
                            <span class="detail-value">${request.EndDate ? new Date(request.EndDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Requested By</span>
                            <span class="detail-value">${request.CreatedByName || 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Description</span>
                            <span class="detail-value">${request.Description || 'No description provided'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value"><span class="status-badge status-pending">⏳ Pending Approval</span></span>
                        </div>
                        
                        <div class="chain">
                            <div class="chain-label">📋 Approval Chain</div>
                            <div class="chain-steps">
                                ${approvalChain.map((step, idx) => {
                                    let cls = 'chain-pending';
                                    let icon = '○';
                                    if (idx < request.CurrentApprovalStep) { cls = 'chain-done'; icon = '✓'; }
                                    else if (idx === request.CurrentApprovalStep) { cls = 'chain-current'; icon = '●'; }
                                    const arrow = idx < approvalChain.length - 1 ? '<span class="chain-arrow">→</span>' : '';
                                    return '<span class="chain-step ' + cls + '">' + icon + ' ' + (roleNames[step.role] || step.role) + '</span>' + arrow;
                                }).join('')}
                            </div>
                        </div>
                        
                        <div class="approval-section">
                            <h3>📝 Your Decision</h3>
                            <div class="form-group">
                                <label for="comments">Comments (optional)</label>
                                <textarea id="comments" placeholder="Add any comments about your decision..."></textarea>
                            </div>
                            <div class="buttons">
                                <button class="btn btn-approve" id="btnApprove" onclick="submitApproval('approve')">
                                    <span class="btn-text">✅ Approve</span>
                                </button>
                                <button class="btn btn-reject" id="btnReject" onclick="submitApproval('reject')">
                                    <span class="btn-text">❌ Reject</span>
                                </button>
                            </div>
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
                    
                    async function submitApproval(action) {
                        const comments = document.getElementById('comments').value;
                        const btnApprove = document.getElementById('btnApprove');
                        const btnReject = document.getElementById('btnReject');
                        const activeBtn = action === 'approve' ? btnApprove : btnReject;
                        
                        // Disable buttons and show loading
                        btnApprove.disabled = true;
                        btnReject.disabled = true;
                        activeBtn.innerHTML = '<span class="spinner"></span> Processing...';
                        
                        try {
                            const res = await fetch('/public/approve/extra-cleaning/${requestId}/submit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action, comments })
                            });
                            
                            const data = await res.json();
                            
                            if (res.ok && data.success) {
                                showToast(data.message, 'success');
                                setTimeout(() => {
                                    // Show success page inline
                                    document.querySelector('.container').innerHTML = \`
                                        <div style="text-align:center;padding:60px 40px;">
                                            <div style="font-size:80px;margin-bottom:20px;">\${action === 'approve' ? '✅' : '❌'}</div>
                                            <h1 style="color:\${action === 'approve' ? '#28a745' : '#dc3545'};margin:0 0 15px 0;">
                                                \${data.status === 'FullyApproved' ? 'Fully Approved!' : (action === 'approve' ? 'Approved!' : 'Rejected')}
                                            </h1>
                                            <p style="color:#666;font-size:16px;margin-bottom:30px;">
                                                \${data.status === 'FullyApproved' 
                                                    ? 'The request has been fully approved and is now complete.' 
                                                    : (action === 'approve' 
                                                        ? 'Your approval has been recorded. The request has been sent to the next approver.' 
                                                        : 'The request has been rejected and the requester has been notified.')}
                                            </p>
                                            <p style="color:#999;font-size:14px;">You can close this window.</p>
                                        </div>
                                    \`;
                                }, 1000);
                            } else {
                                showToast(data.error || 'Failed to process approval', 'error');
                                btnApprove.disabled = false;
                                btnReject.disabled = false;
                                btnApprove.innerHTML = '<span class="btn-text">✅ Approve</span>';
                                btnReject.innerHTML = '<span class="btn-text">❌ Reject</span>';
                            }
                        } catch (err) {
                            showToast('Error: ' + err.message, 'error');
                            btnApprove.disabled = false;
                            btnReject.disabled = false;
                            btnApprove.innerHTML = '<span class="btn-text">✅ Approve</span>';
                            btnReject.innerHTML = '<span class="btn-text">❌ Reject</span>';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading approval page:', err);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error - GMRL</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: #f5f5f5; text-align: center; }
                    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .icon { font-size: 64px; margin-bottom: 20px; }
                    h2 { color: #dc3545; margin: 0 0 15px 0; }
                    p { color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">⚠️</div>
                    <h2>Error Loading Request</h2>
                    <p>${err.message}</p>
                </div>
            </body>
            </html>
        `);
    }
});

// POST: Submit approval/rejection (public endpoint)
router.post('/extra-cleaning/:id/submit', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const requestId = parseInt(req.params.id);
        const { action, comments } = req.body;
        
        // Validate action
        if (!['approve', 'reject'].includes(action)) {
            await pool.close();
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }
        
        // Get current request with creator's name
        const requestResult = await pool.request()
            .input('id', sql.Int, requestId)
            .query(`SELECT r.*, u.DisplayName as CreatedByName 
                    FROM ExtraCleaningRequests r
                    LEFT JOIN Users u ON r.CreatedBy = u.Id
                    WHERE r.Id = @id`);
        
        if (requestResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        const request = requestResult.recordset[0];
        
        // Check if already processed
        if (request.OverallStatus === 'FullyApproved' || request.OverallStatus === 'Rejected') {
            await pool.close();
            return res.status(400).json({ 
                success: false, 
                error: `Request has already been ${request.OverallStatus.toLowerCase()}` 
            });
        }
        
        const approvalChain = JSON.parse(request.ApprovalChain || '[]');
        const currentStep = request.CurrentApprovalStep;
        const currentApprover = approvalChain[currentStep];
        
        if (!currentApprover) {
            await pool.close();
            return res.status(400).json({ success: false, error: 'No pending approval step' });
        }
        
        const now = new Date();
        let newStatus = '';
        let nextStep = currentStep;
        
        if (action === 'reject') {
            // Rejection - end the chain
            newStatus = 'Rejected';
            approvalChain[currentStep].status = 'Rejected';
            approvalChain[currentStep].comments = comments || '';
            approvalChain[currentStep].approvedAt = now.toISOString();
        } else {
            // Approval
            approvalChain[currentStep].status = 'Approved';
            approvalChain[currentStep].comments = comments || '';
            approvalChain[currentStep].approvedAt = now.toISOString();
            
            if (currentStep + 1 >= approvalChain.length) {
                // Last step - fully approved
                newStatus = 'FullyApproved';
            } else {
                // Move to next step
                nextStep = currentStep + 1;
                newStatus = 'PendingApproval';
            }
        }
        
        // Build role-specific status update
        const roleStatusColumn = {
            'AreaManager': 'AreaManagerStatus',
            'HeadOfOperations': 'HOStatus',
            'HR': 'HRStatus'
        };
        const statusColumn = roleStatusColumn[currentApprover.role];
        const statusValue = action === 'approve' ? 'Approved' : 'Rejected';
        
        // Update the request - including individual status columns
        let updateQuery = `UPDATE ExtraCleaningRequests 
                    SET ApprovalChain = @chain, 
                        CurrentApprovalStep = @step, 
                        OverallStatus = @status,
                        CurrentApproverRole = @role,
                        UpdatedAt = GETDATE()`;
        
        // Add role-specific column update
        if (statusColumn) {
            updateQuery += `, ${statusColumn} = @roleStatus, ${statusColumn.replace('Status', 'ApprovedAt')} = GETDATE()`;
        }
        updateQuery += ` WHERE Id = @id`;
        
        await pool.request()
            .input('id', sql.Int, requestId)
            .input('chain', sql.NVarChar(sql.MAX), JSON.stringify(approvalChain))
            .input('step', sql.Int, nextStep)
            .input('status', sql.NVarChar(50), newStatus)
            .input('role', sql.NVarChar(50), approvalChain[nextStep]?.role || null)
            .input('roleStatus', sql.NVarChar(50), statusValue)
            .query(updateQuery);
        
        // Log to approval history
        await pool.request()
            .input('requestId', sql.Int, requestId)
            .input('step', sql.Int, currentStep)
            .input('role', sql.NVarChar(50), currentApprover.role)
            .input('email', sql.NVarChar(200), currentApprover.email)
            .input('action', sql.NVarChar(20), action === 'approve' ? 'Approved' : 'Rejected')
            .input('comments', sql.NVarChar(500), comments || null)
            .query(`INSERT INTO ExtraCleaningApprovalHistory 
                    (RequestId, StepNumber, ApproverRole, ApproverEmail, Action, Comments, ActionDate)
                    VALUES (@requestId, @step, @role, @email, @action, @comments, GETDATE())`);
        
        await pool.close();
        
        const roleNames = {
            'AreaManager': 'Area Manager',
            'HeadOfOperations': 'Head of Operations',
            'HR': 'HR Manager'
        };

        // If approved and not fully approved yet, send email to next approver
        if (action === 'approve' && newStatus === 'PendingApproval' && approvalChain[nextStep]) {
            const nextApprover = approvalChain[nextStep];
            const appUrl = process.env.NODE_ENV === 'live' 
                ? 'https://oeapp.gmrlapps.com' 
                : 'https://oeapp-uat.gmrlapps.com';
            
            // Send email to next approver using app token (no login required)
            emailService.sendApprovalRequestEmailWithAppToken({
                approverEmail: nextApprover.email,
                approverRole: nextApprover.role,
                request: {
                    Id: requestId,
                    Store: request.Store,
                    Category: request.Category,
                    SubmittedBy: request.CreatedByName || 'Unknown',
                    DateRequired: request.StartDate ? new Date(request.StartDate).toLocaleDateString('en-GB') : 'N/A',
                    Description: request.Description
                },
                appUrl: appUrl
            }).then(result => {
                if (result.success) {
                    console.log('📧 ✅ Approval email sent to next approver:', nextApprover.email);
                } else {
                    console.error('📧 ❌ Failed to send approval email:', result.error);
                }
            }).catch(err => {
                console.error('📧 ❌ Email error:', err.message);
            });
        }
        
        res.json({ 
            success: true, 
            message: action === 'approve' 
                ? (newStatus === 'FullyApproved' ? 'Request fully approved!' : `Approved! Sent to ${roleNames[approvalChain[nextStep]?.role] || 'next approver'}`)
                : 'Request rejected',
            status: newStatus
        });
        
    } catch (err) {
        console.error('Error processing approval:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
