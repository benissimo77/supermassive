import Game from './server.game.js';
import QuizModel from '../models/mongo.quiz.js';

const QuizState = {
	INIT: 'INIT',
	INTRO_QUIZ: 'INTRO_QUIZ',
	NEXT_ROUND: 'NEXT_ROUND',
	PREVIOUS_ROUND: 'PREVIOUS_ROUND',
	INTRO_ROUND: 'INTRO_ROUND',
	NEXT_QUESTION: 'NEXT_QUESTION',
	PREVIOUS_QUESTION: 'PREVIOUS_QUESTION',
	QUESTION: 'QUESTION',
	END_QUESTION: 'END_QUESTION',
	COLLECT_ANSWERS: 'COLLECT_ANSWERS',
	SHOW_ANSWER: 'SHOW_ANSWER',
	UPDATE_SCORES: 'UPDATE_SCORES',
	END_ROUND: 'END_ROUND',
	END_QUIZ: 'END_QUIZ'
};

class QuizStateMachine {

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
				this.transitionTo(QuizState.NEXT_ROUND);
				break;

			case QuizState.INTRO_ROUND:
				this.transitionTo(QuizState.NEXT_QUESTION);
				break;

			case QuizState.QUESTION:
				if (this.quiz.mode == "ask") {
					this.transitionTo(QuizState.COLLECT_ANSWERS);
				} else {
					this.transitionTo(QuizState.SHOW_ANSWER);
				}
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
				this.transitionTo(QuizState.END_QUIZ);
				break;
			default:
				console.error(`Unknown state: ${this.state}`);
		}
	}

	previousState() {
		console.log('previousState:', this.state);
		this.direction = 'backward';

		switch (this.state) {

			case QuizState.INTRO_ROUND:
				const previousRound = this.quiz.moveToPreviousRound(); // Decrement round number and reset question number
				if (previousRound) {
					this.transitionTo(QuizState.QUESTION);
				} else {
					this.transitionTo(QuizState.INTRO_QUIZ);
				}
				break;

			case QuizState.NEXT_QUESTION:
			case QuizState.PREVIOUS_QUESTION:
			case QuizState.QUESTION:
			case QuizState.COLLECT_ANSWERS:
			case QuizState.SHOW_ANSWER:
			case QuizState.UPDATE_SCORES:
			case QuizState.END_QUESTION:
			case QuizState.END_ROUND:
			case QuizState.END_QUIZ:
				const previousQuestion = this.quiz.moveToPreviousQuestion(); // Decrement question number and get question
				if (previousQuestion) {
					this.transitionTo(QuizState.QUESTION);
				} else {
					this.transitionTo(QuizState.PREVIOUS_ROUND);
				}
				break;

			default:
				console.error(`Unknown state: ${this.state}`);
				break;

		}
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

			case QuizState.COLLECT_ANSWERS:
				this.quiz.collectAnswers();
				break;

			case QuizState.SHOW_ANSWER:
				this.quiz.showAnswer();
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

			default:
				console.error(`Unknown state: ${newState}`);
		}
	}
}


export default class Quiz extends Game {

	constructor(room) {
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


		this.quizData = {
			"title": "Sample Quiz",
			"description": "<p>This is a sample quiz to get you started.</p>",
			"rounds": [
				{
					title: 'General Ignorance II',
					description: 'Four possible answers, how much do you know?',
					roundTimer: "0",
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
							"image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAGQCAIAAABkkLjnAAAACXBIWXMAAC4jAAAuIwF4pT92AAAInElEQVR4nO3ZsYredRqG4e8TttFCF2EPQLBwYJlaFosN2ESIRdLYKPbpYu/CFrtFTmCLLcwW0yiCEDuTU3BA0gnWOQCncdEi5bpwP1jMN3Jd3fxI8S9ueObNHO8/uDrQXDy888EnX133V9wML133B9wwz/76xXV/ws0grMHZ07uX73123V9xMwhrcP74o+v+hBtDWAM72AlrcPneZ2dP7173V9wMwtpYw0hYG2sYCWvgKuyENbCDnbAGdrAT1sBV2AlrYw0jYW2sYSSsgauwE9bADnbCGtjBTlgDV2EnrI01jIS1sYaRsAauwk5YAzvYCWtgBzthDVyFnbA21jAS1sYaRsIauAo7YQ3sYCesgR3shDVwFXbC2ljDSFgbaxgJa+Aq7IQ1sIOdsAZ2sBPWwFXYCWtjDSNhbaxhJKyBq7AT1sAOdsIa2MFOWANXYSesjTWMhLWxhpGwBq7CTlgDO9gJa2AHO2ENXIWdsDbWMBLWxhpGwhq4CjthDexgJ6yBHeyENXAVdsLaWMNIWBtrGAlr4CrshDWwg52wBnawE9bAVdgJa2MNI2FtrGEkrIGrsBPWwA52whrYwU5YA1dhJ6yNNYyEtbGGkbAGrsJOWAM72AlrYAc7YQ1chZ2wNtYwEtbGGkbCGrgKO2EN7GAnrIEd7IQ1cBV2wtpYw0hYG2sYCWvgKuyENbCDnbAGdrAT1sBV2AlrYw0jYW2sYSSsgauwE9bADnbCGtjBTlgDV2EnrI01jIS1sYaRsAauwk5YAzvYCWtgBzthDVyFnbA21jAS1sYaRsIauAq74zvf/Ov86w+f3fr88vajF09nT+558fIbX1669i+4WS+Hw+GkvudkX473H1wdaC4e3jl7etfv74XfsTaqioS1cRVGwhq4CjthDexgJ6yBHeyENfC3wk5YG2sYCWtjDSNhDVyFnbAGdrAT1sAOdsIauAo7YW2sYSSsjTWMhDVwFXbCGtjBTlgDO9gJa+Aq7IS1sYaRsDbWMBLWwFXYCWtgBzthDexgJ6yBq7AT1sYaRsLaWMNIWANXYSesgR3shDWwg52wBq7CTlgbaxgJa2MNI2ENXIWdsAZ2sBPWwA52whq4CjthbaxhJKyNNYyENXAVdsIa2MFOWAM72Alr4CrshLWxhpGwNtYwEtbAVdgJa2AHO2EN7GAnrIGrsBPWxhpGwtpYw0hYA1dhJ6yBHeyENbCDnbAGrsJOWBtrGAlrYw0jYQ1chZ2wBnawE9bADnbCGrgKO2FtrGEkrI01jIQ1cBV2whrYwU5YAzvYCWvgKuyEtbGGkbA21jAS1sBV2AlrYAc7YQ3sYCesgauwE9bGGkbC2ljDSFgDV2EnrIEd7IQ1sIOdsAauwk5YG2sYCWtjDSNhDVyFnbAGdrAT1sAOdsIauAo7YW2sYSSsjTWMhDVwFXbCGtjBTlgDO9gJa+Aq7IS1sYaRsDbWMBLWwFXYCWtgBzthDexgJ6yBq7AT1sYaRse33/n7t3/598v/ePPFz2dP7v30t+de/t/Ln77/82sf//F0vudkX46v//zu4XC4+ucPb335/qufnl/efvTiX3j535cfL/77/I3vTud7TvnleP/B1YHs4uGdDz756rq/4gbwO9bAVdgJa+Aq7IS1cRVGwtpYw0hYA38r7IQ1sIOdsAZ2sBPWwFXYCWtjDSNhbaxhJKyBq7AT1sAOdsIa2MFOWANXYSesjTWMhLWxhpGwBq7CTlgDO9gJa2AHO2ENXIWdsDbWMBLWxhpGwhq4CjthDexgJ6yBHeyENXAVdsLaWMNIWBtrGAlr4CrshDWwg52wBnawE9bAVdgJa2MNI2FtrGEkrIGrsBPWwA52whrYwU5YA1dhJ6yNNYyEtbGGkbAGrsJOWAM72AlrYAc7YQ1chZ2wNtYwEtbGGkbCGrgKO2EN7GAnrIEd7IQ1cBV2wtpYw0hYG2sYCWvgKuyENbCDnbAGdrAT1sBV2AlrYw0jYW2sYSSsgauwE9bADnbCGtjBTlgDV2EnrI01jIS1sYaRsAauwk5YAzvYCWtgBzthDVyFnbA21jAS1sYaRsIauAo7YQ3sYCesgR3shDVwFXbC2ljDSFgbaxgJa+Aq7IQ1sIOdsAZ2sBPWwFXYCWtjDSNhbaxhJKyBq7AT1sAOdsIa2MFOWANXYSesjTWMhLWxhpGwBq7CTlgDO9gJa2AHO2ENXIWdsDbWMBLWxhpGwhq4CjthDexgJ6yBHeyOtx7/5/L2oxc/nD25d/71h89ufe7lV18Oh8PZ07t/uHrlRL7nlF+Or//87ul8jZffzcvx/oOrA83Fwzvnjz/yX1mF37EGrsJOWANXYSesgauwE9bA3wo7YW2sYSSsjTWMhDVwFXbCGtjBTlgDO9gJa+Aq7IS1sYaRsDbWMBLWwFXYCWtgBzthDexgJ6yBq7AT1sYaRsLaWMNIWANXYSesgR3shDWwg52wBq7CTlgbaxgJa2MNI2ENXIWdsAZ2sBPWwA52whq4CjthbaxhJKyNNYyENXAVdsIa2MFOWAM72Alr4CrshLWxhpGwNtYwEtbAVdgJa2AHO2EN7GAnrIGrsBPWxhpGwtpYw0hYA1dhJ6yBHeyENbCDnbAGrsJOWBtrGAlrYw0jYQ1chZ2wBnawE9bADnbCGrgKO2FtrGEkrI01jIQ1cBV2whrYwU5YAzvYCWvgKuyEtbGGkbA21jAS1sBV2AlrYAc7YQ3sYCesgauwE9bGGkbC2ljDSFgDV2EnrIEd7IQ1sIOdsAauwk5YG2sYCWtjDSNhDVyFnbAGdrAT1sAOdsIauAo7YW2sYSSsjTWMhDVwFXbCGtjBTlgDO9gJa+Aq7IS1sYaRsDbWMBLWwFXYCWtgBzthDexgJ6yBq7AT1sYaRsLaWMNIWANXYSesgR3shDWwg52wBq7CTlgbaxgJa2MNI2ENXIWdsAZ2sPsFDlLVXPOGSogAAAAASUVORK5CYII=",
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
				},

				{
					title: 'General Ignorance II',
					description: 'Just your basic general knowledge questions. Four possible answers, how much do you know?',
					roundTimer: "0",
					showAnswer: "round",
					updateScores: "round",
					questions: [
						{
							type: 'multiple-choice',
							text: 'Who wrote the play "Romeo and Juliet"?',
							options: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain']
						},
						{
							type: 'multiple-choice',
							text: 'Who wrote the play "Romeo and Juliet"?',
							image: "https://placehold.co/1280x720",
							options: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain but now a lot longer... to test adjustment']
						},
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
						{
							"type": "matching",
							"text": "Match left to right",
							"image": null,
							"audio": "",
							"pairs": [
								{
									"left": "Left 1",
									"right": "Right 1"
								},
								{
									"left": "Left 2",
									"right": "Right 2"
								},
								{
									"left": "Left 3",
									"right": "Right 3"
								},
								{
									"left": "Left 4",
									"right": "Right 4"
								},
								{
									"left": "Left 5",
									"right": "Right 5"
								}
							]
						},
						{
							"type": "true-false",
							"text": "True or False: this is a question?",
							"image": null,
							"audio": "",
							"answer": "true"
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
							"type": "draw",
							"text": "Old-skool draw the answer!",
							"image": null,
							"audio": "",
							"answer": "This is what you should have drawn..."
						}
					]
				},
				{
					title: 'Science and Nature',
					description: 'I wanted to include some different types of question, but I ran out of time...',
					roundTimer: "0",
					showAnswer: "round",
					updateScores: "round",
					questions: [
						{
							type: 'multiple-choice',
							text: 'Which planet is known as the Red Planet?',
							options: ['Mars', 'Venus', 'Jupiter', 'Saturn']
						},
						{
							type: 'multiple-choice',
							text: 'What is the hardest natural substance on Earth?',
							options: ['Diamond', 'Gold', 'Iron', 'Platinum']
						},
						{
							type: 'multiple-choice',
							text: 'What is the process by which plants make their food?',
							options: ['Photosynthesis', 'Respiration', 'Digestion', 'Fermentation']
						},
						{
							type: 'multiple-choice',
							text: 'What is the boiling point of water at sea level?',
							options: ['100°C', '90°C', '80°C', '110°C']
						},
						{
							type: 'multiple-choice',
							text: 'Which gas do plants absorb from the atmosphere?',
							options: ['Carbon Dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen']
						},
						{
							type: 'multiple-choice',
							text: 'What is the main gas found in the air we breathe?',
							options: ['Nitrogen', 'Oxygen', 'Carbon Dioxide', 'Helium']
						},
						{
							type: 'multiple-choice',
							text: 'What is the largest planet in our solar system?',
							options: ['Jupiter', 'Saturn', 'Earth', 'Mars']
						},
						{
							type: 'multiple-choice',
							text: 'What is the chemical symbol for gold?',
							options: ['Au', 'Ag', 'Fe', 'Pb']
						},
						{
							type: 'multiple-choice',
							text: 'Which organ in the human body is primarily responsible for detoxification?',
							options: ['Liver', 'Kidney', 'Heart', 'Lungs']
						},
						{
							type: 'multiple-choice',
							text: 'What is the most abundant element in the universe?',
							options: ['Hydrogen', 'Oxygen', 'Carbon', 'Nitrogen']
						}
					]
				},

				{
					"title": "General Knowledge",
					"description": "Test your general knowledge!",
					"roundTimer": "0",
					"showAnswer": "round",
					"updateScores": "round",
					"questions": [
						{
							"type": "matching",
							"text": "Match left to right",
							"image": null,
							"audio": "",
							"pairs": [
								{
									"left": "Left 1",
									"right": "Right 1"
								},
								{
									"left": "Left 2",
									"right": "Right 2"
								},
								{
									"left": "Left 3",
									"right": "Right 3"
								},
								{
									"left": "Left 4",
									"right": "Right 4"
								},
								{
									"left": "Left 5",
									"right": "Right 5"
								}
							]
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
					]
				}

			]
		}

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

		// Declare this as V2 so we don't use it at the moment...
		this.quizData = {
			title: 'The Veluwe 2025 Golf, Food, Wine and Poker Mega-Quiz!',
			description: 'Ok, not very mega, but hey sales...',
			rounds: [
				{
					title: 'General Ignorance',
					description: 'We are warming up! Just your basic general knowledge questions. Four possible answers, how much do you know?',
					roundTimer: "0",
					showAnswer: "round",
					updateScores: "round",
					questions: [
						{
							type: 'multiple-choice',
							text: 'Science: Which gas do plants absorb from the atmosphere?',
							options: ['Carbon Dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen']
						},
						{
							type: 'multiple-choice',
							text: 'Geography: What is the smallest country in the world?',
							options: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein']
						},
						{
							type: 'multiple-choice',
							text: 'History: Who was the first President of the United States?',
							options: ['George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'John Adams']
						},
						{
							type: "multiple-choice",
							text: "On a similar note: Who was the first President of Ireland?",
							options: ["Douglas Hyde", "Éamon de Valera", "W.T. Cosgrave", "Michael Collins"]
						},
						{
							type: "multiple-choice",
							text: "Scotland does not have a President - but they do have a First Minister! Who was Scotland's first First Minister?",
							options: ["Donald Dewar", "Alex Salmond", "Henry McLeish", "Jack McConnell"]
						},
						{
							type: "multiple-choice",
							text: "Since we're in Netherlands: Who was the first Stadhouder of the independent Dutch Republic?",
							options: [
								"William I of Orange",
								"Johan van Oldenbarnevelt",
								"Maurice of Nassau",
								"Johan de Witt"
							]
						},
						{
							type: 'ordering',
							text: 'Arrange those four positions in order of when they were first created. Whose traditions are oldest???',
							extra: {
								startLabel: "Earliest",
								endLabel: "Latest"
							},
							items: [
								"Dutch Stadhouder",
								"US Presidency",
								"Irish Presidency",
								"Scottish First Minister"
							]
						}
					]
				},
				{
					title: 'POKER',
					description: 'A few questions about poker - just to get you in the mood for the main event later...',
					roundTimer: "0",
					showAnswer: "round",
					updateScores: "round",
					questions: [
						{
							type: "multiple-choice",
							text: "Which of these is NOT a variation of poker?",
							options: ["Canasta", "Omaha", "Seven-Card Stud", "Razz"]
						},
						{
							type: "ordering",
							text: "Arrange these poker positions in clockwise order starting from the small blind.",
							extra: {
								startLabel: "First",
								endLabel: "Last"
							},
							items: [
								"Small Blind",
								"Big Blind",
								"Under the Gun",
								"Hijack",
								"Cutoff",
								"Button"
							]
						},
						{
							type: "matching",
							text: "Match these advanced poker concepts with their definitions.",
							pairs: [
								{
									left: "Implied Odds",
									right: "Potential future bets you might win if you hit your draw"
								},
								{
									left: "Reverse Implied Odds",
									right: "When making your hand might cost you more than you win"
								},
								{
									left: "Blockers",
									right: "Cards in your hand that reduce opponent's chances of strong holdings"
								},
								{
									left: "Polarized Range",
									right: "Betting with very strong hands and bluffs but not middle strength"
								},
								{
									left: "GTO",
									right: "Strategy that cannot be exploited regardless of opponent's play"
								}
							]
						},
						{
							type: "multiple-choice",
							text: "Which of these is NOT part of the 'Independent Chip Model' (ICM) considerations in tournament poker?",
							options: [
								"Expected hourly rate of return",
								"Pay jump considerations",
								"Stack size relative to tournament average",
								"Probability of finishing in each position"
							]
						},
						{
							type: "multiple-choice",
							text: "Who won the 2025 World Series of Poker Main Event?",
							image: "https://www.wsop.com/images/2025/MEChampion2025.jpg",
							options: [
								"Michael Mizrachi",
								"Jonathan Tamayo",
								"Elmer",
								"Joe McKeehen"
							]
						},
						{
							type: "number-closest",
							text: "How many players did he beat in order to take the title?",
							answer: 9735,
						},
						{
							type: 'true-false',
							text: 'True or False - he won with T3o?',
							answer: false
						},
						{
							type: "text",
							text: "Enter the (two-letter) initials of the poker player known as 'The Magician'?",
							image: "https://casinochecking.com/wp-content/uploads/2018/08/Antonio-Esfandiari-poker-2000x1331.jpg",
							answer: "AE"
						}
					]
				},
				{
					title: 'Food and Drink',
					description: 'A few questions about food and drink - it was that or questions about cycling',
					roundTimer: "0",
					showAnswer: "round",
					updateScores: "round",
					questions: [
						{
							type: "multiple-choice",
							text: "What is the most widely consumed beverage in the world?",
							options: ["Tea", "Coffee", "Water", "Juice"]
						},
						{
							type: "matching",
							text: "Match these wines with their primary grape varieties.",
							pairs: [
								{
									left: "Cabernet Sauvignon",
									right: "Red grape with black currant notes"
								},
								{
									left: "Chardonnay",
									right: "White grape often aged in oak"
								},
								{
									left: "Merlot",
									right: "Soft red grape with plum flavors"
								},
								{
									left: "Sauvignon Blanc",
									right: "Crisp white grape with grassy notes"
								},
								{
									left: "Pinot Noir",
									right: "Light red grape with cherry notes"
								}
							]
						},

					]
				},

				{
					title: 'GOLF!',
					description: 'Well why not eh? It is a golf weekend after all...',
					roundTimer: "0",
					showAnswer: "round",
					updateScores: "round",
					questions: [
						{
							type: 'multiple-choice',
							text: 'What is the term for a score of one under par on a hole?',
							options: ['Birdie', 'Eagle', 'Par', 'Bogey']
						},
						{
							type: 'text',
							text: 'What are the (two-letter) initials of this golfer?',
							image: 'https://staticg.sportskeeda.com/editor/2023/03/20b83-16799468691823-1920.jpg',
							answer: 'AP'
						},
						{
							type: 'multiple-choice',
							text: 'What is the maximum number of clubs a golfer is allowed to carry in their bag during a round?',
							options: ['14', '10', '12', '16']
						},
						{
							type: 'number-closest',
							text: 'What is the length in yards of the longest golf hole in the world, the 7th hole at the Satsuki Golf Club in Japan?',
							answer: 964,
						},
						{
							type: "matching",
							text: "Match these famous golf courses with their locations.",
							pairs: [
								{
									left: "St Andrews",
									right: "Scotland"
								},
								{
									left: "Augusta National",
									right: "Georgia, USA"
								},
								{
									left: "Pebble Beach",
									right: "California, USA"
								},
								{
									left: "Oakmont",
									right: "Pennsylvania, USA"
								},
								{
									left: "Valderrama",
									right: "Spain"
								}
							]
						},
						{
							type: 'multiple-choice',
							text: 'Which famous golfer is known as "The Golden Bear"?',
							options: ['Jack Nicklaus', 'Tiger Woods', 'Arnold Palmer', 'Gary Player']
						},
						{
							type: 'number-closest',
							text: 'In what year was the Ryder Cup first contested?',
							answer: 1927,
						},
						{
							type: 'multiple-choice',
							text: 'Which tournament is considered the oldest major championship in golf?',
							options: ['The Open Championship', 'The Masters', 'The U.S. Open', 'The PGA Championship']
						},
						{
							type: "ordering",
							text: "Order these golf clubs from shortest to longest in terms of typical distance hit.",
							extra: {
								startLabel: "Shortest",
								endLabel: "Longest"
							},
							items: [
								"5-iron",
								"3-iron",
								"5-wood",
								"3-wood",
								"Driver"
							]
						},
						{
							type: 'number-closest',
							text: 'For a reasonably proficient male golfer in their 50s (ahem), what is a typical driving distance in yards?',
							answer: 220
						},
						{
							type: 'multiple-choice',
							text: 'What is awarded to the winner of The Masters Tournament?',
							options: ['The Green Jacket', 'The Claret Jug', 'The Wanamaker Trophy', 'The Ryder Cup']
						}
					]
				},

				{
					title: 'Wrapping Up',
					description: 'A few final questions to finish off... if we made it to here then it must have worked out ok!',
					roundTimer: "0",
					showAnswer: "question",
					updateScores: "question",
					questions: [
						{
							type: 'draw',
							text: 'Draw a picture of anything you like - it must have at least two colours and use at least two different line widths',
							answer: "Let's have a look at what you did...",
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

	init() {
		this.round = null;
		this.question = null;
		this.mode = "ask";	// ask or answer - whether we are collecting answers or showing them

		// In this state we are waiting for players to arrive and for the host to start
		// So we want to display players as they enter, plus the room code and login instructions...

	}

	// startGame is a required function for a class that extends Game
	// Called by room when it receives a host:requeststart from the host - this is the entry point to the game
	async startGame(config) {
		// Game start logic for game 1
		console.log('Quiz: startGame:', config, this.players);

		// Initialize player scores to 0
		this.players.forEach(player => {
			player.score = 0;
		});

		// Config should pass a quiz ID to select the quiz to load
		// We load the quiz from DB using the passed ID (see api.quiz.js)
		if (config.quizID) {
			// Load the quiz from DB
			// Since this is a DB operation we better catch errors
			try {
				const thisQuizData = await QuizModel.getQuizByID(config.quizID);
				if (thisQuizData) {
					this.quizData = thisQuizData;
					console.log('Quiz::startGame: loaded quiz data:', this.quizData);
				}
			} catch (error) {
				console.error('Quiz::startGame: no quiz data found for ID:', config.quizID);
				console.log('Quiz::startGame: using default quiz data instead');
			}
		}

		// Load the quiz from file and start the state machine
		// parseQuizFromCSV('quiz1.v1').then((quiz) => {
		// 	this.quizData = quiz;
		// 	this.stateMachine.start();
		// });

		// For now, just start the state machine
		this.stateMachine.start();
	}

	endGame() {
		console.log('Quiz::endGame: clean up here...');

		// Not much to do here - we rely on room.js for all the heavy-lifting, game itself is pretty lightweight
	}

	// keyPressHandler
	// Recieves keypresses from the host and acts
	keypressHandler(socket, keyObject) {
		console.log('Quiz::keypressHandler:', keyObject);
		// If right or left arrow then step forward or back in the quiz
		// If CTRL also pressed then jump to end/beginning of the round
		if (keyObject.key == 'ArrowRight') {
			this.stateMachine.nextState();
		}
		if (keyObject.key == 'ArrowLeft') {
			this.stateMachine.previousState();
		}
	}
	// introQuiz
	// Run introductory animation, plus run any set up data tasks
	introQuiz() {
		console.log('introQuiz:');
		this.roundNumber = 0;
		this.room.emitToHosts('server:introquiz', { title: this.quizData.title, description: this.quizData.description }, true)
	}

	// introRound
	// Similar to introQuiz - runs at the beginning of each round
	// Note: this function expects this.round to hold the round to intro (is this the best pattern?)
	introRound() {
		console.log('introRound:');
		this.questionNumber = 0;

		// Check if we are overriding question/answer types for this round (not used yet)
		const typeOverride = (this.round.type && this.round.type != this.quizData.type);

		// Return the Promise from emitToHosts back to the caller
		this.room.emitToHosts('server:introround', { roundnumber: this.roundNumber, title: this.round.title, description: this.round.description, duration: 8 }, true)
	}

	// nextRound
	// A function that can be called to start a round
	// Function returns the round data, or false if there are no more rounds
	moveToNextRound() {
		if (this.roundNumber < this.quizData.rounds.length) {
			this.round = this.quizData.rounds[this.roundNumber];
			this.roundNumber++;
			this.questionNumber = 0;
			return this.round;
		}
		return false;
	}

	// moveToPreviousRound - reverse of moveToNextRound
	moveToPreviousRound() {
		if (this.roundNumber > 1) {
			this.roundNumber--;
			this.round = this.quizData.rounds[this.roundNumber - 1];
			this.questionNumber = this.round.questions.length;
			return this.round;
		}
		return false;
	}

	// nextQuestion
	// Similar to nextRound above - returns the question data or null if there are no more questions in this round
	moveToNextQuestion() {
		if (this.questionNumber < this.round.questions.length) {
			this.question = this.round.questions[this.questionNumber];
			this.questionNumber++;
			return this.question;
		}
		return false;
	}


	// moveToPreviousQuestion - reverse of moveToNextQuestion
	// At end of rouund this.questionNumber will be the length of the questions array
	moveToPreviousQuestion() {
		console.log('moveToPreviousQuestion:', this.questionNumber);
		if (this.questionNumber > 1) {
			this.questionNumber--;
			this.question = this.round.questions[this.questionNumber];
			return this.question;
		} else {
			return this.moveToPreviousRound();
		}
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

		// this.question holds a pointer into the master quizData to allow mutating for storing results
		this.question = this.round.questions[this.questionNumber - 1];

		// Add the general quiz state to the question - do this before copying the question
		this.question.questionNumber = this.questionNumber;

		// Prepare the question by mutating answer options
		// Function also sets up the question.answer since sometimes the answer is derived from the question data (eg first item in options array)
		this.prepareMutatedQuestion(this.question);

		let hostQuestion = structuredClone(this.question);
		hostQuestion.mode = this.mode;
		hostQuestion.direction = this.stateMachine.direction;
		hostQuestion.options = this.question.optionsShuffled;
		hostQuestion.items = this.question.itemsShuffled;
		hostQuestion.pairs = this.question.pairsShuffled;
		delete hostQuestion.answer;
		delete hostQuestion.optionsShuffled;
		delete hostQuestion.itemsShuffled;
		delete hostQuestion.pairsShuffled;

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
		this.room.registerHostResponseHandler(() => {
			this.room.deregisterHostResponseHandler();
			this.stateMachine.nextState();
		});
	}

	collectAnswers() {

		// Prepare a question object holding only the data needed for the players
		// IMPORTANT: don't initialise this otherwise we can't go back and re-visit questions
		if (!this.question.results) {
			this.question.results = {};
		}
		if (!this.question.times) {
			this.question.times = {};
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
			console.log('quiz.responseHandler:', socket.id, response);
			const player = this.room.getPlayerBySocketID(socket.id);
			if (player) {
				this.question.results[player.sessionID] = response.answer;
				this.question.times[player.sessionID] = response.answerTime;
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
		localQuestion.results = this.question.results;

		console.dir('showAnswer:', localQuestion);
		this.room.emitToHosts('server:showanswer', localQuestion);

		// For now also just send same event to all players - QuizPlayScene will decide what to display
		// Special cases such as the one below will need to be catered for here... for now just send to all
		this.room.emitToAllPlayers('server:showanswer', localQuestion);

		// Special case for draw questions - we show all answers on the host screen but send each player a different player's answer and get them to score it
		if (this.question.type === 'draw') {
			this.submitToPlayersForScoring(localQuestion);
		} else {
			const scores = this.calculatePlayerScores(localQuestion);
			console.log('showAnswer: calculated scores:', scores);
			this.room.emitToAllPlayers('server:showanswer', { 'scores': scores });
		}
	}

	// submitToPlayersForScoring
	// For draw questions we want to divide up all the answers and distribute them to players for scoring
	submitToPlayersForScoring(question) {

		// We need to send each player a different answer to score, from the players who answered the question
		const players = question.results ? this.room.players.filter(player => question.results[player.sessionID]) : [];
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
			if (player && question.results[player.sessionID]) {
				const index = players.findIndex(p => p.sessionID === player.sessionID);
				if (index >= 0) {
					const targetPlayer = players[index + 1] || players[0];
					question.results[targetPlayer.sessionID].score = response;
				}
				console.log('server.quiz::submitToPlayersForScoring: updated question results:', question.results);
			}
		}

		players.forEach((player, index) => {
			const playerAnswer = question.results[player.sessionID];
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
	// This function assumes scores have ALREADY been stored in question.results
	updateScores() {
		console.log('server.quiz:: updateScores:', this.roundNumber, this.questionNumber);

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
				const scoreQuestion = this.calculatePlayerScores(this.quizData.rounds[i].questions[j]);
				addDictionaries(scores, scoreQuestion);
				console.log('Round Question:', i, j);
				console.log('Results:', this.quizData.rounds[i].questions[j].results);
				console.log('Question:', scoreQuestion);
				console.log('Scores:', scores);
			}
		}
		console.log('updateScores:', scores);
		this.room.emitToHosts('server:updatescores', { 'scores': scores });
	}

	// calculatePlayerScores
	// For a single question we have all the player's answers stored in question.results
	// This is a dictionary, keyed on player sessionID, with the value being the answer
	// Each question type has its own scoring method - principle is the same:
	// Loop through the keys of the results dictionary calculating a score for each player
	calculatePlayerScores(question) {
		console.log('calculatePlayerScores:', question);

		var scores = {};

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
				Object.keys(question.results).forEach((sessionID) => {
					const simpleResult = createSimpleString(question.results[sessionID]);
					if (levenshteinDistance(simpleAnswerText, simpleResult) < 3) {
						scores[sessionID] = 1;
					}
				});
				break;

			case 'multiple-choice':
			case 'true-false':
			case 'number-exact':
				const simpleAnswer = createSimpleString(question.answer);
				Object.keys(question.results).forEach((sessionID) => {
					console.log('this.calculatePlayerScores: ', simpleAnswer, question.results[sessionID]);
					if (createSimpleString(question.results[sessionID]) == simpleAnswer) {
						scores[sessionID] = 1;
					}
				});
				break;

			case 'number-closest':
				// Calculate distance from correct answer using objects with named properties
				var distances = [];
				Object.keys(question.results).forEach((sessionID) => {
					distances.push({
						sessionID: sessionID,
						distance: Math.abs(parseFloat(question.results[sessionID]) - parseFloat(question.answer))
					});
				});

				// Sort by distance (ascending)
				distances = distances.sort((a, b) => a.distance - b.distance);

				// Closest gets 2 points, next 1 point
				console.log('number-closest:', question.answer, question.results, distances);

				var nextPlayer = 1;
				if (distances.length > 0) {
					scores[distances[0].sessionID] = 2;

					// Award 2 points to any players tied for first place
					for (let i = nextPlayer; i < distances.length; i++) {
						if (distances[i].distance === distances[0].distance) {
							scores[distances[i].sessionID] = 2;
							nextPlayer++;
						}
					}
				}

				// If more than one team was assigned 2 points above then don't award any more points
				if (distances.length > 1 && nextPlayer === 1) {
					scores[distances[1].sessionID] = 1;
					nextPlayer = 2;

					// Award 1 point to any players tied for second place
					if (distances.length > 2) {
						for (let i = nextPlayer; i < distances.length; i++) {
							if (distances[i].distance === distances[1].distance) {
								scores[distances[i].sessionID] = 1;
							}
						}
					}
				}
				break;

			// matching is similar to ordering - except our answer contains a left and right pair
			// We only need to consider the left and check the order of the result is the same
			// question.answer holds the correct order
			case 'ordering':
			case 'matching':
				Object.keys(question.results).forEach((sessionID) => {
					const length = Math.min(question.answer.length, question.results[sessionID].length);
					var score = 0;
					console.log('this.calculatePlayerScores: ordering:', question.answer, question.results[sessionID]);
					for (let i = 0; i < length; i++) {
						console.log(question.answer[i], question.results[sessionID][i]);
						if (question.answer[i] == question.results[sessionID][i]) {
							score++; // Increment score for matching elements
						}
					}
					// You don't score for the final item since this is a given
					if (score == question.answer.length) score--;
					scores[sessionID] = score;
				});
				break;

			case 'hotspot':
				// We would usually use a dictionary but since we have to sort the distances we use an array instead
				var distances = [];
				Object.keys(question.results).forEach((sessionID) => {
					distances.push([sessionID, Math.hypot(parseInt(question.results[sessionID].x) - question.answer.x, parseInt(question.results[sessionID].y) - question.answer.y)]);
				});
				distances = distances.sort(([, valueA], [, valueB]) => valueA - valueB);
				// Closest gets 2 points, next 1 point. Plus a bonus point to all other values within a threshold of second place
				console.log('hotspot:', question.answer, question.results, distances);
				if (distances.length > 0) {
					scores[distances[0][0]] = 2;
				}
				if (distances.length > 1) {
					scores[distances[1][0]] = 1;
				}
				break;

			case 'point-it-out':
				// This is simpler than hotspot since its just a right/wrong answer based on the rectangle hit area
				Object.keys(question.results).forEach((sessionID) => {
					if ((question.results[sessionID].x >= question.answer.start.x) &
						(question.results[sessionID].x <= question.answer.end.x) &
						(question.results[sessionID].y >= question.answer.start.y) &
						(question.results[sessionID].y <= question.answer.end.y)) {
						scores[sessionID] = 1;
					}
				});
				break;

			case 'draw':
				Object.keys(question.results).forEach((sessionID) => {
					if (question.results[sessionID].score) {
						scores[sessionID] = question.results[sessionID].score;
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

	endQuiz() {
		console.log('endQuiz:', this.quizData);
		const scores = this.calculatePlayerScores();
		this.room.emitToHosts('server:endquiz', { quiz: this.quizData } );
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

// Notes:
// From New York Times Quiz
// President-elect Donald J. Trump was convicted of falsifying records to cover up a sex scandal that threatened to derail his 2016 presidential campaign. On how many felony counts did a Manhattan jury find Mr. Trump guilty on May 30?

// (Climate) In June, more than 1,300 people died while attending what major event in Saudi Arabia as temperatures surpassed 100 degrees Fahrenheit?

// “Inside Out 2,” the summer’s biggest movie, delivered a fresh crop of emotions for Riley, the Pixar film’s 13-year-old protagonist. What emotion, pictured center above, stole the show in the sequel?

// Unlike his victory in 2016, Mr. Trump did something he didn’t do in his first successful campaign for the White House. What was that?

// Republicans cemented their control of the House of Representatives on Nov. 13, handing them a “governing trifecta” in Washington to enact President-elect Donald J. Trump’s agenda.

// What does a governing trifecta mean?

// Early on Dec. 4, a masked gunman assassinated Brian Thompson on a Midtown Manhattan street. Mr. Thompson was a chief executive in what industry?

// Taylor Swift ended her 21-month-long Eras Tour on Dec. 8, capping another monster year for the pop superstar.
// Whata was the name of the World Tour?

// In a stunning turn of events after 13 years of civil war, rebels marched into Damascus as Syria’s president fled to Russia. Until Dec. 8, what family had ruled Syria for more than five decades?

// What word was named Oxford’s 2024 Word of the Year?
