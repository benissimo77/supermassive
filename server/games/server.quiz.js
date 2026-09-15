import Game from './server.game.js';
import QuizRating from '../models/mongo.quizRating.js';
import { escapeHtml } from '../utils/sanitize.js';

// For V2 QUIZ :
// import { QuizV2 as QuizModel} from '../models/mongo.quizv2.js';
// For V1 QUIZ :
import QuizModel from '../models/mongo.quiz.js';

const QuizState = {
	INIT: 'INIT',
	START_QUIZ: 'START_QUIZ',
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

class QuizStateMachine {

	constructor(quiz) {
		this.quiz = quiz;
		this.direction = 'forward';
		this.transitionTo(QuizState.INIT);
	}

	// General purpose function which advamces the state machine to the next state
	// Next state is determined by the current state
	nextState() {

		this.direction = 'forward';

		// This is a simple state machine - the next state is determined by the current state
		switch (this.state) {

			case QuizState.INIT:
				this.transitionTo(QuizState.START_QUIZ);
				break;

			case QuizState.START_QUIZ:
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

			case QuizState.START_QUIZ:
				this.quiz.startGame()
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
					this.transitionTo(QuizState.START_QUIZ);
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


export default class Quiz extends Game {

	constructor(room) {

		// Call the parent class constructor with the room instance
		// One thing the parent does is define this.room to the instance of room
		super(room);

		// Initialize other game-specific properties here
		console.log('Quiz::constructor:');
		this.name = 'quiz';
		this.minplayers = 0;
		this.maxplayers = 10;
		this.roundNumber = 0;
		this.questionNumber = 0;
		this.roundTimerID = null;

		// Instantiate the State Machine which will manage the game flow
		this.stateMachine = new QuizStateMachine(this);

		// Catch host keypresses
		this.room.registerHostKeypressHandler(this.keypressHandler.bind(this));

	}

	// Add methods for game-specific logic here
	// For example:
	// checkGameRequirements
	// Every game must include a checkGameRequirements function which returns TRUE if the game can be started
	// This function should be called by the host before starting the game
	checkGameRequirements() {
		console.log('Quiz::checkGameRequirements:', this.players.length, this.minplayers);
		return this.players.length >= this.minplayers;
	}


	// init is a required function for a class that extends Game
	// Called by room when the game is loaded into the room - allows game to perform initialisation before host/players load the game in clients
	// UPDATE: init now async as it supports loading of quiz data from DB - also returns a full config file which is passed to client for their initialization
	async init(config) {
		console.log('Quiz::init:', config);
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
					console.log('Quiz::init: loaded quiz data:', this.quizData.title);
				}
			} catch (error) {
				console.error('Quiz::init: error loading quiz data for ID:', config.quizID, error);
			}
		}

		// Return metadata for the "Waiting to Start Phase"
		return {
			title: this.quizData?.title || 'Untitled Quiz',
			description: this.quizData?.description || '',
			quizMap: this.quizData?.rounds?.map((round) => ({
				title: round.title,
				questionCount: round.questions.length,
				showAnswer: round.showAnswer,
				updateScores: round.updateScores
			})) || []
		};
	}

	// startGame is a required function for a class that extends Game
	// Update: store a flag when started so that if host refreshes we can resume the game
	// UPDATE: simplified it is not required but a useful state to represent the quiz truly starting
	startGame() {
		// Game start logic for game 1
		console.log('Quiz: startGame:', this.players, this.started);

		if (this.started) {
			console.log('Quiz::startGame: game already started, resuming...');

			// Resend current question if we are in a question state
			if (this.roundNumber > 0 && this.questionNumber > 0) {
				this.doQuestion();
			}
			return;
		}
		
		// Game NOT already started so start it now...
		this.started = true;
		this.startTime = new Date();

		// Initialize player scores to 0
		this.players.forEach(player => {
			player.score = 0;
		});

		// Since there is nothing to do immediately after starting, we can transition to the opening credits state
		this.stateMachine.nextState();
	}

	// endGame is a required function for a class that extends Game
	endGame() {
		console.log('Quiz::endGame: clean up here...');

		// Not much to do here - we rely on room.js for all the heavy-lifting, game itself is pretty lightweight
		// Clear game state - null out large objects
		this.quizData = null;
		this.question = null;
		this.stateMachine = null;
		this.players = [];
		this.room = null;
		// Any other clear up here...
		
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

		console.log('Quiz::onPlayerReconnect:', player.sessionID, 'State:', this.stateMachine.state);

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
				playerQuestion.optionsShuffled = this.question.optionsShuffled;
				playerQuestion.itemsShuffled = this.question.itemsShuffled;
				playerQuestion.leftItemsShuffled = this.question.leftItemsShuffled;
				playerQuestion.itemImagesShuffled = this.question.itemImagesShuffled;
				playerQuestion.extra = this.question.extra;
				// Ensure rightItems are sent to players (fallback to legacy pairs)
				let rightItems = this.question.rightItems;
				if ((!Array.isArray(rightItems)) && Array.isArray(this.question.pairs)) {
					rightItems = this.question.pairs.map((p) => ({ text: p.right }));
				}
				playerQuestion.rightItems = rightItems;
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
				localQuestion.optionsShuffled = this.question.optionsShuffled;
				localQuestion.itemsShuffled = this.question.itemsShuffled;
				localQuestion.leftItemsShuffled = this.question.leftItemsShuffled;
				localQuestion.responses = this.question.responses;

				const scores = this.calculateQuestionScore(localQuestion, this.round);
				socket.emit('server:showanswer', { 'scores': scores });
			}
		}
	}


	// keyPressHandler
	// Recieves keypresses from the host and acts
	keypressHandler(socket, keyObject) {
		console.log('Quiz::keypressHandler:', keyObject);
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

	openingCredits() {
		console.log('openingCredits:');
		
		// Collect some sample question texts to fly across the screen for "Juice"
		const samples = [];
		this.quizData.rounds.forEach(round => {
			round.questions.forEach(q => {
				if (q.text && q.text.length < 100) samples.push(q.text);
			});
		});

		samples.push('What is the capital of France?');
		samples.push('Who won the 2025 World Series of Poker Main Event?');
		samples.push('Draw a picture of a cat');
		samples.push('Match these items together');
		samples.push('Place these events in order');
		samples.push('True or False: The sky is blue');
		samples.push('Which planet is known as the Red Planet?');
		// Shuffle and pick 10
		const shuffledSamples = samples.sort(() => 0.5 - Math.random()).slice(0, 10);

		// UPDATE: for now we are not showing the opening credits on the host...
		// this.room.emitToHosts('server:openingcredits', {
		// 	title: this.quizData.title,
		// 	description: this.quizData.description,
		// 	samples: shuffledSamples
		// }, true);

		// So immediately move to next state
		this.stateMachine.nextState();
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
		console.log('No previous round - resetting round/question numbers...');
		this.roundNumber = 0;
		this.questionNumber = 0;
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

	// prepareMutatedQuestion
	// Used when asking questions - make a full copy of the question which will be used for sending to host/players
	// Copy is mutated to eg shuffle option arrays for variety
	// Plus copy can have answer removed if necessary
	prepareMutatedQuestion(question) {

		// If we've already prepared this question (eg by going back/forward) then don't do it again
		if (question.optionsShuffled || question.pairsShuffled || question.leftItemsShuffled || question.itemsShuffled) {
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
				// Support new data model: leftItems / rightItems (arrays of { text, image? })
				let leftItems = localQuestion.leftItems;
				let rightItems = localQuestion.rightItems;
				// Fallback to legacy `pairs` model if necessary
				if ((!Array.isArray(leftItems) || !Array.isArray(rightItems)) && Array.isArray(localQuestion.pairs)) {
					leftItems = localQuestion.pairs.map((p, i) => ({ text: p.left, image: (localQuestion.itemImages && localQuestion.itemImages[i]) || undefined }));
					rightItems = localQuestion.pairs.map((p) => ({ text: p.right }));
				}
				leftItems = leftItems || [];
				rightItems = rightItems || [];

				// The canonical 'answer' for matching remains the list of left item texts
				const leftTexts = leftItems.map(li => li.text ?? '');
				question.answer = [...leftTexts];

				// Shuffle only the LEFT items and keep rightItems intact
				const shuffledLeftItems = shuffleArray([...leftItems]);
				// Expose shuffled left side for hosts/players
				question.leftItemsShuffled = shuffledLeftItems;

				// Maintain backward-compatible itemImagesShuffled if legacy itemImages present
				if (localQuestion.itemImages && localQuestion.itemImages.length > 0) {
					const imageMap = {};
					leftItems.forEach((li, i) => { imageMap[li.text] = localQuestion.itemImages[i]; });
					question.itemImagesShuffled = shuffledLeftItems.map(li => imageMap[li.text] || '');
				}
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

		// this.question holds a pointer into the master quizData to allow mutating for storing player responses and scores
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
		hostQuestion.optionsShuffled = this.question.optionsShuffled;
		hostQuestion.itemsShuffled = this.question.itemsShuffled;
		hostQuestion.leftItemsShuffled = this.question.leftItemsShuffled;
		// Include rightItems for host display when using new matching schema
		let hostRightItems = this.question.rightItems;
		if ((!Array.isArray(hostRightItems)) && Array.isArray(this.question.pairs)) {
			hostRightItems = this.question.pairs.map((p) => ({ text: p.right }));
		}
		hostQuestion.rightItems = hostRightItems;

		// UPDATE: we DON'T delete hostQuestion.items and hostQuestion.pairs because they MIGHT have associated images
		// and we need the original array to identify where in the original items array they are found...

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

		console.log('doQuestion:', this.mode, this.questionNumber, this.question, hostQuestion);
		this.room.emitToHosts('server:question', hostQuestion);

		// In cases where we are live streaming we DON'T want to move to the next state automatically
		// Moving to next state automatically would mean sending players the question - happens the moment host has completed displaying the question
		// So only do this if we are NOT live streaming
		// OR when answering the question - even live streaming we can still show the answer straight away
		if (!this.liveStream || this.mode === 'answer') {
			this.room.registerHostResponseHandler((socket, response) => {
				this.room.deregisterHostResponseHandler();
				this.stateMachine.nextState();
			});
		}
	}

	handleOverrule(answer, isCorrect) {
		console.log(`Quiz::handleOverrule: answer="${answer}", isCorrect=${isCorrect}`);
		if (!this.question) {
			console.warn('Quiz::handleOverrule: No active question');
			return;
		}

		if (!this.question.alternativeAnswers) {
			this.question.alternativeAnswers = [];
		}

		const cleanAnswer = String(answer).trim().toLowerCase();
		const currentAnswer = String(this.question.answer).trim().toLowerCase();

		if (isCorrect) {
			// Add to alternativeAnswers if not already there and not the main answer
			if (cleanAnswer !== currentAnswer && !this.question.alternativeAnswers.includes(cleanAnswer)) {
				this.question.alternativeAnswers.push(cleanAnswer);
			}
		} else {
			// Remove from alternativeAnswers if it was there
			this.question.alternativeAnswers = this.question.alternativeAnswers.filter(a => a !== cleanAnswer);
		}

		// Update all hosts with the new overrule state so they can update their UI
		this.room.emitToHosts('server:hostaction', {
			action: 'overrule',
			answer: answer,
			isCorrect: isCorrect
		});
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
		playerQuestion.optionsShuffled = this.question.optionsShuffled;
		playerQuestion.itemsShuffled = this.question.itemsShuffled;
		playerQuestion.leftItemsShuffled = this.question.leftItemsShuffled;
		playerQuestion.itemImagesShuffled = this.question.itemImagesShuffled;
		playerQuestion.extra = this.question.extra;

		// Ensure rightItems are sent to players (fallback to legacy pairs)
		let rightItems = this.question.rightItems;
		if ((!Array.isArray(rightItems)) && Array.isArray(this.question.pairs)) {
			rightItems = this.question.pairs.map((p) => ({ text: p.right }));
		}
		playerQuestion.rightItems = rightItems;
		// Include the image if it is required for the answer (hotspot, point-it-out)
		if (playerQuestion.type == 'hotspot' || playerQuestion.type == 'point-it-out') {
			playerQuestion.image = this.question.image;
		}

		console.log('collectAnwers:', this.question, playerQuestion);
		const responseHandler = (socket, response) => {
			console.log('quiz.responseHandler:', socket.id, response);
			const player = this.room.getPlayerBySocketID(socket.id);
			if (player) {
				// Clean once, at the point of entry, so every later use (host display, player-facing broadcasts,
				// stored PlayerResult analysis) inherits safe data. Non-string answers (numbers/booleans/coords) pass through untouched.
				const cleanAnswer = typeof response.answer === 'string' ? escapeHtml(response.answer) : response.answer;
				this.question.responses[player.sessionID] = {
					answer: cleanAnswer,
					time: response.answerTime,
					score: 0 // Initialized, will be calculated later
				};
				this.room.emitToHosts('server:questionanswered', { sessionID: player.sessionID, response: { ...response, answer: cleanAnswer } });
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
		localQuestion.options = this.question.options;
		localQuestion.optionsShuffled = this.question.optionsShuffled;
		localQuestion.items = this.question.items;
		localQuestion.itemsShuffled = this.question.itemsShuffled;
		// Prefer new leftItems/rightItems model but fall back to legacy pairs
		localQuestion.leftItems = this.question.leftItems;
		localQuestion.rightItems = this.question.rightItems;
		if ((!Array.isArray(localQuestion.leftItems) || !Array.isArray(localQuestion.rightItems)) && Array.isArray(this.question.pairs)) {
			localQuestion.leftItems = this.question.pairs.map((p, i) => ({ text: p.left, image: (this.question.itemImages && this.question.itemImages[i]) || undefined }));
			localQuestion.rightItems = this.question.pairs.map((p) => ({ text: p.right }));
		}
		localQuestion.leftItemsShuffled = this.question.leftItemsShuffled;

		// Don't forget to include the question responses
		localQuestion.responses = this.question.responses;

		// Calculate scores and derived answers (like number-average) BEFORE emitting to Host
		if (this.question.type !== 'draw') {
			this.calculateQuestionScore(localQuestion, this.round);
			// Sync derived values back to original question object
			this.question.answer = localQuestion.answer;
		}

		console.dir('showAnswer:', localQuestion);
		this.room.emitToHosts('server:showanswer', localQuestion);

		// Since we now have the chance that host wants to overrule a player score we need a host response handler
		// We also have the Ordering question that steps through so we have two host response events to deal with here
		this.room.registerHostResponseHandler((socket, response) => {
			console.log('HostResponseHandler received:', response);
			if (response && response.action) {
				if (response.action === 'overrule') {
					this.handleOverrule(response.answer, response.isCorrect);
				} else if (response.action === 'nextRevealStep') {
					// Simply relay the "step" request to all hosts
					this.room.emitToHosts('server:hostaction', { action: 'nextRevealStep' });
				}
			}
		});

		// For now also just send same event to all players - QuizPlayScene will decide what to display
		// Special cases such as the one below will need to be catered for here... for now just send to all
		this.room.emitToAllPlayers('server:showanswer', localQuestion);

		// Special case for draw questions - we show all answers on the host screen but send each player a different player's answer and get them to score it
		if (this.question.type === 'draw') {
			// this.submitToPlayersForScoring(localQuestion);
		} else {
			// Scoring already done above for non-draw questions
			console.log('showAnswer: updated responses with scores:', localQuestion.responses);
			// Send a focused update of responses/scores to all players
			this.room.emitToAllPlayers('server:showanswer', { 'responses': localQuestion.responses });
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

		console.log('server.quiz:: submitToPlayersForScoring:', question);
		if (!question.responses) {
			console.log('server.quiz:: submitToPlayersForScoring: no responses to score');
			return;
		}
		
		// We need to send each player a different answer to score, from the players who answered the question
		const players = question.responses ? this.room.players.filter(player => question.responses[player.sessionID]) : [];
		console.log('server.quiz:: submitToPlayersForScoring: players:', players.length, players);
		if (players.length === 0) {
			console.log('server.quiz:: submitToPlayersForScoring: no players answered the question, skipping draw scoring');
			return;
		}
		// For now we just send the second player answer to the first player, third to the second, etc.
		// Last player gets the first player's answer
		// First set up a response handler to collect the scores
		const responseHandler = (socket, response) => {
			console.log('server.quiz::submitToPlayersForScoring: responseHandler:', socket.id, response);
			const player = this.room.getPlayerBySocketID(socket.id);
			// We need to map this response back to the correct player
			if (player && question.responses[player.sessionID]) {
				const index = players.findIndex(p => p.sessionID === player.sessionID);
				if (index >= 0) {
					const targetPlayer = players[index + 1] || players[0];
					question.responses[targetPlayer.sessionID].score = response;
				}
				console.log('server.quiz::submitToPlayersForScoring: updated question responses:', question.responses);
			}
		}

		players.forEach((player, index) => {
			const playerAnswer = question.responses[player.sessionID];
			const targetPlayer = players[index - 1] || players[players.length - 1];
			console.log('server.quiz::submitToPlayersForScoring: sending answer to player:', player.sessionID, 'target:', targetPlayer, 'answer:', playerAnswer);
			if (playerAnswer) {
				this.room.emitToPlayers([targetPlayer.socketID], 'server:drawquestionscore', { playerAnswer });
			}
		});
	}

	// updateScores
	// We have shown the correct answer to the players, now time to update the scores
	// Note: we only calculate the scores at this point since some scoring relies on knowing all the player results (eg hotspot)
	// IMPORTANT: if questions need further processing before a score can be calculated then that MUST be done before calling this function!
	// This function assumes scores have ALREADY been stored in question.responses
	updateScores() {
		console.log('server.quiz:: updateScores:', this.roundNumber, this.questionNumber);

		const scores = this.calculateCumulativeScore();
		console.log('updateScores:', scores);
		this.room.emitToHosts('server:updatescores', { 'scores': scores });

		// Log some basic results of this round to the console
		this.printRoundSummary();

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
			const currentRound = this.quizData.rounds[i];
			const lastQuestion = (i == this.roundNumber - 1) ? this.questionNumber : currentRound.questions.length;
			for (var j = 0; j < lastQuestion; j++) {
				const scoreQuestion = this.calculateQuestionScore(currentRound.questions[j], currentRound);
				addDictionaries(scores, scoreQuestion);
				console.log('Round Question:', i, j);
				console.log('Responses:', currentRound.questions[j].responses);
				console.log('Question:', scoreQuestion);
				console.log('Scores:', scores);
			}
		}
	
		return scores;
	}

	// calculateQuestionScore
	// For a single question we have all the player's answers stored in question.responses
	// This is a dictionary, keyed on player sessionID, with the value being the answer
	// Each question type has its own scoring method - principle is the same:
	// Loop through the keys of the responses dictionary calculating a score for each player
	calculateQuestionScore(question, round) {
		console.log('calculateQuestionScore:', question);

		var scores = {};

		// Just in case we arrive here and we have not collected any responses then initialize the responses object
		if (!question.responses) {
			question.responses = {};
		}

		// For scoring method snooze - if player has snoozed then we ignore their answer for this question
		// Better to remove right away so they take no part in the scoring
		if (round.scoreMethod === 'snooze') {
			// Find the response with the highest time (ie the last response) and mark it as snoozed
			// Note: we must consider that a team didn't answer at all - in which case they are the snoozer
			// In this case we don't need to make any of the responses as snoozed since non-answering player negates the need to snooze anyone here
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
				// Map alternativeAnswers to simple strings for comparison
				let validAnswers = [];
				if (question.alternativeAnswers) {
					validAnswers = question.alternativeAnswers.map(a => createSimpleString(a));
				}
				validAnswers.push(createSimpleString(question.answer));

				Object.keys(question.responses).forEach((sessionID) => {
					const simpleResult = createSimpleString(question.responses[sessionID].answer);

					// Check against all valid answers in the array
					const isCorrect = validAnswers.some(ans => levenshteinDistance(ans, simpleResult) < 2);

					if (isCorrect) {
						console.log('Correct answer for sessionID:', sessionID, 'answer:', question.responses[sessionID].answer);
						question.responses[sessionID].score = 1;
						scores[sessionID] = 1;
					} else {
						console.log('Incorrect answer for sessionID:', sessionID, 'answer:', question.responses[sessionID].answer);
						question.responses[sessionID].score = 0;
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
		if (round && round.scoreMethod === 'snooze') {
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
		this.room.emitToAllPlayers('server:endquestion');
		this.room.deregisterClientResponseHandler();
		// Also send to host so they can perform any relevant clean-up
		this.room.emitToHosts('server:endquestion');
	}

	// Outputs a tabular summary of the current round to the console
	printRoundSummary() {
		if (!this.round || !this.round.questions) return;

		console.log(`\n=== SUMMARY: ROUND ${this.roundNumber} - ${this.round.title || ''} ===`);
		const summary = {};

		this.round.questions.forEach((q, index) => {
			let qText = q.text || q.question || q.title || "Question";
			if (qText.length > 28) qText = qText.substring(0, 26).replace(/\s+/g, ' ') + '..';

			const row = {};

			this.players.forEach(player => {
				const response = q.responses && q.responses[player.sessionID];
				const score = response && response.score !== undefined ? response.score : 0;
				
				// Handle object answers (like coordinates or arrays) gracefully
				let answer = '-';
				if (response && response.answer !== undefined) {
					answer = typeof response.answer === 'object' ? JSON.stringify(response.answer) : String(response.answer);
					// Strip any unwanted quote marks for cleaner console readability
					answer = answer.replace(/["']/g, '');
				}

				// Truncate answer to keep column neat
				if (answer.length > 29) answer = answer.substring(0, 29) + '..';

				// Combine score and answer. e.g "1 | my answ.."
				const colName = player.name || player.sessionID.substring(0, 5);
				row[colName] = `${score} ${answer}`;
			});

			summary[`Q${index + 1}: ${qText}`] = row;
		});

		console.table(summary);
		console.log('====================================\n');
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

	// Outputs a tabular summary of the current round to the console
	printRoundSummary() {
		if (!this.round || !this.round.questions) return;

		console.log(`\n=== SUMMARY: ROUND ${this.roundNumber} - ${this.round.title || ''} ===`);
		const summary = {};

		this.round.questions.forEach((q, index) => {
			let qText = q.text || q.question || q.title || "Question";
			if (qText.length > 28) qText = qText.substring(0, 26).replace(/\s+/g, ' ') + '..';

			const row = {};

			this.players.forEach(player => {
				const response = q.responses && q.responses[player.sessionID];
				const score = response && response.score !== undefined ? response.score : 0;
				
				// Handle object answers (like coordinates or arrays) gracefully
				let answer = '-';
				if (response && response.answer !== undefined) {
					answer = typeof response.answer === 'object' ? JSON.stringify(response.answer) : String(response.answer);
					// Strip any unwanted quote marks for cleaner console readability
					answer = answer.replace(/["']/g, '');
				}

				// Truncate answer to keep column neat
				if (answer.length > 29) answer = answer.substring(0, 29) + '..';

				// Combine score and answer, padded to force left-alignment in console.table
				const colName = player.name || player.sessionID.substring(0, 5);
				row[colName] = `${score} ${answer}`.padEnd(31, ' ');
			});

			summary[`Q${index + 1}: ${qText}`] = row;
		});

		console.table(summary);
		console.log('====================================\n');
	}

	// endQuiz
	// Quite a lot to do here - must prepare all final results and perform clean up
	// Quiz collects up data and room will request it from quiz and store to DB when game finally ends
	endQuiz() {
		
		const scores = this.calculateCumulativeScore();
		console.log('endQuiz:', this.roundNumber, this.questionNumber, scores);
		this.room.emitToHosts('server:endquiz', { title: this.quizData.title, scores: scores });


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
				sessionID: sessionID,
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
						score: result.totalScore,
						totalPlayers: playerResults.length
					});
				}
			});

		}

		// Finally store the playerResults object for storage later in DB
		this.playerResults = playerResults;
	}

	closingCredits() {
		console.log('closingCredits:');
		this.room.emitToHosts('server:closingcredits', {
			title: this.quizData.title
		});
		this.room.emitToAllPlayers('server:closingcredits', {
			title: this.quizData.title
		});

		// Since we have a closing credits sequence as part of the quiz then this would be the best point to trigger the endgame
		// Since we have sent the final socket events to hosts and players we can safely run the endGame routine which closes everything and cleans up
		this.room.triggerEndGame();
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


console.log(levenshteinDistance('kitten', 'sitting'));


