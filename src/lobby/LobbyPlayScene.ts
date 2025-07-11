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

// I have a Player class which uses Phaser objects but DOMPlayer is slightly smoother with animations
// Note: it needs its own setScale function to ensure correct scaling...
import { PlayerConfig, DOMPlayer } from '../DOMPlayer';

export class LobbyPlayScene extends BaseScene {

	// Game name to scene key mapping
	private gameToSceneMap: Record<string, string> = {
		'quiz': 'QuizPlayScene',
		'werewolf': 'WerewolfPlayScene',
		// Add more games as needed
	};

	private players: Map<string, DOMPlayer> = new Map<string, DOMPlayer>();

	constructor() {
		super({ key: 'Lobby' });
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

		// Since this is the player version of the game we are likely on mobile so set orientation and fullscreen
		this.scale.lockOrientation('landscape');
		// Next line must be called from a pointer event
		// this.scale.startFullscreen();
	}

	preload(): void {

		console.log('Lobby.preload: hello.');

		this.load.image('playernamepanel', 'assets/rounded-rect-grey-480x48x14.png');
		this.load.image('avatar', 'assets/avatar-100/image-from-rawpixel-id-12138743-original.png');

		this.load.rexWebFont({
			google: {
				families: ['Titan One']
			}
		});

	}

	create(): void {

		console.log('LobbyPlay::create: hello.');

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

		// Last thing to do is to call the server to let them know we are ready
		this.socket.emit('player:ready', { socketID: this.socket.id });
	}

	setupSocketListeners(): void {
		console.log('Lobby.setupSocketListeners: hello.');

		// Listen for player connection events
		this.socket.on('playerconnect', (playerConfig: PlayerConfig) => {
			console.log('Socket:: playerconnect:', playerConfig);
			this.addDOMPlayer(playerConfig);
		});

		this.socket.on('playerdisconnect', (sessionID: string) => {
			console.log('Socket:: playerdisconnect:', sessionID);
			this.removePlayer(sessionID);
		});


		this.socket.on('server:players', (playerList: PlayerConfig[]) => {
			console.log('Socket:: server:players:', playerList);
			playerList.forEach((playerConfig: PlayerConfig) => {
				this.addDOMPlayer(playerConfig);
			});
		});

		this.socket.on('server:loadgame', (game: string) => {

			// Get the corresponding scene key
			const sceneKey = this.gameToSceneMap[game] || game;

			console.log('LobbyPlay:: Socket:server:loadgame:', game, sceneKey);

			if (this.scene.get(sceneKey)) {
				console.log('Already loaded - start immediately');
				this.scene.start(sceneKey);
			} else {
				console.log('Not loaded - ignore...');
			}
		});

		this.socket.on('server:ping', (message: string) => {
			console.log('LobbyPlayScene:: server:ping:', this.socket.connected, message);

			// This is an event with an acknowledgement callback
			this.socket.emit('host:ready', { sessionID: this.socket.id }, (response: string) => {
				// This callback will be executed when server acknowledges the event
				console.log('Server acknowledged host:ready:', response);
			});
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

	getPlayerBySessionID(sessionID: string): DOMPlayer {
		console.log('LobbyPlayScene:: getPlayerBySessionID:', sessionID);
		const player = this.players.get(sessionID);
		if (player) {
			return player;
		} else {
			throw Error('Player not found:' + sessionID);
		}
	}
	addDOMPlayer(playerConfig: PlayerConfig): void {
		console.log('Adding DOM player:', playerConfig);
		const player = this.players.get(playerConfig.sessionID);
		if (player) {
			console.log('Player already exists:', playerConfig.sessionID);
			return;
		}
		const newPlayer: DOMPlayer = new DOMPlayer(this, playerConfig);
		this.add.existing(newPlayer);
		this.players.set(playerConfig.sessionID, newPlayer);
		this.animatePlayer(newPlayer);
	}

	removePlayer(sessionID: string): void {
		console.log('Removing player:', sessionID, this.playerConfigs);
		const domPlayer: DOMPlayer = this.getPlayerBySessionID(sessionID);
		if (domPlayer) {
			domPlayer.destroy();
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
							const v:number|null = tween.getValue();
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
	sceneShutdown(): void {
		console.log('Lobby:: sceneShutdown...');
		// Remove any socket listeners or other cleanup tasks here
	}

}


