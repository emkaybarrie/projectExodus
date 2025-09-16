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

// === Alias policy (keep this in sync with vitals.js) ===
const MAX_ALIAS_LEN = 16;
const ALIAS_RE = /^[A-Za-z0-9_\-]{3,32}$/;

// Optional helper: show inline info/warning if form has a helper element
function showAliasNotice(msg, type = "warn") {
  // Try common helper selectors; tweak if you have a specific element in your form.
  const el = document.querySelector('#aliasHelp, [data-alias-help], .alias-help');
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
    el.style.color = type === "warn" ? "#ffb4b4" : "#cde8a2";
    // auto-clear after a few seconds so it’s non-blocking
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => { el.textContent = ""; el.style.display = "none"; }, 4500);
  } else {
    // Fallback so user still sees something
    alert(msg);
  }
}

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

// Signup (now calls setAlias)
export async function signupUser(data) {
  try {
    const rawAlias = (data.alias ?? "").toString().trim();
    if (!rawAlias) { showAliasNotice("Alias is required.", "warn"); return; }

    // Normalize to policy
    let aliasSafe = rawAlias.slice(0, MAX_ALIAS_LEN);
    if (!ALIAS_RE.test(aliasSafe)) {
      showAliasNotice("Alias must be 3–32 chars: letters, numbers, _ or -.", "warn");
      return;
    }
    if (rawAlias.length > MAX_ALIAS_LEN) {
      showAliasNotice(`Alias was shortened to ${MAX_ALIAS_LEN} characters.`, "warn");
    }

    // 1) Create auth user
    const { user } = await createUserWithEmailAndPassword(auth, data.email, data.password);

    // 2) Create base player doc (no alias fields here)
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

    // 3) Reserve alias + write alias/aliasLower atomically (handles/* + players/*)
    const setAlias = httpsCallable(fns, "setAlias");
    await setAlias({ alias: aliasSafe });

    // 4) Seed auxiliary docs (unchanged)
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


    // 5) Redirect
    sessionStorage.setItem('showSplashNext', '1');
    sessionStorage.setItem('myfi.welcome.v1.done', '0');
    localStorage.setItem('myfi.welcome.v1.done', '0');
    //window.location.href = "dashboard.html";
    window.location.replace("./onboarding/onboarding.html");
  } catch (error) {
    console.error("Signup error:", error);
    // Map common setAlias errors nicely
    const code = error?.code || "";
    if (code === "already-exists") {
      showAliasNotice("That alias is taken. Try another.", "warn");
      return;
    }
    if (code === "invalid-argument") {
      showAliasNotice("Alias must be 3–32 chars: letters, numbers, _ or -.", "warn");
      return;
    }
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

export { auth, db, fns };
