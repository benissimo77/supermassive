import express from 'express';
import Season from '../models/mongo.season.js';

const router = express.Router();

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

/**
 * GET /api/seasons/public
 * List all seasons marked as public (any owner). No auth required — public data.
 */
router.get('/public', async (req, res) => {
    try {
        const seasons = await Season.find({ isPublic: true }).sort({ updatedAt: -1 });
        res.json({ success: true, data: seasons });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.use(checkAuth);

/**
 * GET /api/seasons
 * List all seasons owned by the authenticated user
 */
router.get('/', async (req, res) => {
    try {
        const ownerID = req.user?._id;
        if (!ownerID && process.env.NODE_ENV !== 'development') {
            return res.status(400).json({ success: false, message: 'User ID not found' });
        }

        const query = ownerID ? { ownerID } : {};
        const seasons = await Season.find(query).sort({ updatedAt: -1 });

        res.json({ success: true, data: seasons });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/seasons
 * Create a new season.
 * Body: { name, seriesName?, description?, startDate?, endDate?, defaultTime? }
 */
router.post('/', async (req, res) => {
    try {
        const { name, seriesName, description, startDate, endDate, defaultTime, timezone } = req.body;
        const ownerID = req.user?._id;

        if (!name) {
            return res.status(400).json({ success: false, message: 'name is required' });
        }

        const season = new Season({
            ownerID,
            name,
            seriesName,
            description,
            startDate,
            endDate,
            defaultTime,
            timezone,
            isPublic: false
        });

        await season.save();
        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


/**
 * GET /api/seasons/:id
 * Get a season with its episode titles populated from the quiz collection.
 * Only the owner can view a private season; anyone authenticated can view a public one.
 */
router.get('/:id', async (req, res) => {
    try {
        const season = await Season.findById(req.params.id)
            .populate('episodes.quizID', 'title');

        if (!season) {
            return res.status(404).json({ success: false, message: 'Season not found' });
        }

        const isOwner = String(season.ownerID) === String(req.user?._id);
        if (!isOwner && !season.isPublic) {
            // Same 404 as a missing season — don't reveal that a private season with this id exists
            return res.status(404).json({ success: false, message: 'Season not found' });
        }

        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/seasons/:id
 * Update season metadata (name, seriesName, description, startDate, endDate, defaultTime, isActive).
 * Owner only — being public makes a season readable, not writable, by other hosts.
 */
router.post('/:id', async (req, res) => {
    try {
        const existing = await Season.findById(req.params.id, { ownerID: 1 });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Season not found' });
        }
        if (String(existing.ownerID) !== String(req.user?._id)) {
            return res.status(403).json({ success: false, message: 'You do not have permission to edit this season' });
        }

        const allowed = ['name', 'description', 'startDate', 'endDate', 'defaultTime', 'timezone', 'isPublic', 'episodes'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key] === '' ? null : req.body[key];
            }
        }

        const season = await Season.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: false }
        );

        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


export default router;
