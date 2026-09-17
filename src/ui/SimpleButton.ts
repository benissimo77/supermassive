import { BaseScene } from 'src/BaseScene';

export class SimpleButton extends Phaser.GameObjects.Container {
    declare public scene: BaseScene;

    // normalImge and hoverImage are declared as GameObjects to allow flexibility in subclasses (e.g. NineSliceButton)
    protected normalImage: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice;
    protected hoverImage: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice;
    protected text: Phaser.GameObjects.Text;
    protected buttonScale: number = 1;

    constructor(scene: BaseScene, text: string, styleOverride: any = {}, textureOverride: string = 'simple-button') {
        super(scene, 0, 0);
        this.scene = scene;

        if (!scene.textures.exists(textureOverride)) {
            console.error(`Texture '${textureOverride}' not found in scene:`, scene.scene.key);
            return;
        }

        // Use sensible defaults as a base case - can be adjusted with setButtonSize and setFontSize
        const buttonWidth = 800;
        const buttonHeight = 120;
        const buttonTextSize = 46;
        const buttonStyle = Object.assign({}, this.scene.labelConfig, { fontSize: buttonTextSize }, styleOverride);

        // Create normal and hover images using the overridable method
        this.normalImage = this.createButtonGraphic(textureOverride, buttonWidth, buttonHeight, false);
        let hoverTextureKey = textureOverride + '-hover';
        if (!this.scene.textures.exists(hoverTextureKey)) {
            hoverTextureKey = textureOverride;
        }
        this.hoverImage = this.createButtonGraphic(hoverTextureKey, buttonWidth, buttonHeight, true);

        // Add text
        this.text = scene.add.text(0, 0, text, buttonStyle).setOrigin(0.5);
        this.text.setWordWrapWidth(760);

        this.add([this.normalImage, this.hoverImage, this.text]);

        // Debug origin
        const debugRect = this.scene.add.rectangle(0, 0, 2, 2, 0xffff00, 1).setOrigin(0.5);
        this.add(debugRect);

        this.setButtonSize(buttonWidth, buttonHeight);
        this.adjustTextSize(buttonHeight);

        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);
        this.on('pointerdown', () => {
            this.buttonScale = this.scale;
            this.setScale(this.buttonScale * 1.05);
            this.scene.soundManager.playFX('button-click', 0.1);
        });
        this.on('pointerup', () => this.setScale(this.buttonScale));

        scene.add.existing(this);
    }

    protected createButtonGraphic(textureKey: string, width: number, height: number, initiallyHidden: boolean): Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image {
        const img = this.scene.add.image(0, 0, textureKey).setOrigin(0.5).setDisplaySize(width, height);
        img.setVisible(!initiallyHidden);
        return img;
    }

    public onPointerOver(): void {
        this.hoverImage.setVisible(true);
    }

    public onPointerOut(): void {
        this.hoverImage.setVisible(false);
    }

    public setButtonSize(width: number, height: number): void {
        this.resizeGraphic(this.normalImage, width, height);
        this.resizeGraphic(this.hoverImage, width, height);
        this.setSize(width, height);
        if (this.input) {
            this.input.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height);
        }
        this.text.setWordWrapWidth(width - 40);
    }

    // A plain Image has no intrinsic resize, so setDisplaySize() (scale-based) is the correct way
    // to resize it - this is the default. NineSliceButton overrides this to use NineSlice's own
    // setSize() instead: setDisplaySize() on a NineSlice sets scaleX/scaleY, which uniformly
    // scales the WHOLE graphic including its corners, defeating the purpose of 9-slicing (corners
    // should stay a fixed pixel size; only the middle segment should stretch).
    protected resizeGraphic(image: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice, width: number, height: number): void {
        image.setDisplaySize(width, height);
    }

    public setTint(color: number): void {
        this.normalImage.setTint(color);
        this.hoverImage.setTint(color);
    }

    public setButtonText(text: string): this {
        this.text.setText(text);
        this.adjustTextSize(this.height);
        return this;
    }
    public setTextSize(size: number): void {
        this.text.setFontSize(size);
    }
    public setHighlight(): void {
        this.setAlpha(1);
        this.setScale(1.1);
        const fx1 = (this.hoverImage as any).enableFilters()?.filters?.external?.addGlow?.(0xffff00, 1, 3);
    }
    // Starting font size as a fraction of the button's own HEIGHT only - deliberately independent
    // of width, so resizing a button wider without changing its height never changes the font
    // size on its own. Text content can only ever shrink it further from here (see below).
    private static readonly FONT_HEIGHT_RATIO = 0.4;

    // Returns the font size it applied, in case a caller with several sibling buttons wants to
    // fit each one individually and then re-apply the smallest result to all of them via
    // setTextSize() - otherwise buttons with shorter text end up visibly larger than buttons
    // with longer text, even at identical button size, since this method sizes purely from its
    // own text content.
    public adjustTextSize(targetHeight: number): number {
        if (targetHeight < 8) {
            console.warn('SimpleButton::adjustTextSize: minimum text size reached');
            return parseInt(this.text.style.fontSize as unknown as string, 10) || targetHeight;
        }

        // Padding is a modest, continuous fraction of each dimension - no discrete width "bands",
        // so resizing a button never causes a sudden jump in available space just from crossing a
        // threshold (that was the previous bug: widening a button with no height change could
        // change which band applied and produce a bigger font for no real reason).
        const paddingX = Phaser.Math.Clamp(this.width * 0.08, 12, 60);
        const paddingY = Phaser.Math.Clamp(this.height * 0.15, 8, 24);
        const availableWidth = Math.max(1, this.width - paddingX * 2);
        const availableHeight = Math.max(1, this.height - paddingY * 2);
        this.text.setWordWrapWidth(availableWidth);

        let fontSize = Math.min(targetHeight * SimpleButton.FONT_HEIGHT_RATIO, availableHeight);
        this.text.setFontSize(Math.floor(fontSize));

        // Shrink using Phaser's own measured text bounds (accounts for real wrapping) rather than
        // an estimated average character width - the estimate was what made the result depend on
        // width instead of purely on whether the actual text fits.
        let iterations = 0;
        while ((this.text.height > availableHeight || this.text.width > availableWidth) && fontSize > 8 && iterations < 20) {
            fontSize -= 1;
            this.text.setFontSize(Math.floor(fontSize));
            iterations++;
        }

        return Math.floor(fontSize);
    }
}
