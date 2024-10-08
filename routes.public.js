// ROUTES
const express = require('express');
const router = express.Router({ strict: true });

// Define a route for the home page
router.get('/', (req, res) => {
    console.log('Root request access - clearing cookie');
    req.session = null;
    res.sendFile('index.html', { root: './public'});
  })

// Route for when user submits PLAY form
router.post('/', (req, res) => {
	console.log('A user has POSTed:', req.body, req.session);
	// Validate req.body.room and req.body.name req.body.avatar
	// Note - might not need to validate here since will validate after the redirect
	// Just basic 'do they exist' on fields

	// Assume validated - store their entered details in a cookie so no need to retrieve after
	req.session.room = req.body.room.toUpperCase();
	req.session.name = req.body.name;
	req.session.avatar = req.body.avatar;
	req.session.host = false;
	const redirect = 'play';
	console.log('Validated - redirecting to:', redirect);
	res.redirect(redirect);
})


// // And a route for the expected shape of the URL when a player wants to play a game (ROOM/NAME)
// // Passed here via successful redirect from above POST request, also useful if the user refreshes the page in their browser
router.get('/play', (req, res) => {
	console.log('routes.get /play:', req.params, req.session, req.query, req.originalUrl);
	// perform validation on room / name here...
	res.sendFile('play.html', { root: './public' });
})


// For development - admin console
router.get('/admin', (req, res) => {
	// Authorise user here
	res.sendFile('index.html', { root: './public/admin' })
})


module.exports = router;
