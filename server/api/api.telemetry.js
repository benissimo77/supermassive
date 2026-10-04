import express from 'express';
import telemetryController from '../controllers/telemetryController.js';

const router = express.Router();

// Telemetry is server-ops/diagnostic data, not a per-host feature - admin only.
function checkAdmin(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'admin') {
        return next();
    }
    if (process.env.NODE_ENV === 'development') {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
}

router.use(checkAdmin);

// GET /api/telemetry/all - everything the dashboard needs in one request (see telemetryController)
router.get('/all', telemetryController.getAllTelemetry);

export default router;
