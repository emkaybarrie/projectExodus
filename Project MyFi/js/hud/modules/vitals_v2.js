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

// Updated w/ Ghost Preview Integration
export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();

  // 1) Load cashflow / pools (unchanged)
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const vitalsStartDate = new Date("2025-08-01T00:00:00Z");
  const now = new Date();
  const daysTracked = Math.max(1, Math.floor((now - vitalsStartDate) / (1000 * 60 * 60 * 24)));

  const pools = snap.data().pools; // { stamina: {regenCurrent, spentToDate, regenBaseline, trend}, ... }
  const elements = getVitalsElements();

  // Ensure yellow "reclaim" layers exist (opaque segment that sits after the solid fill)
  ensureReclaimLayers(elements);

  const state = {};
  const regenPerSec = {};
  const targetPct = {};             // kept for minimal diff, but we now drive from effectivePct
  const displayPct = {};            // solid bar eased percent
  const displayReclaimPct = {};     // yellow eased percent (width only)
  const ghostImpact = { stamina: 0, mana: 0, health: 0 }; // amounts to subtract from "current" for preview
  const secondsPerDay = 86400;

  // 2) Build base state from regen/spent (your logic)
  for (const pool of Object.keys(pools)) {
    const data = pools[pool];
    const regen = data.regenCurrent ?? 0;
    const spent = data.spentToDate ?? 0; // Derived from classifiedTransactions that have been committed (status = final)
    console.log(`Pool ${pool}: Regen=${regen}, Spent=${spent}`);

    // NOTE: Using "per-period max" (no * daysTracked) as in your current version.
    // If you want period-scaling later, set: const max = (data.regenBaseline ?? 0) * daysTracked;
    const max = (data.regenBaseline ?? 0);

    const regenTotal = regen * daysTracked; // total generated since vitalsStartDate
    const current = Math.max(0, Math.min(regenTotal - spent, max)); // remaining after committed spend

    state[pool] = { current, max };
    regenPerSec[pool] = (regen * timeMultiplier) / secondsPerDay;

    const startPct = max > 0 ? (current / max) * 100 : 0;
    displayPct[pool] = startPct;
    displayReclaimPct[pool] = 0;           // yellow fades in after initial solid animation
    targetPct[pool] = startPct;
  }



  // 3) Load PENDING transactions for ghost preview
  const q = query(collection(db, `players/${uid}/classifiedTransactions`));
  const qs = await getDocs(q);
  const allTx = qs.docs.map(normalizeTxn);

  const nowMs = Date.now();
  const pending = allTx.filter(tx => tx.status === "pending" && nowMs < tx.ghostExpiryMs);

  console.log("Pending transactions for ghost preview:", pending);

  // 4) Compute stamina remaining for preview **from HUD state** to keep visuals consistent
  //    This mirrors what the user sees right now.
  const staminaRemaining = Math.max(0, state['stamina']?.current ?? 0);
  console.log("Stamina remaining (HUD-based):", staminaRemaining);

  // 5) Compute ghost impact (amounts we’d lose if these snap now)
  const impact = computeGhostImpact({ pendingTxns: pending, staminaRemaining });
  console.log("Ghost impact from pending transactions:", impact);

  ghostImpact.stamina = impact.stamina;
  ghostImpact.mana    = impact.mana;
  ghostImpact.health  = impact.health;

  // 6) Animation loop (regen + synced yellow reclaim)
  let lastTimestamp = null;

  // Delay yellow reveal so the solid can animate first
  const firstFrameAt = performance.now();
  const reclaimVisibleAt = firstFrameAt + 500; // ms; tweak 350–600 to taste

  function animateBars(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaSeconds = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    for (const pool of Object.keys(state)) {
      const el = elements[pool];
      if (!el) continue;

      // Trend classes (unchanged)
      const barContainer = el.fill.closest('.bar');
      barContainer.classList.remove("overspending", "underspending");
      const trend = pools[pool].trend;
      if (trend === "overspending") {
        barContainer.classList.add("overspending");
      } else if (trend === "underspending") {
        barContainer.classList.add("underspending");
      }

      // Regen the *committed* current
      const data = state[pool];
      data.current = Math.min(data.current + regenPerSec[pool] * deltaSeconds, data.max);

      // --- Ghost-as-applied model ---
      // Treat ghost as already "hit" visually; show reclaimable part as yellow.
      const ghostAmt = Math.max(0, ghostImpact[pool] || 0);
      const pendingLoss = Math.min(ghostAmt, data.current); // can't preview more than we have

      const effectiveCurrent = Math.max(0, data.current - pendingLoss);
      const effectivePct = data.max > 0 ? (effectiveCurrent / data.max) * 100 : 0;
      const reclaimPct   = data.max > 0 ? (pendingLoss      / data.max) * 100 : 0;

      // Ease BOTH with the same factor so they feel like one bar
      displayPct[pool]        += (effectivePct - displayPct[pool]) * 0.08;

      // Reveal yellow after initial solid animation
      const targetReclaim = (timestamp >= reclaimVisibleAt) ? reclaimPct : 0;
      displayReclaimPct[pool] += (targetReclaim - displayReclaimPct[pool]) * 0.08;

      // Solid
      el.fill.style.width = `${displayPct[pool].toFixed(2)}%`;

      // Yellow sits right after solid (same eased left), fully opaque (no tinting)
      const reclaimEl = barContainer.querySelector('.bar-reclaim');
      if (reclaimEl) {
        reclaimEl.style.left = `${displayPct[pool].toFixed(2)}%`;
        reclaimEl.style.width = `${displayReclaimPct[pool].toFixed(2)}%`;
        reclaimEl.style.opacity = displayReclaimPct[pool] > 0.2 ? '1' : '0';
      }

      // Value text: show effective current with reclaim hint
      const reclaimTxt = pendingLoss > 0 ? ` (+${pendingLoss.toFixed(2)} reclaimable)` : '';
      el.value.innerText = `${effectiveCurrent.toFixed(2)} / ${data.max.toFixed(2)}${reclaimTxt}`;
    }

    requestAnimationFrame(animateBars);
  }

  requestAnimationFrame(animateBars);
}

/* ===================== helpers ===================== */

/**
 * Ensure we have a yellow reclaim segment per bar.
 * This is an opaque slice placed immediately after the solid fill,
 * so it won’t get tinted by the base bar color.
 */
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


