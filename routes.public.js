// ROUTES
const express = require('express');
const router = express.Router();

const User = require('./server/models/mongo.user');

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

// This taken from Zach Goll https://github.com/zachgoll/express-session-authentication-starter/blob/final/routes/index.js
// router.post('/login', passport.authenticate('local', { failureRedirect: '/login-failure', successRedirect: '/login-success' }));
// router.post('/login', passport.authenticate('local', { failureRedirect: '/login-failure', successRedirect: 'login-success' }));

// Login route
router.post('/loginXXX', (req, res, next) => {
    console.log('Login route hit');
    passport.authenticate('custom-local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.status(200).json({ message: 'Login successful' });
        });
    })(req, res, next);
});


router.get('/login-success', (req, res, next) => {
    res.send('<p>You successfully logged in. --> <a href="/protected-route">Go to protected route</a></p>');
});

router.get('/login-failure', (req, res, next) => {
    res.send('You entered the wrong password.');
});

// This taken from https://www.golinuxcloud.com/nodejs-passportjs-authenticate/
router.all('/register', async (req, res) => {
	console.log('Registering user:', req.body)

		const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create a new user
        const newUser = new User({
            username,
            email
		})
		newUser.password = newUser.generateHash(password);

        // Save the user to the database
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully:', newUser });    
})


// For development - admin console
router.get('/admin', (req, res) => {
	// Authorise user here
	res.sendFile('index.html', { root: './public/admin' })
})


module.exports = router;
