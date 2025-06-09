// Models - note this should be placed into the werewolves file since it is game-specific
import { Player, Phases, Roles } from './models/allModels.js';
import { mongoose } from './db.js';


class Room {

	// We keep a copy of the IO socker server and use this to emit all our events
	#io;

	constructor(io, id) {
		this.#io = io;
		this.id = id;
		this.host = undefined;
		this.game = undefined;
		this.gamename = undefined;
		this.players = [];

	}

	// we say user because at this point we don't know if they are a player or a host/moderator/viewer etc...
	addUserToRoom(socket, userObj) {

		console.log('Room::addUserToRoom:', this.id, userObj.name, userObj.host, userObj.sessionID);

		// Instantly add this user's socket to this room
		socket.join(this.id);

		// host value in player object must evaluate to truth (eg = 1)
		if (userObj.host) {
			// perform host initialisation...
			console.log('User is host:', socket.id, userObj.room, userObj.sessionID);
			this.host = userObj;

			// I've removed this line from here and instead made the host responsible for contacting the server when its ready
			// this.#io.to(socket.id).emit('hostconnect', { room: this.id, players: this.getConnectedPlayers() });
			this.attachHostEvents(socket);
		} else {

			var player = this.getPlayerBySessionID(userObj.sessionID);
			if (player) {
				console.log('player already exists:', player);
				player.connected = true;
				// each re-connection will result in a new socketID
				player.socketID = socket.id;
			} else {
				player = new Player(userObj);
				player.connected = true;
				this.players.push(player);
				console.log('New player...', player, '\nCurrent players:', this.players.length);
			}

			// Send message to host (if there is one)
			if (this.host) {
				this.#io.to(this.host.socketID).emit('playerconnect', player);
			}
			// and send the player their player object for display on the play page
			// NOTE: might move this to only respond after an explicit client:ready event (similar to host)
			this.#io.to(socket.id).emit('player', player);

			// TODO: some games might not allow players to join after the game has started - need to handle logic in this case...
			// In this case we allow player to join...
			if (this.game) {
				this.#io.to(socket.id).emit('server:loadgame', this.game.name);
			} else {
				this.#io.to(socket.id).emit('server:loadgame', 'lobby');
			}
		}

		// attach additional socket events used by both players and host
		socket.on('client:response', (response) => {
			console.log('client:response :', socket.id, response);
			if (this.clientResponseHandler) {
				this.clientResponseHandler(socket, response);
			}
		})

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

	attachHostEvents(socket) {

		socket.on('host:ready', (data, callback) => {

			console.log('Received host:ready from client:', socket.id, data);
			// Send acknowledgment back
			if (callback && typeof callback === 'function') {
				callback({ received: true });
			}
			socket.emit('server:players', this.getConnectedPlayers());
		});

		socket.on('host:requestgame', async (game) => {
			console.log('host:requestgame:', game);

			// We might already be in this game - do nothing if this is the case
			if (this.gamename && this.gamename == game) {
				console.log('Already running this game - ignore');
				// return;
			}

			try {
				const gameModule = await import(`./games/server.${game}.js`);
				// Use the default export if your game modules use default export
				const NewGame = gameModule.default;
				// If your game modules use named exports instead, use: const { GameClass } = gameModule;

				this.game = new NewGame(this);
				this.gamename = game;

				// there might need to be some more checks here to make sure the game is valid...
				const valid = this.game.checkGameRequirements();
				console.log('Game is valid:', valid);
				if (valid || true) {
					this.emitToAllPlayers('server:loadgame', game);
					console.log('emitted to all players - now emitting to host');
					this.emitToHosts('server:loadgame', game);
				}
			} catch (error) {
				console.error(`Error loading game '${game}':`, error);
				// Notify host about the error
				socket.emit('server:error', {
					message: `Could not load game '${game}'`,
					details: error.message
				});
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

		// All the remaining event seem very game-specific - maybe they should be moved to the game object
		socket.on('host:requestnight', () => {
			console.log('host:requestnight:', this.game);
			this.game.nightActionAsync();
		})
		socket.on('host:requestday', () => {
			console.log('host:requestday', this.game);
			this.game.dayAction();
		})
		socket.on('requestgamestate', () => {
			console.log('requestgamestate:', socket.id, this.getPlayerBySocketID(socket.id));
			this.#io.to(socket.id).emit('gamestate', this.players);
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

		// General purpose test event - can be used as a scratch to quickly check some functionality server-side
		socket.on('buttontest', (data) => {
			console.log('Host:: buttontest:', data);
			// this.#io.to(socket.id).emit('nightkill', [ this.players[0].socketID, this.players[1].socketID ] );
			this.emitToAllPlayers('server:loadgame', 'werewolves');
		})
		// Similar to above - can be used to simulate a socket event from the server
		// Simply echoes directly back to the host whatever event was passed
		socket.on('triggersocketevent', (data) => {
			console.log('triggersocketevent:', data.eventname, data.payload);
			this.emitToHosts(data.eventname, data.payload, true)
			this.emitToAllPlayers(data.eventname, data.payload);
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

	endGame() {
		console.log('room.endGame: game has ended - clear up');
		this.game = null;
		this.emitToHosts('server:loadgame', 'lobby');
		this.emitToAllPlayers('server:loadgame', 'lobby');
	}

	emitToHosts(event, data, waitForResponse = false) {
		console.log('emitToHosts:', event, data);
		this.#io.to(this.host.socketID).emit(event, data);
	}

	// emitToPlayers
	// Send an event to the specified players, with the data payload
	emitToPlayers(players, event, data) {
		this.#io.to(players).emit(event, data);
	}

	// emitToAllPlayers
	// Send an event to all players in the room, with the data payload (note: NOT sent to the host)
	emitToAllPlayers(event, data) {
		const playerSockets = this.players.map((player) => { return player.socketID });
		console.log('emitToAllPlayers:', playerSockets, event, data);
		if (playerSockets.length > 0) {
			this.#io.to(playerSockets).emit(event, data);
		}
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
		const player = this.getPlayerBySocketID(socketID);
		console.log('removePlayer:', socketID, player);
		if (this.started) {
			if (player) {
				player.connected = false;
			}
		} else {
			this.players = this.players.filter((player) => player.socketID != socketID);
		}
		// Either way we want to inform the host - we will remove the player from the host display even though we retain the player object
		// Note that we pass the players sessionID not their socketID - sockets are used to send the messages, session used to identify users
		if (this.host && player) {
			console.log('Remove player:', this.host.socketID, player);
			this.#io.to(this.host.socketID).emit('playerdisconnect', player.sessionID);
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

}

export { Room }