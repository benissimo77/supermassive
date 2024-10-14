console.log('######  app.js is running  ######');

// express server
const express = require('express');

// cookie/sessions
const session = require("express-session");

// generating a unique sessionID
const { v4: uuidv4 } = require('uuid');

// nodemailer
// const nodemailer = require('nodemailer');

// passport
const passport = require('passport');
require('./passport');

// init server
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Set up DB connection
// Note: this is a sample - no need to include it unless its actually needed...
const { dbConnect } = require('./db');
dbConnect().then((db) => {
  // You can use the `db` object here if needed
  console.log('MongoDB connection working' );  // Note: don't console.log db it is a huge object
}).catch((error) => {
  console.error('Failed to connect to MongoDB', error);
});

// Serve static files from the react-client build directory
app.use(express.static(__dirname + '/public', { redirect: false }));


// init session cookies - this for the cookie-session middleware
// const sessionMiddleware = session({
//     name: 'session',
//     keys: ['videoswipe online multiplayer game'],
//     httpOnly: true,
// });
// Similar as above but for express-session not cookie-session
const sessionMiddleware = session({
    secret: ['videwoswipe online multiplayer game'],
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // Equals 1 day (1 day * 24 hr/1 day * 60 min/1 hr * 60 sec/1 min * 1000 ms / 1 sec)
    }
})
app.use(sessionMiddleware);

// Generate a unique sessionid for each user (perform on every request)
// app.use( (req, res, next) => {
//   if (req.session.sessionid) {
//           // already have a sessionID
//   } else {
//           const sessionid = uuidv4();
//           req.session.sessionid = sessionid;
//           console.log('Setting sessionid:', req.session);
//   }
//   next()
// });

// Tested enough - this works...
// app.use((req, res, next) => {
//   console.log('Session:', req.session);
//   req.session.nowInMinutes = Math.floor(Date.now() / 60e3)
//   next();
// })

// Parse form data correctly
app.use(express.urlencoded({ extended: true }));

// passport session
// app.use(passport.initialize());
// app.use(passport.session());

app.use((req, res, next) => {
  console.log('req.session:', req.session);
  console.log('req.user:', 
    req.user);
  next();
});


// ROUTES
const indexRoutes = require('./routes.public');
const hostRoutes = require('./routes.auth');
app.use('/', indexRoutes);
app.use('/host', hostRoutes);

// Imports all of the routes from ./routes/index.js
// var routes = require('./routes');
// app.use(routes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App is running on http://localhost:${PORT}`);
});


// module.exports = { app, sessionMiddleware };