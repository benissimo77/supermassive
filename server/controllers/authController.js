import authService from '../services/authService.js';
import userService from '../services/userService.js';
import { success, error } from '../utils/responseHandler.js';


// Utility to extend session
const extendUserSession = (req) => {
    if (req.session && req.session.cookie) {
        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 1 week
        console.log('Session extended for user:', req.user?.email || req.user?.id);
    }
}


class AuthController {

    async handleOAuthCallback(strategy, req, res, next) {
        passport.authenticate(strategy, async (err, user) => {
            if (err) {
                console.error(`${strategy} authentication error:`, err);
                return res.redirect('/login?error=auth_error');
            }
            if (!user) {
                return res.redirect('/login?error=auth_failed');
            }

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
    }

    async googleCallback(req, res, next) {
        extendUserSession(req);
        return this.handleOAuthCallback('google', req, res, next);
    }

    async facebookCallback(req, res, next) {
        extendUserSession(req);
        return this.handleOAuthCallback('facebook', req, res, next);
    }

    async login(req, res) {
        console.log('authController: /login :', req.user);
        extendUserSession(req);
        if (req.user) {
            console.log('User logged in:', req.user.email || req.user.id);
            res.status(200).json(success());
        } else {
            console.log('User not logged in');
            res.status(400).json(error());
        }
    }

    async signUp(req, res) {
        try {
            console.log('authController /signup :', req.body);
            const result = await authService.initiateNewUserSignUp(req.body.email);
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
            console.error('authController: signUp catch:', err);
            res.status(500).json(error('Registration failed'));
        }
    }

    async verifyEmail(req, res) {
        try {
            console.log('authController: /verify :', req.query);
            const result = await userService.verifyUserEmail(req.query.token);
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
        } catch (err) {
            console.error('authController: verifyEmail catch:', err);
            res.redirect('/login?error=verification_failed');
        }
    }

    async forgotPassword(req, res) {
        try {
            console.log('authController: /forgot-password :', req.body);
            await authService.initiatePasswordReset(req.body.email);
            res.status(200).json(success());
        } catch (err) {
            console.error('authController: forgotPassword catch:', err);
            res.status(500).json(error());
        }
    }

    async resetPassword(req, res) {
        try {
            console.log('authController: /reset-password :', req.body);
            const result = await userService.resetPassword(req.body.token, req.body.password);
            if (result) {
                res.status(200).json(success());
            } else {
                res.status(400).json(error());
            }
        } catch (err) {
            console.error('authController: resetPassword catch:', err);
            res.status(500).json(error());
        }
    }

    logout(req, res) {
        req.logout();
        res.json(success('Logged out successfully'));
    }


}

export default new AuthController();