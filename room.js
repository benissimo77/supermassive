// Models
const res = require('express/lib/response');
const { Player, Game, Phases, Roles } = require('./server/models/allModels');


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

		console.log('userJoinRoom:', userObj.name, this.host, this.id, userObj);

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

			var player = this.getPlayerBySessionId(userObj.sessionid);
			if (player) {
				console.log('player already exists:', player);
				player.disconnected = false;
				player.socketid = socket.id;
			} else {
				player = new Player(userObj);
				this.players.push(player);
			}
			
			// For now we only have host and players - maybe in future there will be other user types
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
			this.nightActionAsync();
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

	startGame() {

		console.log('Room::startGame:', this.id);

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

		console.log('Room: startGame:', numWerewolves);

		let roles = new Array(numWerewolves).fill(Roles.WEREWOLF);
		// roles.push(Roles.SEER);
		// roles.push(Roles.WITCH);
		// roles.push(Roles.HEALER);

		// Fill up the rest with villagers
		const numVillagers = this.players.length - roles.length;
		roles.push(...new Array(numVillagers).fill(Roles.VILLAGER));

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
		this.#io.to(this.host.socketid).emit('startgame', this.players);

		// Maintain a flag to indicate the game has started
		this.started = true;
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
	nightActionAsync() {
		this.currentAction = Phases.NIGHT;
		console.log('nightactionAsync:', this.id, this.getLivingVillagers());

		var wolfkill = null;
		var healersave = null;
		var witchkill = null;
		var witchsave = null;

		const doWolfAction = () => {
			console.log('doWolfAction:');
			return new Promise( (resolve, reject) => {
				this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WOLFOPEN' } );
				this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Wolves, open your eyes' } });
				this.registerHostResponseHandler( (response) => {
					const villagers = this.getLivingVillagers();
					const wolves = this.getWolves();
					this.getClientResponse(wolves, villagers, (selected) => {
						wolfkill = selected;
						this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WOLFCLOSE' } );
						this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Wolves, close your eyes' } });
						this.registerHostResponseHandler( () => {
							resolve();
						});
					});
				});
			});
		};
		const doHealerAction = () => {
			console.log('doHealerAction:');
			return new Promise( (resolve, reject) => {
				console.log('doHealerAction: inside Promise');
				const healer = this.getPlayerWithRole(Roles.HEALER);
				console.log('doHealerAction:', healer);
				if (healer && (healer.alive || healer.killphase === Phases.NIGHT)) {
					this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'HEALEROPEN' } );
					this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Healer, open your eyes' } });
					this.registerHostResponseHandler( () => {
						const buttonlist = this.getLivingPlayers();
						this.getClientResponse([healer], buttonlist, (selected) => {
							healersave = selected;
							this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'HEALERCLOSE' } );
							this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Healer, close your eyes' } });
							this.registerHostResponseHandler( () => {
								resolve();
							});
						});
					});
				} else {
					resolve();
				}
			});
		}
		const doWitchAction = () => {
			console.log('doWitchAction:');

			return new Promise( (resolve, reject) => {
				const witch = this.getPlayerWithRole(Roles.WITCH);
				if (witch && (witch.alive || witch.killphase === Phases.NIGHT)) {

					this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHOPEN' } );
					this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, open your eyes' } });
					this.registerHostResponseHandler( () => {
						doWitchKill()
						.then(doWitchSave)
						.then( () => {
							this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHCLOSE' } );
							this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, close your eyes' } });
							this.registerHostResponseHandler( () => {
								resolve();
							});
						});
					});
				} else {
					resolve();
				}

				const doWitchKill = () => {
					console.log('doWitchKill:');
					return new Promise( (resolve, reject) => {
						this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHKILL' } );
						this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, choose someone to kill' } });
						this.registerHostResponseHandler( () => {
							const livingplayers = this.getLivingPlayers();
							const buttonlist = [...livingplayers, { socketid:null, name:'NOT THIS TIME'}];
							this.getClientResponse([witch], buttonlist, (selected) => {
								witchkill = selected;
								witch.witchkill = selected;
								resolve();
							});
						});
					});
				}
				const doWitchSave = () => {
					console.log('doWitchSave:');
					return new Promise( (resolve, reject) => {
						this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'WITCHSAVE' } );
						this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Witch, choose someone to save' } });
						this.registerHostResponseHandler( () => {
							let buttonlist = [];
							if (wolfkill) {
								buttonlist.push(wolfkill);
							}
							buttonlist.push({socketid:null, name:'NOT THIS TIME'});
							if (witch.witchsave) {
								this.#io.to(witch.socketid).emit("server:request", { type:"timedmessage", payload: { message:"You've already SAVED<br/><br/>Nothing to do here", timer:3 } } );
								resolve();
							} else {
								this.getClientResponse([witch], buttonlist, (selected) => {
									witchsave = selected;
									witch.witchsave = selected;
									resolve();
								});
							}
						});
					});
				}
			});
		}

		const doSeerAction = () => {
			console.log('doSeerAction:');
			return new Promise( (resolve, reject) => {
				const seer = this.getPlayerWithRole(Roles.SEER);
				if (seer && (seer.alive || seer.killphase === Phases.NIGHT)) {
					this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'SEEROPEN' } );
					this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Seer, open your eyes' } });
					this.registerHostResponseHandler( () => {
						const buttonlist = this.getLivingPlayers();
						this.getClientResponse([seer], buttonlist, (selected) => {
							console.log('doSeerAction: selected:', selected);

							// Send message to seer with the result of their selection0
							const player = this.getPlayerBySocketId(selected.socketid);
							if (player) {
								const message = player.role === Roles.WEREWOLF || player.role === Roles.WITCH ? 'YES' : 'NO';
								this.#io.to(seer.socketid).emit('server:request', { type:'timedmessage', payload: { message: message, timer: 3 } });
							}
							this.#io.to(this.host.socketid).emit('audioplay', { type:'NARRATOR', track:'SEERCLOSE' } );
							this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'Seer, close your eyes' } });
							this.registerHostResponseHandler( () => {
								resolve();
							});
						});
					});
				}
				else {
					resolve();
				}
			});
		}

		const showResultsHost = () => {
			console.log('showResultsHost:');
			return new Promise( (resolve, reject) => {

				// Now we have all the night actions we can process them
				console.log('ALL DONE...', wolfkill, healersave, witchkill, witchsave);

				// Now we have all the night actions we can process them
				// First we need to send the results to the host - display quickly on screen before people wake up to tell story of who died in the night
				let message = '';
				if (wolfkill && this.getPlayerBySocketId(wolfkill.socketid)) {
					message = message + 'Wolves killed: ' + wolfkill.name + '<br/>';
				}
				if (witchkill && this.getPlayerBySocketId(witchkill.socketid)) {
					message = message + 'Witch killed: ' + witchkill.name + '<br/>';
				}
				if (healersave && this.getPlayerBySocketId(healersave.socketid)) {
					message = message + 'Healer chose: ' + healersave.name;
					if (healersave.socketid == wolfkill.socketid || healersave.socketid == witchkill.socketid) {
						message = message + ' (success!)<br/>';
					} else {
						message = message + ' (no effect)<br/>';
					}
				}
				if (witchsave && this.getPlayerBySocketId(witchsave.socketid)) {
					message = message + 'Witch saved: ' + witchsave.name + '<br/>';
				}
				this.#io.to(this.host.socketid).emit('server:request', { type: 'instructions', payload: { message: message } } );
				this.registerHostResponseHandler(() => { resolve(); });
			});
		}
		const showResultsAll = () => {
			console.log('showResultsAll:');
			return new Promise( (resolve, reject) => {
				this.#io.to(this.host.socketid).emit('morning');
				this.#io.to(this.host.socketid).emit('server:request', { type: 'instructions', payload: { message: 'Everyone, wake up<br/><br/>What happened?' } } );	
				this.registerHostResponseHandler( () => {

					// Now we turn the kills/saves into a final list of dead people
					let dead = new Set()
					if (wolfkill) dead.add(wolfkill.socketid);
					if (witchkill) dead.add(witchkill.socketid);
					if (healersave) dead.delete(healersave.socketid);
					if (witchsave) dead.delete(witchsave.socketid);
					console.log('Dead:', dead);
					this.nightKill(dead);
					if (dead.size > 0) {
						this.#io.to(this.host.socketid).emit('nightkill', Array.from(dead) );
					}
				});
			});
		}

		// Now we chain all the promises together
		doWolfAction()
		.then( doHealerAction )
		.then( doWitchAction )
		.then( doSeerAction )
		.then( showResultsHost )
		.then( showResultsAll )
		.then( () => {
			console.log('nightActionAsync complete');
		})
		.catch( (error) => {
			console.log('nightActionAsync error:', error);
		});

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
			
			const voteDraw = () => {
				console.log('voteDraw:', buttonlist);
				this.collectVotes(livingPlayers, buttonlist);
			}
			
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
				buttonlist = candidates.map( (candidate) => { return { socketid: candidate[0], name: this.getPlayerBySocketId(candidate[0]).name } } );
				this.#io.to(this.host.socketid).emit('daydraw', votes.map( vote => { return vote.response } ));
				this.#io.to(this.host.socketid).emit('server:request', { type:'instructions', payload: { message: 'We have a DRAW!<br/><br/>Vote again...' } });
				this.registerHostResponseHandler(voteDraw);
			} else {
				// We have a winner
				const dead = candidates[0][0];
				this.dayKill(dead);
				this.#io.to(livingPlayerSockets).emit("server:request", { type:"timedmessage", payload: { message:"The people have chosen...", timer:3 } } );
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
		timerId = setTimeout( voteCount, 10000);
		this.#io.to(this.host.socketid).emit('server:starttimer',  { duration: 10 } );
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
			thisPlayer.killphase = Phases.NIGHT;
		})
	}
	dayKill(socketid) {
		const thisPlayer = this.getPlayerBySocketId(socketid);
		if (!thisPlayer) {
			console.log('ERROR: cant find player with this socket.id:', socketid);
			return;
		}
		thisPlayer.alive = false;
		thisPlayer.killphase = Phases.DAY;
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