import mongoose from "mongoose";

async function run() {
    await mongoose.connect("mongodb+srv://bensilburn:kPHOzuUNDhr8H5oY@supermassive-cluster.pfb1c.mongodb.net/supermassive?retryWrites=true&w=majority");
    const db = mongoose.connection;
    const count = await db.collection("quizzes").countDocuments({});
    console.log(`TOTAL QUIZZES IN REMOTE DB: ${count}`);
    const targetUserId = new mongoose.Types.ObjectId("67150d8c98c76cabc58b7160");
    const update = await db.collection("quizzes").updateMany({}, { $set: { ownerID: targetUserId }});
    console.log(`Updated Remote DB: ${update.modifiedCount}`);
    
    mongoose.disconnect();
    process.exit(0);
}
run();
