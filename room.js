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
		this.clientResponseHandler = null;
		this.hostResponseHandler = null;

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
			this.#io.to(socket.id).emit('playersinroom', this.players);
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
			// and send the player their player object for display on the play page
			this.#io.to(socket.id).emit('player', player);
		}

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
		socket.on('host:response', (response) => {
			console.log('host:response :', socket.id, response);
			if (this.hostResponseHandler) {
				this.hostResponseHandler(socket, response);
			}
		})
		socket.on('buttontest', () => {
			console.log('buttontest:');
			this.#io.to(socket.id).emit('nightkill', [ this.players[0].socketid, this.players[1].socketid ] );
		})
	}

	registerClientResponseHandler(handler) {
		console.log('registerClientResponseHandler:', handler);
		this.clientResponseHandler = handler;
	}
	deregisterClientResponseHandler(handler) {
		console.log('deregisterClientResponseHandler:', handler);
		this.clientResponseHandler = null;
	}
	registerHostResponseHandler(handler) {
		this.hostResponseHandler = handler;
	}
	deregisterHostResponseHandler(handler) {
		this.hostResponseHandler = null;
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
		const numVillagers = this.players.length - numWerewolves - 1;

		console.log('Room: startGame:', numWerewolves, numVillagers);

		let roles = new Array(numWerewolves).fill(Roles.WEREWOLF);
		roles.push(...new Array(numVillagers).fill(Roles.VILLAGER));
		// roles.push(Roles.SEER);
		roles.push(Roles.WITCH);
		// roles.push(Roles.HEALER);

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

	// nightAction
	// BIG FUNCTION - this will be a series of steps to collect all the night actions in a chain
	//
	// 1. Send server request to host to display message, play instructions etc
	// 2. Wait for host response when above step complete
	// 3. Send server request to players to collect their responses
	// 4. Collect player response and store in local variabels until all requirements have been met
	// 5. Send server request to host to perform clean-up, final instructions etc
	// 6. Wait for host response to continue to next step
	// 7. Repeat until all steps are complete
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
		const wolfKillStart = () => {
			console.log('wolfKillStart:');

			this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WOLFOPEN' } );
			this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Wolves, open your eyes' } });
			this.registerHostResponseHandler(wolfKillGo);
		}
		const wolfKillGo = () => {
			console.log('wolfKillGo:');

			const villagers = this.getLivingVillagers();	
			console.log('Living villagers:', villagers);
			const wolves = this.getWolves();
			console.log('Wolves:', wolves);
			this.getClientResponse(wolves, villagers, wolfKillCallback);
		}
		const wolfKillCallback = (selected) => {
			wolfkill = selected;
			console.log('wolfKillCallback:', wolfkill);

			this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WOLFCLOSE' } );
			this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Wolves, close your eyes' } });
			this.registerHostResponseHandler(healerStart);
		}
		const healerStart = () => {
			console.log('healerStart:');

			const healer = this.getPlayerWithRole(Roles.HEALER);
			if (healer && (healer.alive || healer.nightKill)) {
				this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'HEALEROPEN' } );
				this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Healer, open your eyes' } });
				this.registerHostResponseHandler(healerGo);
			} else {
				witchStart();
			}
		}
		const healerGo = () => {
			console.log('healerGo:');

			const healer = this.getPlayerWithRole(Roles.HEALER);
			if (healer && healer.alive) {
				const buttonlist = this.getLivingPlayers();
				this.getClientResponse([healer], buttonlist, healerCallback);	
			} else {
				this.#io.to(healer.socketid).emit('server:request', { type:"timedmessage", payload: { message: "You are dead...<br/><br/>Nothing to do here", timer: 3 } });
				healerCallback();
			}
		}
		const healerCallback = (selected) => {
			healer = selected;
			console.log('healerCallback:', healer);

			this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'HEALERCLOSE' } );
			this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Healer, close your eyes' } });
			this.registerHostResponseHandler(witchStart);
		}
		const witchStart = () => {
			console.log('witchStart:');

			const witch = this.getPlayerWithRole(Roles.WITCH);
			if (witch && (witch.alive || witch.nightKill)) {
				this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHOPEN' } );
				this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, open your eyes' } });
				this.registerHostResponseHandler(witchKillGo);
			} else {
				seerStart();
			}
		}
		const witchKillStart = () => {
			console.log('witchKillStart:');

			this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHKILL' } );
			this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, choose someone to kill' } });
			this.registerHostResponseHandler(witchKillGo);
		}
		const witchKillGo = () => {
			const witch = this.getPlayerWithRole(Roles.WITCH);
			const livingplayers = this.getLivingPlayers();
			const buttonlist = [...livingplayers, { socketid:null, name:'NOT THIS TIME'}];
			this.getClientResponse([witch], buttonlist, witchKillCallback);		
		}
		const witchKillCallback = (selected) => {
			witchkill = selected;
			console.log('witchKillCallback:', witchkill);
			
			// Complex line first grabs any witches and then retrieves actual player object with that socketid
			const witch = this.getPlayerWithRole(Roles.WITCH);

			// if witch just killed someone then mark the witch kill so we don't do in future
			// we can discover this by checking if we have a valid player with the socketid
			const witchkilled = this.getPlayerBySocketId(witchkill.socketid);
			if (witchkilled) {
				witch.witchkill = selected;
			}

			// only allow witch to save if they haven't already saved someone
			this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHSAVE' } );
			this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, choose someone to save' } });
			this.registerHostResponseHandler(witchSaveGo);
		}
		const witchSaveGo = () => {
			const witch = this.getPlayerWithRole(Roles.WITCH);
			let buttonlist = [];
			if (wolfkill) {
				buttonlist.push(wolfkill);
			}
			buttonlist.push({socketid:null, name:'NOT THIS TIME'});
			if (witch.witchsave) {
				this.#io.to(witch.socketid).emit("server:request", { type:"timedmessage", payload: { message:"You've already SAVED<br/><br/>Nothing to do here", timer:3 } } );
				witchSaveCallback();
			} else {
				this.getClientResponse([witch], buttonlist, witchSaveCallback);
			}
		}
		const witchSaveCallback = (selected) => {
			witchsave = selected;

			// if witch saved someone then mark save so we don't repeat in future
			const playersaved = this.getPlayerBySocketId(witchsave.socketid);
			if (playersaved) {
				const witch = this.getPlayerWithRole(Roles.WITCH);
				witch.witchsave = true;
			}
			// debugging - send playerlist to host for display in browser
			this.#io.to(this.host.socketid).emit('playerlist', this.players );

			this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHCLOSE' } );
			this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, close your eyes' } });
			this.registerHostResponseHandler(seerStart);
		}
		const seerStart = () => {
			console.log('seerStart:');

			const seer = this.getPlayerWithRole(Roles.SEER);
			if (seer && (seer.alive || seer.nightKill)) {
				this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'SEEROPEN' } );
				this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Seer, open your eyes' } });
				this.registerHostResponseHandler(seerGo);
			} else {
				allDone();
			}
		}
		const seerGo = () => {
			console.log('seerGo:');

			const seer = this.getPlayerWithRole(Roles.SEER);
			if (seer && seer.alive) {
				const buttonlist = this.getLivingPlayers();
				this.getClientResponse([seer], buttonlist, seerCallback);	
			} else {
				this.#io.to(seer.socketid).emit("server:request", { type:"timedmessage", payload: { message:"You're DEAD...<br/><br/>Nothing to do here", timer: 3 } } );
				this.seerCallback({ socketid:'' });
			}
		}
		const seerCallback = (selected) => {
			console.log('seerCallback:', selected);

			// Send message to seer with the result of their selection
			const seer = this.getPlayerWithRole(Roles.SEER);
			const player = this.getPlayerBySocketId(selected.socketid);
			if (player) {
				const message = player.role === Roles.WEREWOLF ? 'YES' : 'NO';
				this.#io.to(seer.socketid).emit('server:request', { type:'timedmessage', payload: { message: message, timer: 3 } });
			}
			this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'SEERCLOSE' } );
			this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Seer, close your eyes' } });
			this.registerHostResponseHandler(allDone);
		}
		const allDone = () => {

			// Now we have all the night actions we can process them
			console.log('ALL DONE...', wolfkill, healer, witchkill, witchsave);

			// Now we have all the night actions we can process them
			// First we need to send the results to the host - display quickly on screen before people wake up to tell story of who died in the night
			let message = '';
			if (wolfkill && this.getPlayerBySocketId(wolfkill.socketid)) {
				message = message + 'Wolves killed: ' + wolfkill.name + '<br/>';
			}
			if (witchkill && this.getPlayerBySocketId(witchkill.socketid)) {
				message = message + 'Witch killed: ' + witchkill.name + '<br/>';
			}
			if (healer && this.getPlayerBySocketId(healer.socketid)) {
				message = message + 'Healer chose: ' + healer.name;
				if (healer.socketid == wolfkill.socketid || healer.socketid == witchkill.socketid) {
					message = message + ' (success!)<br/>';
				} else {
					message = message + ' (no effect)<br/>';
				}
			}
			if (witchsave && this.getPlayerBySocketId(witchsave.socketid)) {
				message = message + 'Witch saved: ' + witchsave.name + '<br/>';
			}
			this.#io.to(this.host.socketid).emit('server:request', { type: 'instructions', payload: { message: message } } );
			this.registerHostResponseHandler(wakeUp);
		}
		const wakeUp = () => {
			console.log('wakeUp:');
			this.#io.to(this.host.socketid).emit('morning');
			this.#io.to(this.host.socketid).emit('server:request', { type: 'instructions', payload: { message: 'Everyone, wake up<br/><br/>What happened?' } } );	
			this.registerHostResponseHandler(nightActionComplete);
		}
		const nightActionComplete = () => {
			
			// Now we turn the kills/saves into a final list of dead people
			let dead = new Set()
			if (wolfkill) dead.add(wolfkill.socketid);
			if (witchkill) dead.add(witchkill.socketid);
			if (healer) dead.delete(healer.socketid);
			if (witchsave) dead.delete(witchsave.socketid);
			console.log('Dead:', dead);
			this.nightKill(dead);
			if (dead.size > 0) {
				this.#io.to(this.host.socketid).emit('nightkill', Array.from(dead) );
			}
		}

		// Start the chain of events
		wolfKillStart();
	}

	getClientResponse(socketlist, buttonlist, callback) {

		console.log('collectVotes:', callback);

		const responseHandler = (socket, response) => {
			console.log('voteHandler:', socket.id, response);
			// Immediately send a response back to the relevant for confirmation (also has benefit of removing buttons so they can't vote again)
			const payload = { message: 'You chose:<br/><br/>' + response.name, timer:3 }
			this.#io.to(socketlist).emit('server:request', { type:'timedmessage', payload: payload } );
			this.deregisterClientResponseHandler(responseHandler);
			callback(response);
		}

		if (socketlist.length > 0 && buttonlist.length > 0) {

			// socketlist is an array of players objects, but it needs to just be the socketids and nothing else
			socketlist = socketlist.map( (socket) => { return socket.socketid } );
			// buttonlist is an array of players objects, but it needs to just be the socketids and names
			buttonlist = buttonlist.map( button => { return { socketid: button.socketid, name: button.name } } );
			this.registerClientResponseHandler(responseHandler);
			this.#io.to(socketlist).emit('server:request', { type:'buttonselect', payload: buttonlist } );
		} else {
			callback(null);
		}
	}

	dayAction() {
		const livingPlayers = this.getLivingPlayers();
		this.collectVotes(livingPlayers, livingPlayers);
	}

	collectVotes(livingPlayers, buttonlist) {

		// map livingPlayers to just get the socketids
		const livingPlayerSockets = livingPlayers.map( (player) => { return player.socketid } );
		// and map the buttonlist to get just the name/id
		buttonlist = buttonlist.map( button => { return { socketid: button.socketid, name: button.name } } );

		// initialize the votes array and timerId
		let votes = [];
		let timerId = null;

		const voteCount = () => {
			console.log('voteCount:', votes);
			clearTimeout(timerId);
			this.#io.to(livingPlayerSockets).emit("server:request", { type:"timedmessage", payload: { message:"Votes are IN", timer:3 } } );
			// Now we have to find which player has the most votes
			// votes is an array of objects with socketid of the voter and response who they voted for
			// We need to convert this into a map of socketid:total votes
			const map = votes.map( (vote) => { return vote.response } );
			const occurences = this.countOccurences(map);
			const candidates = this.getEntriesWithMaximumOccurences(occurences);
			console.log('Candidates:', candidates);
			if (candidates.length == 0) {
				this.collectVotes(livingPlayers, buttonlist);
			} else if (candidates.length > 1) {
				// There is a draw - need to do something about this
				console.log('There is a draw');
				// Need to repeat the vote - build a new buttonlist with just the candidates
				const buttonlist = candidates.map( (candidate) => { return { socketid: candidate[0], name: this.getPlayerBySocketId(candidate[0]).name } } );
				this.#io.to(this.host.socketid).emit('daydraw', candidates.map( candidate => { return candidate[0] } ));
				this.collectVotes(livingPlayers, buttonlist);
			} else {
				// We have a winner
				const dead = candidates[0][0];
				this.dayKill(dead);
				this.#io.to(livingPlayerSockets).emit("server:request", { type:"timedmessage", payload: { message:"We have a winner!", timer:3 } } );
				this.#io.to(this.host.socketid).emit('daykill', dead);
			}
		}
		const voteHandler = (socket, response) => {
			votes.push( { socketid: socket.id, response: response.socketid } );
			console.log('voteHandler:', socket.id, response, votes);
			const payload = { message: 'You voted:<br/><br/>' + response.name, timer:3 }
			this.#io.to(socket.id).emit('server:request', { type:'timedmessage', payload: payload } );
			if (votes.length == livingPlayers.length) {
				// Everyone has voted
				console.log('All votes are IN:');
				// Assuming we are done with the day phase
				this.deregisterClientResponseHandler(voteHandler);
				voteCount();
			}
		}
		this.#io.to(livingPlayerSockets).emit('server:request', { type: 'buttonselect', payload: buttonlist } );
		this.registerClientResponseHandler(voteHandler);
		timerId = setTimeout( voteCount, 5000);
		this.#io.to(this.host.socketid).emit('server:starttimer',  { duration: 5 } );
	}

	// Need a good way to match up socket events with game state to determine what to do
	// For now just fudget it until I have a better understanding of all the possibilities
	clientResponseXXX(socket, response) {

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

	processClientResponsesXXX() {
		// Map an array of socketids to an object with socketid:total votes
		const map = this.clientResponses.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
		console.log('As map:', map);
		console.log('Entries:', [...map].entries());
		// Now we have to find which player has the most votes
		// do more with this later...
	}

	countOccurences(arr) {
		return arr.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
	}
	getMaximumOccurences(map) {
		return Math.max(...map.values());
	}
	getEntriesWithMaximumOccurences(map) {
		const max = this.getMaximumOccurences(map);
		return [...map].filter(([k, v]) => v === max);
	}
	getPlayers() {
		return this.players;
	}
	removePlayer(socketid) {
		this.players = this.players.filter( (player) => player.socketid != socketid);
		this.#io.to(this.host.socketid).emit('playerdisconnect', socketid);
	}
	getPlayerBySocketId(socketid) {
		console.log(this.players.find( (player) => player.socketid == socketid ));
		return this.players.find( (player) => player.socketid === socketid )
	}

	getLivingPlayers() {
		return this.players.filter( player => player.alive )
	}
	getDeadPlayers() {
		return this.players.filter( player => !player.alive )
	}
	getLivingVillagers() {
		return this.players.filter( player => player.alive && player.role != Roles.WEREWOLF )
	}
	getPlayerWithRole(role){ 
		console.log('getLivingPlayersWithRole:', role);
		return this.players.find( player => player.role === role)
	}
	getWolves() {
		return this.players.filter( player => player.alive && player.role === Roles.WEREWOLF )
	}
	getWolfSockets() {
		const wolves = this.getWolves();
		return wolves.map( (wolf) => { return wolf.socketid } );
	}
	nightKill(socketids) {
		// socketid could be a list (technically a Set) of socketids
		socketids.forEach( (socketid) => {
			const thisPlayer = this.getPlayerBySocketId(socketid);
			if (!thisPlayer) {
				console.log('ERROR: cant find player with this socket.id:', socketid);
				return;
			}
			thisPlayer.alive = false;
			thisPlayer.killaction = Actions.NIGHT;
		})
	}
	dayKill(socketid) {
		const thisPlayer = this.getPlayerBySocketId(socketid);
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