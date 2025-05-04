// services/emailService.js
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();


const emailConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
}

const transporter = nodemailer.createTransport(emailConfig);

// Read and compile the email template
// fs reads from the top-level directory
const emailTemplateSource = fs.readFileSync('server/services/emailTemplate.html', 'utf8');
const emailTemplate = handlebars.compile(emailTemplateSource);

const EmailService = {

  sendMail(mailOptions) {
    console.log('emailService: sendMail :', mailOptions);
    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Error:', error);
          reject(error);
        } else {
          console.log('Email sent:', info.response);
          resolve(info);
        }
      });
    });
  },

  // Welcome email sent to new users in order to verify their account
  sendVerificationEmail(to, token) {
    const verificationLink = `${process.env.SERVER_URL}/auth/verify?token=${token}`;
    const htmlContent = emailTemplate({
      emailSubject: 'Verify Your Account',
      appName: 'VideoSwipe',
      emailHeading: 'Welcome! Please Verify Your Email',
      emailBody: 'Thank you for signing up. Please click the button below to verify your email address.',
      actionUrl: verificationLink,
      actionText: 'Verify Email',
      currentYear: new Date().getFullYear()
    });

    return this.sendMail({
      from: 'hello@videoswipe.net',
      to,
      subject: 'Verify Your Account',
      html: htmlContent
    });
  },

  // Password reset email sent to users in order to reset their password
  // NOTE: this must do similar to above page (collect a new password) but messages are different (new v change)
  sendPasswordResetEmail(to, token) {
    console.log('emailService: sendPasswordResetEmail :', to, token);
    const resetLink = `${process.env.SERVER_URL}/login/resetpassword.html?token=${token}`;
    const htmlContent = emailTemplate({
      emailSubject: 'Reset Your Password',
      appName: 'VideoSwipe',
      emailHeading: 'Password Reset Request',
      emailBody: 'You requested a password reset. Click the button below to choose a new password.',
      actionUrl: resetLink,
      actionText: 'Reset Password',
      currentYear: new Date().getFullYear()
    });

    const result = this.sendMail({
      from: 'hello@videoswipe.net',
      to,
      subject: 'Reset Your Password',
      html: htmlContent
    });
    console.log('emailService: sendPasswordResetEmail result:', result);
    return result;
  }
}
export default EmailService;
