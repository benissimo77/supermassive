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

/**
 * HotspotQuestion - Host side of both 'hotspot' and 'point-it-out' question types.
 * Player-side tap-to-place-crosshair + pan/zoom interaction lives in PlayerHotspotQuestion.
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
 *   - Host: Image displayed in question area (BaseQuestion handles this); this class also
 *     positions an (invisible, non-interactive) answer-area copy so the reveal timeline below
 *     has somewhere to draw the correct-answer/player-guess crosshairs onto.
 *
 * HotspotContainer:
 *   - Contains answerImage and crosshair plus additional avatars later
 *   - Always positioned at centre of answer area (960, answerHeight / 2)
 * AnswerImage:
 *   - Origin set to Phaser (0, 0) = centre
 *   - Scaled relative to HotspotContainer
 *   - Initial position (0,0) initial scale set to fill available answer area
 */
export default class HotspotQuestion extends BaseQuestion {

	private hotspotContainer: Phaser.GameObjects.Container;
	private answerImage: Phaser.GameObjects.Image;
	private crosshair: Phaser.GameObjects.Image;
	private crosshairPos: Coordinate | null = null;
	private submitButton: NineSliceButton;

	constructor(scene: BaseScene, questionData: HotspotQuestionData) {
		super(scene, questionData);

		this.hotspotContainer = this.scene.add.container(0, 0);
		this.answerContainer.add(this.hotspotContainer);
	}

	protected getAnswerUIWidth(): number {
		return 1920; // Full width (image can be large)
	}

	/**
	 * Create answer UI elements. Host reuses the image BaseQuestion already loaded for the
	 * question area; the submit button exists but stays hidden (host never submits an answer) -
	 * kept only because showAnswerContent() positions it unconditionally.
	 */
	protected async createAnswerUI(): Promise<void> {
		console.log('HotspotQuestion::createAnswerUI:', this.questionData.type, this.questionData.mode);

		if (!this.questionData.image) {
			console.warn('HotspotQuestion::createAnswerUI: No image provided in question data');
			return;
		}

		this.submitButton = new NineSliceButton(this.scene, 'SUBMIT');
		this.answerContainer.add(this.submitButton);
		this.submitButton.setVisible(false);

		this.answerImage = this.questionImage;
		this.hotspotContainer.add(this.answerImage);

		console.log('HotspotQuestion::createAnswerUI: Created answerImage, submitButton');
	}

	/**
	 * Position answer UI elements based on available height.
	 * Can be called multiple times (e.g., on resize).
	 */
	protected showAnswerContent(answerHeight: number): void {
		console.log('HotspotQuestion::showAnswerContent:', answerHeight);

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

		// Position crosshair (if visible, convert normalized → screen coords)
		if (this.crosshairPos) {
			if (this.crosshair) {
				this.crosshair.destroy();
			}
			this.crosshair = this.addCrosshairAtNormalizedPosition(this.answerImage, this.crosshairPos?.x, this.crosshairPos?.y);
			this.crosshair.setTint(0xFF0000);
		}

		console.log('HotspotQuestion::showAnswerContent: Positioned image, crosshair, submit button');
	}

	// Host never makes anything interactive (that's PlayerHotspotQuestion's job) - kept as no-ops
	// to satisfy BaseQuestion's abstract contract.
	protected makeInteractive(): void {
	}

	protected makeNonInteractive(): void {
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
		super.destroy();
	}
}
