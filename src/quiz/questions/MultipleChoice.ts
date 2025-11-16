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

        const isPortrait = this.scene.isPortrait();
        const scaleFactor = this.scene.getUIScaleFactor();

        // Experiment with making padding a proportion of available space
        // And if we have a LOT of space then make the padding larger otherwise it spreads out too much vertically
        let paddingHeight: number = answerHeight / 8;
        if (answerHeight > 640) {
            paddingHeight = answerHeight / 6;
        }
        const availableHeight: number = answerHeight - 2 * paddingHeight;


        // This is still not that much simpler, but uses a better responsive layout
        // Especially for landscape/portrait on mobile
        const numRows = isPortrait ? this.questionData.options.length : Math.ceil(this.questionData.options.length / 2);
        const numColumns = isPortrait ? 1 : 2;
        const buttonSpace = availableHeight / numRows;

        console.log('MultipleChoiceQuestion::displayAnswerUI:', this.questionData.mode, this.scene.TYPE, availableHeight, buttonSpace);

        this.questionData.options.forEach((option: string, index: number) => {

            const rowCount: number = Math.floor(index / numColumns);
            const y = paddingHeight + rowCount * buttonSpace + buttonSpace / 2;
            const x = isPortrait ? 0 : -480 + 960 * (index % numColumns);

            console.log('MultipleChoiceQuestion::displayAnswerUI:', option, x, y);

            const newButton: NineSliceButton | undefined = this.buttons.get(option);
            if (newButton) {
                newButton.setButtonSize(800 * scaleFactor, 120 * scaleFactor);
                newButton.setPosition(x, this.scene.getY(y));
                newButton.setTextSize(48 * scaleFactor);
            }

        });

        // DEBUG - add rectangle to originof the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);

        console.log('MultipleChoiceQuestion::DONE');


    }

    protected revealAnswerUI(): void {

        if (this.questionData.answer) {
            this.highlightAnswer(this.questionData.answer);
        }
    }

    protected highlightAnswer(correctAnswer: string): void {

        for (const [option, button] of this.buttons) {
            button.setAlpha(0.5);
            if (option ===  correctAnswer) {
                button.setHighlight();
                this.answerContainer.add(button); // re-add to bring to front
            }
        }
    }

    protected makeInteractive(): void {

        this.buttons.forEach((button, option) => {

            // NOTE: for pixel-perfect timing of animation with audio we should build in a short delay to the audio track
            // to allow for the "back.in" easing which starts slowly
            // Maybe record a 'instant swoosh' and 'delayed swoosh' to align with a 0.5s back.in tween to y=2160
            // As it is I've done it with two separate delayed calls which allows more precision but its a bit much 
            button.setInteractive({ useHandCursor: true });
            button.on('pointerup', () => {
                this.makeNonInteractive();
                this.submitAnswer(option);
                this.highlightAnswer(option);
                const tl = gsap.timeline();
                tl.to(this.answerContainer, {
                    y: this.scene.getY(2160),
                    duration: 0.5,
                    ease: 'back.in'
                }, "+1.0");
                tl.add(() => {
                    this.scene.sound.play('submit-answer');
                }, "<+0.25");
                tl.play();
            });
        });

    }

    protected makeNonInteractive(): void {
        this.buttons.forEach((button) => {
            button.disableInteractive();
            button.removeAllListeners();
        });
    }


}