import { BaseScene } from 'src/BaseScene';
import { SimpleButton } from './SimpleButton';

export class NineSliceButton extends SimpleButton {
    
    declare protected normalImage: Phaser.GameObjects.NineSlice;
    declare protected hoverImage: Phaser.GameObjects.NineSlice;

    protected createButtonGraphic(textureKey: string, width: number, height: number, initiallyHidden: boolean): Phaser.GameObjects.NineSlice {
        // Use 16px corners as in the original
        const nineslice = this.scene.add.nineslice(
            0, 0,
            textureKey,
            undefined,
            width, height,
            16, 16, 16, 16
        ).setOrigin(0.5);
        nineslice.setVisible(!initiallyHidden);
        return nineslice;
    }

    // setButtonSize override for nineslice
    public setButtonSize(width: number, height: number): void {
        this.normalImage.setSize(width, height);
        this.hoverImage.setSize(width, height);
        this.setSize(width, height);
        if (this.input) {
            this.input.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height);
        }
        this.text.setWordWrapWidth(width - 40);
    }
}