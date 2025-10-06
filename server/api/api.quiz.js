import express from 'express';
import * as QuizService from '../services/quizService.js';


const router = express.Router();

// Middleware to check if the user is a host
function checkHost(req, res, next) {
    // console.log('checkHost:', req.session, req.url, req.originalUrl, req.baseUrl, req.path, req.params, req.query);
    if (req.session && req.session.host) {
        next();
    } else {
        return res.status(404).json({ message: 'No user identified' });
    }
}

router.use([checkHost]);

// Create a new quiz
// Helper function for consistent responses
function apiResponse(success, data = null, message = '', error = null) {
    return {
        success,
        data,
        message,
        error
    };
}
// Map quizService names to HTTP status codes
export function mapErrorToStatusCode(name) {
    const statusCodeMap = {
        'ValidationError': 400,
        'NotFoundError': 404,
        'PermissionError': 403,
        'QuizServiceError': 500
    };
    return statusCodeMap[name] || 500;
}

// Validate a quiz before saving it
// Add this new endpoint to your existing router

// Validate a quiz without saving
router.post('/validate', async (req, res) => {
    try {
        // Call just the validation part of your QuizService
        const validationResult = QuizService.validateQuiz(req.body);

        return res.status(200).json(apiResponse(
            validationResult.valid,
            {
                valid: validationResult.valid,
                errors: validationResult.errors || []
            },
            validationResult.valid ? 'Quiz structure is valid' : 'Quiz has validation issues'
        ));
    } catch (error) {
        console.error('Error validating quiz:', error);
        return res.status(400).json(apiResponse(
            false,
            {
                valid: false,
                errors: error.details || [{ message: error.message }]
            },
            error.message,
            error.details
        ));
    }
});

// Create or update a quiz
router.post('/save', async (req, res) => {
    console.log('api.quiz /save:', req.body, req.user, req.session.user);
    try {
        const savedQuiz = await QuizService.saveQuiz(req.body, req.user);
        return res.status(200).json(apiResponse(
            true,
            savedQuiz,
            'Quiz saved successfully'
        ));
    } catch (error) {
        console.error('Error saving quiz:', error);
        const statusCode = mapErrorToStatusCode(error.name);
        return res.status(statusCode).json(apiResponse(
            false,
            null,
            error.message,  // Human-readable message for the user
            error.details   // Technical details for debugging
        ));

    }
});


// Get all quizzes (public and personal)
router.get('/', async (req, res) => {
    console.log('api.quiz.js: GET /', req.user);

    if (process.env.NODE_ENV == 'development') {
        if (!req.user) {
            req.user = '67150d8c98c76cabc58b7160';
        }
    }

    try {
        const quizzes = await QuizService.getAllQuizzes(req.user);
        console.log('Quizzes found:', quizzes.length, req.user);
        res.status(200).json(apiResponse(
            true,
            quizzes,
            'Quizzes fetched successfully'
        ));
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        const statusCode = mapErrorToStatusCode(error.name);
        return res.status(statusCode).json(apiResponse(
            false,
            null,
            error.message,  // Human-readable message for the user
            error.details   // Technical details for debugging
        ));
    }
});


// Get a specific quiz by ID
router.get('/:id', async (req, res) => {

    console.log('api.quiz.js: GET /:id', req.params.id);

    if (process.env.NODE_ENV == 'development') {
        if (!req.user) {
            req.user = '67150d8c98c76cabc58b7160';
        }
    }

    try {
        const quiz = await QuizService.getQuizById(req.params.id, req.user);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        return res.status(200).json(apiResponse(
            true,
            quiz,
            'Quiz fetched OK'
        ));

    } catch (error) {
        console.error('Error fetching quiz:', error);
        const statusCode = mapErrorToStatusCode(error.name);
        return res.status(statusCode).json(apiResponse(
            false,
            null,
            error.message,  // Human-readable message for the user
            error.details   // Technical details for debugging
        ));
    }
});


// Delete a quiz
router.delete('/:id', async (req, res) => {

    if (process.env.NODE_ENV == 'development') {
        if (!req.user) {
            req.user = '67150d8c98c76cabc58b7160';
        }
    }

    try {
        const quiz = await QuizService.deleteQuiz(req.params.id, req.user);
        res.status(200).json(apiResponse(
            true,
            quiz,
            'Quiz deleted OK'
        ));
    } catch (error) {
        console.error('Error deleting quiz:', error);
        const statusCode = mapErrorToStatusCode(error.name);
        return res.status(statusCode).json(apiResponse(
            false,
            null,
            error.message,
            error.details
        ));
    }
});

// Delete a quizround
router.delete('/:id/:roundid', async (req, res) => {

    console.log('api.quiz delete quiz, round:', req.params.id, req.params.roundid);
    if (process.env.NODE_ENV == 'development') {
        if (!req.user) {
            req.user = '67150d8c98c76cabc58b7160';
        }
    }

    try {

        const result = await QuizService.deleteQuizRound(req.params.id, req.params.roundid, req.user);
        res.status(200).json(apiResponse(
            true,
            result,
            'Round deleted OK'
        ));

    } catch (error) {
        console.error('Error deleting quiz round:', error);
        const statusCode = mapErrorToStatusCode(error.name);
        return res.status(statusCode).json(apiResponse(
            false,
            null,
            error.message,  // Human-readable message for the user
            error.details   // Technical details for debugging
        ));
    }
});

export default router;