import Phaser from 'phaser';
import { gsap } from 'gsap';

import { BaseScene } from 'src/BaseScene';
import BasePlayerAction from './BasePlayerAction';
import SelectTeamPlayerAction from './SelectTeamPlayerAction';
import SelectTilesPlayerAction from './SelectTilesPlayerAction';
import { ThreePlayer } from '../ThreePlayer';

/**
 * A composite UI Wizard that links "Select Team" -> "Select Tiles".
 * Expected Data: { teamlist: [...], tiles: X }
 */
export default class TeamTileWizardPlayerAction extends BasePlayerAction {
    
    private teamStep!: SelectTeamPlayerAction;
    private tileStep!: SelectTilesPlayerAction;

    private selectedTeamID: string | null = null;
    private floatingAvatar: ThreePlayer | null = null;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {
        super(scene, x, y, actionData);
    }

    public initialize(): void {
        console.log('TeamTileWizardPlayerAction Initializing');

        // ==== STEP 1: TEAM SELECT ====
        // We tell the team select to auto-advance, acting as a fluid step 1
        const teamData = { 
            ...this.actionData, 
            autoAdvance: true,
            // Optional: override the title dynamically based on the Joker meaning
            title: this.actionData.jokerType === 'steal' ? "STEAL FROM WHO?"
                 : this.actionData.jokerType === 'gift'  ? "GIFT TO WHO?"
                 : "STEP 1: CHOOSE TEAM" 
        };
        this.teamStep = new SelectTeamPlayerAction(this.scene, 0, 0, teamData);
        
        // Intercept its output 
        this.teamStep.onAction((payload: any) => this.onTeamSelected(payload));
        this.teamStep.initialize();
        this.add(this.teamStep);


        // ==== STEP 2: TILE SELECT ====
        const step2Title = this.actionData.jokerType === 'gift' ? 'CHOOSE TILE TO GIFT' : 'STEP 2: CHOOSE TILES';
        const tileData = { 
            ...this.actionData, 
            title: step2Title
        };
        // Start this step wildly off-screen to the right
        this.tileStep = new SelectTilesPlayerAction(this.scene, 1920, 0, tileData);
        
        // Intercept its final submit...
        this.tileStep.onAction((payload: any) => this.onTilesSelected(payload));
        // ...and intercept its reset so we can slide backwards!
        this.tileStep.on('action-reset', () => this.goBackToTeams());
        
        this.tileStep.initialize();
        this.add(this.tileStep);
    }

    public render(): void {
        this.teamStep.render();
        this.tileStep.render();
    }

    private onTeamSelected(payload: any): void {
        this.selectedTeamID = payload.answer.teams[0];

        // Fluid Slide Transition
        gsap.to(this.teamStep, { x: -1920, duration: 0.5, ease: 'power2.inOut' });
        gsap.to(this.tileStep, { x: 0, duration: 0.5, ease: 'power2.inOut' });
        
        this.showFloatingAvatar();
    }

    /**
     * Shows a reminder of WHO you are stealing from/targeting over the tile grid.
     */
    private showFloatingAvatar(): void {
        const target = this.actionData.teamlist?.find((t: any) => t.sessionID === this.selectedTeamID);
        if (target && !this.floatingAvatar) {
            this.floatingAvatar = new ThreePlayer(this.scene, target);
            
            // Render it small at the top of the screen next to the chips
            this.floatingAvatar.setScale(this.scene.getPhysicalScale() * 0.6);
            this.floatingAvatar.setPosition(1920 / 2, this.scene.getY(320));
            this.add(this.floatingAvatar);
            
            this.floatingAvatar.setAlpha(0);
            gsap.to(this.floatingAvatar, { alpha: 1, duration: 0.5, delay: 0.4 });
        }
    }

    private destroyFloatingAvatar(): void {
        if (this.floatingAvatar) {
            gsap.to(this.floatingAvatar, { alpha: 0, duration: 0.3, onComplete: () => {
                this.floatingAvatar?.destroy();
                this.floatingAvatar = null;
            }});
        }
    }

    private goBackToTeams(): void {
        this.selectedTeamID = null;
        this.destroyFloatingAvatar();

        // Visually un-dim the avatars in Step 1
        this.teamStep.forceReset();

        // Reverse Slide Transition
        gsap.to(this.teamStep, { x: 0, duration: 0.5, ease: 'power2.inOut' });
        gsap.to(this.tileStep, { x: 1920, duration: 0.5, ease: 'power2.inOut' });
    }

    /**
     * Fired when the final Wizard SUBMIT button is clicked on Step 2.
     */
    private onTilesSelected(payload: any): void {
        if (!this.actionCallback || !this.selectedTeamID) return;

        // Bundle both answers beautifully according to our strict data contract
        this.actionCallback({
            answer: {
                teams: [this.selectedTeamID],
                tiles: payload.answer.tiles
            }
        });
    }

    public destroy(fromScene?: boolean): void {
        if (this.floatingAvatar) this.floatingAvatar.destroy();
        this.teamStep.destroy();
        this.tileStep.destroy();
        super.destroy(fromScene);
    }
}