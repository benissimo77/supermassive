import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { ImageButton } from "src/ui/ImageButton";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { OrderMatchQuestionData } from "./QuestionTypes";

/**
 * PlayerImageOrderingQuestion
 * Player-side handler for ordering questions that have item images.
 * Displays a 2-column grid of image buttons that the player drags into dropzones.
 * Layout is proportionally sized so it works on both portrait mobile and landscape desktop.
 */
export default class PlayerImageOrderingQuestion extends PlayerBaseQuestion {

    private buttons: Map<string, ImageButton> = new Map();
    private dropzones: Map<number, Phaser.GameObjects.NineSlice> = new Map();
    private dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map();
    private submitButton: NineSliceButton;
    private items: string[] = [];
    private labels: string[] = [];

    constructor(scene: BaseScene, questionData: OrderMatchQuestionData) {
        super(scene, questionData);
    }

    protected async createAnswerUI(): Promise<void> {
        console.log('PlayerImageOrderingQuestion::createAnswerUI:', this.questionData);

        const questionData = this.questionData as OrderMatchQuestionData;

        if (questionData.type === 'ordering') {
            this.items = questionData.itemsShuffled || [];
            this.labels = (questionData.itemsShuffled || []).map(() => '');

            if (questionData.extra) {
                this.labels[0] = questionData.extra.startLabel || '';
                this.labels[this.labels.length - 1] = questionData.extra.endLabel || '';
            }
        } else {
            // Matching
            const pairs = questionData.pairsShuffled || questionData.pairs || [];
            this.items = pairs.map((pair: any) => pair.left);
            this.labels = pairs.map((pair: any) => pair.right);
        }

        // Create image buttons for each item, resolving the URL from the original item order
        this.items.forEach((item: string, index: number) => {
            const originalIndex = questionData.items?.indexOf(item) ?? -1;
            let url = (originalIndex >= 0 && questionData.itemImages) ? questionData.itemImages[originalIndex] : '';

            if (url && typeof url === 'object') {
                url = (url as any).url || (url as any).src || (url as any).href || '';
            }
            if (typeof url !== 'string') url = '';

            const button = new ImageButton(this.scene, item, url || null);
            button.setData('index', index);
            button.setData('item', item);
            button.setData('dropzone', null);
            this.buttons.set(item, button);
            this.answerContainer.add(button);
        });

        // Create dropzones with optional labels
        this.labels.forEach((label: string, index: number) => {
            const dropzone = this.scene.add.nineslice(
                0, 0, 'dropzone', undefined, 800, 120, 12, 12, 12, 12
            ).setOrigin(0.5).setTint(0x8080C0);

            dropzone.setData('dropped', '');
            dropzone.setData('index', index);
            this.dropzones.set(index, dropzone);
            this.answerContainer.add(dropzone);

            const labelText = this.scene.add.text(0, 0, label, this.scene.labelConfig).setOrigin(0.5);
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

        // Work entirely in Phaser logical units
        // answerContainer is at (960, 0) — x=0 here is the screen horizontal center
        const totalH = this.scene.getY(answerHeight);
        const VPAD = Math.round(totalH * 0.015);
        const HPAD = 20; // horizontal padding is fixed since width is always 1920

        const numDz = this.labels.length;
        const cols = Math.min(2, this.items.length);
        const rows = Math.ceil(this.items.length / cols);

        // Reserve bottom section for submit button
        const submitH = Math.round(totalH * 0.07);
        const submitY = totalH - submitH / 2 - VPAD;

        // Reserve section for dropzones (above submit)
        const dzAvailH = Math.round(totalH * 0.35);
        const dzH = numDz > 0 ? (dzAvailH - (numDz + 1) * VPAD) / numDz : 0;
        const dzStartY = totalH - submitH - VPAD - dzAvailH;

        // Remaining height for the image grid
        const gridAvailH = dzStartY - VPAD;
        const rowH = rows > 0 ? (gridAvailH - (rows + 1) * VPAD) / rows : 0;
        const maxBtnW = (1920 - (cols + 1) * HPAD) / cols;
        const IMGBTN_SIZE = Math.max(80, Math.min(maxBtnW, rowH));

        // Center image grid horizontally (x=0 is the center of the answerContainer)
        const gridW = cols * IMGBTN_SIZE + (cols - 1) * HPAD;
        const gridStartX = -gridW / 2;

        this.buttons.forEach((button, item) => {
            const index = button.getData('index');
            const col = index % cols;
            const row = Math.floor(index / cols);

            const x = gridStartX + col * (IMGBTN_SIZE + HPAD) + IMGBTN_SIZE / 2;
            const y = VPAD + row * (IMGBTN_SIZE + VPAD) + IMGBTN_SIZE / 2;

            button.setButtonSize(IMGBTN_SIZE, IMGBTN_SIZE);
            button.setPosition(x, y);
            button.setData('OriginX', x);
            button.setData('OriginY', y);
            button.setData('dropzone', null);
        });

        // Position dropzones below the grid
        this.dropzones.forEach((dropzone, index) => {
            const y = dzStartY + (index + 1) * VPAD + index * dzH + dzH / 2;

            // Full-width dropzone (relative to center): spans nearly the full 1920 width
            dropzone.setSize(1820, Math.max(60, dzH));
            dropzone.setPosition(0, y);

            const label = this.dropzoneLabels.get(index);
            if (label) {
                label.setPosition(0, y);
                label.setFontSize(Math.max(20, dzH * 0.4));
            }

            dropzone.setData('dropped', '');
            dropzone.setTint(0x8080C0);
        });

        // Submit button at the very bottom
        this.submitButton.setButtonSize(Math.round(totalH * 0.55), Math.round(submitH * 0.8));
        this.submitButton.setTextSize(Math.round(submitH * 0.45));
        this.submitButton.setPosition(0, submitY);
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

        this.submitButton.on('pointerup', () => this.handleSubmit());
        this.submitButton.setInteractive({ useHandCursor: true });
    }

    protected makeNonInteractive(): void {
        this.removeSceneInputHandlers();
        this.buttons.forEach((button) => button.disableInteractive());
        this.dropzones.forEach((dropzone) => dropzone.disableInteractive());
        this.submitButton.disableInteractive();
        this.submitButton.removeAllListeners();
    }

    public createRevealAnswerTimeline(): gsap.core.Timeline {
        // Player side has no reveal animation
        return gsap.timeline();
    }

    private handleSubmit(): void {
        this.makeNonInteractive();

        const answers: string[] = [];
        this.dropzones.forEach((dropzone) => {
            answers.push(dropzone.getData('dropped') || '');
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
            if (!dropzone.getData('dropped')) full = false;
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

        // If button was already dropped in a dropzone, free that dropzone
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
        // Snap back to origin if not dropped in a valid zone
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
