import mongoose from 'mongoose';

const showSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    ownerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Visual Identity
    visuals: {
        bannerImage: { type: String },
        accentColor: { type: String, default: '#FF5500' },
        theme: { type: String, default: 'dark' }
    },

    // Metadata
    isPublic: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Show', showSchema);
