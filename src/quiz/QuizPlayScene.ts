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
    private quizFinished: boolean = false;
    private phaserPlayer: PhaserPlayer;
    private podiums: Phaser.GameObjects.Graphics[] = [];

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
                this.mySessionID = playerConfig.sessionID;
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

        // Setup socket listeners
        this.setupSocketListeners();

        // TESTING - add a DOMElement to handle input
        // const formElement = this.add.dom(400, 300).createFromHTML(`
        //     <form id="myForm" style="text-align: center;">
        //         <input type="text" name="userInput" placeholder="Type here..."
        //                style="font-size: 20px; padding: 5px; width: 200px;" />
        //         <br><br>
        //         <button type="submit" style="font-size: 18px; padding: 5px 15px;">
        //             Submit
        //         </button>
        //     </form>
        // `);

        // // Access the real HTML form and input
        // const realForm = formElement.node;
        // const inputNode = realForm.querySelector('input[name="userInput"]');

        // // Attach native submit handler
        // realForm.addEventListener('submit', (event) => {
        //     event.preventDefault();
        //     if (inputNode.value.trim() !== '') {
        //         console.log('Submitted:', inputNode.value);
        //         inputNode.value = '';
        //     }
        //     this.socket.emit('consolelog', { message: 'Player submitted the form!' });
        // });

        // // Ensure tapping the input focuses it (mobile keyboard)
        // inputNode.addEventListener('touchend', () => {
        //     inputNode.focus(); // iOS will now show keyboard
        //     this.socket.emit('consolelog', { message: 'Player tapped the input!' });
        // });    
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
                console.log('QuizPlayScene:: server:question - already displaying this question, ignoring:', this.currentQuestionNumber, question.questionNumber);
                return;
            }

            this.currentQuestionNumber = question.questionNumber;

            this.waitingState = false;
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

                // This flag prevents the question from being re-displayed if render fires eg on resize
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
            this.currentQuestionNumber = -1;
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
            this.showFinalScores(data);
        });

        // Show ratings screen
        this.socket.on('server:closingcredits', (data) => {
            this.showRatingUI();
        });

    }

    // Sets player screen in the waiting state
    // Waiting message displays, player is animated around the screen
    // Note: we need to check if answerSubmitted in case this function is called while a new question is added
    private gotoWaitingState(message: string = 'Waiting for next question...'): void {

        // If we are no longer waiting (often in the time between delayed calls) then exit
        if (this.waitingState === false) {
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
            this.currentQuestion.renderPlayer();

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
            let playerScore: number = 0;
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
            this.time.delayedCall(6000, () => {
                this.gotoWaitingState('Waiting for next question...');
            });
        }
    }

    animatePlayer(player: PhaserPlayer): void {
        if (this.quizFinished) return;
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

        // Clear current question
        this.currentQuestionNumber = -1;

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

    private showFinalScores(data: any): void {

        console.log('QuizPlayScene:: showFinalScores:', data);

        this.quizFinished = true;

        // Clear the screen
        this.clearUI();

        // Stop all tweens (including player animation)
        this.tweens.killAll();

        // Hide waiting panel
        this.waitingState = false;
        this.waitingPanel.setVisible(false);

        // Show quiz complete message - calculate vertical positions dynamically
        // We nudge everything up and shrink slightly for small mobile screens (iPhone)
        let currentY = this.getY(100);

        const titleText = this.add.text(
            960,
            currentY,
            'QUIZ COMPLETE!',
            {
                fontSize: `${this.getY(80)}px`,
                fontFamily: '"Titan One", Arial',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center',
                wordWrap: { width: 1800 }
            }
        ).setOrigin(0.5);

        currentY += titleText.height + this.getY(10);

        const rankText = this.add.text(
            960,
            currentY,
            `You finished ${data.rank}${this.getOrdinal(data.rank)} out of ${data.totalPlayers}!`,
            {
                fontSize: `${this.getY(48)}px`,
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
                wordWrap: { width: 1800 }
            }
        ).setOrigin(0.5);

        currentY += rankText.height + this.getY(10);

        const scoreText = this.add.text(
            960,
            currentY,
            `Final Score: ${data.score}`,
            {
                fontSize: `${this.getY(36)}px`,
                fontFamily: '"Titan One", Arial',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }
        ).setOrigin(0.5);

        this.UIContainer.add([titleText, rankText, scoreText]);

        // Show "Save Scores" if guest
        const isGuest = !this.phaserPlayer.getUserID();
        if (isGuest) {
            this.showSavePrompt(this.getY(1040));
        }

        // If in top 3, show the podium
        if (data.rank <= 3) {
            this.showPodium(data.rank);
        } else {
            // If not in top 3, still show the player but maybe just at the bottom
            if (this.phaserPlayer) {
                this.phaserPlayer.setVisible(true);
                this.phaserPlayer.setScale(2.8);
                // Center the avatar on the screen: avatar is roughly 100px wide starting at x=6 in container
                // Center of avatar is x=56.
                // We use getY(700) instead of getY(760) to nudge them up away from the signup footer
                this.phaserPlayer.setPosition(960 - (56 * 2.8), this.getY(700));
            }
        }

    }

    private getOrdinal(n: number): string {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    private showSavePrompt(y: number): void {
        const saveText = this.add.text(
            600,
            y,
            'Sign up to save your score for next time!',
            {
                fontSize: `${this.getY(28)}px`,
                fontFamily: 'Poppins, Arial',
                color: '#ffffff',
                align: 'right',
                lineSpacing: 4
            }
        ).setOrigin(0.5)
            .setWordWrapWidth(960);

        const signupBtn = this.add.text(
            1520,
            y,
            'SIGN UP',
            {
                fontSize: `${this.getY(44)}px`,
                fontFamily: '"Titan One", Arial',
                backgroundColor: '#10b981',
                color: '#ffffff',
                padding: { x: 40, y: 20 }
            }
        ).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Redirect to signup with return URL to the play entry page
                const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login?mode=signup&redirect=${currentUrl}`;
            })
            .on('pointerover', () => signupBtn.setStyle({ backgroundColor: '#059669' }))
            .on('pointerout', () => signupBtn.setStyle({ backgroundColor: '#10b981' }));

        this.UIContainer.add([saveText, signupBtn]);
    }

    private showPodium(rank: number): void {
        const colors = [0xFFD700, 0xC0C0C0, 0xCD7F32]; // Gold, Silver, Bronze
        const heights = [350, 220, 120];
        const scales = [2.8, 2.3, 1.5];
        const labels = ['1st', '2nd', '3rd'];

        const rankIndex = rank - 1;
        const color = colors[rankIndex];
        const height = heights[rankIndex];
        const scale = scales[rankIndex];
        const label = labels[rankIndex];

        // Move podium up a bit for mobile clearance
        const x = 960;
        const y = this.getY(780);

        // Create podium
        this.createPodiumCylinder(x, y, 200 * scale, height, color);

        // Position player on podium
        if (this.phaserPlayer) {
            const totalScale = scale * 1.5;
            this.phaserPlayer.setVisible(true);
            this.phaserPlayer.setScale(totalScale);

            // Center the avatar (approx x=56 in internal container) on the podium
            // and position feet on top of the podium (shifted 20px higher than previous 40px offset)
            this.phaserPlayer.setPosition(x - (56 * totalScale), y - (60 * scale));

            // Add medal label ABOVE the avatar
            const medalLabel = this.add.text(x, y - (240 * scale), label, {
                fontSize: `${this.getY(36 * scale)}px`,
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6
            }).setOrigin(0.5);
            this.UIContainer.add(medalLabel);
        }
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

        // 3. Draw the top face (brighter surface with slight gradient)
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

    private showRatingUI(): void {
        console.log('QuizPlayScene:: showRatingUI');

        // Clear away all old UI
        this.clearUI();

        this.waitingState = false;
        this.waitingPanel.setVisible(false);
        this.tweens.killAll();
        this.tweens.add({
            targets: this.phaserPlayer,
            x: 0,
            y: this.getY(1060),
            scale: 1,
            duration: Phaser.Math.Between(2000, 4000),
            ease: 'Back.Out'
        })

        this.podiums.forEach(p => {
            if (p.active) {
                p.destroy();
            }
        });
        this.podiums = [];

        const title = this.add.text(960, this.getY(150), 'RATE THE QUIZ!', {
            fontFamily: '"Titan One", Arial',
            fontSize: `${this.getY(72)}px`,
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        const ratingContainer = this.add.container(960, 0);

        // Create 5 interactive stars
        for (let i = 1; i <= 5; i++) {
            const star = this.add.text(-600 + (i * 240), this.getY(540), '⭐', { fontSize: `${this.getY(80)}px` })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            star.on('pointerup', () => this.submitRating(i));
            star.on('pointerdown', () => star.setScale(1.4));
            star.on('pointerout', () => star.setScale(1.0));

            ratingContainer.add(star);
        }

        this.UIContainer.add([title, ratingContainer]);
    }

    private submitRating(stars: number): void {
        console.log('Player submitted rating:', stars);
        this.socket.emit('player:rating', { stars: stars });

        this.clearUI();
        const msg = this.add.text(960, 540, 'THANK YOU!', {
            fontFamily: '"Titan One", Arial',
            fontSize: `${this.getY(80)}px`,
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);
        this.UIContainer.add(msg);

        // Final cool down before possible lobby move
        this.tweens.add({
            targets: msg,
            scale: 1.2,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
    }


    protected render(): void {
        // Called from BaseScene when the screen is resized
        console.log('QuizPlayScene:: render: updating layout for new size');
        if (this.waitingState) {
            // nothing needs to be done here - display should resize itself good enough for now...
        } else if (this.currentQuestion) {
            this.currentQuestion.renderPlayer();
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
