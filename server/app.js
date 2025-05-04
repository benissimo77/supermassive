import express from 'express';
import session from 'express-session';
import { create } from 'express-handlebars';
import passport from './passport.js';
import { dbConnect } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ROUTES
import indexRoutes from './routes/routes.public.js';
import hostRoutes from './routes/routes.host.js';
import loginRoutes from './routes/routes.auth.js';
import apiQuiz from './api/api.quiz.js';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('######  app.js is running  ######');

// Initialize the Express app
const app = express();

// Set up DB connection
dbConnect()
  .then((db) => {
    console.log('MongoDB connection working'); // Note: don't console.log db; it is a huge object
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
  });

// Set up Express Handlebars as the templating engine
// const exphbs = create();
// app.engine('handlebars', exphbs.engine);
// app.set('view engine', 'handlebars');
// app.set('views', path.join(__dirname, 'views')); // Directory for Handlebars templates

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine if the app is running in production
const isProduction = process.env.NODE_ENV === 'production';

// Initialize session cookies
const sessionMiddleware = session({
  secret: 'your_session_secret a very long string of random characters ##%$%^',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: isProduction, maxAge: 120000 },
});
app.use(sessionMiddleware);

// Passport initialization (note: should be placed after session middleware)
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from the public directory
app.use(express.static('public'));

// ROUTES
app.use('/', indexRoutes);
app.use('/auth', loginRoutes);
app.use('/host', hostRoutes);

// API ROUTES
app.use('/api/quiz', apiQuiz);

export { app, sessionMiddleware };