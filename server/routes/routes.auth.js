import express from 'express';
import passport from '../passport.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Local login
router.post('/login', passport.authenticate('local'), authController.login);

// Get current user
router.get('/me', authController.me);

// Google authentication
router.get('/google', (req, res, next) => {
    if (req.query.redirect) {
        req.session.returnTo = req.query.redirect;
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});
router.get('/google/callback', authController.googleCallback);

// Facebook authentication
router.get('/facebook', (req, res, next) => {
    if (req.query.redirect) {
        req.session.returnTo = req.query.redirect;
    }
    passport.authenticate('facebook', { scope: ['public_profile', 'email'] })(req, res, next);
});
router.get('/facebook/callback', authController.facebookCallback);

// Sign up
router.post('/signup', authController.signUp);

// Email verification
router.get('/verify', authController.verifyEmail);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.post('/reset-password', authController.resetPassword);

// Logout
router.post('/logout', authController.logout);

export default router;