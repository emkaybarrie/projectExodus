/** 
 * vitals_v10.js
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
const VIEW_FACTORS = { daily: 1, weekly: 7, monthly: 30 };

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
   Time + math
   ──────────────────────────────────────────────────────────────────────────── */
const MS_PER_DAY  = 86_400_000;
const SEC_PER_DAY = 86_400;

// Cached startDate ms (confirmed only)
let START_MS = null;
let START_CONFIRMED = false;

async function ensureStartMs(uid) {
  if (START_CONFIRMED && START_MS !== null) return START_MS;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const pSnap = await getDoc(doc(db, "players", uid));
      if (pSnap.exists()) {
        const raw = pSnap.data()?.startDate;
        if (raw?.toMillis) {
          START_MS = raw.toMillis(); START_CONFIRMED = true; return START_MS;
        } else if (raw instanceof Date) {
          START_MS = raw.getTime(); START_CONFIRMED = true; return START_MS;
        } else if (typeof raw === "number") {
          START_MS = raw; START_CONFIRMED = true; return START_MS;
        }
      }
    } catch (e) {
      console.warn("ensureStartMs read failed:", e);
    }
    await new Promise(r => setTimeout(r, 120));
  }
  return Date.now(); // non-cached fallback; we’ll retry later
}

// calculationStartDate = 1st day of the player’s start month
function calcStartMsFromStartDate(startMs) {
  const d = new Date(startMs);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

async function elapsedDaysFromCalcStart(uid) {
  const startMs = await ensureStartMs(uid);
  const calcStart = calcStartMsFromStartDate(startMs);
  return Math.max(0, (Date.now() - calcStart) / MS_PER_DAY);
}
async function daysTrackedFromCalcStart(uid) {
  const startMs = await ensureStartMs(uid);
  const calcStart = calcStartMsFromStartDate(startMs);
  return Math.max(1, Math.floor((Date.now() - calcStart) / MS_PER_DAY));
}

// Helpers for seeding floors
function sameYMD(aMs, bMs) {
  const a = new Date(aMs), b = new Date(bMs);
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function fractionOfDay(ms) {
  const d = new Date(ms);
  const sod = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.min(1, (ms - sod) / MS_PER_DAY));
}
function monthProgressNow() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextStart  = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  const n = Math.round((nextStart - monthStart) / MS_PER_DAY);  // days in month
  const elapsed = Math.max(0, Math.min(n, (Date.now() - monthStart) / MS_PER_DAY)); // fractional days since month start
  const f = elapsed / n;                                        // 0..1 including partial day
  const d = Math.floor(elapsed) + 1;                            // human day-of-month (1..n)

  return { n, d, f };
}

function modCap(x, cap) {
  if (cap <= 0) return 0;
  const m = x % cap;
  return m < 0 ? m + cap : m;
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
function previewPool(tx) {
  return tx.provisionalTag?.pool ?? tx.suggestedPool ?? "stamina";
}

/* ────────────────────────────────────────────────────────────────────────────
   History modal (unchanged)
   ──────────────────────────────────────────────────────────────────────────── */
function friendlySourceLabel(mode) {
  return mode === 'true' ? 'Verified' : 'Manual Entry';
}
async function getHistorySourceFilter(uid) {
  const mode = await getVitalsMode(uid);
  const src = (mode === 'true') ? 'truelayer' : 'manual';
  return { mode, src };
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
function historyMenuDef({ uid, sourceLabel, src }) {
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
          where('source', '==', src),
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
    const { mode, src } = await getHistorySourceFilter(uid);
    const sourceLabel = friendlySourceLabel(mode);
    const def = historyMenuDef({ uid, sourceLabel, src });
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
      if (['safe','accelerated','manual','true'].includes(mode)) return mode;
    }
  } catch (_) {}
  return 'safe';
}
function shouldApplySeed(pools) {
  const z = (x)=>!x || Math.abs(Number(x)) < 0.000001;
  return z(pools?.health?.spentToDate) &&
         z(pools?.mana?.spentToDate) &&
         z(pools?.stamina?.spentToDate) &&
         z(pools?.essence?.spentToDate);
}
async function getPoolShares(uid, pools) {
  try {
    const snap = await getDoc(doc(getFirestore(), `players/${uid}/cashflowData/poolAllocations`));
    if (snap.exists()) {
      const d = snap.data() || {};
      const mana    = Number(d.manaAllocation    ?? 0);
      const stamina = Number(d.staminaAllocation ?? 0);
      const essence = Number(d.essenceAllocation ?? 0);
      const sum = mana + stamina + essence;
      if (sum > 0) return { mana: mana/sum, stamina: stamina/sum, essence: essence/sum };
    }
  } catch (_) {}
  const m1 = Number(pools?.mana?.regenBaseline    || 0);
  const s1 = Number(pools?.stamina?.regenBaseline || 0);
  const e1 = Number(pools?.essence?.regenBaseline || 0);
  const sum = m1 + s1 + e1;
  return sum > 0 ? { mana: m1/sum, stamina: s1/sum, essence: e1/sum } : { mana: 0, stamina: 0, essence: 0 };
}

// Seed currents: month progress = NOW; day-1 fractional from startDate
async function computeSeedCurrents(uid, pools, mode, startMs, { p = 0.6 } = {}) {
  // fractional days since calculationStartDate (first of the start month)
  const calcStart = calcStartMsFromStartDate(startMs);
  const daysAccrued = Math.max(0, (Date.now() - calcStart) / MS_PER_DAY);

  // day-1 fractional (for floors that depend on the *signup* day)
  const fracDay1 = fractionOfDay(startMs);
  const isDay1   = sameYMD(startMs, Date.now());

  // daily baselines
  const h1 = Number(pools?.health?.regenBaseline   || 0);
  const m1 = Number(pools?.mana?.regenBaseline     || 0);
  const s1 = Number(pools?.stamina?.regenBaseline  || 0);
  const e1 = Number(pools?.essence?.regenBaseline  || 0);

  // accrued maxima up to now (calc-start anchored, includes partial day)
  const Hmax = h1 * daysAccrued;
  const Mmax = m1 * daysAccrued;
  const Smax = s1 * daysAccrued;
  const Emax = e1 * daysAccrued;

  // ── SAFE floors (unchanged semantics) ─────────────────────────────────────
  const fracOnly    = (x1) => x1 * fracDay1;
  const onePlusFrac = (x1) => x1 * (1 + fracDay1);

  const manaSafe     = isDay1 ? fracOnly(m1)    : onePlusFrac(m1);
  const staminaSafe  = isDay1 ? fracOnly(s1)    : onePlusFrac(s1);
  const essenceSafe  = isDay1 ? fracOnly(e1)    : onePlusFrac(e1);

  if (mode !== 'accelerated') {
    return {
      health:  { current: Hmax,                         max: Hmax },
      mana:    { current: Math.min(Mmax, manaSafe),     max: Mmax },
      stamina: { current: Math.min(Smax, staminaSafe),  max: Smax },
      essence: { current: Math.min(Emax, essenceSafe),  max: Emax },
    };
  }

  // ── ACCELERATED ───────────────────────────────────────────────────────────
  const manaFloorAccel    = isDay1 ? fracOnly(m1) : 0;
  const staminaFloorAccel = isDay1 ? fracOnly(s1) : 0;
  const essenceFloorAccel = isDay1 ? fracOnly(e1) : 0;

  // total discretionary accrued so far (calc-start anchored)
  const Dsum = m1 + s1 + e1;
  const A    = Dsum * daysAccrued;

  // remaining (1-p) to split
  const R = Math.max(0, A * (1 - Math.max(0, Math.min(1, p))));

  const shares = await getPoolShares(uid, pools);
  const addM = R * (shares.mana    || 0);
  const addS = R * (shares.stamina || 0);
  const addE = R * (shares.essence || 0);

  const manaCur    = Math.min(Mmax, manaFloorAccel    + addM);
  const staminaCur = Math.min(Smax, staminaFloorAccel + addS);
  const essenceCur = Math.min(Emax, essenceFloorAccel + addE);

  return {
    health:  { current: Hmax,       max: Hmax },
    mana:    { current: manaCur,    max: Mmax },
    stamina: { current: staminaCur, max: Smax },
    essence: { current: essenceCur, max: Emax },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Manual-mode helpers
   ──────────────────────────────────────────────────────────────────────────── */
function manualWindowFromStart(startMs) {
  const d = new Date(startMs);
  const startMonthStartMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return { startMonthStartMs, startDateMs: startMs };
}
async function hasPostStartSpend(uid, startMs) {
  const db = getFirestore();
  const col = collection(db, `players/${uid}/classifiedTransactions`);
  const qy  = query(
    col,
    where('status','==','confirmed'),
    where('amount','<', 0),
    where('dateMs','>=', startMs),
    limit(1)
  );
  const snap = await getDocs(qy);
  return !!snap.size;
}
async function readManualOpeningSummary(uid) {
  const db = getFirestore();
  const sumSnap = await getDoc(doc(db, `players/${uid}/manualSeed/openingSummary`));
  if (!sumSnap.exists()) return null;
  const d = sumSnap.data() || {};
  return {
    total: Number(d.totalPrestartDiscretionary || 0),
    manaPct: Number(d.split?.manaPct ?? 0.4),
    staminaPct: Number(d.split?.staminaPct ?? 0.6),
  };
}
async function sumManualItemised(uid, windowStart, windowEnd) {
  const db = getFirestore();
  const col = collection(db, `players/${uid}/classifiedTransactions`);
  const qy  = query(
    col,
    where('isPrestart','==',true),
    where('dateMs','>=', windowStart),
    where('dateMs','<',  windowEnd)
  );
  const snap = await getDocs(qy);
  let Pmana = 0, Pstamina = 0;
  snap.forEach(d => {
    const tx = d.data() || {};
    const amt = Number(tx.amount || 0);
    if (amt >= 0) return;
    const spend = Math.abs(amt);
    const pool  = tx?.provisionalTag?.pool ?? tx?.tag?.pool ?? 'stamina';
    if (pool === 'mana') Pmana += spend; else Pstamina += spend;
  });
  return { Pmana, Pstamina };
}
async function applyManualAdjustments(uid, accelSeed, startMs) {
  const { startMonthStartMs, startDateMs } = manualWindowFromStart(startMs);

  const summary = await readManualOpeningSummary(uid);
  let Pmana = 0, Pstamina = 0;

  if (summary && summary.total > 0) {
    Pmana    += summary.total * (summary.manaPct || 0);
    Pstamina += summary.total * (summary.staminaPct || 0);
  }

  const itemised = await sumManualItemised(uid, startMonthStartMs, startDateMs);
  Pmana    += itemised.Pmana;
  Pstamina += itemised.Pstamina;

  const H0 = accelSeed.health.current;
  const M0 = accelSeed.mana.current;
  const S0 = accelSeed.stamina.current;

  const S1    = Math.max(0, S0 - Pstamina);
  const spill = Math.max(0, Pstamina - S0);
  const M1    = Math.max(0, M0 - (Pmana + spill));

  return {
    health:  { current: H0, max: accelSeed.health.max },
    mana:    { current: M1, max: accelSeed.mana.max },
    stamina: { current: S1, max: accelSeed.stamina.max },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Seed → Truth carry (calc-start anchored)
   ──────────────────────────────────────────────────────────────────────────── */
async function ensureSeedCarryOnFlip(uid, pools, mode, startMs, snap) {
  const existing = (snap.data()?.seedCarry) || null;
  if (existing && Object.keys(existing).length) return existing;

  if (mode === 'true') return {}; // ignore seeding/carry in true mode

  // Build seed-as-of-now
  let seed = null;
  if (mode === 'manual') {
    const anyPostStart = await hasPostStartSpend(uid, startMs);
    if (!anyPostStart) {
      const accel = await computeSeedCurrents(uid, pools, 'accelerated', startMs, { p: 0.6 });
      seed = await applyManualAdjustments(uid, accel, startMs);
    }
  } else if (mode === 'safe' || mode === 'accelerated') {
    seed = await computeSeedCurrents(uid, pools, mode, startMs, { p: 0.6 });
  }
  if (!seed) return {};

  const days = await elapsedDaysFromCalcStart(uid); // from calculationStartDate
  const out = {};
  for (const k of Object.keys(pools)) {
    const accrued = (pools[k]?.regenCurrent || 0) * days;
    const seedCur = Math.max(0, seed?.[k]?.current || 0);
    out[k] = Math.max(0, accrued - seedCur);
  }

  await setDoc(doc(db, `players/${uid}/cashflowData/current`), { seedCarry: out }, { merge: true });
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   1) Snapshot writer — calc-start anchored
   ──────────────────────────────────────────────────────────────────────────── */
export async function updateVitalsPools(uid) {
  const db = getFirestore();
  try {
    const currentRef  = doc(db, `players/${uid}/cashflowData/current`);
    const currentSnap = await getDoc(currentRef);
    let existingCarry = (currentSnap.exists && currentSnap.data()?.seedCarry) || {};

    const dailyAveragesSnap = await getDoc(doc(db, `players/${uid}/cashflowData/dailyAverages`));
    const poolAllocationsSnap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));
    if (!dailyAveragesSnap.exists() || !poolAllocationsSnap.exists()) return;

    const { dIncome, dCoreExpenses } = dailyAveragesSnap.data();
    const { healthAllocation, manaAllocation, staminaAllocation, essenceAllocation } = poolAllocationsSnap.data();
    const dailyDisposable = dIncome - dCoreExpenses;

    const regenBaseline = {
      health:  dailyDisposable * healthAllocation,
      mana:    dailyDisposable * manaAllocation,
      stamina: dailyDisposable * staminaAllocation,
      essence: dailyDisposable * essenceAllocation,
    };

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

    const daysTracked = await daysTrackedFromCalcStart(uid);
    const elapsedDays = await elapsedDaysFromCalcStart(uid);

    const pools = {};
    for (const pool of ["health","mana","stamina","essence"]) {
      const [regenCurrent, trend] = calcRegen(regenBaseline[pool], usage7Day[pool]);
      const spent = usageAllTime[pool];
      pools[pool] = {
        regenBaseline: Number(regenBaseline[pool].toFixed(2)),
        regenCurrent:  Number(regenCurrent.toFixed(2)),
        usage7Day:     Number(usage7Day[pool].toFixed(2)),
        trend,
        spentToDate:   Number(spent.toFixed(2)),
      };
    }

    // If we’ve flipped to truth and carry is still missing, compute once
    let seedCarry = existingCarry;
    if (!seedCarry || Object.keys(seedCarry).length === 0) {
      const startMs = await ensureStartMs(uid);
      const mode    = await getVitalsMode(uid);
      let seeding = false;
      if (mode === 'safe' || mode === 'accelerated') {
        seeding = shouldApplySeed(pools);
      } else if (mode === 'manual') {
        seeding = !(await hasPostStartSpend(uid, startMs));
      }
      if (!seeding && mode !== 'true') {
        let seedNow = null;
        if (mode === 'manual') {
          const accel = await computeSeedCurrents(uid, pools, 'accelerated', startMs, { p: 0.6 });
          seedNow = await applyManualAdjustments(uid, accel, startMs);
        } else {
          seedNow = await computeSeedCurrents(uid, pools, mode, startMs, { p: 0.6 });
        }
        if (seedNow) {
          const days = await elapsedDaysFromCalcStart(uid);
          seedCarry = {};
          for (const k of Object.keys(pools)) {
            const accrued = (pools[k].regenCurrent || 0) * days;
            const seedCur = Math.max(0, seedNow?.[k]?.current || 0);
            seedCarry[k] = Math.max(0, accrued - seedCur);
          }
        }
      }
    }

    await setDoc(currentRef, {
      pools,
      dailyAverages: { dailyDisposable: Number(dailyDisposable.toFixed(2)) },
      daysTracked,
      elapsedDays,
      lastSync: new Date().toISOString(),
      ...(seedCarry && Object.keys(seedCarry).length ? { seedCarry } : {}),
    }, { merge: true });
  } catch (e) {
    console.error("updateVitalsPools:", e);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   2) Static HUD paint — seed before first spend; truth uses calc-start + carry
   ──────────────────────────────────────────────────────────────────────────── */
export async function loadVitalsToHUD(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;
  const elements = getVitalsElements();
  const factor = VIEW_FACTORS[getViewMode()];

  const startMs = await ensureStartMs(uid);
  const days    = await elapsedDaysFromCalcStart(uid);

  const mode = await getVitalsMode(uid);
  let seed = null;

  if ((mode === 'safe' || mode === 'accelerated') && shouldApplySeed(pools)) {
    seed = await computeSeedCurrents(uid, pools, mode, startMs, { p: 0.6 });
  } else if (mode === 'manual') {
    const anyPostStart = await hasPostStartSpend(uid, startMs);
    if (!anyPostStart) {
      const accel = await computeSeedCurrents(uid, pools, 'accelerated', startMs, { p: 0.6 });
      seed = await applyManualAdjustments(uid, accel, startMs);
    }
  }

  let seedCarry = (snap.data()?.seedCarry) || {};
  if (!seed && Object.keys(seedCarry).length === 0 && mode !== 'true') {
    seedCarry = await ensureSeedCarryOnFlip(uid, pools, mode, startMs, snap);
  }
  const carryFor = (pool) => (mode === 'true' ? 0 : Number((seedCarry?.[pool] || 0)));

  let sumCurrent = 0;
  let sumMax = 0;

  for (const [pool, v] of Object.entries(pools)) {
    const el = elements[pool]; if (!el) continue;
    const cap   = (v.regenBaseline ?? 0) * factor;

    let rNow, sNow;

    if (seed && seed[pool]) {
      rNow = Math.max(0, seed[pool].current);
      sNow = 0;
    } else {
      const T = Math.max(0, (v.regenCurrent ?? 0) * days - ((v.spentToDate ?? 0) + carryFor(pool)));
      rNow  = cap > 0 ? modCap(T, cap) : 0;
      sNow  = cap > 0 ? Math.floor(T / cap) : 0;
    }

    const pct = cap > 0 ? (rNow / cap) * 100 : 0;
    el.fill.style.width = `${pct}%`;
    el.value.innerText  = `${rNow.toFixed(2)} / ${cap.toFixed(2)}`;
    setSurplusPill(el, sNow, sNow);

    if (pool === 'health' || pool === 'mana' || pool === 'stamina') {
      sumCurrent += rNow;
      sumMax     += cap;
    }
  }

  setVitalsTotals(sumCurrent, sumMax);
  refreshBarGrids();
}

/* ────────────────────────────────────────────────────────────────────────────
   3) Ghost allocation helpers
   ──────────────────────────────────────────────────────────────────────────── */
const MANA_OVERFLOW_MODE = 'health'; // or 'stamina_then_health'

function allocateSpendAcrossPools(spend, intent, availTruth) {
  const out = { health:0, mana:0, stamina:0, essence:0 };
  if (spend <= 0) return out;

  if (intent === "mana") {
    const toMana = Math.min(spend, Math.max(0, availTruth.mana));
    if (toMana > 0) { out.mana += toMana; availTruth.mana -= toMana; }
    const leftover = spend - toMana;
    if (leftover > 0) {
      if (MANA_OVERFLOW_MODE === "stamina_then_health") {
        const toStamina = Math.min(leftover, Math.max(0, availTruth.stamina));
        if (toStamina > 0) { out.stamina += toStamina; availTruth.stamina -= toStamina; }
        const toHealth = leftover - toStamina;
        if (toHealth > 0) out.health += toHealth;
      } else {
        out.health += leftover;
      }
    }
    return out;
  }

  const toStamina = Math.min(spend, Math.max(0, availTruth.stamina));
  if (toStamina > 0) { out.stamina += toStamina; availTruth.stamina -= toStamina; }
  const toHealth = spend - toStamina;
  if (toHealth > 0) out.health += toHealth;
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

/* ────────────────────────────────────────────────────────────────────────────
   3.5) Remainder-first projection
   ──────────────────────────────────────────────────────────────────────────── */
function applyRemainderFirst(T, cap, L) {
  if (cap <= 0) return { rNow:0, sNow:0, rAfter:0, sAfter:0, ghostLeftPct:0, ghostWidthPct:0 };

  const sNow = Math.floor(T / cap);
  const rNow = T - sNow * cap;

  if (L <= 0.000001) {
    return {
      rNow, sNow, rAfter: rNow, sAfter: sNow,
      ghostLeftPct: 0, ghostWidthPct: 0
    };
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
    if (whole > 0) {
      s -= whole;
      Lleft -= whole * cap;
    }
  }

  if (Lleft > 0 && s > 0) {
    s -= 1;     // consume one unit to refill
    r  = cap;   // full bar
  }

  const rAfter = Math.max(0, r - Lleft);
  const ghostLeftPct  = (rAfter / cap) * 100;
  const ghostWidthPct = ((r - rAfter) / cap) * 100;

  return { rNow, sNow, rAfter, sAfter: s, ghostLeftPct, ghostWidthPct };
}

/* ────────────────────────────────────────────────────────────────────────────
   4) Animated HUD — truth uses calc-start + carry
   ──────────────────────────────────────────────────────────────────────────── */
export async function initVitalsHUD(uid, timeMultiplier = 1) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const pools = snap.data().pools;
  const elements = getVitalsElements();
  ensureGridLayers(elements);
  ensureReclaimLayers(elements);

  const startMs = await ensureStartMs(uid);
  const days0   = await elapsedDaysFromCalcStart(uid);

  const mode = await getVitalsMode(uid);
  let seed = null;

  if ((mode === 'safe' || mode === 'accelerated') && shouldApplySeed(pools)) {
    seed = await computeSeedCurrents(uid, pools, mode, startMs, { p: 0.6 });
  } else if (mode === 'manual') {
    const anyPostStart = await hasPostStartSpend(uid, startMs);
    if (!anyPostStart) {
      const accel = await computeSeedCurrents(uid, pools, 'accelerated', startMs, { p: 0.6 });
      seed = await applyManualAdjustments(uid, accel, startMs);
    }
  }

  let seedCarry = (snap.data()?.seedCarry) || {};
  if (!seed && Object.keys(seedCarry).length === 0 && mode !== 'true') {
    seedCarry = await ensureSeedCarryOnFlip(uid, pools, mode, startMs, snap);
  }
  const carryFor = (pool) => (mode === 'true' ? 0 : Number((seedCarry?.[pool] || 0)));

  const truth = {};
  const regenPerSec = {};
  for (const pool of Object.keys(pools)) {
    const v = pools[pool];
    if (seed && seed[pool]) {
      truth[pool] = Math.max(0, seed[pool].current);
    } else {
      truth[pool] = Math.max(0, (v.regenCurrent ?? 0) * days0 - ((v.spentToDate ?? 0) + carryFor(pool)));
    }
    regenPerSec[pool] = (v.regenCurrent ?? 0) * (timeMultiplier / SEC_PER_DAY);
  }

  let pendingTx = [];
  const pendingQ = query(collection(db, `players/${uid}/classifiedTransactions`), where("status", "==", "pending"));
  onSnapshot(pendingQ, (shot) => {
    const now = Date.now();
    pendingTx = shot.docs.map(normalizeTxn).filter(tx => now < tx.ghostExpiryMs);
  });

  window.addEventListener("vitals:locked", (e) => {
    const applied = e?.detail?.appliedTotals; if (!applied) return;
    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] - (applied[p] || 0));
    }
  });

  let viewMode = getViewMode();

  let last = null;
  function frame(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;

    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] + regenPerSec[p] * dt);
    }

    const availTruth = { ...truth };
    let pendingTotals = { health:0, mana:0, stamina:0, essence:0 };
    const now = Date.now();
    const ordered = [...pendingTx].sort((a,b)=>a.dateMs - b.dateMs);
    for (const tx of ordered) {
      if (now >= tx.ghostExpiryMs || tx.amount >= 0) continue;
      const spend  = Math.abs(tx.amount);
      const intent = previewPool(tx);
      const split  = allocateSpendAcrossPools(spend, intent, availTruth);
      pendingTotals = sumPools(pendingTotals, split);
    }

    const factor = VIEW_FACTORS[viewMode];
    let sumCurrent = 0;
    let sumMax = 0;

    for (const pool of Object.keys(pools)) {
      const el = elements[pool]; if (!el) continue;
      const v  = pools[pool];
      const cap = (v.regenBaseline ?? 0) * factor || 0;

      const T = truth[pool];
      const L = pendingTotals[pool] || 0;

      const proj = applyRemainderFirst(T, cap, L);

      const pctAfter = cap > 0 ? (proj.rAfter / cap) * 100 : 0;
      el.fill.style.width = `${pctAfter}%`;
      el.value.innerText  = `${proj.rAfter.toFixed(2)} / ${cap.toFixed(2)}`;

      setSurplusPill(el, proj.sNow, proj.sAfter);

      const barEl = el.fill.closest('.bar');
      const reclaimEl = barEl.querySelector('.bar-reclaim');

      if (cap > 0 && L > 0.0001 && proj.ghostWidthPct > 0.01) {
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
        sumCurrent += proj.rAfter;
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
    refreshBarGrids();
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   5) Lock + summary — calc-start + seedCarry in availTruth
   ──────────────────────────────────────────────────────────────────────────── */
function roundPools(p){ return {
  health:Number((p.health||0).toFixed(2)),
  mana:Number((p.mana||0).toFixed(2)),
  stamina:Number((p.stamina||0).toFixed(2)),
  essence:Number((p.essence||0).toFixed(2)),
};}

async function recomputeSummary(uid){
  const db=getFirestore();
  const col=collection(db,`players/${uid}/classifiedTransactions`);
  const confirmedQ=query(col,where("status","==","confirmed"));
  const snap=await getDocs(confirmedQ);

  const all={health:0,mana:0,stamina:0,essence:0};
  const recent7={health:0,mana:0,stamina:0,essence:0};
  const since7=Date.now()-7*MS_PER_DAY;

  snap.forEach(d=>{
    const tx=d.data(); const alloc=tx.appliedAllocation||{};
    for(const k of Object.keys(all)) all[k]+=Number(alloc[k]||0);
    const when=tx?.lockedAtMs||tx?.tag?.setAtMs||0;
    if(when>=since7){ for(const k of Object.keys(recent7)) recent7[k]+=Number(alloc[k]||0); }
  });

  await setDoc(doc(db,`players/${uid}/classifiedTransactions/summary`),{
    historicUsage:roundPools(all),
    recentUsage:roundPools(recent7),
    updatedAt:Date.now(),
  },{merge:true});
}

export async function lockExpiredOrOverflow(uid,queueCap=50){
  const db=getFirestore();
  const col=collection(db,`players/${uid}/classifiedTransactions`);
  const now=Date.now();

  const dueSnap=await getDocs(query(col,where("status","==","pending"),where("ghostExpiryMs","<=",now)));
  const pendAsc=await getDocs(query(col,where("status","==","pending"),orderBy("addedMs","asc")));
  const overflow=Math.max(0,pendAsc.size-queueCap);

  const toConfirm=[]; dueSnap.forEach(d=>toConfirm.push(d));
  if(overflow>0){ let i=0; pendAsc.forEach(d=>{ if(i++<overflow) toConfirm.push(d); }); }
  if(!toConfirm.length) return;

  const currentSnap=await getDoc(doc(db,`players/${uid}/cashflowData/current`));
  if(!currentSnap.exists()) return;
  const pools=currentSnap.data().pools||{};
  const seedCarry = (currentSnap.data()?.seedCarry) || {};

  const mode = await getVitalsMode(uid);
  const carryFor = (pool) => (mode === 'true' ? 0 : Number((seedCarry?.[pool] || 0)));

  const days = await elapsedDaysFromCalcStart(uid);

  const availTruth={
    health: Math.max(0,(pools.health?.regenCurrent ||0)*days - ((pools.health?.spentToDate ||0) + carryFor('health'))),
    mana:   Math.max(0,(pools.mana?.regenCurrent   ||0)*days - ((pools.mana?.spentToDate   ||0) + carryFor('mana'))),
    stamina:Math.max(0,(pools.stamina?.regenCurrent||0)*days - ((pools.stamina?.spentToDate||0) + carryFor('stamina'))),
    essence:Math.max(0,(pools.essence?.regenCurrent||0)*days - ((pools.essence?.spentToDate||0) + carryFor('essence'))),
  };

  toConfirm.sort((a,b)=>(a.data()?.addedMs??0)-(b.data()?.addedMs??0));

  const batch=writeBatch(db);
  const appliedTotals={health:0,mana:0,stamina:0,essence:0};

  for(const d of toConfirm){
    const tx=normalizeTxn(d);
    const reason=tx.ghostExpiryMs<=now?"expiry":"queue_cap";
    const chosen=tx?.provisionalTag?.pool ?? previewPool(tx) ?? "stamina";

    if(tx.amount>=0){
      batch.update(d.ref,{ status:"confirmed", tag:{pool:chosen,setAtMs:now}, autoLockReason:reason, lockedAtMs:now });
      continue;
    }

    const spend=Math.abs(tx.amount);
    const split=allocateSpendAcrossPools(spend,chosen,availTruth);
    for(const k of Object.keys(appliedTotals)) appliedTotals[k]+=(split[k]||0);

    batch.update(d.ref,{
      status:"confirmed",
      tag:{pool:chosen,setAtMs:now},
      autoLockReason:reason,
      lockedAtMs:now,
      appliedAllocation:roundPools(split),
    });
  }

  await batch.commit();
  await recomputeSummary(uid);
  await updateVitalsPools(uid);

  window.dispatchEvent(new CustomEvent("vitals:locked",{ detail:{ appliedTotals:roundPools(appliedTotals) } }));
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

          const mainEl = li.querySelector('.ul-main');
          if (mainEl) {
            onLongPress(mainEl, () => {
              mountTxInlineEditor(li, tx, { uid, onDone: () => {} });
            });
          }

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

// Single source of truth for the menu
export async function getEssenceAvailableMonthlyFromHUD(uid) {
  const db = getFirestore();
  const curSnap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!curSnap.exists()) return 0;
  const cur   = curSnap.data() || {};
  const pools = cur.pools || {};
  const ePool = pools.essence || {};

  const regenBaseline = Number(ePool.regenBaseline || 0);
  const regenCurrent  = Number(ePool.regenCurrent  || regenBaseline);
  const spentToDate   = Number(ePool.spentToDate   || 0);
  const elapsedDays   = Number(cur.elapsedDays || 0);
  const seedCarry     = Number(cur.seedCarry?.essence || 0);

  const capMonthly = regenBaseline * 30;

  // mode + startDate to decide if we’re still in seed
  let mode = 'safe', startMs = Date.now();
  try {
    const p = await getDoc(doc(db, `players/${uid}`));
    if (p.exists()) {
      const d = p.data() || {};
      const raw = d.startDate;
      if (raw?.toMillis) startMs = raw.toMillis();
      else if (raw instanceof Date) startMs = raw.getTime();
      else if (typeof raw === 'number') startMs = raw;

      const m = String(d.vitalsMode || '').toLowerCase();
      if (['safe','accelerated','manual','true'].includes(m)) mode = m;
    }
  } catch {}

  // If we’re in a seeding state, call the same seed function the HUD uses
  if ((mode === 'safe' || mode === 'accelerated') && shouldApplySeed(pools)) {
    const seed = await computeSeedCurrents(uid, pools, mode, startMs, { p: 0.6 });
    return Math.max(0, Math.min(capMonthly, Number(seed?.essence?.current || 0)));
  } else if (mode === 'manual') {
    const anyPostStart = await hasPostStartSpend(uid, startMs);
    if (!anyPostStart) {
      const accel = await computeSeedCurrents(uid, pools, 'accelerated', startMs, { p: 0.6 });
      const manual = await applyManualAdjustments(uid, accel, startMs);
      return Math.max(0, Math.min(capMonthly, Number(manual?.essence?.current || 0)));
    }
  }

  // Otherwise, truth path (note: carry is ignored in true mode)
  const carry = (mode === 'true') ? 0 : seedCarry;
  const T = Math.max(0, regenCurrent * elapsedDays - (spentToDate + carry));
  const r = capMonthly > 0 ? ((T % capMonthly) + capMonthly) % capMonthly : 0;
  return Math.max(0, r);
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
