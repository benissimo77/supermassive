import { BaseScene } from "./BaseScene";

export class PlayerConfig {
    name: string;
    avatar: string;
    socketID: string;
    sessionID: string;
}

export class DOMPlayer extends Phaser.GameObjects.Container {
    private socketID: string;
    private sessionID: string;
    private domElement: Phaser.GameObjects.DOMElement;

    constructor(scene: BaseScene, playerConfig: PlayerConfig) {
        // First create the container at the specified position
        // with the same origin behavior as your regular Player
        super(scene, 0, 0);

        // Store IDs
        this.socketID = playerConfig.socketID;
        this.sessionID = playerConfig.sessionID;

        // Create the DOM element
        const element = document.createElement('div');
        element.className = 'player';
        element.innerHTML = `
            <div class="pixel"></div>
            <div class='avatar'>
                <img src="/img/avatar-200/image-from-rawpixel-id-${playerConfig.avatar}-original.png">
            </div>
            <div class="playernamepanel">
                <div class="playername">${playerConfig.name}</div>
            </div>
        `;

        // Create the DOM element and add it to the container
        // Position it to align with the container's origin
        this.domElement = scene.add.dom(0, 48 - scene.getY(1080), element);

        // Add the DOM element to the container
        this.add(this.domElement);

    }

    // You can add your own methods to control the DOMElement
    animateToRandomPosition(duration: number): void {
        const targetX = Phaser.Math.Between(150, 1770);
        const targetY = Phaser.Math.Between(150, 930);

        this.scene.tweens.add({
            targets: this,  // This targets the container, not the DOM element
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                // Animation complete
            }
        });
    }

    // setSCale - ensures DOM element is scaled correctly, taking into account the origin and position relative to DOM
    setScale(x?: number, y?: number): this {

        if (this.domElement) {
            this.domElement.setScale(x, y);
        }
        return this;
    }

    // Override destroy to properly clean up the DOM element
    destroy(fromScene?: boolean): void {
        console.log('DOMPlayer:: destroy:', this.socketID, this.sessionID);
        if (this.domElement) {
            this.domElement.destroy();
        }
        super.destroy(fromScene);
    }
}
