// Models - note this should be placed into the werewolves file since it is game-specific
const { Player, Phases, Roles } = require('./server/models/allModels');
const { mongoose } = require('./db');


class Room {

	// We keep a copy of the IO socker server and use this to emit all our events
	#io;

	constructor(io, id) {
		this.#io = io;
		this.id = id;
		this.host = undefined;
		this.game = undefined;
		this.players = [];

	}

	// we say user because at this point we don't know if they are a player or a host/moderator/viewer etc...
	addUserToRoom(socket, userObj) {

		console.log('Room::addUserToRoom:', this.id, userObj.name, userObj.host, userObj.sessionid);

		// Instantly add this user's socket to this room
		socket.join(this.id);

		// host value in player object must evaluate to truth (eg = 1)
		if (userObj.host) {
			// perform host initialisation...
			this.host = userObj;
			this.#io.to(socket.id).emit('hostconnect', this.players);
			this.attachHostEvents(socket);
		} else {

			var player = this.getPlayerBySessionId(userObj.sessionid);
			if (player) {
				console.log('player already exists:', player);
				player.disconnected = false;
				// each re-connection will result in a new socketid
				player.socketid = socket.id;
			} else {
				player = new Player(userObj);
				this.players.push(player);
			}
			
			// Send message to host (if there is one)
			if (this.host) {
				this.#io.to(this.host.socketid).emit('playerconnect', player);
			}
			// and send the player their player object for display on the play page
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
		
		// console.log('userJoinRoom ending: ', this.players);
	}

	attachHostEvents(socket) {

		socket.on('host:requestgame', (game) => {
			console.log('host:requestgame:', game);
			const NewGame = require(`./server/games/server.${game}.js`);
			this.game = new NewGame(this);

			// there might need to be some more checks here to make sure the game is valid and the initial conditions for playing have been met
			// eg there should be enough players to start the game
			// Maybe delay these checks until the game itself has loaded - maybe host wants to take a look but not play yet...
			
			const valid = this.game.checkGameRequirements();
			console.log('Game is valid:', valid);
			if (valid || true) {
				this.emitToHosts('server:loadgame', game);
				this.emitToAllPlayers('server:loadgame', game);
			}
		})

		// requeststart
		// Called by host once the introduction has been watched and host is ready to start the game
		socket.on('host:requeststart', () => {
			console.log('host:requeststart:', socket.id, this.getPlayerBySocketId(socket.id));
			if (this.game) {
				const valid = this.game.checkGameRequirements();
				console.log('Game is valid:', valid);
				if (valid) {
					this.game.startGame();
				}
			}
		})
		socket.on('host:requestend', () => {
			console.log('host:requestend:', socket.id, this.game, this.getPlayerBySocketId(socket.id));
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
			console.log('requestgamestate:', socket.id, this.getPlayerBySocketId(socket.id));
			this.#io.to(socket.id).emit('gamestate', this.players);
		})
		socket.on('host:response', (response) => {
			console.log('host:response :', socket.id, response);
			if (this.hostResponseHandler) {
				this.hostResponseHandler(socket, response);
			}
		})
		// General purpose test event - can be used as a scratch to quickly check some functionality server-side
		socket.on('buttontest', (data) => {
			console.log('Host:: buttontest:', data);
			// this.#io.to(socket.id).emit('nightkill', [ this.players[0].socketid, this.players[1].socketid ] );
			this.emitToAllPlayers('server:loadgame', 'werewolves');
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

	endGame() {
		console.log('room.endGame: game has ended - clear up');
		this.game = null;
		this.emitToHosts('server:loadgame', 'lobby');
		this.emitToAllPlayers('server:loadgame', 'lobby');
	}

	// emitToHosts
	// Send an event to all hosts in the room, with the data payload
	// Optional 'waitForResponse' flag will wait for a response from the host before continuing
	emitToHosts(event, data, waitForResponse = false) {
		this.#io.to(this.host.socketid).emit(event, data);
		if (waitForResponse) {
			return new Promise( (resolve, reject) => {
				this.registerHostResponseHandler(resolve);
			})
		}
	}

	// emitToPlayers
	// Send an event to the specified players, with the data payload
	emitToPlayers(players, event, data) {
		this.#io.to(players).emit(event, data);
	}

	// emitToAllPlayers
	// Send an event to all players in the room, with the data payload (note: NOT sent to the host)
	emitToAllPlayers(event, data) {
		const playerSockets = this.players.map( (player) => { return player.socketid } );
		console.log('emitToAllPlayers:', playerSockets, event, data);
		this.#io.to(playerSockets).emit(event, data);
	}

	// getClientResponses
	// General-purpose function collect responses from a client or clients
	// socketlist an array of socketids
	// buttonlist an array of objects with id and label
	// strategy an object which defines the strategy for collecting responses
	// 1. Send a request to the client(s) to select a button from a list of buttons
	// 2. Collect responses from the client(s) and store them in an array
	// 3. When end condition is met, call the callback function with the responses
	// 4. strategy can also include a timer which allows a time limit to be defined, after which collection ends
	getClientResponses(socketlist, buttonlist, strategy) {

		// Dictionary to hold votes, scoped to this function so all functions inside here can access
		let responses = {};
		// ...and the players voting will always be constant, so define here and use throughout (same with voterSockets)

		// collectResponses
		// This function will send an event to all players in the list with a buttonselect request
		// It will then collect the responses and resolve once end condition has been met
		const collectResponses = () => {

			return new Promise( (resolve, reject) => {
				const responseHandler = (socket, response) => {
					console.log('responseHandler:', socket.id, response, Object.keys(responses).length);
					responses[socket.id] = response;	// this ensures that we can't vote twice
					if (strategy.responseHandler) {
						strategy.responseHandler(socket, response);
					}
					if (strategy.endCondition(responses)) {
						resolve();
					}
				}		
				this.registerClientResponseHandler(responseHandler);
				console.log('Sending server:request to all clients in :', socketlist);
				this.#io.to(socketlist).emit('server:request', { type: 'buttonselect', payload: buttonlist } );
			})
		}
		
		console.log('getClientResponses:', socketlist, buttonlist, strategy);
		if (strategy.timeoutSeconds && strategy.timeoutSeconds > 0) {
			this.#io.to(this.host.socketid).emit('server:starttimer',  { duration: strategy.timeoutSeconds } );
			this.withTimeout(collectResponses(), strategy.timeoutSeconds)
			.then( () => {
				console.log('Responses collected:', responses);
				this.deregisterClientResponseHandler();
				strategy.callback(responses);
			})
		} else {
			collectResponses()
			.then( () => {
				console.log('Responses collected:', responses);
				this.deregisterClientResponseHandler();
				strategy.callback(responses);
			})
		}
	}

	collectVotesUnused(playersVoting, playersBeingVotedOn) {

		// map livingPlayers to just get the socketids
		const playersVotingSockets = playersVoting.map( (player) => { return player.socketid } );

		// initialize the votes array and timerId
		let votes = [];
		let timerId = null;
		const timeoutSeconds = 10;

		const votesCollected = () => {

			// Clean-up: clear the timer and deregister the voteHandler
			clearTimeout(timerId);
			this.deregisterClientResponseHandler();
			this.#io.to(playersVotingSockets).emit("server:request", { type:"timedmessage", payload: { message:"Votes are IN", timer:3 } } );
			
			// Now we have to find which player has the most votes
			// votes is an array of objects with socketid of the voter and response who they voted for
			// We need to convert this into a map of socketid:total votes
			const map = votes.map( (vote) => { return vote.response } );
			const occurences = this.countOccurences(map);
			const candidates = this.getEntriesWithMaximumOccurences(occurences);
			console.log('Candidates:', candidates);
			if (candidates.length == 0) {
				this.collectVotes(playersVoting, playersBeingVotedOn);
			} else if (candidates.length > 1) {
				// There is a draw - need to do something about this
				console.log('There is a draw');
				// Need to repeat the vote - build a new buttonlist with just the candidates
				playersBeingVotedOn = candidates.map( (candidate) => { return this.getPlayerBySocketId(candidate[0]) } );
				this.#io.to(this.host.socketid).emit('daydraw', votes.map( vote => { return vote.response } ));
				this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'We have a DRAW!<br/><br/>Vote again...' } });
				this.registerHostResponseHandler( () => { this.collectVotes(playersVoting, playersBeingVotedOn); });
			} else {
				// We have a winner
				const dead = candidates[0][0];
				this.dayKill(dead);
				this.#io.to(playersVotingSockets).emit("server:request", { type:"timedmessage", payload: { message:"The people have chosen...", timer:3 } } );
				this.#io.to(this.host.socketid).emit('daykill', dead);
			}
		}
		const voteHandler = (socket, response) => {
			votes.push( { socketid: socket.id, response: response.socketid } );
			console.log('voteHandler:', socket.id, response, votes);
			const payload = { message: 'You voted:<br/><br/>' + response.name, timer:3 }
			this.#io.to(socket.id).emit('server:request', { type:'timedmessage', payload: payload } );
			this.#io.to(this.host.socketid).emit('server:playervoted',  this.getPlayerBySocketId(socket.id) );
			if (votes.length == playersVoting.length) {
				// Everyone has voted
				console.log('All votes are IN:');
				votesCollected();
			}
		}

		// Send the request to all living players and collect responses
		this.#io.to(playersVotingSockets).emit('server:request', { type: 'buttonselect', payload: playersBeingVotedOn } );
		this.#io.to(this.host.socketid).emit('server:dayvote',  { voters: playersVoting, votingon: playersBeingVotedOn } );
		this.registerClientResponseHandler(voteHandler);
		timerId = setTimeout(votesCollected, timeoutSeconds * 1000);
		this.#io.to(this.host.socketid).emit('server:starttimer',  { duration: timeoutSeconds } );
	}


	// Helper function to add a timeout to a promise
	withTimeout(promise, timeoutSeconds) {
		const timeout = new Promise((resolve) => {
			let id = setTimeout(() => {
				clearTimeout(id);
				resolve('Timed out');
			}, timeoutSeconds*1000);
		})
		return Promise.race([promise, timeout]);
	}
	
	// PLAYER FUNCTIONS
	// These are defined on the Room but used by all games - functions related to players
	// removePlayer
	// Remove a player from the room - only takes effect if game has not started
	// If game HAS started then we need to handle the player leaving in a different way - maybe just mark them as disconnected
	removePlayer(socketid) {
		if (this.started) {
			const player = this.players.find( (player) => player.socketid === socketid );
			if (player) {
				player.disconnected = true;
			}
		} else {
			this.players = this.players.filter( (player) => player.socketid != socketid);
		}
		// Either way we want to inform the host - we will remove the player from the host display even though we retain the player object
		if (this.host) {
			this.#io.to(this.host.socketid).emit('playerdisconnect', socketid);
		}
	}
	getPlayerBySocketId(socketid) {
		console.log(this.players.find( (player) => player.socketid == socketid ));
		return this.players.find( (player) => player.socketid === socketid )
	}
	getPlayerBySessionId(sessionid) {
		return this.players.find( (player) => player.sessionid === sessionid )
	}
	getConnectedPlayers() {
		return this.players.filter( (player) => !player.disconnected );
	}

}

module.exports = { Room }