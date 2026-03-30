import express from 'express';
import leaderboardController from '../controllers/leaderboardController.js';

const router = express.Router();

// Global high scores across all quizzes
router.get('/global', leaderboardController.getGlobalLeaderboard);

// Quiz-specific leaderboard
router.get('/game/:gameID', leaderboardController.getQuizLeaderboard);

export default router;
