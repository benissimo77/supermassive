import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { HotspotQuestionData } from "./QuestionTypes";
import { ImageLoader } from "src/utils/ImageLoader";

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
 * PlayerHotspotQuestion - Player side of both 'hotspot' and 'point-it-out' question types.
 * Handles displaying the image in the answer area, and the tap-to-place-crosshair + pan/zoom interaction.
 * See HotspotQuestion for the host-side display and the shared coordinate-system documentation.
 */
export default class PlayerHotspotQuestion extends PlayerBaseQuestion {

	private answerImage: Phaser.GameObjects.Image;
	private crosshair: Phaser.GameObjects.Image;
	private crosshairPos: Coordinate | null = null;
	private submitButton: NineSliceButton;
	private hitZone: Phaser.GameObjects.Zone;

	// Submit button: fixed physical size, pinned to the bottom-right corner - same treatment and
	// same values as PlayerOrdering's submit button, so the one persistent "action" button players
	// see across question types stays visually consistent. It isn't part of the content that
	// should fill available space, so it must stay a constant, comfortable CSS-px tap-target size
	// on every device rather than scaling proportionally with the canvas.
	private readonly SUBMIT_WIDTH_PX = 120;
	private readonly SUBMIT_HEIGHT_PX = 32;
	private readonly SUBMIT_MARGIN_PX = 12;

	// Zoom/Pan state
	private minScale: number = 0.75;
	private maxScale: number = 4;
	private currentScale: number = 1;
	private pointerCoords: PhaserPointer[] = [];
	private currentTransform: Transform = { x: 0, y: 0, scale: 1 };

	constructor(scene: BaseScene, questionData: HotspotQuestionData) {
		super(scene, questionData);

	}

	// PlayerBaseQuestion has no media-loading of its own (unlike BaseQuestion) since most question
	// types don't need it - Hotspot does, so it loads its own image directly via the shared ImageLoader utility.
	private async createQuestionImage(url: string): Promise<Phaser.GameObjects.Image> {
		console.log('PlayerHotspotQuestion::createQuestionImage:', url.substring(0, 50));
		try {
			const textureKey = await ImageLoader.loadImage(this.scene, url, 'audio-settings');
			const image = this.scene.add.image(0, 0, textureKey);
			image.setOrigin(0.5);
			return image;
		} catch (error) {
			console.error('PlayerHotspotQuestion::createQuestionImage - Failed to load:', error);
			const image = this.scene.add.image(0, 0, 'audio-settings');
			image.setOrigin(0.5, 0.5);
			return image;
		}
	}

	private configureImageSize(image: Phaser.GameObjects.Image, height: number): void {
		const maxWidth = 1920;
		const scale = Math.min(maxWidth / image.width, this.scene.getY(height) / image.height);
		image.setScale(scale);
	}

	/**
	 * Create answer UI elements: the image, submit button, and interactive hit zone.
	 */
	protected async createAnswerUI(): Promise<void> {
		console.log('PlayerHotspotQuestion::createAnswerUI:', this.questionData.type, this.questionData.mode);

		// Placeholder size - resized to match the image's actual display bounds in
		// showAnswerContent() below. Parented to answerContainer (not the whole-canvas zone
		// this used to be) so it only ever covers the image itself, not anything else on
		// screen sharing this container's space (e.g. the submit button, or in solo mode the
		// advance button living entirely outside this question) - and so it automatically
		// pans/zooms together with the image, since both are children of the same container.
		this.hitZone = this.scene.add.zone(0, 0, 1, 1);
		this.answerContainer.add(this.hitZone);

		if (!this.questionData.image) {
			console.warn('PlayerHotspotQuestion::createAnswerUI: No image provided in question data');
			return;
		}

		this.submitButton = new NineSliceButton(this.scene, 'SUBMIT');
		this.add(this.submitButton);

		this.answerImage = await this.createQuestionImage(this.questionData.image);
		this.answerContainer.add(this.answerImage);

		console.log('PlayerHotspotQuestion::createAnswerUI: Created answerImage, crosshair, submitButton');

		this.scene.input.addPointer(1);

		this.makeInteractive();
	}

	/**
	 * Position answer UI elements based on available height. Can be called multiple times (e.g. on resize).
	 */
	protected showAnswerContent(answerHeight: number): void {
		console.log('PlayerHotspotQuestion::showAnswerContent:', answerHeight);

		const physicalScale = this.scene.getPhysicalScale();
		// Floored to a logical-unit minimum so it doesn't shrink to a disproportionately tiny
		// fraction of the canvas on a wide window (e.g. a laptop as a solo/player screen) -
		// physicalScale alone targets a constant CSS-px size regardless of canvas width, which
		// looks right on a phone but too small on a wide one.
		const submitW = Math.max(this.SUBMIT_WIDTH_PX * physicalScale, 200);
		const submitH = Math.max(this.SUBMIT_HEIGHT_PX * physicalScale, 55);
		const submitMargin = Math.max(this.SUBMIT_MARGIN_PX * physicalScale, 16);
		this.submitButton.setButtonSize(submitW, submitH);
		this.submitButton.adjustTextSize(submitH);
		this.submitButton.setPosition(
			1920 - (submitW / 2 + submitMargin),
			this.scene.getY(answerHeight) - (submitH / 2 + submitMargin)
		);

		answerHeight -= this.scene.getY(60);
		this.configureImageSize(this.answerImage, answerHeight);
		this.answerImage.setPosition(0, 0);

		// Keep the hit zone matched to the image's actual current display bounds (changes
		// whenever this runs, e.g. on resize) - see createAnswerUI() for why this must track
		// the image rather than covering the whole canvas.
		const imageDisplayWidth = this.answerImage.width * this.answerImage.scaleX;
		const imageDisplayHeight = this.answerImage.height * this.answerImage.scaleY;
		this.hitZone.setPosition(0, 0);
		this.hitZone.setSize(imageDisplayWidth, imageDisplayHeight);
		// Re-assert the hit area explicitly rather than relying on setSize() alone to keep it
		// in sync - but only if still meant to be interactive (checking .enabled specifically,
		// not just .input truthy) - this can run again after makeNonInteractive() (e.g. a
		// resize/rotation after the player already submitted), and must not accidentally
		// re-enable it.
		if (this.hitZone.input?.enabled) {
			this.hitZone.setInteractive();
		}

		// RESET zoom/pan to default - also reset the actual container scale to match, otherwise
		// a resize while zoomed in would re-center the position (via PlayerBaseQuestion) but leave
		// the real zoom level stuck, out of sync with this tracking variable.
		this.currentScale = 1;
		this.answerContainer.setScale(1);

		// Position crosshair (if visible, convert normalized → screen coords)
		if (this.crosshairPos) {
			if (this.crosshair) {
				this.crosshair.destroy();
			}
			this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos?.x, this.crosshairPos?.y);
			this.crosshair.setTint(0xFF0000);
		}

		console.log('PlayerHotspotQuestion::showAnswerContent: Positioned image, crosshair, submit button');
	}

	protected makeInteractive(): void {
		console.log('PlayerHotspotQuestion::makeInteractive');

		// Make image interactive for tap-to-place-crosshair
		this.hitZone.setInteractive({ draggable: false });
		this.hitZone.on('pointerup', this.handlePointerUp, this);
		this.hitZone.on('pointerdown', this.handlePointerDown, this);
		this.hitZone.on('pointermove', this.handlePointerMove, this);

		this.hitZone.on('pointerupoutside', this.handlePointerUp, this); // Finger released outside the image
		this.hitZone.on('pointercancel', this.handlePointerUp, this);    // OS intercepted the touch

		// Add mouse wheel zoom
		this.hitZone.on('wheel', this.handleMouseWheel, this);

		// Submit button handler
		this.submitButton.setInteractive({ useHandCursor: true });
		this.submitButton.on('pointerup', this.handleSubmit, this);

		console.log('PlayerHotspotQuestion::makeInteractive: Added tap, drag, zoom, submit handlers');
	}

	protected makeNonInteractive(): void {
		console.log('PlayerHotspotQuestion::makeNonInteractive');

		this.hitZone.disableInteractive();
		this.hitZone.removeAllListeners();

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
		this.scene.socket?.emit('consolelog', 'PlayerHotspotQuestion::handlePointerDown: Pointer down: ' + pointer.id + ' : ' + pointer.x + ',' + pointer.y+ ' Coords: ' + this.pointerCoords[1] + ',' + this.pointerCoords[2]);
		this.pointerCoords[pointer.id] = this.getPointerData(pointer);
		this.resetDrag();
	}

	private handlePointerMove(pointer: Phaser.Input.Pointer): void {

		this.scene.socket?.emit('consolelog', 'PlayerHotspotQuestion::handlePointerMove: Pointer move at ' + pointer.id + ' : ' + this.pointerCoords[1] + ',' + this.pointerCoords[2]);

		// For cases when player is on laptop we must have a mouse down
		// isDown always true for touch so works for laptops and mobile devices
		if (!pointer.isDown) {
			return;
		}

		// Update the current pointer to get latest position
		this.pointerCoords[pointer.id].x = pointer.x;
		this.pointerCoords[pointer.id].y = pointer.y;

		const activePointers = Object.values(this.pointerCoords);
		const cameraZoom = this.scene.cameras.main.zoom; // The missing link!

		if (activePointers.length === 1) {
			// 1. PAN ONLY
			const p1 = activePointers[0];

			// Divide the screen movement by the camera zoom to get the true world movement
			this.answerContainer.x = this.currentTransform.x + ((p1.x - p1.downX) / cameraZoom);
			this.answerContainer.y = this.currentTransform.y + ((p1.y - p1.downY) / cameraZoom);

		} else if (activePointers.length >= 2) {
			// 2. PAN + ZOOM (Two Fingers)
			const p1 = activePointers[0];
			const p2 = activePointers[1];

			const startMidX = (p1.downX + p2.downX) / 2;
			const startMidY = (p1.downY + p2.downY) / 2;
			const currentMidX = (p1.x + p2.x) / 2;
			const currentMidY = (p1.y + p2.y) / 2;

			// Calculate new scale
			const startDist = Phaser.Math.Distance.Between(p1.downX, p1.downY, p2.downX, p2.downY);
			const currentDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);

			let newScale = this.currentTransform.scale;
			if (startDist > 10) {
				newScale *= (currentDist / startDist);
				newScale = Phaser.Math.Clamp(newScale, this.minScale, this.maxScale);
			}
			this.answerContainer.setScale(newScale);

			// -- THE WORLD VECTOR MATH --

			// A. Get exact absolute world coordinates for our fingers
			const worldStartMid = this.scene.cameras.main.getWorldPoint(startMidX, startMidY);
			const worldCurrentMid = this.scene.cameras.main.getWorldPoint(currentMidX, currentMidY);

			// B. Calculate vector from the container's center to the pinch point
			// Because both are World Coordinates, we never mix up spaces!
			const vecX = worldStartMid.x - (this.currentTransform as any).worldOriginX;
			const vecY = worldStartMid.y - (this.currentTransform as any).worldOriginY;

			// C. How much did the scale change?
			const scaleRatio = newScale / this.currentTransform.scale;

			// D. When scale increases, the image visually slides outward by this amount
			const slideX = vecX * (scaleRatio - 1);
			const slideY = vecY * (scaleRatio - 1);

			// E. How far did the physical fingers drag across the screen?
			const panX = worldCurrentMid.x - worldStartMid.x;
			const panY = worldCurrentMid.y - worldStartMid.y;

			// F. Final Position = Start State + Finger Drag - Visual Scale Slide
			this.answerContainer.x = this.currentTransform.x + panX - slideX;
			this.answerContainer.y = this.currentTransform.y + panY - slideY;
		}
	}

	private handlePointerUp(pointer: Phaser.Input.Pointer): void {
		this.scene.socket?.emit('consolelog', 'PlayerHotspotQuestion::handlePointerUp: Pointer up at ' + pointer.id + ' : ' + pointer.x + ',' + pointer.y);
		delete this.pointerCoords[pointer.id];

		// Since we are 'resetting' from now we need to update currentTransform and pointers
		this.resetDrag();

		// If both pointers are up we can consider final possibility: a tap
		if (this.pointerCoords[1] || this.pointerCoords[2]) {
			return;
		}

		const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, pointer.downX, pointer.downY);
		console.log('PlayerHotspotQuestion::handlePointerUp: Pointer:', pointer, ' Distance moved:', distance);

		// If pointer didn't move much, treat as a tap
		if (distance < 10) {
			if (this.crosshair) {
				this.crosshair.destroy();
			}
			this.crosshairPos = this.screenToNormalized(pointer.x, pointer.y);
			this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos.x, this.crosshairPos.y);
			this.crosshair.visible = true;
			this.crosshair.setTint(0xFF0000);
			this.animateCrosshairScale(this.crosshair.scale);
		}
	}

	private resetDrag(): void {
		const matrix = this.answerContainer.getWorldTransformMatrix();
		this.currentTransform = {
			x: this.answerContainer.x,
			y: this.answerContainer.y,
			scale: this.answerContainer.scale,
			worldOriginX: matrix.tx, // Snapshot the absolute world center
			worldOriginY: matrix.ty
		} as any; // Cast as any just in case you don't want to update your Transform type definition at the top

		// Update the origin for ALL currently active pointers
		Object.values(this.pointerCoords).forEach(ptr => {
			ptr.downX = ptr.x;
			ptr.downY = ptr.y;
		});
	}

	/**
	 * Handle mouse wheel - zoom container (NOT image)
	 * Crosshair automatically scales with container
	 */
	private handleMouseWheel(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number, deltaZ: number): void {

		const zoomDelta = deltaX > 0 ? 0.9 : 1.1;
		this.currentScale *= zoomDelta;
		this.currentScale = Phaser.Math.Clamp(this.currentScale, 0.5, 3);
		this.answerContainer.setScale(this.currentScale);

		console.log('PlayerHotspotQuestion::handleMouseWheel: Zoom =', deltaX, this.currentScale);
	}

	/**
	 * Handle submit button click. Sends normalized coordinates (0-1000) to server.
	 */
	private handleSubmit(): void {
		console.log('PlayerHotspotQuestion::handleSubmit');

		if (!this.crosshairPos) {
			console.warn('PlayerHotspotQuestion::handleSubmit: No crosshair placed!');
			return;
		}

		this.makeNonInteractive();

		const answer = this.crosshairPos;
		console.log('PlayerHotspotQuestion::handleSubmit: Answer (normalized 0-1000):', answer);

		this.submitAnswer(answer);

		this.playSubmitAnimation();
	}

	private addCrosshairAtNormalizedPosition(image: Phaser.GameObjects.Image, normalizedX: number, normalizedY: number): Phaser.GameObjects.Image {

		const crosshair = this.scene.add.image(0, 0, 'crosshair');
		const cameraZoom = this.scene.cameras.main.zoom;
		crosshair.setScale(1 / cameraZoom);

		const imageWidth = image.width * image.scaleX;
		const imageHeight = image.height * image.scaleY;

		const imageX = (normalizedX * image.width * image.scaleX / 1000) - (imageWidth / 2);
		const imageY = (normalizedY * image.height * image.scaleY / 1000) - (imageHeight / 2);

		crosshair.setPosition(imageX, imageY);
		this.answerContainer.add(crosshair);

		console.log('Crosshair added:', { imageX, imageY, imageWidth, imageHeight });
		return crosshair;
	}

	private animateCrosshairScale(targetScale: number): void {
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

	private screenToNormalized(screenX: number, screenY: number): Coordinate {
		const matrix = this.answerContainer.getWorldTransformMatrix();
		const worldPointer = this.scene.cameras.main.getWorldPoint(screenX, screenY);
		const localPointer = matrix.applyInverse(worldPointer.x, worldPointer.y);
		const pointerX = localPointer.x + (this.answerImage.width * this.answerImage.scaleX) / 2;
		const pointerY = localPointer.y + (this.answerImage.height * this.answerImage.scaleY) / 2;
		const normalizedX = Math.round(1000 * pointerX / (this.answerImage.width * this.answerImage.scaleX));
		const normalizedY = Math.round(1000 * pointerY / (this.answerImage.height * this.answerImage.scaleY));

		return { x: normalizedX, y: normalizedY };
	}

	public destroy(): void {
		console.log('PlayerHotspotQuestion::destroy');
		if (this.scene) {
			this.makeNonInteractive();
		}
		if (this.hitZone) {
			this.hitZone.destroy();
		}
		super.destroy();
	}
}
