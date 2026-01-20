/**
 * Email Service using Microsoft Graph API
 * Sends emails via Microsoft Graph using user's delegated token
 */

class EmailService {
    constructor() {
        // The email address to send from (must be a valid mailbox in your tenant)
        this.fromEmail = process.env.EMAIL_FROM || 'noreply@gmrlgroup.com';
        
        console.log('[EMAIL] Email Service initialized');
        console.log('[EMAIL] From address:', this.fromEmail);
    }

    /**
     * Send an email using Microsoft Graph API with user's delegated token
     * @param {Object} options - Email options
     * @param {string} options.to - Recipient email address
     * @param {string} options.subject - Email subject
     * @param {string} options.body - Email body (HTML supported)
     * @param {string} options.cc - Optional CC email address
     * @param {string} options.accessToken - User's access token with Mail.Send permission
     */
    async sendEmail({ to, subject, body, cc = null, accessToken = null }) {
        try {
            console.log('[EMAIL] Sending email to:', to);
            console.log('[EMAIL] Subject:', subject);

            if (!accessToken) {
                throw new Error('No access token provided - user must be logged in');
            }

            const message = {
                message: {
                    subject: subject,
                    body: {
                        contentType: 'HTML',
                        content: body
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: to
                            }
                        }
                    ]
                },
                saveToSentItems: true
            };

            // Add CC if provided
            if (cc) {
                message.message.ccRecipients = [
                    {
                        emailAddress: {
                            address: cc
                        }
                    }
                ];
            }

            // Send email using /me/sendMail endpoint (uses delegated token from logged-in user)
            const response = await fetch(
                `https://graph.microsoft.com/v1.0/me/sendMail`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(message)
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[EMAIL] Graph API Error:', response.status, errorText);
                throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
            }

            console.log('[EMAIL] ✅ Email sent successfully to:', to);
            return { success: true, message: 'Email sent successfully' };

        } catch (error) {
            console.error('[EMAIL] ❌ Error sending email:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send approval request email
     * @param {Object} options
     * @param {string} options.approverEmail - Approver's email
     * @param {string} options.approverRole - Approver's role (AreaManager, HeadOfOperations, HR)
     * @param {Object} options.request - The request details
     * @param {string} options.appUrl - Base URL of the application
     * @param {string} options.accessToken - User's access token with Mail.Send permission
     */
    async sendApprovalRequestEmail({ approverEmail, approverRole, request, appUrl, accessToken }) {
        // Use public approval URL (no login required)
        const approveUrl = `${appUrl}/public/approve/extra-cleaning/${request.Id}?action=approve`;
        const rejectUrl = `${appUrl}/public/approve/extra-cleaning/${request.Id}?action=reject`;
        const viewUrl = `${appUrl}/stores/extra-cleaning/view/${request.Id}`;

        const roleNames = {
            'AreaManager': 'Area Manager',
            'HeadOfOperations': 'Head of Operations',
            'HR': 'HR Manager'
        };

        const subject = `🔔 Extra Cleaning Request Pending Your Approval - ${request.Store || 'Unknown Store'}`;
        
        const body = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 25px; border: 1px solid #e9ecef; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: 600; width: 150px; color: #666; }
        .detail-value { flex: 1; }
        .buttons { margin-top: 25px; text-align: center; }
        .btn { display: inline-block; padding: 12px 30px; margin: 5px; border-radius: 6px; text-decoration: none; font-weight: 600; }
        .btn-approve { background: #28a745; color: white; }
        .btn-reject { background: #dc3545; color: white; }
        .btn-view { background: #17a2b8; color: white; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin:0;">🧹 Extra Cleaning Request</h1>
            <p style="margin:10px 0 0 0;">Pending your approval as ${roleNames[approverRole] || approverRole}</p>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>A new Extra Cleaning request requires your approval:</p>
            
            <div class="details">
                <div class="detail-row">
                    <span class="detail-label">Store:</span>
                    <span class="detail-value">${request.Store || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">${request.Category || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Requested By:</span>
                    <span class="detail-value">${request.RequestedBy || request.SubmittedBy || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date Required:</span>
                    <span class="detail-value">${request.DateRequired ? new Date(request.DateRequired).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${request.Description || request.Comments || 'N/A'}</span>
                </div>
            </div>

            <div class="buttons">
                <a href="${approveUrl}" class="btn btn-approve">✅ Approve</a>
                <a href="${rejectUrl}" class="btn btn-reject">❌ Reject</a>
                <a href="${viewUrl}" class="btn btn-view">👁️ View Details</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
        `;

        return this.sendEmail({
            to: approverEmail,
            subject,
            body,
            accessToken
        });
    }

    /**
     * Send approval status notification to requester
     * @param {string} options.accessToken - User's access token with Mail.Send permission
     */
    async sendStatusNotificationEmail({ requesterEmail, request, status, approverRole, comments, appUrl, accessToken }) {
        const statusColors = {
            'approved': '#28a745',
            'rejected': '#dc3545',
            'pending': '#ffc107'
        };

        const statusIcons = {
            'approved': '✅',
            'rejected': '❌',
            'pending': '⏳'
        };

        const subject = `${statusIcons[status]} Extra Cleaning Request ${status.charAt(0).toUpperCase() + status.slice(1)} - ${request.Store || 'Request'}`;

        const body = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColors[status]}; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 25px; border: 1px solid #e9ecef; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin:0;">${statusIcons[status]} Request ${status.charAt(0).toUpperCase() + status.slice(1)}</h1>
        </div>
        <div class="content">
            <p>Your Extra Cleaning request for <strong>${request.Store || 'Unknown Store'}</strong> has been <strong>${status}</strong> by ${approverRole}.</p>
            ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
            <p><a href="${appUrl}/stores/extra-cleaning/view/${request.Id}">View Request Details</a></p>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
        </div>
    </div>
</body>
</html>
        `;

        return this.sendEmail({
            to: requesterEmail,
            subject,
            body,
            accessToken
        });
    }

    /**
     * Get an application token using client credentials flow
     * This allows sending emails without a logged-in user
     */
    async getAppToken() {
        try {
            const tenantId = process.env.AZURE_TENANT_ID;
            const clientId = process.env.AZURE_CLIENT_ID;
            const clientSecret = process.env.AZURE_CLIENT_SECRET;

            if (!tenantId || !clientId || !clientSecret) {
                throw new Error('Azure AD credentials not configured');
            }

            const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            
            const params = new URLSearchParams();
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);
            params.append('scope', 'https://graph.microsoft.com/.default');
            params.append('grant_type', 'client_credentials');

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get app token: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('[EMAIL] Error getting app token:', error.message);
            throw error;
        }
    }

    /**
     * Send email using application permissions (no user login required)
     * Requires Mail.Send application permission in Azure AD
     */
    async sendEmailWithAppToken({ to, subject, body, cc = null }) {
        try {
            console.log('[EMAIL] Sending email with app token to:', to);
            console.log('[EMAIL] Subject:', subject);

            const accessToken = await this.getAppToken();
            const fromEmail = this.fromEmail;

            const message = {
                message: {
                    subject: subject,
                    body: {
                        contentType: 'HTML',
                        content: body
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: to
                            }
                        }
                    ]
                },
                saveToSentItems: true
            };

            if (cc) {
                message.message.ccRecipients = [
                    {
                        emailAddress: {
                            address: cc
                        }
                    }
                ];
            }

            // Send email using /users/{email}/sendMail endpoint (uses application permissions)
            const response = await fetch(
                `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(message)
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[EMAIL] Graph API Error:', response.status, errorText);
                throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
            }

            console.log('[EMAIL] ✅ Email sent successfully (app token) to:', to);
            return { success: true, message: 'Email sent successfully' };

        } catch (error) {
            console.error('[EMAIL] ❌ Error sending email with app token:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send approval request email using app token (for public routes without login)
     */
    async sendApprovalRequestEmailWithAppToken({ approverEmail, approverRole, request, appUrl }) {
        // Use public approval URL (no login required)
        const approveUrl = `${appUrl}/public/approve/extra-cleaning/${request.Id}?action=approve`;
        const rejectUrl = `${appUrl}/public/approve/extra-cleaning/${request.Id}?action=reject`;

        const roleNames = {
            'AreaManager': 'Area Manager',
            'HeadOfOperations': 'Head of Operations',
            'HR': 'HR Manager'
        };

        const subject = `🔔 Extra Cleaning Request Pending Your Approval - ${request.Store || 'Unknown Store'}`;
        
        const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🧹 Extra Cleaning Request</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Pending your approval as ${roleNames[approverRole] || approverRole}</p>
        </div>
        <div style="padding: 25px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666; width: 140px;">Request ID</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>#${request.Id}</strong></td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Store</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.Store || 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Category</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.Category || 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Submitted By</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.SubmittedBy || 'Unknown'}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Date Required</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.DateRequired || 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; color: #666; vertical-align: top;">Description</td><td style="padding: 10px 0;">${request.Description || 'No description'}</td></tr>
            </table>
            <div style="margin-top: 25px; text-align: center;">
                <a href="${approveUrl}" style="display: inline-block; padding: 14px 35px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 5px;">✅ Approve</a>
                <a href="${rejectUrl}" style="display: inline-block; padding: 14px 35px; background: #dc3545; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 5px;">❌ Reject</a>
            </div>
            <p style="margin-top: 25px; color: #999; font-size: 12px; text-align: center;">
                Click the button above to review and take action on this request.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        return this.sendEmailWithAppToken({
            to: approverEmail,
            subject,
            body
        });
    }
}

// Export singleton instance
module.exports = new EmailService();
