import { ThreeHostScene } from 'src/three/ThreeHostScene';

/**
 * Interface acting as a simple Factory for mapping the server's requested UI
 * to the correct Phaser Container for Joker interventions.
 */
import StealHostAction from './StealHostAction';
import PassHostAction from './PassHostAction';
import ShuffleHostAction from './ShuffleHostAction';
import GiftHostAction from './GiftHostAction';
import FreezeHostAction from './FreezeHostAction';

export default class ThreeHostActionFactory {
    private scene: ThreeHostScene;

    constructor(scene: ThreeHostScene) {
        this.scene = scene;
    }

    public create(actionData: any): any {
        const type = actionData.jokerType || 'unknown';

        switch (type) {
            case 'steal':
                return new StealHostAction(this.scene, 0, 0, actionData);

            case 'pass':
                return new PassHostAction(this.scene, 0, 0, actionData);

            case 'shuffle':
                return new ShuffleHostAction(this.scene, 0, 0, actionData);

            case 'gift':
                return new GiftHostAction(this.scene, 0, 0, actionData);

            case 'freeze':
                return new FreezeHostAction(this.scene, 0, 0, actionData);
            
            default:
                console.warn(`ThreeHostActionFactory: Unknown action type: ${type}`);
                return null;
        }
    }
}
