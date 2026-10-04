import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoDbURI = process.env.MONGODB_URI;
const targetUserId = "695d1b266d838b92a63dca03";

async function runMigration() {
    if (!mongoDbURI) {
        console.error("Error: MONGODB_URI not found in .env");
        process.exit(1);
    }

    try {
        console.log(`Connecting to remote MongoDB: ${mongoDbURI.split('@')[1]}`);
        await mongoose.connect(mongoDbURI);
        const db = mongoose.connection;
        const targetId = new mongoose.Types.ObjectId(targetUserId);

        console.log(`\n--- Migrating all quizzes to OwnerID: ${targetUserId} ---`);

        // 1. Update v1 Quizzes (quizzes collection)
        console.log("Updating V1 Quizzes...");
        const v1Result = await db.collection("quizzes").updateMany(
            {},
            { $set: { ownerID: targetId } }
        );
        console.log(`V1 Quizzes matched: ${v1Result.matchedCount}, Updated: ${v1Result.modifiedCount}`);

        // Update v1 Rounds (nested in quizzes)
        const v1RoundsResult = await db.collection("quizzes").updateMany(
            { "rounds.ownerID": { $exists: true } },
            { $set: { "rounds.$[].ownerID": targetId } }
        );
        console.log(`V1 Rounds updated: ${v1RoundsResult.modifiedCount}`);

        // 2. Update v2 Quizzes (quizv2s collection)
        console.log("\nUpdating V2 Quizzes...");
        const v2Result = await db.collection("quizv2s").updateMany(
            {},
            { $set: { ownerID: targetId } }
        );
        console.log(`V2 Quizzes matched: ${v2Result.matchedCount}, Updated: ${v2Result.modifiedCount}`);

        // Update v2 Rounds (nested in quizv2s)
        const v2RoundsResult = await db.collection("quizv2s").updateMany(
            { "rounds.ownerID": { $exists: true } },
            { $set: { "rounds.$[].ownerID": targetId } }
        );
        console.log(`V2 Rounds updated: ${v2RoundsResult.modifiedCount}`);

        // 3. Update Questions (questions collection) - used by QuizV2
        console.log("\nUpdating Questions (V2)...");
        const questionsResult = await db.collection("questions").updateMany(
            {},
            { $set: { ownerID: targetId } }
        );
        console.log(`Questions matched: ${questionsResult.matchedCount}, Updated: ${questionsResult.modifiedCount}`);

        console.log("\nMigration completed successfully.");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

runMigration();
