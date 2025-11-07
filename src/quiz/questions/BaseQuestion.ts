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
    private debugContainer: Phaser.GameObjects.Container;

    constructor(scene: BaseScene, questionData: BaseQuestionData) {
        super(scene, 0, 0);
        this.questionData = questionData;
        this.scene = scene;

        // answer container is always needed so just add it directly
        this.answerContainer = this.scene.add.container(0, 0);
        this.add(this.answerContainer);

        this.debugContainer = this.scene.add.container(0, 0);
        this.answerContainer.add(this.debugContainer);

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

    // getAnswerHeight
    // there is a fight between question types and question elements required
    // different question types need different heights
    // these could (in theory) be affected by existence of image/audio/video
    // 
    private getAnswerHeight(): number {

        // Start with the total height available and subtract the key heights required for question
        // Whatever is left is the answer height
        let answerHeight = 1080;
        // Code each of the typical cases here and be done with it!
        // CASE 1: TEXT only no image/audio/video
        if (!this.questionData.image && !this.questionData.audio && !this.questionData.video) {
            return 720;
        }
        // CASE 2: TEXT + VIDEO present
        if (this.questionData.video && this.questionData.video.length > 0) {
            switch (this.questionData.type) {
                case 'multiple-choice':
                case 'true-false':
                    return 640;
            }
        }

        return 0;
    }

    // This copied from Copilot - maybe it will just work??? Replaces above two functions
    private calculateLayout() {
        const TOTAL = 1080;

        // What do we need?
        const elements = [];
        if (this.questionData.text) elements.push('text');
        if (this.questionData.image) elements.push('image');
        if (this.questionData.video) elements.push('video');
        if (this.questionData.audio) elements.push('audio');
        elements.push('answers');

        // Minimums
        const MIN: { [key: string]: number } = {
            text: 120, image: 240, video: 360, audio: 100,
            answers: this.getMinAnswerHeight()
        };

        // Ideals
        const IDEAL: { [key: string]: number } = {
            text: 400, image: 720, video: 640, audio: 120,
            answers: this.getIdealAnswerHeight()
        };

        // Step 1: Allocate minimums
        const allocated: { [key: string]: number } = {};
        let used = 0;
        elements.forEach(el => {
            allocated[el] = MIN[el];
            used += MIN[el];
        });

        // Step 2: Distribute to reach ideals PROPORTIONALLY
        let remaining = TOTAL - used;

        if (remaining > 0) {
            // Calculate total "need" (how much everyone wants to grow)
            const totalNeed = elements.reduce((sum, el) => {
                return sum + (IDEAL[el] - allocated[el]);
            }, 0);

            // Distribute proportionally based on need
            if (totalNeed > 0) {
                elements.forEach(el => {
                    const need = IDEAL[el] - allocated[el];
                    const proportion = need / totalNeed;
                    const give = Math.floor(remaining * proportion);
                    allocated[el] += give;
                });
            }

            // Handle rounding - give leftover to answers (most visible)
            const newTotal = elements.reduce((sum, el) => sum + allocated[el], 0);
            if (newTotal < TOTAL) {
                allocated['answers'] += (TOTAL - newTotal);
            }
        }

        console.log('BaseQuestion::calculateLayout:', { MIN, IDEAL, allocated, elements });
        return allocated;
    }
    private getMinAnswerHeight(): number {
        switch (this.questionData.type) {
            case 'multiple-choice': return 280;
            case 'true-false': return 180;
            case 'text': return 180;
            case 'number-exact': return 640;
            case 'number-closest': return 640;
            case 'ordering': return 640;
            case 'matching': return 640;
            case 'hotspot': return 80;
            case 'point-it-out': return 80;
            default: return 200;
        }
    }
    private getIdealAnswerHeight(): number {
        switch (this.questionData.type) {
            case 'multiple-choice': return 540;
            case 'true-false': return 320;
            case 'text': return 240;
            case 'number-exact': return 720;
            case 'number-closest': return 720;
            case 'ordering': return 720;
            case 'matching': return 720;
            case 'hotspot': return 80;
            case 'point-it-out': return 80;
            default: return 400;
        }
    }

    // Only 3 PUBLIC functions: initialize, displayHost, displayPlayer
    // PLUS onAnswer to set the callback for answer submission

    // Initialize - load/create assets as needed
    // Creates all elements required for the question
    // Works for all screen types (host, solo, player)
    // Calls createAnswerUI which is implemented by subclasses
    public async initialize(): Promise<void> {

        console.log('BaseQuestion::initialize: questionData:', this.questionData);

        // HOST/SOLO load all question-related elements
        if (this.scene.TYPE != 'play') {

            if (this.questionData.text) {
                this.createQuestionText();
            }
            // Load image if there is one
            if (this.questionData.image) {
                try {
                    this.questionImage = await this.createQuestionImage(this.questionData.image);
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
                this.questionYouTubePlayer = this.createQuestionVideo(this.questionData.video);
                // no need to add to the scene it is already added - just move into position in display function
            }

        }

        // All screen types create answer UI (implemented by subclasses)
        this.createAnswerUI();

    }

    // displayHost
    // all question elements have been created - display positions them based on available space
    public displayHost(): void {

        const allocated: { [key: string]: number } = this.calculateLayout();
        console.log('BaseQuestion::display: calculated layout:', allocated);

        // Since we now have everything allocated it *should* be as simple as positioning the containers...
        const textHeight = allocated['text'] || 0;
        const audioHeight = allocated['audio'] || 0;
        const videoHeight = allocated['video'] || 0;
        const imageHeight = allocated['image'] || 0;
        const answerHeight = allocated['answers'] || 0;

        console.log('BaseQuestion::display:', this.questionData.mode, this.scene.TYPE, {
            answerHeight, textHeight, audioHeight, videoHeight, imageHeight
        });

        // Position question text at center of text slot
        if (this.questionText) {
            this.questionText.setPosition(960, this.scene.getY(textHeight / 2));
        }

        // Position audio controls at center of audio slot
        if (this.questionData.audio && this.questionData.audio.length > 0) {
            const audioSlotCenter = textHeight + (audioHeight / 2);
            this.questionAudioControls.setPosition(960, this.scene.getY(audioSlotCenter));
        }

        // Position video player at center of video slot
        if (this.questionData.video && this.questionData.video.length > 0) {
            this.questionYouTubePlayer.setSize(videoHeight);
            const videoSlotTop = textHeight + audioHeight;
            const videoSlotCenter = videoSlotTop + (videoHeight / 2);
            this.questionYouTubePlayer.setPosition(960, this.scene.getY(videoSlotCenter));
        }

        // Position image at center of image slot
        // Changed from top-center to center positioning
        if (this.questionData.image) {
            this.configureImageSize(this.questionImage, imageHeight);

            // Calculate center of image slot
            const imageSlotTop = textHeight + audioHeight;
            const imageSlotCenter = imageSlotTop + (imageHeight / 2);

            // Position at center (origin is now 0.5, 0.5)
            this.questionImage.setPosition(960, this.scene.getY(imageSlotCenter));
        }

        // Position answer container
        const answerSlotTop = textHeight + audioHeight + videoHeight + imageHeight;
        this.answerContainer.x = 960;
        this.answerContainer.y = this.scene.getY(answerSlotTop);

        // Create answer UI (implemented by subclasses)
        this.displayAnswerUI(answerHeight);

        const graphics:Phaser.GameObjects.Rectangle = this.scene.add.rectangle(0, 0, 25, 25, 0xffff00, 1).setOrigin(0.5);
        this.debugContainer.removeAll();
        this.debugContainer.add(graphics);

        console.log('Question created:', this.questionData);
    }

    public displayPlayer(): void {
        this.answerContainer.x = 960;
        this.answerContainer.y = 0;
        this.displayAnswerUI(1080);
    }

    /**
     * Set the callback for when the answer is submitted
     */
    public onAnswer(callback: Function): void {
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
            fontSize: 36,
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

    protected createQuestionText(): void {

        // Create question text - we always assume there will be some text - other types are optional
        const questionConfig = Object.assign({}, this.scene.labelConfig, {
            fontSize: 60,
            align: 'center',
            lineSpacing: 20,
            wordWrap: { width: 1600, useAdvancedWrap: true }
        });

        // Create text object
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

    /**
     * Add image to the question - returns a Promise that resolves with the image
     * Uses ImageLoader utility for consistent loading across all games
     */
    protected async createQuestionImage(url: string): Promise<Phaser.GameObjects.Image> {

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
    private createQuestionVideo(url: string): YouTubePlayerUI {

        const playerUI = YouTubePlayerUI.getInstance(this.scene);

        // Load the video (only once!)
        playerUI.loadVideo(url);
        return playerUI;
    }

    /**
     * Abstract method - each question type implements its specific content - returns a Container containing all relevant answer UI
     */
    protected abstract createAnswerUI(): void;
    protected abstract displayAnswerUI(height: number): void;
    protected abstract makeInteractive(): void;
    protected abstract makeNonInteractive(): void;

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

    // I think this can be removed...
    protected createTextureFromBase64XXX(key: string, base64: string): void {
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


