import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import SocketManagerPlugin from './socketManager';


interface Players {
    [key: string]: Player;
}

class Player extends Phaser.Physics.Arcade.Sprite {
    playerId: string;
}

class Game1 extends Phaser.Scene {
    private socket: Socket;
    private otherPlayers: Phaser.Physics.Arcade.Group;
    // private player: Phaser.Physics.Arcade.Sprite | undefined;
    private player: Player;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

    constructor() {
        super({ key: 'Game1' });
    }

    preload(): void {
        this.load.image('ship', 'assets/spaceShips_001.png');
        this.load.image('otherPlayer', 'assets/enemyBlack5.png');
    }

    init(): void {
        console.log('Game1.init: hello.');
    }
    // NOTE: all socket events must be defined in create() otherwise preloaded images might not be ready
    // and you will see the little green square
    create(): void {

        console.log('Game1.create:: hello');

        // This is the preferred way to initialise the socket, via the SocketManagerPlugin
        const plugin = this.plugins.get('SocketManagerPlugin') as SocketManagerPlugin;
        if (!plugin) throw new Error('SocketManagerPlugin not found');
        const socket = plugin.getSocket();
        if (!socket) throw new Error('Socket not initialized');
        this.socket = socket;

        // This function called when player first enters - gets sent ALL players currently playing
        // Uses the socket.id to determine when player is ME and takes separate action
        this.socket.on('currentPlayers', (players: Players) => {
            console.log('socket.currentPlayers:', players);
            Object.keys(players).forEach((id: string) => {
                if (players[id].playerId === this.socket.id) {
                    this.addThisPlayer(players[id]);
                } else {
                    this.addOtherPlayer(players[id]);
                }
            });
        });

        this.socket.on('newPlayer', (playerInfo: Player) => {
            this.addOtherPlayer(playerInfo);
        });

        this.socket.on('disconnect', (playerId: string) => {
            console.log('socket.disconnect:', playerId);
            this.otherPlayers.getChildren().forEach((gameObject: Phaser.GameObjects.GameObject) => {
                const otherPlayer = gameObject as Player;
                if (playerId === otherPlayer.playerId) {
                    otherPlayer.destroy();
                }
            });
        });

        this.socket.on('playerMoved', (playerInfo: Player) => {
            this.otherPlayers.getChildren().forEach((gameObject: Phaser.GameObjects.GameObject) => {
                const otherPlayer = gameObject as Player;
                if (playerInfo.playerId === otherPlayer.playerId) {
                    otherPlayer.setRotation(playerInfo.rotation);
                    otherPlayer.setPosition(playerInfo.x, playerInfo.y);
                }
            });
        });

        this.otherPlayers = this.physics.add.group();

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

    }

    resize(gameSize: Phaser.Structs.Size, baseSize: Phaser.Structs.Size, displaySize: Phaser.Structs.Size, resolution: number): void {
        // Parameters are unused but kept for future resize functionality
    }

    update(): void {
        if (!this.player || !this.cursors || !this.player.body) return;

        const speed = 3;
        if (this.cursors.left.isDown) {
            this.player.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown) {
            this.player.setAngularVelocity(150);
        } else {
            this.player.setAngularVelocity(0);
        }

        if (this.cursors.up.isDown) {
            console.log('Game1.update: UP:', this.player.rotation, speed, this.player.body.velocity);
            this.physics.velocityFromRotation(this.player.rotation, speed, this.player.body.velocity);
        } else {
            this.player.setVelocity(0);
        }

        // Emit player movement
        const x = this.player.x;
        const y = this.player.y;
        const rotation = this.player.rotation;

        this.socket.emit('playerMovement', { x, y, rotation });
    }

    private addThisPlayer(playerInfo: Player): void {
        console.log('Game1::addThisPlayer:', playerInfo);
        this.player = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'ship') as Player;
        this.player.playerId = playerInfo.playerId;
        this.player.setDrag(100);
        this.player.setAngularDrag(100);
        this.player.setMaxVelocity(200);
    }

    private addOtherPlayer(playerInfo: Player): void {
        console.log('Game1::addOtherPlayer:', playerInfo);
        const otherPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer') as Player;
        otherPlayer.playerId = playerInfo.playerId;
        this.otherPlayers.add(otherPlayer);
    }
}

// Main game config
// Important: SocketManagerPlugin must have start:false otherwise it initializes too quickly and socket events are lost
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1920,
    height: '100vh',
    scale: {
        mode: Phaser.Scale.EXPAND
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    plugins: {
        global: [
            { key: 'SocketManagerPlugin', plugin: SocketManagerPlugin, start: false }
        ]
    },
    scene: Game1
};

const game = new Phaser.Game(config);
export default Game1; 