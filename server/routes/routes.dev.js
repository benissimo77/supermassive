import express from 'express';
import { mongoose } from '../db.js';
import User from '../models/mongo.user.js';

const router = express.Router();

// Direct cookie setting (works)
router.get('/test-direct-cookie', (req, res) => {
  console.log('Setting direct cookie...');
  res.cookie('direct-test', 'direct-value', {
    secure: true,
    httpOnly: false,
    maxAge: 3600000
  });
  res.send('Direct cookie set, check your Application tab');
});

// Session cookie setting (diagnostic)
router.get('/test-session-cookie', (req, res) => {
  console.log('Setting session cookie...');
  req.session.testValue = 'session-value-' + Date.now();
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.send('Session save failed: ' + err.message);
    }
    console.log('Session saved, headers:', res.getHeaderNames());
    res.send('Session cookie should be set, check your Application tab');
  });
});

router.get('/session-internals', (req, res) => {
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

router.get('/test-session-save', (req, res) => {
  req.session.testTimestamp = Date.now();
  console.log('Before save:', req.sessionID, req.session?.isNew);
  req.session.save((err) => {
    if (err) {
      console.error('Save error:', err);
      return res.status(500).send('Save failed: ' + err.message);
    }
    res.cookie('post-session-test', 'value', { secure: true, httpOnly: false, maxAge: 3600000 });
    res.send(`
      <html><body>
        <h1>Session Save Test</h1>
        <p>Session ID: ${req.sessionID}</p>
        <p>Timestamp: ${req.session.testTimestamp}</p>
      </body></html>
    `);
  });
});

// Quick auth flow test — creates a mock user and logs in via passport
router.get('/test-auth-process', async (req, res) => {
  try {
    const email = 'ben.silburn@gmail.com';
    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).send('Test user not found: ' + email);

    // Use passport to log in the existing user
    req.login(user, (err) => {
      if (err) return res.status(500).send('Login failed: ' + err.message);
      req.session.save((err) => {
        if (err) return res.status(500).send('Session save failed: ' + err.message);
        res.send(`<html><body><h1>Auth Test</h1><pre>${JSON.stringify({ user: req.user, authenticated: req.isAuthenticated() }, null, 2)}</pre></body></html>`);
      });
    });
  } catch (err) {
    console.error('test-auth-process error:', err);
    res.status(500).send('Error looking up test user');
  }
});

router.get('/compare-headers', (req, res) => {
  res.cookie('direct-cookie', 'value', { secure: true, httpOnly: false, maxAge: 3600000 });
  req.session.compareTest = Date.now();
  req.session.save(() => {
    const headers = res.getHeaders();
    res.send(`
      <html><body>
        <h1>Response Headers</h1>
        <pre>${JSON.stringify(headers, null, 2)}</pre>
        <h2>Set-Cookie Header</h2>
        <pre>${JSON.stringify(res.getHeader('set-cookie'), null, 2)}</pre>
      </body></html>
    `);
  });
});

router.get('/whoami', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user || null,
    sessionID: req.sessionID || null,
    cookiesSet: res.getHeader ? res.getHeader('set-cookie') : null
  });
});

export default router;
