import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { OrderMatchQuestionData } from "./QuestionTypes";
import { SimpleButton } from "src/ui/SimpleButton";

/**
 * OrderingQuestion - Handles both 'ordering' and 'matching' question types for the Host Screen
 */
export default class OrderingQuestion extends BaseQuestion {

    protected buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    protected dropzones: Map<number, SimpleButton> = new Map<number, SimpleButton>();
    protected dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map<number, Phaser.GameObjects.Text>();
    protected items: string[] = [];
    protected labels: string[] = [];

    constructor(scene: BaseScene, questionData: OrderMatchQuestionData) {
        super(scene, questionData);
    }

    protected getAnswerUIWidth(): number {
        return 600;
    }

    /**
     * Create the specific content for ordering/matching questions
     * Creates all objects (buttons, dropzones, labels) but does NOT position them
     * Positioning happens in showAnswerContent()
     */
    protected createAnswerUI(): void {

        console.log('OrderingQuestion::createAnswerUI:', this.questionData);

        // Extract items and labels based on question type
        if (this.questionData.type === 'ordering') {
            this.items = this.questionData.itemsShuffled || [];
            this.labels = (this.questionData.itemsShuffled || []).map(() => ''); // Empty labels for middle dropzones

            // For ordering questions, label first/last dropzones
            if (this.questionData.extra) {
                this.labels[0] = this.questionData.extra.startLabel || '';
                this.labels[this.labels.length - 1] = this.questionData.extra.endLabel || '';
            }
        } else {
            // Matching question
            const pairs = this.questionData.pairsShuffled || this.questionData.pairs || [];
            this.items = pairs.map((pair: any) => pair.left);
            this.labels = pairs.map((pair: any) => pair.right);
        }

        console.log('OrderingQuestion::createAnswerUI: Items:', this.items, 'Labels:', this.labels);

        // Create buttons (NO positioning yet)
        this.items.forEach((item: string, index: number) => {
            const button = new NineSliceButton(this.scene, item);
            button.setData('index', index);
            button.setData('item', item);
            button.setData('dropzone', null);
            this.buttons.set(item, button);
            this.answerContainer.add(button);
        });

        // Create dropzones (NO positioning yet)
        this.labels.forEach((label: string, index: number) => {
            const dropzone = this.scene.add.nineslice(
                0, 0, // Position in showAnswerContent()
                'dropzone',
                undefined,
                800, 120, // Logical size (fixed)
                12, 12, 12, 12
            )
                .setOrigin(0.5)
                .setTint(0x8080C0);

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
    }

    /**
     * Position all answer UI elements based on available height
     * Can be called multiple times (e.g., on resize)
     */

    protected showAnswerContent(answerHeight: number): void {

        const scaleFactor: number = this.scene.getUIScaleFactor();

        // Calculate layout
        // For this question type we likely need a lot of space so no padding
        let paddingHeight = 0;

        // Two columns (buttons left, dropzones right) side-by-side for host screen
        const numElements = this.items.length;
        const buttonSpace = answerHeight / numElements;

        const buttonHeight = 120 * scaleFactor;

        console.log('OrderingQuestion::showAnswerContent:', {
            scaleFactor,
            answerHeight,
            buttonSpace,
            buttonHeight
        });
        this.scene.socket?.emit('consolelog', `OrderingQuestion::showAnswerContent: ${JSON.stringify({
            scaleFactor,
            answerHeight,
            buttonSpace,
            buttonHeight
        })}`);

        // Position buttons
        this.buttons.forEach((button, item) => {
            const index = button.getData('index');

            const x = -480;
            const y = paddingHeight + index * buttonSpace + buttonSpace / 2;

            // button.setButtonSize(800, buttonHeight);
            button.setButtonSize(800 * scaleFactor, 120 * scaleFactor);
            button.setPosition(x, this.scene.getY(y));
            button.setTextSize(48 * scaleFactor);
            button.setData('OriginX', x);
            button.setData('OriginY', this.scene.getY(y));
            button.setData('dropzone', null); // Reset dropzone data on display
        });

        // Position dropzones
        this.dropzones.forEach((dropzone, index) => {
            const x = 480;
            const y = paddingHeight + index * buttonSpace + buttonSpace / 2;

            dropzone.setSize(800 * scaleFactor, 120 * scaleFactor);
            dropzone.setPosition(x, this.scene.getY(y));

            // Position label (same as dropzone)
            const label = this.dropzoneLabels.get(index);
            if (label) {
                label.setPosition(x, this.scene.getY(y));
                // adjust the font size of the label to match dropzone size
                label.setFontSize(46 * scaleFactor);
            }
            // Since display is getting completely reset ensure dropzone is in init state
            dropzone.setData('dropped', '');
            dropzone.setTint(0x8080C0);

        });
    }

    /**
     * Animate buttons to correct dropzones (answer mode)
     */
    public createRevealAnswerTimeline(): gsap.core.Timeline {

        console.log("OrderingQuestion::createRevealAnswerTimeline:", this.questionData);
        const tl = gsap.timeline();

        this.buttons.forEach((button, item) => {
            this.answerContainer.bringToTop(button);

            const dropzoneIndex = this.questionData.answer.indexOf(item);
            if (dropzoneIndex !== -1) {
                const dropzone = this.dropzones.get(dropzoneIndex);
                if (dropzone) {
                    console.log('Animating button to dropzone:', item, dropzoneIndex);

                    // Slight tweak - for matching pairs don't place button directly over dropzone otherwise you can't read the dropzone label
                    let dropX = dropzone.x;
                    if (this.questionData.type === 'matching') {
                        dropX = button.x + 120;
                    }

                    tl.to(button, {
                        x: dropX,
                        y: dropzone.y,
                        duration: 0.3,
                        delay: dropzoneIndex * 0.2,
                        ease: 'power2.out',
                    }, 0);
                }
            }
        });

        return tl;
    }

    public destroy(): void {
        console.log('OrderingQuestion::destroy');
        this.buttons.clear();
        this.dropzones.clear();
        this.dropzoneLabels.clear();
        super.destroy();
    }
}