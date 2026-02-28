import mongoose from 'mongoose';

const playerResultSchema = new mongoose.Schema({
    gameSessionID: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    sessionID: { type: String, index: true }, // The transient browser session ID for guests
    userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Null for guests
    displayName: { type: String, required: true },
    avatar: { type: String },
    isBot: { type: Boolean, default: false },
    
    rank: { type: Number }, // 1 for winner, 2 for runner up, etc.

    // Promoted stats for leaderboard performance
    totalQuestions: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    
    // Detailed responses for 'ghost playback' and granular analytics
    // e.g. [{ questionText: "...", answer: "...", time: 1.2, score: 100 }]
    responses: [{
        questionText: String,
        answer: mongoose.Schema.Types.Mixed,
        time: Number,
        score: Number
    }],

    // Feedback/Rating (optional)
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String }
}, { timestamps: false });

export default mongoose.model('PlayerResult', playerResultSchema);
