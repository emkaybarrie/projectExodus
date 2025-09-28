// /js/energy-menu.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// We import the two openers. If your files live in a different folder, adjust the paths.
import { openEnergyVerified }   from "./smartReview.js";
import { openEnergyUnverified } from "./energy-unverified.js";

function normalizeMode(val) {
  // supports: true | "true" | "verified" | "unverified" | false | null
  if (val === true) return "verified";
  const s = String(val || "").toLowerCase().trim();
  if (s === "true" || s === "verified") return "verified";
  return "unverified";
}

export async function openEnergyMenu() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    console.warn("[EnergyMenu] No user logged in.");
    return;
  }
  const uid = user.uid;

  const db = getFirestore();
  let mode = "unverified";
  try {
    const snap = await getDoc(doc(db, "players", uid));
    mode = normalizeMode(snap.exists() ? snap.data()?.mode : null);
  } catch (e) {
    console.warn("[EnergyMenu] Could not read players/{uid}.vitalsMode; defaulting to unverified.", e);
  }

  // Avoid opening two overlays if one is already present
  if (document.getElementById("srOverlay") || document.getElementById("energyUnverifiedOverlay")) {
    console.log("[EnergyMenu] Overlay already open; ignoring.");
    return;
  }

  if (mode === "verified") {
    return openEnergyVerified(uid);     // Smart Review overlay
  } else {
    return openEnergyUnverified(uid);   // Manual entry + Connect-to-bank
  }
}

// Optional helpers if you want to call them directly elsewhere:
export async function openEnergyVerifiedMenu()   { return openEnergyVerified(getAuth().currentUser?.uid); }
export async function openEnergyUnverifiedMenu() { return openEnergyUnverified(getAuth().currentUser?.uid); }
