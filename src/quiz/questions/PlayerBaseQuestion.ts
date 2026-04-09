import { BaseScene } from "src/BaseScene";
import { BaseQuestionData } from "./QuestionTypes";

export abstract class PlayerBaseQuestion extends Phaser.GameObjects.Container {
    public scene: BaseScene;
    protected questionData: BaseQuestionData;
    private answerCallback: Function;
    protected answerContainer: Phaser.GameObjects.Container;

    constructor(scene: BaseScene, questionData: BaseQuestionData) {
        super(scene, 0, 0);
        this.questionData = questionData;
        this.scene = scene;

        this.answerContainer = this.scene.add.container(0, 0);
        this.add(this.answerContainer);
    }

    public async initialize(): Promise<void> {
        console.log('PlayerBaseQuestion::initialize: questionData:', this.questionData);
        await this.createAnswerUI();
    }

    public renderPlayer(): void {
        this.answerContainer.x = 960;
        this.answerContainer.y = 0;
        this.showAnswerContent(1080);
    }

    public onAnswer(callback: Function): void {
        this.answerCallback = callback;
    }

    protected submitAnswer(answer: any): void {
        if (this.answerCallback) {
            this.answerCallback(answer);
        }
    }

    protected createSimpleButton(text: string): Phaser.GameObjects.Container {
        const buttonConfig = {
            fontSize: 36,
            fontFamily: '"Titan One", Arial',
            color: '#ffffff'
        }
        const button = this.scene.add.container(0, 0);
        const buttonBg = this.scene.add.rectangle(0, 0, 200, 60, 0x0066cc, 0.7).setOrigin(0.5);
        const buttonText = this.scene.add.text(16, 0, text, buttonConfig).setOrigin(0.5);
        button.add([buttonBg, buttonText]);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerover', () => buttonBg.setFillStyle(0x00ff00));
        button.on('pointerout', () => buttonBg.setFillStyle(0x0066cc));
        this.add(button);
        return button;
    }

    protected abstract createAnswerUI(): void | Promise<void>;
    protected abstract showAnswerContent(height: number): void;
    protected abstract makeInteractive(): void;
    protected abstract makeNonInteractive(): void;
    
    // Stub these out to avoid ts errors if someone casts it to BaseQuestion or tries to use host methods
    public renderHost(): void {}
    public prepareAnswerResults(): any { return null; }
    
    public destroy(fromScene?: boolean): void {
        console.log('PlayerBaseQuestion:: destroy:', this.questionData?.id);
        super.destroy(fromScene);
    }
}
