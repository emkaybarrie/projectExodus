// vitals.js
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

    const { dIncome, dCoreExpenses, dContributionsTarget } = dailyAverages.data();
    const { healthAllocation, manaAllocation, staminaAllocation } = poolAllocations.data();
    const autoProtectEnabled = true;
    const daysInMonth = 30;
    const dailyDisposable = (dIncome - dCoreExpenses - dContributionsTarget) // / daysInMonth;

    // Calculate regenBaseline
    const regenBaseline = {
      health: dailyDisposable * healthAllocation, //poolSplit.health,
      mana: dailyDisposable * manaAllocation,//poolSplit.mana,
      stamina: dailyDisposable * staminaAllocation//poolSplit.stamina
    };

    // Load classifiedTransactions (assumes collection of docs)
    const txnsSnap = await getDoc(doc(db, `players/${uid}/classifiedTransactions/summary`));
    const usage7Day = { health: 0, mana: 0, stamina: 0 };
    if (txnsSnap.exists()) {
      const { recentUsage } = txnsSnap.data();
      usage7Day.health = recentUsage?.health || 0;
      usage7Day.mana = recentUsage?.mana || 0;
      usage7Day.stamina = recentUsage?.stamina || 0;
    }

    // Trend & Regen Adjustments
    const calculateRegen = (baseline, usage) => {
      if (usage > baseline * 1.1) return [baseline * 0.95, "overspending"];
      if (usage < baseline * 0.8) return [baseline * 1.05, "underspending"];
      return [baseline, "on target"];
    };

    const pools = {};
    for (const pool of ["health", "mana", "stamina"]) {
      const [regenCurrent, trend] = calculateRegen(regenBaseline[pool], usage7Day[pool]);
      pools[pool] = {
        current: regenCurrent * 0.25, // Init assumption — will sync actual later
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

    console.log("→ Daily Averages", { dIncome, dCoreExpenses, dContributionsTarget });
    console.log("→ Pool Allocations", { healthAllocation, manaAllocation, staminaAllocation });
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

export async function initVitalsHUD(uid, timeMultiplier = 60) {
  const db = getFirestore();
  const ref = doc(db, `players/${uid}/cashflowData/current`);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.warn("No vitals data found.");
    return;
  }

  const { pools } = snap.data();
  const elements = {
    health: {
      fill: document.querySelector("#vital-health .bar-fill"),
      label: document.querySelector("#vital-health .bar-label")
    },
    mana: {
      fill: document.querySelector("#vital-mana .bar-fill"),
      label: document.querySelector("#vital-mana .bar-label")
    },
    stamina: {
      fill: document.querySelector("#vital-stamina .bar-fill"),
      label: document.querySelector("#vital-stamina .bar-label")
    }
  };

  const state = {
    health: { ...pools.health },
    mana: { ...pools.mana },
    stamina: { ...pools.stamina }
  };

  const regenPerSec = {};
  const frameRate = 1000; // 1 second update
  const secondsPerDay = 86400;
  const multiplier = timeMultiplier;

  for (const pool of ["health", "mana", "stamina"]) {
    regenPerSec[pool] = (state[pool].regenCurrent * multiplier) / secondsPerDay;
  }

  function updateDisplay() {
    for (const pool of ["health", "mana", "stamina"]) {
      state[pool].current = Math.min(state[pool].current + regenPerSec[pool], state[pool].max);
      const pct = (state[pool].current / state[pool].max) * 100;
      elements[pool].fill.style.width = `${pct}%`;
      elements[pool].label.innerText = `${state[pool].current.toFixed(2)} / ${state[pool].max}`;
    }
  }

  updateDisplay(); // Initial render
  setInterval(updateDisplay, frameRate);
}

export async function loadVitalsToHUD(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;

  for (const [pool, values] of Object.entries(pools)) {
    const bar = document.querySelector(`#vital-${pool} .bar-fill`);
    const label = document.querySelector(`#vital-${pool} .bar-label`);
    if (!bar || !label) continue;

    const pct = Math.min((values.current / values.max) * 100, 100);
    bar.style.width = `${pct}%`;
    label.innerText = `${values.current.toFixed(1)} / ${values.max.toFixed(1)} • ${values.trend}`;
  }
}
