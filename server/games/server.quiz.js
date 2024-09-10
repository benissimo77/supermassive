const Game = require('./server.game.js');

class Quiz extends Game {
	constructor(room) {
		super(room);

		// Initialize other game-specific properties here
		console.log('Quiz::constructor:');
		this.name = 'quiz';
		this.minplayers = 1;

		// Build a model JSON structure to represent a quiz
		// This will likely change a lot - but make a start, this becomes the way to store an entire quiz as an object
		// Quiz can then be loaded from a file or a database and everything needed is contained in the JSON
		// This is a simple example of a quiz with 3 questions:
		// type specifies the 'default' question type - can be overridden at round or question level
		// if overridden at question/round level then the question/round will (automatically) include details to explain the override
		// Some possible types: basic, timed, buzzer, picture, audio, video
		// Think a bit about what makes a question need a different type - is is the question format or the answer format (or both)?
		// It might be that we need a separate question and answer type - but for now keep it simple
		// Questions and Rounds are not numbered, so in theory they can be shudffled or presented in any order
		// The order of the rounds might be important - but the order of the questions within a round is not
		// Basic type the answers are an array, the first answer is always the correct one - quiz shuffles the answers before sending
		this.quiz = {
			title: 'Quiz Title',
			description: 'This is a quiz description - displayed at the beginning of the quiz',
			type: 'basic',
			rounds: [
				{
					description: 'Round 1 description',
					questions: [
						{
							question: 'What is the capital of France?',
							answers: ['Paris', 'London', 'Berlin', 'Madrid']
						},
						{
							question: 'What is the capital of Spain?',
							answers: ['Madrid', 'Paris', 'London', 'Berlin']
						},
						{
							question: 'What is the capital of Germany?',
							answers: ['Berlin', 'Madrid', 'Paris', 'London']
						}
					]

				}
			]
		};
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

	introduction() {
		console.log('Quiz: introduction');
	}
	startGame() {
		// Game start logic for game 1
		console.log('Quiz: startGame')

		// questionNumber is set to 0 because in nextQuestion we increment question number before we start the question
		// roundNumber this does not happen (so set to 1)
		this.roundNumber = 1;
		this.questionNumber = 0;
		this.nextQuestion();
	}

	endGame() {
		console.log('Quiz::endGame: clean up here...');

		// Not much to do here - we rely on room.js for all the heavy-lifting, game itself is pretty lightweight
	}

	// nextQuestion
	// A function that can be continually called to move to the next question
	// Function handles the beginning and end of rounds, any additional events to fire at the start or end of a round
	// Idea is that the entire quiz can then be a series of 'nextQuestion' calls until there are no more questions
	// This avoids the need for a single game loop and allows the game to be paused, stopped, restarted etc.
	// Can even provide a way to skip questions or rounds if needed, and to re-play older questions if people need a repeat
	nextQuestion() {
		console.log('Quiz: nextQuestion:', this.roundNumber, this.questionNumber);
		this.questionNumber++;
		this.round = this.quiz.rounds[this.roundNumber - 1];
		this.question = this.round.questions[this.questionNumber - 1];

		// Introduce quiz/round if we are at the beginning
		this.introQuiz()
		.then( () => this.introRound() )
		.then( () => this.doQuestion(this.question) )
		.then( () => { console.log('nextQuestion: doQuestion complete') } );

		// .then( this.endRound() )
		// .then( this.endQuiz() )
	}

	introQuiz() {
		console.log('introQuiz:');
		return new Promise((resolve, reject) => {
			console.log('introQuiz: inside Promise');
			if ((this.questionNumber == 1) && (this.roundNumber == 10000)) {
				this.room.emitToHosts('server:introquiz', { type: this.quiz.type, payload: { message: 'Welcome to the Quiz' } });
				this.room.registerHostResponseHandler( () => {
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	introRound() {
		console.log('introRound:');
		return new Promise((resolve, reject) => {
			console.log('introRound: inside Promise');
			if (this.questionNumber == 10000) {

				// Check if we are overriding question/answer types for this round
				const typeOverride = (this.round.type && this.round.type != this.quiz.type);
				this.room.emitToHosts('server:introround', { type: this.quiz.type, override:typeOverride, description: this.round.description }, true )
				.then ( () => resolve() );
			} else {
				resolve();
			}
		});
	}

	doQuestion(question) {
		console.log('doQuestion:', question);
		const timeoutSeconds = 15;
		const playerList = this.getPlayers();
		const socketList = playerList.map( (player) => { return player.socketid } );
		const correctAnswer = question.answers[0];
		const answers = shuffleArray(question.answers);
		const buttonList = answers.map((answer, index) => { return { id: `answer-${index}`, answer: answer } });
		const correctAnswerId = buttonList.find( (button) => { return button.answer == correctAnswer } ).id;

		const everyoneAnswered = (responses) => {
			console.log('everyoneAnswered:', Object.keys(responses).length);
			return (Object.keys(responses).length == playerList.length);
		}
		const storeResults = (responses) => {
			console.log('storeResults:', responses);
		}
		const responseHandler = (socket, response) => {
			console.log('quiz.responseHandler:', socket.id, response);
		}
		const strategy = {
			responseHandler: responseHandler,
			endCondition: everyoneAnswered,
			callback: storeResults,
			timeoutSeconds: timeoutSeconds
		}

		this.room.emitToHosts('server:question', { question: question.question, answers: buttonList, number:this.questionNumber } );
		this.room.getClientResponses(socketList, buttonList, strategy);
	}

	endRound() {
		console.log('endRound:');
		return new Promise((resolve, reject) => {
			console.log('endRound: inside Promise');
			if (this.questionNumber == this.round.questions.length) {

				this.room.emitToHosts('server:endround', { type: this.quiz.type, description: this.round.description }, true )
				.then( resolve() );
			} else {
				resolve();
			}
		});
	}

	endQuiz() {
		console.log('endQuiz:');
		return new Promise((resolve, reject) => {
			console.log('endQuiz: inside Promise');
			if ((this.questionNumber == this.round.questions.length) && (this.roundNumber == this.quiz.rounds.length)) {
				this.room.emitToHosts('server:endquiz', { description: 'END OF THE QUIZ' }, true )
				.then( resolve() );
			} else {
				resolve();
			}
		});
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

module.exports = Quiz;