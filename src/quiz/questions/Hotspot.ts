import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { HotspotQuestionData, HotspotResultData } from "./QuestionTypes";
import { NineSliceButton } from "src/ui/NineSliceButton";

export default class HotSpotQuestion extends BaseQuestion {

    private submitButton: NineSliceButton;
    private hotspotContainer: Phaser.GameObjects.Container;
    private image: Phaser.GameObjects.Image;
    private crosshair: Phaser.GameObjects.Image;
    private crosshairPos: { x: integer, y: integer } | null = null;
    protected questionData: HotspotQuestionData;

    protected getAnswerUIWidth(): number {
        return 600;
    }

    // Override the constructor to use specific question data type
    constructor(scene: BaseScene, questionData: HotspotQuestionData) {
        super(scene, questionData);
    }

    /**
     * Create the specific content for multiple choice questions
     * The questionData holds everything we need including a 'mode' (ask/answer)
     * If mode = 'answer' then we show the correct answer (non-interactive)
     * If mode = 'ask' then we show the options
     * If mode = 'ask' AND we are player screen then make interactive and collect player input
     */
    protected createAnswerUI(answerHeight: number): void {

        // This should never happen...
        if (!this.questionData.image || this.questionData.image.length === 0) {
            console.error('HotspotQuestion::createAnswerUI: No image provided in questionData');
            return;
        }

        console.log('HotspotQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE, answerHeight);

        this.hotspotContainer = this.scene.add.container(0, 0);
        this.answerContainer.add(this.hotspotContainer);

        // ASK MODE:
        // - HOST and PLAYER display image
        // - PLAYER or singlePlayerMode make image interactive
        // ANSWER MODE:
        // - HOST display image and add crosshairs at player answers plus correct answer

        // Load the image for the hotspot
        // This code taken from BaseQuestion
        // Image is added with an origin of (0.5,0) - centered horizontally and anchored at the top
        this.addQuestionImage()
            .then((image: Phaser.GameObjects.Image) => {
                this.image = image;
                this.configureImageSize(image, answerHeight);
                image.setPosition(0, 0);
                this.hotspotContainer.add(image);

                if (this.questionData.mode === 'ask') {
                    if (this.scene.TYPE == 'host') {
                        // for host we just display the image and that is that
                    } else {
                        this.makeImageInteractive(image);
                        this.addSubmitButton(answerHeight);
                    }
                } else {
                    this.showResults(answerHeight);
                }
            })
            .catch((error: Error) => {
                console.error('Error loading question image:', error);
            });

        // DEBUG - add rectangle to originof the answer container
        const debugRect = this.scene.add.rectangle(0, 0, 5, 5, 0xff0000, 0.5).setOrigin(0.5);
        this.hotspotContainer.add(debugRect);
    }

    private submitImage(): void {
        this.image.disableInteractive();
        this.submitButton.disableInteractive();
        this.submitAnswer(this.crosshairPos);

        // Juice - animate the canvas and buttons out
        const tl = gsap.timeline();
        tl.to(this.submitButton, {
            y: 2000,
            duration: 0.5,
            ease: 'back.in'
        });
        tl.to(this.hotspotContainer, {
            x: 2000,
            duration: 0.5,
            ease: 'back.in'
        });
        tl.play();

    }

    private makeImageInteractive(image: Phaser.GameObjects.Image): void {
        image.setInteractive({ useHandCursor: true });
        image.on('pointerup', (pointer: Phaser.Input.Pointer, localX: number, localY: number) => {

            // We need to map pointer coordinates to the image's local coordinates
            // Handily Phaser provides localX and localY for this purpose
            // localX and localY are relative to the image's top-left corner, accounting for scale and origin

            // Since we will mainly want to display crosshairs at a normalized position we build our system around this
            // So calculate the normialized position of the click and call function to display crosshair at this position
            // Normalized position is between 0 and 1000 to keep integer values
            const normalizedX: number = Math.round(1000 * localX / image.width);
            const normalizedY: number = Math.round(1000 * localY / image.height);
            if (this.crosshairPos) {
                // If a crosshair already exists, remove it before adding a new one
                this.crosshair.destroy();
            }
            this.crosshair = this.addCrosshairAtNormalizedPosition(image, normalizedX, normalizedY);
            this.crosshairPos = { x: normalizedX, y: normalizedY };
            this.submitButton.setVisible(true);
        });

    }
    private addSubmitButton(answerHeight: number): void {
        // Add a SUBMIT button - move to bottom corner to give more space for text display
        this.submitButton = new NineSliceButton(this.scene, 'Submit');
        this.submitButton.setButtonSize(200, 80);
        this.submitButton.setPosition(960 - 160 - 20, this.scene.getY(answerHeight - 80));
        this.submitButton.setVisible(false);
        this.submitButton.setInteractive({ useHandCursor: true });
        this.submitButton.on('pointerup', () => {
            console.log('HotspotQuestion::createAnswerUI: Submit button clicked:', this.crosshairPos);
            this.submitImage();
        });
        this.hotspotContainer.add(this.submitButton);
    }

    private showResults(answerHeight: number): void {

        // First mark all the guesses made by the players
        if (this.questionData.results) {
            Object.entries(this.questionData.results).forEach(([sessionID, result]) => {
                if (result && result.x !== undefined && result.y !== undefined) {
                    const guessCrosshair = this.addCrosshairAtNormalizedPosition(this.image, result.x, result.y);
                    guessCrosshair.setTint(0x008000);
                }
            });
        }

        // HOTSPOT: display the crosshair at the answer position
        // POINT-IT-OUT: display a rectangle at the answer position
        if (this.questionData.type === 'hotspot') {
            this.crosshairPos = { x: this.questionData.answer.x, y: this.questionData.answer.y };
            this.crosshair = this.addCrosshairAtNormalizedPosition(this.image, this.crosshairPos.x, this.crosshairPos.y);
            this.crosshair.setScale(2);
        } else {
            console.log('Point-It-Out showResults:', this.questionData.answer);
            this.crosshairPos = {
                x: (this.questionData.answer.start.x + this.questionData.answer.end.x) / 2,
                y: (this.questionData.answer.start.y + this.questionData.answer.end.y) / 2
            };
            this.addRectangleAtNormalizedPosition(this.image, this.questionData.answer);
        }

        // Experiemnt with zooming the image to make the answer more visible
        // Try just zooming in on one quadrant (topleft, topright, bottomleft, bottomright)
        const newScale = 2;
        const originX = this.image.width * this.image.scaleX / -2;
        const originY = 0;

        // crosshairX and Y are the position of the crosshair relative to image origin (top centre)
        const crosshairX = originX + this.crosshairPos.x * this.image.width * this.image.scaleX / 1000;
        const crosshairY = originY + this.crosshairPos.y * this.image.height * this.image.scaleY / 1000;

        // So we have to translate hotspotContainer to make the crosshair position into the centre
        // hotspotContainer currently at (0, 0) so we need to move it to (-crosshairX, -crosshairY)
        // Also need to allow for new scale and adjusting Y position to be in the middle of the vertical space
        const translateX = 0 - newScale * crosshairX;
        const translateY = this.scene.getY((answerHeight / 2)) - newScale * crosshairY;

        console.log('Image:', crosshairX, crosshairY, translateX, translateY);

        // this.hotspotContainer.setPosition(translateX, translateY);
        // this.hotspotContainer.setScale(newScale);
        this.scene.tweens.add({
            targets: this.hotspotContainer,
            scaleX: newScale,
            scaleY: newScale,
            x: translateX,
            y: translateY,
            duration: 750,
            ease: 'easeInOut'
        })
    }

    private addCrosshairAtNormalizedPosition(image: Phaser.GameObjects.Image, normalizedX: number, normalizedY: number): Phaser.GameObjects.Image {
        // Create a crosshair graphic at the normalized position
        const crosshair = this.scene.add.image(0, 0, 'crosshair');

        const imageWidth = image.width * image.scaleX;
        const imageHeight = image.height * image.scaleY;
        const imageX = (normalizedX * image.width * image.scaleX / 1000) - (imageWidth / 2);
        const imageY = (normalizedY * image.height * image.scaleY / 1000);
        crosshair.setPosition(imageX, imageY);
        this.hotspotContainer.add(crosshair);
        console.log('Crosshair added:', { imageX, imageY, imageWidth, imageHeight });
        return crosshair;
    }

    private addRectangleAtNormalizedPosition(image: Phaser.GameObjects.Image, answer: any): Phaser.GameObjects.Graphics {
        // Create a crosshair graphic at the normalized position
        const rect = this.scene.add.graphics();
        this.hotspotContainer.add(rect);

        const imageWidth = image.width * image.scaleX;
        const imageHeight = image.height * image.scaleY;
        const imageStartX = (answer.start.x * image.width * image.scaleX / 1000) - (imageWidth / 2);
        const imageStartY = (answer.start.y * image.height * image.scaleY / 1000);
        const imageEndX = (answer.end.x * image.width * image.scaleX / 1000) - (imageWidth / 2);
        const imageEndY = (answer.end.y * image.height * image.scaleY / 1000);

        // Calculate rectangle width and height
        const rectWidth = imageEndX - imageStartX;
        const rectHeight = imageEndY - imageStartY;


        rect.fillStyle(0x00FF00, 0.3);
        rect.fillRect(imageStartX, imageStartY, rectWidth, rectHeight);
        rect.lineStyle(2, 0x00FF00, 1);
        rect.strokeRect(imageStartX, imageStartY, rectWidth, rectHeight);

        return rect;
    }

    public destroy(): void {
        super.destroy();
    }

}

