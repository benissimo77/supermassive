/*
Test out the dynamic loading of scene files to simulate the lobby / game experience
Hosting starts in the lobby (scene)
Lobby includes the socket.io layer
Lobby displays all the available games
Host can select a game
If valid game is loaded as a new scene and started
Scene is able to return back to the lobby, game is destroyed
*/

import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import SocketManagerPlugin from './socketManager';


class Lobby extends BaseScene {

    constructor() {
        super({ key: 'Lobby' });
    }

    // Note the order here - init comes first THEN preload THEN create...
    init(): void {

        console.log('Lobby.init: hello.');
        super.init();
    }

    preload(): void {

        console.log('Lobby.preload: hello.');

        // Testing add a progress indiciator
        this.load.on('progress', (progress: number) => {
            console.log('Loader progress:', progress);
        });
        this.load.on('filecomplete', (key: string) => {
            console.log('Loading file complete:', key);
            if (key === "Quiz") {
                this.scene.start('Quiz');
            }
        });

        this.load.on('complete', () => {
            console.log('Loading complete');
        });
        this.load.on('addfile', (key: string, type: string, url: string, xhrSettings: Phaser.Types.Loader.XHRSettingsObject) => {
            console.log('Loader file add:', key, type, url, xhrSettings);
        });
        this.load.on('load', (file: Phaser.Loader.File) => {
            console.log('Loader load:', file);
        });
        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            console.log('Loader load error:', file);
        });

        // this.load.image('ship', 'assets/spaceShips_001.png');
        // this.load.image('otherPlayer', 'assets/enemyBlack5.png');
        // this.load.image('borderbox', 'assets/rounded-rect-gold-200x80x12.png');
    }

    create(): void {

        console.log('Lobby.create: hello.');

        // Output the list of scenes...
        const loadedScenes = this.scene.manager.scenes;
        console.log('loaded scenes:', loadedScenes, 'scenemanager keys:', this.scene.manager.keys);

        // Testing of correct canvas scaling / positioning
        const tl:Phaser.GameObjects.Rectangle = this.add.rectangle(0, this.getY(0) + 50, 200, 100, 0xff0000);  // top left
        tl.setOrigin(0, 0);
        tl.setData({ y: 0});
        this.add.rectangle(1920, this.getY(0) + 50, 200, 100, 0xff0000);  // top right
        this.add.rectangle(0, this.getY(1080) - 50, 200, 100, 0x00ff00); // bottom left
        this.add.rectangle(1920, this.getY(1080) - 50, 200, 100, 0x00ff00); // bottom right

        // This is more of a fully-featured button showing a lot of the options available
        const button = this.add.rectangle(960, this.getY(540), 200, 100, 0x0000ff); // center
        button.setInteractive({ useHandCursor: true })
        .on('pointerdown', (e: Phaser.Input.Pointer) => {
            console.log('Click - load quiz:', e);
            if (this.scene.get('MoneyTree')) {
                console.log('Already loaded - start immediately');
                this.scene.start('MoneyTree');
            } else {
                console.log('Not yet loaded - loading first...');
                this.load.sceneFile('MoneyTree', './moneytree.min.js');
                this.load.once('complete', (key: string) => {
                    console.log('Quiz loaded...:', key);
                    this.scene.start('MoneyTree');
                });
                this.load.start();
            }
        })
        .on('pointerover', () => button.setFillStyle(0x00ffff))
        .on('pointerout', () => button.setFillStyle(0x0000ff));
        button.setOrigin(0.5, 0.5);
        button.setStrokeStyle(2, 0xffffff);
        button.setAlpha(0.7);
        button.setScale(1.5, 1.5);
        button.setVisible(true);
        button.setAngle(0); // Set rotation angle
        button.w = 540; // override the w property (unused by Phaser) to store the logical y position

        // Experiments with buttons/text - good for quiz
        const questionText = "By using a base scene that interacts with the SocketPlugin, you can effectively manage shared functionality across multiple scenes without directly handling the socket instance in each scene. This keeps your code organized and leverages the power of Phaser's plugin system. If you have any further questions or need additional assistance, feel free to ask!";
        // this.startButton = this.add.text(960, 0, questionText)
        //     .setFontFamily('Arial')
        //     .setOrigin(0.5, 0)
        //     .setPadding(10)
        //     .setFontSize(64)
        //     .setStroke('#0000FF', 6)
        //     .setAlign('center')
        //     .setStyle({ backgroundColor: '#AA0', border: '8px white solid' })
        //     .setInteractive({ useHandCursor: true })
        //     .setWordWrapWidth(1720)
        //     .on('pointerdown', () => { console.log('Button click'); })
        //     .on('pointerover', () => this.startButton.setStyle({ fill: '#f39c12' }))
        //     .on('pointerout', () => this.startButton.setStyle({ fill: '#FFF' }));

        // console.log('startButton:', this.startButton.height, this.startButton.text);

        // this.startButton.setFixedSize(1800, this.startButton.height);

        // this.tweens.addCounter({
        //     from: 0,
        //     to: questionText.length + 1,
        //     duration: questionText.length * 50,
        //     onUpdate: (tween: Phaser.Tweens.Tween) => {
        //         const v = tween.getValue();
        //         if (questionText.substring(v, v + 1) === ' ' || v > questionText.length) {
        //             this.startButton.setText(questionText.substring(0, v));
        //         }
        //     }
        // });

        // Experiment with 9-slice for adding a border around some text (eg question cards)
        // const nineSlice = this.make.nineslice({
        //     x: 960,
        //     y: this.getY(1080),
        //     key: 'borderbox',
        //     width: 1920,
        //     height: 80,
        //     leftWidth: 12,
        //     rightWidth: 12,
        //     topHeight: 12,
        //     bottomHeight: 12,
        //     origin: { x: 0.5, y: 1 },
        //     add: true
        // });
    }

    logDisplaySizes(): void {
        // console.log("Window size:", window.innerWidth, window.innerHeight);
        // console.log("Canvas DOM size:", game.canvas.clientWidth, game.canvas.clientHeight);
        console.log('Canvas size:', this.scale.canvas.width, this.scale.canvas.height);
        console.log("Phaser scale size:", this.scale.width, this.scale.height);
        console.log("Camera display size:", this.cameras.main.displayWidth, this.cameras.main.displayHeight);
        console.log("Camera scroll:", this.cameras.main.scrollX, this.cameras.main.scrollY);
        console.log("Camera world view:", this.cameras.main.worldView);
        console.log("Camera zoom:", this.cameras.main.zoom);
    }
    sceneShutdown(): void {
        console.log('Lobby:: sceneShutdown...');
        // Remove any socket listeners or other cleanup tasks here
    }

}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    scale: {
        mode: Phaser.Scale.RESIZE
    },
    plugins: {
        global: [
            { key: 'SocketManagerPlugin', plugin: SocketManagerPlugin, start: false }
        ]
    },
    scene: Lobby,
    parent: 'container'
};

const game = new Phaser.Game(config);
console.log('Game created:', game);