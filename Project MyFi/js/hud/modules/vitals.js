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

export async function initVitalsHUD(uid) {
  const db = getFirestore();
  const ref = doc(db, `players/${uid}/cashflowState/current`);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.warn("No vitals data found.");
    return;
  }

  const { pools, lastSync } = snap.data();
  const hud = document.getElementById("vitals-hud");

  if (!hud || !pools) return;

  const display = {
    health: document.getElementById("pool-health"),
    mana: document.getElementById("pool-mana"),
    stamina: document.getElementById("pool-stamina")
  };

  const state = {
    health: { ...pools.health },
    mana: { ...pools.mana },
    stamina: { ...pools.stamina }
  };

  const regenRatePerSecond = {};
  const regenIntervalMs = 1000; // Every second

  for (const pool of ["health", "mana", "stamina"]) {
    regenRatePerSecond[pool] = state[pool].regenCurrent / (24 * 60 * 60); // Regen over 24h
  }

  function updateDisplay() {
    for (const pool of ["health", "mana", "stamina"]) {
      state[pool].current = Math.min(
        state[pool].current + regenRatePerSecond[pool],
        state[pool].max
      );

      display[pool].innerText = `${pool.toUpperCase()}: ${state[pool].current.toFixed(2)} / ${state[pool].max}`;
    }
  }

  updateDisplay(); // Init
  setInterval(updateDisplay, regenIntervalMs);
}
