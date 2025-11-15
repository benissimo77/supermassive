// NOTE: this is not finished yet - decided to wait before separating out the keyboard into its own class

import { NineSliceButton } from "./NineSliceButton";
import { BaseScene } from "src/BaseScene";

export class Keypad extends Phaser.GameObjects.Container {

    declare public scene: BaseScene;
    private answerText: Phaser.GameObjects.Text;
    private keys: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();

    constructor(scene: BaseScene) {
        super(scene);

        this.scene = scene;

        // Create the keyboard layout
        this.addKeys();

        // Add the answer text
        const answerStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: 120,
        };
        const answerConfig: Phaser.Types.GameObjects.Text.TextStyle = Object.assign({}, this.scene.labelConfig, answerStyle);
        this.answerText = this.scene.add.text(0, 0, '', answerConfig)
            .setOrigin(0.5, 0);
        this.add(this.answerText);

        // Add the container to the scene
        scene.add.existing(this);

        // DEBUG - add rectangle to origin of the answer container
        const debugRect = this.scene.add.rectangle(0, 0, 15, 15, 0xff0000, 1).setOrigin(0.5);
        this.add(debugRect);
    }

    // addKeys - this creates all the buttons for the keypad
    // Uses an absolute fixed size layout - any class that uses this keypad can set the scale if they wish
    addKeys(): void {

        // Create a keybaord - maybe make this a separate class at some point?
        // Create the 26 buttons to provide text input since I can't figure out how to make the DOM input field work properly
        const keyboardButtons: string[] = ['789', '456', '123', '-0.'];
        const keyPadding: number = 24;
        const buttonHeight: number = 120;
        const rowHeight: number = buttonHeight + keyPadding;
        const topPadding: number = 180 + buttonHeight / 2;
        const leftPadding: number = 690 / 2 - buttonHeight / 2

        keyboardButtons.forEach((row, rowIndex) => {
            row.split('').forEach((char: string, charIndex: number) => {
                const button: NineSliceButton = new NineSliceButton(this.scene, char);
                button.setButtonSize(buttonHeight, buttonHeight);
                button.setPosition(-leftPadding + (rowIndex * keyPadding) + (charIndex * (buttonHeight + keyPadding)), topPadding + rowHeight * rowIndex);
                this.keys.set(char, button);
                this.add(button);
            });
        });

        // Add a BACKSPACE button to the right of the top row of keys
        const backspaceButton: NineSliceButton = new NineSliceButton(this.scene, 'DEL');
        backspaceButton.setButtonSize(buttonHeight + 120, buttonHeight * 0.8);
        backspaceButton.setPosition(-leftPadding + (0 * keyPadding) + (3 * (buttonHeight + keyPadding)) + 75, topPadding + 0 * rowHeight);
        // backspaceButton.setInteractive({ useHandCuror: true });
        // backspaceButton.on('pointerup', () => {
        //     this.answerText.setText(this.answerText.text.slice(0, -1));
        // });
        this.keys.set('DELETE', backspaceButton);
        this.add(backspaceButton);

    }

    public makeInteractive(): void {

        this.keys.forEach((button: NineSliceButton, char: string) => {
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
                } else if (char === 'DELETE') {
                    // If 'DELETE' is pressed, remove the last character
                    this.answerText.setText(this.answerText.text.slice(0, -1));
                } else {
                    if (this.answerText.text === '0') {
                        // If current text is '0', replace it with the new character
                        this.answerText.setText(char);
                    } else {
                        // Otherwise, just append the character
                        this.answerText.setText(this.answerText.text + char);
                    }
                }
                // Truncate to a max length of 10 characters
                this.answerText.setText(this.answerText.text.slice(0, 10));
            });
        });

    }
    public makeNonInteracetive(): void {

        this.keys.forEach((button: NineSliceButton, char: string) => {
            button.removeAllListeners();
            button.disableInteractive();
        });

    }

    public getAnswerText(): string {
        return this.answerText.text;
    }
    public setAnswerText(text: string): void {
        this.answerText.setText(text);
    }

}
