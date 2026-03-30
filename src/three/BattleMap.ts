import { BaseScene } from 'src/BaseScene';

export class BattleMap extends Phaser.GameObjects.Container {

    public scene: BaseScene;
    private bg: Phaser.GameObjects.NineSlice;
    private iconsRevealed: Phaser.GameObjects.Image[];
    private currentSlot:number;

    constructor(scene: BaseScene, width: number, height: number) {
        super(scene, 0, 0);
        this.scene = scene;

        // Standard background slot
        this.bg = this.scene.add.nineslice(
            0, 0,
            'selection-slot',
            undefined,
            32, 32, 32, 32
        ).setOrigin(0, 0.5).setSize(width, height).setTint(0xaaaaaa);
        this.add(this.bg);
        
        // Battle Map label
        const battleMapLabelConfig = {
            fontFamily: 'Titan One',
            fontSize: 32,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2
        };
        const battleMapLabel = this.scene.add.text(40, - height/2 + 40, 'Battle Map', battleMapLabelConfig);
        this.add(battleMapLabel);

        this.iconsRevealed = [];
        this.resetBattleMap();
        
    }

    public resetBattleMap():void {

        this.currentSlot = 0;
        this.iconsRevealed.forEach(icon => {
            icon.destroy();
        });
        this.iconsRevealed = [];
        this.addIconSlots();
    }

    private addIconSlots() {
        // Add the 6 slots for the icons won during this turn of battle
        for (let i = 0; i < 6; i++) {
            let slotType = 'selection-slot';
            if (i == 2 || i == 3) {
                slotType = 'selection-slot-highlight';
            }
            const slot: Phaser.GameObjects.Image = this.scene.add.image(
                40 + 36 + i * 72, 16,
                slotType,
                undefined
            ).setOrigin(0.5).setDisplaySize(60, 60);
            this.add(slot);
        }
    }

    public iconRevealed(iconKey: string): void {
        if (this.currentSlot >= 6) {
            console.warn('BattleMap:: All slots are already revealed');
            return;
        }
        const icon = this.scene.add.image(
            40 + 36 + this.currentSlot * 72, 16,
            iconKey
        ).setOrigin(0.5).setDisplaySize(60, 60);
        this.add(icon);
        this.iconsRevealed.push(icon);

        this.scene.tweens.add({
            targets: icon,
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Power2.easeIn'
        });

        // Juice - when icon slot is either 3 or 4 we are looking at a new turn - add an effect to highlight this
        if (this.currentSlot == 2 || this.currentSlot == 3) {
            const highlight: Phaser.GameObjects.Image = this.scene.add.image(40 + 36 + this.currentSlot * 72, 16,
                'highlight'
            ).setOrigin(0.5).setDisplaySize(60, 60);
            this.add(highlight);
        }

        this.currentSlot++;
    }

}
