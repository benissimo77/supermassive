import Phaser from 'phaser';
import { BaseScene } from 'src/BaseScene';
import BaseHostAction from './BaseHostAction';

export default class StealHostAction extends BaseHostAction {
    
    private titleText: Phaser.GameObjects.Text;
    private jokerOverlay: Phaser.GameObjects.Rectangle;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {
        super(scene, x, y, actionData);
        
        const PANEL_HEIGHT = 1040;
        const PANEL_WIDTH = 1320;
        
        // Dark overlay panel over the grid
        // Action container is anchored at (1280, 540). We want to center the
        this.jokerOverlay = scene.add.rectangle(0,0, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.8).setOrigin(0.5);
        this.add(this.jokerOverlay);

        // Background joker image over the overlay
        const jokerBackground = scene.add.image(0, 0, 'joker-white')
            .setOrigin(0.5)
            .setDisplaySize(800, 800)
            .setAlpha(0.05);
        this.add(jokerBackground);

        // Add the joker icon top left of the panel
        // const jokerIcon = scene.add.image(PANEL_WIDTH / 2 - 64, PANEL_HEIGHT / 2 - 64, 'joker')
        //     .setOrigin(0.5)
        //     .setDisplaySize(160, 160);
        // this.add(jokerIcon);

        // // Add a jokerType specific icon on the opposite corner
        // const jokerTypeIcon = scene.add.image(-PANEL_WIDTH / 2 + 64, -PANEL_HEIGHT / 2 + 64, 'icon_1')
        //     .setOrigin(0.5)
        //     .setDisplaySize(140, 140);
        // this.add(jokerTypeIcon);

        // Setup typography header based on joker type
        const jokerTitleConfig = {
            fontFamily: 'Titan One',
            fontSize: '72px',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        };

        this.titleText = scene.add.text(0, -PANEL_HEIGHT / 2 + 128, 'STEAL!', jokerTitleConfig).setOrigin(0.5);
        this.add(this.titleText);
        this.titleText.setScale(0);
        this.scene.tweens.add({
            targets: this.titleText,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // If server sent rules, parse them to the bottom left
        if (actionData.jokerRules && Array.isArray(actionData.jokerRules)) {
            const jokerRulesConfig = {
                fontFamily: 'Titan One',
                fontSize: '44px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            };
            actionData.jokerRules.forEach((rule: string, index: number) => {
                const ruleText = scene.add.text(-PANEL_WIDTH / 2 + 180, -PANEL_HEIGHT / 2 + 240 + (index * 160), rule, jokerRulesConfig)
                    .setOrigin(0)
                    .setLineSpacing(12)
                    .setWordWrapWidth(PANEL_WIDTH - 240);
                this.scene.time.delayedCall(800 + index * 800, () => {
                    this.add(ruleText);
                });
            });
        }
    }

    public render(): void {
        super.render();

        // We have designed entire action container around 1920x1080
        // Scale the entire container based on current screen height
        // Apply a small extra scaling to create a border around the overlay
        this.setScale(this.scene.getScaleFactor() );
    }
}
