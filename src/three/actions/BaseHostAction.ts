import Phaser from 'phaser';
import { BaseScene } from 'src/BaseScene';
import { gsap } from 'gsap';

/**
 * BaseHostAction provides the generic layout and clean-up boilerplate
 * for any UI shown during an Action intervention (e.g., Selecting a Team or Tile).
 *
 * LIFECYCLE:
 *   JOKER state    → layout()            — snap all elements to their final positions for current screen size.
 *                    getRenderTimeline() — entrance animation; calls layout() first, then tweens FROM
 *                                         off-screen/hidden start states. Embedded into stateTimeline.
 *   On resize      → layout()            — instant re-snap, no animation.
 *   JOKER_EVALUATE → getTimeline()       — action-specific choreography, embedded into stateTimeline.
 */
export default class BaseHostAction extends Phaser.GameObjects.Container {
    
    public scene: BaseScene;
    protected actionData: any;
    protected backgroundOverlay: Phaser.GameObjects.Graphics;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {
        super(scene, x, y);
        this.scene = scene;
        this.actionData = actionData;
    }

    /**
     * Snap all elements to their correct positions for the current screen size.
     * Called on resize (instant, no animation) and at the start of getAnnouncementTimeline().
     * Subclasses must override this.
     */
    public layout(): void {
        this.setVisible(true);
    }

    /**
     * Entrance animation for the JOKER state.
     * Calls layout() first to place elements, then tweens FROM their off-screen/hidden start states
     * so that progress(1).kill() always leaves elements in their correct final positions.
     * Returns an unpaused timeline for embedding into stateTimeline.
     * Subclasses should override and call super.getAnnouncementTimeline() to get the base fade-in.
     */
    public getAnnouncementTimeline(): gsap.core.Timeline {
        this.layout();
        const tl = gsap.timeline();
        tl.from(this, { alpha: 0, duration: 0.3, ease: 'power2.out' });
        return tl;
    }

    /**
     * Action-specific choreography for JOKER_EVALUATE.
     * Returns an unpaused timeline for embedding into stateTimeline.
     * Subclasses override with real choreography.
     */
    public getEvaluateTimeline(evaluateData: any): gsap.core.Timeline {
        return gsap.timeline();
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
