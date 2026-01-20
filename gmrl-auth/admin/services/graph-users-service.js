/**
 * Graph Users Service
 * Fetches users from Microsoft Graph API
 */

const { ConfidentialClientApplication } = require('@azure/msal-node');
const config = require('../../config/default');

class GraphUsersService {
    constructor() {
        console.log('[GRAPH] Initializing Graph Users Service...');
        console.log('[GRAPH] Client ID:', config.azure.clientId ? '✓ Set' : '✗ Missing');
        console.log('[GRAPH] Client Secret:', config.azure.clientSecret ? '✓ Set' : '✗ Missing');
        console.log('[GRAPH] Authority:', config.azure.authority);
        
        this.msalClient = new ConfidentialClientApplication({
            auth: {
                clientId: config.azure.clientId,
                clientSecret: config.azure.clientSecret,
                authority: config.azure.authority
            }
        });
    }

    async getUsers() {
        return this.getAllUsers();
    }

    async getAllUsers() {
        try {
            console.log('[GRAPH] Acquiring token for Graph API...');
            const tokenResponse = await this.msalClient.acquireTokenByClientCredential({
                scopes: ['https://graph.microsoft.com/.default']
            });

            if (!tokenResponse || !tokenResponse.accessToken) {
                console.error('[GRAPH] Failed to acquire access token');
                throw new Error('Failed to acquire access token');
            }
            console.log('[GRAPH] Token acquired successfully');

            // Get all users with pagination
            let allUsers = [];
            let nextLink = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=100';

            while (nextLink) {
                console.log('[GRAPH] Fetching users from:', nextLink.substring(0, 60) + '...');
                const response = await fetch(nextLink, {
                    headers: {
                        'Authorization': `Bearer ${tokenResponse.accessToken}`
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[GRAPH] API Error:', response.status, errorText);
                    throw new Error(`Graph API returned ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                
                if (data.value) {
                    console.log('[GRAPH] Received', data.value.length, 'users in this batch');
                    allUsers = allUsers.concat(data.value);
                }

                nextLink = data['@odata.nextLink'] || null;
            }

            console.log(`[GRAPH] Fetched ${allUsers.length} total users from Azure AD`);
            return allUsers;
        } catch (error) {
            console.error('[GRAPH] Error fetching users:', error.message);
            console.error('[GRAPH] Full error:', error);
            throw error;
        }
    }
}

module.exports = GraphUsersService;
