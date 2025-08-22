import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Helper
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

// Login
export async function loginUser(email, password) {
  console.log('User Attempting to Log In');
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const playerData = await getUserDataFromFirestore(user.uid);
    if (playerData) {
      localStorage.setItem("playerData", JSON.stringify(playerData));
      sessionStorage.setItem('showSplashNext', '1');
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error("Login error:", error.message);
    alert("Login failed: " + error.message);
  }
}

// Signup
export async function signupUser(data) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;

    // Get current date/time in local timezone
    const now = new Date();

    // Reset time to 00:00:00.000
    now.setHours(0, 0, 0, 0);

    await setDoc(doc(db, "players", user.uid), {
      startDate: serverTimestamp(),
      alias: data.alias || "No Alias",
      email: data.email,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      level: Number(1),
      vitalsMode: 'accelerated'
    });

    await setDoc(doc(db, `players/${user.uid}/cashflowData/dailyAverages`), {
      dCoreExpenses: Number(0),
      dIncome: Number(0)
    });

    await setDoc(doc(db, `players/${user.uid}/cashflowData/poolAllocations`), {
      essenceAllocation: Number(0.1),
      healthAllocation: Number(0.1),
      manaAllocation: Number(0.3),
      staminaAllocation: Number(0.5),
    });

    await setDoc(doc(db, `players/${user.uid}/classifiedTransactions/summary`), {
      recentUsage: { essence: 0, health: 0, mana: 0, stamina: 0 },
      historicUsage: { essence: 0, health: 0, mana: 0, stamina: 0 },
    });

    sessionStorage.setItem('showSplashNext', '1');
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Signup error:", error.message);
    alert("Signup failed: " + error.message);
  }
}

// Logout
export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = "auth.html";
  } catch (error) {
    console.error("Logout error:", error.message);
  }
}

export { auth, db };
