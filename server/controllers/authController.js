import authService from '../services/authService.js';
import userService from '../services/userService.js';
import passport from '../passport.js';
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
        const guestSessionID = req.sessionID;
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
                    // Automatically claim any guest results from the current session
                    await userService.claimGuestResults(guestSessionID, user._id);

                    // Check for redirect in session
                    const redirectUrl = req.session.returnTo || '/host/dashboard';
                    delete req.session.returnTo;

                    // Redirect to a success page or dashboard
                    return res.redirect(redirectUrl);
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

    async login(req, res, next) {
        const guestSessionID = req.sessionID;
        console.log('authController: login attempt. Guest Session ID:', guestSessionID);

        passport.authenticate('local', async (err, user, info) => {
            if (err) {
                console.error('Login error:', err);
                return res.status(500).json(error('Internal server error'));
            }
            if (!user) {
                console.log('Login failed:', info?.message);
                return res.status(401).json(error(info?.message || 'Authentication failed'));
            }

            req.login(user, async (loginErr) => {
                if (loginErr) {
                    console.error('Login error:', loginErr);
                    return res.status(500).json(error('Login failed'));
                }

                extendUserSession(req);
                console.log('User logged in:', user.email || user.id, 'New Session ID:', req.sessionID);

                // Automatically claim any guest results from the CAPTURED guestSessionID
                try {
                    await userService.claimGuestResults(guestSessionID, user._id);
                } catch (claimErr) {
                    console.error('Error claiming results during login:', claimErr);
                }

                // Explicitly save the session
                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('Session save error:', saveErr);
                        return res.status(500).json(error('Session error'));
                    }

                    let role = user.role;
                    if (!role || role === 'user') {
                        role = user.emailVerified ? 'host' : 'guest';
                    }

                    // Sync activeRoom to session
                    req.session.room = user.activeRoom;
                    req.session.role = role;

                    res.status(200).json(success('Logged in successfully', {
                        user: {
                            id: user._id,
                            email: user.email,
                            displayname: user.displayname,
                            avatar: user.avatar,
                            role: role
                        }
                    }));
                });
            });
        })(req, res, next);
    }

    async me(req, res) {
        if (req.isAuthenticated() && req.user) {
            // Use the role directly from the DB. 
            // Fallback to 'guest' if it's the legacy 'user' role or missing.
            let role = req.user.role;
            if (!role || role === 'user') {
                role = req.user.emailVerified ? 'host' : 'guest';
            }

            res.status(200).json(success('User found', {
                user: {
                    id: req.user._id,
                    email: req.user.email,
                    displayname: req.user.displayname,
                    avatar: req.user.avatar,
                    role: role
                }
            }));
        } else {
            res.status(401).json(error('Not authenticated'));
        }
    }

    async signUp(req, res) {
        try {
            console.log('authController /signup :', req.body);
            const guestSessionID = req.sessionID;
            const { email, password } = req.body;
            const result = await authService.initiateNewUserSignUp(email, password);
            if (result.success) {
                req.login(result.user, async (err) => {
                    if (err) {
                        res.status(401).json(error());
                    } else {
                        // Automatically claim any guest results from the current session
                        try {
                            await userService.claimGuestResults(guestSessionID, result.user._id);
                        } catch (claimErr) {
                            console.error('Error claiming results during signup:', claimErr);
                        }
                        // If there is a pending league invite in session, try to join
                        try {
                            const pendingToken = req.session.pendingLeagueInvite;
                            if (pendingToken) {
                                const LeagueInvite = (await import('../models/mongo.leagueInvite.js')).default;
                                const League = (await import('../models/mongo.league.js')).default;
                                const invite = await LeagueInvite.findOne({ token: pendingToken });
                                if (invite && invite.status === 'pending' && invite.expiresAt > new Date()) {
                                    const league = await League.findById(invite.leagueID);
                                    if (league && !league.members.map(m => String(m)).includes(String(result.user._id))) {
                                        league.members.push(result.user._id);
                                        await league.save();
                                    }
                                    invite.status = 'accepted';
                                    await invite.save();
                                    // store message for dashboard redirect
                                    req.session.joinedLeague = { id: String(league._id), name: league.name };
                                }
                                // cleanup
                                delete req.session.pendingLeagueInvite;
                                delete req.session.prefillEmail;
                            }
                        } catch (joinErr) {
                            console.error('Error auto-joining league after signup:', joinErr);
                        }

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

    async resendVerification(req, res) {
        try {
            if (!req.isAuthenticated() || !req.user) {
                return res.status(401).json(error('Not authenticated'));
            }
            const result = await authService.sendVerificationEmail(req.user);
            if (result.success) {
                res.status(200).json(success('Verification email sent'));
            } else {
                res.status(400).json(error(result.message || 'Failed to resend verification email'));
            }
        } catch (err) {
            console.error('authController: resendVerification catch:', err);
            res.status(500).json(error('Internal server error'));
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

    logout(req, res, next) {
        req.logout((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json(error('Logout failed', 500));
            }
            res.json(success('Logged out successfully'));
        });
    }

    async claimResults(req, res) {
        try {
            if (!req.isAuthenticated() || !req.user) {
                return res.status(401).json(error('Unauthorized'));
            }

            const sessionID = req.sessionID || req.session.id;
            const userID = req.user._id;

            console.log(`authController: claimResults for session ${sessionID}, user ${userID}`);
            const result = await userService.claimGuestResults(sessionID, userID);
            
            res.status(200).json(success('Results claimed successfully', result));
        } catch (err) {
            console.error('authController: claimResults catch:', err);
            res.status(500).json(error('Failed to claim results'));
        }
    }


}

export default new AuthController();