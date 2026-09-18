// Models - note this should be placed into the werewolves file since it is game-specific
import { Player, Phases, Roles } from './models/allModels.js';
import { mongoose } from './db.js';
import GameSession from './models/mongo.gameSession.js';
import PlayerResult from './models/mongo.playerResult.js';
import { GhostManager } from './services/GhostManager.js';
import { createRateLimiter } from './utils/rateLimiter.js';

// A room with no one connected for this long is considered abandoned and torn down (see Room.checkIdle)
const ROOM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Pragmatic spam guard for the 'consolelog' debug event - shared across all rooms, keyed by socket ID
const consoleLogLimiter = createRateLimiter(20, 10_000); // 20 messages / 10s per socket

class Room {

	// We keep a copy of the IO socker server and use this to emit all our events
	#io;

	constructor(io, id, onDestroyCallback) {
		this.#io = io;
		this.id = id;
		this.onDestroy = onDestroyCallback;
		this.host = undefined;
		this.hosts = [];
		this.admins = [];
		this.game = undefined;
		this.players = [];

		// Set the moment the room becomes empty (no hosts/admins/connected players); cleared the moment anyone joins.
		// Checked on every ping tick (see below) so an idle room can tear itself down without a separate timer.
		this.emptyAt = null;

		this.ghostManager = new GhostManager(this);

		// Generate QR code for room
		// Note: this is async but we don't need to await it here since we're leaving...
		// IMPORTANT: This is commented out when travelling as not always available...
		// TODO: UNCOMMENT THIS LINE WHEN GOING TO PRODUCTION!!!
		if (process.env.NODE_ENV === 'production') {
			this.generateQRCode(this.id);
		}

		// Initialize telemetry for the room
		this.telemetry = {
			clients: {}
		}

		/* Sample telemetry structure for a client
		"sessionID": {
			latency: [
				{ timestamp: new Date(), latency: 34 },
				{ timestamp: new Date(), latency: 45 },
			],
			disconnects: [
				{ timestamp: new Date(), reason: 'unknown' },
				{ timestamp: new Date(), reason: 'network_error' }
			],
			transport: 'websocket',
			sockets: [socket.id],
		}
		*/


		// Initialize interval timer for ping/pong latency measurement.
		// Also doubles as the room's own idle check (see checkIdle) so an abandoned room can
		// tear itself down without a separate server-wide scanner.
		this.pingInterval = setInterval(() => {
			this.pingAllClients();
			this.checkIdle();
		}, 30000);

	}

	clearPingInterval() {
		clearInterval(this.pingInterval);
	}

	// we say user because at this point we don't know if they are a player or a host/moderator/viewer etc...
	addUserToRoom(socket, userObj) {

		console.log('Room::addUserToRoom:', this.id, userObj.name, userObj.host, userObj.sessionID, this.game ? this.game.name : 'no game');

		// Someone is here - cancel any idle countdown (see checkIdle)
		this.emptyAt = null;

		// Instantly add this user's socket to this room
		socket.join(this.id);

		// And instantiate a client object for storing telemetry data
		if (this.telemetry.clients[userObj.sessionID]) {
			// already added - add socket.id to the sockets set
			this.telemetry.clients[userObj.sessionID].sockets.push(socket.id);
		} else {
			this.telemetry.clients[userObj.sessionID] = {
				transport: socket.conn.transport.name,
				sockets: [socket.id],
				latency: [],
				disconnects: []
			};
		}

		// host value in player object must evaluate to truth (eg = 1)
		if (userObj.host) {
			// perform host initialisation...
			console.log('User is host:', socket.id, userObj);
			this.host = userObj;

			// Workaround - in case we will end up in SOLO player mode intialise the host fields for a player
			this.host.name = 'HOST';
			this.host.avatar = '13100182';

			// Replace any existing connection for this session (eg a reconnect or second tab/device) instead of
			// duplicating it - unlike players, nothing accumulates on this object across a host's connections,
			// so it's safe (and keeps this.hosts in sync with this.host above) to just swap it in outright.
			const existingHostIndex = this.hosts.findIndex(h => h.sessionID === userObj.sessionID);
			if (existingHostIndex !== -1) {
				this.hosts[existingHostIndex] = userObj;
			} else {
				this.hosts.push(userObj);
			}

			// I've removed this line from here and instead made the host responsible for contacting the server when its ready
			// this.#io.to(socket.id).emit('hostconnect', { room: this.id, players: this.getConnectedPlayers() });
			this.attachHostEvents(socket);
		} else if (userObj.role === 'admin') {
			// Admin role - can see host view and control game
			console.log('User is admin:', socket.id, userObj);

			// Same reasoning as hosts above - replace rather than duplicate a reconnecting session
			const existingAdminIndex = this.admins.findIndex(a => a.sessionID === userObj.sessionID);
			if (existingAdminIndex !== -1) {
				this.admins[existingAdminIndex] = userObj;
			} else {
				this.admins.push(userObj);
			}

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

		// Attach common socket events for both players and hosts
		//
		//
		socket.conn.on('upgrade', () => {
			const sessionID = this.getSessionIDBySocketID(socket.id);
			console.log('>> socket connection upgraded to', socket.conn.transport.name);
			this.telemetry.clients[sessionID].transport = socket.conn.transport.name;
		});

		socket.on('client:response', (response) => {
			console.log('client:response :', socket.id, response);
			if (this.clientResponseHandler) {
				this.clientResponseHandler(socket, response);
			}
		})

		// player:ready
		socket.on('player:ready', (data, callback) => {
			console.log('player:ready from socket:', socket.id, data, callback);
			const player = this.getPlayerBySocketID(socket.id);
			const sessionID = this.getSessionIDBySocketID(socket.id);
			if (callback && typeof callback === 'function') {
				callback(player);
			}
			// and send the player their player object for display on the play page
			// this.#io.to(socket.id).emit('playerconnect', player);

			// data should inclue the players device type so store in telemetry
			if (data && data.device) {
				if (this.telemetry.clients[sessionID]) {
					this.telemetry.clients[sessionID].device = data.device;
				}
			}

			// Notify game of player (re)connection - function should work for both new and reconnected players
			if (this.game) {
				console.log('Sending server:loadgame to player:', this.game.name);
				socket.emit('server:loadgame', this.game.name);
				this.game.onPlayerReconnect(player, socket);
			}
			// if we have no game then the player will remain in the lobby

		})

		// player:rating - sent by player at the end of a game/quiz
		// Find a way to store this without needing to call game - should be agnostic of game type
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

			// Add this disconnect event to the telemetry
			const sessionID = this.getSessionIDBySocketID(socket.id);
			if (this.telemetry.clients[sessionID]) {
				this.telemetry.clients[sessionID].disconnects.push( { timestamp: new Date(), reason: reason } );
			}
			consoleLogLimiter.reset(socket.id);
			this.removePlayer(socket.id);
		})
		socket.on('consolelog', (data) => {
			if (!consoleLogLimiter.allow(socket.id)) return;
			console.log('Message from:', socket.id);
			console.dir(data);
		})
		socket.on('client:pong', (timestamp) => {
			const latency = Date.now() - timestamp;
			console.log('Received client:pong from socket:', socket.id, 'Timestamp:', timestamp, 'Latency:', latency);
			
			const sessionID = this.getSessionIDBySocketID(socket.id);
			if (this.telemetry.clients[sessionID]) {
				// timestamp here is the raw ms-epoch number echoed back from the client (used above
				// for the latency subtraction) - convert to a real Date only at the point of
				// storing it, so it persists as a proper BSON date rather than a raw number.
				this.telemetry.clients[sessionID].latency.push({ timestamp: new Date(timestamp), latency: latency });
			}
		});
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

		console.log('ROOM.js:: Attaching host events for socket:', socket.id);

		// host:ready
		// Sent by host when they have loaded the host page and are ready to start receiving messages
		// Consolidates initialization directly in a single handshake using URL parameters (q/s/gameType)
		socket.on('host:ready', async (data, callback) => {

			const userObj = this.getPlayerBySocketID(socket.id) || this.host;
			const gameType = userObj?.gameType;
			const quizID = userObj?.quizID;
			const seasonID = userObj?.seasonID;

			console.log(`Received host:ready: socketID=${socket.id}, roomID=${this.id}, gameType=${gameType}, quizID=${quizID}, seasonID=${seasonID}`);

			// Telemetry reporting
			const sessionID = this.getSessionIDBySocketID(socket.id);
			if (data && data.device) {
				if (sessionID && this.telemetry.clients[sessionID]) {
					this.telemetry.clients[sessionID].device = data.device;
				}
			}

			let initData = {};

			if (gameType && gameType !== 'lobby' && gameType !== 'dashboard') {
				// Secure auto-initialization of game state on the server at start-up!
				try {
					console.log(`ROOM.js:: Auto-bootstrapping game '${gameType}' directly during ready handshake...`);
					const gameModule = await import(`./games/server.${gameType}.js`);
					const NewGame = gameModule.default;

					this.game = new NewGame(this);
					this.game.name = gameType;

					const config = { quizID };
					if (this.game.init && typeof this.game.init === 'function') {
						initData = await this.game.init(config) || {};
					}

					this.emitToAllPlayers('server:loadgame', gameType);
				} catch (error) {
					console.error(`ROOM.js:: Auto-bootstrap failed for game '${gameType}':`, error);
				}
			}

			// Send richer consolidated response back to the client
			if (callback && typeof callback === 'function') {
				callback({
					success: true,
					roomID: this.id,
					...initData
				});
			}

			console.log('host:ready:: sending connected players:', this.getConnectedPlayers());
			socket.emit('server:players', this.getConnectedPlayers());
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

		// This is a general-purpose event that can be used to trigger any custom action defined by the host
		// Server merely broadcasts to all hosts - individual games can interpret data however they list
		socket.on('host:action', (data) => {
			console.log('host:action:', data);
			this.emitToHosts('server:hostaction', data);
		});

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

		// triggersocketevent - can be used to simulate a socket event from the server
		// Simply echoes directly back to the hosts and players whatever event was passed
		// Dev/test tool only - disabled in production so it can't be used to spoof server messages
		socket.on('triggersocketevent', (data) => {
			if (process.env.NODE_ENV === 'production') return;
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
		console.log('room:: registerHostKeypressHandler:', handler);
		this.hostKeypressHandler = handler;
	}
	deregisterHostKeypressHandler() {
		console.log('room:: deregisterHostKeypressHandler:');
		this.hostKeypressHandler = null;
	}

	pingAllClients() {

		// Check if we have any connected clients
		// We check for >1 because we assume 1 client equals just a host - nothing much to collect at this point
		if (this.#io.sockets.sockets.size > 1) {
			console.log(`Pinging ${this.#io.sockets.sockets.size} clients in the room...`);

			// Can just use this room ID to automatically call all connected clients of this room
			this.#io.to(this.id).emit('server:ping', { timestamp: Date.now() } );
		}
	}

	// isEmpty
	// True once no hosts, admins, or connected players remain in the room
	isEmpty() {
		return this.hosts.length === 0 && this.admins.length === 0 && this.getConnectedPlayers().length === 0;
	}

	// checkIdle
	// Called on every ping tick. If the room has been empty for longer than the idle timeout,
	// tear it down - saving any in-progress game results first, same as a host explicitly ending the game.
	async checkIdle() {
		if (!this.emptyAt) return;
		if (Date.now() - this.emptyAt < ROOM_IDLE_TIMEOUT_MS) return;

		console.log(`Room::checkIdle: room ${this.id} has been empty for over ${ROOM_IDLE_TIMEOUT_MS}ms - tearing down`);
		try {
			if (this.game) {
				await this.triggerEndGame();
			} else {
				this.endGame();
			}
		} catch (error) {
			console.error(`Room::checkIdle: error tearing down room ${this.id}:`, error);
		}
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

	// host:requestend
	// Called by host when they want to end the current game session
	// This feels like the best place to perform all teardown, store final results and clean up
	async triggerEndGame() {

		try {
			await this.saveGameResults();
		} catch (error) {
			console.error('Error saving game results:', error);
		}

		if (this.game) {
			this.game.endGame();
		}

		this.endGame();
	}

	// saveGameResults
	// Store all results to DB for later analysis
	async saveGameResults() {

		const hostID = this.host ? this.host.userID : null;
		const duration = this.game.startTime ? Math.floor((new Date() - this.game.startTime) / 1000) : 0;

		// Determine verification level based on host's role or specific official IDs
		// For now, 0 = Official, 1 = Trusted, 2 = Verified, 3 = Everyone (Default)
		let verificationLevel = 3;
		if (this.host && this.host.role === 'admin') {
			verificationLevel = 0;
		}

		const seasonID = this.host ? this.host.seasonID : null;

		// Update the telemetry data with total connected players, hosts and admins
		this.telemetry.totalPlayers = this.players.length;
		this.telemetry.totalHosts = this.hosts.length;
		this.telemetry.totalAdmins = this.admins.length;

		try {

			const session = await GameSession.create({
				gameType: this.game.name,
				gameID: this.game.quizData._id,
				seasonID: seasonID, // Link this session to a specific competitive Season
				hostID: hostID,
				roomCode: this.id,
				startTime: this.game.startTime || new Date(),
				duration: duration,
				isLive: true, // Need more logic here to decide if this was a live quiz or not
				verificationLevel: verificationLevel,
				metadata: {
					title: this.game.quizData.title,
					totalRounds: this.game.quizData.rounds.length,
					totalQuestions: this.game.quizData.rounds.reduce((acc, r) => acc + r.questions.length, 0)
				},
				telemetry: this.telemetry,
			});
			console.log('Game session saved:');
			console.dir(session);

			const playerResults = this.game.playerResults;

			if (playerResults) {

				// Inject the sessonID into each result so they can be associated with the correct game session
				// This will be important when generating season leaderboard as only certain gameSessions will be used
				playerResults.forEach(result => {
					result.gameSessionID = session._id;
				});

				await PlayerResult.insertMany(playerResults);
				console.log(`Successfully saved ${playerResults.length} player results for session ${session._id}`);
				console.dir(playerResults);
			}	
		} catch (error) {
			console.error('Error saving game session and/or player results:', error);
		}
	}

	// endGame
	// Called by the loaded game when it should be terminated
	// Responsible for cleaning up game state and notifying all clients
	// NOTE: in the event that we return to a lobby then this room must be re-entrant (I think this should be possible)
	// We still want to store all results for this game even if we intend to play another immediately
	endGame() {
		console.log('room.endGame: game has ended - clear up');

		// Clear the ping interval for the room
		// NOTE: what happens if we start another game? We might need to re-initialize the ping interval for the new game.
		// Maybe the room should be responsible for managing its own ping lifecycle entirely and not the game...???
		console.log('Clearing ping interval for the room');
		this.clearPingInterval();

		this.game = null;

		// Clear all socket event listeners
		const allSessions = [...this.hosts, ...this.admins, ...this.players];
		allSessions.forEach(user => {
			const socket = this.getSocket(user.socketID);
			if (socket) {
				socket.removeAllListeners();
				// Force fully leaving this room in Socket.io
				socket.leave(this.id);
			}
		});

		// Call the onDestroy callback if it exists
		if (typeof this.onDestroy === 'function') {
			this.onDestroy();
		}

		// Don't bother doing this right now - see how it looks and find a better 'end-game' solution
		// this.emitToHosts('server:loadgame', 'lobby');
		// this.emitToAllPlayers('server:loadgame', 'lobby');
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
				console.error(`Cannot emit to player - socket ${players[i]} not found - trying sessionID`);
				const player = this.players.find(p => p.socketID === players[i] || p.sessionID === players[i]);
				if (player) {
					const playerSocketBySession = this.getSocket(player.socketID);
					if (playerSocketBySession) {
						playerSocketBySession.emit(event, data, wrappedCallback);
					} else {
						console.error(`Cannot emit to player ${player.name} - socket ${player.socketID} not found`);
					}
				} else {
					console.error(`Cannot find player with socketID or sessionID: ${players[i]}`);
				}
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

		// Start (or keep) the idle clock the moment no one is left connected; see checkIdle
		if (this.isEmpty() && !this.emptyAt) {
			this.emptyAt = Date.now();
		}
	}
	getPlayerBySocketID(socketID) {
		// console.log(this.players.find( (player) => player.socketID == socketID ));
		return this.players.find((player) => player.socketID === socketID)
	}
	getPlayerBySessionID(sessionID) {
		return this.players.find((player) => player.sessionID === sessionID)
	}
	getSessionIDBySocketID(socketID) {
		const player = this.getPlayerBySocketID(socketID);
		if (player) return player.sessionID;
		const host = this.hosts.find((host) => host.socketID === socketID);
		if (host) return host.sessionID;
		const admin = this.admins.find((admin) => admin.socketID === socketID);
		if (admin) return admin.sessionID;
		return undefined;
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
		file.on('error', (err) => {
			console.error('QR code file write error for room:', roomID, err.message);
		});
		const request = https.get(qrURL, (response) => {
			if (response.statusCode !== 200) {
				console.error('QR code request failed for room:', roomID, 'status:', response.statusCode);
				response.resume();
				file.close();
				return;
			}
			response.pipe(file);
			file.on('finish', () => {
				file.close();
				console.log('QR code generated for room:', roomID);
			});
		});
		request.on('error', (err) => {
			console.error('QR code request error for room:', roomID, err.message);
			file.close();
		});
	}
}

export { Room }