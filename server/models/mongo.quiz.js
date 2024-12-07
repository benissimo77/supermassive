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


module.exports = mongoose.model('Quiz', quizSchema);