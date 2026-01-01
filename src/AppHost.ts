import Phaser from 'phaser';
import SocketManagerPlugin from './socketManager';
import WebFontLoaderPlugin from 'phaser3-rex-plugins/plugins/webfontloader-plugin';

// This is a bit of a weird way to import the plugin (downloaded from CDN then exported) but it works
// When attempting to import from the node_modules directly, it didn't work
import RexPlugins from './scripts/rexUI';

import { LobbyHostScene } from './lobby/LobbyHostScene';
import { QuizHostScene } from './quiz/QuizHostScene';

// Parse URL parameters and path to determine initial scene
const urlParams = new URLSearchParams(window.location.search);
const quizID = urlParams.get('q');

// Extract role, room and game from path: /:role/:room/:game
const pathSegments = window.location.pathname.split('/').filter(s => s.length > 0);
console.log('AppHost:: window.location.pathname:', window.location.pathname);
console.log('AppHost:: Path segments:', pathSegments);

// Expected segments: ["host", "ROOMID", "GAME"]
const role = pathSegments[0];
const roomID = pathSegments[1];
const gameKey = pathSegments[2];

// Determine scene order - first scene in array starts automatically
const scenes = [];
if (gameKey === 'quiz') {
    scenes.push(QuizHostScene, LobbyHostScene);
} else {
    scenes.push(LobbyHostScene, QuizHostScene);
}

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
    scene: scenes,
    parent: 'container'
};

// Enable Socket.IO debugging
if (__DEV__) {
    localStorage.debug = 'socket.io-client:socket';
    console.log('Socket.IO debugging enabled in development mode');
}

const game = new Phaser.Game(config);
console.log('AppHost:: Game created:', game);

const startInitialScene = () => {
    console.log('AppHost:: Ready. Path info:', { role, roomID, gameKey, quizID });

    if (gameKey === 'quiz') {
        console.log('AppHost:: Starting QuizHostScene');
        game.scene.start(QuizHostScene.KEY, { quizID: quizID, roomID: roomID });
    } else if (gameKey === 'lobby' || !gameKey || gameKey === 'dashboard') {
        console.log('AppHost:: Starting LobbyHostScene');
        game.scene.start(LobbyHostScene.KEY, { roomID: roomID });
    } else {
        console.log('AppHost:: Unknown gameKey, defaulting to LobbyHostScene:', gameKey);
        game.scene.start(LobbyHostScene.KEY, { roomID: roomID });
    }
};

if (game.isBooted) {
    // Small delay to ensure DOM is stable for resize calculations
    setTimeout(startInitialScene, 100);
} else {
    game.events.once('ready', () => {
        setTimeout(startInitialScene, 100);
    });
}

