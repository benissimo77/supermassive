import Phaser from 'phaser';
import SocketManagerPlugin from './socketManager';
import { Socket } from 'socket.io-client';

export abstract class BaseScene extends Phaser.Scene {
    private static currentHeight = 1080;
    private resizeHandler: (gameSize: Phaser.Structs.Size) => void;
    private shutdownHandler: () => void;
    protected socket: Socket;

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

        // Set up basic socket event listeners
        this.socket.on('connection', function (message) {
            console.log('Connected to server:', message);
        });

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

    getY(originalY: number): number {
        const scaleFactor = this.getScaleFactor();
        return originalY * scaleFactor;
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

