// js/vitalsTour.js
// Firestore-first Vitals tour (FS authoritative; LS is a non-authoritative cache)

import { startTour } from '../../core/tour.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FS_REF = (uid) => doc(getFirestore(), "players", uid);
const LS_KEY = 'myfi.tour.vitals.v1.done'; // cache only (not authoritative)

/* ---------- Step anchors (match your Vitals DOM) ---------- */
function getVitalsTourSteps() {
  return [
    { target: '#vital-health',  title: 'Health',  content: 'Your safety net. Used when other pools run out.' },
    { target: '#vital-mana',    title: 'Mana',    content: 'Intentional / fixed spending. Can be amplified with credit.' },
    { target: '#vital-stamina', title: 'Stamina', content: 'Day-to-day flexible spending. Regenerates regularly.' },
    { target: '#vital-essence', title: 'Essence', content: 'Discretionary energy. Soon convertible into Credits.' },
    { target: '.update-log',    title: 'Update Log', content: 'Recent pending entries. Long-press to edit before they lock.' },
    { target: '#mode-engrave',  title: 'Daily / Weekly / Monthly', content: 'Swap views — bars rescale; regen rate doesn’t.' },
    { target: '#essence-btn',   title: 'Essence Action', content: 'Trigger essence actions; convert to Credits (coming soon).' },
  ];
}

/* ---------- Splash/Welcome → Vitals readiness guard ---------- */
// Treat Vitals as "ready" only when (a) it's the active screen, and (b) no splash/welcome overlay is visible.
const OVERLAY_SELECTORS = [
  '#splashRoot', '.splash-root', '.splash', '.splash-backdrop',
  '.start-overlay', '.intro-overlay', '.pulse-overlay',
  '#welcome-root', '.welcome', '[data-screen="welcome"].screen--active', '#welcomeOverlay'
];

function isVisible(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
  if (el.offsetParent === null && cs.position !== 'fixed') return false;
  return true;
}

function anyOverlayVisible() {
  for (const sel of OVERLAY_SELECTORS) {
    const els = document.querySelectorAll(sel);
    for (const el of els) if (isVisible(el)) return true;
  }
  return false;
}

function vitalsScreenActive() {
  const el = document.querySelector('#vitals-root.screen.screen--active[data-screen="vitals"]');
  return !!(el && isVisible(el));
}

async function waitUntilVitalsReady({ maxWaitMs = 15000, pollMs = 50 } = {}) {
  if (vitalsScreenActive() && !anyOverlayVisible()) return;

  let resolved = false;
  const done = () => { if (!resolved) { resolved = true; cleanup(); } };
  const onSignal = () => check();

  function check() {
    if (vitalsScreenActive() && !anyOverlayVisible()) done();
  }
  function cleanup() {
    window.removeEventListener('myfi:splash:done', onSignal);
    window.removeEventListener('splash:done', onSignal);
    window.removeEventListener('myfi:route:screen', onSignal);
  }

  // React to explicit app signals if you emit them
  window.addEventListener('myfi:splash:done', onSignal, { once: true });
  window.addEventListener('splash:done', onSignal, { once: true }); // your app emits this
  window.addEventListener('myfi:route:screen', onSignal);

  const start = performance.now();
  while (!resolved && (performance.now() - start) < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollMs));
    check();
  }
  cleanup();
}

/* ---------- FS helpers ---------- */
async function readFsFlag(uid) {
  const snap = await getDoc(FS_REF(uid));
  if (!snap.exists()) return false;
  return !!(snap.data()?.tutorialFlags?.vitalsTour?.v1Done);
}
async function writeFsFlag(uid, value = true) {
  await setDoc(FS_REF(uid), {
    tutorialFlags: { vitalsTour: { v1Done: !!value, lastRunAtMs: Date.now() } }
  }, { merge: true });
}

/**
 * Firestore-first gating.
 * - Waits until Vitals is active and overlays are gone.
 * - Reads FS: if done -> skip (and seed LS cache).
 * - If FS says not done -> run the tour, then set FS + LS.
 * - If FS is unreachable, policy controls behavior:
 *    offlinePolicy = 'fallback-local' (default): if LS cache says done -> skip; else do NOT run.
 *    offlinePolicy = 'strict': never run without FS; always skip until FS readable.
 *    offlinePolicy = 'run-anyway': run even if FS is unknown; still set LS, and try FS onEnd.
 */
export async function maybeStartVitalsTour(
  uid,
  { waitFrames = 1, offlinePolicy = 'fallback-local' } = {}
) {
  if (!uid) return; // FS authoritative → we need the player id

  // Ensure Vitals is fully visible and splash/welcome overlays are gone
  await waitUntilVitalsReady();

  if (!document.querySelector('#vitals-root.screen.screen--active[data-screen="vitals"]') ||
     document.querySelector('#welcomeOverlay, #splashRoot, .splash, .splash-backdrop, .start-overlay, .intro-overlay, .pulse-overlay, #welcome-root, .welcome, [data-screen="welcome"].screen--active')) {
   return; // still not safe to show the tour
  }

  // Give the DOM a tick to settle bar layouts
  for (let i = 0; i < waitFrames; i++) {
    await new Promise(r => requestAnimationFrame(r));
  }

  let fsState = 'unknown'; // 'done' | 'not_done' | 'unknown'
  try {
    fsState = (await readFsFlag(uid)) ? 'done' : 'not_done';
  } catch { fsState = 'unknown'; }

  // FS says done → seed LS cache and bail
  if (fsState === 'done') {
    try { localStorage.setItem(LS_KEY, '1'); } catch {}
    return;
  }

  // FS says not done → proceed to run
  if (fsState === 'not_done') {
    return runTourAndPersist(uid);
  }

  // FS unknown (offline/error): decide per policy
  if (offlinePolicy === 'fallback-local') {
    // If LS cache says done, skip; else *don’t* run (respect FS authority)
    if (localStorage.getItem(LS_KEY)) return;
    return; // skip until FS is readable
  }
  if (offlinePolicy === 'strict') {
    return; // never run without FS verdict
  }
  if (offlinePolicy === 'run-anyway') {
    return runTourAndPersist(uid, { offlineMode: true });
  }
}

/* ---------- Helpers ---------- */
function buildStepsOrNull() {
  const steps = getVitalsTourSteps().filter(s => document.querySelector(s.target));
  return steps.length ? steps : null;
}

function runTourAndPersist(uid, { offlineMode = false } = {}) {
  const steps = buildStepsOrNull();
  if (!steps) return;
  startTour(steps, {
    onEnd: async () => {
      // Always seed LS cache for speed/offline UX
      try { localStorage.setItem(LS_KEY, '1'); } catch {}
      // If we’re online (or later when available), mark FS authoritative flag
      if (!offlineMode && uid) {
        try { await writeFsFlag(uid, true); } catch {}
      } else if (uid) {
        // Best-effort attempt even in offlineMode (in case network came back)
        try { await writeFsFlag(uid, true); } catch {}
      }
    }
  });
}

/** Force-run now (ignores gating). Still attempts FS write + seeds LS. */
export function startVitalsTourNow(uid) {
  const steps = buildStepsOrNull();
  if (!steps) return;
  startTour(steps, {
    onEnd: async () => {
      try { localStorage.setItem(LS_KEY, '1'); } catch {}
      if (uid) { try { await writeFsFlag(uid, true); } catch {} }
    }
  });
}

/** Dev helper: clear both flags, so next FS-authoritative check will run the tour. */
export async function clearVitalsTourFlags(uid) {
  try { localStorage.removeItem(LS_KEY); } catch {}
  if (uid) {
    try {
      await updateDoc(FS_REF(uid), { "tutorialFlags.vitalsTour.v1Done": false });
    } catch {
      // If the doc doesn't exist yet, that's fine—no flag equals "not done".
    }
  }
}
