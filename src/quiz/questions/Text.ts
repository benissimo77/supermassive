import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { TextQuestionData } from "./QuestionTypes";

import { Keyboard } from "src/ui/Keyboard";

export default class TextQuestion extends BaseQuestion {

    private keyboard: Keyboard;
    private answerText: Phaser.GameObjects.Text;
    private submitButton: NineSliceButton;

    constructor(scene: BaseScene, questionData: TextQuestionData) {
        super(scene, questionData);
    }

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
    protected createAnswerUI(): void {

        console.log('TextQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE, this.scene.getScaleFactor());

        // Create answer options - answerHeight is total amount of space available but we must allow some padding top and bottom
        // ASK MODE:
        // HOST display message 'Type your answer'
        // PLAY/SOLO display text field and a keyboard
        // ANSWER MODE:
        // HOST/SOLO display the answer text (in place of 'Type your answer')

        // Calculations for the keyboard size and layout:
        // Expand to fill the screen width, keep the keyboard justified to the bottom of the screen
        // Since we can calculate exactly what the height of the keyboard will be (since we know the key size based on width)
        // We just create at that size, and only in cases where vertical height is less than that we adjust it...

        // On very wide screens, height will max out and then keyboard will be centred but get no larger
        // So if calculated size based on width ends up too high then height becomes limiting factor
        // Top third of screen (360) reserved for answer text, bottom two thirds (720)for keyboard
        // So the maximum size of a key is either the width divided by 16 (for ~14 keys plus padding) or the height divided by 6 (for 6 rows)

        if (this.scene.TYPE != 'host') {

            this.keyboard = new Keyboard(this.scene);
            this.answerContainer.add(this.keyboard);

            // Add a SUBMIT button - move to bottom corner to give more space for text display
            this.submitButton = new NineSliceButton(this.scene, 'SUBMIT');
            this.answerContainer.add(this.submitButton);

            // We always want this to be interactive so just do it right away
            this.makeInteractive();
        }

        // For all screen types we create an answerText object to display the answer
        const answerStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: 120,
        }
        const answerConfig: Phaser.Types.GameObjects.Text.TextStyle = Object.assign({}, this.scene.labelConfig, answerStyle);
        this.answerText = this.scene.add.text(0, 0, '', answerConfig)
            .setOrigin(0.5, 0);
        this.answerContainer.add([this.answerText]);

        // DEBUG - add rectangle to originof the answer container
        const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        this.answerContainer.add(debugRect);
    }


    protected displayAnswerUI(answerHeight: number): void {

        console.log('TextQuestion::displayAnswerUI:', this.questionData.mode, this.scene.TYPE, answerHeight, this.scene.getScaleFactor(), answerHeight * this.scene.getScaleFactor());

        // Create answer options - answerHeight is total amount of space available but we must allow some padding top and bottom
        // ASK MODE:
        // HOST display message 'Type your answer'
        // PLAY/SOLO display text field and a keyboard
        // ANSWER MODE:
        // HOST/SOLO display the answer text (in place of 'Type your answer')

        // Calculations for the keyboard size and layout:
        // Expand to fill the screen width, keep the keyboard justified to the bottom of the screen
        // Since we can calculate exactly what the height of the keyboard will be (since we know the key size based on width)
        // We just create at that size, and only in cases where vertical height is less than that we adjust it...

        // On very wide screens, height will max out and then keyboard will be centred but get no larger
        // So if calculated size based on width ends up too high then height becomes limiting factor
        // Top third of screen (360) reserved for answer text, bottom two thirds (720)for keyboard
        // So the maximum size of a key is either the width divided by 16 (for ~14 keys plus padding) or the height divided by 6 (for 6 rows)

        let scale:number = 1;

        if (this.scene.TYPE === 'host') {
            // Display the answer text
            let answerText: string = '';
            if (this.questionData.mode == 'answer' && this.questionData.answer !== undefined) {
                answerText = this.questionData.answer.toString();
            } else {
                answerText = 'Type your answer';
                answerText = '';
            }
            this.answerText.setText(answerText);

        } else {

            // Position and scale the keypad and submit button
            // In Portrait mode submit button is larger and answerheight is reduced
            const scaleFactor: number = this.scene.getUIScaleFactor();
            this.submitButton.setButtonSize(320 * scaleFactor, 80 * scaleFactor);
            this.submitButton.setTextSize(46 * scaleFactor);
            this.submitButton.setPosition(960 - 160 * scaleFactor - 20, this.scene.getY(answerHeight) - 40 * scaleFactor - 20);

            // for portrait mode we can safely reduce answer height as we have loads of space
            if (scaleFactor > 1) {
                answerHeight -= 80 * scaleFactor;
            }

            // keyboard is inside answerContainer which is positioned at 960 horizontally
            // We want to move keyboard to the bottom of the screen, so use its own height to identify how much further to move it
            this.keyboard.setScale(1);
            const keyboardHeight: number = this.keyboard.getBounds().height;
            this.scene.socket?.emit('consolelog', `NumberQuestion::displayAnswerUI: scaleFactor=${scaleFactor} answerHeight=${answerHeight - 40} (${this.scene.getY(answerHeight - 40)}) keyboardHeight=${keyboardHeight} keyboardWidth=${this.keyboard.getBounds().width}`);

            // if not enough space then scale keyboard down
            if (keyboardHeight > this.scene.getY(answerHeight) - 40) {
                scale = (this.scene.getY(answerHeight) - 40) / keyboardHeight;
            } else {
                // more space can scale keyboard up
                const scaleY: number = (this.scene.getY(answerHeight) - 40) / keyboardHeight;
                const scaleX: number = (1920 - 80) / this.keyboard.getBounds().width;
                scale = Math.min(scaleX, scaleY);
            }

            this.keyboard.setScale(scale);
            this.keyboard.setPosition(0, this.scene.getY(answerHeight) - 40 - this.keyboard.getBounds().height);
            this.scene.socket?.emit('consolelog', `AFTER scaling: answerHeight=${answerHeight} (${this.scene.getY(answerHeight)}) OrigkeyboardHeight=${keyboardHeight} newScaledHeight: ${this.keyboard.getBounds().height} scaledWidth=${this.keyboard.getBounds().width}`);

            // Also scale the answerText since this should align with the keyboard answerText
            // I'm wondering if I should bite the bullet and split out the keyboard from the keyboard TEXT... pfff!
            this.answerText.setScale(scale);
            this.answerText.setPosition(0, this.keyboard.y);
        }

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

    protected makeInteractive(): void {

        this.keyboard.makeInteractive();
        this.submitButton.setInteractive({ useHandCuror: true });
        this.submitButton.on('pointerup', () => {
            this.handleSubmit();
        });

    }
    protected makeNonInteractive(): void {
        this.keyboard.makeNonInteractive();
        this.submitButton.removeAllListeners();
        this.submitButton.disableInteractive();
    }

    protected handleSubmit(): void {
        console.log('TextQuestion::createAnswerUI: Submit button clicked');
        let answer = this.keyboard.getAnswerText() ? this.keyboard.getAnswerText().trim() : '';
        this.makeNonInteractive();
        this.submitAnswer(answer);

        // Display the answer to user for final confirmation (relies on existence of answerText - used by host also)
        this.answerText.setText(answer);
        this.answerText.setVisible(true);
        this.keyboard.setAnswerText('');

        // Juice - animate the keyboard and submit button (then later, answerText) out
        const tl = gsap.timeline();
        tl.to(this.submitButton, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        });
        tl.to(this.keyboard, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        }, "<");
        tl.to(this.answerText, {
            scale: this.answerText.scale * 1.8,
            duration: 1.8,
            ease: 'power2.out'
        }, "<");
        tl.to(this.answerText, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        }, ">");
        tl.add(() => {
            this.scene.soundManager.playFX('submit-answer');
        }, "<+0.25");
        tl.play();
    }

    protected revealAnswerUI(): void {
        if (this.questionData.answer) {
            const answerText = this.questionData.answer.toString();
            this.answerText.setText(answerText);
        }
    }

    // Note that destroy can be called from HOST or PLAYER screen so must consider both paths
    public destroy(): void {

        if (this.keyboard) {
            this.keyboard.destroy();
        }
        if (this.submitButton) {
            this.submitButton.destroy();
        }
        super.destroy();
    }

}