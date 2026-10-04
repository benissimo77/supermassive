import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { TrueFalseQuestionData } from "./QuestionTypes";

export default class PlayerTrueFalseQuestion extends PlayerBaseQuestion {

    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();

    // Layout sizing tuning constants (see showAnswerContent), expressed directly against the
    // logical canvas (1920 wide, scene.getY(1080) tall).
    // A single fixed width - matching Ordering.ts/Ordering's own 800x120 buttons - rather than a
    // fraction of the available width. 800 happens to sit comfortably both as a single centered
    // button in portrait's full 1920-wide canvas and centered within either 960-wide column in
    // landscape, so there's no need to compute a different width per orientation.
    private readonly ITEM_WIDTH = 800;
    private readonly ITEM_HEIGHT = 120;        // button height = width * this

    constructor(scene: BaseScene, questionData: TrueFalseQuestionData) {
        super(scene, questionData);
    }

    // The player side only ever asks - the host reveals the correct answer, so there's no need
    // to check questionData.mode here.
    protected createAnswerUI(): void {

        console.log('PlayerTrueFalseQuestion::createAnswerUI:', this.questionData);

        ['true', 'false'].forEach((option: string) => {

            const newButton: NineSliceButton = new NineSliceButton(this.scene, option.toUpperCase());
            this.buttons.set(option, newButton);
            this.answerContainer.add(newButton);
            this.makeInteractive();

        });
    }

    protected showAnswerContent(answerHeight: number): void {

        const isPortrait = this.scene.isPortrait();

        // No touch-target clamp here - ITEM_WIDTH is a fixed, deliberately-chosen size (see its
        // comment), and a floor/ceiling derived from a physical CSS-px range could force the
        // button wider than its available column on a narrow landscape window, causing the two
        // columns to overlap instead of actually solving a real tap-target problem.
        const buttonWidth = isPortrait ? this.ITEM_WIDTH * 2 : this.ITEM_WIDTH;
        const buttonHeight = isPortrait ? this.ITEM_HEIGHT * 2 : this.ITEM_HEIGHT;

        console.log('PlayerTrueFalseQuestion::showAnswerContent:', isPortrait, buttonWidth, buttonHeight);

        // Portrait: same approach as PlayerMultipleChoiceQuestion - divide the full available
        // height evenly across the 2 rows, and let the gap between them fall out as whatever's
        // left over (fitHeight - buttonHeight), rather than an independently-tuned gap ratio.
        // This anchors the two buttons symmetrically at 1/4 and 3/4 of the available height.
        const numRows = 2;
        const fitHeight = answerHeight / numRows;
        const totalHeight = answerHeight - (fitHeight - buttonHeight);
        const top = -totalHeight / 2;

        ['true', 'false'].forEach((option: string, index: number) => {

            const newButton: NineSliceButton | undefined = this.buttons.get(option);
            if (!newButton) return;

            newButton.setButtonSize(buttonWidth, buttonHeight);
            newButton.adjustTextSize(buttonHeight);

            if (isPortrait) {
                const y = this.scene.getY(top + index * fitHeight + buttonHeight / 2);
                newButton.setPosition(0, y);
            } else {
                // Each button is centered in its own half-screen-width slot, not spaced by an
                // independent gutter - see ITEM_WIDTH's comment.
                const x = (index === 0 ? -1 : 1) * 480;
                newButton.setPosition(x, 0);
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

    protected highlightAnswer(correctAnswer: string): void {
        for (const [option, button] of this.buttons) {
            button.setAlpha(0.5);
            if (option === correctAnswer) {
                button.setAlpha(1);
                button.setHighlight();
            }
        }
    }

}
