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

        this.answerContainer.removeAll(true);

        // Create answer options - answerHeight is total amount of space available but we must allow some padding top and bottom
        // For text questions its pretty simple - will likely have full height of 1080px since only displayed on player screen
        // ASK MODE:
        // For HOST we display a message 'Type your answer'
        // PLAYER we display a text field and a keyboard
        // ANSWER MODE:
        // For HOST we display the answer text (in place of 'Type your answer')

        if (this.scene.TYPE == 'host') {

            let labelString: string = '';
            if (this.questionData.mode == 'ask') {
                labelString = 'Type your answer';
            } else {
                labelString = this.questionData.answer || 'No answer provided';
            }
            const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
                fontSize: this.scene.getY(48)
            }
            const labelConfig: Phaser.Types.GameObjects.Text.TextStyle = Object.assign({}, this.scene.labelConfig, labelStyle);
            const labelText: Phaser.GameObjects.Text = this.scene.add.text(0, answerHeight / 2, labelString, labelConfig)
                .setOrigin(0.5);

            this.answerContainer.add(labelText);

        } else {

            const numRows: number = 4;
            const rowHeight: number = 150;
            const keyboardTop: number = answerHeight - numRows * rowHeight;

            // Create a text field to hold the current answer
            const answerY: number = keyboardTop / 3;
            const answerStyle: Phaser.Types.GameObjects.Text.TextStyle = {
                fontSize: this.scene.getY(96)
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
                    button.setButtonSize(120, 120);
                    button.setPosition(-800 + (rowIndex * 45) + (charIndex * 150), this.scene.getY(keyboardTop + 150 * rowIndex));
                    button.setInteractive({ useHandCuror: true });
                    button.on('pointerup', () => {
                        this.answerText.setText(this.answerText.text + char);
                        // Truncate to a max length of 25 characters
                        this.answerText.setText(this.answerText.text.slice(0, 25));
                    });
                    this.keys.set(char, button);
                    this.answerContainer.add(button);
                });
            });
            // Add a SPACE bar
            const spaceButton: NineSliceButton = new NineSliceButton(this.scene, 'SPACE');
            spaceButton.setButtonSize(600, 120);
            spaceButton.setPosition(-60, this.scene.getY(keyboardTop + 150 * keyboardButtons.length));
            spaceButton.setInteractive({ useHandCuror: true });
            spaceButton.on('pointerup', () => {
                this.answerText.setText(this.answerText.text + ' ');
                // Truncate to a max length of 25 characters
                this.answerText.setText(this.answerText.text.slice(0, 25));
            });
            this.keys.set('SPACE', spaceButton);
            this.answerContainer.add(spaceButton);

            // Add a BACKSPACE button to the right of the top row of keys
            const backspaceButton: NineSliceButton = new NineSliceButton(this.scene, 'DELETE');
            backspaceButton.setButtonSize(120 + 150, 120);
            backspaceButton.setPosition(-800 + (0 * 45) + (10 * 150) + 75, this.scene.getY(keyboardTop));
            backspaceButton.setInteractive({ useHandCuror: true });
            backspaceButton.on('pointerup', () => {
                this.answerText.setText(this.answerText.text.slice(0, -1));
            });
            this.keys.set('DELETE', backspaceButton);
            this.answerContainer.add(backspaceButton);

            // Add a SUBMIT button - move to bottom corner to give more space for text display
            this.submitButton = new NineSliceButton(this.scene, 'Submit');
            this.submitButton.setButtonSize(320, 120);
            this.submitButton.setPosition(960 - 160 - 20, this.scene.getY(answerHeight - 80));
            this.submitButton.setVisible(true);
            this.submitButton.setInteractive({ useHandCuror: true });
            this.submitButton.on('pointerup', () => {
                console.log('TextQuestion::createAnswerUI: Submit button clicked');
                const answer = this.answerText ? this.answerText.text.trim() : '';
                this.submitAnswer(answer);
                this.makeButtonsNonInteractive();
            });
            this.answerContainer.add(this.submitButton);


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