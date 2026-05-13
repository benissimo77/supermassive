import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

async function updateAdmin() {
    let port = process.env.MONGO_PORT;
    
    // Auto-detect port if not provided
    if (!port) {
        const lockFile = path.resolve('./.local_mongo_db/mongod.lock');
        if (fs.existsSync(lockFile)) {
            const pid = fs.readFileSync(lockFile, 'utf8').trim();
            try {
                const netstatOut = execSync(`netstat -ano`).toString();
                const match = netstatOut.split('\n').find(l => l.includes('LISTENING') && l.includes(pid));
                if (match) {
                    port = match.trim().split(/\s+/)[1].split(':')[1];
                }
            } catch (e) {
                console.warn('Could not detect port from lockfile, trying default 27017');
            }
        }
    }
    if (!port) port = '27017';

    const uri = `mongodb://127.0.0.1:${port}/test`;
    const email = 'ben.silburn@gmail.com';

    console.log(`Connecting to ${uri}...`);
    try {
        await mongoose.connect(uri);
        const User = mongoose.connection.collection('users');
        
        const result = await User.updateOne(
            { email: email },
            { $set: { role: 'admin' } }
        );

        if (result.matchedCount > 0) {
            console.log(`Successfully updated ${email} to admin.`);
        } else {
            console.log(`User ${email} not found in database.`);
            const allUsers = await User.find({}, { projection: { email: 1 } }).toArray();
            console.log('Available emails:', allUsers.map(u => u.email));
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

updateAdmin();
