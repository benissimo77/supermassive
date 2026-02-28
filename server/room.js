// Models - note this should be placed into the werewolves file since it is game-specific
import { Player, Phases, Roles } from './models/allModels.js';
import { mongoose } from './db.js';
import { GhostManager } from './services/GhostManager.js';


class Room {

	// We keep a copy of the IO socker server and use this to emit all our events
	#io;

	constructor(io, id) {
		this.#io = io;
		this.id = id;
		this.host = undefined;
		this.hosts = [];
		this.admins = [];
		this.game = undefined;
		this.players = [];

		this.ghostManager = new GhostManager(this);

		// Generate QR code for room
		// Note: this is async but we don't need to await it here since we're leaving...
		this.generateQRCode(this.id);
	}

	// we say user because at this point we don't know if they are a player or a host/moderator/viewer etc...
	addUserToRoom(socket, userObj) {

		console.log('Room::addUserToRoom:', this.id, userObj.name, userObj.host, userObj.sessionID, this.game ? this.game.name : 'no game');

		// Instantly add this user's socket to this room
		socket.join(this.id);

		// host value in player object must evaluate to truth (eg = 1)
		if (userObj.host) {
			// perform host initialisation...
			console.log('User is host:', socket.id, userObj);
			this.host = userObj;
			this.hosts.push(userObj);

			// Workaround - in case we will end up in SOLO player mode intialise the host fields for a player
			this.host.name = 'HOST';
			this.host.avatar = '13100182';

			// I've removed this line from here and instead made the host responsible for contacting the server when its ready
			// this.#io.to(socket.id).emit('hostconnect', { room: this.id, players: this.getConnectedPlayers() });
			this.attachHostEvents(socket);
		} else if (userObj.role === 'admin') {
			// Admin role - can see host view and control game
			console.log('User is admin:', socket.id, userObj);
			this.admins.push(userObj);
			this.attachHostEvents(socket);
		} else {

			var player = this.addUserAsPlayer(socket, userObj);

			// Send message to host and admins
			this.emitToHosts('playerconnect', player);

			// TODO: some games might not allow players to join after the game has started - need to handle logic in this case...
			// In this case we allow player to join...
			if (this.game) {

				// This call works if player is connecting for the first time OR if re-connecting
				// Play client checks if the game is already running and does NOT restart it
				// Note: we now awit for an explicit 'player:ready' event from the player before sending the loadgame event
				// socket.emit('server:loadgame', this.game.name);

			} else {
				// this.#io.to(socket.id).emit('server:loadgame', 'lobby');
			}
		}

		// attach additional socket events used by both players and host
		socket.on('client:response', (response) => {
			console.log('client:response :', socket.id, response);
			if (this.clientResponseHandler) {
				this.clientResponseHandler(socket, response);
			}
		})

		socket.on('player:ready', (data, callback) => {
			console.log('player:ready from socket:', socket.id, data, callback);
			const player = this.getPlayerBySocketID(socket.id);
			if (callback && typeof callback === 'function') {
				callback(player);
			}
			// and send the player their player object for display on the play page
			// this.#io.to(socket.id).emit('playerconnect', player);

			// Notify game of player (re)connection - function should work for both new and reconnected players
			if (this.game) {
				console.log('Sending server:loadgame to player:', this.game.name);
				socket.emit('server:loadgame', this.game.name);
				this.game.onPlayerReconnect(player, socket);
			}
			// if we have no game then the player will remain in the lobby

		})

		// player:rating - sent by player at the end of a game/quiz
		socket.on('player:rating', (data) => {
			console.log('Room:: player:rating:', socket.id, data);
			const player = this.getPlayerBySocketID(socket.id);
			if (this.game && this.game.onPlayerRating) {
				this.game.onPlayerRating(player, data);
			}
		});

		// Just see if I can catch a socket connect/disconnect events
		socket.on('connect', (data) => {
			console.log('socket.connect:', data);
		})
		socket.on('disconnecting', (reason) => {
			console.log('socket.disconnecting:', socket.id, reason);
		})
		socket.on('disconnect', (reason) => {
			console.log('socket.disconnect:', socket.id, reason);
			this.removePlayer(socket.id);
		})
		socket.on('consolelog', (data) => {
			console.log('Message from:', socket.id);
			console.dir(data);
		})
		// console.log('userJoinRoom ending: ', this.players);
	}

	addUserAsPlayer(socket, userObj) {
		var player = this.getPlayerBySessionID(userObj.sessionID);
		if (player) {
			console.log('player already exists:', player);
			player.name = userObj.name || player.name;
			player.avatar = userObj.avatar || player.avatar;
			player.connected = true;
			// each re-connection will result in a new socketID
			player.socketID = socket.id;
		} else {
			player = new Player(userObj);
			player.connected = true;
			this.players.push(player);
			console.log('room.addUserAsPlayer:', player, '\nCurrent players:', this.players.length);
		}
		return player;
	}

	attachHostEvents(socket) {

		// host:ready
		// Sent by host when they have loaded the host page and are ready to start receiving messages
		socket.on('host:ready', (data, callback) => {

			console.log('Received host:ready from client:', socket.id, data);
			// Send acknowledgment back
			if (callback && typeof callback === 'function') {
				callback({ received: true, roomID: this.id });
			}
			socket.emit('server:players', this.getConnectedPlayers());
		});

		socket.on('host:requestgame', async (game, config, callback) => {
			console.log('host:requestgame:', game, config);

			// Support both (game, callback) and (game, config, callback)
			if (typeof config === 'function') {
				callback = config;
				config = {};
			}

			// We might already be in this game - do nothing if this is the case...
			// Update: If the game has ended, we can start a new one of the same type
			const isEnded = this.game && typeof this.game.isEnded === 'function' ? this.game.isEnded() : false;
			const isSame = this.game && typeof this.game.isSameGame === 'function' ? this.game.isSameGame(config) : true;

			if (this.game && this.game.name == game && !isEnded && isSame) {
				console.log('Already running this game - ignore:', this.game.name);

				// If the game has not actually started yet (is in the lobby phase), we should allow it to re-initialize
				// to pick up any changes made to the quiz data in the database.
				// if (this.game.started === false && this.game.init && typeof this.game.init === 'function') {
				// 	console.log('Game not started yet - re-initializing to pick up any data changes...');
				// 	const initData = await this.game.init(config) || {};
				// 	if (callback) callback({ success: true, ...initData });
				// 	return;
				// }

				if (callback) callback({ success: true, alreadyRunning: true });
			} else {

				try {
					const gameModule = await import(`./games/server.${game}.js`);
					// Use the default export if your game modules use default export
					const NewGame = gameModule.default;
					// If your game modules use named exports instead, use: const { GameClass } = gameModule;

					this.game = new NewGame(this);
					this.game.name = game;

					// If the game has an init method, call it with the config
					// We await this so that the game can perform async setup (like loading data)
					// before we acknowledge the host:requestgame event.
					let initData = {};
					if (this.game.init && typeof this.game.init === 'function') {
						initData = await this.game.init(config) || {};
					}

					this.emitToAllPlayers('server:loadgame', game);
					// Note: the next line is not needed since we pass data via the callback function below
					// BUT it could be useful in future when we navigate via the lobby, THEN the host needs to load the quiz game
					// this.emitToHosts('server:loadgame', { game, ...initData });

					if (callback) callback({ success: true, ...initData });

				} catch (error) {
					console.error(`Error loading game '${game}':`, error);
					if (callback) callback({ success: false, error: error.message });

					// Notify host about the error
					socket.emit('server:error', {
						message: `Could not load game '${game}'`,
						details: error.message
					});
				}
			}
		});

		// requeststart
		// Called by host once the introduction has been watched and host is ready to start the game
		// Function accepts an optional config object which can be used to pass additional data to the game
		socket.on('host:requeststart', (config) => {
			console.log('host:requeststart:', socket.id, this.getPlayerBySocketID(socket.id), config);
			if (this.game) {
				const valid = this.game.checkGameRequirements();
				console.log('Game is valid:', valid);

				if (valid) {

					// This might be the best place to check for a single-player mode
					// Maybe the game config will include a flag to indicate if this is allowed - for now assume it is
					// For now comment out since I want to get it working for Veluwe
					if (this.players.length == 0 && 0) {
						console.log('No players in game - SINGLE-PLAYER MODE:');
						var player = this.addUserAsPlayer(socket, this.host);

						// Send message to host (ie this player)
						this.emitToHosts('playerconnect', player);

					}

					this.game.startGame(config);
				}
			}
		})

		socket.on('host:requestend', () => {
			console.log('host:requestend:', socket.id, this.game, this.getPlayerBySocketID(socket.id));
			if (this.game) {
				this.game.endGame();
			}
			this.endGame();
		})

		socket.on('host:response', (response) => {
			console.log('host:response :', socket.id, response);
			if (this.hostResponseHandler) {
				this.hostResponseHandler(socket, response);
			}
		})
		// host:keypress - sent by host when they press a key on their keyboard
		// key is an object holding the key plus flags to indicate shift, ctrl, alt etc
		socket.on('host:keypress', (key) => {
			console.log('host:keypress:', key);
			if (this.hostKeypressHandler) {
				this.hostKeypressHandler(socket, key);
			}
		})

		socket.on('admin:kickplayer', (sessionID) => {
			console.log('Room:: host:kickplayer:', sessionID);
			const player = this.players.find(p => p.sessionID === sessionID);
			if (player) {
				console.log('Room:: Found player to kick:', player);
				const playerSocket = this.getSocket(player.socketID);
				if (playerSocket) {
					console.log(`Room:: Kicking player ${player.name} (${sessionID})`);
					playerSocket.disconnect(true);
				}
				// The disconnect event will trigger removePlayer, which notifies hosts
			} else {
				console.error('Room:: Cannot find player to kick with sessionID:', sessionID);
			}
		})

		socket.on('admin:spawn_ghost', () => {
			console.log('Room:: host:spawn_ghost');
			this.ghostManager.spawnGhost();
		});

		socket.on('admin:remove_ghosts', () => {
			console.log('Room:: host:remove_ghosts');
			this.ghostManager.removeAllGhosts();
		});

		// General purpose test event - can be used as a scratch to quickly check some functionality server-side
		socket.on('buttontest', (data) => {
			console.log('Host:: buttontest:', data);
			// this.#io.to(socket.id).emit('nightkill', [ this.players[0].socketID, this.players[1].socketID ] );
			this.emitToAllPlayers('server:loadgame', 'werewolves');
		})
		// Similar to above - can be used to simulate a socket event from the server
		// Simply echoes directly back to the host whatever event was passed
		socket.on('triggersocketevent', (data) => {
			console.log('triggersocketevent:', data.event, data.payload);
			this.emitToHosts(data.event, data.payload)
			this.emitToAllPlayers(data.event, data.payload);
		})
	}

	registerClientResponseHandler(handler) {
		console.log('registerClientResponseHandler:', handler);
		this.clientResponseHandler = handler;
	}
	deregisterClientResponseHandler() {
		console.log('deregisterClientResponseHandler:');
		this.clientResponseHandler = null;
	}
	registerHostResponseHandler(handler) {
		this.hostResponseHandler = handler;
	}
	deregisterHostResponseHandler() {
		this.hostResponseHandler = null;
	}
	registerHostKeypressHandler(handler) {
		this.hostKeypressHandler = handler;
	}
	deregisterHostKeypressHandler() {
		this.hostKeypressHandler = null;
	}

	/**
	 * Helper to get a socket by ID, checking both real and ghost sockets.
	 */
	getSocket(socketID) {
		// Try real sockets first
		let socket = this.#io.sockets.sockets.get(socketID);
		if (socket) return socket;

		// Try ghost sockets
		if (this.ghostManager) {
			const ghost = this.ghostManager.ghosts.find(g => g.socket.id === socketID);
			if (ghost) return ghost.socket;
		}

		return null;
	}

	endGame() {
		console.log('room.endGame: game has ended - clear up');
		this.game = null;
		this.emitToHosts('server:loadgame', 'lobby');
		this.emitToAllPlayers('server:loadgame', 'lobby');
	}

	// Fixed version using socket.emit
	emitToHosts(event, data, callback = null) {
		console.log('emitToHosts:', event, data);
		
		let callbackCalled = false;
		const wrappedCallback = (response) => {
			if (typeof callback === 'function' && !callbackCalled) {
				callbackCalled = true;
				callback(response);
			}
		};
		
		// Emit to all hosts
		this.hosts.forEach(host => {
			const hostSocket = this.getSocket(host.socketID);
			if (hostSocket) {
				hostSocket.emit(event, data, wrappedCallback);
			}
		});

		// Emit to admins (without callback to avoid double-processing)
		this.admins.forEach(admin => {
			const adminSocket = this.getSocket(admin.socketID);
			if (adminSocket) {
				adminSocket.emit(event, data);
			}
		});
	}

	// emitToPlayers
	// Send an event to the specified players, with the data payload
	emitToPlayers(players, event, data, callback = null) {
		console.log('emitToPlayers:', players, event, data);
		const wrappedCallback = (response) => {
			if (typeof callback === 'function') {
				callback(response);
			}
		};
		for (let i = 0; i < players.length; i++) {
			const playerSocket = this.getSocket(players[i]);
			if (playerSocket) {
				playerSocket.emit(event, data, wrappedCallback);
			} else {
				console.error(`Cannot emit to player - socket ${players[i]} not found`);
			}
		}
	}

	// emitToAllPlayers
	// Send an event to all players in the room, with the data payload (note: NOT sent to the host)
	emitToAllPlayers(event, data, callback = null) {
		const playerSockets = this.players
			.filter(player => player.connected)
			.map((player) => { return player.socketID });

		// In single-player mode the host WILL be in the players array but we DON'T want to send the event to them
		this.hosts.forEach(host => {
			if (playerSockets.includes(host.socketID)) {
				playerSockets.splice(playerSockets.indexOf(host.socketID), 1);
			}
		});

		console.log('emitToAllPlayers:', playerSockets, event, data);
		this.emitToPlayers(playerSockets, event, data, callback);
	}

	// getClientResponses
	// General-purpose function collect responses from a client or clients
	// socketlist an array of socketIDs
	// buttonlist an array of objects with id and label
	// strategy an object which defines the strategy for collecting responses
	// 1. Send a request to the client(s) to select a button from a list of buttons
	// 2. Collect responses from the client(s) and store them in an array
	// 3. When end condition is met, call the callback function with the responses
	// 4. strategy can also include a timer which allows a time limit to be defined, after which collection ends
	// NOTE: potential bug in this function if no timeout and client disconnects or can't respond (fn will never resolve)
	// Always need a way for host to be able to resolve any situation
	// Modified to work in a more straight-forward way - passes responses back to the game
	getClientResponses(socketlist, buttonlist, strategy) {

		console.log('Sending server:request to all clients in :', socketlist);
		this.#io.to(socketlist).emit('server:request', { type: 'buttonselect', payload: buttonlist });

	}


	// PLAYER FUNCTIONS
	// These are defined on the Room but used by all games - functions related to players
	// removePlayer
	// Remove a player from the room - only takes effect if game has not started
	// If game HAS started then we need to handle the player leaving in a different way - maybe just mark them as disconnected
	removePlayer(socketID) {
		const playerIndex = this.players.findIndex(p => p.socketID === socketID);
		const player = playerIndex !== -1 ? this.players[playerIndex] : null;
		
		console.log('removePlayer:', socketID, player ? player.name : 'unknown');

		// Clean up hosts and admins
		this.hosts = this.hosts.filter(h => h.socketID !== socketID);
		this.admins = this.admins.filter(a => a.socketID !== socketID);

		// Update primary host if it was the one that disconnected
		if (this.host && this.host.socketID === socketID) {
			this.host = this.hosts.length > 0 ? this.hosts[this.hosts.length - 1] : undefined;
		}

		if (this.game && this.game.started) {
			if (player) {
				player.connected = false;
			}
		} else {
			if (playerIndex !== -1) {
				this.players.splice(playerIndex, 1);
			}
		}

		// Clean up ghost manager if it was a ghost
		if (this.ghostManager) {
			this.ghostManager.removeGhost(socketID);
		}

		// Either way we want to inform the host - we will remove the player from the host display even though we retain the player object
		// Note that we pass the players sessionID not their socketID - sockets are used to send the messages, session used to identify users
		if (player) {
			console.log('Host:: sending playerdisconnect:', player);
			this.emitToHosts('playerdisconnect', player.sessionID);
		}
	}
	getPlayerBySocketID(socketID) {
		// console.log(this.players.find( (player) => player.socketID == socketID ));
		return this.players.find((player) => player.socketID === socketID)
	}
	getPlayerBySessionID(sessionID) {
		return this.players.find((player) => player.sessionID === sessionID)
	}
	getConnectedPlayers() {
		console.log('Connected players:', this.players.filter((player) => player.connected).length);
		return this.players.filter((player) => player.connected);
	}

	async generateQRCode(roomID) {
		// For now we simply generate a QR code using an external service and save it as a PNG file in the host/qr folder
		// In future we might want to generate these dynamically on request
		// Using goqr.me API - limit of 1000 requests per day for free usage
		const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://videoswipe.net/play?room=${roomID}`;
		const fs = await import('fs');
		const https = await import('https');
		const file = fs.createWriteStream(`./public/assets/qr/${roomID}.png`);
		https.get(qrURL, (response) => {
			response.pipe(file);
			file.on('finish', () => {
				file.close();
				console.log('QR code generated for room:', roomID);
			});
		});
	}
}

export { Room }