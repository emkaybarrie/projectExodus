import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

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
// NEW (bind to your region)
const fns  = getFunctions(app, "europe-west2");

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

// Login (unchanged)
export async function loginUser(email, password) {
  console.log('User Attempting to Log In');
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const playerData = await getUserDataFromFirestore(user.uid);
    if (playerData) {
      await setDoc(doc(db, "players", user.uid), { lastLoginAt: serverTimestamp() }, { merge: true });
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

    // 1) Create auth user
    const { user } = await createUserWithEmailAndPassword(auth, data.email, data.password);

    // 2) Create base player doc
    await setDoc(doc(db, "players", user.uid), {
      startDate: serverTimestamp(),
      email: data.email,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      level: Number(1),
      vitalsMode: 'standard',
      lastLoginAt: serverTimestamp(),
      onboarding: { welcomeDone: false }
    }, { merge: true });

    // 3) Seed auxiliary docs (unchanged)
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
      recentUsage:  { essence: 0, health: 0, mana: 0, stamina: 0 },
      historicUsage:{ essence: 0, health: 0, mana: 0, stamina: 0 },
    });

    // Capture Invite code if present (non-blocking)
    try {
      const params = new URL(window.location.href).searchParams;
      const invite = (params.get('invite') || params.get('ref') || '').trim();
      if (invite) {
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
        const fn = httpsCallable(getFunctions(app, 'europe-west2'), 'captureInviteOnSignup');
        await fn({ inviteCode: invite });
        // optional: show a quick toast
        // alert('Invite captured, thanks!');
      }
    } catch (e) {
      console.warn('[Signup] captureInviteOnSignup failed:', e);
      // non-fatal; user continues
    }


    // 4) Redirect
    sessionStorage.setItem('showSplashNext', '1');
    sessionStorage.setItem('myfi.welcome.v1.done', '0');
    localStorage.setItem('myfi.welcome.v1.done', '0');
    window.location.replace("./onboarding/onboarding.html");
  } catch (error) {
    console.error("Signup error:", error);
    alert("Signup failed: " + (error?.message || "Unknown error"));
  }
}

// Logout (unchanged)
export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = "start.html";
  } catch (error) {
    console.error("Logout error:", error.message);
  }
}

window.auth = auth;

export {app, auth, db, fns };
