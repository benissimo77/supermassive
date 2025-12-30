import mongoose from 'mongoose';

const gameSessionSchema = new mongoose.Schema({
    gameType: { type: String, required: true, index: true }, // 'quiz', 'drawing', etc.
    gameID: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', index: true }, // Reference to the specific quiz/game definition
    hostID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Who hosted it
    roomCode: { type: String, required: true },
    startTime: { type: Date, required: true },
    duration: { type: Number }, // Duration in seconds
    
    // Flexible metadata for game-specific info (e.g. quiz title, total questions)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model('GameSession', gameSessionSchema);
