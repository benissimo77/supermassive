import { BaseScene } from 'src/BaseScene';

export class SelectionSlot extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.NineSlice;
    private highlight: Phaser.GameObjects.NineSlice;

    // sessionID holds the player sessionID assigned to this slot
    // Used to place a player inside this slot and then animate the slot
    private sessionID: string;

    constructor(scene: BaseScene, width: number, height: number) {
        super(scene, 0, 0);

        // Standard background slot
        this.bg = scene.add.nineslice(
            0, 0,
            'selection-slot',
            undefined,
            width, height,
            32, 32, 32, 32
        ).setOrigin(0.5).setTint(0xaaaaaa);

        // Highlight layer (using the hover/correct state)
        this.highlight = scene.add.nineslice(
            0, 0,
            'selection-slot-highlight',
            undefined,
            width, height,
            32, 32, 32, 32
        ).setOrigin(0.5).setVisible(false);

        this.add([this.bg, this.highlight]);
        
        scene.add.existing(this);
    }

    public setSessionID(sessionID: string): void {
        this.sessionID = sessionID;
    }
    public getSessionID(): string {
        return this.sessionID;
    }
    
    public setHighlighted(active: boolean): void {
        this.highlight.setVisible(active);
    }

    public setAnchorLeft(): this {
        this.bg.setOrigin(0, 0.5);
        this.highlight.setOrigin(0, 0.5);
        return this;
    }

    public setSize(width: number, height: number): this {
        super.setSize(width, height);
        this.bg.setSize(width, height);
        this.highlight.setSize(width, height);
        return this;
    }
}
