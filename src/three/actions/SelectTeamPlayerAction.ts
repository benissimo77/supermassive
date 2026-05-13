import Phaser from 'phaser';
import BasePlayerAction from './BasePlayerAction';
import { ThreePlayer } from '../ThreePlayer';
import { BaseScene } from 'src/BaseScene';

export default class SelectTeamPlayerAction extends BasePlayerAction {

    private actionTitle: Phaser.GameObjects.Text;
    private buttons: ThreePlayer[] = [];
    
    // Scrolling vars
    private scrollContainer: Phaser.GameObjects.Container;
    private isDragging: boolean = false;
    private startPointerPos = { x: 0, y: 0 };
    private startContainerPos = { x: 0, y: 0 };
    private bounds = { min: 0, max: 0 };
    private selectedTeamID: string | null = null;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {      
        super(scene, x, y, actionData);
    }

    public initialize(): void {
        console.log('SelectTeamPlayerAction Initializing with targets:', this.actionData.teamlist);

        let headerLabel = 'CHOOSE A TEAM';
        if (this.actionData.jokerType === 'steal') headerLabel = 'STEAL FROM:'; 
        if (this.actionData.jokerType === 'freeze') headerLabel = 'FREEZE WHO?';
        if (this.actionData.jokerType === 'gift')   headerLabel = 'GIFT TO:';

        this.actionTitle = this.scene.add.text(0, 0, headerLabel, {
            fontFamily: 'Titan One',
            fontSize: '48px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.add(this.actionTitle);

        this.scrollContainer = this.scene.add.container(0, 0);
        this.add(this.scrollContainer);

        // Build the buttons mapping to player panels
        if (this.actionData.teamlist && Array.isArray(this.actionData.teamlist)) {

            this.actionData.teamlist.forEach((target: any, index: number) => {
                const playerUI = new ThreePlayer(this.scene, target);

                this.scrollContainer.add(playerUI);
                this.buttons.push(playerUI);
            });
        }

        this.setupDragEvents();

        this.makeInteractive();

        // Add strictly positioned base footer controls.
        // Initially invisible/disabled until a selection is made.
        this.createFooterControls();
        this.submitButton?.setAlpha(0).disableInteractive();
        this.resetButton?.setAlpha(0).disableInteractive();
    }

    private setupDragEvents(): void {
        const onPointerDown = (pointer: Phaser.Input.Pointer) => {
            this.isDragging = false;
            this.startPointerPos = { x: pointer.x, y: pointer.y };
            this.startContainerPos = { x: this.scrollContainer.x, y: this.scrollContainer.y };
        };

        const onPointerMove = (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown) return;
            
            const dx = pointer.x - this.startPointerPos.x;
            const dy = pointer.y - this.startPointerPos.y;

            // Threshold of 10 pixels to consider it a drag rather than a sloppy tap
            if (!this.isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                this.isDragging = true;
            }

            if (this.isDragging) {
                if (this.scene.isPortrait()) {
                    let newY = this.startContainerPos.y + dy;
                    if (newY > this.bounds.max) newY = this.bounds.max;
                    if (newY < this.bounds.min) newY = this.bounds.min;
                    this.scrollContainer.y = newY;
                } else {
                    let newX = this.startContainerPos.x + dx;
                    if (newX > this.bounds.max) newX = this.bounds.max;
                    if (newX < this.bounds.min) newX = this.bounds.min;
                    this.scrollContainer.x = newX;
                }
            }
        };

        this.scene.input.on('pointerdown', onPointerDown);
        this.scene.input.on('pointermove', onPointerMove);

        // Clean up events when this action is destroyed/removed
        this.on('destroy', () => {
            this.scene.input.off('pointerdown', onPointerDown);
            this.scene.input.off('pointermove', onPointerMove);
        });
    }

    private makeInteractive(): void {
        this.buttons.forEach(btn => {
            btn.makeInteractive(() => {
                if (this.isDragging) return; // Prevent click if we were just dragging
                this.onTeamSelected((btn as any).playerConfig.sessionID);
            });
        });
    }

    public render(): void {
        if (this.actionTitle) {
            this.actionTitle.setPosition(960, this.scene.getY(150));
        }

        this.scrollContainer.setPosition(0, 0);
        this.bounds = { min: 0, max: 0 };

        // Grid: 4 columns × 2 rows in landscape, 2 columns × 4 rows in portrait
        const cols = this.scene.isPortrait() ? 2 : 4;

        // ThreePlayer natural card dimensions in logical units
        const PLAYER_W = 560;
        const PLAYER_H = 360;
        const GAP = 40;

        // Scale so that `cols` players + gaps fill the 1920-wide logical canvas
        const playerScale = (1920 - (cols - 1) * GAP) / (cols * PLAYER_W);

        const CELL_W = (PLAYER_W + GAP) * playerScale;
        const CELL_H = (PLAYER_H + GAP) * playerScale;

        // Centre the grid horizontally at x=960.
        // ThreePlayer's origin is NOT the card centre — battleSlotBg starts at x=-40 with origin(0,0.5),
        // so the card centre in player-local space is at x = -40 + 560/2 = 240.
        // In world space that offset is 240 * playerScale, which we subtract to align card centres.
        const CARD_CENTER_OFFSET_X = (-40 + PLAYER_W / 2) * playerScale; // = 240 * playerScale
        const startX = 960 - ((cols - 1) / 2) * CELL_W - CARD_CENTER_OFFSET_X;
        const startY = this.scene.getY(300);

        this.buttons.forEach((playerUI, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            playerUI.setScale(playerScale);
            playerUI.setPosition(startX + col * CELL_W, startY + row * CELL_H);
        });

        this.layoutFooterControls();
    }

    private onTeamSelected(targetSID: string): void {
        console.log(`SelectTeamPlayerAction: Chose target ${targetSID}`);       

        this.selectedTeamID = targetSID;

        // Visual feedback: deselect all, then select the chosen one
        this.buttons.forEach(btn => {
            btn.setSelected((btn as any).playerConfig.sessionID === targetSID);
        });

        // Determine if we need to show submit or auto-advance
        if (this.actionData.autoAdvance) {
            this.handleSubmit();
        } else {
            // Show the standard footer
            this.scene.tweens.add({
                targets: [this.submitButton, this.resetButton],
                alpha: 1,
                duration: 200,
                onComplete: () => {
                    this.submitButton.setInteractive({ useHandCursor: true });
                    this.resetButton.setInteractive({ useHandCursor: true });
                }
            });
        }
    }

    protected handleReset(): void {
        this.selectedTeamID = null;
        
        // Restore avatars
        this.buttons.forEach(btn => btn.setHighlighted(false));

        // Hide footer
        this.submitButton.setAlpha(0).disableInteractive();
        this.resetButton.setAlpha(0).disableInteractive();
    }

    protected handleSubmit(): void {
        if (!this.selectedTeamID) return;

        this.disableFooterControls();

        if (this.actionCallback) {
            this.actionCallback({
                answer: { teams: [this.selectedTeamID] },
                jokerType: this.actionData.jokerType
            });
        }

        const tl = gsap.timeline();
        if (this.submitButton) {
            tl.to(this.submitButton, { y: this.scene.getY(2160), duration: 0.5, ease: 'back.in' });
        }
        if (this.resetButton) {
            tl.to(this.resetButton, { y: this.scene.getY(2160), duration: 0.5, ease: 'back.in' }, "<");
        }
        tl.add(() => {
            this.scene.soundManager.playFX('submit-answer');
        }, "<+0.25");

        tl.addLabel('buttonsOut');
        for (const btn of this.buttons) {
            tl.to(btn, { y: this.scene.getY(2160), duration: 0.5, ease: 'back.in' }, "buttonsOut");
        }

        if (this.actionTitle) {
            tl.to( this.actionTitle, { y: "-=1080", duration:0.5, ease:'back.in' });
        }
    }
}
