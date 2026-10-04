import express from 'express';
import { mongoose } from '../db.js';
import User from '../models/mongo.user.js';
import League from '../models/mongo.league.js';
import LeagueInvite from '../models/mongo.leagueInvite.js';

const router = express.Router();

// joinLeague
// User has clicked a league invite from an email and they have arrived here
// Whatever happens we know that this user's email is now verified since they clicked the email link
// So we will always redirect to the dashboard leagues page
// The only question is what state we are in when we redirect there:
// - if they are already logged in we can just add the league to their account and show them their league
// - if they are not logged in we will store the user without a password but with email verified true
// league page queries the user object on load - this will be the basis for a suitable message
router.get('/join', async (req, res) => {

	console.log('routes.league: join league route hit with query', req.query);

	try {

		const token = req.query.token;
		if (!token) return res.status(400).json({ error: 'Token required' });

		const invite = await LeagueInvite.findOne({ token });
		if (!invite) return res.status(404).json({ error: 'Invite not found' });
		if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Invite expired' });

		const league = await League.findById(invite.leagueID);
		if (!league) return res.status(404).json({ error: 'League not found' });

		if (!req.isAuthenticated()) {

			console.log('routes.league: user not authenticated, processing invite for email', invite.targetEmail);

			// Not authenticated but we have a verified email - find or create user by email
			let user = await User.findOne({ email: invite.targetEmail });

			if (!user) {
				user = new User({
					email: invite.targetEmail,
					role: 'host'
				});
			}
			user.emailVerified = true;
			await user.save();

			// Manually log the user in. This is Passport's way of establishing an authenticated session.
			// It serialize the user into the session so req.isAuthenticated() will be true on subsequent requests.
			await new Promise((resolve, reject) => {
				req.login(user, (err) => {
					if (err) return reject(err);
					resolve();
				});
			});
		}

		if (req.user) {
			console.log('routes.league:: we have a user:', req.user.email, 'joining league', league.name);

			if (!league.members.map(m => String(m)).includes(String(req.user._id))) {
				league.members.push(req.user._id);
				await league.save();
			}
			invite.status = 'accepted';
			await invite.save();


			// Not sure why we need this - going to see if we can delete it...
			req.session.joinedLeague = { id: String(league._id), name: league.name };
		}

		console.log('routes.league: redirecting to dashboard leagues with joined league in session', req.session.joinedLeague);
		return res.redirect('/host/dashboard/leagues?joinedLeague=' + encodeURIComponent(league.name));

		// Not authenticated: save token and optional prefill email in session then redirect to login/signup
		// req.session.pendingLeagueInvite = token;
		// if (invite.targetEmail) req.session.prefillEmail = invite.targetEmail;
		// req.session.returnTo = '/host/dashboard';
		// const prefillQuery = invite.targetEmail ? `?prefillEmail=${encodeURIComponent(invite.targetEmail)}` : '';
		// return res.redirect('/login' + prefillQuery);

	} catch (err) {
		console.error('routes.league: join league error', err);
		return res.status(500).json({ error: 'Invite processing error' });
	}


});


export default router;
