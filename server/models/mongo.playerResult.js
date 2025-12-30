import mongoose from 'mongoose';

const playerResultSchema = new mongoose.Schema({
    sessionID: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Null for guests
    displayName: { type: String, required: true },
    avatar: { type: String },
    
    score: { type: Number, default: 0 },
    rank: { type: Number }, // 1 for winner, 2 for runner up, etc.
    
    // Flexible stats object for granular data
    // e.g. { correctCount: 10, totalQuestions: 12, avgResponseTime: 1.5 }
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // Feedback/Rating (optional)
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String }
}, { timestamps: false });

// Index for fast dashboard lookups
playerResultSchema.index({ userID: 1, createdAt: -1 });

export default mongoose.model('PlayerResult', playerResultSchema);
