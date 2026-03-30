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

                playerUI.makeInteractive(() => {
                    if (this.isDragging) return; // Prevent click if we were just dragging
                    this.onTeamSelected(target.sessionID);
                });

                this.scrollContainer.add(playerUI);
                this.buttons.push(playerUI);
            });
        }

        this.setupDragEvents();
        
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

    public render(): void {
        const centerX = 960;
        
        // Position title near the top of the interface
        if (this.actionTitle) {
            this.actionTitle.setPosition(centerX, this.scene.getY(150));
        }

        // Reset scroll position on layout change
        this.scrollContainer.setPosition(0, 0);
        this.bounds.max = 0;
        this.bounds.min = 0; // Disable scrolling metrics for now

        if (this.scene.isPortrait()) {
            
            const cellWidth = 480;
            const cellHeight = 150;
            
            // Calculate a safe scale where a 2-column grid will fit
            // (logical width is 1920 so 480 * 2 = 960... meaning it comfortably fits 2 columns at 1.0)
            const numAvatars = this.buttons.length;
            const columns = 2; // Always 2 columns in portrait
            
            // Layout starting coordinates
            const startY = this.scene.getY(300);
            
            // Calculate starting X to center the block of 2 columns
            const totalWidth = columns * cellWidth;
            const startX = centerX - (totalWidth / 2) + (cellWidth / 2);

            this.buttons.forEach((playerUI, index) => {
                const row = Math.floor(index / columns);
                const col = index % columns;
                
                // Keep the items moderately scaled
                // Avatars are 480picels wide so in portrait mode with a 2-column grid we want them to become more like ~800 pixels wide
                playerUI.setScale(800/480); 
                
                // We add some buffer to the xPos calculation so columns don't overlap as much
                const xPos = startX + (col * (cellWidth + 60)); 
                const yPos = startY + (row * cellHeight * 1.2 * this.scene.getPhysicalScale());
                playerUI.setPosition(xPos, yPos);
            });

        } else {
            // LANDSCAPE: Layout as a 3 or 4 column grid
            const cellWidth = 480;
            const cellHeight = 150;
            const columns = this.buttons.length > 6 ? 4 : 3;
            
            const startY = this.scene.getY(300);
            const totalWidth = columns * (cellWidth + 40);
            const startX = centerX - (totalWidth / 2) + (cellWidth / 2);

            this.buttons.forEach((playerUI, index) => {
                const row = Math.floor(index / columns);
                const col = index % columns;
                
                playerUI.setScale(1);
                
                const xPos = startX + (col * (cellWidth + 40)); // Small padding between columns
                const yPos = startY + (row * cellHeight * 1.5); // Space them out vertically
                playerUI.setPosition(xPos, yPos);
            });
        }
        
        // Layout any active footer pieces.
        this.layoutFooterControls();
    }

    private onTeamSelected(targetSID: string): void {
        console.log(`SelectTeamPlayerAction: Chose target ${targetSID}`);       

        this.selectedTeamID = targetSID;

        // Visual feedback: dim others, highlight selected
        this.buttons.forEach(btn => {
            if ((btn as any).playerConfig.sessionID === targetSID) {
                btn.setAlpha(1);
            } else {
                btn.setAlpha(0.4);
            }
        });

        // Determine if we need to show submit or auto-advance
        if (this.actionData.autoAdvance) {
            // Slight delay so the user registers their visual selection before the wizard slides away
            this.scene.time.delayedCall(400, () => {
                this.handleSubmit();
            });
        } else {
            // Show the standard footer
            this.scene.tweens.add({
                targets: [this.submitButton, this.resetButton],
                alpha: 1,
                duration: 200,
                onComplete: () => {
                    this.submitButton?.setInteractive({ useHandCursor: true });
                    this.resetButton?.setInteractive({ useHandCursor: true });
                }
            });
        }
    }

    protected handleReset(): void {
        this.selectedTeamID = null;
        
        // Restore avatars
        this.buttons.forEach(btn => btn.setAlpha(1));

        // Hide footer
        this.submitButton?.setAlpha(0).disableInteractive();
        this.resetButton?.setAlpha(0).disableInteractive();
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

        if (this.actionTitle) {
            this.actionTitle.setText("WAITING...");
        }
    }
}
