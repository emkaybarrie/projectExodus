// js/vitalsTour.js
// Firestore‑first Vitals tour, event‑gated behind Splash & Welcome.

import { startTour } from '../../core/tour.js';
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FS_REF = (uid) => doc(getFirestore(), "players", uid);
const LS_KEY = 'myfi.tour.vitals.v1.done';

function getVitalsTourSteps() {
  return [
    { target: '#vital-health',  title: 'Health',  content: 'Your safety net. Used when other pools run out.' },
    { target: '#vital-mana',    title: 'Mana',    content: 'Represents intentional / power spending.' },
    { target: '#vital-stamina', title: 'Stamina', content: 'Represents day-to-day, general spending.' },
    { target: '#vital-essence', title: 'Essence', content: 'Discretionary energy. Can be used to grow and empower your avatar.' },
    { target: '.update-log',    title: 'Update Log', content: 'Recent pending entries. Long-press to edit before they lock.' },
    { target: '#mode-engrave',  title: 'Daily / Weekly / Monthly', content: 'Swap views — bars rescale; regen rate doesn’t.' },
    { target: '#essence-btn',   title: 'Essence Action', content: 'Trigger essence actions; convert to Credits (coming soon).' },
  ];
}

/* ---------- Visibility guards ---------- */
const OVERLAY_SELECTORS = [
  '#splashRoot', '.splash-root', '.splash', '.splash-backdrop',
  '#welcome-root', '.welcome', '[data-screen="welcome"].screen--active', '#welcomeOverlay'
];

const isVisible = (el) => {
  if (!el) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
  if (el.offsetParent === null && cs.position !== 'fixed') return false;
  return true;
};
const anyOverlayVisible = () => {
  for (const sel of OVERLAY_SELECTORS) {
    const els = document.querySelectorAll(sel);
    for (const el of els) if (isVisible(el)) return true;
  }
  return false;
};
const vitalsScreenActive = () => {
  const el = document.querySelector('#vitals-root.screen.screen--active[data-screen="vitals"]');
  return !!(el && isVisible(el));
};

async function waitUntilVitalsReady({ maxWaitMs = 15000, pollMs = 60 } = {}) {
  if (vitalsScreenActive() && !anyOverlayVisible() && !window.__MYFI_TOUR_SUPPRESS) return;

  let resolved = false;
  const done = () => { if (!resolved) { resolved = true; cleanup(); } };
  const check = () => {
    if (vitalsScreenActive() && !anyOverlayVisible() && !window.__MYFI_TOUR_SUPPRESS) done();
  };

  const onSignal = () => check();
  const cleanup = () => {
    window.removeEventListener('splash:done', onSignal);
    window.removeEventListener('welcome:done', onSignal);
    window.removeEventListener('myfi:navigate', onSignal);
  };

  window.addEventListener('splash:done', onSignal, { once: true });
  window.addEventListener('welcome:done', onSignal, { once: true });
  window.addEventListener('myfi:navigate', onSignal);

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

/* ---------- Public: maybeStartVitalsTour ---------- */
export async function maybeStartVitalsTour(uid, { waitFrames = 1, offlinePolicy = 'fallback-local' } = {}) {
  if (!uid) return;

  // Wait until Vitals is active and neither Splash nor Welcome is up, and not suppressed.
  await waitUntilVitalsReady();

  const overlayUp = anyOverlayVisible();
  const suppressed = !!window.__MYFI_TOUR_SUPPRESS;
  const vitalsActive = vitalsScreenActive();

  // If we’re still blocked (overlay or suppressed or wrong screen), attach a one-shot retry and bail.
  if (!vitalsActive || overlayUp || suppressed) {
    const retry = () => { setTimeout(() => maybeStartVitalsTour(uid).catch(()=>{}), 0); };
    window.addEventListener('welcome:done', retry, { once: true });
    window.addEventListener('splash:done', retry, { once: true });
    window.addEventListener('myfi:navigate', retry, { once: true });
    return;
  }

  // Let DOM settle for placement math
  for (let i = 0; i < waitFrames; i++) {
    await new Promise(r => requestAnimationFrame(r));
  }

  let fsState = 'unknown';
  try { fsState = (await readFsFlag(uid)) ? 'done' : 'not_done'; }
  catch { fsState = 'unknown'; }

  if (fsState === 'done') {
    try { localStorage.setItem(LS_KEY, '1'); } catch {}
    return;
  }

  if (fsState === 'not_done') {
    return runTourAndPersist(uid);
  }

  // FS unknown
  if (offlinePolicy === 'fallback-local') {
    if (localStorage.getItem(LS_KEY)) return; // respect cache if present
    return; // otherwise defer until FS readable
  }
  if (offlinePolicy === 'strict') return;
  if (offlinePolicy === 'run-anyway') return runTourAndPersist(uid, { offlineMode: true });
}

/* ---------- helpers ---------- */
function buildStepsOrNull() {
  const steps = getVitalsTourSteps().filter(s => document.querySelector(s.target));
  return steps.length ? steps : null;
}

function runTourAndPersist(uid, { offlineMode = false } = {}) {
  const steps = buildStepsOrNull();
  if (!steps) return;

  // Block re-entry while the tour is running.
  window.__MYFI_TOUR_SUPPRESS = true;

  startTour(steps, {
    onEnd: async () => {
      try { localStorage.setItem(LS_KEY, '1'); } catch {}
      try { await writeFsFlag(uid, true); } catch {}
      // Release the gate and notify listeners
      window.__MYFI_TOUR_SUPPRESS = false;
      try { window.dispatchEvent(new CustomEvent('tour:vitals:done')); } catch {}
    }
  });
}
