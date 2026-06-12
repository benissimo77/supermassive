import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from './passport.js';
import { dbConnect, isDBConnected, mongoose } from './db.js';
import { fileURLToPath } from 'url';

// Wait for DB connection (with 3s timeout defined in db.js)
// This allows us to decide which session store to use.
await dbConnect();

// ROUTES
import indexRoutes from './routes/routes.public.js';
import hostRoutes from './routes/routes.host.js';
import adminRoutes from './routes/routes.admin.js';
import loginRoutes from './routes/routes.auth.js';
import devRoutes from './routes/routes.dev.js';
import leagueRoutes from './routes/routes.league.js';

import apiQuiz from './api/api.quiz.js';
import apiImage from './api/api.image.js';
import apiLeague from './api/api.league.js';
import apiLeaderboard from './api/api.leaderboard.js';
import apiSeasons from './api/api.seasons.js';

console.log('######  app.js is running  ######');

// Check essential environment variables
const requiredEnvVars = ['NODE_ENV','MONGODB_URI', 'SESSION_SECRET'];
const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1); // Exit with error code
}


// Initialize the Express app
const app = express();

// Serve static files from the public directory
// Note: placed before session/passport to avoid overhead for public assets
app.use(express.static('public'));

// Set up Express Handlebars as the templating engine
// const exphbs = create();
// app.engine('handlebars', exphbs.engine);
// app.set('view engine', 'handlebars');
// app.set('views', path.join(__dirname, 'views')); // Directory for Handlebars templates

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine if the app is running in production
const isProduction = process.env.NODE_ENV === 'production';

// This is required when running behind a reverse proxy such as nginx (and that took my six hours to figure out)
if (isProduction) {
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled for production');
}

// Determine session store (Fallback to MemoryStore if MongoDB is offline)
let sessionStore;
if (isDBConnected()) {
  // Use the established connection client
  const client = mongoose.connection.getClient ? mongoose.connection.getClient() : mongoose.connection.client;

  sessionStore = MongoStore.create({
    client: client,
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60,
    touchAfter: 24 * 60 * 60,
    autoRemove: 'native'
  });
  console.log('Session store: Using MongoStore');
} else {
  console.log('Session store: Using MemoryStore (Local Development Fallback)');
  sessionStore = new session.MemoryStore();
}

// Initialize session cookies
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  },
  store: sessionStore
});
app.use(sessionMiddleware);

// Passport initialization (note: should be placed after session middleware)
app.use(passport.initialize());
app.use(passport.session());


// ROUTES
app.use('/', indexRoutes);
app.use('/auth', loginRoutes);
app.use('/host', hostRoutes);
app.use('/admin', adminRoutes);
app.use('/league', leagueRoutes);
// Dev routes: mount only in non-production (and can be disabled via ENABLE_DEV_ROUTES=false)
if (!isProduction && process.env.ENABLE_DEV_ROUTES !== 'false') {
  app.use('/dev', devRoutes);
  console.log('Dev routes enabled at /dev');
}


// API ROUTES
app.use('/api/quiz', apiQuiz);
app.use('/api/image', apiImage);
app.use('/api/league', apiLeague);
app.use('/api/leaderboard', apiLeaderboard);
app.use('/api/seasons', apiSeasons);

export { app, sessionMiddleware };