// vitals.js
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ✅ Updated helper for new DOM structure
function getVitalsElements() {
  const pools = ["health", "mana", "stamina", "essence"];
  const elements = {};

  for (const pool of pools) {
    const barFill = document.querySelector(`#vital-${pool} .bar-fill`);
    const barValue = document.querySelector(`#vital-${pool} .bar-value`);
    const label = document.querySelector(`#vital-${pool} .bar-label`);
    if (barFill && barValue && label) {
      elements[pool] = {
        fill: barFill,
        value: barValue,
        label: label
      };
    }
  }

  return elements;
}

// 🟢 One-time loader (for immediate population)
export async function loadVitalsToHUD(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;
  const elements = getVitalsElements();

  for (const [pool, values] of Object.entries(pools)) {
    const el = elements[pool];
    if (!el) continue;

    const pct = Math.min((values.current / values.max) * 100, 100);
    el.fill.style.width = `${pct}%`;
    el.value.innerText = `${values.current.toFixed(1)} / ${values.max.toFixed(1)}${values.trend ? ` • ${values.trend}` : ''}`;
  }
}

// 🌀 Optional: Animated Regen Mode
export async function initVitalsHUD(uid, timeMultiplier = 60) {
  const db = getFirestore();
  const ref = doc(db, `players/${uid}/cashflowData/current`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.warn("No vitals data found.");
    return;
  }

  const pools = snap.data().pools;
  const elements = getVitalsElements();
  const state = {};
  const regenPerSec = {};
  const multiplier = timeMultiplier;
  const secondsPerDay = 86400;

  for (const pool of Object.keys(elements)) {
    if (!pools[pool]) continue;
    state[pool] = { ...pools[pool] };
    regenPerSec[pool] = (pools[pool].regenCurrent * multiplier) / secondsPerDay;
  }

  function updateDisplay() {
    for (const pool of Object.keys(elements)) {
      const el = elements[pool];
      if (!el || !state[pool]) continue;

      state[pool].current = Math.min(state[pool].current + regenPerSec[pool], state[pool].max);
      const pct = (state[pool].current / state[pool].max) * 100;
      el.fill.style.width = `${pct}%`;
      el.value.innerText = `${state[pool].current.toFixed(2)} / ${state[pool].max}`;
    }
  }

  updateDisplay();
  setInterval(updateDisplay, 1000);
}
