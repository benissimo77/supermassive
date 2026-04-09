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

        const PANEL_HEIGHT = 1040;
        const PANEL_WIDTH = 1320;

        // Dark overlay panel centred over the grid area.
        // actionContainer is anchored at scene centre (1280, getY(540)).
        this.jokerOverlay = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.8).setOrigin(0.5);
        this.add(this.jokerOverlay);

        // Watermark joker image behind the title
        const jokerBackground = scene.add.image(0, 0, 'joker-white')
            .setOrigin(0.5)
            .setDisplaySize(800, 800)
            .setAlpha(0.05);
        this.add(jokerBackground);

        // Title — animates in via render()
        this.titleText = scene.add.text(0, -PANEL_HEIGHT / 2 + 128, 'STEAL!', {
            fontFamily: 'Titan One',
            fontSize: '72px',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setScale(0);
        this.add(this.titleText);

        // Display any server-supplied rules text beneath the title
        if (actionData.jokerRules && Array.isArray(actionData.jokerRules)) {
            actionData.jokerRules.forEach((rule: string, index: number) => {
                const ruleText = scene.add.text(
                    -PANEL_WIDTH / 2 + 180,
                    -PANEL_HEIGHT / 2 + 240 + (index * 160),
                    rule,
                    { fontFamily: 'Titan One', fontSize: '44px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }
                ).setOrigin(0).setLineSpacing(12).setWordWrapWidth(PANEL_WIDTH - 240);
                // Stagger rules in one-by-one
                this.scene.time.delayedCall(800 + index * 800, () => { this.add(ruleText); });
            });
        }
    }

    /**
     * JOKER state entry — show overlay + pop in the title.
     * Scale the container to fit the current screen height.
     */
    public render(): void {
        super.render();
        this.setScale(this.scene.getScaleFactor());
        gsap.to(this.titleText, { scale: 1, duration: 0.5, ease: 'back.out(1.7)' });
    }

    /**
     * JOKER_EVALUATE — full steal choreography.
     * Returns a paused timeline. The scene plays it and wires up host:response on onComplete.
     */
    public getTimeline(evaluateData: any): gsap.core.Timeline {
        const tl = gsap.timeline({ paused: true });
        const scene = this.scene as ThreeHostScene;

        // Merge joker-setup data (known at JOKER time) with evaluate results (known at JOKER_EVALUATE time)
        const data = { ...this.actionData, ...evaluateData };

        const activePlayer = scene.threePlayers.get(data.playerSID);
        const victimPlayer = scene.threePlayers.get(data.fromSID);
        const targetCard   = scene.cards[data.pos];

        if (!activePlayer || !victimPlayer || !targetCard) {
            console.error('StealHostAction::getTimeline — missing entities', { data });
            return tl;
        }

        // Slot positions in battleContainer local space (design-space, scale applied by container)
        const SLOT_X   = 80;
        const SLOT_1_Y = 20 + 20 + 140 + 360 + 20; // slot 1 — victim (active player is already at slot 0)

        // 0. Slide rules overlay back off-screen right, simultaneously reparent victim into slot 1.
        //    Active player is already in battleContainer slot 0 from JOKER setup.
        tl.add(() => {
            scene.reparentObject(victimPlayer, scene.battleContainer);
            victimPlayer.setCardMode(true);
            victimPlayer.setIconGridVisibility(true);
            // Start them off-screen below so they can tween up into position
            victimPlayer.x = SLOT_X;
            victimPlayer.y = SLOT_1_Y + 200;
        });
        tl.to(scene.actionContainer, { x: 1920 + 1280, duration: 0.8, ease: 'power2.inOut' });
        tl.to(victimPlayer, { y: SLOT_1_Y, duration: 0.6, ease: 'back.out(1.7)' }, '<+0.2');

        // 1. Reveal the targeted tile on the grid
        tl.add(() => { targetCard.flip(data.tileType, true, 0.5); }, '+=0.3');

        // 2. Pop outcome text above the card (in gridContainer local space)
        const resultText = scene.add.text(0, 0,
            data.result === 'steal' ? 'STEAL!' : 'FAILED STEAL!',
            { fontFamily: 'Titan One', fontSize: '60px',
              color: data.result === 'steal' ? '#ff0000' : '#aaaaaa',
              stroke: '#000000', strokeThickness: 8 }
        ).setOrigin(0.5).setAlpha(0).setScale(0);
        tl.add(() => {
            scene.gridContainer.add(resultText);
            resultText.setPosition(targetCard.x, targetCard.y);
        });
        tl.to(resultText, { y: '-=120', scale: 1, alpha: 1, duration: 0.5, ease: 'back.out' }, '+=0.2');
        tl.to(resultText, { alpha: 0, duration: 0.5, ease: 'power2.in' }, '+=1.5');
        tl.add(() => resultText.destroy());

        // 3. Transfer the tile icon between the two visible players
        if (data.result === 'steal') {
            tl.add(() => {
                victimPlayer.loseCollectedIcon(data.tileType, data.pos);
                activePlayer.addCollectedIcon(data.tileType, data.pos, data.newTileCount);
            }, '+=0.3');
        }

        // 4. Flip the tile back face-down
        tl.add(() => { targetCard.flip('', false, 0.5); }, '+=0.2');

        // 5. Remove the joker icon from the active player's grid
        tl.add(() => { activePlayer.loseCollectedIcon('joker', 0); }, '+=0.1');

        return tl;
    }
}
