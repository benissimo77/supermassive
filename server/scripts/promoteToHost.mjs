/**
 * One-off script: promote a local-DB user from 'guest' to 'host'.
 * Connects directly to the already-running mongod that was started by the server.
 *
 * Usage: node server/scripts/promoteToHost.mjs [port]
 * If port is omitted, finds it automatically from .local_mongo_db/mongod.lock + netstat.
 *
 * Safe to run repeatedly (idempotent).
 * Run from the project root: node server/scripts/promoteToHost.mjs
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import mongoose from 'mongoose';

// --- Resolve the port of the already-running mongod ---
let port = process.argv[2];
if (!port) {
    const lockFile = path.resolve('./.local_mongo_db/mongod.lock');
    if (!fs.existsSync(lockFile)) {
        console.error('Lock file not found at', lockFile);
        console.error('Make sure the server is running with the local DB before using this script.');
        process.exit(1);
    }
    const pid = fs.readFileSync(lockFile, 'utf8').trim();
    console.log('Found mongod PID:', pid);

    try {
        const netstatOut = execSync(`netstat -ano`).toString();
        const lines = netstatOut.split('\n');
        const match = lines.find(l => l.includes('LISTENING') && l.trim().endsWith(pid));
        if (!match) throw new Error('No LISTENING port found for PID ' + pid);
        // e.g. "  TCP    127.0.0.1:54734  0.0.0.0:0  LISTENING  26908"
        port = match.trim().split(/\s+/)[1].split(':')[1];
    } catch (e) {
        console.error('Could not auto-detect port:', e.message);
        console.error('Try: node server/scripts/promoteToHost.mjs <port>');
        process.exit(1);
    }
}

const uri = `mongodb://127.0.0.1:${port}/supermassive`;
console.log('Connecting to:', uri);
await mongoose.connect(uri);

const db = mongoose.connection;

// --- DRY RUN: list all users first ---
const users = await db.collection('users').find({}, { projection: { email: 1, displayname: 1, emailVerified: 1, role: 1 } }).toArray();

if (users.length === 0) {
    // Dump all collection names to help diagnose
    const cols = await db.db.listCollections().toArray();
    console.log('Collections in DB:', cols.map(c => c.name));
    console.log('No users found. Log in via the app first, then re-run this script.');
    await mongoose.disconnect();
    process.exit(0);
}

console.log('\nUsers found:');
users.forEach(u => {
    console.log(`  [${u._id}] email=${u.email ?? '(none)'}  displayname=${u.displayname ?? '(none)'}  emailVerified=${u.emailVerified}  role=${u.role}`);
});

// --- Apply update ---
const result = await db.collection('users').updateMany(
    {},
    { $set: { emailVerified: true, role: 'host' } }
);

console.log(`\nUpdated ${result.modifiedCount} user(s) -> emailVerified: true, role: 'host'`);

await mongoose.disconnect();
console.log('Done. Log out and back in (or refresh the session) and you will have host access.');
