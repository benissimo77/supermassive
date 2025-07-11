import { BaseScene } from "src/BaseScene";
import { SocketDebugger } from "src/SocketDebugger";

import { QuestionFactory } from "./questions/QuestionFactory";
import { BaseQuestion } from "./questions/BaseQuestion";

import { PlayerConfig } from "src/DOMPlayer";


export class QuizPlayScene extends BaseScene {

    static readonly KEY = 'QuizPlayScene';

    private socketDebugger: SocketDebugger;

    private currentQuestion: BaseQuestion;
    private questionFactory: QuestionFactory;

    // UI elements
    private UIContainer: Phaser.GameObjects.Container;

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
            fontSize: this.getY(36),
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
        }


        // Setup socket listeners
        this.setupSocketListeners();

        // Since this is likely to be a mobile device lock the screen to landscape
        this.scale.lockOrientation('landscape');
    }

    preload(): void {

        // Load common assets for all question types
        this.load.image('quiz-background', 'img/quiz/background.jpg');
        this.load.image('simple-button', 'assets/img/simplebutton.png');
        this.load.image('simple-button-hover', 'assets/img/simplebutton-hover.png');
        this.load.image('dropzone', 'assets/img/dropzone.png');
        // this.load.image('answer-button', 'assets/quiz-button.png');
        // this.load.image('player-marker', 'assets/player-marker.png');

        this.load.image('crosshair', 'img/crosshair40.png');


        // Load custom fonts
        this.load.rexWebFont({
            google: {
                families: ['Titan One']
            }
        });

    }

    create(): void {


        // Let the server know we're ready - this could come from a button click or other event
        this.socket.emit('play:requeststart', {});
    }


    private setupSocketListeners(): void {

        // Player connect/disconnect - these are caught by BaseScene but quiz can also take action
        this.socket.on('playerconnect', (playerConfig: PlayerConfig) => {
            console.log('QuizPlayScene:: playerconnect:', playerConfig.name, playerConfig.avatar);
            // this.animatePlayer(thisPlayer);
        });


        // Listen for intro quiz message
        this.socket.on('server:introquiz', (data) => {
            this.showQuizIntro(data.title, data.description);
        });

        // Listen for intro round message
        this.socket.on('server:introround', (data) => {
            this.showRoundIntro(data.roundnumber, data.title, data.description);
        });

        // Listen for question
        this.socket.on('server:question', (question) => {
            this.displayQuestion(question);
        });

        // Player answered a question
        this.socket.on('server:questionanswered', (data) => {
            // this.updatePlayerAnswer(data.sessionID, data.response);
        });

        // Show answer
        this.socket.on('server:showanswer', (data) => {
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


    private showQuizIntro(title: string, description: string): void {

        // Clear previous UI
        this.clearUI();
        this.UIContainer = this.add.container(0, 0);

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


        this.UIContainer.add([titleText, descText]);


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
        this.UIContainer = this.add.container(0, 0);

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

    private displayQuestion(question: any): void {

        console.log('QuizPlayScene:: displayQuestion:', question);

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

            // Make sure it's added to the scene
            this.add.existing(this.currentQuestion);

            this.currentQuestion.onAnswer((answer: any) => {
                console.log('QuizPlayScene:: answer:', answer);
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
        this.UIContainer = this.add.container(0, 0);

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
        this.UIContainer = this.add.container(0, 0);

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

    private clearUI(): void {
        // Clean up the previous question's display elements
        if (this.UIContainer) {
            this.UIContainer.destroy();
        }
        if (this.currentQuestion) {
            this.currentQuestion.destroy();
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
