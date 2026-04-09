import mongoose from 'mongoose';
import Quiz from '../models/mongo.quiz.js';
import { QuizV2, Question } from '../models/mongo.quizv2.js';
import Ajv from 'ajv';
import fs from 'fs';
import { saveV1QuizToV2 } from './quizConvert.js';

const ajv = new Ajv({ allErrors: true });
const schemaPath = 'server/services/quiz-schema.json';
const quizSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const validateQuizSchema = ajv.compile(quizSchema);

// Custom validation rules that extend AJV logic for specific questions.
// To avoid looping through the entire quiz payload for every single rule, 
// we loop through the quiz hierarchy once, and pass each question to these rules.
const questionValidators = [
    // 1. Ordering Questions: All items must have images, or we must have no images
    (q, rIndex, qIndex, errors) => {
        if (q.type === 'ordering' && q.itemImages && q.itemImages.length > 0) {
            const allHaveImages = q.itemImages.every(url => typeof url === 'string' && url.trim().length > 0);
            if (!q.items || q.itemImages.length !== q.items.length || !allHaveImages) {
                errors.push({
                    instancePath: `/rounds/${rIndex}/questions/${qIndex}/itemImages`,
                    schemaPath: '#/custom/itemImagesMatch',
                    keyword: 'customLengthMatch',
                    params: {},
                    message: 'All items must have images, or you must remove all images.'
                });
            }
        }
    }
    // Add additional question-level validation rule functions here in the future
];

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

/**
 * Normalizes a userID (which could be a string, ObjectId, or User document) to a string ID.
 */
function getUserIDString(userID) {
    if (!userID) return null;
    if (typeof userID === 'string') return userID;
    if (userID._id) return userID._id.toString();
    return userID.toString();
}

// Validate a quiz against the schema
export function validateQuiz(quizData) {
    // Your existing validation logic
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(quizSchema);
    validate(quizData); // Returns primitive boolean, ignores mutations to errors array easily

    // Clone AJV errors so we can inject our own
    let errors = validate.errors ? [...validate.errors] : [];

    // Run all custom extensive validation checks
    if (quizData.rounds) {
        quizData.rounds.forEach((round, rIndex) => {
            if (round.questions) {
                round.questions.forEach((q, qIndex) => {
                    // Loop through all custom question validators once per question
                    questionValidators.forEach(validator => {
                        validator(q, rIndex, qIndex, errors);
                    });
                });
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors: errors
    }
}

// ⚡ Save a V2 Fork
export async function saveAsQuizV2(quizData, userID) {

    const userIDString = getUserIDString(userID);

    // 1. Load the original quiz
    const existingQuiz = await QuizV2.findById(quizData._id).lean();
    if (!existingQuiz) throw new Error("V2 quiz not found");

    // 2. Prepare the fork
    const fork = {
        title: quizData.title,
        description: quizData.description,
        ownerID: userIDString,
        public: true,
        rounds: [],
    };

    // 3. Clone rounds + questions
    for (const round of quizData.rounds) {
        const newRound = {
            title: round.title,
            description: round.description,
            ownerID: userIDString,
            roundTimer: round.roundTimer,
            showAnswer: round.showAnswer,
            updateScores: round.updateScores,
            questions: []
        };

        for (const question of round.questions) {

            // question may already be populated, strip down
            let existingQuestion = null;
            if (question._id && mongoose.Types.ObjectId.isValid(question._id)) {
                existingQuestion = await Question.findById(question._id).lean();
            } else {
                delete question._id;
            }

            // Brand new question? Create new and add to rounds array
            if (!existingQuestion) {

                const newQuestion = await Question.create({
                    ...question,
                    ownerID: userIDString,
                    version: 1,
                    parentID: null,
                    familyID: new mongoose.Types.ObjectId()
                });
                newRound.questions.push( newQuestion._id );
                continue;
            }

            console.log('Existing question:', existingQuestion);


            // 4. Either Create a new version of the question
            // OR overwrite existing question (if user is owner of the original question)
            if (existingQuestion.ownerID && existingQuestion.ownerID.toString() === userIDString) {
                // User owns original question - overwrite it
                console.log('User owns question - overwriting:', question);
                await Question.findByIdAndUpdate(existingQuestion._id, { ...question });
                newRound.questions.push( existingQuestion._id );
            } else {
                // Create a new question version
                const newQuestion = await Question.create({
                    ...question,
                    ownerID: userIDString,
                    parentID: existingQuestion._id,
                    familyID: existingQuestion.familyID || existingQuestion._id,
                    version: (existingQuestion.version || 1) + 1
                });

                newRound.questions.push( newQuestion._id );
            }

        }

        fork.rounds.push(newRound);
    }

    // 5. Save new fork OR update existing fork if user is owner
    if (existingQuiz.ownerID && existingQuiz.ownerID.toString() === userIDString) {
        return await QuizV2.findByIdAndUpdate(existingQuiz._id, fork);
    } else {
        console.log('Saving new fork quiz for user:', userIDString);
        return await QuizV2.create(fork);
    }

}


    // Update service methods with proper error handling
    export async function saveQuiz(quizData, userID) {

        const userIDString = getUserIDString(userID);
        const schemaVersion = Number(quizData.schemaVersion) || 1;
        console.log('QuizService::saveQuiz:', schemaVersion, quizData.title, quizData._id, userIDString);

        let thisQuiz;
        
        // First-time save logic (save as V1 AND V2 for safety)
        // NOTE: V1 very important as allows entire quiz to be included in a single JSON - good for importing/exporting/sharing
        if (!quizData._id) {

            // _id might be an empty string which will error on save, so delete it
            delete quizData._id;

            // Add ownership
            quizData.ownerID = userIDString;
            quizData.rounds.forEach(round => {
                if (!round.ownerID) round.ownerID = userIDString;
                if (round._id) delete round._id;
            });

            thisQuiz = new Quiz(quizData);
            try {
                await thisQuiz.save();
            } catch (dbError) {
                throw new QuizServiceError(
                    'Failed to save new quiz to database',
                    dbError.message
                );
            }

            // Also save the quiz in V2 format - remove for now
            // thisQuiz = await saveV1QuizToV2(thisQuiz, userIDString);
            // console.log('Converted to V2 quiz:', thisQuiz._id);

            return filterQuestions(thisQuiz, userIDString);
        }

        // Existing quiz - already loaded from DB at least once before so has _id, owner etc
        // Why do we need to load the original again???
        if (Math.floor(schemaVersion) === 1) {
            thisQuiz = await Quiz.findById(quizData._id);
        } else {
            thisQuiz = await QuizV2.findById(quizData._id);
        }

        if (!thisQuiz) {
            throw new NotFoundError(`Quiz with ID ${quizData._id} not found`);
        }

        // Logic for different ownership scenarios (FORK vs OVERWRITE)
        if (userIDString && (thisQuiz.ownerID.toString() != userIDString)) {

            console.log('User is NOT owner - saving as FORK');

            // Track lineage before destroying the old ID
            const originalId = quizData._id;

            // Clean up the IDs so they don't conflict, effectively creating a new Quiz
            quizData.ownerID = userIDString;
            quizData.collaborators = []; // wipe old collaborators just in case
            delete quizData._id;

            // Set the lineage tracking
            quizData.parentID = originalId;
            if (thisQuiz.originID) {
                // carry forward the true origin
                quizData.originID = thisQuiz.originID;
            } else {
                // If it doesn't have an originID yet, the originalId was the true origin
                quizData.originID = originalId;
            }

            // ensure all rounds also get stripped of _id and assigned to this new user
            if (quizData.rounds) {
                quizData.rounds.forEach(round => {
                    delete round._id;
                    round.ownerID = userIDString;
                    // Wipe question ids so it treats them as embedded subdocs cleanly
                    if (round.questions) {
                        round.questions.forEach(q => delete q._id);
                    }
                });
            }

            // Force fork to be a V1 monolithic quiz document to simplify architecture
            quizData.schemaVersion = 1;

            thisQuiz = await Quiz.create(quizData);

        } else {

            console.log('User IS owner - full update');

            // Owner updating - full overwrite
            if (quizData.rounds) {
                quizData.rounds.forEach(round => {
                    if (!round.ownerID) round.ownerID = userIDString;
                    // remove round id so mongoose replaces them entirely instead of trying to merge
                    if (round._id) delete round._id;
                });
            }

            // Save as V1 monolithic document, migrating if it was formerly V2
            if (Math.floor(schemaVersion) === 1) {
                thisQuiz = await Quiz.findByIdAndUpdate(quizData._id, quizData, { new: true });
                // Also convert to V2 and save - don't bother for now
                // thisQuiz = await saveV1QuizToV2(quizData, userID);
                // console.log('Converted to V2 quiz:', thisQuiz._id);
            } else {
                console.log('Migrating V2 quiz to V1 format for owner');
                quizData.schemaVersion = 1;
                // create new v1 version, delete old v2 version to keep things simple
                const legacyV2Id = quizData._id;
                delete quizData._id;
                thisQuiz = await Quiz.create(quizData);
                // await QuizV2.findByIdAndDelete(legacyV2Id); // Delete the old deprecated format
            }
        }
        // } catch (dbError) {
        //     throw new QuizServiceError(
        //         'Failed to update quiz in database',
        //         dbError.message
        //     );
        // }


        // This works for case where collaborators should NOT see each other's questions
        // return filterQuestions(thisQuiz, userID);

        // Important that thisQuiz is a fully populated V2 quiz - questions fully expanded
        return thisQuiz;

        // } catch (error) {
        //     // Rethrow service errors, wrap others
        //     if (error instanceof QuizServiceError) {
        //         throw error;
        //     } else {
        //         throw new QuizServiceError(
        //             'Unexpected error in quiz service',
        //             error.message
        //         );
        //     }
        // }

    }

    // getAllQuizzes
    // Returns all available quizzes for hosting
    // NOTE: this should not be used by the quizbuilder as this allows anyone to edit a public quiz
    export async function getAllQuizzes(userID) {

        const userIDString = getUserIDString(userID);

        // Return quizzes owned by the user OR public quizzes, excluding deleted ones
        const search = {
            isDeleted: { $ne: true },
            $or: [
                { ownerID: userIDString },
                { public: true }
            ]
        };

        const quizzes = await Quiz.find(search).lean();

        const v2quizzes = await QuizV2.find(search)
            .populate({
                path: 'rounds.questions',
                model: 'Question'
            })
            .lean();

        // console.log('QuizService::getAllQuizzes: Found V2:', v2quizzes[0].rounds[0].questions);

        // Flatten questions - quirk of populate, it populates question into the questionID field
        // for (const quiz of v2quizzes) {
        //     quiz.rounds.forEach(round => {
        //         round.questions = round.questions.map(q => q.questionId); // unwrap the document
        //     });
        // }

        const all_quizzes = quizzes.concat(v2quizzes);
        return all_quizzes.map(quiz => filterQuestions(quiz, userIDString));
    }


    export async function getQuizById(quizId, userID) {
        const userIDString = getUserIDString(userID);
        console.log('QuizService:: getQuizById:', quizId, userIDString);
        
        let quiz = await Quiz.findById(quizId).lean();
        if (!quiz) {
            quiz = await QuizV2.findById(quizId).populate({
                path: 'rounds.questions',
                model: 'Question'
            }).lean();
        }

        if (!quiz || quiz.isDeleted) return null;
        
        return filterQuestions(quiz, userIDString);
    }


    export async function deleteQuiz(quizId, userID) {

        console.log('QuizService:: deleteQuiz:', quizId, userID);
        const userIDString = getUserIDString(userID);

        try {
            // Find the quiz first to check ownership
            let quiz = await Quiz.findById(quizId);

            // Quiz doesn't exist - maybe its a V2 quiz?
            if (!quiz) {
                quiz = await QuizV2.findById(quizId);
                if (!quiz) {
                    throw new NotFoundError(`Quiz with ID ${quizId} not found`);
                }
            }

            // Authorization check
            if (quiz.ownerID.toString() !== userIDString) {
                throw new PermissionError('You do not have permission to delete this quiz');
            }

            // Soft delete: mark as deleted instead of removing from DB
            if (quiz instanceof Quiz) {
                return Quiz.findByIdAndUpdate(quizId, { isDeleted: true }, { new: true });
            } else if (quiz instanceof QuizV2) {
                return QuizV2.findByIdAndUpdate(quizId, { isDeleted: true }, { new: true });
            }

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

    export async function deleteQuizRound(quizId, roundId, userID) {

        const userIDString = getUserIDString(userID);

        try {
            const thisQuiz = await Quiz.findById(quizId);
            if (!thisQuiz) throw new NotFoundError('Round not found in this quiz');

            const index = thisQuiz.rounds.findIndex((thisRound) => {
                return thisRound._id.toString() == roundId;
            });

            if (index >= 0) {
                const thisRound = thisQuiz.rounds[index];
                if (thisRound.ownerID && thisRound.ownerID.toString() == userIDString) {
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
    function filterQuestions(quiz, userID) {
        // We no longer strip questions based on ownerID since 
        // the separate question library system (V2) is deprecated.
        // Stripping questions here was causing the dashboard to load 
        // empty rounds, which would then permanently save as empty.
        
        return quiz;
    }