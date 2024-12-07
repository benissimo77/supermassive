const mongoose = require('mongoose');

// Define the Question schema
const questionSchema = new mongoose.Schema({
    type: { type: String, required: true },
    text: { type: String },
    image: { type: String },
    audio: { type: String },
    options: [{ type: String }],
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
    public: { type:mongoose.Schema.Types.Boolean, required: true, default:true },
    rounds: [quizRoundSchema] // Array of rounds
}, { timestamps: true }); // Automatically manage createdAt and updatedAt fields


// This is an experiment with adding methods to this model to include reading/writing to the DB
// That way we only need to include this Model and it will encapsulate all the DB operations
// This is a good idea because it keeps all the DB operations in one place
quizSchema.statics.getQuizByID = async function(quizID) {
    try {
        const quiz = await this.findById(quizID);
        if (!quiz) {
            throw new Error('Quiz not found');
        }
        return quiz;
    } catch (error) {
        throw new Error('Error retrieving quiz data: ' + error.message);
    }
}

module.exports = mongoose.model('Quiz', quizSchema);