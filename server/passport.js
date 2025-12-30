import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import userService from './services/userService.js';
import dotenv from 'dotenv';

dotenv.config();


passport.serializeUser((user, done) => {
  console.log('passport.serializeUser:', user);
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userService.findUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    console.log('passport.use.LocalStrategy:', email, password);
    try {
      const user = await userService.authenticateUser(email, password);
      console.log('passport.use.LocalStrategy:', user);
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,

}, (token, tokenSecret, profile, done) => {
  // Replace this with your own logic to find or create a user
  console.log('passport.use.GoogleStrategy:', profile);
  return done(null, profile);
}));

// Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  console.log('passport.use.FacebookStrategy:', profile);
  return done(null, profile);
}));

export default passport;
