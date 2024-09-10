// Models
const { Player, Phases, Roles } = require('../models/models.werewolves.js');
const Game = require('./server.game.js');

class Werewolves extends Game {

	constructor(room) {
        console.log('Werewolves::constructor:', room);
		super(room);

		// Following lines are defined in the parent class (Game)
		// this.room = room;
        // this.players = room.players;
		// this.started = false;

		// Hardcode the name of this game - used to load the correct client-side page if a player connects after game has started
		this.name = 'werewolves';
		this.minplayers = 5;
		this.currentAction = null;
		room.clientResponseHandler = null;
		room.hostResponseHandler = null;
	}

	// Every Game must have an introduction function which allows the host to load the correct client-side page containing the DOM elements and socket events
	// This is a simple function which sends a message to the host to load the correct page
	// Once the host has loaded the page and run its own custom introduction it will send a message that it is ready to start
	introduction() {
		console.log('Werewolves::introduction:');
	}

	// checkGameRequirements
	// Every game must include a checkGameRequirements function which returns TRUE if the game can be started
	// This function should be called by the host before starting the game
	checkGameRequirements() {
		console.log('Werewolves::checkGameRequirements:');
		return this.players.length >= this.minplayers;
	}
	
	startGame() {

		console.log('Werewolves::startGame:');

		// Assign roles to players (customize based on your game rules)
		// I'm going to hardcode some logic here for now until this gets more formalised
		// Assume around 12 players
		// 1 Seer, 1 Witch, 1 Healer, 2 wolves, remaining villagers
		// If there is time try to add GHOST - can spell out a letter each night
		// Witch can resurrect ANYONE they like from the list of dead players (once)
		const numWerewolves = this.players.length > 10 ? 3 : 2;

		console.log('Werewolves: startGame:', numWerewolves);

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
			this.room.emitToPlayers(player.socketid, 'playerrole', player.role);
		})
		
		// Send full playerlist to host
		// TODO - find a better way to synchronize the player list without destroying and re-creating
		// Experimenting with a simple gamestate call which updates the host screen based on players
		// Commenting out for now during testing - gets in the way
        // this.room.emitToHosts('startgame', this.players);

		// Maintain a flag to indicate the game has started
		this.started = true;
	}

	// endGame
	// Every game must include an endGame function which is called when the game is over
	// endGame should clean up after itself, reset the background colour to darkblue and then pass back to the lobby
	endGame() {
		console.log('Werewolves::endGame: clean up here...');

		// Not much to do here - we rely on room.js for all the heavy-lifting, game itself is pretty lightweight
		// Maybe save results to a DB here?
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
				this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'WOLFOPEN' } );
				this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Wolves, open your eyes' } });
				this.room.registerHostResponseHandler( (response) => {
					const villagers = this.getLivingVillagers();
					const wolves = this.getWolves();
					this.getClientResponse(wolves, villagers, (selected) => {
						wolfkill = selected;
						this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'WOLFCLOSE' } );
						this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Wolves, close your eyes' } });
						this.room.registerHostResponseHandler( () => {
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
					this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'HEALEROPEN' } );
					this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Healer, open your eyes' } });
					this.room.registerHostResponseHandler( () => {
						const buttonlist = this.getLivingPlayers();
						this.getClientResponse([healer], buttonlist, (selected) => {
							healersave = selected;
							this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'HEALERCLOSE' } );
							this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Healer, close your eyes' } });
							this.room.registerHostResponseHandler( () => {
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

					this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'WITCHOPEN' } );
					this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Witch, open your eyes' } });
					this.room.registerHostResponseHandler( () => {
						doWitchKill()
						.then(doWitchSave)
						.then( () => {
							this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'WITCHCLOSE' } );
							this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Witch, close your eyes' } });
							this.room.registerHostResponseHandler( () => {
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
						this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'WITCHKILL' } );
						this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Witch, choose someone to kill' } });
						this.room.registerHostResponseHandler( () => {
							const livingplayers = this.getLivingPlayers();
							const buttonlist = [...livingplayers, { socketid:null, name:'NOT THIS TIME'}];
							if (witch.witchkill) {
								this.room.emitToPlayers(witch.socketid, 'server:request', { type:"timedmessage", payload: { message:"You've already SAVED<br/><br/>Nothing to do here", timer:3 } } );
								resolve();
							} else {
								this.getClientResponse([witch], buttonlist, (selected) => {
									witchkill = selected;
									witch.witchkill = selected;
									resolve();
								})
							}
						})
					})
				}
				const doWitchSave = () => {
					console.log('doWitchSave:');
					return new Promise( (resolve, reject) => {
						this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'WITCHSAVE' } );
						this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Witch, choose someone to save' } });
						this.room.registerHostResponseHandler( () => {
							let buttonlist = [];
							if (wolfkill) {
								buttonlist.push(wolfkill);
							}
							buttonlist.push({socketid:null, name:'NOT THIS TIME'});
							if (witch.witchsave) {
								this.room.emitToPlayers(witch.socketid, 'server:request', { type:"timedmessage", payload: { message:"You've already SAVED<br/><br/>Nothing to do here", timer:3 } } );
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
					this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'SEEROPEN' } );
					this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Seer, open your eyes' } });
					this.room.registerHostResponseHandler( () => {
						const buttonlist = this.getLivingPlayers();
						this.getClientResponse([seer], buttonlist, (selected) => {
							console.log('doSeerAction: selected:', selected);

							// Send message to seer with the result of their selection0
							const player = this.getPlayerBySocketId(selected.socketid);
							if (player) {
								const message = player.role === Roles.WEREWOLF || player.role === Roles.WITCH ? 'YES' : 'NO';
								this.room.emitToPlayers(seer.socketid, 'server:request', { type:'timedmessage', payload: { message: message, timer: 3 } });
							}
							this.room.emitToHosts('audioplay', { type:'NARRATOR', track:'SEERCLOSE' } );
							this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'Seer, close your eyes' } });
							this.room.registerHostResponseHandler( () => {
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
				this.room.emitToHosts('server:request', { type: 'instructions', payload: { message: message } } );
				this.room.registerHostResponseHandler(() => { resolve(); });
			});
		}
		const showResultsAll = () => {
			console.log('showResultsAll:');
			return new Promise( (resolve, reject) => {
				this.room.emitToHosts('morning');
				this.room.emitToHosts('server:request', { type: 'instructions', payload: { message: 'Everyone, wake up<br/><br/>What happened?' } } );	
				this.room.registerHostResponseHandler( () => {

					// Now we turn the kills/saves into a final list of dead people
					let dead = new Set()
					if (wolfkill) dead.add(wolfkill.socketid);
					if (witchkill) dead.add(witchkill.socketid);
					if (healersave) dead.delete(healersave.socketid);
					if (witchsave) dead.delete(witchsave.socketid);
					console.log('Dead:', dead);
					this.nightKill(dead);
					if (dead.size > 0) {
						this.room.emitToHosts('nightkill', Array.from(dead) );
					}
					resolve();
				})
			})
		}

		// Now we chain all the promises together
		doWolfAction()
		.then( doHealerAction )
		.then( doWitchAction )
		.then( doSeerAction )
		.then( showResultsHost )
		.then( showResultsAll )
		.then( () => {
			this.room.deregisterHostResponseHandler();
			console.log('nightActionAsync complete');
		})
		.catch( (error) => {
			this.room.deregisterHostResponseHandler();
			console.log('nightActionAsync error:', error);
		})

	}

	// getClientResponse
	// This function is used to collect a response from a client or clients (in the event of multiple clients eg wolves)
	// It will send a request to the client(s) to select a button from a list of buttons
	// It will then wait for the response and store it in a local variable
	// It will inform all clients of the selection (one wolf makes a vote all wolves see the result)
	// It will then call the callback function with the response
	getClientResponse(socketlist, buttonlist, callback) {

		console.log('getClientResponse:', callback);

		const responseHandler = (socket, response) => {
			console.log('responseHandler:', socket.id, response);
			// Immediately send a response back to the relevant for confirmation (also has benefit of removing buttons so they can't vote again)
			this.room.deregisterClientResponseHandler();
			callback(response);
		}

		if (socketlist.length > 0 && buttonlist.length > 0) {

			// socketlist is an array of players objects, but it needs to just be the socketids and nothing else
			socketlist = socketlist.map( (socket) => { return socket.socketid } );
			// buttonlist is an array of players objects, but it needs to just be the socketids and names
			buttonlist = buttonlist.map( button => { return { socketid: button.socketid, name: button.name } } );
			this.room.registerClientResponseHandler(responseHandler);
			this.room.emitToPlayers(socketlist, 'server:request', { type:'buttonselect', payload: buttonlist } );
		} else {
			callback(null);
		}
	}

	dayAction() {

		// dayAction can have a choice of different ways to collect votes
		// eg FirstPastThePost, MalignDictator, DemocracyRules etc
		// These can be selected by the host or by the game rules - each will have their own entry point
		// Once I've built a few there might be ways to generalise the code to make it more flexible
		// For now I'm just going to hardcode a simple system: WeNeedAWinner

		// These two lines WORK 
		// const livingPlayers = this.getLivingPlayers();
		// this.collectVotes(livingPlayers, livingPlayers);

		// How about these two?
        // We know that weNeedAWinner works fine... try using the more generic room-based function
		// this.weNeedAWinner();

		// ...and the players voting will always be constant, so define here and use throughout (same with voterSockets)
		const voterList = this.getLivingPlayers();
        const candidateList = voterList.map( (player) => { return { socketid: player.socketid, name: player.name } } );

		// Since its possible that we have more than one vote (in the event of a draw) we call a separate function which can be called recursively
        this.dayVote(voterList, candidateList);
	}

    dayVote(voterList, candidateList) {
        const timeoutSeconds = 10;
        const socketlist = voterList.map( (player) => { return player.socketid } );
        const buttonlist = candidateList.map( (candidate) => { return { socketid: candidate.socketid, name: candidate.name } } );
        
		// everyoneGetsAVote
		// A strategy function, called on each client response, to check if all clients have responded
		const everyoneGetsAVote = (responses) => {
			console.log('everyoneGetsAVote:', Object.keys(responses).length);
			return (Object.keys(responses).length == voterList.length)
		}
		// malignDictator
		// Strategy function, will always return true since as soon as we have a result (sent from dictator) then we are done
		const malignDictator = (responses) => {
			console.log('malignDictator:', Object.keys(responses).length);
			return (true)
		}

		const processVotes = (votes) => {
			console.log('processVotes:', votes);
			this.room.emitToPlayers(socketlist, 'server:request', { type:"timedmessage", payload: { message:"Votes are IN", timer:3 } } );
			this.room.emitToHosts('server:dayvoteresult', { candidates: candidateList, votes: votes }, true )
			.then( () => {
				const candidates = this.getPlayersWithMostVotes(votes);
				if (candidates.length == 0) {
					this.dayVote(voterList, candidateList);
				} else if (candidates.length > 1) {
					// There is a draw - call votingStart again with just the candidates
					const newCandidateList = candidates.map( (candidate) => { return this.getPlayerBySocketId(candidate[0]) } );
					this.room.emitToHosts('server:request', { type:'instructions', payload: { message: 'We have a DRAW!<br/><br/>Vote again...' } }, true)
					.then( this.dayVote(voterList, newCandidateList) );
				}
				else {
					// We have a winner
					const dead = candidates[0][0];
					console.log('Winner:', dead);
					this.dayKill(dead);
					this.room.emitToHosts('daykill', dead);
				}
			})
		}
		const strategy = {
			endCondition: malignDictator,
			callback: processVotes,
			timeoutSeconds: timeoutSeconds
		}
		this.room.emitToHosts('server:dayvotestart', { voters: voterList, candidates: candidateList } );
		this.room.getClientResponses(socketlist, buttonlist, strategy)
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
	getPlayersWithMostVotes(votes) {
		const map = Object.values(votes);
		const occurences = this.countOccurences(map);
		const max = this.getMaximumOccurences(occurences);
		return [...occurences].filter(([k, v]) => v === max);
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
			this.room.emitToHosts('playerdisconnect', socketid);
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

module.exports = Werewolves;