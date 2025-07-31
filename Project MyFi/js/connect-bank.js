// Bank connection logic here...

// This is for the "Connect Your Bank" flow
import { auth, db } from './auth.js'; 
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Function to connect Google Sheets account to user
async function connectBank() {
    const user = auth.currentUser;
    if (!user) {
        console.error("No user logged in.");
        return;
    }

    // Simulate Google Sheets API connection process
    const googleSheetLink = prompt("Please enter your Google Sheets link:");

    if (googleSheetLink) {
        const userDocRef = doc(db, "players", user.uid);
        await setDoc(userDocRef, { googleSheetLink }, { merge: true });

        alert("Bank account connected successfully!");

        // After successful connection, redirect to the dashboard
        window.location.href = "dashboard.html";
    } else {
        console.log("No Google Sheets link entered. Skipping connection.");
        // Redirect to dashboard if skipped
        window.location.href = "dashboard.html";
    }
}

// Event listener for the "Connect" button
// document.getElementById('connect-btn').addEventListener('click', connectBank);

// Optionally, the user can skip the step
document.getElementById('skip-for-now-btn').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});
