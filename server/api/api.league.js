import express from 'express';
import League from '../models/mongo.league.js';

const router = express.Router();

/**
 * Get all leagues for the current user
 */
router.get('/my-leagues', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        const leagues = await League.find({ 
            $or: [
                { ownerID: req.user._id },
                { members: req.user._id }
            ]
        }).sort({ updatedAt: -1 });
        
        res.json(leagues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create a new league
 */
router.post('/create', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        const { name, slogan, visuals } = req.body;
        
        const league = await League.create({
            name,
            ownerID: req.user._id,
            members: [req.user._id],
            visuals: visuals || { motto: slogan }
        });

        res.json({ success: true, league });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Join a league via unique ID
 */
router.post('/join/:id', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        const league = await League.findById(req.params.id);
        if (!league) return res.status(404).json({ error: 'League not found' });

        if (!league.members.includes(req.user._id)) {
            league.members.push(req.user._id);
            await league.save();
        }

        res.json({ success: true, league });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
