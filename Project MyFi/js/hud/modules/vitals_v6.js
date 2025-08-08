// vitals.js
import {
  getFirestore,
  doc,
  getDoc,
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs
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
        //pools[pool].regenCurrent = Number((pools[pool].regenCurrent * 0.75).toFixed(2));
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


function normalizeTxn(docSnap) {
  const d = docSnap.data();
  const amount = Number(d?.transactionData?.amount ?? 0);

  return {
    id: docSnap.id,
    amount, // assume negative = spend, positive = income; if not, adapt here
    dateMs: d?.transactionData?.entryDate?.toMillis?.() ?? Date.parse(d?.transactionData?.entryDate),
    status: d?.assignmentData?.status || "pending",
    ghostExpiryMs: d?.assignmentData?.assignmentDeadline?.toMillis?.() ?? Date.parse(d?.assignmentData?.assignmentDeadline),
    finalPool: d?.assignmentData?.finalPool || null,
    tag: {
      pool: d?.assignmentData?.tag?.pool || null,       // "mana" | "stamina" | "income" | "contribution" | null
      taggedAtMs: d?.assignmentData?.tag?.taggedAt?.toMillis?.() ?? null,
      source: d?.assignmentData?.tag?.source || null,   // "auto" | "manual"
      overridden: !!d?.assignmentData?.tag?.overridden,
      confidence: d?.assignmentData?.tag?.confidence ?? null,
    }
  };
}

function intendedPool(tx) {
  // MVP: if tagged, use that; otherwise default stamina-first
  return tx.tag?.pool || "stamina";
}

function computeGhostImpact({ pendingTxns, staminaRemaining }) {
  console.log("Computing ghost impact for pending transactions:", pendingTxns);
  const impact = { stamina: 0, mana: 0, health: 0 };

  let remaining = Math.max(0, staminaRemaining);

  // preview in chronological order (stable & fair)
  pendingTxns.sort((a,b) => a.dateMs - b.dateMs);

  for (const tx of pendingTxns) {
    console.log(`Processing ghost txn ${tx.id} for ${tx.amount} (current stamina remaining: ${remaining})`);
    if (tx.amount >= 0) continue; // income/contribution not part of ghost "damage"
    const spend = -tx.amount; // positive

    const intent = intendedPool(tx);
    if (intent === "mana") {
      impact.mana += spend;
      continue;
    }

    // stamina-first preview with overflow to health
    const toStamina = Math.min(spend, remaining);
    const toHealth  = spend - toStamina;

    impact.stamina += toStamina;
    impact.health  += toHealth;

    remaining -= toStamina;
  }

  return impact; // amounts to subtract from current (remaining)
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

// 🌀 Animated Regen Mode

// === initVitalsHUD with multi-pool ghost expiry fix ===
export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1) LOAD BASE DATA
  // ─────────────────────────────────────────────────────────────────────────────
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const vitalsStartDate = new Date("2025-08-01T00:00:00Z");
  const now = new Date();
  const daysTracked = Math.max(1, Math.floor((now - vitalsStartDate) / (1000 * 60 * 60 * 24)));

  const pools = snap.data().pools;
  const elements = getVitalsElements();
  ensureReclaimLayers(elements);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) STATE
  // ─────────────────────────────────────────────────────────────────────────────
  const state = {};
  const regenPerSec = {};
  const displayPct = {};

  const ghostImpact = { stamina: 0, mana: 0, health: 0 };
  const pendingLossBase = {};
  const pendingLossDisplay = {};
  const regenEaten = {};

  const revealTriggered = {};
  const revealTimers = {};

  // Ghost expiry watch list: { pool, amount, expiry }
  let ghostWatchList = [];

  const secondsPerDay = 86400;
  const REVEAL_DELAY_MS = 600;
  const TINY_MARGIN = 0.1;

  // ─────────────────────────────────────────────────────────────────────────────
  // 3) INIT FROM POOLS (committed)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const pool of Object.keys(pools)) {
    const data = pools[pool];
    const regen = data.regenCurrent ?? 0;
    const spent = data.spentToDate ?? 0;
    const max = data.regenBaseline ?? 0;

    const regenTotal = regen * daysTracked;
    const current = Math.max(0, Math.min(regenTotal - spent, max));

    state[pool] = { current, max };
    regenPerSec[pool] = (regen * timeMultiplier) / secondsPerDay;
    displayPct[pool] = max > 0 ? (current / max) * 100 : 0;

    pendingLossBase[pool] = 0;
    pendingLossDisplay[pool] = 0;
    regenEaten[pool] = 0;
    revealTriggered[pool] = false;
    revealTimers[pool] = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4) LOAD PENDING TX + COMPUTE GHOST IMPACT
  // ─────────────────────────────────────────────────────────────────────────────
  const q = query(collection(db, `players/${uid}/classifiedTransactions`));
  const qs = await getDocs(q);
  const allTx = qs.docs.map(normalizeTxn);

  const nowMs = Date.now();
  const pending = allTx.filter(tx => tx.status === "pending" && nowMs < tx.ghostExpiryMs);

  const staminaRemaining = Math.max(0, state.stamina?.current ?? 0);

  const impact = computeGhostImpact({ pendingTxns: pending, staminaRemaining });
  ghostImpact.stamina = impact.stamina;
  ghostImpact.mana = impact.mana;
  ghostImpact.health = impact.health;

  // Store ghost amounts
  for (const pool of Object.keys(state)) {
    pendingLossBase[pool] = Math.max(0, ghostImpact[pool] || 0);
  }

  // Build ghost watch list — include overflow pools
  ghostWatchList = [];
  pending.forEach(tx => {
    const basePool = tx.pool || determinePoolFromTx(tx);
    const amount = Math.abs(tx.amount);
    const expiry = tx.ghostExpiryMs;

    // Always push the original intended pool
    ghostWatchList.push({ pool: basePool, amount, expiry });

    // Now check if there’s overflow into another pool
    // We detect overflow by comparing ghostImpact for each pool vs zero
    for (const pool of Object.keys(ghostImpact)) {
      if (pool !== basePool && ghostImpact[pool] > 0) {
        ghostWatchList.push({ pool, amount: ghostImpact[pool], expiry });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5) ANIMATE LOOP
  // ─────────────────────────────────────────────────────────────────────────────
  let lastTimestamp = null;

  function animateBars(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaSeconds = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    const nowTime = Date.now();

    // ── 5A) Expiry check: trigger snap when ghost expires
    ghostWatchList = ghostWatchList.filter(g => {
      if (nowTime >= g.expiry) {
        const pool = g.pool;
        state[pool].current = Math.max(0, state[pool].current - g.amount);
        pendingLossBase[pool] = 0;
        return false; // remove from list
      }
      return true;
    });

    // ── 5B) Main animation per pool
    for (const pool of Object.keys(state)) {
      const el = elements[pool];
      if (!el) continue;
      const barContainer = el.fill.closest('.bar');

      barContainer.classList.remove("overspending", "underspending");
      const trend = pools[pool].trend;
      if (trend === "overspending") barContainer.classList.add("overspending");
      else if (trend === "underspending") barContainer.classList.add("underspending");

      const data = state[pool];
      data.current = Math.min(data.current + regenPerSec[pool] * deltaSeconds, data.max);

      const fullPct = data.max > 0 ? (data.current / data.max) * 100 : 0;

      // Phase 1: green only
      if (!revealTriggered[pool]) {
        displayPct[pool] += (fullPct - displayPct[pool]) * 0.08;
        el.fill.style.width = `${displayPct[pool].toFixed(2)}%`;

        const reclaimEl = barContainer.querySelector('.bar-reclaim');
        reclaimEl.style.opacity = '0';
        reclaimEl.style.width = '0%';

        el.value.innerText = `${data.current.toFixed(2)} / ${data.max.toFixed(2)}`;

        if (Math.abs(fullPct - displayPct[pool]) < TINY_MARGIN) {
          if (!revealTimers[pool]) {
            revealTimers[pool] = performance.now();
          } else if (performance.now() - revealTimers[pool] >= REVEAL_DELAY_MS) {
            revealTriggered[pool] = true;
          }
        } else {
          revealTimers[pool] = null;
        }
        continue;
      }

      // Phase 2: regen eats yellow
      regenEaten[pool] += regenPerSec[pool] * deltaSeconds;
      const targetPendingLoss = Math.max(0, pendingLossBase[pool] - regenEaten[pool]);
      const clampedPendingLoss = Math.min(targetPendingLoss, data.current);

      pendingLossDisplay[pool] += (clampedPendingLoss - pendingLossDisplay[pool]) * 0.12;

      const effectiveCurrent = Math.max(0, data.current - pendingLossDisplay[pool]);
      const effectivePct = data.max > 0 ? (effectiveCurrent / data.max) * 100 : 0;

      displayPct[pool] += (effectivePct - displayPct[pool]) * 0.08;
      el.fill.style.width = `${displayPct[pool].toFixed(2)}%`;

      const reclaimEl = barContainer.querySelector('.bar-reclaim');
      const reclaimPct = data.max > 0 ? (pendingLossDisplay[pool] / data.max) * 100 : 0;
      reclaimEl.style.left = `${displayPct[pool].toFixed(2)}%`;
      reclaimEl.style.width = `${reclaimPct.toFixed(2)}%`;
      reclaimEl.style.opacity = reclaimPct > 0.1 ? '1' : '0';

      const reclaimTxt = pendingLossDisplay[pool] > 0 ? ` (+${pendingLossDisplay[pool].toFixed(2)})` : '';
      el.value.innerText = `${effectiveCurrent.toFixed(2)} / ${data.max.toFixed(2)}${reclaimTxt}`;
    }

    requestAnimationFrame(animateBars);
  }

  requestAnimationFrame(animateBars);
}

/* ──────────────────────────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────────────────────────── */
function ensureReclaimLayers(elements) {
  for (const pool of Object.keys(elements)) {
    const barEl = elements[pool]?.fill?.closest('.bar');
    if (!barEl) continue;
    if (!barEl.querySelector('.bar-reclaim')) {
      const seg = document.createElement('div');
      seg.className = 'bar-reclaim';
      barEl.appendChild(seg);
    }
  }
}

function determinePoolFromTx(tx) {
  if (tx.intendedPool) return tx.intendedPool;
  if (tx.amount < 0) return 'stamina';
  return 'mana';
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


