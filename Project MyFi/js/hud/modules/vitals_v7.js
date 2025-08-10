/**
 * vitals_v7.js
 * ---------------------------------------------------------------------------
 * What this file does:
 * 1) Maintains "current" vitals (regen, spent, trend) in cashflowData/current
 * 2) Renders HUD bars (Health, Mana, Stamina, Essence)
 * 3) Applies a "ghost overlay" from pending transactions (provisionally tagged or not)
 * 4) Renders Update Log (latest 5 pending) with quick-tagging
 * 5) Auto-locks expired items (and enforces queue max) by flipping status->confirmed
 * 6) Renders Recently Locked (latest 5 in last 24h)
 * ---------------------------------------------------------------------------
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/* ──────────────────────────────────────────────────────────────────────────────
   1) VITALS SNAPSHOT WRITER (kept compatible with your existing flow)
   ────────────────────────────────────────────────────────────────────────────── */
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
    const autoProtectEnabled = true; // if you want to react to mismatch later

    // Baselines from your allocations (per-day regen capacity per pool)
    const regenBaseline = {
      health: dailyDisposable * healthAllocation,
      mana: dailyDisposable * manaAllocation,
      stamina: dailyDisposable * staminaAllocation,
      essence: dailyDisposable * essenceAllocation,
    };

    // Optional usage snapshots you might already be writing under classifiedTransactions/summary
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

    // Trend adjuster (very lightweight)
    const calculateRegen = (baseline, usage) => {
      if (usage > baseline * 1.15) return [baseline * 0.95, "overspending"];
      if (usage < baseline * 0.8)  return [baseline * 1.05, "underspending"];
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
        spentToDate: Number(spent.toFixed(2)),
      };
    }

    // Optional: compare to bank balance (if you populate that path)
    const balanceSnap = await getDoc(doc(db, `players/${uid}/financialData_TRUELAYER/accounts`));
    const availableBalance = balanceSnap.exists() ? (balanceSnap.data().available || 0) : 0;
    const mismatch = availableBalance < totalCurrent * 0.9;

    if (mismatch && autoProtectEnabled) {
      // Hook for future auto-protect tweaks to regenCurrent
    }

    await setDoc(doc(db, `players/${uid}/cashflowData/current`), {
      pools,
      dailyAverages: { dailyDisposable: Number(dailyDisposable.toFixed(2)) },
      balanceSnapshot: Number(availableBalance.toFixed(2)),
      mismatch,
      daysTracked,
      lastSync: new Date().toISOString(),
    });

    console.log("✔ Vitals updated successfully.");
  } catch (err) {
    console.error("❌ Failed to update vitals pools:", err);
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   2) CLASSIFIED TX NORMALIZER (for HUD + Update Log rendering)
   ────────────────────────────────────────────────────────────────────────────── */
function normalizeTxn(docSnap) {
  const d = docSnap.data();
  const amount = Number(d?.amount ?? 0);
  return {
    id: docSnap.id,
    amount,                             // negative = spend; positive = income
    dateMs: d?.dateMs ?? Date.now(),
    status: d?.status || "pending",
    ghostExpiryMs: d?.ghostExpiryMs ?? 0,
    provisionalTag: {
      pool: d?.provisionalTag?.pool ?? null,
      setAtMs: d?.provisionalTag?.setAtMs ?? null,
    },
    tag: {
      pool: d?.tag?.pool ?? null,
      setAtMs: d?.tag?.setAtMs ?? null,
    },
    suggestedPool: d?.suggestedPool ?? null,
    rulesVersion: d?.rulesVersion ?? null,
    transactionData: {
      description: d?.transactionData?.description ?? "",
      entryDateMs: d?.transactionData?.entryDate?.toMillis?.() ?? null,
    },
  };
}

// Provisional/preview choice for pending items (used by ghost logic)
function previewPool(tx) {
  return tx.provisionalTag?.pool ?? tx.suggestedPool ?? "stamina";
}

/* ──────────────────────────────────────────────────────────────────────────────
   3) ONE-TIME HUD LOADER (snap current without animation)
   ────────────────────────────────────────────────────────────────────────────── */
export async function loadVitalsToHUD(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;
  const elements = getVitalsElements();

  const vitalsStartDate = new Date("2025-08-01T00:00:00Z");
  const daysTracked = Math.max(1, Math.floor((new Date() - vitalsStartDate) / (1000 * 60 * 60 * 24)));

  for (const [pool, values] of Object.entries(pools)) {
    const el = elements[pool];
    if (!el) continue;

    const regen = values.regenCurrent ?? 0;
    const spent = values.spentToDate ?? 0;
    const max = values.regenBaseline ?? 0;

    const potentialCurrent = (regen * daysTracked) - spent;
    const current = Math.max(0, Math.min(potentialCurrent, max));

    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    el.fill.style.width = `${pct}%`;
    el.value.innerText = `${current.toFixed(2)} / ${max.toFixed(2)}${values.trend ? ` • ${values.trend}` : ''}`;
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   4) Animated HUD with Ghost Preview (pending items only)
   - Pending includes provisionally tagged items until lock.
   - Build per-transaction ghost watch list with stamina-first overflow.
   ────────────────────────────────────────────────────────────────────────────── */
export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();

  // Base vitals snapshot
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const vitalsStartDate = new Date("2025-08-01T00:00:00Z");
  const daysTracked = Math.max(1, Math.floor((new Date() - vitalsStartDate) / (1000 * 60 * 60 * 24)));

  const pools = snap.data().pools;
  const elements = getVitalsElements();
  ensureReclaimLayers(elements);

  // Local animated state
  const state = {};
  const regenPerSec = {};
  const displayPct = {};
  const pendingLossBase = {};
  const pendingLossDisplay = {};
  const regenEaten = {};
  const revealTriggered = {};
  const revealTimers = {};

  let ghostWatchList = [];                // [{ pool, amount, expiry }]
  const secondsPerDay = 86400;
  const REVEAL_DELAY_MS = 600;            // small staging delay
  const TINY_MARGIN = 0.1;

  // Initialise HUD bars from committed values
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

  // Load pending transactions (those inside ghost window)
  const qs = await getDocs(query(collection(db, `players/${uid}/classifiedTransactions`)));
  const allTx = qs.docs.map(normalizeTxn);
  const nowMs = Date.now();
  const pending = allTx.filter(tx => tx.status === "pending" && nowMs < tx.ghostExpiryMs);

  // Build per-transaction allocations in chronological order
  // - mana: 100% to mana
  // - otherwise: stamina-first with overflow to health
  let remainingForStamina = Math.max(0, state.stamina?.current ?? 0);
  const sorted = [...pending].sort((a, b) => a.dateMs - b.dateMs);
  const perPoolTotals = { stamina: 0, mana: 0, health: 0 };

  ghostWatchList = [];
  for (const tx of sorted) {
    if (tx.amount >= 0) continue; // income/contrib don't cause ghost damage

    const spend = -tx.amount;
    const intent = previewPool(tx);
    const expiry = tx.ghostExpiryMs;

    if (intent === "mana") {
      perPoolTotals.mana += spend;
      ghostWatchList.push({ pool: "mana", amount: spend, expiry });
      continue;
    }

    const toStamina = Math.min(spend, remainingForStamina);
    const toHealth = spend - toStamina;

    if (toStamina > 0) {
      perPoolTotals.stamina += toStamina;
      ghostWatchList.push({ pool: "stamina", amount: toStamina, expiry });
    }
    if (toHealth > 0) {
      perPoolTotals.health += toHealth;
      ghostWatchList.push({ pool: "health", amount: toHealth, expiry });
    }

    remainingForStamina -= toStamina;
  }

  // Store ghost totals per pool (will be "eaten" by regen over time)
  for (const pool of Object.keys(state)) {
    pendingLossBase[pool] = Math.max(0, perPoolTotals[pool] || 0);
  }

  // Animation loop
  let lastTimestamp = null;
  function animateBars(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaSeconds = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    const nowTime = Date.now();

    // A) Snap ghost into real depletion at expiry time
    ghostWatchList = ghostWatchList.filter(g => {
      if (nowTime >= g.expiry) {
        const pool = g.pool;
        state[pool].current = Math.max(0, state[pool].current - g.amount);
        pendingLossBase[pool] = 0;          // reset pool pending after snap
        return false;                       // remove this ghost item
      }
      return true;
    });

    // B) Animate each pool (regen + reclaim overlay)
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

      // Phase 1: green fill settles; delay before showing yellow reclaim
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

      // Phase 2: regen eats the yellow reclaim segment over time
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
   5) UPDATE LOG: latest 5 pending + quick-tag + auto-lock tick
   ────────────────────────────────────────────────────────────────────────────── */
export function listenUpdateLogPending(uid, cb) {
  const db = getFirestore();
  const qy = query(
    collection(db, `players/${uid}/classifiedTransactions`),
    where("status", "==", "pending"),
    orderBy("addedMs", "desc"),
    limit(5)
  );
  return onSnapshot(qy, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...normalizeTxn(d) }));
    cb(items);
  });
}

export async function setProvisionalTag(uid, txId, pool) {
  const db = getFirestore();
  await updateDoc(doc(db, `players/${uid}/classifiedTransactions/${txId}`), {
    provisionalTag: { pool, setAtMs: Date.now() },
  });
}

/**
 * lockExpiredOrOverflow
 * - Confirms any pending that have reached ghostExpiryMs.
 * - Enforces queue max by confirming oldest pending beyond the cap.
 * - Flips status -> "confirmed", sets tag.pool (provisional or fallback), sets autoLockReason.
 */
export async function lockExpiredOrOverflow(uid, queueCap = 50) {
  const db = getFirestore();
  const col = collection(db, `players/${uid}/classifiedTransactions`);
  const now = Date.now();

  const batch = writeBatch(db);

  // 1) Expire due
  const dueSnap = await getDocs(query(col, where("status", "==", "pending"), where("ghostExpiryMs", "<=", now)));
  dueSnap.forEach(d => {
    const tx = d.data();
    const chosen = tx?.provisionalTag?.pool ?? "stamina";  // fallback default
    batch.update(d.ref, {
      status: "confirmed",
      tag: { pool: chosen, setAtMs: now },
      autoLockReason: "expiry",
    });
  });

  // 2) Enforce queue cap (confirm oldest pending beyond cap)
  const pendSnap = await getDocs(query(col, where("status", "==", "pending"), orderBy("addedMs", "asc")));
  const overflow = pendSnap.size - queueCap;
  if (overflow > 0) {
    let i = 0;
    pendSnap.forEach(d => {
      if (i++ < overflow) {
        const tx = d.data();
        const chosen = tx?.provisionalTag?.pool ?? "stamina";
        batch.update(d.ref, {
          status: "confirmed",
          tag: { pool: chosen, setAtMs: now },
          autoLockReason: "queue_cap",
        });
      }
    });
  }

  if (!dueSnap.empty || overflow > 0) {
    await batch.commit();
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   6) RECENTLY LOCKED: last 24h (latest 5)
   ────────────────────────────────────────────────────────────────────────────── */
export function listenRecentlyConfirmed(uid, lookbackMs = 24 * 60 * 60 * 1000, cb) {
  const db = getFirestore();
  const since = Date.now() - lookbackMs;

  // Requires a composite index: status=confirmed + tag.setAtMs
  const qy = query(
    collection(db, `players/${uid}/classifiedTransactions`),
    where("status", "==", "confirmed"),
    where("tag.setAtMs", ">=", since),
    orderBy("tag.setAtMs", "desc"),
    limit(5)
  );

  return onSnapshot(qy, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...normalizeTxn(d) }));
    cb(items);
  });
}

/* ──────────────────────────────────────────────────────────────────────────────
   7) AUTO-WIRE UPDATE LOG (if UI containers exist)
   ────────────────────────────────────────────────────────────────────────────── */
export function autoInitUpdateLog() {
  const listEl = document.querySelector("#update-log-list");
  const recentEl = document.querySelector("#recently-locked-list");
  if (!listEl && !recentEl) return;

  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const uid = user.uid;

    // Live PENDING items (latest 5)
    if (listEl) {
      listenUpdateLogPending(uid, (items) => {
        listEl.innerHTML = "";
        if (!items.length) {
          const li = document.createElement("li");
          li.textContent = "Nothing pending — nice!";
          listEl.appendChild(li);
          return;
        }
        items.forEach(tx => {
          const li = document.createElement("li");

          const tag = tx.provisionalTag?.pool ?? "stamina";
          const secsLeft = Math.max(0, Math.floor((tx.ghostExpiryMs - Date.now()) / 1000));
          const minLeft = Math.floor(secsLeft / 60);
          const secLeft = secsLeft % 60;

          const name = tx.transactionData?.description || "Transaction";
          const amt = Number(tx.amount).toFixed(2);

          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">
                  £${amt} • <span class="countdown">${minLeft}m ${secLeft}s</span> • ${tag}
                </div>
              </div>
              <div class="ul-actions">
                <button class="tag-btn" data-pool="stamina">Stamina</button>
                <button class="tag-btn" data-pool="mana">Mana</button>
              </div>
            </div>
          `;

          li.querySelectorAll(".tag-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const pool = btn.getAttribute("data-pool");
              await setProvisionalTag(uid, tx.id, pool);
            });
          });

          listEl.appendChild(li);
        });
      });
    }

    // Live RECENTLY LOCKED (last 24h, latest 5)
    if (recentEl) {
      listenRecentlyConfirmed(uid, 24 * 60 * 60 * 1000, (items) => {
        recentEl.innerHTML = "";
        if (!items.length) {
          const li = document.createElement("li");
          li.textContent = "No recent locks.";
          recentEl.appendChild(li);
          return;
        }
        items.forEach(tx => {
          const li = document.createElement("li");
          const pool = tx.tag?.pool ?? "stamina";
          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);
          const when = tx.tag?.setAtMs ? new Date(tx.tag.setAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • ${when} <span class="badge ${pool}">${pool}</span></div>
              </div>
            </div>
          `;
          recentEl.appendChild(li);
        });
      });
    }

    // Periodic auto-lock tick (expiry + queue cap)
    setInterval(() => lockExpiredOrOverflow(uid, 50), 20_000);
  });
}

/* ──────────────────────────────────────────────────────────────────────────────
   8) DOM HELPERS (bars + reclaim segment)
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

// Finds HUD bar elements by id pattern: #vital-{pool} .bar-fill/.bar-value/.bar-label
function getVitalsElements() {
  const pools = ["health", "mana", "stamina", "essence"];
  const elements = {};
  for (const pool of pools) {
    const barFill = document.querySelector(`#vital-${pool} .bar-fill`);
    const barValue = document.querySelector(`#vital-${pool} .bar-value`);
    const label = document.querySelector(`#vital-${pool} .bar-label`);
    if (barFill && barValue && label) {
      elements[pool] = { fill: barFill, value: barValue, label };
    }
  }
  return elements;
}
