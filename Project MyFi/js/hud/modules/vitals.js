// vitals.js
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function updateVitalsPools(uid) {
  const db = getFirestore();

  try {
    const dailyAveragesSnap = await getDoc(doc(db, `players/${uid}/cashflowData/dailyAverages`));
    const poolAllocationsSnap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));

    if (!dailyAveragesSnap.exists() || !poolAllocationsSnap.exists()) {
      console.warn("Missing dailyAverages or poolAllocations");
      return;
    }

    const { dIncome, dCoreExpenses } = dailyAveragesSnap.data();
    const { healthAllocation, manaAllocation, staminaAllocation, essenceAllocation } = poolAllocationsSnap.data();
    const dailyDisposable = dIncome - dCoreExpenses;
    const autoProtectEnabled = true;

    const regenBaseline = {
      health: dailyDisposable * healthAllocation,
      mana: dailyDisposable * manaAllocation,
      stamina: dailyDisposable * staminaAllocation,
      essence: dailyDisposable * essenceAllocation
    };

    // Load 7-day and all-time usage
    const txnsSnap = await getDoc(doc(db, `players/${uid}/classifiedTransactions/summary`));
    const usage7Day = { health: 0, mana: 0, stamina: 0, essence: 0 };
    const usageAllTime = { health: 0, mana: 0, stamina: 0, essence: 0 };

    if (txnsSnap.exists()) {
      const { recentUsage = {}, historicUsage = {} } = txnsSnap.data();
      for (const pool of ["health", "mana", "stamina", "essence"]) {
        usage7Day[pool] = recentUsage[pool] || 0;
        usageAllTime[pool] = historicUsage[pool] || 0;
      }
    }

    // Calculate trend-based regen
    const calculateRegen = (baseline, usage) => {
      if (usage > baseline * 1.15) return [baseline * 0.95, "overspending"];
      if (usage < baseline * 0.8) return [baseline * 1.05, "underspending"];
      return [baseline, "on target"];
    };

    const vitalsStartDate = new Date("2025-08-01T00:00:00Z");
    const daysTracked = Math.max(1, Math.floor((new Date() - vitalsStartDate) / (1000 * 60 * 60 * 24)));

    const pools = {};
    let totalCurrent = 0;

    for (const pool of ["health", "mana", "stamina", "essence"]) {
      const [regenCurrent, trend] = calculateRegen(regenBaseline[pool], usage7Day[pool]);
      const regenTotal = regenCurrent * daysTracked;
      const spent = usageAllTime[pool];
      const current = Math.max(0, Math.min(regenTotal - spent, regenBaseline[pool]));

      totalCurrent += current;

      pools[pool] = {
        regenBaseline: Number(regenBaseline[pool].toFixed(2)),
        regenCurrent: Number(regenCurrent.toFixed(2)),
        usage7Day: Number(usage7Day[pool].toFixed(2)),
        trend,
        spentToDate: Number(spent.toFixed(2))
      };
    }

    // Load bank balance snapshot
    const balanceSnap = await getDoc(doc(db, `players/${uid}/financialData_TRUELAYER/accounts`));
    const availableBalance = balanceSnap.exists() ? (balanceSnap.data().available || 0) : 0;
    const mismatch = availableBalance < totalCurrent * 0.9;

    if (mismatch && autoProtectEnabled) {
      for (const pool of Object.keys(pools)) {
        pools[pool].regenCurrent = Number((pools[pool].regenCurrent * 0.75).toFixed(2));
      }
    }

    await setDoc(doc(db, `players/${uid}/cashflowData/current`), {
      pools,
      dailyAverages: { dailyDisposable: Number(dailyDisposable.toFixed(2)) },
      balanceSnapshot: Number(availableBalance.toFixed(2)),
      mismatch,
      daysTracked,
      lastSync: new Date().toISOString()
    });

    console.log("✔ Vitals updated successfully.");
  } catch (err) {
    console.error("❌ Failed to update vitals pools:", err);
  }
}


// 🟢 One-time loader (for immediate population)
export async function loadVitalsToHUD(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;
  console.log("Loaded Vitals Pools:", pools);
  const elements = getVitalsElements();

  const vitalsStartDate = new Date("2025-08-01T00:00:00Z"); // hardcoded tracking start
  const now = new Date();
  const daysTracked = Math.max(1, Math.floor((now - vitalsStartDate) / (1000 * 60 * 60 * 24)));
  console.log("Days tracked since start:", daysTracked);

  for (const [pool, values] of Object.entries(pools)) {
    const el = elements[pool];
    if (!el) continue;

    const regen = values.regenCurrent ?? 0;
    const spent = values.spentToDate ?? 0;
    const max = values.regenBaseline ?? 0;

    // NOTE: daily max system → pools can't exceed `max` (baseline)
    const potentialCurrent = (regen * daysTracked) - spent;
    const current = Math.max(0, Math.min(potentialCurrent, max));

    const pct = Math.min((current / max) * 100, 100);
    el.fill.style.width = `${pct}%`;
    el.value.innerText = `${current.toFixed(2)} / ${max.toFixed(2)}${values.trend ? ` • ${values.trend}` : ''}`;
  }
}

// 🌀 Optional: Animated Regen Mode
// export async function initVitalsHUD(uid, timeMultiplier = 60) {
//   const db = getFirestore();
//   const ref = doc(db, `players/${uid}/cashflowData/current`);
//   const snap = await getDoc(ref);
//   if (!snap.exists()) {
//     console.warn("No vitals data found.");
//     return;
//   }

//   const vitalsStartDate = new Date("2025-08-01T00:00:00Z");
//   const now = new Date();
//   const daysTracked = Math.max(1, Math.floor((now - vitalsStartDate) / (1000 * 60 * 60 * 24)));

//   const pools = snap.data().pools;
//   console.log("Initializing Vitals HUD with pools:", pools);
//   const elements = getVitalsElements();
  
//   const state = {};
//   const regenPerSec = {};
//   const multiplier = timeMultiplier;
//   const secondsPerDay = 86400;

//   for (const pool of Object.keys(elements)) {
//     if (!pools[pool]) continue;
//     const values = pools[pool];
//     const regen = values.regenCurrent ?? 0;
//     const spent = values.spentToDate ?? 0;
//     const max = values.regenBaseline ?? 0;

//     const baseCurrent = (regen * daysTracked) - spent;
//     const current = Math.max(0, Math.min(baseCurrent, max));

//      state[pool] = {
//       current,
//       max,
//       regenPerSec: (regen * multiplier) / secondsPerDay,
//     };
//   }

//   function updateDisplay() {
//     for (const pool of Object.keys(elements)) {
//       const el = elements[pool];
//       const data = state[pool];
//       if (!el || !data) continue;

//       data.current = Math.min(data.current + data.regenPerSec, data.max);
//       const pct = (data.current / data.max) * 100;

//       el.fill.style.width = `${pct}%`;
//       el.value.innerText = `${data.current.toFixed(2)} / ${data.max.toFixed(2)}`;
//     }
//   }

//   updateDisplay();
//   setInterval(updateDisplay, 1000);
// }

export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const vitalsStartDate = new Date("2025-08-01T00:00:00Z");
  const now = new Date();
  const daysTracked = Math.max(1, Math.floor((now - vitalsStartDate) / (1000 * 60 * 60 * 24)));

  const pools = snap.data().pools;
  const elements = getVitalsElements();

  const state = {};
  const regenPerSec = {};
  const targetPct = {};
  const displayPct = {};
  const secondsPerDay = 86400;

  for (const pool of Object.keys(pools)) {
    const data = pools[pool];
    const regen = data.regenCurrent ?? 0;
    const spent = data.spentToDate ?? 0;
    const max = data.regenBaseline ?? 0;

    const regenTotal = regen * daysTracked;
    const current = Math.max(0, Math.min(regenTotal - spent, max));

    state[pool] = { current, max };
    regenPerSec[pool] = (regen * timeMultiplier) / secondsPerDay;
    displayPct[pool] = (current / max) * 100;
    targetPct[pool] = displayPct[pool]; // initialized same
  }

  // Smooth animation update loop

  let lastTimestamp = null;

  function animateBars(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaSeconds = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    for (const pool of Object.keys(state)) {
      const el = elements[pool];
      // Apply trend class
      const barContainer = el.fill.closest('.bar');
      barContainer.classList.remove("overspending", "underspending");

      const trend = pools[pool].trend;
      if (trend === "overspending") {
        barContainer.classList.add("overspending");
      } else if (trend === "underspending") {
        barContainer.classList.add("underspending");
      }
      const data = state[pool];
      if (!el || !data) continue;

      // Accurate regen per delta time
      data.current = Math.min(data.current + regenPerSec[pool] * deltaSeconds, data.max);
      const newTargetPct = (data.current / data.max) * 100;
      targetPct[pool] = newTargetPct;

      // Smooth bar fill animation
      displayPct[pool] += (targetPct[pool] - displayPct[pool]) * 0.05;

      el.fill.style.width = `${displayPct[pool].toFixed(1)}%`;
      el.value.innerText = `${data.current.toFixed(2)} / ${data.max.toFixed(2)}`;
    }

    requestAnimationFrame(animateBars);
  }

  requestAnimationFrame(animateBars);
}


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


