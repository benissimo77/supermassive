import Phaser from 'phaser';
import SocketManagerPlugin from './socketManager';
import WebFontLoaderPlugin from 'phaser3-rex-plugins/plugins/webfontloader-plugin';

// This is a bit of a weird way to import the plugin (downloaded from CDN then exported) but it works
// When attempting to import from the node_modules directly, it didn't work
import RexPlugins from './scripts/rexUI';

import { LobbyHostScene } from './lobby/LobbyHostScene';
import { QuizHostScene } from './quiz/QuizHostScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    backgroundColor: '#0000DD',
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
                sceneKey: ['LobbyHostScene', 'QuizHostScene']
            },
            {
                key: 'rexToggleSwitch',
                plugin: RexPlugins.ToggleSwitch,
                mapping: 'rexToggleSwitch'
            }
        ]
    },
    scene: [LobbyHostScene, QuizHostScene],
    parent: 'container'
};

const game = new Phaser.Game(config);
console.log('Game created:', game );

// Start with the appropriate scene and pass data - this works....
// game.events.once('ready', () => {

//     console.log(`READY EVENT fired: Starting initial scene: {quizId: ${quizId}}`);

//     // Stop all scenes first
//     game.scene.scenes.forEach(scene => {
//         scene.scene.stop();
//     });
    
//     // Start the appropriate scene with configuration
//     game.scene.start(QuizHostScene.KEY, { quizId: quizId });
// });

