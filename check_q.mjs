import { MongoClient } from "mongodb";

async function run() {
    const client = new MongoClient("mongodb+srv://bensilburn:kPHOzuUNDhr8H5oY@supermassive-cluster.pfb1c.mongodb.net/supermassive");
    try {
        await client.connect();
        const db = client.db("supermassive");
        const count = await db.collection("questions").countDocuments();
        console.log("TOTAL ORPHANED V2 QUESTIONS:", count);
        
        if (count > 0) {
            const latest = await db.collection("questions").find().limit(2).toArray();
            console.log("\n--- EXAMPLES ---");
            console.log(JSON.stringify(latest, null, 2));
        }
    } catch(e) {
        console.error(e.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}
run();
