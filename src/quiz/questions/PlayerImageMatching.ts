import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { ImageButton } from "src/ui/ImageButton";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { MatchingQuestionData } from "./QuestionTypes";

/**
 * PlayerImageMatchingQuestion
 * Player-side handler for matching questions that have images on the left-side items.
 * Renders 4 ImageButtons in a 2×2 grid alongside 4 text-label dropzones in a second 2×2 grid.
 * Portrait: grids stack vertically. Landscape: grids sit side-by-side.
 * Interaction is identical drag-and-drop to PlayerOrdering.
 */
export default class PlayerImageMatchingQuestion extends PlayerBaseQuestion {

    private buttons: Map<string, ImageButton> = new Map();
    private dropzones: Map<number, Phaser.GameObjects.NineSlice> = new Map();
    private dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map();
    private submitButton!: NineSliceButton;
    private items: string[] = [];
    private labels: string[] = [];

    constructor(scene: BaseScene, questionData: MatchingQuestionData) {
        super(scene, questionData);
    }

    protected createAnswerUI(): void {
        const questionData = this.questionData as MatchingQuestionData;

        const pairs = questionData.pairsShuffled || [];
        this.items = pairs.map((pair: any) => pair.left);
        this.labels = pairs.map((pair: any) => pair.right);
        this.images = questionData.pairImagesShuffled || [];

        // Create image buttons for left items
        this.items.forEach((item: string, index: number) => {
            const url = this.images[index] || '';
            const button = new ImageButton(this.scene, item, url);
            button.setData('index', index);
            button.setData('item', item);
            button.setData('dropzone', null);
            this.buttons.set(item, button);
            this.answerContainer.add(button);
        });

        // Create dropzones with text labels (right side of each pair)
        this.labels.forEach((label, index) => {
            const dropzone = this.scene.add.nineslice(
                0, 0, 'dropzone', undefined, 100, 100, 12, 12, 12, 12
            ).setOrigin(0.5).setTint(0x8080C0);

            dropzone.setData('dropped', '');
            dropzone.setData('index', index);
            this.dropzones.set(index, dropzone);
            this.answerContainer.add(dropzone);

            const labelText = this.scene.add.text(0, 0, label, this.scene.labelConfig)
                .setOrigin(0.5);
            this.dropzoneLabels.set(index, labelText);
            this.answerContainer.add(labelText);
        });

        this.submitButton = new NineSliceButton(this.scene, 'Submit');
        this.answerContainer.add(this.submitButton);
        this.submitButton.setVisible(false);

        if (this.questionData.mode === 'ask') {
            this.makeInteractive();
        }
    }

    protected showAnswerContent(answerHeight: number): void {
        const isPortrait = this.scene.isPortrait();
        const scaleFactor: number = this.scene.getUIScaleFactor();

        this.submitButton.setButtonSize(320 * scaleFactor, 80 * scaleFactor);
        this.submitButton.setTextSize(46 * scaleFactor);
        this.submitButton.setPosition(960 - 160 * scaleFactor - 20, this.scene.getY(answerHeight) - 40 * scaleFactor - 20);

        answerHeight -= 80 * scaleFactor;

        // Image buttons are square — use the shorter axis to determine size
        const numItems = this.items.length;
        const numElements = isPortrait ? numItems * 2 : numItems;
        const slotSize = answerHeight / numElements;
        // Square buttons sized to fit comfortably in their slot
        const buttonSize = Math.min(slotSize * 0.9, 300 * scaleFactor);

        this.buttons.forEach((button, item) => {
            const index = button.getData('index');

            const x = isPortrait ? 0 : -480;
            const y = index * slotSize + slotSize / 2;

            button.setButtonSize(buttonSize, buttonSize);
            button.setTextSize(36 * scaleFactor);
            button.setPosition(x, this.scene.getY(y));
            button.setData('OriginX', x);
            button.setData('OriginY', this.scene.getY(y));
            button.setData('dropzone', null);
        });

        this.dropzones.forEach((dropzone, index) => {
            const x = isPortrait ? 0 : 480;
            const y = isPortrait
                ? numItems * slotSize + slotSize / 2 + index * slotSize
                : index * slotSize + slotSize / 2;

            dropzone.setSize(800 * scaleFactor, 120 * scaleFactor);
            dropzone.setPosition(x, this.scene.getY(y));

            const label = this.dropzoneLabels.get(index);
            if (label) {
                label.setPosition(x, this.scene.getY(y));
                label.setFontSize(46 * scaleFactor);
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
            answers.push(droppedItem || '');
        });

        this.submitAnswer(answers);

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
        this.answerContainer.bringToTop(this.submitButton);
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
}
