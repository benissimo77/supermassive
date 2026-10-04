import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { MultipleChoiceQuestionData } from "./QuestionTypes";

export default class PlayerMultipleChoiceQuestion extends PlayerBaseQuestion {

    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    protected questionData: MultipleChoiceQuestionData;

    // Layout sizing tuning constants (see showAnswerContent), expressed directly against the
    // logical canvas (1920 wide, scene.getY(1080) tall) - same approach and reasoning as
    // PlayerTrueFalseQuestion, generalized for a variable option count (up to ~8).
    // A single fixed width, matching Ordering.ts's own 800x120 buttons, rather than a fraction of
    // the available width
    private readonly ITEM_WIDTH = 800;
    private readonly ITEM_HEIGHT = 120;        // fixed button height, matching Host's own 800x120 buttons

    constructor(scene: BaseScene, questionData: MultipleChoiceQuestionData) {
        super(scene, questionData);

    }

    /**
     * The questionData holds everything we need including a 'mode' (ask/answer)
     * If mode = 'ask' then we show the options and make them interactive
     */
    protected createAnswerUI(): void {

        console.log('PlayerMultipleChoiceQuestion::createAnswerUI:', this.questionData);
        this.questionData.optionsShuffled.forEach((option: string) => {
            const newButton: NineSliceButton = new NineSliceButton(this.scene, option);

            this.buttons.set(option, newButton);
            this.answerContainer.add(newButton);
        });

        if (this.questionData.mode == 'ask') {
            this.makeInteractive();
        }
    }

    protected showAnswerContent(answerHeight: number): void {

        const isPortrait = this.scene.isPortrait();

        const options = this.questionData.optionsShuffled;
        const numColumns = isPortrait ? 1 : 2;
        const numRows = Math.ceil(options.length / numColumns);

        // Width is a fixed size (see ITEM_WIDTH) - no touch-target clamp here, since a floor/
        // ceiling derived from a physical CSS-px range could force the button wider than its
        // available column on a narrow landscape window, causing the columns to overlap instead
        // of actually solving a real tap-target problem.
        const buttonWidth = isPortrait ? this.ITEM_WIDTH * 2: this.ITEM_WIDTH;

        // Height: the smaller of the aspect-ratio-ideal height (matches PlayerTrueFalseQuestion's
        // feel when there's plenty of room) and whatever height lets numRows rows + gaps fit the
        // vertical budget (kicks in once there are enough options that the ideal height would
        // overflow).
        const idealHeight = isPortrait ? this.ITEM_HEIGHT * 2 : this.ITEM_HEIGHT;
        const verticalBudget = answerHeight;
        const fitHeight = verticalBudget / numRows;
        const buttonHeight = idealHeight;

        console.log('PlayerMultipleChoiceQuestion::showAnswerContent:', this.questionData.mode, isPortrait, options.length, numColumns, numRows, buttonWidth, buttonHeight);

        // totalHeight is the distance from top of top button to bottom of bottom button
        // It is basically answerHeight minus the top and bottom margins
        const totalHeight = verticalBudget - (fitHeight - buttonHeight);
        const top = -totalHeight / 2;

        // Pass 1: size and position every button, noting each one's own best-fit font size.
        let uniformFontSize = Infinity;
        options.forEach((option: string, index: number) => {

            const newButton: NineSliceButton | undefined = this.buttons.get(option);
            if (!newButton) return;

            newButton.setButtonSize(buttonWidth, buttonHeight);
            uniformFontSize = Math.min(uniformFontSize, newButton.adjustTextSize(buttonHeight));

            const col = index % numColumns;
            const row = Math.floor(index / numColumns);
            const y = this.scene.getY( top + row * fitHeight + buttonHeight / 2 );
            // Each column is centered in its own half-screen-width slot, not spaced by an
            // independent gutter - see ITEM_WIDTH's comment.
            const x = isPortrait ? 0 : (col === 0 ? -1 : 1) * 480;

            newButton.setPosition(x, y);
        });

        // Pass 2: re-apply the smallest fitted size to every button, so a short option (e.g.
        // "Yes") doesn't render visibly larger than a longer sibling - adjustTextSize fits each
        // button from its own text length, which looks inconsistent across a set of buttons that
        // should read as one uniform family.
        this.buttons.forEach((button) => button.setTextSize(uniformFontSize));
    }

    protected highlightAnswer(correctAnswer: string): void {

        for (const [option, button] of this.buttons) {
            button.setAlpha(0.5);
            if (option === correctAnswer) {
                button.setHighlight();
                this.answerContainer.bringToTop(button);
            }
        }
    }

    protected makeInteractive(): void {

        this.buttons.forEach((button, option) => {

            button.setInteractive({ useHandCursor: true });
            button.on('pointerup', () => {
                this.makeNonInteractive();
                this.submitAnswer(option);
                this.highlightAnswer(option);
                // 1s pause so the player can see their highlighted pick before it slides away
                this.playSubmitAnimation(1.0);
            });
        });
    }

    protected makeNonInteractive(): void {
        this.buttons.forEach((button) => {
            button.disableInteractive();
            button.removeAllListeners();
        });
    }

    public createRevealAnswerTimeline(): gsap.core.Timeline {
        // Only the host reveals the answer via createRevealAnswerTimeline() - never called on the player
        // side in practice, but PlayerBaseQuestion requires an implementation of the abstract contract.
        return gsap.timeline();
    }
}
