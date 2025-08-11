/**
 * vitals_v7.js
 * ---------------------------------------------------------------------------
 * What this file does:
 * 1) Maintains "current" vitals (regen, spent, trend) in cashflowData/current
 * 2) Renders HUD bars (Health, Mana, Stamina, Essence)
 * 3) Applies a "ghost overlay" from PENDING transactions during their ghost window
 *    - Pending includes provisionally tagged items (Stamina/Mana) until lock
 *    - Ghost recomputes LIVE via Firestore onSnapshot (reacts to new tx + quick-tag)
 * 4) Renders Update Log (latest 5 pending) with TWO quick-tag buttons (Stamina/Mana)
 *    - Active button highlights (green for Stamina, blue for Mana)
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

/* ────────────────────────────────────────────────────────────────────────────
   View mode helpers (daily / weekly / monthly)
   ──────────────────────────────────────────────────────────────────────────── */
const VIEW_MODES   = ["daily", "weekly", "monthly"];
const VIEW_FACTORS = { daily: 1, weekly: 7, monthly: 30 };

function getViewMode() {
  return localStorage.getItem("vitals:viewMode") || "daily";
}
function setViewMode(mode) {
  const next = VIEW_MODES.includes(mode) ? mode : "daily";
  localStorage.setItem("vitals:viewMode", next);
  const btn = document.getElementById("left-btn");
  if (btn) btn.title = `View: ${next}`;
  // Tell HUD animation to rescale and redraw
  window.dispatchEvent(new CustomEvent("vitals:viewmode", { detail: { mode: next }}));
  // Repaint grids immediately for static/snap view
  refreshBarGrids();
}
function cycleViewMode() {
  const i = VIEW_MODES.indexOf(getViewMode());
  setViewMode(VIEW_MODES[(i + 1) % VIEW_MODES.length]);
}


/* ──────────────────────────────────────────────────────────────────────────────
   1) VITALS SNAPSHOT WRITER (compatible with existing flow)
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
    const autoProtectEnabled = true; // reserved for future tweaks

    // Daily regen baselines per pool
    const regenBaseline = {
      health:  dailyDisposable * healthAllocation,
      mana:    dailyDisposable * manaAllocation,
      stamina: dailyDisposable * staminaAllocation,
      essence: dailyDisposable * essenceAllocation,
    };

    // Optional usage snapshot you may already write
    const txnsSnap = await getDoc(doc(db, `players/${uid}/classifiedTransactions/summary`));
    const usage7Day   = { health: 0, mana: 0, stamina: 0, essence: 0 };
    const usageAllTime= { health: 0, mana: 0, stamina: 0, essence: 0 };

    if (txnsSnap.exists()) {
      const { recentUsage = {}, historicUsage = {} } = txnsSnap.data();
      for (const p of ["health", "mana", "stamina", "essence"]) {
        usage7Day[p]    = recentUsage[p]  || 0;
        usageAllTime[p] = historicUsage[p]|| 0;
      }
    }

    // Lightweight trend modifier
    const calcRegen = (baseline, usage) => {
      if (usage > baseline * 1.15) return [baseline * 0.95, "overspending"];
      if (usage < baseline * 0.8 ) return [baseline * 1.05, "underspending"];
      return [baseline, "on target"];
    };

    const vitalsStartDate = new Date("2025-08-11T00:00:00Z");
    const daysTracked = Math.max(1, Math.floor((new Date() - vitalsStartDate) / 86400000));

    const pools = {};
    let totalCurrent = 0;

    for (const pool of ["health", "mana", "stamina", "essence"]) {
      const [regenCurrent, trend] = calcRegen(regenBaseline[pool], usage7Day[pool]);
      const regenTotal = regenCurrent * daysTracked;
      const spent = usageAllTime[pool];
      const current = Math.max(0, Math.min(regenTotal - spent, regenBaseline[pool]));
      totalCurrent += current;

      pools[pool] = {
        regenBaseline: Number(regenBaseline[pool].toFixed(2)),
        regenCurrent:  Number(regenCurrent.toFixed(2)),
        usage7Day:     Number(usage7Day[pool].toFixed(2)),
        trend,
        spentToDate:   Number(spent.toFixed(2)),
      };
    }

    // Optional: compare to balance (if you populate this doc)
    const balanceSnap = await getDoc(doc(db, `players/${uid}/financialData_TRUELAYER/accounts`));
    const availableBalance = balanceSnap.exists() ? (balanceSnap.data().available || 0) : 0;
    const mismatch = availableBalance < totalCurrent * 0.9;

    if (mismatch && autoProtectEnabled) {
      // reserved for auto-protect logic
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
    amount, // negative = spend; positive = income
    dateMs: d?.dateMs ?? Date.now(),
    status: d?.status || "pending",
    ghostExpiryMs: d?.ghostExpiryMs ?? 0,
    provisionalTag: {
      pool:   d?.provisionalTag?.pool ?? null,
      setAtMs:d?.provisionalTag?.setAtMs ?? null,
    },
    tag: {
      pool:   d?.tag?.pool ?? null,
      setAtMs:d?.tag?.setAtMs ?? null,
    },
    suggestedPool: d?.suggestedPool ?? null,
    rulesVersion:  d?.rulesVersion  ?? null,
    transactionData: {
      description: d?.transactionData?.description ?? "",
      entryDateMs: d?.transactionData?.entryDate?.toMillis?.() ?? null,
    },
  };
}

// Preview choice for PENDING items (used by ghost logic)
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

  const vitalsStartDate = new Date("2025-08-11T00:00:00Z");
  const daysTracked = Math.max(1, Math.floor((new Date() - vitalsStartDate) / 86400000));

  const factor = VIEW_FACTORS[getViewMode()];

  for (const [pool, values] of Object.entries(pools)) {
    const el = elements[pool];
    if (!el) continue;

    const regen = values.regenCurrent ?? 0;
    const spent = values.spentToDate ?? 0;
    const max   = (values.regenBaseline ?? 0) * factor;

    const current = Math.max(0, Math.min((regen * daysTracked) - spent, max));
    const pct     = max > 0 ? Math.min((current / max) * 100, 100) : 0;

    el.fill.style.width = `${pct}%`;
    el.value.innerText  = `${current.toFixed(2)} / ${max.toFixed(2)}${values.trend ? ` • ${values.trend}` : ''}`;
  }

  // ensure grid exists for snap view
  refreshBarGrids();
}


/* ──────────────────────────────────────────────────────────────────────────────
   4) Ghost builder (per‑tx allocation) — shared by initVitalsHUD
   ────────────────────────────────────────────────────────────────────────────── */
function buildGhostFromPending(pendingTx, state) {
  let remainingForStamina = Math.max(0, state.stamina?.current ?? 0);
  const sorted = [...pendingTx].sort((a, b) => a.dateMs - b.dateMs);

  const perPoolTotals = { stamina: 0, mana: 0, health: 0 };
  const newWatch = []; // [{pool, amount, expiry}]

  for (const tx of sorted) {
    if (tx.amount >= 0) continue; // income/contrib don't ghost
    const spend  = -tx.amount;
    const intent = previewPool(tx);
    const expiry = tx.ghostExpiryMs;

    if (intent === "mana") {
      perPoolTotals.mana += spend;
      newWatch.push({ pool: "mana", amount: spend, expiry });
      continue;
    }

    // stamina-first with overflow → health
    const toStamina = Math.min(spend, remainingForStamina);
    const toHealth  = spend - toStamina;

    if (toStamina > 0) {
      perPoolTotals.stamina += toStamina;
      newWatch.push({ pool: "stamina", amount: toStamina, expiry });
    }
    if (toHealth > 0) {
      perPoolTotals.health += toHealth;
      newWatch.push({ pool: "health", amount: toHealth, expiry });
    }

    remainingForStamina -= toStamina;
  }

  return { perPoolTotals, newWatch };
}

/* ──────────────────────────────────────────────────────────────────────────────
   5) Animated HUD with LIVE Ghost Preview (pending items only)
   ────────────────────────────────────────────────────────────────────────────── */
export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();

  // Base snapshot
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const vitalsStartDate = new Date("2025-08-11T00:00:00Z");
  const daysTracked = Math.max(1, Math.floor((new Date() - vitalsStartDate) / 86400000));
  console.log ('Days tracked:', daysTracked);

  const pools = snap.data().pools;
  const elements = getVitalsElements();
    // NEW: create grid layers now so they sit under fill
  ensureGridLayers(elements);     // <── add this
  ensureReclaimLayers(elements);  // (yours, unchanged)

  // Local animated state
  const state = {};
  const regenPerSec = {};
  const displayPct = {};
  const pendingLossBase = {};
  const pendingLossDisplay = {};
  const regenEaten = {};
  const revealTriggered = {};
  const revealTimers = {};

  // Ghost watch list (per‑tx expiry snap)
  let ghostWatchList = [];

  const secondsPerDay = 86400;
  const REVEAL_DELAY_MS = 600;
  const TINY_MARGIN = 0.1;

  // NEW: view factor on first init
  let viewMode = getViewMode();
  let factor = VIEW_FACTORS[viewMode];

  // Initialise bar state from committed values
  for (const pool of Object.keys(pools)) {
    const data = pools[pool];
    const regen = data.regenCurrent ?? 0;
    const spent = data.spentToDate ?? 0;
    const max   = (data.regenBaseline ?? 0) * factor;  // <── changed

    const regenTotal = regen * daysTracked;
    const current = Math.max(0, Math.min(regenTotal - spent, max));

    state[pool] = { current, max };
    regenPerSec[pool] = (regen * timeMultiplier) / secondsPerDay;
    displayPct[pool]  = max > 0 ? (current / max) * 100 : 0;

    pendingLossBase[pool]    = 0;
    pendingLossDisplay[pool] = 0;
    regenEaten[pool]         = 0;
    revealTriggered[pool]    = false;
    revealTimers[pool]       = null;
  }

  // LIVE ghost: listen to pending items and rebuild ghost model
  const pendingQ = query(
    collection(db, `players/${uid}/classifiedTransactions`),
    where("status", "==", "pending")
  );

  onSnapshot(pendingQ, (snapShot) => {
    const nowMs = Date.now();
    const pending = snapShot.docs
      .map(normalizeTxn)
      .filter(tx => nowMs < tx.ghostExpiryMs); // still inside ghost window

    const { perPoolTotals, newWatch } = buildGhostFromPending(pending, state);

    // Reset ghost state for smooth re-merge
    for (const pool of Object.keys(state)) {
      pendingLossBase[pool]    = Math.max(0, perPoolTotals[pool] || 0);
      pendingLossDisplay[pool] = 0;
      regenEaten[pool]         = 0;
    }
    ghostWatchList = newWatch;
  });

  // Animation loop
  let lastTimestamp = null;
  function animateBars(ts) {
    if (lastTimestamp === null) lastTimestamp = ts;
    const deltaSeconds = (ts - lastTimestamp) / 1000;
    lastTimestamp = ts;

    const nowTime = Date.now();

    // A) Snap ghost into real depletion on expiry
    ghostWatchList = ghostWatchList.filter(g => {
      if (nowTime >= g.expiry) {
        const pool = g.pool;
        state[pool].current = Math.max(0, state[pool].current - g.amount);
        pendingLossBase[pool] = 0; // clear remaining ghost for that pool
        const reclaimEl = elements[pool]?.fill?.closest('.bar')?.querySelector('.bar-reclaim');
        if (reclaimEl) reclaimEl.classList.add('flash'); // small visual pulse
        return false;
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
      if (trend === "overspending")   barContainer.classList.add("overspending");
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
        reclaimEl.style.width   = '0%';

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
      const targetPendingLoss   = Math.max(0, pendingLossBase[pool] - regenEaten[pool]);
      const clampedPendingLoss  = Math.min(targetPendingLoss, data.current);

      pendingLossDisplay[pool] += (clampedPendingLoss - pendingLossDisplay[pool]) * 0.12;

      const effectiveCurrent = Math.max(0, data.current - pendingLossDisplay[pool]);
      const effectivePct     = data.max > 0 ? (effectiveCurrent / data.max) * 100 : 0;

      displayPct[pool] += (effectivePct - displayPct[pool]) * 0.08;
      el.fill.style.width = `${displayPct[pool].toFixed(2)}%`;

      const reclaimEl  = barContainer.querySelector('.bar-reclaim');
      const reclaimPct = data.max > 0 ? (pendingLossDisplay[pool] / data.max) * 100 : 0;
      reclaimEl.style.left   = `${displayPct[pool].toFixed(2)}%`;
      reclaimEl.style.width  = `${reclaimPct.toFixed(2)}%`;
      reclaimEl.style.opacity= reclaimPct > 0.1 ? '1' : '0';

      const reclaimTxt = pendingLossDisplay[pool] > 0 ? ` (+${pendingLossDisplay[pool].toFixed(2)})` : '';
      el.value.innerText = `${effectiveCurrent.toFixed(2)} / ${data.max.toFixed(2)}${reclaimTxt}`;
    }

    requestAnimationFrame(animateBars);
  }
  requestAnimationFrame(animateBars);

    // ── NEW: react to mode changes while running ───────────────────────────────
  window.addEventListener("vitals:viewmode", (e) => {
    viewMode = e?.detail?.mode || "daily";
    factor = VIEW_FACTORS[viewMode];

    // Rescale max and refresh instantaneous display pct + labels
    for (const pool of Object.keys(state)) {
      const el = elements[pool];
      if (!el) continue;

      const poolData = pools[pool];
      state[pool].max = (poolData.regenBaseline ?? 0) * factor;

      // Keep current the same; only the denominator changes
      const effectiveCurrent = Math.max(0, state[pool].current - (pendingLossDisplay[pool] || 0));
      const pct = state[pool].max > 0 ? (effectiveCurrent / state[pool].max) * 100 : 0;

      displayPct[pool] = pct;
      el.fill.style.width = `${pct.toFixed(2)}%`;

      // Update value text to reflect new max
      const reclaimTxt = pendingLossDisplay[pool] > 0 ? ` (+${pendingLossDisplay[pool].toFixed(2)})` : '';
      el.value.innerText = `${effectiveCurrent.toFixed(2)} / ${state[pool].max.toFixed(2)}${reclaimTxt}`;
    }

    // Redraw the day grid for the new mode
    refreshBarGrids();
  });
}

/* ──────────────────────────────────────────────────────────────────────────────
   6) UPDATE LOG: latest 5 pending + quick-tag + auto-lock tick
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

// Confirm on expiry + enforce queue cap
export async function lockExpiredOrOverflow(uid, queueCap = 50) {
  const db = getFirestore();
  const col = collection(db, `players/${uid}/classifiedTransactions`);
  const now = Date.now();
  const batch = writeBatch(db);

  // 1) Expire due
  const dueSnap = await getDocs(query(col, where("status", "==", "pending"), where("ghostExpiryMs", "<=", now)));
  dueSnap.forEach(d => {
    const tx = d.data();
    const chosen = tx?.provisionalTag?.pool ?? "stamina";
    batch.update(d.ref, {
      status: "confirmed",
      tag: { pool: chosen, setAtMs: now },
      autoLockReason: "expiry",
    });
  });

  // 2) Queue cap
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

  if (!dueSnap.empty || overflow > 0) await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────────────────
   7) RECENTLY LOCKED: last 24h (latest 5)
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
   8) AUTO-WIRE UPDATE LOG (if UI containers exist)
   ────────────────────────────────────────────────────────────────────────────── */
export function autoInitUpdateLog() {
  const listEl   = document.querySelector("#update-log-list");
  const recentEl = document.querySelector("#recently-locked-list");
  if (!listEl && !recentEl) return;

  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const uid = user.uid;

    // Helper: highlight active button
    function setActiveButtons(li, pool) {
      const buttons = li.querySelectorAll(".tag-btn");
      buttons.forEach(b => {
        b.classList.remove("active", "stamina", "mana");
        if (b.dataset.pool === pool) {
          b.classList.add("active", pool); // adds .active + .stamina or .mana
        }
      });
    }

    // PENDING list (latest 5)
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
          const minLeft  = Math.floor(secsLeft / 60);
          const secLeft  = secsLeft % 60;

          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);

          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">
                  £${amt} • <span class="countdown">${minLeft}m ${secLeft}s</span> • ${tag}
                </div>
              </div>
              <div class="ul-actions two">
                <button class="tag-btn" data-pool="stamina">Stamina</button>
                <button class="tag-btn" data-pool="mana">Mana</button>
              </div>
            </div>
          `;

          // Initial highlight
          setActiveButtons(li, tag);

          // Click handlers + immediate highlight + write
          li.querySelectorAll(".tag-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const pool = btn.getAttribute("data-pool");
              setActiveButtons(li, pool);         // instant UI feedback
              await setProvisionalTag(uid, tx.id, pool);
            });
          });

          listEl.appendChild(li);
        });
      });
    }

    // RECENTLY LOCKED (last 24h, latest 5)
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
   9) DOM HELPERS
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

// Map HUD elements by id: #vital-{pool}
function getVitalsElements() {
  const pools = ["health", "mana", "stamina", "essence"];
  const elements = {};
  for (const pool of pools) {
    const barFill  = document.querySelector(`#vital-${pool} .bar-fill`);
    const barValue = document.querySelector(`#vital-${pool} .bar-value`);
    const label    = document.querySelector(`#vital-${pool} .bar-label`);
    if (barFill && barValue && label) {
      elements[pool] = { fill: barFill, value: barValue, label };
    }
  }
  return elements;
}

/* ────────────────────────────────────────────────────────────────────────────
   Grid layer: vertical day dividers under the green fill
   ──────────────────────────────────────────────────────────────────────────── */
function ensureGridLayers(elements) {
  const days = VIEW_FACTORS[getViewMode()];
  for (const pool of Object.keys(elements)) {
    const barEl = elements[pool]?.fill?.closest('.bar');
    if (!barEl) continue;

    let grid = barEl.querySelector('.bar-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'bar-grid';
      // Insert before fill so it sits under it naturally
      const fill = elements[pool].fill;
      barEl.insertBefore(grid, fill);
    }
    paintBarGrid(grid, days);
  }
}

function paintBarGrid(gridEl, days) {
  // days-1 lines at 1/d, 2/d, ..., (d-1)/d
  const needed = Math.max(0, (days|0) - 1);
  gridEl.innerHTML = '';
  for (let i = 1; i <= needed; i++) {
    const line = document.createElement('div');
    line.className = 'grid-line';
    line.style.left = ((i / days) * 100).toFixed(4) + '%';
    gridEl.appendChild(line);
  }
}

// Can be called on mode change or initial snap
function refreshBarGrids() {
  const elements = getVitalsElements();
  const days = VIEW_FACTORS[getViewMode()];
  for (const pool of Object.keys(elements)) {
    const barEl = elements[pool]?.fill?.closest('.bar');
    if (!barEl) continue;
    let grid = barEl.querySelector('.bar-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'bar-grid';
      const fill = elements[pool].fill;
      barEl.insertBefore(grid, fill);
    }
    paintBarGrid(grid, days);
  }
}

// Auto-wire left button to cycle view mode
(function wireLeftButtonForViewMode() {
  const run = () => {
    const btn = document.getElementById("left-btn");
    if (!btn) return;
    // Init tooltip with current mode
    btn.title = `View: ${getViewMode()}`;
    btn.addEventListener("click", cycleViewMode);
    // Ensure initial grids are drawn if HUD not animated yet
    refreshBarGrids();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();


