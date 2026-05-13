import Phaser from 'phaser';
import { gsap } from "gsap";

import { BaseScene } from 'src/BaseScene';
import BasePlayerAction from './BasePlayerAction';
import { ThreeChip } from "../ThreeChip";
import { ThreeCard } from "../ThreeCard";

export default class SelectTilesPlayerAction extends BasePlayerAction {

    private maxTiles: number = 0;
    private currentSelection: number = 0;
    private selectionList: number[] = [];

    private actionTitle: Phaser.GameObjects.Text;

    private gridContainer: Phaser.GameObjects.Container;
    private selectionChips: ThreeChip[] = [];
    private cards: ThreeCard[] = [];
    private myHand: Set<number> = new Set();
    
    // The grid is always 6x6 max. In the future, we could receive this from the server.
    private readonly GRID_SIZE = 6;
    private readonly CARD_SIZE = 180;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {
        super(scene, x, y, actionData);
    }

    public initialize(): void {
        console.log('SelectTilesPlayerAction Initializing with data:', this.actionData);

        // Figure out how many selections are allowed
        // Support either standard quiz/question architecture or pure joker action logic lengths
        if (this.actionData.tiles !== undefined) {
             this.maxTiles = this.actionData.tiles;
        } else if (this.actionData.scores && this.scene.mySessionID && this.actionData.scores[this.scene.mySessionID] !== undefined) {
             // Clean payload structure uses direct scores mapping
             this.maxTiles = this.actionData.scores[this.scene.mySessionID];
        }

        // Title
        let headerLabel = 'CHOOSE TILES';
        if (this.actionData.title) {
            headerLabel = this.actionData.title.toUpperCase();
        } else if (this.actionData.jokerType) {
            headerLabel = `PLAY JOKER: CHOOSE ${this.maxTiles}`;
        }

        this.actionTitle = this.scene.add.text(0, 0, headerLabel, {
            fontFamily: 'Titan One',
            fontSize: '48px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.add(this.actionTitle);

        // Build the central layout containers
        this.gridContainer = this.scene.add.container(0, 0);
        this.add(this.gridContainer);

        this.createGrid();
        this.createSelectionChips();

        // Control Buttons
        this.createFooterControls();
    }

    public render(): void {
        const centerX = 960;
        
        // Ensure scale is correct logic-wise
        const physicalScale = this.scene.getPhysicalScale();

        if (this.actionTitle) {
            this.actionTitle.setPosition(centerX, this.scene.getY(120));
        }

        // We center the grid based on portrait/landscape rules, similar to the original question logic
        this.gridContainer.setPosition(centerX, this.scene.getY(540));
        
        if (this.scene.isPortrait()) {
            // scale based on total width - camera zoom fixes width at 1920px
            const maxGridWidth = this.GRID_SIZE * this.CARD_SIZE;
            const scale = 1920 / maxGridWidth;
            this.gridContainer.setScale(scale);
        } else {
            // landscape uses height
            const scale = 1080 * this.scene.getScaleFactor() / (this.GRID_SIZE * this.CARD_SIZE);
            this.gridContainer.setScale(scale * 0.9); // Shrink slightly to fit buttons nicely
        }

        this.layoutFooterControls();

        // Align chips top right corner
        if (this.selectionChips.length > 0) {
            this.selectionChips.forEach((chip, i) => {
                chip.setPosition(centerX - 800 + (i * 96), this.scene.getY(120));
            });
        }
    }

    protected handleSubmit(): void {
        let answer = this.selectionList;

        // Prevent submission if not enough tiles selected
        if (this.currentSelection < this.maxTiles) {
            console.warn(`Need ${this.maxTiles} selections to submit`); // Maybe highlight chips?
            // Could add warning visual here
            return;
        }

        this.disableFooterControls();

        // Pass response back to ThreePlayScene to be emitted
        if (this.actionCallback) {
            this.actionCallback({
                answer: { tiles: answer },
            });
        }

        // Juice - animate the elememts out
        const tl = gsap.timeline();
        if (this.submitButton) {
            tl.to(this.submitButton, { y: this.scene.getY(2160), duration: 0.5, ease: 'back.in' });
        }
        if (this.resetButton) {
            tl.to(this.resetButton, { y: this.scene.getY(2160), duration: 0.5, ease: 'back.in' }, "<");
        }
        tl.to(this.gridContainer, { y: this.scene.getY(2160), duration: 0.5, ease: 'back.in' }, "<");

        tl.add(() => {
            this.scene.soundManager.playFX('submit-answer');
        }, "<+0.25");
        tl.play();

        if (this.actionTitle) {
            tl.to(this.actionTitle, { y: "-=1080", duration: 0.5, ease: 'back.in'} );
        }
        this.selectionChips.forEach( (chip) => {
            tl.to( chip, { y: "-=1080", duration: 0.5, ease: 'back.in'}, "<" );
        });


    }

    protected handleReset(): void {
        this.currentSelection = 0;
        this.selectionList = [];
        this.cards.forEach(c => {
            c.setSelection(0);
        });
        this.selectionChips.forEach(c => {
            c.setSelection(0);
        });
        
    }

    private createGrid(): void {
        this.cards.forEach(c => c.destroy());
        this.cards = [];

        // Populate hand from the server-provided myHand array (only this player's own tiles)
        this.myHand = new Set<number>();
        if (this.actionData.myHand) {
            (this.actionData.myHand as number[]).forEach((idx: number) => this.myHand.add(idx));
        }

        // Master grid defines what represents which index
        const masterGrid = this.actionData.grid || [];

        for (let x = 0; x < this.GRID_SIZE; x++) {
            for (let y = 0; y < this.GRID_SIZE; y++) {
                const index = x * this.GRID_SIZE + y;
                const posX = (x - (this.GRID_SIZE - 1) / 2) * this.CARD_SIZE;
                const posY = (y - (this.GRID_SIZE - 1) / 2) * this.CARD_SIZE;                
                
                const card = new ThreeCard(this.scene, posX, posY, 'card_back', index);
                card.on('card-clicked', (pos: number) => this.cardClicked(pos));
                
                this.gridContainer.add(card);
                this.cards.push(card);

                // Reveal players selected tiles
                const isOwnedByMe = this.myHand.has(index);
                const tileType = masterGrid[index] || 'joker';
                if (isOwnedByMe) {
                    card.flip(tileType, true, 0).play(); // Reveal without interact trigger
                }

            }
        }
    }

    private cardClicked(pos: number): void {
        if (this.currentSelection < this.maxTiles && !this.selectionList.includes(pos) && this.cards[pos].getIconType() !== 'joker') {
            this.cards[pos].setSelection(this.currentSelection + 1);
            this.selectionChips[this.currentSelection].setSelection(this.currentSelection + 1);
            this.selectionList.push(pos);
            this.currentSelection++;
        }
    }

    private createSelectionChips(): void {
        for (let i = 0; i < this.maxTiles; i++) {
            const chip = new ThreeChip(this.scene, 0, 0); // Pos handled in render
            this.add(chip);
            this.selectionChips.push(chip);
        }
    }

    public destroy(fromScene: boolean = true): void {
        this.cards.forEach(c => c.destroy());
        this.selectionChips.forEach(c => c.destroy());
        super.destroy(fromScene);
    }
}
