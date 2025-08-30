import SocketManagerPlugin from './socketManager';
import { Socket } from 'socket.io-client';
import { PlayerConfig } from './DOMPlayer';

export abstract class BaseScene extends Phaser.Scene {
    private static currentHeight = 1080;
    protected socket: Socket;
    private resizeHandler: (gameSize: Phaser.Structs.Size) => void;
    private shutdownHandler: () => void;
    private overlay: Phaser.GameObjects.Rectangle | null = null;
    public rexUI!: any;
    public rexToggleSwitch!: any;

    protected playerConfigs: Map<string, PlayerConfig> = new Map<string, PlayerConfig>();

    // TYPE is the type of screen we are showing, currently 'play' or 'host' (maybe 'admin', 'viewer' later)
    public TYPE: string;
    // Store a flag for single player mode - maybe there is a better way to do this but see how far we get with this
    public singlePlayerMode: boolean = false;

    // The labelConfig is used for text styles in the scene, can be overridden by child scenes
    public labelConfig: Phaser.Types.GameObjects.Text.TextStyle;


    init(): void {
        console.log(`${this.scene.key}:: BaseScene.init: hello`);

        // Store the resize handler reference so it can be removed later
        this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
            this.handleResize(gameSize);
        };
        this.shutdownHandler = () => {
            this.shutdown();
        }

        // Add a resize listener
        this.scale.on('resize', this.resizeHandler);

        // and a shutdown event listener to clean up the resize listener
        // when the scene is shut down
        this.events.on('shutdown', this.shutdownHandler);

        // Call handleResize immediately to set up the initial camera zoom and screen height
        this.handleResize(this.scale.gameSize);

        // Initialise the socket manager
        const plugin = this.plugins.get('SocketManagerPlugin') as SocketManagerPlugin;
        if (!plugin) throw new Error('SocketManagerPlugin not found');
        const socket = plugin.getSocket();
        if (!socket) throw new Error('Socket not initialized');
        this.socket = socket;

        // rexUI plugin is a scene plugin and available immediately as this.rexUI
        console.log(`${this.scene.key}:: BaseScene.init: plugins:`, this.rexUI);

        // This is useful for debugging but quite noisy
        // this.socket.onAny((event, ...args) => {
        //     console.log('BaseScene:: Socket event:', event, args);
        // });

        // Set up common socket event listeners
        // this.socket.on('hostconnect', this.handleHostConnect.bind(this));
        // Tempted to remove these and let only chil scenes handle them - risk of data getting out of sync
        // If ALL games had identical player configs and player objects then maybe BaseScene could centralise
        // But likely each game will have different player objects, design, style etc so just delegate to children
        this.socket.on('playerconnect', (player: PlayerConfig) => this.handlePlayerConnect(player));
        this.socket.on('playerdisconnect', (sessionID: string) => this.handlePlayerDisconnect(sessionID));

        this.socket.on('server:players', (players: PlayerConfig[]) => {
            console.log('BaseScene:: server:players:', players);
            // Clear the existing player configs
            this.playerConfigs.clear();
            players.forEach((player: PlayerConfig) => this.handlePlayerConnect(player))
        });

    }

    create(): void {
        console.log(`${this.scene.key}:: BaseScene.create: hello`);

        this.game.events.on('hidden', () => {
            console.log('Game lost focus');
            // Pause game, mute audio, etc.
            this.scene.pause();

            // Add overlay to highlight that game can no longer be controlled
            this.overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.1);
        });

        this.game.events.on('visible', () => {
            console.log('Game gained focus');
            // Resume game, unmute audio, etc.
            this.scene.resume();
            // Remove the overlay if it exists
            if (this.overlay) {
                this.overlay.destroy();
                this.overlay = null;
            }
        });


        // Set the label config for text styles
        this.labelConfig = {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 600, useAdvancedWrap: true }
        };

    }
    protected handlePlayerConnect(playerConfig: PlayerConfig): void {

        // Store the player config in the map
        this.playerConfigs.set(playerConfig.sessionID, playerConfig);
        console.log('BaseScene:: handlePlayerConnect:', { playerConfigs: this.playerConfigs });

    }
    protected handlePlayerDisconnect(sessionID: string): void {
        console.log('BaseScene: Player disconnected:', sessionID);

        if (sessionID) {
            const player = this.playerConfigs.get(sessionID);

            // Remove from tracking
            this.playerConfigs.delete(sessionID);
        }
    }

    abstract getPlayerBySessionID(sessionID: string): Phaser.GameObjects.Container;

    // Return the map of player configs as a simple array
    getPlayerConfigsAsArray(): PlayerConfig[] {
        const playerConfigsArray: PlayerConfig[] = [];
        this.playerConfigs.forEach((playerConfig: PlayerConfig) => {
            playerConfigsArray.push(playerConfig);
        });
        return playerConfigsArray;
    }
    getPlayerConfigBySessionID(sessionID: string): PlayerConfig | undefined {
        return this.playerConfigs.get(sessionID);
    }

    handleResize(gameSize: Phaser.Structs.Size): void {
        console.log(`${this.scene.key}:: BaseScene.handleResize:`, gameSize.width, gameSize.height);

        const scaleX = gameSize.width / 1920;

        // Calculate the logical height visible through the camera
        const logicalHeight = gameSize.height / scaleX;

        // Set the camera properties - will be overridden by the game scene
        // this.setCameraProperties(scaleX);
        const camera = this.cameras.main;
        camera.setOrigin(0, 0);
        camera.setZoom(scaleX);

        this.updateHeight(logicalHeight);
    }

    updateHeight(newHeight: number): void {
        console.log('BaseScene:: updateHeight:', newHeight);
        BaseScene.currentHeight = newHeight;
    }

    getY(logicalY: number): number {
        const scaleFactor = this.getScaleFactor();
        return logicalY * scaleFactor;
    }

    // getScaleFactor - this hardcodes 1080 as the logical height
    getScaleFactor(): number {
        return BaseScene.currentHeight / 1080;
    }


    shutdown(): void {
        console.log(`BaseScene:: shutdown`);

        // Remove the resize listener
        this.scale.off('resize', this.resizeHandler);
        this.events.off('shutdown', this.shutdownHandler);

        // Remove the socket listeners
        this.socket.removeAllListeners();

        // Call the child scene shutdown method to allow them to clean up
        this.sceneShutdown();
    }
    abstract sceneShutdown(): void;

}

