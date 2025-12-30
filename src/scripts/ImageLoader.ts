import { BaseScene } from 'src/BaseScene';

/**
 * ImageLoader
 * 
 * Shared utility for loading images with robust error handling.
 * Handles:
 * - Base64 encoded images (synchronous)
 * - External URLs via proxy (to avoid CORS)
 * - Texture caching (don't reload if already loaded)
 * - Error handling with optional fallback textures
 * 
 * Usage:
 *   const textureKey = await ImageLoader.loadImage(scene, imageUrl, 'fallback-texture');
 *   const image = scene.add.image(x, y, textureKey);
 */
export class ImageLoader {
    
    /**
     * Load an image into the texture cache
     * Returns the texture key that can be used to create image GameObjects
     * 
     * @param scene - The Phaser scene
     * @param url - Image URL (can be base64, http://, or local path)
     * @param fallbackKey - Optional texture key to use if load fails
     * @returns Promise that resolves with the texture key
     * @throws Error if load fails and no fallback provided
     */
    static async loadImage(
        scene: BaseScene,
        url: string,
        fallbackKey?: string
    ): Promise<string> {
        
        const isBase64 = url.startsWith('data:image');
        
        // Generate texture key
        // For base64: Use timestamp (unique per load, base64 can't be cached)
        // For URLs: Use URL itself (enables caching across questions/rounds)
        let textureKey = isBase64 ? `texture-${Date.now()}` : url;
        
        // Truncate long keys (Phaser has 64 character limit for texture keys)
        if (textureKey.length > 64) {
            textureKey = textureKey.substring(0, 64);
        }
        
        // Check if already loaded (skip if already in cache)
        if (scene.textures.exists(textureKey)) {
            console.log('ImageLoader::loadImage - Already cached:', textureKey);
            return textureKey;
        }
        
        console.log('ImageLoader::loadImage - Loading:', isBase64 ? '[base64 data]' : url);
        
        try {
            if (isBase64) {
                // Base64 images are added synchronously (but we await for consistency)
                await this.loadBase64Image(scene, textureKey, url);
            } else {
                // External URLs load asynchronously (with proxy if needed)
                await this.loadExternalImage(scene, textureKey, url);
            }
            
            console.log('ImageLoader::loadImage - Success:', textureKey);
            return textureKey;
            
        } catch (error) {
            console.error('ImageLoader::loadImage - Failed:', url, error);
            
            // Use fallback if provided and it exists
            if (fallbackKey && scene.textures.exists(fallbackKey)) {
                console.warn('ImageLoader::loadImage - Using fallback:', fallbackKey);
                return fallbackKey;
            }
            
            // No fallback available - throw error
            throw new Error(`Failed to load image: ${isBase64 ? '[base64]' : url}`);
        }
    }
    
    /**
     * Load base64 encoded image
     * Base64 images are added synchronously but we wrap in Promise for consistent API
     */
    private static loadBase64Image(
        scene: BaseScene,
        textureKey: string,
        base64: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            
            // Listen for texture added event
            // Note: Using specific event 'addtexture-{key}' for this texture only
            const eventName = `addtexture-${textureKey}`;
            
            scene.textures.once(eventName, () => {
                console.log('ImageLoader::loadBase64Image - Texture added:', textureKey);
                resolve();
            });
            
            // Add base64 texture (triggers event above)
            try {
                scene.textures.addBase64(textureKey, base64);
                // Note: addBase64 is synchronous, but event fires asynchronously
            } catch (error) {
                // Clean up listener if error occurs
                scene.textures.off(eventName);
                reject(error);
            }
        });
    }
    
    /**
     * Load external image URL
     * Routes through proxy if external domain (to avoid CORS issues)
     */
    private static loadExternalImage(
        scene: BaseScene,
        textureKey: string,
        url: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            
            // Route external URLs through proxy (if not local/same domain)
            let imageURL = url;
            if (imageURL.startsWith('http') && !imageURL.includes('videoswipe')) {
                imageURL = `/proxy-image?url=${encodeURIComponent(imageURL)}`;
                console.log('ImageLoader::loadExternalImage - Using proxy for:', url);
            }
            
            // Setup load handlers as named functions (so they can be removed)
            const completeHandler = () => {
                console.log('ImageLoader::loadExternalImage - Complete:', textureKey);
                // Clean up error handler
                scene.load.off('loaderror', errorHandler);
                resolve();
            };
            
            const errorHandler = () => {
                console.error('ImageLoader::loadExternalImage - Error loading:', imageURL);
                // Clean up complete handler
                scene.load.off('complete', completeHandler);
                reject(new Error(`Failed to load: ${imageURL}`));
            };
            
            // Attach handlers (use 'once' so they auto-remove after firing)
            scene.load.once('complete', completeHandler);
            scene.load.once('loaderror', errorHandler);
            
            // Start load
            scene.load.image(textureKey, imageURL);
            scene.load.start();
        });
    }
    
    /**
     * Preload multiple images in parallel
     * Useful for loading all question images at quiz start
     * 
     * @param scene - The Phaser scene
     * @param urls - Array of image URLs to load
     * @param fallbackKey - Optional fallback texture for failed loads
     * @returns Map of original URL -> texture key (only includes successful loads)
     */
    static async loadImages(
        scene: BaseScene,
        urls: string[],
        fallbackKey?: string
    ): Promise<Map<string, string>> {
        
        const results = new Map<string, string>();
        
        console.log('ImageLoader::loadImages - Loading', urls.length, 'images');
        
        // Load all images in parallel
        const promises = urls.map(async (url) => {
            try {
                const textureKey = await this.loadImage(scene, url, fallbackKey);
                results.set(url, textureKey);
                console.log('ImageLoader::loadImages - Loaded:', url, '→', textureKey);
            } catch (error) {
                console.error('ImageLoader::loadImages - Failed:', url, error);
                // Continue loading other images even if one fails
                // Don't add to results map - caller can check if URL exists in map
            }
        });
        
        await Promise.all(promises);
        
        console.log('ImageLoader::loadImages - Complete:', results.size, '/', urls.length, 'succeeded');
        
        return results;
    }
    
    /**
     * Check if an image is already loaded in the texture cache
     * Useful for checking before attempting to load
     * 
     * @param scene - The Phaser scene
     * @param url - Image URL to check
     * @returns True if texture exists in cache
     */
    static isLoaded(scene: BaseScene, url: string): boolean {
        const isBase64 = url.startsWith('data:image');
        
        // Base64 images can't be checked (unique keys each time)
        if (isBase64) {
            return false;
        }
        
        // For URLs, check if texture key (URL) exists
        let textureKey = url;
        if (textureKey.length > 64) {
            textureKey = textureKey.substring(0, 64);
        }
        
        return scene.textures.exists(textureKey);
    }
    
    /**
     * Unload an image from the texture cache
     * Useful for freeing memory after quiz rounds
     * 
     * @param scene - The Phaser scene
     * @param textureKey - Texture key to remove
     */
    static unloadImage(scene: BaseScene, textureKey: string): void {
        if (scene.textures.exists(textureKey)) {
            console.log('ImageLoader::unloadImage - Removing:', textureKey);
            scene.textures.remove(textureKey);
        }
    }
    
    /**
     * Unload multiple images from cache
     * 
     * @param scene - The Phaser scene
     * @param textureKeys - Array of texture keys to remove
     */
    static unloadImages(scene: BaseScene, textureKeys: string[]): void {
        console.log('ImageLoader::unloadImages - Removing', textureKeys.length, 'textures');
        
        textureKeys.forEach(key => {
            this.unloadImage(scene, key);
        });
    }
}
