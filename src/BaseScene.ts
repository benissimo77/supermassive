import SocketManagerPlugin from './socketManager';
import { Socket } from 'socket.io-client';
import { PlayerConfig } from 'src/quiz/PhaserPlayer';
import { SoundManager } from 'src/audio/SoundManager';

export abstract class BaseScene extends Phaser.Scene {
    protected currentHeight = 1080;
    private static wakeLock: any = null;
    private overlay: Phaser.GameObjects.Rectangle | null = null;
    private resizeCount: number = 0;
    private lastResizeTime: number = 0;
    private resizeDebounceTimer: any = null;
    private resizeHandler: (gameSize: Phaser.Structs.Size) => void;
    private shutdownHandler: () => void;
    protected globalKeypressHandler: (event: KeyboardEvent) => void;

    // Named socket handler references — stored so shutdown() can remove exactly these, not all listeners
    private onPlayerConnect: (player: PlayerConfig) => void;
    private onPlayerDisconnect: (sessionID: string) => void;
    private onServerPlayers: (players: PlayerConfig[]) => void;
    private onServerPing: (data: any, callback: Function) => void;

    // Containers for the different layers that make up the scene
    protected backgroundContainer: Phaser.GameObjects.Container;
    protected mainContainer: Phaser.GameObjects.Container;
    protected UIContainer: Phaser.GameObjects.Container;
    public topContainer: Phaser.GameObjects.Container;
    protected debugContainer: Phaser.GameObjects.Container;

    public soundManager: SoundManager;
    public rexUI!: any;
    public rexToggleSwitch!: any;
    public socket: Socket;
    protected roomID: string = '';

    // players will be overridden by any child scene - adapted for its own purposes
    public abstract players: Map<string, Phaser.GameObjects.Container>;
    protected playerConfigs: Map<string, PlayerConfig> = new Map<string, PlayerConfig>();
    public mySessionID: string | null = null;

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

        // Ensure audio and game logic continues playing even when the tab is not active
        // This is critical for streaming via OBS when the admin is switching tabs
        if (this.sound) {
            this.sound.pauseOnBlur = false;
        }
        // Prevents the Phaser clock and physics from stopping when tab loses focus
        this.game.events.off('hidden');
        this.game.events.off('visible');
        // this.socket.onAny((event, ...args) => {
        //     console.log('BaseScene:: Socket event:', event, args);
        // });

        // Set up common socket event listeners
        // this.socket.on('hostconnect', this.handleHostConnect.bind(this));
        // Tempted to remove these and let only chil scenes handle them - risk of data getting out of sync
        // If ALL games had identical player configs and player objects then maybe BaseScene could centralise
        // But likely each game will have different player objects, design, style etc so just delegate to children
        this.onPlayerConnect = (player: PlayerConfig) => this.handlePlayerConnect(player);
        this.onPlayerDisconnect = (sessionID: string) => this.handlePlayerDisconnect(sessionID);
        this.onServerPlayers = (players: PlayerConfig[]) => {
            console.log('BaseScene:: server:players:', players);
            this.playerConfigs.clear();
            players.forEach((player: PlayerConfig) => this.handlePlayerConnect(player));
        };

        this.socket.on('playerconnect', this.onPlayerConnect);
        this.socket.on('playerdisconnect', this.onPlayerDisconnect);
        this.socket.on('server:players', this.onServerPlayers);

        // Initialize the ping test handler
        this.initPingTest();

        // Log all image loads and their texture keys to help debug image issues
        this.load.on('filecomplete-image', (key) => {
            const tex = this.textures.get(key);
            if (tex && tex.source && tex.source[0]) {
                console.log('Image Loaded:', key, tex.source[0].url);
            }
        });


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

        if (!this.backgroundContainer) {
            this.backgroundContainer = this.add.container(0, 0);
            this.add.existing(this.backgroundContainer);
        }
        if (!this.mainContainer) {
            this.mainContainer = this.add.container(0, 0);
            this.add.existing(this.mainContainer);
        }
        if (!this.UIContainer) {
            this.UIContainer = this.add.container(0, 0);
            this.add.existing(this.UIContainer);
        }
        if (!this.topContainer) {
            this.topContainer = this.add.container(0, 0);
            this.add.existing(this.topContainer);
        }

        // Especially on Apple devices we need to request wakelock only on user interaction.
        // We MUST use native DOM events here. Phaser's synthetic pointer events often lose the 
        // "transient user activation" token that iOS Safari strictly requires for permission APIs.
        if (__DEV__) {
            // Don't add wake lock or fullscreen - leave for production use only
        } else {
            const enableWakeLock = () => {
                this.requestWakeLock();
                this.requestFullscreenPortrait();
                this.game.canvas.removeEventListener('click', enableWakeLock);
                this.game.canvas.removeEventListener('touchend', enableWakeLock);
            };
            this.game.canvas.addEventListener('click', enableWakeLock);
            this.game.canvas.addEventListener('touchend', enableWakeLock);
        }

        // Max debugging of all input events
        // This is VERY noisy so use with caution
        if (__DEV__ && 0) {
            this.enableInputDebug();
        }

        // UPDATE: Experimenting with the correct place to put this call - must be after eg socket is set up
        // Call handleResize immediately to set up the initial camera zoom and screen height
        this.handleResize(this.scale.gameSize);


    }

    private initPingTest(): void {

        // This event used by all games and all user types
        // Add handler for server-initiated ping tests
        if (!this.socket) {
            console.error('SocketManager: Socket not initialized for ping test');
            return;
        }

        console.log('SocketManager: initPingTest registering handler, socketId:', this.socket?.id);
        this.onServerPing = (data: any, callback: Function) => {
            const device = this.getDeviceType();
            console.log('Responding to ping test from server, device:', device);
            callback({ device, received: Date.now() });
        };
        this.socket.off('server:ping', this.onServerPing);
        this.socket.on('server:ping', this.onServerPing);
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

        // Cancel any existing timer
        if (this.resizeDebounceTimer) {
            clearTimeout(this.resizeDebounceTimer);
            this.resizeDebounceTimer = null;
        }

        // Set a new timer to process resize after 300ms of no events
        // Use window.setTimeout instead of this.time.delayedCall because this.time might not be ready in init()
        this.resizeDebounceTimer = window.setTimeout(() => {
            this.handleResize(gameSize);
            this.resizeDebounceTimer = null;
        }, 300);
    }

    handleResize(gameSize: Phaser.Structs.Size): void {

        // CRITICAL FIX: If a player is actively typing into an HTML input field on mobile, 
        // the software keyboard opening/closing will trigger window resizes. 
        // Re-scaling the Phaser DOM elements or camera during this animation 
        // forces the mobile browser to instantly abort the keyboard focus, 
        // creating an endless resize/reflow loop. 
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            console.log(`${this.scene.key}:: BaseScene.handleResize: Ignored because HTML input is focused.`);
            if (this.socket) {
                this.socket.emit('consolelog', `${this.scene.key}:: BaseScene.handleResize: Ignored because HTML input is focused.`);
            }
            return;
        }

        this.resizeCount++;

        // gameSize width and height are the reported size of the canvas
        // However on iOS these values can be wrong - esp when in fullscreen mode
        // visualViewport is more reliable, so use this if it is available
        // UPDATE: DON'T use visualViewport just drop fullscreen / landscape lock for now
        let screenWidth = gameSize.width;
        let screenHeight = gameSize.height;

        // Safety check for 0 dimensions
        if (screenWidth === 0 || screenHeight === 0) {
            console.warn(`${this.scene.key}:: BaseScene.handleResize: Dimensions are 0, skipping resize.`);
            return;
        }

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

        // Call the child scene render function to update any layout
        this.render();

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


    enableInputDebug() {

        // Pointer events - manually list the events we want to debug
        const pointerEvents = [
            'pointerdown',
            'pointerup',
            'pointermove',
            'pointerover',
            'pointerout',
            'dragstart',
            'drag',
            'dragend',
            'drop',
            'pointerenter',
            'pointerleave',
            'pointercancel',
            'pointerupoutside',
            'pointerdownoutside',
            'gameout',
            'gameover'
        ];
        pointerEvents.forEach(eventName => {
            this.input.on(eventName, (...args) => {
                this.socket?.emit('consolelog', `[Pointer Event] ${eventName}, ${args}`);
            });
        });

        // Multi-touch events
        this.input.on('pointer1down', (...args) => {
            this.socket?.emit('consolelog', `[Pointer Event] pointer1down, ${args}`);
        });
        this.input.on('pointer2down', (...args) => {
            this.socket?.emit('consolelog', `[Pointer Event] pointer2down, ${args}`);
        });
        this.input.on('pointer3down', (...args) => {
            this.socket?.emit('consolelog', `[Pointer Event] pointer3down, ${args}`);
        });
        this.input.on('pointer1up', (...args) => {
            this.socket?.emit('consolelog', `[Pointer Event] pointer1up, ${args}`);
        });
        this.input.on('pointer2up', (...args) => {
            this.socket?.emit('consolelog', `[Pointer Event] pointer2up, ${args}`);
        });
        this.input.on('pointer3up', (...args) => {
            this.socket?.emit('consolelog', `[Pointer Event] pointer3up, ${args}`);
        });

        // Keyboard events
        const kb = this.input.keyboard;
        ['keydown', 'keyup'].forEach(eventName => {
            kb.on(eventName, (event) => {
                this.socket?.emit('consolelog', `[Keyboard Event] ${eventName}, ${event.key}, ${event}`);
            });
        });
    }

    public registerGlobalKeypressHandler(handler: (event: KeyboardEvent) => void): void {
        // General keyboard listener - useful for keyboard control
        // Don't do anything unless we have a scene.input object
        if (this.input && this.input.keyboard) {
            if (this.globalKeypressHandler) {
                this.input.keyboard.off('keydown', this.globalKeypressHandler, this);
            }
            if (handler) {
                this.globalKeypressHandler = handler;
            }
            if (this.globalKeypressHandler) {
                this.input.keyboard.on('keydown', this.globalKeypressHandler, this);
            }
        }
    }

    public deregisterGlobalKeypressHandler(): void {
        if (this.input?.keyboard && this.globalKeypressHandler) {
            this.input.keyboard.off('keydown', this.globalKeypressHandler, this);
        }
    }


    updateHeight(newHeight: number): void {
        console.log('BaseScene:: updateHeight:', newHeight);
        this.currentHeight = newHeight;
    }

    getY(logicalY: number): number {
        const scaleFactor = this.getScaleFactor();
        return logicalY * scaleFactor;
    }

    // getScaleFactor - this hardcodes 1080 as the logical height
    getScaleFactor(): number {
        return this.currentHeight / 1080;
    }

    /**
     * Reparents a game object into a new container while maintaining its world position.
     * This handles any scaling, rotation, or nesting offsets automatically.
     */
    public reparentObject(child: any, newParent: Phaser.GameObjects.Container): void {
        if (!child || !newParent) return;

        // 1. Get the current world position of the child
        const matrix = child.getWorldTransformMatrix();
        const worldX = matrix.tx;
        const worldY = matrix.ty;

        // 2. Add to new container (this resets x/y relative to new parent)
        newParent.add(child);

        // 3. Convert that world position back into the new parent's local space
        const localPoint = newParent.getLocalPoint(worldX, worldY);
        child.setPosition(localPoint.x, localPoint.y);
    }

    isPortrait(): boolean {
        // Check both window dimensions and orientation API
        const windowPortrait = window.innerHeight > window.innerWidth;

        if (__DEV__) {
            console.log('BaseScene:: isPortrait check: window dimensions:', window.innerWidth, window.innerHeight, 'windowPortrait:', windowPortrait);
            return windowPortrait;
        }

        // Use orientation API if available (more reliable)
        if (screen.orientation) {
            const orientationType = screen.orientation.type;
            console.log('BaseScene:: isPortrait returning (orientationType):', orientationType.includes('portrait'));
            return orientationType.includes('portrait');
        }

        console.log('BaseScene:: isPortrait returning (window dimensions):', windowPortrait);
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

    /**
     * getPhysicalScale
     * Returns a scale factor designed to keep interactive elements at a consistent 
     * physical size regardless of the screen's logical-to-physical mapping.
     * 
     * Formula: (1 / cameraZoom) * (1 / dpr) * constant
     */
    getPhysicalScale(): number {
        const cameraZoom = this.cameras.main.zoom || 1;
        const dpr = window.devicePixelRatio || 1;

        console.log('BaseScene:: getPhysicalScale: cameraZoom:', cameraZoom, 'devicePixelRatio:', dpr, 'returns:', (1 / cameraZoom) * (1 / dpr));
        // A pure ratio that keeps an object at its standard physical size 
        // across different camera zooms and pixel densities.
        return (1 / cameraZoom) * (1 / dpr);
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
                this.socket.emit('consolelog', `Wake lock failed: ${err?.message || err}`);
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

    private requestFullscreenPortrait(): void {

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
            await screen.orientation.lock('portrait');
            console.log('✅ Orientation locked to portrait');
            this.socket.emit('consolelog', 'Orientation locked: portrait');
        } catch (err: any) {
            console.warn('Orientation lock not available:', err.message);
            this.socket.emit('consolelog', `Orientation lock failed: ${err.message}`);
            // Not critical - CSS fallback handles it
        }
    }

    shutdown(): void {
        console.log(`BaseScene:: shutdown`);

        // Clear any pending resize timer
        if (this.resizeDebounceTimer) {
            clearTimeout(this.resizeDebounceTimer);
            this.resizeDebounceTimer = null;
        }

        // Remove the resize listener
        this.scale.off('resize', this.resizeHandler);
        this.events.off('shutdown', this.shutdownHandler);

        // Remove only the listeners registered by BaseScene.
        // The socket is a shared singleton — removeAllListeners() must never be called here.
        if (this.socket) {
            this.socket.off('playerconnect', this.onPlayerConnect);
            this.socket.off('playerdisconnect', this.onPlayerDisconnect);
            this.socket.off('server:players', this.onServerPlayers);
            this.socket.off('server:ping', this.onServerPing);
        }

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
    protected abstract render(): void;

}

