import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { MultipleChoiceQuestionData } from "./QuestionTypes";
import { PhaserPlayer } from "../PhaserPlayer";

export default class MultipleChoiceQuestion extends BaseQuestion {

    private buttons: Map<string, NineSliceButton> = new Map<string, NineSliceButton>();
    protected questionData: MultipleChoiceQuestionData;

    constructor(scene: BaseScene, questionData: MultipleChoiceQuestionData) {
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

        console.log('MultipleChoiceQuestion::createAnswerUI:', this.questionData);
        this.questionData.optionsShuffled.forEach((option: string, index: number) => {
            const newButton: NineSliceButton = new NineSliceButton(this.scene, option);

            this.buttons.set(option, newButton);
            this.answerContainer.add(newButton);

        });

        // Make interactive if we are in ask mode and player screen
        if (this.questionData.mode == 'ask' && this.scene.TYPE != 'host') {
            this.makeInteractive();
        }

        // DEBUG - add rectangle to originof the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);
    }

    protected displayAnswerUI(answerHeight: number): void {

        const isPortrait = this.scene.isPortrait();
        const scaleFactor = this.scene.getUIScaleFactor();

        // Experiment with making padding a proportion of available space
        // And if we have a LOT of space then make the padding larger otherwise it spreads out too much vertically
        let paddingHeight: number = answerHeight / 8;
        if (answerHeight > 640) {
            paddingHeight = answerHeight / 6;
        }
        const availableHeight: number = answerHeight - 2 * paddingHeight;


        // This is still not that much simpler, but uses a better responsive layout
        // Especially for landscape/portrait on mobile
        const numRows = isPortrait ? this.questionData.optionsShuffled.length : Math.ceil(this.questionData.optionsShuffled.length / 2);
        const numColumns = isPortrait ? 1 : 2;
        const buttonSpace = availableHeight / numRows;

        console.log('MultipleChoiceQuestion::displayAnswerUI:', this.questionData.mode, this.scene.TYPE, availableHeight, buttonSpace);

        this.questionData.optionsShuffled.forEach((option: string, index: number) => {

            const rowCount: number = Math.floor(index / numColumns);
            const y = paddingHeight + rowCount * buttonSpace + buttonSpace / 2;
            const x = isPortrait ? 0 : -480 + 960 * (index % numColumns);

            console.log('MultipleChoiceQuestion::displayAnswerUI:', option, x, y);

            const newButton: NineSliceButton | undefined = this.buttons.get(option);
            if (newButton) {
                newButton.setButtonSize(800 * scaleFactor, 120 * scaleFactor);
                newButton.setPosition(x, this.scene.getY(y));
                newButton.setTextSize(48 * scaleFactor);
            }

        });

        // DEBUG - add rectangle to originof the answer container
        //const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        //this.answerContainer.add(debugRect);

        console.log('MultipleChoiceQuestion::DONE');


    }

    protected revealAnswerUI(): void {

        console.log('MultipleChoiceQuestion::revealAnswerUI:', this.questionData);
        const tl = this.minimizeQuestionContent();
        const playerOptions: { [key: string]: string[] } = {};

        // If we have responses data then we can generate an animation to show who guessed what
        if (this.questionData.responses) {

            // Tween the buttons into a vertical stack on the left side of the screen
            // Then tween the player avatars to the right of the buttons aligned with their chosen answer
            // Players are in the playerContainer which is at (0,0) while answerContainer is at (960,0)

            // For ease of tweening we will re-organize the player responses into a dictionary of answer -> [sessionID,...]
            // This way we already know how many players chose each answer and can space them out accordingly
            for (const [option, button] of this.buttons) {
                const playersForThisOption: string[] = [];
                for (const [sessionID, playerAnswer] of Object.entries(this.questionData.responses)) {
                    if (playerAnswer.answer === option) {
                        playersForThisOption.push(sessionID);
                    }
                }
                console.log('MultipleChoiceQuestion::revealAnswerUI: option:', option, 'playersForThisOption:', playersForThisOption);
                playerOptions[option] = playersForThisOption;
            }

            // Since answerContainer.y is in real pixels then we keep buttonHeight the same (no need to getY later) 
            const buttonHeight = (this.scene.getY(1080) - this.answerContainer.y) / this.questionData.optionsShuffled.length;
            const answerX = -480;
            tl.addLabel("PositionButtons");
            this.questionData.optionsShuffled.forEach((option: string, optionIndex: number) => {
                const button = this.buttons.get(option);
                if (button) {
                    const targetY = optionIndex * buttonHeight + buttonHeight/2;
                    tl.to(button, {
                        x: answerX,
                        y: targetY,
                        duration: 0.5,
                        ease: 'power2.out'
                    }, "PositionButtons");
                }
            });

            // Now repeat the above loop in order to position player avatars
            const avatarX = 960;
            const avatarY: number = this.answerContainer.y;
            tl.addLabel("PositionPlayers", ">+0.5");
            this.questionData.optionsShuffled.forEach((option: string, optionIndex: number) => {
                const button = this.buttons.get(option);
                if (button) {
                    const targetY = optionIndex * buttonHeight + buttonHeight/2;
                    // Now position any player avatars who chose this answer
                    const numPlayersForOption = playerOptions[option].length;
                    const avatarSpacing:number = Math.min(200, 960 / numPlayersForOption);
                    playerOptions[option].forEach((sessionID, playerIndex) => {
                        const player: Phaser.GameObjects.Container = this.scene.getPlayerBySessionID(String(sessionID));
                        if (player) {
                            tl.add(() => {
                                player.parentContainer.bringToTop(player);
                            }, "PositionPlayers");
                            tl.to(player, {
                                x: avatarX + playerIndex * avatarSpacing,
                                y: avatarY + targetY,
                                duration: 0.6,
                                delay: 0.2 * playerIndex,
                                ease: 'power2.out'
                            }, "PositionPlayers");
                        } else {
                            console.log('MultipleChoiceQuestion::revealAnswerUI: WARNING - player avatar not found for sessionID:', sessionID);
                        }
                    });
                }
            });
        }
        if (this.questionData.answer) {
            tl.add(() => {
                this.highlightAnswer(this.questionData.answer);
            }, ">+0.5");

            // Add flashText to players who provided a response
            // Rely on the score field sent from server as this is our source of truth
            tl.addLabel("ShowScores", ">+0.5");
            for (const [sessionID, playerAnswer] of Object.entries(this.questionData.responses)) {
                const player: PhaserPlayer = this.scene.getPlayerBySessionID(String(sessionID)) as PhaserPlayer;
                if (player) {
                    tl.add(() => {
                        if (playerAnswer.snoozed) {
                            tl.add(() => {
                                player.flashText('Z', '#ff0000');
                            }, "ShowScores");
                            tl.add(() => {
                                player.flashText('Z', '#ff0000');
                            }, "ShowScores+=0.5");
                            tl.add(() => {
                                player.flashText('Z', '#ff0000');
                            }, "ShowScores+=1.0");
                            tl.add(() => {
                                player.flashText('Z', '#ff0000');
                            }, "ShowScores+=1.5");
                        } else {
                            player.flashText(playerAnswer.score, '#00ff00');
                        }
                    }, "ShowScores");
                }
            });
        }
        tl.play();
    }

    protected highlightAnswer(correctAnswer: string): void {

        for (const [option, button] of this.buttons) {
            button.setAlpha(0.5);
            if (option ===  correctAnswer) {
                button.setHighlight();
                this.answerContainer.bringToTop(button);
            }
        }
    }

    protected makeInteractive(): void {

        this.buttons.forEach((button, option) => {

            // NOTE: for pixel-perfect timing of animation with audio we should build in a short delay to the audio track
            // to allow for the "back.in" easing which starts slowly
            // Maybe record a 'instant swoosh' and 'delayed swoosh' to align with a 0.5s back.in tween to y=2160
            // As it is I've done it with two separate delayed calls which allows more precision but its a bit much 
            button.setInteractive({ useHandCursor: true });
            button.on('pointerup', () => {
                this.makeNonInteractive();
                this.submitAnswer(option);
                this.highlightAnswer(option);
                const tl = gsap.timeline();
                tl.to(this.answerContainer, {
                    y: this.scene.getY(2160),
                    duration: 0.5,
                    ease: 'back.in'
                }, "+1.0");
                tl.add(() => {
                    this.scene.soundManager.playFX('submit-answer');
                }, "<+0.25");
                tl.play();
            });
        });

    }

    protected makeNonInteractive(): void {
        this.buttons.forEach((button) => {
            button.disableInteractive();
            button.removeAllListeners();
        });
    }


}