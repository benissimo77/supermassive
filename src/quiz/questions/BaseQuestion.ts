import { BaseScene } from "src/BaseScene";
import { BaseQuestionData } from "./QuestionTypes";
import { DebugUtils as console } from 'src/scripts/DebugUtils';

import { YouTubePlayerUI } from '../YouTubePlayerUI';

// Some defaults to get us started (these are all logical units)
const QUESTIONIMAGE_HEIGHT = 640;
const QUESTIONVIDEO_HEIGHT = 480;
const QUESTIONAUDIO_HEIGHT = 120;

// Positioning Logic:
// For PLAYER mode its simple: answers 1080, question 0
// For HOST essentially we have 3 layouts: simple (text/audio), video and image
// simple: question/audio 440, answers 640
// video: question/video 720, answers 360
// image: question/image 840, answers 240

// Then (HOST still) we can tweak above based on question type:
// MultipleChoice, TrueFalse, Ordering, Matching - no change to above
// Hotspot, PointItOut - answers becomes large since answers will handle image and answer display
// Text, Numeric, Draw - answers becomes 0 since only PLAYER needs to show answer UI
// question and answers are always origin at top-centre, vertically centred into available space

// Some other ground rules for now:
// Can't have image AND video - too much space needed
// Can have image and ordering/matching but image will be smaller than usual

export abstract class BaseQuestion extends Phaser.GameObjects.Container {

    declare public scene: BaseScene;
    protected questionData: BaseQuestionData;
    protected answerContainer: Phaser.GameObjects.Container;
    private answerCallback: Function;
    protected questionImage: Phaser.GameObjects.Image | null = null;
    protected playerControls: Phaser.GameObjects.Container | null = null;

    constructor(scene: BaseScene, questionData: BaseQuestionData) {
        super(scene, 0, 0);
        this.questionData = questionData;
        this.scene = scene;
        this.answerContainer = this.scene.add.container(0, 0);

        // Architecture has been modified to perform all initialization up-front so that the display method can be re-entrant
        // Allows re-draw whenever window resizes (eg browser messes with screen size)
        // Could also work when phone is rotated, but maybe solve that with an overlay to force landscape mode

        // If there's an image, add it
        if (this.questionData.image && this.questionData.image.length > 0) {
            this.addQuestionImage().then((image: Phaser.GameObjects.Image) => {
                this.questionImage = image;
                this.add(image);
                this.display(); // this forces an initial display once image is loaded
            })
                .catch((error: Error) => {
                    console.error('Error loading question image:', error);
                });
        }

        // If there's audio, add controls
        if (this.questionData.audio) {
            this.playerControls = this.addQuestionAudio(this.questionData.audio);
            this.scene.add.existing(this.playerControls);
            this.add(this.playerControls);
        }

        // If there's video, add it (no need for controls as video player has them)
        // We still leave soem of the video setup to the display function as it needs to know where to position the video
        if (this.questionData.video) {
            const playerUI = YouTubePlayerUI.getInstance(this.scene);
            if (playerUI.isPlayerReady()) {
                playerUI.loadVideo(this.questionData.video);
            }
        }


    }

    private calculateLogicalAnswerHeight(): number {
        // Calculate the height available for the answer options
        // PLAY MODE - 1080
        // simple: question/audio 440, answers 640
        // video: question/video 720, answers 360
        // image: question/image 840, answers 240
        if (this.scene.TYPE == 'play') {
            return 1080;
        }
        // hotspot and pointitout image is displayed by child so make answer height large
        if (this.questionData.type === 'hotspot' || this.questionData.type === 'point-it-out') {
            return QUESTIONIMAGE_HEIGHT;
        }
        if (this.questionData.image && this.questionData.image.length > 0) {
            return 240;
        }
        if (this.questionData.video && this.questionData.video.length > 0) {
            return 360;
        }
        return 640;
    }


    /**
     * Display the question - template method pattern
     * Each derived class will override specific parts
     */
    display(): void {

        // Quick additional hack for when we have image but its not yet loaded
        if (this.questionData.image && this.questionData.image.length > 0 && !this.questionImage) {
            console.log('BaseQuestion::display: image not yet loaded, skipping display');
            return;
        }

        // Logic for displaying question elements:
        // 1. First - use questionData to determine the height available for the answer options
        // 2. Fit the question elements into the rest of the space
        const answerHeight = this.calculateLogicalAnswerHeight();
        const questionHeight = 1080 - answerHeight;

        // We have a question height total - decide how to divide this between the different elements
        // If image this takes 720 and text takes the rest
        // If image AND audio image is shrunk to 600 and audio takes 120
        // If video this takes 480 and text takes the rest
        let imageHeight = 0;
        let videoHeight = 0;
        let audioHeight = 0;
        if (this.questionData.image && this.questionData.image.length > 0) {
            imageHeight = QUESTIONIMAGE_HEIGHT;
        }
        if (this.questionData.audio && this.questionData.audio.length > 0) {
            audioHeight = QUESTIONAUDIO_HEIGHT;
            // If we have image AND audio then we need to shrink the image height
            imageHeight -= audioHeight;
            imageHeight = Math.max(0, imageHeight);
        }
        if (this.questionData.video && this.questionData.video.length > 0) {
            videoHeight = QUESTIONVIDEO_HEIGHT;
        }

        // Space available for text is the remainder of the vertical space
        // Extra complexity: for hotspot and point-it-out the image is handled by child/answer so remove from calculation
        let textHeight = questionHeight - imageHeight - videoHeight - audioHeight;
        if (this.questionData.type === 'hotspot' || this.questionData.type === 'point-it-out') {
            // For hotspot and point-it-out we don't display the image here, so text takes all remaining space
            textHeight = questionHeight - videoHeight - audioHeight;
        }

        console.log('BaseQuestion::display:', this.questionData.mode, this.scene.TYPE, { answerHeight, questionHeight, textHeight, audioHeight, videoHeight, imageHeight });
        console.log('BaseQuestion::display: questionData:', this.questionData);

        // If we are in ask mode then we need to clear the question and show the new one
        // If we are in answer mode we can assume we already have the question displayed - just show the answer
        if (this.questionData.mode == 'ask' && this.scene.TYPE != 'play') {

            // Clear previous content - Phaser built-in method
            this.removeAll(true);

            // Create question text - we always assume there will be some text - other types are optional
            const questionConfig = {
                fontSize: this.scene.getY(48),
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: 1600, useAdvancedWrap: true }
            };
            const questionText = this.scene.add.text(960, this.scene.getY(textHeight / 2), this.questionData.text || "Question", questionConfig);
            questionText.setOrigin(0.5);
            this.add(questionText);


            // DEBUG = add rectangle to show questionText
            // const debugRect = this.scene.add.graphics();
            // debugRect.lineStyle(2, 0x00ff00, 1);
            // debugRect.strokeRectShape(questionText.getBounds());
            // debugRect.strokeRect(960 - 4, this.scene.getY(textHeight / 2) - 4, 8, 8);
            // debugRect.strokeRect(-questionText.width / 2, -textHeight / 2, questionText.width, textHeight);
            //this.add(debugRect);

            // If there's audio, add controls
            if (this.playerControls) {
                this.playerControls.setPosition(960, this.scene.getY(textHeight + QUESTIONAUDIO_HEIGHT / 2));
            }

            // If there's video, add it (no need for controls as video player has them)
            if (this.questionData.video) {
                const playerUI = YouTubePlayerUI.getInstance(this.scene);
                if (playerUI.isPlayerReady()) {
                    const playerH = QUESTIONVIDEO_HEIGHT;
                    playerUI.setSize(playerH);
                    const playerTop = textHeight;
                    playerUI.setPosition(960, playerTop);
                } else {
                    playerUI.once('ready', () => {
                        const playerH = QUESTIONVIDEO_HEIGHT;
                        playerUI.setSize(playerH);
                        const playerTop = textHeight;
                        playerUI.setPosition(960, playerTop);
                    });
                }
            }

            // If there's an image, display it - image has origin different to usual to make hotspot simpler set to (0.5,0) top-centre
            // UPDATE: for hotspot type question we use the child classes to display the image so they can show answers as well
            if (this.questionData.type === 'hotspot' || this.questionData.type === 'point-it-out') {
                // Do not display image here, handled by child classes
            } else {

                if (this.questionImage) {
                    this.configureImageSize(this.questionImage, imageHeight);
                    this.questionImage.setPosition(960, this.scene.getY(textHeight + audioHeight));
                    this.questionImage.setVisible(true);
                }
            }
        }





        // Create answer content - this will likely be different based on question type, overridden by concrete classes
        // NOTE: this function writes directly into this.answerContainer
        // NOTE2: this works for HOST and PLAY mode - answerHeight/questionHeight are set correctly at the top to ensure layout works
        this.answerContainer.removeAll(true);
        this.answerContainer.x = 960;
        this.answerContainer.y = this.scene.getY(questionHeight);
        this.add(this.answerContainer);

        this.createAnswerUI(answerHeight);

        // Debug - add a small cross at the origin of the answer container
        const debugCross = this.scene.add.rectangle(0, 0, 10, 10, 0xff0000).setOrigin(0.5);
        this.answerContainer.add(debugCross);

        console.log('Question created:', this.questionData);

    }

    /**
     * Set the callback for when the answer is submitted
     */
    onAnswer(callback: Function): void {
        this.answerCallback = callback;
    }

    // Subclasses should call this method to submit the answer
    protected submitAnswer(answer: any): void {
        if (this.answerCallback) {
            this.answerCallback(answer);
        }
    }

    // Since so many question types will need some kind of a button then create a generic function to do this
    protected createSimpleButton(text: string): Phaser.GameObjects.Container {
        const buttonConfig = {
            fontSize: this.scene.getY(36),
            fontFamily: '"Titan One", Arial',
            color: '#ffffff'
        }
        const button = this.scene.add.container(0, 0);
        const buttonBg = this.scene.add.rectangle(0, 0, 200, 60, 0x0066cc, 0.7).setOrigin(0.5);
        const buttonText = this.scene.add.text(16, 0, text, buttonConfig).setOrigin(0.5);
        button.add([buttonBg, buttonText]);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerover', () => buttonBg.setFillStyle(0x00ff00));
        button.on('pointerout', () => buttonBg.setFillStyle(0x0066cc));
        this.add(button);
        return button;
    }


    /**
     * Add image to the question - returns a Promise that resolves with the image
     * Base64 images resolve (almost) immediately, URL images resolve when loaded
     */
    protected addQuestionImage(): Promise<Phaser.GameObjects.Image> {

        return new Promise<Phaser.GameObjects.Image>((resolve, reject) => {

            // We know that we must have an image in order for this function to be called
            // BUT check anyway to avoid TS warnings
            if (!this.questionData.image || this.questionData.image.length == 0) {
                return Promise.reject(new Error('No image specified in questionData'));
            }

            const isBase64 = this.questionData.image.startsWith('data:image');
            let textureKey = isBase64 ? `texture-${Date.now()}` : this.questionData.image;
            textureKey = textureKey.substring(0, 64);

            // Convenience function adds image and resolves (used multiple times)
            const addImage = (): void => {
                const image = this.scene.add.image(0, 0, textureKey).setOrigin(0.5, 0);
                resolve(image);
            }

            // First check if texture already exists
            if (this.scene.textures.exists(textureKey)) {
                // Texture already exists, create image and resolve immediately
                addImage();
                return;
            }

            if (isBase64) {
                // Base64 path - create texture and wait for event
                this.scene.textures.once(textureKey, () => {
                    console.log('Base64 image texture created:', { textureKey });
                    addImage();
                });
                this.scene.textures.addBase64(textureKey, this.questionData.image);
            } else {

                // External URLs load via image proxy to prevent CORS issues
                let imageURL = this.questionData.image;
                if (imageURL.startsWith('http') && !imageURL.includes('videoswipe')) {
                    imageURL = `/proxy-image?url=${encodeURIComponent(imageURL)}`;
                }

                this.scene.load.once('complete', () => {
                    console.log('Image loaded:', textureKey);
                    addImage();
                });

                this.scene.load.once('loaderror', () => {
                    console.error('Failed to load image URL:', imageURL);
                    addImage();
                });
                this.scene.load.image(textureKey, imageURL);
                this.scene.load.start();
            }
        });
    }

    /**
     * Apply proper sizing to images
     */
    protected configureImageSize(image: Phaser.GameObjects.Image, height: number): void {

        // Maximum dimensions
        const maxWidth = 1920;

        const scale = Math.min(maxWidth / image.width, this.scene.getY(height) / image.height);
        image.setScale(scale);
    }


    /**
     * Add audio player to the question with Phaser native controls
     * Uses hidden YouTube iframe for actual audio playback
     */
    private addQuestionAudio(url: string): Phaser.GameObjects.Container {

        // Get the player UI service
        const playerUI = YouTubePlayerUI.getInstance(this.scene);

        // Create and add controls at the appropriate position
        const controls: Phaser.GameObjects.Container = playerUI.createPlayerUI(this.scene);

        // Load and play the video
        playerUI.loadVideo(url);

        // No need for cleanup in this method as the service handles it

        // Player can be sized and positioned as needed - can't use logical canvas since this directly hits the DOM
        console.log('Player UI:', this.scene.scale.getViewPort(), this.scene.scale.displaySize);

        return controls;
    }


    /**
     * Abstract method - each question type implements its specific content - returns a Container containing all relevant answer UI
     */
    protected abstract createAnswerUI(height: number): void;

    /**
     * Abstract method - each question type implements its specific content - returns a Container containing all relevant answer UI
     */
    protected abstract getAnswerUIWidth(): number;

    /**
     * Default implementation for showing answer results
     */
    showAnswer(questionData: any): void {

        // If we have implemented this correctly then just displaying the question again should be enough
        // questionData.mode = 'answer' when answering the question and this can be used to determine if we need to show the answer
        // Let subclasses implement specific answer visualization
        this.questionData = questionData;
        this.display();
    }

    // Called by QuizHost when question finished with
    destroy(fromScene?: boolean): void {
        console.log('BaseQuestion:: destroy:', this.questionData.id);
        const playerUI = YouTubePlayerUI.getInstance(this.scene);
        playerUI.stopVideo();
        // This is a bit of a hack - but moving off-screen is probably the easiest way to hide the player
        playerUI.setPosition(0, -4000);
        super.destroy(fromScene);
    }


    protected createTextureFromBase64(key: string, base64: string): void {
        if (!this.scene.textures.exists(key)) {
            this.scene.textures.addBase64(key, base64);
        }
    }


}