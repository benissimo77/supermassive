import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { OrderMatchQuestionData } from "./QuestionTypes";

/**
 * OrderingQuestion - Handles both 'ordering' and 'matching' question types
 * 
 * ORDERING: Items must be placed in specific sequence (e.g., planets by distance)
 *   - Dropzones labeled: "Closest" (first), "" (middle), "Furthest" (last)
 * 
 * MATCHING: Items must match specific labels (e.g., countries to capitals)
 *   - Dropzones labeled: "Paris", "Madrid", "Rome"
 * 
 * Layout:
 *   - Portrait: Single column (buttons stacked, then dropzones below)
 *   - Landscape: Two columns (buttons left, dropzones right)
 */
export default class OrderingQuestion extends BaseQuestion {

    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    private dropzones: Map<number, Phaser.GameObjects.NineSlice> = new Map<number, Phaser.GameObjects.NineSlice>();
    private dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map<number, Phaser.GameObjects.Text>();
    private submitButton: NineSliceButton;
    private items: string[] = [];
    private labels: string[] = [];

    constructor(scene: BaseScene, questionData: OrderMatchQuestionData) {
        super(scene, questionData);
    }

    protected getAnswerUIWidth(): number {
        return 600;
    }

    /**
     * Create the specific content for ordering/matching questions
     * Creates all objects (buttons, dropzones, labels) but does NOT position them
     * Positioning happens in displayAnswerUI()
     */
    protected createAnswerUI(): void {

        console.log('OrderingQuestion::createAnswerUI:', this.questionData.type, this.questionData.mode);

        // Extract items and labels based on question type
        if (this.questionData.type === 'ordering') {
            this.items = this.questionData.items;
            this.labels = this.questionData.items.map(() => ''); // Empty labels for middle dropzones

            // For ordering questions, label first/last dropzones
            if (this.questionData.extra) {
                this.labels[0] = this.questionData.extra.startLabel || '';
                this.labels[this.labels.length - 1] = this.questionData.extra.endLabel || '';
            }
        } else {
            // Matching question
            this.items = this.questionData.pairs.map((pair: any) => pair.left);
            this.labels = this.questionData.pairs.map((pair: any) => pair.right);
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
                0, 0, // Position in displayAnswerUI()
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

        // Create submit button (NO positioning yet)
        // Place inside its own container (aligned with answerContainer) so that draggables can get brought to front but submit button still stays on top
        this.submitButton = new NineSliceButton(this.scene, 'Submit');
        this.answerContainer.add(this.submitButton);

        // Make invisible for all screens (becomes visible when all dropzones filled)
        this.submitButton.setVisible(false);

        // Make interactive if in ask mode and player screen
        if (this.questionData.mode === 'ask' && this.scene.TYPE !== 'host') {
            this.makeInteractive();
        }
    }

    /**
     * Position all answer UI elements based on available height
     * Can be called multiple times (e.g., on resize)
     */

    protected displayAnswerUI(answerHeight: number): void {

        const isPortrait = this.scene.isPortrait();
        const scaleFactor: number = this.scene.getUIScaleFactor();

        // Position and scale submit button (BOILERPLATE - same as Text/Number)
        // Firstly align the submit button container with answer container
        this.submitButton.setButtonSize(320 * scaleFactor, 80 * scaleFactor);
        this.submitButton.setTextSize(46 * scaleFactor);
        this.submitButton.setPosition(960 - 160 * scaleFactor - 20, this.scene.getY(answerHeight) - 40 * scaleFactor - 20);

        // Reduce answerHeight to account for submit button area
        // Needed at all scale factors since ordering elements can reach the right hand edge of screen
        answerHeight -= 80 * scaleFactor;

        // Calculate layout
        // For this question type we likely need a lot of space so no padding
        let paddingHeight = 0;

        // Portrait: 2× elements (buttons + dropzones stacked)
        // Landscape: 1× elements (buttons and dropzones side-by-side)
        const numElements = isPortrait ? this.items.length * 2 : this.items.length;
        const buttonSpace = answerHeight / numElements;

        const buttonHeight = 120 * scaleFactor;

        console.log('OrderingQuestion::displayAnswerUI:', {
            isPortrait,
            scaleFactor,
            answerHeight,
            buttonSpace,
            buttonHeight
        });
        this.scene.socket?.emit('consolelog', `OrderingQuestion::displayAnswerUI: ${JSON.stringify({
            isPortrait,
            scaleFactor,
            answerHeight,
            buttonSpace,
            buttonHeight
        })}`);

        // Position buttons
        this.buttons.forEach((button, item) => {
            const index = button.getData('index');

            const x = isPortrait ? 0 : -480;
            const y = paddingHeight + index * buttonSpace + buttonSpace / 2;

            // button.setButtonSize(800, buttonHeight);
            button.setButtonSize(800 * scaleFactor, 120 * scaleFactor);
            button.setPosition(x, this.scene.getY(y));
            button.setTextSize(48 * scaleFactor);
            button.setData('OriginX', x);
            button.setData('OriginY', this.scene.getY(y));
        });

        // Position dropzones
        this.dropzones.forEach((dropzone, index) => {
            const x = isPortrait ? 0 : 480;
            const y = isPortrait
                ? paddingHeight + this.items.length * buttonSpace + (buttonSpace/2) + index * buttonSpace + buttonSpace / 2
                : paddingHeight + index * buttonSpace + buttonSpace / 2;

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
     * Make buttons and dropzones interactive (player screen)
     */
    protected makeInteractive(): void {
        // Add drag-drop scene handlers
        this.addSceneInputHandlers();

        // Make buttons draggable
        this.buttons.forEach((button) => {
            button.setInteractive({ useHandCursor: true, draggable: true });
        });

        // Make dropzones drop targets
        this.dropzones.forEach((dropzone) => {
            dropzone.setInteractive({ dropZone: true });
        });

        this.submitButton.on('pointerup', () => { this.handleSubmit(); });
        this.submitButton.setInteractive({ useHandCuror: true });

    }

    /**
     * Make buttons and dropzones non-interactive (host screen or after submit)
     */
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

    /**
     * Handle submit button click
     */
    private handleSubmit(): void {
        console.log('OrderingQuestion::handleSubmit');
        this.makeNonInteractive();

        // Collect answers from dropzones
        const answers: string[] = [];
        this.dropzones.forEach((dropzone) => {
            const droppedItem = dropzone.getData('dropped');
            if (droppedItem) {
                answers.push(droppedItem);
            } else {
                answers.push('');
                console.warn('Dropzone empty on submit:', dropzone.getData('index'));
            }
        });

        console.log('OrderingQuestion::handleSubmit: Answers:', answers);
        this.submitAnswer(answers);

        // Animate out
        const tl = gsap.timeline();
		tl.to(this.answerContainer, {
			y: this.scene.getY(2160),
			duration: 0.5,
			ease: 'back.in'
		});
		tl.add(() => {
			this.scene.sound.play('submit-answer');
		}, "<+0.25");
		tl.play();
    }

    /**
     * Animate buttons to correct dropzones (answer mode)
     */
    protected revealAnswerUI(): void {

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
                    this.scene.tweens.add({
                        targets: button,
                        x: dropX,
                        y: dropzone.y,
                        duration: 300,
                        delay: dropzoneIndex * 200,
                        ease: 'Power2',
                    });
                }
            }
        });
    }

    /**
     * Check if all dropzones are filled (show submit button)
     */
    private checkDropzonesFull(): boolean {
        let full = true;
        this.dropzones.forEach((dropzone) => {
            if (!dropzone.getData('dropped')) {
                full = false;
            }
        });
        return full;
    }

    /**
     * Add drag-drop input handlers
     */
    private addSceneInputHandlers(): void {
        this.scene.input.on('dragstart', this.handleDragStart, this);
        this.scene.input.on('dragend', this.handleDragEnd, this);
        this.scene.input.on('drag', this.handleDrag, this);
        this.scene.input.on('dragenter', this.handleDragEnter, this);
        this.scene.input.on('dragleave', this.handleDragLeave, this);
        this.scene.input.on('drop', this.handleDrop, this);
    }

    /**
     * Remove drag-drop input handlers
     */
    private removeSceneInputHandlers(): void {
        this.scene.input.off('dragstart', this.handleDragStart, this);
        this.scene.input.off('drag', this.handleDrag, this);
        this.scene.input.off('dragend', this.handleDragEnd, this);
        this.scene.input.off('dragenter', this.handleDragEnter, this);
        this.scene.input.off('dragleave', this.handleDragLeave, this);
        this.scene.input.off('drop', this.handleDrop, this);
    }

    private handleDragStart(pointer: Phaser.Input.Pointer, gameObject: any): void {
        console.log('Drag started:', gameObject.getData('item'));
        this.answerContainer.bringToTop(gameObject);

        // If dragging from dropzone, check if pointer started outside bounds
        if (gameObject.getData('dropzone') !== null) {
            const dropzoneIndex = gameObject.getData('dropzone');
            const dropzone = this.dropzones.get(dropzoneIndex);
            if (dropzone) {
                const bounds = dropzone.getBounds();
                if (!bounds.contains(pointer.x, pointer.y)) {
                    // Clear dropzone (pointer started outside)
                    dropzone.setData('dropped', '');
                    dropzone.setTint(0x8080C0);
                    gameObject.setData('dropzone', null);
                }
            }
        }
    }

    private handleDragEnd(pointer: Phaser.Input.Pointer, gameObject: any): void {
        console.log('Drag ended:', gameObject.getData('item'));

        if (gameObject.getData('dropzone') !== null) {
            console.log('Dropped on dropzone:', gameObject.getData('dropzone'));
        } else {
            // Return to origin
            this.scene.tweens.add({
                targets: gameObject,
                x: gameObject.getData('OriginX'),
                y: gameObject.getData('OriginY'),
                duration: 300,
                ease: 'Power2',
            });
        }

        // Show submit button if all dropzones filled
        this.submitButton.setVisible(this.checkDropzonesFull());
    }

    private handleDrag(pointer: Phaser.Input.Pointer, gameObject: any, dragX: number, dragY: number): void {
        // Snap to grid
        dragX = Phaser.Math.Snap.To(dragX, 1);
        dragY = Phaser.Math.Snap.To(dragY, 1);
        gameObject.setPosition(dragX, dragY);
    }

    private handleDragEnter(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        console.log('Drag enter:', dropzone.getData('index'));

        if (dropzone.getData('dropped')) {
            console.warn('Dropzone already filled');
        } else {
            dropzone.setTint(0x00ff00); // Green = valid drop
        }
    }

    private handleDragLeave(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        console.log('Drag leave:', dropzone.getData('index'));

        dropzone.setTint(0x8080C0); // Reset tint

        // If leaving own dropzone, clear it
        if (gameObject.getData('dropzone') === dropzone.getData('index')) {
            dropzone.setData('dropped', '');
            gameObject.setData('dropzone', null);
        }
    }

    private handleDrop(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        console.log('Drop:', dropzone.getData('index'), gameObject.getData('item'));

        if (dropzone.getData('dropped')) {
            console.warn('Dropzone already filled');
        } else {
            // Snap to dropzone
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

    public destroy(): void {
        console.log('OrderingQuestion::destroy');
        if (this.scene) {
            this.removeSceneInputHandlers();
        }
        super.destroy();
    }
}