// db.js
const mongoose = require('mongoose');
const uri = 'mongodb+srv://bensilburn:kPHOzuUNDhr8H5oY@supermassive-cluster.pfb1c.mongodb.net/?retryWrites=true&w=majority&appName=supermassive-cluster';
let db;

async function dbConnect() {
    if (!db) {
        try {
            await mongoose.connect(uri);
            db = mongoose.connection;
        } catch (error) {
            console.error('Failed to connect to MongoDB', error);
            throw error;
        }
    }
    return db;
}

module.exports = { dbConnect, mongoose };
