import crypto from 'crypto';
import userService from './userService.js';
import emailService from './emailService.js';

class AuthService {

  generateToken() {
    return crypto.randomBytes(20).toString('hex');
  }

  async initiateNewUserSignUp(email, password) {
    const result = await userService.signUpNewUser(email, password);
    if (!result.success) return result;
    
    const emailResult = await this.sendVerificationEmail(result.user);
    return { ...emailResult, status: emailResult.success ? 201 : 500, user: result.user };
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

  async sendVerificationEmail(user) {
    if (!user || user.emailVerified) return { success: false, message: 'Invalid user or already verified' };

    const token = this.generateToken();
    await userService.storeTokenWithUser(user._id, token);
    
    try {
      await emailService.sendVerificationEmail(user.email, token);
      return { success: true };
    } catch (error) {
      console.error('Verification email failed:', error);
      return { success: false, message: 'Failed to send email' };
    }
  }

  // Add other auth-related methods as needed

}


export default new AuthService();
