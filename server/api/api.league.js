import express from 'express';
import crypto from 'crypto';
import League from '../models/mongo.league.js';
import LeagueInvite from '../models/mongo.leagueInvite.js';
import EmailService from '../services/emailService.js';

const router = express.Router();

/**
 * Get all leagues for the current user
 */
router.get('/my-leagues', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        const leagues = await League.find({ 
            $or: [
                { ownerID: req.user._id },
                { members: req.user._id }
            ]
        })
        .populate('members', 'displayname avatar email')
        .sort({ updatedAt: -1 });
        
        res.json(leagues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create a new league
 */
router.post('/create', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        const { name, slogan, visuals } = req.body;
        
        const league = await League.create({
            name,
            ownerID: req.user._id,
            members: [req.user._id],
            visuals: visuals || { motto: slogan }
        });

        res.json({ success: true, league });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Join a league via unique ID
 */
router.post('/join/:id', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        const league = await League.findById(req.params.id);
        if (!league) return res.status(404).json({ error: 'League not found' });

        if (!league.members.includes(req.user._id)) {
            league.members.push(req.user._id);
            await league.save();
        }

        res.json({ success: true, league });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create an invite token for a league (owner/admin only)
 * Body: { emails: [optional array of target emails for personalized invites] }
 * If no emails are specified then it will create an 'anonymous' invite which can be shared on social media
 */
router.post('/:id/invite', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const league = await League.findById(req.params.id);
        if (!league) return res.status(404).json({ error: 'League not found' });
        // Allow league owner OR admin users to create invites
        const isOwner = String(league.ownerID) === String(req.user._id);
        if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

        const expiresDays = 7;
        const token = crypto.randomBytes(6).toString('hex');

        // Support creating multiple invites when emails are provided
        const emails = Array.isArray(req.body.emails) ? req.body.emails.map(e => (e || '').trim()).filter(Boolean) : [];
        let invite;
        if (emails.length === 0) {
            invite = await LeagueInvite.create({
                leagueID: league._id,
                inviterID: req.user._id,
                token,
                expiresAt: new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
            });
        } else {
            // Create one invite per email
            const created = [];
            for (const email of emails) {
                const t = crypto.randomBytes(6).toString('hex');
                const inv = await LeagueInvite.create({
                    leagueID: league._id,
                    inviterID: req.user._id,
                    token: t,
                    targetEmail: email,
                    expiresAt: new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
                });
                created.push(inv);

                // Send server-side email using EmailService
                try {
                    const baseUrl = (process.env.APP_URL && process.env.APP_URL.trim()) ? process.env.APP_URL.replace(/\/$/, '') : `${req.protocol}://${req.get('host')}`;
                    const link = `${baseUrl}/league/join?token=${t}`;
                    const html = `<p>You have been invited to join the league <strong>${league.name}</strong> on VideoSwipe.</p>
                    <p>Compete in quizzes, track your scores and see how you stack up against your friends!</p>
                      <p><a href="${link}">Click here to join the league</a></p>`;
                    await EmailService.sendMail({
                        from: 'hello@videoswipe.net',
                        to: email,
                        subject: `${req.user.email} has invited you to join their league: ${league.name}`,
                        html
                    });
                } catch (emailErr) {
                    console.error('Failed to send league invite email to', email, emailErr);
                }
            }
            // return first created invite for compatibility
            invite = created[0];
        }

        const baseUrl = (process.env.APP_URL && process.env.APP_URL.trim()) ? process.env.APP_URL.replace(/\/$/, '') : `${req.protocol}://${req.get('host')}`;
        const link = `${baseUrl}/league/join?token=${token}`;
        res.json({ success: true, invite, link });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Join a league using an invite token
 * Body: { token }
 */
router.post('/join-token', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token required' });

        const invite = await LeagueInvite.findOne({ token });
        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.status !== 'pending') return res.status(400).json({ error: 'Invite not pending' });
        if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Invite expired' });

        const league = await League.findById(invite.leagueID);
        if (!league) return res.status(404).json({ error: 'League not found' });

        if (!league.members.map(m => String(m)).includes(String(req.user._id))) {
            league.members.push(req.user._id);
            await league.save();
        }

        invite.status = 'accepted';
        await invite.save();

        res.json({ success: true, league });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Remove a member (owner only)
 */
router.post('/:id/remove/:playerID', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const league = await League.findById(req.params.id);
        if (!league) return res.status(404).json({ error: 'League not found' });
        if (String(league.ownerID) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });

        const pid = req.params.playerID;
        league.members = league.members.filter(m => String(m) !== String(pid));
        await league.save();

        res.json({ success: true, league });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Landing route for league invites (also accessible via /join-league redirect)
router.get('/join-leagueOriginal', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).json({ error: 'Token required' });

        const invite = await LeagueInvite.findOne({ token });
        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Invite expired' });

        const league = await League.findById(invite.leagueID);
        if (!league) return res.status(404).json({ error: 'League not found' });

        if (req.isAuthenticated() && req.user) {
            if (!league.members.map(m => String(m)).includes(String(req.user._id))) {
                league.members.push(req.user._id);
                await league.save();
            }
            invite.status = 'accepted';
            await invite.save();
            req.session.joinedLeague = { id: String(league._id), name: league.name };
            return res.redirect('/host/dashboard');
        }

        // Not authenticated: save token and optional prefill email in session then redirect to login/signup
        req.session.pendingLeagueInvite = token;
        if (invite.targetEmail) req.session.prefillEmail = invite.targetEmail;
        req.session.returnTo = '/host/dashboard';
        const prefillQuery = invite.targetEmail ? `?prefillEmail=${encodeURIComponent(invite.targetEmail)}` : '';
        return res.redirect('/login' + prefillQuery);
    } catch (err) {
        console.error('api.league: join-league error', err);
        return res.status(500).json({ error: 'Invite processing error' });
    }
});

/**
 * Get a league with outstanding invites
 */
router.get('/:id', async (req, res) => {
    try {
        const league = await League.findById(req.params.id).populate('members', 'displayname avatar email');
        if (!league) return res.status(404).json({ error: 'League not found' });

        const invites = await LeagueInvite.find({ leagueID: league._id, status: 'pending' }).sort({ createdAt: -1 });
        res.json({ league, invites });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
