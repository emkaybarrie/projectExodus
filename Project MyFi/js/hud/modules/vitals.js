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
    // Load income config
    const dailyAverages = await getDoc(doc(db, `players/${uid}/cashflowData/dailyAverages`));
    const poolAllocations = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));

    if (!dailyAverages.exists() || !poolAllocations.exists()) {
      console.warn("Missing dailyAverages or poolAllocations");
      return;
    }

    const { dIncome, dCoreExpenses } = dailyAverages.data();
    const { healthAllocation, manaAllocation, staminaAllocation, essenceAllocation } = poolAllocations.data();
    const autoProtectEnabled = true;
    const dailyDisposable = (dIncome - dCoreExpenses)

    // Calculate regenBaseline
    const regenBaseline = {
      health: dailyDisposable * healthAllocation, //poolSplit.health,
      mana: dailyDisposable * manaAllocation,//poolSplit.mana,
      stamina: dailyDisposable * staminaAllocation,//poolSplit.stamina
      essence: dailyDisposable * essenceAllocation//poolSplit.stamina
    };

    // Load classifiedTransactions (assumes collection of docs)
    const txnsSnap = await getDoc(doc(db, `players/${uid}/classifiedTransactions/summary`));
    const usage7Day = { health: 0, mana: 0, stamina: 0 , essence: 0 };
    if (txnsSnap.exists()) {
      const { recentUsage } = txnsSnap.data();
      usage7Day.health = recentUsage?.health || 0;
      usage7Day.mana = recentUsage?.mana || 0;
      usage7Day.stamina = recentUsage?.stamina || 0;
      usage7Day.essence = recentUsage?.essence || 0;
    }

    // Trend & Regen Adjustments
    const calculateRegen = (baseline, usage) => {
      if (usage > baseline * 1.1) return [baseline * 0.95, "overspending"];
      if (usage < baseline * 0.8) return [baseline * 1.05, "underspending"];
      return [baseline, "on target"];
    };

    const pools = {};
    for (const pool of ["health", "mana", "stamina", "essence"]) {
      const [regenCurrent, trend] = calculateRegen(regenBaseline[pool], usage7Day[pool]);
      pools[pool] = {
        current: regenCurrent, // Init assumption — will sync actual later
        regenBaseline: Number(regenBaseline[pool].toFixed(2)),
        regenCurrent: Number(regenCurrent.toFixed(2)),
        max: Number(regenBaseline[pool].toFixed(2)),
        usage7Day: Number(usage7Day[pool].toFixed(2)),
        trend
      };
    }

    // Load bank balance snapshot (TrueLayer)
    const balanceSnap = await getDoc(doc(db, `players/${uid}/financialData_TRUELAYER/accounts`));
    const availableBalance = balanceSnap.exists() ? (balanceSnap.data().available || 0) : 0;
    const totalCurrent = Object.values(pools).reduce((sum, p) => sum + p.current, 0);
    const mismatch = availableBalance < totalCurrent * 0.9;

    if (mismatch && autoProtectEnabled) {
      for (const pool of Object.keys(pools)) {
        pools[pool].regenCurrent = Number((pools[pool].regenCurrent * 0.75).toFixed(2));
      }
    }

    console.log("→ Daily Averages", { dIncome, dCoreExpenses });
    console.log("→ Pool Allocations", { healthAllocation, manaAllocation, staminaAllocation, essenceAllocation });
    console.log("→ Regen Baseline", regenBaseline);
    console.log("→ Usage (last 7d)", usage7Day);
    console.log("→ Calculated Pools", pools);
    console.log("→ Available Bank Balance", availableBalance);
    console.log("→ Total Current (Pools)", totalCurrent);
    console.log("→ Balance Mismatch", mismatch);


    await setDoc(doc(db, `players/${uid}/cashflowData/current`), {
      pools,
      dailyAverages: { dailyDisposable: Number(dailyDisposable.toFixed(2)) },
      balanceSnapshot: Number(availableBalance.toFixed(2)),
      mismatch,
      lastSync: new Date().toISOString()
    });

    console.log("Vitals updated.");
  } catch (err) {
    console.error("Failed to update vitals pools:", err);
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

  for (const [pool, values] of Object.entries(pools)) {
    const el = elements[pool];
    if (!el) continue;

    const pct = Math.min((values.current / values.max) * 100, 100);
    el.fill.style.width = `${pct}%`;
    el.value.innerText = `${values.current.toFixed(0) * 100} / ${values.max.toFixed(0) * 100}${values.trend ? ` • ${values.trend}` : ''}`;
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
  console.log("Initializing Vitals HUD with pools:", pools);
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
      el.value.innerText = `${state[pool].current.toFixed(0)} / ${state[pool].max.toFixed(0)}`;
    }
  }

  updateDisplay();
  setInterval(updateDisplay, 1000);
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


