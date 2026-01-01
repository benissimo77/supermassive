// services/userService.js
import UserModel from '../models/mongo.user.js';

class UserService {
  constructor() {
    this.userModel = UserModel;
    this.userCache = new Map();
  }

  async findUserByEmail(email) {
    console.log('userService: findUserByEmail :', email);
    return this.userModel.findOne({ email });
  }

  // As far as I can tell this is not used.... wrong, used when user attempts to login
  async findUserById(id) {
    const now = Date.now();
    const cached = this.userCache.get(id.toString());
    if (cached && (now - cached.timestamp < 5000)) {
      // return cached.user;
    }

    console.log('userService: findUserById (DB hit) :', id);
    const user = await this.userModel.findById(id);
    this.userCache.set(id.toString(), { user, timestamp: now });
    return user;
  }

  async findUserByToken(token) {
    console.log('userService: findUserByPasswordResetToken :', token);
    const user = await this.userModel.findOne({ token: token });
    if (user && user.tokenExpiry && user.tokenExpiry > Date.now()) {
      return user;
    }
    return null;
  }


  async signUpNewUser(email, verificationToken) {
    console.log('userService: signUpUser :', email);
    try {
      const user = await this.userModel.create({ email, token: verificationToken, tokenExpiry: new Date(Date.now() + 24 * 360 * 1000) });
      return { success: true, user: user };
    } catch (error) {
      console.error('Error signing up new user:', error);
      if (error.code === 11000) {
        return { success: false, status: 409 };
      }
      return { success: false, status: 500 };
    }
  }

  // Function takes a user object returned from Facebook or Google and adds it to the relevant user document
  async addProfileData(profileData) {
    console.log('userService: addProfileData :', profileData);

    let email = null;
    let avatar = null;
    let displayName = null;

    // Check if we have an email
    if (profileData.emails && profileData.emails[0] && profileData.emails[0].value) {
      email = profileData.emails[0].value;
    }
    if (profileData.displayName) {
      displayName = profileData.displayName;
    }
    if (profileData.photos && profileData.photos[0] && profileData.photos[0].value) {
      avatar = profileData.photos[0].value;
    }

    if (email) {
      const user = await this.findUserByEmail(email);
      if (user) {

        // User already exists in database, update this user with the profile data
        const fieldsToUpdate = {
          displayname: profileData.displayName,
          avatar: avatar,
        }
        fieldsToUpdate[user.provider + 'profile'] = profileData;
        return this.userModel.findByIdAndUpdate(user.id, fieldsToUpdate);
      }
      // User does not exist, create a new user
      const newUser = {
        email: email,
        displayname: displayName,
        avatar: avatar
      }
      newUser[user.provider + 'profile'] = profileData;
      return this.userModel.create({ ...newUser });
    }
  }

  // As far as I can tell this is not used.... wrong, used when user attempts to login
  async authenticateUser(email, password) {
    console.log('userService: authenticateUser :', email, password);
    try {
      const user = await this.findUserByEmail(email);
      console.log('userService: authenticateUser :', user);
      if (user && await user.verifyPassword(password)) {
        return user;
      }
      return false;
    } catch (error) {
      console.log('authService: authenticateUser catch:', error);
      return false;
    }
  }

  async verifyUserEmail(verificationToken) {
    const user = await this.findUserByToken(verificationToken);
    if (user) {
      return this.userModel.findByIdAndUpdate(user.id, { emailVerified: true });
    }
    return false;
  }

  async storeTokenWithUser(userID, token) {
    console.log('userService: storeTokenWithUser :', userID, token);
    const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    return this.userModel.findByIdAndUpdate(userID, { token: token, tokenExpiry: tokenExpiry });
  }

  async verifyPassword(user, suppliedPassword) {
    if (!user || !user.password) {
      return false;
    }
    try {
      // Compare the supplied password with the stored hash
      return await user.validatePassword(suppliedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  // Function called by /reset-password route to update user's password
  async resetPassword(token, newPassword) {
    console.log('userService: resetPassword :', token, newPassword);
    const user = await this.findUserByToken(token);
    if (user) {
      const hashedPassword = user.generateHashedPassword(newPassword);
      return this.userModel.findByIdAndUpdate(user.id, { password: hashedPassword, token: null, tokenExpiry: null });
    }
    return false;
  }

  async clearUserToken(userID) {
    console.log('userService: clearUserToken :', userID);
    return this.userModel.findByIdAndUpdate(userID, { token: null, tokenExpiry: null });
  }
}

export default new UserService();