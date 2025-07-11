// ROUTES
// This file sets up the routes for /host - hosting a game OR general host page showing general host info
// Must be logged in to view these routes
import express from 'express';
const router = express.Router({ strict: true });

const isAuth = (req, res, next) => {
	// console.log('isAuth:', req.user, req.session, req.isAuthenticated());
	if (req.isAuthenticated()) {
		console.log('isAuth:: User is authenticated:', req.user);
		next();
	} else {
		// res.status(401).json({ msg: 'You are not authorized to view this resource' });
		res.redirect('/login');
	}
}

const isAdmin = (req, res, next) => {
	if (req.isAuthenticated() && req.user.admin) {
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
	// console.log('checkRoom:', req.baseUrl, req.originalUrl, req.url, req.path, req.params, req.query);

	// In development we want to be able to override the room name by adding directly to query
	// console.log(process.env.NODE_ENV, req.query);
	if (process.env.NODE_ENV === 'development') {
		if (req.query.room) {
			req.session.room = req.query.room;
		}
	}

	if (req.session && req.session.room) {
		next();
	} else {
		req.session.room = generateNewRoomName();
		next();
	}
}

router.use([isAuth, checkHost, checkRoom]);


// Before serving static files from the host directory, override some of the files to permit handlebars templating


// Problem with all lines below - WHY DID I DO THIS USING HANDLEBARS???
// One quick decision to allow handlebars to create a dynamic page and suddenly everything is a handlebars template
// NO NEED FOR THIS!!!
// Note that this route has a trailing slash - seems that either browser or server is adding slash at the end
// router.get('/dashboard/', (req, res) => {
// 	console.log('routes.host.js: /dashboard');
//     res.render('home', { layout: 'dashboard' }); // Use a different layout
// });
// // Repeat above but without the slash... (?)
// router.get('/dashboard', (req, res) => {
// 	console.log('routes.host.js: /dashboard');
//     res.render('home', { layout: 'dashboard' }); // Use a different layout
// });
// router.get('/dashboard/home', (req, res) => {
// 	console.log('routes.host.js: /dashboard/home');
//     res.render('home', { layout: 'dashboard' }); // Use a different layout
// });
// router.get('/dashboard/quiz', (req, res) => {
// 	console.log('routes.host.js: /dashboard/quiz');
//     res.render('quiz', { layout: false }); // Use a different layout
// });
// router.get('/dashboard/sample', (req, res) => {
// 	console.log('routes.host.js: /dashboard/sample');
//     res.render('sample', { layout: 'dashboard' }); // Use a different layout
// });

// The problem with the code below is that every request for a page in /dashboard gets rendered as a tempalte
// But currently all the styles and javascript code is also accessed from /dashbaord (the static folder)
// So these get treated as if they were templates...
// // Nice idea but not right now
// router.get('/dashboard/:page', (req, res) => {
//     const page = req.params.page; // Get the page parameter from the URL
//     console.log(`routes.host.js: /dashboard/${page}`);

//     // Define a list of valid pages to prevent rendering invalid templates
//     const validPages = ['quiz', 'sample', 'home']; // Add other valid page names here

//     if (validPages.includes(page)) {
//         // Render the corresponding template
//         res.render(page, { layout: false }); // Use layout conditionally
//     } else {
//         // Handle invalid page requests
// 		console.log('Not a page');
//     }
// });

// INSTEAD - just serve the static files from the host directory
router.get('/', (req, res) => {
	console.log('routes.host.js: /');
	res.redirect('/host/dashboard');
});
// // Repeat above but without the slash... (?)
// router.get('/dashboard', (req, res) => {
// 	console.log('routes.host.js: /dashboard');
//     res.render('home', { layout: 'dashboard' }); // Use a different layout
// });


// This works when it is described below - it does NOT seem to work when placed into a (req,res,next) type function
// NOTE: this is placed after the checks above so it serves /host files only to authenticated hosts with a room
// router.use( express.static(__dirname + '/host', { redirect: false }) );
router.use(express.static('host'));



// For development - admin console (shouldn't be placed in the public folder...)
router.get('/admin', (req, res) => {
	// Authorise user here
	res.sendFile('index.html', { root: './public/admin' })
})


const generateNewRoomName = () => {
	return 'NUTS5';
}

export default router;
