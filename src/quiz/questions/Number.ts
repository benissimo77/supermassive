import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { Keypad } from "src/ui/Keypad";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { NumberQuestionData } from "./QuestionTypes";

export default class NumberQuestion extends BaseQuestion {

    private keypad: Keypad;
    private answerText: Phaser.GameObjects.Text;
    private submitButton: NineSliceButton;

    constructor(scene: BaseScene, questionData: NumberQuestionData) {
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

        console.log('NumberQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE);

        // Create answer options - answerHeight is total amount of space available but we must allow some padding top and bottom
        // For text questions its pretty simple - will likely have full height of 1080px since only displayed on player screen
        // ASK MODE:
        //  HOST we display a message 'Type your answer'
        //  PLAYER we display a text field and a keyboard
        // ANSWER MODE:
        //  HOST we display the answer text (in place of 'Type your answer')


        if (this.scene.TYPE != 'host') {

            this.keypad = new Keypad(this.scene);
            this.answerContainer.add(this.keypad);

            // Add a SUBMIT button - move to bottom corner to give more space for text display
            this.submitButton = new NineSliceButton(this.scene, 'SUBMIT');
            this.submitButton.setButtonSize(320, 80);
            this.answerContainer.add(this.submitButton);

            // We always want this to be interactive so just do it right away
            this.makeInteractive();

        }

        // For all screen types create an answerText object to display the answer
        // Used by HOST to display message, by player when submitting their answer
        // Note: font size of 120 is important since it matches the font size of the keypad text
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

        let scale:number = 1;

        // HOST display either the answer or a message to type answer
        // Text already placed at (0,0) so no need to re-position
        if (this.scene.TYPE === 'host') {
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

            // keypad is inside answerContainer which is positioned at 960 horizontally
            // We want to move keypad to the bottom of the screen, so use its own height to identify how much further to move it
            this.keypad.setScale(1);
            const keypadHeight: number = this.keypad.getBounds().height;
            // this.scene.socket?.emit('consolelog', `NumberQuestion::displayAnswerUI: scaleFactor=${scaleFactor} answerHeight=${answerHeight - 40} (${this.scene.getY(answerHeight - 40)}) keypadHeight=${keypadHeight} keypadWidth=${this.keypad.getBounds().width}`);

            // if not enough space then scale keypad down
            if (keypadHeight > this.scene.getY(answerHeight) - 40) {
                scale = (this.scene.getY(answerHeight) - 40) / keypadHeight;
                this.keypad.setScale(scale);
            } else {
                // more space can scale keypad up
                const scaleY: number = (this.scene.getY(answerHeight) - 40) / keypadHeight;
                const scaleX: number = (1920 - 80) / this.keypad.getBounds().width;
                scale = Math.min(scaleX, scaleY);
            }

            this.keypad.setScale(scale);
            this.keypad.setPosition(0, this.scene.getY(answerHeight) - 40 - this.keypad.getBounds().height);
            this.scene.socket?.emit('consolelog', `NumberQuestion::displayAnswerUI: scaleUP: scale=${scale} answerHeight=${answerHeight} (${this.scene.getY(answerHeight)}) OrigkeypadHeight=${keypadHeight} newScaledHeight: ${this.keypad.getBounds().height} scaledWidth=${this.keypad.getBounds().width}`);

            // Also scale the answerText since this should align with the keyboard answerText
            // I'm wondering if I should bite the bullet and split out the keyboard from the keyboard TEXT... pfff!
            this.answerText.setScale(scale);
            this.answerText.setPosition(0, this.keypad.y);

        }

        // DEBUG - add rectangle to originof the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);
    }

    protected makeInteractive(): void {

        this.keypad.makeInteractive();
        this.submitButton.setInteractive({ useHandCuror: true });
        this.submitButton.on('pointerup', () => {
            this.handleSubmit();
        });

    }
    protected makeNonInteractive(): void {
        this.keypad.makeNonInteracetive();
        this.submitButton.removeAllListeners();
        this.submitButton.disableInteractive();
    }

    private handleSubmit(): void {
        console.log('TextQuestion::createAnswerUI: Submit button clicked');
        let answer = this.keypad.getAnswerText() ? this.keypad.getAnswerText().trim() : '0';
        if (answer === '-') {
            answer = '0';
        }
        this.makeNonInteractive();
        this.submitAnswer(answer);

        // Display the answer to user for final confirmation (relies on existence of answerText - used by host also)
        this.answerText.setText(answer);
        this.answerText.setVisible(true);
        this.keypad.setAnswerText('');

        // Juice - animate the keypad out
        const tl = gsap.timeline();
        tl.to(this.submitButton, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        });
        tl.to(this.keypad, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        }, "<");
        tl.to(this.answerText, {
            scale: this.answerText.scale *  1.8,
            duration: 1.8,
            ease: 'power2.out'
        }, "<");
        tl.to(this.answerText, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        }, ">");
        tl.add(() => {
            this.scene.sound.play('submit-answer');
        }, "<+0.25");
        tl.play();
    }

    protected revealAnswerUI(): void {
        if (this.questionData.answer) {
            const answerText = this.questionData.answer.toString();
            this.answerText.setText(answerText);
        }
    }


    public destroy(): void {
        if (this.keypad) {
            this.keypad.destroy();
        }
        if (this.submitButton) {
            this.submitButton.destroy();
        }
        super.destroy();
    }

}