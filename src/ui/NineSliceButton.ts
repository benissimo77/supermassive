import { BaseScene } from 'src/BaseScene';


export class NineSliceButton extends Phaser.GameObjects.Container {
    declare public scene: BaseScene;
    private normalSlice: Phaser.GameObjects.NineSlice;
    private hoverSlice: Phaser.GameObjects.NineSlice;
    private text: Phaser.GameObjects.Text;
    private buttonScale: number = 1;

    constructor(scene: BaseScene, text: string, styleOverride: any = {}) {

        super(scene, 0, 0);
        this.scene = scene;

        // console.log('NineSliceButton::constructor:', text, styleOverride);

        if (!scene.textures.exists('simple-button')) {
            console.error("Texture 'simple-button' not found!");
            // Create fallback
            return;
        }

        // Merge default styles with any provided styles - will override defaults
        // 46 might seem unusual but its the biggest size that still can fit 2 lines within the button height
        const buttonTextSize = { fontSize: 46 };
        const buttonStyle = Object.assign({}, this.scene.labelConfig, buttonTextSize, styleOverride);

        // Assume a default size - but this can/will be overridden when laying out all elements
        // Note that this is one case we were fix the height and don't use a scaled height to match screen height
        const buttonWidth = 800;
        const buttonHeight = 120;

        // ALSO important: origin of container is (0.5) - otherwise hit area is wrong
        // This means everything must be centred in the container

        // Create normal state 9-slice
        this.normalSlice = scene.add.nineslice(
            0, 0,                // Position (relative to container)
            'simple-button',     // Key of normal button texture
            undefined,                // Frame
            buttonWidth, buttonHeight,       // Width, height
            16, 16, 16, 16       // Corner slice sizes
        )
            .setOrigin(0.5);

        // Create hover state 9-slice (initially invisible)
        this.hoverSlice = scene.add.nineslice(
            0, 0,                // Position
            'simple-button-hover',      // Key of hover button texture  
            undefined,                // Frame
            buttonWidth, buttonHeight,       // Width, height
            16, 16, 16, 16       // Corner slice sizes
        )
            .setOrigin(0.5)
            .setVisible(false);     // Initially hidden

        // Add text
        this.text = scene.add.text(0, 0, text, buttonStyle).setOrigin(0.5);
        this.text.setWordWrapWidth(760);

        // Add all elements to container
        this.add([this.normalSlice, this.hoverSlice, this.text]);

        // DEBUG - add a small rectangle at the button origin
        const debugRect = this.scene.add.rectangle(0, 0, 2, 2, 0xffff00, 1).setOrigin(0.5);
        this.add(debugRect);

        // When making a container interactive we must set the size of the container
        // This function also adjusts the text size to fit the button
        this.setButtonSize(buttonWidth, buttonHeight);

        // Add hover effect - but calling class will decide if this is interactive or not
        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);
        this.on('pointerdown', () => {
            this.buttonScale = this.scale;
            this.setScale(this.buttonScale * 1.05);
            this.scene.soundManager.playFX('button-click', 0.1);
        });
        this.on('pointerup', () => this.setScale(this.buttonScale));

        // Add to scene
        scene.add.existing(this);
    }

    public onPointerOver(): void {
        // this.normalSlice.setVisible(false);
        this.hoverSlice.setVisible(true);
    }

    public onPointerOut(): void {
        // this.normalSlice.setVisible(true);
        this.hoverSlice.setVisible(false);
    }

    public setButtonSize(width: number, height: number): void {
        this.normalSlice.setSize(width, height);
        this.hoverSlice.setSize(width, height);
        this.setSize(width, height);

        // Update interactive hit area if button is already interactive
        // Just update the hit area (don't remove interactive)
        if (this.input) {
            this.input.hitArea = new Phaser.Geom.Rectangle(0,0, width, height);
        }

        // Since this button will have a text label we should adjust the textwrap width for this label
        this.text.setWordWrapWidth(width - 40);
        
        // Call the recursive function to adjust text size to fit within button
        // Calling with this.height is just a value to start the recursion - it will always reduce from this
        //this.adjustTextSize(this.height);
    }

    public setButtonText(text: string): this {
        this.text.setText(text);
        this.adjustTextSize(this.height);
        return this;
    }
    public setTextSize(size: number): void {
        this.text.setFontSize(size);
    }

    // setHighlight - a new state to provide a highlighted version
    // Convenience function to ensure consistency with highlighting button states
    public setHighlight(): void {
        this.setAlpha(1);
        this.setScale(1.1);
        this.postFX.addGlow(0xffff00, 2, 6);
    }

    // adjustTextSize - set the text height to the initially-supplied height, then check if it fits it not steaily reduce the height
    private adjustTextSizeOrig(newHeight: number): void {

        // Avoid infinite loop - always end if we go below a certain size
        if (newHeight < 8) {
            console.warn('NineSliceButton::adjustTextSize: minimum text size reached');
            return;
        }

        // We have three cases:
        // a 'regular' button which is quite large and has padding
        // a 'small' button which is more tightly fitted
        // a 'large' button which is very wide and has more padding
        this.text.setFontSize(newHeight);
        if (this.width <= 120) {
            // Small button - less padding
            this.text.setWordWrapWidth(this.width - 12);
            if ((this.text.height > this.height / 1.2) || (this.text.width > this.width - 4)) {
                this.adjustTextSize(newHeight - 2);
            }
        } else if (this.width >= 800) {
            // Large button - more padding
            this.text.setWordWrapWidth(this.width - 80);
            if ((this.text.height > this.height / 2) || (this.text.width > this.width - 80)) {
                this.adjustTextSize(newHeight - 2);
            }
        } else {
            // Regular button - more padding
            this.text.setWordWrapWidth(this.width - 40);
            if ((this.text.height > this.height / 1.6) || (this.text.width > this.width - 40)) {
                this.adjustTextSize(newHeight - 2);
            }

        }

    }
    private adjustTextSize(targetHeight: number): void {
        // Avoid infinite loop - always end if we go below a certain size
        if (targetHeight < 8) {
            console.warn('NineSliceButton::adjustTextSize: minimum text size reached');
            return;
        }

        // Calculate padding based on button size
        let padding: number;
        let maxHeightRatio: number;

        if (this.width <= 120) {
            // Small button
            padding = 12;
            maxHeightRatio = 1.2;
        } else if (this.width >= 800) {
            // Large button
            padding = 60;
            maxHeightRatio = 1.8;
        } else {
            // Regular button
            padding = 40;
            maxHeightRatio = 1.4;
        }

        const availableWidth = this.width - padding;
        const availableHeight = this.height / maxHeightRatio;

        // Set word wrap first (before measuring)
        this.text.setWordWrapWidth(availableWidth);

        // Calculate font size based on available height
        // Start with target height, but constrain to available space
        let fontSize = Math.min(targetHeight, availableHeight);

        // Estimate how many lines the text will wrap to
        // This is approximate but much faster than recursive checking
        const textLength = this.text.text.length;
        const avgCharWidth = fontSize * 0.6; // Rough estimate
        const charsPerLine = Math.floor(availableWidth / avgCharWidth);
        const estimatedLines = Math.ceil(textLength / charsPerLine);

        // Adjust font size if text will be too tall when wrapped
        if (estimatedLines > 1) {
            const lineHeight = fontSize * 1.2; // Phaser default line height
            const totalHeight = lineHeight * estimatedLines;

            if (totalHeight > availableHeight) {
                // Scale down font size to fit
                fontSize = fontSize * (availableHeight / totalHeight);
            }
        }

        // Apply calculated size (only once!)
        this.text.setFontSize(Math.floor(fontSize));

        // Optional: One final check if you want to be safe
        // (but only ONE iteration, not 20+)
        if (this.text.height > availableHeight || this.text.width > availableWidth) {
            // Reduce by 10% if still too big
            this.text.setFontSize(Math.floor(fontSize * 0.9));
        }
    }
}