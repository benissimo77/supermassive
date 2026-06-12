import express from 'express';
import passport from '../passport.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Local login
router.post('/login', (req, res, next) => authController.login(req, res, next));

// Get current user
router.get('/me', (req, res) => authController.me(req, res));

// Update profile
router.post('/profile', (req, res) => authController.updateProfile(req, res));

// Google authentication
router.get('/google', (req, res, next) => {
    if (req.query.redirect) {
        req.session.returnTo = req.query.redirect;
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});
router.get('/google/callback', (req, res, next) => authController.googleCallback(req, res, next));

// Facebook authentication
router.get('/facebook', (req, res, next) => {
    if (req.query.redirect) {
        req.session.returnTo = req.query.redirect;
    }
    passport.authenticate('facebook', { scope: ['public_profile', 'email'] })(req, res, next);
});
router.get('/facebook/callback', (req, res, next) => authController.facebookCallback(req, res, next));

// Sign up
router.post('/signup', (req, res) => authController.signUp(req, res));

// Email verification
router.get('/verify', (req, res) => authController.verifyEmail(req, res));
router.post('/resend-verification', (req, res) => authController.resendVerification(req, res));

// Forgot password
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));

// Reset password
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

// Logout
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

// Claim transient guest results
router.post('/claim-results', (req, res) => authController.claimResults(req, res));

export default router;