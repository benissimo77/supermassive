import { io, Socket } from 'socket.io-client';
import Phaser from 'phaser';

interface PlayerInfo {
    playerId: string;
    x: number;
    y: number;
    rotation: number;
    team?: 'blue' | 'red';
}

interface Players {
    [key: string]: PlayerInfo;
}

interface OtherPlayer extends Phaser.Physics.Arcade.Sprite {
    playerId: string;
}

interface ShipPosition {
    x: number;
    y: number;
    rotation: number;
}

class Game2 extends Phaser.Scene {
    private socket: Socket | undefined;
    private otherPlayers: Phaser.Physics.Arcade.Group | undefined;
    private ship: Phaser.Physics.Arcade.Image | undefined;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private oldPosition: ShipPosition;

    constructor() {
        super({ key: 'Game2' });
    }

    preload(): void {
        this.load.image('ship', 'assets/spaceShips_001.png');
        this.load.image('otherPlayer', 'assets/enemyBlack5.png');
    }

    create(): void {
        // For testing- place a ship in the bottom of the screen
        this.ship = this.physics.add.image(960, 90, 'ship');
        this.ship.setDisplaySize(200, 160);
        this.ship.setTint(0xffff00);

        this.scale.on('resize', this.resize, this);

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }
    }

    createOLD(): void {
        this.socket = io();
        this.otherPlayers = this.physics.add.group();

        this.socket.on('currentPlayers', (players: Players) => {
            Object.keys(players).forEach((id: string) => {
                if (players[id].playerId === this.socket?.id) {
                    this.addPlayer(players[id]);
                } else {
                    this.addOtherPlayers(players[id]);
                }
            });
        });

        this.socket.on('newPlayer', (playerInfo: PlayerInfo) => {
            this.addOtherPlayers(playerInfo);
        });

        this.socket.on('playerDisconnect', (playerId: string) => {
            this.otherPlayers?.getChildren().forEach((gameObject: Phaser.GameObjects.GameObject) => {
                const otherPlayer = gameObject as OtherPlayer;
                if (playerId === otherPlayer.playerId) {
                    otherPlayer.destroy();
                }
            });
        });

        this.socket.on('playerMoved', (playerInfo: PlayerInfo) => {
            this.otherPlayers?.getChildren().forEach((gameObject: Phaser.GameObjects.GameObject) => {
                const otherPlayer = gameObject as OtherPlayer;
                if (playerInfo.playerId === otherPlayer.playerId) {
                    otherPlayer.setRotation(playerInfo.rotation);
                    otherPlayer.setPosition(playerInfo.x, playerInfo.y);
                }
            });
        });

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        // For testing- place a ship in the bottom of the screen
        this.ship = this.physics.add.image(960, 90, 'ship');
        this.ship.setDisplaySize(200, 160);
        this.ship.setTint(0xffff00);

        this.scale.on('resize', this.resize, this);
    }

    resize(gameSize: Phaser.Structs.Size, baseSize: Phaser.Structs.Size, displaySize: Phaser.Structs.Size, resolution: number): void {
        console.log('resize', gameSize, displaySize, resolution);

        const width = gameSize.width;
        const height = gameSize.height;

        const scale = displaySize.width / 1920;
        const adjustY = displaySize.height / scale;

        this.physics.world.setBounds(0, 0, 1920, adjustY);
    }

    updateOLD(): void {
        if (!this.ship || !this.cursors || !this.ship.body) return;

        if (this.cursors.left.isDown) {
            this.ship.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown) {
            this.ship.setAngularVelocity(150);
        } else {
            this.ship.setAngularVelocity(0);
        }

        if (this.cursors.up.isDown) {
            const velocity = new Phaser.Math.Vector2();
            this.physics.velocityFromRotation(this.ship.rotation + 1.5, 100, velocity);
            this.ship.setVelocity(velocity.x, velocity.y);
        } else {
            this.ship.setVelocity(0);
        }

        this.physics.world.wrap(this.ship, 5);

        // emit player movement
        const x = this.ship.x;
        const y = this.ship.y;
        const r = this.ship.rotation;

        if (this.oldPosition && (x !== this.oldPosition.x || y !== this.oldPosition.y || r !== this.oldPosition.rotation)) {
            this.socket?.emit('playerMovement', { x, y, rotation: r });
        }

        // save old position data
        this.oldPosition = {
            x,
            y,
            rotation: r
        };
    }

    private addPlayer(playerInfo: PlayerInfo): void {
        console.log('addPlayer', playerInfo);
        this.ship = this.physics.add.image(playerInfo.x, playerInfo.y, 'ship')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(53, 40);

        if (playerInfo.team === 'blue') {
            this.ship.setTint(0x0000ff);
        } else {
            this.ship.setTint(0xff0000);
        }

        this.ship.setDrag(100);
        this.ship.setAngularDrag(100);
        this.ship.setMaxVelocity(200);
    }

    private addOtherPlayers(playerInfo: PlayerInfo): void {
        if (!this.otherPlayers) return;

        const otherPlayer = this.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(53, 40) as OtherPlayer;

        if (playerInfo.team === 'blue') {
            otherPlayer.setTint(0x0000ff);
        } else {
            otherPlayer.setTint(0xff0000);
        }

        otherPlayer.playerId = playerInfo.playerId;
        this.otherPlayers.add(otherPlayer);
    }
}

export default Game2; 