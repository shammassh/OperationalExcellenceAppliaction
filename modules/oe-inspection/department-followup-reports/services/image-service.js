/**
 * Image Service
 * Handles fetching and processing corrective images from CImages library
 */

class ImageService {
    constructor(connector) {
        this.connector = connector;
        this.cImagesGuid = 'abb703bc-835c-4671-bad0-2f89956e3b74';
    }

    /**
     * Get corrective images for follow-up items
     * Filters by ItemKey and Iscorrective = true
     * 
     * @param {Array} followupItems - Array of follow-up items with itemKey
     * @returns {Promise<Object>} - Map of itemKey to corrective images
     */
    async getCorrectiveImagesForItems(followupItems) {
        try {
            console.log(`\n📷 Fetching corrective images for ${followupItems.length} follow-up items...`);

            const itemKeys = followupItems.map(item => item.itemKey).filter(Boolean);
            
            if (itemKeys.length === 0) {
                console.log('⚠️ No item keys found, skipping image fetch');
                return {};
            }

            // Fetch images from CImages library filtered by Iscorrective = true
            const token = await this.connector.getAccessToken();
            const siteUrl = this.connector.config?.siteUrl || process.env.SHAREPOINT_SITE_URL;
            
            // Build filter for all item keys
            const filters = itemKeys.map(key => `substringof('${key}', ImageID)`).join(' or ');
            const url = `${siteUrl}/_api/Web/Lists(guid'${this.cImagesGuid}')/Items?$select=Id,ImageID,Iscorrective,FileLeafRef,FileRef,File_x0020_Type,Created&$filter=(${filters}) and Iscorrective eq 1&$top=5000`;

            console.log(`🔍 Fetching corrective images with filter...`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json;odata=verbose'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch corrective images: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const images = data.d?.results || [];

            console.log(`✅ Found ${images.length} corrective images`);

            // Group images by ItemKey (extracted from ImageID)
            const imagesByItemKey = {};
            
            for (const image of images) {
                const imageID = image.ImageID || '';
                const itemKey = this.extractItemKeyFromImageID(imageID);
                
                if (!itemKey) continue;

                if (!imagesByItemKey[itemKey]) {
                    imagesByItemKey[itemKey] = [];
                }

                // Build REST API URL for downloading
                const downloadUrl = `${siteUrl}/_api/Web/GetFileByServerRelativeUrl('${encodeURIComponent(image.FileRef)}')/$value`;
                
                imagesByItemKey[itemKey].push({
                    id: image.Id,
                    imageID: imageID,
                    fileName: image.FileLeafRef,
                    fileRef: image.FileRef,
                    fileType: image.File_x0020_Type,
                    downloadUrl: downloadUrl,
                    created: image.Created
                });
            }

            console.log(`📷 Grouped into ${Object.keys(imagesByItemKey).length} item keys with corrective images`);

            return imagesByItemKey;

        } catch (error) {
            console.error('❌ Error fetching corrective images:', error.message);
            return {};
        }
    }

    /**
     * Download corrective images and convert to base64
     * @param {Object} imagesByItemKey - Map of itemKey to image metadata
     * @returns {Promise<Object>} - Map of itemKey to base64 images
     */
    async downloadAndConvertImages(imagesByItemKey) {
        try {
            console.log(`\n📥 Downloading and converting corrective images to base64...`);

            const token = await this.connector.getAccessToken();
            const base64ImagesByKey = {};

            for (const [itemKey, images] of Object.entries(imagesByItemKey)) {
                base64ImagesByKey[itemKey] = [];

                for (const image of images) {
                    try {
                        console.log(`📥 Downloading: ${image.fileName}`);

                        const response = await fetch(image.downloadUrl, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (!response.ok) {
                            console.warn(`⚠️ Failed to download ${image.fileName}: ${response.status}`);
                            continue;
                        }

                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const base64 = buffer.toString('base64');
                        
                        // Determine MIME type
                        const mimeType = this.getMimeType(image.fileType || image.fileName);
                        const dataUrl = `data:${mimeType};base64,${base64}`;

                        const sizeKB = Math.round(buffer.length / 1024);
                        console.log(`✅ Converted ${image.fileName} to base64 (${sizeKB}KB)`);

                        base64ImagesByKey[itemKey].push({
                            fileName: image.fileName,
                            dataUrl: dataUrl,
                            size: sizeKB
                        });

                    } catch (imgError) {
                        console.warn(`⚠️ Error processing ${image.fileName}:`, imgError.message);
                    }
                }
            }

            const totalImages = Object.values(base64ImagesByKey).reduce((sum, imgs) => sum + imgs.length, 0);
            console.log(`✅ Successfully converted ${totalImages} corrective images to base64`);

            return base64ImagesByKey;

        } catch (error) {
            console.error('❌ Error downloading corrective images:', error.message);
            return {};
        }
    }

    /**
     * Extract ItemKey from ImageID
     * ImageID format might be: "GMRL-FSACR-0001-87" or similar
     * @param {string} imageID - ImageID from CImages
     * @returns {string} - Extracted ItemKey
     */
    extractItemKeyFromImageID(imageID) {
        if (!imageID) return '';
        
        // ImageID typically contains the ItemKey
        // Format: DOCUMENT_NUMBER-SEQUENTIAL (e.g., "GMRL-FSACR-0001-87")
        // Return as-is since ItemKey in Checklist FollowUps matches this format
        return imageID.trim();
    }

    /**
     * Get MIME type from file extension
     * @param {string} fileNameOrType - File name or extension
     * @returns {string} - MIME type
     */
    getMimeType(fileNameOrType) {
        const ext = fileNameOrType.toLowerCase().split('.').pop();
        
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        };

        return mimeTypes[ext] || 'image/jpeg';
    }

    /**
     * Attach corrective images to follow-up items
     * @param {Array} followupItems - Follow-up items
     * @param {Object} base64ImagesByKey - Map of itemKey to base64 images
     * @returns {Array} - Follow-up items with images attached
     */
    attachImagesToItems(followupItems, base64ImagesByKey) {
        console.log(`\n🔗 Attaching corrective images to follow-up items...`);

        for (const item of followupItems) {
            const itemKey = item.itemKey;
            
            if (itemKey && base64ImagesByKey[itemKey]) {
                item.correctiveImages = base64ImagesByKey[itemKey];
                console.log(`✅ Attached ${item.correctiveImages.length} images to ${itemKey}`);
            } else {
                item.correctiveImages = [];
            }
        }

        return followupItems;
    }
}

module.exports = ImageService;
