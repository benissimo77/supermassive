// ROUTES
// This file sets up the routes for /host - hosting a game OR general host page showing general host info
// Must be logged in to view these routes
const express = require('express');
const router = express.Router({ strict: true });


// Middleware to check if the user is a host
function checkHost(req, res, next) {
	console.log('checkHost:', req.session, req.url, req.originalUrl, req.baseUrl, req.path, req.params, req.query);
	if (req.session && req.session.host) {
	  next();
	} else {
	  //res.redirect('/login');
	  next();
	}
  }

// Apply the middleware to the /host route
router.use('/*', checkHost, (req, res, next) => {
	console.log('Middleware checkHost called:', req.session, req.url, req.baseUrl, req.path);

	// Middleware has already been called to authorise the host - so can assume they are authorised by now

	// If already in a room then use it, otherwise generate random room name
	if (req.session.room) {
		console.log('Already in room:', req.session.room);
	} else {
		req.session.room = generateNewRoomName();
		req.session.host = true;
		console.log('No room found - generating new one:', req.session.room);
	}
	res.sendFile(req.baseUrl, { root: __dirname });
})


router.get('/XXX', (req, res) => {
	console.log('router.get /:', req.session, req.url, req.baseUrl, req.path, req.params, req.query, req.originalUrl);
	checkHost();	// calling explicitly since the middleware operates on /host/*

	// If already in a room then use it, otherwise generate random room name
	if (req.session.room) {
		console.log('Already in room:', req.session.room);
	} else {
		req.session.room = generateNewRoomName();
		console.log('No room found - generating new one:', req.session.room);
	}
	req.session.host = true;
	res.sendFile('host/lobby.html', { root: __dirname });
})

// Serve all files from the host directory only to authorized users
//router.use('/host/*', express.static(__dirname + '/host'));
// const expressStatic = express.static(__dirname + '/host');
// router.use('/host/*', (req, res, next) => {
//   console.log('Static file request:', req.originalUrl, req.url, req.baseUrl, req.path, req.params, req.query, req.session);
//   // it looks like (for some reason) the req.url has a trailing slash added - no idea why, but remove it as its messing everything up
//   //req.url = req.url.replace(/\/$/, '');
//   expressStatic(req, res, next);
// });

//   router.use('/host', (req, res, next) => {
// 	console.log('Static file request:', req);
// 	res.sendFile( __dirname + req.originalUrl);
//   });

  
router.get('/login', (req, res) => {
	console.log('Redirecting host attempt to login page')
	// Render the login page
	res.sendFile('login.html', { root: './public' });
  });
  
  router.post('/login', (req, res) => {
	// Handle the login form submission
	// This is where you would check the user's credentials and set req.session.host
  });

// For development - admin console
router.get('/admin', (req, res) => {
	// Authorise user here
	res.sendFile('index.html', { root: './public/admin' })
})

router.post('/host/endgame', (req, res) => {
	// End the game
	// This is where you would check the user's credentials and set req.session.host
  });

  const generateNewRoomName = () => {
	return 'WOLF';
}

module.exports = router;
