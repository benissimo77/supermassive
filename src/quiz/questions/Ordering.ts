import { gsap } from "gsap";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";

// NOTE: there is little difference between ordering and matching questions
// so we use the same class for both types of questions
export default class OrderingQuestion extends BaseQuestion {

    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    private dropzones: Map<integer, Phaser.GameObjects.NineSlice> = new Map<integer, Phaser.GameObjects.NineSlice>();
    private submitButton: NineSliceButton;

    protected getAnswerUIWidth(): number {
        return 600;
    }

    /**
     * Create the specific content for ordering/matching questions
     * The questionData holds everything we need including a 'mode' (ask/answer)
     * If mode = 'answer' then we show the correct answer (non-interactive)
     * If mode = 'ask' then we show the options
     * If mode = 'ask' AND we are player screen then make interactive and collect player input
     */
    protected createAnswerUI(answerHeight: number): void {

        console.log('OrderingQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE, answerHeight);

        // Separate the difference between ordering and matching questions
        // We need two things:
        // List of items to represent the buttons
        // List of labels to represent the dropzones
        let items: string[];
        if (this.questionData.type == 'ordering') {
            items = this.questionData.items;
        } else {
            items = this.questionData.pairs.map(pair => pair.left);
        }
        let labels: string[];
        if (this.questionData.type == 'ordering') {
            labels = this.questionData.items.map(item => '');
            // For ordering questions we have a start and end label
            if (this.questionData.extra) {
                labels[0] = this.questionData.extra.startLabel;
                labels[labels.length - 1] = this.questionData.extra.endLabel;
            }
        } else {
            labels = this.questionData.pairs.map(pair => pair.right);
        }
        console.log('OrderingQuestion::createAnswerUI: Items:', items, 'Labels:', labels);

        // Create answer options - answerHeight is total amount of space available but we must allow some padding top and bottom
        // Experiment with making padding a proportion of available space
        // And if we have a LOT of space then make the padding larger otherwise it spreads out too much vertically
        // All of the layout assumes a logical button width of 800
        const numColumns = 1;

        let paddingHeight: number = answerHeight / 8;
        if (answerHeight > 640) {
            paddingHeight = answerHeight / 6;
        }
        let availableHeight: number = answerHeight - 2 * paddingHeight;
        let buttonSpace: number = numColumns * availableHeight / items.length;
        let buttonHeight: number = buttonSpace * 0.8;

        // One more twist of logic - button height can look a bit too large so set a max height
        if (buttonHeight > 180) {
            buttonHeight = 180;
        }

        console.log('OrderingQuestion::createAnswerUI:', this.scene.TYPE, availableHeight, buttonSpace, buttonHeight);


        // Now create the buttons using the above calculated values
        items.forEach((item: string, index: number) => {

            const rowCount: number = index;
            const y = this.scene.getY(paddingHeight + rowCount * buttonSpace + buttonSpace / 2);
            const x = -480;

            console.log('OrderingQuestion::createAnswerUI:', item, x, y);

            const newButton: NineSliceButton = new NineSliceButton(this.scene, item);
            newButton.setButtonSize(800, this.scene.getY(buttonHeight));
            newButton.setPosition(x, y);
            newButton.setData('OriginY', y);
            newButton.setData('item', item);
            newButton.setData('dropzone', null);

            // Add dropzone for this button
            const dropzone: Phaser.GameObjects.NineSlice = this.scene.add.nineslice(480, y, 'dropzone',
                undefined,                // Frame
                800, this.scene.getY(buttonHeight),       // Width, height
                12, 12, 12, 12       // Corner slice sizes
            )
                .setOrigin(0.5)
                .setTint(0x8080C0);
            dropzone.setData('dropped', '');
            dropzone.setData('index', index);

            // Add label for dropzone
            const textLabelConfig = this.scene.labelConfig;
            const label: Phaser.GameObjects.Text = this.scene.add.text(480, y, labels[index], textLabelConfig)
                .setOrigin(0.5);

            this.buttons.set(item, newButton);
            this.answerContainer.add(newButton);

            this.dropzones.set(index, dropzone);
            this.answerContainer.add([dropzone, label]);
        });

        // Add submit button (always 200x80 for consistency across all questions)
        this.submitButton = new NineSliceButton(this.scene, 'Submit');
        this.submitButton.setButtonSize(200, 80);
        this.submitButton.setPosition(-480, (answerHeight) / 2);
        this.submitButton.setVisible(false);
        this.submitButton.on('pointerup', () => {
            console.log('OrderingQuestion::createAnswerUI: Submit button clicked');
            this.makeButtonsNonInteractive();
            // Collect the answers from the dropzones
            const answers: string[] = [];
            this.dropzones.forEach((dropzone, index) => {
                const droppedItem = dropzone.getData('dropped');
                if (droppedItem) {
                    answers.push(droppedItem);
                } else {
                    console.warn('Dropzone is empty:', index);
                }
            });
            console.log('OrderingQuestion::createAnswerUI: Collected answers:', answers);
            this.submitAnswer(answers);

            // Juice - animate the buttons out
            const tl = gsap.timeline();
            tl.to(this.submitButton, {
                y: 2000,
                duration: 0.5,
                ease: 'back.in'
            });
            tl.to(this.answerContainer, {
                x: -2000,
                duration: 0.5,
                ease: 'power2.in'
            });
            tl.play();

        });
        this.submitButton.setInteractive({ useHandCuror: true });

        this.answerContainer.add(this.submitButton);

        // DEBUG - add rectangle to origin of the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);

        // Make interactive if we are in ask mode and player screen
        if (this.questionData.mode == 'ask' && this.scene.TYPE != 'host') {
            this.makeButtonsInteractive();
            this.addSceneInputHandlers();
        }

        // If we are in answer mode then we show the correct answer
        // Loop through each button tweening it to its correct dropzone position
        if (this.questionData.mode == 'answer') {

            this.buttons.forEach((button, item) => {
                this.answerContainer.bringToTop(button);
                const dropzoneIndex = this.questionData.answer.indexOf(item);
                if (dropzoneIndex !== -1) {
                    const dropzone = this.dropzones.get(dropzoneIndex);
                    if (dropzone) {
                        console.log('OrderingQuestion::createAnswerUI: Tweening button to dropzone:', item, dropzoneIndex);
                        this.scene.tweens.add({
                            targets: button,
                            x: dropzone.x,
                            y: dropzone.y,
                            duration: 300,
                            delay: dropzoneIndex * 200,
                            ease: 'Power2',
                        });
                    } else {
                        console.warn('OrderingQuestion::createAnswerUI: Dropzone not found for index:', dropzoneIndex);
                    }
                } else {
                    console.warn('OrderingQuestion::createAnswerUI: Item not found in answer:', item);
                }
            });
        }

    }

    public destroy(): void {
        console.log('OrderingQuestion::destroy: Destroying question:', this.questionData.id, this.scene);
        if (this.scene) {
            this.removeSceneInputHandlers();
        }
        super.destroy();
    }

    private makeButtonsInteractive(): void {

        this.dropzones.forEach((dropzone, option) => {
            dropzone.setInteractive({ dropZone: true });
        });
        this.buttons.forEach((button, option) => {
            button.setInteractive({ useHandCuror: true, draggable: true });
        });

    }

    private makeButtonsNonInteractive(): void {
        this.buttons.forEach((button) => {
            button.disableInteractive();
        });
        this.dropzones.forEach((dropzone) => {
            dropzone.disableInteractive();
        });
    }


    private checkDropzonesFull(): boolean {
        let full: boolean = true;
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

    private handleDragStart(pointer, gameObject): void {
        console.log('Drag started for gameObject:', gameObject, this.scene);
        this.answerContainer.bringToTop(gameObject);
        // Very tricky bug here: pointer might be dragging the button but from outside the dropzone
        // In this case pointer might never enter or leave the dropzone so no more events will be fired
        // So in the special case that pointer begins OUTSIDE the dropzone we need to treat as if it was already left the dropzone
        if (gameObject.getData('dropzone') !== null) {
            console.warn('GameObject already has a dropzone:', gameObject.getData('dropzone'));
            const dropzone = this.dropzones.get(gameObject.getData('dropzone'));
            if (dropzone) {
                const bounds = dropzone.getBounds();
                // Check if pointer coordinates are inside bounds
                if (!bounds.contains(pointer.x, pointer.y)) {
                    dropzone.setData('dropped', '');
                    dropzone.setTint(0x8080C0);
                    gameObject.setData('dropzone', null);
                }
            }
        }
    }
    private handleDragEnd(pointer, gameObject): void {
        console.log('Drag ended for gameObject:', gameObject, this.scene);
        if (gameObject.getData('dropzone') !== null) {
            console.log('GameObject was dropped on a dropzone:', gameObject.getData('dropzone'));
        } else {
            this.scene.tweens.add({
                targets: gameObject,
                x: -480,
                y: gameObject.getData('OriginY'), // Reset to original Y position
                duration: 300,
                ease: 'Power2',
            });

        }

        // Regardless of what happened above, if drag has ended we check if all dropzones are full
        console.log('Checking if all dropzones are full...', this.checkDropzonesFull());
        this.submitButton.setVisible(this.checkDropzonesFull());
    }

    private handleDrag(pointer, gameObject, dragX, dragY): void {
        //  This will snap our drag to a 64x64 grid
        dragX = Phaser.Math.Snap.To(dragX, 1);
        dragY = Phaser.Math.Snap.To(dragY, 1);
        gameObject.setPosition(dragX, dragY);
    }

    private handleDragEnter(pointer, gameObject: Phaser.GameObjects.GameObject, dropzone: Phaser.GameObjects.Image): void {
        console.log('Dragenter:', dropzone.getData('index'), dropzone.getData('dropped'), 'with gameObject:', gameObject.getData('item'));
        if (dropzone.getData('dropped')) {
            console.warn('Dropzone already has an item dropped:', dropzone);
        } else {
            dropzone.setTint(0x00ff00); // Change color to indicate a valid drop target
        }
    }
    private handleDragLeave(pointer, gameObject, dropzone): void {
        console.log('Dragleave:', dropzone.getData('index'), dropzone.getData('dropped'), 'with gameObject:', gameObject.getData('item'));
        // We can always set the tint to original color since either button is leaving or another button is obscuring it
        dropzone.setTint(0x8080C0); // Reset color
        // If the gameobject leaving dropzone was previously dropped on it then reset dropzone
        if (gameObject.getData('dropzone') === dropzone.getData('index')) {
            console.warn('GameObject is leaving its own dropzone:', dropzone.getData('index'));
            dropzone.setData('dropped', '');
            gameObject.setData('dropzone', null); // Clear the dropzone data from the gameObject
        }
    }
    private handleDrop(pointer, gameObject, dropzone): void {
        console.log('Drop:', dropzone.getData('index'), dropzone.getData('dropped'), 'with gameObject:', gameObject.getData('item'));
        if (dropzone.getData('dropped')) {
            console.warn('Dropzone already has an item dropped:', dropzone);
        } else {
            dropzone.setData('dropped', gameObject.getData('item'));
            // Find the item associated with the dropzone using this.dropzones map
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

}