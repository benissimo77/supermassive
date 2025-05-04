import mongoose from "mongoose";
import bcrypt from "bcrypt";

// userSchema
// username is optional, but email and password are required
// email must be unique but it is NOT required because we use it for logging in with Facebook or Google and user might have prevented sharing
// avatar is optional, but if provided must be a valid URL to an image
// We try to get avatar from Facebook or Google if available
// Other facebook/google data is stored in the user's profile as json for analysis later
const userSchema = mongoose.Schema({
    registrationDate: { type: Date, default: Date.now },
    email: { type: 'string', unique: true },
    password: { type: 'string' },
    displayname: { type: 'string' },
    avatar: { type: 'string' },

    googleprofile: { type: 'object' },
    facebookprofile: { type: 'object' },

    token: { type: 'string', default: null },
    tokenExpiry: { type: 'date', default: null },
    emailVerified: { type: Boolean, default: false }
});

// hash the password
userSchema.methods.generateHashedPassword = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
};

// checking if password is valid
// Note: its possible for a user to not yet have a password, so check for this before running the bcrypt compare
userSchema.methods.verifyPassword = function (password) {
    if (this.password) {
        return bcrypt.compareSync(password, this.password);
    }
    return false;
};

// Export model
export default mongoose.model('User', userSchema);

