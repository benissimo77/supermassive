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


    protected showAnswerContent(answerHeight: number): void {

        console.log('TextQuestion::showAnswerContent:', this.questionData.mode, this.scene.TYPE, answerHeight, this.scene.getScaleFactor(), answerHeight * this.scene.getScaleFactor());

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
            this.scene.socket?.emit('consolelog', `TextQuestion::showAnswerContent: scaleFactor=${scaleFactor} answerHeight=${answerHeight - 40} (${this.scene.getY(answerHeight - 40)}) keyboardHeight=${keyboardHeight} keyboardWidth=${this.keyboard.getBounds().width}`);

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
        const keys = this.keyboard.getKeys();
        if (keys.has(event.code)) {
            const keyButton = keys.get(event.code);
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

    public createRevealAnswerTimeline(): gsap.core.Timeline {
		const tl = this.minimizeQuestionContent();
        this.tl = tl;
        const answerTextStr = this.questionData.answer ? this.questionData.answer.toString() : '';

        // Add the correct answer at the top or center of the screen
        if (this.questionData.answer) {
            tl.add(() => {
                this.answerText.setText(answerTextStr);
                this.answerText.setPosition(0, this.scene.getY(40));
                // Set to 1 then tween from 0
                this.answerText.setScale(1.0);
                this.answerText.setAlpha(1.0);
            });
            // Pop the answer in
            tl.from(this.answerText, {
                scale: 0,
                alpha: 0,
                duration: 0.6,
                ease: 'back.out(1.5)'
            }, 0);
        }

        // Layout logic if we're showing players' text answers
        if (this.questionData.responses) {
            const numPlayers = Object.keys(this.questionData.responses).length;
            
            // Sort so players appear in alphabetical order rather than random join order
            const sortedSessions = Object.keys(this.questionData.responses).sort((a, b) => {
                const aName = this.scene.getPlayerConfigsAsArray().find(p => p.sessionID === a)?.name || '';
                const bName = this.scene.getPlayerConfigsAsArray().find(p => p.sessionID === b)?.name || '';
                return aName.localeCompare(bName);
            });
            console.log('TextQuestion::createRevealAnswerTimeline: sorting players:', sortedSessions);
            
            // Where the answerContainer will globally land after minimizeQuestionContent
            const answerY = this.getTargetAnswerContainerY();
            // Local startY allows to adjust vertical position of player answers grid
            let startY = 240;
            // Calculate dynamic row height to fit all players in a single column
            const availableSpace = this.scene.getY(1080) - answerY - startY;
            const maxRowHeight = 120; // Default comfortable row height
            const rowHeight = numPlayers > 0 ? Math.min(maxRowHeight, availableSpace / numPlayers) : maxRowHeight;

            // If we have lots of space then vertically centre the player answers in the available space
            if (rowHeight * numPlayers < availableSpace) {
                startY += (availableSpace - (rowHeight * numPlayers)) / 2;
            }
            
            sortedSessions.forEach((sessionID, index) => {
                const playerAnswer = this.questionData.responses![sessionID];
                const player = this.scene.getPlayerBySessionID(sessionID);
                if (!player) return;

                // All horizontal logic uses the logical 1920 canvas width
                const avatarScreenX = 160; 
                // Avatar Y is global, so it must account for answerContainer's target position
                const avatarScreenY = answerY + startY + (index * rowHeight);

                tl.to(player, {
                    x: avatarScreenX,
                    y: avatarScreenY,
                    // No scaling of global objects!
                    duration: 0.5,
                    ease: 'power2.out'
                }, '>');

                // Group for their answer text and validation. 
                // Since this object is added to answerContainer (at x=960), we offset its local X.
                const localGroupX = (avatarScreenX - 960) + 480;
                const localGroupY = startY + (index * rowHeight);

                const playerTextGroup = this.scene.add.container(localGroupX, localGroupY);
                this.answerContainer.add(playerTextGroup);

                const rawAns = playerAnswer.answer ? playerAnswer.answer.toString() : '';
                const displayAns = rawAns.trim() === '' ? '...' : rawAns;
                
                // Color coding based on server score (which we trust completely)
                let color = '#ff0000'; // Default wrong (red)
                let iconText = '❌';

                if (playerAnswer.snoozed) {
                    color = '#aaaaaa'; // Grey out snoozed
                    iconText = '💤';
                } else if (playerAnswer.score > 0) {
                    color = '#00ff00'; // Green if correct
                    iconText = '✅';
                }

                const icon = this.scene.add.text(0, 0, iconText, {
                    fontSize: 48
                }).setOrigin(0.5, 0.5);
                playerTextGroup.add(icon);

                const ansText = this.scene.add.text(45, 0, displayAns, {
                    fontFamily: '"Titan One", Arial',
                    fontSize: 54,
                    color: color,
                    stroke: '#000000',
                    strokeThickness: 4,
                    align: 'left'
                }).setOrigin(0, 0.5);
                playerTextGroup.add(ansText);

                // Start them invisible and slightly off to the right
                playerTextGroup.setAlpha(0);
                playerTextGroup.setX(localGroupX + 50);
                
                // Fade and slide in the player's text and icon
                tl.to(playerTextGroup, {
                    alpha: 1,
                    x: localGroupX,
                    duration: 0.4,
                    ease: 'power2.out'
                }, '<+0.2'); // Start sliding in slightly after the avatar starts moving
            });
        }

        return tl;
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