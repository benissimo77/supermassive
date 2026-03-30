import { BaseScene } from 'src/BaseScene';
import { BaseQuestion } from 'src/quiz/questions/BaseQuestion';
import { ThreeCard } from './ThreeCard';
import { SocketDebugger } from 'src/utils/SocketDebugger';
import { QuestionFactory } from './QuestionFactory';
import { ThreePlayer } from './ThreePlayer';
import { PlayerConfig, PhaserPlayerState } from '../quiz/PhaserPlayer';
import { NineSliceButton } from "src/ui/NineSliceButton";
import { ThreeChip } from './ThreeChip';

import ThreePlayerActionFactory from './actions/ThreePlayerActionFactory';
import BasePlayerAction from './actions/BasePlayerAction';

export enum ThreeState {
    INIT = 'INIT',
    LOBBY = 'LOBBY',
    PRACTICE = 'PRACTICE',
    QUIZ_QUESTION = 'QUIZ_QUESTION',
    QUIZ_ANSWER = 'QUIZ_ANSWER',
    TEAM_BATTLE = 'TEAM_BATTLE',
    BATTLE_QUESTION = 'BATTLE_QUESTION',
    BATTLE_ANSWER = 'BATTLE_ANSWER',
    TILE_SELECTION = 'TILE_SELECTION',
    TURN_EVALUATE = 'TURN_EVALUATE',
    JOKER = 'JOKER', // Add Joker state tracking to Player Phone
    JOKER_EVALUATE = 'JOKER_EVALUATE', // Add Joker state tracking to Player Phone
    GAME_OVER = 'GAME_OVER'
}
enum BattleMode {
    OPEN = 'open',
    BATTLE = 'battle'
}

export class ThreePlayScene extends BaseScene {

    private currentQuestion: BaseQuestion | null = null;
    private currentQuestionNumber: number = -1;
    private questionFactory: QuestionFactory;

    private waitingState: boolean = false;
    private quizFinished: boolean = false;
    private currentState: ThreeState = ThreeState.INIT;
    
    private threePlayer: ThreePlayer;

    // UI elements
    private waitingText: Phaser.GameObjects.Text;
    private waitingPanel: Phaser.GameObjects.Container;
    private testButtons: NineSliceButton[] = [];


    // Additional containers specific to ThreePlayScene
    private gridContainer: Phaser.GameObjects.Container;
    private questionContainer: Phaser.GameObjects.Container;

    private actionFactory: ThreePlayerActionFactory;
    private currentAction: BasePlayerAction | null = null;
    public actionContainer: Phaser.GameObjects.Container;

    constructor() {
        super({ key: 'ThreePlayScene' });
    }

    init(): void {
        console.log('ThreePlayScene:: init');
        super.init();
        
        this.TYPE = 'play';
        this.questionFactory = new QuestionFactory(this);
        this.actionFactory = new ThreePlayerActionFactory(this, this.socket);

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

        // Cards and Icons
        this.load.image('card_back', '/assets/three/card-back.png');
        this.load.image('icon_1', '/assets/three/icon-key-bg.png');
        this.load.image('icon_2', '/assets/three/icon-energy-bg.png');
        this.load.image('icon_3', '/assets/three/icon-gold-bg.png');
        this.load.image('icon_4', '/assets/three/icon-trophy-bg.png');
        this.load.image('icon_5', '/assets/three/icon-star-bg.png');
        this.load.image('icon_6', '/assets/three/icon-crown-bg.png');
        this.load.image('joker', '/assets/three/joker.png');

        // Player UI assets
        this.load.image('playernamepanel', '/assets/rounded-rect-grey-480x48x14.png');

        // Selection slots and highlights
        this.load.image('selection-slot', "/assets/three/card-background.png");
        this.load.image('selection-slot-highlight', "/assets/three/card-background-highlight.png");
        this.load.image('highlight', "/assets/three/card-highlight.png");

        // Quiz-related images
        this.load.image('simple-button', '/assets/img/simplebutton.png');
        this.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
        this.load.image('dropzone', '/assets/img/dropzone.png');

        // Audio
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
        super.create(); // Initialize layers from BaseScene
        this.TYPE = 'play';

        console.log('ThreePlayScene::create');

        // Create the waiting panel - this will be shown at the beginning of the quiz and between questions
        this.waitingPanel = this.add.container(960, 540);
        this.waitingText = this.add.text(0, 0, 'Waiting for quiz to start...', this.labelConfig).setOrigin(0.5);
        this.waitingPanel.add(this.waitingText);
        this.waitingPanel.setScale(this.getUIScaleFactor());
        this.waitingPanel.setVisible(true);

        const sendReady = () => {
            console.log('ThreePlayScene:: sending player:ready');
            this.socket.emit('player:ready', {}, (playerConfig: PlayerConfig) => {
                console.log('ThreePlayScene:: player:ready callback:', playerConfig);
                this.mySessionID = playerConfig.sessionID;
                if (!this.threePlayer) {
                    this.threePlayer = new ThreePlayer(this, playerConfig);
                    this.threePlayer.setScale(this.getUIScaleFactor());
                    this.add.existing(this.threePlayer);
                    this.threePlayer.setPosition(-480, Phaser.Math.Between(this.getY(200), this.getY(880)));
                    this.animatePlayer(this.threePlayer);
                }
            });
        };

        this.socket.on('connect', sendReady);
        sendReady();

        // Create test buttons for getPhysicalScale proof-of-concept
        // const labels = ['TOP LEFT', 'CENTER', 'BOTTOM RIGHT'];
        const labels: string[] = [];
        const positions = [
            { x: 200, y: 100 },
            { x: 960, y: 540 },
            { x: 1720, y: 980 }
        ];

        labels.forEach((label, i) => {
            const btn = new NineSliceButton(this, label);
            btn.setPosition(positions[i].x, positions[i].y);

            // Apply the initial scale
            // btn.setScale(this.getPhysicalScale());
            
            this.UIContainer.add(btn);
            this.testButtons.push(btn);
        });

        // Center grid container using BaseScene's getY helper
        this.gridContainer = this.add.container(960, this.getY(540));
        this.actionContainer = this.add.container(0, 0); // Fills bounds on player
        this.mainContainer.add([this.gridContainer, this.actionContainer]);
        this.gridContainer.setVisible(false);
        // this.createGrid();
        // this.createSelectionChips();

        // Socket listeners
        this.setupSocketListeners();

        // Render the scene
        this.render();
    }

    private setupSocketListeners(): void {

        this.socket.onAny((event, ...args) => {
            console.log('ThreePlayScene:: Socket event:', event, args);
        });

        // Listen for question
        this.socket.on('server:state:question', async (question, callback) => {

            this.changeState(ThreeState.QUIZ_QUESTION, question);
            
            // If we are already displaying this question, ignore the message
            // This prevents wiping out player progress during silent reconnections
            if (this.currentQuestionNumber === question.questionNumber) {
                console.log('ThreePlayScene:: server:state:question - already displaying this question, ignoring:', this.currentQuestionNumber, question.questionNumber);
                return;
            }

            this.currentQuestionNumber = question.questionNumber;

            this.waitingState = false;
            this.waitingPanel.setVisible(false);
            this.tweens.killAll();
            this.tweens.add({
                targets: this.threePlayer,
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
                console.log('ThreePlayScene:: answer:', answer);
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
        this.socket.on('server:action:questionanswered', (data) => {
            // this.updatePlayerAnswer(data.sessionID, data.response);
        });

        // Question over - clear the screen and destroy all question-related objects
        this.socket.on('server:state:endquestion', (data) => {
            console.log('ThreePlayScene:: server:state:endquestion', data);
            this.clearUI();
            if (this.currentQuestion) {
                console.log('ThreePlayScene:: destroying current question');
                this.currentQuestion.destroy(true);
                this.currentQuestion = null;
            }
        });

        // Show answer
        this.socket.on('server:state:answer', (data) => {
            console.log('ThreePlayScene:: server:state:answer:', data);
            // this.showAnswer(data);
        });

        // TILE Selection 
        this.socket.on('server:state:tileselection', (data) => {
            console.log('ThreePlayScene:: server:state:tileselection:', data);
            this.changeState(ThreeState.TILE_SELECTION, data);
        });

        this.socket.on('server:state:turnevaluate', (data) => {
            console.log('ThreePlayScene:: server:state:turnevaluate:', data);
            this.changeState(ThreeState.TURN_EVALUATE, data);
        });

        // Joker event logic
        this.socket.on('server:state:joker', (data) => {
            console.log('ThreePlayScene:: server:state:joker:', data);
            this.changeState(ThreeState.JOKER, data);
        });

    }

    changeState(newState: ThreeState, data: any = {}): void {

        console.log(`ThreePlayScene:: Transitioning from ${this.currentState} to ${newState}`);
        this.stateTeardown(this.currentState);
        this.currentState = newState;
        this.stateSetup(newState, data);

    }

    stateTeardown(state: ThreeState): void {

        console.log(`ThreePlayScene:: Tearing down state ${state}`);

        // EXIT logic for states to clean up after themselves
        // ADD cases here as and when they come up
        switch (state) {

            case ThreeState.LOBBY:
                break;

            case ThreeState.QUIZ_QUESTION:                
                break;

            case ThreeState.QUIZ_ANSWER:
                break;

            case ThreeState.TILE_SELECTION:
            case ThreeState.JOKER:
                console.log('ThreePlayScene:: stateTeardown:', state, this.currentAction);
                if (this.currentAction) {
                    this.currentAction.destroy();
                    this.currentAction = null;
                }
                break;
        }
    }


    // ENTER logic for new state
    stateSetup(state: ThreeState, data: any = {}): void {

        console.log(`ThreePlayScene:: Setting up state ${state}`);

        switch (state) {

            case ThreeState.LOBBY:
                // this.doLobby();
                break;

            case ThreeState.QUIZ_QUESTION:
                break;

            case ThreeState.QUIZ_ANSWER:
                break;


            case ThreeState.TEAM_BATTLE:
                break;

            case ThreeState.TILE_SELECTION:
                if (data && this.actionFactory) {
                    this.clearUI();
                    
                    data.ui = 'select-tiles';
                    this.currentAction = this.actionFactory.create(data);
                    
                    if (this.currentAction) {
                        this.currentAction.onAction((payload: any) => {
                            // Forward the selected tiles (payload.answer) to the server
                            this.socket.emit('client:response', { answer: payload.answer, answerTime: 0 });

                            // Add a slight delay then go to a waiting state
                            this.waitingState = true;
                            this.time.delayedCall(2500, () => {
                                this.gotoWaitingState();
                            });
                        });

                        this.actionContainer.add(this.currentAction);
                        this.currentAction.initialize();
                        this.currentAction.render();
                    }
                }
                break;
                
            case ThreeState.JOKER:
                if (data && this.actionFactory) {
                    this.clearUI();
                    
                    this.currentAction = this.actionFactory.create(data);
                    if (this.currentAction) {

                        this.currentAction.onAction((payload: any) => {
                            console.log('ThreePlayScene:: Joker action submitted with payload:', payload);
                            this.socket.emit('client:response', { answer: payload.answer } );
                        });

                        this.actionContainer.add(this.currentAction);
                        this.currentAction.initialize();
                        this.currentAction.render();
                    }
                }
                break;
        }

    }

    private async createQuestion(question: any): Promise<void> {

        console.log('ThreePlayScene:: displayQuestion:', question);

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
        this.animatePlayer(this.threePlayer);
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

    private createGrid(): void {
        
        // Clear old cards if they exist
        this.cards.forEach(c => c.destroy());
        this.cards = [];

        for (let x = 0; x < this.GRID_SIZE; x++) {
            for (let y = 0; y < this.GRID_SIZE; y++) {
                const posX = (x - (this.GRID_SIZE - 1) / 2) * this.CARD_SIZE;
                const posY = this.getY((y - (this.GRID_SIZE - 1) / 2) * this.CARD_SIZE);
                const card: ThreeCard = new ThreeCard(this, posX, posY, 'card_back', x * this.GRID_SIZE + y);
                card.on('card-clicked', (pos: number) => {
                    console.log('Card clicked:', pos);
                    this.cardClicked(pos);
                });
                this.gridContainer.add(card);
                this.cards.push(card);
            }
        }
    }

    private createSelectionChips(): void {
        // Create 3 chips in the top right corner to indicate selection order
        for (let i = 0; i < 3; i++) {
            const chip = new ThreeChip(this, 1920 - (i * 150 + 100), this.getY(100));
            this.gridContainer.add(chip);
            this.selectionChips.push(chip);
        }
    }


    animatePlayer(player: ThreePlayer): void {

        if (this.quizFinished) return;

        // Animation for PlayerScreen is a bit simpler than for host
        // If we are in waiting state then player can move around screen
        // If not then move to bottom left corner and stay there until next waiting state
        // console.log('animatePlayer:', player);
        let targetX: number = Phaser.Math.Between(0, 1920);
        let targetY: number = Phaser.Math.Between(0, this.getY(1080));
        if (!this.waitingState) {
            targetX = 0;
            targetY = this.getY(1060);
        }
        this.tweens.add({
            targets: player,
            x: targetX,
            y: targetY,
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

    protected render(): void {
        // Called from BaseScene when the screen is resized
        console.log('ThreePlayScene:: render: updating layout for new size');
        this.socket.emit('consolelog', 'ThreePlayScene:: render: - physicalScale: ' + this.getPhysicalScale().toFixed(2));

        const physicalScale = this.getPhysicalScale();

        if (this.waitingText) {
            this.waitingText.setText('getPhysicalScale: ' + physicalScale.toFixed(2));
            this.waitingText.setText('');
        }

        // Update test buttons scale and position
        if (this.testButtons && this.testButtons.length > 0) {
            this.testButtons.forEach((btn, i) => {
                // btn.setScale(physicalScale);
                // Maintain positions relative to logical 1920x1080 (handled by logic, but ensuring x/y are correct in logic space)
            });
            // Update specific positions for test cases
            // this.testButtons[0].setPosition(this.testButtons[0].displayWidth / 2, this.testButtons[0].displayHeight / 2);
            // this.testButtons[0].setButtonText('displayWidth:' + this.testButtons[0].displayWidth.toFixed(2));
            // this.testButtons[1].setPosition(0, this.getY(540));
            // this.testButtons[1].setButtonText('width:' + this.testButtons[1].width.toFixed(2));
            // this.testButtons[2].setPosition(1920 - this.testButtons[2].displayWidth / 2, this.getY(1080) - this.testButtons[2].displayHeight / 2);
            // this.testButtons[2].setButtonText('inner:' + window.innerWidth + 'x' + window.innerHeight);
        }

        if (this.waitingState) {
            // nothing needs to be done here - display should resize itself good enough for now...
        } else if (this.currentQuestion) {
            this.currentQuestion.renderPlayer();
        }

        if (this.currentAction) {
            // Re-render layout coordinates natively within the 1920x1080 logical scaling bounds
            this.currentAction.render();
        }

        // Re-position waiting panel
        if (this.waitingPanel) {
            this.waitingPanel.setPosition(960, this.getY(540));
            this.waitingPanel.setScale(physicalScale);
        }
        // Re-scale and position player if answer NOT submitted ie player is in corner
        if (this.threePlayer) {
            this.threePlayer.setScale(physicalScale);
            if (!this.waitingState) {
                this.threePlayer.setPosition(0, this.getY(1060));
            }
        }

        // Re-position and scale grid container
        // Grid is 6 tiles wide with each tile 180px including spacing, so total width is 1080px - we want to keep it centered on the screen regardless of the display orientation
        // if (this.gridContainer) {
        //     this.gridContainer.setPosition(960, this.getY(540));

        //     if (this.isPortrait()) {
        //         // in portrait mode we scale based on the total width - camera zoom fixes width at 1920px and we know the grid total size is CARD_SIZE * GRID_SIZE
        //         const scale:number = 1920 / (this.GRID_SIZE * this.CARD_SIZE);
        //         this.gridContainer.setScale(scale);
        //     } else {
        //         // in landscape mode the height is the limiting factor - screen height / grid height 
        //         // but since we also have a camera zoom we can use helper getScaleFactor to calculate the actual height
        //         // AND THIS WORKS!!! Its a miracle...
        //         // NOTE: fix the 'actual' size of graphics and then scale based on the width/height depending on portrait or landscape
        //         const scale:number = 1080 * this.getScaleFactor() / (this.GRID_SIZE * this.CARD_SIZE);
        //         this.gridContainer.setScale(scale);
        //     }
        // }
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
        console.log('Three:: sceneShutdown...');
        // Remove any socket listeners or other cleanup tasks here
    }

}
