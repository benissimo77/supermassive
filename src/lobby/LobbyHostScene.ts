/*
Test out the dynamic loading of scene files to simulate the lobby / game experience
Hosting starts in the lobby (scene)
Lobby includes the socket.io layer
Lobby displays all the available games
Host can select a game
If valid game is loaded as a new scene and started
Scene is able to return back to the lobby, game is destroyed
*/
import { BaseScene } from 'src/BaseScene';
import { SoundManager } from 'src/audio/SoundManager';
import { ThemeManager } from 'src/ui/ThemeManager';

// I have a Player class which uses Phaser objects but DOMPlayer is slightly smoother with animations
// Note: it needs its own setScale function to ensure correct scaling...
// Not worth keeping both classes so going with PhaserPlayer for now
import { PlayerConfig, PhaserPlayer } from 'src/quiz/PhaserPlayer';

// Define a simple interface for menu items
// Ensures correct typing in createButtonCallback
interface MenuItem {
	name: string;
	scene: string;
}

export class LobbyHostScene extends BaseScene {

	static readonly KEY: string = 'LobbyHostScene';

	private players: Map<string, PhaserPlayer> = new Map<string, PhaserPlayer>();

	public soundManager: SoundManager;
	public themeManager: ThemeManager;
	public soundPanel: Phaser.GameObjects.Container;
	public games: { name: string; key: string; description: string }[] = [];
	private gameCards: Phaser.GameObjects.Container[] = [];
	private selectedGameIndex:number = 0;

	constructor() {
		super({ key: LobbyHostScene.KEY });
		this.soundManager = SoundManager.getInstance(this);
		this.themeManager = ThemeManager.getInstance();
	}

	// Note the order here - init comes first THEN preload THEN create...
	init(): void {

		console.log('Lobby.init: hello.');
		super.init();
		this.cameras.main.setRoundPixels(true);

		// Testing add a progress indiciator
		// this.load.on('progress', (progress: number) => {
		// 	console.log('Loader progress:', progress);
		// });
		// this.load.on('filecomplete', (key: string) => {
		// 	console.log('Loading file complete:', key);
		// });

		// this.load.on('complete', () => {
		// 	console.log('Loading complete');
		// });
		// this.load.on('addfile', (key: string, type: string, url: string, xhrSettings: Phaser.Types.Loader.XHRSettingsObject) => {
		// 	console.log('Loader file add:', key, type, url, xhrSettings);
		// });
		// this.load.on('load', (file: Phaser.Loader.File) => {
		// 	console.log('Loader load:', file);
		// });
		// this.load.on('loaderror', (file: Phaser.Loader.File) => {
		// 	console.log('Loader load error:', file);
		// });

		this.setupSocketListeners();

	}

	preload(): void {

		console.log('Lobby.preload: hello.');

		this.load.image('playernamepanel', '/assets/rounded-rect-grey-480x48x14.png');
		this.load.image('avatar', '/assets/avatar-100/image-from-rawpixel-id-12138743-original.png');

		// Testing dropzone
		this.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
		this.load.image('dropzone', '/assets/img/dropzone.png');

		this.load.rexWebFont({
			google: {
				families: ['Titan One']
			}
		});

	}

	create(): void {
		console.log('Lobby.create: hello.');
		super.create();

		// Define available games (add more as needed)
		this.games = [
			{ name: 'Quiz', key: 'quiz', description: 'Test your knowledge with fun questions!' },
			// { name: 'Drawing', key: 'drawing', description: 'Draw and guess with friends!' },
			// Add more games here
		];

		this.createGameGrid();

		// Keyboard navigation
		this.input.keyboard.on('keydown-LEFT', () => this.navigate(-1, 0));
		this.input.keyboard.on('keydown-RIGHT', () => this.navigate(1, 0));
		this.input.keyboard.on('keydown-UP', () => this.navigate(0, -1));
		this.input.keyboard.on('keydown-DOWN', () => this.navigate(0, 1));
		this.input.keyboard.on('keydown-ENTER', () => this.selectGame());

		// Instructions panel button
		this.createButton(1680, this.getY(50), 'Join Instructions', () => this.showInstructions());

		// Let server know host is ready (should trigger server to send room code)
		this.socket.emit('host:ready', { socketID: this.socket.id }, (response: any) => {
			console.log('host:ready ack received:', response)
			if (response.roomID) {
				this.roomID = response.roomID;
				this.load.image('roomQR', `/assets/qr/${this.roomID}.png`);
				this.load.once('complete', () => {
					console.log('Room QR code image loaded');
					this.showInstructions();
				});
				this.load.start();
			}
		});

	}

	// Add these methods to the class:
	private createGameGrid(): void {
		const cardWidth = 320;
		const cardHeight = 200;
		const cols = 3;
		const spacing = 40;
		const totalWidth = cols * cardWidth + (cols - 1) * spacing;
		const startX = 960 - totalWidth / 2;
		const startY = 320;
		this.gameCards = [];
		for (let i = 0; i < this.games.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const x = startX + col * (cardWidth + spacing);
			const y = startY + row * (cardHeight + spacing);
			const card = this.createGameCard(x, y, this.games[i], i);
			this.gameCards.push(card);
		}
		this.updateCardSelection();
	}

	private createGameCard(x: number, y: number, game: any, index: number): Phaser.GameObjects.Container {
		const card = this.add.container(x, y);
		const bg = this.add.rectangle(0, 0, 320, 200, 0x333344).setStrokeStyle(3, 0xffffff);
		card.add(bg);
		const title = this.add.text(0, -60, game.name, { fontSize: '28px', color: '#fff', fontFamily: 'Titan One' }).setOrigin(0.5);
		card.add(title);
		const desc = this.add.text(0, 20, game.description, { fontSize: '18px', color: '#ccc', align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5);
		card.add(desc);
		bg.setInteractive({ useHandCursor: true });
		bg.on('pointerdown', () => {
			this.selectedGameIndex = index;
			this.updateCardSelection();
			this.selectGame();
		});
		bg.on('pointerover', () => bg.setFillStyle(0x555577));
		bg.on('pointerout', () => this.updateCardSelection());
		return card;
	}

	private updateCardSelection(): void {
		this.gameCards.forEach((card, idx) => {
			const bg = card.getAt(0) as Phaser.GameObjects.Rectangle;
			bg.setFillStyle(idx === this.selectedGameIndex ? 0x7b5e9c : 0x333344);
		});
	}

	private navigate(dx: number, dy: number): void {
		const cols = 3;
		const rows = Math.ceil(this.games.length / cols);
		let col = this.selectedGameIndex % cols;
		let row = Math.floor(this.selectedGameIndex / cols);
		col += dx;
		row += dy;
		if (col < 0) col = cols - 1;
		if (col >= cols) col = 0;
		if (row < 0) row = rows - 1;
		if (row >= rows) row = 0;
		const newIndex = row * cols + col;
		if (newIndex < this.games.length) {
			this.selectedGameIndex = newIndex;
			this.updateCardSelection();
		}
	}

	private selectGame(): void {
		const game = this.games[this.selectedGameIndex];
		this.socket.emit('host:requestgame', game.key, {}, (response: any) => {
			console.log('LobbyHostScene:: selectGame ack:', response);
		});
	}

	private showInstructions(): void {
		const panel = this.add.container(960, this.getY(1080) - 480);
		const bg = this.add.rectangle(0, 0, 1600, 400, 0x000000, 0.4).setOrigin(0.5, 0);
		panel.add(bg);
		const title = this.add.text(0, 60, 'How to Join', { fontSize: '64px', color: '#fff', fontFamily: 'Titan One' }).setOrigin(0.5);
		panel.add(title);
		
		// Two-column layout
		// - left column for manual steps: 1. Go to VIDEOSWIPE.NET 2. Tap 'Start Playing Now' card 3. Enter room code: ROOMID
		// - right column display message 'Or scan QR code' and show QR code image below
		// Enter your name and select an avatar to join the game
		const instr = this.add.text(-700, 120, "VIDEOSWIPE.NET\nTap 'Start Playing Now'\nRoom code: " + this.roomID, { fontFamily: 'Titan One', fontSize: '48px', color: '#ccc', align: 'left', wordWrap: { width: 800 }, lineSpacing: 30 }).setOrigin(0);
		panel.add(instr);

		const orText = this.add.text(0, 190, 'OR', { fontFamily: 'Titan One', fontSize: '48px', color: '#77e', align: 'center' }).setOrigin(0.5);
		panel.add(orText);

		const qrImage = this.add.image(500, 240, 'roomQR').setDisplaySize(240, 240).setOrigin(0.5);
		panel.add(qrImage);

		const closeBtn = this.add.text(760, 20, 'X', { fontSize: '32px', color: '#fff' }).setInteractive({ useHandCursor: true });
		closeBtn.on('pointerdown', () => panel.destroy());
		panel.add(closeBtn);
		bg.setInteractive();
	}

	// Function to test out various RexUI components
	// Not used any more but useful to see what's possible
	testRexUI(): void {

		console.log('Lobby.testRexUI: hello.');

		// Output the list of scenes...
		const loadedScenes = this.scene.manager.scenes;
		console.log('loaded scenes:', loadedScenes, 'scenemanager keys:', this.scene.manager.keys);


		// Testing of correct canvas scaling / positioning
		this.add.rectangle(0, 0, 200, 100, 0xff0000).setOrigin(0, 0);
		this.add.rectangle(1920, 0, 200, 100, 0xff0000).setOrigin(1, 0);
		this.add.rectangle(0, this.getY(1080), 200, 100, 0x00ff00).setOrigin(0, 1);
		this.add.rectangle(1920, this.getY(1080), 200, 100, 0x00ff00).setOrigin(1);

		// Add a simple button object using a Phaser text
		this.createButton(960, this.getY(50), 'Arrange', () => { console.log('Arrange button clicked'); this.arrangePlayers(); });
		this.createButton(1680, this.getY(50), 'Release', () => { this.startRandomMovement(); });

		// This is more of a fully-featured button showing a lot of the options available
		const button = this.add.rectangle(960, this.getY(540), 200, 100, 0x0000ff); // center
		button.setInteractive({ useHandCursor: true })
			.on('pointerdown', (e: Phaser.Input.Pointer) => {
				console.log('Click - load quiz:', e);
				this.socket.emit('host:requestgame', 'quiz');
			})
			.on('pointerover', () => button.setFillStyle(0x00ffff))
			.on('pointerout', () => button.setFillStyle(0x0000ff));
		button.setOrigin(1);
		button.setStrokeStyle(2, 0xffffff);
		button.setAlpha(0.7);
		button.setScale(1.5, 1.5);
		button.setVisible(true);
		button.setAngle(0); // Set rotation angle
		button.w = 540; // override the w property (unused by Phaser) to store the logical y position

		const dropzone: Phaser.GameObjects.NineSlice = this.add.nineslice(960, 600, 'dropzone',
			undefined,                // Frame
			640, 300,       // Width, height
			12, 12, 12, 12       // Corner slice sizes
		);
		dropzone.setScale(800 / dropzone.width, this.getY(80) / dropzone.height);
		dropzone.setOrigin(0.5);
		dropzone.setTint(0xFF0000);

		this.rexUI.add.menu({
			x: 960,
			y: this.getY(700),
			orientation: 'y',
			background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 20, 0x333333),
			items: [
				{ name: 'New Game', scene: 'LobbyHostScene' },
				{ name: 'Continue', scene: 'QuizHostScene' },
				{ name: 'Settings', scene: 'SettingsScene' },
				{ name: 'Help', scene: 'HelpScene' }
			],
			createButtonCallback: (item: MenuItem, i: number) => {
				return this.rexUI.add.label({
					background: this.rexUI.add.roundRectangle(0, 0, 20, 40, 10, 0x7b5e9c),
					text: this.add.text(0, 0, item.name, { fontSize: '20px' }),
					space: { left: 10, right: 10, top: 10, bottom: 10 }
				});
			},
			easeIn: {
				duration: 500,
				orientation: 'y'
			}
		})
			.layout()
			.on('button.click', (button: any, index: number, pointer: Phaser.Input.Pointer, event: PointerEvent) => {
				const item = button.getData('item');
				this.scene.start(item.scene);
			});

		// Create an animated score counter
		const scoreBar = this.rexUI.add.numberBar({
			x: 100,
			y: this.getY(700),
			width: 200,
			background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x333333),
			icon: this.add.image(0, 0, 'star'),
			slider: {
				track: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x7b5e9c),
				indicator: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x5e9c7b),
				input: 'none',
			},
			text: this.add.text(0, 0, '0', { fontSize: '24px' }),
			space: { left: 10, right: 10, top: 10, bottom: 10, icon: 10 },
			value: 0
		})
			.layout();

		// Animate score change
		this.tweens.add({
			targets: scoreBar,
			value: 100,
			duration: 1000,
			ease: 'Cubic.easeOut',
			onUpdate: () => {
				console.log('Tweening scoreBar:', scoreBar.value);
				scoreBar.layout();
			}
		});

		// No need to call layout() on circularProgress it seems to figure that out
		const timer = this.rexUI.add.circularProgress({
			x: 400,
			y: this.getY(700),
			radius: 50,
			trackColor: 0x333333,
			barColor: 0x7b5e9c,
			centerColor: 0x000000,
			thickness: 20,
			value: 1
		})

		// Create countdown effect
		this.tweens.add({
			targets: timer,
			value: 0,
			duration: 10000, // 10 seconds
			onUpdate: () => {
				timer.layout();
			},
			onComplete: () => {
				// Time's up logic
			}
		});

		// Experiments with buttons/text - good for quiz
		const questionText = "By using a base scene that interacts with the SocketPlugin, you can effectively manage shared functionality across multiple scenes without directly handling the socket instance in each scene. This keeps your code organized and leverages the power of Phaser's plugin system. If you have any further questions or need additional assistance, feel free to ask!";
		// this.startButton = this.add.text(960, 0, questionText)
		//     .setFontFamily('Arial')
		//     .setOrigin(0.5, 0)
		//     .setPadding(10)
		//     .setFontSize(64)
		//     .setStroke('#0000FF', 6)
		//     .setAlign('center')
		//     .setStyle({ backgroundColor: '#AA0', border: '8px white solid' })
		//     .setInteractive({ useHandCursor: true })
		//     .setWordWrapWidth(1720)
		//     .on('pointerdown', () => { console.log('Button click'); })
		//     .on('pointerover', () => this.startButton.setStyle({ fill: '#f39c12' }))
		//     .on('pointerout', () => this.startButton.setStyle({ fill: '#FFF' }));

		// console.log('startButton:', this.startButton.height, this.startButton.text);

		// this.startButton.setFixedSize(1800, this.startButton.height);

		// this.tweens.addCounter({
		//     from: 0,
		//     to: questionText.length + 1,
		//     duration: questionText.length * 50,
		//     onUpdate: (tween: Phaser.Tweens.Tween) => {
		//         const v = tween.getValue();
		//         if (questionText.substring(v, v + 1) === ' ' || v > questionText.length) {
		//             this.startButton.setText(questionText.substring(0, v));
		//         }
		//     }
		// });

		// Experiment with 9-slice for adding a border around some text (eg question cards)
		// const nineSlice = this.make.nineslice({
		//     x: 960,
		//     y: this.getY(1080),
		//     key: 'borderbox',
		//     width: 1920,
		//     height: 80,
		//     leftWidth: 12,
		//     rightWidth: 12,
		//     topHeight: 12,
		//     bottomHeight: 12,
		//     origin: { x: 0.5, y: 1 },
		//     add: true
		// });

		// Experiment with render textures
		// const avatar: Phaser.GameObjects.Image = this.add.image(960, this.getY(540), 'avatar').setOrigin(0, 0.5);
		// const renderTexture: Phaser.GameObjects.RenderTexture = this.add.renderTexture(960, this.getY(540), avatar.width, avatar.height).setOrigin(1);
		// renderTexture.setTint(0x00ff00).fill(0x000080);
		// renderTexture.draw(avatar, avatar.width / 2, avatar.height / 2);

		this.testSizer();
	}

	private testSizer(): void {
		// Create a sizer with defined width
		const testSizer = this.rexUI.add.sizer({
			x: 960,
			y: 200,
			width: 600,
			height: 200,
			orientation: 'vertical',
			space: { item: 10 }
		});

		// Set background to see the sizer boundaries
		testSizer.addBackground(
			this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x333333)
		);

		// Add label aligned left
		const leftLabel = this.rexUI.add.label({
			background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0xff0000),
			text: this.add.text(0, 0, 'Left Aligned and more', { fontSize: '24px', align: 'right' }),
			space: { left: 10, right: 10, top: 5, bottom: 5 }
		});
		testSizer.add(leftLabel, { align: 'left' });

		// Add label aligned center
		const centerLabel = this.rexUI.add.label({
			background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x00ff00),
			text: this.add.text(0, 0, 'Center Aligned', { fontSize: '24px' }),
			space: { left: 10, right: 10, top: 5, bottom: 5 }
		});
		testSizer.add(centerLabel, { align: 'center' });

		// Add label aligned right
		const rightLabel = this.rexUI.add.label({
			background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x0000ff),
			text: this.add.text(0, 0, 'Right Aligned', { fontSize: '24px' }),
			space: { left: 10, right: 10, top: 5, bottom: 5 }
		});
		testSizer.add(rightLabel, { align: 'right' });

		testSizer.layout();

	}


	private createToggle(text: string, initialValue: boolean, onChange: (value: boolean) => void): any {
		// Create a horizontal sizer for the toggle and its label
		const toggleContainer = this.rexUI.add.sizer({
			orientation: 'horizontal',
			space: { item: 10 }
		});

		// Add the label
		toggleContainer.add(
			this.add.text(0, 0, text)
		);

		// Track width and height
		const trackWidth = 60;
		const trackHeight = 30;

		// Create the track
		const track = this.rexUI.add.roundRectangle(
			0, 0, trackWidth, trackHeight, trackHeight / 2,
			0x4e4e4e
		);

		// Create the thumb that slides
		const thumb = this.add.circle(
			initialValue ? trackWidth / 4 : -trackWidth / 4, 0,
			trackHeight / 2 - 4,
			initialValue ? 0x00ff00 : 0xff0000
		);

		// Create container for track and thumb
		const toggleSwitch = this.add.container(0, 0, [track, thumb]);
		toggleSwitch.setSize(trackWidth, trackHeight);

		// Store current value
		let value = initialValue;

		// Make toggle interactive
		track.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => {
				// Toggle the value
				value = !value;

				// Animate the thumb
				this.tweens.add({
					targets: thumb,
					x: value ? trackWidth / 4 : -trackWidth / 4,
					duration: 150,
					ease: 'Power2'
				});

				// Change thumb color
				thumb.setFillStyle(value ? 0x00ff00 : 0xff0000);

				// Call the callback
				onChange(value);
			});

		// Add the toggle switch to the container
		toggleContainer.add(toggleSwitch);

		// Layout and return
		return toggleContainer.layout();
	}


	setupSocketListeners(): void {
		console.log('Lobby.setupSocketListeners: hello.');

		// Listen for player connection events
		this.socket.on('playerconnect', (playerConfig: PlayerConfig) => {
			console.log('Socket:: playerconnect:', playerConfig);
			this.addPhaserPlayer(playerConfig);
		});

		this.socket.on('playerdisconnect', (sessionID: string) => {
			console.log('Socket:: playerdisconnect:', sessionID);
			this.removePlayer(sessionID);
		});


		this.socket.on('server:players', (playerList: PlayerConfig[]) => {
			console.log('Socket:: server:players:', playerList);
			playerList.forEach((playerConfig: PlayerConfig) => {
				this.addPhaserPlayer(playerConfig);
			});
		});

		this.socket.on('server:ping', (message: string) => {
			console.log('LobbyHostScene:: server:ping:', this.socket.connected, message);
		});
	}

	createButton(x: number, y: number, text: string, clickHandler: () => void): Phaser.GameObjects.Text {
		const button = this.add.text(x, y, text)
			.setFontFamily('Arial')
			.setOrigin(0.5, 0.5)
			.setPadding(10)
			.setFontSize(24)
			.setBackgroundColor('#AA0')
			.setInteractive({ useHandCursor: true });

		button.on('pointerdown', clickHandler);
		button.on('pointerover', () => button.setBackgroundColor('#f39c12'));
		button.on('pointerout', () => button.setBackgroundColor('#AA0'));

		return button;
	}

	getPlayerBySessionID(sessionID: string): PhaserPlayer {
		console.log('LobbyHostScene:: getPlayerBySessionID:', sessionID);
		const player = this.players.get(sessionID);
		if (player) {
			return player;
		} else {
			throw Error('Player not found:' + sessionID);
		}
	}

	addPhaserPlayer(playerConfig: PlayerConfig): void {
		console.log('Adding PhaserPlayer:', playerConfig);
		const player = this.players.get(playerConfig.sessionID);
		if (player) {
			console.log('Player already exists:', playerConfig.sessionID);
			return;
		}
		const newPlayer: PhaserPlayer = new PhaserPlayer(this, playerConfig);
		this.add.existing(newPlayer);
		this.backgroundContainer.add(newPlayer);
		this.players.set(playerConfig.sessionID, newPlayer);
		this.animatePlayer(newPlayer);
	}

	removePlayer(sessionID: string): void {
		console.log('Removing player:', sessionID, this.playerConfigs);
		const phaserPlayer: PhaserPlayer = this.getPlayerBySessionID(sessionID);
		if (phaserPlayer) {
			phaserPlayer.destroy();
		}
	}

	animatePlayer(player: Phaser.GameObjects.GameObject): void {
		this.tweens.add({
			targets: player,
			x: Phaser.Math.Between(0, 1920),
			y: Phaser.Math.Between(0, this.getY(1080)),
			duration: Phaser.Math.Between(2000, 4000),
			ease: 'Cubic.easeInOut',
			onComplete: () => {
				this.animatePlayer(player);
			}
		});
	}

	arrangePlayers(): void {
		console.log('Arranging players...');
		const playerArray = Array.from(this.players.values());
		const playerCount = playerArray.length;
		const spacing = 480 / (playerCount + 1);

		// Create new tweens to arranged positions
		playerArray.forEach((player, index) => {
			this.tweens.killTweensOf(player);
			const container = player as Phaser.GameObjects.Container;
			this.tweens.add({
				targets: container,
				x: 240,  // Position them 240px from left edge
				y: this.getY(0 + index * spacing),  // Spaced vertically
				duration: 1000,  // 1 second animation
				ease: 'Power2',  // Smoother ease
				onComplete: () => {
					// Optional: add a scale effect to test scaling
					this.tweens.addCounter({
						from: 1,
						to: 2,
						duration: 5000,
						ease: 'Cubic.easeInOut',
						onUpdate: (tween: Phaser.Tweens.Tween) => {
							const v: number | null = tween.getValue();
							container.setScale(v ?? 1);
						},

					});
				}
			});
		});

	}

	startRandomMovement(): void {
		console.log('Starting random movement...');
		const playerArray = Array.from(this.players.values());

		// Start random movement for each player
		playerArray.forEach(player => {
			this.tweens.killTweensOf(player);
			this.animatePlayer(player);
		});
	}


	logDisplaySizes(): void {
		// console.log("Window size:", window.innerWidth, window.innerHeight);
		// console.log("Canvas DOM size:", game.canvas.clientWidth, game.canvas.clientHeight);
		console.log('Canvas size:', this.scale.canvas.width, this.scale.canvas.height);
		console.log("Phaser scale size:", this.scale.width, this.scale.height);
		console.log("Camera display size:", this.cameras.main.displayWidth, this.cameras.main.displayHeight);
		console.log("Camera scroll:", this.cameras.main.scrollX, this.cameras.main.scrollY);
		console.log("Camera world view:", this.cameras.main.worldView);
		console.log("Camera zoom:", this.cameras.main.zoom);
	}

	sceneDisplay(): void {
		// Called from BaseScene when the screen is resized
		console.log('LobbyHostScene:: sceneDisplay: updating layout for new size');
	}

	sceneShutdown(): void {
		console.log('Lobby:: sceneShutdown...');
		// Remove any socket listeners or other cleanup tasks here
		// Note I haven't done this but LobbyHost does NOT continue to receive socket events...
	}

}


