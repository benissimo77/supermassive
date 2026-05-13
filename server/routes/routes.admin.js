import express from 'express';
const router = express.Router({ strict: true });

const isAuth = (req, res, next) => {
	if (req.isAuthenticated()) {
		next();
	} else {
		res.redirect('/login');
	}
}

const isAdmin = (req, res, next) => {
	if (req.isAuthenticated() && req.user.role === 'admin') {
		next();
	} else {
		res.redirect('/login');
	}
}

// Middleware to check if the (admin) user is in a room
function checkRoom(req, res, next) {
	const roomFromUrl = req.params.room?.toUpperCase();
	const sessionRoom = req.session.room?.toUpperCase();
	const isAdmin = req.user?.role === 'admin' || req.user?.role === 'producer';

	if (roomFromUrl === sessionRoom || isAdmin) {
		return next();
	}

	res.redirect('/host/dashboard');
}

// All admin routes require admin privileges
router.use([isAuth, isAdmin]);

// Admin Stage
// Allows viewing the admin panel for a specific room
// URL: /admin/:room
router.get('/:room([A-Z]{4})', checkRoom, (req, res) => {
	const { game } = req.params;
	res.sendFile('admin/index.html', { root: './host' });
});

// Admin Dashboard
router.get('/', (req, res) => {
	res.sendFile('index.html', { root: './public/admin' });
});

// Server Status API
router.get('/server-status', (req, res) => {
	const io = req.app.get('io');
	const stats = io ? io.getRoomStats() : {};
	res.json({
		success: true,
		rooms: stats,
		roomCount: Object.keys(stats).length,
		timestamp: new Date()
	});
});

export default router;
