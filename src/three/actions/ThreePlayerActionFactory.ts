import Phaser from 'phaser';

import SelectTeamPlayerAction from './SelectTeamPlayerAction';
import SelectTilesPlayerAction from './SelectTilesPlayerAction';
import TeamTileWizardPlayerAction from './TeamTileWizardPlayerAction';

export default class ThreePlayerActionFactory {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public create(actionData: any): any {
        const type = actionData.ui || 'unknown';

        switch (type) {
            case 'select-team':
                return new SelectTeamPlayerAction(this.scene as any, 0, 0, actionData);

            case 'select-tiles':
                return new SelectTilesPlayerAction(this.scene as any, 0, 0, actionData);
                
            case 'team-tile-wizard':
                return new TeamTileWizardPlayerAction(this.scene as any, 0, 0, actionData);

            default:
                console.warn(`ThreePlayerActionFactory: Unknown player action UI type: ${type}`);
                return null;
        }
    }
}
