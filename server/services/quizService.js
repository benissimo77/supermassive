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
    const valid = validate(quizData);

    return {
        valid: valid,
        errors: validate.errors || []
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
        if (schemaVersion == 1) {
            thisQuiz = await Quiz.findById(quizData._id);
        } else {
            thisQuiz = await QuizV2.findById(quizData._id);
        }

        if (!thisQuiz) {
            throw new NotFoundError(`Quiz with ID ${quizData._id} not found`);
        }

        // Logic for different ownership scenarios
        if (userIDString && (thisQuiz.ownerID.toString() != userIDString)) {

            console.log('User is NOT owner:', thisQuiz.ownerID.toString(), userIDString);

            // User not owner of quiz - check if they are allowed to collaborate
            const isCollaborator = thisQuiz.collaborators && thisQuiz.collaborators.some(collabId => collabId.toString() === userIDString);
            if (isCollaborator) {

                console.log('User is COLLABORATOR: ', thisQuiz.collaborators, userIDString);

                quizData.rounds.forEach(async (newRound) => {
                    const index = thisQuiz.rounds.findIndex((thisRound) => {
                        return thisRound._id.toString() == newRound._id;
                    });

                    if (index >= 0 && thisQuiz.rounds[index].ownerID &&
                        thisQuiz.rounds[index].ownerID.toString() == userIDString) {
                        thisQuiz.rounds[index] = newRound;
                        thisQuiz.rounds[index].ownerID = userIDString;
                    } else if (index < 0) {
                        newRound.ownerID = userIDString;
                        thisQuiz.rounds.push(newRound);
                    }
                });

            } else {

                console.log('User is NOT collaborator - saving as FORK');
                // thisQuiz = await saveAsQuizV2(quizData, userIDString);
                quizData.ownerID = userIDString;
                delete quizData._id;
                thisQuiz = await Quiz.create(quizData);

            }

        } else {

            console.log('User IS owner - full update');

            // Owner updating - full overwrite
            quizData.rounds.forEach(round => {
                if (!round.ownerID) round.ownerID = userIDString
                if (round._id) delete round._id;
            });

            // Save as V1 (if original was V1) and as V2 as well new:true returns the new quiz document
            if (schemaVersion === 1) {
                thisQuiz = await Quiz.findByIdAndUpdate(quizData._id, quizData, { new: true });
                // Also convert to V2 and save - don't bother for now
                // thisQuiz = await saveV1QuizToV2(quizData, userID);
                // console.log('Converted to V2 quiz:', thisQuiz._id);
            } else {
                await saveAsQuizV2(quizData, userID);
                thisQuiz = await QuizV2.findById(quizData._id)
                    .populate({
                        path: 'rounds.questions',
                        model: 'Question'
                    });
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

        // Since we are using this by the quiz builder which is allowing editing, remove the public check for now
        const search = {
            $or: [
                { ownerID: userIDString }
                // { public: true }
            ]
        };

        const quizzes = await Quiz.find(search);

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
        const quiz = await Quiz.getQuizByID(quizId);
        console.log('QuizService:: getQuizById: Found quiz:', quiz ? quiz.title : 'NOT FOUND');
        if (!quiz) return null;
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

            // Proceed with deletion if authorized
            if (quiz instanceof Quiz) {
                return Quiz.findByIdAndDelete(quizId);
            } else if (quiz instanceof QuizV2) {
                return QuizV2.findByIdAndDelete(quizId);
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
        const userIDString = getUserIDString(userID);
        const filteredQuiz = JSON.parse(JSON.stringify(quiz));
        filteredQuiz.rounds.forEach((round) => {
            if (round.ownerID && round.ownerID.toString() != userIDString) {
                round.questions = [];
            }
        });

        console.log('Filtered quiz for user:', userIDString, filteredQuiz);
        return filteredQuiz;
    }