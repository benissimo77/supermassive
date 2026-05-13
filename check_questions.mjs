import mongoose from "mongoose";

async function run() {
    try {
        await mongoose.connect("mongodb+srv://bensilburn:kPHOzuUNDhr8H5oY@supermassive-cluster.pfb1c.mongodb.net/supermassive?retryWrites=true&w=majority");
        const db = mongoose.connection;
        
        const collections = await db.db.listCollections().toArray();
        console.log("Collections in DB:", collections.map(c => c.name).join(", "));

        const questionsCount = await db.collection("questions").countDocuments({});
        console.log(`\n=> TOTAL QUESTIONS IN REMOTE DB: ${questionsCount}`);
        
        if (questionsCount > 0) {
            const sample = await db.collection("questions").find({}).limit(2).toArray();
            console.log("\nSample Question Data:");
            console.log(JSON.stringify(sample, null, 2));
        }
        
        mongoose.disconnect();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
