// Form submission and switch functionality
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('auth-form');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const switchButton = document.getElementById('switchButton');
    const switchMessage = document.getElementById('switchMessage');

    let isLoginMode = true;

    const switchMode = () => {
        isLoginMode = !isLoginMode;
        formTitle.textContent = isLoginMode ? 'Sign in to your account' : 'Create your account';
        submitButton.textContent = isLoginMode ? 'Sign in' : 'Sign up';
        switchMessage.textContent = isLoginMode ? 'Don\'t have an account?' : 'Already have an account?';
        switchButton.textContent = isLoginMode ? 'Sign up' : 'Sign in';
    };

    switchButton.addEventListener('click', switchMode);

    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default submission

        const email = form.querySelector('input[type="email"]').value;
        const password = form.querySelector('input[type="password"]').value;

        console.log('Form data:', { email, password });

        const endpoint = isLoginMode ? '/auth/local' : '/auth/signup';
        console.log('Submitting to:', endpoint);

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => console.log('Success:', data))
        .catch(error => console.error('Error:', error));
    });
});
