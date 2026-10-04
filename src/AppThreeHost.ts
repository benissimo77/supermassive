import Phaser from 'phaser';
import SocketManagerPlugin from './socketManager';
import WebFontLoaderPlugin from 'phaser4-rex-plugins/plugins/webfontloader-plugin';

import { ThreeHostScene } from 'src/three/ThreeHostScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    transparent: true,
    backgroundColor: 'rgba(0,0,0,0)',
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
            }
        ]
    },
    scene: [ThreeHostScene],
    parent: 'container'
};

const game = new Phaser.Game(config);
console.log('AppThreeHost:: Game created:', game);
