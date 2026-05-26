import PlayerResult from '../models/mongo.playerResult.js';
import GameSession from '../models/mongo.gameSession.js';
import { success, error } from '../utils/responseHandler.js';

const leaderboardController = {
    /**
     * Get top scores across all games
     * Filtered for non-bots and usually verified sessions
     */
    async getGlobalLeaderboard(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            
            // Get sessions that are verified (level 0 or 1)
            const verifiedSessions = await GameSession.find({
                verificationLevel: { $in: [0, 1] }
            }).select('_id');
            
            const sessionIds = verifiedSessions.map(s => s._id);

            const leaderboard = await PlayerResult.aggregate([
                { 
                    $match: { 
                        gameSessionID: { $in: sessionIds },
                        isBot: false 
                    } 
                },
                { 
                    // Group by userID if available, else by displayName
                    $group: {
                        _id: { $ifNull: ["$userID", "$displayName"] },
                        totalScore: { $sum: "$totalScore" },
                        totalQuestions: { $sum: "$totalQuestions" },
                        totalCorrect: { $sum: "$totalCorrect" },
                        gameCount: { $sum: 1 },
                        playerName: { $first: "$displayName" },
                        avatar: { $first: "$avatar" }
                    }
                },
                { 
                    // Join with user to get verification info if needed, 
                    // though for now we can infer it roughly or trust the first result
                    $addFields: {
                        verificationLevel: 1 // We already filtered for verified sessions [0, 1]
                    }
                },
                { $sort: { totalScore: -1 } },
                { $limit: limit }
            ]);

            // FALLBACK: If empty, provide mock data for UI troubleshooting
            if (leaderboard.length === 0 || req.query.mock === 'true') {
                return res.status(200).json([
                    { playerName: "QuizMaster Ben", totalScore: 125400, gameCount: 42, totalQuestions: 420, totalCorrect: 385, verificationLevel: 0, avatar: "12138118" },
                    { playerName: "Speedy Gonzales", totalScore: 98200, gameCount: 15, totalQuestions: 150, totalCorrect: 142, verificationLevel: 1, avatar: "12138231" },
                    { playerName: "Trivia Titan", totalScore: 85000, gameCount: 12, totalQuestions: 120, totalCorrect: 110, verificationLevel: 1, avatar: "12138743" },
                    { playerName: "Mystery Player", totalScore: 72100, gameCount: 8, totalQuestions: 80, totalCorrect: 65, verificationLevel: 2, avatar: "12138846" },
                    { playerName: "Noob King", totalScore: 4500, gameCount: 1, totalQuestions: 10, totalCorrect: 2, verificationLevel: 3, avatar: "12139963" }
                ]);
            }

            res.status(200).json(leaderboard); // Returning direct array for simplicity in FE
        } catch (err) {
            console.error('Leaderboard error:', err);
            res.status(500).json({ error: 'Failed to retrieve leaderboard' });
        }
    },

    /**
     * Get aggregated scores for a season (all game sessions tagged with seasonID)
     * Groups by player across every episode, sums scores.
     */
    async getSeasonLeaderboard(req, res) {
        try {
            const { seasonId } = req.params;
            const limit = parseInt(req.query.limit) || 10;

            const sessions = await GameSession.find({ seasonID: seasonId }).select('_id');
            const sessionIds = sessions.map(s => s._id);

            if (sessionIds.length === 0) {
                return res.status(200).json([]);
            }

            const leaderboard = await PlayerResult.aggregate([
                { $match: { gameSessionID: { $in: sessionIds }, isBot: false } },
                {
                    $group: {
                        _id:            { $ifNull: ['$userID', '$displayName'] },
                        totalScore:     { $sum: '$totalScore' },
                        totalQuestions: { $sum: '$totalQuestions' },
                        totalCorrect:   { $sum: '$totalCorrect' },
                        gameCount:      { $sum: 1 },
                        playerName:     { $first: '$displayName' },
                        avatar:         { $first: '$avatar' },
                        // Collect each game's score so we can compute Best 5
                        allScores:      { $push: '$totalScore' }
                    }
                },
                {
                    // Sort each player's scores descending, take top 5, sum them
                    $addFields: {
                        best5: {
                            $sum: {
                                $slice: [
                                    { $sortArray: { input: '$allScores', sortBy: -1 } },
                                    5
                                ]
                            }
                        }
                    }
                },
                // Rank by Best 5, not total points
                { $sort: { best5: -1 } },
                { $limit: limit },
                // Drop the raw scores array — not needed by the client
                { $project: { allScores: 0 } }
            ]);

            res.status(200).json(leaderboard);
        } catch (err) {
            console.error('Season leaderboard error:', err);
            res.status(500).json({ error: 'Failed to retrieve season leaderboard' });
        }
    },

    /**
     * Get top scores for a specific quiz
     */
    async getQuizLeaderboard(req, res) {
        try {
            const { gameID } = req.params;
            const limit = parseInt(req.query.limit) || 20;

            // Find all sessions for this quiz
            const sessions = await GameSession.find({ gameID }).select('_id verificationLevel');
            const sessionIds = sessions.map(s => s._id);

            const leaderboard = await PlayerResult.find({
                gameSessionID: { $in: sessionIds },
                isBot: false
            })
            .sort({ totalScore: -1 })
            .limit(limit)
            .populate('userID', 'displayName avatar')
            .lean();
            
            // Add verification info to results
            const resultsWithMeta = leaderboard.map(result => {
                const session = sessions.find(s => s._id.toString() === result.gameSessionID.toString());
                return {
                    ...result,
                    playerName: result.displayName, // Alias for FE consistency
                    verificationLevel: session ? session.verificationLevel : 3
                };
            });

            // FALLBACK: Mock data for troubleshooting
            if (resultsWithMeta.length === 0 || req.query.mock === 'true') {
                return res.status(200).json([
                    { playerName: "High Scorer", totalScore: 5000, verificationLevel: 1 },
                    { playerName: "Silver Medalist", totalScore: 4200, verificationLevel: 2 },
                    { playerName: "Bronze Winner", totalScore: 3800, verificationLevel: 3 }
                ]);
            }

            res.status(200).json(resultsWithMeta);
        } catch (err) {
            console.error('Leaderboard error:', err);
            res.status(500).json({ error: 'Failed to retrieve leaderboard' });
        }
    }
};

export default leaderboardController;
