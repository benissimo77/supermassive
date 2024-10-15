console.log('######  app.js is running  ######');

// express server
const express = require('express');

// cookie/sessions
const session = require("cookie-session");

// generating a unique sessionID
const { v4: uuidv4 } = require('uuid');

// nodemailer
const nodemailer = require('nodemailer');

// init server
const app = express();

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


// init session cookies
sessionMiddleware = session({
    name: 'session',
    keys: ['videoswipe online multiplayer game'],
    httpOnly: true,
});
app.use(sessionMiddleware);

// Generate a unique sessionid for each user (perform on every request)
app.use( (req, res, next) => {
  if (req.session.sessionid) {
          // already have a sessionID
  } else {
          const sessionid = uuidv4();
          req.session.sessionid = sessionid;
          console.log('Setting sessionid:', req.session);
  }
  next()
});

// Tested enough - this works...
// app.use((req, res, next) => {
//   console.log('Session:', req.session);
//   req.session.nowInMinutes = Math.floor(Date.now() / 60e3)
//   next();
// })

// Parse form data correctly
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROUTES
indexRoutes = require('./routes.public');
app.use('/', indexRoutes);
hostRoutes = require('./routes.auth');
app.use('/host', hostRoutes);

module.exports = { app, sessionMiddleware };