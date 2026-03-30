import { BaseScene } from 'src/BaseScene';

export class LobbyHUDScene extends BaseScene {

    constructor() {
        super({ key: 'LobbyHUDScene' });
    }

    init() {
        super.init();
    }

    create() {
        this.add.text(960, this.getY(540), 'LobbyHUDScene');
    }


    // These functions must be present for any scene that extends BaseScene
    // BaseScene needed for the getY function and other misc helper functions
    getPlayerBySessionID(sessionID: string): Phaser.GameObjects.Container {
        return new Phaser.GameObjects.Container(this, 0,0, []);
    }
    render() {

    }
    protected sceneShutdown(): void {
        
    }
}
