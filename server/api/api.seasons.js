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
 * Body: { name, seriesName?, description?, startDate?, endDate? }
 */
router.post('/', async (req, res) => {
    try {
        const { name, seriesName, description, startDate, endDate } = req.body;
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
            isPublic: false
        });

        await season.save();
        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/seasons/public
 * List all seasons marked as public (any owner)
 */
router.get('/public', async (req, res) => {
    try {
        const seasons = await Season.find({ isPublic: true }).sort({ updatedAt: -1 });
        res.json({ success: true, data: seasons });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/seasons/:id
 * Get a season with its episodes populated
 */
router.get('/:id', async (req, res) => {
    try {
        const season = await Season.findById(req.params.id)
            .populate('episodes.quizID', 'title');

        if (!season) {
            return res.status(404).json({ success: false, message: 'Season not found' });
        }

        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/seasons/:seasonId/episodes
 * Add a quiz to a season.
 * Body: { quizID, label?, airDate? }
 */
router.post('/:seasonId/episodes', async (req, res) => {
    try {
        const { quizID, label, airDate } = req.body;

        // Get current episode count to generate a default label
        const existing = await Season.findById(req.params.seasonId, { episodes: 1 });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Season not found' });
        }

        const newEpisode = {
            quizID,
            label: label || `Episode ${existing.episodes.length + 1}`,
            airDate: airDate || new Date()
        };

        // Use $push via findByIdAndUpdate to bypass document-level validation
        // (avoids issues with legacy seasons that pre-date schema changes)
        const season = await Season.findByIdAndUpdate(
            req.params.seasonId,
            { $push: { episodes: newEpisode } },
            { new: true, runValidators: false }
        ).populate('episodes.quizID', 'title');

        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PATCH /api/seasons/:id
 * Update season metadata (name, seriesName, description, startDate, endDate, isActive)
 */
router.patch('/:id', async (req, res) => {
    try {
        const allowed = ['name', 'seriesName', 'description', 'startDate', 'endDate', 'isPublic'];
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
        if (!season) return res.status(404).json({ success: false, message: 'Season not found' });

        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PATCH /api/seasons/:seasonId/episodes/:episodeId
 * Update an episode's label or airDate
 */
router.patch('/:seasonId/episodes/:episodeId', async (req, res) => {
    try {
        const { label, airDate, quizID } = req.body;
        const setFields = {};
        if (label !== undefined) setFields['episodes.$.label'] = label;
        if (airDate !== undefined) setFields['episodes.$.airDate'] = airDate || null;
        if (quizID !== undefined) setFields['episodes.$.quizID'] = quizID || null;

        const season = await Season.findOneAndUpdate(
            { _id: req.params.seasonId, 'episodes._id': req.params.episodeId },
            { $set: setFields },
            { new: true }
        ).populate('episodes.quizID', 'title');

        if (!season) return res.status(404).json({ success: false, message: 'Episode not found' });
        res.json({ success: true, data: season });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/seasons/:seasonId/episodes/:episodeId
 * Remove an episode from a season
 */
router.delete('/:seasonId/episodes/:episodeId', async (req, res) => {
    try {
        const season = await Season.findByIdAndUpdate(
            req.params.seasonId,
            { $pull: { episodes: { _id: req.params.episodeId } } },
            { new: true }
        );
        if (!season) return res.status(404).json({ success: false, message: 'Season not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
