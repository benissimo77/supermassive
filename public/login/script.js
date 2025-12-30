let isSignupMode = false;
let forgotPasswordMode = false;

// Utility function to handle responses
// This function relies on the fetch API returning a JSON object containing a response.ok property
// status is the code sent by the server (usually 200, 400, 401)
const handleResponse = (response) => {
    return {
        success: response.ok,
        status: response.status
    };
};

// Utility function to display messages
const displayMessage = (message, isError = false) => {
    const messageElement = document.getElementById('message');
    if (messageElement) {
        messageElement.innerHTML = message;
        messageElement.className = isError ? 'message error' : 'message success';
        messageElement.style.display = 'block';
    } else {
        alert(message); // Fallback if message element doesn't exist
    }
};

// Function to toggle between login and signup
// If we are already in forgotpassword mode then we always go back to sign in
const toggleAuthMode = () => {
    if (forgotPasswordMode) {
        forgotPasswordMode = !forgotPasswordMode;
        isSignupMode = false;
    } else {
        isSignupMode = !isSignupMode;
    }
    layoutMode();
};
// Function to set the forgot password mode
const setForgotPasswordMode = () => {
    forgotPasswordMode = true;
    layoutMode();
};

// Function to layout the form based on the mode
const layoutMode = () => {
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const switchMessage = document.getElementById('switchMessage');
    const switchButton = document.getElementById('switchLink');
    const socialButtons = document.getElementById('socialButtons');
    const passwordInput = document.getElementById('password');
    const passwordGroup = passwordInput ? passwordInput.closest('.form-group') : null;

    if (isSignupMode || forgotPasswordMode) {
        formTitle.textContent = isSignupMode ? 'Create an account' : 'Forgotten password?';
        submitButton.textContent = isSignupMode ? 'Sign Up' : 'Send reset email';
        switchButton.textContent = 'Sign In';
        switchMessage.textContent = 'Already have an account?';
        socialButtons.style.display = 'none';
        if (passwordGroup) passwordGroup.style.display = 'none';
    } else {
        formTitle.textContent = 'Sign in to your account';
        submitButton.textContent = 'Sign In';
        switchButton.textContent = 'Sign Up';
        switchMessage.textContent = 'Don\'t have an account?';
        socialButtons.style.display = 'block';
        if (passwordGroup) passwordGroup.style.display = 'block';
    }

    // Clear the message element no matter which mode we are in
    const messageElement = document.getElementById('message');
    if (messageElement) {
        messageElement.textContent = '';
        messageElement.className = 'message';
    }
};


// Function to handle form submission (works regardless of loginMode)
const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const email = formData.get('email');
    const password = formData.get('password');

    // Logic depends on the mode
    if (forgotPasswordMode || isSignupMode) {
        if (!email) {
            displayMessage('Please enter your email address', true);
            return;
        }
    } else {
        if (!email || !password) {
            displayMessage('Please enter both email and password', true);
            return;
        }
    }

    // Determine the endpoint based on the mode (forgot password, signup or login)
    const endpoint = forgotPasswordMode ? '/auth/forgot-password' : (isSignupMode ? '/auth/signup' : '/auth/login');
    console.log('Submitting to:', endpoint, email, password);

    try {
        // OK - this is the fetch API, it's a promise so we need to await it
        const response = await fetch(endpoint, {
            method: "post",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const { success, status } = handleResponse(response);
        console.log('handleSubmit response:', success, status, response);

        if (success) {

            // If forgot-password flow then we need to terminate the flow here...
            if (forgotPasswordMode) {
                terminateForgotPasswordFlow();
            } else {
                // If it's a successful login or registration, redirect to dashboard
                // window.location.href = '/host/dashboard';
                console.log('Redirecting to dashboard');
            }
        } else {
            // Handle different types of errors based on status codes
            switch (status) {
                case 401:
                    displayMessage('Unknown email/password combination', true);
                    break;
                case 409:
                    displayMessage("Email already in our system :(<br>Have you forgotten your password? Try the link below...", true);
                    break;
                case 422:
                    displayMessage('Invalid input. Please check your email and password.', true);
                    break;
                default:
                    displayMessage(data.message || 'An error occurred. Please try again.', true);
            }
        }
    } catch (error) {
        // This catch block will now only handle network errors or JSON parsing errors
        displayMessage('A network error occurred. Please check your connection and try again.', true);
        console.error('Network Error:', error);
    }
};

// And similar for handling of password reset form
const handleReset = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const password = formData.get('password');
    const confirmPassword = formData.get('password-confirm');

    if (!password-confirm || !password) {
        displayMessage('Please enter both password and confirm password', true);
        return;
    }
    if (password !== confirmPassword) {
        displayMessage('Passwords do not match', true);
        return;
    }

    // We need to include the token in the form data
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
        displayMessage('Error - please click the link in the set password email', true);
        return;
    }

    // Determine the endpoint based on the mode (forgot password, signup or login)
    const endpoint = '/auth/reset-password';
    console.log('Submitting to:', endpoint, token, password);

    try {
        // OK - this is the fetch API, it's a promise so we need to await it
        const response = await fetch(endpoint, {
            method: "post",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, password }),
        });

        const { success, status } = handleResponse(response);
        console.log('handleSubmit response:', success, status, response);

        if (success) {
            displayMessage('Password reset successfully. Redirecting to login...', true);
        } else {
            // Handle different types of errors based on status codes
            switch (status) {
                case 400:
                    displayMessage("Hmmm... seems the email link has expired. Hang on, we'll redirect you", true);
                    break;
                case 401:
                    displayMessage("Hmmm... that didn't work :(", true);
                    break;
                case 409:
                    displayMessage("Email already in our system :(<br>Have you forgotten your password? Try the link below...", true);
                    break;
                case 422:
                    displayMessage('Invalid input. Please check your email and password.', true);
                    break;
                default:
                    displayMessage('An error occurred. Please try again.', true);
            }
        }
        setTimeout(() => {
            window.location.href = '/login';
        }, 6000);
    
    } catch (error) {
        // This catch block will now only handle network errors or JSON parsing errors
        displayMessage('A network error occurred. Please check your connection and try again.', true);
        console.error('Network Error:', error);
    }
}

const terminateForgotPasswordFlow = () => {
    // TODO: Implement this
    console.log('terminateForgotPasswordFlow');
    displayMessage('Password reset initiated. Check your email for further instructions.', true);
    // Redirect to login page after 6 seconds
    setTimeout(() => {
        window.location.href = '/login';
    }, 6000);
};

// Function to handle social logins
const handleSocialLogin = (provider) => {
    window.location.href = `/auth/${provider}`;
};

// Add event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('authForm');
    const switchButton = document.getElementById('switchLink');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const googleBtn = document.getElementById('googleLogin');
    const facebookBtn = document.getElementById('facebookLogin');

    if (form) form.addEventListener('submit', handleSubmit);
    if (switchButton) switchButton.addEventListener('click', toggleAuthMode);
    if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', setForgotPasswordMode);

    // Social login buttons
    if (googleBtn) googleBtn.addEventListener('click', () => handleSocialLogin('google'));
    if (facebookBtn) facebookBtn.addEventListener('click', () => handleSocialLogin('facebook'));

    // Password reset
    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
        resetForm.addEventListener('submit', handleReset);
    }

    // We might have a message to display immediately if we arrived here from a redirect
    const messageElement = document.getElementById('message');
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
        switch (error) {
            case 'auth_error':
                displayMessage('An error occurred during authentication. Please try again.', true);
                break;
            case 'auth_failed':
                displayMessage('Authentication failed. Please try again.', true);
                break;
            case 'login_error':
                displayMessage('An error occurred during login. Please try again.', true);
                break;
            case 'profile_error':
                displayMessage('An error occurred processing your profile. Please try again.', true);
                break;
            case 'verification_failed':
                displayMessage("Verification failed - we suggest you follow the 'Forgot Password' link below", true);
                break;
            default:
                displayMessage('An error occurred. Please try again.', true);
        }
    }
});

