import { BaseScene } from 'src/BaseScene';


export class NineSliceButton extends Phaser.GameObjects.Container {
    declare public scene: BaseScene;
    private normalSlice: Phaser.GameObjects.NineSlice;
    private hoverSlice: Phaser.GameObjects.NineSlice;
    private text: Phaser.GameObjects.Text;

    constructor(scene: BaseScene, text: string, styleOverride: any = {}) {

        super(scene, 0, 0);
        this.scene = scene;

        if (!scene.textures.exists('simple-button')) {
            console.error("Texture 'simple-button' not found!");
            // Create fallback
            return;
        }

        // Merge default styles with any provided styles - will override defaults
        const buttonTextSize = { fontSize: scene.getY(36) };
        const buttonStyle = Object.assign({}, this.scene.labelConfig, buttonTextSize, styleOverride);

        // Assume a default size - but this can/will be overridden when laying out all elements
        const buttonWidth = 600;
        const buttonHeight = scene.getY(60);

        // ALSO important: origin of container is (0.5) - otherwise hit area is wrong
        // This means everything must be centred in the container

        // Create normal state 9-slice
        this.normalSlice = scene.add.nineslice(
            0, 0,                // Position (relative to container)
            'simple-button',     // Key of normal button texture
            undefined,                // Frame
            buttonWidth, buttonHeight,       // Width, height
            12, 12, 12, 12       // Corner slice sizes
        )
            .setOrigin(0.5);

        // Create hover state 9-slice (initially invisible)
        this.hoverSlice = scene.add.nineslice(
            0, 0,                // Position
            'simple-button-hover',      // Key of hover button texture  
            undefined,                // Frame
            buttonWidth, buttonHeight,       // Width, height
            12, 12, 12, 12       // Corner slice sizes
        )
            .setOrigin(0.5)
            .setVisible(false);     // Initially hidden

        // Add text
        this.text = scene.add.text(0, 0, text, buttonStyle).setOrigin(0.5);

        // Add all elements to container
        this.add([this.normalSlice, this.hoverSlice, this.text]);

        // DEBUG - add a small rectangle at the button origin
        const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xffff00, 1).setOrigin(0.5);
        this.add(debugRect);

        // When making a container interactive we must set the size of the container
        // This function also adjusts the text size to fit the button
        this.setButtonSize(buttonWidth, buttonHeight);

        // Add hover effect - but calling class will decide if this is interactive or not
        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);

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
        this.text.setWordWrapWidth(width - 40);
        
        console.log('NineSliceButton::setButtonSize:', width, height, this.width, this.height);

        // Call recursive function to adjust text height until it fits neatly
        this.adjustTextSize(height / 2);
    }

    public setButtonText(text: string): this {
        this.text.setText(text);
        this.adjustTextSize(this.height / 2);
        return this;
    }

    // adjustTextSize - set the text height to the initially-supplied height, then check if it fits it not steaily reduce the height
    private adjustTextSize(maxHeight: number): void {
        this.text.setFontSize(maxHeight);
        if ((this.text.height > this.height - this.scene.getY(24)) || (this.text.width > this.width - 40)) {
            console.log('NineSliceButton::adjustTextSize:', this.text.height, this.height);
            this.adjustTextSize(maxHeight - 2);
        }
    }

}