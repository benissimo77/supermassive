import Phaser from 'phaser';
import SocketManagerPlugin from './socketManager';
import WebFontLoaderPlugin from 'phaser4-rex-plugins/plugins/webfontloader-plugin';

import RexPlugins from 'src/utils/rexUI';
import { QuizHostScene } from 'src/quiz/QuizHostScene';
import { QuizIntroScene } from 'src/quiz/QuizIntroScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    transparent: true,
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
        ],
        scene: [
            {
                key: 'rexUI',
                plugin: RexPlugins.UI,
                mapping: 'rexUI',
                sceneKey: 'QuizHostScene'
            },
            {
                key: 'rexToggleSwitch',
                plugin: RexPlugins.ToggleSwitch,
                mapping: 'rexToggleSwitch',
                sceneKey: 'QuizHostScene'
            }
        ]
    },
    scene: [QuizHostScene, QuizIntroScene],
    parent: 'container'
};

const game = new Phaser.Game(config);
console.log('AppQuizHost:: Game created:', game);
