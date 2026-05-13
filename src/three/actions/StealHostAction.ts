import Phaser from 'phaser';
import { BaseScene } from 'src/BaseScene';
import { gsap } from 'gsap';
import BaseHostAction from './BaseHostAction';
import type { ThreeHostScene } from 'src/three/ThreeHostScene';

export default class StealHostAction extends BaseHostAction {

    private titleText: Phaser.GameObjects.Text;
    private jokerOverlay: Phaser.GameObjects.Rectangle;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {
        super(scene, x, y, actionData);

        // Panel sits over the grid area on the right side of the screen.
        // Deliberately undersized — not trying to fill all available space, just sitting comfortably on the right.
        // Grid is centred at x=1280. Panel centre x=1300 spans roughly x=940–1660, clear of the battle players.
        const PANEL_X = 1280;
        const PANEL_Y = this.scene.getY(540);
        const PANEL_WIDTH  = 960;
        const PANEL_HEIGHT  = this.scene.getY(900);

        // Dark panel — right-side only, battle players remain visible on left
        this.jokerOverlay = scene.add.rectangle(PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.88).setOrigin(0.5);
        this.add(this.jokerOverlay);

        // Watermark joker image inside the panel
        const jokerBackground = scene.add.image(PANEL_X, PANEL_Y, 'joker-white')
            .setOrigin(0.5)
            .setDisplaySize(560, 560)
            .setAlpha(0.07);
        this.add(jokerBackground);

        // Title — final position set by layout(), animated in by getAnnouncementTimeline()
        this.titleText = scene.add.text(PANEL_X, this.scene.getY(120), 'STEAL!', {
            fontFamily: 'Titan One',
            fontSize: '64px',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        this.add(this.titleText);

        // Rules text — below title, within panel bounds
        if (actionData.jokerRules && Array.isArray(actionData.jokerRules)) {
            actionData.jokerRules.forEach((rule: string, index: number) => {
                const ruleText = scene.add.text(
                    PANEL_X - PANEL_WIDTH / 2 + 40,
                    this.scene.getY(240 + (index * 140)),
                    rule,
                    { fontFamily: 'Titan One', fontSize: '40px', color: '#ffffff', stroke: '#600000', strokeThickness: 3 }
                ).setOrigin(0).setLineSpacing(10).setWordWrapWidth(PANEL_WIDTH - 80);
                this.add(ruleText);
            });
        }
    }

    /**
     * Snap all elements to their correct positions for the current screen size.
     * Called on resize and at the start of getAnnouncementTimeline().
     */
    public layout(): void {
        super.layout();
    }    

    /**
     * Entrance animation — elements are already in final positions (via layout()),
     * tweened FROM their hidden/off-screen start states.
     * progress(1).kill() leaves everything correctly positioned.
     */
    public getAnnouncementTimeline(): gsap.core.Timeline {
        this.layout();
        // The panel sliding in (handled by the scene) is the announcement.
        // No inner animation needed — content is visible when the panel arrives.
        return gsap.timeline();
    }

    /**
     * JOKER_EVALUATE — steal-specific choreography.
     * Scene-level staging (overlay slideoff, active player, victim slide-in) has already run.
     * This timeline handles only the steal-specific animation: tile reveal, outcome text, icon transfer.
     * Returns an unpaused timeline so it can be embedded into the scene's master timeline.
     */
    public getEvaluateTimeline(evaluateData: any): gsap.core.Timeline {
        const tl = gsap.timeline();
        const scene = this.scene as ThreeHostScene;

        const data = { ...this.actionData, ...evaluateData };

        const activePlayer = scene.players.get(data.playerSID);
        const victimPlayer = scene.players.get(data.fromSID);
        const targetCard   = scene.cards[data.pos];

        if (!activePlayer || !targetCard) {
            console.error('StealHostAction::getEvaluateTimeline — missing entities', { data });
            return tl;
        }

        // 1. Reveal the targeted tile on the grid
        tl.add(() => { targetCard.flip(data.jokerResult.tileType, true, 0.5); });

        // 2. Pop outcome text above the card
        const resultText = scene.add.text(0, 0,
            data.jokerResult.result === 'steal' ? 'STEAL!' : 'FAILED!',
            { fontFamily: 'Titan One', fontSize: '60px',
              color: data.jokerResult.result === 'steal' ? '#ff0000' : '#aaaaaa',
              stroke: '#000000', strokeThickness: 8 }
        ).setOrigin(0.5).setAlpha(0).setScale(0);
        tl.add(() => {
            scene.gridContainer.add(resultText);
            resultText.setPosition(targetCard.x, targetCard.y);
        });
        tl.to(resultText, { y: '-=120', scale: 1, alpha: 1, duration: 0.5, ease: 'back.out' }, '+=0.2');
        tl.to(resultText, { alpha: 0, duration: 0.5, ease: 'power2.in' }, '+=1.5');
        tl.add(() => resultText.destroy());

        // 3. Transfer the tile icon between the two players
        if (data.jokerResult.result === 'steal' && victimPlayer) {
            tl.add(() => {
                victimPlayer.loseCollectedIcon(data.jokerResult.tileType, data.pos);
                activePlayer.addCollectedIcon(data.jokerResult.tileType, data.pos, data.jokerResult.newTileCount);
            }, '+=0.3');
        }

        // 4. Flip the tile back face-down
        tl.add(() => { targetCard.flip('', false, 0.5); }, '+=0.2');

        // 5. Remove the joker icon from the active player's grid
        tl.add(() => { activePlayer.loseCollectedIcon('joker', 0); }, '+=0.1');

        return tl;
    }
}
