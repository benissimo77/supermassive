import Phaser from 'phaser';

export class ThreeChip extends Phaser.GameObjects.Container {

    private chipGraphics: Phaser.GameObjects.Graphics;
    private chipText: Phaser.GameObjects.Text;
    private chipNumber: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        
        this.chipGraphics = scene.add.graphics();
        this.chipGraphics.fillStyle(0x0000cc, 1);
        this.chipGraphics.fillCircle(0, 0, 60);
        this.chipGraphics.lineStyle(5, 0xcccc00);
        this.chipGraphics.strokeCircle(0, 0, 60);
        
        const chipTextConfig = {
            fontFamily: 'Titan One',
            fontSize: '64px',
            color: '#ffffff',
            strokeThickness: 2,
            stroke: '#000000'
        }
        this.chipText = scene.add.text(0, 0, '', chipTextConfig).setOrigin(0.5);

        this.add([this.chipGraphics, this.chipText]);

        // Add to scene
        scene.add.existing(this);
    }

    /**
     * Sets the selection order (1, 2, or 3) and displays it.
     */
    public setSelection(order: number | null): void {
        this.chipNumber = order || 0;
        if (this.chipNumber > 0) {
            this.chipText.setText(this.chipNumber.toString());
            this.setScale(1.5);
            this.scene.tweens.add({
                targets: this,
                scale: 1,
                duration: 300,
                ease: 'Quad.easeInOut'
            })
        } else {
            this.chipText.setText('');
        }
    }

    public getSelection(): number {
        return this.chipNumber;
    }

}
