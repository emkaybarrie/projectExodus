/** 
 * vitals_v11.js
 * ---------------------------------------------------------------------------
 * Truth T = regenCurrent * daysSince(calculationStartDate)
 *           − (spentToDate + seedCarryIfApplicable)
 * ...
 * ---------------------------------------------------------------------------
 */

import {
  getFirestore, doc, getDoc, setDoc, collection, query, where,
  getDocs, orderBy, limit, onSnapshot, updateDoc, writeBatch, deleteDoc, startAfter
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { maybeStartVitalsTour} from "./vitalsTour.js";

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
// match your deployed region for callables
const functions = getFunctions(undefined, "europe-west2");

export async function refreshVitals() {
  const fn = httpsCallable(functions, "vitals_getSnapshot");
  const res = await fn();
  return res.data || {};
}

// Note: keep signature so dashboard's setInterval keeps working
export async function lockExpiredOrOverflow(uid, queueCap = 50) {
  try {
    const fn = httpsCallable(functions, "vitals_lockPending");
    const res = await fn({ queueCap });
    // let the HUD animation react via 'vitals:locked' (as before)
    const payload = res.data || {};
    if (payload.appliedTotals) {
      window.dispatchEvent(new CustomEvent("vitals:locked", { detail: { appliedTotals: payload.appliedTotals }}));
    }
    return payload;
  } catch (e) {
    console.warn("Server lock failed:", e);
    return { locked: 0 };
  }
}

// Optional (safer) server source of truth for Essence monthly
export async function getEssenceAvailableMonthlyFromHUD(uid) {
  try {
    const fn = httpsCallable(functions, "vitals_getEssenceAvailableMonthly");
    const res = await fn();
    return Number(res?.data?.available || 0);
  } catch {
    // fallback to previous local logic if the callable isn't deployed yet
    // (leaving your existing local implementation in place below is fine)
    return 0;
  }
}

// ── Debounced "lock on expiry" trigger + refresh snapshot ───────────────────
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// uid is available later; we bind it inside initVitalsHUD
let __triggerLockSoon = null;


/* ────────────────────────────────────────────────────────────────────────────
   Alias & Level helpers
   ──────────────────────────────────────────────────────────────────────────── */
const db = getFirestore();

const titleEl = document.getElementById("header-title");
const actionsEl = document.getElementById("headerActions");
const moreBtn = document.getElementById("btnMore");
const moreMenu = document.getElementById("moreMenu");

const DEFAULT_TITLE = "VITALS";
const MAX_ALIAS_LEN = 16;          // UI + storage cap
const COLLAPSE_LEN_HINT = 14;      // hint to bias collapse on tiny screens

let unsubPlayer = null;

function collapseActionsIfNeeded() {
  if (!titleEl || !actionsEl) return;
  // start expanded
  actionsEl.classList.remove('is-collapsed');
  // measure overflow
  const overflows = titleEl.scrollWidth > titleEl.clientWidth;
  const tinyScreen = window.innerWidth < 420;
  const nameLen = (titleEl.textContent || '').length;
  const shouldCollapse = overflows || (tinyScreen && nameLen >= COLLAPSE_LEN_HINT);
  actionsEl.classList.toggle('is-collapsed', shouldCollapse);
  // reflect sandwich presence
  if (moreBtn) moreBtn.style.display = actionsEl.classList.contains('is-collapsed') ? 'inline-flex' : 'none';
}

function wireMoreMenu() {
  if (!moreBtn || !moreMenu) return;
  if (!moreBtn.__wired) {
    moreBtn.__wired = true;
    moreBtn.addEventListener('click', () => {
      const isOpen = moreMenu.hidden === false;
      moreMenu.hidden = isOpen;
      moreBtn.setAttribute('aria-expanded', String(!isOpen));
    });
    // proxy clicks back to the original buttons (no regression)
    moreMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-proxy]');
      if (!btn) return;
      const sel = btn.getAttribute('data-proxy');
      const target = document.querySelector(sel);
      if (target) target.click();
      moreMenu.hidden = true;
      moreBtn.setAttribute('aria-expanded', 'false');
    });
    // close on outside click
    document.addEventListener('click', (e) => {
      if (!moreMenu.hidden && !moreMenu.contains(e.target) && e.target !== moreBtn) {
        moreMenu.hidden = true;
        moreBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

export async function startAliasListener(uid) {
  if (unsubPlayer) { unsubPlayer(); unsubPlayer = null; }
  const ref = doc(db, "players", uid);

  wireMoreMenu();

  unsubPlayer = onSnapshot(ref, (snap) => {
    const raw = (snap.exists() && typeof snap.data().alias === "string")
      ? snap.data().alias.trim()
      : "";
    // UI cap to avoid absurdly long names; full value still shown in title tooltip
    const capped = raw.length > MAX_ALIAS_LEN ? raw.slice(0, MAX_ALIAS_LEN) : raw;
    titleEl.textContent = capped || DEFAULT_TITLE;
    titleEl.title = raw || DEFAULT_TITLE;

    // length-based step downs
    titleEl.classList.toggle('is-gt10', (capped.length > 10));
    titleEl.classList.toggle('is-gt12', (capped.length > 12));

    // collapse if needed after paint
    requestAnimationFrame(collapseActionsIfNeeded);
  }, (err) => {
    console.warn("Alias listener error:", err);
    titleEl.textContent = DEFAULT_TITLE;
    requestAnimationFrame(collapseActionsIfNeeded);
  });

  // re-evaluate on resize
  window.addEventListener('resize', () => requestAnimationFrame(collapseActionsIfNeeded));
}

const levelEl = document.getElementById("player-level");
let unsubPlayerLevel = null;

export async function startLevelListener(uid) {
  if (unsubPlayerLevel) { unsubPlayerLevel(); unsubPlayerLevel = null; }
  const ref = doc(db, "players", uid);

  unsubPlayerLevel = onSnapshot(ref, (snap) => {
    let lvl;
    if (snap.exists()) {
      const d = snap.data();
      lvl = Number(d.level ?? d.playerLevel ?? d.stats?.level);
    }
    if (Number.isFinite(lvl)) {
      levelEl.textContent = String(lvl);
      levelEl.hidden = false;
    } else {
      levelEl.hidden = true;
    }
  }, (err) => {
    console.warn("Level listener error:", err);
    levelEl.hidden = true;
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   View mode helpers
   ──────────────────────────────────────────────────────────────────────────── */
const VIEW_MODES   = ["daily", "weekly", "monthly"];
const VIEW_FACTORS = { daily: 1, weekly: 7, monthly: 30.44 };

export function getViewMode() {
  return localStorage.getItem("vitals:viewMode") || "daily";
}
export function setViewMode(mode) {
  const next = VIEW_MODES.includes(mode) ? mode : "daily";
  localStorage.setItem("vitals:viewMode", next);
  const btn = document.getElementById("left-btn");
  if (btn) btn.title = `View: ${next}`;
  window.dispatchEvent(new CustomEvent("vitals:viewmode", { detail: { mode: next }}));
  refreshBarGrids();
  updateModeEngrave(next);
}
export function cycleViewMode() {
  const i = VIEW_MODES.indexOf(getViewMode());
  setViewMode(VIEW_MODES[(i + 1) % VIEW_MODES.length]);
}



/* ────────────────────────────────────────────────────────────────────────────
   Firestore normalizers
   ──────────────────────────────────────────────────────────────────────────── */
function normalizeTxn(docSnap) {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    amount: Number(d?.amount ?? 0), // negative = spend; positive = income
    dateMs: d?.dateMs ?? Date.now(),
    status: d?.status || "pending",
    source: d?.source ?? null,   // <-- ADDED: expose source for filtering
    ghostExpiryMs: d?.ghostExpiryMs ?? 0,
    addedMs: d?.addedMs ?? d?.dateMs ?? Date.now(),
    provisionalTag: { pool: d?.provisionalTag?.pool ?? null, setAtMs: d?.provisionalTag?.setAtMs ?? null },
    tag:           { pool: d?.tag?.pool           ?? null, setAtMs: d?.tag?.setAtMs           ?? null },
    suggestedPool: d?.suggestedPool ?? null,
    rulesVersion:  d?.rulesVersion  ?? null,
    transactionData: {
      description: d?.transactionData?.description ?? "",
      entryDateMs: d?.transactionData?.entryDate?.toMillis?.() ?? null,
    },
    appliedAllocation: d?.appliedAllocation ?? null,
  };
}

//  Add Transaction

export function autoInitAddSpendButton() {
  // NEW: "Add Spend" — opens the Add Transaction modal directly
  const addBtn = document.getElementById('btn-add-spend');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (typeof window.MyFiOpenAddTransaction === 'function') {
        window.MyFiOpenAddTransaction({ variant: 'single' }); // content-only
      } else {
        // Fallback to existing drilldown flow if financesMenu isn’t loaded yet
        // Reuse the existing Finances handler that already opens "Add Transaction"
      // See financesMenu.js: right-btn click -> open('addTransaction', ...)
        document.getElementById('right-btn')?.click();
      }
    });
  }

}


/* ────────────────────────────────────────────────────────────────────────────
   History modal (unchanged)
   ──────────────────────────────────────────────────────────────────────────── */
function friendlySourceLabel(mode) {
  return mode === 'true' ? 'Verified' : 'Manual Entry';
}
async function getHistorySourceFilter(uid) {
  const mode = await getVitalsMode(uid);
  // Base source by mode (stream-aware)
  const base = (mode === 'true') ? 'truelayer' : 'manual';
  // Always include contributions (mode-agnostic)
  const sources = [base, 'stripe', 'manual_bank'];
  return { mode, sources };
}
function renderTxRow(tx) {
  const name = tx?.transactionData?.description || 'Transaction';
  const amt = Number(tx.amount || 0);
  const sign = amt >= 0 ? '+' : '−';
  const abs = Math.abs(amt).toFixed(2);
  const when = tx?.dateMs ? new Date(tx.dateMs).toLocaleString() : '';
  const type = amt >= 0 ? 'income' : 'spend';
  return `
    <li class="tx-row ${type}">
      <div class="ul-row">
        <div class="ul-main">
          <strong>${name}</strong>
          <div class="ul-meta">${sign}£${abs} • ${when}</div>
        </div>
      </div>
    </li>
  `;
}
function historyMenuDef({ uid, sourceLabel, sources  }) {
  return {
    label: 'All Activity',
    title: `All Activity — ${sourceLabel}`,
    render() {
      const wrap = document.createElement('div');

      const controls = document.createElement('div');
      controls.style.display = 'grid';
      controls.style.gridTemplateColumns = '1fr auto';
      controls.style.gap = '8px';
      controls.style.marginBottom = '8px';
      controls.innerHTML = `
        <input id="histSearch" class="input" placeholder="Search description…" />
        <select id="histType" class="input">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="spend">Expenses</option>
        </select>
      `;

      const list = document.createElement('ul');
      list.id = 'histList';
      list.style.listStyle = 'none';
      list.style.padding = '0';
      list.style.margin = '0';

      const more = document.createElement('button');
      more.className = 'btn';
      more.textContent = 'Load more';
      more.style.marginTop = '10px';

      wrap.append(controls, list, more);

      const db = getFirestore();
      const col = collection(db, `players/${uid}/classifiedTransactions`);
      let last = null;
      let loading = false;
      let done = false;
      let cache = [];

      async function fetchPage() {
        if (loading || done) return;
        loading = true;

        let qy = query(
          col,
          where('source', 'in', sources ),
          orderBy('dateMs', 'desc'),
          limit(50)
        );
        if (last) qy = query(qy, startAfter(last));

        const snap = await getDocs(qy);
        if (!snap.size) {
          done = true;
          more.disabled = true;
          if (!cache.length) list.innerHTML = `<li class="ul-meta" style="opacity:.7">No transactions found.</li>`;
          loading = false;
          return;
        }

        const next = [];
        snap.forEach(d => {
          const x = d.data();
          next.push({
            id: d.id,
            amount: Number(x.amount || 0),
            dateMs: x.dateMs || 0,
            transactionData: { description: x?.transactionData?.description || '' }
          });
        });

        cache = cache.concat(next);
        last = snap.docs[snap.docs.length - 1];
        renderFiltered();
        loading = false;
      }

      function renderFiltered() {
        const term = (document.getElementById('histSearch').value || '').toLowerCase().trim();
        const tsel = (document.getElementById('histType').value || '').toLowerCase();
        const filtered = cache.filter(tx => {
          const matchTerm = !term || tx.transactionData.description.toLowerCase().includes(term);
          const matchType = !tsel || (tsel === 'income' ? tx.amount >= 0 : tx.amount < 0);
          return matchTerm && matchType;
        });
        list.innerHTML = filtered.map(renderTxRow).join('');
      }

      wrap.addEventListener('input', (e) => { if (e.target.id === 'histSearch') renderFiltered(); });
      wrap.addEventListener('change', (e) => { if (e.target.id === 'histType') renderFiltered(); });

      fetchPage();
      more.addEventListener('click', fetchPage);

      return [wrap];
    },
    footer() {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = 'Close';
      b.addEventListener('click', () => window.MyFiModal.close());
      return [b];
    }
  };
}
function openHistoryFor() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid;

  (async () => {
    const { mode, sources } = await getHistorySourceFilter(uid);
    const sourceLabel = friendlySourceLabel(mode);
    const def = historyMenuDef({ uid, sourceLabel, sources });
    const menu = { history: def };
    window.MyFiModal.setMenu(menu);
    window.MyFiModal.open('history', { variant: 'single', menuTitle: 'Activity Log' });
  })();
}
export function autoInitHistoryButtons() {
  const btn1 = document.getElementById('btn-expand-update');
  const btn2 = document.getElementById('btn-expand-locked');
  if (btn1) btn1.addEventListener('click', () => openHistoryFor());
  if (btn2) btn2.addEventListener('click', () => openHistoryFor());
}

/* ────────────────────────────────────────────────────────────────────────────
   Seeding helpers
   ──────────────────────────────────────────────────────────────────────────── */
async function getVitalsMode(uid) {
  try {
    const p = await getDoc(doc(db, "players", uid));
    if (p.exists()) {
      const mode = String(p.data().vitalsMode || '').toLowerCase();
      if (['relaxed','standard','focused','true'].includes(mode)) return mode;
    }
  } catch (_) {}
  return 'standard';
}


/* ────────────────────────────────────────────────────────────────────────────
   2) Static HUD paint — seed before first spend; truth uses calc-start + carry
   ──────────────────────────────────────────────────────────────────────────── */
export async function loadVitalsToHUD(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const cur = snap.data() || {};
  const pools = cur.pools || {};
  const elements = getVitalsElements();
  const factor = VIEW_FACTORS[getViewMode()];
  // Enable regen-rate peeking for this snapshot
  installRatePeekHandlers(elements, pools, getViewMode());


  // Use server-provided timing + mode/carry/seed
  const days    = Number(cur.elapsedDays || 0);
  const mode    = String(cur.mode || 'standard').toLowerCase();
  const seed    = cur.seed || null;             // optional — present while in seeding state
  const seedCarry = cur.seedCarry || {};        // present after flip to truth (non-true modes)

  const carryFor = (pool) => (mode === 'true' ? 0 : Number(seedCarry?.[pool] || 0));

  let sumCurrent = 0;
  let sumMax = 0;

  for (const [pool, v] of Object.entries(pools)) {
    const el = elements[pool]; if (!el) continue;
    const cap = (Number(v.regenBaseline || 0)) * factor;

    let rNow, sNow;

    if (seed && seed[pool]) {
      // During seeding: render the seed currents straight
      rNow = Math.max(0, Number(seed[pool].current || 0));
      sNow = 0;
    } else {
      // Truth after flip (server is the source of truth for elapsedDays and seedCarry)
      const T = Math.max(0, (Number(v.regenCurrent || 0) * days) - ((Number(v.spentToDate || 0)) + carryFor(pool)));
      rNow = cap > 0 ? ((T % cap) + cap) % cap : 0;
      sNow = cap > 0 ? Math.floor(T / cap) : 0;
    }

    const pct = cap > 0 ? (rNow / cap) * 100 : 0;
    el.fill.style.width = `${pct}%`;
    const normalText = `${rNow.toFixed(2)} / ${cap.toFixed(2)}`;
    const showRate = el.value.classList.contains('is-rate');
    const rateText = el.value.__rateText || normalText;
    el.value.innerText = showRate ? rateText : normalText;
    setSurplusPill(el, sNow, sNow);

    if (pool === 'health' || pool === 'mana' || pool === 'stamina') {
      sumCurrent += rNow;
      sumMax     += cap;
    }

    const barEl = el.fill.closest('.bar');
    barEl?.classList.remove("overspending","underspending");
    if (v.trend === "overspending")  barEl?.classList.add("overspending");
    if (v.trend === "underspending") barEl?.classList.add("underspending");
  }

  setVitalsTotals(sumCurrent, sumMax);
  refreshBarGrids();
}

/* ────────────────────────────────────────────────────────────────────────────
   3) Animated HUD — truth uses calc-start + carry
   ──────────────────────────────────────────────────────────────────────────── */
export async function initVitalsHUDV1(uid, timeMultiplier = 1) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const cur = snap.data() || {};
  const pools = cur.pools || {};
  const elements = getVitalsElements();
  ensureGridLayers(elements);
  ensureReclaimLayers(elements);
  // Wire regen-rate peeking (uses server-provided pools)
  installRatePeekHandlers(elements, pools, getViewMode());


  const days0   = Number(cur.elapsedDays || 0);
  const mode    = String(cur.mode || 'standard').toLowerCase();
  const seed    = cur.seed || null;
  const seedCarry = cur.seedCarry || {};
  const carryFor = (pool) => (mode === 'true' ? 0 : Number(seedCarry?.[pool] || 0));

  // Authoritative truth T at t0; animation is client-side smoothing only.
  const truth = {};
  const regenPerSec = {};
  for (const pool of Object.keys(pools)) {
    const v = pools[pool];

    if (seed && seed[pool]) {
      truth[pool] = Math.max(0, Number(seed[pool].current || 0));
    } else {
      truth[pool] = Math.max(
        0,
        (Number(v.regenCurrent || 0) * days0) - ((Number(v.spentToDate || 0)) + carryFor(pool))
      );
    }
    regenPerSec[pool] = Number(v.regenCurrent || 0) * (timeMultiplier / 86_400); // per-sec from daily
  }

  // Bind the debounced locker to this user
  __triggerLockSoon = debounce(async () => {
    try {
      await lockExpiredOrOverflow(uid, 50); // server confirms due + overflow
      await refreshVitals();                // pull fresh snapshot for HUD + logs
    } catch (e) {
      console.warn("lock/refresh failed:", e);
    }
  }, 200);

  // Live ghosts (pending)
  let pendingTx = [];
  const pendingQ = query(collection(db, `players/${uid}/classifiedTransactions`), where("status", "==", "pending"));
  onSnapshot(pendingQ, (shot) => {
    const now = Date.now();
    pendingTx = shot.docs.map(d => {
      const x = d.data() || {};
      return {
        id: d.id,
        amount: Number(x.amount || 0),
        dateMs: x.dateMs || 0,
        ghostExpiryMs: x.ghostExpiryMs || 0,
        provisionalTag: x.provisionalTag || null,
        suggestedPool: x.suggestedPool || null,
        transactionData: { description: x?.transactionData?.description || '' },
      };
    })//.filter(tx => now < tx.ghostExpiryMs);
  });

  window.addEventListener("vitals:locked", (e) => {
    const applied = e?.detail?.appliedTotals; if (!applied) return;
    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] - (Number(applied[p] || 0)));
    }
  });

  let viewMode = getViewMode();

  function allocateSpendAcrossPools(spend, intent, availTruth) {
    const out = { health:0, mana:0, stamina:0, essence:0 };
    if (spend <= 0) return out;

    if (intent === "mana") {
      const toMana = Math.min(spend, Math.max(0, availTruth.mana));
      if (toMana > 0) { out.mana += toMana; availTruth.mana -= toMana; }
      const leftover = spend - toMana;
      if (leftover > 0) out.health += leftover; // overflow→health (parity)
      return out;
    }
    const toStamina = Math.min(spend, Math.max(0, availTruth.stamina));
    if (toStamina > 0) { out.stamina += toStamina; availTruth.stamina -= toStamina; }
    const toHealth = spend - toStamina;
    if (toHealth > 0) out.health += toHealth;
    return out;
  }

  function applyRemainderFirst(T, cap, L) {
    if (cap <= 0) return { rNow:0, sNow:0, rAfter:0, sAfter:0, ghostLeftPct:0, ghostWidthPct:0 };
    const sNow = Math.floor(T / cap);
    const rNow = T - sNow * cap;

    if (L <= 0.000001) {
      return { rNow, sNow, rAfter: rNow, sAfter: sNow, ghostLeftPct:0, ghostWidthPct:0 };
    }
    if (L <= rNow) {
      const rAfter = rNow - L;
      return {
        rNow, sNow, rAfter, sAfter: sNow,
        ghostLeftPct: (rAfter / cap) * 100,
        ghostWidthPct: (L / cap) * 100,
      };
    }

    let Lleft = L - rNow;
    let s     = sNow;
    let r     = 0;

    if (s > 0) {
      const whole = Math.min(s, Math.floor(Lleft / cap));
      if (whole > 0) { s -= whole; Lleft -= whole * cap; }
    }
    if (Lleft > 0 && s > 0) { s -= 1; r = cap; }
    const rAfter = Math.max(0, r - Lleft);
    const ghostLeftPct  = (rAfter / cap) * 100;
    const ghostWidthPct = ((r - rAfter) / cap) * 100;
    return { rNow, sNow, rAfter, sAfter: s, ghostLeftPct, ghostWidthPct };
  }

  let last = null;

  // Delay ghost overlay until base bars have painted once
  let allowGhostOverlay = false;
  // flip on after first paint (or just a short beat)
  function enableGhostOverlaySoon() {
    if (!allowGhostOverlay) setTimeout(() => (allowGhostOverlay = true), 60);
  }

  function frame(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;

    // Animate truth by regen
    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] + regenPerSec[p] * dt);
    }

    // Ghost preview application
    const availTruth = { ...truth };
    let pendingTotals = { health:0, mana:0, stamina:0, essence:0 };
    const now = Date.now();
    const ordered = [...pendingTx].sort((a,b)=>a.dateMs - b.dateMs);

    // (A) live countdown tick (emit once per second)
    window.__myfi_lastTickSec ??= 0;
    const sec = Math.floor(now / 1000);
    if (sec !== window.__myfi_lastTickSec) {
      window.__myfi_lastTickSec = sec;
      const ticks = ordered.map(tx => ({
        id: tx.id,
        seconds: Math.max(0, Math.ceil((tx.ghostExpiryMs - now) / 1000))
      }));
      window.dispatchEvent(new CustomEvent("tx:expiry-tick", { detail: { ticks } }));
    } 


    // (B) compute preview + detect expiry
    let hasLocalExpiry = false;
    for (const tx of ordered) {
      const ttl = (tx.ghostExpiryMs - now);
      if (ttl <= 0) {
        hasLocalExpiry = true; // crossed 0: ask server to confirm asap
        continue;              // exclude from preview immediately
      }
      if (tx.amount >= 0) continue; // only spending affects ghosts
      const spend  = Math.abs(tx.amount);
      const intent = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
      const split  = allocateSpendAcrossPools(spend, intent, availTruth);
      pendingTotals = {
        health:  pendingTotals.health  + (split.health  || 0),
        mana:    pendingTotals.mana    + (split.mana    || 0),
        stamina: pendingTotals.stamina + (split.stamina || 0),
        essence: pendingTotals.essence + (split.essence || 0),
      };
    }

    // (C) trigger server lock + refresh if any expired just now
    if (hasLocalExpiry && __triggerLockSoon) __triggerLockSoon();

    const factor = VIEW_FACTORS[viewMode];
    let sumCurrent = 0;
    let sumMax = 0;

    for (const pool of Object.keys(pools)) {
      const el = elements[pool]; if (!el) continue;
      const v  = pools[pool];
      const cap = (Number(v.regenBaseline || 0)) * factor || 0;

      const T = truth[pool];
      const L = pendingTotals[pool] || 0;

      const proj = applyRemainderFirst(T, cap, L);

      // const pctBase = cap > 0 ? (proj.rNow / cap) * 100 : 0;
      // el.fill.style.width = `${pctBase}%`;

      // decide whether to show projected (post-ghost) or current (pre-ghost)
      const useProjected = allowGhostOverlay && cap > 0 && L > 0.0001 && proj.ghostWidthPct > 0.01;

      const pct = cap > 0 ? ((useProjected ? proj.rAfter : proj.rNow) / cap) * 100 : 0;
      el.fill.style.width = `${pct}%`;

      const normalText = `${proj.rAfter.toFixed(2)} / ${cap.toFixed(2)}`;
      const showRate = el.value.classList.contains('is-rate');
      const rateText = el.value.__rateText || normalText;
      el.value.innerText = showRate ? rateText : normalText;
      // after we’ve painted at least once, allow overlay next frames
      enableGhostOverlaySoon();

      setSurplusPill(el, proj.sNow, proj.sAfter);

      const barEl = el.fill.closest('.bar');
      const reclaimEl = barEl.querySelector('.bar-reclaim');

      const showGhost = allowGhostOverlay && cap > 0 && L > 0.0001 && proj.ghostWidthPct > 0.01;

      if (showGhost) {
        reclaimEl.style.left    = `${Math.max(0, Math.min(100, proj.ghostLeftPct)).toFixed(2)}%`;
        reclaimEl.style.width   = `${Math.max(0, Math.min(100, proj.ghostWidthPct)).toFixed(2)}%`;
        reclaimEl.style.opacity = '1';
      } else {
        reclaimEl.style.opacity = '0';
        reclaimEl.style.width   = '0%';
      }

      barEl.classList.remove("overspending","underspending");
      if (v.trend === "overspending")  barEl.classList.add("overspending");
      if (v.trend === "underspending") barEl.classList.add("underspending");

      if (pool === 'health' || pool === 'mana' || pool === 'stamina') {
        // sumCurrent += proj.rAfter;
        sumCurrent += useProjected ? proj.rAfter : proj.rNow;
        sumMax     += cap;
      }
    }

    setVitalsTotals(sumCurrent, sumMax);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("vitals:viewmode", (e) => {
    const next = e?.detail?.mode || "daily";
    viewMode = VIEW_MODES.includes(next) ? next : "daily";
    allowGhostOverlay = false;          // re-gate overlay for new caps
    enableGhostOverlaySoon();
    refreshBarGrids();
    // NEW: keep regen-rate peek text in sync with the new mode
    updateRatePeekTexts(elements, pools, viewMode);
  });

  // Vitals Tour remains unchanged
  maybeStartVitalsTour(uid);
}

export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const cur = snap.data() || {};
  const pools = cur.pools || {};
  const elements = getVitalsElements();
  ensureGridLayers(elements);
  ensureReclaimLayers(elements);
  // Wire regen-rate peeking (uses server-provided pools)
  installRatePeekHandlers(elements, pools, getViewMode());


  const days0   = Number(cur.elapsedDays || 0);
  const mode    = String(cur.mode || 'standard').toLowerCase();
  const seed    = cur.seed || null;
  const seedCarry = cur.seedCarry || {};
  const carryFor = (pool) => (mode === 'true' ? 0 : Number(seedCarry?.[pool] || 0));

  // STREAM-AWARE: only track pending tx from the active stream
  const desiredSource = (mode === 'true') ? 'truelayer' : 'manual';

  // Authoritative truth T at t0; animation is client-side smoothing only.
  const truth = {};
  const regenPerSec = {};
  for (const pool of Object.keys(pools)) {
    const v = pools[pool];

    if (seed && seed[pool]) {
      truth[pool] = Math.max(0, Number(seed[pool].current || 0));
    } else {
      truth[pool] = Math.max(
        0,
        (Number(v.regenCurrent || 0) * days0) - ((Number(v.spentToDate || 0)) + carryFor(pool))
      );
    }
    // per-sec from daily
    regenPerSec[pool] = Number(v.regenCurrent || 0) * (timeMultiplier / 86_400);
  }

  // Bind the debounced locker to this user
  __triggerLockSoon = debounce(async () => {
    try {
      await lockExpiredOrOverflow(uid, 50); // server confirms due + overflow
      await refreshVitals();                // pull fresh snapshot for HUD + logs
    } catch (e) {
      console.warn("lock/refresh failed:", e);
    }
  }, 200);

  // Live ghosts (pending) — STREAM-AWARE QUERY
  let pendingTx = [];
  const pendingQ = query(
    collection(db, `players/${uid}/classifiedTransactions`),
    where("status", "==", "pending"),
    where("source", "==", desiredSource) // <— only active stream
  );
  onSnapshot(pendingQ, (shot) => {
    const now = Date.now();
    pendingTx = shot.docs.map(d => {
      const x = d.data() || {};
      return {
        id: d.id,
        amount: Number(x.amount || 0),
        dateMs: x.dateMs || 0,
        ghostExpiryMs: x.ghostExpiryMs || 0,
        provisionalTag: x.provisionalTag || null,
        suggestedPool: x.suggestedPool || null,
        transactionData: { description: x?.transactionData?.description || '' },
      };
    });
    // If you want to hide already-expired ghosts locally, add:
    // .filter(tx => now < tx.ghostExpiryMs);
  });

  window.addEventListener("vitals:locked", (e) => {
    const applied = e?.detail?.appliedTotals; if (!applied) return;
    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] - (Number(applied[p] || 0)));
    }
  });

  let viewMode = getViewMode();

  function allocateSpendAcrossPools(spend, intent, availTruth) {
    const out = { health:0, mana:0, stamina:0, essence:0 };
    if (spend <= 0) return out;

    if (intent === "mana") {
      const toMana = Math.min(spend, Math.max(0, availTruth.mana));
      if (toMana > 0) { out.mana += toMana; availTruth.mana -= toMana; }
      const leftover = spend - toMana;
      if (leftover > 0) out.health += leftover; // overflow→health (parity)
      return out;
    }
    const toStamina = Math.min(spend, Math.max(0, availTruth.stamina));
    if (toStamina > 0) { out.stamina += toStamina; availTruth.stamina -= toStamina; }
    const toHealth = spend - toStamina;
    if (toHealth > 0) out.health += toHealth;
    return out;
  }

  function applyRemainderFirst(T, cap, L) {
    if (cap <= 0) return { rNow:0, sNow:0, rAfter:0, sAfter:0, ghostLeftPct:0, ghostWidthPct:0 };
    const sNow = Math.floor(T / cap);
    const rNow = T - sNow * cap;

    if (L <= 0.000001) {
      return { rNow, sNow, rAfter: rNow, sAfter: sNow, ghostLeftPct:0, ghostWidthPct:0 };
    }
    if (L <= rNow) {
      const rAfter = rNow - L;
      return {
        rNow, sNow, rAfter, sAfter: sNow,
        ghostLeftPct: (rAfter / cap) * 100,
        ghostWidthPct: (L / cap) * 100,
      };
    }

    let Lleft = L - rNow;
    let s     = sNow;
    let r     = 0;

    if (s > 0) {
      const whole = Math.min(s, Math.floor(Lleft / cap));
      if (whole > 0) { s -= whole; Lleft -= whole * cap; }
    }
    if (Lleft > 0 && s > 0) { s -= 1; r = cap; }
    const rAfter = Math.max(0, r - Lleft);
    const ghostLeftPct  = (rAfter / cap) * 100;
    const ghostWidthPct = ((r - rAfter) / cap) * 100;
    return { rNow, sNow, rAfter, sAfter: s, ghostLeftPct, ghostWidthPct };
  }

  let last = null;

  // Delay ghost overlay until base bars have painted once
  let allowGhostOverlay = false;
  function enableGhostOverlaySoon() {
    if (!allowGhostOverlay) setTimeout(() => (allowGhostOverlay = true), 60);
  }

  function frame(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;

    // Animate truth by regen
    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] + regenPerSec[p] * dt);
    }

    // Ghost preview application
    const availTruth = { ...truth };
    let pendingTotals = { health:0, mana:0, stamina:0, essence:0 };
    const now = Date.now();
    const ordered = [...pendingTx].sort((a,b)=>a.dateMs - b.dateMs);

    // (A) live countdown tick (emit once per second)
    window.__myfi_lastTickSec ??= 0;
    const sec = Math.floor(now / 1000);
    if (sec !== window.__myfi_lastTickSec) {
      window.__myfi_lastTickSec = sec;
      const ticks = ordered.map(tx => ({
        id: tx.id,
        seconds: Math.max(0, Math.ceil((tx.ghostExpiryMs - now) / 1000))
      }));
      window.dispatchEvent(new CustomEvent("tx:expiry-tick", { detail: { ticks } }));
    }

    // (B) compute preview + detect expiry
    let hasLocalExpiry = false;
    for (const tx of ordered) {
      const ttl = (tx.ghostExpiryMs - now);
      if (ttl <= 0) {
        hasLocalExpiry = true; // crossed 0: ask server to confirm asap
        continue;              // exclude from preview immediately
      }
      if (tx.amount >= 0) continue; // only spending affects ghosts
      const spend  = Math.abs(tx.amount);
      const intent = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
      const split  = allocateSpendAcrossPools(spend, intent, availTruth);
      pendingTotals = {
        health:  pendingTotals.health  + (split.health  || 0),
        mana:    pendingTotals.mana    + (split.mana    || 0),
        stamina: pendingTotals.stamina + (split.stamina || 0),
        essence: pendingTotals.essence + (split.essence || 0),
      };
    }

    // (C) trigger server lock + refresh if any expired just now
    if (hasLocalExpiry && __triggerLockSoon) __triggerLockSoon();

    const factor = VIEW_FACTORS[viewMode];
    let sumCurrent = 0;
    let sumMax = 0;

    for (const pool of Object.keys(pools)) {
      const el = elements[pool]; if (!el) continue;
      const v  = pools[pool];
      const cap = (Number(v.regenBaseline || 0)) * factor || 0;

      const T = truth[pool];
      const L = pendingTotals[pool] || 0;

      const proj = applyRemainderFirst(T, cap, L);

      const useProjected = allowGhostOverlay && cap > 0 && L > 0.0001 && proj.ghostWidthPct > 0.01;
      const pct = cap > 0 ? ((useProjected ? proj.rAfter : proj.rNow) / cap) * 100 : 0;
      el.fill.style.width = `${pct}%`;

      const normalText = `${proj.rAfter.toFixed(2)} / ${cap.toFixed(2)}`;
      const showRate = el.value.classList.contains('is-rate');
      const rateText = el.value.__rateText || normalText;
      el.value.innerText = showRate ? rateText : normalText;
      enableGhostOverlaySoon();

      setSurplusPill(el, proj.sNow, proj.sAfter);

      const barEl = el.fill.closest('.bar');
      const reclaimEl = barEl.querySelector('.bar-reclaim');

      const showGhost = allowGhostOverlay && cap > 0 && L > 0.0001 && proj.ghostWidthPct > 0.01;

      if (showGhost) {
        reclaimEl.style.left    = `${Math.max(0, Math.min(100, proj.ghostLeftPct)).toFixed(2)}%`;
        reclaimEl.style.width   = `${Math.max(0, Math.min(100, proj.ghostWidthPct)).toFixed(2)}%`;
        reclaimEl.style.opacity = '1';
      } else {
        reclaimEl.style.opacity = '0';
        reclaimEl.style.width   = '0%';
      }

      barEl.classList.remove("overspending","underspending");
      if (v.trend === "overspending")  barEl.classList.add("overspending");
      if (v.trend === "underspending") barEl.classList.add("underspending");

      if (pool === 'health' || pool === 'mana' || pool === 'stamina') {
        sumCurrent += useProjected ? proj.rAfter : proj.rNow;
        sumMax     += cap;
      }
    }

    setVitalsTotals(sumCurrent, sumMax);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("vitals:viewmode", (e) => {
    const next = e?.detail?.mode || "daily";
    viewMode = VIEW_MODES.includes(next) ? next : "daily";
    allowGhostOverlay = false;          // re-gate overlay for new caps
    enableGhostOverlaySoon();
    refreshBarGrids();
    // NEW: keep regen-rate peek text in sync with the new mode
    updateRatePeekTexts(elements, pools, viewMode);
  });

  // Vitals Tour remains unchanged
  maybeStartVitalsTour(uid);
}

/* ────────────────────────────────────────────────────────────────────────────
   Update Log + Recently Locked + Inline edit (unchanged)
   ──────────────────────────────────────────────────────────────────────────── */
export function listenUpdateLogPending(uid, cb) {
  const db = getFirestore();
  const qy = query(
    collection(db, `players/${uid}/classifiedTransactions`),
    where("status", "==", "pending"),
    orderBy("addedMs", "desc"),
    limit(5)
  );
  return onSnapshot(qy, (snap) => {
    // const items = snap.docs.map(d => ({ id: d.id, ...normalizeTxn(d) }));
    const items = snap.docs.map(normalizeTxn);
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
    // const items = snap.docs.map(d => ({ id: d.id, ...normalizeTxn(d) }));
    const items = snap.docs.map(normalizeTxn);
    cb(items);
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Long-press helper + Inline editor (unchanged)
   ──────────────────────────────────────────────────────────────────────────── */
const LONG_PRESS_MS = 550;

function onLongPress(targetEl, startCb) {
  let timer = null;
  let hasFired = false;

  const start = (ev) => {
    hasFired = false;
    timer = setTimeout(() => {
      hasFired = true;
      startCb(ev);
    }, LONG_PRESS_MS);
  };
  const clear = () => { if (timer) clearTimeout(timer); timer = null; };

  targetEl.addEventListener('mousedown', start);
  targetEl.addEventListener('mouseup', clear);
  targetEl.addEventListener('mouseleave', clear);

  targetEl.addEventListener('touchstart', start, { passive: true });
  targetEl.addEventListener('touchend', clear);
  targetEl.addEventListener('touchcancel', clear);

  targetEl.addEventListener('click', (e) => { if (hasFired) { e.preventDefault(); e.stopPropagation(); } }, true);
}

function mountTxInlineEditor(li, tx, { uid, onDone }) {
  if (tx.status !== "pending") return;

  const main = li.querySelector('.ul-main');
  const actions = li.querySelector('.ul-actions');
  if (!main) return;

  li.classList.add('is-editing');
  if (actions) actions.style.display = 'none';

  const name = tx.transactionData?.description || "";
  const amt = Number(tx.amount || 0);

  const editor = document.createElement('div');
  editor.className = 'ul-editor';
  editor.innerHTML = `
    <div class="ul-edit-fields">
      <label class="ul-edit-row">
        <span class="ul-edit-label">Description</span>
        <input class="ul-edit-input" type="text" value="${name.replace(/"/g,'&quot;')}" />
      </label>
      <label class="ul-edit-row">
        <span class="ul-edit-label">Amount (£)</span>
        <input class="ul-edit-input" type="number" step="0.01" inputmode="decimal" value="${amt}" />
      </label>
    </div>
    <div class="ul-edit-actions">
      <button class="btn-save">Save</button>
      <button class="btn-cancel">Cancel</button>
      <button class="btn-delete">Delete</button>
    </div>
  `;

  editor.style.marginTop = '0.5rem';
  main.appendChild(editor);

  const [descInput, amtInput] = editor.querySelectorAll('.ul-edit-input');
  const btnSave = editor.querySelector('.btn-save');
  const btnCancel = editor.querySelector('.btn-cancel');
  const btnDelete = editor.querySelector('.btn-delete');

  const cleanup = () => {
    editor.remove();
    li.classList.remove('is-editing');
    if (actions) actions.style.display = '';
    onDone && onDone();
  };

  btnCancel.addEventListener('click', cleanup);

  btnSave.addEventListener('click', async () => {
    const nextDesc = (descInput.value || '').trim();
    let nextAmt = Number(amtInput.value);
    if (!Number.isFinite(nextAmt)) nextAmt = amt;

    const wasSpend = amt < 0;
    if (wasSpend && nextAmt > 0) nextAmt = -Math.abs(nextAmt);
    if (!wasSpend && nextAmt < 0) nextAmt = Math.abs(nextAmt);

    try {
      const db = getFirestore();
      await updateDoc(doc(db, `players/${uid}/classifiedTransactions/${tx.id}`), {
        amount: nextAmt,
        transactionData: {
          ...(tx.transactionData || {}),
          description: nextDesc,
        },
        editedAtMs: Date.now(),
      });
    } catch (e) {
      console.warn('Edit failed:', e);
    } finally {
      cleanup();
    }
  });

  btnDelete.addEventListener('click', async () => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, `players/${uid}/classifiedTransactions/${tx.id}`));
    } catch (e) {
      console.warn('Delete failed:', e);
    } finally {
      cleanup();
    }
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Update Log wiring
   ──────────────────────────────────────────────────────────────────────────── */
export function autoInitUpdateLog() {
  const listEl   = document.querySelector("#update-log-list");
  const recentEl = document.querySelector("#recently-locked-list");
  if (!listEl && !recentEl) return;

  const auth = getAuth();
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const uid = user.uid;

    // BEGIN stream filter: choose list source by vitals mode
    const mode = await getVitalsMode(uid); // relaxed|standard|focused|true
    const desiredSource = (mode === 'true') ? 'truelayer' : 'manual';
    // END stream filter

    function setActiveButtons(li, pool) {
      const buttons = li.querySelectorAll(".tag-btn");
      buttons.forEach(b => {
        b.classList.remove("active", "stamina", "mana");
        if (b.dataset.pool === pool) b.classList.add("active", pool);
      });
    }

    if (listEl) {
      listenUpdateLogPending(uid, (items) => {
        // Allow active stream AND contributions from any provider
        const allowed = new Set([desiredSource, "stripe", "manual_bank"]);
        const filtered = items.filter(x => allowed.has(x.source));

        listEl.innerHTML = "";
        if (!filtered.length) {
          const li = document.createElement("li");
          li.textContent = "Nothing pending — nice!";
          listEl.appendChild(li);
          return;
        }

        filtered.forEach(tx => {
          const li = document.createElement("li");
          li.setAttribute('data-tx', tx.id);

          // STEP 2: treat contributions as read-only (Essence-only)
          const isContribution = (tx.source === "stripe" || tx.source === "manual_bank");

          // STEP 3: guard countdown when no ghostExpiryMs present
          const nowMs    = Date.now();
          const hasTTL   = Number.isFinite(Number(tx.ghostExpiryMs));
          const secsLeft = hasTTL ? Math.max(0, Math.floor((Number(tx.ghostExpiryMs) - nowMs) / 1000)) : 0;
          const minLeft  = Math.floor(secsLeft / 60);
          const secLeft  = secsLeft % 60;

          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);

          // For non-contribution pendings, show tag buttons as before
          const tag = tx.provisionalTag?.pool ?? "stamina";
          const actionsHtml = isContribution
            ? `
              <div class="ul-actions one">
                <span class="badge essence" title="Essence">Essence</span>
              </div>
            `
            : `
              <div class="ul-actions two">
                <!-- SWAPPED ORDER + SHORT LABELS -->
                <button class="tag-btn" data-pool="mana"     title="Mana"     aria-label="Mana">M</button>
                <button class="tag-btn" data-pool="stamina"  title="Stamina"  aria-label="Stamina">S</button>
              </div>
            `;

          // Keep countdown span (even for contributions) so tick handler is robust
          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">
                  £${amt} • <span class="countdown">${minLeft}m ${secLeft}s</span> • ${isContribution ? "essence" : tag}
                </div>
              </div>
              ${actionsHtml}
            </div>
          `;

          // Only wire tag buttons for NON-contribution pending items
          if (!isContribution) {
            setActiveButtons(li, tag);
            li.querySelectorAll(".tag-btn").forEach(btn => {
              btn.addEventListener("click", async () => {
                const pool = btn.getAttribute("data-pool");
                setActiveButtons(li, pool);
                await setProvisionalTag(uid, tx.id, pool);
              });
            });

            const mainEl = li.querySelector('.ul-main');
            if (mainEl) {
              onLongPress(mainEl, () => {
                mountTxInlineEditor(li, tx, { uid, onDone: () => {} });
              });
            }
          }

          listEl.appendChild(li);
        });
      });

      // Live countdown updates for pending rows
      window.addEventListener("tx:expiry-tick", (e) => {
        const ticks = e?.detail?.ticks || [];
        for (const { id, seconds } of ticks) {
          const row = listEl?.querySelector(`li[data-tx="${id}"]`);
          if (!row) continue;
          const span = row.querySelector(".countdown");
          if (!span) continue;
          const s = Math.max(0, (Number(seconds) || 0));
          const m = Math.floor(s / 60);
          const r = s % 60;
          span.textContent = `${m}m ${r}s`;
        }
      });
    }

    if (recentEl) {
      listenRecentlyConfirmed(uid, 24 * 60 * 60 * 1000, (items) => {
        // Allow active stream AND contributions from any provider
        const allowed = new Set([desiredSource, 'stripe', 'manual_bank']);
        const filtered = items.filter(x => allowed.has(x.source));

        recentEl.innerHTML = "";
        if (!filtered.length) {
          const li = document.createElement("li");
          li.textContent = "No recent locks.";
          recentEl.appendChild(li);
          return;
        }

        filtered.forEach(tx => {
          const li = document.createElement("li");
          const intentPool = tx.tag?.pool ?? "stamina";
          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);
          const when = tx.tag?.setAtMs ? new Date(tx.tag.setAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          const alloc = tx.appliedAllocation || null;
          let badgesHtml = "";

          if (alloc && typeof tx.amount === "number" && tx.amount < 0) {
            const entries = Object.entries(alloc).filter(([_, v]) => Number(v) > 0);
            const poolOrder = ["stamina","mana","health","essence"];
            entries.sort((a, b) => {
              const [pa, va] = a, [pb, vb] = b;
              if (pa === intentPool && pb !== intentPool) return -1;
              if (pb === intentPool && pa !== intentPool) return 1;
              if (vb !== va) return Number(vb) - Number(va);
              return poolOrder.indexOf(pa) - poolOrder.indexOf(pb);
            });
            badgesHtml = entries.map(([p, v]) => {
              const n = Number(v).toFixed(2);
              return `<span class="badge ${p}" title="${p}: £${n}">${p}</span>`;
            }).join(" ");
          } else {
            badgesHtml = `<span class="badge ${intentPool}">${intentPool}</span>`;
          }

          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • ${when} ${badgesHtml}</div>
              </div>
            </div>
          `;
          recentEl.appendChild(li);
        });
      });
    }

    setInterval(() => lockExpiredOrOverflow(uid, 50), 20_000);
  });
}


/* ────────────────────────────────────────────────────────────────────────────
   DOM helpers
   ──────────────────────────────────────────────────────────────────────────── */
function getVitalsElements() {
  const pools = ["health","mana","stamina","essence"];
  const map = {};
  for (const p of pools) {
    const root = document.querySelector(`#vital-${p}`);
    const fill = root?.querySelector('.bar-fill');
    const val  = root?.querySelector('.bar-value');
    const label= root?.querySelector('.bar-label');
    const pill = root?.querySelector('.bar-surplus');
    if (fill && val && label && pill) map[p] = { fill, value: val, label, pill };
  }
  return map;
}

function setSurplusPill(el, countNow, countAfter) {
  const pill = el.pill; if (!pill) return;

  const barEl = pill.closest('.bar');
  if (barEl) {
    barEl.classList.toggle('has-surplus', (countAfter || 0) > 0);
  }

  const shouldShow = (countNow || 0) > 0 || (countAfter || 0) > 0;
  if (!shouldShow) {
    pill.style.display = "none";
    pill.textContent = "";
    pill.classList.remove("with-next","pill-up","pill-down");
    return;
  }

  pill.style.display = "inline-flex";

  pill.classList.remove("pill-up","pill-down");
  if (typeof countAfter === "number" && typeof countNow === "number" && countAfter !== countNow) {
    if (countAfter > countNow) pill.classList.add("pill-up");
    else                       pill.classList.add("pill-down");
    pill.textContent = `×${Math.max(0,countNow)} → ×${Math.max(0,countAfter)}`;
    pill.classList.add("with-next");
  } else {
    pill.textContent = `×${Math.max(0,countNow)}`;
    pill.classList.remove("with-next");
  }
}

function ensureReclaimLayers(elements) {
  for (const p of Object.keys(elements)) {
    const bar = elements[p]?.fill?.closest('.bar'); if (!bar) continue;
    if (!bar.querySelector('.bar-reclaim')) {
      const seg = document.createElement('div');
      seg.className = 'bar-reclaim';
      bar.appendChild(seg);
    }
  }
}
function ensureGridLayers(elements) {
  const days = VIEW_FACTORS[getViewMode()];
  for (const p of Object.keys(elements)) {
    const bar = elements[p]?.fill?.closest('.bar'); if (!bar) continue;
    let grid = bar.querySelector('.bar-grid');
    if (!grid) {
      grid = document.createElement('div'); grid.className = 'bar-grid';
      bar.insertBefore(grid, elements[p].fill);
    }
    paintBarGrid(grid, days);
  }
}
function paintBarGrid(gridEl, days) {
  const needed = Math.max(0, (days|0) - 1); gridEl.innerHTML = '';
  for (let i=1; i<=needed; i++) {
    const line = document.createElement('div');
    line.className = 'grid-line';
    line.style.left = ((i / days) * 100).toFixed(4) + '%';
    gridEl.appendChild(line);
  }
}
function refreshBarGrids() {
  const pools = ["health","mana","stamina","essence"];
  for (const p of pools) {
    const root = document.querySelector(`#vital-${p}`);
    const bar  = root?.querySelector('.bar');
    if (!bar) continue;
    let grid = bar.querySelector('.bar-grid');
    if (!grid) {
      grid = document.createElement('div'); grid.className = 'bar-grid';
      const fill = bar.querySelector('.bar-fill'); bar.insertBefore(grid, fill);
    }
    paintBarGrid(grid, VIEW_FACTORS[getViewMode()]);
  }
}
function updateModeEngrave(mode = getViewMode()){
  const row = document.getElementById('mode-engrave'); if (!row) return;
  const key = String(mode).toLowerCase();
  row.querySelectorAll('.mode-btn').forEach(btn => {
    const is = btn.dataset.mode === key;
    btn.classList.toggle('is-active', is);
    btn.setAttribute('aria-selected', is ? 'true' : 'false');
  });
}

function formatNum(n){ return (Math.round(n)||0).toLocaleString('en-GB'); }

function setVitalsTotals(currentTotal, maxTotal){
  const el = document.getElementById('vitals-total');
  if (!el) return;
  el.innerHTML = `
    <span class="label">Total</span>
    <span class="vital-value">${formatNum(currentTotal)}</span>
    <span class="sep">/</span>
    <span class="vital-max">${formatNum(maxTotal)}</span>
  `;
}

// ────────────────────────────────────────────────────────────────────────────
// Regen-rate peek helpers
// ────────────────────────────────────────────────────────────────────────────
function rateTextForMode(regenCurrentPerDay, mode = getViewMode()) {
  const perDay = Number(regenCurrentPerDay || 0);
  switch (String(mode).toLowerCase()) {
    case 'daily':   return `+${(perDay/24).toFixed(2)}/hr`;   // show hourly
    case 'weekly':  return `+${(perDay).toFixed(2)}/day`;     // show daily
    case 'monthly': return `+${(perDay*7).toFixed(2)}/wk`;    // show weekly
    default:        return `+${(perDay/24).toFixed(2)}/hr`;
  }
}

/**
 * Compute and stash rate texts on each bar-value, and wire hover/tap to peek them.
 * - Desktop: on pointerenter we swap to rate; pointerleave restores.
 * - Mobile: on touchstart/click we show rate for ~1.5s then restore.
 */
function installRatePeekHandlers(elements, pools, mode = getViewMode()) {
  const POOLS = Object.keys(pools || {});
  for (const p of POOLS) {
    const el = elements[p]; if (!el?.value) continue;
    const v  = pools[p] || {};
    const rate = rateTextForMode(v.regenCurrent, mode);
    console.log(`Regen peek for ${p}:`, rate);

    // Stash originals + computed alt
    el.value.__origText = el.value.textContent;
    el.value.__rateText = rate;
    el.value.title = `Regen: ${rate}`;  // native tooltip on desktop

    // Guard: only wire once
    if (el.value.__rateWired) continue;
    el.value.__rateWired = true;

    const bar = el.value.closest('.bar');

    // swap helpers
    const show = () => {
      if (!el.value) return;
      el.value.textContent = el.value.__rateText;
      el.value.classList.add('is-rate');
    };
    const hide = () => {
      if (!el.value) return;
      el.value.textContent = el.value.__origText;
      el.value.classList.remove('is-rate');
    };

    // Desktop hover/focus
    bar.addEventListener('pointerenter', show);
    bar.addEventListener('pointerleave', hide);
    bar.addEventListener('focusin', show);
    bar.addEventListener('focusout', hide);

    // Mobile quick peek (tap)
    let tapTimer = null;
    bar.addEventListener('click', () => {
      show();
      clearTimeout(tapTimer);
      tapTimer = setTimeout(hide, 1500);
    }, { passive: true });
    bar.addEventListener('touchstart', () => {
      show();
      clearTimeout(tapTimer);
      tapTimer = setTimeout(hide, 1500);
    }, { passive: true });
  }
}

/** Recompute texts when the view mode changes (e.g., Daily→Weekly). */
function updateRatePeekTexts(elements, pools, mode = getViewMode()) {
  for (const p of Object.keys(pools || {})) {
    const el = elements[p]; if (!el?.value) continue;
    const v  = pools[p] || {};
    el.value.__rateText = rateTextForMode(v.regenCurrent, mode);
    // keep title in sync too
    el.value.title = `Regen: ${el.value.__rateText}`;
    // if the user is currently peeking, refresh the visible text
    if (el.value.classList.contains('is-rate')) {
      el.value.textContent = el.value.__rateText;
    }
  }
}





/* ────────────────────────────────────────────────────────────────────────────
   Mode UI wiring
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  const run = () => {
    const btn = document.getElementById("left-btn");
    if (btn) {
      btn.title = `View: ${getViewMode()}`;
      btn.addEventListener("click", cycleViewMode);
    }

    const engrave = document.getElementById("mode-engrave");
    if (engrave) {
      engrave.addEventListener("click", (ev) => {
        const b = ev.target.closest(".mode-btn");
        if (!b || !engrave.contains(b)) return;
        const mode = b.dataset.mode;
        if (mode) setViewMode(mode);
      });
      engrave.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const b = ev.target.closest(".mode-btn");
        if (!b || !engrave.contains(b)) return;
        ev.preventDefault();
        const mode = b.dataset.mode;
        if (mode) setViewMode(mode);
      });
    }

    refreshBarGrids();
    updateModeEngrave(getViewMode());
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
