/**
 * Email Modal Component
 * Reusable Outlook-style email form modal for sending inspection reports
 * Usage: Include this script and call EmailModal.show(options)
 */

const EmailModal = (function() {
    let modalElement = null;
    let currentOptions = null;
    let ccRecipients = [];

    /**
     * Initialize the modal HTML structure
     */
    function createModalHTML() {
        const modalHTML = `
            <div id="email-modal-overlay" class="email-modal-overlay" style="display: none;">
                <div class="email-modal">
                    <div class="email-modal-header">
                        <div class="email-modal-title">
                            <span class="email-icon">📧</span>
                            <span id="email-modal-title-text">Send Report via Email</span>
                        </div>
                        <button class="email-modal-close" onclick="EmailModal.hide()">&times;</button>
                    </div>
                    <div class="email-modal-body">
                        <div class="email-field">
                            <label>From:</label>
                            <div class="email-field-value">
                                <input type="text" id="email-from" readonly class="email-input readonly">
                            </div>
                        </div>
                        <div class="email-field">
                            <label>To:</label>
                            <div class="email-field-value to-field">
                                <div id="to-tags" class="to-tags"></div>
                                <div class="to-dropdown-container">
                                    <input type="email" id="to-search" class="email-input" placeholder="Type email or search users... (press Enter to add)">
                                    <div id="to-dropdown" class="to-dropdown" style="display: none;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="email-field">
                            <label>CC:</label>
                            <div class="email-field-value cc-field">
                                <div id="cc-tags" class="cc-tags"></div>
                                <div class="cc-dropdown-container">
                                    <input type="email" id="cc-search" class="email-input cc-search" placeholder="Type email or search users... (press Enter to add)">
                                    <div id="cc-dropdown" class="cc-dropdown" style="display: none;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="email-field">
                            <label>Subject:</label>
                            <div class="email-field-value">
                                <input type="text" id="email-subject" readonly class="email-input readonly">
                            </div>
                        </div>
                        <div class="email-field email-body-field">
                            <label>Preview:</label>
                            <div class="email-body-preview">
                                <iframe id="email-body-preview" class="email-preview-iframe"></iframe>
                            </div>
                        </div>
                    </div>
                    <div class="email-modal-footer">
                        <div class="email-modal-status" id="email-modal-status"></div>
                        <div class="email-modal-actions">
                            <button class="email-btn email-btn-cancel" onclick="EmailModal.hide()">Cancel</button>
                            <button class="email-btn email-btn-send" id="email-send-btn" onclick="EmailModal.send()">
                                <span class="send-icon">📤</span> Send Email
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styles = `
            <style id="email-modal-styles">
                .email-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(4px);
                }
                .email-modal {
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 700px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: modalSlideIn 0.3s ease-out;
                }
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: translateY(-30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .email-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 18px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 12px 12px 0 0;
                }
                .email-modal-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 18px;
                    font-weight: 600;
                }
                .email-icon {
                    font-size: 24px;
                }
                .email-modal-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    font-size: 24px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                .email-modal-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                .email-modal-body {
                    padding: 20px 24px;
                    overflow-y: auto;
                    flex: 1;
                }
                .email-field {
                    display: flex;
                    margin-bottom: 14px;
                    align-items: flex-start;
                }
                .email-field label {
                    width: 70px;
                    font-weight: 600;
                    color: #555;
                    padding-top: 10px;
                    flex-shrink: 0;
                }
                .email-field-value {
                    flex: 1;
                }
                .email-input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    font-family: inherit;
                    box-sizing: border-box;
                }
                .email-input.readonly {
                    background: #f8f9fa;
                    color: #555;
                }
                .email-input:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                .cc-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .cc-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-height: 10px;
                }
                .cc-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 13px;
                }
                .cc-tag-role {
                    opacity: 0.8;
                    font-size: 11px;
                }
                .cc-tag-remove {
                    background: rgba(255, 255, 255, 0.3);
                    border: none;
                    color: white;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    line-height: 1;
                    padding: 0;
                }
                .cc-tag-remove:hover {
                    background: rgba(255, 255, 255, 0.5);
                }
                .to-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .to-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-height: 10px;
                }
                .to-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 13px;
                }
                .to-tag-remove {
                    background: rgba(255, 255, 255, 0.3);
                    border: none;
                    color: white;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    line-height: 1;
                    padding: 0;
                }
                .to-tag-remove:hover {
                    background: rgba(255, 255, 255, 0.5);
                }
                .to-dropdown-container {
                    position: relative;
                }
                .to-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 100;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                .to-dropdown-item {
                    padding: 10px 14px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    border-bottom: 1px solid #eee;
                }
                .to-dropdown-item:last-child {
                    border-bottom: none;
                }
                .to-dropdown-item:hover {
                    background: #f0f4ff;
                }
                .to-dropdown-name {
                    font-weight: 500;
                    color: #333;
                }
                .to-dropdown-email {
                    font-size: 12px;
                    color: #666;
                }
                .cc-dropdown-container {
                    position: relative;
                }
                .cc-search {
                    background: white;
                }
                .cc-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 100;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                .cc-dropdown-item {
                    padding: 10px 14px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #eee;
                }
                .cc-dropdown-item:last-child {
                    border-bottom: none;
                }
                .cc-dropdown-item:hover {
                    background: #f0f4ff;
                }
                .cc-dropdown-item.selected {
                    background: #e8f0fe;
                }
                .cc-dropdown-name {
                    font-weight: 500;
                    color: #333;
                }
                .cc-dropdown-role {
                    font-size: 12px;
                    color: #888;
                }
                .cc-dropdown-email {
                    font-size: 12px;
                    color: #666;
                }
                .email-body-field {
                    flex-direction: column;
                    align-items: stretch;
                }
                .email-body-field label {
                    width: auto;
                    margin-bottom: 8px;
                    padding-top: 0;
                }
                .email-body-preview {
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    overflow: hidden;
                    background: #f8f9fa;
                }
                .email-preview-iframe {
                    width: 100%;
                    height: 250px;
                    border: none;
                }
                .email-modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    background: #f8f9fa;
                    border-top: 1px solid #eee;
                    border-radius: 0 0 12px 12px;
                }
                .email-modal-status {
                    font-size: 14px;
                    color: #666;
                }
                .email-modal-status.error {
                    color: #dc3545;
                }
                .email-modal-status.success {
                    color: #28a745;
                }
                .email-modal-actions {
                    display: flex;
                    gap: 10px;
                }
                .email-btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s;
                }
                .email-btn-cancel {
                    background: #e9ecef;
                    color: #495057;
                }
                .email-btn-cancel:hover {
                    background: #dee2e6;
                }
                .email-btn-send {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .email-btn-send:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .email-btn-send:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                .email-btn-send .send-icon {
                    font-size: 16px;
                }
                .email-loading {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        // Insert styles if not already present
        if (!document.getElementById('email-modal-styles')) {
            document.head.insertAdjacentHTML('beforeend', styles);
        }

        // Insert modal HTML
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalElement = document.getElementById('email-modal-overlay');

        // Set up event listeners
        setupEventListeners();
    }
    
    // To recipients array
    let toRecipients = [];

    /**
     * Set up event listeners for To and CC search
     */
    function setupEventListeners() {
        const toSearch = document.getElementById('to-search');
        const toDropdown = document.getElementById('to-dropdown');
        const ccSearch = document.getElementById('cc-search');
        const ccDropdown = document.getElementById('cc-dropdown');
        
        // To field search with debounce
        let toSearchTimeout;
        toSearch.addEventListener('input', function() {
            clearTimeout(toSearchTimeout);
            const value = this.value.trim();
            if (value.length >= 2) {
                toSearchTimeout = setTimeout(() => searchUsersForTo(value), 300);
            } else {
                toDropdown.style.display = 'none';
            }
        });
        
        // To field - press Enter to add email directly
        toSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const email = this.value.trim();
                if (isValidEmail(email)) {
                    addToRecipient(email, email);
                    this.value = '';
                    toDropdown.style.display = 'none';
                }
            }
        });
        
        // CC field - press Enter to add email directly
        ccSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const email = this.value.trim();
                if (isValidEmail(email)) {
                    addCC(email, email, '');
                    this.value = '';
                    ccDropdown.style.display = 'none';
                }
            }
        });

        ccSearch.addEventListener('focus', function() {
            showCCDropdown();
        });

        ccSearch.addEventListener('input', function() {
            filterCCDropdown(this.value);
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.cc-dropdown-container')) {
                ccDropdown.style.display = 'none';
            }
            if (!e.target.closest('.to-dropdown-container') && !e.target.closest('.to-tags')) {
                toDropdown.style.display = 'none';
            }
        });

        // Close modal on escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modalElement && modalElement.style.display !== 'none') {
                hide();
            }
        });
    }
    
    /**
     * Validate email format
     */
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    /**
     * Search users for To field
     */
    async function searchUsersForTo(query) {
        const dropdown = document.getElementById('to-dropdown');
        
        try {
            const response = await fetch('/api/users/search?q=' + encodeURIComponent(query));
            const data = await response.json();
            
            let html = '';
            
            // Show option to add as manual email if it looks like an email
            if (isValidEmail(query)) {
                html += `
                    <div class="to-dropdown-item" onclick="EmailModal.addToRecipient('${query}', '${query}')" style="background: #e8f5e9;">
                        <span class="to-dropdown-name">➕ Add "${query}"</span>
                        <span class="to-dropdown-email">Press Enter or click to add</span>
                    </div>
                `;
            }
            
            if (data.success && data.users && data.users.length > 0) {
                const filtered = data.users.filter(u => !toRecipients.find(r => r.email === u.email));
                html += filtered.map(user => `
                    <div class="to-dropdown-item" onclick="EmailModal.addToRecipient('${user.email}', '${user.name || user.email}')">
                        <span class="to-dropdown-name">${user.name || user.email}</span>
                        <span class="to-dropdown-email">${user.email}</span>
                    </div>
                `).join('');
            }
            
            if (!html) {
                html = '<div class="to-dropdown-item" style="color: #888; cursor: default;">No users found. Type a valid email and press Enter.</div>';
            }
            
            dropdown.innerHTML = html;
            dropdown.style.display = 'block';
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }
    
    /**
     * Add To recipient
     */
    function addToRecipient(email, name) {
        if (toRecipients.find(r => r.email === email)) return;
        
        toRecipients.push({ email, name });
        renderToTags();
        
        document.getElementById('to-search').value = '';
        document.getElementById('to-dropdown').style.display = 'none';
    }
    
    /**
     * Remove To recipient
     */
    function removeToRecipient(email) {
        toRecipients = toRecipients.filter(r => r.email !== email);
        renderToTags();
    }
    
    /**
     * Render To tags
     */
    function renderToTags() {
        const container = document.getElementById('to-tags');
        container.innerHTML = toRecipients.map(r => `
            <span class="to-tag">
                <span>${r.name || r.email}</span>
                <button class="to-tag-remove" onclick="EmailModal.removeToRecipient('${r.email}')">&times;</button>
            </span>
        `).join('');
    }
    
    /**
     * Search users API (legacy - keeping for compatibility)
     */
    async function searchUsers(query, targetField) {
        if (!query || query.length < 2) {
            document.getElementById(targetField + '-dropdown').style.display = 'none';
            return;
        }
        
        try {
            const response = await fetch('/api/users/search?q=' + encodeURIComponent(query));
            const data = await response.json();
            
            if (data.success && data.users) {
                showUserDropdown(data.users, targetField);
            }
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }
    
    /**
     * Show user dropdown for To field
     */
    function showUserDropdown(users, targetField) {
        const dropdown = document.getElementById(targetField + '-dropdown');
        
        if (users.length === 0) {
            dropdown.innerHTML = '<div class="to-dropdown-item" style="color: #999; cursor: default;">No users found</div>';
            dropdown.style.display = 'block';
            return;
        }
        
        dropdown.innerHTML = users.map(user => `
            <div class="to-dropdown-item" onclick="EmailModal.selectToRecipient('${user.email}', '${user.name || user.displayName || user.email}')">
                <span class="to-dropdown-name">${user.name || user.displayName || user.email}</span>
                <span class="to-dropdown-email">${user.email}</span>
            </div>
        `).join('');
        
        dropdown.style.display = 'block';
    }
    
    /**
     * Select To recipient
     */
    function selectToRecipient(email, name) {
        currentOptions.to = { email: email, name: name };
        
        const toRecipient = document.getElementById('to-recipient');
        const toSearch = document.getElementById('to-search');
        const toDropdown = document.getElementById('to-dropdown');
        
        toRecipient.innerHTML = `
            <span>${name} &lt;${email}&gt;</span>
            <button class="to-recipient-remove" onclick="EmailModal.clearToRecipient()">&times;</button>
        `;
        toRecipient.style.display = 'inline-flex';
        toSearch.style.display = 'none';
        toDropdown.style.display = 'none';
    }
    
    /**
     * Clear To recipient
     */
    function clearToRecipient() {
        currentOptions.to = null;
        
        const toRecipient = document.getElementById('to-recipient');
        const toSearch = document.getElementById('to-search');
        
        toRecipient.style.display = 'none';
        toRecipient.innerHTML = '';
        toSearch.style.display = 'block';
        toSearch.value = '';
        toSearch.focus();
    }

    /**
     * Show CC dropdown with suggestions
     */
    function showCCDropdown() {
        const dropdown = document.getElementById('cc-dropdown');
        if (!currentOptions) currentOptions = { ccSuggestions: [] };
        if (!currentOptions.ccSuggestions) currentOptions.ccSuggestions = [];

        filterCCDropdown('');
        dropdown.style.display = 'block';
    }

    /**
     * Filter CC dropdown based on search text - searches API if text entered
     */
    async function filterCCDropdown(searchText) {
        const dropdown = document.getElementById('cc-dropdown');
        if (!currentOptions) currentOptions = { ccSuggestions: [] };
        if (!currentOptions.ccSuggestions) currentOptions.ccSuggestions = [];
        
        // If searching, search the API
        if (searchText && searchText.length >= 2) {
            try {
                const response = await fetch('/api/users/search?q=' + encodeURIComponent(searchText));
                const data = await response.json();
                
                let html = '';
                
                // Show option to add as manual email if it looks like an email
                if (isValidEmail(searchText)) {
                    html += `
                        <div class="cc-dropdown-item" onclick="EmailModal.addCC('${searchText}', '${searchText}', '')" style="background: #e8f5e9;">
                            <div>
                                <div class="cc-dropdown-name">➕ Add "${searchText}"</div>
                                <div class="cc-dropdown-email">Press Enter or click to add</div>
                            </div>
                        </div>
                    `;
                }
                
                if (data.success && data.users) {
                    const filtered = data.users.filter(user => {
                        // Don't show already selected users
                        return !ccRecipients.find(r => r.email === user.email);
                    });
                    
                    if (filtered.length > 0) {
                        html += filtered.map(user => `
                            <div class="cc-dropdown-item" onclick="EmailModal.addCC('${user.email}', '${user.name || user.email}', '')">
                                <div>
                                    <div class="cc-dropdown-name">${user.name || user.email}</div>
                                    <div class="cc-dropdown-email">${user.email}</div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
                
                if (!html) {
                    html = '<div class="cc-dropdown-item" style="color: #888; cursor: default;">No users found. Type a valid email and press Enter.</div>';
                }
                
                dropdown.innerHTML = html;
                dropdown.style.display = 'block';
            } catch (error) {
                console.error('Error searching users for CC:', error);
            }
            return;
        }

        // Show suggestions when not searching
        const filtered = currentOptions.ccSuggestions.filter(user => {
            // Don't show already selected users
            if (ccRecipients.find(r => r.email === user.email)) return false;
            return true;
        });

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="cc-dropdown-item" style="color: #888; cursor: default;">Type to search users or enter email...</div>';
        } else {
            dropdown.innerHTML = '<div style="padding: 8px 14px; font-size: 12px; color: #888; background: #f8f9fa; border-bottom: 1px solid #eee;">Suggested (Brand Responsibles):</div>' + 
                filtered.map(user => `
                <div class="cc-dropdown-item" onclick="EmailModal.addCC('${user.email}', '${user.name}', '${user.role || ''}')">
                    <div>
                        <div class="cc-dropdown-name">${user.name}</div>
                        <div class="cc-dropdown-email">${user.email}</div>
                    </div>
                    <div class="cc-dropdown-role">${user.role || ''}</div>
                </div>
            `).join('');
        }
        
        dropdown.style.display = 'block';
    }

    /**
     * Add a CC recipient
     */
    function addCC(email, name, role) {
        if (ccRecipients.find(r => r.email === email)) return;

        ccRecipients.push({ email, name, role });
        renderCCTags();
        
        document.getElementById('cc-search').value = '';
        document.getElementById('cc-dropdown').style.display = 'none';
    }

    /**
     * Remove a CC recipient
     */
    function removeCC(email) {
        ccRecipients = ccRecipients.filter(r => r.email !== email);
        renderCCTags();
    }

    /**
     * Render CC tags
     */
    function renderCCTags() {
        const container = document.getElementById('cc-tags');
        container.innerHTML = ccRecipients.map(r => `
            <span class="cc-tag">
                <span>${r.name}</span>
                ${r.role ? `<span class="cc-tag-role">(${r.role})</span>` : ''}
                <button class="cc-tag-remove" onclick="EmailModal.removeCC('${r.email}')">&times;</button>
            </span>
        `).join('');
    }

    /**
     * Show the email modal
     * @param {Object} options
     * @param {Object} options.from - { email, name }
     * @param {Object} options.to - { email, name } - Initial To recipient (store manager)
     * @param {Array} options.ccSuggestions - [{ email, name, role }]
     * @param {Array} options.ccPreselected - [{ email, name, role }] - Pre-selected CC recipients
     * @param {string} options.subject - Email subject
     * @param {string} options.bodyHtml - HTML content for preview
     * @param {string} options.reportType - 'full' or 'action-plan'
     * @param {string} options.module - 'OE' or 'OHS'
     * @param {number} options.auditId - Audit ID for sending
     * @param {string} options.sendUrl - API endpoint for sending
     * @param {Function} options.onSent - Callback after successful send
     */
    function show(options) {
        if (!modalElement) {
            createModalHTML();
        }

        currentOptions = options;
        ccRecipients = [...(options.ccPreselected || [])];
        
        // Reset To recipients and pre-populate if store manager assigned
        toRecipients = [];
        if (options.to && options.to.email) {
            toRecipients.push({ email: options.to.email, name: options.to.name || options.to.email });
        }

        // Set title based on report type
        const titleText = document.getElementById('email-modal-title-text');
        if (options.module === 'OE') {
            titleText.textContent = options.reportType === 'full' ? 
                'Send OE Full Report' : 'Send OE Action Plan';
        } else {
            titleText.textContent = options.reportType === 'full' ? 
                'Send OHS Full Report' : 'Send OHS Action Plan';
        }

        // Populate fields
        document.getElementById('email-from').value = options.from ? 
            `${options.from.name} <${options.from.email}>` : '';
        
        // Handle To field - render tags (dynamic multi-select)
        renderToTags();
        document.getElementById('to-search').value = '';
        
        document.getElementById('email-subject').value = options.subject || '';

        // Render CC tags
        renderCCTags();

        // Set body preview
        const iframe = document.getElementById('email-body-preview');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        // Ensure UTF-8 encoding for emojis
        const bodyHtml = options.bodyHtml || '';
        const htmlWithCharset = bodyHtml.includes('<head>') 
            ? bodyHtml.replace('<head>', '<head><meta charset="UTF-8">')
            : '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' + bodyHtml + '</body></html>';
        iframeDoc.write(htmlWithCharset);
        iframeDoc.close();

        // Reset status
        document.getElementById('email-modal-status').textContent = '';
        document.getElementById('email-modal-status').className = 'email-modal-status';
        document.getElementById('email-send-btn').disabled = false;

        // Show modal
        modalElement.style.display = 'flex';
    }

    /**
     * Hide the modal
     */
    function hide() {
        if (modalElement) {
            modalElement.style.display = 'none';
        }
    }

    /**
     * Send the email
     */
    async function send() {
        if (!currentOptions || !currentOptions.sendUrl) {
            setStatus('Configuration error: No send URL', 'error');
            return;
        }
        
        // Validate To recipients - need at least one
        if (!toRecipients || toRecipients.length === 0) {
            setStatus('❌ Please add at least one recipient (To field)', 'error');
            return;
        }

        const sendBtn = document.getElementById('email-send-btn');
        const originalText = sendBtn.innerHTML;
        
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="email-loading"></span> Sending...';
        setStatus('Sending email...', '');

        try {
            const response = await fetch(currentOptions.sendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reportType: currentOptions.reportType,
                    to: toRecipients,
                    cc: ccRecipients
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setStatus('✅ Email sent successfully!', 'success');
                
                if (currentOptions.onSent) {
                    currentOptions.onSent(result);
                }

                // Close modal after a short delay
                setTimeout(() => {
                    hide();
                }, 1500);
            } else {
                throw new Error(result.error || result.message || 'Failed to send email');
            }
        } catch (error) {
            console.error('[EmailModal] Error sending email:', error);
            setStatus(`❌ ${error.message}`, 'error');
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    }

    /**
     * Set status message
     */
    function setStatus(message, type) {
        const statusEl = document.getElementById('email-modal-status');
        statusEl.textContent = message;
        statusEl.className = 'email-modal-status' + (type ? ` ${type}` : '');
    }

    // Public API
    return {
        show,
        hide,
        send,
        addCC,
        removeCC,
        addToRecipient,
        removeToRecipient,
        selectToRecipient,
        clearToRecipient
    };
})();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailModal;
}
