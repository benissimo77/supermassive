"use strict";

console.log('######  app.js is running  ######');

// express server
const express = require('express');
const session = require("express-session");
const exphbs = require('express-handlebars').create();
const passport = require('./passport');
const { dbConnect } = require('./db');
const path = require('path');

// const nodemailer = require('nodemailer');

// init server
const app = express();

// Set up DB connection
// Note: this is a sample - no need to include it unless its actually needed...
dbConnect().then((db) => {
  // You can use the `db` object here if needed
  console.log('MongoDB connection working');  // Note: don't console.log db it is a huge object
}).catch((error) => {
  console.error('Failed to connect to MongoDB', error);
});

// Set up Express Handlebars as the templating engine
// app.engine('handlebars', exphbs.engine);
// app.set('view engine', 'handlebars');
// app.set('views', path.join(__dirname, 'views')); // Directory for Handlebars templates


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine if the app is running in production
const isProduction = process.env.NODE_ENV === 'production';

// init session cookies
const sessionMiddleware = session({
  secret: 'your_session_secret a very long string of random characters ##%$%^',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: isProduction, maxAge: 120000 }
});
app.use(sessionMiddleware);

// Tested enough - this works...
// app.use((req, res, next) => {
//   console.log('Session:', req.session);
//   req.session.nowInMinutes = Math.floor(Date.now() / 60e3)
//   next();
// })

// Passport initialization (note: should be placed after session middleware)
app.use(passport.initialize());
app.use(passport.session());

// After routers have taken their turn, serve static files from the react-client build directory
// app.use(express.static(__dirname + '/public', { redirect: false }));
app.use(express.static('public'));


// ROUTES
const indexRoutes = require('./routes/routes.public');
const hostRoutes = require('./routes/routes.host');
const loginRoutes = require('./routes/routes.auth');

app.use('/', indexRoutes);
app.use('/auth', loginRoutes);
app.use('/host', hostRoutes);


// API ROUTES - not sure if this is needed right now...
const apiQuiz = require('./api/api.quiz');
const { strict } = require('assert');
app.use('/api/quiz', apiQuiz);



module.exports = { app, sessionMiddleware };
