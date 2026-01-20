/**
 * SharePoint Users Service
 * Fetches users from SharePoint Site using DELEGATED permissions
 * 
 * Uses the logged-in user's access token (Sites.Read.All delegated permission)
 * This works because the admin clicking "Sync" has a valid Azure token
 */

const { ConfidentialClientApplication } = require('@azure/msal-node');

// Try to load config from different locations
let config;
try {
    config = require('../../config/default');
} catch (e) {
    try {
        config = require('../../../config/default');
    } catch (e2) {
        // Fallback to environment-based config
        config = {
            azure: {
                clientId: process.env.AZURE_CLIENT_ID,
                clientSecret: process.env.AZURE_CLIENT_SECRET,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
            }
        };
    }
}

class SharePointUsersService {
    constructor(userAccessToken = null) {
        console.log('[SHAREPOINT] Initializing SharePoint Users Service...');
        
        // Store user's access token for delegated calls
        this.userAccessToken = userAccessToken;
        
        // SharePoint site URL - configure via environment variable
        this.siteUrl = process.env.SHAREPOINT_SITE_URL || 'https://spinneysleb.sharepoint.com/operations';
        this.tenantName = this.extractTenantName(this.siteUrl);
        
        console.log('[SHAREPOINT] Site URL:', this.siteUrl);
        console.log('[SHAREPOINT] Tenant:', this.tenantName);
        console.log('[SHAREPOINT] User Token:', userAccessToken ? '✓ Provided (delegated mode)' : '✗ None (will try app mode)');
        
        // MSAL client for OBO flow
        this.msalClient = new ConfidentialClientApplication({
            auth: {
                clientId: config.azure.clientId,
                clientSecret: config.azure.clientSecret,
                authority: config.azure.authority
            }
        });
    }
    
    extractTenantName(siteUrl) {
        // Extract tenant name from SharePoint URL
        // e.g., https://spinneysleb.sharepoint.com -> spinneysleb
        const match = siteUrl.match(/https:\/\/([^.]+)\.sharepoint\.com/);
        return match ? match[1] : 'unknown';
    }

    /**
     * Get a valid Graph API token using Client Credentials or OBO flow
     */
    async getGraphToken() {
        // First try client credentials (app-only) for server-to-server calls
        if (!this.userAccessToken) {
            console.log('[SHAREPOINT] No user token, using client credentials flow...');
            try {
                const response = await this.msalClient.acquireTokenByClientCredential({
                    scopes: ['https://graph.microsoft.com/.default']
                });
                console.log('[SHAREPOINT] Client credentials token acquired successfully');
                return response.accessToken;
            } catch (err) {
                console.error('[SHAREPOINT] Client credentials failed:', err.message);
                throw new Error('Failed to acquire token via client credentials: ' + err.message);
            }
        }
        
        console.log('[SHAREPOINT] Using On-Behalf-Of flow to get Graph token...');
        
        try {
            // OBO flow - exchange user token for Graph token with Sites.Read.All
            const oboRequest = {
                oboAssertion: this.userAccessToken,
                scopes: ['https://graph.microsoft.com/Sites.Read.All']
            };
            
            const response = await this.msalClient.acquireTokenOnBehalfOf(oboRequest);
            console.log('[SHAREPOINT] OBO token acquired successfully');
            return response.accessToken;
        } catch (oboError) {
            console.error('[SHAREPOINT] OBO failed:', oboError.message);
            
            // If OBO fails, the user's token might already work for Graph
            // This can happen if the original token was obtained with Graph scopes
            console.log('[SHAREPOINT] Trying user token directly...');
            return this.userAccessToken;
        }
    }

    async getUsers() {
        try {
            // Use User.ReadBasic.All to list all Azure AD users
            return await this.getAllAzureADUsers();
        } catch (error) {
            console.error('[SHAREPOINT] All methods failed:', error.message);
            return [];
        }
    }

    /**
     * Get all Azure AD users using User.ReadBasic.All permission
     * This works with the delegated permission we have
     */
    async getAllAzureADUsers() {
        const accessToken = await this.getGraphToken();
        
        if (!accessToken) {
            throw new Error('No access token available');
        }
        
        console.log('[SHAREPOINT] Fetching all Azure AD users...');
        
        let allUsers = [];
        let nextLink = 'https://graph.microsoft.com/v1.0/users?$top=100&$select=id,displayName,mail,userPrincipalName,jobTitle,department';
        
        while (nextLink) {
            console.log('[SHAREPOINT] Fetching batch of users...');
            
            const response = await fetch(nextLink, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SHAREPOINT] Failed to get users:', response.status, errorText);
                throw new Error(`Failed to get users: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.value) {
                // Filter to only users with email addresses
                const users = data.value
                    .filter(u => u.mail || u.userPrincipalName)
                    .map(u => ({
                        id: u.id,
                        displayName: u.displayName || (u.mail || u.userPrincipalName).split('@')[0],
                        mail: u.mail || u.userPrincipalName,
                        userPrincipalName: u.userPrincipalName || u.mail,
                        jobTitle: u.jobTitle || null,
                        department: u.department || null
                    }));
                
                allUsers = allUsers.concat(users);
            }
            
            nextLink = data['@odata.nextLink'] || null;
            
            // Safety limit to prevent infinite loops
            if (allUsers.length > 5000) {
                console.log('[SHAREPOINT] Reached 5000 user limit, stopping pagination');
                break;
            }
        }
        
        console.log(`[SHAREPOINT] Fetched ${allUsers.length} users from Azure AD`);
        return allUsers;
    }

    async getSiteUsersViaGraph() {
        try {
            const accessToken = await this.getGraphToken();
            
            if (!accessToken) {
                throw new Error('No access token available');
            }
            
            // Extract site path from URL
            // e.g., https://spinneysleb.sharepoint.com/operations -> operations
            // e.g., https://spinneysleb.sharepoint.com/sites/FSMonitoring -> sites/FSMonitoring
            const sitePathMatch = this.siteUrl.match(/sharepoint\.com\/(.+)/);
            const sitePath = sitePathMatch ? sitePathMatch[1] : '';
            
            // Get site ID first
            const siteIdUrl = `https://graph.microsoft.com/v1.0/sites/${this.tenantName}.sharepoint.com:/${sitePath}`;
            console.log('[SHAREPOINT] Getting site ID from:', siteIdUrl);
            
            const siteResponse = await fetch(siteIdUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!siteResponse.ok) {
                const errorText = await siteResponse.text();
                console.error('[SHAREPOINT] Failed to get site:', siteResponse.status, errorText);
                
                // If 401/403, it's a permission issue
                if (siteResponse.status === 401 || siteResponse.status === 403) {
                    console.log('[SHAREPOINT] Permission denied. User may not have access to this SharePoint site.');
                    throw new Error('Permission denied accessing SharePoint site');
                }
                
                throw new Error(`Failed to get site: ${siteResponse.status}`);
            }
            
            const siteData = await siteResponse.json();
            console.log('[SHAREPOINT] Site ID:', siteData.id);
            console.log('[SHAREPOINT] Site Name:', siteData.displayName);
            
            // Get site permissions/members
            const permissionsUrl = `https://graph.microsoft.com/v1.0/sites/${siteData.id}/permissions`;
            console.log('[SHAREPOINT] Getting site permissions from:', permissionsUrl);
            
            const permResponse = await fetch(permissionsUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            const users = [];
            
            if (permResponse.ok) {
                const permData = await permResponse.json();
                
                for (const perm of permData.value || []) {
                    if (perm.grantedToIdentities) {
                        for (const identity of perm.grantedToIdentities) {
                            if (identity.user && identity.user.email) {
                                users.push({
                                    id: identity.user.id || identity.user.email,
                                    displayName: identity.user.displayName || identity.user.email.split('@')[0],
                                    mail: identity.user.email,
                                    userPrincipalName: identity.user.email
                                });
                            }
                        }
                    }
                    
                    // Also check grantedTo (singular)
                    if (perm.grantedTo && perm.grantedTo.user && perm.grantedTo.user.email) {
                        users.push({
                            id: perm.grantedTo.user.id || perm.grantedTo.user.email,
                            displayName: perm.grantedTo.user.displayName || perm.grantedTo.user.email.split('@')[0],
                            mail: perm.grantedTo.user.email,
                            userPrincipalName: perm.grantedTo.user.email
                        });
                    }
                }
            }
            
            // Also try to get users from associated M365 group (if site has one)
            const groupUsers = await this.getSiteAssociatedGroupMembers(siteData.id, accessToken);
            users.push(...groupUsers);
            
            // Deduplicate by email
            const uniqueUsers = Array.from(
                new Map(users.map(u => [u.mail.toLowerCase(), u])).values()
            );
            
            console.log(`[SHAREPOINT] Fetched ${uniqueUsers.length} total unique users`);
            return uniqueUsers;
            
        } catch (error) {
            console.error('[SHAREPOINT] getSiteUsersViaGraph error:', error.message);
            throw error;
        }
    }
    
    async getSiteAssociatedGroupMembers(siteId, accessToken) {
        try {
            // Try to get the site's associated Microsoft 365 group
            const groupUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}?$select=id,displayName`;
            
            // Some sites have an associated owner group we can query
            // Try getting drives/lists to find associated group
            const drivesUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
            console.log('[SHAREPOINT] Getting site drives to find group...');
            
            const drivesResponse = await fetch(drivesUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (!drivesResponse.ok) {
                return [];
            }
            
            // If we can access drives, try getting the site's group members
            // by checking the environment variable for group name
            const groupName = process.env.SHAREPOINT_GROUP_NAME || 'FS Monitoring Members';
            
            console.log('[SHAREPOINT] Searching for group:', groupName);
            
            const groupSearchUrl = `https://graph.microsoft.com/v1.0/groups?$filter=displayName eq '${encodeURIComponent(groupName)}'&$select=id,displayName`;
            
            const groupResponse = await fetch(groupSearchUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (!groupResponse.ok) {
                console.log('[SHAREPOINT] Group search failed');
                return [];
            }
            
            const groupData = await groupResponse.json();
            
            if (!groupData.value || groupData.value.length === 0) {
                console.log('[SHAREPOINT] Group not found:', groupName);
                return [];
            }
            
            const groupId = groupData.value[0].id;
            console.log('[SHAREPOINT] Found group ID:', groupId);
            
            // Get group members
            let allMembers = [];
            let nextLink = `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=id,displayName,mail,userPrincipalName&$top=100`;
            
            while (nextLink) {
                const membersResponse = await fetch(nextLink, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (!membersResponse.ok) {
                    break;
                }
                
                const membersData = await membersResponse.json();
                
                if (membersData.value) {
                    const users = membersData.value
                        .filter(m => m['@odata.type'] === '#microsoft.graph.user' && m.mail)
                        .map(m => ({
                            id: m.id,
                            displayName: m.displayName || m.mail.split('@')[0],
                            mail: m.mail,
                            userPrincipalName: m.userPrincipalName || m.mail
                        }));
                    
                    allMembers = allMembers.concat(users);
                }
                
                nextLink = membersData['@odata.nextLink'] || null;
            }
            
            console.log(`[SHAREPOINT] Found ${allMembers.length} users from group`);
            return allMembers;
            
        } catch (error) {
            console.error('[SHAREPOINT] getSiteAssociatedGroupMembers error:', error.message);
            return [];
        }
    }
}

module.exports = SharePointUsersService;
