import { BaseScene } from "src/BaseScene";
import gsap from 'gsap';

export class PlayerConfig {
	name: string;
	avatar: string;
	socketID: string;
	sessionID: string;
	userID: string | null;
	connected: boolean = true;
}

export enum PhaserPlayerState {
	FLOATING,
	ANSWERING,
	ANSWERED,
	REVEALING,
	RACING,
	HIDDEN
}

export class PhaserPlayer extends Phaser.GameObjects.Container {
	public scene: BaseScene;
	private playerConfig: PlayerConfig;
	private socketID: string;
	private sessionID: string;
	private userID: string | null;
	protected playerTexture: Phaser.GameObjects.RenderTexture;
	private playerScore: number;
	protected playerScoreText: Phaser.GameObjects.Text;
	private playerState: PhaserPlayerState = PhaserPlayerState.FLOATING;
	private flameEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
	private leaderPulseTween: gsap.core.Tween | null = null;
	private leaderGlow: Phaser.FX.Glow | null = null;

	constructor(scene: BaseScene, playerConfig: PlayerConfig) {
		super(scene, 0, 0);
		this.scene = scene;
		this.playerConfig = playerConfig;

		console.log('PhaserPlayer constructor:', playerConfig.name);

		// Store IDs for later use
		this.socketID = playerConfig.socketID;
		this.sessionID = playerConfig.sessionID;
		this.userID = playerConfig.userID || null;

		// Load avatar and complete the setup
		scene.load.once('complete', () => {
			console.log('*** Avatar file loaded...');

			// Create a fresh temporary container each time
			const tempContainer = scene.add.container(0, 0);
			this.add(tempContainer);

			// Add panel and name to the container
			const playerNamePanel = scene.add.image(0, 0, 'playernamepanel').setOrigin(0, 0.5);
			const playerName = scene.add.text(120, 0, playerConfig.name.slice(0, 12), {})
				.setOrigin(0, 0.5)
				.setFontFamily('"Titan One", Georgia')
				.setFontSize(40)
				.setColor('#00008b');

			// Adjust the size of the name panel based on name length
			// Name begins at x=120 so add a 20px padding on right side
			const nameTextWidth = playerName.width;
			const namePanelWidth = Math.min(nameTextWidth + 140, 480);
			playerNamePanel.setDisplaySize(namePanelWidth, playerNamePanel.height);

			// While we are here add a text obejct for the score
			this.playerScoreText = scene.add.text(namePanelWidth, -24, '', {})
				.setOrigin(1, 1)
				.setFontFamily('"Titan One", Georgia')
				.setFontSize(40)
				.setColor('#ffffff');
			this.add(this.playerScoreText);


			// Get avatar texture dimensions
			const avatarFrame = scene.textures.get(playerConfig.avatar).getSourceImage();
			const avatarWidth = avatarFrame.width || 100;
			const avatarHeight = avatarFrame.height || 100;
			const shadowDistance = 6;

			console.log(`Avatar image dimensions: ${avatarWidth}x${avatarHeight}`);

			// Create and add avatar with shadow
			const avatarImage = scene.add.image(6, 60, playerConfig.avatar);
			avatarImage.setOrigin(0, 1);

			// Ensure avatar is properly sized if needed
			avatarImage.setDisplaySize(avatarWidth, avatarHeight);

			// Add shadow effect
			if (avatarImage.postFX) {
				// avatarImage.postFX.addShadow(-8, -6, 0.05, 2, 0x000000, 3, 0.6);
			}

			// Create a manual shadow
			const avatarShadow = scene.add.image(6 + shadowDistance, 60 + shadowDistance, playerConfig.avatar);
			avatarShadow.setOrigin(0, 1);
			avatarShadow.setDisplaySize(avatarWidth, avatarHeight);
			avatarShadow.setTint(0x222222);
			avatarShadow.setAlpha(0.4);
			// avatarShadow.setBlendMode(Phaser.BlendModes.MULTIPLY);

			// Constrain shadow to the panel's vertical area
			const shadowTop = avatarShadow.y - avatarHeight;
			const cropTop = Math.max(0, (-playerNamePanel.displayHeight / 2) - shadowTop);
			const cropBottom = Math.min(avatarHeight, (playerNamePanel.displayHeight / 2) - shadowTop);

			if (cropBottom > cropTop) {
				avatarShadow.setCrop(0, cropTop, avatarWidth, cropBottom - cropTop);
			} else {
				avatarShadow.setVisible(false);
			}

			// Add shadow first, then the actual avatar
			tempContainer.add([playerNamePanel, playerName, avatarShadow, avatarImage]);

			// Calculate bounds for the texture (+8 for the shadow below the avatar)
			const textureHeight: integer = avatarImage.height + shadowDistance;
			const textureWidth: integer = 480;

			// Create render texture
			this.playerTexture = scene.add.renderTexture(0, 0, textureWidth, textureHeight);

			// Debug fill texture with colour
			// this.playerTexture.fill(0xffdddd, 0.2);
			// Remove debug tint if you're using it in production
			// this.playerTexture.setTint(0x004000);


			// Set origin point
			const originY: number = (textureHeight - 60) / textureHeight;
			this.playerTexture.setOrigin(0, originY);
			console.log(`Setting origin to: (0, ${originY})`);

			// Use snapshot method to ensure all elements are properly rendered
			this.playerTexture.draw(tempContainer, 0, textureHeight - 60);

			// Clean up temporary objects
			tempContainer.removeAll(true);
			tempContainer.destroy();

			// Add the texture to our container
			this.add(this.playerTexture);

			// Notify subclasses/listeners that playerScoreText and other elements are ready
			this.emit('player-setup-complete');

		}, scene);

		// Start loading the avatar image - workaround for situation where avatar is not supplied (eg host as player)
		if (!playerConfig.avatar) {
			playerConfig.avatar = 'default';
		}
		scene.load.image(playerConfig.avatar, `/img/avatar-100/image-from-rawpixel-id-${playerConfig.avatar}-original.png`);
		scene.load.start();
	}

	updatePlayerScore(score: number) {
		this.playerScore = score;
		if (this.playerScoreText && score > 0) {
			this.playerScoreText.setText(this.playerScore.toString());
		}
	}
	public getScore(): number {
		return this.playerScore || 0;
	}
	public setScore(score: number): void {
		this.updatePlayerScore(score);
	}

	// setPlayerScoreText
	// This method allows setting arbitrary text (eg "+100" for score updates)
	// without changing the actual score number
	setPlayerScoreText(text: string) {
		if (this.playerScoreText) {
			this.playerScoreText.setText(text);
		}
	}
	resetPlayerScoreText() {
		this.playerScoreText.setText('');
		if (this.playerScore) {
			this.updatePlayerScore(this.playerScore);
		}
	}


	public addShine(): void {

		if (this.playerTexture && this.playerTexture.postFX) {
			const shine: Phaser.FX.Shine = this.playerTexture.postFX.addShine(1, 0.2, 5);
			this.scene.time.delayedCall(2000, () => {
				this.playerTexture.postFX.remove(shine);
			});
		}
	}

	public addStars(): void {
		// Create a star particle emitter around the avatar
		// Positioned to center on the avatar (approx x=60, y=10)
		const emitter = this.scene.add.particles(60, 10, 'star-particle', {
			speed: { min: 80, max: 250 },
			scale: { start: 1.5, end: 0 },
			scaleX: {
				onUpdate: (particle: any) => {
					particle.tumblePhase += particle.tumbleSpeed || 0;
					return Math.cos(particle.tumblePhase) * particle.scaleY;
				}
			},
			lifespan: 1500,
			gravityY: -100,
			frequency: 40,
			blendMode: 'ADD',
			tint: [ 0xffff00, 0xffffff, 0xffd700, 0xffa500 ],
			angle: { min: 0, max: 360 },
			rotate: { min: 0, max: 360 }
		});

		// Add 3D tumbling effect to stars
		emitter.onParticleEmit((particle: any) => {
			particle.tumbleSpeed = Math.random() * 0.1 + 0.05;
			particle.tumblePhase = Math.random() * Math.PI * 2;
		});

		this.add(emitter);
		this.sendToBack(emitter); // Move behind the player avatar

		// Stop emitting after 8 seconds (slightly longer than confetti)
		this.scene.time.delayedCall(8000, () => {
			emitter.stop();
			// Destroy after particles are gone
			this.scene.time.delayedCall(2000, () => emitter.destroy());
		});
	}

	// Note: we now make players totally invisible when they disconnect
	// This was done for live streaming, kicking players should make them disappear
	// If needed we can re-introduce the 'ghost' players but for now lets just make them invisible
	disconnect(): void {
		if (this.playerTexture) {
			this.playerTexture.setAlpha(0);
		}
		this.stopFlames();
		this.playerScoreText.setText('');
		this.playerConfig.connected = false;
	}
	connect(): void {
		if (this.playerTexture) {
			this.playerTexture.setAlpha(1);
		}
		this.resetPlayerScoreText();
		this.playerConfig.connected = true;
	}

	destroy(fromScene?: boolean) {
		console.warn(`*** Destroying PhaserPlayer: ${this.playerConfig.name} ***`);

		// Don't destroy  the player - that's very bad - just reparent back to playerContainer
		if ('playerContainer' in this.scene) {
		    this.scene.reparentObject(this, (this.scene as any).playerContainer);
		} else {
			if (this.playerTexture) {
				this.playerTexture.destroy();
			}
			super.destroy(fromScene);
		}
	}

	public getSocketID(): string {
		return this.socketID;
	}

	public getSessionID(): string {
		return this.sessionID;
	}

	public getUserID(): string | null {
		return this.userID;
	}

	public startFlames(): void {

		console.log('PhaserPlayer: startFlames: ON!');

		if (this.flameEmitter) return;

		// Create a fire effect behind/around the avatar
		// Positioned at the avatar's feet area
		this.flameEmitter = this.scene.add.particles(30, 0, 'white-pixel', {
			speed: { min: 100, max: 250 },
			angle: { min: 170, max: 190 }, // Shooting backwards (assuming racing to the right)
			scale: { start: 12, end: 0 },
			lifespan: 1200,
			gravityY: -100, // Flame-like rising
			frequency: 25,
			blendMode: 'ADD',
			tint: [ 0xff0000, 0xffa500, 0xffff00 ], // Red, Orange, Yellow
			alpha: { start: 0.8, end: 0 }
		});

		this.add(this.flameEmitter);
		this.sendToBack(this.flameEmitter);
	}

	public stopFlames(): void {
		if (this.flameEmitter) {
			this.flameEmitter.stop();
			const emitter = this.flameEmitter;
			this.scene.time.delayedCall(1000, () => {
				if (emitter) {
					emitter.destroy();
				}
			});
			this.flameEmitter = null;
		}
	}

	public startLeaderPulse(): void {
		if (this.leaderPulseTween) return;

		// Slow, "breathing" scale animation on the texture
		this.leaderPulseTween = gsap.to(this.playerTexture, {
			scale: 1.05,
			duration: 1.2,
			yoyo: true,
			repeat: -1,
			ease: 'sine.inOut'
		});

		// Add a golden glow if supported
		if (this.playerTexture.postFX && !this.leaderGlow) {
			this.leaderGlow = this.playerTexture.postFX.addGlow(0xffff00, 2, 0);
			this.scene.tweens.add({
				targets: this.leaderGlow,
				outerStrength: 4,
				duration: 1200,
				yoyo: true,
				repeat: -1,
				ease: 'sine.inOut'
			});
		}
	}

	public stopLeaderPulse(): void {
		if (this.leaderPulseTween) {
			this.leaderPulseTween.kill();
			this.leaderPulseTween = null;
			gsap.to(this.playerTexture, { scale: 1, duration: 0.3 });
		}

		if (this.leaderGlow) {
			if (this.playerTexture.postFX) {
				this.playerTexture.postFX.remove(this.leaderGlow);
			}
			this.leaderGlow = null;
		}
	}

	public playImpactFlash(): void {
		// Create a temporary white flash overlay
		const flash = this.scene.add.rectangle(0, 0, 480, 100, 0xffffff)
			.setOrigin(0, 0.5) // Adjust origin to match player panel logic roughly
			.setAlpha(0)
			.setBlendMode(Phaser.BlendModes.ADD);
		
		// Attempt to match the texture's specific origin if possible
		if (this.playerTexture) {
			flash.setOrigin(this.playerTexture.originX, this.playerTexture.originY);
		}

		this.add(flash);
		
		gsap.to(flash, {
			alpha: 0.6,
			duration: 0.05,
			yoyo: true,
			repeat: 1,
			onComplete: () => flash.destroy()
		});
	}

	public playOvertake(): void {
		// Jump up and down - Use GSAP and target child to avoid coordinate conflicts with Racetrack
		gsap.to(this, {
			scale: "1.3",
			duration: 0.2,
			yoyo: true,
			repeat: 1,
			ease: 'back.out'
		});

		// Move child texture instead of container to avoid fighting Racetrack's Y sorting
		gsap.fromTo(this.playerTexture, { y: 0 }, {
			y: -40,
			duration: 0.2,
			yoyo: true,
			repeat: 1,
			ease: 'power1.inOut'
		});
		
		// Add a tiny emote bubble
		const emote = this.scene.add.text(10, 0, '🏎️💨', { fontSize: this.scene.getY(80) })
			.setOrigin(0.5)
			.setAngle(180)
			.setScale(0.25);
		this.add(emote);
		gsap.to(emote, {
			x: '-20',
			alpha: 0,
			scale: 1.2,
			duration: 2,
			onComplete: () => emote.destroy()
		});
	}

	public playKnockback(): void {
		// Shake and move back slightly - target child for X offset
		// Use absolute targets or fromTo to prevent drift from rapid triggers
		gsap.fromTo(this.playerTexture, { x: 0 }, {
			x: -20,
			duration: 0.1,
			yoyo: true,
			repeat: 5,
			ease: 'sine.inOut'
		});

		// repeat: 3 means 4 total cycles (forward+back x 2), returning exactly to 1.0
		gsap.fromTo(this.playerTexture, { scale: 1 }, {
			scale: 0.85,
			duration: 0.1,
			yoyo: true,
			repeat: 3,
			ease: 'sine.inOut'
		});

	}

	/**
	 * Displays a text message that floats up from the player and fades away.
	 * Useful for showing points earned or other quick feedback.
	 */
	public flashText(message: string, color: string = '#ffffff'): void {
		// Position roughly above the avatar center
		const text = this.scene.add.text(60, this.scene.getY(-80), message, {})
			.setOrigin(0.5)
			.setFontFamily('"Titan One", Georgia')
			.setFontSize(60)
			.setColor(color)
			.setStroke('#000000', 8)
			.setShadow(2, 2, '#000000', 2, true, true);

		this.add(text);

		// Add sine-wave oscillation on X
		gsap.to(text, { x: '+=40', duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });

		gsap.to(text, {
			y: this.scene.getY(-360),
			alpha: 0,
			scale: 1.2,
			duration: 5,
			ease: 'power2.In',
			onComplete: () => {
				text.destroy();
			}
		});
	}

	public getPlayerState(): PhaserPlayerState {
		return this.playerState;
	}
	setPlayerState(newState: PhaserPlayerState): void {
		this.playerState = newState;
	}
}