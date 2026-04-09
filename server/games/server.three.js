import Game from './server.game.js';
import QuizModel from '../models/mongo.quiz.js';
import { response } from 'express';

/**
 * Three For All - Server Logic
 * Manages a 6x6 grid of icons and tracks player collections.
 */

const ThreeState = {
    INIT: 'INIT',
    LOBBY: 'LOBBY',
    QUIZ_QUESTION: 'QUIZQUESTION',
	COLLECT_ANSWERS: 'COLLECTANSWERS',
    QUIZ_ANSWER: 'QUIZANSWER',
    TEAM_BATTLE: 'TEAMBATTLE',
    TILE_SELECTION: 'TILESELECTION',
    TURN_EVALUATE: 'TURNEVALUATE',
	JOKER: 'JOKER',
	JOKER_EVALUATE: 'JOKEREVALUATE',
    GAME_OVER: 'GAMEOVER'
};
const BattleMode = {
	OPEN: 'open',
	BATTLE: 'battle'
}

/**
 * The TileDirector manages the "Position-Pointer" Grid.
 * It decides which icon type should be at a specific position.
 * 
 * Rules:
 * 1. 5 of each icon (6 types = 30 tiles)
 * 2. 6 Jokers (special tiles that mess with gameplay)
 * 3. Total 36 tiles.
 */
class TileDirector {
    constructor() {
        // Source of truth for remaining tiles
        this.remaining = {
            'icon_1': 5, 'icon_2': 5, 'icon_3': 5,
            'icon_4': 5, 'icon_5': 5, 'icon_6': 5,
            'joker': 6
        };

        this.rules = [
            this.ruleJoker_SlowDownLeaders,
			this.ruleJoker_MaximumOnePerTurn
        ];
    }

    /**
     * Decides WHAT is behind tile index 'pos'.
     * @param {number} pos - The grid index being revealed (0-35)
     * @param {Object} context - { grid, playerHands, battleTiles, activeSID, opponentSID, battleTeams }
     */
    decideTileAt(pos, context) {
        // If it's already revealed, return the existing type
        if (context.grid[pos]) return context.grid[pos];

        // 1. Initial weights based on actual remaining counts
        let weights = {};
        Object.keys(this.remaining).forEach(type => {
            weights[type] = this.remaining[type]; 
        });

        // 2. Apply influence rules
        const influences = [];
        this.rules.forEach(rule => {
            const influence = rule.call(this, weights, pos, context);
            if (influence) influences.push(influence);
        });

        // 3. Choice
        // Safe exposure of final weights strictly for the test runner to inspect
        this.lastWeights = { ...weights };
        const selectedType = this.weightedPick(weights);
        if (selectedType) {
            this.remaining[selectedType]--;
        }

        console.log(`Director:: Revealed Index [${pos}] as [${selectedType}] (${this.remaining[selectedType]} left)`);
        influences.forEach(inf => console.log(` - ${inf}`));

        return selectedType;
    }

    weightedPick(weights) {
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        if (totalWeight <= 0) {
            // Emergency fallback to anything with > 0
            return Object.keys(this.remaining).find(k => this.remaining[k] > 0);
        }

        // Shuffle the keys before picking to prevent order-bias if weights are identical 
        // (Math.random is theoretically non-deterministic, but shuffling adds a safety layer)
        const types = shuffleArray(Object.keys(weights));

        let random = Math.random() * totalWeight;
        for (const type of types) {
            if (random < weights[type]) return type;
            random -= weights[type];
        }
        return null;
    }

    /**
     * Decisions around WHAT TYPE of Joker a player receives.
     * @param {string} playerSID - The side revealing the joker
     * @param {Object} context - Game state context { playerHands, battleTeams, ... }
     * @returns {string} - The joker type selected
     */
    selectJokerType(playerSID, context) {
        const { playerHands, battleTeams } = context;

        // Base weights for each joker type
        let weights = {
            steal: 20,
            swap: 10,
            plus2: 15,
            freeze: 15,
            shield: 10,
            bank: 5
        };

        // Condition checks
        const myHand = playerHands.get(playerSID);
        const myTileCount = myHand ? myHand.size : 0;

        // Calculate other team tiles (for Steal logic)
        let otherTilesFound = false;
        if (battleTeams) {
            battleTeams.forEach(sid => {
                if (sid !== playerSID) {
                    const otherHand = playerHands.get(sid);
                    if (otherHand && otherHand.size > 0) {
                        otherTilesFound = true;
                    }
                }
            });
        } else {
            // Backup if battleTeams isn't passed in context, check all other players
            playerHands.forEach((hand, sid) => {
                if (sid !== playerSID && hand && hand.size > 0) {
                    otherTilesFound = true;
                }
            });
        }

        // --- FILTERING RULES ---

        // 1. Don't choose STEAL if no other players have any tiles
        if (!otherTilesFound) {
            delete weights['steal'];
        }

        // 2. Don't choose SHIELD, BANK, or SWAP if the player has no tiles 
        if (myTileCount === 0) {
            delete weights['shield'];
            delete weights['bank'];
            delete weights['swap'];
        }

        // 3. Fallback weighted pick based on what survived the filters
        // If everything was somehow deleted (e.g. invalid setup), default to plus2
        const selectedJoker = this.weightedPick(weights) || 'plus2';
        this.lastWeights = { ...weights };
		
        console.log(`Director:: Joker selected [${selectedJoker}] for player [${playerSID}] with context: MyTiles=${myTileCount}, OthersHaveTiles=${otherTilesFound}`);

		// TODO remove the fixed joker type
		return 'steal';
        return selectedJoker;
    }

	getJokerRules(jokerType) {

		switch (jokerType) {

			case 'steal':
				return [
					"Select a team and a tile",
					"If the selected team currenty possesses that tile you STEAL it!",
					"If they don't posses that tile... you get nothing",
					"Stolen tiles cannot be stolen from you during this battle"
				];

			case 'swap':
				return [
					"Swap: Exchange one of your tiles with an opponent's tile. A risky move!"
				];

			case 'plus2':
				return [
					"Plus 2: Reveal two additional tiles immediately. More chances, more risks!"
				];
		}
	}

    // --- RULES ---

    ruleTension_FavorVulnerableSteals(weights, pos, context) {
        const { grid, playerHands, battleTiles, activeSID, battleTeams } = context;
        if (!battleTeams || battleTeams.length < 2) return;

        const opponentSID = battleTeams.find(id => id !== activeSID);
        const opponentHand = playerHands.get(opponentSID);
        if (!opponentHand || opponentHand.size === 0) return;

        // Iterate through vulnerable indices (the ones revealed THIS battle)
        // and check if they exist in the opponent's Set.
        let boosted = false;
        battleTiles.forEach(p => {
            if (opponentHand.has(p)) {
                const type = grid[p];
                // CRITICAL: Only boost if the type is a standard icon, NOT a joker
                if (type && type !== 'joker' && weights[type] !== undefined) {
                    weights[type] *= 2;
                    boosted = true;
                }
            }
        });

        if (boosted) return `Tension: Boosted weights for vulnerable tiles owned by ${opponentSID}`;
    }

    /**
     * Joker Pressure: If a team is close to winning (2 tiles), slightly increase Joker chance
     * to add chaos to the finish line.
     */
    ruleJoker_SlowDownLeaders(weights, pos, context) {
        const { playerHands, activeSID } = context;
        const myHand = playerHands.get(activeSID);
        const myCount = myHand ? myHand.size : 0;
        
        if (myCount >= 2 && weights['joker'] > 0) {
            weights['joker'] *= 1.5;
            return "Joker: Leader pressure applied";
        }
    }

	ruleJoker_MaximumOnePerTurn(weights, pos, context) {
		const { turnReveals } = context;
		if (turnReveals && turnReveals.some(r => r.icon === 'joker')) {
			weights['joker'] = 0;
			return "Joker: Max one per turn";
		}
	}
}

class ThreeStateMachine {
    constructor(game) {
        this.game = game;
        this.state = ThreeState.INIT;
    }

    start() {
        this.transitionTo(ThreeState.LOBBY);
    }

    nextState() {
        switch (this.state) {
            case ThreeState.INIT:
                this.transitionTo(ThreeState.LOBBY);
                break;

			case ThreeState.LOBBY:
				this.transitionTo(ThreeState.QUIZ_QUESTION);
				break;

			case ThreeState.QUIZ_QUESTION:
				this.transitionTo(ThreeState.COLLECT_ANSWERS);
				break;

				// COLLECT_ANSWERS used by questions in OPEN or in BATTLE mode - so need to check where we are...
			case ThreeState.COLLECT_ANSWERS:
				this.game.endQuestion();
				this.transitionTo(ThreeState.QUIZ_ANSWER);
				break;

			case ThreeState.QUIZ_ANSWER:
				if (this.game.battleMode === BattleMode.OPEN) {
					this.transitionTo(ThreeState.TEAM_BATTLE);
				} else {
					this.transitionTo(ThreeState.TILE_SELECTION);
				}
				break;

			case ThreeState.TEAM_BATTLE:
				this.transitionTo(ThreeState.QUIZ_QUESTION);
				break;

			case ThreeState.TILE_SELECTION:
				this.transitionTo(ThreeState.TURN_EVALUATE);
				break;

			case ThreeState.TURN_EVALUATE:
				console.log('ThreeStateMachine:: nextState(): current state: TURN_EVALUATE - evaluating turn results');
				if (this.game.checkJoker()) {
					console.log('JOKER played');
					this.transitionTo(ThreeState.JOKER);
				} else {
					if (this.game.checkBattleOver()) {
						console.log('checkBattleOver: true');
						if (this.game.checkWinner()) {
							console.log('checkWinner: true');
							this.transitionTo(ThreeState.GAME_OVER);
						} else {
							console.log('CheckBattleOver: false');
							this.game.endBattle();
							this.transitionTo(ThreeState.QUIZ_QUESTION);
						}
					} else {
						console.log('CheckBattleOver: false');
						// Loop back to next battle question — shows players back in their slots, then a new battle question follows
						this.transitionTo(ThreeState.QUIZ_QUESTION);
					}
				}
				break;

			case ThreeState.JOKER:
				this.transitionTo(ThreeState.JOKER_EVALUATE);
				break;

			case ThreeState.JOKER_EVALUATE:
				console.log('ThreeStateMachine:: nextState(): current state: JOKER_EVALUATE - evaluating joker results', this.game.battleContext);
				// Once the result animation has played out, loop back to resolving the original turn state 
				// (Checking if they won via steal, or returning to normal selection)
				if (this.game.checkBattleOver()) {
					if (this.game.checkWinner()) {
						this.transitionTo(ThreeState.GAME_OVER);
					} else {
						this.game.endBattle();
						this.transitionTo(ThreeState.QUIZ_QUESTION);
					}
				} else {
					// Loop back to next battle question — shows players back in their slots, then a new battle question follows
					this.transitionTo(ThreeState.QUIZ_QUESTION);
				}
				break;
        }
    }

	previousState() {
		switch (this.state) {
			case ThreeState.LOBBY:
				this.transitionTo(ThreeState.INIT);
				break;
			// Additional backward transitions can be added here
		}
	}

		// Beware that the name of the state in the above ENUM is used to construct an event name by lowercasing it!
    transitionTo(newState, data = {}) {
        console.log(`ThreeStateMachine:: Transitioning from ${this.state} to ${newState}`);

		// We always want to deregister any existing handlers - maybe we moved on before the response had a chance to clear it away
		this.game.room.deregisterHostResponseHandler();
		this.game.room.deregisterClientResponseHandler();

		this.stateTeardown(this.state);
        this.state = newState;
		this.stateSetup(newState, data);

	}

	stateTeardown(state) {

		switch (state) {

			case ThreeState.TILE_SELECTION:
				// Remove response handlers related to tile selection
				this.game.room.deregisterClientResponseHandler();
				break;
		}

	}
	stateSetup(newState, data) {

		switch (newState) {

			case ThreeState.QUIZ_QUESTION:
				let response;
				if (this.game.battleMode === BattleMode.OPEN) {
					response = this.game.moveToNextOpenQuestion();
				 } else {
					response = this.game.moveToNextBattleQuestion();
				 }
				 if (response) {
						console.log('Moved to next question:: battleMode:', this.game.battleMode, 'roundNumber:', this.game.roundNumber, 'questionNumber:', this.game.questionNumber);
						this.game.doQuestion();
				} else {
					this.transitionTo(ThreeState.GAME_OVER);
				}
				return;

			case ThreeState.COLLECT_ANSWERS:
				this.game.collectAnswers();
				return;
			
			case ThreeState.QUIZ_ANSWER:
				this.game.showAnswer();
				return;

			case ThreeState.TEAM_BATTLE:
				this.game.doTeamBattle(data);
				return;

			case ThreeState.TILE_SELECTION:
				console.log('TransitionTo: TILE_SELECTION - waiting for host to select tile...');
				this.game.doTileSelection(data);
				return;

			case ThreeState.TURN_EVALUATE:
				console.log('TransitionTo: TURN_EVALUATE - evaluating turn...');
				this.game.doTurnEvaluate(data);
				return;

			case ThreeState.JOKER:
				console.log('TransitionTo: JOKER - waiting for player jokeraction...');
				this.game.doJoker();
				// Note: doJoker handles its own targeted emissions using Select UI modes so we just return
				return;

			case ThreeState.JOKER_EVALUATE:
				console.log('TransitionTo: JOKER_EVALUATE - animating result...');
				this.game.doJokerEvaluate();
				return;
		}

		// For now just send the state name to host - might be enough for now...
		console.log(`ThreeStateMachine:: DEFAULT ACTION - emitting state to host:`, newState, data);
        this.game.room.emitToHosts(`server:state:${newState.toLowerCase()}`, data);
    }


}

export default class ThreeGame extends Game {

    constructor(room) {
        super(room);

        this.name = 'three';
        this.displayName = 'Three For All';
        
		// Modes the game can be in
		// mode: ASK or ANSWER - used to determine if we are asking question or answering it
		// battleMode: OPEN or BATTLE - used to determine if we are asking all teams or just the battle teams
        this.mode = "ask";
		this.battleMode = BattleMode.OPEN;
        this.battleContext = null;
        this.grid = Array(36).fill(null); // positions 0-35
        this.playerHands = new Map(); // sessionID -> Set[pos]
        this.battles = [];

		// Using roundNumber and questionNumber since they were used by the quiz and so somewhat tested
		// Slightly different definition: roundNumber total number of rounds therefore index into first 'round' of questions (the round questions)
		// questionNumber the total number of battles therefore the index into the second 'round' of questions (the battle questions)
		this.roundNumber = 0;
		this.questionNumber = 0;

        this.stateMachine = new ThreeStateMachine(this);
        this.director = new TileDirector();

		// Catch host keypresses
		this.room.registerHostKeypressHandler(this.keypressHandler.bind(this));

		console.log("Three:: constructor completed - game loaded:", this.name, this.room.id);
    }

	// Every game must include a checkGameRequirements function which returns TRUE if the game can be started
	// This function should be called by the host before starting the game
	checkGameRequirements() {
		console.log('Quiz::checkGameRequirements:', this.players.length, this.minplayers);
		return true;
	}

	async init(config) {
		console.log('Three::init:', config);
		this.started = false;
		this.startTime = null;
		this.liveStream = false; // whether we are in live stream mode or not (affects state machine - need to account for latency of the stream)

		// Config should pass a quiz ID to select the quiz to load
        // We can use similar here when we learn what is needed at this point...
		// Config should pass a quiz ID to select the quiz to load
		// We load the quiz from DB using the passed ID (see api.quiz.js)
		if (config && config.quizID) {
			try {
				const thisQuizData = await QuizModel.getQuizByID(config.quizID);
				if (thisQuizData) {
					this.quizData = thisQuizData;
					console.log('Quiz::init: loaded quiz data:', this.quizData.title);
				}
			} catch (error) {
				console.error('Quiz::init: error loading quiz data for ID:', config.quizID, error);
			}
		}

		// Return metadata for the "Lobby Phase"
		return {
			title: this.quizData?.title || 'Untitled Quiz',
			description: this.quizData?.description || '',
			quizMap: this.quizData?.rounds?.map( (round) => ({
				title: round.title,
				questionCount: round.questions.length,
				showAnswer: round.showAnswer,
				updateScores: round.updateScores
			})) || []
		};

		// Return metadata for the "Lobby Phase"
		// return {
		// 	title: this.quizData?.title || 'Untitled Quiz',
		// 	description: this.quizData?.description || '',
		// 	quizMap: this.quizData?.rounds?.map((round) => ({
		// 		title: round.title,
		// 		questionCount: round.questions.length,
		// 		showAnswer: round.showAnswer,
		// 		updateScores: round.updateScores
		// 	})) || []
		// };
	}

	// startGame is a required function for a class that extends Game
	// Called by room when it receives a host:requeststart from the host - this is the entry point to the game
	// Update: store a flag when started so that if host refreshes we can resume the game
	async startGame() {
		// Game start logic for game 1
		console.log('Three: startGame:', this.players, this.started);

		if (this.started) {
			console.log('Three::startGame: game already started, resuming...');
			// Resend intro quiz data so host can rebuild the quiz map
			// this.introQuiz();
		}
		this.startTime = new Date();

		// Initialize player scores to 0
		this.players.forEach(player => {
			player.score = 0;
		});

		// For now, just start the state machine
		this.stateMachine.start();

	}

	// endGame is a required function for a class that extends Game
	endGame() {
		console.log('Three::endGame: clean up here...');

		// Not much to do here - we rely on room.js for all the heavy-lifting, game itself is pretty lightweight
	}

	isEnded() {
		// return this.stateMachine.state === QuizState.CLOSING_CREDITS;
	}

	/**
	 * Determines if the existing game instance can be considered the same as the one requested.
	 * Used for refresh-resume logic in room.js.
	 */
	isSameGame(config) {
		if (!config || !config.quizID) return true;
		// if (!this.quizData || !this.quizData._id) return false;
		return String(config.quizID) === String(this.quizData._id);
	}

    start() {
        console.log('ThreeGame::start in room', this.room.id);
        this.room.emitToHosts('server:loadgame', 'three');
        this.room.emitToPlayers('server:loadgame', 'three');
    }

	fastForward() {

		console.log('ThreeGame::fastForward - stepping through states quickly for testing...');

		// Step through the entire game flow - check all states setup and teardown correctly
		this.stateMachine.nextState(); // LOBBY
		this.stateMachine.nextState(); // QUIZ_QUESTION
		this.stateMachine.nextState(); // COLLECT_ANSWERS
		// this.stateMachine.nextState(); // QUIZ_ANSWER
		
		// DEVELOPMENT - jump straight to tile selection
		// this.battleContext = {};
		console.log('Battle Context after quizAnswer:', this.battleMode, this.battleContext);

		// call the teamBattle function to set up the host screen
		this.stateMachine.transitionTo(ThreeState.TEAM_BATTLE, { teams: ['1', '2'] });
		console.log('Returned from setting TEAM_BATTTLE. Battle Context:', this.battleContext);

		this.stateMachine.transitionTo(ThreeState.TILE_SELECTION, { scores: { '1': 1, '2': 1 } });
		console.log('Returned from setting TILE_SELECTION. Battle Context:', this.battleContext);

		this.stateMachine.transitionTo(ThreeState.TURN_EVALUATE,
			{
				selections: {
					'1': { tiles: [0] },
					'2': { tiles: [1] }
				}
			}
		);

		// DEVELOPMENT - jump straight to joke reveal
		let reveals = [
			{ pos: 10, icon: 'joker', playerSID: '2' },
		];
		this.battleContext.activeTurn.reveals = reveals;
		this.stateMachine.transitionTo(ThreeState.JOKER);

	}


	moveToNextOpenQuestion() {
		const round = this.quizData.rounds[0];
		if (this.questionNumber < round.questions.length) {
			this.questionNumber++;
			return true;
		}
		return false;
	}

	moveToNextBattleQuestion() {
		const round = this.quizData.rounds[1];
		if (this.roundNumber < round.questions.length) {
			this.roundNumber++;
			return true;
		}
		return false;
	}

	// keyPressHandler
	// Recieves keypresses from the host and acts
	keypressHandler(socket, keyObject) {

		console.log('Three::keypressHandler:', keyObject);

		// If right or left arrow then step forward or back in the game
		// If SHIFT also pressed then jump to next/previous round
		if (keyObject.key == 'ArrowRight') {
			if (keyObject.shiftKey) {
				// this.stateMachine.fastForward();
				// this.stateMachine.nextState();
				this.fastForward();
			} else {
				this.stateMachine.nextState();
			}
		}
		if (keyObject.key == 'ArrowLeft') {
			if (keyObject.shiftKey) {
				// this.stateMachine.fastBackward();
				 this.stateMachine.previousState();
			} else {
				this.stateMachine.previousState();
			}
		}
		if (keyObject.key == 'KeyS') {
			this.liveStream = !this.liveStream;
			console.log('Stream mode:', this.liveStream);
			this.room.emitToHosts('server:streammode', { enabled: this.liveStream });
		}

		// If up or down arrow then it could be to change the team order in team battle
		 if (keyObject.key == 'ArrowUp' || keyObject.key == 'ArrowDown') {
			if (this.stateMachine.state === ThreeState.TEAM_BATTLE || 1) {
				if (!this.battleContext || this.battleContext.teams.length < 2) {
					console.warn('Not enough teams to switch!');
					this.battleContext = { teams: ['1', '2'], tiles: new Set() }; // For testing - in real game we would want to handle this more gracefully
					return;
				}
				// For simplicity, we just toggle the teams here - in a real game we would want more control
				// We pass a copy of the reversed array inside a data object, adhering to the override pattern
				const reversedTeams = [...this.battleContext.teams].reverse();
				this.doTeamBattle({ teams: reversedTeams });
			}
		}
		console.log('keypressHandler: completed');
	}

	// prepareMutatedQuestion
	// Copied directly from quiz
	prepareMutatedQuestion(question) {

		// If we've already prepared this question (eg by going back/forward) then don't do it again
		if (question.optionsShuffled || question.pairsShuffled || question.itemsShuffled) {
			return;
		}

		let localQuestion = structuredClone(question);

		// When asking question we might need to adjust the correct answer based on the question type
		// Try overwriting the actual quizData with the modified question/answers data
		// Now I can actually pass the entire question object directly to the client (do later it works right now)
		switch (localQuestion.type) {

			case 'multiple-choice':
				question.answer = localQuestion.options[0];
				question.optionsShuffled = shuffleArray(localQuestion.options);
				break;

			case 'matching':
				var left = localQuestion.pairs.map((pair) => pair.left);
				question.answer = [...left];
				var shuffledLeft = shuffleArray(left);
				localQuestion.pairs.forEach((pair, index) => { pair.left = shuffledLeft[index] });
				console.log('Matching:', question.answer, localQuestion.pairs);
				question.pairsShuffled = localQuestion.pairs;
				break;

			case 'ordering':
				question.answer = [...localQuestion.items];
				localQuestion.items = shuffleArray(localQuestion.items);
				question.itemsShuffled = localQuestion.items;
				break;

			default:
				// all other question types the answer field is used
				break;
		}

	}


	// doQuestion
	// Copied directly from quiz game and then modified - hopefully not by much
	// We are using round 0 to store the number-closest questions and round 1 the ordering questions
	// So we do need question number as a pointer into the quiz data
	// In fact we need a round number - which round in the entire game we are in, so we can look up in round[0].roundNumber for the number-closest question
	doQuestion() {

		// this.question holds a pointer into the master quizData to allow mutating for storing player responses and scores
		if (this.battleMode === BattleMode.OPEN) {
			this.question = this.quizData.rounds[0].questions[this.questionNumber - 1];
			this.question.questionNumber = this.questionNumber;
		} else {
			this.question = this.quizData.rounds[1].questions[this.roundNumber - 1];
			this.question.questionNumber = 100 + this.roundNumber;
		}

		console.log('doQuestion:', this.battleMode, this.question);

		// Prepare the question by mutating answer options
		// Function also sets up the question.answer since sometimes the answer is derived from the question data (eg first item in options array)
		this.prepareMutatedQuestion(this.question);

		let hostQuestion = structuredClone(this.question);
		hostQuestion.mode = "ask";
		hostQuestion.battleMode = this.battleMode;
		hostQuestion.direction = this.stateMachine.direction;
		hostQuestion.roundNumber = this.roundNumber;
		hostQuestion.optionsShuffled = this.question.optionsShuffled;
		hostQuestion.itemsShuffled = this.question.itemsShuffled;
		hostQuestion.pairsShuffled = this.question.pairsShuffled;

		// This is an exception where we want to automatically move to next state without waiting for host
		// WHY? Because after asking a question we know we instantly want to either collect answers or show the answer

		// UPDATE: experiment with collecting answers immediately rather than waiting for host response
		// WHY? Because there is often quite a delay in sending the answers so just get on with it
		// this.room.registerHostResponseHandler(() => {
		// 	this.room.deregisterHostResponseHandler();
		// 	this.stateMachine.nextState();
		// });

		// Add timestamp before sending
		const questionSentTime = Date.now();
		const callback = ((acknowledgement) => {
			const roundTripTime = Date.now() - questionSentTime;
			console.log('Host acknowledged question display:', acknowledgement, 'RTT (ms):', roundTripTime);
		}).bind(this);

		this.room.emitToHosts('server:state:question', hostQuestion);

		// In cases where we are live streaming we DON'T want to move to the next state automatically
		// So only do this if we are NOT live streaming
		// OR when answering the question - even live streaming we can still show the answer straight away
		if (!this.liveStream || this.mode === 'answer') {
			this.room.registerHostResponseHandler(() => {
				this.room.deregisterHostResponseHandler();
				this.stateMachine.nextState();
			});
		}
	}

	collectAnswers() {

		// Prepare a question object holding only the data needed for the players
		// IMPORTANT: don't initialise this otherwise we can't go back and re-visit questions
		if (!this.question.responses) {
			this.question.responses = {};
		}

		// Prepare a local copy of the question for sending to players
		// Note: could use the StructuredClone method above but for players its easier to build from scratch
		// Though I'm not sure about that now - looks like quite a lot of code duplication
		let playerQuestion = {}
		playerQuestion.mode = 'ask';
		playerQuestion.direction = this.stateMachine.direction;
		playerQuestion.questionNumber = this.question.questionNumber;
		playerQuestion.type = this.question.type;
		playerQuestion.optionsShuffled = this.question.optionsShuffled;
		playerQuestion.itemsShuffled = this.question.itemsShuffled;
		playerQuestion.pairsShuffled = this.question.pairsShuffled;
		playerQuestion.extra = this.question.extra;
		// Include the image if it is required for the answer (hotspot, point-it-out)
		if (playerQuestion.type == 'hotspot' || playerQuestion.type == 'point-it-out') {
			playerQuestion.image = this.question.image;
		}

		console.log('collectAnwers:', this.question, playerQuestion);
		const responseHandler = (socket, response) => {
			console.log('quiz.responseHandler:', socket.id, response);
			const player = this.room.getPlayerBySocketID(socket.id);
			if (player) {
				this.question.responses[player.sessionID] = {
					answer: response.answer,
					time: response.answerTime,
					score: 0 // Initialized, will be calculated later
				};
				this.room.emitToHosts('server:questionanswered', { sessionID: player.sessionID, response: response });
			}
			console.log('quiz.responseHandler:', this.question);
		}
		const strategy = {
			responseHandler: responseHandler,
			timeoutSeconds: 10
		}
		this.room.registerClientResponseHandler(responseHandler);

		// Add timestamp before sending
		const questionSentTime = Date.now();

		this.room.emitToAllPlayers("server:state:question", playerQuestion, (acknowledgement) => {
			const roundTripTime = Date.now() - questionSentTime;
			console.log('Player acknowledged question:', acknowledgement, 'RTT (ms):', roundTripTime);
		});

		// Also send a message to the host so they can indicate that we are waiting for players to answer
		// This is currently only used when live streaming so that host display can remove the stream latency indicator
		this.room.emitToHosts('server:state:collectanswers', { roundNumber: this.roundNumber, questionNumber: this.questionNumber });
	}

	// showAnswer
	// This also copied directly from quiz game
	showAnswer() {

		// For some question types (eg hotspot) the determining of the correct answer is harder
		// For now lets just do it with the basic questions and add other types later...
		// Calculate the player answers and append to this.question for completion
		let localQuestion = structuredClone(this.question);
		localQuestion.mode = 'answer';
		localQuestion.direction = this.stateMachine.direction;
		localQuestion.options = this.question.options;
		localQuestion.optionsShuffled = this.question.optionsShuffled;
		localQuestion.items = this.question.items;
		localQuestion.itemsShuffled = this.question.itemsShuffled;
		localQuestion.pairs = this.question.pairs;
		localQuestion.pairsShuffled = this.question.pairsShuffled;

		// Don't forget to include the question responses
		localQuestion.responses = this.question.responses;

		// Calculate scores and derived answers (like number-average) BEFORE emitting to Host
		this.calculateQuestionScore(localQuestion);
		console.log('showAnswer: calculated scores:', localQuestion.responses);

		// Sync derived values back to original question object
		this.question.answer = localQuestion.answer;

		console.dir(localQuestion);

		this.room.registerHostResponseHandler(() => {
			this.room.deregisterHostResponseHandler();
			this.stateMachine.nextState();
		});
		this.room.emitToHosts('server:state:answer', localQuestion);

		// For now also just send same event to all players - QuizPlayScene will decide what to display
		// Special cases such as the one below will need to be catered for here... for now just send to all
		this.room.emitToAllPlayers('server:state:answer', localQuestion);

		// Scoring already done above for non-draw questions
		console.log('showAnswer: updated responses with scores:', localQuestion.responses);
	}

	// calculateQuestionScore
	// For a single question we have all the player's answers stored in question.responses
	// This is a dictionary, keyed on player sessionID, with the value being the answer
	// Each question type has its own scoring method - principle is the same:
	// Loop through the keys of the responses dictionary calculating a score for each player
	calculateQuestionScore(question) {
		console.log('calculateQuestionScore:', question);

		var scores = {};

		// Just in case we arrive here and we have not collected any responses then initialize the responses object
		if (!question.responses) {
			question.responses = {};
		}

		// For scoring method snooze - if player has snoozed then we ignore their answer for this question
		// Better to remove right away so they take no part in the scoring
		if (this.quizData.rounds[0].scoreMethod === 'snooze') {
			// Find the response with the highest time (ie the last response) and mark it as snoozed
			// Note: we must consider that a team didn't answer at all - in which case they are the snoozer
			if (Object.keys(question.responses).length === this.room.players.length) {
				let latestTime = 0;
				let latestSessionID = null;
				Object.keys(question.responses).forEach((sessionID) => {
					if (question.responses[sessionID].time > latestTime) {
						latestTime = question.responses[sessionID].time;
						latestSessionID = sessionID;
					}
				});
				if (latestSessionID) {
					question.responses[latestSessionID].snoozed = true;
					console.log('Snoozing player:', latestSessionID);
				}
			}
		}

		function createSimpleString(str) {
			if (str === null || str === undefined) {
				return '';
			}
			str = String(str);
			return str
				.toLowerCase() // Convert to lowercase
				.replace(/[^a-z0-9-_:.]/g, '') // Remove invalid characters
				.replace(/\s+/g, ''); // Remove spaces
		}

		switch (question.type) {

			case 'text':
				const simpleAnswerText = createSimpleString(question.answer);
				Object.keys(question.responses).forEach((sessionID) => {
					const simpleResult = createSimpleString(question.responses[sessionID].answer);
					if (levenshteinDistance(simpleAnswerText, simpleResult) < 3) {
						question.responses[sessionID].score = 1;
						scores[sessionID] = 1;
					}
				});
				break;

			case 'multiple-choice':
			case 'true-false':
			case 'number-exact':
				const simpleAnswer = createSimpleString(question.answer);
				Object.keys(question.responses).forEach((sessionID) => {
					console.log('calculateQuestionScore: ', simpleAnswer, question.responses[sessionID].answer);
					if (createSimpleString(question.responses[sessionID].answer) == simpleAnswer) {
						question.responses[sessionID].score = 1;
						scores[sessionID] = 1;
					}
				});
				break;

			case 'number-closest':
				// Calculate distance from correct answer using objects with named properties
				var distances = [];
				Object.keys(question.responses).filter( (sessionID) => !(question.responses[sessionID].snoozed && question.responses[sessionID].snoozed === true)).forEach((sessionID) => {
					distances.push({
						sessionID: sessionID,
						distance: Math.abs(parseFloat(question.responses[sessionID].answer) - parseFloat(question.answer))
					});
				});

				// Sort by distance (ascending)
				distances = distances.sort((a, b) => a.distance - b.distance);

				// Closest gets 2 points, next 1 point
				console.log('number-closest:', question.answer, question.responses, distances);

				var nextPlayer = 1;
				if (distances.length > 0) {
					// Award 2 points to any players tied for first place
					for (let i = 0; i < distances.length; i++) {
						if (distances[i].distance === distances[0].distance) {
							question.responses[distances[i].sessionID].score = 2;
							scores[distances[i].sessionID] = 2;
							nextPlayer = i + 1;
						} else {
							break;
						}
					}
				}

				// If more than one team was assigned 2 points above then award 1 point to the next level
				if (distances.length > nextPlayer) {
					const secondPlaceDistance = distances[nextPlayer].distance;
					for (let i = nextPlayer; i < distances.length; i++) {
						if (distances[i].distance === secondPlaceDistance) {
							question.responses[distances[i].sessionID].score = 1;
							scores[distances[i].sessionID] = 1;
						} else {
							break;
						}
					}
				}
				break;

			// number-average is similar to number-closest except we calculate the average of all answers first
			// Could probably factor our some of this functionality into useful helper functions...
			case 'number-average':
				// Calculate distance from correct answer using objects with named properties
				let total = 0;
				const responseKeys = Object.keys(question.responses);
				if (responseKeys.length === 0) {
					// If no responses, keep existing answer or set to 0
					question.answer = question.answer || 0;
				} else {
					responseKeys.forEach((sessionID) => {
						total += parseInt(question.responses[sessionID].answer);
					});
					question.answer = (total / responseKeys.length).toFixed(0);
				}
				
				var distancesAvg = [];
				responseKeys.forEach((sessionID) => {
					distancesAvg.push({
						sessionID: sessionID,
						distance: Math.abs(parseFloat(question.responses[sessionID].answer) - parseFloat(question.answer))
					});
				});

				// Sort by distance (ascending)
				distancesAvg = distancesAvg.sort((a, b) => a.distance - b.distance);

				// Closest gets 2 points, next 1 point
				console.log('number-average:', question.answer, question.responses, distancesAvg);

				var nextPlayerAvg = 1;
				if (distancesAvg.length > 0) {
					for (let i = 0; i < distancesAvg.length; i++) {
						if (distancesAvg[i].distance === distancesAvg[0].distance) {
							question.responses[distancesAvg[i].sessionID].score = 2;
							scores[distancesAvg[i].sessionID] = 2;
							nextPlayerAvg = i + 1;
						} else {
							break;
						}
					}
				}

				if (distancesAvg.length > nextPlayerAvg) {
					const secondPlaceDistance = distancesAvg[nextPlayerAvg].distance;
					for (let i = nextPlayerAvg; i < distancesAvg.length; i++) {
						if (distancesAvg[i].distance === secondPlaceDistance) {
							question.responses[distancesAvg[i].sessionID].score = 1;
							scores[distancesAvg[i].sessionID] = 1;
						} else {
							break;
						}
					}
				}
				break;

			// matching is similar to ordering - except our answer contains a left and right pair
			// We only need to consider the left and check the order of the result is the same
			// question.answer holds the correct order
			case 'ordering':
			case 'matching':
				Object.keys(question.responses).forEach((sessionID) => {
					const length = Math.min(question.answer.length, question.responses[sessionID].answer.length);
					var score = 0;
					console.log('calculateQuestionScore: ordering:', question.answer, question.responses[sessionID].answer);
					for (let i = 0; i < length; i++) {
						console.log(question.answer[i], question.responses[sessionID].answer[i]);
						if (question.answer[i] == question.responses[sessionID].answer[i]) {
							score++; // Increment score for matching elements
						}
					}
					// You don't score for the final item since this is a given
					if (score == question.answer.length) score--;
					question.responses[sessionID].score = score;
					scores[sessionID] = score;
				});
				break;

			case 'hotspot':
				// We would usually use a dictionary but since we have to sort the distances we use an array instead
				var hotspotDistances = [];
				Object.keys(question.responses).forEach((sessionID) => {
					const response = question.responses[sessionID].answer;
					hotspotDistances.push([sessionID, Math.hypot(parseInt(response.x) - question.answer.x, parseInt(response.y) - question.answer.y)]);
				});
				hotspotDistances = hotspotDistances.sort(([, valueA], [, valueB]) => valueA - valueB);
				
				console.log('hotspot:', question.answer, question.responses, hotspotDistances);
				if (hotspotDistances.length > 0) {
					const firstSessionID = hotspotDistances[0][0];
					question.responses[firstSessionID].score = 2;
					scores[firstSessionID] = 2;
				}
				if (hotspotDistances.length > 1) {
					const secondSessionID = hotspotDistances[1][0];
					question.responses[secondSessionID].score = 1;
					scores[secondSessionID] = 1;
				}
				break;

			case 'point-it-out':
				// This is simpler than hotspot since its just a right/wrong answer based on the rectangle hit area
				Object.keys(question.responses).forEach((sessionID) => {
					const response = question.responses[sessionID].answer;
					if ((response.x >= question.answer.start.x) &
						(response.x <= question.answer.end.x) &
						(response.y >= question.answer.start.y) &
						(response.y <= question.answer.end.y)) {
						question.responses[sessionID].score = 1;
						scores[sessionID] = 1;
					}
				});
				break;

			case 'draw':
				Object.keys(question.responses).forEach((sessionID) => {
					if (question.responses[sessionID].answer && question.responses[sessionID].answer.score) {
						const score = question.responses[sessionID].answer.score;
						question.responses[sessionID].score = score;
						scores[sessionID] = score;
					}
				});
				break;

		}

		// Handle "You Snooze You Lose" logic
		// We already set the snoozer at the top of this function
		// Since we then marked players are normal we simply look for any snoozers and set their score to 0
		if (this.quizData.rounds[0].scoreMethod === 'snooze') {
			const sessions = Object.keys(question.responses);
			sessions.forEach(sessionID => {
				if (question.responses[sessionID].snoozed) {
					question.responses[sessionID].score = 0;
					scores[sessionID] = 0;
				}
			});
		}

		return scores;
	}

	// endQuestion
	// General-purpose function to tidy up after a question has been asked and answers given
	// Specifically: deregister the client responder so we don't catch unwanted answers in between other states
	endQuestion() {
		console.log('endQuestion:', this.question);
		this.room.emitToAllPlayers('server:action:endquestion');
		this.room.deregisterClientResponseHandler();
		// Also send to host so they can perform any relevant clean-up (not currently used)
		this.room.emitToHosts('server:endquestion');
	}

	// Move into Team Battle phase - starts by sending the two teams involved
	doTeamBattle(data = {}) {
		this.battleMode = BattleMode.BATTLE;
		this.battleContext = {
			tiles: new Set(),
			turns: [],
			activeTurn: { scores: {}, selections: {}, reveals: [] }
		};

		// Determine the teams for battle - either from passed-in data or question data
		if (this.question && this.question.responses) {
			// If we just came from an OPEN question, we need to extract the top 2 teams here
		const sortedTeams = Object.keys(this.question.responses).sort((a, b) => (this.question.responses[b].score || 0) - (this.question.responses[a].score || 0));
			let battleTeams = sortedTeams.slice(0, 2);
			console.log('doTeamBattle: Automatically extracted top teams from question:', battleTeams);
			if (battleTeams.length < 2) {
				console.warn('doTeamBattle: Not enough teams with responses to form a battle! Defaulting to first two players in room.');
				battleTeams = [ '1', '2'];
			}
			this.battleContext.teams = battleTeams;
		}
		if (data.teams) {
			this.battleContext.teams = data.teams;
		}

		console.log('ThreeGame::doTeamBattle: battleTeams:', this.battleContext.teams, 'battleMode:', this.battleMode);
		this.room.emitToHosts('server:state:teambattle', { battleTeams: this.battleContext.teams });
	}

	// doTileSelection
	// We have just asked a question so this.question.responses holds the scores.
	// This function bridges the 'Question Context' into the 'Battle Context'
	doTileSelection(data = {}) {
		console.log('ThreeGame::doTileSelection: Starting tile selection phase. Battle Context before processing:', this.battleContext);
		console.dir(this.battleContext);
		
		// Always reset activeTurn at the start of each new tile selection round so
		// stale answers and tile selections from the previous turn can't bleed through.
		this.battleContext.activeTurn = { scores: {}, selections: {}, reveals: [] };

		// BRIDGE: Migrate scores from the Quiz context into the Battle context
		// This must happen here at the start of TileSelection, because this state
		// requires the scores to determine how many tiles each player can select.
		if (this.question && this.question.responses) {
			this.battleContext.teams.forEach(sid => {
				const qScore = this.question.responses[sid]?.score;
				if (qScore !== undefined) {
					this.battleContext.activeTurn.scores[sid] = qScore;
				}
			});
		}
		
		if (data.scores) {
			this.battleContext.activeTurn.scores = data.scores;
		}

		// Prepare a map of what each player has collected 
		// (Converting Set to Array for JSON serialisation)
		const playerHands = {};
		this.playerHands.forEach((hand, sid) => {
			playerHands[sid] = Array.from(hand);
		});

		// Build the clean payload for frontend Action
		const payload = {
			type: 'tileselection',
			battleTeams: this.battleContext.teams,
			scores: this.battleContext.activeTurn.scores,
			grid: this.grid,
			playerHands: playerHands
		};

		this.room.emitToHosts('server:state:tileselection', payload);

		console.log('doTileSelection payload:', payload);
		const responseHandler = (socket, response) => {
			console.log('three.responseHandler:', socket.id, response);
			const player = this.room.getPlayerBySocketID(socket.id);
			if (player) {
				// Normalize to an array regardless of old/new payload formats
				let selections = response.answer;
				this.battleContext.activeTurn.selections[player.sessionID] = selections;
				this.room.emitToHosts('server:questionanswered', { sessionID: player.sessionID, response: response });
			}
			console.log('three.responseHandler activeTurn:', this.battleContext.activeTurn);
		}
		
		this.room.registerClientResponseHandler(responseHandler);
		this.room.emitToPlayers(this.battleContext.teams, 'server:state:tileselection', payload);
	}

	doTurnEvaluate(data = {}) {
		console.log('ThreeGame::doTurnEvaluate: playerHands:', this.playerHands);
		console.dir(this.battleContext, { depth: null, colors: true });

		// Quick sanity-check on all data we need for this function
		if (!this.battleContext || !this.battleContext.activeTurn || !this.battleContext.teams) {
			console.error('ThreeGame::doTurnEvaluate: Missing battle context data!', this.battleContext);
			return;
		}
		if (this.battleContext.teams.length < 2) {
			console.error('ThreeGame::doTurnEvaluate: Not enough teams to evaluate!', this.battleContext.teams);
			return;
		}
		if (!this.battleContext.activeTurn.selections) {
			console.warn('ThreeGame::doTurnEvaluate: No selections found for active turn, defaulting to empty selections.', this.battleContext.activeTurn);
			this.battleContext.activeTurn.selections = {};
		}

		// If data overrides then use this instead
		if (data.selections) {
			this.battleContext.activeTurn.selections = data.selections;
			console.log('ThreeGame::doTurnEvaluate: Using overridden selections:', data.selections);
		}
		// OK - we should have everything we need... let the function commence...

		// You can uncomment this line during testing to get a deep-inspection view 
		// of the entire battleContext, including nested objects!
		// console.dir(this.battleContext, { depth: null, colors: true });

 		// We will build a list of all reveal outcomes in chronological order
 		const reveals = [];
		const p1_SID = this.battleContext.teams[0];
		const p2_SID = this.battleContext.teams[1];

		// Ensure selections array defaults cleanly 
		const p1_selections = this.battleContext.activeTurn.selections[p1_SID]?.tiles || [];
		const p2_selections = this.battleContext.activeTurn.selections[p2_SID]?.tiles || [];

		// MaxTurns is the sum of choices, but we alternate
		const maxTurns = Math.max(p1_selections.length, p2_selections.length);

		console.log('ThreeGame::doTurnEvaluate: p1_selections:', p1_selections, 'p2_selections:', p2_selections, 'maxTurns:', maxTurns);
		for (let i = 0; i < maxTurns; i++) {
			// Player 1 turn
			if (i < p1_selections.length) {
				console.log('ThreeGame::doTurnEvaluate: Player 1 position', p1_selections[i]);
				const pos = p1_selections[i];
				const result = this.resolveReveal(p1_SID, pos);
				reveals.push({ ...result, playerSID: p1_SID });
			}

			// Player 2 turn
			if (i < p2_selections.length) {
				console.log('ThreeGame::doTurnEvaluate: Player 2 position', p2_selections[i]);
				const pos = p2_selections[i];
				const result = this.resolveReveal(p2_SID, pos);
				reveals.push({ ...result, playerSID: p2_SID });
			}
		}

		console.dir( 'Reveals:', reveals, { depth: null, colors: true });

		// Record the loop history
		this.battleContext.activeTurn.reveals = reveals;
		// Keep a historical record, but continue using activeTurn
		this.battleContext.turns.push(this.battleContext.activeTurn);
		
		// Emit the sequence of events to the host for animation
		// Once the host animation is done, auto-advance to TEAM_BATTLE to show players back in their slots
		// this.room.registerHostResponseHandler(() => {
		// 	this.room.deregisterHostResponseHandler();
		// 	this.stateMachine.nextState();
		// });
		this.room.emitToHosts('server:state:turnevaluate', { 
			reveals,
			grid: this.grid, // Send final grid state for verification
			playerHands: Object.fromEntries(Array.from(this.playerHands.entries()).map(([k, v]) => [k, Array.from(v)]))
		});
		// Nothing happens on the player screen for turn evaluate but the state change allows Player to teardown the previous state
		this.room.emitToAllPlayers('server:state:turnevaluate', { });
	}

	checkJoker() {
		// Use the reveals from the active turn we just evaluated
		const recentReveals = this.battleContext?.activeTurn?.reveals;
		
		console.log('ThreeGame::checkJoker: Checking for joker in reveals:', recentReveals);
		if (recentReveals) {
			// forEach returns undefined and cannot be broken out of (return just skips to the next iteration like 'continue')
			// We use .some() to stop as soon as we find a joker.
			return recentReveals.some(reveal => {
				if (reveal.icon === 'joker') {
					console.log(`ThreeGame::checkJoker: Joker revealed at position ${reveal.pos} by player ${reveal.playerSID}`);
					return true;
				}
			});
		}
		return false;
	}


	// Logic is slightly different here to checkJoker because we want the LAST joker revealed as this will be stolen from earlier
	doJoker() {
		let thisReveal = null;
		// Use the reveals from the active turn we just evaluated
		const recentReveals = this.battleContext?.activeTurn?.reveals;

		if (recentReveals) {
			recentReveals.forEach(reveal => {
				if (reveal.icon === 'joker') {
					console.log(`ThreeGame::doJoker: Granting joker at position ${reveal.pos} to player ${reveal.playerSID}`);
					thisReveal = reveal;
				}
			});
		}
		if (thisReveal) {

			// Invoke the TileDirector selectJokerType function to detemrine best joker based on context
			const playerSID = thisReveal.playerSID;
			const jokerType = this.director.selectJokerType( playerSID, {
				grid: this.grid,
    	        playerHands: this.playerHands,
        	    battleTiles: this.battleContext.tiles,
            	activeSID: playerSID,
				battleTeams: this.battleContext.teams
			});
			
			const jokerRules = this.director.getJokerRules(jokerType);

			// Store the joker type in the active turn so that it is available in other states
			const jokerPayload = {
				ui: 'team-tile-wizard',
				teams: 1,
				tiles: 1,
				jokerType: jokerType,
				jokerRules: jokerRules,
				pos: thisReveal.pos,
				playerSID: playerSID
			};

			this.battleContext.activeTurn.joker = jokerPayload;

			// 1. Tell Host to show the Joker Graphic/Rules
			this.room.emitToHosts('server:state:joker', jokerPayload);

			// 2. Identify the target group of players for the UI prompt (often just the other teams in the battle)
			// Example for Steal/Freeze: Provide valid targets to pick from
			// Usually its just all players exceot the active player (they can't choose themselves)
			const validOpponents = this.room.getConnectedPlayers()
				.filter(p => p.sessionID !== playerSID)
				.map(p => ({
					sessionID: p.sessionID,
					name: p.name,
					avatar: p.avatar
				}));
			const playerPayload = {
				...jokerPayload,
				teamlist: validOpponents
			};

			// 3. Send the prompt solely to the active player who earned the Joker
			console.log(`ThreeGame::doJoker: Dispatching joker prompt [${jokerType}] to player [${playerSID}]`);
			this.room.emitToPlayers([playerSID], 'server:state:joker', playerPayload);

			// 4. Wait for their selection before calculating result
			this.room.registerClientResponseHandler( (socket, data) => {
					console.log(`ThreeGame::doJoker: Received joker action from ${playerSID}`, data);
					
					jokerPayload.response = data;

					// Send a message to the host so they know player has responded and can manually step to the next state
					this.room.emitToHosts('server:questionanswered', { sessionID: playerSID, response: data });
				});

		} else {
            console.log('ThreeGame::doJoker: No Joker reveal found. (Should not reach here normally)');
        }
	}

	// doJokerEvaluate
	// We have the player's response to the joker stored in the active turn (joker.response)
	// We must evaluate what happened and translate into a 'reveal' object so it can be displayed similar to the TURN_EVALUATE state and associated animation on the Host Screen
	doJokerEvaluate() {

		console.log('ThreeGame::doJokerEvaluate: Evaluating joker result for active turn:', this.battleContext.activeTurn);

		if (!this.battleContext || !this.battleContext.activeTurn || !this.battleContext.activeTurn.joker) {
			console.log('ThreeGame::doJokerEvaluate: No joker data found in active turn. Cannot evaluate result.');
			return;
		}

		const jokerData = this.battleContext.activeTurn.joker;

		if (!jokerData.response || !jokerData.response.answer) {
			console.log('ThreeGame::doJokerEvaluate: No response data found for joker. Cannot evaluate result.');
			return;
		}
		const response = jokerData.response;
		const answer = response.answer;
		console.log('ThreeGame::doJokerEvaluate: Evaluating joker result with data:', jokerData);

		// At the moment we will do it via a large switch statement to perform relevant logic based on joker type
		// Maybe there is a smarter way to do this but for now it should work
		switch (jokerData.jokerType) {

			case 'steal':
				const fromSID = answer.teams[0];
				const fromPlayer = this.room.getPlayerBySessionID(fromSID);
				const fromTile = answer.tiles[0];

				// Lazy generation if the tile hasn't been revealed yet
				const tileType = this.director.decideTileAt(fromTile, {
						grid: this.grid,
						playerHands: this.playerHands,
						battleTiles: this.battleContext.tiles,
						activeSID: jokerData.playerSID,
						battleTeams: this.battleContext.teams
					});

				// We must explicitly save it back to the grid in case it was newly generated!
				this.grid[fromTile] = tileType;

				let result = '';
				if (fromPlayer) {
					if (!this.playerHands.has(fromSID)) {
						this.playerHands.set(fromSID, new Set());
					}
					const fromHand = this.playerHands.get(fromSID);
					if (fromHand.has(fromTile) && fromTile !== 'joker') {
						result = 'steal';
						this.stealTile(fromSID, jokerData.playerSID, fromTile);
						// Since this is a joker steal it should always be safe - so remove from battleContext.tiles
						this.battleContext.tiles.delete(fromTile);
					} else {
						result = 'no-op';
					}
				}
				jokerData.result = result;
				jokerData.fromSID = fromSID;
				jokerData.pos = fromTile;
				break;

		}

		// Final data item to add is the new number of tiles for the stolen set
		// There could be a scenario where a steal results in a team losing a tile but the stealing team does NOT get it
		// So to fix this we must explicitly pass the tile count for the stealing team
		if (jokerData.pos !== undefined) {
			const tileType = this.grid[jokerData.pos];
			jokerData.tileType = tileType;
			jokerData.newTileCount = this.getTileCountForPlayer(jokerData.playerSID, tileType);
		}

		// Broadcast the stored result out to trigger the animations
		this.room.emitToHosts('server:state:jokerevaluate', jokerData);

		// When the host animation completes it will send host:response — advance to the next state
		// this.room.registerHostResponseHandler(() => {
		// 	this.room.deregisterHostResponseHandler();
		// 	this.stateMachine.nextState(); // JOKER_EVALUATE → TILE_SELECTION
		// });

	}

	getTileCountForPlayer(playerSID, tileType) {
		const stealingTeamHand = this.playerHands.get(playerSID);
		if (stealingTeamHand) {
			// How many of the tileType does the stealing team now have?
			// At this point, any tile in a player's hand MUST have already been revealed and stored in the grid
			const newTileCount = Array.from(stealingTeamHand).filter(pos => this.grid[pos] === tileType).length;
			console.log('Calculating new tile count:', newTileCount);
			return newTileCount;
		}
		console.log('getTileCountForPlayer: No hand found for playerSID:', playerSID);
		return 0;
	}


	/**
     * Test rig for TileDirector (Position-Pointer model).
     */
    /**
     * Core Battle Resolution Logic
     * Handles one reveal by one player.
	 * Format of JSON returned:
	 * {
	 *   icon: 'icon_1',
	 *   pos: 5,
	 *   result: 'steal' | 'collect' | 'no-op',
	 *   fromSID: 'p2' (used when stealing - be explicit to allow stealing from any player not just opponent)
	 * }
     */
    resolveReveal(playerSID, pos) {

		// Decide what's there (lazy generation if needed)
        const icon = this.director.decideTileAt(pos, {
            grid: this.grid,
            playerHands: this.playerHands,
            battleTiles: this.battleContext.tiles,
            activeSID: playerSID,
            battleTeams: this.battleContext.teams,
            turnReveals: this.battleContext.activeTurn?.reveals || []
        });

        // Ensure the master grid is updated immediately with the revealed type
        this.grid[pos] = icon;

        // 1. Check if this position was already collected in THIS battle
        // If it was, it's vulnerable and can be stolen.
        const isVulnerable = this.battleContext.tiles.has(pos);
		const fromSID = this.getOpponentSID(playerSID);
        
        // CASE: Steal (it is vulnerable therefore been stolen)
		// NOTE: this relies on players cannot reveal the same tile in the same turn - meaning if it is vulnerable then it MUST have been revealed by the other player
		let result = 'FAIL';
        if (isVulnerable) {
            this.stealTile(fromSID, playerSID, pos);
			result = 'steal';
        } else {
			if (!this.playerHands.get(playerSID)) {
				this.playerHands.set(playerSID, new Set());
			}
			if (this.playerHands.get(playerSID).has(pos)) {
                result = 'no-op';
            } else {
				this.collectTile(playerSID, pos);
				result = 'collect';
			}
		}
		console.log(`ThreeGame:: resolveReveal result:`, { icon, result, fromSID });

		// Extra twist - if the revealed tile was a joker all players get it because it can only be claimed once per game
		if (icon === 'joker') {
			console.log(`ThreeGame:: Position ${pos} is a joker - all players get it`);
			this.players.forEach((player) => {
				this.collectTile(player.sessionID, pos);
			});
		}

		// Final step - include the new total of the revealed tile
		// Avoids edge cases where stolen tiles can be counted twice - explicitly set the new tile count
		const tileType = this.grid[pos];
		const newTileCount = this.getTileCountForPlayer(playerSID, tileType);
		return { icon, pos, result, fromSID, newTileCount };
        
    }

    collectTile(playerSID, pos) {
        if (!this.playerHands.has(playerSID)) this.playerHands.set(playerSID, new Set());
        const hand = this.playerHands.get(playerSID);
        hand.add(pos);
		this.battleContext.tiles.add(pos);
    }

    stealTile(fromSID, toSID, pos) {
        const fromHand = this.playerHands.get(fromSID);
        if (!this.playerHands.has(toSID)) this.playerHands.set(toSID, new Set());
        const toHand = this.playerHands.get(toSID);
        
        if (fromHand) fromHand.delete(pos);
        toHand.add(pos);
		if (this.battleContext.teams.includes(fromSID)) {
			this.battleContext.tiles.add(pos);  
		}   
        console.log(`STEAL: Position ${pos} moved from ${fromSID} to ${toSID}`);
    }

    getOpponentSID(sid) {
        // Simple 2-player assumption for now
        return Array.from(this.playerHands.keys()).find(k => k !== sid);
    }

	// checkWinner
	// Looks at the playerHands and determines if a team has collected 3 matching tiles yet.
	// A "win" requires 3 tiles of the SAME icon type (looked up from this.grid).
	// In the event that two teams both have a winning hand simultaneously, teams[0] wins (they went first).
    checkWinner() {
		console.dir(this.playerHands, { depth: 3, colors: true });

		const winners = [];

        for (const [sid, hand] of this.playerHands.entries()) {
			// Count occurrences of each icon type in this hand
			const typeCounts = {};
			for (const pos of hand) {
				const type = this.grid[pos];
				if (!type) continue;
				typeCounts[type] = (typeCounts[type] || 0) + 1;
				if (typeCounts[type] >= 3) {
					winners.push(sid);
					break;
				}
			}
        }

		if (winners.length === 0) return null;

		// Tie-break: the team listed first in battleContext.teams went first and wins
		if (winners.length > 1 && this.battleContext?.teams) {
			for (const sid of this.battleContext.teams) {
				if (winners.includes(sid)) return sid;
			}
		}

		return winners[0];
    }

	checkBattleOver() {
		console.log('ThreeGame::checkBattleOver - checking if battle is over with tiles:', this.battleContext.activeTurn);
		const activeTurn = this.battleContext.activeTurn;
		if (!activeTurn || !activeTurn.reveals) {
			console.warn('ThreeGame::checkBattleOver - No active turn or reveals found in battle context!');
			return false;
		}
		// Count the number of 'collects' these are the new tiles that were collected this turn, must be 3-4 to continue the battle
		const collectCount = activeTurn.reveals.filter(reveal => reveal.result === 'collect').length;
		console.log(`ThreeGame::checkBattleOver - collectCount: ${collectCount}`);
 		// If less than 3 new tiles were collected then the battle is over
		return collectCount < 3 || collectCount > 4;
	}

    endBattle() {
        console.log('ThreeGame:: endBattle - Vaulting all tiles (clearing vulnerability)');
		if (this.battleContext) {
			this.battles.push(this.battleContext);
		}
        this.battleContext = null;
		this.battleMode = BattleMode.OPEN;
    }


    onPlayerJoin(player, socket) {
        console.log(`ThreeGame::onPlayerJoin: ${player.name}`);
        if (!this.playerHands.has(player.sessionID)) {
            this.playerHands.set(player.sessionID, new Set());
        }
    }

    onPlayerReconnect(player, socket) {
		console.log(`ThreeGame::onPlayerReconnect: ${player.name}`);
        console.dir({state: this.stateMachine.state, battleContext: this.battleContext});

		// If we are currently in a question, send it to the reconnected player
		if (this.stateMachine.state === ThreeState.COLLECT_ANSWERS) {
			
			// Check if player has already answered
			if (this.question && this.question.responses && this.question.responses[player.sessionID]) {
				console.log('Player already answered - client will remain in waiting state');
				return;
			}

			// Check if this is a BATTLE QUESTION - and if this team is part of the battle
			if (this.battleMode === BattleMode.BATTLE && this.battleContext.teams && !this.battleContext.teams.includes(player.sessionID)) {
				console.log('Player is not part of the battle - client will remain in waiting state');
				return;
			}

			if (this.question) {
				// Prepare player question (logic duplicated from collectAnswers for now)
				let playerQuestion = {};
				playerQuestion.mode = 'ask';
				playerQuestion.direction = this.stateMachine.direction;
				playerQuestion.questionNumber = this.question.questionNumber;
				playerQuestion.type = this.question.type;
				playerQuestion.optionsShuffled = this.question.optionsShuffled;
				playerQuestion.itemsShuffled = this.question.itemsShuffled;
				playerQuestion.pairsShuffled = this.question.pairsShuffled;
				playerQuestion.extra = this.question.extra;
				if (playerQuestion.type == 'hotspot' || playerQuestion.type == 'point-it-out') {
					playerQuestion.image = this.question.image;
				}

				console.log('Re-sending question to reconnected player:', player.sessionID);
				socket.emit('server:state:question', playerQuestion, (acknowledgement) => {
					console.log('Acknowledgement from player:', player.sessionID, acknowledgement);
				});
			}
		}

		if (this.stateMachine.state === ThreeState.TILE_SELECTION) {
			console.log('Player reconnected during tile selection:', player.sessionID, this.battleMode, this.battleContext.teams);
			// If we are in tile selection then we also need to check if this player is part of the battle
			if (this.battleMode === BattleMode.BATTLE && this.battleContext.teams && !this.battleContext.teams.includes(player.sessionID)) {
				console.log('Player is not part of the battle - client will remain in waiting state');
				return;
			}

			// Prepare collection for reconnected player - only send their hand not the other players
			const playerHand = this.playerHands.get(player.sessionID) || new Set();
			const hand = Array.from(playerHand);
			this.question.type = 'tileselection';
			this.question.playerHands = { [player.sessionID]: hand };
			this.question.grid = this.grid; // Include master grid on reconnect

			console.log('Re-sending tile selection state to reconnected player:', player.sessionID);
			socket.emit('server:state:tileselection', this.question, (acknowledgement) => {
				console.log('Acknowledgement from player:', player.sessionID, acknowledgement);
			});
		}

		if (this.stateMachine.state === ThreeState.JOKER) {

			console.dir(player.sessionID, this.battleContext);
			// If we are in joker phase then we also need to check if this player is part of the battle
			if (this.battleMode === BattleMode.BATTLE && this.battleContext.teams && !this.battleContext.teams.includes(player.sessionID)) {
				console.log('Player is not part of the battle - client will remain in waiting state');
				return;
			}
			// If the reconnected player is the active player for the joker then we need to resend the prompt
			if (this.battleContext && this.battleContext.activeTurn && this.battleContext.activeTurn.joker && this.battleContext.activeTurn.joker.playerSID === player.sessionID) {
				const jokerType = this.battleContext.activeTurn.joker.jokerType;
				const validOpponents = this.room.getConnectedPlayers()
					.filter(p => p.sessionID !== player.sessionID)
					.map(p => ({
						sessionID: p.sessionID,
						name: p.name,
						avatar: p.avatar
					}));
				const playerPayload = {
					...this.battleContext.activeTurn.joker,
					teamlist: validOpponents
				};
				console.log(`ThreeGame::onPlayerReconnect: Re-sending joker prompt [${jokerType}] to player [${player.sessionID}]`);
				this.room.emitToPlayers( [ player.sessionID ], 'server:state:joker', playerPayload, (acknowledgement) => {
					console.log('Acknowledgement from player:', player.sessionID, acknowledgement);
				});
			}
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
// Helper function to perform a fuzzy string comparison
function levenshteinDistance(str1, str2) {
	const len1 = str1.length;
	const len2 = str2.length;
	const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

	for (let i = 0; i <= len1; i++) matrix[i][0] = i;
	for (let j = 0; j <= len2; j++) matrix[0][j] = j;

	for (let i = 1; i <= len1; i++) {
		for (let j = 1; j <= len2; j++) {
			const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost
			);
		}
	}
	return matrix[len1][len2];
}

