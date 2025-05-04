// db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoDbURI = process.env.MONGODB_URI;
let db;

async function dbConnect() {
    if (!db) {
        try {
            await mongoose.connect(mongoDbURI);
            db = mongoose.connection;
        } catch (error) {
            console.error('Failed to connect to MongoDB', error);
            throw error;
        }
    }
    return db;
}

module.exports = { dbConnect, mongoose };
