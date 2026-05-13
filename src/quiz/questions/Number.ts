import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { Keypad } from "src/ui/Keypad";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { NumberQuestionData } from "./QuestionTypes";
import { PlayerConfig, PhaserPlayer, PhaserPlayerState } from "../PhaserPlayer";

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

    protected showAnswerContent(answerHeight: number): void {

        let scale: number = 1;

        // HOST display either the answer or a message to type answer
        // Text already placed at (0,0) so no need to re-position
        if (this.scene.TYPE === 'host') {
            let answerText: string = '';
            if (this.questionData.mode == 'ask') {
                answerText = 'Type your answer';
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
            // this.scene.socket?.emit('consolelog', `NumberQuestion::showAnswerContent: scaleFactor=${scaleFactor} answerHeight=${answerHeight - 40} (${this.scene.getY(answerHeight - 40)}) keypadHeight=${keypadHeight} keypadWidth=${this.keypad.getBounds().width}`);

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
            this.scene.socket?.emit('consolelog', `NumberQuestion::showAnswerContent: scaleUP: scale=${scale} answerHeight=${answerHeight} (${this.scene.getY(answerHeight)}) OrigkeypadHeight=${keypadHeight} newScaledHeight: ${this.keypad.getBounds().height} scaledWidth=${this.keypad.getBounds().width}`);

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
        this.keypad.makeNonInteractive();
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
        this.tl = gsap.timeline();
        const tl = this.tl;
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

    // reveal answer - this is the BIG one, a fairly complex timeline animation that places all player guesses onto a central line
    // guesses are added one player at a time with all avatars responding and scaling along the line as each new player guess is added
    // KEY INSIGHT to build the timeline:
    // Players are pulled randomly from the responses object - this maintains randomness
    // A currentMin and currentMax are maintained which represent the min/max of the added player responses
    // These are positioned on the line based on the number of players added:
    // Divide the total line length (80 - 1920-80-320) by number of players added + 1
    // So first player added, you divide the line by 2 to give the spacing amount
    // currentMin is logically set to 80 + currentSpacing, currentMax to 1920-80-320 - currentSpacing
    // Player is added in the dead centre of the line (so currentMin+currentMax/2)
    // Then current player guess is added - currentMin/currentMax adjusted if this player exceed the existing bounds
    // Then all player avatars, including currentPlayer, are re-positioned based on the new currentMin/Max

    private createExactRevealAnswerTimeline(): gsap.core.Timeline {
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

        tl.pause();
        return tl;
    }

    public createRevealAnswerTimeline(): gsap.core.Timeline {

        if (this.questionData.type === 'number-exact') {
            return this.createExactRevealAnswerTimeline();
        }

        const tl = this.minimizeQuestionContent();
        this.tl = tl;
        
        // For this quesiton type we will set answerContainer to 960,549 (logical) as base everything off that
        tl.to(this.answerContainer, {
            y: this.scene.getY(540),
            duration: 0.5
        });
        // For neatness move all players to the bottom of the screen first
        this.scene.getPlayerConfigsAsArray().forEach( (playerConfig) => {
            const player: PhaserPlayer = this.scene.getPlayerBySessionID(playerConfig.sessionID) as PhaserPlayer;
            tl.to(player, {
                x: Math.random() * (1920 - 320),
                y: this.scene.getY(1080 - 20),
                duration: 0.5
            }, 0); // all at once
        });

        // Animate the main number line - a graphics which scales from 0 to full width
        const numberLine: Phaser.GameObjects.Rectangle = this.scene.add.rectangle(-960, 0, 0, 4, 0x00ff00, 1);
        this.answerContainer.add(numberLine);
        tl.to(numberLine, {
            width: 1920,
            duration: 0.5,
            ease: 'power2.out'
        }, '<');

        // Set up all the variables we need to manage player positioning
        // These are defined at the top since we also need these further down after players have been added
        const xMin: number = 0;
        const xMax: number = 1920;
        let playersAdded: string[] = [];
        let playerGuesses: Map<string, Phaser.GameObjects.Container> = new Map();
        let currentMin: number | undefined;
        let currentMax: number | undefined;
        let currentSpacing: number = 0;

        const tweenAllPlayersToPositions = (subTl: gsap.core.Timeline) => {
            subTl.add('Label');
            for (const thisSessionID of playersAdded) {
                const thisPlayer: PhaserPlayer = this.scene.getPlayerBySessionID(thisSessionID) as PhaserPlayer;
                const thisPlayerResponse = this.questionData.responses ? this.questionData.responses[thisSessionID] : null;
                const thisPlayerGuess = thisPlayerResponse ? Number(thisPlayerResponse.answer) : 0;

                // Experiment with using gsap utils here - I've already sovled it but now I'm curious
                const mapper = gsap.utils.mapRange(currentMin!, currentMax!, xMin + currentSpacing, xMax - currentSpacing);
                if (thisPlayer && thisPlayerResponse) {
                    // Calculate target X based on current min/max spread
                    // currentMin sits at (xMin + currentSpacing)
                    // currentMax sits at (xMax - currentSpacing)
                    // targetX = xMin + currentSpacing + ((thisPlayerGuess - currentMin) / (currentMax - currentMin)) * (xMax - xMin)
                    // let targetX = xMin + currentSpacing + ((thisPlayerGuess - currentMin) / Math.max(currentMax - currentMin, 1)) * (xMax - 2 * currentSpacing);
                    let targetX = mapper(thisPlayerGuess);
                    subTl.to(thisPlayer, {
                        x: targetX,
                        duration: 0.5
                    }, 'Label');
                    // Also update this playerGuess label (must subtract 960 since answerContainer is centred)
                    const thisPlayerGuessContainer = playerGuesses.get(thisSessionID);
                    if (thisPlayerGuessContainer) {
                        subTl.to(thisPlayerGuessContainer, {
                            x: targetX - 960,
                            duration: 0.5
                        }, 'Label');
                    } else {
                        console.log('WARNING - playerGuessContainer not found for sessionID:', thisSessionID);
                    }
                }
            }            
        }

        const addPlayerToLine = (sessionID: string, answer: number): gsap.core.Timeline => {
            const subTl = gsap.timeline();

            // Add the player to the playersAdded array, and create a guess label for them (hidden for now)
            playersAdded.push(sessionID);
            const playerGuess:Phaser.GameObjects.Container = this.scene.add.container(0, 0);
            playerGuess.visible = false;
            this.answerContainer.add(playerGuess);
            const playerGuessTick: Phaser.GameObjects.Rectangle = this.scene.add.rectangle(-2, -20, 2, 30 * playersAdded.length + 20, 0xffffff, 1)
                .setOrigin(0.5, 0);
            playerGuess.add(playerGuessTick);
            const playerGuessText = this.scene.add.text(0, 30 * playersAdded.length, answer.toString(), this.scene.labelConfig)
                .setOrigin(0.5, 0);
            playerGuess.add(playerGuessText);
            playerGuesses.set(sessionID, playerGuess);

            currentSpacing = (xMax - xMin) / (playersAdded.length + 1);

            // First bit is easy - simply animate this avatar to its starting position - halfway along the line
            const player: PhaserPlayer = this.scene.getPlayerBySessionID(sessionID) as PhaserPlayer;
            if (player) {
                subTl.to(player, {
                    x: (xMax - xMin) / 2,
                    y: this.scene.getY(540 - 120),
                    duration: 0.5,
                });

                // Now we adjust currentMin/Max if needed
                if (currentMin === undefined || answer < currentMin) {
                    currentMin = answer;
                }
                if (currentMax === undefined || answer > currentMax) {
                    currentMax = answer;
                }

                // And now we add tweens for all added players to re-scale them based on currentMin/Max
                tweenAllPlayersToPositions(subTl);

                // And now we finally adjust the currentPlayers y value to bring them down onto the line
                subTl.to(player, {
                    y: this.scene.getY(540 - 40),
                    duration: 0.5
                }, '>');
                // ...and now that player is in position make the guess text visible
                subTl.add(() => {
                    playerGuess.visible = true;
                }, '>');
                subTl.to(playerGuessText, {
                    scale: 2,
                    duration: 0.5,
                    repeat: 1,
                    yoyo: true
                }, '>');
            }
            return subTl;
        };

        // So our addPlayerToLine function is doing the heavy-lifting here
        // All that is left is to loop through the responses and call it for each player
        if (this.questionData.responses) {
            const sessionIDs = Object.keys(this.questionData.responses);
            for (const sessionID of sessionIDs) {
                const playerResponse = this.questionData.responses[sessionID];
                const playerAnswer = Number(playerResponse.answer);
                tl.add(addPlayerToLine(sessionID, playerAnswer));
            }
        }

        const answerTick: Phaser.GameObjects.Rectangle = this.scene.add.rectangle(-960, this.scene.getY(-20), 4, playersAdded.length * 30 + 80, 0x00ff00, 1)
            .setOrigin(0.5, 0);
        this.answerContainer.add(answerTick);
        // Bounce the answerTick between the left/right edges of the number line a few times to draw attention
        tl.to(answerTick, {
            x: 960,
            duration: 0.5,
            repeat: 3,
            ease: 'power2.inOut',
            yoyo: true
        });
        // Finally tween the answerTick to its final resting place - either somewhere between the min/max or outside this range if everyone guessed too low or too high
        // In the case that the answer is outside the currentMin/Max we modify the currentSpacing to treat the answerTick as an extra player
        if (this.questionData.answer) {

            if (currentMin === undefined || this.questionData.answer < currentMin) {
                currentMin = this.questionData.answer;
                currentSpacing = (xMax - xMin) / (playersAdded.length + 2);
            }
            if (currentMax === undefined || this.questionData.answer > currentMax) {
                currentMax = this.questionData.answer;
                currentSpacing = (xMax - xMin) / (playersAdded.length + 2);
            }
            let finalAnswerX = -960 + gsap.utils.mapRange(currentMin, currentMax, xMin + currentSpacing, xMax - currentSpacing, this.questionData.answer);
            console.log('NumberQuestion::createRevealAnswerTimeline: ', {currentMin, currentMax, xMin, xMax, currentSpacing, finalAnswerX});
            tl.add('PositionAnswerTick');
            tweenAllPlayersToPositions(tl);
            tl.to(answerTick, {
                x: finalAnswerX,
                duration: 0.5,
                ease: 'power2.inOut'
            }, 'PositionAnswerTick');
            tl.add(() => {
                this.answerText.setText(this.questionData.answer!.toString());
                // Adjust answer text position to avoid going off screen
                if (finalAnswerX + 960 < this.answerText.width / 2) {
                    finalAnswerX = this.answerText.width / 2 - 960;
                }
                if (finalAnswerX + 960 > 1920 - this.answerText.width / 2) {
                    finalAnswerX = 1920 - this.answerText.width / 2 - 960;
                }
                this.answerText.setPosition(finalAnswerX, this.scene.getY(playersAdded.length * 30 + 80));
            });

            // We start by animating the players who DIDN'T score any points (if any) to get them out of the way
            const nonScoringPlayers = Object.entries(this.questionData.responses)
                .filter(([sessionID, response]) => !response.score || response.score === 0);
            tl.add('RemoveNonScorers');
            nonScoringPlayers.forEach( ([sessionID, response], index) => {
                const guess: Phaser.GameObjects.Container | undefined = playerGuesses.get(sessionID);
                if (guess) {
                    tl.to(guess, {
                        alpha: 0,
                        duration: 1.5,
                        ease: 'power2.out',
                        onComplete: () => {
                            guess.destroy();
                        }
                    }, 'RemoveNonScorers');                    
                }
                const player: PhaserPlayer = this.scene.getPlayerBySessionID(sessionID) as PhaserPlayer;
                if (player) {
                    tl.to(player, {
                        y: this.scene.getY(1080-20),
                        duration: 1.5,
                        ease: 'power2.out'
                    }, '>');
                }
            });

            // Now we want to animate the players who scored the points in this question
            // Sort the player responses by score from highest to lowest and then animate all those players whose score is > 0
            tl.add('HighlightScorers', '>+0.5');
            const scoringPlayers = Object.entries(this.questionData.responses)
                .filter(([sessionID, response]) => response.score && response.score > 0)
                .sort((a, b) => (a[1].score - b[1].score));
            scoringPlayers.forEach( ([sessionID, response], index) => {
                const player: PhaserPlayer = this.scene.getPlayerBySessionID(sessionID) as PhaserPlayer;
                if (player) {
                    tl.add(() => {
                        player.parentContainer.bringToTop(player);
                    }, '>');
                    tl.add(() => {
                        player.flashText(`+${response.score}`, '#00ff00');
                    }, '>');
                    tl.to(player, {
                        scale: 1.5,
                        duration: 1,
                        ease: 'power2.out',
                        repeat: 1,
                        yoyo: true
                    }, '<');
                }
            }); 
        }

        return tl;
    }


    // Display visualization for average number question
    // this.questionData.responses is a dictionary with player sessionID as key and their choice as value
    private displayAverageAnswerVisualization(): void {
        console.log('NumberQuestion::displayAverageAnswerVisualization:', this.questionData.responses);

        if (!this.questionData.responses) {
            return;
        }

        const guesses = Object.values(this.questionData.responses).map(r => Number(r.answer));
        let minGuess = Math.min(...guesses);
        let maxGuess = Math.max(...guesses);
        if (minGuess === maxGuess) {
            maxGuess = maxGuess + 1;
        }
        const spread = 1400;

        for (const sessionID in this.questionData.responses) {
            const playerGuess = Number(this.questionData.responses[sessionID].answer);
            const player: PhaserPlayer = this.scene.getPlayerBySessionID(sessionID) as PhaserPlayer;
            if (player) {
                this.scene.tweens.killTweensOf(player);

                let x = 960; // default center
                if (guesses.length > 1) {
                    // Center average at 960, spread guesses
                    x = 960 - spread/2 - 120 + (playerGuess - minGuess) / (maxGuess - minGuess) * spread;
                    x = Phaser.Math.Clamp(x, 160, 1760);
                }

                // Since we are floating up into position while the question is minimizing, 
                // target the final Y exactly instead of assuming current starting position
                const targetY = this.getTargetAnswerContainerY() + this.scene.getY(40);

                this.scene.tweens.add({
                    targets: player,
                    x: x,
                    y: targetY,
                    duration: Phaser.Math.Between(2000, 4000),
                    ease: 'Cubic.easeInOut',
                    onComplete: () => {
                        player.setPlayerScoreText(playerGuess.toString());
                    }
                });
            }
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