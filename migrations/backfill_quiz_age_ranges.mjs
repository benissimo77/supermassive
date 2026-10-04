import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoDbURI = process.env.MONGODB_URI;
const dryRun = process.argv.includes('--dry-run');

async function runMigration() {
    if (!mongoDbURI) {
        console.error("Error: MONGODB_URI not found in .env");
        process.exit(1);
    }

    try {
        console.log(`Connecting to remote MongoDB: ${mongoDbURI.split('@')[1]}`);
        await mongoose.connect(mongoDbURI);
        const db = mongoose.connection;

        console.log(`\n--- Backfilling ageRanges: ['Family'] on quizzes missing it ${dryRun ? '(DRY RUN)' : ''} ---`);

        // Only the V1 "quizzes" collection - QuizV2 is deprecated and not tagged.
        const filter = { ageRanges: { $exists: false } };
        const matchCount = await db.collection('quizzes').countDocuments(filter);
        console.log(`Quizzes missing ageRanges: ${matchCount}`);

        if (dryRun) {
            console.log('Dry run - no changes made. Re-run without --dry-run to apply.');
        } else {
            const result = await db.collection('quizzes').updateMany(
                filter,
                { $set: { ageRanges: ['Family'] } }
            );
            console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

            // Verify: no quizzes should be missing ageRanges after this runs
            const stillMissing = await db.collection('quizzes').countDocuments(filter);
            console.log(`Verification - quizzes still missing ageRanges: ${stillMissing}`);
            if (stillMissing > 0) {
                console.error('WARNING: some documents were not updated - investigate before re-running.');
            }
        }

        console.log('\nMigration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

runMigration();
