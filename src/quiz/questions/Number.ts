import { gsap } from "gsap";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";

export default class NumberQuestion extends BaseQuestion {

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


        console.log('NumberQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE, answerHeight);

        // Create answer options - answerHeight is total amount of space available but we must allow some padding top and bottom
        // For text questions its pretty simple - will likely have full height of 1080px since only displayed on player screen
        // ASK MODE:
        // For HOST we display a message 'Type your answer'
        // PLAYER we display a text field and a keyboard
        // ANSWER MODE:
        // For HOST we display the answer text (in place of 'Type your answer')

        if (this.questionData.mode == 'ask') {

            // Perform some calculations to determine vertical positions
            // We have a total of answerHeight available for the keyboard and answer text
            // Four rows of buttons plus another row for the answer text + half a row height top and bottom (= 6 rows)
            const numRows: number = 6;
            const rowHeight: number = answerHeight / numRows;
            const buttonHeight: number = this.scene.getY(rowHeight * 0.9);

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
            const keyboardContainer: Phaser.GameObjects.Container = this.scene.add.container(0, 0);
            const keyboardButtons: string[] = ['789', '456', '123', '-0.'];

            keyboardButtons.forEach((row, rowIndex) => {
                row.split('').forEach((char, charIndex) => {
                    const button: NineSliceButton = new NineSliceButton(this.scene, char);
                    button.setButtonSize(buttonHeight, buttonHeight);
                    button.setPosition(-320 + (rowIndex * 24) + (charIndex * (buttonHeight + 24)), this.scene.getY(rowHeight * 2 + rowHeight * rowIndex));
                    button.setInteractive({ useHandCuror: true });
                    button.on('pointerup', () => {
                        if (char === '-') {
                            // If '-' is pressed, ensure it is at the start of the text
                            if (this.answerText.text.length === 0 || this.answerText.text[0] !== '-') {
                                this.answerText.setText('-' + this.answerText.text);
                            } else if (this.answerText.text[0] === '-') {
                                // If '-' is already at the start, remove it
                                this.answerText.setText(this.answerText.text.slice(1));
                            }
                        } else if (char === '.') {
                            // If '.' is pressed, ensure it is only added if there is no decimal point
                            if (!this.answerText.text.includes('.')) {
                                this.answerText.setText(this.answerText.text + '.');
                            }
                        } else {
                            // For all other characters, just append them
                            this.answerText.setText(this.answerText.text + char);
                        }
                        // Truncate to a max length of 10 characters
                        this.answerText.setText(this.answerText.text.slice(0, 10));
                    });
                    this.keys.set(char, button);
                    keyboardContainer.add(button);
                });
            });

            // Add a BACKSPACE button to the right of the top row of keys
            const backspaceButton: NineSliceButton = new NineSliceButton(this.scene, 'DELETE');
            backspaceButton.setButtonSize(buttonHeight + 150, buttonHeight);
            backspaceButton.setPosition(-320 + (0 * 45) + (3 * (buttonHeight + 24)) + 75, this.scene.getY(rowHeight * 2));
            backspaceButton.setInteractive({ useHandCuror: true });
            backspaceButton.on('pointerup', () => {
                this.answerText.setText(this.answerText.text.slice(0, -1));
            });
            this.keys.set('DELETE', backspaceButton);
            keyboardContainer.add(backspaceButton);

            this.answerContainer.add(keyboardContainer);

            // Add a SUBMIT button - move to bottom corner to give more space for text display
            this.submitButton = new NineSliceButton(this.scene, 'Submit');
            this.submitButton.setButtonSize(200, 80);
            this.submitButton.setPosition(960 - 160 - 20, this.scene.getY(answerHeight - 80));
            this.submitButton.setVisible(true);
            this.submitButton.setInteractive({ useHandCuror: true });
            this.submitButton.on('pointerup', () => {
                console.log('TextQuestion::createAnswerUI: Submit button clicked');
                let answer = this.answerText ? this.answerText.text.trim() : '0';
                if (answer === '-') {
                    answer = '0';
                }
                this.makeButtonsNonInteractive();
                this.submitAnswer(answer);

                // Juice - animate the canvas and buttons out
                const tl = gsap.timeline();
                tl.to(this.submitButton, {
                    y: 2000,
                    duration: 0.5,
                    ease: 'back.in'
                });
                tl.to(keyboardContainer.getAll(), {
                    x: -2000,
                    duration: 0.5,
                    ease: 'power2.in',
                    stagger: 0.05
                }, "<");
                tl.to(this.answerText, {
                    scale: 2,
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
            this.keys.set('SUBMIT', this.submitButton);
            this.answerContainer.add(this.submitButton);

            // Tweak to the above display for HOST screen - minimal change just disable keyboard and hide submit button
            if (this.scene.TYPE == 'host') {
                this.makeButtonsNonInteractive();
                this.submitButton.setVisible(false);
            }

        } else {

            // TYPE host and solo we display the answer
            if (this.scene.TYPE != 'play') {

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


    private makeButtonsNonInteractive(): void {
        this.keys.forEach((key) => {
            key.removeAllListeners();
            key.disableInteractive();
        });
    }

    public destroy(): void {
        super.destroy();
    }

}