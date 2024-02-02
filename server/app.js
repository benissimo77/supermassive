// server.js
const express = require('express');

// cookie/sessions
const session = require("express-session");

// init server
const app = express();

// init session cookies
app.use(session({
    secret: "amar",
    saveUninitialized: true,
    resave: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
  // console.log('Session:', req.session);
  next();
})

// Parse form data correctly
app.use(express.urlencoded({ extended: true }));

// ROUTES
// const indexRoutes = require('./routes');
// app.use(indexRoutes);
// Define a route for the home page
app.get('/', (req, res) => {
  console.log('User requesting /');
  res.sendFile('play.html', { root: './public'});
})

// Route for when user submits PLAY form
// app.post('/', (req, res) => {
//   console.log('A user has POSTed:', req.body);
//   // Validate req.body.room and req.body.playername
//   // Note - might not need to validate here since will validate after the redirect
//   // Just basic 'do they exist' on fields
//   const redirect = `play/${req.body.room}/${req.body.playername}`;
//   console.log('Validated - redirecting to:', redirect);
//   res.redirect(redirect);
// })

// // And a route for the expected shape of the URL when a player wants to play a game (ROOM/NAME)
// // Passed her via successful redirect from above POST request, also useful if the user refreshes the page in their browser
// app.get('/play/:room/:playerName', (req, res) => {
//   console.log('Redirect/refresh:', req.params);
//   // perform validation on room / playerName here...
//   res.sendFile('play.html',  { root: './public'});
// })

// app.get('/host', (req,res) => {
//   // Authorise user here
//   res.sendFile('host.html',  { root: './public'})
// })

module.exports = app;