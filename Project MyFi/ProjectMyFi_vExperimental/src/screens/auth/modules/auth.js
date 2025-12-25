
import { getFeature } from '../../../features/registry.js';
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

import { firebaseApp as app, auth, db, functions as fns } from '../../../core/firestore.js';

import { navigate } from '../../../core/router.js';


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

// ---- Login ----
export async function loginUser(email, password, { variant = 'stable' } = {}) {
  const { user } = await getFeature('auth').api.signInEmail(email, password)
  const playerData = await getUserDataFromFirestore(user.uid);

  if (!playerData) {
    // Up to you: throw or return a shape indicating missing profile.
    throw new Error("No player profile found.");
  }

  await setDoc(doc(db, "players", user.uid), { lastLoginAt: serverTimestamp() }, { merge: true });

  // Persist bits the UI may want
  try {
    localStorage.setItem("playerData", JSON.stringify(playerData));
    localStorage.setItem("lastBuildVariant", variant);
    sessionStorage.setItem("showSplashNext", "1");
  } catch {}

  // Return data; let the screen decide routing.
  return { user, playerData, variant };
}


// ---- Signup ----
export async function signupUser(data) {
  const { user } = await getFeature('auth').api.signUpEmail(email, password);

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

  await setDoc(doc(db, `players/${user.uid}/financialData/cashflowData`), { 
    poolAllocations: {
      essenceAllocation: 0.1,
      healthAllocation: 0.1,
      manaAllocation: 0.3,
      staminaAllocation: 0.5,
    }
  }, { merge: true });

  // New structure examples
  await setDoc(doc(db, "players", user.uid, "coreData", "userData"), {
    registrationDate: serverTimestamp(),
    email: data.email,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
  }, { merge: true });

  await setDoc(doc(db, "players", user.uid, "coreData", "playerData"), {
    alias: "unknown",
    level: 1,
    vitalsMode: 'standard',
    lastLoginAt: serverTimestamp(),
    onboarding: { welcomeDone: false }
  }, { merge: true });

  // Return the user; caller will decide next route.
  return { user };
}

// Logout (unchanged)
export async function logoutUser() {
  console.log('Signing Out...')
  try {
    await getFeature('auth').api.logout();
    //window.location.href = "start.html";
  } catch (error) {
    console.error("Logout error:", error.message);
  }
}
