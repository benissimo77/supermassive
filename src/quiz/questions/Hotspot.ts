import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { HotspotQuestionData } from "./QuestionTypes";

type Coordinate = {
	x: number;
	y: number;
}
type PhaserPointer = {
	x: number;
	y: number;
	downX: number;
	downY: number;
};
type Transform = {
	x: number;
	y: number;
	scale: number;
}

/**
 * HotspotQuestion - Handles both 'hotspot' and 'point-it-out' question types
 * 
 * COORDINATE SYSTEM:
 *   All positions use normalized coordinates (0-1000 in both X and Y)
 *   - (0, 0) = top-left of image
 *   - (1000, 1000) = bottom-right of image
 *   - Independent of actual image size/scale
 * 
 * HOTSPOT: Player taps exact location on image (e.g., "Where is the Eiffel Tower?")
 *   - Answer: Single coordinate (x, y) in normalized 0-1000 range
 *   - Results: Show all player guesses + correct answer
 * 
 * POINT-IT-OUT: Player taps approximate location (e.g., "Point to France")
 *   - Answer: Area/region (tolerance radius)
 *   - Results: Show all player guesses + highlight correct region
 * 
 * Layout:
 *   - Host: Image displayed in question area (BaseQuestion handles this)
 *   - Player: Image displayed in answer area (this class handles it)
 * 	
 * HotspotContainer:
 *   - Contains answerImage and crosshair plus additional avatars later
 *   - Always positioned at centre of answer area (960, answerHeight / 2)
 * AnswerImage:
 *   - Origin set to Phaser (0, 0) = centre
 *   - Scaled relative to HotspotContainer
 *   - Initial position (0,0) initial scale set to fill available answer area
 * 
 * Pointers:
 *   - Pointer events are used to pan and zoom the image
 *   - Pointer events are in screen coordinates
 * 
 */
export default class HotspotQuestion extends BaseQuestion {

	// Player-specific UI (host doesn't create these)
	private hotspotContainer: Phaser.GameObjects.Container;
	private answerImage: Phaser.GameObjects.Image;
	private crosshair: Phaser.GameObjects.Image;
	private crosshairPos: Coordinate | null = null;
	private submitButton: NineSliceButton;

	// Zoom/Pan state
	private minScale: number = 0.75;
	private maxScale: number = 4;
	private currentScale: number = 1;
	private pointerCoords: PhaserPointer[] = [];
	private currentTransform: Transform = { x: 0, y: 0, scale: 1 };

	constructor(scene: BaseScene, questionData: HotspotQuestionData) {
		super(scene, questionData);

		this.hotspotContainer = this.scene.add.container(0, 0);
		this.answerContainer.add(this.hotspotContainer);
	}

	protected getAnswerUIWidth(): number {
		return 1920; // Full width (image can be large)
	}

	/**
	 * Create answer UI elements (player only)
	 * Host displays image in question area (handled by BaseQuestion)
	 */
	protected async createAnswerUI(): Promise<void> {
		console.log('HotspotQuestion::createAnswerUI:', this.questionData.type, this.questionData.mode, this.scene.TYPE);

		// Only player creates answer UI (host uses BaseQuestion.questionImage)
		// if (this.scene.TYPE !== 'play') {
		//     console.log('HotspotQuestion::createAnswerUI: Host mode - no answer UI needed');
		//     return;
		// }

		if (!this.questionData.image) {
			console.warn('HotspotQuestion::createAnswerUI: No image provided in question data');
			return;
		}

		// Simplicity: create a submit button in all modes but just make invisible if not needed
		this.submitButton = new NineSliceButton(this.scene, 'SUBMIT');
		this.answerContainer.add(this.submitButton);

		// Create image (using BaseQuestion helper for consistency)
		// If in HOST mode we already have an image loaded as part of question - use this
		if (this.scene.TYPE === 'host') {
			this.answerImage = this.questionImage;
			this.submitButton.setVisible(false);

		} else if (this.scene.TYPE === 'solo') {
			this.answerImage = this.questionImage;
		} else {
			this.answerImage = await this.createQuestionImage(this.questionData.image);
		}

		this.hotspotContainer.add(this.answerImage);

		console.log('HotspotQuestion::createAnswerUI: Created answerImage, crosshair, submitButton');

		this.scene.input.addPointer(1);

		// Make interactive
		if (this.scene.TYPE !== 'host' || 1) {
			this.makeInteractive();
			// this.enableInputDebug();
		}
	}

	/**
	 * Position answer UI elements based on available height
	 * Can be called multiple times (e.g., on resize)
	 */
	protected displayAnswerUI(answerHeight: number): void {
		console.log('HotspotQuestion::displayAnswerUI:', answerHeight, this.scene.TYPE);

		// Position and scale submit button (EXACT copy from Number.ts)
		const scaleFactor = this.scene.getUIScaleFactor();
		this.submitButton.setButtonSize(320 * scaleFactor, 80 * scaleFactor);
		this.submitButton.setTextSize(46 * scaleFactor);
		this.submitButton.setPosition(
			960 - 160 * scaleFactor - 20,
			this.scene.getY(answerHeight) - 40 * scaleFactor - 20
		);
		this.answerContainer.add(this.submitButton);	// Ensure button is on top

		// Position and size container and image (fill available space)
		// Update: reduce answerHeight to allow some margin at bottom of screen
		answerHeight -= this.scene.getY(60);
		this.hotspotContainer.setPosition(0, this.scene.getY(answerHeight / 2));
		this.configureImageSize(this.answerImage, answerHeight);
		this.answerImage.setPosition(0, 0);

		// RESET zoom/pan to default (as discussed)
		this.currentScale = 1;

		// Position crosshair (if visible, convert normalized → screen coords)
		if (this.crosshairPos) {
			this.crosshair.destroy();
			this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos?.x, this.crosshairPos?.y);
		}

		console.log('HotspotQuestion::displayAnswerUI: Positioned image, crosshair, submit button');
	}


	// enableInputDebug - log all pointer events on answerImage
	// VERY NOISY - use for debugging only
	enableInputDebug() {

        // Pointer events - manually list the events we want to debug
        const pointerEvents = [
            'pointerdown',
            'pointerup',
            'pointermove',
            'pointerover',
            'pointerout',
            'dragstart',
            'drag',
            'dragend',
            'drop',
            'pointerenter',
            'pointerleave',
            'pointercancel',
            'pointerupoutside',
            'pointerdownoutside',
            'gameout',
            'gameover'
        ];
        pointerEvents.forEach(eventName => {
			this.answerImage.setInteractive({ draggable: false });
            this.answerImage.on(eventName, (...args) => {
                this.scene.socket?.emit('consolelog', `[Pointer Event] ${eventName}, ${args}`);
            });
        });

    }


	/**
	 * Make answer UI interactive (player only)
	 */
	protected makeInteractive(): void {
		console.log('HotspotQuestion::makeInteractive:',);

		// Make image interactive for tap-to-place-crosshair
		this.answerImage.setInteractive({ draggable: false });
		this.answerImage.on('pointerup', this.handlePointerUp, this);
		this.answerImage.on('pointerdown', this.handlePointerDown, this);
		this.answerImage.on('pointermove', this.handlePointerMove, this);

		// Add drag handlers for panning image - these are global to the scene
		// this.answerImage.on('drag', this.handleDragMove, this);
		// this.answerImage.on('dragend', this.handleDragEnd, this);

		// Add mouse wheel zoom (pinch-to-zoom TODO later)
		this.answerImage.on('wheel', this.handleMouseWheel, this);

		// Add scene level pointer event for multi-touch zoom (pinch)
		// this.answerImage.on('pointerdown', this.handleZoomStart, this);
		// this.answerImage.on('pointermove', this.handleDragMove, this);

		// Submit button handler
		this.submitButton.setInteractive({ useHandCursor: true });
		this.submitButton.on('pointerup', this.handleSubmit, this);

		console.log('HotspotQuestion::makeInteractive: Added tap, drag, zoom, submit handlers');
	}

	/**
	 * Make answer UI non-interactive
	 */
	protected makeNonInteractive(): void {
		console.log('HotspotQuestion::makeNonInteractive');

		if (this.scene.TYPE !== 'play') {
			return;
		}

		// Remove image handlers
		this.answerImage.disableInteractive();
		this.answerImage.removeAllListeners();

		// Remove drag handlers
		this.scene.input.off('pointermove', this.handleDragMove, this);
		this.scene.input.off('pointerup', this.handleDragEnd, this);

		// Remove submit button handlers
		this.submitButton.disableInteractive();
		this.submitButton.removeAllListeners();
	}

	private getPointerData(pointer: Phaser.Input.Pointer): PhaserPointer {
		return {
			x: pointer.x,
			y: pointer.y,
			downX: pointer.downX,
			downY: pointer.downY
		}
	}

	private handlePointerDown(pointer: Phaser.Input.Pointer): void {
		this.scene.socket?.emit('consolelog', 'HotspotQuestion::handlePointerDown: Pointer down: ' + pointer.id + ' : ' + pointer.x + ',' + pointer.y);
		this.pointerCoords[pointer.id] = this.getPointerData(pointer);
		this.resetDrag();
	}

	private handlePointerMove(pointer: Phaser.Input.Pointer): void {

		// this.scene.socket?.emit('consolelog', 'HotspotQuestion::handlePointerMove: Pointer move at ' + pointer.id + ' : ' + this.pointerCoords[1] + ',' + this.pointerCoords[2]);
		
		// For cases when player is on laptop we must have a mouse down
		// isDown always true for touch so works for laptops and mobile devices
		if (!pointer.isDown) {
			return;
		}

		// Update the current pointer to get latest position
		this.pointerCoords[pointer.id].x = pointer.x;
		this.pointerCoords[pointer.id].y = pointer.y;
		
		// Check if we might be zooming (both pointers down)
		if (this.pointerCoords[1] && this.pointerCoords[2]) {

			const originalDistance: number = Phaser.Math.Distance.Between(
				this.pointerCoords[1].downX,
				this.pointerCoords[1].downY,
				this.pointerCoords[2].downX,
				this.pointerCoords[2].downY
			);
			const currentDistance: number = Phaser.Math.Distance.Between(
				this.pointerCoords[1].x,
				this.pointerCoords[1].y,
				this.pointerCoords[2].x,
				this.pointerCoords[2].y
			);
			const zoomFactor = (currentDistance - originalDistance) / originalDistance + 1;
			this.currentScale = Phaser.Math.Clamp(this.currentTransform.scale * zoomFactor, this.minScale, this.maxScale);
			this.hotspotContainer.setScale(this.currentScale);

			// Adjust the position of hotspotContainer to ensure that the midpoint between the two pointers remains consistent
			this.hotspotContainer.x = this.currentTransform.x + this.hotspotContainer.scale * ((this.pointerCoords[1].x + this.pointerCoords[2].x) / 2 - (this.pointerCoords[1].downX + this.pointerCoords[2].downX) / 2);
			this.hotspotContainer.y = this.currentTransform.y + this.hotspotContainer.scale * ((this.pointerCoords[1].y + this.pointerCoords[2].y) / 2 - (this.pointerCoords[1].downY + this.pointerCoords[2].downY) / 2);

		} else {

			// See if a basic drag will work with simply a move by the pointer difference
			const thisPointer = this.pointerCoords[pointer.id];
			this.hotspotContainer.x = this.currentTransform.x + this.hotspotContainer.scale * (thisPointer.x - thisPointer.downX);
			this.hotspotContainer.y = this.currentTransform.y + this.hotspotContainer.scale * (thisPointer.y - thisPointer.downY);
		}
			
	}

	private handlePointerUp(pointer: Phaser.Input.Pointer): void {
		this.scene.socket?.emit('consolelog', 'HotspotQuestion::handlePointerUp: Pointer up at ' + pointer.id + ' : ' + pointer.x + ',' + pointer.y);
		delete this.pointerCoords[pointer.id];

		// Since we are 'resetting' from now we need to update currentTransform and pointers
		this.resetDrag();

		// If both pointers are up we can consider final possibility: a tap
		if (this.pointerCoords[1] || this.pointerCoords[2]) {
			return;
		}

		const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, pointer.downX, pointer.downY);
		console.log('HotspotQuestion::handlePointerUp: Pointer:', pointer, ' Distance moved:', distance);

		// If pointer didn't move much, treat as a tap
		if (distance < 10) {
			if (this.crosshair) {
				this.crosshair.destroy();
			}
			this.crosshairPos = this.screenToNormalized(pointer.x, pointer.y);
			this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos.x, this.crosshairPos.y);
			this.crosshair.visible = true;
			this.animateCrosshairScale(this.crosshair.scale);
		}
	}

	private resetDrag(): void {
		this.currentTransform = {
			x: this.hotspotContainer.x,
			y: this.hotspotContainer.y,
			scale: this.hotspotContainer.scale
		};
		if (this.pointerCoords[1]) {
			this.pointerCoords[1].downX = this.pointerCoords[1].x;
			this.pointerCoords[1].downY = this.pointerCoords[1].y;
		}
		if (this.pointerCoords[2]) {
			this.pointerCoords[2].downX = this.pointerCoords[2].x;
			this.pointerCoords[2].downY = this.pointerCoords[2].y;
		}
	}



	/**
	 * Handle mouse wheel - zoom container (NOT image)
	 * Crosshair automatically scales with container
	 */
	private handleMouseWheel(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number, deltaZ: number): void {

		// Zoom in/out
		const zoomDelta = deltaX > 0 ? 0.9 : 1.1;
		this.currentScale *= zoomDelta;

		// Clamp zoom (0.5x to 3x)
		this.currentScale = Phaser.Math.Clamp(this.currentScale, 0.5, 3);

		// ✅ Apply zoom to CONTAINER (not image)
		this.hotspotContainer.setScale(this.currentScale);

		console.log('HotspotQuestion::handleMouseWheel: Zoom =', deltaX, this.currentScale);

	}

	/**
	 * Handle submit button click
	 * Sends normalized coordinates (0-1000) to server
	 */
	private handleSubmit(): void {
		console.log('HotspotQuestion::handleSubmit');

		// Check if crosshair placed
		if (!this.crosshairPos) {
			console.warn('HotspotQuestion::handleSubmit: No crosshair placed!');
			// TODO: Show error message to player
			return;
		}

		// Make non-interactive
		this.makeNonInteractive();

		// Get answer (normalized coordinates 0-1000)
		const answer = this.crosshairPos;

		console.log('HotspotQuestion::handleSubmit: Answer (normalized 0-1000):', answer);

		// Submit answer
		this.submitAnswer(answer);

		// Animate out (same as other question types)
		const tl = gsap.timeline();
		tl.to(this.answerContainer, {
			y: this.scene.getY(2160),
			duration: 0.5,
			ease: 'back.in'
		});
		tl.add(() => {
			this.scene.soundManager.playFX('submit-answer');
		}, "<+0.25");
		tl.play();
	}

	private addCrosshairAtNormalizedPosition(image: Phaser.GameObjects.Image, normalizedX: number, normalizedY: number): Phaser.GameObjects.Image {

		const crosshair = this.scene.add.image(0, 0, 'crosshair');
		const cameraZoom = this.scene.cameras.main.zoom;
		crosshair.setScale(1 / cameraZoom);

		const imageWidth = image.width * image.scaleX;
		const imageHeight = image.height * image.scaleY;

		// Origin at center (0.5, 0.5)
		const imageX = (normalizedX * image.width * image.scaleX / 1000) - (imageWidth / 2);
		const imageY = (normalizedY * image.height * image.scaleY / 1000) - (imageHeight / 2);

		crosshair.setPosition(imageX, imageY);
		this.hotspotContainer.add(crosshair);

		console.log('Crosshair added:', { imageX, imageY, imageWidth, imageHeight });
		return crosshair;
	}

	private animateCrosshairScale(targetScale: number): void {
		// Animate crosshair scale (pulse effect)
		if (!this.crosshair) {
			return;
		}
		this.crosshair.setScale(targetScale * 3);
		gsap.to(this.crosshair, {
			scale: targetScale,
			duration: 0.8,
			ease: 'elastic.out(1, 0.5)'
		});
	}

	protected revealAnswerUI(): void {
		const allocated = this.calculateLayout();
		const answerHeight = allocated['answers'] || 0;
		this.showResults(answerHeight);
	}

	protected showResults(answerHeight: number): void {

		// HOTSPOT: display the crosshair at the answer position
		// POINT-IT-OUT: display a rectangle at the answer position
		if (this.questionData.type === 'hotspot') {
			this.crosshairPos = { x: this.questionData.answer.x, y: this.questionData.answer.y };
			this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos.x, this.crosshairPos.y);
			this.animateCrosshairScale(2);
		} else {
			console.log('Point-It-Out showResults:', this.questionData.answer);
			this.crosshairPos = {
				x: (this.questionData.answer.start.x + this.questionData.answer.end.x) / 2,
				y: (this.questionData.answer.start.y + this.questionData.answer.end.y) / 2
			};
			this.addRectangleAtNormalizedPosition(this.answerImage, this.questionData.answer);
		}

		// Mark all the guesses made by the players
		if (this.questionData.results) {
			Object.entries(this.questionData.results).forEach(([sessionID, result]) => {
				if (result && result.x !== undefined && result.y !== undefined) {
					const guessCrosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, result.x, result.y);
					guessCrosshair.setScale(0.8);
					// Move player avatar to guess position (if we have one)
					const playerAvatar = this.scene.getPlayerBySessionID(sessionID);
				}
			});
		}

		// Experimenting with a centroid of all guesses - but not sure if this is going anywhere useful...
		const crosshairs = this.questionData.results ? Object.values(this.questionData.results) : [];
		const centroid = {
			x: crosshairs.reduce((sum, c) => sum + c.x, 0) / crosshairs.length,
			y: crosshairs.reduce((sum, c) => sum + c.y, 0) / crosshairs.length
		};


	}

	private addRectangleAtNormalizedPosition(image: Phaser.GameObjects.Image, answer: any): Phaser.GameObjects.Graphics {
		// Create a crosshair graphic at the normalized position
		const rect = this.scene.add.graphics();
		this.hotspotContainer.add(rect);

		const imageWidth = image.width * image.scaleX;
		const imageHeight = image.height * image.scaleY;
		const imageStartX = (answer.start.x * image.width * image.scaleX / 1000) - (imageWidth / 2);
		const imageStartY = (answer.start.y * image.height * image.scaleY / 1000) - (imageHeight / 2);
		const imageEndX = (answer.end.x * image.width * image.scaleX / 1000) - (imageWidth / 2);
		const imageEndY = (answer.end.y * image.height * image.scaleY / 1000) - (imageHeight / 2);

		// Calculate rectangle width and height
		const rectWidth = imageEndX - imageStartX;
		const rectHeight = imageEndY - imageStartY;


		rect.fillStyle(0x00FF00, 0.3);
		rect.fillRect(imageStartX, imageStartY, rectWidth, rectHeight);
		rect.lineStyle(2, 0x00FF00, 1);
		rect.strokeRect(imageStartX, imageStartY, rectWidth, rectHeight);

		return rect;
	}

	private screenToNormalized(screenX:number, screenY: number): Coordinate {
		// Get the world transform matrix of the container
		const matrix = this.hotspotContainer.getWorldTransformMatrix();
		// Get pointer coordinates in world space
		const worldPointer = this.scene.cameras.main.getWorldPoint(screenX, screenY);
		// Convert world (global) coordinates to local container coordinates
		const localPointer = matrix.applyInverse(worldPointer.x, worldPointer.y);
		// Convert local.x/y to image coordinates (origin at center)
		const pointerX = localPointer.x + (this.answerImage.width * this.answerImage.scaleX) / 2;
		const pointerY = localPointer.y + (this.answerImage.height * this.answerImage.scaleY) / 2;
		const normalizedX = Math.round(1000 * pointerX / (this.answerImage.width * this.answerImage.scaleX));
		const normalizedY = Math.round(1000 * pointerY / (this.answerImage.height * this.answerImage.scaleY));

		return { x: normalizedX, y: normalizedY };
	}

	/**
	 * Cleanup
	 */
	public destroy(): void {
		console.log('HotspotQuestion::destroy');
		if (this.scene) {
			this.makeNonInteractive();
		}
		super.destroy();
	}
}