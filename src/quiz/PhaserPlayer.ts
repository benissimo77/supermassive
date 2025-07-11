import { BaseScene } from "src/BaseScene";

export class PlayerConfig {
	name: string;
	avatar: string;
	socketID: string;
	sessionID: string;
}

export class PhaserPlayer extends Phaser.GameObjects.Container {
	private socketID: string;
	private sessionID: string;
	private playerTexture: Phaser.GameObjects.RenderTexture;
	private playerScore: number;
	private playerScoreText: Phaser.GameObjects.Text;

	constructor(scene: BaseScene, playerConfig: PlayerConfig) {
		super(scene, 0, 0);

		console.log('PhaserPlayer constructor:', playerConfig.name);

		// Store IDs for later use
		this.socketID = playerConfig.socketID;
		this.sessionID = playerConfig.sessionID;

		// Load avatar and complete the setup
		scene.load.once('complete', () => {
			console.log('*** Avatar file loaded...');

			// Create a fresh temporary container each time
			const tempContainer = scene.add.container(0, 0);
			this.add(tempContainer);

			// Add panel and name to the container
			const panel = scene.add.image(0, 0, 'playernamepanel').setOrigin(0, 0.5);
			const playerName = scene.add.text(120, 0, playerConfig.name.slice(0, 12), {})
				.setOrigin(0, 0.5)
				.setFontFamily('"Titan One", Georgia')
				.setFontSize(40)
				.setColor('#00008b');

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

			// Add shadow first, then the actual avatar
			tempContainer.add([panel, playerName, avatarShadow, avatarImage]);

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

			// While we are here add a text obejct for the score
			this.playerScoreText = scene.add.text(480, -24, '', {})
				.setOrigin(1, 1)
				.setFontFamily('"Titan One", Georgia')
				.setFontSize(40)
				.setColor('#ffffff');
			this.add(this.playerScoreText);


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

	destroy(fromScene?: boolean) {
		if (this.playerTexture) {
			this.playerTexture.destroy();
		}
		super.destroy(fromScene);
	}

	getSocketID(): string {
		return this.socketID;
	}
}