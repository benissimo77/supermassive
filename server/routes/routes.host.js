// ROUTES
// This file sets up the routes for /host - hosting a game OR general host page showing general host info
// Must be logged in to view these routes
import express from 'express';
const router = express.Router({ strict: true });

const isAuth = (req, res, next) => {
	// console.log('isAuth:', req.user, req.session, req.isAuthenticated());
	if (req.isAuthenticated()) {
		console.log('routes.host.isAuth:: User is authenticated:', req.user);
		next();
	} else {
		// res.status(401).json({ msg: 'You are not authorized to view this resource' });
		res.redirect('/login');
	}
}

const isAdmin = (req, res, next) => {
	if (req.isAuthenticated() && req.user.role === 'admin') {
		next();
	} else {
		res.redirect('/login');
		// res.status(401).json({ msg: 'You are not authorized to view this resource because you are not an admin.' });
	}
}

// Middleware to check if the user is a host
function checkHost(req, res, next) {
	// console.log('checkHost:', req.session, req.url, req.originalUrl, req.baseUrl, req.path, req.params, req.query);
	if (req.session && req.session.host) {
		console.log('checkHost:: User is a host:', req.session.host);
		next();
	} else {
		//res.redirect('/login');
		// Since user has come via the /host directory and this has been authenticated then user must be a host
		req.session.host = 1;
		console.log('checkHost:: User is not a host, setting host:', req.session.host);
		next();
	}
}

// Middleware to check if the (host) user is in a room - creates a new room if not
function checkRoom(req, res, next) {
	// If room is in the URL, use it
	if (req.params.room) {
		req.session.room = req.params.room;
	}

	// In development we want to be able to override the room name by adding directly to query
	if (process.env.NODE_ENV === 'development') {
		if (req.query.room) {
			req.session.room = req.query.room;
		}
	}

	if (req.session && req.session.room) {
		next();
	} else {
		// If no room, redirect to dashboard to start one
		console.log('checkRoom:: No room in session, redirecting to /host/dashboard');
		res.redirect('/host/dashboard');
	}
}

// Base host routes (Auth only)
router.use([isAuth, checkHost]);

// Static files with extension support
// This handles /host/dashboard -> host/dashboard/index.html
// and /host/dashboard/quiz -> host/dashboard/quiz/index.html
// and /host/dashboard/quiz/edit -> host/dashboard/quiz/edit.html
router.use(express.static('host', { extensions: ['html'] }));

// Dashboard Home Redirect
router.get('/', (req, res) => {
	res.redirect('/host/dashboard');
});

// Start a game (The Redirector)
// Generates a room and redirects to the Stage
router.get('/:game/start', (req, res) => {
	const room = generateNewRoomName();
	req.session.room = room;
	const game = req.params.game;
	const q = req.query.q ? `?q=${req.query.q}` : '';
	res.redirect(`/host/${room}/${game}${q}`);
});

// Active Game (The Stage)
// Serves the game files at the Room-prefixed URL
// We use a regex constraint [A-Z]{4} to ensure this only matches 4-character room codes,
// preventing it from intercepting routes like /host/dashboard/something
router.get('/:room([A-Z]{4})/:game', checkRoom, (req, res) => {
	const { game } = req.params;
	res.sendFile(`${game}/index.html`, { root: './host' });
});

// Static files for games
// We serve static files both at the root and with the room prefix to support relative paths
router.use('/:room([A-Z]{4})', express.static('host'));

const generateNewRoomName = () => {
	const chars = 'BCDFGHJKLMNPQRSTVWXYZ';
	let result = '';
	for (let i = 0; i < 4; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

export default router;
