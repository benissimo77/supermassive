import gsap from 'gsap';

declare const __DEV__: boolean;

import { BaseScene } from "src/BaseScene";
import { SocketDebugger } from "src/SocketDebugger";

import { QuestionFactory } from "./questions/QuestionFactory";
import { BaseQuestion } from "./questions/BaseQuestion";
import { Racetrack } from "./Racetrack";
import { PlayerConfig, PhaserPlayerState, PhaserPlayer } from './PhaserPlayer';
import { YouTubePlayerUI } from './YouTubePlayerUI';

import { SoundManager } from 'src/audio/SoundManager';
import { GlobalNavbar } from 'src/ui/GlobalNavbar';
import { SoundSettingsPanel } from 'src/ui/SoundSettingsPanel';

export class QuizHostScene extends BaseScene {

    static readonly KEY = 'QuizHostScene';

    // SoundManager is public so that all questions can access it easily
    public soundManager: SoundManager;

    private socketDebugger: SocketDebugger;

    private currentQuestion: BaseQuestion;
    private currentRound: any = null;
    private currentQuestionIndex: number = 0;
    private currentRoundIndex: number = 0;
    private phaserPlayers: Map<string, PhaserPlayer> = new Map();
    private playerScores: Map<string, number> = new Map();
    private playerAnswers: Map<string, any> = new Map();
    private questionFactory: QuestionFactory;

    // UI elements
    private timerBar: Phaser.GameObjects.Graphics;
    private timerText: Phaser.GameObjects.Text;
    private scoreBoard: Phaser.GameObjects.Container;
    private globalNavbar: GlobalNavbar;
    private soundSettings: SoundSettingsPanel;

    // Containers - created once in order to set the ordering
    private playerContainer: Phaser.GameObjects.Container;
    private questionContainer: Phaser.GameObjects.Container;

    // For key press handling
    private lastKeyTime: number = 0;

    // Racetrack for animating scores
    private racetrack: Racetrack;

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
        this.soundManager = SoundManager.getInstance(this);

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

        // Audio - voice
        // this.load.audio('quiz-voice-intro', '/assets/audio/quiz/music/quiz-intro-Gabriella.mp3');

        // Audio SFX
        this.load.audio('answer-correct', '/assets/audio/quiz/fx/320655__rhodesmas__level-up-01.wav');
        this.load.audio('answer-incorrect', '/assets/audio/quiz/fx/150879__nenadsimic__jazzy-chords.wav');
        this.load.audio('button-click', '/assets/audio/quiz/fx/114187__edgardedition__thud17.wav');
        this.load.audio('submit-answer', '/assets/audio/quiz/fx/585256__lesaucisson__swoosh-2.mp3');
        this.load.audio('question-answered', '/assets/audio/quiz/fx/446100__justinvoke__bounce.wav');

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
        const background: Phaser.GameObjects.Image = this.add.image(0, 0, 'quiz-background').setOrigin(0, 0);
        background.setDisplaySize(1920, this.getY(1080));
        this.backgroundContainer.add(background);

        // Overlay to darken the background
        const overlay: Phaser.GameObjects.Graphics = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, 1920, this.getY(1080));
        this.backgroundContainer.add(overlay);

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
        if (debugMode && 0) {
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


        // Let the server know we're ready - this could come from a button click or other event
        // host:ready informs server host is ready to receive player data and other socket events
        // host:ready event also sends acknowledgment callback data including IMPORTANT: room ID
        this.socket.emit('host:ready', {}, (response: any) => {
            console.log('Host is ready:', response);
            if (response.room) {
               // this.showRoomID(response.room);
            }
        });

        // We might want to run some kind of introduction - think opening credits of a TV quiz show
        // But since I don't have this yet, let's just show the quiz intro

        // DEVELOPMENT - look for quiz ID in URL and if so go straight to that quiz
        // Note: host:requeststart loads the quiz BUT we don't actually start the quiz until the host clicks 'Start Quiz' button
        const urlParams = new URLSearchParams(window.location.search);
        const quizID = urlParams.get('q');
        // Provide ability to go instantly to a quiz with a known ID
        if (quizID) {
            this.socket.emit('host:requeststart', { quizID: quizID });
        }
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
            this.showQuizIntro(data.title, data.description);
        });

        // Listen for intro round message
        this.socket.on('server:introround', (data) => {
            this.racetrack.flyOut();
            this.showRoundIntro(data.roundnumber, data.title, data.description);
        });

        // Listen for question - not sure if this should all be here...
        this.socket.on('server:question', async (question, callback) => {
            let receivedTime = Date.now();
            await this.createQuestion(question);
            const displayTime = Date.now() - receivedTime;
            const deviceInfo = {
                device: /iPad/.test(navigator.userAgent) ? 'iPad' :
                    /iPhone|iPod/.test(navigator.userAgent) ? 'iPhone' :
                        /Android/.test(navigator.userAgent) ? 'Android' : 'Other',
                displayTime: displayTime
            };
            callback(deviceInfo);

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
                    this.soundManager.playMusic('quiz-countdown', { volume: 0.5 });
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
                const localX: number = player.x + this.racetrack.x;
                const localY: number = player.y + this.racetrack.y;
                this.playerContainer.add(player);
                player.setPosition(localX, localY);
                player.setPlayerState(PhaserPlayerState.ANSWERING);
                this.animatePlayer(player);
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

        // Show answer
        this.socket.on('server:showanswer', async (question) => {
            await this.createQuestion(question);
            // Make sure it's added to the scene, and to the question container (for depth management)
            this.add.existing(this.currentQuestion);
            this.questionContainer.add(this.currentQuestion);
            this.showAnswer();
        });

        // Update scores
        this.socket.on('server:updatescores', (data) => {
            this.updateScores(data.scores);
        });

        // End round
        this.socket.on('server:endround', (data) => {
            this.endRound(data);
        });

        // End quiz
        this.socket.on('server:endquiz', (data) => {
            this.showFinalScores();
        });

        // Start timer
        this.socket.on('server:starttimer', (data) => {
            this.startTimer(data.duration);
        });
    }

    private handleKeyDown(event: KeyboardEvent): void {

        // Debounce key presses to prevent rapid firing
        const currentTime: number = Date.now();
        if (currentTime - this.lastKeyTime < 300) {
            return;
        }
        this.lastKeyTime = currentTime;

        // Get the key name (convert to uppercase for consistency)
        const keyName = event.key.toUpperCase();

        console.log(`Key pressed: ${keyName} (code: ${event.code})`);
        this.socket.emit('host:keypress', { key: event.code });
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

        phaserPlayer.setPosition(0, Phaser.Math.Between(0, this.getY(1080)));
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

        // Score board
        this.scoreBoard = this.add.container(50, this.getY(650));
    }

    private showQuizIntro(title: string, description: string): void {

        // This works...
        // this.soundManager.playMusic('quiz-music-intro', { volume: 0.5 });

        // Clear previous UI
        this.clearUI();

        // Show quiz title
        const titleConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(64),
            strokeThickness: 6
        });
        const titleText = this.add.text(960, this.getY(200), title, titleConfig)
            .setOrigin(0.5)
            .setWordWrapWidth(1400);

        // Remove HTML tags from description (until I can find a way to render them properly)
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");

        // Show description
        const descConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(32),
            strokeThickness: 3,
        });
        const descText = this.add.text(960, this.getY(350), cleanDescription, descConfig)
            .setOrigin(0.5, 0)
            .setWordWrapWidth(1600);

        // Add "Start" button
        const startButton = this.createSimpleButton(960, descText.y + descText.height + this.getY(120), 'START QUIZ');

        this.UIContainer.add([titleText, descText, startButton]);

        // Animation for intro elements
        this.tweens.add({
            targets: [titleText, descText, startButton],
            alpha: { from: 0, to: 1 },
            y: '-=30',
            duration: 800,
            ease: 'Power2',
            stagger: 200
        });

        gsap.fromTo(this.UIContainer,
            { y: -1080 },
            {
                duration: 1,
                y: 0,
                ease: 'back.out(1.7)',
                onComplete: () => {
                    console.log('GSAP animation complete!');
                    gsap.to(this.UIContainer, { duration: 5, y: '+=120', ease: 'back.out(1.7)' });
                }
            }
        );
    }

    private showRoundIntro(roundNumber: number, title: string, description: string): void {

        // Clear previous UI
        this.clearUI();

        // Show round title
        const titleConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(64),
            strokeThickness: 6
        });
        const roundTitle = this.add.text(960, this.getY(200), `Round ${roundNumber}: ${title}`, titleConfig)
            .setWordWrapWidth(1400)
            .setOrigin(0.5);

        // Show description
        const descriptionConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(32),
            strokeThickness: 3,
        });
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");
        const descText = this.add.text(960, this.getY(350), cleanDescription, descriptionConfig)
            .setWordWrapWidth(1600)
            .setOrigin(0.5, 0);

        // Next button
        const nextButton = this.createSimpleButton(960, descText.y + descText.height + this.getY(120), 'START ROUND');

        this.UIContainer.add([roundTitle, descText, nextButton]);

        // Animation
        this.tweens.add({
            targets: [roundTitle, descText, nextButton],
            alpha: { from: 0, to: 1 },
            y: '-=30',
            duration: 800,
            ease: 'Power2',
            stagger: 200
        });
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

        // Firstly get the race audio going...
        this.soundManager.playMusic('quiz-race', { volume: 0.5 });

        // Make sure the racetrack is visible
        this.racetrack.setVisible(true);

        // Re-parent the players to the racetrack for score animation
        this.phaserPlayers.forEach((player: PhaserPlayer) => {
            player.setPlayerState(PhaserPlayerState.RACING);
            this.tweens.killTweensOf(player);
        });

        // Build a (long) timeline animation for all the elements to run the race...
        // const tl: gsap.core.Timeline = this.racetrack.flyIn();
        const tl: gsap.core.Timeline = gsap.timeline();

        this.racetrack.setPosition(0, this.getY(640));

        // Get rid of existing questin if there is one
        if (this.currentQuestion) {
            // Animate the current question off screen to the left
            // Move to less than -1920 since question might end up wider than 1920 if image was enlarged
            tl.to(this.currentQuestion, {
                duration: 0.8,
                x: -2620,
                ease: 'back.out(1.7)',
            }, "<");
        }

        // Add players to racetrack - positions the players in the racetrack container and tweens them to starting position
        tl.add(this.racetrack.addPlayersToTrack(this.getPlayerConfigsAsArray()));

        // ... and update to their new scores
        tl.add(this.racetrack.updateScores(scores));

        tl.add(() => {
            console.log('Score update animation complete');
            this.phaserPlayers.forEach((player: PhaserPlayer) => {
                console.log('Player final position:', player.name, player.x, player.y);
            });
        });
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

        // Clear question display
        this.clearUI();

        // Show round end message
        const titleTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(64),
            strokeThickness: 6
        });
        const titleText = this.add.text(960, this.getY(200), data.title, titleTextConfig)
            .setOrigin(0.5);

        const descTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(32),
            align: 'center',
            wordWrap: { width: this.cameras.main.width - 200 }
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
        this.tweens.add({
            targets: this.UIContainer,
            alpha: { from: 0, to: 1 },
            y: '-=30',
            duration: 800,
            ease: 'Power2',
            stagger: 200
        });
    }

    private showFinalScores(): void {

        // Clear the screen
        this.clearUI();

        // Show quiz complete message
        const titleTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(64),
            strokeThickness: 6
        });
        const titleText = this.add.text(
            960,
            this.getY(200),
            'QUIZ COMPLETE!',
            titleTextConfig
        );

        // Get winner
        let winner = '';
        let highScore = 0;

        this.playerScores.forEach((score, playerID) => {
            if (score > highScore) {
                highScore = score;
                winner = this.getPlayerName(playerID);
            }
        });

        // Show winner
        const winnerTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(48),
            strokeThickness: 4
        });
        const winnerText = this.add.text(960, this.getY(400), `Winner: ${winner} with ${highScore} points!`, winnerTextConfig);

        // Create list of all scores
        let y = 400;
        const sortedScores = Array.from(this.playerScores.entries())
            .sort((a, b) => b[1] - a[1]);

        const scoreTextConfig = Object.assign({}, this.labelConfig, {
            fontSize: this.getY(32),
            fontFamily: 'Arial'
        });
        sortedScores.forEach(([playerID, score], index) => {
            const player = this.getPlayerName(playerID);
            const scoreText = this.add.text(960, this.getY(y + index * 40), `${index + 1}. ${player}: ${score}`, scoreTextConfig);
        });

        // Return to lobby button
        const backButtonConfig = Object.assign({}, this.labelConfig, {
            backgroundColor: '#0066cc',
            padding: { x: 30, y: 15 }
        });
        const backButton = this.add.text(960, this.getY(y + sortedScores.length * 40 + 60), 'RETURN TO LOBBY', backButtonConfig)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('LobbyHostScene');
            });

        this.UIContainer.add([titleText, winnerText, backButton]);

    }

    private clearUI(): void {

        console.log('QuizHostScene:: clearUI...');

        // Clean up the previous question's display elements
        if (this.UIContainer) {
            this.UIContainer.removeAll(true);
        } else {
            this.UIContainer = this.add.container(0, 0);
        }
        if (this.currentQuestion) {
            this.currentQuestion.destroy();
            this.questionContainer.removeAll(true);
        }
    }

    sceneDisplay(): void {
        // Called from BaseScene when the screen is resized
        // Works for the question but I need to extend this to all other elements...
        console.log('QuizHostScene:: sceneDisplay: updating layout for new size');
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

