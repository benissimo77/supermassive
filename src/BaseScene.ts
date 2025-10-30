import SocketManagerPlugin from './socketManager';
import { Socket } from 'socket.io-client';
import { PlayerConfig } from './DOMPlayer';
import { SoundSettingsPanel } from 'src/ui/SoundSettingsPanel';
import { GlobalNavbar } from './ui/GlobalNavbar';

export abstract class BaseScene extends Phaser.Scene {
    private static currentHeight = 1080;
    private overlay: Phaser.GameObjects.Rectangle | null = null;
    private resizeCount: number = 0;
    private wakeLock: any = null;
    private resizeHandler: (gameSize: Phaser.Structs.Size) => void;
    private shutdownHandler: () => void;

    // Containers for the different layers that make up the scene
    protected backgroundContainer: Phaser.GameObjects.Container;
    protected mainContainer: Phaser.GameObjects.Container;
    protected UIContainer: Phaser.GameObjects.Container;
    protected topContainer: Phaser.GameObjects.Container;
    protected debugContainer: Phaser.GameObjects.Container;

    public rexUI!: any;
    public rexToggleSwitch!: any;
    protected soundSettings: SoundSettingsPanel;
    protected socket: Socket;
    protected globalNavbar: GlobalNavbar;

    protected playerConfigs: Map<string, PlayerConfig> = new Map<string, PlayerConfig>();

    // TYPE is the type of screen we are showing, currently 'play' or 'host' (maybe 'admin', 'viewer' later)
    public TYPE: string;
    // Store a flag for single player mode - maybe there is a better way to do this but see how far we get with this
    public singlePlayerMode: boolean = false;

    // The labelConfig/buttonConfig is used for text styles in the scene, properties can be overridden as needed
    public labelConfig: Phaser.Types.GameObjects.Text.TextStyle;
    public buttonConfig: Phaser.Types.GameObjects.Text.TextStyle;


    init(): void {
        console.log(`${this.scene.key}:: BaseScene.init: hello`);

        this.labelConfig = {
            fontFamily: '"Titan One", Arial',
            fontSize: this.getY(36),
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
        }
        // Similar for buttons
        this.buttonConfig = {
            fontFamily: '"Titan One", Arial',
            fontSize: this.getY(36),
            color: '#ffffff',
            stroke: '#000000',
            backgroundColor: '#0000FF',
            strokeThickness: 2,
            align: 'center',
            padding: { x: 30, y: 15 },
        };

        // Store the resize handler reference so it can be removed later
        this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
            this.handleResize(gameSize);
        };
        // Call handleResize immediately to set up the initial camera zoom and screen height
        this.handleResize(this.scale.gameSize);

        // Add a resize listener
        this.scale.on('resize', this.resizeHandler);

        // and a shutdown event listener to clean up the resize listener
        // when the scene is shut down
        this.shutdownHandler = () => {
            this.shutdown();
        }
        this.events.on('shutdown', this.shutdownHandler);

        // Initialise the socket manager
        const plugin = this.plugins.get('SocketManagerPlugin') as SocketManagerPlugin;
        if (!plugin) throw new Error('SocketManagerPlugin not found');
        const socket = plugin.getSocket();
        if (!socket) throw new Error('Socket not initialized');
        this.socket = socket;

        // rexUI plugin is a scene plugin and available immediately as this.rexUI
        console.log(`${this.scene.key}:: BaseScene.init: plugins:`, this.rexUI);

        // Request wake lock when the scene initializes
        this.setupWakeLock();

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
        // Initialize the ping test handler
        this.initPingTest();

    }

    preload(): void {
        this.load.image('audio-settings', '/assets/img/audio-settings.png');
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

        this.backgroundContainer = this.add.container(0, 0);
        this.add.existing(this.backgroundContainer);
        this.mainContainer = this.add.container(0, 0);
        this.add.existing(this.mainContainer);
        this.UIContainer = this.add.container(0, 0);
        this.add.existing(this.UIContainer);
        this.topContainer = this.add.container(0, 0);
        this.add.existing(this.topContainer);

        this.globalNavbar = new GlobalNavbar(this);
        this.add.existing(this.globalNavbar);

        // Add a settings button to open the panel
        this.soundSettings = new SoundSettingsPanel(this);
        this.add.existing(this.soundSettings);

        this.globalNavbar.addIcon('audio-settings', () => {
            console.log('Settings icon clicked');
            this.soundSettings.toggle();
        });

    }

    private initPingTest(): void {

        // This event used by all games and all user types
        // Add handler for server-initiated ping tests
        if (!this.socket) {
            console.error('SocketManager: Socket not initialized for ping test');
            return;
        }

        console.log('SocketManager: initPingTest registering handler, socketId:', this.socket?.id);
        this.socket.off('server:ping');
        this.socket.on('server:ping', (data, callback) => {
            // Determine device type
            let device = 'unknown';

            if (/iPad/.test(navigator.userAgent)) {
                device = 'iPad';
            } else if (/iPhone|iPod/.test(navigator.userAgent)) {
                device = 'iPhone';
            } else if (/Android/.test(navigator.userAgent)) {
                device = 'Android';
            } else if (/Windows/.test(navigator.userAgent)) {
                device = 'Windows';
            } else if (/Macintosh/.test(navigator.userAgent)) {
                device = 'Mac';
            } else if (/Linux/.test(navigator.userAgent)) {
                device = 'Linux';
            }

            // Send response with device info
            console.log('Responding to ping test from server, device:', device);
            callback({
                device,
                received: Date.now()
            });
        });
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

            // We no longer remove player in case they re-join
            // this.playerConfigs.delete(sessionID);
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
        this.resizeCount++;

        // gameSize width and height are the reported size of the canvas
        // However on iOS these values can be wrong
        // visualViewport is more reliable, so use this if it is available
        let screenWidth = gameSize.width;
        let screenHeight = gameSize.height;
        if (window.visualViewport) {
            screenWidth = window.visualViewport.width;
            screenHeight = window.visualViewport.height;
        }

        const scaleX = gameSize.width / 1920;
        const logicalHeight = screenHeight / scaleX;

        console.log(`${this.scene.key}:: BaseScene.handleResize:`, this.resizeCount, screenWidth, screenHeight, scaleX, logicalHeight);

        if (this.socket) {
            this.socket.emit('consolelog', this.resizeCount);
        }

        // Set the camera properties
        const camera = this.cameras.main;
        camera.setOrigin(0, 0);
        camera.setZoom(scaleX);

        this.updateHeight(logicalHeight);

        // Add debugging graphics to show camera bounds
        if (__DEV__) {
            this.addDebugGraphics();
        }
    }

    addDebugGraphics(): void {

        if (this.debugContainer) {
            this.debugContainer.removeAll(true);
        }
        this.debugContainer = this.add.container(0, 0);

        // Add a small rectangle at each corner of the screen to show corners
        const cornerSize = 40;
        const corners = [
            { x: 0, y: 0 },
            { x: 1920, y: 0 },
            { x: 0, y: this.getY(1080) },
            { x: 1920, y: this.getY(1080) }
        ];
        corners.forEach(corner => {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x00ff00, 1);
            graphics.fillRect(corner.x - cornerSize / 2, corner.y - cornerSize / 2, cornerSize, cornerSize);
            this.debugContainer.add(graphics);
        });
    }

    updateHeight(newHeight: number): void {
        console.log('BaseScene:: updateHeight:', newHeight);
        BaseScene.currentHeight = newHeight;

        // Call the display function in the child scenes to update any layout
        // this.sceneDisplay();
    }

    getY(logicalY: number): number {
        const scaleFactor = this.getScaleFactor();
        return logicalY * scaleFactor;
    }

    // getScaleFactor - this hardcodes 1080 as the logical height
    getScaleFactor(): number {
        return BaseScene.currentHeight / 1080;
    }

    // Add these new methods
    private setupWakeLock(): void {
        // Request wake lock initially
        this.requestWakeLock();

        // Set up visibility change handler to reacquire wake lock when needed
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!this.wakeLock || (this.wakeLock.released === true)) {
                    console.log('Document became visible, requesting wake lock');
                    this.requestWakeLock();
                }
            }
        });
    }

    private async requestWakeLock(): Promise<void> {
        // Check if Wake Lock API is supported
        if ('wakeLock' in navigator) {
            try {
                // Request a screen wake lock
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
                console.log('Wake lock activated');

                // Add a listener to log when wake lock is released
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake lock released');
                });
            } catch (err) {
                console.warn('Wake lock request failed:', err);
            }
        } else {
            console.log('Wake Lock API not supported by this browser');
        }
    }
    shutdown(): void {
        console.log(`BaseScene:: shutdown`);

        // Remove the resize listener
        this.scale.off('resize', this.resizeHandler);
        this.events.off('shutdown', this.shutdownHandler);

        // Remove the socket listeners
        this.socket.removeAllListeners();

        // Release wake lock if it exists
        if (this.wakeLock && typeof this.wakeLock.release === 'function') {
            this.wakeLock.release()
                .then(() => console.log('Wake lock released on scene shutdown'))
                .catch(err => console.error('Error releasing wake lock:', err));
        }

        // Call the child scene shutdown method to allow them to clean up
        this.sceneShutdown();
    }

    // Abstract methods for child scenes to implement
    abstract sceneShutdown(): void;
    abstract sceneDisplay(): void;

}

