import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { HotspotQuestionData } from "./QuestionTypes";

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
 */
export default class HotspotQuestion extends BaseQuestion {

	// Player-specific UI (host doesn't create these)
	private hotspotContainer: Phaser.GameObjects.Container;
	private answerImage: Phaser.GameObjects.Image;
	private crosshair: Phaser.GameObjects.Image;
	private crosshairPos: { x: integer, y: integer } | null = null;
	private submitButton: NineSliceButton;

	// Zoom/Pan state
	private isDragging: boolean = false;
	private isZooming: boolean = false;
	private minScale: number = 0.75;
	private maxScale: number = 4;
	private currentScale: number = 1;
	private zoomStartScale: number = 1;
	private zoomStartDistance: number = 0;

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
		if (this.scene.TYPE !== 'host') {
			this.makeInteractive();
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

	/**
	 * Make answer UI interactive (player only)
	 */
	protected makeInteractive(): void {
		console.log('HotspotQuestion::makeInteractive:',);

		// Make image interactive for tap-to-place-crosshair
		this.answerImage.setInteractive({ draggable: true });
		this.answerImage.on('pointerup', this.handleImageTap, this);

		// Add drag handlers for panning image - these are global to the scene
		this.answerImage.on('drag', this.handleDragMove, this);
		this.answerImage.on('dragend', this.handleDragEnd, this);

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

	/**
	 * Handle image tap - place/move crosshair
	 * Converts screen tap → normalized coordinates (0-1000)
	 * NOTE: this is really an image pointerup handler
	 * Could also be called at the end of a dragging or zooming operation
	 */
	private handleImageTap(pointer: Phaser.Input.Pointer, localX: number, localY: number): void {

		// Ignore if dragging - this flag gets cleared 50ms after drag end to distinguish from a drag event
		if (this.isDragging) {
			// Ignore taps while dragging
			return;
		}
		if (this.isZooming) {
			const p1 = this.scene.input.pointer1;
			const p2 = this.scene.input.pointer2;
			console.log('HotspotQuestion::handleImageTap: Pointers:', p1.isDown, p2.isDown);
			this.scene.socket?.emit('consolelog', 'HotspotQuestion::handleImageTap: Ignoring tap during zoom ' + p1.isDown + p2.isDown);
			// Once BOTH pointers are up we can clear the zooming flag and allow taps again
			// As for isDragging we need a short delay to avoid second pointerup firing and slipping through
			if (!p1.isDown && !p2.isDown) {
				this.scene.time.delayedCall(50, () => {
					this.isZooming = false;
				});
			}
			return;
		}
		this.scene.socket?.emit('consolelog', 'HotspotQuestion::handleImageTap: still here... Processing tap at ' + localX + ',' + localY);

		console.log('HotspotQuestion::handleImageTap: TAP at local coords:', { x: localX, y: localY });

		// If we made it to here then it's a valid tap
		const normalizedX: number = Math.round(1000 * localX / this.answerImage.width);
		const normalizedY: number = Math.round(1000 * localY / this.answerImage.height);
		console.log('handleImageTap: NORMALIZED (0-1000):', { x: normalizedX, y: normalizedY });

		// Clamp to valid range just in case it goes outside (shouldn't normally happen)
		const clampedX = Phaser.Math.Clamp(normalizedX, 0, 1000);
		const clampedY = Phaser.Math.Clamp(normalizedY, 0, 1000);

		console.log('NORMALIZED (0-1000):', { x: clampedX, y: clampedY });

		// ✅ Step 4: Display crosshair at tap location (visual feedback)
		// this.crosshair.setPosition(pointer.x, pointer.y);
		// this.crosshair.setVisible(true);
		if (this.crosshair) {
			this.crosshair.destroy();
		}
		this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, clampedX, clampedY);
		this.crosshair.setVisible(true);
		this.crosshairPos = { x: clampedX, y: clampedY };

		console.log('CROSSHAIR PLACED AT SCREEN:', clampedX, clampedY, pointer.x, pointer.y);
	}


	/**
	 * Handle drag move - pan container (NOT image)
	 * Crosshair automatically moves with container
	 */
	private handleDragMove(pointer: Phaser.Input.Pointer, dragX: number, dragY: number) {

		// Check if we are two-finger zooming - if so, ignore drag
		if (this.scene.input.pointer1.isDown && this.scene.input.pointer2.isDown) {

			if (this.isZooming === false) {
				// Start zooming
				this.handleZoomStart(pointer);
				return;
			}
			// zoom instead of drag
			const distance: number = Phaser.Math.Distance.Between(
				this.scene.input.pointer1.position.x,
				this.scene.input.pointer1.position.y,
				this.scene.input.pointer2.position.x,
				this.scene.input.pointer2.position.y
			);
			const zoomFactor = (distance - this.zoomStartDistance) / this.zoomStartDistance + 1;
			this.currentScale = Phaser.Math.Clamp(this.zoomStartScale * zoomFactor, this.minScale, this.maxScale);
			this.hotspotContainer.setScale(this.currentScale);
			// if (this.crosshair) {
			// 	this.crosshair.setScale(1 / this.currentScale);
			// }
			console.log('HotspotQuestion::handleDragMove: Two-finger zoom detected, distance =', distance);
			this.scene.socket?.emit('consolelog', `HotspotQuestion::handleDragMove: Two-finger zoom detected, startDistance = ${this.zoomStartDistance}, distance = ${distance} , zoomFactor=${zoomFactor}, zoomStartScale=${this.zoomStartScale}, currentScale=${this.currentScale}	`);
			return;
		}

		this.isDragging = true;

		// Calculate drag deltas
		const deltaX = pointer.position.x - pointer.prevPosition.x;
		const deltaY = pointer.position.y - pointer.prevPosition.y;

		// Convert to world-space deltas to account for camera zoom
		const worldDeltaX = deltaX / this.scene.cameras.main.zoom;
		const worldDeltaY = deltaY / this.scene.cameras.main.zoom;

		// Move the container
		this.hotspotContainer.x += worldDeltaX;
		this.hotspotContainer.y += worldDeltaY;

		// This is better - set to drag position directly - but only works if image is moved NOT container
		// this.answerImage.x = dragX;
		// this.answerImage.y = dragY;

		// Apply bounds to keep image visible
		// this.applyDragBounds(answerHeight);
	};

	/**
	 * Handle drag end - stop panning
	 */
	private handleDragEnd(): void {

		// Clear dragging flag after a short delay
		this.scene.time.delayedCall(50, () => {
			this.isDragging = false;
		});
		console.log('HotspotQuestion::handleDragEnd');
		this.scene.socket?.emit('consolelog', 'HotspotQuestion::handleDragEnd');
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

		// ✅ Crosshair scales automatically! (same container)
		// No updateCrosshairPosition() needed!

		// ✅ BUT: Scale crosshair inversely to maintain visual size
		// if (this.crosshair) {
		// 	this.crosshair.setScale(1 / this.currentScale);
		// }
	}

	private handleZoomStart(pointer: Phaser.Input.Pointer): void {

		const p1 = this.scene.input.pointer1
		const p2 = this.scene.input.pointer2

		console.log('HotspotQuestion::handleZoomStart:', p1);
		this.scene.socket?.emit('consolelog', 'HotspotQuestion::handleZoomStart: ' + JSON.stringify(p1.position) + JSON.stringify(p2.position) + p1.isDown + p2.isDown);

		if (p1.isDown && p2.isDown) {
			const distance: number = Phaser.Math.Distance.Between(
				p1.position.x,
				p1.position.y,
				p2.position.x,
				p2.position.y
			);
			this.zoomStartDistance = distance;
			this.zoomStartScale = this.currentScale;
			this.isZooming = true;
		}

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

	protected revealAnswerUI(): void {
		const allocated = this.calculateLayout();
		const answerHeight = allocated['answers'] || 0;
		this.showResults(answerHeight);
	}

	protected showResults(answerHeight: number): void {

		// First mark all the guesses made by the players
		if (this.questionData.results) {
			Object.entries(this.questionData.results).forEach(([sessionID, result]) => {
				if (result && result.x !== undefined && result.y !== undefined) {
					const guessCrosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, result.x, result.y);
					guessCrosshair.setTint(0x008000);
				}
			});
		}

		// HOTSPOT: display the crosshair at the answer position
		// POINT-IT-OUT: display a rectangle at the answer position
		if (this.questionData.type === 'hotspot') {
			this.crosshairPos = { x: this.questionData.answer.x, y: this.questionData.answer.y };
			this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos.x, this.crosshairPos.y);
			this.crosshair.setScale(2);
		} else {
			console.log('Point-It-Out showResults:', this.questionData.answer);
			this.crosshairPos = {
				x: (this.questionData.answer.start.x + this.questionData.answer.end.x) / 2,
				y: (this.questionData.answer.start.y + this.questionData.answer.end.y) / 2
			};
			this.addRectangleAtNormalizedPosition(this.answerImage, this.questionData.answer);
		}

		// Experiemnt with zooming the image to make the answer more visible
		// Try just zooming in on one quadrant (topleft, topright, bottomleft, bottomright)
		const newScale = 2;
		const originX = this.answerImage.width * this.answerImage.scaleX / -2;
		const originY = 0;

		// crosshairX and Y are the position of the crosshair relative to image origin (top centre)
		const crosshairX = originX + this.crosshairPos.x * this.answerImage.width * this.answerImage.scaleX / 1000;
		const crosshairY = originY + this.crosshairPos.y * this.answerImage.height * this.answerImage.scaleY / 1000;

		// So we have to translate hotspotContainer to make the crosshair position into the centre
		// hotspotContainer currently at (0, 0) so we need to move it to (-crosshairX, -crosshairY)
		// Also need to allow for new scale and adjusting Y position to be in the middle of the vertical space
		const translateX = 0 - newScale * crosshairX;
		const translateY = this.scene.getY((answerHeight / 2)) - newScale * crosshairY;

		console.log('Image:', crosshairX, crosshairY, translateX, translateY);

		// Instead of just zooming in on a section instead make entire image interactive and let host zoom for themselves
		this.makeInteractive();

		// this.hotspotContainer.setPosition(translateX, translateY);
		// this.hotspotContainer.setScale(newScale);
		// this.scene.tweens.add({
		// 	targets: this.hotspotContainer,
		// 	scaleX: newScale,
		// 	scaleY: newScale,
		// 	x: translateX,
		// 	y: translateY,
		// 	duration: 750,
		// 	ease: 'easeInOut'
		// })
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