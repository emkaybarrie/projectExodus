/**
 * vitals_v16.js
 * ---------------------------------------------------------------------------
 * Single truth (regen*elapsed - spentToDate) drives all views.
 * Mode = lens: cap = baseline*factor, remainder = truth % cap, surplus = ⌊truth/cap⌋.
 * Ghost (pending) consumes surplus first (from truth), overflow → Health (or Stamina→Health for Mana if configured).
 * Surplus counter pill shows ×N; while pending, shows predicted →.
 * On lock, write appliedAllocation, recompute summary, refresh current, and emit 'vitals:locked' for instant UI sync.
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

export function getViewMode() {
  return localStorage.getItem("vitals:viewMode") || "daily";
}
export function setViewMode(mode) {
  const next = VIEW_MODES.includes(mode) ? mode : "daily";
  localStorage.setItem("vitals:viewMode", next);
  const btn = document.getElementById("left-btn");
  if (btn) btn.title = `View: ${next}`;
  // Tell HUD to completely recompute for this mode (no clamping tricks)
  window.dispatchEvent(new CustomEvent("vitals:viewmode", { detail: { mode: next }}));
  refreshBarGrids();
}
export function cycleViewMode() {
  const i = VIEW_MODES.indexOf(getViewMode());
  setViewMode(VIEW_MODES[(i + 1) % VIEW_MODES.length]);
}

/* ────────────────────────────────────────────────────────────────────────────
   Time + math helpers
   ──────────────────────────────────────────────────────────────────────────── */
const MS_PER_DAY  = 86_400_000;
const SEC_PER_DAY = 86_400;
// Anchor (same as you’ve been using)
const VITALS_START_DATE = new Date("2025-08-01T00:00:00Z");

function elapsedDaysNow() {
  return Math.max(0, (Date.now() - VITALS_START_DATE.getTime()) / MS_PER_DAY);
}
function modCap(x, cap) {
  if (cap <= 0) return 0;
  const m = x % cap;
  return m < 0 ? m + cap : m; // proper positive modulo
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/* ──────────────────────────────────────────────────────────────────────────────
   Firestore normalizers
   ────────────────────────────────────────────────────────────────────────────── */
function normalizeTxn(docSnap) {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    amount: Number(d?.amount ?? 0), // negative = spend; positive = income
    dateMs: d?.dateMs ?? Date.now(),
    status: d?.status || "pending",
    ghostExpiryMs: d?.ghostExpiryMs ?? 0,
    addedMs: d?.addedMs ?? d?.dateMs ?? Date.now(),
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
function previewPool(tx) {
  return tx.provisionalTag?.pool ?? tx.suggestedPool ?? "stamina";
}

/* ──────────────────────────────────────────────────────────────────────────────
   1) VITALS SNAPSHOT WRITER (same shapes as v8)
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

    const regenBaseline = {
      health:  dailyDisposable * healthAllocation,
      mana:    dailyDisposable * manaAllocation,
      stamina: dailyDisposable * staminaAllocation,
      essence: dailyDisposable * essenceAllocation,
    };

    // Reads: summary for recent/historic usage (for trends + spentToDate)
    const txnsSnap = await getDoc(doc(db, `players/${uid}/classifiedTransactions/summary`));
    const usage7Day    = { health:0, mana:0, stamina:0, essence:0 };
    const usageAllTime = { health:0, mana:0, stamina:0, essence:0 };
    if (txnsSnap.exists()) {
      const { recentUsage = {}, historicUsage = {} } = txnsSnap.data();
      for (const p of ["health","mana","stamina","essence"]) {
        usage7Day[p]    = recentUsage[p]  || 0;
        usageAllTime[p] = historicUsage[p]|| 0;
      }
    }

    const calcRegen = (baseline, usage) => {
      if (usage > baseline * 1.15) return [baseline * 0.95, "overspending"];
      if (usage < baseline * 0.8 ) return [baseline * 1.05, "underspending"];
      return [baseline, "on target"];
    };

    const daysTracked = Math.max(1, Math.floor((Date.now() - VITALS_START_DATE.getTime()) / MS_PER_DAY));
    const elapsedDays = elapsedDaysNow();

    const pools = {};
    for (const pool of ["health","mana","stamina","essence"]) {
      const [regenCurrent, trend] = calcRegen(regenBaseline[pool], usage7Day[pool]);
      const spent = usageAllTime[pool];

      pools[pool] = {
        regenBaseline: Number(regenBaseline[pool].toFixed(2)), // per-day baseline
        regenCurrent:  Number(regenCurrent.toFixed(2)),        // per-day after trend tweak
        usage7Day:     Number(usage7Day[pool].toFixed(2)),
        trend,
        spentToDate:   Number(spent.toFixed(2)),
      };
    }

    await setDoc(doc(db, `players/${uid}/cashflowData/current`), {
      pools,
      dailyAverages: { dailyDisposable: Number(dailyDisposable.toFixed(2)) },
      daysTracked,
      elapsedDays,
      lastSync: new Date().toISOString(),
    }, { merge: true });

  } catch (err) {
    console.error("❌ updateVitalsPools:", err);
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   2) Static snap (no animation) — renders truth → (remainder, surplus)
   ────────────────────────────────────────────────────────────────────────────── */
export async function loadVitalsToHUD(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;
  const elements = getVitalsElements();
  const factor = VIEW_FACTORS[getViewMode()];
  const days   = elapsedDaysNow();

  for (const [pool, v] of Object.entries(pools)) {
    const el = elements[pool];
    if (!el) continue;

    const cap     = (v.regenBaseline ?? 0) * factor;
    const truth   = Math.max(0, (v.regenCurrent ?? 0) * days - (v.spentToDate ?? 0));
    const rem     = cap > 0 ? modCap(truth, cap) : 0;
    const surplus = cap > 0 ? Math.floor(truth / cap) : 0;

    const pct = cap > 0 ? (rem / cap) * 100 : 0;
    el.fill.style.width = `${pct}%`;
    el.value.innerText  = `${rem.toFixed(2)} / ${cap.toFixed(2)}`;
    setSurplusPill(el, surplus, surplus); // no ghost here
  }

  refreshBarGrids();
}

/* ──────────────────────────────────────────────────────────────────────────────
   3) Ghost: live recompute from truth (consumes surplus first)
   ────────────────────────────────────────────────────────────────────────────── */
const MANA_OVERFLOW_MODE = 'health'; // or 'stamina_then_health'

function allocateSpendAgainstTruth(spend, intent, avail) {
  // avail is mutable: {health, mana, stamina, essence} true amounts
  const out = { health:0, mana:0, stamina:0, essence:0 };

  if (spend <= 0) return out;

  if (intent === "mana") {
    const toMana = Math.min(spend, Math.max(0, avail.mana));
    if (toMana > 0) { out.mana += toMana; avail.mana -= toMana; }
    const leftover = spend - toMana;
    if (leftover > 0) {
      if (MANA_OVERFLOW_MODE === "stamina_then_health") {
        const toStamina = Math.min(leftover, Math.max(0, avail.stamina));
        if (toStamina > 0) { out.stamina += toStamina; avail.stamina -= toStamina; }
        const toHealth = leftover - toStamina;
        if (toHealth > 0) { out.health += toHealth; /* health can go below zero truth (we’ll clamp display) */ }
      } else {
        out.health += leftover;
      }
    }
    return out;
  }

  // stamina intent (default)
  const toStamina = Math.min(spend, Math.max(0, avail.stamina));
  if (toStamina > 0) { out.stamina += toStamina; avail.stamina -= toStamina; }
  const toHealth = spend - toStamina;
  if (toHealth > 0) { out.health += toHealth; }
  return out;
}

function sumPools(a, b) {
  return {
    health:  (a.health  || 0) + (b.health  || 0),
    mana:    (a.mana    || 0) + (b.mana    || 0),
    stamina: (a.stamina || 0) + (b.stamina || 0),
    essence: (a.essence || 0) + (b.essence || 0),
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
   4) Animated HUD
   ────────────────────────────────────────────────────────────────────────────── */
export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();

  // Base snapshot
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;
  const elements = getVitalsElements();
  ensureGridLayers(elements);
  ensureReclaimLayers(elements);

  // Initial truth per pool at t0
  const t0Days = elapsedDaysNow();
  const truth = {};
  const regenPerSec = {};
  for (const pool of Object.keys(pools)) {
    const v = pools[pool];
    const base = Math.max(0, (v.regenCurrent ?? 0) * t0Days - (v.spentToDate ?? 0));
    truth[pool] = base;
    regenPerSec[pool] = (v.regenCurrent ?? 0) * (timeMultiplier / SEC_PER_DAY);
  }

  // Live pending set
  let pendingTx = [];

  const pendingQ = query(
    collection(db, `players/${uid}/classifiedTransactions`),
    where("status", "==", "pending")
  );
  onSnapshot(pendingQ, (snapShot) => {
    const nowMs = Date.now();
    pendingTx = snapShot.docs
      .map(normalizeTxn)
      .filter(tx => nowMs < tx.ghostExpiryMs); // only those still ghosting
  });

  // HUD state
  let viewMode = getViewMode();
  let factor   = VIEW_FACTORS[viewMode];

  // On lock batches, snap local truth without waiting for refresh
  window.addEventListener("vitals:locked", (e) => {
    const applied = e?.detail?.appliedTotals;
    if (!applied) return;
    for (const pool of Object.keys(truth)) {
      truth[pool] = Math.max(0, truth[pool] - (applied[pool] || 0));
    }
  });

  // Main loop
  let lastTs = null;
  function frame(ts) {
    if (lastTs === null) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    // 1) True regen
    for (const pool of Object.keys(truth)) {
      truth[pool] = Math.max(0, truth[pool] + regenPerSec[pool] * dt);
    }

    // 2) Compute current pending allocations from *current truth*
    const avail = { ...truth }; // mutable copy for allocation walk
    let pendingTotals = { health:0, mana:0, stamina:0, essence:0 };
    const now = Date.now();
    const ordered = [...pendingTx].sort((a,b)=>a.dateMs - b.dateMs);
    for (const tx of ordered) {
      if (now >= tx.ghostExpiryMs || tx.amount >= 0) continue;
      const spend = Math.abs(tx.amount);
      const intent = previewPool(tx);
      const split = allocateSpendAgainstTruth(spend, intent, avail);
      pendingTotals = sumPools(pendingTotals, split);
    }

    // 3) Render each pool for current mode lens
    factor = VIEW_FACTORS[viewMode]; // in case changed
    for (const pool of Object.keys(pools)) {
      const el = elements[pool];
      if (!el) continue;
      const v  = pools[pool];
      const cap = (v.regenBaseline ?? 0) * factor;

      // Current & predicted truth (after pending)
      const tNow   = truth[pool];
      const tAfter = Math.max(0, tNow - (pendingTotals[pool] || 0));

      const remNow   = cap > 0 ? modCap(tNow,   cap) : 0;
      const remAfter = cap > 0 ? modCap(tAfter, cap) : 0;

      const sNow   = cap > 0 ? Math.floor(tNow   / cap) : 0;
      const sAfter = cap > 0 ? Math.floor(tAfter / cap) : 0;

      // Fill
      const pct = cap > 0 ? (remNow / cap) * 100 : 0;
      el.fill.style.width = `${pct}%`;
      el.value.innerText  = `${remNow.toFixed(2)} / ${cap.toFixed(2)}`;
      setSurplusPill(el, sNow, sAfter);

      // Ghost overlay (only show reduction on the bar remainder)
      const deltaRem = remNow - remAfter; // if negative, remainder would rise → no yellow
      const barEl = el.fill.closest('.bar');
      const reclaimEl = barEl.querySelector('.bar-reclaim');
      if (cap > 0 && deltaRem > 0.0001) {
        const leftPct  = (remAfter / cap) * 100;
        const widthPct = (deltaRem / cap) * 100;
        reclaimEl.style.left    = `${leftPct.toFixed(2)}%`;
        reclaimEl.style.width   = `${widthPct.toFixed(2)}%`;
        reclaimEl.style.opacity = '1';
      } else {
        reclaimEl.style.opacity = '0';
        reclaimEl.style.width   = '0%';
      }

      // Trend classes (unchanged)
      const barC = barEl;
      barC.classList.remove("overspending","underspending");
      if (v.trend === "overspending")   barC.classList.add("overspending");
      if (v.trend === "underspending")  barC.classList.add("underspending");
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Mode switch: fully recompute lens only (truth remains untouched)
  window.addEventListener("vitals:viewmode", (e) => {
    const next = e?.detail?.mode || "daily";
    viewMode = VIEW_MODES.includes(next) ? next : "daily";
    refreshBarGrids();
    // Loop already uses latest factor each frame; no other state needs changing.
  });
}

/* ──────────────────────────────────────────────────────────────────────────────
   5) Lock / expiry: write appliedAllocation, recompute summary, refresh current,
      and notify the running HUD for immediate truth sync.
   ────────────────────────────────────────────────────────────────────────────── */
function roundPools(p) {
  return {
    health:  Number((p.health  || 0).toFixed(2)),
    mana:    Number((p.mana    || 0).toFixed(2)),
    stamina: Number((p.stamina || 0).toFixed(2)),
    essence: Number((p.essence || 0).toFixed(2)),
  };
}

async function recomputeSummary(uid) {
  const db = getFirestore();
  const col = collection(db, `players/${uid}/classifiedTransactions`);

  // Only need confirmed (all time) for spentToDate; optional: 7d for trends
  const confirmedQ = query(col, where("status","==","confirmed"));
  const snap = await getDocs(confirmedQ);

  const all = { health:0, mana:0, stamina:0, essence:0 };
  const recent7 = { health:0, mana:0, stamina:0, essence:0 };
  const since7 = Date.now() - 7 * MS_PER_DAY;

  snap.forEach(d => {
    const tx = d.data();
    const alloc = tx.appliedAllocation || {};
    for (const k of Object.keys(all)) all[k] += Number(alloc[k] || 0);
    const when = tx?.lockedAtMs || tx?.tag?.setAtMs || 0;
    if (when >= since7) {
      for (const k of Object.keys(recent7)) recent7[k] += Number(alloc[k] || 0);
    }
  });

  await setDoc(doc(db, `players/${uid}/classifiedTransactions/summary`), {
    historicUsage: roundPools(all),
    recentUsage: roundPools(recent7),
    updatedAt: Date.now(),
  }, { merge: true });
}

export async function lockExpiredOrOverflow(uid, queueCap = 50) {
  const db = getFirestore();
  const col = collection(db, `players/${uid}/classifiedTransactions`);
  const now = Date.now();

  // 1) Determine which pending to confirm (expiry + overflow)
  const dueSnap = await getDocs(query(col, where("status","==","pending"), where("ghostExpiryMs","<=", now)));
  const pendAsc = await getDocs(query(col, where("status","==","pending"), orderBy("addedMs","asc")));
  const overflowCount = Math.max(0, pendAsc.size - queueCap);

  const toConfirm = [];
  dueSnap.forEach(d => toConfirm.push(d));
  if (overflowCount > 0) {
    let i = 0;
    pendAsc.forEach(d => { if (i++ < overflowCount) toConfirm.push(d); });
  }
  if (!toConfirm.length) return;

  // 2) Compute *current truth* per pool at lock time
  const currentSnap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!currentSnap.exists()) return;
  const pools = currentSnap.data().pools || {};
  const days = elapsedDaysNow();
  const avail = {
    health:  Math.max(0, (pools.health?.regenCurrent  || 0) * days - (pools.health?.spentToDate  || 0)),
    mana:    Math.max(0, (pools.mana?.regenCurrent    || 0) * days - (pools.mana?.spentToDate    || 0)),
    stamina: Math.max(0, (pools.stamina?.regenCurrent || 0) * days - (pools.stamina?.spentToDate || 0)),
    essence: Math.max(0, (pools.essence?.regenCurrent || 0) * days - (pools.essence?.spentToDate || 0)),
  };

  // 3) Walk the chosen docs in order and allocate from *truth* (surplus first)
  toConfirm.sort((a,b) => (a.data()?.addedMs ?? 0) - (b.data()?.addedMs ?? 0));

  const batch = writeBatch(db);
  const appliedTotals = { health:0, mana:0, stamina:0, essence:0 };

  for (const d of toConfirm) {
    const tx = normalizeTxn(d);
    const reason = tx.ghostExpiryMs <= now ? "expiry" : "queue_cap";
    const chosen = tx?.provisionalTag?.pool ?? previewPool(tx) ?? "stamina";

    if (tx.amount >= 0) {
      // Income path: confirm, no appliedAllocation
      batch.update(d.ref, {
        status: "confirmed",
        tag: { pool: chosen, setAtMs: now },
        autoLockReason: reason,
        lockedAtMs: now,
      });
      continue;
    }

    const spend = Math.abs(tx.amount);
    const split = allocateSpendAgainstTruth(spend, chosen, avail); // mutates avail
    for (const k of Object.keys(appliedTotals)) appliedTotals[k] += (split[k] || 0);

    batch.update(d.ref, {
      status: "confirmed",
      tag: { pool: chosen, setAtMs: now },
      autoLockReason: reason,
      lockedAtMs: now,
      appliedAllocation: roundPools(split),
    });
  }

  // 4) Commit + recompute summary + refresh current
  await batch.commit();
  await recomputeSummary(uid);
  await updateVitalsPools(uid);

  // 5) Nudge running HUD truth immediately (so UI snaps without reload)
  window.dispatchEvent(new CustomEvent("vitals:locked", {
    detail: { appliedTotals: roundPools(appliedTotals) }
  }));
}

/* ──────────────────────────────────────────────────────────────────────────────
   6) Update Log + Recently Locked (kept)
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

export function listenRecentlyConfirmed(uid, lookbackMs = 24 * 60 * 60 * 1000, cb) {
  const db = getFirestore();
  const since = Date.now() - lookbackMs;

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
   7) Auto-wire Update Log (unchanged)
   ────────────────────────────────────────────────────────────────────────────── */
export function autoInitUpdateLog() {
  const listEl   = document.querySelector("#update-log-list");
  const recentEl = document.querySelector("#recently-locked-list");
  if (!listEl && !recentEl) return;

  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const uid = user.uid;

    function setActiveButtons(li, pool) {
      const buttons = li.querySelectorAll(".tag-btn");
      buttons.forEach(b => {
        b.classList.remove("active", "stamina", "mana");
        if (b.dataset.pool === pool) b.classList.add("active", pool);
      });
    }

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
          setActiveButtons(li, tag);

          li.querySelectorAll(".tag-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const pool = btn.getAttribute("data-pool");
              setActiveButtons(li, pool);
              await setProvisionalTag(uid, tx.id, pool);
            });
          });

          listEl.appendChild(li);
        });
      });
    }

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

    // Keep your periodic locker
    setInterval(() => lockExpiredOrOverflow(uid, 50), 20_000);
  });
}

/* ──────────────────────────────────────────────────────────────────────────────
   8) DOM helpers (extended to include surplus pill)
   ────────────────────────────────────────────────────────────────────────────── */
function getVitalsElements() {
  const pools = ["health", "mana", "stamina", "essence"];
  const elements = {};
  for (const pool of pools) {
    const root    = document.querySelector(`#vital-${pool}`);
    const barFill = root?.querySelector(`.bar-fill`);
    const barVal  = root?.querySelector(`.bar-value`);
    const label   = root?.querySelector(`.bar-label`);
    const pill    = root?.querySelector(`.bar-surplus`);
    if (barFill && barVal && label && pill) {
      elements[pool] = { fill: barFill, value: barVal, label, pill };
    }
  }
  return elements;
}

function setSurplusPill(el, countNow, countAfter) {
  const pill = el.pill;
  if (!pill) return;
  if (!countNow || countNow <= 0) {
    pill.style.display = "none";
    pill.textContent = "";
    return;
  }
  pill.style.display = "inline-flex";
  // Show predicted drop if different
  if (typeof countAfter === "number" && countAfter !== countNow) {
    pill.textContent = `×${countNow} → ×${Math.max(0, countAfter)}`;
    pill.classList.add("with-next");
  } else {
    pill.textContent = `×${countNow}`;
    pill.classList.remove("with-next");
  }
}

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

/* Grid underlay (unchanged) */
function ensureGridLayers(elements) {
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
function paintBarGrid(gridEl, days) {
  const needed = Math.max(0, (days|0) - 1);
  gridEl.innerHTML = '';
  for (let i = 1; i <= needed; i++) {
    const line = document.createElement('div');
    line.className = 'grid-line';
    line.style.left = ((i / days) * 100).toFixed(4) + '%';
    gridEl.appendChild(line);
  }
}
function refreshBarGrids() {
  const pools = ["health","mana","stamina","essence"];
  for (const pool of pools) {
    const root = document.querySelector(`#vital-${pool}`);
    const barEl = root?.querySelector('.bar');
    if (!barEl) continue;
    let grid = barEl.querySelector('.bar-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'bar-grid';
      const fill = barEl.querySelector('.bar-fill');
      barEl.insertBefore(grid, fill);
    }
    const days = VIEW_FACTORS[getViewMode()];
    paintBarGrid(grid, days);
  }
}

/* Auto-wire left button to cycle mode */
(function wireLeftButtonForViewMode() {
  const run = () => {
    const btn = document.getElementById("left-btn");
    if (!btn) return;
    btn.title = `View: ${getViewMode()}`;
    btn.addEventListener("click", cycleViewMode);
    refreshBarGrids();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
