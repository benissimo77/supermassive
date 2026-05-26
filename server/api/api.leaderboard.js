import express from 'express';
import leaderboardController from '../controllers/leaderboardController.js';

const router = express.Router();

// Global high scores across all quizzes
router.get('/global', leaderboardController.getGlobalLeaderboard);

// Season leaderboard — aggregated scores across all episodes in a season
router.get('/season/:seasonId', leaderboardController.getSeasonLeaderboard);

// Quiz-specific leaderboard
router.get('/game/:gameID', leaderboardController.getQuizLeaderboard);

export default router;
