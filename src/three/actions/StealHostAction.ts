import Phaser from 'phaser';
import { BaseScene } from 'src/BaseScene';
import { gsap } from 'gsap';
import BaseHostAction from './BaseHostAction';
import { ThreeSceneRefs } from 'src/three/ThreeSceneRefs';

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
    public getTimeline(refs: ThreeSceneRefs): gsap.core.Timeline {
        const data = this.actionData;
        const activePlayer = refs.players.get(data.playerSID);
        const victimPlayer = refs.players.get(data.fromSID);
        const targetCard = refs.cards[data.pos];

        const tl = gsap.timeline({ paused: true });

        if (!activePlayer || !victimPlayer || !targetCard) {
            console.error('StealHostAction::getTimeline — missing entities', { activePlayer, victimPlayer, targetCard });
            return tl;
        }

        // 1. Slide the battle container off-screen and bring the joker container's players into view
        tl.add(() => {}, '+=0.5');
        tl.to(refs.battleContainer, { x: -1280, duration: 0.8, ease: 'Back.easeIn(1.7)' }, '+=0.2');

        // 2. Reparent players into the joker container at fixed positions (synchronous, inside tl.add)
        tl.add(() => {
            refs.reparentObject(activePlayer, refs.gridContainer);
            activePlayer.setCardMode(false);
            activePlayer.x = 40 + 40;
            activePlayer.y = 140;

            refs.reparentObject(victimPlayer, refs.gridContainer);
            victimPlayer.setCardMode(false);
            victimPlayer.setIconGridVisibility(true);
            victimPlayer.x = 40;
            victimPlayer.y = 380;
        });

        // 3. Reveal the targeted tile
        tl.add(() => { targetCard.flip(data.tileType, true, 0.5); }, '+=0.1');

        // 4. Pop outcome text over the card
        const resultText = this.scene.add.text(0, 0,
            data.result === 'steal' ? 'STEAL!' : 'FAILED STEAL!',
            {
                fontFamily: 'Titan One', fontSize: '60px',
                color: data.result === 'steal' ? '#ff0000' : '#aaaaaa',
                stroke: '#000000', strokeThickness: 8
            }
        ).setOrigin(0.5).setAlpha(0).setScale(0);

        tl.add(() => {
            resultText.setPosition(targetCard.x, targetCard.y);
            refs.gridContainer.add(resultText);
        });
        tl.to(resultText, { y: '-=120', scale: 1, alpha: 1, duration: 0.5, ease: 'back.out' }, '+=0.1');
        tl.to(resultText, { alpha: 0, duration: 0.5, ease: 'power2.in' }, '+=1.5');
        tl.add(() => resultText.destroy());

        // 5. Transfer the tile on success
        if (data.result === 'steal') {
            tl.add(() => {
                victimPlayer.loseCollectedIcon(data.tileType, data.pos);
                activePlayer.addCollectedIcon(data.tileType, data.pos, data.newTileCount);
            }, '+=0.3');
        }

        // 6. Always flip the tile back face-down
        tl.add(() => { targetCard.flip('', false, 0.5); }, '+=0.2');

        // 7. Remove the joker icon from the active player's grid
        tl.add(() => { activePlayer.loseCollectedIcon('joker', 0); }, '+=0.1');

        // 8. Restore the battle UI — slide the joker overlay out, restore players, slide battle in
        tl.add(() => { refs.doBattleSetup().play(); });
        tl.to(refs.battleContainer, { x: 0, duration: 0.8, ease: 'back.out(1.7)' }, '<');

        return tl;
    }
}
