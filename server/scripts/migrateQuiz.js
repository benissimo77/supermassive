import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Quiz from '../models/mongo.quiz.js';
import { validateQuiz } from '../services/quizService.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    runMigration();
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});

/**
 * Migration function - customize this for each schema change
 * @param {Object} quiz - The quiz to migrate
 * @returns {Object} - Modified quiz
 */
function migrateQuiz(quiz) {

    // Add schemaVersion
    if (!quiz.schemaVersion) {
        quiz.schemaVersion = '1.0';
    }

    // Convert true-false questions from string to boolean
    if (quiz.rounds && Array.isArray(quiz.rounds)) {
        quiz.rounds.forEach(round => {
            if (round.questions && Array.isArray(round.questions)) {
                round.questions.forEach(question => {
                    // Convert boolean true/false back to string
                    if (question.type === 'true-false') {
                        // Force conversion to string regardless of current type
                        const originalType = typeof question.answer;
                        const originalValue = question.answer;

                        // Convert to proper string 'true' or 'false'
                        if (originalValue === true || originalValue === 'true') {
                            question.answer = 'true';
                        } else if (originalValue === false || originalValue === 'false') {
                            question.answer = 'false';
                        }

                        console.log(`Converting true-false answer from ${originalType}:${originalValue} to string:"${question.answer}" for question: "${question.text.substring(0, 30)}..."`);
                    }
                    // Convert number fields from string to number
                    if ((question.type === 'number-exact' || question.type === 'number-closest') &&
                        typeof question.answer === 'string' && !isNaN(question.answer)) {
                        console.log(`Converting number answer from string to number for question: "${question.text.substring(0, 30)}..."`);
                        question.answer = Number(question.answer);
                    }
                });
            }
        });
    }

    return quiz;
}

/**
 * Main migration runner
 */
async function runMigration() {
    try {
        console.log('Starting migration...');

        // Get all quizzes
        const quizzes = await Quiz.find({});
        console.log(`Found ${quizzes.length} quizzes to process`);

        // Track statistics
        let updated = 0;
        let unchanged = 0;
        let validationFailed = 0;
        let errors = 0;

        // Validation issues for later review
        const validationIssues = [];

        // Process each quiz
        for (const quiz of quizzes) {
            try {
                const originalQuiz = JSON.stringify(quiz.toObject());

                // Apply migration function
                const migratedQuiz = migrateQuiz(quiz.toObject());

                // Check if anything changed
                if (JSON.stringify(migratedQuiz) !== originalQuiz) {
                    // Validate before saving
                    const validationResult = validateQuiz(migratedQuiz);

                    if (validationResult.valid) {
                        // Update in database
                        await Quiz.findByIdAndUpdate(quiz._id, migratedQuiz);
                        updated++;
                        console.log(`✅ Successfully updated quiz: ${migratedQuiz.title} (${quiz._id})`);
                    } else {
                        // Track validation issues
                        validationFailed++;
                        const issues = {
                            quizId: quiz._id,
                            title: migratedQuiz.title,
                            errors: validationResult.errors
                        };
                        validationIssues.push(issues);
                        console.error(`❌ Validation failed for quiz ${migratedQuiz.title} (${quiz._id})`);
                        console.error(JSON.stringify(validationResult.errors, null, 2));
                    }
                } else {
                    unchanged++;
                }
            } catch (error) {
                console.error(`Error processing quiz ${quiz._id}:`, error);
                errors++;
            }
        }

        // Log results
        console.log('\nMigration complete:');
        console.log(`- Updated: ${updated}`);
        console.log(`- Unchanged: ${unchanged}`);
        console.log(`- Validation Failed: ${validationFailed}`);
        console.log(`- Errors: ${errors}`);

        // Create migration record
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const record = {
            date: new Date().toISOString(),
            totalQuizzes: quizzes.length,
            updated,
            unchanged,
            validationFailed,
            errors,
            validationIssues
        };

        // Save migration record
        const recordsDir = path.join(process.cwd(), 'migrations');
        if (!fs.existsSync(recordsDir)) {
            fs.mkdirSync(recordsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(recordsDir, `migration-${timestamp}.json`),
            JSON.stringify(record, null, 2)
        );

        console.log(`Migration record saved to migrations/migration-${timestamp}.json`);

        // Report validation issues
        if (validationIssues.length > 0) {
            fs.writeFileSync(
                path.join(recordsDir, `validation-issues-${timestamp}.json`),
                JSON.stringify(validationIssues, null, 2)
            );
            console.log(`⚠️ ${validationIssues.length} quizzes had validation issues.`);
            console.log(`Details saved to migrations/validation-issues-${timestamp}.json`);
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        // Close database connection
        mongoose.connection.close();
        console.log('Database connection closed');
    }
}