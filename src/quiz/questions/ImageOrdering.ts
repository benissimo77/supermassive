import { gsap } from "gsap";
import { BaseScene } from 'src/BaseScene';
import { OrderMatchQuestionData } from "./QuestionTypes";
import OrderingQuestion from './Ordering';
import { ImageButton } from 'src/ui/ImageButton';
import { SimpleButton } from "src/ui/SimpleButton";

const BUTTONWIDTH = 360;
const BUTTONHEIGHT = 360;
const BUTTONPADDING = 40;

export default class ImageOrderingQuestion extends OrderingQuestion {

    // Only used for Host image grid
    // We re-declare buttons since it is a map of ImageButtons not NineSliceButtons
    // this.dropzones is still used as in Ordering to store the dropzones (nineslices)
    // this.items is still used to store the items and this.labels to store the dropzone labels
    protected buttons: Map<string, ImageButton> = new Map<string, ImageButton>();

    constructor(scene: BaseScene, data: OrderMatchQuestionData) {
        super(scene, data);

        this.questionData = data as OrderMatchQuestionData;
    }

    public makeInteractive(): void {
        // Nothing needed here at the moment - Player will always use OrderingQuestion
    }
    public makeNonInteractive(): void {
        // Nothing needed here at the moment - Player will always use OrderingQuestion
    }

    protected async createAnswerUI(): Promise<void> {
        console.log('ImageOrdering::createAnswerUI (Host Mode)');

        // Extract items
        if (this.questionData.type === 'ordering') {
            this.items = this.questionData.itemsShuffled || [];
        } else {
            const pairs = this.questionData.pairsShuffled || this.questionData.pairs || [];
            this.items = pairs.map((pair: any) => pair.left);
        }

        // Create buttons and allow ImageButton to handle its own loading completely!
        this.items.forEach((item: string, index: number) => {
            const originalIndex = this.questionData.items?.indexOf(item) ?? -1;
            let url = (originalIndex >= 0 && this.questionData.itemImages) ? this.questionData.itemImages[originalIndex] : '';

            // Protection against malformed JSON structs if itemImages happens to contain objects instead of strings
            if (url && typeof url === 'object') {
                url = (url as any).url || (url as any).src || (url as any).href || '';
            }
            if (typeof url !== 'string') {
                url = '';
            }

            const button = new ImageButton(this.scene, item, url);
            button.setData('index', index);
            button.setData('item', item);
            button.setData('dropzone', null);
            this.buttons.set(item, button);

            this.answerContainer.add(button);
        });

        this.labels = (this.questionData.itemsShuffled || []).map(() => ''); // Empty labels for middle dropzones
        // For ordering questions, label first/last dropzones
        if (this.questionData.extra) {
            this.labels[0] = this.questionData.extra.startLabel || '';
            this.labels[this.labels.length - 1] = this.questionData.extra.endLabel || '';
        }

        console.log('ImageOrderingQuestion::createAnswerUI: Items:', this.items, 'Labels:', this.labels);

        // Create dropzones (NO positioning yet)
        this.labels.forEach((label: string, index: number) => {
            const dropzone = new SimpleButton(
                this.scene,
                label,
                {},
                'dropzone-square'
            );
            dropzone.setTint(0x0000C0);
            dropzone.setButtonSize(BUTTONWIDTH, BUTTONHEIGHT);
            dropzone.setData('index', index);
            this.dropzones.set(index, dropzone);
            this.answerContainer.add(dropzone);
        });
    }

    protected showAnswerContent(answerHeight: number): void {

        // Host Layout: Grid of Images
        // We adopt a more robust model to positioning of elements
        // Build around a fixed size (assuming 1920x1080) and then scale entire container to fit available space
        const cols = this.buttons.size > 2 ? 2 : this.buttons.size;
        const rows = Math.ceil(this.buttons.size / cols);

        // Calculate block bounds
        const totalWidth = (cols * BUTTONWIDTH) + ((cols - 1) * BUTTONPADDING);
        const totalHeight = (rows * BUTTONHEIGHT) + ((rows - 1) * BUTTONPADDING);

        // Scale container to fit available height gracefully
        const availableHeight = this.scene.getY(1080) - this.answerContainer.y - BUTTONPADDING;
        if (availableHeight > 0) {
            const fitScale = availableHeight / totalHeight;
            this.answerContainer.setScale(fitScale);
        } else {
            this.answerContainer.setScale(1);
        }

        // X = 0 is center width for the container
        const offsetX = -totalWidth / 2;
        // Y = Top edge below question text
        const topY = BUTTONPADDING / 2;

        this.buttons.forEach((button, item) => {
            const index = button.getData('index');
            button.setButtonSize(BUTTONWIDTH, BUTTONHEIGHT);

            const col = index % cols;
            const row = Math.floor(index / cols);

            // center offsets
            const x = offsetX + (col * (BUTTONWIDTH + BUTTONPADDING)) + (BUTTONWIDTH / 2);
            const y = topY + (row * (BUTTONHEIGHT + BUTTONPADDING)) + (BUTTONHEIGHT / 2);

            button.setPosition(x, y);
        });

        // Position dropzones off-screen to the right, y positions already calculated correctly so they can be easily slid on
        this.dropzones.forEach((dropzone, index) => {
            const targetX = 1920 * 2;
            const targetY = BUTTONPADDING / 2 + index * (BUTTONHEIGHT + BUTTONPADDING) + (BUTTONHEIGHT / 2);
            dropzone.setPosition(targetX, targetY); // Positioned to the right of the grid
            console.log('Positioning dropzone', index, 'at', dropzone.x, dropzone.y);
        });
    }

    public createRevealAnswerTimeline(): gsap.core.Timeline {

        // Instead of the traditional tweening to minimise question content we adopt a more radical approach
        // Move the answerContainer to y=0 - this slides the question off completely leaving the entire screen for the display
        // This question requires a lot of space so just clear it completely to have a nice clean slate
        //
        const tl = gsap.timeline();

        // Experiment with getting clever with timelines
        // We can add pauses into a timeline at key points and then play them via different means...
        // So we deregiater the global keypress handler and register our own local handler that plays the timeline
        this.scene.deregisterGlobalKeypressHandler();
        const localKeypressHandler = (event: KeyboardEvent) => {
            // Space or Enter to step through timeline, Escape to skip
            if (event.code === 'ArrowRight') {
                tl.play();
            }
        };
        this.scene.input.keyboard?.on('keydown', localKeypressHandler, this);

        tl.to(this.questionText, {
            y: this.scene.getY(-1080),
            duration: 1,
            ease: "power2.out"
        });

        this.answerContainer.y = 0;
        this.buttons.forEach((button, index) => {
            // tl.to(button, {
            //     x: -980 + BUTTONWIDTH / 2,
            //     y: "+=" + this.answerContainer.y,
            //     duration: 0.5,
            //     ease: "power2.out"
            // }, "<");
            button.setPosition(0, this.scene.getY(2160));
        });

        // Since we are now bringing on 4 more elements the scale of the answerContainer will likely need to change
        // So we tween this to make it smooth
        // newHeight is one whole padding (half at top, half at bottom) plus 4 buttons plus 3 gaps plus extra space for the player avatar right at the bottom
        const newHeight = this.buttons.size * (BUTTONHEIGHT + BUTTONPADDING) + 60;
        const newScale = Math.min(1, this.scene.getY(1080) / newHeight);

        tl.to(this.answerContainer, {
            scale: newScale,
            duration: 0.5,
            ease: "power2.out"
        }, "<");

        // One useful calculation: the vertical centre line of the dropzones, should appear on the right edge of the screen (minus padding) to allow players to stack to the left
        // answerContainer is at (960,0) but it is scaled so that the right edge of the screen is 960/newScale
        // One further tweak: adjust the X position based on the number of player responses
        // Ensures overall display remains balanced - every x coordinate below must be related to this number
        let dropzoneTargetX = 960 / newScale - BUTTONWIDTH / 2;

        if (this.questionData.responses && Object.keys(this.questionData.responses).length < 6) {
            dropzoneTargetX -= (6 - Object.keys(this.questionData.responses).length) * (BUTTONWIDTH + BUTTONPADDING) / 2;
        }
        // Never let dropzones go further left than vertical centre-line (x=0)
        dropzoneTargetX = Math.max(0, dropzoneTargetX);

        tl.addLabel('positionDropzones', '>+0.5');
        this.dropzones.forEach((dz, index) => {
            tl.to(dz, { x: dropzoneTargetX, duration: 0.5, ease: "back.out" }, "positionDropzones");
        });

        // this.buttons.forEach((button, index) => {
        //     const dropzoneTargetY = BUTTONPADDING/2 + index * (BUTTONHEIGHT + BUTTONPADDING) + (BUTTONHEIGHT / 2);
        //     tl.to(button, { x: -dropzoneTargetX, y: dropzoneTargetY, duration: 0.5, ease: "bounce.out" }, "positionDropzones" );
        // });

        // BIG loop:
        // Display a player avatar for the players who responded
        // For each player - move their avatar to the left of the dropzones (stacked leftwards)
        // Then create new ImageButtons for each of their answers aligned with the dropzones
        let playerIndex = 0;
        const playerAnswerButtons: ImageButton[][] = [];
        for (const [sessionID, playerAnswer] of Object.entries(this.questionData.responses)) {

            const player = this.scene.getPlayerBySessionID(sessionID);
            if (player) {
                playerAnswerButtons[playerIndex] = [];
                tl.add( () => {
                    // In case they are part of the animatePlayer loop lets kill any tweens
                    this.scene.tweens.killTweensOf(player);
                    this.scene.reparentObject(player, this.answerContainer);
                    // Next line is an experiment - maybe should become part of reparentObject method
                    player.setScale(1 / this.answerContainer.scale);
                });
                tl.to(player, {
                    x: dropzoneTargetX - (BUTTONWIDTH + BUTTONPADDING) - playerIndex * (BUTTONWIDTH + BUTTONPADDING) - BUTTONWIDTH / 2 - 60,
                    y: this.scene.getY(1080) / newScale - 60,
                    scale: 1,
                    duration: 0.5,
                    ease: "power2.inout"
                });

                // And now another loop through the responses creating new ImageButtons for the player answers and tweening these to the correct dropzones
                console.log('ImageOrderingQuestion::createRevealAnswerTimeline: Player responses:', this.questionData.responses);
                const playerAnswerList = playerAnswer.answer;
                console.log('Creating answer buttons for player', sessionID, 'with answers', playerAnswerList);
                // Loop through player answer in reverse order (bottom to top)
                for (let answerIndex = playerAnswerList.length - 1; answerIndex >= 0; answerIndex--) {
                    const playerAnswer = playerAnswerList[answerIndex];
                    const originalIndex = this.questionData.items?.indexOf(playerAnswer) ?? -1;
                    let url = (originalIndex >= 0 && this.questionData.itemImages) ? this.questionData.itemImages[originalIndex] : '';

                    // Protection against malformed JSON structs if itemImages happens to contain objects instead of strings
                    if (url && typeof url === 'object') {
                        url = (url as any).url || (url as any).src || (url as any).href || '';
                    }
                    if (typeof url !== 'string') {
                        url = '';
                    }

                    const button = new ImageButton(this.scene, playerAnswer, url);
                    const playerAnswerX = dropzoneTargetX - (BUTTONWIDTH + BUTTONPADDING) - playerIndex * (BUTTONWIDTH + BUTTONPADDING);
                    const playerAnswerY = BUTTONPADDING / 2 + answerIndex * (BUTTONHEIGHT + BUTTONPADDING) + (BUTTONHEIGHT / 2);
                    button.setButtonSize(BUTTONWIDTH, BUTTONHEIGHT);
                    this.answerContainer.add(button).sendToBack(button); // Ensure these new buttons are behind the player avatars
                    console.log('Adding player answer button for', playerAnswer, 'at index', answerIndex, 'positioning to', playerAnswerX, playerAnswerY);
                    button.setPosition(playerAnswerX, playerAnswerY);
                    button.setScale(0);
                    console.log('Caching playerAnswerButtons for playerIndex:', playerIndex, answerIndex, playerAnswerButtons[playerIndex]);
                    playerAnswerButtons[playerIndex][answerIndex] = button;
                    tl.to(button, { scale: 0.8, duration: 0.5, ease: "back.out" }, '>+0.2');
                }

                // All player answers displayed - increment playerIndex and loop through all responding players
                playerIndex++;
                tl.addPause();
            }
        }

        console.log('Caching finished, final playerAnswerButtons:', playerAnswerButtons);

        // Now we have to place the correct answers onto the dropzones and label each players answers with a checkmark or a crossmark... phew!
        tl.addLabel('answerReveal', '>+0.5');
        if (this.questionData.answer) {
            for (let answerIndex = this.questionData.answer.length - 1; answerIndex >= 0; answerIndex--) {
                const answerItem = this.questionData.answer[answerIndex];
                const button = this.buttons.get(answerItem);
                if (button) {
                    const buttonTargetX = dropzoneTargetX;
                    const buttonTargetY = BUTTONPADDING / 2 + answerIndex * (BUTTONHEIGHT + BUTTONPADDING) + (BUTTONHEIGHT / 2);
                    tl.add(() => {
                        button.setPosition(buttonTargetX, buttonTargetY);
                        button.setScale(0);
                        this.answerContainer.bringToTop(button);
                    });
                    tl.to(button, { scale: 1, duration: 0.5, ease: "power2.out" });

                    // Now we must loop through the players again adding a checkmark or a cross
                    playerIndex = 0;
                    for (const [sessionID, playerAnswer] of Object.entries(this.questionData.responses)) {
                        const player = this.scene.getPlayerBySessionID(sessionID);
                        if (player) {
                            const playerAnswerList = playerAnswer.answer;
                            const isCorrect = playerAnswerList.indexOf(answerItem) === answerIndex;
                            const markKey = isCorrect ? 'checkmark' : 'crossmark';
                            const playerAnswerX = dropzoneTargetX - (BUTTONWIDTH + BUTTONPADDING) - playerIndex * (BUTTONWIDTH + BUTTONPADDING);
                            const playerAnswerY = BUTTONPADDING / 2 + answerIndex * (BUTTONHEIGHT + BUTTONPADDING) + (BUTTONHEIGHT / 2);
                            const mark = this.scene.add.image(playerAnswerX, playerAnswerY, markKey).setOrigin(0, 1).setScale(3).setAlpha(0);
                            this.answerContainer.add(mark);
                            tl.to( mark, { scale: 0.5, duration: 0.5, ease: "bounce.out" }, ">+0.2");
                            tl.to( mark, { alpha: 1, duration: 0.2 }, "<" );
                            tl.to( playerAnswerButtons[playerIndex][answerIndex], { alpha: isCorrect ? 1 : 0.4, duration: 0.5 }, "<" );
                            playerIndex++;
                        }
                    }
                }
            }
        }


        tl.add(() => {
            this.scene.input.keyboard?.off('keydown', localKeypressHandler, this);
            this.scene.registerGlobalKeypressHandler(); // Re-register global keypress handler to allow skipping through the rest of the timeline as normal
        });

        // this.imageButtonsArray.forEach((ib, index) => {
        //     // Find this image button in the array of answers and position the button to align with the relevant dropzone
        //     const answerIndex = this.questionData.items?.indexOf(index) ?? -1;
        //     tl.to(ib, { x: 1780, duration: 0.5, ease: "power2.out" }, 'positionButtons' );
        // });
        return tl;
    }

    public destroy(): void {
        super.destroy();
    }
}