// src/core/firebase.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged,
  setPersistence,
  browserLocalPersistence, } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

/**
 * You can inject config via <script> that sets window.__FIREBASE_CONFIG,
 * or hard-code your config here. This avoids bundling secrets.
 */
const cfg = window.__FIREBASE_CONFIG || {
  apiKey: "AIzaSyC-d6H3Fv8QXQLU83R8JiUaA9Td4PLN9RQ",
  authDomain: "myfi-app-7fa78.firebaseapp.com",
  projectId: "myfi-app-7fa78",
  storageBucket: "myfi-app-7fa78.appspot.com",
  messagingSenderId: "720285758770",
  appId: "1:720285758770:web:ed7d646efac936993b532b",
  measurementId: "G-GDR4RQ25T3"
};

// Singleton
const app = getApps().length ? getApp() : initializeApp(cfg);

// Export typed handles — import these everywhere else.
export const firebaseApp = app;
export const auth       = getAuth(app);
// make persistence explicit (one-time)
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const db         = getFirestore(app);
// If you use a region for CFs, pass it: getFunctions(app, "europe-west2")
export const functions  = getFunctions(app, "europe-west2");

// Promise that resolves when we *know* the current user (or null)
export function waitForAuthUser() {
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (user) => {
      off();
      resolve(user || null);
    });
  });
}
