// /js/energy-menu.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// We import the two openers. If your files live in a different folder, adjust the paths.
import { openEnergyVerified }   from "./energy-verified.js";
import { openEnergyUnverified } from "./energy-unverified.js";

function normalizeMode(val) {
  // supports: true | "true" | "verified" | "unverified" | false | null
  if (val === true) return "verified";
  const s = String(val || "").toLowerCase().trim();
  if (s === "true" || s === "verified") return "verified";
  return "unverified";
}

// ────────────────────────────────────────────────────────────────────────────
// CSS scoping helper: confines menu CSS to its overlay root without changing
// visual appearance. It leaves @keyframes blocks untouched.
// rootId = "srOverlay" (verified) or "emOverlay" (unverified).
export function scopeCSS(rawCss, rootId) {
  const root = `#${rootId}`;

  // Pull out @keyframes temporarily so we don't mangle "from/to/0%" selectors.
  const stash = [];
  const cssNoKf = rawCss.replace(/@keyframes[\s\S]*?\}\s*\}/g, (m) => {
    const token = `__KF_${stash.length}__`;
    stash.push(m);
    return token;
  });

  // Localize global tokens to the overlay only.
  let scoped = cssNoKf
    .replace(/\:root\b/g, root)                   // variables live on the overlay
    .replace(/\bhtml\s*,\s*body\b/g, root);       // global resets → overlay only

  // Prefix every non-@ rule with the overlay, but don't double-prefix rules that
  // already start with the overlay id.
  scoped = ('}' + scoped).replace(/\}\s*([^@{}][^{]*)\{/g, (_, sel) => {
    const parts = sel.split(',').map(s => s.trim()).filter(Boolean).map(s => {
      if (s.startsWith(root)) return s;          // already scoped
      return `${root} ${s}`;
    });
    return `}${parts.join(', ')}{`;
  }).slice(1); // remove the leading brace we added

  // Put the keyframes back exactly as they were.
  stash.forEach((block, i) => { scoped = scoped.replace(`__KF_${i}__`, block); });

  return scoped;
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
    mode = normalizeMode(snap.exists() ? snap.data()?.transactionMode : null);
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
