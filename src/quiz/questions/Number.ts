import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { Keypad } from "src/ui/Keypad";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { createSubmitButton, positionSubmitButton } from "src/utils/SubmitButton";
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

            // For host we just create an answerText object to display the answer
            const answerStyle: Phaser.Types.GameObjects.Text.TextStyle = {
                fontSize: 96,
            }
            const answerConfig: Phaser.Types.GameObjects.Text.TextStyle = Object.assign({}, this.scene.labelConfig, answerStyle);
            this.answerText = this.scene.add.text(0, 0, '', answerConfig)
                .setOrigin(0.5);
            this.answerContainer.add([this.answerText]);
        }


        // DEBUG - add rectangle to originof the answer container
        const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        this.answerContainer.add(debugRect);
    }

    protected displayAnswerUI(answerHeight: number): void {


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
            answerHeight -= 80 * scaleFactor;

            // keypad is inside answerContainer which is positioned at 960 horizontally
            // We want to move keypad to the bottom of the screen, so use its own height to identify how much further to move it
            this.keypad.setScale(1);
            const keypadHeight:number = this.keypad.getBounds().height;
            this.scene.socket?.emit('consolelog', `NumberQuestion::displayAnswerUI: scaleFactor=${scaleFactor} answerHeight=${answerHeight - 40} (${this.scene.getY(answerHeight - 40)}) keypadHeight=${keypadHeight} keypadWidth=${this.keypad.getBounds().width}`);
            
            // if not enough space then scale keypad down
            if (keypadHeight > this.scene.getY(answerHeight) - 40) {
                const scale:number = (this.scene.getY(answerHeight) - 40) / keypadHeight;
                this.keypad.setScale(scale);
            } else {
                // more space can scale keypad up
                const scaleY:number = (this.scene.getY(answerHeight) - 40) / keypadHeight;
                const scaleX:number = (1920 - 80) / this.keypad.getBounds().width;
                const scale:number = Math.min(scaleX, scaleY);
                this.keypad.setScale(scale);
                this.scene.socket?.emit('consolelog', `NumberQuestion::displayAnswerUI: scaleUP: answerHeight=${answerHeight} (${this.scene.getY(answerHeight)}) OrigkeypadHeight=${keypadHeight} newScaledHeight: ${this.keypad.getBounds().height} scaledWidth=${this.keypad.getBounds().width}`);
            }
            this.keypad.setPosition(0, this.scene.getY(answerHeight) - 40 - this.keypad.getBounds().height);

        }

        // DEBUG - add rectangle to originof the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);
    }

    protected makeInteractive(): void {

        this.keypad.makeInteractive();
        this.submitButton.setInteractive({ useHandCuror: true });
        this.submitButton.on('pointerup', () => {
            console.log('TextQuestion::createAnswerUI: Submit button clicked');
            let answer = this.keypad.getAnswerText() ? this.keypad.getAnswerText().trim() : '0';
            if (answer === '-') {
                answer = '0';
            }
            this.makeNonInteractive();
            this.submitAnswer(answer);

            // Juice - animate the keypad out
            const tl = gsap.timeline();
            tl.to(this.submitButton, {
                x: 2400,
                duration: 0.5,
                ease: 'back.in'
            });
            tl.to(this.keypad, {
                y: 2160,
                duration: 0.5,
                ease: 'power2.in',
                stagger: 0.05
            }, "<");
            tl.play();
        });

    }
    protected makeNonInteractive(): void {
        this.keypad.makeNonInteracetive();
        this.submitButton.removeAllListeners();
        this.submitButton.disableInteractive();
    }

    public destroy(): void {
        this.keypad.destroy();
        this.submitButton.destroy();
        super.destroy();
    }

}