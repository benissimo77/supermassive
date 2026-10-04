import gsap from 'gsap';
import { BaseScene } from "src/BaseScene";

import { QuestionFactory } from "./questions/QuestionFactory";
import { PlayerBaseQuestion } from "./questions/PlayerBaseQuestion";

import { PlayerConfig, PhaserPlayer } from "./PhaserPlayer";


export class QuizPlayScene extends BaseScene {

    static readonly KEY = 'QuizPlayScene';

    // Required by BaseScene abstract contract — QuizPlayScene only has one local player,
    // tracked separately via this.phaserPlayer.
    public players: Map<string, Phaser.GameObjects.Container> = new Map();

    private currentQuestion: PlayerBaseQuestion;
    private currentQuestionNumber: number = -1;
    // Tracks whether the local player has answered the current question - lets
    // server:endquestion tell apart "already showing Answer Submitted, leave it resize-safe"
    // from "never answered, stop resizing the now-hidden question".
    private hasAnswered: boolean = false;
    private questionFactory: QuestionFactory;
    private quizFinished: boolean = false;
    private phaserPlayer: PhaserPlayer;

    // Unlike the Host's multi-player leaderboard, this player-facing screen only ever shows the
    // local player, so the avatar doesn't need to vary in size by rank - a flat scale looks
    // better here. 2x makes the ~480px name panel a comfortable ~960px in both orientations.
    private readonly PODIUM_PLAYER_SCALE = 2.6;

    // Stored handler references so sceneShutdown() can remove them cleanly.
    private onConnectSendReady: () => void;

    // Shared UI elements
    private waitingPanel: Phaser.GameObjects.Container;

    // The currently-active screen's layout function - reassigned by whichever screen method is
    // showing right now, called once immediately to position everything, and re-invoked by
    // render() on every resize. null between clearUI() and the next screen's assignment is a
    // safe transient state (render() just no-ops).
    private currentLayout: (() => void) | null = null;

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

        // Create the waiting panel - shown once, before the quiz starts
        this.waitingPanel = this.add.container(960, 540);
        const waitingText = this.add.text(0, 0, 'Waiting for quiz to start...', this.labelConfig).setOrigin(0.5);
        this.waitingPanel.add(waitingText);
        this.waitingPanel.setScale(this.getUIScaleFactor());
        this.waitingPanel.setVisible(true);

        // Deliberately does NOT touch phaserPlayer.x/y - its position is owned by the
        // animatePlayer() tween, and a resize must not snap it out of that tween.
        this.currentLayout = () => {
            this.waitingPanel.setPosition(960, this.getY(540));
            this.waitingPanel.setScale(this.getUIScaleFactor());
            if (this.phaserPlayer) {
                this.phaserPlayer.setScale(this.getUIScaleFactor());
            }
        };
        this.currentLayout();

        const sendReady = () => {
            const device = this.getDeviceInfo();
            console.log('QuizPlayScene:: sending player:ready with device info:', device);
            this.socket.emit('player:ready', { device }, (playerConfig: PlayerConfig) => {
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

        this.onConnectSendReady = sendReady;
        this.socket.on('connect', this.onConnectSendReady);
        sendReady();

        // Setup socket listeners
        this.setupSocketListeners();
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
            this.hasAnswered = false;

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

            this.currentQuestion.onAnswer((answer: any) => {
                console.log('QuizPlayScene:: answer:', answer);
                this.hasAnswered = true;

                // Send the answer to the server immediately - this must never wait on an animation.
                // questionNumber lets the server tell a genuine answer apart from a stale retry
                // that arrives after the question has already moved on (see server.quiz.js).
                const responsePayload = {
                    answer: answer,
                    answerTime: Date.now() - receivedTime - displayTime,
                    questionNumber: this.currentQuestionNumber
                };
                // Deliberately minimal: one retry on a missing ack, not a robust queue/backoff -
                // Socket.io's own buffer-and-flush-on-reconnect (plus connectionStateRecovery)
                // already covers the more common "briefly disconnected at submit time" case;
                // this only needs to catch "ack lost but connection fine".
                const sendResponse = (isRetry: boolean) => {
                    this.socket.timeout(4000).emit('client:response', responsePayload, (err: any) => {
                        if (!err) return;
                        if (!isRetry) {
                            console.warn('QuizPlayScene:: client:response not acknowledged, retrying once:', err);
                            sendResponse(true);
                        } else {
                            console.warn('QuizPlayScene:: client:response retry also not acknowledged, giving up:', err);
                        }
                    });
                };
                sendResponse(false);

                // The question is now playing its own submit-feedback animation (see
                // PlayerBaseQuestion.playSubmitAnimation) - stop resizing it, since renderPlayer()
                // would fight that animation by resetting the answer container's position.
                // onSubmitted (below) takes over once that animation finishes.
                this.currentLayout = null;
            });

            this.currentQuestion.onSubmitted(() => {
                this.showAnswerSubmitted();
            });
        });

        // Player answered a question (used in Host scene)
        this.socket.on('server:questionanswered', (data) => {
            // this.updatePlayerAnswer(data.sessionID, data.response);
        });

        // Question over - clear the screen
        // Note: we DON'T destroy the question since it might still be animating etc - just hide it
        this.socket.on('server:endquestion', (data) => {
            console.log('QuizPlayScene:: server:endquestion:', data);
            // If the player just tapped submit, force their feedback animation to finish right
            // now (see PlayerBaseQuestion.finishPendingAnimation) so it resolves into the Answer
            // Submitted screen cleanly rather than being silently hidden mid-animation.
            this.currentQuestion?.finishPendingAnimation();
            if (this.currentQuestion) {
                this.currentQuestion.setVisible(false);
            }
            // If the player never answered, show a neutral placeholder until the real next
            // screen (showanswer, etc.) arrives - the question is now hidden with nothing local
            // to replace it. If they did answer, Answer Submitted is already showing (in
            // UIContainer, untouched here) and stays resize-safe.
            if (!this.hasAnswered) {
                this.showTimesUp();
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
            // Comment this out for now - not worth collecting ratings just yet...
            // Besides the UI looks a bit janky...
            // this.showRatingUI();
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

        this.currentLayout = () => {
            titleText.setPosition(960, this.getY(50));
            descText.setPosition(960, this.getY(350));
        };
        this.currentLayout();

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
            fontSize: 32,
            fontFamily: 'Arial',
            color: '#ffffff',
            align: 'center',
            padding: { x: 20, y: 10 },
            stroke: '#000000'
        }
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, "");
        const descText = this.add.text(960, this.getY(350), cleanDescription, descriptionConfig);
        descText.setOrigin(0.5);

        this.UIContainer.add([roundTitle, descText]);

        this.currentLayout = () => {
            roundTitle.setPosition(960, this.getY(200));
            descText.setPosition(960, this.getY(350));
        };
        this.currentLayout();
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
            this.currentLayout = () => this.currentQuestion.renderPlayer();
            this.currentLayout();

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

    // Shown the instant the local player submits an answer, once their own submit-feedback
    // animation finishes (see PlayerBaseQuestion.onSubmitted) - persists as-is, no timer, until
    // the next real server event (endquestion/showanswer/etc.) replaces it.
    private showAnswerSubmitted(): void {
        this.clearUI();

        this.tweens.killAll();
        this.animatePlayer(this.phaserPlayer);

        const msg = this.add.text(960, 0, 'Answer submitted!', {
            fontFamily: '"Titan One", Arial',
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);
        this.UIContainer.add(msg);

        this.currentLayout = () => {
            msg.setPosition(960, this.getY(540));
            if (this.phaserPlayer) this.phaserPlayer.setScale(this.getUIScaleFactor());
        };
        this.currentLayout();
    }

    // Shown when server:endquestion arrives and the local player never submitted an answer -
    // persists as-is, no timer, until the next real server event (showanswer, etc.) replaces it.
    private showTimesUp(): void {
        this.clearUI();

        this.tweens.killAll();
        this.animatePlayer(this.phaserPlayer);

        const msg = this.add.text(960, 0, "Time's up!", {
            fontFamily: '"Titan One", Arial',
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);
        this.UIContainer.add(msg);

        this.currentLayout = () => {
            msg.setPosition(960, this.getY(540));
            if (this.phaserPlayer) this.phaserPlayer.setScale(this.getUIScaleFactor());
        };
        this.currentLayout();
    }

    // showAnswer - receives a list of scores from the server and displays if user got this question correct
    // Plays a suitable sound effect based on players score. Persists as-is, no timer, until the
    // next real server event (next round intro, next question, round end, or final scores).
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

            this.clearUI();
            this.tweens.killAll();
            this.animatePlayer(this.phaserPlayer);

            const msg = this.add.text(960, 0, answerText, {
                fontFamily: '"Titan One", Arial',
                fontSize: '64px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center'
            }).setOrigin(0.5);
            this.UIContainer.add(msg);

            this.currentLayout = () => {
                msg.setPosition(960, this.getY(540));
                if (this.phaserPlayer) this.phaserPlayer.setScale(this.getUIScaleFactor());
            };
            this.currentLayout();
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

        this.currentLayout = () => {
            titleText.setPosition(960, this.getY(200));
            descText.setPosition(960, this.getY(350));
            descText.setWordWrapWidth(this.cameras.main.width - 200);
        };
        this.currentLayout();

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

        const titleText = this.add.text(960, 0, 'QUIZ COMPLETE!', {
            fontSize: '80px',
            fontFamily: '"Titan One", Arial',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
            wordWrap: { width: 1800 }
        }).setOrigin(0.5);

        const rankText = this.add.text(960, 0, `You finished ${data.rank}${this.getOrdinal(data.rank)} out of ${data.totalPlayers}!`, {
            fontSize: '48px',
            fontFamily: '"Titan One", Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        rankText.setWordWrapWidth(1800);

        const scoreText = this.add.text(960, 0, `Final Score: ${data.score}`, {
            fontSize: '36px',
            fontFamily: '"Titan One", Arial',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        this.UIContainer.add([titleText, rankText, scoreText]);

        // Show "Save Scores" if guest
        const isGuest = !this.phaserPlayer.getUserID();
        const saveObjects = isGuest ? this.showSavePrompt() : null;

        this.currentLayout = () => {
            const isPortrait = this.isPortrait();
            const scale = isPortrait ? 2 : 1;

            // Save prompt: fixed top row in both orientations - button flush to the right edge,
            // text right-aligned immediately to its left.
            if (saveObjects) {
                const margin = 40;
                const gap = 24;
                const btnY = this.getY(70);
                const btnX = 1920 - margin;
                saveObjects.saveText.setScale(scale);
                saveObjects.signupBtn.setScale(scale);
                saveObjects.signupBtn.setPosition(btnX, btnY);
                saveObjects.saveText.setPosition(btnX - saveObjects.signupBtn.width - gap, btnY);
            }

            // Title/rank/score share one column: full-width-centered in portrait, or centered in
            // the right half in landscape (wordwrap kept clear of the podium group on the left).
            // Title never wraps (see its own construction) but still shares the same x.
            const textX = isPortrait ? 960 : 1440;
            const wrapWidth = isPortrait ? 1820 : 860;

            let currentY = this.getY(260);
            titleText.setPosition(textX, currentY);
            currentY += titleText.height + this.getY(20 * scale);

            rankText.setWordWrapWidth(wrapWidth);
            rankText.setPosition(textX, currentY);
            currentY += rankText.height + this.getY(10);
            scoreText.setPosition(textX, currentY);

            if (this.phaserPlayer) {
                const x = 400;
                this.phaserPlayer.setVisible(true);
                this.phaserPlayer.setScale(this.PODIUM_PLAYER_SCALE);
                // Avatar is roughly 100px wide starting at x=6 in its container - center is x=56.
                this.phaserPlayer.setPosition(x, this.getY(880));
            }

            // Not a great solution but text needs to scale up in portrait since camera zoom is reduced.
            titleText.setScale(scale);
            rankText.setScale(scale);
            scoreText.setScale(scale);

        };
        this.currentLayout();
    }

    private getOrdinal(n: number): string {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    private showSavePrompt(): { saveText: Phaser.GameObjects.Text; signupBtn: Phaser.GameObjects.Text } {
        // Positioned properly in the layout closure (top row, button flush right, text
        // right-aligned immediately to its left) - origins are set here since they don't change.
        const saveText = this.add.text(
            0,
            0,
            'Sign up to save your score for next time!',
            {
                fontSize: '40px',
                fontFamily: 'Poppins, Arial',
                color: '#ffffff',
                align: 'right'
            }
        ).setOrigin(1, 0.5)
            .setWordWrapWidth(700);

        const signupBtn = this.add.text(
            0,
            0,
            'SIGN UP',
            {
                fontSize: '44px',
                fontFamily: '"Titan One", Arial',
                backgroundColor: '#10b981',
                color: '#ffffff',
                padding: { x: 40, y: 20 }
            }
        ).setOrigin(1, 0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Redirect to signup with return URL to the play entry page
                const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login?mode=signup&redirect=${currentUrl}`;
            })
            .on('pointerover', () => signupBtn.setStyle({ backgroundColor: '#059669' }))
            .on('pointerout', () => signupBtn.setStyle({ backgroundColor: '#10b981' }));

        this.UIContainer.add([saveText, signupBtn]);

        return { saveText, signupBtn };
    }

    private showRatingUI(): void {
        console.log('QuizPlayScene:: showRatingUI');

        // Clear away all old UI
        this.clearUI();

        this.tweens.killAll();
        this.tweens.add({
            targets: this.phaserPlayer,
            x: 0,
            y: this.getY(1060),
            scale: 1,
            duration: Phaser.Math.Between(2000, 4000),
            ease: 'Back.Out'
        })

        const title = this.add.text(960, this.getY(150), 'RATE THE QUIZ!', {
            fontFamily: '"Titan One", Arial',
            fontSize: '72px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        const ratingContainer = this.add.container(960, 0);

        // Create 5 interactive stars
        const stars: Phaser.GameObjects.Text[] = [];
        for (let i = 1; i <= 5; i++) {
            const star = this.add.text(-600 + (i * 80), this.getY(540), '⭐', { fontSize: '80px' })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            star.on('pointerup', () => this.submitRating(i));
            star.on('pointerdown', () => star.setScale(1.4));
            star.on('pointerout', () => star.setScale(1.0));

            ratingContainer.add(star);
            stars.push(star);
        }

        this.UIContainer.add([title, ratingContainer]);

        this.currentLayout = () => {
            title.setPosition(960, this.getY(150));
            ratingContainer.setPosition(960, 0);
            stars.forEach((star, idx) => star.setPosition(-600 + ((idx + 1) * 80), this.getY(540)));
            // deliberately not re-snapping phaserPlayer.x/y - see entrance tween above,
            // resize should not fight an in-flight tween
            if (this.phaserPlayer) this.phaserPlayer.setScale(this.getUIScaleFactor());
        };
        this.currentLayout();
    }

    private submitRating(stars: number): void {
        console.log('Player submitted rating:', stars);
        this.socket.emit('player:rating', { stars: stars });

        this.clearUI();
        const msg = this.add.text(960, this.getY(540), 'THANK YOU!', {
            fontFamily: '"Titan One", Arial',
            fontSize: '80px',
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

        this.currentLayout = () => msg.setPosition(960, this.getY(540));
        this.currentLayout();
    }


    protected render(): void {
        // Called from BaseScene when the screen is resized.
        // Every screen method (re)assigns currentLayout when it becomes active, so this just
        // re-runs whichever one is currently showing. null is a safe transient state.
        this.currentLayout?.();
    }

    private clearUI(): void {
        // Screen is transitioning away - its layout no longer applies until the next screen
        // method assigns a new one. Safe even mid-transition since render() treats null as a no-op.
        this.currentLayout = null;
        // A new screen is about to take over - force any in-flight submit animation to finish
        // right now rather than let it keep running (and fire onSubmitted) against whatever
        // replaces it. No-op if nothing is animating.
        this.currentQuestion?.finishPendingAnimation();
        // Every screen but the initial "waiting for quiz to start" one hides this - do it here
        // once rather than in every individual screen method.
        this.waitingPanel?.setVisible(false);
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
        if (this.onConnectSendReady) {
            this.socket.off('connect', this.onConnectSendReady);
        }
        // A question that's only ever hidden (never destroyed, e.g. the quiz ended without
        // building another one) still needs its destroy() to run - some question types
        // (Number, Text) hold raw DOM elements outside Phaser that only destroy() removes.
        this.currentQuestion?.destroy();
        this.phaserPlayer = null as any;
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
