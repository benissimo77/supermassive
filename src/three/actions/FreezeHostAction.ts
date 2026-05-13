import { gsap } from 'gsap';
import BaseHostAction from './BaseHostAction';
import { ThreeHostScene } from 'src/three/ThreeHostScene';
import { ThreePlayer } from 'src/three/ThreePlayer';

export default class FreezeHostAction extends BaseHostAction {

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

        const titleText = scene.add.text(PANEL_X, this.scene.getY(120), 'FREEZE!', {
            fontFamily: 'Titan One',
            fontSize: '64px',
            color: '#44ccff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        this.add(titleText);

        if (actionData.jokerRules && Array.isArray(actionData.jokerRules)) {
            actionData.jokerRules.forEach((rule: string, index: number) => {
                const ruleText = scene.add.text(
                    PANEL_X - PANEL_WIDTH / 2 + 40,
                    this.scene.getY(240 + (index * 140)),
                    rule,
                    { fontFamily: 'Titan One', fontSize: '40px', color: '#ffffff', stroke: '#003355', strokeThickness: 3 }
                ).setOrigin(0).setLineSpacing(10).setWordWrapWidth(PANEL_WIDTH - 80);
                this.add(ruleText);
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
     * JOKER_EVALUATE — freeze choreography.
     * The frozen player is already in slot 1 (slid in by the generic host scene logic).
     * Flash them with a cold blue pulse to confirm the freeze, then show a "FROZEN!" label.
     */
    public getEvaluateTimeline(evaluateData: any): gsap.core.Timeline {
        const tl = gsap.timeline();
        const scene = this.scene as ThreeHostScene;
        const data = { ...this.actionData, ...evaluateData };

        const activePlayer = scene.players.get(data.playerSID) as ThreePlayer;
        const frozenPlayer = scene.players.get(data.fromSID) as ThreePlayer;

        // 1. Flash frozen player with a cold blue tint (scale + alpha pulse)
        if (frozenPlayer) {
            tl.to(frozenPlayer, {
                alpha: 0.3, duration: 0.2, ease: 'power2.inOut',
                onComplete: () => { gsap.to(frozenPlayer, { alpha: 1, duration: 0.2 }); }
            });
            tl.to(frozenPlayer, {
                alpha: 0.3, duration: 0.2, ease: 'power2.inOut',
                onComplete: () => { gsap.to(frozenPlayer, { alpha: 0.5, duration: 0.3 }); }
            }, '+=0.1');
            // Leave the frozen player at reduced alpha so they look "frozen"
        }

        // 2. FROZEN! label above the frozen player's slot
        const resultText = scene.add.text(360, scene.getY(500), 'FROZEN!', {
            fontFamily: 'Titan One', fontSize: '72px',
            color: '#44ccff', stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0).setScale(0);
        tl.add(() => { scene.battleContainer.add(resultText); });
        tl.to(resultText, { scale: 1, alpha: 1, duration: 0.5, ease: 'back.out' }, '+=0.2');
        tl.to(resultText, { alpha: 0, duration: 0.4, ease: 'power2.in' }, '+=1.5');
        tl.add(() => resultText.destroy());

        // 3. Remove joker from active player
        tl.add(() => { activePlayer?.loseCollectedIcon('joker', 0); }, '+=0.1');

        return tl;
    }
}
