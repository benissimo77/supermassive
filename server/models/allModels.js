// src/allModels.js

class Player {
	constructor(obj) {
		// Socket related - socket can change during session if player disconnects/reconnects
		this.socketID = obj.socketID;
		// Session ID is assigned on entry - remains constant use this to reference player
		this.sessionID = obj.sessionID;
		// Player data
		this.name = obj.name;
		this.avatar = obj.avatar;
		this.userID = obj.userID;
		// Game data
		this.role = null;
		this.alive = true;
		this.killphase = null;
		this.sheriff = false;
		this.witchkill = false;
		this.witchsave = false;
	}
}

class Roles {
	static WEREWOLF = 'Werewolf';
	static VILLAGER = 'Villager';
	static HEALER = 'Healer';
	static WITCH = 'Witch';
	static CUPID = 'Cupid';
	static SEER = 'Seer';
	static HUNTER = 'Hunter';
	static SHERIFF = 'Sheriff';
	// Add more roles as needed
}

class Phases {
	static DAY = 'Day';
	static NIGHT = 'Night';
}

class Options {
	constructor() {
		this.MINPLAYERS = 5;
	}
}

class GameX {

	constructor(id) {
		this.id = id;
		this.room = id;
		this.host = undefined;
		this.players = [];
		this.started = false;
		this.nightActions = {};
		this.dayActions = {};
		this.minplayers = 5;
		this.currentAction = null;
	}

	addPlayer(player) {
		this.players.push(player);
	}

	removePlayer(socketid) {
		this.players = this.players.filter((player) => player.socketid !== socketid);
	}

	getPlayers() {
		return this.players;
	}

	getPlayerBySocketId(socketid) {
		return this.players.find((player) => player.socketid === socketid)
	}

	getLivingPlayers() {
		return this.players.filter((player) => {
			return (player.alive)
		}).map((player) => {
			return { socketid: player.socketid, name: player.name }
		})
	}
	getLivingVillagers() {
		return this.players.filter((player) => {
			return (player.alive & player.role != Roles.WEREWOLF)
		}).map((player) => {
			return { socketid: player.socketid, name: player.name }
		})
	}
	getWolves() {
		return this.players.filter((player) => {
			return player.role === Roles.WEREWOLF
		})
	}
	getWolfSockets() {
		const wolves = this.getWolves();
		return wolves.map((wolf) => { return wolf.socketid });
	}
	wolfKill(socketid) {
		thisPlayer = this.getPlayerBySocketId(socketid);
		if (!thisPlayer) {
			console.log('ERROR: cant find player with this socket.id:', socketid);
			return;
		}
		thisPlayer.alive = false;
		thisPlayer.killphase = Phases.NIGHT;
	}
	villagerKill(socketid) {
		thisPlayer = this.getPlayerBySocketId(socketid);
		if (!thisPlayer) {
			console.log('ERROR: cant find player with this socket.id:', socketid);
			return;
		}
		thisPlayer.alive = false;
		thisPlayer.killphase = Phases.DAY;
	}

	startGame() {

		// Validation
		if (this.players.length < this.minplayers) {
			console.log(`ERROR: This game requires at least ${this.minplayers} players`);
			return false;
		}

		// Assign roles to players (customize based on your game rules)
		const numWerewolves = 3;
		const numVillagers = this.players.length - numWerewolves;

		console.log('Game: startGame:', numWerewolves, numVillagers);

		let roles = new Array(numWerewolves).fill(Roles.WEREWOLF);
		roles.push(...new Array(numVillagers).fill(Roles.VILLAGER));

		// Shuffle roles to randomize assignments
		roles = shuffleArray(roles);

		// Assign roles to players
		this.players.forEach((player, index) => {
			player.role = roles[index];
		});

		return this.started = true;
	}

	performNightAction() {
		// Handle night actions based on player roles (customize based on your game rules)
		// For example, Werewolves might target a player to eliminate
		// Villagers might have special abilities as well

		// Example: Werewolf night action

		if (this.nightActions[playerId] === undefined) {
			this.nightActions[playerId] = { action: 'Werewolf', target: targetId };
			return { message: `You targeted ${targetId} during the night.` };
		}

		// You can add more conditions for other roles and actions

		return null;
	}

	performDayAction(playerId, targetId) {
		// Handle day actions (e.g., voting to eliminate a player)
		// Customize based on your game rules

		// Example: Day voting action
		if (this.dayActions[playerId] === undefined) {
			this.dayActions[playerId] = { action: 'Vote', target: targetId };
			return { message: `You voted to eliminate ${targetId}.` };
		}

		// You can add more conditions for other day actions

		return null;
	}

	getGameState() {
		return {
			players: this.getPlayers(),
			roles: this.roles,
			started: this.started,
		}
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

class AsyncTimer {
	constructor(ms) {
		this.ms = ms;
		this.timeoutId = null;
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.timeoutId = setTimeout(() => {
				resolve();
				this.timeoutId = null;
			}, ms);
		});
	}

	cancel() {
		if (this.timeoutId !== null) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
			this.reject(new Error('Delay canceled'));
		}
	}
}


export { Player, Roles, Phases };
