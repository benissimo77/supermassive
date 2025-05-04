// ROUTES
import express from 'express';
const router = express.Router();

// Route for when user submits PLAY form
router.post('/play', (req, res) => {
	console.log('A user has POSTed:', req.body, req.session);
	// Validate req.body.room and req.body.name req.body.avatar
	// Note - might not need to validate here since will validate after the redirect
	// Just basic 'do they exist' on fields

	// Assume validated - store their entered details in a cookie so no need to retrieve after
	req.session.room = req.body.room.toUpperCase();
	req.session.name = req.body.name;
	req.session.avatar = req.body.avatar;
	req.session.host = false;
	// const redirect = 'play';
	// console.log('Validated - redirecting to:', redirect);
	// res.redirect(redirect);
	res.sendFile('play.html', { root: './public' });
})


// // And a route for the expected shape of the URL when a player wants to play a game (ROOM/NAME)
// // Passed here via successful redirect from above POST request, also useful if the user refreshes the page in their browser
// router.get('/play', (req, res) => {
// 	console.log('routes.get /play:', req.params, req.session, req.query, req.originalUrl);
// perform validation on room / name here...

// If no session data then first-time go direct to index.html to fill out player form
// Otherwise we already have details set up - go instead to play.html
// NOTE: this works well, but not sure I like this way of doing things
// I have play/index.html set up so just calling videoswipe.net/play will go to the exact right place
// Why complicate things further by intercepting this route and modifying it here?
// if (req.session.room) {
// 	res.sendFile('play.html', { root: './public' });
// } else {
// 	res.sendFile('play/index.html', { root: './public' });
// }
// })


export default router;
