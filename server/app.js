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

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);

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

// Add after your session middleware, before your routes
app.use((req, res, next) => {
  // Only log for authentication-related paths
  if (req.path.includes('/auth/') || req.path.includes('/host/')) {
    console.log(`[Cookie Debug] ${req.method} ${req.path}`);
    console.log(`- Has cookies: ${!!req.headers.cookie}`);
    console.log(`- Session ID: ${req.sessionID || 'none'}`);
  }
  next();
});
// Add after your session middleware
app.use((req, res, next) => {
  if (req.path.includes('/auth/login')) {
    // Store the original end method
    const originalEnd = res.end;
    
    // Override end method
    res.end = function(chunk, encoding) {
      // Log headers before response is sent
      console.log('\n=== RESPONSE HEADERS ===');
      console.log('URL:', req.method, req.originalUrl);
      console.log('Set-Cookie header:', res.getHeader('Set-Cookie'));
      console.log('=======================\n');
      
      // Call the original end method
      return originalEnd.call(this, chunk, encoding);
    };
  }
  next();
});
// Add to app.js
app.get('/test-cookie', (req, res) => {
  // Set multiple test cookies with different settings
  
  // Test cookie 1: Standard secure cookie
  res.cookie('test1', 'value1', {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    secure: true,
    httpOnly: false,
    sameSite: 'none',
    maxAge: 3600000
  });
  
  // Test cookie 2: Non-secure cookie (shouldn't work on HTTPS)
  res.cookie('test2', 'value2', {
    secure: false,
    httpOnly: false,
    maxAge: 3600000
  });
  
  // Test cookie 3: Different SameSite setting
  res.cookie('test3', 'value3', {
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 3600000
  });
  
  // Return the response headers for debugging
  const headers = res.getHeaders();
  
  res.send(`
    <html>
      <head>
        <title>Cookie Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .success { color: green; }
          .failure { color: red; }
        </style>
      </head>
      <body>
        <h1>Cookie Test</h1>
        
        <h2>Response Headers:</h2>
        <pre>${JSON.stringify(headers, null, 2)}</pre>
        
        <h2>Cookies Set:</h2>
        <div id="cookies">Checking...</div>
        
        <script>
          // Display all cookies
          function showCookies() {
            const cookieDiv = document.getElementById('cookies');
            const cookies = document.cookie;
            
            if (cookies) {
              cookieDiv.innerHTML = '<p class="success">Cookies found:</p><ul>';
              cookies.split(';').forEach(cookie => {
                cookieDiv.innerHTML += '<li>' + cookie.trim() + '</li>';
              });
              cookieDiv.innerHTML += '</ul>';
            } else {
              cookieDiv.innerHTML = '<p class="failure">No cookies found!</p>';
            }
          }
          
          // Run on page load
          showCookies();
          
          // Check again after a short delay
          setTimeout(showCookies, 500);
        </script>
      </body>
    </html>
  `);
});

// ROUTES
app.use('/', indexRoutes);
app.use('/auth', loginRoutes);
app.use('/host', hostRoutes);

// API ROUTES
app.use('/api/quiz', apiQuiz);
app.use('/api/image', apiImage);

export { app, sessionMiddleware };