import { BaseScene } from 'src/BaseScene';

export class SimpleButton extends Phaser.GameObjects.Container {
    declare public scene: BaseScene;

    // normalImge and hoverImage are declared as GameObjects to allow flexibility in subclasses (e.g. NineSliceButton)
    protected normalImage: Phaser.GameObjects.GameObject;
    protected hoverImage: Phaser.GameObjects.GameObject;
    protected text: Phaser.GameObjects.Text;
    protected buttonScale: number = 1;

    constructor(scene: BaseScene, text: string, styleOverride: any = {}, textureOverride: string = 'simple-button') {
        super(scene, 0, 0);
        this.scene = scene;

        if (!scene.textures.exists(textureOverride)) {
            console.error(`Texture '${textureOverride}' not found in scene:`, scene.scene.key);
            return;
        }

        const buttonTextSize = { fontSize: 46 };
        const buttonStyle = Object.assign({}, this.scene.labelConfig, buttonTextSize, styleOverride);
        const buttonWidth = 800;
        const buttonHeight = 120;

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

    protected createButtonGraphic(textureKey: string, width: number, height: number, initiallyHidden: boolean): Phaser.GameObjects.GameObject {
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
        this.normalImage.setDisplaySize(width, height);
        this.hoverImage.setDisplaySize(width, height);
        this.setSize(width, height);
        if (this.input) {
            this.input.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height);
        }
        this.text.setWordWrapWidth(width - 40);
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
        this.postFX.addGlow(0xffff00, 2, 6);
    }
    protected adjustTextSize(targetHeight: number): void {
        if (targetHeight < 8) {
            console.warn('SimpleButton::adjustTextSize: minimum text size reached');
            return;
        }
        let padding: number;
        let maxHeightRatio: number;
        if (this.width <= 120) {
            padding = 12;
            maxHeightRatio = 1.2;
        } else if (this.width >= 800) {
            padding = 60;
            maxHeightRatio = 1.8;
        } else {
            padding = 40;
            maxHeightRatio = 1.4;
        }
        const availableWidth = this.width - padding;
        const availableHeight = this.height / maxHeightRatio;
        this.text.setWordWrapWidth(availableWidth);
        let fontSize = Math.min(targetHeight, availableHeight);
        const textLength = this.text.text.length;
        const avgCharWidth = fontSize * 0.6;
        const charsPerLine = Math.floor(availableWidth / avgCharWidth);
        const estimatedLines = Math.ceil(textLength / charsPerLine);
        if (estimatedLines > 1) {
            const lineHeight = fontSize * 1.2;
            const totalHeight = lineHeight * estimatedLines;
            if (totalHeight > availableHeight) {
                fontSize = fontSize * (availableHeight / totalHeight);
            }
        }
        this.text.setFontSize(Math.floor(fontSize));
        if (this.text.height > availableHeight || this.text.width > availableWidth) {
            this.text.setFontSize(Math.floor(fontSize * 0.9));
        }
    }
}
