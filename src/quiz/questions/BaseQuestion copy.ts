import { BaseScene } from "src/BaseScene";
import { BaseQuestionData } from "./QuestionTypes";
import { DebugUtils } from 'src/scripts/DebugUtils';
import { ImageLoader } from 'src/scripts/ImageLoader';

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
    private answerCallback: Function;

    // References to all question elements so they can be repositioned indepenendently
    protected questionText: Phaser.GameObjects.Text;
    protected questionImage: Phaser.GameObjects.Image;
    protected questionYouTubePlayer: YouTubePlayerUI;
    protected questionAudioControls: Phaser.GameObjects.Container;
    protected answerContainer: Phaser.GameObjects.Container;

    constructor(scene: BaseScene, questionData: BaseQuestionData) {
        super(scene, 0, 0);
        this.questionData = questionData;
        this.scene = scene;

        // answer container is always needed so just add it directly
        this.answerContainer = this.scene.add.container(0, 0);
        this.add(this.answerContainer);

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

    public async initialize(): Promise<void> {

        console.log('BaseQuestion::initialize: questionData:', this.questionData);

        if (this.questionData.text) {
            this.createQuestionText();
        }

        // Load image if there is one
        if (this.questionData.image) {
            try {
                this.questionImage = await this.addQuestionImage(this.questionData.image);
                this.add(this.questionImage);
            } catch (error) {
                console.error('BaseQuestion::initialize: Error loading question image:', error);
                // for now just replace with a placeholder until I can figure out a robust method of checking
                // Maybe the best option would be that it somehow checks in advance if all images are available before even starting the quiz...
                this.questionImage = this.scene.add.image(0, 0, 'audio-settings').setOrigin(0.5, 0);
                this.add(this.questionImage);
            }
        }
        // Load audio controls if there is one
        if (this.questionData.audio) {
            this.questionAudioControls = this.createQuestionAudio(this.questionData.audio);
            this.add(this.questionAudioControls);
        }
        if (this.questionData.video) {
            this.questionYouTubePlayer = await this.createQuestionVideo(this.questionData.video);
        }

        // Finally display the question (this function can be called repeatedly for eg resize)
        this.display();
    }

    private createQuestionText(): void {

        // Create question text - we always assume there will be some text - other types are optional
        const questionConfig = Object.assign({}, this.scene.labelConfig, {
            fontSize: this.scene.getY(60),
            align: 'center',
            lineSpacing: this.scene.getY(20),
            wordWrap: { width: 1600, useAdvancedWrap: true }
        });
        this.questionText = this.scene.add.text(960, 0, this.questionData.text || "Question", questionConfig);
        this.questionText.setOrigin(0.5);
        this.add(this.questionText);

        // DEBUG = add rectangle to show questionText
        // const debugRect = this.scene.add.graphics();
        // debugRect.lineStyle(2, 0x00ff00, 1);
        // debugRect.strokeRectShape(questionText.getBounds());
        // debugRect.strokeRect(960 - 4, this.scene.getY(textHeight / 2) - 4, 8, 8);
        // // debugRect.strokeRect(-questionText.width / 2, -textHeight / 2, questionText.width, textHeight);
        // this.add(debugRect);

    }


    public display(): void {

        const answerHeight = this.calculateLogicalAnswerHeight();
        const questionHeight = 1080 - answerHeight;

        let imageHeight = 0;
        let videoHeight = 0;
        let audioHeight = 0;

        if (this.questionData.image && this.questionData.image.length > 0) {
            imageHeight = QUESTIONIMAGE_HEIGHT;
        }
        if (this.questionData.audio && this.questionData.audio.length > 0) {
            audioHeight = QUESTIONAUDIO_HEIGHT;
            imageHeight -= audioHeight;
            imageHeight = Math.max(0, imageHeight);
        }
        if (this.questionData.video && this.questionData.video.length > 0) {
            videoHeight = QUESTIONVIDEO_HEIGHT;
        }

        let textHeight = questionHeight - imageHeight - videoHeight - audioHeight;
        if (this.questionData.type === 'hotspot' || this.questionData.type === 'point-it-out') {
            textHeight = questionHeight - videoHeight - audioHeight;
        }

        console.log('BaseQuestion::display:', this.questionData.mode, this.scene.TYPE, {
            answerHeight, questionHeight, textHeight, audioHeight, videoHeight, imageHeight
        });

        if (this.questionData.mode == 'ask' && this.scene.TYPE != 'play') {

            // Position question text at center of text slot
            if (this.questionText) {
                this.questionText.setPosition(960, this.scene.getY(textHeight / 2));
            }

            // Position audio controls at center of audio slot
            if (this.questionData.audio) {
                const audioSlotCenter = textHeight + (audioHeight / 2);
                this.questionAudioControls.setPosition(960, this.scene.getY(audioSlotCenter));
            }

            // Position video player at center of video slot
            if (this.questionData.video) {
                this.questionYouTubePlayer.setSize(QUESTIONVIDEO_HEIGHT);
                const videoSlotTop = textHeight + audioHeight;
                const videoSlotCenter = videoSlotTop + (videoHeight / 2);
                this.questionYouTubePlayer.setPosition(960, this.scene.getY(videoSlotCenter));
            }

            // Position image at center of image slot
            // Changed from top-center to center positioning
            if (this.questionData.type === 'hotspot' || this.questionData.type === 'point-it-out') {
                // Image handled by child classes
            } else {
                if (this.questionData.image) {
                    this.configureImageSize(this.questionImage, imageHeight);

                    // Calculate center of image slot
                    const imageSlotTop = textHeight + audioHeight;
                    const imageSlotCenter = imageSlotTop + (imageHeight / 2);

                    // Position at center (origin is now 0.5, 0.5)
                    this.questionImage.setPosition(960, this.scene.getY(imageSlotCenter));
                }
            }
        }

        // Position answer container
        this.answerContainer.removeAll(true);
        this.answerContainer.x = 960;
        this.answerContainer.y = this.scene.getY(questionHeight);

        // Create answer UI (implemented by subclasses)
        this.createAnswerUI(answerHeight);

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
     * Uses ImageLoader utility for consistent loading across all games
     */
    protected async addQuestionImage(url: string): Promise<Phaser.GameObjects.Image> {

        console.log('BaseQuestion::addQuestionImage:', url.substring(0, 50));

        try {
            // Load image using shared utility
            const textureKey = await ImageLoader.loadImage(
                this.scene,
                url,
                'audio-settings' // Fallback texture
            );

            console.log('BaseQuestion::addQuestionImage - Loaded with key:', textureKey);

            // Create image with CENTER origin (0.5, 0.5)
            // Changed from (0.5, 0) for consistency with all other elements
            const image = this.scene.add.image(0, 0, textureKey);
            image.setOrigin(0.5, 0.5); // ← Changed to center origin

            return image;

        } catch (error) {
            console.error('BaseQuestion::addQuestionImage - Failed to load:', error);

            // Fallback image (also center origin)
            const image = this.scene.add.image(0, 0, 'audio-settings');
            image.setOrigin(0.5, 0.5); // ← Changed to center origin
            return image;
        }
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
    private createQuestionAudio(url: string): Phaser.GameObjects.Container {

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
     * Add audio player to the question with Phaser native controls
     * Uses hidden YouTube iframe for actual audio playback
     */
    private createQuestionVideo(url: string): Promise<YouTubePlayerUI> {

        return new Promise<YouTubePlayerUI>((resolve, reject) => {
            const playerUI = YouTubePlayerUI.getInstance(this.scene);

            // Set up the ready listener before loading
            playerUI.once('ready', () => {
                console.log('YouTube Player ready event received');
                resolve(playerUI);
            });

            // Optional: handle errors
            playerUI.once('error', (error: string) => {
                console.error('YouTube Player error:', error);
                reject(new Error('Failed to load YouTube player'));
            });

            // Load the video (only once!)
            playerUI.loadVideo(url);
        });
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


/*
ERROR PLAYING QUIZ

file:///home/nodejs/supermassive/server/games/server.quiz.js:1485
                                        if ((question.results[sessionID].x >= question.answer.start.x) &
                                                                         ^

TypeError: Cannot read properties of null (reading 'x')
    at file:///home/nodejs/supermassive/server/games/server.quiz.js:1485:39
    at Array.forEach (<anonymous>)
    at Quiz.calculatePlayerScores (file:///home/nodejs/supermassive/server/games/server.quiz.js:1484:35)
    at Quiz.updateScores (file:///home/nodejs/supermassive/server/games/server.quiz.js:1342:32)
    at QuizStateMachine.transitionTo (file:///home/nodejs/supermassive/server/games/server.quiz.js:238:15)
    at QuizStateMachine.nextState (file:///home/nodejs/supermassive/server/games/server.quiz.js:113:12)
    at Quiz.keypressHandler (file:///home/nodejs/supermassive/server/games/server.quiz.js:1026:22)
    at Socket.<anonymous> (file:///home/nodejs/supermassive/server/room.js:217:10)
    at Socket.emit (node:events:513:28)
    at Socket.emitUntyped (/home/nodejs/supermassive/node_modules/socket.io/dist/typed-events.js:69:22)
    */


