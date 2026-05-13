import { gsap } from 'gsap';
import BaseHostAction from './BaseHostAction';
import { ThreeHostScene } from 'src/three/ThreeHostScene';

export default class GiftHostAction extends BaseHostAction {

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

        const titleText = scene.add.text(PANEL_X, this.scene.getY(120), 'GIFT!', {
            fontFamily: 'Titan One',
            fontSize: '64px',
            color: '#44ff88',
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
                    { fontFamily: 'Titan One', fontSize: '40px', color: '#ffffff', stroke: '#005500', strokeThickness: 3 }
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
     * JOKER_EVALUATE — gift choreography.
     * Reveals the gifted tile, animates it moving from the gifter (slot 0) to the recipient (slot 1),
     * then transfers the collected icon between the two players.
     */
    public getEvaluateTimeline(evaluateData: any): gsap.core.Timeline {
        const tl = gsap.timeline();
        const scene = this.scene as ThreeHostScene;
        const data = { ...this.actionData, ...evaluateData };

        const activePlayer = scene.players.get(data.playerSID);   // gifter
        const recipientPlayer = scene.players.get(data.toSID);    // recipient
        const targetCard = scene.cards[data.pos];

        if (!activePlayer || !targetCard) {
            console.error('GiftHostAction::getEvaluateTimeline — missing entities', { data });
            return tl;
        }

        // 1. Reveal the gifted tile briefly
        tl.add(() => { targetCard.flip(data.jokerResult.tileType, true, 0.5); });

        // 2. Pop outcome text
        const label = data.jokerResult.result === 'gift' ? 'GIFTED!' : 'FAILED!';
        const labelColor = data.jokerResult.result === 'gift' ? '#44ff88' : '#aaaaaa';
        const resultText = scene.add.text(0, 0, label, {
            fontFamily: 'Titan One', fontSize: '60px',
            color: labelColor, stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0).setScale(0);
        tl.add(() => {
            scene.gridContainer.add(resultText);
            resultText.setPosition(targetCard.x, targetCard.y);
        });
        tl.to(resultText, { y: '-=120', scale: 1, alpha: 1, duration: 0.5, ease: 'back.out' }, '+=0.2');
        tl.to(resultText, { alpha: 0, duration: 0.5, ease: 'power2.in' }, '+=1.5');
        tl.add(() => resultText.destroy());

        // 3. Transfer the icon between players (gifter loses, recipient gains)
        if (data.jokerResult.result === 'gift') {
            tl.add(() => {
                activePlayer.loseCollectedIcon(data.jokerResult.tileType, data.pos);
                if (recipientPlayer) {
                    recipientPlayer.addCollectedIcon(data.jokerResult.tileType, data.pos, data.jokerResult.recipientNewTileCount);
                }
            }, '+=0.3');
        }

        // 4. Flip tile face-down
        tl.add(() => { targetCard.flip('', false, 0.5); }, '+=0.2');

        // 5. Remove joker from active player
        tl.add(() => { activePlayer.loseCollectedIcon('joker', 0); }, '+=0.1');

        return tl;
    }
}
