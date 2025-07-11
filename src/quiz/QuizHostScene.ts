import gsap from 'gsap';

declare const __DEV__: boolean;

import { BaseScene } from "src/BaseScene";
import { SocketDebugger } from "src/SocketDebugger";

import { QuestionFactory } from "./questions/QuestionFactory";
import { BaseQuestion } from "./questions/BaseQuestion";
import { Racetrack } from "./Racetrack";
import { PlayerConfig, PhaserPlayer } from './PhaserPlayer';
import { YouTubePlayerUI } from './YouTubePlayerUI';

import { SoundManager } from 'src/audio/SoundManager';
import { SoundSettingsPanel } from 'src/ui/SoundSettingsPanel';

export class QuizHostScene extends BaseScene {

    static readonly KEY = 'QuizHostScene';

    private socketDebugger: SocketDebugger;

    private soundManager: SoundManager;
    private soundSettings: SoundSettingsPanel;
    private questions: any[] = [];
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

    // Containers - created once in order to set the ordering
    private playerContainer: Phaser.GameObjects.Container;
    private UIContainer: Phaser.GameObjects.Container;
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

        // Text labels config object - can be overridden but this provides a base
        this.labelConfig = {
            fontFamily: '"Titan One", Arial',
            fontSize: this.getY(36),
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
        }


        if (this.input?.keyboard) {
            this.input.keyboard.on('keydown', this.handleKeyDown, this);
        }

        // Setup socket listeners
        this.setupSocketListeners();
    }

    preload(): void {

        // Load common assets for all question types
        // this.load.image('quiz-background', '/img/quiz/background.jpg');
        this.load.image('quiz-background', '/img/quiz/kling-background.png');
        // this.load.image('quiz-background', '/assets/img/grid1920x1080.png');
        this.load.image('simple-button', '/assets/img/simplebutton.png');
        this.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
        this.load.image('dropzone', '/assets/img/dropzone.png');

        this.load.image('player-play', '/assets/img/YouTubePlayerButtons_90px_0002_play.png');
        this.load.image('player-pause', '/assets/img/YouTubePlayerButtons_90px_0001_pause.png');
        this.load.image('player-replay', '/assets/img/YouTubePlayerButtons_90px_0000_replay.png');

        this.load.image('crosshair', '/img/crosshair40.png');

        // Audio assets - theme music
        this.load.audio('quiz-music-intro', '/assets/audio/modern-beat-jingle-intro-149598.mp3');
        // Audio - voice
        this.load.audio('quiz-voice-intro', '/assets/audio/quiz-intro-Gabriella.mp3');
        // Audio SFX
        this.load.audio('answer-correct', '/assets/audio/moneytree-answercorrect.wav');

        // Load custom fonts
        this.load.rexWebFont({
            google: {
                families: ['Titan One']
            }
        });

    }

    create(): void {

        if (this.rexUI) {
            // Create your UI components
            console.log('Rex UI Plugin loaded successfully');
        } else {
            console.error('Rex UI Plugin not loaded properly');
        }

        // Create background
        const background: Phaser.GameObjects.Image = this.add.image(0, 0, 'quiz-background').setOrigin(0, 0);
        background.setDisplaySize(1920, this.getY(1080));

        // Overlay to darken the background
        const overlay: Phaser.GameObjects.Graphics = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, 1920, this.getY(1080));

        // Create score racetrack at the bottom of the screen
        this.racetrack = new Racetrack(
            this,
            1920,
            this.getY(400)
        );
        this.add.existing(this.racetrack);
        this.racetrack.setPosition(0, this.getY(640));
        // this.scoreRacetrack.setVisible(false);

        // Create the UI container for all UI elements
        this.playerContainer = this.add.container(0, 0);
        this.UIContainer = this.add.container(0, 0);
        this.questionContainer = this.add.container(0, 0);

        // Add a settings button to open the panel
        this.soundSettings = new SoundSettingsPanel(this);
        this.add.existing(this.soundSettings);

        const settingsButton = this.add.image(1800, this.getY(80), 'player-play')
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => {
                console.log('Settings button clicked');
                this.soundSettings.toggle();
            });

        // Start background music - this works
        // this.soundManager.playMusic('quiz-intro-music', { fadeIn: 2000 });

        // Only create the debugger in debug mode
        const debugMode = __DEV__;
        if (debugMode) {
            this.socketDebugger = new SocketDebugger(this, this.socket);
        }

        // Let the server know we're ready - this could come from a button click or other event
        this.socket.emit('host:ready', {});

        // We might want to run some kind of introduction - think opening credits of a TV quiz show
        // But since I don't have this yet, let's just show the quiz intro
		const urlParams = new URLSearchParams(window.location.search);
		const quizID = urlParams.get('q');
		// Provide ability to go instantly to a quiz with a known ID
        this.socket.emit('host:requeststart', { quizID: quizID });

    }


    private setupSocketListeners(): void {

        // Player connect/disconnect - these are caught by BaseScene but quiz can also take action
        this.socket.on('playerconnect', (playerConfig: PlayerConfig) => {
            console.log('QuizHostScene:: playerconnect :', { playerConfigs: this.getPlayerConfigsAsArray() });
            const thisPlayer: PhaserPlayer = this.addPlayer(playerConfig);
            this.racetrack.addPlayersToTrack(this.getPlayerConfigsAsArray());
            console.log(' DEBUG: - added to racetrack...');
            // this.animatePlayer(thisPlayer);
        });

        this.socket.on('server:players', (playerConfigs: PlayerConfig[]) => {
            console.log('QuizHostScene:: server:players:', playerConfigs);

            playerConfigs.forEach((playerConfig: PlayerConfig) => {
                this.addPlayer(playerConfig);
            });

            this.racetrack.addPlayersToTrack(this.getPlayerConfigsAsArray());
        });

        this
        // Listen for intro quiz message
        this.socket.on('server:introquiz', (data) => {
            this.showQuizIntro(data.title, data.description);
        });

        // Listen for intro round message
        this.socket.on('server:introround', (data) => {
            this.racetrack.flyOut();
            this.showRoundIntro(data.roundnumber, data.title, data.description);
        });

        // Listen for question
        this.socket.on('server:question', (question) => {
            this.displayQuestion(question);
        });

        // Player answered a question
        this.socket.on('server:questionanswered', (data) => {
            this.playerAnswers.set(data.sessionID, data.response);
            this.updatePlayerAnswer(data.sessionID, data.response);
        });

        // Show answer
        this.socket.on('server:showanswer', (data) => {
            this.showAnswer(data);
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
    }


    addPlayer(playerConfig: PlayerConfig): PhaserPlayer {
        const phaserPlayer: PhaserPlayer = new PhaserPlayer(this, playerConfig);
        this.phaserPlayers.set(playerConfig.sessionID, phaserPlayer);
        this.add.existing(phaserPlayer);
        // phaserPlayer.setPosition(0, Phaser.Math.Between(0, this.getY(1080)));
        // this.animatePlayer(phaserPlayer);
        // this.scoreRacetrack.addPlayersToTrack(this.getPlayerConfigsAsArray());

        // Fun with FX!
        // phaserPlayer.postFX.addShine(1, 0.2, 5);


        return phaserPlayer;
    }

    animatePlayer(player: PhaserPlayer): void {
        // console.log('animatePlayer:', player);
        this.tweens.add({
            targets: player,
            x: Phaser.Math.Between(0, 1920),
            y: Phaser.Math.Between(0, this.getY(1080)),
            duration: Phaser.Math.Between(2000, 4000),
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                // this.animatePlayer(player);
                player.setPosition(0, Phaser.Math.Between(0, this.getY(1080)));
            }
        });
    }
    getPlayerBySessionID(sessionID: string): PhaserPlayer {
        if (!this.phaserPlayers.has(sessionID)) {
            throw Error(`Player with session ID ${sessionID} not found.`);
        }
        return this.phaserPlayers.get(sessionID)!;
    }

    private createUI(): void {

        // Round display
        const roundDisplay = this.add.text(960, this.getY(50), '')
            .setFontSize(this.getY(36))
            .setFontFamily('"Titan One", Arial')
            .setColor('#ffffff')
            .setStroke('#000000', 4)
            .setOrigin(0.5);

        // Timer bar
        this.timerBar = this.add.graphics();

        // Timer text
        this.timerText = this.add.text(960, this.getY(600), '')
            .setFontSize(this.getY(36))
            .setFontFamily('"Titan One", Arial')
            .setColor('#ffffff')
            .setStroke('#000000', 3)
            .setOrigin(0.5);
        // Score board
        this.scoreBoard = this.add.container(50, this.getY(650));
    }

    private showQuizIntro(title: string, description: string): void {

        // This works...
        // this.soundManager.playMusic('quiz-music-intro', { volume: 0.5 });

        // Clear previous UI
        this.clearUI();

        // Show quiz title
        const titleText = this.add.text(960, this.getY(200), title)
            .setFontSize(this.getY(64))
            .setFontFamily('"Titan One", Arial')
            .setColor('#ffffff')
            .setStroke('#000000', 6)
            .setAlign('center')
            .setOrigin(0.5);

        // Remove HTML tags from description
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");

        // Show description
        const descText = this.add.text(960, this.getY(350), cleanDescription)
            .setFontSize(this.getY(32))
            .setFontFamily('Arial')
            .setColor('#ffffff')
            .setAlign('center')
            .setWordWrapWidth(this.cameras.main.width - 200)
            .setOrigin(0.5);

        // Add "Start" button
        const startButton = this.add.text(960, this.getY(550), 'START QUIZ')
            .setFontSize(this.getY(36))
            .setFontFamily("'Titan One', Arial")
            .setColor('#ffffff')
            .setBackgroundColor('#0066cc')
            .setPadding({ x: 30, y: 15 })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.socket.emit('host:next');
            });

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
        const titleConfig = {
            fontSize: this.getY(64),
            fontFamily: '"Titan One", Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            padding: { x: 20, y: this.getY(10) },
        };
        const roundTitle = this.add.text(960, this.getY(200), `Round ${roundNumber}: ${title}`, titleConfig);
        roundTitle.setOrigin(0.5);

        // Show description
        const descriptionConfig = {
            fontSize: this.getY(32),
            fontFamily: 'Arial',
            color: '#ffffff',
            align: 'center',
            padding: { x: 20, y: this.getY(10) },
            stroke: '#000000'
        }
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");
        const descText = this.add.text(960, this.getY(350), cleanDescription, descriptionConfig);
        descText.setOrigin(0.5);

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
        const buttonConfig = {
            fontSize: this.getY(36),
            fontFamily: '"Titan One", Arial',
            color: '#ffffff',
            backgroundColor: '#0066cc',
            padding: { x: 30, y: 15 },
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2
        };

        const button = this.add.text(x, y, text, buttonConfig)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.socket.emit('host:keypress', { key: 'ArrowRight' });
            })
            .on('pointerover', () => {
                button.setStyle({ backgroundColor: '#0055aa' });
            })
            .on('pointerout', () => {
                button.setStyle({ backgroundColor: '#0066cc' });
            });

        return button;
    }

    private displayQuestion(question: any): void {

        console.log('QuizHostScene:: displayQuestion:', question);

        // Clear previous UI
        this.clearUI();

        // Create the appropriate question renderer based on type
        this.currentQuestion = this.questionFactory.create(question.type, question);

        // Let the specialized renderer handle the display - this is when question gets added to the scene
        if (this.currentQuestion) {
            this.currentQuestion.display();

            // Debug container position and visibility
            console.log('Question container:', {
                x: this.currentQuestion.x,
                y: this.currentQuestion.y,
                visible: this.currentQuestion.visible,
                alpha: this.currentQuestion.alpha,
                children: this.currentQuestion.list.length
            });

            // Animate the arrival of the question - based on the direction we are currently moving
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
                }
            });

            // This code taken from QuizPlayScene - the way to submit an answer (for single-player mode when hosting)
            this.currentQuestion.onAnswer((answer: any) => {
                console.log('QuizJHostScene:: answer:', answer);
                // Send the answer to the server
                this.socket.emit('client:response', answer);
            });

        }

    }

    private showAnswer(questionData: any): void {
        if (this.currentQuestion) {
            this.currentQuestion.showAnswer(questionData);
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
                const width = Math.max(0, value);

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

        // Make sure the racetrack is visible
        this.racetrack.setVisible(true);

        // Update all player scores with animation
        const tl: gsap.core.Timeline = this.racetrack.flyIn();
        tl.add(this.racetrack.updateScores(scores));
        tl.add(() => {
            console.log('Score update animation complete');
        });
        tl.play();

        // Store scores internally for other uses
        // Object.entries(scores).forEach(([playerID, score]) => {
        //     this.playerScores.set(playerID, score);
        // });
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
        const titleText = this.add.text(
            960,
            this.getY(200),
            data.title,
            {
                fontSize: '64px',
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        const descText = this.add.text(
            960,
            this.getY(350),
            data.description,
            {
                fontSize: '32px',
                fontFamily: 'Arial',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: this.cameras.main.width - 200 }
            }
        ).setOrigin(0.5);

        // Next button
        const nextButton = this.add.text(
            960,
            this.getY(550),
            'CONTINUE',
            {
                fontSize: '36px',
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                backgroundColor: '#0066cc',
                padding: { x: 30, y: 15 }
            }
        )
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
        const titleText = this.add.text(
            960,
            this.getY(200),
            'QUIZ COMPLETE!',
            {
                fontSize: '72px',
                fontFamily: '"Titan One", Arial',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 8
            }
        ).setOrigin(0.5);

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
        const winnerText = this.add.text(960, this.getY(400), `Winner: ${winner} with ${highScore} points!`)
            .setFontSize(this.getY(48))
            .setFontFamily('"Titan One", Arial')
            .setColor('#ffffff')
            .setStroke('#000000', 6)
            .setOrigin(0.5);

        // Create list of all scores
        let y = 400;
        const sortedScores = Array.from(this.playerScores.entries())
            .sort((a, b) => b[1] - a[1]);

        sortedScores.forEach(([playerID, score], index) => {
            const player = this.getPlayerName(playerID);
            const scoreText = this.add.text(960, this.getY(y + index * 40), `${index + 1}. ${player}: ${score}`)
                .setFontSize(this.getY(32))
                .setFontFamily('Arial')
                .setColor('#ffffff')
                .setOrigin(0.5);
        });

        // Return to lobby button
        const backButton = this.add.text(960, this.getY(y + sortedScores.length * 40 + 60), 'RETURN TO LOBBY')
            .setFontSize('36px')
            .setFontFamily('"Titan One", Arial')
            .setColor('#ffffff')
            .setBackgroundColor('#0066cc')
            .setPadding({ x: 30, y: 15 })
            .setOrigin(0.5)
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

    sceneShutdown(): void {
        console.log('Quiz:: sceneShutdown...');
        // Remove any socket listeners or other cleanup tasks here
        YouTubePlayerUI.getInstance(this).destroy();
    }

}

