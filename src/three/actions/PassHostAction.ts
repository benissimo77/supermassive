import Phaser from 'phaser';
import { gsap } from 'gsap';
import BaseHostAction from './BaseHostAction';
import { ThreeHostScene } from 'src/three/ThreeHostScene';
import { ThreePlayer } from 'src/three/ThreePlayer';

export default class PassHostAction extends BaseHostAction {

    private titleText: Phaser.GameObjects.Text;
    private jokerOverlay: Phaser.GameObjects.Rectangle;

    constructor(scene: ThreeHostScene, x: number, y: number, actionData: any) {
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
        this.titleText = scene.add.text(PANEL_X, this.scene.getY(120), 'PASS!', {
            fontFamily: 'Titan One',
            fontSize: '64px',
            color: '#44aaff',
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

    public layout(): void {
        super.layout();
    }

    public getAnnouncementTimeline(): gsap.core.Timeline {
        this.layout();
        return gsap.timeline();
    }

    /**
     * JOKER_EVALUATE — pass-specific choreography.
     * Scene-level staging (panel slide-off, versusLabel update, victim slide-in) has already run.
     * For PASS the "victim" is the incoming team — scene slides them in just like for steal.
     * Here we just surface a brief text outcome confirming the swap.
     */
    public getEvaluateTimeline(evaluateData: any): gsap.core.Timeline {

        const BATTLESLOT_WIDTH = 560;
        const BATTLESLOT_HEIGHT = 360;
        const SLOT_X = 80;
        const SLOT_0_Y = 20 + 20 + 140; // top battle slot y
        const SLOT_1_Y = 20 + 20 + 140 + BATTLESLOT_HEIGHT + 20;

        const scene = this.scene as ThreeHostScene;
        const tl = gsap.timeline();

        const data = { ...this.actionData, ...evaluateData };

        const incomingPlayer:ThreePlayer = scene.players.get(data.toSID);
        const passingPlayer  = scene.players.get(data.fromSID);

        // Start by tweening the activePlayer OFF - they are no longer in the battle
        // We use width of 560 this is the width of the battleSlot (player + panel)
        if (passingPlayer) {
            tl.to(passingPlayer, {
                x: -BATTLESLOT_WIDTH,
                duration: 0.8,
                ease: 'power2.in',
                onComplete: () => {
                    this.scene.reparentObject(passingPlayer, this.scene.playerContainer);
                    passingPlayer.setHighlighted(false);
                    passingPlayer.setCardMode(false);
                    passingPlayer.setIconGridVisibility(false);
                }
            });
        }

        // We need to bring on the other battle team - but lets bring them directly into the correct slot (0 or 1)
        // So first we tween the new team into their correct position and then tween in their opponent
        // Incoming team is currently in battle slot 1 - check if we need to tween him to battle slot 0
        if (data.jokerResult?.battleTeams) {
            const incomingTeamIndex = data.jokerResult.battleTeams.findIndex((team: string[]) => team.includes(data.toSID));
            if (incomingTeamIndex === 0) {
                tl.to(incomingPlayer, {
                    x: SLOT_X,
                    y: SLOT_0_Y,
                    duration: 0.8,
                    ease: 'power2.out'
                });
            }

            const originalTeamIndex = data.jokerResult.battleTeams.findIndex((team: string[]) => !team.includes(data.toSID));
            const player:ThreePlayer = this.scene.getPlayerBySessionID(data.jokerResult.battleTeams[originalTeamIndex]);
            if (player) {
                player.setPosition(-BATTLESLOT_WIDTH, SLOT_0_Y + (originalTeamIndex * (BATTLESLOT_HEIGHT + 20)));
                tl.to(player, {
                    x: SLOT_X,
                    duration: 0.8,
                    ease: 'power2.out'
                });
            }

        }

        return tl;
    }
}
