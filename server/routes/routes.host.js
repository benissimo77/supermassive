// ROUTES
// This file sets up the routes for /host - hosting a game OR general host page showing general host info
// Must be logged in to view these routes
import express from 'express';
import User from '../models/mongo.user.js';
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

// Middleware to check if the (host) user is in a room
// Ensures user can only host the room currently in their session
function checkRoom(req, res, next) {
	const roomFromUrl = req.params.room?.toUpperCase();
	const sessionRoom = req.session.room?.toUpperCase();
	const isAdmin = req.user?.role === 'admin';

	if (roomFromUrl === sessionRoom || isAdmin) {
		return next();
	}

	console.warn(`routes.host.checkRoom:: Unauthorized host attempt for room ${roomFromUrl} (Session expects: ${sessionRoom})`);
	res.redirect('/host/dashboard');
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
// Host is redirected to /host/:room/:game and their activeRoom is saved for the Producer to follow.
router.get('/:game/start', async (req, res) => {
	const { q } = req.query;
	// Handle both seasonID and seasonId casing
	const seasonID = req.query.seasonID || req.query.seasonId;
	const game = req.params.game;

	console.log('routes.host:: /:game/start - starting game:', game, 'Quiz:', q, 'Season:', seasonID);

	if (!req.session || !req.session.room) {
		const newRoom = generateNewRoomName();
		req.session.room = newRoom;

		// Save the active room to the database for this user (enables Producer shadow role)
		if (req.user && req.user._id) {
			try {
				await User.findByIdAndUpdate(req.user._id, { activeRoom: newRoom });
				console.log(`routes.host:: Updated activeRoom to ${newRoom} for user ${req.user.email}`);
			} catch (err) {
				console.error('routes.host:: Failed to update activeRoom in DB:', err);
			}
		}
	}

	// Capture the 'Intent' in the session.
	// This makes the season/quiz IDs persistent across redirects 
	// without them needing to be in the URL bar.
	req.session.pendingGame = {
		quizID: q,
		seasonID: seasonID,
		gameType: game,
		timestamp: Date.now()
	};

	const room = req.session.room;
	
	// Clean redirect to the stage without leaking IDs in the URL
	req.session.save(() => {
		res.redirect(`/host/${room}/${game}`);
	});
});

// Catch room-only URLs and default to the lobby
router.get('/:room([A-Z]{4})', (req, res) => {
	res.redirect(`/host/${req.params.room}/lobby`);
});

// End / Retire a room
router.get('/:room([A-Z]{4})/end', async (req, res) => {
	const room = req.params.room.toUpperCase();
	console.log(`routes.host:: Request to end room: ${room}`);

	// Only clear if the user actually owns this room (protection)
	if (req.session.room?.toUpperCase() === room || req.user?.role === 'admin') {
		req.session.room = null;

		if (req.user && req.user._id) {
			try {
				await User.findByIdAndUpdate(req.user._id, { activeRoom: null });
				console.log(`routes.host:: Retired activeRoom in DB for user ${req.user.email}`);
			} catch (err) {
				console.error('routes.host:: Failed to clear activeRoom in DB:', err);
			}
		}
	}

	res.redirect('/host/dashboard');
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
