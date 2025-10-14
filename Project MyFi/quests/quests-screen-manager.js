// Quests Screen Manager.js

// ───────────────────────────────── Imports ─────────────────────────────────
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs,
  query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc, startAfter
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

import { loadCSS } from "../js/core/utilities.js";


// ───────────────────────────────── CSS ─────────────────────────────────────

(function ensureScreenCss(){
  // Give it an id so it’s easy to spot in DOM; dedupe happens by href anyway.
  // Main
  loadCSS('./quests/modules/questsScreen.css', { id: 'quests-screen-css', preload: true })
    .catch(err => console.warn('[Quests Screen] CSS load failed', err));

})();