import mongoose from 'mongoose';

// Define the schema for matching pairs
const matchingPairSchema = new mongoose.Schema({
    left: { type: String },
    right: { type: String }
}, { _id: false }); // Prevent automatic _id generation for matching pairs

// Define the Question schema
const questionSchema = new mongoose.Schema({
    type: { type: String, required: true },
    text: { type: String },
    image: { type: String },
    audio: { type: String },
    video: { type: String },
    options: [{ type: String }],
    items: [{ type:String }],
    pairs: [matchingPairSchema], // Array of matching pairs without _id
    extra: { type: mongoose.Schema.Types.Mixed },   // Misc extra data eg labels for ordering
    answer: { type: mongoose.Schema.Types.Mixed },
}, { _id: false }); // Prevent automatic _id generation for questions

// Define the QuizRound schema
const quizRoundSchema = new mongoose.Schema({
    title: { type: String },
    description: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the User model
    roundTimer: { type: String, required: true, default: '0' },
    showAnswer: { type: String, required: true, default: 'round' },
    updateScores: { type: String, required: true, default: 'round' },
    questions: [questionSchema] // Array of questions without _id
});


// Define the Quiz schema
const quizSchema = new mongoose.Schema({
    title: { type: String },
    description: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    public: { type: mongoose.Schema.Types.Boolean, required: true, default: true },
    validation: [ {type: Object} ],
    rounds: [quizRoundSchema] // Array of rounds
}, { timestamps: false }); // Automatically manage createdAt and updatedAt fields - OFF for now...


// This is an experiment with adding methods to this model to include reading/writing to the DB
// That way we only need to include this Model and it will encapsulate all the DB operations
// This is a good idea because it keeps all the DB operations in one place
quizSchema.statics.getQuizByID = async function (quizID) {
    try {
        // Add lean() to return a plain JS object instead of a Mongoose document
        // Among other things, this means you can't modify the object and save it back to the DB
        // If I want to store the results of the quiz they should be stored separately
        const quiz = await this.findById(quizID).lean();
        if (!quiz) {
            throw new Error('Quiz not found');
        }
        return quiz;
    } catch (error) {
        throw new Error('Error retrieving quiz data: ' + error.message);
    }
}

const Quiz = mongoose.model('Quiz', quizSchema);

export default Quiz;