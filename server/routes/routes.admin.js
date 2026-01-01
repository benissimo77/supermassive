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
	if (req.params.room) {
		req.session.room = req.params.room;
	}

	if (req.session && req.session.room) {
		next();
	} else {
		res.redirect('/host/dashboard');
	}
}

// All admin routes require admin privileges
router.use([isAuth, isAdmin]);

// Admin Stage
// Allows viewing the admin panel for a specific room/game
// URL: /admin/:room/:game
router.get('/:room([A-Z]{4})/:game', checkRoom, (req, res) => {
	const { game } = req.params;
	res.sendFile('admin/index.html', { root: './host' });
});

// Admin Dashboard
router.get('/', (req, res) => {
	res.sendFile('index.html', { root: './public/admin' });
});

export default router;
