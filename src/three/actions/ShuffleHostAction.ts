import { gsap } from 'gsap';
import BaseHostAction from './BaseHostAction';
import { ThreeHostScene } from 'src/three/ThreeHostScene';

export default class ShuffleHostAction extends BaseHostAction {

    private jokerOverlay: Phaser.GameObjects.Rectangle;

    constructor(scene: ThreeHostScene, x: number, y: number, actionData: any) {
        super(scene, x, y, actionData);

        const PANEL_X = 1280;
        const PANEL_Y = this.scene.getY(540);
        const PANEL_WIDTH = 960;
        const PANEL_HEIGHT = this.scene.getY(900);

        this.jokerOverlay = scene.add.rectangle(PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.88).setOrigin(0.5);
        this.add(this.jokerOverlay);

        const jokerBackground = scene.add.image(PANEL_X, PANEL_Y, 'joker-white')
            .setOrigin(0.5)
            .setDisplaySize(560, 560)
            .setAlpha(0.07);
        this.add(jokerBackground);


        const titleText = scene.add.text(PANEL_X, this.scene.getY(120), 'SHUFFLE!', {
            fontFamily: 'Titan One',
            fontSize: '64px',
            color: '#aa44ff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        this.add(titleText);

        if (actionData.jokerRules && Array.isArray(actionData.jokerRules)) {
            let nextY:number = this.scene.getY(240);
            actionData.jokerRules.forEach((rule: string, index: number) => {
                const ruleText = scene.add.text(
                    PANEL_X - PANEL_WIDTH / 2 + 40,
                    nextY,
                    rule,
                    { fontFamily: 'Titan One', fontSize: '40px', color: '#ffffff', stroke: '#330055', strokeThickness: 3 }
                ).setOrigin(0).setLineSpacing(10).setWordWrapWidth(PANEL_WIDTH - 80);
                this.add(ruleText);
                nextY += ruleText.height + 60;
            });
        }
    }

    public layout(): void {
        super.layout();
    }

    public getAnnouncementTimeline(): gsap.core.Timeline {
        this.layout();
        return gsap.timeline();
    }

    /**
     * JOKER_EVALUATE — shuffle choreography.
     * For each move: flip both tiles face-up, swap their positions, flip face-down.
     *
     * Uses tl.call() to trigger flips as fire-and-forget so that the flip's onUpdate
     * callbacks fire normally. Nesting GSAP timelines via tl.add() causes seeking which
     * suppresses onUpdate, preventing the texture swap inside flip() from running.
     */
    public getEvaluateTimeline(evaluateData: any): gsap.core.Timeline {
        const tl = gsap.timeline();
        const scene = this.scene as ThreeHostScene;
        const data = { ...this.actionData, ...evaluateData };

        const moves: { oldPos: number; newPos: number; oldTileType: string; newTileType: string }[] = data.jokerResult?.moves || [];

        // Bring the grid on screen (it should be there already, but ensure it)
        tl.to(scene.gridContainer, {
            x: 1280,
            duration: 0.8,
            ease: 'power2.out'
        });

        moves.forEach((result) => {
            const oldCard = scene.cards[result.oldPos];
            const newCard = scene.cards[result.newPos];
            if (!oldCard || !newCard) return;

            // Capture positions before any tweens move them
            const origOldX = oldCard.x, origOldY = oldCard.y;
            const origNewX = newCard.x, origNewY = newCard.y;

            // Flip old card face-up + scale pop concurrently — flip is fire-and-forget via call()
            // so its onUpdate callbacks fire normally (tl.add() would seek and suppress them)
            tl.call(() => { oldCard.flip(result.oldTileType, true, 0.4); });
            tl.to(oldCard, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '<');

            // Flip new card face-up + scale pop after old card
            tl.call(() => { newCard.flip(result.newTileType, true, 0.4); });
            tl.to(newCard, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '<');

            // Wait for both flips to complete before swapping
            tl.to({}, { duration: 0.55 });

            // Swap positions concurrently while both cards are face-up
            tl.to(oldCard, { x: origNewX, y: origNewY, duration: 0.8, ease: 'power2.inOut' });
            tl.to(newCard, { x: origOldX, y: origOldY, duration: 0.8, ease: 'power2.inOut' }, '<');

            // CRITICAL: swap scene.cards entries so the index array stays in sync with visual positions.
            // Without this, future reveals use scene.cards[pos] and get the wrong card object.
            tl.add(() => {
                scene.cards[result.oldPos] = newCard;
                scene.cards[result.newPos] = oldCard;
            });

            // Flip both cards face-down — fire-and-forget
            tl.call(() => {
                oldCard.flip(result.oldTileType, false, 0.4);
                newCard.flip(result.newTileType, false, 0.4);
            });
            // Wait for the flip-back to complete, with a brief pause before the next swap
            tl.to({}, { duration: 0.7 });
        });

        return tl;
    }
}
