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
    {
      target: '#vital-health',
      title: 'Health',
      content:
        'Represents your core vitality — the last line of defense. If other resources run dry, your Health will be sacrificed. Protect it above all else.'
    },
    {
      target: '#vital-mana',
      title: 'Mana',
      content:
        'Represents your intentional, focused energy. Linked to planned or power spending — high-impact actions you choose deliberately.'
    },
    {
      target: '#vital-stamina',
      title: 'Stamina',
      content:
        'Represents your everyday energy. Linked to routine, flexible spending that regenerates steadily over time. Balance it wisely to avoid draining more vital reserves.'
    },
    {
      target: '#mode-engrave',
      title: 'Context Mode',
      content:
        '"Current" is your main view — aligned to your longer cycles of energy, closely reflecting the rhythm of real life. It shows the broader arc of how your strength has been managed. Switch to "Focus" for just today or this week, giving you a sharper sense of your immediate flow. Use these views to guide real choices, and to shape how your avatar’s story unfolds.'
    },
    {
      target: '.bar-surplus',
      title: 'Stored Energy',
      content:
        'Represents the reserve built beyond your daily needs, shown as extra days of strength (e.g. +3). This surplus can be drawn upon when you need it in the real world, or preserved to empower your avatar within The Badlands and beyond.'
    },
    {
      target: '#vitals-total',
      title: 'Total Energy',
      content:
        'Shows the sum of all your available energy across Health, Mana, Stamina, and Essence within the current view — whether the broader arc of your long cycle or the focused window of today or this week.'
    },
    {
      target: '.skills-row',
      title: 'Skills',
      content:
        'Your avatar’s active and passive abilities. Some skills automate tagging of actions, others provide bonuses or effects — both in-game and in the real world.'
    },
    {
      target: '.update-log',
      title: 'Events Log - Active',
      content:
        'Add and track events that will soon affect your avatar. Tap, or long-press to edit before they lock in. Once confirmed, they become part of your story.'
    },
    {
      target: '.recently-locked',
      title: 'Events Log - Recent',
      content:
        'Confirmed events that have shaped your avatar. Once here, the consequences are permanent — adapt and press forward.'
    },
    {
      target: '#vital-essence',
      title: 'Essence',
      content:
        'Represents your long-term growth energy. Used to customise and empower your avatar, unlock cosmetics, or invest in progression.'
    },
    {
      target: '#essence-btn',
      title: 'Essence Menu',
      content:
        'Spend Essence to unlock bonuses, special resources, and [Credits] — all fueling your avatar’s growth and influence.'
    },
    {
      target: '#left-btn',
      title: 'Energy Menu',
      content:
        "⚡ Set the values that determine power your avatar's very being  — watch it shape the foundations of their vitals. Can connect to your bank for full automation and unlock the full game experience"
    },
    {
      target: '#right-btn',
      title: 'Social Menu',
      content:
        '👥 Connect with friends, band together to take on The Badlands, and invite others to join the fight.'
    },
    {
      target: '.myfi-nav-btn',
      title: 'Navigation',
      content:
        'From the central hub, swipe or tap the screen edges to explore. Head left to track Quests, right to manage your Avatar, up to access tools and partners, or down to venture into The Badlands.'
    }
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
