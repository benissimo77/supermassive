// ROUTES
// This file sets up /solo - a zero-friction, no-login entry point where a single
// person plays a quiz on their own: they see the real host view and answer questions
// themselves via one dual-registered socket (both host AND player server-side - see
// Room.addUserToRoom's isSolo branch), with the player's own interactive question UI
// composed directly into the host's screen client-side (see BaseQuestion.ts's
// playerDelegate). This route just creates the room and, once the visitor has picked
// a name/avatar via the entry form below, serves the exact same host page /host/:room/:game
// serves - just reached unauthenticated (see socketserver.js identifyUser() for how this
// referer path is granted normal host privileges).
import express from 'express';
const router = express.Router({ strict: true });

const generateNewRoomName = () => {
	const chars = 'BCDFGHJKLMNPQRSTVWXYZ';
	let result = '';
	for (let i = 0; i < 4; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

// Start a solo game (The Redirector) - generates a room and redirects to the solo
// stage for that room. The player themselves still picks their own name/avatar via
// the normal player entry journey (see public/solo/entry.html) - this route doesn't
// assign an identity, same as the real host-start flow doesn't either.
router.get('/:game/start', (req, res) => {
	const q = req.query.q;
	const seasonID = req.query.s;
	const game = req.params.game;

	const newRoom = generateNewRoomName();
	req.session.room = newRoom;

	req.session.save(() => {
		// room is included here (as well as already being in the path) because
		// play-entry.js's unmodified prefill logic reads it from the query string -
		// without it, it would fall back to a possibly-stale localStorage room code.
		const queryParams = [`room=${newRoom}`];
		if (q) queryParams.push(`q=${encodeURIComponent(q)}`);
		if (seasonID) queryParams.push(`s=${encodeURIComponent(seasonID)}`);
		res.redirect(`/solo/${newRoom}/${game}?${queryParams.join('&')}`);
	});
});

// The solo stage - not yet identified (no name/avatar in session) serves the
// full-screen join form first; once identified, serves the real host page directly
// (the same static file routes.host.js serves at /host/:room/:game, just without the
// isAuth/checkHost/checkRoom gate that namespace applies to everything under it).
router.get('/:room([A-Z]{4})/:game', (req, res) => {
	if (req.session.name && req.session.avatar) {
		res.sendFile(`${req.params.game}/index.html`, { root: './host' });
	} else {
		res.sendFile('entry.html', { root: './public/solo' });
	}
});

// Submits the join form above - mirrors routes.public.js's POST /play (same fields,
// same session shape) but redirects back to this same solo stage instead of straight
// into standalone /play/:room, so the player lands on the real host view having
// already joined, rather than on the real player page with no host view in sight.
router.post('/:room([A-Z]{4})/:game', (req, res) => {
	req.session.room = req.params.room.toUpperCase();
	req.session.name = req.body.name;
	req.session.avatar = req.body.avatar;
	req.session.host = false;

	req.session.save(() => {
		res.redirect(req.originalUrl);
	});
});

export default router;
