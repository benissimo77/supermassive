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

        console.log(`\n--- Adding defaultTime ('18:00') to seasons missing it ---`);
        const defaultTimeResult = await db.collection("seasons").updateMany(
            { defaultTime: { $exists: false } },
            { $set: { defaultTime: '18:00' } }
        );
        console.log(`Seasons matched: ${defaultTimeResult.matchedCount}, Modified: ${defaultTimeResult.modifiedCount}`);

        console.log(`\n--- Adding timezone ('UTC') to seasons missing it ---`);
        const timezoneResult = await db.collection("seasons").updateMany(
            { timezone: { $exists: false } },
            { $set: { timezone: 'UTC' } }
        );
        console.log(`Seasons matched: ${timezoneResult.matchedCount}, Modified: ${timezoneResult.modifiedCount}`);

        console.log(`\n--- Adding airTime (null) to episodes missing it ---`);
        const airTimeResult = await db.collection("seasons").updateMany(
            { 'episodes.airTime': { $exists: false } },
            { $set: { 'episodes.$[elem].airTime': null } },
            { arrayFilters: [{ 'elem.airTime': { $exists: false } }] }
        );
        console.log(`Seasons matched: ${airTimeResult.matchedCount}, Modified: ${airTimeResult.modifiedCount}`);

        console.log("\nMigration completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

runMigration();
