import Quiz from '../models/mongo.quiz.js';
import Ajv from 'ajv';
import fs from 'fs';

const ajv = new Ajv({ allErrors: true });
const schemaPath = 'server/services/quiz-schema.json';
const quizSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const validateQuizSchema = ajv.compile(quizSchema);

// Define custom error types
export class QuizServiceError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'QuizServiceError';
        this.details = details;
    }
}
export class ValidationError extends QuizServiceError {
    constructor(message, details) {
        super(message, details);
        this.name = 'ValidationError';
    }
}
export class NotFoundError extends QuizServiceError {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
    }
}
export class PermissionError extends QuizServiceError {
    constructor(message) {
        super(message);
        this.name = 'PermissionError';
    }
}

// Validate a quiz against the schema
export function validateQuiz(quizData) {
    // Your existing validation logic
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(quizSchema);
    const valid = validate(quizData);

    return {
        valid: valid,
        errors: validate.errors || []
    };
}

// Update service methods with proper error handling
export async function saveQuiz(quizData, userId) {

    console.log('QuizService::saveQuiz:', quizData.title, userId);
    try {
        let thisQuiz;

        // Validate the quizData immediately and attach validation result to quizData
        const validationResult = validateQuiz(quizData);
        quizData.validation = validationResult.errors;

        // First-time save logic
        if (!quizData._id) {
            const newQuiz = { ...quizData };
            delete newQuiz._id;

            // Add ownership
            newQuiz.owner = userId;
            newQuiz.rounds.forEach(round => {
                if (!round.owner) round.owner = userId;
                if (!round._id) delete round._id;
            });

            thisQuiz = new Quiz(newQuiz);
            try {
                await thisQuiz.save();
            } catch (dbError) {
                throw new QuizServiceError(
                    'Failed to save new quiz to database',
                    dbError.message
                );
            }

            console.log('Quiz saved:', thisQuiz);
            return filterQuestions(thisQuiz, userId);
        }

        // Update existing quiz
        try {
            thisQuiz = await Quiz.findById(quizData._id);
        } catch (dbError) {
            throw new QuizServiceError(
                'Database error while finding quiz',
                dbError.message
            );
        }

        if (!thisQuiz) {
            throw new NotFoundError(`Quiz with ID ${quizData._id} not found`);
        }

        // Logic for different ownership scenarios
        if (userId && (thisQuiz.owner.toString() != userId)) {
            // User not owner of quiz - handle round updates
            quizData.rounds.forEach(async (newRound) => {
                const index = thisQuiz.rounds.findIndex((thisRound) => {
                    return thisRound._id.toString() == newRound._id;
                });

                if (index >= 0 && thisQuiz.rounds[index].owner &&
                    thisQuiz.rounds[index].owner.toString() == userId) {
                    thisQuiz.rounds[index] = newRound;
                    thisQuiz.rounds[index].owner = userId;
                } else if (index < 0) {
                    newRound.owner = userId;
                    thisQuiz.rounds.push(newRound);
                }
            });
        } else {
            // Owner updating - full overwrite
            quizData.rounds.forEach(round => {
                if (!round.owner) round.owner = userId
            });
            thisQuiz = new Quiz(quizData);
        }

        try {
            await Quiz.findByIdAndUpdate(thisQuiz._id, thisQuiz);
        } catch (dbError) {
            throw new QuizServiceError(
                'Failed to update quiz in database',
                dbError.message
            );
        }

        return filterQuestions(thisQuiz, userId);

    } catch (error) {
        // Rethrow service errors, wrap others
        if (error instanceof QuizServiceError) {
            throw error;
        } else {
            throw new QuizServiceError(
                'Unexpected error in quiz service',
                error.message
            );
        }
    }
}

// getAllQuizzes
// Returns all available quizzes for hosting
// NOTE: this should not be used by the quizbuilder as this allows anyone to edit a public quiz
export async function getAllQuizzes(userId) {

    // Since we are using this by the quiz builder which is allowing editing, remove the public check for now
    const search = {
        $or: [
            { owner: userId },
            // { public: true }
        ]
    };

    const quizzes = await Quiz.find(search);
    return quizzes.map(quiz => filterQuestions(quiz, userId));
}


export async function getQuizById(quizId, userId) {
    const quiz = await Quiz.getQuizById(quizId);
    if (!quiz) return null;
    return filterQuestions(quiz, userId);
}


export async function deleteQuiz(quizId, userId) {

    console.log('QuizService:: deleteQuiz:', quizId, userId);

    try {
        // Find the quiz first to check ownership
        const quiz = await Quiz.findById(quizId);

        // Quiz doesn't exist
        if (!quiz) {
            throw new NotFoundError(`Quiz with ID ${quizId} not found`);
        }

        // Authorization check
        if (quiz.owner.toString() !== userId) {
            throw new PermissionError('You do not have permission to delete this quiz');
        }

        // Proceed with deletion if authorized
        return Quiz.findByIdAndDelete(quizId);

    } catch (error) {
        // Rethrow service errors, wrap others
        if (error instanceof QuizServiceError) {
            throw error;
        } else {
            throw new QuizServiceError(
                'Unexpected error in quiz service',
                error.message
            );
        }
    }
}

export async function deleteQuizRound(quizId, roundId, userId) {

    try {
        const thisQuiz = await Quiz.findById(quizId);
        if (!thisQuiz) throw new NotFoundError('Round not found in this quiz');

        const index = thisQuiz.rounds.findIndex((thisRound) => {
            return thisRound._id.toString() == roundId;
        });

        if (index >= 0) {
            const thisRound = thisQuiz.rounds[index];
            if (thisRound.owner && thisRound.owner.toString() == userId) {
                thisQuiz.rounds.splice(index, 1);
                await thisQuiz.save();
            }
        }

        return thisQuiz;

    } catch (error) {
        // Rethrow service errors, wrap others
        if (error instanceof QuizServiceError) {
            throw error;
        } else {
            throw new QuizServiceError(
                'Unexpected error in quiz service',
                error.message
            );
        }

    }
}

// Helper function
function filterQuestions(quiz, userId) {
    const filteredQuiz = JSON.parse(JSON.stringify(quiz));
    filteredQuiz.rounds.forEach((round) => {
        if (round.owner && round.owner.toString() != userId) {
            round.questions = [];
        }
    });

    return filteredQuiz;
}