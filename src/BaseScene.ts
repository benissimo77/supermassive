import SocketManagerPlugin from './socketManager';
import { Socket } from 'socket.io-client';
import { PlayerConfig } from './DOMPlayer';
import { SoundManager } from 'src/audio/SoundManager';

export abstract class BaseScene extends Phaser.Scene {
    private static currentHeight = 1080;
    private static wakeLock: any = null;
    private overlay: Phaser.GameObjects.Rectangle | null = null;
    private resizeCount: number = 0;
    private lastResizeTime: number = 0;
    private resizeDebounceTimer: Phaser.Time.TimerEvent | null = null;
    private resizeHandler: (gameSize: Phaser.Structs.Size) => void;
    private shutdownHandler: () => void;

    // Containers for the different layers that make up the scene
    protected backgroundContainer: Phaser.GameObjects.Container;
    protected mainContainer: Phaser.GameObjects.Container;
    protected UIContainer: Phaser.GameObjects.Container;
    protected topContainer: Phaser.GameObjects.Container;
    protected debugContainer: Phaser.GameObjects.Container;

    public soundManager: SoundManager;
    public rexUI!: any;
    public rexToggleSwitch!: any;
    protected socket: Socket;

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
            this.handleResizeDebouncer(gameSize);
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

        // Initialize the SoundManager
        this.soundManager = SoundManager.getInstance(this);
        
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
    }

    create(): void {
        console.log(`${this.scene.key}:: BaseScene.create: hello`);

        this.game.events.on('hidden', () => {
            console.log('Game lost focus');
            // Pause game, mute audio, etc.
            this.scene.pause();
            // Add overlay to highlight that game can no longer be controlled
            this.overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.1);
            this.releaseWakeLock();
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
            this.requestWakeLock();
        });

        this.backgroundContainer = this.add.container(0, 0);
        this.add.existing(this.backgroundContainer);
        this.mainContainer = this.add.container(0, 0);
        this.add.existing(this.mainContainer);
        this.UIContainer = this.add.container(0, 0);
        this.add.existing(this.UIContainer);
        this.topContainer = this.add.container(0, 0);
        this.add.existing(this.topContainer);

        // Especially on Apple devices we need to request wakelock only on user interaction
        this.input.once('pointerdown', () => {
            // this.requestFullscreenLandscape();
            this.requestWakeLock();
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

            const device = this.getDeviceType();

            // Send response with device info
            console.log('Responding to ping test from server, device:', device);
            callback({
                device,
                received: Date.now()
            });
        });
    }

    private getDeviceType(): string {
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

        return device;
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

    private handleResizeDebouncer(gameSize: Phaser.Structs.Size): void {

        const now = Date.now();
        const timeSinceLastResize = now - this.lastResizeTime;
        this.lastResizeTime = now;

        console.log(`Resize event received (${timeSinceLastResize}ms since last)`);
        this.socket.emit('consolelog', `Resize event received (${timeSinceLastResize}ms since last)`);

        // Cancel any existing timer
        if (this.resizeDebounceTimer) {
            this.resizeDebounceTimer.remove();
        }

        // Set a new timer to process resize after 300ms of no events
        this.resizeDebounceTimer = this.time.delayedCall(300, () => {
            console.log('Resize events settled, processing...');
            this.socket.emit('consolelog', 'Resize events settled, processing...');
            this.handleResize(gameSize);
        });
    }

    handleResize(gameSize: Phaser.Structs.Size): void {

        this.resizeCount++;

        // gameSize width and height are the reported size of the canvas
        // However on iOS these values can be wrong - esp when in fullscreen mode
        // visualViewport is more reliable, so use this if it is available
        // UPDATE: DON'T use visualViewport just drop fullscreen / landscape lock for now
        let screenWidth = gameSize.width;
        let screenHeight = gameSize.height;
        // if (window.visualViewport) {
        // screenWidth = window.visualViewport.width;
        // screenHeight = window.visualViewport.height;
        // }

        const scaleX = screenWidth / 1920;
        const logicalHeight = screenHeight / scaleX;

        console.log(`${this.scene.key}:: BaseScene.handleResize:`, this.resizeCount, screenWidth, screenHeight, scaleX, logicalHeight);

        if (this.socket) {
            this.socket.emit('consolelog', `${this.scene.key}:: BaseScene.handleResize:, ${this.resizeCount}, ${gameSize.width}, ${gameSize.height}, ${scaleX}, ${logicalHeight}`);
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

        // Call the child scene display function to update any layout
        this.sceneDisplay();

    }

    addDebugGraphics(): void {

        if (this.debugContainer) {
            this.debugContainer.removeAll(true);
        } else {
            this.debugContainer = this.add.container(0, 0);
        }

        // Add a small rectangle at each corner of the screen to show corners
        const cornerSize = 80;
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
        const graphics = this.add.graphics();
        graphics.lineStyle(4, 0xffff00, 1);
        graphics.moveTo(0, 0);
        graphics.lineTo(1920, this.getY(1080));
        graphics.strokePath();
        graphics.moveTo(1920, 0);
        graphics.lineTo(0, this.getY(1080));
        graphics.strokePath();
        this.debugContainer.add(graphics);

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
    isPortrait(): boolean {
        // Check both window dimensions and orientation API
        const windowPortrait = window.innerHeight > window.innerWidth;

        // Use orientation API if available (more reliable)
        if (screen.orientation) {
            const orientationType = screen.orientation.type;
            return orientationType.includes('portrait');
        }

        // Fallback to window dimensions
        return windowPortrait;
    }
    // Function returns a useful number that can be used to scale UI elements especially for mobile browsers which can be very thin/tall and need heavy adjustment
    getUIScaleFactor(): number {
        const aspectRatio = this.scale.width / this.scale.height;

        // Simple formula: 2.0 - ratio (clamped between 1.0 and ~2.5)
        // Thinner screens (lower ratio) get higher scale factor
        // Idea is it provides a good scale between landscape/portrait extremes
        // Landscape returns ~1.0, Portrait returns ~2.5 so 800width becomes ~1800px  
        return Math.min(2.5, Math.max(1.0, 3.2 - 2 * aspectRatio));
    }



    private async requestWakeLock(): Promise<void> {

        // Log if wake lock is available
        if (!('wakeLock' in navigator)) {
            console.log('Wake lock API not supported on this device');
            this.socket.emit('consolelog', `Wake lock API not supported: ${this.getDeviceType()} : ${window.isSecureContext}`);
            return;
        }
        if (BaseScene.wakeLock === null && 'wakeLock' in navigator) {
            try {
                BaseScene.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock activated');
                this.socket.emit('consolelog', `Wake lock active: ${this.getDeviceType()}`);
            } catch (err: any) {
                console.error('Wake lock request failed:', err);
            }
        }
    }

    private async releaseWakeLock(): Promise<void> {
        if (BaseScene.wakeLock !== null) {
            try {
                await BaseScene.wakeLock.release();
                BaseScene.wakeLock = null;
                console.log('Wake lock released');
                this.socket.emit('consolelog', `Wake lock released: ${this.getDeviceType()}`);
            } catch (err: any) {
                console.error('Wake lock release failed:', err);
            }
        }
    }

    private requestFullscreenLandscape(): void {

        const device = this.getDeviceType();
        const canvas = this.game.canvas;

        try {
            if (document.fullscreenElement) {
                console.log('Already in fullscreen mode');
                this.requestOrientationLock();
                return;
            }

            // Call fullscreen request SYNCHRONOUSLY - no await!
            let fullscreenPromise: Promise<void> | undefined;

            if (canvas.requestFullscreen) {
                fullscreenPromise = canvas.requestFullscreen();
            } else if ((canvas as any).webkitRequestFullscreen) {
                fullscreenPromise = (canvas as any).webkitRequestFullscreen();
            } else if ((canvas as any).mozRequestFullScreen) {
                fullscreenPromise = (canvas as any).mozRequestFullScreen();
            } else if ((canvas as any).msRequestFullscreen) {
                fullscreenPromise = (canvas as any).msRequestFullscreen();
            }

            // Handle the promise AFTER the synchronous call
            if (fullscreenPromise) {
                fullscreenPromise
                    .then(() => {
                        console.log('✅ Fullscreen activated');
                        this.socket.emit('consolelog', `✅ Fullscreen activated: ${device}`);

                        // Now request orientation lock
                        this.requestOrientationLock();
                    })
                    .catch((err: any) => {
                        console.warn('Fullscreen request failed:', err.message);
                        this.socket.emit('consolelog', `⚠️ Fullscreen failed: ${device} - ${err.message}`);
                    });
            } else {
                console.warn('Fullscreen API not available');
                this.socket.emit('consolelog', `⚠️ Fullscreen not available: ${device}`);
            }

        } catch (err: any) {
            console.error('Fullscreen request error:', err.message);
            this.socket.emit('consolelog', `❌ Fullscreen error: ${device} - ${err.message}`);
        }
    }
    private async requestOrientationLock(): Promise<void> {

        if (!screen.orientation || !screen.orientation.lock) {
            console.log('Screen Orientation API not supported');
            this.socket.emit('consolelog', 'Screen Orientation API not supported');
            return;
        }

        try {
            await screen.orientation.lock('landscape');
            console.log('✅ Orientation locked to landscape');
            this.socket.emit('consolelog', 'Orientation locked: landscape');
        } catch (err: any) {
            console.warn('Orientation lock not available:', err.message);
            this.socket.emit('consolelog', `Orientation lock failed: ${err.message}`);
            // Not critical - CSS fallback handles it
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
        if (BaseScene.wakeLock && typeof BaseScene.wakeLock.release === 'function') {
            BaseScene.wakeLock.release()
                .then(() => console.log('Wake lock released on scene shutdown'))
                .catch((err: any) => console.error('Error releasing wake lock:', err));
        }

        // Call the child scene shutdown method to allow them to clean up
        this.sceneShutdown();
    }

    // Abstract methods for child scenes to implement
    protected abstract sceneShutdown(): void;
    protected abstract sceneDisplay(): void;

}

