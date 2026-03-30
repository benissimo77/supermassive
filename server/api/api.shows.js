import express from 'express';
import Show from '../models/mongo.show.js';
import Season from '../models/mongo.season.js';

const router = express.Router();

// Middleware to check if the user is authorized (host/admin)
function checkAuth(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        const role = req.user.role;
        if (['host', 'admin'].includes(role)) {
            return next();
        }
    } else if (process.env.NODE_ENV === 'development') {
        return next();
    }
    return res.status(401).json({ success: false, message: 'Unauthorized' });
}

router.use(checkAuth);

/**
 * GET /api/shows
 * List all shows owned by the authenticated user
 */
router.get('/', async (req, res) => {
    try {
        const ownerID = req.user?._id;
        if (!ownerID && process.env.NODE_ENV !== 'development') {
            return res.status(400).json({ success: false, message: 'User ID not found' });
        }

        const query = ownerID ? { ownerID } : {};
        const shows = await Show.find(query).sort({ updatedAt: -1 });
        
        res.json({ success: true, data: shows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/shows
 * Create a new show
 */
router.post('/', async (req, res) => {
    try {
        const { title, description, accentColor } = req.body;
        const ownerID = req.user?._id;

        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        // Generate a slug from the title
        let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        // Ensure unique slug
        const existing = await Show.findOne({ slug });
        if (existing) {
            slug = `${slug}-${Date.now().toString().slice(-4)}`;
        }

        const show = new Show({
            title,
            slug,
            description,
            ownerID,
            visuals: { accentColor: accentColor || '#FF5500' }
        });

        await show.save();
        
        // Automatically create "Season 1" for any new show (YAGNI simplification)
        const season = new Season({
            showID: show._id,
            name: "Season 1",
            isActive: true
        });
        await season.save();

        res.json({ success: true, data: show });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/shows/:id
 * Get show details including its seasons
 */
router.get('/:id', async (req, res) => {
    try {
        const show = await Show.findById(req.params.id);
        if (!show) {
            return res.status(404).json({ success: false, message: 'Show not found' });
        }

        const seasons = await Season.find({ showID: show._id })
            .populate('episodes.quizID', 'title')
            .sort({ createdAt: -1 });
        
        res.json({ 
            success: true, 
            data: { 
                ...show.toObject(), 
                seasons 
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/shows/:showId/seasons/:seasonId/episodes
 * Add a quiz to a season
 */
router.post('/:showId/seasons/:seasonId/episodes', async (req, res) => {
    try {
        const { quizID, label, airDate } = req.body;
        const season = await Season.findOne({ _id: req.params.seasonId, showID: req.params.showId });
        
        if (!season) return res.status(404).json({ success: false, message: 'Season not found' });
        
        // Don't add if already exists? (Optional check)
        season.episodes.push({ 
            quizID, 
            label: label || `Episode ${season.episodes.length + 1}`, 
            airDate: airDate || new Date() 
        });
        
        await season.save();
        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
