import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { MultipleChoiceQuestionData } from "./QuestionTypes";

export default class MultipleChoiceQuestion extends BaseQuestion {

    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    protected questionData: MultipleChoiceQuestionData;

    constructor(scene: BaseScene, questionData: MultipleChoiceQuestionData) {
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

        console.log('MultipleChoiceQuestion::createAnswerUI:', this.questionData);
        this.questionData.options.forEach((option: string, index: number) => {
            const newButton: NineSliceButton = new NineSliceButton(this.scene, option);

            this.buttons.set(option, newButton);
            this.answerContainer.add(newButton);

        });

        // Make interactive if we are in ask mode and player screen
        if (this.questionData.mode == 'ask' && this.scene.TYPE != 'host') {
            this.makeInteractive();
        }

        // DEBUG - add rectangle to originof the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);
    }

    protected displayAnswerUI(answerHeight: number): void {

        // Experiment with making padding a proportion of available space
        // And if we have a LOT of space then make the padding larger otherwise it spreads out too much vertically
        // All of the layout assumes a logical button width of 800

        let paddingHeight: number = answerHeight / 8;
        if (answerHeight > 640) {
            paddingHeight = answerHeight / 6;
        }
        let availableHeight: number = answerHeight - 2 * paddingHeight;
        let buttonSpace: number = 2 * availableHeight / this.questionData.options.length;
        let buttonHeight: number = buttonSpace * 0.8;

        // One more twist of logic - button height can look a bit too large so set a max height
        if (buttonHeight > 180) {
            buttonHeight = 180;
        }

        console.log('MultipleChoiceQuestion::displayAnswerUI:', this.questionData.mode, this.scene.TYPE, availableHeight, buttonSpace, buttonHeight);

        // Now layout the buttons using the above calculated values
        const now: number = Date.now();
        this.questionData.options.forEach((option: string, index: number) => {

            const rowCount: number = Math.floor(index / 2);
            const y = this.scene.getY(paddingHeight + rowCount * buttonSpace + buttonSpace / 2);
            const x = -480 + 960 * (index % 2);

            console.log('MultipleChoiceQuestion::createAnswerUI:', option, x, y);

            const newButton: NineSliceButton | undefined = this.buttons.get(option);
            if (newButton) {
                newButton.setButtonSize(800, buttonHeight);
                newButton.setPosition(x, y);

                if (this.scene.TYPE === 'play') {
                    this.scene.socket?.emit('consolelog', `MultipleChoiceQuestion::displayAnswerUI: index=${index} option=${option} x=${x} y=${y} buttonHeight=${buttonHeight} time=${Date.now() - now}ms`);
                }

                // Leave this here for now... can't think where else to put it
                if (this.questionData.mode === 'answer') {
                    if (option === this.questionData.answer) {
                        newButton.onPointerOver();
                    }
                }
            }

        });

        // DEBUG - add rectangle to originof the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);
    }

    protected makeInteractive(): void {

        this.buttons.forEach((button, option) => {

            button.setInteractive({ useHandCursor: true });
            button.on('pointerup', () => {
                this.makeNonInteractive();
                this.submitAnswer(option);
                button.bringToTop(this.answerContainer);
                this.buttons.forEach(b => {
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