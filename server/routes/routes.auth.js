const express = require('express');
const authService = require('../services/authService');
const userService = require('../services/userService');
const { success, error } = require('../utils/responseHandler');
const passport = require('passport');
const router = express.Router();

// OK - this route is working well and look how simple it it!
// No clever abstractions, just a simple route that uses passport and checks the req.user object
// Why did this take a whole weekend to get right???
// When I get time do the same for the other routes in this file...
// the async function below is only called when passport succeeds, if error then passport returns response to user directly
router.post('/login', passport.authenticate('local'), async (req, res, next) => {
  console.log('authRoutes: /login :', req.user);
  // if we have got here we should definitely have a user, but check anyway...
  if (req.user) {
    res.status(200).json(success());
  } else {
    res.status(400).json(error());
  }
});

// Google/Facebook authentication
// These follow similar flows so can share the same functions in the authService
// Note the flow is slightly different to the local strategy, since it is invoked by a get to /auth/google
// So client is expecting a redirect to a correct new page, not a json response
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }) );
router.get('/google/callback', handleOAuthCallback('google'));

// Facebook authentication
router.get('/facebook', passport.authenticate('facebook', { scope: ['public_profile', 'email'] }) );
router.get('/facebook/callback', handleOAuthCallback('facebook'));

// Helper function for OAuth callbacks
function handleOAuthCallback(strategy) {
  return (req, res, next) => {
    passport.authenticate(strategy, (err, user, info) => {
      if (err) {
        console.error(`${strategy} authentication error:`, err);
        return res.redirect('/login?error=auth_error');
      }
      if (!user) {
        return res.redirect('/login?error=auth_failed');
      }
      
      // Callback declared as async as it calls the async addProfileData function
      req.login(user, async (loginErr) => {
        if (loginErr) {
          console.error('Login error:', loginErr);
          return res.redirect('/login?error=login_error');
        }
        
        try {
          // Add profile data if needed
          await userService.addProfileData(user);
          
          // Redirect to a success page or dashboard
          return res.redirect('/dashboard');
        } catch (error) {
          console.error('Error processing profile:', error);
          return res.redirect('/login?error=profile_error');
        }
      });
    })(req, res, next);
  };
}

/////////////////////////////////////////////////////////////////////////////////////
// Additional routes related to signing in such as forgot password and reset password

// Sign up new user
// Note: this route creates a new user in the database and logs them in
// meaning they are logged in, but email is not yet verified (bear this in mind when designing the UI)
router.post('/signup', async (req, res, next) => {
  try {
    console.log('authRoutes /signup :', req.body);
    const result = await authService.initiateNewUserSignUp(req.body.email);
    console.log('authRoutes /signup result:', result);
    if (result.success) {
      req.login(result.user, (err) => {
        if (err) {
          res.status(401).json(error());
        } else {
          res.status(201).json(success());
        }
      });
    } else {
      res.status(result.status).json(error());
    }
  } catch (err) {
    console.log('authService: signUpUser catch:', err);
    res.status(500).json(error('Registration failed'));
  }
});

// Called when user clicks link in the user email verification email
// Route checks for a verification token
router.get('/verify', async (req, res) => {
  console.log('router: /verify :', req.query);
  const result = await userService.verifyUserEmail(req.query.token);
  console.log('router: /verify result:', result);
  if (result) {
    req.login(result, (err) => {  
      if (err) {
        res.redirect('/login?error=login_error');
      } else {
        res.redirect('/host/dashboard');
      }
    });
  } else {
    res.redirect('/login?error=verification_failed');
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    console.log('router: /forgot-password :', req.body);
    const result = await authService.initiatePasswordReset(req.body.email);
    console.log('router: /forgot-password result:', result);
    res.status(200).json(success());
  } catch (err) {
    res.status(200).json(success());
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    console.log('router: /reset-password :', req.body);
    const result = await userService.resetPassword(req.body.token, req.body.password);
    console.log('router: /reset-password result:', result);
    if (result) {
      res.status(200).json(success());
    } else {
      res.status(400).json(error());
    }
  } catch (err) {
    res.status(500).json(error());
  }
});

router.post('/logout', (req, res) => {
  req.logout();
  res.json(success('Logged out successfully'));
});



module.exports = router;
