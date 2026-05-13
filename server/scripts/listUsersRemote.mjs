import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function listUsers() {
    const mongoDbURI = process.env.MONGODB_URI;
    if (!mongoDbURI) {
        console.error('MONGODB_URI not found in .env');
        process.exit(1);
    }

    console.log('Connecting to remote MongoDB...');
    await mongoose.connect(mongoDbURI);

    const db = mongoose.connection;
    const users = await db.collection('users').find({}, { projection: { email: 1, displayname: 1, role: 1 } }).limit(10).toArray();
    
    console.log('--- User List (First 10) ---');
    console.table(users);
    
    await mongoose.disconnect();
}

listUsers().catch(console.error);
