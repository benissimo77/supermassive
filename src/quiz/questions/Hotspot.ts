import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { HotspotQuestionData } from "./QuestionTypes";
import { PhaserPlayer } from "../PhaserPlayer";

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
	private hitZone:Phaser.GameObjects.Zone;

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

		this.hitZone = this.scene.add.zone(960, this.scene.getY(540), 1920, this.scene.getY(1080));

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
	protected showAnswerContent(answerHeight: number): void {
		console.log('HotspotQuestion::showAnswerContent:', answerHeight, this.scene.TYPE);

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
			this.crosshair.setTint(0xFF0000);
		}

		console.log('HotspotQuestion::showAnswerContent: Positioned image, crosshair, submit button');
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
		this.hitZone.setInteractive({ draggable: false });
		this.hitZone.on('pointerup', this.handlePointerUp, this);
		this.hitZone.on('pointerdown', this.handlePointerDown, this);
		this.hitZone.on('pointermove', this.handlePointerMove, this);

		this.hitZone.on('pointerupoutside', this.handlePointerUp, this); // Finger released outside the image
		this.hitZone.on('pointercancel', this.handlePointerUp, this);    // OS intercepted the touch

		// Add drag handlers for panning image - these are global to the scene
		// this.answerImage.on('drag', this.handleDragMove, this);
		// this.answerImage.on('dragend', this.handleDragEnd, this);

		// Add mouse wheel zoom (pinch-to-zoom TODO later)
		this.hitZone.on('wheel', this.handleMouseWheel, this);

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
		this.hitZone.disableInteractive();
		this.hitZone.removeAllListeners();

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
		this.scene.socket?.emit('consolelog', 'HotspotQuestion::handlePointerDown: Pointer down: ' + pointer.id + ' : ' + pointer.x + ',' + pointer.y+ ' Coords: ' + this.pointerCoords[1] + ',' + this.pointerCoords[2]);
		this.pointerCoords[pointer.id] = this.getPointerData(pointer);
		this.resetDrag();
	}

	private handlePointerMove(pointer: Phaser.Input.Pointer): void {

		this.scene.socket?.emit('consolelog', 'HotspotQuestion::handlePointerMove: Pointer move at ' + pointer.id + ' : ' + this.pointerCoords[1] + ',' + this.pointerCoords[2]);

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
			this.hotspotContainer.x = this.currentTransform.x + ((p1.x - p1.downX) / cameraZoom);
			this.hotspotContainer.y = this.currentTransform.y + ((p1.y - p1.downY) / cameraZoom);

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
			this.hotspotContainer.setScale(newScale);

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
			this.hotspotContainer.x = this.currentTransform.x + panX - slideX;
			this.hotspotContainer.y = this.currentTransform.y + panY - slideY;
		}
		// Check if we might be zooming (both pointers down)
		// if (this.pointerCoords[1] && this.pointerCoords[2]) {

		// 	const originalDistance: number = Phaser.Math.Distance.Between(
		// 		this.pointerCoords[1].downX,
		// 		this.pointerCoords[1].downY,
		// 		this.pointerCoords[2].downX,
		// 		this.pointerCoords[2].downY
		// 	);
		// 	const currentDistance: number = Phaser.Math.Distance.Between(
		// 		this.pointerCoords[1].x,
		// 		this.pointerCoords[1].y,
		// 		this.pointerCoords[2].x,
		// 		this.pointerCoords[2].y
		// 	);
		// 	const zoomFactor = (currentDistance - originalDistance) / originalDistance + 1;
		// 	this.currentScale = Phaser.Math.Clamp(this.currentTransform.scale * zoomFactor, this.minScale, this.maxScale);
		// 	this.hotspotContainer.setScale(this.currentScale);

			// Adjust the position of hotspotContainer to ensure that the midpoint between the two pointers remains consistent
			// this.hotspotContainer.x = this.currentTransform.x + this.hotspotContainer.scale * ((this.pointerCoords[1].x + this.pointerCoords[2].x) / 2 - (this.pointerCoords[1].downX + this.pointerCoords[2].downX) / 2);
			// this.hotspotContainer.y = this.currentTransform.y + this.hotspotContainer.scale * ((this.pointerCoords[1].y + this.pointerCoords[2].y) / 2 - (this.pointerCoords[1].downY + this.pointerCoords[2].downY) / 2);

		// } else {

		// 	// See if a basic drag will work with simply a move by the pointer difference
		// 	const thisPointer = this.pointerCoords[pointer.id];
		// 	this.hotspotContainer.x = this.currentTransform.x + this.currentTransform.scale * (thisPointer.x - thisPointer.downX);
		// 	this.hotspotContainer.y = this.currentTransform.y + this.currentTransform.scale * (thisPointer.y - thisPointer.downY);
		// }
			
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
			this.crosshair.setTint(0xFF0000);
			this.animateCrosshairScale(this.crosshair.scale);
		}
	}

private resetDrag(): void {
    const matrix = this.hotspotContainer.getWorldTransformMatrix();
    this.currentTransform = {
        x: this.hotspotContainer.x,
        y: this.hotspotContainer.y,
        scale: this.hotspotContainer.scale,
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

	public createRevealAnswerTimeline(): gsap.core.Timeline {

		// Slight tweak to regular pattern - we create a blank timeline and add the minimise content a bit later in the sequence
		const tl = this.minimizeQuestionContent();
		this.tl = tl;

		// Mark all the guesses made by the players ONE BY ONE first
        if (this.questionData.responses) {
            const playerEntries = Object.entries(this.questionData.responses);

			// 1. Move ALL players to the top of the screen (y = 120), retaining their X positions
			tl.addLabel('MoveAllUp', 0);
			for (const [sessionID] of playerEntries) {
				const player: PhaserPlayer = this.scene.getPlayerBySessionID(String(sessionID));
				if (player) {
					// tl.to(player, {
					// 	y: this.scene.getY(120),
					// 	duration: 0.1, // Super fast pre-animation
					// 	ease: 'bounce.out'
					// }, 'MoveAllUp');
					player.setY(this.scene.getY(120));
				}
			}

			tl.addLabel('AnimatePlayers', '>+0.3'); // Start animating players after a brief pause
			for (const [sessionID, playerAnswer] of playerEntries) {
                const answer = playerAnswer.answer;
				const player: PhaserPlayer = this.scene.getPlayerBySessionID(String(sessionID));

                if (answer && answer.x !== undefined && answer.y !== undefined && player) {
					
					// 2. Swoop the active player to the centre of the screen smoothly
					tl.to(player, {
						x: 960,
						y: this.scene.getY(540),
						scale: 1.2,
						duration: 0.6,
						ease: 'power2.inOut'
					}, '>');

					// 3. Very brief hang time, then smoothly accelerate directly downwards
					tl.to(player, {
						y: this.scene.getY(1080) - 60,
						duration: 0.6,
						ease: 'power2.inOut'
					}, '>');

					// Pre-calculate crosshair position so we can use its worldX
                    const guessCrosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, answer.x, answer.y);
					guessCrosshair.setTint(0xFF0000);
                    const finalScale = guessCrosshair.scale * 0.8;
					
					// Make it invisible to start with
					guessCrosshair.setAlpha(0);
					guessCrosshair.setScale(finalScale * 12); // Start huge

					// 4. Slide avatar left/right to align with crosshair X position
					// By overlapping this with the downward movement (-0.2s), the player curves gracefully into the corner rather than moving in rigid L-shapes
					const worldX = guessCrosshair.getWorldTransformMatrix().getX(0, 0);
					tl.to(player, {
						x: worldX,
						scale: 1,
						duration: 0.6,
						ease: 'power2.inOut'
					}, '>-0.2');

					// 5. Crosshair appears. "Falling" effect that shrinks slowly, speeds up, and bounces at the end
					// For PointItOut make this animation quicker its less relevant they either got it or they didn't...
					let duration = 1.6;
					if (this.questionData.type === 'point-it-out') {
						duration = 0.4;
					}
                    tl.to(guessCrosshair, { 
						alpha: 1, 
						scale: finalScale, 
						duration: duration, 
						ease: 'bounce.out' 
					}, '>');
					// Short pause before next player
					tl.set({}, {}, '>+0.2');
                }
            }
        }

		// FINALLY, REVEAL CORRECT ANSWER AFTER ALL PLAYERS
		tl.addLabel('ShowCorrectAnswer', '>+0.3');

		// HOTSPOT: display the crosshair at the answer position
		// POINT-IT-OUT: display a rectangle at the answer position
		if (this.questionData.type === 'hotspot') {
			this.crosshairPos = { x: this.questionData.answer.x, y: this.questionData.answer.y };
			const correctCrosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos.x, this.crosshairPos.y);
			correctCrosshair.setTint(0x00FF00);
			
			// Animate crosshair scale (simulate falling using bounce)
			correctCrosshair.setAlpha(0);
			const targetScale = correctCrosshair.scale;
			correctCrosshair.setScale(targetScale * 12); // Start huge

			tl.to(correctCrosshair, {
				alpha: 1,
				scale: targetScale,
				duration: 1.5,
				ease: 'bounce.out'
			}, 'ShowCorrectAnswer');

		} else {
			console.log('Point-It-Out showResults:', this.questionData.answer);
			this.crosshairPos = {
				x: (this.questionData.answer.start.x + this.questionData.answer.end.x) / 2,
				y: (this.questionData.answer.start.y + this.questionData.answer.end.y) / 2
			};
			const rect = this.addRectangleAtNormalizedPosition(this.answerImage, this.questionData.answer);
			tl.from(rect, { 
                alpha: 0, 
                duration: 0.5, 
                ease: 'none' 
            }, 'ShowCorrectAnswer');
		}

        if (this.questionData.responses) {
            // Add flashText to players who provided a response
            // Rely on the score field sent from server as this is our source of truth
            tl.addLabel('ShowScores', '>+0.5');
			for (const [sessionID, playerAnswer] of Object.entries(this.questionData.responses)) {
				const player: PhaserPlayer = this.scene.getPlayerBySessionID(String(sessionID));
				if (player) {
                    if (playerAnswer.snoozed) {
                        tl.add(() => { player.flashText('Z', '#ff0000'); }, 'ShowScores');
                        tl.add(() => { player.flashText('Z', '#ff0000'); }, 'ShowScores+=0.5');
                        tl.add(() => { player.flashText('Z', '#ff0000'); }, 'ShowScores+=1.0');
                        tl.add(() => { player.flashText('Z', '#ff0000'); }, 'ShowScores+=1.5');
                    } else {
                        tl.add(() => {
                            player.flashText(playerAnswer.score, '#00ff00');
                        }, 'ShowScores');
                    }
                }
            }

			
        }

		return tl;
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
		if (this.hitZone) {
			this.hitZone.destroy();
		}
		super.destroy();
	}
}