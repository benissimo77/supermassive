import mongoose from 'mongoose';

const leagueSchema = new mongoose.Schema({
    name: { type: String, required: true },
    ownerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Member list
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // League Visuals / Branding
    visuals: {
        templateID: { type: String, default: 'classic-shield' },
        primaryColor: { type: String, default: '#FF5500' },
        secondaryColor: { type: String, default: '#333333' },
        sigil: { type: String, default: 'crown' },
        motto: { type: String, default: '' }
    },

    // Metadata
    description: { type: String },
    isPrivate: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('League', leagueSchema);
