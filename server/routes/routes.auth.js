import express from 'express';
import passport from '../passport.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// Local login
router.post('/login', passport.authenticate('local'), authController.login);

// Google authentication
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', authController.googleCallback);

// Facebook authentication
router.get('/facebook', passport.authenticate('facebook', { scope: ['public_profile', 'email'] }));
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