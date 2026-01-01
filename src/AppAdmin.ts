import Phaser from 'phaser';
import SocketManagerPlugin from './socketManager';
import WebFontLoaderPlugin from 'phaser3-rex-plugins/plugins/webfontloader-plugin';
import RexPlugins from './scripts/rexUI';

import { QuizAdminScene } from 'src/quiz/QuizAdminScene';
import { QuizHostScene } from 'src/quiz/QuizHostScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    backgroundColor: '#222222',
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
                sceneKey: 'QuizAdminScene'
            },
            {
                key: 'rexToggleSwitch',
                plugin: RexPlugins.ToggleSwitch,
                mapping: 'rexToggleSwitch',
                sceneKey: 'QuizAdminScene'
            }
        ]
    },
    scene: [QuizAdminScene, QuizHostScene],
    parent: 'container'
};

const game = new Phaser.Game(config);
console.log('AppAdmin:: Game created:', game);

// Parse URL parameters and path
const urlParams = new URLSearchParams(window.location.search);
const quizID = urlParams.get('q');

// Extract room and game from path: /admin/:room/:game
const pathSegments = window.location.pathname.split('/').filter(s => s.length > 0);
console.log('AppAdmin:: window.location.pathname:', window.location.pathname);
console.log('AppAdmin:: Path segments:', pathSegments);

// Expected segments: ["admin", "ROOMID", "GAME"]
const roomID = pathSegments[1];
const gameKey = pathSegments[2];

const startInitialScene = () => {
    console.log('AppAdmin:: Ready. Path info:', { roomID, gameKey, quizID });

    if (gameKey === 'quiz') {
        console.log('AppAdmin:: Starting QuizAdminScene');
        game.scene.start(QuizAdminScene.KEY, { quizID: quizID, roomID: roomID });
    } else {
        console.log('AppAdmin:: Defaulting to QuizAdminScene');
        game.scene.start(QuizAdminScene.KEY, { quizID: quizID, roomID: roomID });
    }
};

if (game.isBooted) {
    startInitialScene();
} else {
    game.events.once('ready', startInitialScene);
}
