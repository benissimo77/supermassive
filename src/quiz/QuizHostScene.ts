import gsap from 'gsap';

declare const __DEV__: boolean;

import { BaseScene } from "src/BaseScene";
import { SocketDebugger } from "src/utils/SocketDebugger";
import { QuizMap, QuizMapData } from "./QuizMap";

import { QuestionFactory } from "./questions/QuestionFactory";
import { BaseQuestion } from "./questions/BaseQuestion";
import { Racetrack } from "./Racetrack";
import { PlayerConfig, PhaserPlayerState, PhaserPlayer } from './PhaserPlayer';
import { YouTubePlayerUI } from './YouTubePlayerUI';

import { GlobalNavbar } from 'src/ui/GlobalNavbar';
import { SoundSettingsPanel } from 'src/ui/SoundSettingsPanel';
import { BeatManager } from 'src/utils/BeatManager';
import { GameObjects } from 'phaser';

export class QuizHostScene extends BaseScene {

    static readonly KEY = 'QuizHostScene';

    private socketDebugger: SocketDebugger;
    private beatManager: BeatManager;

    private currentQuestion: BaseQuestion;
    private currentRoundNumber: number = 0;
    private currentQuestionNumber: number = 0;
    private quizMap: QuizMap;
    private players: Map<string, PhaserPlayer> = new Map();
    private playerAnswers: Map<string, any> = new Map();
    private questionFactory: QuestionFactory;

    // UI elements
    private timerBar: Phaser.GameObjects.Graphics;
    private timerText: Phaser.GameObjects.Text;
    private globalNavbar: GlobalNavbar;
    private soundSettings: SoundSettingsPanel;

    private streamCue: Phaser.GameObjects.Graphics;

    // Containers - created once in order to set the ordering
    private playerContainer: Phaser.GameObjects.Container;
    private questionContainer: Phaser.GameObjects.Container;

    // For key press handling
    private lastKeyTime: number = 0;

    // Racetrack for animating scores
    private racetrack: Racetrack;

    private spotlights: Phaser.GameObjects.Graphics[] = [];
    private podiums: Phaser.GameObjects.Graphics[] = [];

    private introTimeline: gsap.core.Timeline | null = null;

    private background: Phaser.GameObjects.Image;
    private backgroundOverlay: Phaser.GameObjects.Graphics;

    private instructionsPanel: Phaser.GameObjects.Container | null = null;
    private instructionState: 'hidden' | 'minimized' | 'maximized' = 'maximized';

    private startingSoonHUD: Phaser.GameObjects.Container | null = null;
    private HUDTimerGraphics: Phaser.GameObjects.Graphics | null = null;
    private HUDWaitingText: Phaser.GameObjects.Text | null = null;
    private HUDCountdownSeconds: number = 900;
    private lobbyTitle: string = 'THE GAUNTLET';

    // Add this constructor to set the scene key
    constructor() {
        super(QuizHostScene.KEY);
    }

    init(): void {
        super.init();

        console.log('QuizHostScene:: init.');

        // for host the TYPE will be 'host' or 'solo'
        this.TYPE = 'host';
        this.playerAnswers = new Map();
        this.questionFactory = new QuestionFactory(this);

    }

    preload(): void {
        super.preload();

        // Load common assets for all question types
        // Background images
        this.load.image('quiz-background', '/img/quiz/background.jpg');
        this.load.image('simple-button', '/assets/img/simplebutton.png');
        this.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
        this.load.image('dropzone', '/assets/img/dropzone.png');
        this.load.image('dropzone-square', '/assets/img/dropzone-square.png');
        this.load.image('checkmark', '/assets/three/checkmark.png');
        this.load.image('crossmark', '/assets/three/crossmark.png');


        // Player UI assets
        this.load.image('playernamepanel', '/assets/rounded-rect-grey-480x48x14.png');

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
        this.load.audio('crowd-cheer', '/assets/audio/quiz/fx/crowd-cheering-314920.mp3');

        // Load custom fonts
        this.load.rexWebFont({
            google: {
                families: ['Titan One']
            }
        });

    }

    create(): void {

        super.create();
        this.beatManager = new BeatManager();

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

        // Register global keypress handler for host controls (next question, previous question, toggle instructions, etc.)
        this.registerGlobalKeypressHandler(this.handleKeyDown);

        // Create score racetrack but begin with it off-screen
        // TODO: factor this out into its own SCENE
        this.racetrack = new Racetrack(
            this,
            1920,
            this.getY(400)
        );
        this.racetrack.setPosition(0, this.getY(1200));
        this.add.existing(this.racetrack);
        this.mainContainer.add(this.racetrack);
        this.racetrack.flyOut().play();

        this.quizMap = new QuizMap(this, this.getY(20), this.getY(240));
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
        this.render();

        // Create a simple white pixel for particles/confetti
        // Using a 2x2 white texture to ensure it's visible and tintable
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(0, 0, 2, 2);
        graphics.generateTexture('white-pixel', 2, 2);

        // Create a star texture for player FX
        graphics.clear();
        graphics.fillStyle(0xffffff, 1);
        const starPoints = 5;
        const outerRadius = 10;
        const innerRadius = 4;
        graphics.beginPath();
        for (let i = 0; i < starPoints * 2; i++) {
            const angle = (i * Math.PI) / starPoints - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = 10 + Math.cos(angle) * radius;
            const y = 10 + Math.sin(angle) * radius;
            if (i === 0) graphics.moveTo(x, y);
            else graphics.lineTo(x, y);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.generateTexture('star-particle', 20, 20);

        // Setup socket listeners
        this.setupSocketListeners();

        // SEQUENTIAL BOOTSTRAP:
        // 1. host:ready -> server returns roomID
        // 2. host:requestgame -> server loads game module returns quiz data (pre-game waiting state) 
        // 3. host:requeststart -> start game logic (opening credits and into first round)

        console.log('QuizHostScene:: Starting sequential bootstrap...');
        this.socket?.emit('consolelog', 'QuizHostScene:: Starting sequential bootstrap...');

        const urlParams = new URLSearchParams(window.location.search);
        const quizID = (this.scene.settings.data as any)?.quizID || urlParams.get('q');

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

            if (gameResponse && gameResponse.success) {
                // Initialize the Waiting to Start display with the rich data returned from the server
                this.waitingToStart(gameResponse);
            } else {
                console.error('QuizHostScene:: Failed to load game "quiz":', gameResponse ? gameResponse.error : 'No response');
            }
        });
    }
    update(time: number, delta: number): void {
        this.beatManager.update();
        if (this.startingSoonHUD && this.HUDTimerGraphics) {
            this.drawHUDTimer();
        }
    }

    private waitingToStart(data: any): void {
        console.log('QuizHostScene:: Initializing Lobby Phase:', data.title);
        
        // Start lobby music
        this.soundManager.playMusic('quiz-music-intro', { volume: 0.5 });
        const music = this.soundManager.getCurrentMusicTrack();
        if (music && music.sound) {
            // "modern-beat-jingle-intro" sounds like ~128 BPM
            this.beatManager.start(music.sound, 128);
        }

        // Update Quiz Map if provided
        if (data.quizMap && this.quizMap) {
            this.quizMap.setMapData(data.quizMap);
            this.quizMap.updatePosition(0, 0, 'LOBBY');
        }

        // Show the pulsing title and instructions
        this.showStartingSoonHUD(data.title);
        this.showInstructions();
    }


    private setupSocketListeners(): void {

        // Player connect/disconnect - these are caught by BaseScene but quiz can also take action
        // BaseScene handles the storage/maintenance of playerConfigs - game decides their own visuals
        this.socket.on('playerconnect', (playerConfig: PlayerConfig) => {
            console.log('QuizHostScene:: playerconnect :', { playerConfigs: this.getPlayerConfigsAsArray() });
            const player: PhaserPlayer = this.getPlayerBySessionID(playerConfig.sessionID);
            if (player) {
                player.connect();
            } else {
                this.addPlayer(playerConfig);
            }
 
            // Refresh instructions and HUD
            if (this.instructionState === 'maximized') {
                this.showInstructions();
            }
            if (this.startingSoonHUD) {
                this.showStartingSoonHUD();
            }
        });

        // When player disconnects don't remove from list as they might re-join
        // They simply become 'dormant' and won't receive questions - but if they re-join they will be right back where they left off
        this.socket.on('playerdisconnect', (sessionID: string) => {
            console.log('QuizHostScene:: playerdisconnect:', sessionID);
            const player: PhaserPlayer = this.getPlayerBySessionID(sessionID);
            if (player) {
                player.disconnect();
            } else {
                console.warn(`Player with session ID ${sessionID} not found.`);
            }

            // Update HUD
            if (this.startingSoonHUD) {
                this.showStartingSoonHUD();
            }
        });

        this.socket.on('server:players', (playerConfigs: PlayerConfig[]) => {
            console.log('QuizHostScene:: server:players:', playerConfigs);

            playerConfigs.forEach((playerConfig: PlayerConfig) => {
                this.addPlayer(playerConfig);
            });

            if (this.startingSoonHUD) {
                this.showStartingSoonHUD();
            }
        });


        // This is an all-purpose socket event that can perform any useful action
        this.socket.on('server:hostaction', (data) => {
            console.log('QuizHostScene:: server:hostaction:', data);
            if (data.action === 'toggleInstructions') {
                this.toggleInstructions();
            }
            if (data.action === 'toggleNavbar') {
                this.globalNavbar?.toggle();
            }
            if (data.action === 'adjustTimer') {
                this.adjustHUDTimer(data.delta);
            }
        });

        // Listen for intro quiz message
        this.socket.on('server:introquiz', (data) => {
            if (data.quizMap) {
                this.quizMap.setMapData(data.quizMap);
            }
        });

        // Listen for opening credits message
        this.socket.on('server:openingcredits', (data) => {
            this.showOpeningCredits(data.title, data.description || '', data.samples || []);
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
                        if (!question.video && !question.audio) {
                            this.soundManager.playMusic('quiz-countdown', { volume: 0.3, fadeIn: 6000 });
                        } else {
                            // If playing a video/audio question, stop background music to avoid clashing
                            this.soundManager.stopCategory('music', 2000);
                        }
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
            this.players.forEach((player: PhaserPlayer) => {
                this.reparentObject(player, this.playerContainer);
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
        // Closing credits
        this.socket.on('server:closingcredits', (data) => {
            this.showClosingCredits(data);
        });

        // Start timer
        this.socket.on('server:starttimer', (data) => {
            this.startTimer(data.duration);
        });

        this.socket.on('server:waitingforstream', (data) => {
            console.log('QuizHostScene:: server:waitingforstream:', data);
            this.showStreamCue();
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
        
        // Handle local hotkeys
        if (event.code === 'KeyI') {
            this.socket.emit('host:action', { action: 'toggleInstructions' });
            return;
        }
        if (event.code === 'KeyN') {
            this.socket.emit('host:action', { action: 'toggleNavbar' });
            return;
        }
        if (event.code === 'ArrowUp') {
            this.socket.emit('host:action', { action: 'adjustTimer', delta: 60 });
            return;
        }
        if (event.code === 'ArrowDown') {
            this.socket.emit('host:action', { action: 'adjustTimer', delta: -60 });
            return;
        }

        this.socket.emit('host:keypress', { key: event.code, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey });
        this.flyQuestionOut(event.code);
    }

    private toggleInstructions(): void {
        if (this.instructionState === 'hidden') {
            this.instructionState = 'maximized';
        } else if (this.instructionState === 'maximized') {
            this.instructionState = 'minimized';
        } else {
            this.instructionState = 'hidden';
        }
        this.showInstructions();
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
        this.players.set(playerConfig.sessionID, phaserPlayer);
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
        
        // If player is racing or revealing, do not animate anymore since racetrack will control player
        if (player.getPlayerState() === PhaserPlayerState.RACING || player.getPlayerState() === PhaserPlayerState.REVEALING) {
            return;
        }

        let targetX: number = Phaser.Math.Between(0, 1920);
        let targetY: number = Phaser.Math.Between(0, this.getY(1080));
        if (player.getPlayerState() === PhaserPlayerState.ANSWERING) {
            targetY = this.getY(1080 - 20);
        }
        // For HIDDEN we can get a bit clever and move them off the side they are closest to
        if (player.getPlayerState() === PhaserPlayerState.HIDDEN) {
            const fromLeft = player.x < 960;
            targetX = fromLeft ? Phaser.Math.Between(-1920, -960) : Phaser.Math.Between(1920, 1920 + 960);
            const fromTop = player.y < this.getY(540);
            targetY = fromTop ? Phaser.Math.Between(-this.getY(1080), -this.getY(-540)) : Phaser.Math.Between(this.getY(1080), this.getY(1080 + 540));
        }
        this.tweens.killTweensOf(player);
        this.tweens.add({
            targets: player,
            scale: 1,
            x: targetX,
            y: targetY,
            duration: Phaser.Math.Between(2000, 4000),
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                if (player.getPlayerState() !== PhaserPlayerState.HIDDEN) {
                    this.animatePlayer(player);
                // player.setPosition(0, Phaser.Math.Between(0, this.getY(1080)));
                }
            }
        });
    }

    // getPlayerBySessionID - overridden from BaseScene to return PhaserPlayer
    getPlayerBySessionID(sessionID: string): PhaserPlayer {
        return this.players.get(sessionID)!;
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

    }

    private drawHUDTimer(): void {
        if (!this.HUDTimerGraphics) return;

        const graphics = this.HUDTimerGraphics;
        graphics.clear();

        const totalSeconds = this.HUDCountdownSeconds;
        const subSecond = (this.time.now % 1000) / 1000;
        
        // Ticks represent seconds remaining in the current minute (0-59)
        const secsInMinute = totalSeconds % 60;
        
        const centerX = 0;
        const centerY = 0;
        const radius = 150;
        
        // 1. Outer Ring: 60 Ticks
        for (let i = 0; i < 60; i++) {
            const angle = Phaser.Math.DegToRad((i * 6) - 90);
            
            // Ticks "disappear" as seconds count down
            // If i < secsInMinute, it's a remaining second
            const isActive = i < secsInMinute;
            
            const r1 = radius + 25;
            const r2 = radius + 50;
            
            if (isActive) {
                graphics.lineStyle(6, 0x00ccff, 1);
            } else {
                graphics.lineStyle(2, 0xffffff, 0.1);
            }
            
            graphics.lineBetween(
                centerX + Math.cos(angle) * r1,
                centerY + Math.sin(angle) * r1,
                centerX + Math.cos(angle) * r2,
                centerY + Math.sin(angle) * r2
            );
        }

        // 2. Inner Ring: Sweep logic (30s fill, 30s erase for active feel)
        // We use actual time for smooth sub-second sweeping
        const sweepProgress = ((this.time.now / 1000) % 2); // 0.0 to 2.0
        
        if (sweepProgress < 1) {
            // Phase 1: Fill
            graphics.lineStyle(12, 0x00ccff, 1);
            graphics.beginPath();
            graphics.arc(centerX, centerY, radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + (sweepProgress * 360)), false);
            graphics.strokePath();
        } else {
            // Phase 2: Erase
            const eraseProgress = sweepProgress - 1;
            // Draw full ring base
            graphics.lineStyle(12, 0x00ccff, 1);
            graphics.beginPath();
            graphics.arc(centerX, centerY, radius, Phaser.Math.DegToRad(-90 + eraseProgress * 360), Phaser.Math.DegToRad(270), false);
            graphics.strokePath();            
        }
    }

    private showStartingSoonHUD(titleTextOverride?: string): void {
        if (titleTextOverride) this.lobbyTitle = titleTextOverride;
        
        const playerCount = this.getPlayerConfigsAsArray()
            .filter(player => player.connected)
            .length;

        // If it already exists, just update the player count text and return
        if (this.startingSoonHUD && this.HUDWaitingText) {
            this.HUDWaitingText.setText(`${playerCount} PLAYERS JOINED`);
            return;
        }

        // Otherwise create from scratch
        if (this.startingSoonHUD) {
            this.startingSoonHUD.destroy(true);
            this.startingSoonHUD = null;
            this.HUDTimerGraphics = null;
            this.HUDWaitingText = null;
        }

        // Center HUD higher and slightly smaller to avoid overlap
        this.startingSoonHUD = this.add.container(960, 350).setScale(0.84);

        // Circular Timer Graphics
        this.HUDTimerGraphics = this.add.graphics();
        this.startingSoonHUD.add(this.HUDTimerGraphics);

        // Add Bloom effect to make the neon blue elements glow
        // (color, offsetX, offsetY, blurStrength, strength)
        this.HUDTimerGraphics.postFX.addBloom(0x00ccff, 1, 1, 2, 1.5);

        // Pulsing Title (Branding)
        const title = this.add.text(0, -320, this.lobbyTitle.toUpperCase(), {
            fontFamily: 'Titan One',
            fontSize: '110px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 12
        }).setOrigin(0.5);

        // Beat-synced Pulse
        // We use the BeatManager to trigger a "bump" on every beat
        this.beatManager.onBeat((index) => {
            if (title && title.active) {
                this.tweens.add({
                    targets: title,
                    scale: 1.08,
                    duration: 150,
                    yoyo: true,
                    ease: 'Back.easeOut'
                });
            }
        });

        // Fallback pulse if music isn't playing or BeatManager isn't used
        this.tweens.add({
            targets: title,
            scale: 1.03,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Precise Timer Typography (Prevents jumping by positioning segments individually)
        const mins = Math.floor(this.HUDCountdownSeconds / 60);
        const secs = this.HUDCountdownSeconds % 60;
        
        const timerStyle = {
            fontFamily: 'Titan One',
            fontSize: '72px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        };

        // We use fixed offsets from center to ensure stable positioning regardless of character width
        const minText = this.add.text(-15, 0, mins.toString().padStart(2, '0'), timerStyle).setOrigin(1, 0.5);
        const colon = this.add.text(0, -6, ":", timerStyle).setOrigin(0.5, 0.5);
        const secText = this.add.text(15, 0, secs.toString().padStart(2, '0'), timerStyle).setOrigin(0, 0.5);

        // Store references for external timer adjustment
        this.data.set('HUDMinText', minText);
        this.data.set('HUDSecText', secText);

        // "Starting Soon" - larger than 960 x since entire container is scaled down
        const startingText = this.add.text(1080, -320, "STARTING SOON!", {
            fontFamily: 'Titan One',
            fontSize: '44px',
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(1, 1);

        // Player Count
        this.HUDWaitingText = this.add.text(1080, -280, `${playerCount} PLAYERS JOINED`, {
            fontFamily: 'Titan One',
            fontSize: '36px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(1,1);

        this.startingSoonHUD.add([title, startingText, minText, colon, secText, this.HUDWaitingText]);

        // Start countdown only once
        if (!this.data.get('timerStarted')) {
            this.data.set('timerStarted', true);
            this.time.addEvent({
                delay: 1000,
                callback: () => {
                    if (this.HUDCountdownSeconds > 0) {
                        this.HUDCountdownSeconds--;
                        if (this.startingSoonHUD && minText.active) {
                            const m = Math.floor(this.HUDCountdownSeconds / 60);
                            const s = this.HUDCountdownSeconds % 60;
                            minText.setText(`${m.toString().padStart(2, '0')}`);
                            secText.setText(`${s.toString().padStart(2, '0')}`);
                        }
                    }
                },
                loop: true
            });
        }
    }

    private adjustHUDTimer(delta: number): void {
        this.HUDCountdownSeconds = Math.max(0, this.HUDCountdownSeconds + delta);
        
        // Update the display immediately
        const minText = this.data.get('HUDMinText') as Phaser.GameObjects.Text;
        const secText = this.data.get('HUDSecText') as Phaser.GameObjects.Text;
        
        if (minText && minText.active && secText && secText.active) {
            const m = Math.floor(this.HUDCountdownSeconds / 60);
            const s = this.HUDCountdownSeconds % 60;
            minText.setText(`${m.toString().padStart(2, '0')}`);
            secText.setText(`${s.toString().padStart(2, '0')}`);
            
            // Visual feedback for the adjustment
            this.tweens.add({
                targets: [minText, secText],
                scale: 1.2,
                duration: 100,
                yoyo: true,
                ease: 'Quad.easeOut'
            });
        }
    }

    private showInstructions(): void {
        if (this.instructionsPanel) {
            this.instructionsPanel.destroy();
            this.instructionsPanel = null;
        }

        if (this.instructionState === 'hidden') return;

        if (this.instructionState === 'maximized') {
            const panelWidth = 1600;
            const panelHeight = 352; // Height is determined by QR(320) + 16px border top/bottom
            const qrBlockSize = 352; // Width is determined by QR(320) + 16px border left/right
            const textPanelWidth = panelWidth - qrBlockSize; 

            // Position lower (bottom-heavy layout)
            this.instructionsPanel = this.add.container(960, this.getY(1080) - 380);
            
            // Background for Text (Semi-transparent black)
            const bgText = this.add.rectangle(-(panelWidth / 2), 0, textPanelWidth, panelHeight, 0x000000, 0.6)
                .setOrigin(0, 0).setInteractive();
            
            // Background for QR (Solid White as requested for a perfect fit)
            const bgQR = this.add.rectangle((panelWidth / 2) - qrBlockSize, 0, qrBlockSize, panelHeight, 0x000000, 0.6)
                .setOrigin(0, 0).setInteractive();
            
            this.instructionsPanel.add([bgText, bgQR]);

            // Left side: Join Text (Tweaked vertical offsets to center in 352 height)
            const leftX = -(panelWidth / 2) + 60;
            const joinText = this.add.text(leftX, 85, 'JOIN AT:', { 
                fontFamily: 'Titan One', 
                fontSize: '48px', 
                color: '#fff' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(joinText);

            const urlText = this.add.text(leftX, 185, 'VIDEOSWIPE.NET', { 
                fontFamily: 'Titan One', 
                fontSize: '80px', 
                color: '#fff'
            }).setOrigin(0, 1);
            this.instructionsPanel.add(urlText);

            const roomText = this.add.text(leftX, 285, 'ROOM: ' + this.roomID, { 
                fontFamily: 'Titan One', 
                fontSize: '80px', 
                color: '#FFFF00' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(roomText);

            const orText = this.add.text(textPanelWidth - 1100, 200, 'OR', { 
                fontFamily: 'Titan One', 
                fontSize: '72px', 
                color: '#66d' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(orText);

            // Right side: QR Code (Perfectly centered in the white 352x352 block)
            if (this.textures.exists('roomQR')) {
                const qrImageSize = 320;
                const qr = this.add.image((panelWidth / 2) - (qrBlockSize / 2), panelHeight / 2, 'roomQR')
                    .setDisplaySize(qrImageSize, qrImageSize);
                this.instructionsPanel.add(qr);
                console.log('QuizHostScene:: Added roomQR to instructions panel with 16px border');

                // experiment with plane for 3D perspective - YES WORKS WELL!
                // const qrPlane = this.add.plane(0, 0, 'roomQR');
                // gsap.to(qrPlane, {
                //     rotateY: 360,
                //     duration: 1.5,
                //     ease: 'back.out',
                //     repeat: -1,
                //     yoyo: true
                // });
                // this.instructionsPanel.add(qrPlane);
                
            } else {
                console.warn('QuizHostScene:: roomQR texture not found for instructions panel');
            }

        } else if (this.instructionState === 'minimized') {
            // Watermark state: Bottom-left corner
            this.instructionsPanel = this.add.container(40, this.getY(1080) - 40);
            
            const bg = this.add.rectangle(0, 0, 400, 140, 0x000000, 0.6).setOrigin(0, 1).setInteractive();
            this.instructionsPanel.add(bg);

            if (this.textures.exists('roomQR')) {
                const qrImage = this.add.image(10, -10, 'roomQR').setDisplaySize(120, 120).setOrigin(0, 1);
                this.instructionsPanel.add(qrImage);
            }

            const joinText = this.add.text(140, -105, 'JOIN AT:', { 
                fontFamily: 'Titan One', 
                fontSize: '20px', 
                color: '#77e' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(joinText);

            const urlText = this.add.text(140, -70, 'VIDEOSWIPE.NET', { 
                fontFamily: 'Titan One', 
                fontSize: '24px', 
                color: '#fff' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(urlText);

            const roomText = this.add.text(140, -15, 'ROOM: ' + this.roomID, { 
                fontFamily: 'Titan One', 
                fontSize: '32px', 
                color: '#FFFF00' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(roomText);
        }
    }


    private showOpeningCredits(title: string, description: string, samples: any[]): void {
        console.log('QuizHostScene:: showOpeningCredits:', title);
        this.clearUI();
        
        // Minimize instructions automatically for the intro
        this.instructionState = 'minimized';
        this.showInstructions();

        // Ensure Starting Soon HUD is gone
        if (this.startingSoonHUD) {
            this.startingSoonHUD.destroy(true);
            this.startingSoonHUD = null;
            this.HUDTimerGraphics = null;
            this.HUDWaitingText = null;
        }

        // Play intro music
        this.soundManager.playMusic('quiz-music-intro', { volume: 0.6, fadeIn: 1000 });
        const music = this.soundManager.getCurrentMusicTrack();
        if (music && music.sound) {
            this.beatManager.start(music.sound, 128);
            
            // Add a musical "Impact" cue (e.g., at 4.3s where the jingle hits a climax)
            this.beatManager.addCue(4.3, () => {
                const flash = this.add.rectangle(960, 540, 1920, 1080, 0xffffff).setAlpha(0);
                this.topContainer.add(flash);
                gsap.to(flash, { alpha: 1, duration: 0.05 });
                gsap.to(flash, { alpha: 0, duration: 0.5, onComplete: () => flash.destroy() });
                this.cameras.main.shake(150, 0.005);
            });
        }

        if (this.introTimeline) {
            this.introTimeline.kill();
        }

        this.introTimeline = gsap.timeline();
        const tl = this.introTimeline;

        // 3. Question "Flybys" - Horizontal fast flybys for juice
        samples.forEach((sample, index) => {
            const flyText = this.add.text(-200, this.getY(150 + (index * 70)), (sample.text || "").toUpperCase(), {
                fontFamily: 'Titan One',
                fontSize: this.getY(32),
                color: '#ffffff'
            }).setOrigin(0, 0.5).setAlpha(0.1);
            this.backgroundContainer?.add(flyText);

            tl.to(flyText, {
                x: 2000,
                duration: 4 + Math.random() * 4,
                ease: 'none'
            }, index * 0.5); // Stagger them
        });

        // 4. Dramatic Title Blast
        const creditsTitle = this.add.text(960, this.getY(500), title.toUpperCase(), {
            fontFamily: 'Titan One',
            fontSize: this.getY(160),
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 20,
            align: 'center',
            wordWrap: { width: 1600 }
        }).setOrigin(0.5).setAlpha(0).setScale(0.1);
        this.UIContainer.add(creditsTitle);

        tl.to(creditsTitle, {
            duration: 1.2,
            alpha: 1,
            scale: 1,
            ease: 'back.out(1.5)',
        }, 1.0);

        // 5. Presenter / Description Reveal
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");
        const descText = this.add.text(960, this.getY(750), cleanDescription.toUpperCase(), {
            fontFamily: 'Titan One',
            fontSize: this.getY(48),
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
            wordWrap: { width: 1400 }
        }).setOrigin(0.5).setAlpha(0);
        this.UIContainer.add(descText);

        tl.to(descText, {
            alpha: 1,
            y: this.getY(700),
            duration: 1.5,
            ease: 'power4.out'
        }, 3.0);

        // 6. "Are you ready?" Blast
        const readyText = this.add.text(960, this.getY(850), "GET READY!", {
            fontFamily: 'Titan One',
            fontSize: this.getY(100),
            color: '#00ccff',
            stroke: '#ffffff',
            strokeThickness: 10
        }).setOrigin(0.5).setAlpha(0).setScale(2);
        this.UIContainer.add(readyText);

        tl.to(readyText, {
            alpha: 1,
            scale: 1,
            duration: 1,
            ease: 'expo.out'
        }, 12.0);

        // 7. Loop a subtle shake on the title (Moved out of timeline so it doesn't block completion)
        tl.to(creditsTitle, {
            rotation: 0.02,
            duration: 0.1,
            delay: 1.2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.easeInOut'
        });

        tl.add( () => {
            console.log('QuizHostScene:: showOpeningCredits: Intro timeline complete!');
            this.socket?.emit('host:keypress', { key: 'ArrowRight' });
        }, '+=1' );
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
    private async createQuestion(questionData: any): Promise<void> {

        console.log('QuizHostScene:: createQuestion:', questionData);

        // Clear previous UI
        this.clearUI();

        // Universal Rule for 'ask-question': Questions sit *above* players
        this.mainContainer.bringToTop(this.questionContainer);

        // Create the appropriate question renderer based on type
        this.currentQuestion = this.questionFactory.create(questionData.type, questionData);

        // Let the specialized renderer handle the display - this is when question gets added to the scene
        if (this.currentQuestion) {

            // Call the async function to initialize and display the question
            // async because loading an image/video may be required this could take a while
            await this.currentQuestion.initialize();
            this.currentQuestion.renderHost();

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

        if (!this.currentQuestion) {
            return;
        }

        // Prepare the players to be moved around to represent their choices
        for (const [sessionID, player] of this.players) {
            player.setPlayerState(PhaserPlayerState.HIDDEN);
            this.reparentObject(player, this.playerContainer);
            this.animatePlayer(player);
        }
        
        // Universal Rule for 'show-answer': Players float *over* answers
        this.mainContainer.bringToTop(this.playerContainer);
        this.currentQuestion.createRevealAnswerTimeline().play();
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
        this.players.forEach((player: PhaserPlayer) => {
            player.setPlayerState(PhaserPlayerState.RACING);
            this.tweens.killTweensOf(player);
            console.log('Reparenting player to racetrack for racing animation:', player, this.racetrack);
            this.reparentObject(player, this.racetrack);
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
    // fly out the racetrack and bring in the final scores display
    // data.title: title of this quiz
    // data.score: dictionary object of playerID: score
    private showFinalScores(data: any): void {

        console.log('QuizHostScene:: showFinalScores:', data);

        // Clear the screen
        this.clearUI();

        // Show quiz complete message
        const titleTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: 80,
            strokeThickness: 6,
            align: 'left'
        });
        const titleText = this.add.text(100, this.getY(100), data.title, titleTextConfig)
            .setOrigin(0, 0.5);

        // Show complete message
        const completeTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: 48,
            strokeThickness: 4,
            color: '#FFFF00'
        });
        const completeText = this.add.text(100, this.getY(180), 'QUIZ COMPLETE!', completeTextConfig)
            .setOrigin(0, 0.5);
        this.UIContainer.add([titleText, completeText]);
        this.UIContainer.setPosition(-1000, 0);

        // OK everything set up - now run animations with music background
        this.soundManager.playMusic('quiz-end', { volume: 0.5 });

        // Create a master GSAP timeline for the entire sequence
        const masterTl = gsap.timeline();

        // 1. Animate the UI container in
        masterTl.to(this.UIContainer, {
            x: 0,
            duration: 1.5,
            ease: 'power2.out'
        });

        // Prepare players for podium
        this.players.forEach((player: PhaserPlayer) => {
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
            .sort(([, scoreA], [, scoreB]) => (scoreB as number) - (scoreA as number));

        // also find the highest and lowest scores - use this to determine position/scale (in event of tie)
        const highestScore = sortedScores[0] ? (sortedScores[0][1] as number) : 0;
        const lowestScore = sortedScores[sortedScores.length - 1] ? (sortedScores[sortedScores.length - 1][1] as number) : 0;

        console.log('Sorted Scores:', sortedScores, { highestScore, lowestScore });

        // Display the top 3 players
        // Bottom align the podiums to this Y position
        const Y_BOTTOM = this.getY(950);
        const heights = [400, 250, 150];
        const scales = [2.8, 2.3, 1.5];

        // Offset x by -240 to account for left-aligned player origin (approx half width)
        const podiumPositions = [
            { x: 960 - 140, y: (Y_BOTTOM - heights[0]) - (40 * scales[0]), scale: 2.5, label: '1st' }, // 1st Place (Center)
            { x: 500 - 140, y: (Y_BOTTOM - heights[1]) - (40 * scales[1]), scale: 1.8, label: '2nd' }, // 2nd Place (Left)
            { x: 1420 - 140, y: (Y_BOTTOM - heights[2]) - (40 * scales[2]), scale: 1.5, label: '3rd' }  // 3rd Place (Right)
        ];

        // Create the podium cylinders - do this in order 1st to 3rd so largest podium is at back
        const colors = [0xFFD700, 0xC0C0C0, 0xCD7F32]; // Gold, Silver, Bronze
        
        [0, 1, 2].forEach((rankIndex) => {

            // Calculate feet position for spotlight and podium top
            const pos = podiumPositions[rankIndex];
            const spotX = pos.x + (60 * scales[rankIndex]);
            const spotY = pos.y + (40 * scales[rankIndex]);

            masterTl.add(() => {
                this.createPodiumCylinder(spotX, spotY, 200 * scales[rankIndex], heights[rankIndex], colors[rankIndex]);
            });
        });

        // 2. Move all players to the bottom row first
        // Arrange players so that first place is lowest in stacking order (looks better on the podium)
        const initialMoveTl = gsap.timeline();
        for (let i = sortedScores.length; i-- > 0; ) {
            const [playerID, score] = sortedScores[i];
            const player = this.players.get(playerID);
            if (player) {
                this.tweens.killTweensOf(player);
                this.playerContainer.bringToTop(player);
                player.updatePlayerScore((score as any) ? (score as any) : 0);
                
                // All players start at the bottom, spread out
                // Ensure they stay within screen bounds (panel width approx 400px)
                const margin = 20;
                const panelWidth = 400;
                const availableWidth = 1920 - panelWidth - (margin * 2);
                const targetX = margin + (i * (availableWidth / Math.max(sortedScores.length - 1, 1)));
                const targetY = this.getY(980);

                initialMoveTl.to(player, {
                    x: targetX,
                    y: targetY,
                    scale: 0.8,
                    duration: 1.5,
                    ease: 'cubic.out',
                }, 0); // Start all at once
            }
        }
        masterTl.add(initialMoveTl, "-=1.0"); // Overlap with UI animation

        // 3. Sequence the podium reveal (3rd -> 2nd -> 1st)
        [2, 1, 0].forEach((rankIndex) => {
            const scoreEntry = sortedScores[rankIndex];
            if (!scoreEntry) return;

            const [playerID, score] = scoreEntry;
            const player = this.players.get(playerID);
            if (player) {
                const pos = podiumPositions[rankIndex];
                const revealTl = gsap.timeline();

                // Calculate feet position for spotlight and podium top
                const spotX = pos.x + (60 * scales[rankIndex]);
                const spotY = pos.y + (35 * scales[rankIndex]);

                // Move player to podium
                revealTl.to(player, {
                    x: pos.x,
                    y: pos.y,
                    scale: pos.scale,
                    duration: 1.2,
                    ease: 'back.out',
                    onComplete: () => {
                        player.addShine();
                        player.addStars();

                        // Add spotlight effect
                        const intensities = [1.0, 0.7, 0.5];
                        this.createSpotlight(spotX, spotY, intensities[rankIndex]);
                    }
                });

                // Add medal label
                const isFirst = rankIndex === 0;
                const medalY = isFirst ? -120 : 20;
                const medal = this.add.text(100, medalY, pos.label, {
                    fontFamily: 'Titan One',
                    fontSize: this.getY(64),
                    color: rankIndex === 0 ? '#FFD700' : (rankIndex === 1 ? '#C0C0C0' : '#CD7F32'),
                    stroke: '#000000',
                    strokeThickness: 8
                }).setOrigin(0.5).setAlpha(0).setScale(0.5);
                
                player.add(medal);
                
                revealTl.to(medal, {
                    alpha: 1,
                    scale: 1,
                    y: isFirst ? -120 : 120,
                    duration: 0.5,
                    ease: 'back.out'
                }, "-=0.2"); // Pop medal slightly before player finishes

                // If 1st place, trigger confetti and fanfare
                if (isFirst) {
                    revealTl.add(() => {
                        this.soundManager.playFX('crowd-cheer', 0.6);
                    }, "<-0.5");
                    revealTl.add(() => {
                        this.createConfetti();
                    }, "+=1.5");
                }

                masterTl.add(revealTl, "+=0.5"); // 0.5s gap between each player's reveal
            }
        });

    }

    private showClosingCredits(data: any): void {
        console.log('QuizHostScene:: showClosingCredits');

        // 1. Transition existing visual elements out
        // Fade out podiums and spotlights
        this.podiums.forEach(p => {
            if (p.active) {
                this.tweens.add({ targets: p, alpha: 0, duration: 2000, onComplete: () => p.destroy() });
            }
        });
        this.podiums = [];

        this.spotlights.forEach(s => {
            if (s.active) {
                this.tweens.add({ targets: s, alpha: 0, duration: 2000, onComplete: () => s.destroy() });
            }
        });
        this.spotlights = [];

        // Fling out only the content of UIContainer, but keep the header title
        this.tweens.add({
            targets: this.UIContainer,
            y: -1080,
            duration: 1500,
            ease: 'power2.in',
            onComplete: () => {
                this.clearUI();
                this.UIContainer.setY(0);
                this.createEndCreditsUI(data);
            }
        });

        // Fade out the players
        this.players.forEach(player => {
            this.tweens.add({
                targets: player,
                alpha: 0,
                duration: 2000,
                ease: 'power2.out'
            });
        });

    }

    private createEndCreditsUI(data: any): void {

        const endContainer = this.add.container(960, 0);
        this.UIContainer.add(endContainer);

        const thanksText = this.add.text(0, this.getY(200), 'THANKS FOR PLAYING!', {
            fontFamily: 'Titan One',
            fontSize: this.getY(100),
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5);

        const creditsLines = [
            'QUIZ COMPLETE',
            '',
            `  TITLE: ${data.title}`,
            '  PLATFORM: SUPERMASSIVE',
            '',
            'FEATURING',
            ...this.getPlayerConfigsAsArray().map(p => {
                return '  ' + (p.name);
            }),
            '',
            'DEVELOPED BY',
            '  SUPERMASSIVE AI TEAM',
            '',
            'SEE YOU NEXT TIME!'
        ];

        const creditsContent = this.add.container(0, 0);
        creditsLines.forEach((line, i) => {
            // "Hack" workaround: Headers are all-caps and HAVE NO leading spaces.
            // Content lines (even if all-caps like "BEN") are prefixed with spaces to force regular styling.
            const isHeader = line.length > 0 && !line.startsWith(' ');
            const displayText = line.trim();
            
            const txt = this.add.text(0, i * 60, displayText, {
                fontFamily: 'Titan One',
                fontSize: isHeader ? this.getY(48) : this.getY(36),
                color: isHeader ? '#00FFFF' : '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            creditsContent.add(txt);
        });

        // Start credits below screen
        creditsContent.setY(this.getY(1080));
        endContainer.add([creditsContent, thanksText]);

        // Scrolling credits tween
        this.tweens.add({
            targets: creditsContent,
            y: creditsLines.length * -60 - 60,
            duration: 20000,
            ease: 'linear'
        });

        // Add "Return to Dashboard" button
        const returnText = this.add.text(20, this.getY(50), '← Return to Dashboard', {
            fontFamily: 'Arial',
            fontSize: '38px',
            color: '#ffffff'
        })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });

        returnText.on('pointerup', () => {
            window.location.href = '/host/dashboard';
        });
        returnText.setAlpha(0);
        this.tweens.add({ targets: returnText, alpha: 1, duration: 1000, delay: 2000 });
    }

    private createConfetti(): void {
        const emitter = this.add.particles(0, 0, 'white-pixel', {
            x: { min: 0, max: 1920 },
            y: -50,
            lifespan: 5000,
            speedY: { min: 150, max: 500 },
            speedX: { min: -50, max: 50 },
            scaleX: {
                onUpdate: (particle: any) => {
                    particle.tumblePhase += particle.tumbleSpeed || 0.1;
                    return Math.cos(particle.tumblePhase) * particle.scaleY;
                }
            },
            scaleY: { start: 12, end: 4 },
            rotate: { start: 0, end: 720 },
            gravityY: 150,
            frequency: 30,
            blendMode: 'NORMAL',
            tint: [ 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0xff0000, 0x00ff00 ]
        });

        emitter.onParticleEmit((particle: any) => {
            particle.tumbleSpeed = Math.random() * 0.2 + 0.1;
            particle.tumblePhase = Math.random() * Math.PI * 2;
        });

        this.overlayContainer.add(emitter);
        
        // Stop emitting after 5 seconds
        this.time.delayedCall(5000, () => {
            emitter.stop();
            // Destroy after particles are gone
            this.time.delayedCall(4000, () => emitter.destroy());
        });
    }

    private createSpotlight(x: number, targetY: number, intensity: number): void {
        const graphics = this.add.graphics();
        this.backgroundContainer.add(graphics);
        this.spotlights.push(graphics);

        const topY = -400; // Start even higher for better beam angle
        const topWidth = 100 * intensity;
        const bottomWidth = 380 * intensity;
        const ellipseWidth = bottomWidth; // Match width more closely
        const ellipseHeight = bottomWidth / 4; // Match the 1/4 depth ratio of the podium
        const maxAlpha = 0.4 * intensity;

        // Draw the beam (trapezoid with curved bottom to match ellipse)
        // Use a slightly lower alpha for the beam than the floor pool
        graphics.fillStyle(0xffffff, 0.7);
        graphics.beginPath();
        graphics.moveTo(x - topWidth / 2, topY);
        graphics.lineTo(x + topWidth / 2, topY);
        graphics.lineTo(x + ellipseWidth / 2, targetY);
        
        // Curve the bottom of the beam to match the top of the floor pool
        for (let i = 0; i <= 20; i++) {
            const angle = (i / 20) * Math.PI;
            const px = x + (Math.cos(angle) * ellipseWidth / 2);
            const py = targetY - (Math.sin(angle) * ellipseHeight / 2);
            graphics.lineTo(px, py);
        }
        
        graphics.closePath();
        graphics.fillPath();

        // Draw the pool of light (ellipse) at the "feet" - slightly brighter
        graphics.fillStyle(0xffffff, 1.0);
        graphics.fillEllipse(x, targetY, ellipseWidth, ellipseHeight);

        graphics.setAlpha(0);
        
        // Flicker on animation
        this.tweens.add({
            targets: graphics,
            alpha: maxAlpha,
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Subtle atmospheric pulse
                this.tweens.add({
                    targets: graphics,
                    alpha: maxAlpha * 0.7,
                    duration: 1500 + Math.random() * 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });
    }

    private createPodiumCylinder(x: number, y: number, width: number, height: number, color: number): void {
        const graphics = this.add.graphics();
        this.backgroundContainer.add(graphics);
        this.podiums.push(graphics);

        const depth = width / 4;
        
        // Shading colors
        const colorObj = Phaser.Display.Color.IntegerToColor(color);
        const darkColor = colorObj.clone().darken(30).color;
        const midColor = color;
        const lightColor = colorObj.clone().brighten(20).color;
        
        // Vertices for the hexagonal top (isometric look)
        const topPoints = [
            { x: x - width / 2, y: y },                       // Left
            { x: x - width / 4, y: y - depth / 2 },          // Back-Left
            { x: x + width / 4, y: y - depth / 2 },          // Back-Right
            { x: x + width / 2, y: y },                       // Right
            { x: x + width / 4, y: y + depth / 2 },          // Front-Right
            { x: x - width / 4, y: y + depth / 2 }           // Front-Left
        ];

        // Vertices for the hexagonal bottom (simply top points + height)
        const botPoints = topPoints.map(p => ({ x: p.x, y: p.y + height }));

        // 1. Draw individual vertical panels for proper shading
        // Left Panel (Lightest) - between p[0] and p[5]
        graphics.fillStyle(lightColor, 1);
        graphics.fillPoints([topPoints[0], topPoints[5], botPoints[5], botPoints[0]], true);

        // Center Panel (Mid) - between p[5] and p[4]
        graphics.fillStyle(midColor, 1);
        graphics.fillPoints([topPoints[5], topPoints[4], botPoints[4], botPoints[5]], true);

        // Right Panel (Darkest) - between p[4] and p[3]
        graphics.fillStyle(darkColor, 1);
        graphics.fillPoints([topPoints[4], topPoints[3], botPoints[3], botPoints[4]], true);

        // 2. Draw the bottom edges to give it weight
        graphics.lineStyle(2, midColor, 1);
        graphics.strokePoints([botPoints[0], botPoints[5], botPoints[4], botPoints[3]], false);

        // 3. Draw the top face (brighter surface)
        graphics.fillStyle(lightColor, 1);
        graphics.fillPoints(topPoints, true);
        graphics.lineStyle(1, 0xffffff, 0.3); // Subtle highlight on top edge
        graphics.strokePoints(topPoints, true);

        // Animate in
        graphics.setAlpha(0);
        this.tweens.add({
            targets: graphics,
            alpha: 1,
            duration: 500,
            ease: 'Power2.out'
        });
    }

    private clearUI(): void {

        console.log('QuizHostScene:: clearUI...');

        // Clean up spotlights
        this.spotlights.forEach(s => s.destroy());
        this.spotlights = [];

        // Clean up podiums
        this.podiums.forEach(p => p.destroy());
        this.podiums = [];

        if (this.introTimeline) {
            this.introTimeline.kill();
            this.introTimeline = null;
        }

        if (this.startingSoonHUD) {
            this.startingSoonHUD.destroy(true);
            this.startingSoonHUD = null;
            this.HUDTimerGraphics = null;
            this.HUDWaitingText = null;
        }

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

    render(): void {
        // Called from BaseScene when the screen is resized
        console.log('QuizHostScene:: render: updating layout for new size');

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
            this.currentQuestion.renderHost();
        }
    }

    sceneShutdown(): void {
        console.log('Quiz:: sceneShutdown...');
        // Remove any socket listeners or other cleanup tasks here
        YouTubePlayerUI.getInstance(this).destroy();
    }

}

