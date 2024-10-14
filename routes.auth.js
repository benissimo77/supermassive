// ROUTES
// This file sets up the routes for /host - hosting a game OR general host page showing general host info
// Must be logged in to view these routes
const express = require('express');
const router = express.Router({ strict: true });

const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.status(401).json({ msg: 'You are not authorized to view this resource' });
    }
}

const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.admin) {
        next();
    } else {
        res.status(401).json({ msg: 'You are not authorized to view this resource because you are not an admin.' });
    }
}

// Middleware to check if the user is a host
function checkHost(req, res, next) {
	// console.log('checkHost:', req.baseUrl, req.originalUrl, req.url, req.path, req.params, req.query);

	// Zach Goll suggests that there might be a req.isAuthenticated() function that can be used here
	console.log('Checking if user is a host:', req.user);
    // if (req.isAuthenticated()) {
	// 	console.log('Hmmm... surprisingly that worked...');
	// } else {
	// 	console.log('Well the call worked, response:', req.isAuthenticated());
	// }
	if (req.user) {
		req.session.host = true;
		next();
	}
	if (req.session && req.session.host) {
		next();
	} else {
	//   res.redirect('/login');
	  next();
	}
  }

// Middleware to check if the (host) user is in a room - creates a new room if not
function checkRoom(req, res, next) {
// console.log('checkRoom:', req.baseUrl, req.originalUrl, req.url, req.path, req.params, req.query);
	if (req.session && req.session.room) {
		next();
	} else {
		req.session.room = generateNewRoomName();
		next();
	}
}

router.use( [checkHost, checkRoom] );

// This works when it is described below - it does NOT seem to work when placed into a (req,res,next) type function
// NOTE: this is placed after the checks above so it serves /host files only to authenticated hosts with a room
router.use( express.static(__dirname + '/host', { redirect: false }) );


router.get('/login', (req, res) => {
	console.log('Redirecting host attempt to login page')
	// Render the login page
	res.sendFile('login.html', { root: './public' });
  });
  
// router.post('/login', (req, res) => {
// 	// Handle the login form submission
// 	// This is where you would check the user's credentials and set req.session.host
//   });



// For development - admin console (shouldn't be placed in the public folder...)
router.get('/admin', (req, res) => {
	// Authorise user here
	res.sendFile('index.html', { root: './public/admin' })
})


const generateNewRoomName = () => {
	return 'GOLD';
}

module.exports = router;
