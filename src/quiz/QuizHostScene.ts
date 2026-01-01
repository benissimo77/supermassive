import gsap from 'gsap';

declare const __DEV__: boolean;

import { BaseScene } from "src/BaseScene";
import { SocketDebugger } from "src/SocketDebugger";
import { QuizMap, QuizMapData } from "./QuizMap";

import { QuestionFactory } from "./questions/QuestionFactory";
import { BaseQuestion } from "./questions/BaseQuestion";
import { Racetrack } from "./Racetrack";
import { PlayerConfig, PhaserPlayerState, PhaserPlayer } from './PhaserPlayer';
import { YouTubePlayerUI } from './YouTubePlayerUI';

import { GlobalNavbar } from 'src/ui/GlobalNavbar';
import { SoundSettingsPanel } from 'src/ui/SoundSettingsPanel';

export class QuizHostScene extends BaseScene {

    static readonly KEY = 'QuizHostScene';

    private socketDebugger: SocketDebugger;

    private currentQuestion: BaseQuestion;
    private currentRoundNumber: number = 0;
    private currentQuestionNumber: number = 0;
    private quizMap: QuizMap;
    private phaserPlayers: Map<string, PhaserPlayer> = new Map();
    private playerScores: Map<string, number> = new Map();
    private playerAnswers: Map<string, any> = new Map();
    private questionFactory: QuestionFactory;

    // UI elements
    private timerBar: Phaser.GameObjects.Graphics;
    private timerText: Phaser.GameObjects.Text;
    private globalNavbar: GlobalNavbar;
    private soundSettings: SoundSettingsPanel;

    private streamModeIndicator: Phaser.GameObjects.Text;
    private streamCue: Phaser.GameObjects.Graphics;

    // Containers - created once in order to set the ordering
    private playerContainer: Phaser.GameObjects.Container;
    private questionContainer: Phaser.GameObjects.Container;

    // For key press handling
    private lastKeyTime: number = 0;

    // Racetrack for animating scores
    private racetrack: Racetrack;

    private background: Phaser.GameObjects.Image;
    private backgroundOverlay: Phaser.GameObjects.Graphics;

    // Add this constructor to set the scene key
    constructor() {
        super(QuizHostScene.KEY);
    }

    init(): void {

        super.init();

        console.log('QuizHostScene:: init.');

        // for host the TYPE will be 'host' or 'solo'
        this.TYPE = 'host';
        this.playerScores = new Map();
        this.playerAnswers = new Map();
        this.questionFactory = new QuestionFactory(this);

        // General keyboard listener - useful for keyboard control
        if (this.input?.keyboard) {
            this.input.keyboard.on('keydown', this.handleKeyDown, this);
        }
        // General mouse listener - can adjust display when user moves mouse
        // this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        //     console.log(`Pointer moved to: x=${pointer.x}, y=${pointer.y}`);
        // }, this);

        // Setup socket listeners
        this.setupSocketListeners();
    }

    preload(): void {

        super.preload();

        // Load common assets for all question types
        // Background images
        this.load.image('quiz-background', '/img/quiz/background.jpg');
        // this.load.image('quiz-background', '/img/quiz/background.jpg');
        // this.load.image('quiz-background', '/assets/img/grid1920x1080.png');

        // Button images
        this.load.image('simple-button', '/assets/img/simplebutton.png');
        this.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
        this.load.image('dropzone', '/assets/img/dropzone.png');

        // YouTube player buttons
        this.load.image('player-play', '/assets/img/YouTubePlayerButtons_90px_0002_play.png');
        this.load.image('player-pause', '/assets/img/YouTubePlayerButtons_90px_0001_pause.png');
        this.load.image('player-replay', '/assets/img/YouTubePlayerButtons_90px_0000_replay.png');

        // Crosshair for drag-and-drop
        this.load.image('crosshair', '/img/crosshair40.png');

        // Audio assets - theme music
        this.load.audio('quiz-music-intro', '/assets/audio/quiz/music/modern-beat-jingle-intro-149598.mp3');
        this.load.audio('quiz-countdown', '/assets/audio/quiz/music/quiz-countdown-337785.mp3');
        this.load.audio('quiz-race', '/assets/audio/quiz/music/1-01 Title.m4a');
        this.load.audio('quiz-end', '/assets/audio/quiz/music/2-10 Koopa Cape (Final Lap).m4a');

        // Audio - voice
        // this.load.audio('quiz-voice-intro', '/assets/audio/quiz/music/quiz-intro-Gabriella.mp3');

        // Audio SFX
        this.load.audio('answer-correct', '/assets/audio/quiz/fx/320655__rhodesmas__level-up-01.wav');
        this.load.audio('answer-incorrect', '/assets/audio/quiz/fx/150879__nenadsimic__jazzy-chords.wav');
        this.load.audio('button-click', '/assets/audio/quiz/fx/114187__edgardedition__thud17.wav');
        this.load.audio('submit-answer', '/assets/audio/quiz/fx/585256__lesaucisson__swoosh-2.mp3');
        this.load.audio('question-answered', '/assets/audio/quiz/fx/446100__justinvoke__bounce.wav');
        this.load.audio('end-question', '/assets/audio/quiz/fx/gong-hit-2-184010.mp3');

        // Load custom fonts
        this.load.rexWebFont({
            google: {
                families: ['Titan One']
            }
        });

    }

    create(): void {

        super.create();

        if (this.rexUI) {
            // Create your UI components
            console.log('Rex UI Plugin loaded successfully');
        } else {
            console.error('Rex UI Plugin not loaded properly');
        }

        // Create background
        this.background = this.add.image(0, 0, 'quiz-background').setOrigin(0, 0);
        this.background.setDisplaySize(1920, this.getY(1080));
        this.backgroundContainer.add(this.background);

        // Overlay to darken the background
        this.backgroundOverlay = this.add.graphics();
        this.backgroundOverlay.fillStyle(0x000000, 0.7);
        this.backgroundOverlay.fillRect(0, 0, 1920, this.getY(1080));
        this.backgroundContainer.add(this.backgroundOverlay);

        // Create score racetrack but begin with it off-screen
        // TODO: factor this out into its own SCENE
        this.racetrack = new Racetrack(
            this,
            1920,
            this.getY(400)
        );
        this.racetrack.setPosition(0, this.getY(640));
        this.add.existing(this.racetrack);
        this.mainContainer.add(this.racetrack);
        this.racetrack.flyOut().play();

        this.quizMap = new QuizMap(this, 0, this.getY(1000));
        this.add.existing(this.quizMap);
        this.mainContainer.add(this.quizMap);

        // Create the containers for all UI elements (eg round intro)
        // Note: these are added to the 'base' containers set up in BaseScene: background, UI, main, top, overlay
        this.playerContainer = this.add.container(0, 0);
        this.questionContainer = this.add.container(0, 0);
        this.mainContainer.add(this.playerContainer);
        this.mainContainer.add(this.questionContainer);

        // Start background music - this works
        // this.soundManager.playMusic('quiz-intro-music', { fadeIn: 2000 });

        // Only create the debugger in debug mode
        const debugMode = __DEV__;
        if (debugMode) {
            this.socketDebugger = new SocketDebugger(this, this.socket);
        }

        // Global navbar - this should go in some kind of global host scene so its available to all host scenes
        this.globalNavbar = new GlobalNavbar(this);
        this.add.existing(this.globalNavbar);

        // Add a settings button to open the panel
        this.soundSettings = new SoundSettingsPanel(this);
        this.add.existing(this.soundSettings);

        this.globalNavbar.addIcon('audio-settings', () => {
            console.log('Settings icon clicked');
            this.soundSettings.toggle();
        });

        // Ensure initial layout is correct before starting bootstrap
        this.sceneDisplay();

        // SEQUENTIAL BOOTSTRAP:
        // 1. host:ready -> get roomID
        // 2. host:requestgame -> load game module
        // 3. host:requeststart -> start game logic

        console.log('QuizHostScene:: Starting sequential bootstrap...');
        this.socket?.emit('consolelog', 'QuizHostScene:: Starting sequential bootstrap...');

        const urlParams = new URLSearchParams(window.location.search);
        const quizID = this.scene.settings.data?.quizID || urlParams.get('q');

        // 1. host:ready -> get roomID and show instructions
        this.socket.emit('host:ready', {}, (readyResponse: any) => {
            console.log('QuizHostScene:: host:ready ack received:', readyResponse);
            this.socket?.emit('consolelog', `QuizHostScene:: host:ready ack received: ${JSON.stringify(readyResponse)}`);
            if (readyResponse && readyResponse.roomID) {
                this.roomID = readyResponse.roomID;
                this.load.image('roomQR', `/assets/qr/${this.roomID}.png`);
                this.load.once('complete', () => {
                    console.log('QuizHostScene:: Room QR code image loaded');
                    this.showInstructions();
                });
                this.load.start();
            }
        });

        // 2. Request the game module and pass the quizID config
        console.log('QuizHostScene:: Requesting game "quiz" from server...');
        this.socket.emit('host:requestgame', 'quiz', { quizID }, (gameResponse: any) => {
            console.log('QuizHostScene:: host:requestgame ack received:', gameResponse);
            this.socket?.emit('consolelog', `QuizHostScene:: host:requestgame ack received: ${JSON.stringify(gameResponse)}`);

            if (gameResponse && gameResponse.success) {
                // 3. Auto-start if quizID is present
                if (quizID) {
                    console.log('QuizHostScene:: Auto-starting quiz:', quizID);
                    this.socket.emit('host:requeststart');
                }
            } else {
                console.error('QuizHostScene:: Failed to load game "quiz":', gameResponse ? gameResponse.error : 'No response');
            }
        });
    }


    private setupSocketListeners(): void {

        // Player connect/disconnect - these are caught by BaseScene but quiz can also take action
        // BaseScene handles the storage/maintenance of playerConfigs - game decides their own visuals
        this.socket.on('playerconnect', (playerConfig: PlayerConfig) => {
            console.log('QuizHostScene:: playerconnect :', { playerConfigs: this.getPlayerConfigsAsArray() });
            const player: PhaserPlayer = this.getPlayerBySessionID(playerConfig.sessionID);
            if (player) {
                player.connected();
            } else {
                this.addPlayer(playerConfig);
            }
        });

        // When player disconnects don't remove from list as they might re-join
        // They simply become 'dormant' and won't receive questions - but if they re-join they will be right back where they left off
        this.socket.on('playerdisconnect', (sessionID: string) => {
            console.log('QuizHostScene:: playerdisconnect:', sessionID);
            const player: PhaserPlayer = this.getPlayerBySessionID(sessionID);
            if (player) {
                player.disconnected();
            } else {
                console.warn(`Player with session ID ${sessionID} not found.`);
            }
        });

        this.socket.on('server:players', (playerConfigs: PlayerConfig[]) => {
            console.log('QuizHostScene:: server:players:', playerConfigs);

            playerConfigs.forEach((playerConfig: PlayerConfig) => {
                this.addPlayer(playerConfig);
            });
        });


        // Listen for intro quiz message
        this.socket.on('server:introquiz', (data) => {
            if (data.quizMap) {
                this.quizMap.setMapData(data.quizMap);
                this.quizMap.updatePosition(0, 0, 'INTRO_QUIZ');
            }
            this.showQuizIntro(data.title, data.description);
        });

        // Listen for intro round message
        this.socket.on('server:introround', (data) => {
            if (data.roundnumber) {
                this.currentRoundNumber = data.roundnumber;
                this.currentQuestionNumber = 0;
                this.quizMap.updatePosition(this.currentRoundNumber, 0, 'INTRO_ROUND');
            }
            this.showRoundIntro(data.roundnumber, data.title, data.description);
        });

        // Listen for question - not sure if this should all be here...
        this.socket.on('server:question', async (question, callback) => {
            if (question.roundNumber && question.questionNumber) {
                this.currentRoundNumber = question.roundNumber;
                this.currentQuestionNumber = question.questionNumber;
                const state = question.mode === 'answer' ? 'SHOW_ANSWER' : 'QUESTION';
                this.quizMap.updatePosition(this.currentRoundNumber, this.currentQuestionNumber, state);
            }
            let receivedTime = Date.now();
            await this.createQuestion(question);
            const displayTime = Date.now() - receivedTime;
            const deviceInfo = {
                device: /iPad/.test(navigator.userAgent) ? 'iPad' :
                    /iPhone|iPod/.test(navigator.userAgent) ? 'iPhone' :
                        /Android/.test(navigator.userAgent) ? 'Android' : 'Other',
                displayTime: displayTime
            };
            if (callback && typeof callback === 'function') {
                callback(deviceInfo);
            }

            // Animate the arrival of the question - based on the direction we are currently moving
            // This might be better moved to its own function but for now leave it here...
            if (question.direction === 'forward') {
                this.currentQuestion.x = 1920;
            } else {
                this.currentQuestion.x = -1920;
            }
            // Make sure it's added to the scene, and to the question container (for depth management)
            this.add.existing(this.currentQuestion);
            this.questionContainer.add(this.currentQuestion);

            gsap.to(this.currentQuestion, {
                duration: 1,
                x: 0,
                ease: 'back.out(1.7)',
                onComplete: () => {
                    console.log('GSAP animation complete!');
                    this.socket.emit('host:response');
                    if (question.mode === 'ask') {
                        this.soundManager.playMusic('quiz-countdown', { volume: 0.3, fadeIn: 6000 });
                    } 
                    // Update receivedTime just to make answerTime slightly more accurate
                    receivedTime = Date.now();
                }
            });

            // This code taken from QuizPlayScene - the way to submit an answer (for single-player mode when hosting)
            this.currentQuestion.onAnswer((answer: any) => {
                console.log('QuizHostScene:: answer:', answer);
                // Send the answer to the server
                this.socket.emit('client:response', { answer: answer, answerTime: Date.now() - receivedTime });
            });

            // Set all players to state of ANSWERING
            // - re-parent them in playerContainer
            // - animate them to the bottom of the screen on the next tween update
            this.phaserPlayers.forEach((player: PhaserPlayer) => {
                if (player.parentContainer === this.racetrack) {
                    player.x += this.racetrack.x;
                    player.y += this.racetrack.y;
                    this.playerContainer.add(player);
                }
                player.setPlayerState(PhaserPlayerState.ANSWERING);
                player.resetPlayerScoreText();
                this.animatePlayer(player);
                this.racetrack.flyOut().play();
            });

        });

        // Player answered a question
        this.socket.on('server:questionanswered', (data) => {
            this.playerAnswers.set(data.sessionID, data.response);
            this.updatePlayerAnswer(data.sessionID, data.response);
            const player: PhaserPlayer = this.getPlayerBySessionID(data.sessionID);
            if (player) {
                player.setPlayerState(PhaserPlayerState.ANSWERED);
                this.tweens.killTweensOf(player);
                this.soundManager.playFX('question-answered', 0.3);
                this.tweens.add({
                    targets: player,
                    y: this.getY(880),
                    duration: 500,
                    ease: 'Back.InOut',
                    onComplete: () => {
                        player.setPlayerState(PhaserPlayerState.FLOATING);
                        this.animatePlayer(player);
                    }
                });
            }
        });

        // endquestion - clean up any question-specific elements
        this.socket.on('server:endquestion', (data) => {
            console.log('QuizHostScene:: server:endquestion');
            this.soundManager.playFX('end-question', 0.5);
            this.soundManager.stopTrack('quiz-countdown');
        });

        // Show answer
        this.socket.on('server:showanswer', async (question) => {
            this.quizMap.updatePosition(this.currentRoundNumber, this.currentQuestionNumber, 'SHOW_ANSWER');
            await this.createQuestion(question);
            // Make sure it's added to the scene, and to the question container (for depth management)
            this.add.existing(this.currentQuestion);
            this.questionContainer.add(this.currentQuestion);
            this.showAnswer();
        });

        // Update scores
        this.socket.on('server:updatescores', (data) => {
            this.quizMap.updatePosition(this.currentRoundNumber, this.currentQuestionNumber, 'UPDATE_SCORES');
            this.updateScores(data.scores);
        });

        // End round
        this.socket.on('server:endround', (data) => {
            this.quizMap.updatePosition(this.currentRoundNumber, this.currentQuestionNumber, 'END_ROUND');
            this.soundManager.stopAll( 3000 );
            this.endRound(data);
        });

        // End quiz
        this.socket.on('server:endquiz', (data) => {
            this.quizMap.updatePosition(this.currentRoundNumber, this.currentQuestionNumber, 'END_QUIZ');
            this.showFinalScores(data);
        });

        // Start timer
        this.socket.on('server:starttimer', (data) => {
            this.startTimer(data.duration);
        });

        this.socket.on('server:waitingforstream', (data) => {
            console.log('QuizHostScene:: server:waitingforstream:', data);
            this.showStreamCue();
        });

        this.socket.on('server:streammode', (data) => {
            console.log('QuizHostScene:: server:streammode:', data);
            this.updateStreamModeIndicator(data.enabled);
        });

        this.socket.on('server:collectanswers', () => {
            console.log('QuizHostScene:: server:collectanswers:');
            if (this.streamCue) {
                this.streamCue.destroy();
            }
        });
    }

    private handleKeyDown(event: KeyboardEvent): void {

        // Ignore modifier keys themselves to prevent them from triggering debouncing or server events
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
            return;
        }

        // Debounce key presses to prevent rapid firing
        const currentTime: number = Date.now();
        if (currentTime - this.lastKeyTime < 300) {
            return;
        }
        this.lastKeyTime = currentTime;

        // Get the key name (convert to uppercase for consistency)
        const keyName = event.key.toUpperCase();

        console.log(`Key pressed: ${keyName} (code: ${event.code}) ${event.shiftKey ? 'with Shift' : ''} ${event.ctrlKey ? 'with Ctrl' : '' }`);
        this.socket.emit('host:keypress', { key: event.code, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey });
        this.flyQuestionOut(event.code);
    }

    private showRoomID(roomID: string): void {
        const roomTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(96),
            strokeThickness: 6,
            backgroundColor: '#000000',
            color: '#FFFF00',
            padding: { x: 40, y: this.getY(30) }
        });
        const roomText = this.add.text(1900, this.getY(1060), roomID, roomTextConfig)
            .setOrigin(1, 1);
        this.topContainer.add(roomText);
    }

    // flyQuestionOut - animate the current question off screen based on direction
    // This is done to provide instant feedback to host that question is moving on
    // If we wait for the server to respond there can be some latency which feels unresponsive
    // IMPORTANT: can only happen when showAnswer/updateScores happens at end of round NOT each question
    // This is because we still expecct the question to be on screen when showAnswer is received
    flyQuestionOut(keyCode: string): void {
        if (this.currentQuestion && 0) {
            if (keyCode === 'ArrowRight') {
                this.tweens.add({
                    targets: this.currentQuestion,
                    x: -1920,
                    duration: 500,
                });
            }
            if (keyCode === 'ArrowLeft') {
                this.tweens.add({
                    targets: this.currentQuestion,
                    x: 1920,
                    duration: 500,
                });
            }
        }
    }

    // addPlayer - accepts a playerConfig and creates a PhaserPlayer instance
    // Performs all relevant initialization and sets up the player in the scene
    // Returns a PhaserPlayer instance, though maybe this is not needed
    addPlayer(playerConfig: PlayerConfig): PhaserPlayer {
        const phaserPlayer: PhaserPlayer = new PhaserPlayer(this, playerConfig);
        this.phaserPlayers.set(playerConfig.sessionID, phaserPlayer);
        this.add.existing(phaserPlayer);
        this.playerContainer.add(phaserPlayer);

        phaserPlayer.setPosition(-480, Phaser.Math.Between(0, this.getY(1080)));
        this.animatePlayer(phaserPlayer);
        // this.scoreRacetrack.addPlayersToTrack(this.getPlayerConfigsAsArray());

        // Fun with FX!1
        // Shine adds a nice flashy sliding light effect
        const shine: Phaser.FX.Shine = phaserPlayer.postFX.addShine(1, 0.2, 5);
        // Bloom adds a glow effect - but it seemed to make player darker...
        const bloom: Phaser.FX.Bloom = phaserPlayer.postFX.addBloom(0xff0000, 1, 1, 0, 1.2);
        // Circle makes the player appear in a circular mask
        const circle: Phaser.FX.Circle = phaserPlayer.postFX.addCircle();
        phaserPlayer.postFX.remove(shine);
        phaserPlayer.postFX.remove(bloom);
        phaserPlayer.postFX.remove(circle);

        console.log('addPlayer:', phaserPlayer, shine);
        return phaserPlayer;
    }

    animatePlayer(player: PhaserPlayer): void {
        // console.log('animatePlayer:', player);
        
        // If player is racing, do not animate anymore since racetrack will control player
        if (player.getPlayerState() === PhaserPlayerState.RACING) {
            return;
        }

        this.tweens.killTweensOf(player);
        this.tweens.add({
            targets: player,
            x: Phaser.Math.Between(0, 1920),
            y: player.getPlayerState() === PhaserPlayerState.FLOATING ? Phaser.Math.Between(0, this.getY(980)) : this.getY(1080 - 20),
            duration: Phaser.Math.Between(2000, 4000),
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                this.animatePlayer(player);
                // player.setPosition(0, Phaser.Math.Between(0, this.getY(1080)));
            }
        });
    }

    // getPlayerBySessionID - overridden from BaseScene to return PhaserPlayer
    getPlayerBySessionID(sessionID: string): PhaserPlayer {
        return this.phaserPlayers.get(sessionID)!;
    }

    private createUI(): void {

        // Round display - uses labelConfig defined in BaseScene
        const roundDisplayConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(36),
            strokeThickness: 4
        });
        const roundDisplay = this.add.text(960, this.getY(50), '', roundDisplayConfig);

        // Timer bar
        this.timerBar = this.add.graphics();

        // Timer text
        const timerTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(36),
            strokeThickness: 3
        });
        this.timerText = this.add.text(960, this.getY(600), '', timerTextConfig);

        // Stream mode indicator
        this.streamModeIndicator = this.add.text(10, this.getY(1070), 'STREAM MODE: OFF', {
            fontSize: '24px',
            color: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0, 1).setAlpha(0.5);
        this.topContainer.add(this.streamModeIndicator);
    }

    private showInstructions(): void {
		const panel = this.add.container(960, this.getY(1080) - 480);
		const bg = this.add.rectangle(0, 0, 1600, 400, 0x000000, 0.4).setOrigin(0.5, 0);
		panel.add(bg);
		const title = this.add.text(0, 60, 'How to Join', { fontSize: '64px', color: '#fff', fontFamily: 'Titan One' }).setOrigin(0.5);
		panel.add(title);
		
		// Two-column layout
		// - left column for manual steps: 1. Go to VIDEOSWIPE.NET 2. Tap 'Start Playing Now' card 3. Enter room code: ROOMID
		// - right column display message 'Or scan QR code' and show QR code image below
		// Enter your name and select an avatar to join the game
		const instr = this.add.text(-700, 120, "VIDEOSWIPE.NET\nTap 'Start Playing Now'\nRoom code: " + this.roomID, { fontFamily: 'Titan One', fontSize: '48px', color: '#ccc', align: 'left', wordWrap: { width: 800 }, lineSpacing: 30 }).setOrigin(0);
		panel.add(instr);

		const orText = this.add.text(0, 190, 'OR', { fontFamily: 'Titan One', fontSize: '48px', color: '#77e', align: 'center' }).setOrigin(0.5);
		panel.add(orText);

		const qrImage = this.add.image(500, 240, 'roomQR').setDisplaySize(240, 240).setOrigin(0.5);
		panel.add(qrImage);

		const closeBtn = this.add.text(760, 20, 'X', { fontSize: '32px', color: '#fff' }).setInteractive({ useHandCursor: true });
		closeBtn.on('pointerdown', () => panel.destroy());
		panel.add(closeBtn);
		bg.setInteractive();
	}


    private showQuizIntro(title: string, description: string): void {

        console.log('QuizHostScene:: showQuizIntro:', title);
        this.socket?.emit('consolelog', `QuizHostScene:: showQuizIntro: ${title}`);

        // Clear previous UI
        this.clearUI();

        // Show quiz title
        const titleConfig = Object.assign({}, this.labelConfig, {
            fontSize: 80,
            strokeThickness: 6,
            wordWrap: { width: 1400, useAdvancedWrap: true }
        });
        const titleText = this.add.text(960, this.getY(180), title, titleConfig)
            .setOrigin(0.5);

        // Remove HTML tags from description (until I can find a way to render them properly)
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");
        // const cleanDescription = description;

        // Show description
        const descConfig = Object.assign({}, this.labelConfig, {
            fontSize: 48,
            strokeThickness: 3,
            wordWrap: { width: 1600, useAdvancedWrap: true }
        });
        const descText = this.add.text(960, this.getY(350), cleanDescription, descConfig)
            .setOrigin(0.5, 0);

        // Add "Start" button
        console.log('QuizHostScene:: showQuizIntro: creating start button');
        const startButton = this.createSimpleButton(960, descText.y + descText.height + this.getY(120), 'START QUIZ');

        console.log('QuizHostScene:: showQuizIntro: adding elements to UIContainer');
        this.UIContainer.add([titleText, descText, startButton]);

        console.log('QuizHostScene:: showQuizIntro: starting GSAP animation. GSAP version:', gsap?.version);
        this.socket?.emit('consolelog', `QuizHostScene:: showQuizIntro: starting GSAP animation. GSAP version: ${gsap?.version}`);

        if (!gsap) {
            console.error('QuizHostScene:: showQuizIntro: GSAP is undefined!');
            this.socket?.emit('consolelog', 'QuizHostScene:: showQuizIntro: GSAP is undefined!');
            return;
        }

        gsap.fromTo(this.UIContainer,
            { y: this.getY(-1080) },
            {
                duration: 1,
                y: 0,
                ease: 'power2.out',
                onComplete: () => {
                    console.log('QuizHostScene:: showQuizIntro: GSAP animation complete!');
                    this.socket?.emit('consolelog', 'QuizHostScene:: showQuizIntro: GSAP animation complete!');
                }
            }
        );
    }

    private showRoundIntro(roundNumber: number, title: string, description: string): void {

        console.log('QuizHostScene:: showRoundIntro:', roundNumber, title);
        this.socket?.emit('consolelog', `QuizHostScene:: showRoundIntro: ${roundNumber} ${title}`);

        // Clear previous UI
        this.clearUI();

        // Show round title
        const titleConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(80),
            strokeThickness: 6,
            wordWrap: { width: 1400, useAdvancedWrap: true }
        });
        const roundTitle = this.add.text(960, this.getY(180), `Round ${roundNumber}: ${title}`, titleConfig)
            .setOrigin(0.5);

        // Show description
        const descriptionConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(48),
            strokeThickness: 3,
            wordWrap: { width: 1600, useAdvancedWrap: true }
        });
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");
        const descText = this.add.text(960, this.getY(350), cleanDescription, descriptionConfig)
            .setOrigin(0.5, 0);

        // Next button
        console.log('QuizHostScene:: showRoundIntro: creating next button');
        const nextButton = this.createSimpleButton(960, descText.y + descText.height + this.getY(120), 'START ROUND');

        console.log('QuizHostScene:: showRoundIntro: adding elements to UIContainer');
        this.UIContainer.add([roundTitle, descText, nextButton]);

        // Animation
        console.log('QuizHostScene:: showRoundIntro: starting GSAP animation');
        gsap.fromTo(this.UIContainer,
            { y: this.getY(-1080) },
            {
                duration: 1,
                y: 0,
                ease: 'power2.out',
                onComplete: () => {
                    console.log('QuizHostScene:: showRoundIntro: GSAP animation complete!');
                    this.socket?.emit('consolelog', 'QuizHostScene:: showRoundIntro: GSAP animation complete!');
                }
            }
        );
    }

    private createSimpleButton(x: number, y: number, text: string): Phaser.GameObjects.Text {
        const buttonConfig = Object.assign({}, this.labelConfig, {
            backgroundColor: '#0066cc',
            padding: { x: 30, y: 15 },
        });
        const button = this.add.text(x, y, text, buttonConfig)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.socket.emit('host:keypress', { key: 'ArrowRight' });
                this.flyQuestionOut('ArrowRight');
            })
            .on('pointerover', () => {
                button.setStyle({ backgroundColor: '#0055aa' });
            })
            .on('pointerout', () => {
                button.setStyle({ backgroundColor: '#0066cc' });
            });

        return button;
    }

    /* createQuestion
     * Initialize and create a complete question display based on question data
     * Once created the calling function is responsible for adding it to the scene / animating it in whatever...
     */
    private async createQuestion(question: any): Promise<void> {

        console.log('QuizHostScene:: createQuestion:', question);

        // Clear previous UI
        this.clearUI();

        // Create the appropriate question renderer based on type
        this.currentQuestion = this.questionFactory.create(question.type, question);

        // Let the specialized renderer handle the display - this is when question gets added to the scene
        if (this.currentQuestion) {

            // Call the async function to initialize and display the question
            // async because loading an image/video may be required this could take a while
            await this.currentQuestion.initialize();
            this.currentQuestion.displayHost();

            // Debug container position and visibility
            console.log('Question container:', {
                x: this.currentQuestion.x,
                y: this.currentQuestion.y,
                visible: this.currentQuestion.visible,
                alpha: this.currentQuestion.alpha,
                children: this.currentQuestion.list.length
            });
        }
    }

    /* showAnswer
     * Show the answer for the current question
     * Note that we don't pass questionData into the function since it has just been created so will be stored in this.currentQuestion
     */
    private showAnswer(): void {
        if (this.currentQuestion) {
            this.currentQuestion.showAnswer();
        }
    }

    private startTimer(duration: number): void {
        // Reset the timer graphics
        this.timerBar.clear();
        this.timerBar.fillStyle(0x00ff00, 1);
        this.timerBar.fillRect(
            960 - 300,
            600,
            600,
            30
        );

        this.timerText.setText(`${duration}`);

        // Start the timer animation
        this.tweens.add({
            targets: { width: 600 },
            width: 0,
            duration: duration * 1000,
            onUpdate: (tween) => {
                const value = tween.getValue();
                const width = Math.max(0, value ?? 0);

                // Change color as time decreases
                let color;
                const progress = width / 600;
                if (progress > 0.7) {
                    color = 0x00ff00; // Green
                } else if (progress > 0.3) {
                    color = 0xffff00; // Yellow
                } else {
                    color = 0xff0000; // Red
                }

                // Update the timer bar
                this.timerBar.clear();
                this.timerBar.fillStyle(color, 1);
                this.timerBar.fillRect(
                    960 - 300,
                    600,
                    width,
                    30
                );

                // Update timer text
                const secondsLeft = Math.ceil(progress * duration);
                this.timerText.setText(`${secondsLeft}`);
            }
        });
    }

    private updateTimer(delta: number): void {
        // Additional timer update logic if needed
    }

    private updatePlayerAnswer(playerID: string, answer: any): void {
        if (this.currentQuestion) {
            // this.currentQuestion.updatePlayerAnswer(playerID, answer);
        }
    }

    // Handle score updates
    private updateScores(scores: { [key: string]: number }): void {

        // Firstly get the race audio going... uses resume music because we are pausing/resuming each time we come back here
        this.soundManager.playMusic('quiz-race', { volume: 0.5 });

        // Set the players to racing, kill any existing tweens and re-parent to racetrack
        this.phaserPlayers.forEach((player: PhaserPlayer) => {
            player.setPlayerState(PhaserPlayerState.RACING);
            this.tweens.killTweensOf(player);
            if (player.parentContainer !== this.racetrack) {
                player.x = player.x + this.playerContainer.x - this.racetrack.x;
                player.y = player.y + this.playerContainer.y - this.racetrack.y;
                this.racetrack.add(player);
            }
        });

        // Build a (long) timeline animation for all the elements to run the race...
        const tl: gsap.core.Timeline = gsap.timeline();

        // Get rid of existing question if there is one
        if (this.currentQuestion) {
            // Animate the current question off screen to the left
            // Move to less than -1920 since question might end up wider than 1920 if image was enlarged
            tl.to(this.currentQuestion, {
                duration: 0.8,
                x: -2620,
                ease: 'back.out(1.7)',
            }, "<");
        }

        tl.add(this.racetrack.flyIn(this.getY(640)), "<");

        // Tweens the players in the racetrack container to starting position
        tl.add(this.racetrack.movePlayersToTrack(this.getPlayerConfigsAsArray()), "<");

        // ... and update/animate to their new scores
        tl.add(this.racetrack.updateScores(scores));
        tl.play();

        // Store scores internally for other uses
        Object.entries(scores).forEach(([playerID, score]) => {
            this.playerScores.set(playerID, score);
        });
    }


    private getPlayerName(playerID: string): string {
        // Placeholder - you would look up the actual player name
        // based on their ID in your player tracking system
        // For now just return a placeholder
        return `Player ${playerID.substring(0, 4)}`;
    }

    private endRound(data: any): void {

        // Clear question display and fly out racetrack
        this.clearUI();
        this.racetrack.flyOut().play();

        // Show round end message
        const titleTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: 80,
            strokeThickness: 6
        });
        const titleText = this.add.text(960, this.getY(180), data.title, titleTextConfig)
            .setOrigin(0.5);

        const descTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: 48,
            align: 'center',
            wordWrap: { width: 1640 }
        });
        const descText = this.add.text(960, this.getY(350), data.description, descTextConfig)
            .setOrigin(0.5);

        // Next button
        const nextButtonConfig = Object.assign({}, this.labelConfig, {
            backgroundColor: '#0066cc',
            padding: { x: 30, y: 15 }
        });
        const nextButton = this.add.text(960, this.getY(550), 'CONTINUE', nextButtonConfig)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.socket.emit('host:next');
            });

        this.UIContainer.add([titleText, descText, nextButton]);

        // Animation
        gsap.fromTo(this.UIContainer,
            { y: this.getY(-1080) },
            {
                duration: 1,
                y: 0,
                ease: 'power2.out',
                onComplete: () => {
                    console.log('GSAP animation complete!');
                }
            }
        );
    }

    // showFinalScores - end quiz screen
    // the racetrack is still visible on screen (should be for all possible combinations of answer/score settings)
    // this means top half of screen is available to just display the top 3 players using UI Container
    // data.quizTitle: title of this quiz
    // data.score: dictionary object of playerID: score
    private showFinalScores(data: any): void {

        console.log('QuizHostScene:: showFinalScores:', data);

        // Clear the screen
        this.clearUI();

        // Show quiz complete message
        const titleTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: 120,
            strokeThickness: 6
        });
        const titleText = this.add.text(960, this.getY(120), data.quizTitle, titleTextConfig)
            .setOrigin(0.5);

        // Show complete message
        const completeTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: 60,
            strokeThickness: 4
        });
        const completeText = this.add.text(960, this.getY(240), 'COMPLETE!', completeTextConfig)
            .setOrigin(0.5);
        this.UIContainer.add([titleText, completeText]);
        this.UIContainer.setPosition(1920, 0);

        // OK everything set up - now run animations with music background
        this.soundManager.playMusic('quiz-end', { volume: 0.5 });


        // Animate the UI container in
        this.tweens.add({
            targets: this.UIContainer,
            x: 0,
            duration: 2000,
            ease: 'Power2'
        });

        // Animate all players to form a neat podium style design - scale increasing to create depth
        this.phaserPlayers.forEach((player: PhaserPlayer) => {
            if (player.parentContainer === this.racetrack) {
                player.x += this.racetrack.x;
                player.y += this.racetrack.y;
                this.playerContainer.add(player);
            }
        });
        this.racetrack.flyOut().play();

        // data.scores is a dictionary of playerID: score
        // Create a sorted array of player scores from lowest to highest score
        const sortedScores = Object.entries(data.scores)
            .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

        // also find the highest and lowest scores - use this to determine position/scale (in event of tie)
        const highestScore = sortedScores[0] ? sortedScores[0][1] : 0;
        const lowestScore = sortedScores[sortedScores.length - 1] ? sortedScores[sortedScores.length - 1][1] : 0;

        console.log('Sorted Scores:', sortedScores, { highestScore, lowestScore });

        // Display the top 3 players
        for (let i = 0; i < sortedScores.length; i++) {
            const [playerID, score] = sortedScores[i];
            const player = this.phaserPlayers.get(playerID);
            if (player) {
                this.tweens.killTweensOf(player);
                this.playerContainer.bringToTop(player);
                const scoreRatio = (highestScore == lowestScore) ? 0 : (score - lowestScore) / (highestScore - lowestScore);
                this.tweens.add({
                    targets: player,
                    x: 180 + scoreRatio * 900,
                    y: this.getY(480 + i * this.getY(120)),
                    scale: 1 + scoreRatio * 1,
                    duration: 3000,
                    ease: 'Power2',
                    delay: (sortedScores.length - i) * 750,
                    onComplete: () => {
                        console.log(`Player ${playerID} animation complete: ${player.x}, ${player.y}, scale: ${player.scale}`);0.0
                        player.updatePlayerScore(score ? score : 0);
                        player.addShine();
                    }
                });
            } else {
                console.log(`Player with ID ${playerID} not found.`);
            }
        }
    }

    private clearUI(): void {

        console.log('QuizHostScene:: clearUI...');

        // Clean up the previous question's display elements
        if (this.UIContainer) {
            this.UIContainer.removeAll(true);
        } else {
            this.UIContainer = this.add.container(0, 0);
            this.add.existing(this.UIContainer);
        }
        if (this.currentQuestion) {
            this.currentQuestion.destroy();
            this.questionContainer.removeAll(true);
        }
    }

    private updateStreamModeIndicator(enabled: boolean): void {
        if (this.streamModeIndicator) {
            this.streamModeIndicator.setText(`STREAM MODE: ${enabled ? 'ON' : 'OFF'}`);
            this.streamModeIndicator.setColor(enabled ? '#00ff00' : '#ffffff');
            this.streamModeIndicator.setAlpha(enabled ? 1 : 0.5);
        }
    }

    private showStreamCue(): void {

        // Create a visual cue that the host needs to press a key to continue
        // This is to sync with the stream delay
        if (this.streamCue) {
            this.streamCue.destroy();
        }

        this.streamCue = this.add.graphics();
        this.streamCue.fillStyle(0xff0000, 0.8);
        this.streamCue.fillCircle(1880, this.getY(1040), 20);
        this.topContainer.add(this.streamCue);

    }

    sceneDisplay(): void {
        // Called from BaseScene when the screen is resized
        console.log('QuizHostScene:: sceneDisplay: updating layout for new size');

        if (this.background) {
            this.background.setDisplaySize(1920, this.getY(1080));
        }
        if (this.backgroundOverlay) {
            this.backgroundOverlay.clear();
            this.backgroundOverlay.fillStyle(0x000000, 0.7);
            this.backgroundOverlay.fillRect(0, 0, 1920, this.getY(1080));
        }

        // if (this.racetrack) {
        //     this.racetrack.setPosition(0, this.getY(640));
        // }

        if (this.currentQuestion) {
            this.currentQuestion.displayHost();
        }
    }

    sceneShutdown(): void {
        console.log('Quiz:: sceneShutdown...');
        // Remove any socket listeners or other cleanup tasks here
        YouTubePlayerUI.getInstance(this).destroy();
    }

}

