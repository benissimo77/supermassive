import Game from './server.game.js';
import GameSession from '../models/mongo.gameSession.js';
import PlayerResult from '../models/mongo.playerResult.js';
import QuizRating from '../models/mongo.quizRating.js';

// For V2 QUIZ :
// import { QuizV2 as QuizModel} from '../models/mongo.quizv2.js';
// For V1 QUIZ :
import QuizModel from '../models/mongo.quiz.js';

const QuizState = {
	INIT: 'INIT',
	INTRO_QUIZ: 'INTRO_QUIZ',
	OPENING_CREDITS: 'OPENING_CREDITS',
	NEXT_ROUND: 'NEXT_ROUND',
	PREVIOUS_ROUND: 'PREVIOUS_ROUND',
	INTRO_ROUND: 'INTRO_ROUND',
	NEXT_QUESTION: 'NEXT_QUESTION',
	PREVIOUS_QUESTION: 'PREVIOUS_QUESTION',
	QUESTION: 'QUESTION',
	WAITING_FOR_STREAM: 'WAITING_FOR_STREAM',
	END_QUESTION: 'END_QUESTION',
	COLLECT_ANSWERS: 'COLLECT_ANSWERS',
	SHOW_ANSWER: 'SHOW_ANSWER',
	MARK_ANSWERS: 'MARK_ANSWERS',
	UPDATE_SCORES: 'UPDATE_SCORES',
	END_ROUND: 'END_ROUND',
	END_QUIZ: 'END_QUIZ',
	CLOSING_CREDITS: 'CLOSING_CREDITS'
};

class GauntletStateMachine {

	constructor(quiz) {
		this.quiz = quiz;
		this.direction = 'forward';
		this.transitionTo(QuizState.INIT);
	}

	start() {
		this.transitionTo(QuizState.INTRO_QUIZ);
	}

	// General purpose function which advamces the state machine to the next state
	// Next state is determined by the current state
	nextState() {

		this.direction = 'forward';

		// This is a simple state machine - the next state is determined by the current state
		switch (this.state) {

			case QuizState.INIT:
				this.transitionTo(QuizState.INTRO_QUIZ);
				break;
			case QuizState.INTRO_QUIZ:
				this.transitionTo(QuizState.OPENING_CREDITS);
				break;

			case QuizState.OPENING_CREDITS:
				this.transitionTo(QuizState.NEXT_ROUND);
				break;

			case QuizState.INTRO_ROUND:
				this.transitionTo(QuizState.NEXT_QUESTION);
				break;

			case QuizState.QUESTION:
				if (this.quiz.mode == "ask") {
					if (this.quiz.liveStream) {
						this.transitionTo(QuizState.WAITING_FOR_STREAM);
					} else {
						this.transitionTo(QuizState.COLLECT_ANSWERS);
					}
				} else {
					this.transitionTo(QuizState.SHOW_ANSWER);
				}
				break;

			case QuizState.WAITING_FOR_STREAM:
				this.transitionTo(QuizState.COLLECT_ANSWERS);
				break;

			case QuizState.COLLECT_ANSWERS:
				// Once we have finished with COLLECT_ANSWERS we know we don't want to collect any more answers
				// So end the question for all players immediately
				this.quiz.endQuestion();
				if (this.quiz.round.showAnswer == "question") {
					this.transitionTo(QuizState.SHOW_ANSWER);
				} else {
					this.transitionTo(QuizState.NEXT_QUESTION);
				}
				break;

			case QuizState.SHOW_ANSWER:
				console.log('SHOW_ANSWER:', this.quiz.round.showAnswer, this.quiz.round.updateScores);
				// For Draw question types (and maybe others) we want to pass to players to mark correct/incorrect
				if (this.quiz.doesQuestionNeedMarking()) {
					console.log('... DRAW! move to MARK_ANSWERS');
					this.transitionTo(QuizState.MARK_ANSWERS);
				} else {
					if (this.quiz.round.updateScores == "question") {
						this.transitionTo(QuizState.UPDATE_SCORES);
					} else {
						this.transitionTo(QuizState.NEXT_QUESTION);
					}
				}
				break;

			// after MARK_ANSWERS we duplicate the logic from SHOW_ANSWER
			case QuizState.MARK_ANSWERS:
				if (this.quiz.round.updateScores == "question") {
					this.transitionTo(QuizState.UPDATE_SCORES);
				} else {
					this.transitionTo(QuizState.NEXT_QUESTION);
				}
				break;

			case QuizState.UPDATE_SCORES:
				// After updating scores we either move to next question or to next round
				if (this.quiz.round.updateScores == "question") {
					this.transitionTo(QuizState.NEXT_QUESTION);
				} else {
					this.transitionTo(QuizState.NEXT_ROUND);
				}
				break;

			case QuizState.END_QUESTION:
				this.transitionTo(QuizState.NEXT_QUESTION);
				break;

			// END_ROUND state is entered the moment we run out of questions
			// However we might still need to show answers and update scores
			case QuizState.END_ROUND:
				if (this.quiz.mode == "ask") {
					if (this.quiz.round.showAnswer == "round") {
						console.log('Switching to answer mode...');
						this.quiz.mode = "answer";
						this.quiz.questionNumber = 0;
						this.transitionTo(QuizState.NEXT_QUESTION);
					} else {
						if (this.quiz.round.updateScores == "round") {
							this.transitionTo(QuizState.UPDATE_SCORES);
						} else {
							this.transitionTo(QuizState.NEXT_ROUND);
						}
					}
				} else {
					// If we reached here in 'answer' mode then we are done with answers - update scores
					if (this.quiz.round.updateScores == "round") {
						this.transitionTo(QuizState.UPDATE_SCORES);
					} else {
						this.transitionTo(QuizState.NEXT_ROUND);
					}
				}
				break;

			case QuizState.END_QUIZ:
				this.transitionTo(QuizState.CLOSING_CREDITS);
				break;

			case QuizState.CLOSING_CREDITS:
				// Quiz is over
				console.log('Quiz is fully over.');
				break;

			default:
				console.error(`Unknown state: ${this.state}`);
		}
	}

	previousState() {
		console.log('previousState:', this.state);
		this.direction = 'backward';

		switch (this.state) {

			case QuizState.OPENING_CREDITS:
				this.transitionTo(QuizState.INTRO_QUIZ);
				break;

			case QuizState.INTRO_ROUND:
				// If we are at the intro of a round, go to the last question of the previous round
				if (this.quiz.moveToPreviousRound()) {
					this.transitionTo(QuizState.QUESTION);
				} else {
					this.transitionTo(QuizState.OPENING_CREDITS);
				}
				break;

			case QuizState.QUESTION:
			case QuizState.COLLECT_ANSWERS:
			case QuizState.SHOW_ANSWER:
			case QuizState.MARK_ANSWERS:
			case QuizState.UPDATE_SCORES:
			case QuizState.END_QUESTION:
				// Move to the previous question from these states
				if (this.quiz.moveToPreviousQuestion()) {
					this.transitionTo(QuizState.QUESTION);
				} else {
					// We are on Question 1, so go back to the Round Intro
					this.transitionTo(QuizState.INTRO_ROUND);
				}
				break;

			case QuizState.END_ROUND:
				// If we are at the end of a round/quiz, go back to the start of the last question
				this.transitionTo(QuizState.PREVIOUS_QUESTION);
				break;

			case QuizState.END_QUIZ:
			case QuizState.CLOSING_CREDITS:
				console.log('Attempting to go back after end of quiz... do nothing here...');
				break;

			default:
				this.transitionTo(QuizState.INTRO_QUIZ);
				break;
		}
	}

	fastForward() {
		console.log('fastForward:', this.state);
		this.direction = 'forward';
		this.transitionTo(QuizState.NEXT_ROUND);
	}

	fastBackward() {
		console.log('fastBackward:', this.state);
		this.direction = 'backward';
		this.transitionTo(QuizState.PREVIOUS_ROUND);
	}

	transitionTo(newState) {
		this.state = newState;
		console.log(`Transitioning to state: ${newState}`);

		// In case we still have a timer set from previous state (and user has attempted to move on) then clear the timer
		if (this.quiz.roundTimerID) {
			clearTimeout(this.quiz.roundTimerID);
			this.quiz.roundTimerID = null;
		}

		switch (newState) {
			case QuizState.INIT:
				this.quiz.init();
				break;

			case QuizState.INTRO_QUIZ:
				this.quiz.introQuiz()
				break;

			case QuizState.OPENING_CREDITS:
				this.quiz.openingCredits();
				break;

			case QuizState.NEXT_ROUND:
				this.quiz.mode = "ask";
				if (this.quiz.moveToNextRound()) {
					this.transitionTo(QuizState.INTRO_ROUND);
				} else {
					this.transitionTo(QuizState.END_QUIZ);
				}
				break;

			case QuizState.PREVIOUS_ROUND:
				if (this.quiz.moveToPreviousRound()) {
					this.transitionTo(QuizState.INTRO_ROUND);
				} else {
					this.transitionTo(QuizState.INTRO_QUIZ);
				}
				break;

			case QuizState.INTRO_ROUND:
				this.quiz.introRound();
				break;

			case QuizState.PREVIOUS_QUESTION:
				if (this.quiz.moveToPreviousQuestion()) {
					this.transitionTo(QuizState.QUESTION);
				} else {
					this.transitionTo(QuizState.PREVIOUS_ROUND);
				}
				break;

			case QuizState.NEXT_QUESTION:
				if (this.quiz.moveToNextQuestion()) {
					this.transitionTo(QuizState.QUESTION);
				} else {
					console.log('No more questions - ending round...');
					this.transitionTo(QuizState.END_ROUND);
				}
				break;

			// Tweaked logic QUESTION now expects the question number to be already set correctly
			case QuizState.QUESTION:
				this.quiz.doQuestion()
				break;

			case QuizState.WAITING_FOR_STREAM:
				this.quiz.waitingForStream();
				break;

			case QuizState.COLLECT_ANSWERS:
				this.quiz.collectAnswers();
				break;

			case QuizState.SHOW_ANSWER:
				this.quiz.showAnswer();
				break;

			case QuizState.MARK_ANSWERS:
				this.quiz.submitToPlayersForScoring();
				break;

			case QuizState.UPDATE_SCORES:
				this.quiz.updateScores();
				break;

			case QuizState.END_QUESTION:
				this.quiz.endQuestion()
				break;

			case QuizState.END_ROUND:
				this.quiz.endRound()
				break;

			case QuizState.END_QUIZ:
				this.quiz.endQuiz();
				break;

			case QuizState.CLOSING_CREDITS:
				this.quiz.closingCredits();
				break;

			default:
				console.error(`Unknown state: ${newState}`);
		}
	}
}


export default class Gauntlet extends Game {

	constructor(room) {
		super(room);

		// Initialize other game-specific properties here
		console.log('Gauntlet::constructor:');
		this.name = 'gauntlet';
		this.minplayers = 0;
		this.maxplayers = 10;
		this.roundNumber = 0;
		this.questionNumber = 0;
		this.roundTimerID = null;

		// Instantiate the State Machine which will manage the game flow
		this.stateMachine = new GauntletStateMachine(this);

		// Catch host keypresses
		this.room.registerHostKeypressHandler(this.keypressHandler.bind(this));


		this.quizData = {
			"title": "Sample Gauntlet",
			"description": "<p>This is a sample gauntlet to get you started.</p>",
			"rounds": [
				{
					title: 'General Ignorance II',
					description: 'Four possible answers, how much do you know?',
					roundTimer: "10",
					showAnswer: "question",
					updateScores: "question",
					questions: [
						{
							type: "text",
							text: "What is the capital of France?",
							image: null,
							audio: "https://youtu.be/VtM1Jlfx_eA?si=slW5pOj-snu9OnKX",
							answer: "Paris"
						},
						{
							"type": "true-false",
							"text": "True or False: this is a question?",
							"image": null,
							"audio": "",
							"answer": "true"
						},
						{
							"type": "draw",
							"text": "Old-skool draw the answer!",
							"image": null,
							"audio": "",
							"answer": "This is what you should have drawn..."

						},
						{
							type: 'multiple-choice',
							text: 'Who wrote the play "Romeo and Juliet"?',
							options: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain']
						},
						{
							type: "number-closest",
							text: "Who is closest to 2.5?",
							image: null,
							answer: "2.5"
						},
						{
							type: "text",
							text: "What is the capital of France?",
							image: null,
							audio: "https://youtu.be/VtM1Jlfx_eA?si=slW5pOj-snu9OnKX",
							answer: "Paris"
						},
						{
							"type": "hotspot",
							"text": "HOTSPOT!",
							"image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAGQCAIAAABkkLjnAAAACXBIWXMAAC4jAAAuIwF4pT92AAAInElEQVR4nO3ZsYredRqG4e8TttFCF2EPQLBwYJlaFosN2ESIRdLYKPbpYu/CFrtFTmCLLcwW0yiCEDuTU3BA0gnWOQCncdEi5bpwP1jMN3Jd3fxI8S9ueObNHO8/uDrQXDy888EnX133V9wML133B9wwz/76xXV/ws0grMHZ07uX73123V9xMwhrcP74o+v+hBtDWAM72AlrcPneZ2dP7173V9wMwtpYw0hYG2sYCWvgKuyENbCDnbAGdrAT1sBV2AlrYw0jYW2sYSSsgauwE9bADnbCGtjBTlgDV2EnrI01jIS1sYaRsAauwk5YAzvYCWtgBzthDVyFnbA21jAS1sYaRsIauAo7YQ3sYCesgR3shDVwFXbC2ljDSFgbaxgJa+Aq7IQ1sIOdsAZ2sBPWwFXYCWtjDSNhbaxhJKyBq7AT1sAOdsIa2MFOWANXYSesjTWMhLWxhpGwBq7CTlgDO9gJa2AHO2ENXIWdsDbWMBLWxhpGwhq4CjthDexgJ6yBHeyENXAVdsLaWMNIWBtrGAlr4CrshDWwg52wBnawE9bAVdgJa2MNI2FtrGEkrIGrsBPWwA52whrYwU5YA1dhJ6yNNYyEtbGGkbAGrsJOWAM72AlrYAc7YQ1chZ2wNtYwEtbGGkbCGrgKO2EN7GAnrIEd7IQ1cBV2wtpYw0hYG2sYCWvgKuyENbCDnbAGdrAT1sBV2AlrYw0jYW2sYSSsgauwE9bADnbCGtjBTlgDV2EnrI01jIS1sYaRsAauwk5YAzvYCWtgBzthDVyFnbA21jAS1sYaRsIauAo7YQ3sYCesgR3shDVwFXbC2ljDSFgbaxgJa+Aq7IQ1sIOdsAZ2sBPWwFXYCWtjDSNhbaxhJKyBq7AT1sAOdsIa2MFOWANXYSesjTWMhLWxhpGwBq7CTlgDO9gJa2AHO2ENXIWdsDbWMBLWxhpGwhq4CjthDexgJ6yBHeyOtx7/5/L2oxc/nD25d/71h89ufe7lV18Oh8PZ07t/uHrlRL7nlF+Or//87ul8jZffzcvx/oOrA83Fwzvnjz/yX1mF37EGrsJOWANYSesgauwE9bA3wo7YW2sYSSsjTWMhDVwFXbCGtjBTlgDO9gJa+Aq7IS1sYaRsDbWMBLWwFXYCWtgBzthDexgJ6yBq7AT1sYaRsLaWMNIWANXYSesgR3shDWwg52wBq7CTlgbaxgJa2MNI2ENXIWdsAZ2sBPWwA52whrYCjthbaxhJKyNNYyENXAVdsIa2MFOWAM72Alr4CrshLWxhpGwNtYwEtbAVdgJa2AHO2EN7GAnrIGrsBPWxhpGwtpYw0hYA1dhJ6yBHeyENbCDnbAGrsJOWBtrGAlrYw0jYQ1chZ2wBnawE9bADnbCGrgKO2FtrGEkrI01jIQ1cBV2whrYwU5YAzvYCWvgKuyEtbGGkbA21jAS1sBV2AlrYAc7YQ3sYCesgauwE9bGGkbC2ljDSFgDV2EnrIEd7IQ1sIOdsAauwk5YG2sYCWtjDSNhDVyFnbAGdrAT1sAOdsIauAo7YW2sYSSsjTWMhDVwFXbCGtjBTlgDO9gJa+Aq7IS1sYaRsDbWMBLWwFXYCWtgBzthDexgJ6yBq7AT1sYaRsLaWMNIWANXYSesgR3shDWwg52wBq7CTlgbaxgJa2MNI2ENXIWdsAZ2sPsFDlLVXPOGSogAAAAASUVORK5CYII=",
							"audio": "",
							"answer": {
								"x": 100,
								"y": 985
							}
						},
						{
							"type": "ordering",
							"text": "Place in order",
							"image": null,
							"audio": "",
							"extra": {
								"startLabel": "Earliest",
								"endLabel": "Latest"
							},
							"items": [
								"1990",
								"1995",
								"2000",
								"2004",
								"2012"
							]
						},
						{
							"type": "point-it-out",
							"text": "Point out the top corner...",
							"image": "data:image/png;base64,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",
							"audio": "",
							"answer": {
								"start": {
									"x": 80,
									"y": 80
								},
								"end": {
									"x": 320,
									"y": 320
								}
							}
						},

					]
				}
			]
		}

	}

	// Add methods for game-specific logic here
	// For example:
	// checkGameRequirements
	// Every game must include a checkGameRequirements function which returns TRUE if the game can be started
	// This function should be called by the host before starting the game
	checkGameRequirements() {
		console.log('Gauntlet::checkGameRequirements:', this.players.length, this.minplayers);
		return this.players.length >= this.minplayers;
	}


	// init is a required function for a class that extends Game
	// Called by room when the game is loaded into the room - allows game to perform initialisation before host/players load the game in clients
	async init(config) {
		console.log('Gauntlet::init:', config);
		this.round = null;
		this.question = null;
		this.started = false;
		this.startTime = null;
		this.mode = "ask";	// ask or answer - whether we are collecting answers or showing them
		this.liveStream = false; // whether we are in live stream mode or not (affects state machine - need to account for latency of the stream)

		// Config should pass a quiz ID to select the quiz to load
		// We load the quiz from DB using the passed ID (see api.quiz.js)
		if (config && config.quizID) {
			try {
				const thisQuizData = await QuizModel.getQuizByID(config.quizID);
				if (thisQuizData) {
					this.quizData = thisQuizData;
					console.log('Gauntlet::init: loaded quiz data:', this.quizData.title);
				}
			} catch (error) {
				console.error('Gauntlet::init: error loading quiz data for ID:', config.quizID, error);
			}
		}
	}

	// startGame is a required function for a class that extends Game
	// Called by room when it receives a host:requeststart from the host - this is the entry point to the game
	// Update: store a flag when started so that if host refreshes we can resume the game
	async startGame() {
		// Game start logic for game 1
		console.log('Gauntlet: startGame:', this.players, this.started);

		if (this.started) {
			console.log('Gauntlet::startGame: game already started, resuming...');
			// Resend intro quiz data so host can rebuild the quiz map
			this.introQuiz();
			// Resend current question if we are in a question state
			if (this.roundNumber > 0 && this.questionNumber > 0) {
				this.doQuestion();
			}
			return;
		}
		this.started = true;
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
		console.log('Gauntlet::endGame: clean up here...');

		// Not much to do here - we rely on room.js for all the heavy-lifting, game itself is pretty lightweight
	}

	isEnded() {
		return this.stateMachine.state === QuizState.CLOSING_CREDITS;
	}

	/**
	 * Determines if the existing game instance can be considered the same as the one requested.
	 * Used for refresh-resume logic in room.js.
	 */
	isSameGame(config) {
		if (!config || !config.quizID) return true;
		if (!this.quizData || !this.quizData._id) return false;
		return String(config.quizID) === String(this.quizData._id);
	}

	// onPlayerReconnect is a required function for a class that extends Game
	// Called by room when a player connects OR reconnects to the game
	// We need to resend any current question or answer state to the reconnected player
	// socket is the new socket for the (re)connected player
	onPlayerReconnect(player, socket) {

		console.log('Gauntlet::onPlayerReconnect:', player.sessionID, 'State:', this.stateMachine.state);

		// If we are currently in a question, send it to the reconnected player
		if (this.stateMachine.state === QuizState.COLLECT_ANSWERS) {
			
			// Check if player has already answered
			if (this.question && this.question.responses && this.question.responses[player.sessionID]) {
				console.log('Player already answered - client will remain in waiting state');
				return;
			}

			if (this.question) {
				// Prepare player question (logic duplicated from collectAnswers for now)
				let playerQuestion = {};
				playerQuestion.mode = 'ask';
				playerQuestion.direction = this.stateMachine.direction;
				playerQuestion.questionNumber = this.question.questionNumber;
				playerQuestion.type = this.question.type;
				playerQuestion.options = this.question.optionsShuffled;
				playerQuestion.items = this.question.itemsShuffled;
				playerQuestion.pairs = this.question.pairsShuffled;
				playerQuestion.extra = this.question.extra;
				if (playerQuestion.type == 'hotspot' || playerQuestion.type == 'point-it-out') {
					playerQuestion.image = this.question.image;
				}

				console.log('Re-sending question to reconnected player:', player.sessionID);
				socket.emit('server:question', playerQuestion, (acknowledgement) => {
					console.log('Acknowledgement from player:', player.sessionID, acknowledgement);
				});
			}
		}
		// If we are currently showing an answer, send it to the reconnected player
		if (this.stateMachine.state === QuizState.SHOW_ANSWER) {
			if (this.question) {
				let localQuestion = structuredClone(this.question);
				localQuestion.mode = 'answer';
				localQuestion.direction = this.stateMachine.direction;
				localQuestion.options = this.question.optionsShuffled;
				localQuestion.items = this.question.itemsShuffled;
				localQuestion.pairs = this.question.pairsShuffled;
				localQuestion.responses = this.question.responses;

				const scores = this.calculateQuestionScore(localQuestion);
				socket.emit('server:showanswer', { 'scores': scores });
			}
		}
	}


	// keyPressHandler
	// Recieves keypresses from the host and acts
	keypressHandler(socket, keyObject) {
		console.log('Gauntlet::keypressHandler:', keyObject);
		// If right or left arrow then step forward or back in the quiz
		// If SHIFT also pressed then jump to next/previous round
		if (keyObject.key == 'ArrowRight') {
			if (keyObject.shiftKey) {
				this.stateMachine.fastForward();
			} else {
				this.stateMachine.nextState();
			}
		}
		if (keyObject.key == 'ArrowLeft') {
			if (keyObject.shiftKey) {
				this.stateMachine.fastBackward();
			} else {
				this.stateMachine.previousState();
			}
		}
		if (keyObject.key == 'KeyS') {
			this.liveStream = !this.liveStream;
			console.log('Stream mode:', this.liveStream);
			this.room.emitToHosts('server:streammode', { enabled: this.liveStream });
		}
	}

	// introQuiz
	// Run introductory animation, plus run any set up data tasks
	introQuiz() {
		console.log('introQuiz:');

		// Create a map of the quiz structure for the host display
		const quizMap = this.quizData.rounds.map((round) => ({
			title: round.title,
			questionCount: round.questions.length,
			showAnswer: round.showAnswer,
			updateScores: round.updateScores
		}));

		this.room.emitToHosts('server:introquiz', {
			title: this.quizData.title,
			description: this.quizData.description,
			quizMap: quizMap
		}, true)
	}

	openingCredits() {
		console.log('openingCredits:');
		this.room.emitToHosts('server:openingcredits', {
			title: this.quizData.title,
			description: this.quizData.description
		}, true);
	}

	// introRound
	// Similar to introQuiz - runs at the beginning of each round
	// Note: this function expects this.round to hold the round to intro (is this the best pattern?)
	introRound() {
		console.log('introRound:');
		this.round = this.quizData.rounds[this.roundNumber - 1];
		this.questionNumber = 0;

		// Check if we are overriding question/answer types for this round (not used yet)
		const typeOverride = (this.round.type && this.round.type != this.quizData.type);

		// Return the Promise from emitToHosts back to the caller
		this.room.emitToHosts('server:introround', { roundnumber: this.roundNumber, title: this.round.title, description: this.round.description, duration: 8 }, true)
	}

	// nextRound
	// A function that can be called to start a round
	// Function returns true/false if there are more rounds
	moveToNextRound() {
		if (this.roundNumber < this.quizData.rounds.length) {
			this.roundNumber++;
			this.questionNumber = 0;
			return true;
		}
		return false;
	}

	// moveToPreviousRound - reverse of moveToNextRound
	moveToPreviousRound() {
		if (this.roundNumber > 1) {
			this.roundNumber--;
			const round = this.quizData.rounds[this.roundNumber - 1];
			this.questionNumber = round.questions.length;
			return true;
		}
		return false;
	}

	// nextQuestion
	// Similar to nextRound above - returns true/false if there are no more questions in this round
	moveToNextQuestion() {
		const round = this.quizData.rounds[this.roundNumber - 1];
		if (this.questionNumber < round.questions.length) {
			this.questionNumber++;
			return true;
		}
		return false;
	}

	// moveToPreviousQuestion - reverse of moveToNextQuestion
	// At end of round this.questionNumber will be the length of the questions array
	moveToPreviousQuestion() {
		console.log('moveToPreviousQuestion:', this.questionNumber);
		if (this.questionNumber > 1) {
			this.questionNumber--;
			return true;
		}
		return false;
	}

	// copyQuestionForMutating
	// Used when asking questions - make a full copy of the question which will be used for sending to host/players
	// Copy is mutated to eg shuffle option arrays for variety
	// Plus copy can have answer removed if necessary
	prepareMutatedQuestion(question) {

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
	// A general function that will do everything needed to present the supplied question
	// It doesn't know anything outside of the question it is given
	// Perform any question-specific set-up (eg setting up the correct answer if needed)
	// Mode is the form of the question - asking it or showing the question and answer
	doQuestion() {

		console.log('doQuestion:', this.roundNumber, this.questionNumber);
		this.round = this.quizData.rounds[this.roundNumber - 1];

		// this.question holds a pointer into the master quizData to allow mutating for storing results
		this.question = this.round.questions[this.questionNumber - 1];

		// Add the general quiz state to the question - do this before copying the question
		this.question.questionNumber = this.questionNumber;

		console.log('doQuestion: preparing question:', this.mode, this.questionNumber, this.question);
		
		// Prepare the question by mutating answer options
		// Function also sets up the question.answer since sometimes the answer is derived from the question data (eg first item in options array)
		this.prepareMutatedQuestion(this.question);

		let hostQuestion = structuredClone(this.question);
		hostQuestion.mode = this.mode;
		hostQuestion.direction = this.stateMachine.direction;
		hostQuestion.roundNumber = this.roundNumber;
		hostQuestion.options = this.question.optionsShuffled;
		hostQuestion.items = this.question.itemsShuffled;
		hostQuestion.pairs = this.question.pairsShuffled;
		delete hostQuestion.answer;
		delete hostQuestion.optionsShuffled;
		delete hostQuestion.itemsShuffled;
		delete hostQuestion.pairsShuffled;

		// Add timestamp before sending
		const questionSentTime = Date.now();
		const callback = ((acknowledgement) => {
			const roundTripTime = Date.now() - questionSentTime;
			console.log('Host acknowledged question display:', acknowledgement, 'RTT (ms):', roundTripTime);
		}).bind(this);

		console.log('doQuestion:', this.mode, this.questionNumber, this.question, hostQuestion);
		this.room.emitToHosts('server:question', hostQuestion);

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

	waitingForStream() {
		console.log('waitingForStream:');
		this.room.emitToHosts('server:waitingforstream', { questionNumber: this.questionNumber });
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
		playerQuestion.options = this.question.optionsShuffled;
		playerQuestion.items = this.question.itemsShuffled;
		playerQuestion.pairs = this.question.pairsShuffled;
		playerQuestion.extra = this.question.extra;
		// Include the image if it is required for the answer (hotspot, point-it-out)
		if (playerQuestion.type == 'hotspot' || playerQuestion.type == 'point-it-out') {
			playerQuestion.image = this.question.image;
		}

		console.log('collectAnwers:', this.question, playerQuestion);
		const responseHandler = (socket, response) => {
			console.log('gauntlet.responseHandler:', socket.id, response);
			const player = this.room.getPlayerBySocketID(socket.id);
			if (player) {
				this.question.responses[player.sessionID] = {
					answer: response.answer,
					time: response.answerTime,
					score: 0
				};
				this.room.emitToHosts('server:questionanswered', { sessionID: player.sessionID, response: response });
			}
		}
		const strategy = {
			responseHandler: responseHandler,
			timeoutSeconds: 10
		}
		this.room.registerClientResponseHandler(responseHandler);

		// Add timestamp before sending
		const questionSentTime = Date.now();

		this.room.emitToAllPlayers("server:question", playerQuestion, (acknowledgement) => {
			const roundTripTime = Date.now() - questionSentTime;
			console.log('Player acknowledged question:', acknowledgement, 'RTT (ms):', roundTripTime);
		});

		if (this.round.roundTimer > 0) {
			this.roundTimerID = setTimeout(() => {
				this.roundTimerID = null;
				this.stateMachine.nextState();
			}, this.round.roundTimer * 1000);
			this.room.emitToHosts('server:starttimer', { duration: this.round.roundTimer });
			this.room.emitToAllPlayers('server:starttimer', { duration: this.round.roundTimer });
		}

		// Also send a message to the host so they can indicate that we are waiting for players to answer
		// This is currently only used when live streaming so that host display can remove the stream latency indicator
		this.room.emitToHosts('server:collectanswers', { questionNumber: this.questionNumber });
	}

	// showAnswer
	// Sends the full question to server (and maybe players) with the correct answer plus results
	showAnswer() {

		// For some question types (eg hotspot) the determining of the correct answer is harder
		// For now lets just do it with the basic questions and add other types later...
		// Calculate the player answers and append to this.question for completion
		let localQuestion = structuredClone(this.question);
		localQuestion.mode = 'answer';
		localQuestion.direction = this.stateMachine.direction;
		localQuestion.options = this.question.optionsShuffled;
		localQuestion.items = this.question.itemsShuffled;
		localQuestion.pairs = this.question.pairsShuffled;

		// Don't forget to include the question results
		localQuestion.responses = this.question.responses;

		console.dir('showAnswer:', localQuestion);
		this.room.emitToHosts('server:showanswer', localQuestion);

		// For now also just send same event to all players - QuizPlayScene will decide what to display
		// Special cases such as the one below will need to be catered for here... for now just send to all
		this.room.emitToAllPlayers('server:showanswer', localQuestion);

		// Special case for draw questions - we show all answers on the host screen but send each player a different player's answer and get them to score it
		if (this.question.type === 'draw') {
			// this.submitToPlayersForScoring(localQuestion);
		} else {
			const scores = this.calculateQuestionScore(localQuestion);
			this.question.scores = scores; // Store scores on the question for later stat processing
			console.log('showAnswer: calculated scores:', scores);
			this.room.emitToAllPlayers('server:showanswer', { 'scores': scores });
		}
	}

	doesQuestionNeedMarking() {
		// For now only draw questions need marking
		if (this.question.type === 'draw') {
			return true;
		}
		return false;
	}

	// submitToPlayersForScoring
	// For draw questions we want to divide up all the answers and distribute them to players for scoring
	submitToPlayersForScoring(question) {

		console.log('server.gauntlet:: submitToPlayersForScoring:', question);
		if (!question.responses) {
			console.log('server.gauntlet:: submitToPlayersForScoring: no responses to score');
			return;
		}
		
		// We need to send each player a different answer to score, from the players who answered the question
		const players = question.responses ? this.room.players.filter(player => question.responses[player.sessionID]) : [];
		console.log('server.gauntlet:: submitToPlayersForScoring: players:', players.length, players);
		if (players.length === 0) {
			console.log('server.gauntlet:: submitToPlayersForScoring: no players answered the question, skipping draw scoring');
			return;
		}
		// For now we just send the second player answer to the first player, third to the second, etc.
		// Last player gets the first player's answer
		// First set up a response handler to collect the scores
		const responseHandler = (socket, response) => {
			console.log('server.gauntlet::submitToPlayersForScoring: responseHandler:', socket.id, response);
			const player = this.room.getPlayerBySocketID(socket.id);
			// We need to map this response back to the correct player
			if (player && question.responses[player.sessionID]) {
				const index = players.findIndex(p => p.sessionID === player.sessionID);
				if (index >= 0) {
					const targetPlayer = players[index + 1] || players[0];
					question.responses[targetPlayer.sessionID].score = response * 1000;
				}
				console.log('server.gauntlet::submitToPlayersForScoring: updated question responses:', question.responses);
			}
		}

		players.forEach((player, index) => {
			const playerAnswer = question.responses[player.sessionID];
			const targetPlayer = players[index - 1] || players[players.length - 1];
			console.log('server.gauntlet::submitToPlayersForScoring: sending answer to player:', player.sessionID, 'target:', targetPlayer, 'answer:', playerAnswer);
			if (playerAnswer) {
				this.room.emitToPlayers([targetPlayer.socketID], 'server:drawquestionscore', { playerAnswer });
			}
		});
	}

	// updateScores
	// We have shown the correct answer to the players, now time to update the scores
	// Note: we only calculate the scores at this point since some scoring relies on knowing all the player results (eg hotspot)
	// IMPORTANT: if questions need further processing before a score can be calculated then that MUST be done before calling this function!
	// This function assumes scores have ALREADY been stored in question.results
	updateScores() {
		console.log('server.gauntlet:: updateScores:', this.roundNumber, this.questionNumber);

		const scores = this.calculateCumulativeScore();
		console.log('updateScores:', scores);
		this.room.emitToHosts('server:updatescores', { 'scores': scores });
	}

	// calculateCumulativeScore
	// Uses the current round and question number and loops through all questions up to this point
	// returns a scores object, keyed on player sessionID with cumulative score as value
	calculateCumulativeScore() {

		// Function to add values from dict2 to dict1
		function addDictionaries(dict1, dict2) {
			for (const key in dict2) {
				if (dict2.hasOwnProperty(key)) {
					// If the key exists in dict1, add the value from dict2
					// Otherwise, initialize it with the value from dict2
					dict1[key] = (dict1[key] || 0) + dict2[key];
				}
			}
		}

		// we iterate through ALL questions up to current question performing the calculation on each question
		// Note: this doesn't attempt to maintain a running total - simply regenerate the totals whenever needed (simpler)
		// AND force every player to have 0 to start - force 0
		var scores = {};
		this.players.forEach(player => {
			scores[player.sessionID] = 0;
		});
		for (var i = 0; i < this.roundNumber; i++) {
			const lastQuestion = (i == this.roundNumber - 1) ? this.questionNumber : this.quizData.rounds[i].questions.length;
			for (var j = 0; j < lastQuestion; j++) {
				const scoreQuestion = this.calculateQuestionScore(this.quizData.rounds[i].questions[j]);
				addDictionaries(scores, scoreQuestion);
				console.log('Round Question:', i, j);
				console.log('Responses:', this.quizData.rounds[i].questions[j].responses);
				console.log('Question:', scoreQuestion);
				console.log('Scores:', scores);
			}
		}
	
		return scores;
	}

	// calculateQuestionScore
	// For a single question we have all the player's answers stored in question.results
	// This is a dictionary, keyed on player sessionID, with the value being the answer
	// Each question type has its own scoring method - principle is the same:
	// Loop through the keys of the results dictionary calculating a score for each player
	calculateQuestionScore(question) {
		console.log('calculateQuestionScore:', question);

		var scores = {};

		// Just in case we arrive here and we have not collected any results then initialize the responses object
		if (!question.responses) {
			question.responses = {};
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

		// Gauntlet scoring helper: 1000 base + up to 1000 speed bonus
		const calculateGauntletPoints = (sessionID) => {
			const baseScore = 1000;
			const timeTaken = question.responses && question.responses[sessionID] ? question.responses[sessionID].time : 0;
			const maxTime = this.round && this.round.roundTimer > 0 ? this.round.roundTimer * 1000 : 10000; // default 10s if not set
			
			const speedBonus = Math.max(0, Math.floor(1000 * (1 - (timeTaken / maxTime))));
			return baseScore + speedBonus;
		}

		switch (question.type) {

			case 'text':
				const simpleAnswerText = createSimpleString(question.answer);
				Object.keys(question.responses).forEach((sessionID) => {
					const simpleResult = createSimpleString(question.responses[sessionID].answer);
					if (levenshteinDistance(simpleAnswerText, simpleResult) < 3) {
						const score = calculateGauntletPoints(sessionID);
						question.responses[sessionID].score = score;
						scores[sessionID] = score;
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
						const score = calculateGauntletPoints(sessionID);
						question.responses[sessionID].score = score;
						scores[sessionID] = score;
					}
				});
				break;

			case 'number-closest':
				// Calculate distance from correct answer using objects with named properties
				var distances = [];
				Object.keys(question.responses).forEach((sessionID) => {
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
					// Award 2000 points (2 points * 1000) to any players tied for first place
					for (let i = 0; i < distances.length; i++) {
						if (distances[i].distance === distances[0].distance) {
							const score = 2000;
							question.responses[distances[i].sessionID].score = score;
							scores[distances[i].sessionID] = score;
							nextPlayer = i + 1;
						} else {
							break;
						}
					}
				}

				// If we have more players, award 1000 points to the next level
				if (distances.length > nextPlayer) {
					const secondPlaceDistance = distances[nextPlayer].distance;
					for (let i = nextPlayer; i < distances.length; i++) {
						if (distances[i].distance === secondPlaceDistance) {
							const score = 1000;
							question.responses[distances[i].sessionID].score = score;
							scores[distances[i].sessionID] = score;
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
				if (responseKeys.length === 0) break;

				responseKeys.forEach((sessionID) => {
					total += parseFloat(question.responses[sessionID].answer);
				});
				question.answer = Math.floor(total / responseKeys.length);
				
				var distances = [];
				responseKeys.forEach((sessionID) => {
					distances.push({
						sessionID: sessionID,
						distance: Math.abs(parseFloat(question.responses[sessionID].answer) - parseFloat(question.answer))
					});
				});

				// Sort by distance (ascending)
				distances = distances.sort((a, b) => a.distance - b.distance);

				// Closest gets 2 points, next 1 point
				console.log('number-average:', question.answer, question.responses, distances);

				var nextPlayerAvg = 1;
				if (distances.length > 0) {
					for (let i = 0; i < distances.length; i++) {
						if (distances[i].distance === distances[0].distance) {
							const score = 2000;
							question.responses[distances[i].sessionID].score = score;
							scores[distances[i].sessionID] = score;
							nextPlayerAvg = i + 1;
						} else {
							break;
						}
					}
				}

				if (distances.length > nextPlayerAvg) {
					const secondPlaceDistance = distances[nextPlayerAvg].distance;
					for (let i = nextPlayerAvg; i < distances.length; i++) {
						if (distances[i].distance === secondPlaceDistance) {
							const score = 1000;
							question.responses[distances[i].sessionID].score = score;
							scores[distances[i].sessionID] = score;
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
					var count = 0;
					console.log('calculateQuestionScore: ordering:', question.answer, question.responses[sessionID].answer);
					for (let i = 0; i < length; i++) {
						console.log(question.answer[i], question.responses[sessionID].answer[i]);
						if (question.answer[i] == question.responses[sessionID].answer[i]) {
							count++; // Increment score for matching elements
						}
					}
					// You don't score for the final item since this is a given
					if (count == question.answer.length) count--;
					
					// Score is 1000 per correct item.
					const score = count * 1000;
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
					question.responses[firstSessionID].score = 2000;
					scores[firstSessionID] = 2000;
				}
				if (hotspotDistances.length > 1) {
					const secondSessionID = hotspotDistances[1][0];
					question.responses[secondSessionID].score = 1000;
					scores[secondSessionID] = 1000;
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
						const score = calculateGauntletPoints(sessionID);
						question.responses[sessionID].score = score;
						scores[sessionID] = score;
					}
				});
				break;

			case 'draw':
				Object.keys(question.responses).forEach((sessionID) => {
					if (question.responses[sessionID].answer && question.responses[sessionID].answer.score) {
						const score = question.responses[sessionID].answer.score * 1000;
						question.responses[sessionID].score = score;
						scores[sessionID] = score;
					}
				});
				break;

		}

		return scores;
	}

	// endQuestion
	// General-purpose function to tidy up after a question has been asked and answers given
	// Specifically: deregister the client responder so we don't catch unwanted answers in between other states
	endQuestion() {
		console.log('endQuestion:', this.question);
		this.room.emitToAllPlayers('server:endquestion');
		this.room.deregisterClientResponseHandler();
		// Also send to host so they can perform any relevant clean-up
		this.room.emitToHosts('server:endquestion');
	}

	// Called when we've reached the end of the questions in this round
	// We still need to decide if we need to show answers and/or update scores
	// Only after those steps have completed (if necessary) will we actually end the round
	endRound() {
		console.log('endRound:', this.mode, this.round);

		// TODO - decide whether to mark the answers now or wait...
		// If marked then add a note to this round to signify it has been marked (so that multiple rounds can be marked together)
		var information = {
			title: 'End of Round'
		}

		// Message partly depends on the mode ask/answer and the round meta-data showAnswer/updateScores
		if (this.mode == 'ask' && this.round.showAnswer == "round") {
			information.description = "Let's see how you got on - here are the answers...";
		} else if (this.round.updateScores == "round") {
			information.description = "Ok, let's update the scores";
		} else if (this.mode == 'ask' && this.round.showAnswer == "question") {
			this.stateMachine.nextState();
			return;
		} else {
			information.description = "Let's move on...";
		}
		this.room.emitToHosts('server:endround', information)
	}

	async endQuiz() {
		const scores = this.calculateCumulativeScore();
		console.log('endQuiz:', this.quizData, this.roundNumber, this.questionNumber, scores);
		this.room.emitToHosts('server:endquiz', { quizTitle: this.quizData.title, scores: scores });

		// Save results to database
		try {
			const hostID = this.room.host ? this.room.host.userID : null;
			const duration = this.startTime ? Math.floor((new Date() - this.startTime) / 1000) : 0;
			
			const session = await GameSession.create({
				gameType: 'gauntlet',
				gameID: this.quizData._id,
				hostID: hostID,
				roomCode: this.room.id,
				startTime: this.startTime || new Date(),
				duration: duration,
				isLive: true,
				verificationLevel: (this.room.host && this.room.host.role === 'admin') ? 0 : 3,
				metadata: {
					title: this.quizData.title,
					totalRounds: this.quizData.rounds.length,
					totalQuestions: this.quizData.rounds.reduce((acc, r) => acc + r.questions.length, 0)
				}
			});

			this.lastSessionID = session._id;

			// Sort scores to determine rank
			const sortedScores = Object.entries(scores)
				.sort(([, a], [, b]) => b - a);

			const playerResults = sortedScores.map(([sessionID, score], index) => {
				const player = this.players.find(p => p.sessionID === sessionID);
				
				// NOTE: When calculating global question difficulty or aggregate stats, 
				// always filter out results where isBot is true to avoid polluting data.
				
				// Extract granular stats for this player
				const playerStats = {
					correctCount: 0,
					totalQuestions: 0,
					avgResponseTime: 0,
					responses: []
				};

				let totalTime = 0;
				let answeredCount = 0;

				this.quizData.rounds.forEach(round => {
					round.questions.forEach(question => {
						playerStats.totalQuestions++;
						const response = question.responses ? question.responses[sessionID] : null;
						
						if (response) {
							answeredCount++;
							if (response.time) totalTime += response.time;
							if (response.score > 0) playerStats.correctCount++;

							playerStats.responses.push({
								questionText: question.text,
								answer: response.answer,
								time: response.time,
								score: response.score || 0
							});
						}
					});
				});

				if (answeredCount > 0) {
					playerStats.avgResponseTime = totalTime / answeredCount;
				}

				return {
					gameSessionID: session._id,
					sessionID: sessionID, // This is the player's transient session ID
					userID: player ? player.userID : null,
					displayName: player ? player.name : 'Unknown',
					avatar: player ? player.avatar : null,
					isBot: player ? player.isBot : false,
					rank: index + 1,
					totalQuestions: playerStats.totalQuestions,
					totalCorrect: playerStats.correctCount,
					totalScore: score,
					responses: playerStats.responses
				};
			});

			if (playerResults.length > 0) {
				await PlayerResult.insertMany(playerResults);
				console.log(`Successfully saved ${playerResults.length} player results for session ${session._id}`);

				// Notify each player of their final rank and the top 3
				const top3 = playerResults.slice(0, 3).map(r => ({
					displayName: r.displayName,
					avatar: r.avatar,
					score: r.score,
					rank: r.rank
				}));

				playerResults.forEach(result => {
					console.log('playerResults:', result);
					const player = this.players.find(p => p.sessionID === result.sessionID);
					if (player && player.socketID) {
						console.log(`Notifying player ${player.name} of final rank ${result.rank}`);
						this.room.emitToPlayers([player.socketID], 'server:endquiz', {
							rank: result.rank,
							score: result.score,
							totalPlayers: playerResults.length
						});
					}
				});
			}
		} catch (err) {
			console.error('Error saving gauntlet results:', err);
		}
	}

	closingCredits() {
		console.log('closingCredits:');
		this.room.emitToHosts('server:closingcredits', {
			title: this.quizData.title
		});
		this.room.emitToAllPlayers('server:closingcredits', {
			title: this.quizData.title
		});
	}

async onPlayerRating(player, rating) {
		console.log('onPlayerRating:', player.name, rating);

		if (!this.lastSessionID) {
			console.error('onPlayerRating: Missing last session ID. Cannot save rating.');
			return;
		}
		if (!this.quizData?._id) {
			console.error('onPlayerRating: Missing quiz data _id. Cannot save rating.');
			return;
		}

		try {
			await QuizRating.findOneAndUpdate(
				{ gameSessionID: this.lastSessionID, playerSessionID: player.sessionID },
				{
					quizID: this.quizData._id,
					gameSessionID: this.lastSessionID,
					userID: player.userID || null,
					playerSessionID: player.sessionID,
					rating: rating.stars,
				},
				{ upsert: true, new: true }
			);
			console.log(`Successfully saved rating ${rating} for quiz ${this.quizData._id} from player ${player.name}`);
		} catch (error) {
			console.error('onPlayerRating: Error saving rating to DB:', error);
		}
	}

	getPlayers() {
		return this.players;
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
