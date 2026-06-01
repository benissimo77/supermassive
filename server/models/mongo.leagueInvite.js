import mongoose from 'mongoose';

const leagueInviteSchema = new mongoose.Schema({
    leagueID: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true, index: true },
    inviterID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true, index: true },
    targetEmail: { type: String, required: false, index: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' }
}, { timestamps: true });

export default mongoose.model('LeagueInvite', leagueInviteSchema);
