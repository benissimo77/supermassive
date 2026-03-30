import Phaser from 'phaser';

/**
 * Interface acting as a simple Factory for mapping the server's requested UI
 * to the correct Phaser Container for Joker interventions.
 */
import StealHostAction from './StealHostAction';

export default class ThreeHostActionFactory {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public create(actionData: any): any {
        const type = actionData.jokerType || 'unknown';

        switch (type) {
            case 'steal':
                // Place at screen center (local to wherever the parent container is mapped)
                return new StealHostAction(this.scene, 0, 0, actionData);
            
            // Add other UI modes here as we build them (e.g. 'freeze')
            default:
                console.warn(`ThreeHostActionFactory: Unknown action type: ${type}`);
                return null;
        }
    }
}
