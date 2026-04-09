import { BaseScene } from 'src/BaseScene';
import { NineSliceButton } from './NineSliceButton';
import { ImageLoader } from 'src/utils/ImageLoader';

export class ImageButton extends NineSliceButton {

    private buttonImage: Phaser.GameObjects.Image | null = null;
    private textBackground: Phaser.GameObjects.Graphics;
    private imageKey: string | null = null;
    private isSquareMode: boolean = true;

    constructor(scene: BaseScene, text: string, imageKey: string | null = null, styleOverride: any = {}) {
        super(scene, text, styleOverride);
        this.imageKey = imageKey;

        // Initially just create an empty image with no key (we will bake the texture in initTexture)
        this.buttonImage = scene.add.image(0, 0, '');
        this.buttonImage.setOrigin(0.5);

        // Create dark transparent background for text
        this.textBackground = scene.add.graphics();

        this.add(this.buttonImage);
        this.add(this.textBackground);
        this.add(this.text);
        
        this.setDisplayMode('square');
        
        // Kick off the one-time high-quality texture generation
        this.initTexture();
    }

    private async initTexture(): Promise<void> {

        console.log('ImageButton:: initTexture', this.imageKey, this.buttonImage);

        if (!this.imageKey || !this.buttonImage) return;

        try {
            // ImageLoader caches identical requests transparently and returns the internal Phaser texture key
            this.imageKey = await ImageLoader.loadImage(this.scene, this.imageKey, '');
        } catch (e) {
            console.warn('ImageButton failed to fetch texture:', this.imageKey, e);
            return;
        }

        // Bake exactly one high-quality square texture per image key
        const targetRes = 360; 
        const roundedKey = `rounded_sq_${this.imageKey}`;

        const attemptBake = () => {

            console.log('ImageButton:: attemptBake', roundedKey, this.scene.textures.exists(roundedKey));
            
            // If already baked (by us or another button), just reuse it
            if (this.scene.textures.exists(roundedKey)) {
                this.applyBakedTexture(roundedKey);
                return;
            }

            const textureObj = this.scene.textures.get(this.imageKey!);
            const srcImage = textureObj.getSourceImage();

            if (!srcImage || (srcImage as any).width === 0) {
                // Wait for native load event synchronously
                if (srcImage && srcImage instanceof HTMLImageElement) {
                    srcImage.onload = () => {
                        console.log('ImageButton:: onload', roundedKey);
                        attemptBake();
                    };
                }
                return; 
            }

            // Create the CanvasTexture ONCE
            const canvasTexture = this.scene.textures.createCanvas(roundedKey, targetRes, targetRes);
            const ctx = canvasTexture?.context;

            if (ctx) {
                ctx.beginPath();
                const radius = 16;
                ctx.moveTo(radius, 0);
                ctx.lineTo(targetRes - radius, 0);
                ctx.quadraticCurveTo(targetRes, 0, targetRes, radius);
                ctx.lineTo(targetRes, targetRes - radius);
                ctx.quadraticCurveTo(targetRes, targetRes, targetRes - radius, targetRes);
                ctx.lineTo(radius, targetRes);
                ctx.quadraticCurveTo(0, targetRes, 0, targetRes - radius);
                ctx.lineTo(0, radius);
                ctx.quadraticCurveTo(0, 0, radius, 0);
                ctx.closePath();
                ctx.clip(); // Mask the corners
                
                const scaleX = targetRes / (srcImage as any).width;
                const scaleY = targetRes / (srcImage as any).height;
                const maxScale = Math.max(scaleX, scaleY);

                const drawWidth = (srcImage as any).width * maxScale;
                const drawHeight = (srcImage as any).height * maxScale;
                const offsetX = (targetRes - drawWidth) / 2;
                const offsetY = (targetRes - drawHeight) / 2;

                ctx.drawImage(srcImage as CanvasImageSource, offsetX, offsetY, drawWidth, drawHeight);
                canvasTexture.refresh();
            }

            console.log('ImageButton: image:', srcImage.width, srcImage.height);

            this.applyBakedTexture(roundedKey);
        };

        if (this.scene.textures.exists(this.imageKey)) {
            attemptBake();
        } else {
            // Listen exactly ONCE for this image
            this.scene.textures.once(`addtexture-${this.imageKey}`, () => {
                console.log('ImageButton:: addtexture event', this.imageKey);
                attemptBake();
            });
        }
    }

    private applyBakedTexture(roundedKey: string): void {

        console.log('ImageButton:: applyBakedTexture', roundedKey, this.buttonImage);

        if (this.buttonImage) {
            if (this.scene.textures.exists(roundedKey)) {
                this.buttonImage.setTexture(roundedKey);
                this.updateImageScale();
                // Explicit Depth Safety check
                this.bringToTop(this.buttonImage);
                this.bringToTop(this.textBackground);
                this.bringToTop(this.text);
            }
        }
    }

    private updateImageScale(): void {
        if (!this.buttonImage || !this.buttonImage.texture || this.buttonImage.texture.key === '__DEFAULT') return;

        const inset = 6;
        const innerWidth = this.width - (inset * 2);
        
        if (this.buttonImage.width > 0) {
            this.buttonImage.setScale(innerWidth / this.buttonImage.width);
        }
    }

    public setDisplayMode(mode: 'square' | 'letterbox'): void {
        this.isSquareMode = (mode === 'square');
        
        if (this.buttonImage && this.textBackground) {
            this.buttonImage.setVisible(this.isSquareMode);
            this.textBackground.setVisible(this.isSquareMode);
            
            // If dropping down to letterbox, just hide the image elements and re-center the text
            if (!this.isSquareMode) {
                this.text.setPosition(0, 0);
            }
        }
    }

    public setButtonSize(width: number, height: number): void {
        super.setButtonSize(width, height);

        // Text position at centre - will be updated if in square mode...
        this.text.setPosition(0, 0);

        if (this.isSquareMode && this.buttonImage && this.textBackground && this.imageKey) {
            
            // Recalculate layout scales without regenerating the canvas texture
            this.updateImageScale();

            const inset = 6; // Shrink the image so the NineSlice outer gold border remains visible!
            const innerWidth = width - (inset * 2);
            
            // Position text at the bottom.
            // 1. Text panel should be 20% of the button's overall height
            const textPanelHeight = height * 0.20; 
            
             // 3. The text background panel should not over-bleed the gold border (width - inset * 2)
            // It aligns with the inset image now. We'll use innerWidth directly.
            
            // Calculate bottom Y coordinate (-height/2 to height/2, so bottom is height/2)
            // It needs to be inside the inset border as well: height / 2 - inset - textPanelHeight / 2
            const bottomY = (height / 2) - inset - (textPanelHeight / 2); 
            this.textBackground.setPosition(0, bottomY);
            this.textBackground.clear();
            this.textBackground.fillStyle(0x000000, 0.6); // Semi-transparent black
            this.textBackground.fillRoundedRect(-innerWidth / 2, -textPanelHeight / 2, innerWidth, textPanelHeight, 16);

            // 2. Adjust text size logic: start with a size around 85% of the panel height
            this.adjustTextSize(textPanelHeight * 0.85);
            this.text.setPosition(0, bottomY);
        }
    }

    protected adjustTextSize(targetHeight: number): void {
        if (!this.isSquareMode || !this.buttonImage || !this.buttonImage.visible) {
            super.adjustTextSize(targetHeight);
            return;
        }

        // Avoid infinite loop - always end if we go below a certain size
        if (targetHeight < 12) {
            return;
        }

        const inset = 6;
        const panelWidth = this.width - (inset * 2);
        const panelHeight = this.height * 0.20;

        this.text.setFontSize(targetHeight);
        
        // Give it slight horizontal padding inside the black panel so it's not flush to the edges
        const textWrapWidth = panelWidth - 8;
        this.text.setWordWrapWidth(textWrapWidth);
        
        // Recurse downwards if the text is physically taller or wider than the panel 
        if (this.text.height > panelHeight || this.text.width > textWrapWidth) {
            this.adjustTextSize(targetHeight - 2);
        }
    }
}
