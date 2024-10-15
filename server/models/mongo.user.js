const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = mongoose.Schema({
    username: { type: 'string' },
    email: { type: 'string', required: true, unique: true },
    password: { type: 'string', required: true },
    registrationDate: { type: Date, default: Date.now }
})

// hash the password
userSchema.methods.generateHash = function(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
};

// checking if password is valid
userSchema.methods.validatePassword = function(password) {
    const [salt, hash] = this.password.split(':');
    console.log('User model:', password, salt, hash);
    const hashToCompare = crypto.scryptSync(password, salt, 64).toString('hex');
    return hash === hashToCompare;
};

// Export model
module.exports = mongoose.model('User', userSchema)
