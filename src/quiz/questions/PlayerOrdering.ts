import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { OrderMatchQuestionData } from "./QuestionTypes";

export default class PlayerOrderingQuestion extends PlayerBaseQuestion {
    
    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    private dropzones: Map<number, Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image> = new Map();
    private dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map<number, Phaser.GameObjects.Text>();

    // Toggle to compare the dotted-line dropzone graphic as a 9-slice (tiled, current) vs a plain
    // uniformly-scaled image (no tiling artifacts on the dashes, but stretches the dash pattern
    // itself if a dropzone ends up far from square) - remove this + the false branch once decided.
    private readonly USE_NINESLICE_DROPZONE = false;
    private submitButton: NineSliceButton;
    private items: string[] = [];
    private labels: string[] = [];

    // Same fixed-size approach as PlayerTrueFalse/PlayerMultipleChoice (and, for the column
    // centering, the same as Ordering.ts's host layout, which hardcodes the same ±480 column
    // centers): a single fixed item width and height - matching Ordering.ts's own 800x120 buttons
    // exactly - sits comfortably both as a single column in portrait's full 1920-wide canvas and
    // centered within either 960-wide column in landscape. No row-count-driven shrinking: with
    // items up to ~6 per column, that would only ever bind on a screen shaped roughly 2.67:1
    // landscape or more extreme (needs screenWidth > ~2.67 * screenHeight) - not a realistic play
    // scenario, same reasoning as PlayerMultipleChoiceQuestion's dropped height guard.

    // item height = fixed 800x120px - matches Host's 800x120 items and looks good in general
    private readonly ITEM_WIDTH = 800;
    private readonly ITEM_HEIGHT = 120;

    // Submit button does not scale with screen size, is a physical size
    private readonly SUBMIT_WIDTH_PX = 120;
    private readonly SUBMIT_HEIGHT_PX = 32;
    private readonly SUBMIT_MARGIN_PX = 12;

    constructor(scene: BaseScene, questionData: OrderMatchQuestionData) {
        super(scene, questionData);
    }

    protected createAnswerUI(): void {
        console.log('PlayerOrderingQuestion::createAnswerUI:', this.questionData);

        const questionData = this.questionData as OrderMatchQuestionData;

        // Extract items and labels based on question type
        if (questionData.type === 'ordering') {
            this.items = questionData.itemsShuffled || [];
            this.labels = (questionData.itemsShuffled || []).map(() => ''); // Empty labels for middle dropzones

            // For ordering questions, label first/last dropzones
            if (questionData.extra) {
                this.labels[0] = questionData.extra.startLabel || '';
                this.labels[this.labels.length - 1] = questionData.extra.endLabel || '';
            }
        } else {
            // Matching question - prefer leftItems/rightItems model
            const q: any = questionData;
            let leftItems = q.leftItemsShuffled || q.leftItems;
            let rightItems = q.rightItems;
            if ((!Array.isArray(leftItems) || !Array.isArray(rightItems))) {
                const pairs = q.pairsShuffled || q.pairs || [];
                leftItems = pairs.map((p: any, i: number) => ({ text: p.left, image: (q.itemImages && q.itemImages[i]) || undefined }));
                rightItems = pairs.map((p: any) => ({ text: p.right }));
            }

            this.items = (leftItems || []).map((li: any) => (li && li.text) ? li.text : '');
            this.labels = (rightItems || []).map((ri: any) => (ri && ri.text) ? ri.text : '');
        }

        // Create buttons
        this.items.forEach((item: string, index: number) => {
            const button = new NineSliceButton(this.scene, item);
            button.setData('index', index);
            button.setData('item', item);
            button.setData('dropzone', null);
            this.buttons.set(item, button);
            this.answerContainer.add(button);
        });

        // Create dropzones
        this.labels.forEach((label: string, index: number) => {
            const dropzone: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image = this.USE_NINESLICE_DROPZONE
                ? this.scene.add.nineslice(0, 0, 'dropzone', undefined, 800, 120, 12, 12, 12, 12).setOrigin(0.5)
                : this.scene.add.image(0, 0, 'dropzone').setOrigin(0.5);
            dropzone.setTint(0x8080C0);

            dropzone.setData('dropped', '');
            dropzone.setData('index', index);
            this.dropzones.set(index, dropzone);
            this.answerContainer.add(dropzone);

            // Create label text
            const labelText = this.scene.add.text(0, 0, label, this.scene.labelConfig)
                .setOrigin(0.5);
            this.dropzoneLabels.set(index, labelText);
            this.answerContainer.add(labelText);
        });

        // Create submit button
        this.submitButton = new NineSliceButton(this.scene, 'Submit');
        this.add(this.submitButton);
        this.submitButton.setVisible(false);

        if (this.questionData.mode === 'ask') {
            this.makeInteractive();
        }
    }

    protected showAnswerContent(answerHeight: number): void {

        const isPortrait = this.scene.isPortrait();
        const physicalScale = this.scene.getPhysicalScale();
        const N = this.items.length;

        // --- Submit button: fixed physical size, pinned to the bottom-right corner - persistent
        // chrome, not part of the scaled content block below (same pattern as PlayerTrueFalse/
        // PlayerMultipleChoice's touch-target sizing).
        const submitW = this.SUBMIT_WIDTH_PX * physicalScale;
        const submitH = this.SUBMIT_HEIGHT_PX * physicalScale;
        this.submitButton.setButtonSize(submitW, submitH);
        this.submitButton.adjustTextSize(submitH);
        this.submitButton.setPosition(
            1920 - (this.SUBMIT_WIDTH_PX / 2 + this.SUBMIT_MARGIN_PX) * physicalScale,
            this.scene.getY(answerHeight) - (this.SUBMIT_HEIGHT_PX / 2 + this.SUBMIT_MARGIN_PX) * physicalScale
        );

        // --- Items + dropzones: fixed size (see ITEM_WIDTH's comment), no touch-target clamp or
        // row-count-driven shrinking - matches PlayerTrueFalse/PlayerMultipleChoice. Row spacing
        // divides the full available height evenly across however many rows are needed, and the
        // gap between rows falls out as whatever's left over (fitHeight - itemHeight), rather
        // than an independently-tuned gap ratio - same approach as PlayerMultipleChoiceQuestion.
        const itemWidth = this.ITEM_WIDTH;
        const itemHeight = this.ITEM_HEIGHT;

        const rows = isPortrait ? N * 2 : N;
        const fitHeight = answerHeight / rows;
        const totalHeight = answerHeight - (fitHeight - itemHeight);
        const top = -totalHeight / 2;
        // const dropzoneLabelFontSize = itemHeight * this.DROPZONE_LABEL_FONT_RATIO;

        // rowY: the button group occupies rows [0, N), the dropzone group occupies rows [N, 2N)
        // in portrait (landscape keeps them in separate side-by-side columns at the same rows) -
        // the group boundary gets the same implicit gap as any other row, rather than a second,
        // independently-tuned gap.
        const rowY = (rowIndex: number): number => this.scene.getY(top + rowIndex * fitHeight + itemHeight / 2);

        // Pass 1: size and position every item button, noting each one's own best-fit font size.
        let uniformFontSize = Infinity;
        this.buttons.forEach((button, item) => {
            const index = button.getData('index');
            const x = isPortrait ? 0 : -480; // centered in the left half-screen-width column, matching Ordering.ts's hardcoded x = -480
            const y = rowY(index);

            button.setButtonSize(itemWidth, itemHeight);
            button.setPosition(x, y);
            uniformFontSize = Math.min(uniformFontSize, button.adjustTextSize(itemHeight));
            button.setData('OriginX', x);
            button.setData('OriginY', y);
            button.setData('dropzone', null);
        });

        // Pass 2: re-apply the smallest fitted size to every item button - see
        // PlayerMultipleChoiceQuestion for why (adjustTextSize fits per-button from its own text).
        this.buttons.forEach((button) => button.setTextSize(uniformFontSize));

        this.dropzones.forEach((dropzone, index) => {
            const rowIndex = isPortrait ? N + index : index;
            const x = isPortrait ? 0 : 480; // centered in the right half-screen-width column, matching Ordering.ts's hardcoded x = 480
            const y = rowY(rowIndex);

            // NineSlice.setSize() resizes the slice; a plain Image needs setDisplaySize() instead
            // since setSize() only touches its size metadata, not what's actually drawn.
            if (dropzone instanceof Phaser.GameObjects.NineSlice) {
                dropzone.setSize(itemWidth, itemHeight);
            } else {
                dropzone.setDisplaySize(itemWidth, itemHeight);
            }
            dropzone.setPosition(x, y);

            // Set the label text size to the same size as the buttons for a uniform appearance
            const label = this.dropzoneLabels.get(index);
            if (label) {
                label.setPosition(x, y);
                label.setFontSize(uniformFontSize);
            }

            dropzone.setData('dropped', '');
            dropzone.setTint(0x8080C0);
        });

        this.submitButton.setVisible(false);
    }

    protected makeInteractive(): void {
        this.addSceneInputHandlers();

        this.buttons.forEach((button) => {
            button.setInteractive({ useHandCursor: true, draggable: true });
        });

        this.dropzones.forEach((dropzone) => {
            dropzone.setInteractive({ dropZone: true });
        });

        this.submitButton.on('pointerup', () => { this.handleSubmit(); });
        this.submitButton.setInteractive({ useHandCursor: true });
    }

    protected makeNonInteractive(): void {
        this.removeSceneInputHandlers();

        this.buttons.forEach((button) => {
            button.disableInteractive();
        });

        this.dropzones.forEach((dropzone) => {
            dropzone.disableInteractive();
        });

        this.submitButton.disableInteractive();
        this.submitButton.removeAllListeners();
    }

    private handleSubmit(): void {
        this.makeNonInteractive();

        const answers: string[] = [];
        this.dropzones.forEach((dropzone) => {
            const droppedItem = dropzone.getData('dropped');
            if (droppedItem) {
                answers.push(droppedItem);
            } else {
                answers.push('');
            }
        });

        this.submitAnswer(answers);

        // Animate out
        const tl = gsap.timeline();
		tl.to(this.answerContainer, {
			y: this.scene.getY(2160),
			duration: 0.5,
			ease: 'back.in'
		});
		tl.add(() => {
			this.scene.soundManager.playFX('submit-answer');
		}, "<+0.25");
		tl.play();
    }

    private checkDropzonesFull(): boolean {
        let full = true;
        this.dropzones.forEach((dropzone) => {
            if (!dropzone.getData('dropped')) {
                full = false;
            }
        });
        return full;
    }

    private addSceneInputHandlers(): void {
        this.scene.input.on('dragstart', this.handleDragStart, this);
        this.scene.input.on('dragend', this.handleDragEnd, this);
        this.scene.input.on('drag', this.handleDrag, this);
        this.scene.input.on('dragenter', this.handleDragEnter, this);
        this.scene.input.on('dragleave', this.handleDragLeave, this);
        this.scene.input.on('drop', this.handleDrop, this);
    }

    private removeSceneInputHandlers(): void {
        this.scene.input.off('dragstart', this.handleDragStart, this);
        this.scene.input.off('drag', this.handleDrag, this);
        this.scene.input.off('dragend', this.handleDragEnd, this);
        this.scene.input.off('dragenter', this.handleDragEnter, this);
        this.scene.input.off('dragleave', this.handleDragLeave, this);
        this.scene.input.off('drop', this.handleDrop, this);
    }

    private handleDragStart(pointer: Phaser.Input.Pointer, gameObject: any): void {
        this.answerContainer.bringToTop(gameObject);

        if (gameObject.getData('dropzone') !== null) {
            const dropzoneIndex = gameObject.getData('dropzone');
            const dropzone = this.dropzones.get(dropzoneIndex);
            if (dropzone) {
                dropzone.setData('dropped', '');
                dropzone.setTint(0x8080C0);
                gameObject.setData('dropzone', null);
            }
        }
    }

    private handleDragEnd(pointer: Phaser.Input.Pointer, gameObject: any): void {
        if (gameObject.getData('dropzone') === null) {
            this.scene.tweens.add({
                targets: gameObject,
                x: gameObject.getData('OriginX'),
                y: gameObject.getData('OriginY'),
                duration: 300,
                ease: 'Power2',
            });
        }

        this.submitButton.setVisible(this.checkDropzonesFull());
        this.bringToTop(this.submitButton);
    }

    private handleDrag(pointer: Phaser.Input.Pointer, gameObject: any, dragX: number, dragY: number): void {
        dragX = Phaser.Math.Snap.To(dragX, 1);
        dragY = Phaser.Math.Snap.To(dragY, 1);
        gameObject.setPosition(dragX, dragY);
    }

    private handleDragEnter(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        if (!dropzone.getData('dropped')) {
            dropzone.setTint(0x00ff00); 
        }
    }

    private handleDragLeave(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        dropzone.setTint(0x8080C0);
    }

    private handleDrop(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        if (!dropzone.getData('dropped')) {
            dropzone.setData('dropped', gameObject.getData('item'));
            gameObject.setData('dropzone', dropzone.getData('index'));

            this.scene.tweens.add({
                targets: gameObject,
                x: dropzone.x,
                y: dropzone.y,
                duration: 300,
                ease: 'Power2',
            });
        }
    }

    public destroy(fromScene?: boolean): void {
        if (this.scene) {
            this.removeSceneInputHandlers();
        }
        super.destroy(fromScene);
    }

    // Provide a simple reveal timeline for PlayerOrdering (player screen doesn't self-reveal)
    public createRevealAnswerTimeline(): gsap.core.Timeline {
        return gsap.timeline();
    }
}
