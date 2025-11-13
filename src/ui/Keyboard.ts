import { NineSliceButton } from "./NineSliceButton";
import { BaseScene } from "src/BaseScene";

/**
 * Keyboard - Full QWERTY keyboard for text input (Multi-Game Utility)
 * 
 * Layout:
 * - Number row (0-9)
 * - QWERTY row (10 keys)
 * - ASDFGHJKL row (9 keys, offset)
 * - ZXCVBNM row (7 keys, offset)
 * - SPACE + DELETE at bottom
 * 
 * Usage (same as Keypad):
 *   const keyboard = new Keyboard(scene);
 *   keyboard.makeInteractive();
 *   const answer = keyboard.getAnswerText();
 *   keyboard.makeNonInteractive();
 */
export class Keyboard extends Phaser.GameObjects.Container {

    declare public scene: BaseScene;
    private answerText: Phaser.GameObjects.Text;
    private keys: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();

    constructor(scene: BaseScene) {
        super(scene);

        this.scene = scene;

        // Create the keyboard layout
        this.addKeys();

        // Add the answer text (above keyboard)
        // Note: this is one time we DON'T use getY for positioning since we rely on an overall scale factor
        // for the keyboard to determine the correct space - here we fix everything
        const answerStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: 120,
        };
        const answerConfig: Phaser.Types.GameObjects.Text.TextStyle = Object.assign({}, this.scene.labelConfig, answerStyle);
        this.answerText = this.scene.add.text(0, 0, '', answerConfig)
            .setOrigin(0.5, 0);
        this.add(this.answerText);

        // Add the container to the scene
        scene.add.existing(this);

        // DEBUG - add rectangle to origin of the container
        const debugRect = this.scene.add.rectangle(0, 0, 15, 15, 0xff0000, 1).setOrigin(0.5);
        this.add(debugRect);
    }

    /**
     * Add all keyboard keys with QWERTY layout
     * Fixed logical size - calling class can scale
     */
    private addKeys(): void {

        const keyPadding = 24;
        const buttonSize = 120;
        const deleteButtonWidth = buttonSize + 120;
        const deleteButtonHeight = buttonSize * 0.8;
        const rowHeight = buttonSize + keyPadding;
        const topPadding = 240; // Space for answer text + a gap

        // Define all letter/number rows (QWERTY layout)
        const keyboardRows = [
            '1234567890',  // Number row
            'QWERTYUIOP',  // Top letter row
            'ASDFGHJKL',   // Middle letter row
            'ZXCVBNM'      // Bottom letter row
        ];

        // Calculate widest row (number row + DELETE button)
        const numberRowWidth = keyboardRows[0].length * (buttonSize + keyPadding) + deleteButtonWidth;
        
        // Create all rows in one loop (like Keypad)
        keyboardRows.forEach((row, rowIndex) => {

            let rowWidth = row.length * (buttonSize + keyPadding) - keyPadding;

            if (rowIndex == 0) {
                rowWidth = numberRowWidth;
            }

            // Center this row within the max row width
            const rowOffset = - rowWidth / 2;
            const rowStartX = rowOffset + buttonSize / 2;

            row.split('').forEach((char, charIndex) => {
                const button = new NineSliceButton(this.scene, char, { fontFamily: 'Verdana', strokeThickness: 0 });
                button.setButtonSize(buttonSize, buttonSize);
                button.setPosition(
                    rowStartX + charIndex * (buttonSize + keyPadding),
                    topPadding + rowIndex * rowHeight
                );
                this.keys.set(char, button);
                this.add(button);
            });
        });
        
        // DELETE button (to right of number row)
        const numberRowOffset = - numberRowWidth / 2;
        const numberRowStartX = numberRowOffset;

        const deleteButton = new NineSliceButton(this.scene, 'DEL', { fontFamily: 'Verdana', color: '#ffffff' });
        deleteButton.setButtonSize(deleteButtonWidth, deleteButtonHeight);
        deleteButton.setPosition(
            numberRowStartX + keyboardRows[0].length * (buttonSize + keyPadding) + deleteButtonWidth / 2,
            topPadding + 0 * rowHeight  // Row 0 (number row)
        );
        this.keys.set('DELETE', deleteButton);
        this.add(deleteButton);

        // SPACE button (wide, bottom row)
        const spaceButton = new NineSliceButton(this.scene, 'SPACE', { fontFamily: 'Verdana' });
        spaceButton.setButtonSize(buttonSize * 8, buttonSize);
        spaceButton.setPosition(0, topPadding + keyboardRows.length * rowHeight);
        this.keys.set('SPACE', spaceButton);
        this.add(spaceButton);
    }

    /**
     * Make keyboard interactive (add click handlers)
     */
    public makeInteractive(): void {
        this.keys.forEach((button: NineSliceButton, char: string) => {
            button.setInteractive({ useHandCuror: true });
            button.on('pointerup', () => {
                if (char === 'DELETE') {
                    // Remove last character
                    this.answerText.setText(this.answerText.text.slice(0, -1));
                } else if (char === 'SPACE') {
                    // Add space (if not at start or after existing space)
                    if (this.answerText.text.length > 0 && !this.answerText.text.endsWith(' ')) {
                        this.answerText.setText(this.answerText.text + ' ');
                    }
                } else {
                    // Add character (letter or number)
                    this.answerText.setText(this.answerText.text + char);
                }
                
                // Truncate to max length of 20 characters
                this.answerText.setText(this.answerText.text.slice(0, 20));
            });
        });
    }

    /**
     * Make keyboard non-interactive (remove click handlers)
     */
    public makeNonInteractive(): void {
        this.keys.forEach((button: NineSliceButton) => {
            button.disableInteractive();
            button.removeAllListeners();
        });
    }

    /**
     * Get current answer text
     */
    public getAnswerText(): string {
        return this.answerText.text;
    }
    public setAnswerText(text: string): void {
        this.answerText.setText(text);
    }
    // getAnswerPosition
    // Returns the position in world coordinates of the answer text (for animation purposes)
    public getAnswerPosition(): number {
        return this.answerText.getBounds().y + this.y;
    }
}
