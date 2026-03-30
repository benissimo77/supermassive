import mongoose from 'mongoose';

const quizRatingSchema = new mongoose.Schema({
    quizID: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    gameSessionID: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Null for guest players
    playerSessionID: { type: String, required: true, index: true }, // Transient session ID to identify guest players
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxLength: 500 }
}, { timestamps: true });

// Prevent multiple ratings from the same player in the same game session
// We use playerSessionID as the primary identifier for both guests and users
quizRatingSchema.index({ gameSessionID: 1, playerSessionID: 1 }, { unique: true });

export default mongoose.model('QuizRating', quizRatingSchema);
