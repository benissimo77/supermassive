// ROUTES
// This file sets up the routes for /host - hosting a game OR general host page showing general host info
// Must be logged in to view these routes
const express = require('express');
const router = express.Router({ strict: true });


// Middleware to check if the user is a host
function checkHost(req, res, next) {
	console.log('checkHost:', req.url, req.originalUrl, req.baseUrl, req.path, req.params, req.query);
	if (req.session && req.session.host) {
	  next();
	} else {
	  //res.redirect('/login');
	  next();
	}
  }

// Apply the middleware to the /host route
// router.use('*', checkHost);
router.use('*', checkHost, (req, res, next) => {

	// console.log('Middleware checkHost called:', req.session, req.url, req.baseUrl, req.path);
	// Middleware has already been called to authorise the host - so can assume they are authorised by now

	// If already in a room then use it, otherwise generate random room name
	if (req.session.room) {
		console.log('routes.auth:: middleware:', req.session.room, req.baseUrl, req.originalUrl, __dirname);
	} else {
		req.session.room = generateNewRoomName();
		req.session.host = true;
		console.log('routes.auth:: generating new room:', req.session.room);
	}
	// res.sendFile(req.baseUrl, { root: __dirname });
	next();
})

// Serve all files from the host directory only to authorized users
// router.use('*', express.static(__dirname + '/host'));

const expressStatic = express.static(__dirname);
router.use('*', (req, res, next) => {
  console.log('routes.auth:: attempt at static:', req.originalUrl, req.url, req.baseUrl, req.path, req.params, req.query);
  // it looks like (for some reason) the req.url has a trailing slash added - no idea why, but remove it as its messing everything up
  //req.url = req.url.replace(/\/$/, '');
  expressStatic(req, res, next);
});

// Final catch-all route to serve the host directory (assumes host already authenticated previously)
router.use(express.static('/host'));

router.use('*', (req, res, next) => {
	console.log('routes.auth:: last call for file:', req.baseUrl, __dirname);
	res.sendFile(req.baseUrl, { root: __dirname });
	// res.sendFile( __dirname + req.originalUrl);
});

  
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

const generateNewRoomName = () => {
	return 'GOLF';
}


module.exports = router;
