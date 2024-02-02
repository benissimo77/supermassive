// ROUTES
const express = require('express');
const router = express.Router();

// Define a route for the home page
router.get('/xxx', (req, res) => {
    console.log('Root request access - clearing cookie');
    req.session = null;
    res.sendFile('index.html', { root: './public'});
  })

// Access the session as req.session
router.get('/', function (req, res) {
	console.log('GET /: ', req.session);
	if (req.session.views) {
		req.session.views++;
		res.sendFile('index.html', { root: './public' });
	} else {
		req.session.views = 1
		res.end('welcome to the session demo. refresh!')
	}
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
	const redirect = 'play';
	console.log('Validated - redirecting to:', redirect);
	res.redirect(redirect);
})

// // And a route for the expected shape of the URL when a player wants to play a game (ROOM/NAME)
// // Passed her via successful redirect from above POST request, also useful if the user refreshes the page in their browser
router.get('/play', (req, res) => {
	console.log('routes.get /play:', req.params, req.session, req.query, req.originalUrl);
	// perform validation on room / name here...
	res.sendFile('play.html', { root: './public' });
})


router.get('/host', (req, res) => {
	console.log('router.get /host');
	// Authorise user here

	// If already in a room then use it, otherwise generate random room name
	if (req.session.room) {
		console.log('Already in room:', req.session.room);
	} else {
		req.session.room = generateNewRoomName();
	}
	req.session.host = true;
	res.sendFile('host.html', { root: './public' })
})

// For development - admin console
router.get('/admin', (req, res) => {
	// Authorise user here
	res.sendFile('index.html', { root: './public/admin' })
})

const generateNewRoomName = () => {
	return 'WOLF';
}

module.exports = router;
