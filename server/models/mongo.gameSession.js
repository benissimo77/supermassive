import mongoose from 'mongoose';

const gameSessionSchema = new mongoose.Schema({
    gameType: { type: String, required: true, index: true }, // 'quiz', 'drawing', etc.
    gameID: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', index: true }, // Reference to the specific quiz/game definition
    hostID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Who hosted it
    roomCode: { type: String, required: true },
    startTime: { type: Date, required: true },
    duration: { type: Number }, // Duration in seconds

    // Competition tracking:
    // isLive - if not then we likely won't want to include in leaderboards
    // verificationLevel allows us to filter out unverified or low-quality sessions from leaderboards
    isLive: { type: Boolean, default: false },
    verificationLevel: { type: Number, default: 3 }, // 0: VideoSwipe, 1: Trusted, 2: Verified, 3: Everyone
    
    // Optional season this game belongs to (null for standalone one-off quizzes)
    // Current thinking is that a quiz must be placed into a season to be eligible for leaderboard aggregation, but this could change in the future
    seasonID: { type: mongoose.Schema.Types.ObjectId, ref: 'Season', index: true, default: null },
    
    // Flexible metadata for game-specific info (e.g. quiz title, total questions)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model('GameSession', gameSessionSchema);
