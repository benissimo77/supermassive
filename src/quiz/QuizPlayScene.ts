import gsap from 'gsap';
import { BaseScene } from "src/BaseScene";

import { QuestionFactory } from "./questions/QuestionFactory";
import { BaseQuestion } from "./questions/BaseQuestion";

import { PlayerConfig, PhaserPlayer } from "./PhaserPlayer";


export class QuizPlayScene extends BaseScene {

    static readonly KEY = 'QuizPlayScene';

    private currentQuestion: BaseQuestion;
    private currentQuestionNumber: number = -1;
    private questionFactory: QuestionFactory;
    private waitingState: Boolean = false;
    private phaserPlayer: PhaserPlayer;

    // UI elements
    private waitingText: Phaser.GameObjects.Text;
    private waitingPanel: Phaser.GameObjects.Container;

    // Add this constructor to set the scene key
    constructor() {
        super(QuizPlayScene.KEY);
    }

    init(): void {
        super.init();

        this.TYPE = 'play';
        this.questionFactory = new QuestionFactory(this);

        // Text labels config object - can be overridden but this provides a base
        this.labelConfig = {
            fontFamily: '"Titan One", Arial',
            fontSize: 36,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
        }

        // Setup socket listeners
        this.setupSocketListeners();

    }

    preload(): void {

        // Load common assets for all question types
        // this.load.image('quiz-background', '/img/quiz/background.jpg');
        this.load.image('simple-button', '/assets/img/simplebutton.png');
        this.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
        this.load.image('dropzone', '/assets/img/dropzone.png');
        // this.load.image('answer-button', '/assets/quiz-button.png');
        // this.load.image('player-marker', '/assets/player-marker.png');

        this.load.image('crosshair', '/img/crosshair40.png');

        // audio files
        this.load.audio('answer-correct', '/assets/audio/quiz/fx/320655__rhodesmas__level-up-01.wav');
        this.load.audio('answer-incorrect', '/assets/audio/quiz/fx/150879__nenadsimic__jazzy-chords.wav');
        this.load.audio('button-click', '/assets/audio/quiz/fx/114187__edgardedition__thud17.wav');
        this.load.audio('submit-answer', '/assets/audio/quiz/fx/585256__lesaucisson__swoosh-2.mp3');

        // Load custom fonts
        this.load.rexWebFont({
            google: {
                families: ['Titan One']
            }
        });

    }

    create(): void {

        super.create();

        console.log('QuizPlayScene:: create: HELLO')

        // Add a CONNECT/DISCONNECT button to simulate player disconnections
        // const connectButton = this.add.text(960, 10, 'Connect', this.labelConfig).setOrigin(0.5, 0);
        // connectButton.setInteractive({ useHandCursor: true });
        // connectButton.on('pointerdown', () => this.toggleConnect());

        // Create the waiting panel - this will be shown at the beginning of the quiz and between questions
        this.waitingPanel = this.add.container(960, 540);
        this.waitingText = this.add.text(0, 0, 'Waiting for quiz to start...', this.labelConfig).setOrigin(0.5);
        this.waitingPanel.add(this.waitingText);
        this.waitingPanel.setScale(this.getUIScaleFactor());
        this.waitingPanel.setVisible(true);

        const sendReady = () => {
            console.log('QuizPlayScene:: sending player:ready');
            this.socket.emit('player:ready', {}, (playerConfig: PlayerConfig) => {
                console.log('QuizPlayScene:: player:ready callback:', playerConfig);
                if (!this.phaserPlayer) {
                    this.phaserPlayer = new PhaserPlayer(this, playerConfig);
                    this.phaserPlayer.setScale(this.getUIScaleFactor());
                    this.add.existing(this.phaserPlayer);
                    this.phaserPlayer.setPosition(-480, Phaser.Math.Between(this.getY(200), this.getY(880)));
                    this.animatePlayer(this.phaserPlayer);
                }
            });
        };

        this.socket.on('connect', sendReady);
        sendReady();
    }


    private toggleConnect(): void {
        console.log('QuizPlayScene:: toggleConnect')
        if (this.socket.connected) {
            this.socket.disconnect();
        } else {
            this.socket.connect();
        }
    }

    private setupSocketListeners(): void {

        // Listen for intro quiz message
        this.socket.on('server:introquiz', (data) => {
            this.showQuizIntro(data.title, data.description);
        });

        // Listen for intro round message
        this.socket.on('server:introround', (data) => {
            this.currentQuestionNumber = -1;
            this.showRoundIntro(data.roundnumber, data.title, data.description);
        });

        // Listen for question
        this.socket.on('server:question', async (question, callback) => {

            // If we are already displaying this question, ignore the message
            // This prevents wiping out player progress during silent reconnections
            if (this.currentQuestionNumber === question.questionNumber) {
                console.log('QuizPlayScene:: server:question - already displaying this question, ignoring');
                return;
            }

            this.currentQuestionNumber = question.questionNumber;

            this.waitingPanel.setVisible(false);
            this.tweens.killAll();
            this.tweens.add({
                targets: this.phaserPlayer,
                x: 0,
                y: this.getY(1060),
                duration: Phaser.Math.Between(2000, 4000),
                ease: 'Back.Out'
            })

            const receivedTime = Date.now();
            await this.createQuestion(question);
            const displayTime = Date.now() - receivedTime;

            // Enhanced device detection
            let device = 'Unknown';
            let browser = 'Unknown';
            const ua = navigator.userAgent;

            // OS Detection
            if (/iPad/.test(ua)) {
                device = 'iPad';
            } else if (/iPhone|iPod/.test(ua)) {
                device = 'iPhone';
            } else if (/Android/.test(ua)) {
                device = 'Android';
            } else if (/Windows/.test(ua)) {
                device = 'Windows';
            } else if (/Macintosh|Mac OS X/.test(ua)) {
                device = 'macOS';
            } else if (/Linux/.test(ua)) {
                device = 'Linux';
            }

            // Browser Detection
            if (/Edge|Edg/.test(ua)) {
                browser = 'Edge';
            } else if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) {
                browser = 'Chrome';
            } else if (/Firefox/.test(ua) && !/Seamonkey/.test(ua)) {
                browser = 'Firefox';
            } else if (/Safari/.test(ua) && !/Chrome|Chromium|Edge|OPR/.test(ua)) {
                browser = 'Safari';
            } else if (/Opera|OPR/.test(ua)) {
                browser = 'Opera';
            } else if (/Trident|MSIE|IEMobile/.test(ua)) {
                browser = 'Internet Explorer';
            }

            // Additional platform info if available
            const platformInfo = navigator.platform || '';

            const deviceInfo = {
                device,
                browser,
                platform: platformInfo,
                displayTime,
                screen: {
                    width: window.screen.width,
                    height: window.screen.height
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };

            callback(deviceInfo);

            // Make sure it's added to the scene
            this.add.existing(this.currentQuestion);
            this.waitingState = false;

            this.currentQuestion.onAnswer((answer: any) => {
                console.log('QuizPlayScene:: answer:', answer);
                // Send the answer to the server
                this.socket.emit('client:response', { answer: answer, answerTime: Date.now() - receivedTime - displayTime });

                // This flag prevents the question from being re-displayed if sceneDisplay fires eg on resize
                this.waitingState = true;

                // Show waiting panel and animate player after a short delay to allow submitted answer to disappear
                // Also hide the question panel otherwise it might appear when resizing mobile
                // Problem with delayedCall: anything can happen in the 2.5 seconds delay! eg a new question is asked
                this.time.delayedCall(2500, () => {
                    this.gotoWaitingState();
                });
            });
        });

        // Player answered a question (used in Host scene)
        this.socket.on('server:questionanswered', (data) => {
            // this.updatePlayerAnswer(data.sessionID, data.response);
        });

        // Question over - clear the screen
        // Note: we DON'T destroy the question since it might still be animating etc - just hide it
        this.socket.on('server:endquestion', (data) => {
            console.log('QuizPlayScene:: server:endquestion - UI invisible:', data);
            this.UIContainer.setVisible(false);
            if (this.currentQuestion) {
                this.currentQuestion.setVisible(false);
            }
        });

        // Show answer
        this.socket.on('server:showanswer', (data) => {
            console.log('QuizPlayScene:: server:showanswer:', data);
            this.showAnswer(data);
        });

        // End round
        this.socket.on('server:endround', (data) => {
            this.endRound(data);
        });

        // End quiz
        this.socket.on('server:endquiz', (data) => {
            this.showFinalScores();
        });

    }

    // Sets player screen in the waiting state
    // Waiting message displays, player is animated around the screen
    // Note: we need to check if answerSubmitted in case this function is called while a new question is added
    private gotoWaitingState(message: string = 'Waiting for next question...'): void {
        if (!this.waitingState) {
            return
        }
        if (this.currentQuestion) {
            this.currentQuestion.setVisible(false);
        }
        this.waitingText.text = message;
        this.waitingText.setFontSize(8);
        this.waitingPanel.setVisible(true);
        this.tweens.killAll();
        this.animatePlayer(this.phaserPlayer);
        this.tweens.addCounter({
            from: 0.1,
            to: 1,
            duration: 1000,
            ease: 'Back.Out',
            onUpdate: (tween) => {
                const scale: number | null = tween.getValue();
                this.waitingText.setFontSize(8 + (scale || 1) * 28);
            }
        });
    }

    private showQuizIntro(title: string, description: string): void {

        // Clear previous UI
        this.clearUI();

        // Show quiz title
        const quizTitleConfig = Object.assign({}, this.labelConfig, {
            fontSize: 64,
            strokeThickness: 6
        });
        const titleText = this.add.text(960, this.getY(50), title, quizTitleConfig);

        // Remove HTML tags from description
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");

        // Show description
        const quizDescriptionConfig = Object.assign({}, this.labelConfig, {
            fontSize: 32,
            strokeThickness: 2,
            wordWrap: { width: 1680 }
        });
        const descText = this.add.text(960, this.getY(350), cleanDescription, quizDescriptionConfig);

        this.UIContainer.add([titleText, descText]);

        gsap.fromTo(this.UIContainer,
            { y: -1080 },
            {
                duration: 1,
                y: 0,
                ease: 'back.out(1.7)',
                onComplete: () => {
                    console.log('GSAP animation complete!');
                }
            }
        );
    }

    private showRoundIntro(roundNumber: number, title: string, description: string): void {

        // Clear previous UI
        this.clearUI();

        // Show round title
        const titleConfig = {
            fontSize: 64,
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

        this.UIContainer.add([roundTitle, descText]);

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

    private async createQuestion(question: any): Promise<void> {

        console.log('QuizPlayScene:: displayQuestion:', question);

        // Clear previous UI
        this.clearUI();

        // Destroy previous question if any
        if (this.currentQuestion) {
            this.currentQuestion.destroy(true);
        }

        // Create the appropriate question renderer based on type
        this.currentQuestion = this.questionFactory.create(question.type, question);

        // Let the specialized renderer handle the display - this is when question gets added to the scene
        if (this.currentQuestion) {
            await this.currentQuestion.initialize();
            this.currentQuestion.displayPlayer();

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

    // showAnswer - receives a list of scores from the server and displays if user got this question correct
    // Plays a suitable sound effect based on players score
    private showAnswer(questionData: any): void {

        // questionData.scores is a dictionary with keys as sessionIDs and values as score objects
        // e.g. { 'abc123': 10, 'def456': 0, ... }
        // pull out the correct key and retrieve the score for this player
        if (questionData.scores) {
            let playerScore:number = 0;
            playerScore = questionData.scores[this.phaserPlayer.getSessionID()] || 0;
            if (playerScore) {
                console.log(`Player score for this question: ${playerScore}`);
            }
            let answerText: string = `You scored ${playerScore} points`;
            if (playerScore == 1) {
                answerText = 'You scored 1 point';
            }
            if (playerScore > 0) {
                this.soundManager.playFX('answer-correct');
            } else {
                this.soundManager.playFX('answer-incorrect');
            }
            this.waitingState = true;
            this.gotoWaitingState(answerText);
            this.time.delayedCall(3000, () => {
                this.gotoWaitingState('Waiting for next question...');
            });
        }
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
                this.animatePlayer(player);
            }
        });
    }


    // We need to supply this function to satisfy the abstract method in BaseScene
    // but we don't need to do anything here
    getPlayerBySessionID(sessionID: string): Phaser.GameObjects.Container {
        return this.add.container(0, 0);
    }

    private getPlayerName(playerId: string): string {
        // Placeholder - you would look up the actual player name
        // based on their ID in your player tracking system
        // For now just return a placeholder
        return `Player ${playerId.substring(0, 4)}`;
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


        this.UIContainer.add([titleText, descText]);

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


        this.UIContainer.add([titleText]);

    }

    protected sceneDisplay(): void {
        // Called from BaseScene when the screen is resized
        console.log('QuizPlayScene:: sceneDisplay: updating layout for new size');
        if (this.waitingState) {
            // nothing needs to be done here - display should resize itself good enough for now...
        } else if (this.currentQuestion) {
            this.currentQuestion.displayPlayer();
        }

        // Re-position waiting panel
        if (this.waitingPanel) {
            this.waitingPanel.setPosition(960, this.getY(540));
            this.waitingPanel.setScale(this.getUIScaleFactor());
        }
        // Re-scale and position player if answer NOT submitted ie player is in corner
        if (this.phaserPlayer) {
            this.phaserPlayer.setScale(this.getUIScaleFactor());
            if (!this.waitingState) {
                this.phaserPlayer.setPosition(0, this.getY(1060));
            }
        }
    }

    private clearUI(): void {
        // Clean up any existing display (note: NOT current question - this is only destroyed the moment a new question is needed)
        // Also position and make visible so its ready for new content
        if (this.UIContainer) {
            this.UIContainer.removeAll(true);
            this.UIContainer.setPosition(0, 0);
            this.UIContainer.setVisible(true);
        }
    }

    sceneShutdown(): void {
        console.log('Quiz:: sceneShutdown...');
        // Remove any socket listeners or other cleanup tasks here
    }

}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    scale: {
        mode: Phaser.Scale.RESIZE
    },
    scene: QuizPlayScene,
    parent: 'container'
};
