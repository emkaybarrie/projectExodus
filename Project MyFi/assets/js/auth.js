import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { categories, incomeCategory, subCategories } from './config.js';

const firebaseConfig = {
    apiKey: "AIzaSyC-d6H3Fv8QXQLU83R8JiUaA9Td4PLN9RQ",
    authDomain: "myfi-app-7fa78.firebaseapp.com",
    projectId: "myfi-app-7fa78",
    storageBucket: "myfi-app-7fa78.appspot.com", 
    messagingSenderId: "720285758770",
    appId: "1:720285758770:web:ed7d646efac936993b532b",
    measurementId: "G-GDR4RQ25T3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🦸‍♂️ Helper function to get user data from Firestore
const getUserDataFromFirestore = async (uid) => {
    const userDocRef = doc(db, "players", uid);
    try {
        const userDoc = await getDoc(userDocRef);
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error("Error fetching user data:", error.message);
        return null;
    }
};

// 🔐 Login user
export async function loginUser(email, password) {
    console.log('User Attempting to Log In')
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("User signed in:", user);

        const playerData = await getUserDataFromFirestore(user.uid);
        if (playerData) {
            localStorage.setItem("playerData", JSON.stringify(playerData));
            window.location.href = "dashboard.html";  // Redirect after login
        }
    } catch (error) {
        console.error("Login error:", error.message);
        alert("Login failed: " + error.message);
    }
}

// 🆕 Signup user
export async function signUpUser(email, password, alias, firstName, lastName, startBalance) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        //console.log("User signed up:", user);
        const userDocRef = doc(db, "players", user.uid);
        const startDate = new Date();
        await setDoc(userDocRef, {
            startDate: startDate,
            alias: alias || "No Alias",
            email: email,
            firstName: firstName || "",
            lastName: lastName || "",
            startBalance: startBalance || 0,
            currentBalance: startBalance || 0,
            financeSummary: {
                income: 0,
                expensesByCategory: generateInitialExpensesByCategory()
            },
            avatarData: {
                avatarContribution: 0
            },
            monthsSinceStart: 0
        });

        window.location.href = "connect-bank.html"; // Redirect after signup
    } catch (error) {
        console.error("Signup error:", error.message);
        alert("Signup failed: " + error.message);
    }
}

// 🧰 Generate expensesByCategory dynamically (with Discretionary nested)
function generateInitialExpensesByCategory() {
    const initial = {};
    // Mandatory and Supplementary categories
    initial[categories.mandatory] = 0;
    initial[categories.supplementary] = 0;

    // Discretionary nested categories
    initial[categories.discretionary] = {};
    subCategories[categories.discretionary].forEach(subcategory => {
        initial[categories.discretionary][subcategory] = 0;
    });

    return initial;
}

// 🚪 Logout user
export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout error:", error.message);
    }
}

export { auth, db };
