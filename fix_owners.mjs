import { dbConnect, mongoose } from "./server/db.js";

async function run() {
    await dbConnect();
    const db = mongoose.connection;
    const targetUserId = new mongoose.Types.ObjectId("67150d8c98c76cabc58b7160");

    console.log("--- UPDATING QUIZZES ---");
    const v1Result = await db.collection("quizzes").updateMany(
        {},
        { $set: { ownerID: targetUserId } }
    );
    console.log(`V1 Quizzes matched: ${v1Result.matchedCount}, Updated: ${v1Result.modifiedCount}`);

    const v1RoundsResult = await db.collection("quizzes").updateMany(
        { "rounds.ownerID": { $exists: true } },
        { $set: { "rounds.$[].ownerID": targetUserId } }
    );
    console.log(`V1 Rounds updated: ${v1RoundsResult.modifiedCount}`);

    const v2Result = await db.collection("quizv2s").updateMany(
        {},
        { $set: { ownerID: targetUserId } }
    );
    console.log(`V2 Quizzes matched: ${v2Result.matchedCount}, Updated: ${v2Result.modifiedCount}`);

    mongoose.disconnect();
    process.exit(0);
}
run();
