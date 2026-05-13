import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import mongoose from 'mongoose';

async function listUsers() {
    let port = process.env.MONGO_PORT;
    if (!port) {
        const lockFile = path.resolve('./.local_mongo_db/mongod.lock');
        if (!fs.existsSync(lockFile)) {
            console.error('Lock file not found. Ensure the server is running with a local DB.');
            process.exit(1);
        }
        const pid = fs.readFileSync(lockFile, 'utf8').trim();
        try {
            const netstatOut = execSync(`netstat -ano`).toString();
            const lines = netstatOut.split('\n');
            const match = lines.find(l => l.includes('LISTENING') && l.trim().endsWith(pid));
            if (!match) throw new Error('No LISTENING port found for PID ' + pid);
            port = match.trim().split(/\s+/)[1].split(':')[1];
        } catch (e) {
            console.error('Could not auto-detect port:', e.message);
            process.exit(1);
        }
    }

    const uri = `mongodb://127.0.0.1:${port}/supermassive`;
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);

    const db = mongoose.connection;
    const users = await db.collection('users').find({}, { projection: { email: 1, displayname: 1, role: 1 } }).limit(10).toArray();
    
    console.log('--- User List (First 10) ---');
    console.table(users);
    
    await mongoose.disconnect();
}

listUsers().catch(console.error);
