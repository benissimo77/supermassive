import Phaser from 'phaser';
import SocketManagerPlugin from './socketManager';
import WebFontLoaderPlugin from 'phaser3-rex-plugins/plugins/webfontloader-plugin.js';

import { LobbyPlayScene } from './lobby/LobbyPlayScene';
import { QuizPlayScene } from './quiz/QuizPlayScene';


const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    backgroundColor: '#051C55',
    scale: {
        mode: Phaser.Scale.RESIZE
    },
    dom: {
        createContainer: true
    },
    plugins: {
        global: [
            {
                key: 'SocketManagerPlugin',
                plugin: SocketManagerPlugin,
                start: true
            },
            {
                key: 'rexWebFontLoader',
                plugin: WebFontLoaderPlugin,
                start: true
            }]
    },
    scene: [LobbyPlayScene, QuizPlayScene],
    parent: 'container'
};

const game = new Phaser.Game(config);
console.log('Game created:', game);
