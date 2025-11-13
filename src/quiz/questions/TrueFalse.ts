import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { TrueFalseQuestionData } from "./QuestionTypes";

export default class TrueFalseQuestion extends BaseQuestion {

    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();

    constructor(scene: BaseScene, questionData: TrueFalseQuestionData) {
        super(scene, questionData);
    }

    protected getAnswerUIWidth(): number {
        return 600;
    }


    /**
     * Create the specific content for multiple choice questions
     * The questionData holds everything we need including a 'mode' (ask/answer)
     * If mode = 'answer' then we show the correct answer (non-interactive)
     * If mode = 'ask' then we show the options
     * If mode = 'ask' AND we are player screen then make interactive and collect player input
     */
    protected createAnswerUI(): void {

        console.log('TrueFalseQuestion::createAnswerUI:', this.scene.TYPE, this.questionData);

        // Create answer options
        ['true', 'false'].forEach((option: string, index: number) => {

            const newButton: NineSliceButton = new NineSliceButton(this.scene, option.toUpperCase());
            this.buttons.set(option, newButton);
            this.answerContainer.add(newButton);

            // Make interactive if we are in ask mode and player screen
            if (this.questionData.mode == 'ask' && this.scene.TYPE != 'host') {
                this.makeInteractive();
            }

            // If we are in answer mode then we show the correct answer
            if (this.questionData.mode == 'answer') {
                // Instead of converting option to boolean, compare strings directly
                if (option === this.questionData.answer) {
                    newButton.onPointerOver();
                }
            }
        });
    }

    protected displayAnswerUI(answerHeight: number): void {

        // This code copied directly from MultipleChoiceQuestion - should work for now
        const isPortrait = this.scene.isPortrait();
        const scaleFactor = this.scene.getUIScaleFactor();

        let paddingHeight: number = answerHeight / 8;
        if (answerHeight > 640) {
            paddingHeight = answerHeight / 6;
        }
        const availableHeight: number = answerHeight - 2 * paddingHeight;
        const numRows = isPortrait ? 2 : 1;
        const numColumns = isPortrait ? 1 : 2;
        const buttonSpace = availableHeight / numRows;

        console.log('TrueFalseQuestion::displayAnswerUI:', this.scene.TYPE, availableHeight, buttonSpace);

        // Create answer options
        ['true', 'false'].forEach((option: string, index: number) => {

            const rowCount: number = Math.floor(index / numColumns);
            const y = paddingHeight + rowCount * buttonSpace + buttonSpace / 2;
            const x = isPortrait ? 0 : -480 + 960 * (index % numColumns);

            const newButton: NineSliceButton | undefined = this.buttons.get(option);
            if (newButton) {
                newButton.setButtonSize(800 * scaleFactor, 120 * scaleFactor);
                newButton.setPosition(x, this.scene.getY(y));
                newButton.setTextSize(48 * scaleFactor);
            }

        });
    }

    protected makeInteractive(): void {

        this.buttons.forEach((button, option) => {

            button.setInteractive({ useHandCursor: true });
            button.on('pointerup', () => {
                this.makeNonInteractive();
                this.submitAnswer(option);
                this.highlightAnswer(option);
                this.scene.time.delayedCall(1000, () => {
                    this.scene.sound.play('submit-answer');
                    gsap.to(this.answerContainer, {
                        y: this.scene.getY(1080 + 540),
                        ease: 'back.in'
                    });
                });
            });
        });
    }

    protected makeNonInteractive(): void {
        this.buttons.forEach((button) => {
            button.disableInteractive();
            button.removeAllListeners();

        });
    }

    protected revealAnswerUI(): void {

        if (this.questionData.answer) {
            this.highlightAnswer(this.questionData.answer);
        }
    }

    protected highlightAnswer(correctAnswer: string): void {

        for (const [option, button] of this.buttons) {
            button.setAlpha(0.5);
            if (option === correctAnswer) {
                button.setHighlight();
            }
        }
    }

}
