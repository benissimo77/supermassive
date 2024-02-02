// Models
const res = require('express/lib/response');
const { Player, Game, Actions, Roles } = require('./server/models/allModels');


class Room {

	// We keep a copy of the IO socker server and use this to emit all our events
	#io;

	constructor(io, id) {
		this.#io = io;
		this.id = id;
		this.host = undefined;
		this.players = [];
		this.started = false;
		this.minplayers = 5;
		this.currentAction = null;
		this.clientResponses = [];
		this.clientResponseHandlers = [];

		// Development hardcode this new game for testing
		this.game = new Game();
	}

	// we say user because at this point we don't know if they are a player or a host/moderator/viewer etc...
	addUserToRoom(socket, userObj) {

		// console.log('userJoinRoom:', userObj.name, this.host, this.id);

		// Instantly add this user's socket to this room
		socket.join(this.id);

		// host value in player object must evaluate to truth (eg = 1)
		if (userObj.host) {
			console.log('this user is HOST');
			// perform host initialisation...
			this.host = userObj;
			this.#io.to(socket.id).emit('playerlist', this.players);
			this.attachHostEvents(socket);
		} else {

			const player = new Player(userObj);
			
			// For now we only have host and players - maybe in future there will be other user types
			this.players.push(player);
			// this.game.addPlayer(player);

			// throw this in here for now...
		
			// Send message to host (if there is one)
			if (this.host) {
				this.#io.to(this.host.socketid).emit('addplayer', player);
			}
		}

		socket.on('client:response', (response) => {
			console.log('client:response :', socket.id, response);
			// this.clientResponse(socket, selected);
			this.clientResponseHandlers.forEach( (handler) => {
				handler(socket, response);
			})

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

		socket.on('host:requeststart', () => {
			console.log('host:requeststartgame:', socket.id, this.getPlayerBySocketId(socket.id));
			this.startGame(socket);
		})
		socket.on('host:requestnight', () => {
			console.log('host:requestnight:', this.getLivingVillagers());
			this.nightAction();
		})
		socket.on('host:requestday', () => {
			console.log('host:requestday');
			this.dayAction();
		})
		socket.on('requestgamestate', () => {
			console.log('requestgamestate:', socket.id, this.getPlayerBySocketId(socket.id));
			this.#io.to(socket.id).emit('gamestate', this.players);
		})

	}

	registerClientResponseHandler(handler) {
		console.log('registerClientResponseHandler:', handler);
		this.clientResponseHandlers.push( handler );
	}
	deregisterClientResponseHandler(handler) {
		console.log('deregisterClientResponseHandler:', handler);
		this.clientResponseHandlers = this.clientResponseHandlers.filter( (h) => { return h != handler } );
	}

	startGame(socket) {

		console.log('Room::startGame:', socket.id, this.id);

		// Validation
		if (this.players.length < this.minplayers) {
			console.log(`ERROR: This game requires at least ${this.minplayers} players`);
			return false;
		}

		// Assign roles to players (customize based on your game rules)
		// I'm going to ahrdcode some logic here for now until this gets more formalised
		// Assume around 12 players
		// 1 Seer, 1 Witch, 1 Healer, 2 wolves, remaining villagers
		// If there is time try to add GHOST - can spell out a letter each night
		// Witch can resurrect ANYONE they like from the list of dead players (once)
		const numWerewolves = this.players.length > 10 ? 3 : 2;
		const numVillagers = this.players.length - numWerewolves - 3;

		console.log('Room: startGame:', numWerewolves, numVillagers);

		let roles = new Array(numWerewolves).fill(Roles.WEREWOLF);
		roles.push(...new Array(numVillagers).fill(Roles.VILLAGER));
		roles.push(Roles.SEER);
		roles.push(Roles.WITCH);
		roles.push(Roles.HEALER);

		// Shuffle roles to randomize assignments
		roles = shuffleArray(roles);

		// Assign roles to players
		this.players.forEach((player, index) => {
			player.role = roles[index];
		});

		// Hardcode the sending of roles for speed
		this.players.forEach( (player) => {
			console.log(player.socketid, player.role);
			this.#io.to(player.socketid).emit('playerrole', player.role);
		})
		
		// Send full playerlist to host
		// TODO - find a better way to synchronize the player list without destroying and re-creating
		// Experimenting with a simple gamestate call which updates the host screen based on players
		this.#io.to(this.host.socketid).emit('gamestate', this.players);

		return this.started = true;
	}

	nightAction() {
		this.currentAction = Actions.NIGHT;
		console.log('nightaction:', this.id, this.getLivingVillagers());

		// Several things can happen during the night phase
		// Collect them all up and then take action based on the accumulation of results
		let wolfkill = null;
		let healer = null;
		let witchkill = null;
		let witchsave = null;
		
		// Define all the callback functions which will be chained together
		const wolfKillCallback = (selected) => {
			wolfkill = selected;
			const socketlist = this.getLivingPlayersWithRole(Roles.HEALER);
			const buttonlist = this.getLivingPlayers();
			this.collectVotes(socketlist, buttonlist, healerCallback);
		}
		const healerCallback = (selected) => {
			healer = selected;
			const socketlist = this.getLivingPlayersWithRole(Roles.WITCH);
			if ((socketlist.length > 0) && (!socketlist[0].witchkill)) {
				const livingplayers = this.getLivingPlayers();
				const buttonlist = [...livingplayers, { socketid:null, name:'NOT THIS TIME'}];
				this.collectVotes(socketlist, buttonlist, witchKillCallback);		
			} else {
				witchKillCallback( { socketid:''} );
			}
		}
		const witchKillCallback = (selected) => {
			witchkill = selected;
			const socketlist = this.getLivingPlayersWithRole(Roles.WITCH);
			// if witch just killed someone then mark the witch kill so we don't do in future
			if (socketlist.length > 0) {
				if (this.getPlayerBySocketId(witchkill.socketid).length > 0) {
					socketlist[0].witchkill = true;
				}				
			}
			if ((socketlist.length > 0) && (!socketlist[0].witchsave)) {
				let buttonlist = this.getDeadPlayers();
				if (wolfkill) {
					buttonlist.push(wolfkill);
				}
				buttonlist.push({socketid:null, name:'NOT THIS TIME'});
				this.collectVotes(socketlist, buttonlist, witchSaveCallback);
			} else {
				witchSaveCallback( {socketid:''});
			}
		}
		const witchSaveCallback = (selected) => {
			witchsave = selected;

			// if witch saved someone then mark save so we don't repeat in future
			const playersaved = this.getPlayerBySocketId(witchsave.socketid);
			if (playersaved) {
				witch = this.getLivingPlayersWithRole(Role.WITCH);
				witch[0].witchsave = true;
			}
			console.log('ALL DONE...', wolfkill, healer, witchkill, witchsave);

			// this.wolfKill(selected);
			// console.log('After kill:', this.getPlayerBySocketId(selected));
			// console.log('Sending wolfkill to:', this.host.socketid);
			// this.#io.to(this.host.socketid).emit('wolfkill', selected);
		}

		// Kick start the chain with the first vote - the wolves
		const villagers = this.getLivingVillagers();
		
		console.log('Living villagers:', villagers);
		const wolves = this.getLivingPlayersWithRole(Roles.WEREWOLF);
		console.log('Wolves:', wolves);
		this.collectVotes(wolves, villagers, wolfKillCallback);
	}

	collectVotes(socketlist, buttonlist, callback) {

		console.log('collectVotes:', callback);

		const voteHandler = (socket, response) => {
			console.log('voteHandler:', socket.id, response);
			// Immediately send a response back to the wolf clients for confirmation
			const payload = { message: 'You voted:<br/><br/>' + response.label, timer:3 }
			this.#io.to(socketlist).emit('server:request', { type:'timedmessage', payload: payload } );
			this.deregisterClientResponseHandler(voteHandler);
			callback(response);
		}


		if (socketlist.length > 0 && buttonlist.length > 0) {

			// socketlist is an array of objects, name and socketid, for use as a button
			// but socketlist needs to just be the socketids and nothing else
			socketlist = socketlist.map( (socket) => { return socket.socketid } );
			this.registerClientResponseHandler(voteHandler);
			this.#io.to(socketlist).emit('server:request', { type:'buttonselect', payload: buttonlist } );
		} else {
			callback(null);
		}
	}

	dayAction() {

		// For now go for something simpler... collect up the remaining players
		this.currentAction = Actions.DAY;
		let votes = [];
		let timerId = null;
		const livingPlayers = this.getLivingPlayers();
		console.log('Living players:', livingPlayers);
		const livingPlayerSockets = livingPlayers.map( (player) => { return player.socketid } );
		this.#io.to(livingPlayerSockets).emit('server:request', { type: 'buttonselect', payload:livingPlayers } );

		const voteCount = () => {
			console.log('voteCount:', votes);
			clearTimeout(timerId);
			// Now we have to find which player has the most votes
			// do more with this later...
			const map = votes.reduce((acc, e) => acc.set(e.response, (acc.get(e.response) || 0) + 1), new Map());
			console.log('As map:', map);
			console.log('Entries:', [...map].entries());
		}
		const voteHandler = (socket, response) => {
			votes.push( { socket: socket.id, response: response.id } );
			console.log('voteHandler:', socket.id, response, votes);
			const payload = { message: 'You voted:<br/><br/>' + response.label, timer:3 }
			this.#io.to(socket.id).emit('server:request', { type:'timedmessage', payload: payload } );
			if (votes.length == livingPlayers.length) {
				// Everyone has voted
				console.log('All votes are IN:');
				voteCount();
				// Assuming we are done with the day phase
				this.deregisterClientResponseHandler(voteHandler);
			}
		}
		this.registerClientResponseHandler(voteHandler);
		timerId = setTimeout( voteCount, 3000);
		this.#io.to(this.host.socketid).emit('server:starttimer',  { duration: 3 } );
	}

	// Need a good way to match up socket events with game state to determine what to do
	// For now just fudget it until I have a better understanding of all the possibilities
	clientResponse(socket, response) {

		console.log('clientResponse:', socket.id, response);

		// Immediately send a response back to the client for confirmation
		// OK this works - commenting out so I can use the same client for multiple button clicks...
		// const payload = { message: 'You voted:<br/><br/>' + response.label, timer:3 }
		// this.#io.to(socket.id).emit('server:request', { type:'timedmessage', payload: payload } );
		
		const selected = response.id;

		// Use the gameState to check if we are night or daytime to determine how to process this event
		if (this.currentAction == Actions.NIGHT) {

			this.wolfKill(selected);
			console.log('After kill:', this.getPlayerBySocketId(selected));
			console.log('Sending wolfkill to:', this.host.socketid);
			this.#io.to(this.host.socketid).emit('wolfkill', selected);
		
		} else {

			this.clientResponseHandlers.forEach( (handler) => {
				handler(socket, response);
			})
		}
	}

	processClientResponses() {
		// Map an array of socketids to an object with socketid:total votes
		const map = this.clientResponses.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
		console.log('As map:', map);
		console.log('Entries:', [...map].entries());
		// Now we have to find which player has the most votes
		// do more with this later...
	}

	
	getPlayers() {
		return this.players;
	}

	removePlayer(socketid) {
		this.players = this.players.filter( (player) => player.socketid != socketid);
	}
	getPlayerBySocketId(socketid) {
		console.log(this.players.find( (player) => player.socketid == socketid ));
		return this.players.find( (player) => player.socketid === socketid )
	}

	getLivingPlayers() {
		return this.players.filter( (player) => {
			return (player.alive)
		 }).map( (player) => {
			return { socketid:player.socketid, name:player.name }
		 })
	}
	getDeadPlayers() {
		return this.players.filter( (player) => {
			return (!player.alive)
		 }).map( (player) => {
			return { socketid:player.socketid, name:player.name }
		 })
	}
	getLivingVillagers() {
		return this.players.filter( (player) => {
			console.log('getLivingVillagers:', player);
			return (player.alive & player.role != Roles.WEREWOLF)
		}).map( (player) => {
			return { socketid:player.socketid, name:player.name }
		})
	}
	getLivingPlayersWithRole(role){ 
		console.log('getLivingPlayersWithRole:', role);
		return this.players.filter( player => player.alive & player.role === role)
		.map( (player) => {
			return { socketid:player.socketid, name:player.name }
		})
	}
	getWolves() {
		return this.players.filter( player => player.role === Roles.WEREWOLF )
		.map( (player) => {
			return { socketid:player.socketid, name:player.name }
		})
	}
	getWolfSockets() {
		const wolves = this.getWolves();
		return wolves.map( (wolf) => { return wolf.socketid } );
	}
	wolfKill(socketid) {
		const thisPlayer = this.getPlayerBySocketId(socketid);
		if (!thisPlayer) {
			console.log('ERROR: cant find player with this socket.id:', socketid);
			return;
		}
		thisPlayer.alive = false;
		thisPlayer.killaction = Actions.NIGHT;
	}
	villagerKill(socketid) {
		thisPlayer = this.getPlayerBySocketId(socketid);
		if (!thisPlayer) {
			console.log('ERROR: cant find player with this socket.id:', socketid);
			return;
		}
		thisPlayer.alive = false;
		thisPlayer.killaction = Actions.DAY;
	}



}

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

module.exports = { Room }