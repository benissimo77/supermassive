import dotenv from 'dotenv';
dotenv.config();

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

// This is required when running behind a reverse proxy such as nginx (and that took my six hours to figure out)
if (isProduction) {
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled for production');
}

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

// Serve shared utilities
app.use('/utils', express.static('src/utils'));


// Direct cookie setting (works)
app.get('/test-direct-cookie', (req, res) => {
  console.log('Setting direct cookie...');
  res.cookie('direct-test', 'direct-value', {
    secure: true,
    httpOnly: false,
    maxAge: 3600000
  });
  res.send('Direct cookie set, check your Application tab');
});

// Session cookie setting (doesn't work)
app.get('/test-session-cookie', (req, res) => {
  console.log('Setting session cookie...');
  // Set some value in session
  req.session.testValue = 'session-value-' + Date.now();
  
  // Force session save
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.send('Session save failed: ' + err.message);
    }
    console.log('Session saved, headers:', res.getHeaderNames());
    res.send('Session cookie should be set, check your Application tab');
  });
});
// Add this diagnostic route
app.get('/session-internals', (req, res) => {
  // Check key express-session variables
  const session = req.session;
  
  const diagnostics = {
    sessionID: req.sessionID,
    sessionExists: !!session,
    isNew: session?.isNew,
    isSaved: !session?.isNew,
    isModified: session?._isModified,
    isPopulated: !!Object.keys(session || {}).length,
    cookieOptions: session?.cookie,
    saveMethod: !!session?.save,
    resHasCookieMethod: !!res.cookie,
    setHeaderMethod: !!res.setHeader
  };
  
  console.log('Session internals:', diagnostics);
  
  res.json(diagnostics);
});
// Add this test route
app.get('/test-session-save', (req, res) => {
  // Set a session value
  req.session.testTimestamp = Date.now();
  
  console.log('Before save:');
  console.log('- Session ID:', req.sessionID);
  console.log('- Session is new:', req.session.isNew);
  console.log('- Session cookie:', req.session.cookie);
  
  // Save with detailed tracking
  req.session.save((err) => {
    if (err) {
      console.error('Save error:', err);
      return res.status(500).send('Save failed: ' + err.message);
    }
    
    console.log('After save:');
    console.log('- Session ID:', req.sessionID);
    console.log('- Session is new:', req.session.isNew);
    console.log('- Cookie in header:', res.getHeader('set-cookie'));
    
    // Try forcing a cookie directly after session save
    res.cookie('post-session-test', 'value', {
      secure: true,
      httpOnly: false,
      maxAge: 3600000
    });
    
    console.log('After extra cookie:');
    console.log('- Cookies in header:', res.getHeader('set-cookie'));
    
    res.send(`
      <html>
        <head><title>Session Save Test</title></head>
        <body>
          <h1>Session Save Test</h1>
          <p>Session ID: ${req.sessionID}</p>
          <p>Timestamp: ${req.session.testTimestamp}</p>
          <p>Check console logs and Application tab</p>
        </body>
      </html>
    `);
  });
});
app.get('/test-auth-process', (req, res) => {
  // Simulate a user object
  const user = { id: '12345', email: 'test@example.com' };
  
  // This is basically what passport.logIn does
  req.login(user, (err) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).send('Login failed: ' + err.message);
    }
    
    console.log('After login:');
    console.log('- User:', req.user);
    console.log('- Session:', req.session);
    console.log('- Authenticated:', req.isAuthenticated());
    
    // Explicitly save the session
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Session save failed: ' + err.message);
      }
      
      console.log('After session save:');
      console.log('- Cookie header:', res.getHeader('set-cookie'));
      
      res.send(`
        <html>
          <head><title>Auth Test</title></head>
          <body>
            <h1>Auth Test</h1>
            <p>User: ${JSON.stringify(req.user)}</p>
            <p>Authenticated: ${req.isAuthenticated()}</p>
            <p>Check console logs and Application tab</p>
          </body>
        </html>
      `);
    });
  });
});
app.get('/compare-headers', (req, res) => {
  // First, set a direct cookie
  res.cookie('direct-cookie', 'value', {
    secure: true,
    httpOnly: false,
    maxAge: 3600000
  });
  
  // Then set a session value and save
  req.session.compareTest = Date.now();
  req.session.save((err) => {
    if (err) console.error('Session save error:', err);
    
    // Get all response headers
    const headers = res.getHeaders();
    
    res.send(`
      <html>
        <head><title>Header Comparison</title></head>
        <body>
          <h1>Response Headers</h1>
          <pre>${JSON.stringify(headers, null, 2)}</pre>
          
          <h2>Set-Cookie Header</h2>
          <pre>${JSON.stringify(res.getHeader('set-cookie'), null, 2)}</pre>
        </body>
      </html>
    `);
  });
});


// ROUTES
app.use('/', indexRoutes);
app.use('/auth', loginRoutes);
app.use('/host', hostRoutes);

// API ROUTES
app.use('/api/quiz', apiQuiz);
app.use('/api/image', apiImage);

export { app, sessionMiddleware };