import { gsap } from "gsap";
import { BaseScene } from "src/moneytree/BaseScene";
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
        let paddingHeight: number = answerHeight / 8;
        if (answerHeight > 640) {
            paddingHeight = answerHeight / 6;
        }
        let availableHeight: number = answerHeight - 2 * paddingHeight;
        let buttonSpace: number = 2 * availableHeight / 2;
        let buttonHeight: number = buttonSpace * 0.8;

        // One more twist of logic - button height can look a bit too large so set a max height
        if (buttonHeight > 180) {
            buttonHeight = 180;
        }

        console.log('TrueFalseQuestion::displayAnswerUI:', this.scene.TYPE, availableHeight, buttonSpace, buttonHeight);

        // Create answer options
        ['true', 'false'].forEach((option: string, index: number) => {

            const rowCount: number = Math.floor(index / 2);
            const y = this.scene.getY(paddingHeight + rowCount * buttonSpace + buttonSpace / 2);
            const x = -480 + 960 * (index % 2);

            const newButton: NineSliceButton | undefined = this.buttons.get(option);
            if (newButton) {
                newButton.setPosition(x, y);
                console.log('MultipleChoiceQuestion::createAnswerUI:', option, x, y);
            }

        });
    }

    protected makeInteractive(): void {

        this.buttons.forEach((button, option) => {

            button.setInteractive({ useHandCuror: true });
            button.on('pointerup', () => {
                this.submitAnswer(option);
                this.makeNonInteractive();
                button.bringToTop(this.answerContainer);
                this.buttons.forEach(b => {
                    console.log('TrueFalseQuestion::makeButtonsInteractive:', b, b === button);
                    button.removeAllListeners();
                    if (b === button) {
                        gsap.to(b, {
                            y: -2000,
                            duration: 0.5,
                            ease: 'power2.in',
                            delay: 0.8
                        })
                    } else {
                        gsap.to(b, {
                            x: -2000,
                            duration: 1,
                            ease: 'power2.out'
                        });
                    }
                });
            });
        });
    }

    protected makeNonInteractive(): void {
        this.buttons.forEach((button) => {
            button.disableInteractive();
        });
    }

}