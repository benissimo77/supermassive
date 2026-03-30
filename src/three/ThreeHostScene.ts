import { BaseScene } from 'src/BaseScene';
import { ThreeCard } from './ThreeCard';
import { SocketDebugger } from 'src/utils/SocketDebugger';
import { QuestionFactory } from './QuestionFactory';
import { BaseQuestion } from '../quiz/questions/BaseQuestion';
import { ThreePlayer } from './ThreePlayer';
import { PlayerConfig, PhaserPlayerState } from '../quiz/PhaserPlayer';
import { BattleMap } from './BattleMap';
import { LobbyHUD } from 'src/ui/LobbyHUD';
import { BeatManager } from 'src/utils/BeatManager';
import ThreeHostActionFactory from './actions/ThreeHostActionFactory';
import BaseHostAction from './actions/BaseHostAction';

import { gsap } from 'gsap';

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
    JOKER = 'JOKER',
    JOKER_EVALUATE = 'JOKER_EVALUATE',
    GAME_OVER = 'GAME_OVER'
}

enum BattleMode {
    OPEN = 'open',
    BATTLE = 'battle'
}

const BATTLESLOT_HEIGHT = 360;
const BATTLESLOT_WIDTH = 560;

export class ThreeHostScene extends BaseScene {

    private beatManager: BeatManager = new BeatManager();
    private currentState: ThreeState = ThreeState.INIT;
    private stateTimeline: gsap.core.Timeline | null = null; // Tracks the primary animation for the current state

    private cards: ThreeCard[] = [];
    private battleMode: BattleMode = BattleMode.OPEN;
    private battleMap: BattleMap;
    private battleTeams: Map<string, 0|1> = new Map(); // Store sessionID -> slot index for persistent slot mapping
    private lobbyHUD: LobbyHUD;
    private lastKeyTime: number = 0;

    // Additional containers specific to ThreeHostScene
    private gridContainer: Phaser.GameObjects.Container;
    private battleContainer: Phaser.GameObjects.Container;
    private questionContainer: Phaser.GameObjects.Container;
    private playerContainer: Phaser.GameObjects.Container;

    private currentQuestion: BaseQuestion | null = null;
    private threePlayers: Map<string, ThreePlayer> = new Map();
    private questionFactory: QuestionFactory;

    // Cards are actually 160x160 but CARD_SIZE allows for 8 pixels space between cards
    private readonly GRID_SIZE = 6;
    private readonly CARD_SIZE = 180;

    private background: Phaser.GameObjects.Image;
    private backgroundOverlay: Phaser.GameObjects.Graphics;

    private socketDebugger: SocketDebugger;

    private actionFactory: ThreeHostActionFactory;
    private currentAction: BaseHostAction | null = null;
    public actionContainer: Phaser.GameObjects.Container;

    constructor() {
        super({ key: 'ThreeHostScene' });
    }

    preload(): void {

        // Phaser assets should use root-relative paths to load from /public/
        this.load.image('quiz-background', '/img/quiz/background.jpg');

        // Cards and Icons
        this.load.image('card_back', '/assets/three/card-back.png');
        this.load.image('icon_1', '/assets/three/icon-key-bg.png');
        this.load.image('icon_2', '/assets/three/icon-energy-bg.png');
        this.load.image('icon_3', '/assets/three/icon-gold-bg.png');
        this.load.image('icon_4', '/assets/three/icon-trophy-bg.png');
        this.load.image('icon_5', '/assets/three/icon-star-bg.png');
        this.load.image('icon_6', '/assets/three/icon-crown-bg.png');
        this.load.image('joker', '/assets/three/joker.png');
        this.load.image('joker-white', '/assets/three/joker-white.png');

        // Player UI assets
        this.load.image('playernamepanel', '/assets/rounded-rect-grey-480x48x14.png');

        // Selection slots - plus highlight versions and versus graphic
        this.load.image('selection-slot', "/assets/three/card-background.png");
        this.load.image('selection-slot-highlight', "/assets/three/card-background-highlight.png");
        this.load.image('highlight', "/assets/three/card-highlight.png");
        this.load.image('versus', '/assets/three/versus.png');

        // Quiz-related images
        this.load.image('simple-button', '/assets/img/simplebutton.png');
        this.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
        this.load.image('dropzone', '/assets/img/dropzone.png');

        // Audio
        this.load.audio('quiz-countdown', '/assets/audio/quiz/music/quiz-countdown-337785.mp3');
        this.load.audio('question-answered', '/assets/audio/quiz/fx/446100__justinvoke__bounce.wav');
        this.load.audio('end-question', '/assets/audio/quiz/fx/gong-hit-2-184010.mp3');


        // Load custom fonts
        this.load.rexWebFont({
            google: {
                families: ['Titan One']
            }
        });

    }

    init(): void {
        super.init();
        this.TYPE = 'host';
        this.questionFactory = new QuestionFactory(this);
        this.actionFactory = new ThreeHostActionFactory(this);

        // General keyboard listener - useful for keyboard control
        if (this.input?.keyboard) {
            this.input.keyboard.on('keydown', this.handleKeyDown, this);
        }

    }

    create(): void {
        super.create(); // Initialize containers from BaseScene
        console.log('ThreeHostScene::create: scaleFactorY', this.getScaleFactor());

        // 1. Scene background
        this.background = this.add.image(0, 0, 'quiz-background').setOrigin(0.5, 0.5);
        this.background.setPosition(960, this.getY(540));
        this.background.setDisplaySize(1920, this.getY(1080));
        this.backgroundContainer.add(this.background);
        this.backgroundOverlay = this.add.graphics();
        this.backgroundContainer.add(this.backgroundOverlay);

        // 2. Initialize Three-Specific Containers inside BaseScene slots
        this.gridContainer = this.add.container(1280, this.getY(540));
        this.battleContainer = this.add.container(-1920, 0);
        this.playerContainer = this.add.container(0, 0);
        this.questionContainer = this.add.container(0, 0);
        this.actionContainer = this.add.container(1280, this.getY(540)); // Center of screen for Joker splashes

        // Grid and Players live in the Main/World container
        this.mainContainer.add([this.battleContainer, this.playerContainer, this.gridContainer, this.questionContainer, this.actionContainer]);

        // Create the grid (invisible to start and scaled down ready for the scale-up transition)
        this.createGrid();
        this.gridContainer.setVisible(false);
        this.gridContainer.setScale(0.1);
 
        // Set up the lobbyHUD display
        this.lobbyHUD = new LobbyHUD(this, 0, 0, "Three For All");
        this.lobbyHUD.setVisible(false);
        this.UIContainer.add(this.lobbyHUD);

        // 3. Pre-create Selection Slots for Board Resolution (Dugout)
        // Hidden until Board phase, always behind player avatars
        this.createBattleUI();

        // 4. Initial Scene display setup
        this.render();

        if (__DEV__) {
            this.socketDebugger = new SocketDebugger(this, this.socket);
            this.socketDebugger.toggleVisibility();
        }

        this.setupSocketListeners();

        // 5. Handshake & Initialization
        if (this.socket.connected) {
            this.initServerHandshake();
        } else {
            console.log('ThreeHostScene:: Socket not connected - waiting for connect event...');
            this.socket.once('connect', () => {
                console.log('ThreeHostScene:: Socket connected - starting handshake.');
                this.initServerHandshake();
            });
        }

    }

    update(time: number, delta: number): void {
        this.beatManager.update();
        this.lobbyHUD.updateHUDTimerGraphics();
    }

    // SEQUENTIAL BOOTSTRAP:
    // 1. host:ready -> server returns roomID
    // 2. host:requestgame -> server loads game module returns quiz data (pre-game waiting state) 
    // 3. host:requeststart -> start game logic (opening credits and into first round)
    private initServerHandshake(): void {
        console.log('ThreeHostScene:: Handshaking with server...');

        // Step 1: host:ready. Returns the Room ID.
        this.socket.emit('host:ready', {}, (readyResponse: any) => {
            console.log('ThreeHostScene:: host:ready ack:', readyResponse);
            if (readyResponse && readyResponse.roomID) {
                this.roomID = readyResponse.roomID;
                this.lobbyHUD.showInstructionPanel(this.roomID);

                // Step 2: Request the specific game logic ('three')
                const urlParams = new URLSearchParams(window.location.search);
                const quizID = (this.scene.settings.data as any)?.quizID || urlParams.get('q');
                this.socket.emit('host:requestgame', 'three', { quizID }, (gameResponse: any) => {
                    console.log('ThreeHostScene:: host:requestgame ack:', gameResponse);
                    if (gameResponse && gameResponse.success) {
                        // The server is now running 'three' logic for this room.
                        // We can now safely request to start and begin the stateMachine flow on the server
                        this.changeState(ThreeState.LOBBY, gameResponse);
                        this.socket.emit('host:requeststart', {}, (startResponse: any) => {
                            console.log('ThreeHostScene:: host:requeststart ack:', startResponse);
                        });
                    }
                });
            }
        });
    }

    protected render(): void {
        console.log('ThreeHostScene:: render - re-calibrating for current state:', this.currentState);

        // 1. Static Layout & Overlays (Background darkening)
        if (this.background) {
            this.background.setPosition(960, this.getY(540));
            this.background.setDisplaySize(1920, this.getY(1080));
        }
        if (this.backgroundOverlay) {
            this.backgroundOverlay.clear();
            this.backgroundOverlay.fillStyle(0x000000, 0.8);
            this.backgroundOverlay.fillRect(0, 0, 1920, this.getY(1080));
        }

        // 2. Safety: Kill major UI tweens to prevent conflicts during transition/resize
        this.tweens.killTweensOf([
            this.questionContainer,
            this.playerContainer,
            this.gridContainer,
            this.mainContainer
        ]);

        // 3. Sync state-specific dynamic content visibility
        if (this.currentQuestion) {
            this.currentQuestion.renderHost();
        }

        // scale the BattleUI to fit the screen - battleUI is designed to be 1080 height and then scaled to fit
        if (this.battleContainer) {
            // Experiment with scaling the battleUI to simplify the problem if fitting it all in
            console.log('ThreeHostScene:: Scaling battleContainer with scale factor', this.getY(1080) / 1080, 'getScaleFactor():', this.getScaleFactor());
            this.battleContainer.setScale(this.getY(1080) / 1080);
        }

        // If a Joker panel is active, let it adjust itself (e.g. recenter dynamically)
        if (this.currentState === ThreeState.JOKER && this.currentAction) {
            // Action containers reside at 960, getY(540) via BaseScene logic
            this.actionContainer.setPosition(1280, this.getY(540));
        }

        // If we have a grid container then ensure it still fits the screen
        // Positioned slightly to the right of centre to leave room for battle UI
        if (this.gridContainer) {
            this.gridContainer.setPosition(1280, this.getY(540));

            // landscape uses height as determining factor
            const scale = 1080 * this.getScaleFactor() / (this.GRID_SIZE * this.CARD_SIZE);
            this.gridContainer.setScale(scale * 0.9); // Shrink slightly to fit buttons nicely
        }

    }

    changeState(newState: ThreeState, data: any = {}): void {

        console.log(`ThreeHostScene:: Transitioning from ${this.currentState} to ${newState}`);
        this.stateTeardown(this.currentState);
        this.currentState = newState;
        this.stateSetup(newState, data);

    }

    stateTeardown(state: ThreeState): void {

        console.log(`ThreeHostScene:: Tearing down state ${state}`);

        // FIX: Force state timeline to instant completion to prevent half-finished state updates when skipping
        if (this.stateTimeline && this.stateTimeline.isActive()) {
            this.stateTimeline.progress(1).kill();
            this.stateTimeline = null;
        }

        // EXIT logic for states to clean up after themselves
        // ADD cases here as and when they come up
        switch (state) {

            case ThreeState.LOBBY:
                this.lobbyHUD.setVisible(false);
                break;

            case ThreeState.QUIZ_QUESTION:
                this.battleTeams.forEach((slotIndex, sessionID) => {
                    this.threePlayers.get(sessionID)?.setHighlighted(false);
                });
                break;

            case ThreeState.QUIZ_ANSWER:
                // Clean up question container and prepare players for next phase
                this.questionContainer.removeAll(true);
                if (this.currentQuestion) {
                    this.currentQuestion.destroy();
                    this.currentQuestion = null;}
                break;

            case ThreeState.TILE_SELECTION:
                // Clean highlight from battle slots
                this.battleTeams.forEach((slotIndex, sessionID) => {
                    this.threePlayers.get(sessionID)?.setHighlighted(false);
                });
                break;

            case ThreeState.TURN_EVALUATE:
                // Reset battle map for next turn
                this.battleMap.resetBattleMap();
                break;
                
            case ThreeState.JOKER:
                // Slide action container off-screen to the right, then destroy
                if (this.currentAction) {
                    const oldAction = this.currentAction;
                    this.currentAction = null; // Detach reference immediately
                    
                    this.tweens.add({
                        targets: this.actionContainer,
                        x: "+=1280",
                        duration: 0.8,
                        ease: "power2.inOut",
                        onComplete: () => {
                            oldAction.destroy();
                        }
                    });
                }
                break;
        }
    }


    // ENTER logic for new state
    stateSetup(state: ThreeState, data: any = {}): void {

        console.log(`ThreeHostScene:: Setting up state ${state}`);

        switch (state) {

            case ThreeState.LOBBY:
                this.doLobby();
                this.lobbyHUD.setVisible(true);
                this.UIContainer.setY(this.getY(1280));
                this.tweens.add({
                    targets: this.UIContainer,
                    y: 0,
                    duration: 1000,
                    ease: 'Back.easeOut'
                });
                break;

            case ThreeState.QUIZ_QUESTION:
                this.questionContainer.setVisible(true);
                this.questionContainer.setAlpha(1);
                break;

            case ThreeState.QUIZ_ANSWER:
                this.questionContainer.setVisible(true);
                this.questionContainer.setAlpha(1);
                break;


            case ThreeState.TEAM_BATTLE:
            case ThreeState.TILE_SELECTION:

                // 2. Focus on the Board
                this.gridContainer.setVisible(true);
                this.tweens.add({
                    targets: this.gridContainer,
                    scale: 1,
                    duration: 800,
                    ease: 'Back.easeOut'
                });

                // 3 Battle Container
                this.battleContainer.setVisible(true);
                this.tweens.add({
                    targets: this.battleContainer,
                    x: 0,
                    duration: 800,
                    ease: 'Back.easeOut'
                })

                this.doBattleSetup(data);
                break;

            case ThreeState.TILE_SELECTION:
                // Nothing needed in the host view - display should be set up from the previous state
                break;

            case ThreeState.JOKER:
                if (this.currentAction) {
                    this.currentAction.destroy();
                    this.currentAction = null;
                }
                this.currentAction = this.actionFactory.create(data);
                if (this.currentAction) {
                    this.actionContainer.add(this.currentAction);
                    this.currentAction.render();
                    this.actionContainer.setPosition(1920 + 1280, this.getY(540)); // Start off-screen right
                    this.tweens.add({
                        targets: this.actionContainer,
                        x: 1280,
                        duration: 800,
                        ease: 'Back.easeOut'
                    });
                }
                break;
        }

    }


    // LobbyUI is all the elements that comprise the "Waiting to Start" state
    // Starting soon message, player count, countdown timer, instructions panel
    private doLobby(): void {

        // Destroy everything and re-create to allow idempotence of this function
        this.lobbyHUD.setVisible(true);

        // Start lobby music
        // this.soundManager.playMusic('quiz-music-intro', { volume: 0.5 });
        const music = this.soundManager.getCurrentMusicTrack();
        if (music && music.sound) {
            // "modern-beat-jingle-intro" sounds like ~128 BPM
            this.beatManager.start(music.sound, 128);
        }

    }

    private doBattleSetup(data: any): void {

        console.log('ThreeHostScene:: doBattleSetup:', data);
        this.battleMode = BattleMode.BATTLE;

        // First time: first team gets put into first slot, second team into second slot
        if (this.battleTeams.size === 0) {
            if (data.battleTeams) {
                this.battleTeams.set(data.battleTeams[0], 0);
                this.battleTeams.set(data.battleTeams[1], 1);
            }
        }

        // Loop through players either placing them into their correct battleSlot or hiding them
        this.threePlayers.forEach((p, sessionID) => {
            console.log('ThreeHostScene:: TEAM_BATTLE - placing player:', p.getSessionID(), sessionID);
            if (data.battleTeams.includes(sessionID)) {
                p.setIconGridVisibility(true);
                p.setCardMode(true);
                p.setPlayerState(PhaserPlayerState.REVEALING);
                this.tweens.killTweensOf(p);
                
                const currentSlotIndex = this.battleTeams.get(sessionID);
                const newSlotIndex = data.battleTeams.indexOf(sessionID);
                console.log('ThreeHostScene:: TEAM_BATTLE - player slot mapping:', sessionID, 'currentSlotIndex:', currentSlotIndex, 'newSlotIndex:', newSlotIndex);
                
                if (currentSlotIndex !== undefined && newSlotIndex !== undefined) {
                    this.reparentObject(p, this.battleContainer);
                    this.battleContainer.sendToBack(p);
                    
                    const targetX = 80;
                    const targetY = 20 + 20 + 140 + newSlotIndex * (BATTLESLOT_HEIGHT + 20);

                    this.tweens.add({
                        targets: p,
                        x: targetX,
                        y: targetY,
                        duration: 800,
                        ease: 'Back.easeOut'
                    });
                }
            } else {
                p.setIconGridVisibility(false);
                p.setCardMode(false);
                p.setPlayerState(PhaserPlayerState.HIDDEN);
                this.animatePlayer(p);
            }
        });
    }

    private doTileSelection(data: any): void {
        console.log('ThreeHostScene:: doTileSelection:', data);
        // Loop through the responses and set the player score text to their score
        for (const [sessionID, response] of Object.entries(data.responses)) {
            const player = this.threePlayers.get(sessionID);
            const r = response as any;
            if (player) {
                console.log('ThreeHostScene:: doTileSelection - placing response for player:', sessionID, 'score:', r.score);
                player.setPlayerScoreText(r.score || '-');
            } else {
                console.warn('ThreeHostScene:: doTileSelection - no player found for sessionID:', sessionID);
            }
        }
    }

    addPlayer(playerConfig: PlayerConfig): ThreePlayer {
        const phaserPlayer: ThreePlayer = new ThreePlayer(this, playerConfig);
        this.threePlayers.set(playerConfig.sessionID, phaserPlayer);
        this.add.existing(phaserPlayer);
        this.playerContainer.add(phaserPlayer);

        phaserPlayer.setPosition(-480, Phaser.Math.Between(0, this.getY(1080)));
        this.animatePlayer(phaserPlayer);

        return phaserPlayer;
    }

    animatePlayer(player: ThreePlayer): void {
        // console.log('animatePlayer:', player);

        // If player is racing or revealing, do not animate anymore since racetrack will control player
        if (player.getPlayerState() === PhaserPlayerState.RACING || player.getPlayerState() === PhaserPlayerState.REVEALING) {
            return;
        }

        this.tweens.killTweensOf(player);
        let yTarget: number = Phaser.Math.Between(0, this.getY(980));
        switch (player.getPlayerState()) {

            case PhaserPlayerState.ANSWERING:
                yTarget = this.getY(1080 - 20);
                break;
            case PhaserPlayerState.HIDDEN:
                yTarget = this.getY(1280);
                break;
        }
        this.tweens.add({
            targets: player,
            scale: 1,
            x: Phaser.Math.Between(0, 1920),
            y: yTarget,
            duration: Phaser.Math.Between(2000, 4000),
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                if (player.getPlayerState() !== PhaserPlayerState.HIDDEN) {
                    this.animatePlayer(player);
                }
            }
        });
    }

    private async createQuestion(question: any): Promise<void> {
        console.log('ThreeHostScene:: createQuestion:', question);

        // Clean up previous question
        this.questionContainer.removeAll(true);

        // Create the appropriate question renderer based on type
        this.currentQuestion = this.questionFactory.create(question.type, question);
        await this.currentQuestion.initialize();

        // Display host layout
        this.currentQuestion.renderHost();

        // Add to our question container
        this.add.existing(this.currentQuestion);
        this.questionContainer.add(this.currentQuestion);

    }

    /* showAnswer
     * Show the answer for the current question
     * Note that we don't pass questionData into the function since it has just been created so will be stored in this.currentQuestion
     */
    private getAnswerTimeline(): gsap.core.Timeline {

        if (!this.currentQuestion) {
            return gsap.timeline();
        }

        // Prepare the players to be moved around to represent their choices
        for (const [playerID, player] of this.threePlayers) {
            player.setPlayerState(PhaserPlayerState.REVEALING);
            this.tweens.killTweensOf(player);
            this.reparentObject(player, this.playerContainer);
        }
        return this.currentQuestion.prepareAnswerResults();
    }


    // Define all the socket events that will drive this game
    // Two types of events:
    // Game State Events: Emitted by server to transition to a new game state (e.g., new question, show answer,)
    // Game Action Events: Emitted by server to trigger specific actions (eg card reveal, collect icon)
    // Game State Events typically invoke a transition to a new state and use the changeState function
    // Game Action Events typically don't update game state but just trigger short animations or UI updates
    private setupSocketListeners(): void {

        // First socket events are general ones sent by room - keep these together (they are special so don't follow the same schema as other events)
        this.socket.on('playerconnect', (playerConfig: PlayerConfig) => {
            console.log('ThreeHostScene:: playerconnect', playerConfig);
            if (!this.threePlayers.has(playerConfig.sessionID)) {
                this.addPlayer(playerConfig);
                this.lobbyHUD.updatePlayerCount(this.threePlayers.size);
            }
        });

        this.socket.on('server:players', (players: any[]) => {
            console.log('ThreeHostScene:: server:players', players);
            players.forEach(p => {
                if (!this.threePlayers.has(p.sessionID)) {
                    this.addPlayer(p);
                }
            });
            this.lobbyHUD.updatePlayerCount(players.length);
        });

        this.socket.on('server:state:question', async (question: any) => {
            this.changeState(ThreeState.QUIZ_QUESTION, question);
            await this.createQuestion(question);

            // Animate transition (sliding from right)
            this.currentQuestion.x = 1920;
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
                }
            });

            // Set all players to state of ANSWERING
            // - re-parent them in playerContainer
            // - animate them to the bottom of the screen on the next tween update
            if (question.battleMode === BattleMode.OPEN) {
                this.threePlayers.forEach((player: ThreePlayer) => {
                    this.reparentObject(player, this.playerContainer);
                    player.setPlayerState(PhaserPlayerState.ANSWERING);
                    // player.resetPlayerScoreText();
                    this.animatePlayer(player);
                });
            } else {
                // do nothing - should be all set up from previous TEAMBATTLE state
            }

        });

        this.socket.on('server:state:answer', async (question: any) => {
            this.changeState(ThreeState.QUIZ_ANSWER, question);
            await this.createQuestion(question);

            const tl = this.getAnswerTimeline();
            this.stateTimeline = tl;

            // For the OPEN question we have a pretty complex animation leading to the two winning teams
            // So in this case we can immediately trigger the next state transition once the animation is complete since we know the flow will always be question -> answer -> team battle
            // Not so for the BATTLE question (until I can improve the reveal animtion)
            // For now in BATTLE mode just make sure the teams scores are added to their battleSlots so we can observe before the next state is manually triggered
            if (question.battleMode === BattleMode.OPEN) {
                tl.eventCallback('onComplete', () => {
                    console.log('Answer reveal animation complete:', question);
                    // After we've seen the answer we can go directly to the team battle state since it flows directly from the answer reveal
                    // We do this by sending a host:response to the server which triggers the nextState change
                    this.socket.emit('host:response');
                });
            } else {
                tl.eventCallback('onComplete', () => {
                    console.log('Answer reveal animation complete for BATTLE question:', question);
                    for (const [sessionID, response] of Object.entries(question.responses)) {
                        const r = response as any;
                        console.log('Updating score for sessionID:', sessionID, 'score:', r.score);
                        const player = this.threePlayers.get(sessionID);
                        if (player) {
                            player.setPlayerScoreText(r.score || '-');
                        }
                    }
                });
            }
            tl.play();
        });

        // Player answered a question
        this.socket.on('server:questionanswered', (data) => {

            const player: ThreePlayer = this.getPlayerBySessionID(data.sessionID);
            if (player) {
                this.soundManager.playFX('question-answered', 0.3);
                if (this.battleMode === BattleMode.OPEN) {
                    player.setPlayerState(PhaserPlayerState.ANSWERED);
                    this.tweens.killTweensOf(player);
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
                } else {
                    // highlight the selection slot for this player (will do for now)
                    player.setHighlighted(true);
                }
            }
        });

        this.socket.on('server:state:teambattle', (data: any) => {
            console.log('ThreeHostScene:: server:state:teambattle', data);

            // Slight edge case to logic here since this event can be called multiple times
            // But we only want to invoke a state change the first time...
            this.changeState(ThreeState.TEAM_BATTLE, data);
        });

        this.socket.on('server:state:battlequestion', async (question: any) => {
            console.log('ThreeHostScene:: server:state:battlequestion', question);
            this.changeState(ThreeState.BATTLE_QUESTION, question);
            await this.createQuestion(question);

            // Animate transition (sliding from right)
            this.currentQuestion.x = 1920;
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
                }
            });

            // Set battling teams to state of ANSWERING
            this.battleTeams.forEach((slotIndex, sessionID) => {
                const player = this.threePlayers.get(sessionID);
                if (player) {
                    player.setPlayerState(PhaserPlayerState.ANSWERING);
                    this.animatePlayer(player);
                }
            });
        });

        this.socket.on('server:state:battleanswer', async (question: any) => {
            console.log('ThreeHostScene:: server:state:battleanswer', question);
            this.changeState(ThreeState.BATTLE_ANSWER, question);
            await this.createQuestion(question);
            const tl:gsap.core.Timeline = this.getAnswerTimeline();
            this.stateTimeline = tl;
            tl.eventCallback('onComplete', () => {
                console.log('Battle Answer reveal animation complete:', question);
                this.socket.emit('host:response');
            });
            tl.play();
        });

        this.socket.on('server:state:tileselection', (data: any) => {
            console.log('ThreeHostScene:: server:state:tileselection:', data);
            this.changeState(ThreeState.TILE_SELECTION, data);
        });

        this.socket.on('server:state:joker', (data: any) => {
            console.log('ThreeHostScene:: server:state:joker:', data);
            this.changeState(ThreeState.JOKER, data);
        });

        this.socket.on('server:action:iconrevealed', (data: { iconKey: string }) => {
            console.log('ThreeHostScene:: server:action:iconrevealed', data);
            this.battleMap.iconRevealed(data.iconKey);
        });

        this.socket.on('game:selection', (data: { index: number, order: number | null }) => {
            console.log('ThreeHostScene:: game:selection', data);
            const card = this.cards[data.index];
            if (card) {
                card.setSelection(data.order);
            }
        });

        this.socket.on('server:action:revealtile', (data: { index: number, icon?: string }) => {
            console.log('ThreeHostScene:: server:action:revealtile', data);
            const card = this.cards[data.index];
            if (card) {
                card.flip(data.icon || '', true);
            }
        });

        this.socket.on('server:action:hidetile', (data: { index: number }) => {
            console.log('ThreeHostScene:: server:action:hidetile', data);
            const card = this.cards[data.index];
            if (card) {
                card.flip('', false);
            }
        });

        this.socket.on('server:action:collecttile', (data: { sessionID: string, icon: string, newTileCount?: number }) => {
            console.log('ThreeHostScene:: server:action:collecttile', data);
            const player = this.threePlayers.get(data.sessionID);
            if (player) {
                player.setIconGridVisibility(true);
                player.addCollectedIcon(data.icon, 0, data.newTileCount || 1);
            }
        });

        this.socket.on('server:action:losetile', (data: { sessionID: string, icon: string }) => {
            console.log('ThreeHostScene:: server:action:losetile', data);
            const player = this.threePlayers.get(data.sessionID);
            if (player) {
                player.setIconGridVisibility(true);
                player.loseCollectedIcon(data.icon, 0);
            }
        });

        this.socket.on('server:state:turnevaluate', (data: { reveals: any[] }) => {
            console.log('ThreeHostScene:: server:state:turnevaluate:', data);
            this.changeState(ThreeState.TURN_EVALUATE, data);
            this.doTurnEvaluate(data);
        });

        this.socket.on('server:state:joker', (data: any) => {
            console.log('ThreeHostScene:: server:state:joker:', data);
            this.changeState(ThreeState.JOKER, data);
        });

        this.socket.on('server:state:jokerevaluate', (data: any) => {
            console.log('ThreeHostScene:: server:state:jokerevaluate:', data);
            this.changeState(ThreeState.JOKER_EVALUATE, data);
            this.doJokerEvaluate(data);
        });

        this.socket.on('game:turn', (data: { sessionID: string }) => {
            console.log('ThreeHostScene:: game:turn', data);
            this.setActiveTeam(data.sessionID);
        });
    }

    private async doTurnEvaluate(data: { reveals: any[] }): Promise<void> {
        console.log('ThreeHostScene:: handleTurnEvaluate start:', data);

        // Helper functions to add an animated message above a card
        const addCardMessage = (scene: Phaser.Scene, card: ThreeCard, message: string, configOverride: any = {}): gsap.core.Timeline => {
            // Note: Phaser for stroke uses `stroke` (string color) and `strokeThickness` (number)
            const cardMessageConfig = { 
                fontFamily: 'Titan One', 
                fontSize: '60px', 
                color: '#ff0000', 
                stroke: '#000000', 
                strokeThickness: 2
            };
            Object.assign(cardMessageConfig, configOverride);
            
            const text = scene.add.text(card.x, card.y - 100, message, cardMessageConfig).setOrigin(0.5);
            this.gridContainer.add(text);

            const messageTl = gsap.timeline({
                onComplete: () => text.destroy()
            });

            messageTl.fromTo(text, 
                { y: card.y - 60, scale: 0.8, alpha: 0 },
                { y: card.y - 160, scale: 1.2, alpha: 1, duration: 0.4, ease: "back.out" }
            );

            messageTl.to(text, 
                { alpha: 0, duration: 0.3, ease: "power2.in" }, 
                "+=0.8"
            );

            return messageTl;
        };

        // 1. Create a timeline for the reveals plus short pause before begin
        const tl = gsap.timeline();
        this.stateTimeline = tl;
        tl.add(() => {}, "+=0.5");

        // 2. Process each reveal step
        for (const reveal of data.reveals) {
            const card = this.cards[reveal.pos];
            const activePlayer = this.threePlayers.get(reveal.playerSID);

            // Turn start: Highlight active player slot
            tl.add(() => {
                this.setActiveTeam(reveal.playerSID);
            });

            // Reveal step: Flip the card or make it pop if already flipped
            if (card) {
                if (card.isFlipped()) {
                    tl.to(card, {
                        scale: 1.2,
                        duration: 0.4,
                        yoyo: true,
                        repeat: 1,
                        ease: "quad.inOut"
                    });
                } else {
                    // Integrate the card's flip timeline into our master timeline
                    // Note: `tl.add()` automatically schedules the timeline, we don't need to play() it. But we MUST let GSAP control it.
                    // Because ThreeCard is returning a paused timeline, GSAP's master timeline will manually unpause it when it's precisely its time.
                    tl.add( card.flip(reveal.icon, true), ">");
                }
            }

            // Add the steal/no-op/collect animation based on the reveal result
            switch (reveal.result) {

                case 'steal':
                    if (card) {
                        tl.add(addCardMessage(this, card, 'STEAL!'), ">");
                    }

                    // BattleTeam Map keys are sessionIDs, values are slot indices (0 or 1)
                    let fromSID = reveal.fromSID;
                    const victim = this.threePlayers.get(fromSID);
                    tl.add(() => {
                        if (victim) victim.loseCollectedIcon(reveal.icon, reveal.pos);
                        if (activePlayer) activePlayer.addCollectedIcon(reveal.icon, reveal.pos, reveal.newTileCount);
                        // this.soundManager.playFX('steal-icon');
                    }, "<+0.2"); // Slight offset from the "STEAL!" text pop
                    break;

                case 'no-op':
                    if (card) {
                        tl.add(addCardMessage(this, card, 'NOPE', { color: '#aaaaaa' }), ">");
                    }
                    break;

                case 'collect':
                    if (card) {
                        tl.add(addCardMessage(this, card, 'NEW TILE!', { color: '#00ff00' }), ">");
                    }
                    tl.add(() => {
                        if (activePlayer) activePlayer.addCollectedIcon(reveal.icon, reveal.pos, reveal.newTileCount);
                        // this.soundManager.playFX('collect-icon');
                    }, "<+0.1");
                    tl.add(() => {
                        // After collecting a tile, we should update the battle map to show the new icon revealed
                        this.battleMap.iconRevealed(reveal.icon);
                    }, "<");
                    break;
            }


            // Brief pause between reveals in a turn
            tl.add(() => {
                this.battleTeams.forEach((slotIndex, sessionID) => {
                    this.threePlayers.get(sessionID)?.setHighlighted(false);
                });
            }, "+=0.5");
        }

        // 3. After all reveals, flip back all the non-joker tiles
        tl.add(() => {
            for (const reveal of data.reveals) {
                const card = this.cards[reveal.pos];
                if (card.isFlipped() && reveal.icon !== 'joker') {
                    tl.add( card.flip('', false), ">+=0.1" );
                }
            }
        }, "+=0.5");

        tl.play();
    }

    private setActiveTeam(sessionID: string): void {
        // Find which slot index this player is in based on the battleTeams mapping
        const winnerIndex = this.battleTeams.get(sessionID);

        this.battleTeams.forEach((slotIndex, sID) => {
            this.threePlayers.get(sID)?.setHighlighted(slotIndex === winnerIndex);
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

        console.log(`Key pressed: ${keyName} (code: ${event.code}) ${event.shiftKey ? 'with Shift' : ''} ${event.ctrlKey ? 'with Ctrl' : ''}`);

        // Handle local hotkeys
        // if (event.code === 'KeyI') {
        //     this.toggleInstructions();
        //     return;
        // }
        // if (event.code === 'KeyN') {
        //     this.globalNavbar?.toggle();
        //     return;
        // }

        if (event.code === 'KeyT') {
            console.log('ThreeHostScene:: Triggering Tile Director Test Rig...');
            this.socket.emit('host:response', { type: 'test_tile_director' });
            return;
        }

        this.socket.emit('host:keypress', { key: event.code, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey });
        // this.flyQuestionOut(event.code);
    }

    private createGrid(): void {
        // Clear old cards if they exist
        this.cards.forEach(c => c.destroy());
        this.cards = [];

        for (let x = 0; x < this.GRID_SIZE; x++) {
            for (let y = 0; y < this.GRID_SIZE; y++) {
                const posX = (x - (this.GRID_SIZE - 1) / 2) * this.CARD_SIZE;
                const posY = (y - (this.GRID_SIZE - 1) / 2) * this.CARD_SIZE;
                const card: ThreeCard = new ThreeCard(this, posX, posY, 'card_back', x * this.GRID_SIZE + y);
                card.on('card-clicked', (pos: number) => {
                    console.log('Card clicked:', pos);
                    card.setSelection(5);
                });
                this.gridContainer.add(card);
                this.cards.push(card);
            }
        }


    }

    private createBattleUI(): void {
        // We need to allow enough space for two battle slots plus the battle map
        // battleSlots are 560 width = 480 max player name panel + 40 pixels on either side
        // battleSlots are 360 height = 200 for max player avatar + 3*42 for icons + 34 for top/bottom margin
        // UPDATE: adjusted upwards to allow space for the 'battle map' showing icons revealed and if new turn or not...
        // Note: The battle slot bounding boxes and highlights are now drawn internally by ThreePlayer

        const versusY:number = 20 + BATTLESLOT_HEIGHT / 2 + 0.5 * (BATTLESLOT_HEIGHT + 20);
        const versus = this.add.image(40 + BATTLESLOT_WIDTH / 2, versusY, 'versus').setOrigin(0.5, 0.5);
        versus.setScale(0.4);
        this.battleContainer.add(versus);

        // Battle Map Slot
        this.battleMap = new BattleMap(this, BATTLESLOT_WIDTH, 240);
        // Just anchor the battlemap to the bottom of the screen
        this.battleMap.setPosition(40, 1080 - 20 - 120);
        this.battleContainer.add(this.battleMap);

        // Experiment with scaling the battleUI to simplify the problem if fitting it all in
        this.battleContainer.setScale(this.getY(1080) / 1080);
    }

    // Animates the result of a Joker intervention
    private async doJokerEvaluate(data: any): Promise<void> {
        console.log('ThreeHostScene:: doJokerEvaluate:', data);

        // Bit of a hack but just push the gridContainer to the bottom so that everything sits on top
        this.mainContainer.sendToBack(this.gridContainer);

        const tl = gsap.timeline({
            onComplete: () => {
                // Resume server state machine
                this.socket.emit('host:response');
            }
        });
        this.stateTimeline = tl;

        // Small pause for effect
        tl.add(() => {}, "+=0.5");

        if (data.jokerType === 'steal') {
            const activePlayer = this.threePlayers.get(data.playerSID);
            const victimPlayer = this.threePlayers.get(data.fromSID);
            const targetCard = this.cards[data.pos];

            if (!activePlayer || !victimPlayer || !targetCard) {
                console.error("Missing entities for steal operation");
                return;
            }

            // 1. Slide the jokerOverlay to the right (x += 1280)
            // (Removed here because it is now handled generically in stateTeardown)

            // Prepare reparenting vars
            let originalParent: Phaser.GameObjects.Container;
            let originalLocalX: number;
            let originalLocalY: number;
            let originalScale: number;

            // 2. Bring the victim avatar onto the screen by re-parenting
            // Note this can be done before timeline even starts
            originalParent = victimPlayer.parentContainer as Phaser.GameObjects.Container;
            originalLocalX = victimPlayer.x;
            originalLocalY = victimPlayer.y;
            const playerGlobalScale = victimPlayer.getWorldTransformMatrix().scaleX;
            const mainGlobalScale = this.mainContainer.getWorldTransformMatrix().scaleX;

            console.log('JokerEvaluate - before tween: player scale:', playerGlobalScale, 'mainGlobalScale:', mainGlobalScale);

            // Move to main container so it floats above everything
            this.reparentObject(victimPlayer, this.mainContainer);
            victimPlayer.setScale(playerGlobalScale / mainGlobalScale);
            
            // 4. setIconGridVisibilty(true) for this victim
            victimPlayer.setIconGridVisibility(true);

            // 3. Tween their avatar to the location of data.pos (x,y adjusted slightly)
            tl.to(victimPlayer, {
                x: () => {
                    const worldPoint = targetCard.getWorldTransformMatrix();
                    const localPoint = this.mainContainer.getLocalPoint(worldPoint.tx, worldPoint.ty);
                    // Slightly shift left or right depending on tile column so we don't totally obscure it
                    const offsetX = targetCard.x < 0 ? 140 : -140 - 240; 
                    return localPoint.x + (offsetX * this.mainContainer.scaleX);
                },
                y: () => {
                    const worldPoint = targetCard.getWorldTransformMatrix();
                    const localPoint = this.mainContainer.getLocalPoint(worldPoint.tx, worldPoint.ty);
                    // Float below if upper half (targetCard.y < 0), otherwise hover slightly above
                    const offsetY = targetCard.y < 0 ? 160 : -160 - 100;
                    return localPoint.y + (offsetY * this.mainContainer.scaleY); 
                },
                scaleX: 1,
                scaleY: 1,
                duration: 0.8,
                ease: "back.out(1.2)"
            });

            // 5. Physical reveal of targeted tile (tiles are never pre-revealed so we always flip)
            tl.add(targetCard.flip(data.tileType, true, 0.5), "+=0.1");

            // Pop some text over the grid container
            const text = this.add.text(0, 0, 'FAILEED STEAL!', {
                fontFamily: 'Titan One', fontSize: '60px', color: '#aaaaaa', stroke: '#000000', strokeThickness: 8
            }).setOrigin(0.5).setAlpha(0).setScale(0);
            tl.add(() => {
                text.setPosition(targetCard.x, targetCard.y);
                this.gridContainer.add(text);
            });
            tl.to(text, { y: "-=120",scale: 1, alpha: 1, duration: 0.5, ease: 'back.out' }, "+=0.1");
            tl.to(text, { alpha: 0, duration: 0.5, ease: 'power2.in' }, "+=1.5");
            tl.add(() => text.destroy());

            // 6. Steal successful or not? Trigger lose/add collected icon on success
            if (data.result === 'steal') {
                text.setText('STEAL!');
                text.setColor('#ff0000');

                tl.add(() => {
                    victimPlayer.loseCollectedIcon(data.tileType, data.pos);
                    activePlayer.addCollectedIcon(data.tileType, data.pos, data.newTileCount);
                }, "+=0.3");
            }

            tl.add(() => {
                victimPlayer.setIconGridVisibility(false);                
                this.reparentObject(victimPlayer, originalParent);
                victimPlayer.setScale(mainGlobalScale / playerGlobalScale);
                console.log('JokerEvaluate - timeline victim just re-parented back to original parent');
            });

            // 7. Wait 1s second then tween the victim avatar back
            tl.to(victimPlayer, {
                x: originalLocalX,
                y: originalLocalY,
                scaleX: 1,
                scaleY: 1,
                duration: 1.8,
                ease: "power2.inOut"
            }, "+=0.5");

            // 8. ALWAYS flip back to face-down
            tl.add(targetCard.flip('', false, 0.5), "+=0.2");
        }
    }

    getPlayerBySessionID(sessionID: string): any {
        return this.threePlayers.get(sessionID);
    }

    sceneShutdown() {
        console.log('ThreeHostScene:: sceneShutdown...');
        // Remove any socket listeners or other cleanup tasks here
    }
}
