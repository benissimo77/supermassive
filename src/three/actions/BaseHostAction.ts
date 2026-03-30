import Phaser from 'phaser';
import { BaseScene } from 'src/BaseScene';

/**
 * BaseHostAction provides the generic layout and clean-up boilerplate
 * for any UI shown during an Action intervention (e.g., Selecting a Team or Tile).
 */
export default class BaseHostAction extends Phaser.GameObjects.Container {
    
    public scene: BaseScene;
    protected actionData: any;
    protected backgroundOverlay: Phaser.GameObjects.Graphics;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {
        super(scene, x, y);
        this.scene = scene;
        this.actionData = actionData;

        // Optional: Common Setup: Fade out the background to focus attention if desired
        // We leave this transparent by default because subclasses often create localized
        // overlays (e.g. over the board but leaving the players visible).
        // this.backgroundOverlay = scene.add.graphics();
        // this.backgroundOverlay.fillStyle(0x000000, 0.7);
        // this.backgroundOverlay.fillRect(-960, -540, 1920, 1080);
        // this.add(this.backgroundOverlay);

        scene.add.existing(this);
    }

    /**
     * Called when the action is first displayed to the screen.
     * We use a generic name as it applies to both Host and Player variants.
     */
    public render(): void {
        this.setVisible(true);
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
    }

    /**
     * Clean up visual elements safely.
     */
    public destroy(fromScene?: boolean): void {
        if (this.backgroundOverlay) {
            this.backgroundOverlay.destroy();
        }
        super.destroy(fromScene);
    }
}
