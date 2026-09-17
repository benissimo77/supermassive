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

    // Render the question for the player, positioning the answer container and showing the content.
    // this.question is positioned at (0,0)
    // this.answerContainer is positioned at (960, getY(540))
    // ALL question types accept this positioning and work with it
    // eg items placed directly inside this will assume an origin of (0,0)
    // items placed inside this.answerContainer will assume an origin logical (960,540)
    public renderPlayer(): void {
        this.answerContainer.x = 960;
        this.answerContainer.y = this.scene.getY(540);
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

    protected abstract createAnswerUI(): void | Promise<void>;
    protected abstract showAnswerContent(height: number): void;
    protected abstract makeInteractive(): void;
    protected abstract makeNonInteractive(): void;

    public destroy(fromScene?: boolean): void {
        console.log('PlayerBaseQuestion:: destroy:', this.questionData?.id);
        super.destroy(fromScene);
    }
}
