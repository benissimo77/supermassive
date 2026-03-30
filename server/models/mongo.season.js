import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema({
    showID: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true, index: true },
    name: { type: String, required: true }, // e.g. "Series 1", "Winter 2026"
    description: { type: String },
    
    // Status
    isActive: { type: Boolean, default: true },
    startDate: { type: Date },
    endDate: { type: Date },

    // The "Episodes" - ordered list of quizzes in this season
    episodes: [{
        quizID: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
        airDate: { type: Date },
        label: { type: String } // e.g. "Episode 1", "The Grand Finale"
    }]
}, { timestamps: true });

// Ensure we can quickly find the active season for a show
seasonSchema.index({ showID: 1, isActive: 1 });

export default mongoose.model('Season', seasonSchema);
