import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema({
    ownerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seriesName: { type: String }, // Optional brand name e.g. "Pub Quiz @ Home", "The Gauntlet"
    name: { type: String, required: true }, // e.g. "Series 1", "Winter 2026"
    description: { type: String },

    // Status
    isPublic: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    defaultTime: { type: String, default: '18:00' }, // "HH:MM" fallback air time for episodes that don't override it
    timezone: { type: String, default: 'UTC' }, // IANA name (e.g. "America/New_York") the host's times were entered in

    // The "Episodes" - ordered list of quizzes in this season
    episodes: [{
        quizID: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
        airDate: { type: Date },
        airTime: { type: String, default: null }, // "HH:MM" override; null means use the season's defaultTime
        label: { type: String } // e.g. "Episode 1", "The Grand Finale"
    }]
}, { timestamps: true });

// Quickly find active seasons for a given owner
seasonSchema.index({ ownerID: 1, isPublic: 1 });

export default mongoose.model('Season', seasonSchema);
