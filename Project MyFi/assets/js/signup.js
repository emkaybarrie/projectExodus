import { signUpUser } from './auth.js';  // Import signUpUser directly


document.getElementById('signup-form-element').addEventListener('submit', async (event) => {
    event.preventDefault();  // Prevent form submit reload

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const alias = document.getElementById('alias').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const startBalanceInput = document.getElementById('startBalance').value.trim();

    if (!email || !password || !alias || !firstName || !lastName || !startBalanceInput) {
        alert("Please fill in all fields.");
        return;
    }

    const startBalance = parseFloat(startBalanceInput);
    if (isNaN(startBalance)) {
        alert("Please enter a valid number for Start Balance.");
        return;
    }

    await signUpUser(email, password, alias, firstName, lastName, startBalance);
});
