import { BaseScene } from "src/BaseScene";
import { YouTubePlayerUI } from '../YouTubePlayerUI';

// Some defaults to get us started (these are all logical units)
const QUESTIONIMAGE_HEIGHT = 720;
const QUESTIONVIDEO_HEIGHT = 480;
const QUESTIONAUDIO_HEIGHT = 120;
const QUESTIONANSWER_HEIGHT = 180;

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
    protected questionData: any;
    private answerCallback: Function;
    protected answerContainer: Phaser.GameObjects.Container;

    constructor(scene: BaseScene, questionData: any) {
        super(scene, 0, 0);
        this.questionData = questionData;
        this.scene = scene;
        this.answerContainer = this.scene.add.container(0, 0);
    }

    private calculateLogicalAnswerHeight(): number {
        // Calculate the height available for the answer options
        // PLAY MODE - 1080
        // simple: question/audio 440, answers 640
        // video: question/video 720, answers 360
        // image: question/image 900, answers 180
        if (this.scene.TYPE == 'play') {
            return 1080;
        }
        // hotspot and pointitout image is displayed by child so make answer height large
        if (this.questionData.type === 'hotspot' || this.questionData.type === 'point-it-out') {
            return QUESTIONIMAGE_HEIGHT;
        }
        if (this.questionData.image) {
            return 240;
        }
        if (this.questionData.video) {
            return 360;
        }
        return 640;
    }


    /**
     * Display the question - template method pattern
     * Each derived class will override specific parts
     */
    display(): void {

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
        if (this.questionData.image) {
            imageHeight = QUESTIONIMAGE_HEIGHT;
        }
        if (this.questionData.video) {
            videoHeight = QUESTIONVIDEO_HEIGHT;
        }
        if (this.questionData.audio) {
            audioHeight = QUESTIONAUDIO_HEIGHT;
            imageHeight -= audioHeight;
            imageHeight = Math.max(0, imageHeight);
        }
        let textHeight = questionHeight - imageHeight - videoHeight - audioHeight;

        console.log('BaseQuestion::display:', this.questionData.mode, this.scene.TYPE, { questionHeight, textHeight, audioHeight, videoHeight, imageHeight });

        // If we are in ask mode then we need to clear the question and show the new one
        // If we are in answer mode we can assume we already have the question displayed - just show the answer
        if (this.scene.TYPE == 'host' && this.questionData.mode == 'ask') {

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
            const debugRect = this.scene.add.graphics();
            debugRect.lineStyle(2, 0x00ff00, 1);
            debugRect.strokeRectShape(questionText.getBounds());
            debugRect.strokeRect(960 - 4, this.scene.getY(textHeight / 2) - 4, 8, 8);
            // debugRect.strokeRect(-questionText.width / 2, -textHeight / 2, questionText.width, textHeight);
            this.add(debugRect);

            // If there's audio, add controls
            if (this.questionData.audio) {
                const controls: Phaser.GameObjects.Container = this.addQuestionAudio(this.questionData.audio);
                this.scene.add.existing(controls);
                this.add(controls);
                controls.setPosition(960, this.scene.getY(textHeight + QUESTIONAUDIO_HEIGHT / 2));
            }

            // If there's video, add it (no need for controls as video player has them)
            if (this.questionData.video) {
                const playerUI = YouTubePlayerUI.getInstance(this.scene);
                if (playerUI.isPlayerReady()) {
                    const playerH = QUESTIONVIDEO_HEIGHT;
                    playerUI.setSize(playerH);
                    const playerTop = textHeight;
                    playerUI.setPosition(960, playerTop);
                    playerUI.loadVideo(this.questionData.video);
                } else {
                    playerUI.once('ready', () => {
                        const playerH = QUESTIONVIDEO_HEIGHT;
                        playerUI.setSize(playerH);
                        const playerTop = textHeight;
                        playerUI.setPosition(960, playerTop);
                        playerUI.loadVideo(this.questionData.video);
                    });
                }
            }

            // If there's an image, display it - image has origin different to usual to make hotspot simpler set to (0.5,0) top-centre
            // UPDATE: for hotspot type question we use the child classes to display the image so they can show answers as well
            if (this.questionData.type === 'hotspot' || this.questionData.type === 'point-it-out') {
                // Do not display image here, handled by child classes
            } else {
                if (this.questionData.image) {
                    this.addQuestionImage().then((image: Phaser.GameObjects.Image) => {
                        this.configureImageSize(image, imageHeight);
                        image.setPosition(960, this.scene.getY(textHeight + audioHeight));
                        this.add(image);
                    })
                        .catch((error: Error) => {
                            console.error('Error loading question image:', error);
                        });
                }
            }


        }


        // Create answer content - this will likely be different based on question type, overridden by concrete classes
        // NOTE: this function clears and then writes directly into this.answerContainer
        // NOTE2: this works for HOST and PLAY mode - answerHeight/questionHeight are set correctly at the top to ensure layout works
        this.createAnswerUI(answerHeight);
        this.answerContainer.x = 960;
        this.answerContainer.y = this.scene.getY(questionHeight);
        this.add(this.answerContainer);

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

            const isBase64 = this.questionData.image.startsWith('data:image');
            const textureKey = `question-image-${this.questionData.questionNumber}`;

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
                this.scene.textures.once('addtexture-' + textureKey, () => {
                    console.log('Base64 image texture created:', { textureKey });
                    addImage();
                });
                this.scene.textures.addBase64(textureKey, this.questionData.image);
            } else {

                this.scene.load.once('complete', () => {
                    console.log('Image loaded:', textureKey);
                    addImage();
                });

                this.scene.load.once('loaderror', () => {
                    console.error('Failed to load image URL:', this.questionData.image);
                    addImage();
                });
                this.scene.load.image(textureKey, this.questionData.image);
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