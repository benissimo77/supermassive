const Game = require('./server.game.js');

const QuizState = {
    INIT: 'INIT',
    INTRO_QUIZ: 'INTRO_QUIZ',
    INTRO_ROUND: 'INTRO_ROUND',
    QUESTION: 'QUESTION',
    END_ROUND: 'END_ROUND',
    END_QUIZ: 'END_QUIZ'
};

class QuizStateMachine {

    constructor(quiz) {
        this.quiz = quiz;
        this.state = QuizState.INIT;
    }

    start() {
        this.transitionTo(QuizState.INTRO_ROUND);
    }

    transitionTo(newState) {
        this.state = newState;
        console.log(`Transitioning to state: ${newState}`);
        switch (newState) {
            case QuizState.INTRO_QUIZ:
                this.quiz.introQuiz().then(() => this.transitionTo(QuizState.INTRO_ROUND));
                break;

            case QuizState.INTRO_ROUND:
				const nextRound = this.quiz.nextRound(); // Increment round number and reset question number
				if (nextRound) {
	                this.quiz.introRound()
					.then(() => this.transitionTo(QuizState.QUESTION));
				} else {
					this.transitionTo(QuizState.END_QUIZ);
				}
                break;

            case QuizState.QUESTION:
                const nextQuestion = this.quiz.nextQuestion(); // Increment question number and get question
				if (nextQuestion) {
					this.quiz.doQuestion(nextQuestion)
					.then(() => {
                        this.transitionTo(QuizState.QUESTION);
					});
				} else {
					console.log('No more questions - ending round...');
					this.transitionTo(QuizState.END_ROUND);
				}
                break;

            case QuizState.END_ROUND:
                this.quiz.endRound()
					.then(() => {
						console.log('endRound complete - moving to next round...');
						this.transitionTo(QuizState.INTRO_ROUND);
                	});
                break;

            case QuizState.END_QUIZ:
                this.quiz.endQuiz();
                break;

            default:
                console.error(`Unknown state: ${newState}`);
        }
    }
}


class Quiz extends Game {

	constructor(room) {
		super(room);

		// Initialize other game-specific properties here
		console.log('Quiz::constructor:');
		this.name = 'quiz';
		this.minplayers = 1;
		this.maxplayers = 10;
		this.roundNumber = 0;
		this.questionNumber = 0;

		// Instantiate the State Machine which will manage the game flow
		this.stateMachine = new QuizStateMachine(this);

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
		this.quizData = {
			title: 'The Veluwe Weekend Mega-Quiz!',
			description: 'Ok, not very mega, but hey sales...',
			type: 'basic',
			rounds: [
				{
					title: 'General Ignorance',
					description: 'Just your basic general knowledge questions. Four possible answers, how much do you know?',
					questions: [
						{
							question: 'Who wrote the play "Romeo and Juliet"?',
							answers: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain']
						},
						{
							question: 'What is the capital city of Japan?',
							answers: ['Tokyo', 'Beijing', 'Seoul', 'Bangkok']
						},
						{
							question: 'In which year did the Titanic sink?',
							answers: ['1912', '1905', '1915', '1920']
						},
						{
							question: 'What is the largest ocean on Earth?',
							answers: ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean']
						},
						{
							question: 'Who painted the Mona Lisa?',
							answers: ['Leonardo da Vinci', 'Vincent van Gogh', 'Pablo Picasso', 'Claude Monet']
						},
						{
							question: 'What is the smallest country in the world?',
							answers: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein']
						},
						{
							question: 'Which country is known as the Land of the Rising Sun?',
							answers: ['Japan', 'China', 'South Korea', 'Thailand']
						},
						{
							question: 'What is the main ingredient in guacamole?',
							answers: ['Avocado', 'Tomato', 'Onion', 'Garlic']
						},
						{
							question: 'Who was the first President of the United States?',
							answers: ['George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'John Adams']
						}
					]
				},
				{
					title: 'Science and Nature',
					description: 'I wanted to include some different types of question, but I ran out of time...',
					questions: [
						{
							question: 'Which planet is known as the Red Planet?',
							answers: ['Mars', 'Venus', 'Jupiter', 'Saturn']
						},
						{
							question: 'What is the hardest natural substance on Earth?',
							answers: ['Diamond', 'Gold', 'Iron', 'Platinum']
						},
						{
							question: 'What is the process by which plants make their food?',
							answers: ['Photosynthesis', 'Respiration', 'Digestion', 'Fermentation']
						},
						{
							question: 'What is the boiling point of water at sea level?',
							answers: ['100°C', '90°C', '80°C', '110°C']
						},
						{
							question: 'Which gas do plants absorb from the atmosphere?',
							answers: ['Carbon Dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen']
						},
						{
							question: 'What is the main gas found in the air we breathe?',
							answers: ['Nitrogen', 'Oxygen', 'Carbon Dioxide', 'Helium']
						},
						{
							question: 'What is the largest planet in our solar system?',
							answers: ['Jupiter', 'Saturn', 'Earth', 'Mars']
						},
						{
							question: 'What is the chemical symbol for gold?',
							answers: ['Au', 'Ag', 'Fe', 'Pb']
						},
						{
							question: 'Which organ in the human body is primarily responsible for detoxification?',
							answers: ['Liver', 'Kidney', 'Heart', 'Lungs']
						},
						{
							question: 'What is the most abundant element in the universe?',
							answers: ['Hydrogen', 'Oxygen', 'Carbon', 'Nitrogen']
						}
					]
				},
				{
					title: 'GOLF!',
					description: 'Well why not eh? It is a golf weekend after all...',
					questions: [
						{
							question: 'What is the term for a score of one under par on a hole?',
							answers: ['Birdie', 'Eagle', 'Par', 'Bogey']
						},
						{
							question: 'What is the maximum number of clubs a golfer is allowed to carry in their bag during a round?',
							answers: ['14', '10', '12', '16']
						},
						{
							question: 'Which famous golfer is known as "The Golden Bear"?',
							answers: ['Jack Nicklaus', 'Tiger Woods', 'Arnold Palmer', 'Gary Player']
						},
						{
							question: 'Which tournament is considered the oldest major championship in golf?',
							answers: ['The Open Championship', 'The Masters', 'The U.S. Open', 'The PGA Championship']
						},
						{
							question: 'What is the name of the trophy awarded to the winner of The Masters Tournament?',
							answers: ['The Green Jacket', 'The Claret Jug', 'The Wanamaker Trophy', 'The Ryder Cup']
						}
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
		console.log('Quiz::checkGameRequirements:', this.players.length, this.minplayers);
		return this.players.length >= this.minplayers;
	}

	introduction() {
		console.log('Quiz: introduction');
	}
	startGame() {
		// Game start logic for game 1
		console.log('Quiz: startGame')

		// Start the state machine
		this.stateMachine.start();

		// the idea is that this is enough - after that the host will invoke a 'next round' event which will trigger the next round
		// next round is also responsible for determining if there are any more rounds left
		// if not then we end the quiz
	}

	endGame() {
		console.log('Quiz::endGame: clean up here...');

		// Not much to do here - we rely on room.js for all the heavy-lifting, game itself is pretty lightweight
	}

	// introQuiz
	// Run introductory animation, plus run any set up data tasks
	introQuiz() {
		console.log('introQuiz:');
		return new Promise((resolve, reject) => {
			console.log('introQuiz: inside Promise');
			this.room.emitToHosts('server:introquiz', { title: this.quizData.title, description: this.quizData.description }, true )
			.then ( () => resolve() );
		});
	}

	// introRound
	// Similar to introQuiz - runs at the beginning of each round
	introRound() {
		console.log('introRound:');
		return new Promise((resolve, reject) => {
			console.log('introRound: inside Promise');
			// Check if we are overriding question/answer types for this round
			const typeOverride = (this.round.type && this.round.type != this.quizData.type);
			this.room.emitToHosts('server:introround', { roundnumber: this.roundNumber, title: this.round.title, description: this.round.description, duration: 8 }, true )
			.then ( () => resolve() );
		});
	}

	// nextRound
	// A function that can be called to start a round
	// Function returns the round data, or null if there are no more rounds
	nextRound() {
		this.roundNumber++;
		this.questionNumber = 0;
		this.round = (this.roundNumber <= this.quizData.rounds.length) ? this.quizData.rounds[this.roundNumber - 1] : null;
		return this.round;
	}

	// nextQuestion
	// Similar to nextRound above - returns the question data or null if there are no more questions in this round
	nextQuestion() {
		this.questionNumber++;
		this.question = (this.questionNumber <= this.round.questions.length) ? this.round.questions[this.questionNumber -1] : null;
		return this.question;
	}


	// doQuestion
	// A general function that will do everything needed to present the supplied question
	// It doesn't know anything outside of the question it is given
	// It does have responsibility to handle the correct answer and collect responses from the players
	doQuestion(question) {
		console.log('doQuestion:', question);
		return new Promise((resolve, reject) => {
			const timeoutSeconds = 10;
			const playerList = this.room.getConnectedPlayers();
			const socketList = playerList.map( (player) => { return player.socketid } );
			const correctAnswer = question.answers[0];
			const answers = shuffleArray(question.answers);
			const buttonList = answers.map((answer, index) => { return { id: `answer-${index}`, answer: answer } });
			const correctAnswerId = buttonList.find( (button) => { return button.answer == correctAnswer } ).id;

			// Try overwriting the actual quizData with the modified question/answers data
			// Now I can actually pass the entire question object directly to the client (do later it works right now)
			this.question.answers = buttonList;
			this.question.number = this.questionNumber;

			var results = {};

			const everyoneAnswered = (responses) => {
				console.log('everyoneAnswered:', Object.keys(responses).length);
				return (Object.keys(responses).length == playerList.length);
			}
			const questionFinished = (responses) => {
				console.log('storeResults:', results);
				this.question.results = results;
				this.question.correctAnswerId = correctAnswerId;
				this.room.emitToHosts('server:questionfinished', {},  true)
				.then( resolve() );
			}
			const responseHandler = (socket, response) => {
				console.log('quiz.responseHandler:', socket.id, response);
				results[socket.id] = (response == correctAnswerId);
				this.room.emitToHosts('server:questionanswered', { socketid: socket.id, response: response });
			}
			const strategy = {
				responseHandler: responseHandler,
				endCondition: everyoneAnswered,
				callback: questionFinished,
				timeoutSeconds: timeoutSeconds
			}

			this.room.emitToHosts('server:question', { question: question.question, answers: buttonList, number:this.questionNumber }, true )
			.then( () => {
				this.room.getClientResponses(socketList, buttonList, strategy);
			});
			
		});

	}

	endRound() {
		console.log('endRound:', this.round);
		return new Promise((resolve, reject) => {
			console.log('endRound: inside Promise');
			this.room.emitToHosts('server:endround', this.round, true )
			.then( () => {
				resolve();
			});
		});
	}

	endQuiz() {
		console.log('endQuiz:');
		return new Promise((resolve, reject) => {
			console.log('endQuiz: inside Promise');
			this.room.emitToHosts('server:endquiz', { description: 'END OF THE QUIZ' }, true )
			.then( resolve() );
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