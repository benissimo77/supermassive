import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from './passport.js';
import { dbConnect } from './db.js';
import { fileURLToPath } from 'url';

// ROUTES
import indexRoutes from './routes/routes.public.js';
import hostRoutes from './routes/routes.host.js';
import loginRoutes from './routes/routes.auth.js';

import apiQuiz from './api/api.quiz.js';
import apiImage from './api/api.image.js';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);

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

// Initialize session cookies with MongoDB store
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  },
  // Add MongoDB store
  store: MongoStore.create({
    // Use the same MongoDB connection as your app
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60,
    touchAfter: 24 * 60 * 60, // Only update if 24 hours passed
    autoRemove: 'native' // Use MongoDB's TTL index for cleanup
  })
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
app.use('/api/image', apiImage);

export { app, sessionMiddleware };