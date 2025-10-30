import { io, Socket } from 'socket.io-client';
import Phaser from 'phaser';

export default class SocketManagerPlugin extends Phaser.Plugins.BasePlugin {
    private socket: Socket | undefined;

    constructor(pluginManager: Phaser.Plugins.PluginManager) {
        super(pluginManager);
        console.log('SocketManagerPlugin constructor');
    }

    init(): void {

        this.socket = io(); // Initialize the socket connection

        console.log('SocketManagerPlugin:: init socketId:', this.socket?.id);

        this.socket.on('connect', () => {
            console.log('SocketManager: Connected to server:');
        });

    }

    getSocket(): Socket | undefined {
        return this.socket;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

console.log('SocketManager loaded...'); 