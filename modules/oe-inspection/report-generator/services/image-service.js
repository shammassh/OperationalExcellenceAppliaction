/**
 * Image Service
 * Handles image processing and base64 conversion
 */

class ImageService {
    /**
     * Process pictures for a response - already in base64 from SQL
     * @param {Array} pictures - Pictures array with dataUrl
     * @param {string} type - Filter by picture type (optional)
     * @returns {Array} - Processed pictures
     */
    filterPictures(pictures, type = null) {
        if (!pictures || !Array.isArray(pictures)) {
            return [];
        }

        if (type) {
            return pictures.filter(p => p.pictureType === type);
        }

        return pictures;
    }

    /**
     * Get issue pictures (Non-Corrective)
     * @param {Array} pictures - All pictures for a response
     * @returns {Array} - Issue pictures
     */
    getIssuePictures(pictures) {
        return this.filterPictures(pictures, 'issue');
    }

    /**
     * Get corrective pictures
     * @param {Array} pictures - All pictures for a response
     * @returns {Array} - Corrective pictures
     */
    getCorrectivePictures(pictures) {
        return this.filterPictures(pictures, 'corrective');
    }

    /**
     * Generate HTML for pictures
     * @param {Array} pictures - Pictures array with dataUrl
     * @param {Object} options - Display options
     * @returns {string} - HTML string
     */
    generatePictureHtml(pictures, options = {}) {
        if (!pictures || pictures.length === 0) {
            return '';
        }

        const {
            maxWidth = 150,
            maxHeight = 100,
            showLabel = false,
            className = 'audit-picture'
        } = options;

        const html = pictures.map(pic => {
            const label = showLabel ? `<div class="picture-label">${pic.pictureType || 'Image'}</div>` : '';
            return `
                <div class="picture-container ${className}">
                    <img src="${pic.dataUrl}" 
                         alt="${pic.fileName || 'Audit Image'}" 
                         style="max-width: ${maxWidth}px; max-height: ${maxHeight}px; cursor: pointer;"
                         onclick="openImageModal(this.src)"
                         loading="lazy">
                    ${label}
                </div>
            `;
        }).join('');

        return `<div class="pictures-wrapper">${html}</div>`;
    }

    /**
     * Generate HTML for before/after comparison
     * @param {Array} pictures - All pictures
     * @returns {string} - HTML string
     */
    generateBeforeAfterHtml(pictures) {
        if (!pictures || pictures.length === 0) {
            return '<span class="no-pictures">-</span>';
        }

        const issuePics = this.getIssuePictures(pictures);
        const correctivePics = this.getCorrectivePictures(pictures);

        let html = '';

        if (issuePics.length > 0) {
            html += '<div class="before-pictures"><strong>Issue:</strong>';
            html += this.generatePictureHtml(issuePics, { maxWidth: 120, maxHeight: 80 });
            html += '</div>';
        }

        if (correctivePics.length > 0) {
            html += '<div class="after-pictures"><strong>Corrective:</strong>';
            html += this.generatePictureHtml(correctivePics, { maxWidth: 120, maxHeight: 80 });
            html += '</div>';
        }

        if (html === '') {
            // Show all pictures if no type specified
            html = this.generatePictureHtml(pictures, { maxWidth: 120, maxHeight: 80 });
        }

        return html || '<span class="no-pictures">-</span>';
    }

    /**
     * Optimize image for display (resize if too large)
     * Note: For future enhancement with canvas resizing
     * @param {string} dataUrl - Base64 data URL
     * @param {number} maxSize - Maximum dimension
     * @returns {string} - Optimized data URL
     */
    optimizeImage(dataUrl, maxSize = 800) {
        // For now, return as-is since images are stored in SQL
        // Future: Implement canvas-based resizing for large images
        return dataUrl;
    }

    /**
     * Get image thumbnail (smaller version)
     * @param {string} dataUrl - Base64 data URL
     * @returns {string} - Thumbnail data URL
     */
    getThumbnail(dataUrl) {
        // For now, return as-is
        // Future: Generate smaller thumbnails for gallery view
        return dataUrl;
    }

    /**
     * Validate image data URL
     * @param {string} dataUrl - Data URL to validate
     * @returns {boolean} - Is valid
     */
    isValidDataUrl(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            return false;
        }

        return dataUrl.startsWith('data:image/');
    }

    /**
     * Get image dimensions from data URL
     * Note: This is a placeholder - actual implementation would require canvas
     * @param {string} dataUrl - Data URL
     * @returns {Object} - { width, height }
     */
    getImageDimensions(dataUrl) {
        // Placeholder - would need browser canvas or sharp library
        return { width: 0, height: 0 };
    }
}

module.exports = ImageService;
