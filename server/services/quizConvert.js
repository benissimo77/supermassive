import mongoose from 'mongoose';
import { Question, QuizV2 } from '../models/mongo.quizv2.js';

/**
 * Converts a V1 quiz into V2 format.
 * @param {Object} v1Quiz - Fully loaded V1 quiz document (with rounds and questions)
 * @param {String|ObjectId} userID - ID of the user performing the save
 */
export async function saveV1QuizToV2(v1Quiz, userID) {
    if (!v1Quiz) throw new Error('No V1 quiz provided for conversion');

    // NOTE: this function now extended to save a V2 quiz as well
    // For V2 it must check each question - store new question if modified, else reuse existing

    // Map to store old question references → new V2 question IDs
    const questionIdMap = new Map();

    // 1️⃣ Process all rounds and questions
    const v2Rounds = [];

    for (const round of v1Quiz.rounds) {
        const v2Round = {
            title: round.title,
            description: round.description,
            ownerID: round.ownerID || userID,
            roundTimer: round.roundTimer || '0',
            showAnswer: round.showAnswer || 'round',
            updateScores: round.updateScores || 'round',
            questions: []
        };

        // Iterate questions in this round
        for (const question of round.questions) {

            // Check if we've already converted this exact question
            // Use original _id as key for idempotency
            if (question._id && questionIdMap.has(question._id.toString())) {
                v2Round.questions.push( questionIdMap.get(question._id.toString()) );
                continue;
            }

            // Build the new V2 question object
            const newQuestion = {
                type: question.type,
                text: question.text,
                image: question.image,
                audio: question.audio,
                video: question.video,
                options: question.options || [],
                items: question.items || [],
                pairs: question.pairs || [],
                extra: question.extra || {},
                answer: question.answer || {},

                // Lineage & ownership
                ownerID: question.ownerID || userID,
                parentID: null,    // New question is root unless you implement V1→V2 mapping
                familyID: new mongoose.Types.ObjectId(), // Each new question starts a family
                generation: 1
            };

            // Save the new V2 question
            const savedQuestion = await Question.create(newQuestion);

            // Add reference for this round
            v2Round.questions.push( savedQuestion._id );

            // Track this mapping to avoid duplicates in other rounds (not sure this is really necessary)
            if (question._id) {
                questionIdMap.set(question._id.toString(), savedQuestion._id);
            }
        }

        v2Rounds.push(v2Round);
    }

    // 2️⃣ Build the V2 quiz object
    const v2QuizData = {
        schemaVersion: 2,
        title: v1Quiz.title,
        description: v1Quiz.description,
        ownerID: v1Quiz.ownerID || userID,
        public: v1Quiz.public !== undefined ? v1Quiz.public : true,
        collaborators: v1Quiz.collaborators || [],
        rounds: v2Rounds,
        validation: v1Quiz.validation || []
    };

    // 3️⃣ Save the V2 quiz
    const savedV2Quiz = await QuizV2.create(v2QuizData);

    console.log(`V1 Quiz (${v1Quiz._id}) converted → V2 Quiz (${savedV2Quiz._id})`);

    return await QuizV2.findById(savedV2Quiz._id)
        .populate({
            path: 'rounds.questions',
            model: 'Question'
        });
}

