const crypto = require('crypto');
const userService = require('./userService');
const emailService = require('./emailService');

class AuthService {

  generateToken() {
    return crypto.randomBytes(20).toString('hex');
  }

  async initiateNewUserSignUp(email) {
    const verificationToken = this.generateToken();
    const result = await userService.signUpNewUser(email, verificationToken);
    if (!result.success) {
      return result;
    }
    try {
      await emailService.sendVerificationEmail(email, verificationToken);
      return { success: true, status: 201, user: result.user };

    } catch (error) {
      console.error('Error sending verification email:', error);
      return { success: false, status: 500 };
    }
  }

  async initiatePasswordReset(email) {
    console.log('authService: initiatePasswordReset :', email);
    const user = await userService.findUserByEmail(email);
    if (user) {
      console.log('authService: initiatePasswordReset user:', user);
      const resetToken = this.generateToken();
      await userService.storeTokenWithUser(user.id, resetToken);
      const result = await emailService.sendPasswordResetEmail(user.email, resetToken);
      console.log('authService: initiatePasswordReset result:', result);
    }
    // this function does not return anything - assumed that any errors will be caught in the calling function
  }

  // Add other auth-related methods as needed

}

module.exports = new AuthService();
