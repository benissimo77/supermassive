// server.js
const express = require('express');

// cookie/sessions
const session = require("cookie-session");

// init server
const app = express();

// Serve static files from the react-client build directory
app.use(express.static(__dirname + '/public'));

// init session cookies
sessionMiddleware = session({
    name: 'session',
    keys: ['secret keys here...'],
    secret: 'qswdefrgapoj',
    httpOnly: true,
    resave: true,
    saveUninitialized: true
});
app.use(sessionMiddleware);

app.use((req, res, next) => {
  // console.log('Session:', req.session);
  // req.session.nowInMinutes = Math.floor(Date.now() / 60e3)
  next();
})

// Parse form data correctly
app.use(express.urlencoded({ extended: true }));

// ROUTES
indexRoutes = require('./routes');
app.use('/', indexRoutes);

module.exports = { app, sessionMiddleware };