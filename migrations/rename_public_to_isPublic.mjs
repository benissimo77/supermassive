import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoDbURI = process.env.MONGODB_URI;

async function runMigration() {
    if (!mongoDbURI) {
        console.error("Error: MONGODB_URI not found in .env");
        process.exit(1);
    }

    try {
        console.log(`Connecting to remote MongoDB: ${mongoDbURI.split('@')[1]}`);
        await mongoose.connect(mongoDbURI);
        const db = mongoose.connection;

        console.log(`\n--- Renaming "public" field to "isPublic" ---`);

        // 1. Rename in "quizzes" collection
        console.log("Renaming in quizzes collection...");
        const v1Result = await db.collection("quizzes").updateMany(
            { public: { $exists: true } },
            { $rename: { "public": "isPublic" } }
        );
        console.log(`V1 Quizzes matched: ${v1Result.matchedCount}, Modified: ${v1Result.modifiedCount}`);

        // 2. Rename in "quizv2s" collection
        console.log("\nRenaming in quizv2s collection...");
        const v2Result = await db.collection("quizv2s").updateMany(
            { public: { $exists: true } },
            { $rename: { "public": "isPublic" } }
        );
        console.log(`V2 Quizzes matched: ${v2Result.matchedCount}, Modified: ${v2Result.modifiedCount}`);

        console.log("\nMigration completed successfully.");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

runMigration();
