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

    // See SimpleButton.resizeGraphic - a NineSlice must be resized via its own setSize(), not
    // setDisplaySize(), so its corners stay a fixed pixel size instead of being scaled along with
    // everything else.
    protected resizeGraphic(image: Phaser.GameObjects.NineSlice, width: number, height: number): void {
        image.setSize(width, height);
    }

}