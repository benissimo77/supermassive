import Phaser from 'phaser';
import { BaseScene } from 'src/BaseScene';
import { NineSliceButton } from 'src/ui/NineSliceButton';

/**
 * Base UI Container for Player Mobile phones during general Actions.
 */
export default class BasePlayerAction extends Phaser.GameObjects.Container {    

    public scene: BaseScene;
    protected actionData: any;
    protected actionCallback: Function | null = null;
    
    // Standard Footer Controls
    protected submitButton: NineSliceButton;
    protected resetButton: NineSliceButton;

    constructor(scene: BaseScene, x: number, y: number, actionData: any) {      
        super(scene, x, y);
        this.scene = scene;
        this.actionData = actionData;

        this.submitButton = new NineSliceButton(this.scene, 'SUBMIT');
        this.submitButton.setButtonSize(320, 80);
        this.submitButton.setVisible(false);
        this.resetButton = new NineSliceButton(this.scene, 'RESET');
        this.resetButton.setButtonSize(320, 80);
        this.resetButton.setVisible(false);

        scene.add.existing(this);
    }

    /**
     * Instantiates the standard SUBMIT and RESET buttons for this action.
     * Hooks their tap events up to `handleSubmit` and `handleReset`.
     */
    protected createFooterControls(): void {

        this.submitButton.setVisible(true);
        this.submitButton.setInteractive({ useHandCursor: true });
        this.submitButton.on('pointerup', () => this.handleSubmit());

        this.resetButton.setVisible(true);
        this.resetButton.setInteractive({ useHandCursor: true });
        this.resetButton.on('pointerup', () => this.handleReset());

        this.add([ this.submitButton, this.resetButton ]);
    }

    /**
     * Positions the footer controls strictly on the bottom of the screen.
     * Use this in child `render()` functions.
     */
    protected layoutFooterControls(): void {

        const centerX = 960;
        
        if (this.scene.isPortrait()) {
            // Scale them to fit most of the bottom of the screen width
            this.resetButton.setScale(800 / this.resetButton.displayWidth);
            this.submitButton.setScale(800 / this.submitButton.displayWidth);
        } else {
            // Landscape is 1920pixels wide so 320 button size is about right
            this.resetButton.setScale(1);
            this.submitButton.setScale(1);
        }
        this.resetButton.setPosition(this.resetButton.displayWidth/2, this.scene.getY(1080) - this.resetButton.displayHeight / 2 );
        this.submitButton.setPosition(1920 - this.submitButton.displayWidth/2, this.scene.getY(1080) - this.submitButton.displayHeight / 2 );
    }

    /**
     * Lock/Unlock standard interaction.
     */
    protected disableFooterControls(): void {
        this.submitButton.removeAllListeners();
        this.submitButton.disableInteractive();
        this.resetButton.removeAllListeners();
        this.resetButton.disableInteractive();
    }

    /**
     * Set the callback for when an action payload is ready to be sent to the server.
     */
    public onAction(callback: Function): void {
        this.actionCallback = callback;
        this.setVisible(true);
    }

    // Lifecycle methods to be overridden
    public initialize(): void {}
    public render(): void {}
    
    // Abstract button hooks for children
    protected handleSubmit(): void {}
    protected handleReset(): void {}

    /**
     * Expose reset externally so complex wizards can force a sub-action to revert visually.
     */
    public forceReset(): void {
        this.handleReset();
    }

    public destroy(fromScene: boolean = true): void {
        if (this.submitButton) {
            this.submitButton.destroy();
            this.resetButton?.destroy();
        }
        super.destroy(fromScene);
    }
}
