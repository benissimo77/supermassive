import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Quiz from '../models/mongo.quiz.js';
import { QuizV2, Question } from '../models/mongo.quizv2.js';

dotenv.config();

async function migrate() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not found in environment');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Migrate Quiz (V1)
        console.log('Migrating Quiz (V1)...');
        // We use lean() to get raw objects, but we need to save them back.
        // Or we can use find() and update documents.
        const quizzes = await Quiz.find({});
        let quizCount = 0;
        for (const quiz of quizzes) {
            let changed = false;
            const quizObj = quiz.toObject({ virtuals: false });
            
            // Check top-level owner
            if (quizObj.owner && !quizObj.ownerID) {
                quiz.ownerID = quizObj.owner;
                quiz.set('owner', undefined, { strict: false });
                changed = true;
            }

            // Check rounds
            if (quiz.rounds && Array.isArray(quiz.rounds)) {
                quiz.rounds.forEach((round, index) => {
                    const roundObj = quizObj.rounds[index];
                    if (roundObj) {
                        // Migrate owner -> ownerID
                        if (roundObj.owner && !roundObj.ownerID) {
                            round.ownerID = roundObj.owner;
                            quiz.set(`rounds.${index}.owner`, undefined, { strict: false });
                            changed = true;
                        }

                        // Ensure ownerID exists (default to quiz owner if missing)
                        if (!round.ownerID) {
                            round.ownerID = quiz.ownerID;
                            changed = true;
                        }

                        // Fix missing required fields in rounds
                        if (!round.roundTimer) {
                            round.roundTimer = '0';
                            changed = true;
                        }
                        if (!round.showAnswer) {
                            round.showAnswer = 'round';
                            changed = true;
                        }
                        if (!round.updateScores) {
                            round.updateScores = 'round';
                            changed = true;
                        }
                    }
                });
            }

            if (changed) {
                await quiz.save();
                quizCount++;
            }
        }
        console.log(`Updated ${quizCount} V1 quizzes.`);

        // 2. Migrate QuizV2
        console.log('Migrating QuizV2...');
        const v2quizzes = await QuizV2.find({});
        let v2Count = 0;
        for (const quiz of v2quizzes) {
            let changed = false;
            const quizObj = quiz.toObject({ virtuals: false });

            if (quizObj.owner && !quizObj.ownerID) {
                quiz.ownerID = quizObj.owner;
                quiz.set('owner', undefined, { strict: false });
                changed = true;
            }

            if (quiz.rounds && Array.isArray(quiz.rounds)) {
                quiz.rounds.forEach((round, index) => {
                    const roundObj = quizObj.rounds[index];
                    if (roundObj) {
                        if (roundObj.owner && !roundObj.ownerID) {
                            round.ownerID = roundObj.owner;
                            quiz.set(`rounds.${index}.owner`, undefined, { strict: false });
                            changed = true;
                        }

                        // Ensure ownerID exists (default to quiz owner if missing)
                        if (!round.ownerID) {
                            round.ownerID = quiz.ownerID;
                            changed = true;
                        }

                        // Fix missing required fields in rounds
                        if (!round.roundTimer) {
                            round.roundTimer = '0';
                            changed = true;
                        }
                        if (!round.showAnswer) {
                            round.showAnswer = 'round';
                            changed = true;
                        }
                        if (!round.updateScores) {
                            round.updateScores = 'round';
                            changed = true;
                        }
                    }
                });
            }

            if (changed) {
                await quiz.save();
                v2Count++;
            }
        }
        console.log(`Updated ${v2Count} V2 quizzes.`);

        // 3. Migrate Question
        console.log('Migrating Questions...');
        const questions = await Question.find({});
        let qCount = 0;
        for (const question of questions) {
            let changed = false;
            const qObj = question.toObject({ virtuals: false });

            if (qObj.owner && !qObj.ownerID) {
                question.ownerID = qObj.owner;
                question.set('owner', undefined, { strict: false });
                changed = true;
            }

            if (changed) {
                await question.save();
                qCount++;
            }
        }
        console.log(`Updated ${qCount} questions.`);

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
