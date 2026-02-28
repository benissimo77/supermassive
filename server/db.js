// db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const mongoDbURI = process.env.MONGODB_URI;
let db;
let mongod;

async function dbConnect() {
    if (!db) {
        try {
            // Shorten timeout to 3 seconds so we don't hang if IP is not whitelisted or offline
            await mongoose.connect(mongoDbURI, { serverSelectionTimeoutMS: 3000 });
            db = mongoose.connection;
            console.log('MongoDB connection established (Remote)');
        } catch (error) {
            // On production, we should NOT fall back to local DB as it implies something is wrong with the connection
            if (process.env.NODE_ENV === 'production') {
                console.error('CRITICAL: Remote MongoDB unavailable on production server.');
                throw error;
            }

            console.warn('\x1b[33m%s\x1b[0m', '!!! REMOTE DB UNAVAILABLE: Starting local fallback DB... !!!');
            
            try {
                // Persistent path for the local DB
                const dbPath = path.resolve('./.local_mongo_db');
                if (!fs.existsSync(dbPath)) {
                    fs.mkdirSync(dbPath, { recursive: true });
                }

                // Dynamically import local DB server only when needed (so production doesn't need the dependency)
                const { MongoMemoryServer } = await import('mongodb-memory-server');

                mongod = await MongoMemoryServer.create({
                    instance: {
                        dbPath: dbPath,
                        storageEngine: 'wiredTiger', // Required for persistence
                        dbName: 'supermassive'
                    }
                });

                const localUri = mongod.getUri();
                await mongoose.connect(localUri);
                db = mongoose.connection;
                console.log('MongoDB Local Fallback established at:', dbPath);
            } catch (localError) {
                console.error('Failed to start local fallback DB:', localError.message);
                db = mongoose.connection; 
            }
        }
    }
    return db;
}

const isDBConnected = () => mongoose.connection.readyState === 1;

export { dbConnect, mongoose, isDBConnected };
