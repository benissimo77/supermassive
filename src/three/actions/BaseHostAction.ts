import Phaser from 'phaser';
import { BaseScene } from 'src/BaseScene';
import { gsap } from 'gsap';

/**
 * BaseHostAction provides the generic layout and clean-up boilerplate
 * for any UI shown during an Action intervention (e.g., Selecting a Team or Tile).
 *
 * LIFECYCLE:
 *   JOKER state    → render()       — display joker type title + active team (same for all joker types)
 *   JOKER_EVALUATE → getTimeline()  — full choreography for this specific joker type.
 *                                     Receives ThreeSceneRefs so it can move containers, players and
 *                                     cards freely. Returns a paused gsap timeline; the scene plays it
 *                                     and wires up the onComplete socket emit.
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
     * Called when the JOKER state is entered.
     * Subclasses should build their panel, title and active-team avatar here.
     * The base implementation fades the container in; call super.render() from subclasses.
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
     * Called when JOKER_EVALUATE is entered.
     * Subclasses must override this to return their full choreography as a paused gsap timeline.
     * The scene will play() the timeline and attach the onComplete socket emit — the action
     * should NOT emit host:response itself.
     *
     * @param refs — live references to scene containers, players and cards the action may need.
     */
    public getTimeline(evaluateData: any): gsap.core.Timeline {
        // Base implementation is a no-op; subclasses override with real choreography.
        return gsap.timeline({ paused: true });
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
