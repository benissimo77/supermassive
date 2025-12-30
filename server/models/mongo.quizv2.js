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
    items: [{ type: String }],
    pairs: [matchingPairSchema], // Array of matching pairs without _id
    extra: { type: mongoose.Schema.Types.Mixed },   // Misc extra data eg labels for ordering
    answer: { type: mongoose.Schema.Types.Mixed },

    // Lineage + permissions + generation (how many times changed from original)
    ownerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentID: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
    familyID: { type: mongoose.Schema.Types.ObjectId, index: true },
    validated: { type: Boolean, default: false },
    generation: { type: Number, default: 1 },

}, { _id: true }); // We want automatic _id generation for questions since quizzes will reference them

// Define the QuizRound schema
const quizRoundSchema = new mongoose.Schema({
    title: { type: String },
    description: { type: String },
    ownerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the User model
    roundTimer: { type: String, required: true, default: '0' },
    showAnswer: { type: String, required: true, default: 'round' },
    updateScores: { type: String, required: true, default: 'round' },

    // NEW — question references
    questions: [ mongoose.Schema.Types.ObjectId ]
    
}, { _id: false });


// Define the Quiz schema
const quizV2Schema = new mongoose.Schema({
    schemaVersion: { type: Number, default: 2 },
    title: { type: String },
    description: { type: String },
    ownerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    public: { type: mongoose.Schema.Types.Boolean, required: true, default: true },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rounds: [quizRoundSchema],
}, { _id: true, timestamps: false }); // Automatically manage createdAt and updatedAt fields - OFF for now...


// This is an experiment with adding methods to this model to include reading/writing to the DB
// That way we only need to include this Model and it will encapsulate all the DB operations
// This is a good idea because it keeps all the DB operations in one place
quizV2Schema.statics.getQuizByID = async function (quizID) {
    try {
        // Add lean() to return a plain JS object instead of a Mongoose document
        // Among other things, this means you can't modify the object and save it back to the DB
        // If I want to store the results of the quiz they should be stored separately
        const quiz = await this.findById(quizID).populate({
                        path: 'rounds.questions',
                        model: 'Question'
                    }).lean();
        if (!quiz) {
            throw new Error('Quiz not found');
        }
        return quiz;
    } catch (error) {
        throw new Error(`Error retrieving quiz ${quizID}: ${error.message}`);

    }
}

export const Question = mongoose.model('Question', questionSchema);
export const QuizV2 = mongoose.model('QuizV2', quizV2Schema);

