import { gsap } from "gsap";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "../NineSliceButton";

export default class TextQuestion extends BaseQuestion {

    private answerText: Phaser.GameObjects.Text;
    private submitButton: NineSliceButton;
    private keys: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();

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
    protected createAnswerUI(answerHeight: number): void {

        console.log('TextQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE, answerHeight);

        // Create answer options - answerHeight is total amount of space available but we must allow some padding top and bottom
        // For text questions its pretty simple - will likely have full height of 1080px since only displayed on player screen
        // ASK MODE:
        // HOST display message 'Type your answer'
        // PLAY/SOLO display text field and a keyboard
        // ANSWER MODE:
        // HOST/SOLO display the answer text (in place of 'Type your answer')

        if (this.questionData.mode == 'ask') {
        
            const numRows: number = 6;
            const rowHeight: number = answerHeight / numRows;
            const buttonHeight: number = this.scene.getY(rowHeight * 0.9);
            const keyboardTop: number = answerHeight - numRows * rowHeight;

            // Create a text field to hold the current answer
            const answerY: number = rowHeight / 2;
            const answerStyle: Phaser.Types.GameObjects.Text.TextStyle = {
                fontSize: this.scene.getY(rowHeight * 0.8),
            }
            const answerConfig: Phaser.Types.GameObjects.Text.TextStyle = Object.assign({}, this.scene.labelConfig, answerStyle);
            this.answerText = this.scene.add.text(0, this.scene.getY(answerY), '', answerConfig)
                .setOrigin(0.5);

            this.answerContainer.add([this.answerText]);

            // Create a keybaord - maybe make this a separate class at some point?
            // Create the 26 buttons to provide text input since I can't figure out how to make the DOM input field work properly
            const keyboardButtons: string[] = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

            keyboardButtons.forEach((row, rowIndex) => {
                row.split('').forEach((char, charIndex) => {
                    const button: NineSliceButton = new NineSliceButton(this.scene, char);
                    button.setButtonSize(buttonHeight, buttonHeight);
                    button.setPosition(-800 + (rowIndex * 45) + (charIndex * (buttonHeight + 24)), this.scene.getY(rowHeight * 2 + rowHeight * rowIndex);
                    button.setInteractive({ useHandCuror: true });
                    button.on('pointerup', () => {
                        this.answerText.setText(this.answerText.text + char);
                        // Truncate to a max length of 25 characters
                        this.answerText.setText(this.answerText.text.slice(0, 25));
                    });
                    this.keys.set('Key' + char.toUpperCase(), button);
                    this.answerContainer.add(button);
                });
            });
            // Add a BACKSPACE button to the right of the top row of keys
            const backspaceButton: NineSliceButton = new NineSliceButton(this.scene, 'DELETE');
            backspaceButton.setButtonSize(buttonHeight + 150, buttonHeight);
            backspaceButton.setPosition(-800 + (0 * 45) + (10 * (buttonHeight + 24)) + (buttonHeight + 24), this.scene.getY(rowHeight * 2));
            backspaceButton.setInteractive({ useHandCuror: true });
            backspaceButton.on('pointerup', () => {
                this.answerText.setText(this.answerText.text.slice(0, -1));
            });
            this.keys.set('Backspace', backspaceButton);
            this.answerContainer.add(backspaceButton);

            // Add a SPACE bar
            const spaceButton: NineSliceButton = new NineSliceButton(this.scene, 'SPACE');
            spaceButton.setButtonSize(600, buttonHeight);
            spaceButton.setPosition(-60, this.scene.getY(rowHeight * 2 + rowHeight * keyboardButtons.length));
            spaceButton.setInteractive({ useHandCuror: true });
            spaceButton.on('pointerup', () => {
                this.answerText.setText(this.answerText.text + ' ');
                // Truncate to a max length of 25 characters
                this.answerText.setText(this.answerText.text.slice(0, 25));
            });
            this.keys.set('Space', spaceButton);
            this.answerContainer.add(spaceButton);

            // Add a SUBMIT button - move to bottom corner to give more space for text display
            this.submitButton = new NineSliceButton(this.scene, 'Submit');
            this.submitButton.setButtonSize(200, 80);
            this.submitButton.setPosition(960 - 160 - 20, this.scene.getY(answerHeight - 80));
            this.submitButton.setVisible(true);
            this.submitButton.setInteractive({ useHandCuror: true });
            this.submitButton.on('pointerup', () => {
                console.log('TextQuestion::createAnswerUI: Submit button clicked');
                this.makeButtonsNonInteractive();
                const answer = this.answerText ? this.answerText.text.trim() : '';
                this.submitAnswer(answer);

                // Juice - animate the canvas and buttons out
                const tl = gsap.timeline();
                tl.to(this.submitButton, {
                    y: 2000,
                    duration: 0.5,
                    ease: 'back.in'
                });
                this.keys.delete('Enter');
                this.keys.forEach((key) => {
                    key.removeAllListeners();
                    tl.to(key, {
                        x: -2000,
                        duration: 0.5,
                        ease: 'power2.in'
                    }, "<");
                });
                tl.to(this.answerText, {
                    scale: this.answerText.text.length > 12 ? 1.2 : 2,
                    duration: 1,
                    ease: 'back.out'
                }); 
                tl.to(this.answerText, {
                    y: -2000,
                    duration: 0.5,
                    ease: 'power2.in'
                });   
                tl.play();


            });
            this.keys.set('Enter', this.submitButton);
            this.answerContainer.add(this.submitButton);

            // Additional feature for SOLO mode - add a keyboard listener to simulate keypresses
            if (this.scene.TYPE == 'solo') {
                if (this.scene.input && this.scene.input.keyboard) {
                    this.scene.input.keyboard.on('keydown', this.handleKeyPress, this);
                }
            }

            // Tweak display for HOST - disable keyboard and hide submit button
            if (this.scene.TYPE == 'host') {
                this.makeButtonsNonInteractive();
                this.submitButton.setVisible(false);
                this.answerText.setText('Enter your answers...');
            }

        } else {

            if (this.scene.TYPE == 'host' || this.scene.TYPE == 'solo') {
                const labelString = this.questionData.answer || 'No answer provided';
                const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
                    fontSize: this.scene.getY(96)
                }
                const labelConfig: Phaser.Types.GameObjects.Text.TextStyle = Object.assign({}, this.scene.labelConfig, labelStyle);
                const labelText: Phaser.GameObjects.Text = this.scene.add.text(0, answerHeight / 2, labelString, labelConfig)
                    .setOrigin(0.5);

                this.answerContainer.add(labelText);

            }
        }

        // DEBUG - add rectangle to originof the answer container
        const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        this.answerContainer.add(debugRect);
    }

    private handleKeyPress(event: KeyboardEvent): void {
        // Handle key presses to update the answer text
        console.log('TextQuestion::handleKeyPress:', event.key, this.scene);
        if (this.keys.has(event.code)) {
            const keyButton = this.keys.get(event.code);
            if (keyButton) {
                keyButton.emit('pointerover');
                // Add a subtle scale effect for the "press" feeling
                gsap.to(keyButton, {
                    scaleX: 0.95,
                    scaleY: 0.95,
                    duration: 0.1,
                    yoyo: true,
                    onComplete: () => {
                        console.log('TextQuestion::handleKeyPress: tween complete:', event.code);
                        // Execute the button action when animation completes
                        keyButton.emit('pointerup');
                    }
                });

                this.scene.time.delayedCall(200, () => {
                    keyButton.emit('pointerout');
                });

            }
        }
    }

    private makeButtonsNonInteractive(): void {
        this.keys.forEach((key) => {
            key.removeAllListeners();
            key.disableInteractive();
        });
    }

    public destroy(): void {
        
        // Clean up the keys map
        this.keys.clear();

        if (this.scene && this.scene.input && this.scene.input.keyboard) {
            this.scene.input.keyboard.off('keydown', this.handleKeyPress, this);
        }

        super.destroy();
    }

}