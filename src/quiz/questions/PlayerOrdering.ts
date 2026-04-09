import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { OrderMatchQuestionData } from "./QuestionTypes";

export default class PlayerOrderingQuestion extends PlayerBaseQuestion {
    
    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    private dropzones: Map<number, Phaser.GameObjects.NineSlice> = new Map<number, Phaser.GameObjects.NineSlice>();
    private dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map<number, Phaser.GameObjects.Text>();
    private submitButton: NineSliceButton;
    private items: string[] = [];
    private labels: string[] = [];

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
            // Matching question
            const pairs = questionData.pairsShuffled || questionData.pairs || [];
            this.items = pairs.map((pair: any) => pair.left);
            this.labels = pairs.map((pair: any) => pair.right);
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
            const dropzone = this.scene.add.nineslice(
                0, 0,
                'dropzone',
                undefined,
                800, 120,
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

        // Create submit button
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

        // Submit button positioning
        this.submitButton.setButtonSize(320 * scaleFactor, 80 * scaleFactor);
        this.submitButton.setTextSize(46 * scaleFactor);
        this.submitButton.setPosition(960 - 160 * scaleFactor - 20, this.scene.getY(answerHeight) - 40 * scaleFactor - 20);

        answerHeight -= 80 * scaleFactor;

        let paddingHeight = 0;
        const numElements = isPortrait ? this.items.length * 2 : this.items.length;
        const buttonSpace = answerHeight / numElements;

        this.buttons.forEach((button, item) => {
            const index = button.getData('index');

            const x = isPortrait ? 0 : -480;
            const y = paddingHeight + index * buttonSpace + buttonSpace / 2;

            button.setButtonSize(800 * scaleFactor, 120 * scaleFactor);
            button.setPosition(x, this.scene.getY(y));
            button.setTextSize(48 * scaleFactor);
            button.setData('OriginX', x);
            button.setData('OriginY', this.scene.getY(y));
            button.setData('dropzone', null); 
        });

        this.dropzones.forEach((dropzone, index) => {
            const x = isPortrait ? 0 : 480;
            const y = isPortrait
                ? paddingHeight + this.items.length * buttonSpace + (buttonSpace/2) + index * buttonSpace + buttonSpace / 2
                : paddingHeight + index * buttonSpace + buttonSpace / 2;

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
