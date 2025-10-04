// energy-vitals.js — unified Vitals Gateway + HUD (single-file drop-in)
// - Builds vitalsData/gateway from cashflowData + verified processedTransactions
// - Full HUD wiring (bars, focus/core modes, ghosts, update logs, buttons)
// - Dashboard helpers (refreshVitals, autoInitAddEnergyButton, etc.)
//
// Pay-cycle realignment (matches legacy intent):
//   - payCycleAnchorMs: start point for vitals truth/accumulation window
//       → Any txn BEFORE this is ignored for vitals (spentToDate, creditsToDate, 7-day nudge, etc.)
//   - lastAnchorUpdateMs: when payCycleAnchorMs was last changed (for debug/display)
//
// Credit handling (configurable via cashflowData.creditMode):
//   - "essence" (default): all confirmed credits add to Essence (ad-hoc income).
//   - "allocate": credits reduce spend in their tagged pool (like negative debit).
//   - "health": all confirmed credits reduce Health spend (flows to Health).
//
// Public functions consumed by dashboard:
//   recomputeVitalsGatewayStub, loadVitalsToHUD, initVitalsHUD,
//   startAliasListener, startLevelListener,
//   refreshVitals, autoInitAddEnergyButton, autoInitAddSocialButton, autoInitAddSpendButton,
//   autoInitUpdateLog, autoInitHistoryButtons,
//   setViewMode, getViewMode, cycleViewMode,
//   setProvisionalTag, listenUpdateLogPending, listenRecentlyConfirmed

// ───────────────────────────────── Imports ─────────────────────────────────
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs,
  query, where, orderBy, limit, onSnapshot, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { openEnergyMenu } from "./energy-menu.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";


// ───────────────────────────────── Constants ────────────────────────────────
const MS_PER_DAY     = 86_400_000;
const AVG_MONTH_DAYS = 30.44;      // cap basis

const CORE_DAYS   = 30.44;         // HUD “Current” window (visual only)
const VIEW_MODES  = ["daily","weekly"];
const VIEW_FACTORS= { daily:1, weekly:7 };

const DEFAULT_TITLE = "VITALS";
const MAX_ALIAS_LEN = 16;
const COLLAPSE_LEN_HINT = 14;

// ───────────────────────────────── Utilities ────────────────────────────────
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
function safeNum(n, d=0){ n = Number(n); return Number.isFinite(n) ? n : d; }

// Wrap accumulated truth T into monthly cap
function wrapIntoCap(T, cap){
  if (cap <= 0) return { rNow:0, sNow:0 };
  const sNow = Math.floor(T / cap);
  const rNow = T - sNow * cap;
  return { rNow: clamp(rNow, 0, cap), sNow };
}

// Days strictly since payCycleAnchorMs (fallback: 1st of current month)
function daysSincePayCycleStart(payCycleAnchorMs){
  if (Number.isFinite(payCycleAnchorMs) && payCycleAnchorMs > 0){
    return Math.max(0, (Date.now() - payCycleAnchorMs) / MS_PER_DAY);
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return Math.max(0, (Date.now() - start) / MS_PER_DAY);
}


// ─────────────────────────────── Cloud Functions ────────────────────────────
const functions = getFunctions();

export async function refreshVitals_BE(uid){
  try{
    const fn = httpsCallable(functions, "vitals_getSnapshot");
    const res = await fn();
    return res?.data||{};
  }catch(e){
    console.warn("refreshVitals failed", e);
    return {};
  }
}

// Note: signature kept for dashboard setInterval compatibility
export async function lockExpiredOrOverflow_BE(uid, queueCap = 50){
  try{
    const fn = httpsCallable(functions, "vitals_lockPending");
    const res = await fn({ queueCap });
    const payload = res?.data || {};
    if (payload.appliedTotals){
      window.dispatchEvent(new CustomEvent("vitals:locked", { detail: { appliedTotals: payload.appliedTotals } }));
    }
    return payload;
  }catch(e){
    console.warn("Server lock failed:", e);
    return { locked: 0 };
  }
}

// Optional server source for Essence monthly
export async function getEssenceAvailableMonthlyFromHUD_BE(uid){
  try{
    const fn = httpsCallable(functions, "vitals_getEssenceAvailableMonthly");
    const res = await fn();
    return Number(res?.data?.available||0);
  }catch(e){
    return 0;
  }
}
// ───────────────────────────────── Firestore handle ─────────────────────────
const db = getFirestore();
let CURRENT_TX_COLLECTION_PATH = null;
let CURRENT_CASHFLOW_DOC_PATH = null;
const HUD_TRUTH_SOURCE = 'gateway'; // 'gateway' | 'backend'


// ─────────────────────────────── Source selector ─────────────────────────────
// Decides whether to read from verified or unverified paths
async function resolveDataSources(uid) {
  const profSnap = await getDoc(doc(db, `players/${uid}`));
  const prof = profSnap.exists() ? (profSnap.data() || {}) : {};
  const tMode = String(prof.transactionMode || 'unverified').toLowerCase();

   let dataSources = {
        cashflowDocPath: `players/${uid}/financialData/cashflowData`,
        txCollectionPath: null
   }

  if (tMode === 'unverified') {
      dataSources.txCollectionPath = `players/${uid}/financialData/processedTransactions/unverified`
  } else if (tMode === "verified"){
        dataSources.txCollectionPath = `players/${uid}/financialData/processedTransactions/verified`
  }

  CURRENT_TX_COLLECTION_PATH = dataSources.txCollectionPath;
  CURRENT_CASHFLOW_DOC_PATH = dataSources.cashflowDocPath;
  return dataSources  
}


// ───────────────────────────────── Pool allocations ─────────────────────────
async function readAllocations(db, uid){
  try{
    const snap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));
    if (snap.exists()){
      const d = snap.data() || {};
      const health  = safeNum(d.healthAllocation, 0.34);
      const mana    = safeNum(d.manaAllocation,   0.33);
      const stamina = safeNum(d.staminaAllocation,0.33);
      const essence = safeNum(d.essenceAllocation,0.0); // can be zero safely
      const sum = Math.max(1e-9, health+mana+stamina+essence);
      return {
        health:  health/sum,
        mana:    mana/sum,
        stamina: stamina/sum,
        essence: essence/sum,
      };
    }
  }catch(_){}
  return { health:0.34, mana:0.33, stamina:0.33, essence:0.0 };
}

// ───────────────────────────────── Intent allocation ────────────────────────
function allocateSpendAcrossPools(spend, intent, availTruth){
  const out = { health:0, mana:0, stamina:0, essence:0 };
  if (spend <= 0) return out;

  if (intent === "mana") {
    const toMana = Math.min(spend, Math.max(0, availTruth.mana));
    if (toMana > 0) { out.mana += toMana; availTruth.mana -= toMana; }
    const leftover = spend - toMana;
    if (leftover > 0) out.health += leftover;
    return out;
  }
  const toStamina = Math.min(spend, Math.max(0, availTruth.stamina));
  if (toStamina > 0) { out.stamina += toStamina; availTruth.stamina -= toStamina; }
  const toHealth = spend - toStamina;
  if (toHealth > 0) out.health += toHealth;
  return out;
}

// ───────────────────────────────── Credit mode ──────────────────────────────
function resolveCreditMode(configDoc){
  const raw = String(configDoc?.creditMode || '').toLowerCase();
  if (["essence","allocate","health"].includes(raw)) return raw;
  return "essence";
}

// ─────────────────────────────── Non-core usage ingest ──────────────────────
// Reads verified processedTransactions /verified and returns in-window totals
async function readNonCoreUsage(db, uid, windowStartMs, creditMode = 'essence', txCollectionPath){
  const base = collection(db, txCollectionPath)
  const shot = await getDocs(base);

  const totals = {
    all:   { health:0, mana:0, stamina:0, essence:0 },   // window: ≥ anchor
    last7: { health:0, mana:0, stamina:0, essence:0 },   // last 7d (clamped to window)
    pending: { health:0, mana:0, stamina:0, essence:0, creditEssence:0 } // preview
  };

  const sevenAgo = Date.now() - 7*MS_PER_DAY;
  const sevenWindowStart = Math.max(Number(windowStartMs||0), sevenAgo);

  function applyAllocatedCredit(amount, intent, when){
    const avail = { health: Infinity, mana: Infinity, stamina: Infinity, essence: 0 };
    const split = allocateSpendAcrossPools(amount, intent==='mana'?'mana':'stamina', avail);
    const apply = (bucket)=>{
      bucket.health  -= Number(split.health  || 0);
      bucket.mana    -= Number(split.mana    || 0);
      bucket.stamina -= Number(split.stamina || 0);
    };
    apply(totals.all);
    if (when >= sevenWindowStart) apply(totals.last7);
  }

  shot.forEach(d=>{
    const tx = d.data() || {};
    const amt = safeNum(tx.amount ?? tx.amountMajor ?? 0, 0);
    if (!amt) return;

    const cls = String(tx.classification || '').toLowerCase();
    const isCore = (cls === 'coreinflow' || cls === 'coreoutflow');
    if (isCore) return;

    const status = String(tx.status || 'confirmed').toLowerCase();
    const when   = safeNum(tx.dateMs ?? tx.postedAtMs ?? tx.transactionData?.entryDate?.toMillis?.(), 0);
    const inWindow = (when >= Number(windowStartMs||0));

    // Credits
    if (amt > 0){
      if (status === 'pending') {
        totals.pending.creditEssence += amt;
      } else if (inWindow) {
        if (creditMode === 'essence'){
          totals.all.essence += amt;
          if (when >= sevenWindowStart) totals.last7.essence += amt;
        } else if (creditMode === 'allocate'){
          const intent = tx?.tag?.pool || tx?.provisionalTag?.pool || 'stamina';
          applyAllocatedCredit(amt, intent, when);
        } else if (creditMode === 'health'){
          totals.all.health -= amt;
          if (when >= sevenWindowStart) totals.last7.health -= amt;
        }
      }
      return;
    }

    // Debits
    const spend = Math.abs(amt);

    if (status === 'pending') {
      const intent = tx?.provisionalTag?.pool || tx?.tag?.pool || 'stamina';
      const avail = { health: Infinity, mana: Infinity, stamina: Infinity, essence: 0 };
      const alloc = allocateSpendAcrossPools(spend, intent === 'mana' ? 'mana' : 'stamina', avail);
      totals.pending.health  += alloc.health  || 0;
      totals.pending.mana    += alloc.mana    || 0;
      totals.pending.stamina += alloc.stamina || 0;
      return;
    }

    if (!inWindow) return;

    // Confirmed: prefer appliedAllocation
    const applied = tx.appliedAllocation || null;
    if (applied) {
      totals.all.health  += safeNum(applied.health, 0);
      totals.all.mana    += safeNum(applied.mana,   0);
      totals.all.stamina += safeNum(applied.stamina,0);
      totals.all.essence += safeNum(applied.essence,0);
      if (when >= sevenWindowStart){
        totals.last7.health  += safeNum(applied.health, 0);
        totals.last7.mana    += safeNum(applied.mana,   0);
        totals.last7.stamina += safeNum(applied.stamina,0);
        totals.last7.essence += safeNum(applied.essence,0);
      }
      return;
    }

    // Fallback split by intent
    const intent = tx?.tag?.pool || tx?.provisionalTag?.pool || 'stamina';
    const avail = { health: Infinity, mana: Infinity, stamina: Infinity, essence: 0 };
    const alloc = allocateSpendAcrossPools(spend, intent === 'mana' ? 'mana' : 'stamina', avail);

    totals.all.health  += alloc.health  || 0;
    totals.all.mana    += alloc.mana    || 0;
    totals.all.stamina += alloc.stamina || 0;

    if (when >= sevenWindowStart){
      totals.last7.health  += alloc.health  || 0;
      totals.last7.mana    += alloc.mana    || 0;
      totals.last7.stamina += alloc.stamina || 0;
    }
  });

  for (const grp of [totals.all, totals.last7, totals.pending]){
    for (const k of Object.keys(grp)){
      grp[k] = Number(safeNum(grp[k],0).toFixed(2));
    }
  }
  return totals;
}

// ───────────────────────── Vitals Gateway recompute (stub) ──────────────────
export async function recomputeVitalsGatewayStub(uid){
  const { cashflowDocPath, txCollectionPath} = await resolveDataSources(uid)
  
  const activeRef = doc(db, cashflowDocPath)
  const active = await getDoc(activeRef);

  if (!active.exists()){
    await setDoc(doc(db, `players/${uid}/vitalsData/gateway`), {
      mode: "continuous",
      cadence: "monthly",
      payCycleAnchorMs: null,
      lastAnchorUpdateMs: null,
      core: { dailyIncome:0, dailyExpense:0, netDaily:0 },
      pools: {
        health:{ max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,sNow:0,truthTotal:0,pending:{debit:0,credit:0},trend:"stable" },
        mana:{   max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,sNow:0,truthTotal:0,pending:{debit:0,credit:0},trend:"stable" },
        stamina:{max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,sNow:0,truthTotal:0,pending:{debit:0,credit:0},trend:"stable" },
        essence:{max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,sNow:0,truthTotal:0,pending:{debit:0,credit:0},trend:"stable" },
      },
      updatedAt: Date.now()
    }, { merge:true });
    return;
  }

  const A = active.data() || {};
  const mode = String(A.energyMode || A.mode || 'continuous').toLowerCase();
  const creditMode = resolveCreditMode(A);

  const payCycleAnchorMs  = safeNum(A.payCycleAnchorMs ?? A.anchorMs, NaN);
  const lastAnchorUpdateMs= safeNum(A.lastAnchorUpdateMs, NaN);

  const incMo = safeNum(A?.inflow?.total ?? A?.inflow ?? 0, 0);
  const outMo = safeNum(A?.outflow?.total ?? A?.outflow ?? 0, 0);
  const dailyIncome  = incMo / AVG_MONTH_DAYS;
  const dailyExpense = outMo / AVG_MONTH_DAYS;
  const netDaily     = dailyIncome - dailyExpense;

  const alloc = await readAllocations(db, uid);
  const regenBaseline = {
    health:  Number((netDaily * alloc.health ).toFixed(2)),
    mana:    Number((netDaily * alloc.mana   ).toFixed(2)),
    stamina: Number((netDaily * alloc.stamina).toFixed(2)),
    essence: Number((netDaily * alloc.essence).toFixed(2)),
  };

  // Window: ≥ payCycleAnchorMs
  const usage = await readNonCoreUsage(db, uid, payCycleAnchorMs, creditMode, txCollectionPath);

  // Nudge vs 7-day actuals
  function nudge(pool){
    const base   = safeNum(regenBaseline[pool], 0);
    const used7  = safeNum(usage.last7[pool], 0);
    const expect7 = Math.max(0, base * 7);
    let trend = "on target";
    let current = base;
    if (expect7 > 0){
      if (used7 > expect7 * 1.15) { current = base * 0.95; trend = "overspending"; }
      else if (used7 < expect7 * 0.80) { current = base * 1.05; trend = "underspending"; }
    }
    return { regenCurrent: Number(current.toFixed(2)), trend };
  }
  const nH = nudge("health");
  const nM = nudge("mana");
  const nS = nudge("stamina");
  const nE = nudge("essence");

  const days = daysSincePayCycleStart(payCycleAnchorMs);

  function buildPool(k, nudgeObj){
    const daily   = safeNum(nudgeObj.regenCurrent, 0);
    const cap     = Math.max(0, daily * AVG_MONTH_DAYS);
    const spent   = safeNum(usage.all[k], 0);

    // Credits: only accrue to Essence in "essence" mode; otherwise credits offset spends upstream
    let credit = 0;
    if (creditMode === 'essence' && k === 'essence'){
      credit = safeNum(usage.all.essence, 0);
    }

    // Truth since anchor
    const T = (daily * days) - spent + credit;
    const { rNow, sNow } = wrapIntoCap(T, cap);

    // Pending preview (ghost)
    const pendDebit   = (k === 'essence') ? 0 : safeNum(usage.pending[k], 0);
    const pendCreditE = (creditMode === 'essence' && k === 'essence')
      ? safeNum(usage.pending.creditEssence, 0)
      : 0;

    return {
      max:           Number(cap.toFixed(2)),
      current:       Number(rNow.toFixed(2)),
      regenDaily:    Number(daily.toFixed(2)),
      spentToDate:   Number(spent.toFixed(2)),
      creditToDate:  Number(credit.toFixed(2)),
      sNow:          Number(sNow),
      truthTotal:    Number(T.toFixed(2)),
      pending: {
        debit:  Number(pendDebit.toFixed(2)),
        credit: Number(pendCreditE.toFixed(2)),
        expiryMs: null
      },
      trend: nudgeObj.trend
    };
  }

  const payload = {
    mode,
    cadence: "monthly",
    payCycleAnchorMs:  Number.isFinite(payCycleAnchorMs)  ? payCycleAnchorMs  : null,
    lastAnchorUpdateMs:Number.isFinite(lastAnchorUpdateMs)? lastAnchorUpdateMs: null,
    core: {
      dailyIncome:  Number(dailyIncome.toFixed(2)),
      dailyExpense: Number(dailyExpense.toFixed(2)),
      netDaily:     Number(netDaily.toFixed(2)),
    },
    pools: {
      health:  buildPool("health",  nH),
      mana:    buildPool("mana",    nM),
      stamina: buildPool("stamina", nS),
      essence: buildPool("essence", nE),
    },
    updatedAt: Date.now()
  };

  await setDoc(doc(db, `players/${uid}/vitalsData/gateway`), payload, { merge:true });
}

// ────────────────────────────── Mode helpers (HUD) ──────────────────────────
function displayLabelFor(mode){
  const map = { daily:"Today", weekly:"This Week", core:"Current" };
  return map[String(mode).toLowerCase()] || mode;
}
function getPrimaryMode(){
  return localStorage.getItem("vitals:primary") || "core";
}
function setPrimaryMode(next){
  const v = (next === "core" || next === "focus") ? next : "core";
  localStorage.setItem("vitals:primary", v);
  repaintEngravingLabels();
  window.dispatchEvent(new CustomEvent("vitals:primary",{ detail:{ primary:v }}));
}
export function getViewMode(){
  const primary = getPrimaryMode();
  if (primary === "core") return "core";
  const raw = localStorage.getItem("vitals:viewMode") || "daily";
  return (raw === "monthly") ? "weekly" : raw;
}
export function setViewMode(mode){
  const next = VIEW_MODES.includes(mode) ? mode : "daily";
  localStorage.setItem("vitals:viewMode", next);
  setPrimaryMode("focus");
  repaintEngravingLabels();
  window.dispatchEvent(new CustomEvent("vitals:viewmode",{ detail:{ mode: next }}));
  refreshBarGrids();
  updateModeEngrave(next);
}
export function cycleViewMode(){
  const cur = getViewMode();
  setViewMode(cur === "daily" ? "weekly" : "daily");
}

// ───────────────────────── Alias / Level listeners (HUD) ────────────────────
let unsubPlayer = null;
let unsubPlayerLevel = null;

const titleEl   = document.getElementById("header-title");
const actionsEl = document.getElementById("headerActions");
const moreBtn   = document.getElementById("btnMore");
const moreMenu  = document.getElementById("moreMenu");

function collapseActionsIfNeeded(){
  if (!titleEl || !actionsEl) return;
  actionsEl.classList.remove('is-collapsed');
  const overflows = titleEl.scrollWidth > titleEl.clientWidth;
  const tiny      = window.innerWidth < 420;
  const nameLen   = (titleEl.textContent||"").length;
  const should    = overflows || (tiny && nameLen >= COLLAPSE_LEN_HINT);
  actionsEl.classList.toggle('is-collapsed', should);
  if (moreBtn) moreBtn.style.display = should ? 'inline-flex' : 'none';
}
function wireMoreMenu(){
  if (!moreBtn || !moreMenu || moreBtn.__wired) return;
  moreBtn.__wired = true;
  moreBtn.addEventListener('click', ()=>{
    const isOpen = moreMenu.hidden === false;
    moreMenu.hidden = isOpen; moreBtn.setAttribute('aria-expanded', String(!isOpen));
  });
  moreMenu.addEventListener('click',(e)=>{
    const btn = e.target.closest('button[data-proxy]');
    if (!btn) return; const sel = btn.getAttribute('data-proxy'); const target = document.querySelector(sel);
    if (target) target.click(); moreMenu.hidden = true; moreBtn.setAttribute('aria-expanded','false');
  });
  document.addEventListener('click', (e)=>{
    if (!moreMenu.hidden && !moreMenu.contains(e.target) && e.target !== moreBtn){
      moreMenu.hidden = true; moreBtn.setAttribute('aria-expanded','false');
    }
  });
}
export async function startAliasListener(uid){
  if (unsubPlayer) { unsubPlayer(); unsubPlayer = null; }
  wireMoreMenu();
  unsubPlayer = onSnapshot(doc(db,"players",uid),(snap)=>{
    const raw = (snap.exists() && typeof snap.data().alias === "string") ? snap.data().alias.trim() : "";
    const capped = raw.length > MAX_ALIAS_LEN ? raw.slice(0,MAX_ALIAS_LEN) : raw;
    if (titleEl){ titleEl.textContent = capped || DEFAULT_TITLE; titleEl.title = raw || DEFAULT_TITLE;
    titleEl.classList.toggle('is-gt10', (capped.length > 10));
    titleEl.classList.toggle('is-gt12', (capped.length > 12)); }
    requestAnimationFrame(collapseActionsIfNeeded);
  },()=>{ if (titleEl){ titleEl.textContent = DEFAULT_TITLE; } requestAnimationFrame(collapseActionsIfNeeded); });
  window.addEventListener('resize', ()=>requestAnimationFrame(collapseActionsIfNeeded));
}
const levelEl = document.getElementById("player-level");
export async function startLevelListener(uid){
  if (unsubPlayerLevel) { unsubPlayerLevel(); unsubPlayerLevel = null; }
  unsubPlayerLevel = onSnapshot(doc(db,"players",uid),(snap)=>{
    let lvl; if (snap.exists()) lvl = Number(snap.data().level ?? snap.data().playerLevel ?? snap.data().stats?.level);
    if (Number.isFinite(lvl)){ if(levelEl){ levelEl.textContent=String(lvl); levelEl.hidden=false;} }
    else { if(levelEl) levelEl.hidden = true; }
  },()=>{ if(levelEl) levelEl.hidden = true; });
}

// ─────────────────────────── DOM helpers (HUD rendering) ────────────────────
function getVitalsElements(){
  const pools = ["health","mana","stamina","essence"]; const map = {};
  for (const p of pools){
    const root = document.querySelector(`#vital-${p}`);
    const fill = root?.querySelector('.bar-fill');
    const val  = root?.querySelector('.bar-value');
    const label= root?.querySelector('.bar-label');
    const pill = root?.querySelector('.bar-surplus');
    if (fill && val && label && pill) map[p] = { fill, value: val, label, pill };
  }
  return map;
}
function paintBarGrid(gridEl, days){
  const needed = Math.max(0, (days|0)-1); gridEl.innerHTML='';
  for (let i=1;i<=needed;i++){
    const line=document.createElement('div');
    line.className='grid-line';
    line.style.left=((i/days)*100).toFixed(4)+'%';
    gridEl.appendChild(line);
  }
}
function refreshBarGrids(){
  const vm = getViewMode(); const days = (vm==='core')? CORE_DAYS : VIEW_FACTORS[vm];
  const pools = ["health","mana","stamina","essence"];
  for (const p of pools){
    const root = document.querySelector(`#vital-${p}`); const bar = root?.querySelector('.bar'); if(!bar) continue;
    let grid = bar.querySelector('.bar-grid'); if (!grid){ grid=document.createElement('div'); grid.className='bar-grid'; bar.insertBefore(grid, bar.querySelector('.bar-fill')); }
    paintBarGrid(grid, days);
  }
}
function updateModeEngrave(mode = getViewMode()){
  const coreBtn  = document.getElementById('engrave-core');
  const focusBtn = document.getElementById('engrave-focus'); if (!coreBtn||!focusBtn) return;
  const key = String(mode).toLowerCase(); const isCore = (key==='core');
  if (!isCore) focusBtn.dataset.mode = key;
  coreBtn.classList.toggle('is-active', isCore);
  focusBtn.classList.toggle('is-active', !isCore);
}
function repaintEngravingLabels(){
  const coreBtn  = document.getElementById("engrave-core");
  const focusBtn = document.getElementById("engrave-focus");

  // Make sure legacy CSS hooks are present
  if (coreBtn && !coreBtn.classList.contains("mode-btn"))  coreBtn.classList.add("mode-btn");
  if (focusBtn && !focusBtn.classList.contains("mode-btn")) focusBtn.classList.add("mode-btn");

  //
  if (coreBtn){ coreBtn.textContent="Current"; coreBtn.dataset.mode="core"; coreBtn.setAttribute("aria-label","Current"); }
  if (focusBtn){
    const vm = getViewMode();
    const shown = (vm==='core') ? (localStorage.getItem("vitals:viewMode")||"daily") : vm;
    const coerced = (shown==='monthly')?'weekly':shown;
    focusBtn.textContent  = `Focus: ${displayLabelFor(coerced)}`;
    focusBtn.dataset.mode = coerced;
    focusBtn.setAttribute("aria-label", `Focus: ${displayLabelFor(coerced)}`);
  }
}
function setSurplusPill(el, daysNow, daysAfter){
  const pill = el.pill; if (!pill) return;
  // We also need the BAR element to toggle the faint surplus backdrop
  const barEl = el.fill?.closest?.('.bar') || null;

  const isCore = (getPrimaryMode()==='core');
  const anyNow = isCore && (Number(daysNow||0) > 0);
  const anyAf  = isCore && (Number(daysAfter||0)> 0);
  if (!anyNow && !anyAf){
    pill.style.display="none"; pill.textContent="";
    pill.classList.remove("with-next","pill-up","pill-down");
    // No surplus backdrop in Focus or when there’s no surplus
    if (barEl) barEl.classList.remove('has-surplus');
    return;
  }
  pill.style.display="inline-flex"; pill.classList.remove("pill-up","pill-down");
  const txt = (d)=>`+${Math.max(0, Math.floor(Number(d)||0))}`;
  if (anyAf && (daysAfter!==daysNow)){
    if(daysAfter>daysNow) pill.classList.add("pill-up"); else pill.classList.add("pill-down");
    pill.textContent = `${txt(daysNow)} → ${txt(daysAfter)}`; pill.classList.add("with-next");
  } else {
    pill.textContent = txt(daysNow); pill.classList.remove("with-next");
  }

  // Toggle the faint surplus backdrop on the bar itself.
  // Show it in Core when there is any surplus now (daysNow > 0).
  if (barEl) barEl.classList.toggle('has-surplus', isCore && Number(daysNow||0) > 0);
}
function formatNum(n){ return (Math.round(n)||0).toLocaleString('en-GB'); }
function setVitalsTotals(currentTotal, maxTotal){
  const el = document.getElementById('vitals-total'); if (!el) return;
  el.innerHTML = `
    <span class="label">Total</span>
    <span class="vital-value">${formatNum(currentTotal)}</span>
    <span class="sep">/</span>
    <span class="vital-max">${formatNum(maxTotal)}</span>
  `;
}
function rateTextForMode(perDay, mode=getViewMode()){
  const d=Number(perDay||0);
  switch(String(mode).toLowerCase()){
    case 'daily':  return `+${(d/24).toFixed(2)}/hr`;
    case 'weekly': return `+${(d).toFixed(2)}/day`;
    case 'core':   return `+${(d*7).toFixed(2)}/wk`;
    default:       return `+${(d/24).toFixed(2)}/hr`;
  }
}
function installRatePeekHandlers(elements, pools, mode=getViewMode()){
  const POOLS = Object.keys(pools||{});
  for (const p of POOLS){
    const el = elements[p]; if (!el?.value) continue; const v = pools[p]||{};
    const rate = rateTextForMode(v.regenDaily || v.regenCurrent, mode);
    el.value.__origText = el.value.textContent; el.value.__rateText = rate; el.value.title = `Regen: ${rate}`;
    if (el.value.__rateWired) continue; el.value.__rateWired = true;
    const bar = el.value.closest('.bar');
    const show=()=>{ el.value.textContent=el.value.__rateText; el.value.classList.add('is-rate'); };
    const hide=()=>{ el.value.textContent=el.value.__origText; el.value.classList.remove('is-rate'); };
    bar.addEventListener('pointerenter',show); bar.addEventListener('pointerleave',hide);
    bar.addEventListener('focusin',show); bar.addEventListener('focusout',hide);
    let t=null; bar.addEventListener('click',()=>{ show(); clearTimeout(t); t=setTimeout(hide,1500); },{passive:true});
    bar.addEventListener('touchstart',()=>{ show(); clearTimeout(t); t=setTimeout(hide,1500); },{passive:true});
  }
}
function updateRatePeekTexts(elements, pools, mode=getViewMode()){
  for (const p of Object.keys(pools||{})){
    const el = elements[p]; if (!el?.value) continue; const v = pools[p]||{};
    el.value.__rateText = rateTextForMode(v.regenDaily || v.regenCurrent, mode);
    if (el.value.classList.contains('is-rate')) el.value.textContent = el.value.__rateText;
  }
}
function ensureReclaimLayers(elements){
  for (const p of Object.keys(elements)){
    const bar = elements[p]?.fill?.closest('.bar'); if (!bar) continue;
    if (!bar.querySelector('.bar-reclaim')){ const seg = document.createElement('div'); seg.className='bar-reclaim'; bar.appendChild(seg); }
  }
}

// ───────────────────────── Gateway reader for HUD paint ─────────────────────
async function readGateway(uid){
  const snap = await getDoc(doc(db, `players/${uid}/vitalsData/gateway`));
  return snap.exists() ? (snap.data()||{}) : null;
}

// ───────────────────────────── Public: Static paint (HUD) ───────────────────
export async function loadVitalsToHUD(uid){
  const data = await readGateway(uid); if (!data) return;
  const elements = getVitalsElements();
  const pools = data.pools || {};
  const vm = getViewMode();
  const factor = (vm === 'core') ? CORE_DAYS : VIEW_FACTORS[vm];

  installRatePeekHandlers(elements, pools, vm === 'core' ? 'core' : vm);

  let sumCurrent = 0, sumMax = 0;
  for (const [pool, v] of Object.entries(pools)){
    const el = elements[pool]; if (!el) continue;
    const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);
    const cap   = Math.max(0, daily * factor);
    const current = Math.max(0, Math.min(cap, Number(v.current||0)));  // gateway remainder
    const pct = cap>0 ? (current / cap) * 100 : 0;
    el.fill.style.width = `${pct}%`;
    el.value.innerText = `${current.toFixed(2)} / ${cap.toFixed(2)}`;

    // Surplus pill (days over cap): use truthTotal and daily
    const truthTotal = Number(v.truthTotal || 0);
    const daysOver = (vm==='core' && daily>0)
      ? Math.floor(Math.max(0, (truthTotal - cap) / daily))
      : 0;
    setSurplusPill(el, daysOver, daysOver);

    if (pool!=='essence'){ sumCurrent += current; sumMax += cap; }

    // Trend class
    const barEl = el.fill.closest('.bar');
    barEl?.classList.remove("overspending","underspending");
    if (v.trend === "overspending")  barEl?.classList.add("overspending");
    if (v.trend === "underspending") barEl?.classList.add("underspending");
  }
  setVitalsTotals(sumCurrent, sumMax);
  refreshBarGrids();
}

// ─────────────────────────── Public: Animated HUD (ghosts) ──────────────────
export async function initVitalsHUD(uid, timeMultiplier = 1){

  // Opportunistic refresh for freshness
  try { await recomputeVitalsGatewayStub(uid); } catch {}

    const data = await readGateway(uid); if (!data) return;
    const { cashflowDocPath, txCollectionPath} = await resolveDataSources(uid)

  const elements = getVitalsElements();
  const pools = data.pools || {};
  ensureReclaimLayers(elements);
  { const vm = getViewMode(); installRatePeekHandlers(elements, pools, vm==='core'?'core':vm); }

  // Truth remainder starts from gateway.current; regen per sec from regenDaily
  const truth = {};
  const truthTotal = {};
  const regenPerSec = {};
  for (const [pool, v] of Object.entries(pools)){
    const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);
    truth[pool] = Math.max(0, Number(v.current || 0));
    truthTotal[pool] = Number(v.truthTotal || 0); // used only for pills baseline
    regenPerSec[pool] = daily * (timeMultiplier / 86_400);
  }

  // Live pending (ghosts)
  const pendingCol = collection(db, txCollectionPath);
  let pendingTx = [];
  const pendingQ = query(pendingCol, where("status","==","pending"));
  onSnapshot(pendingQ, (shot)=>{
    pendingTx = shot.docs.map(d=>{
      const x = d.data()||{};
      return {
        id: d.id,
        amount: Number(x.amount ?? x.amountMajor ?? 0),
        dateMs: x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? 0,
        ghostExpiryMs: Number(x.ghostExpiryMs ?? 0),
        provisionalTag: x.provisionalTag || null,
        suggestedPool:  x.suggestedPool  || null,
        transactionData:{ description: x?.transactionData?.description || '' },
      };
    });
  });

  // Focus cache (confirmed non-core debits in today/week)
  let focusSpend = { health:0, mana:0, stamina:0, essence:0 };
  let focusStart = 0, focusEnd = 0, focusDays = 1, lastFetchMs = 0;
  function getFocusPeriodBounds(mode){
    const now = new Date(); let start, end;
    if (mode === 'daily'){
      start = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(); end = start + MS_PER_DAY;
    } else {
      const dow=(now.getDay()+6)%7; const startDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow);
      start=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()).getTime(); end=start+7*MS_PER_DAY;
    }
    return [start,end];
  }
  async function fetchConfirmedSpendInRange(uid, s, e){
    const qy = query(
      pendingCol,
      where("status","==","confirmed"),
      where("dateMs",">=",s),
      where("dateMs","<", e)
    );
    const snap = await getDocs(qy);
    const sums = { health:0, mana:0, stamina:0, essence:0 };
    snap.forEach(d=>{
      const x=d.data()||{};
      const cls = String(x.classification||'').toLowerCase();
      const isCore = (cls==='coreinflow'||cls==='coreoutflow');
      if (isCore) return;
      const amt = Number(x.amount ?? x.amountMajor ?? 0);
      if (amt >= 0) return; // credits handled at gateway
      const alloc = x.appliedAllocation || {};
      sums.health  += Number(alloc.health  || 0);
      sums.mana    += Number(alloc.mana    || 0);
      sums.stamina += Number(alloc.stamina || 0);
    });
    return Object.fromEntries(Object.entries(sums).map(([k,v])=>[k,Number(v.toFixed(2))]));
  }
  async function refreshFocusCacheIfNeeded(){
    const vm = getViewMode(); if (vm==='core') return;
    const [s,e] = getFocusPeriodBounds(vm);
    const stale = (Date.now()-lastFetchMs)>15000 || s!==focusStart || e!==focusEnd;
    if (!stale) return;
    focusStart=s; focusEnd=e; focusDays=Math.max(1,(e-s)/MS_PER_DAY);
    focusSpend = await fetchConfirmedSpendInRange(getAuth().currentUser.uid, s, e);
    lastFetchMs = Date.now();
    repaintEngravingLabels();
  }
  setInterval(()=>{ refreshFocusCacheIfNeeded(); }, 5000);
  await refreshFocusCacheIfNeeded();

  // Ghost overlay projection
  function applyRemainderFirst(T, cap, L){
    if (cap<=0) return { rNow:0, sNow:0, rAfter:0, sAfter:0, ghostLeftPct:0, ghostWidthPct:0 };
    const sNow=Math.floor(T/cap); const rNow=T - sNow*cap;
    if (L<=0.000001) return { rNow, sNow, rAfter:rNow, sAfter:sNow, ghostLeftPct:0, ghostWidthPct:0 };
    if (L<=rNow){
      const rAfter=rNow-L;
      return { rNow, sNow, rAfter, sAfter:sNow, ghostLeftPct:(rAfter/cap)*100, ghostWidthPct:(L/cap)*100 };
    }
    let Lleft=L-rNow; let s=sNow; let r=0;
    if (s>0){
      const whole=Math.min(s, Math.floor(Lleft/cap));
      if (whole>0){ s-=whole; Lleft-=whole*cap; }
    }
    if (Lleft>0 && s>0){ s-=1; r=cap; }
    const rAfter=Math.max(0, r-Lleft);
    return { rNow, sNow, rAfter, sAfter:s, ghostLeftPct:(rAfter/cap)*100, ghostWidthPct:((r-rAfter)/cap)*100 };
  }

  let last = null; let allowGhost = false; const enableGhostSoon=()=>{ if(!allowGhost) setTimeout(()=>allowGhost=true,60); };

  function frame(ts){
    if (last===null) last=ts; const dt=(ts-last)/1000; last=ts;

    for (const p of Object.keys(truth)) truth[p] = Math.max(0, truth[p] + (regenPerSec[p]||0) * dt);

    const now = Date.now();
    const ordered = [...pendingTx].sort((a,b)=>a.dateMs-b.dateMs);

    // Dispatch per-tx expiry countdown ticks for Update Log rows
    if (ordered.length){
      const nowMs = Date.now();
      const ticks = ordered.map(tx=>({ id: tx.id, seconds: Math.max(0, Math.ceil((Number(tx.ghostExpiryMs||0) - nowMs)/1000)) }));
      window.dispatchEvent(new CustomEvent('tx:expiry-tick',{ detail:{ ticks } }));
    }

    const vm = getViewMode();
    if (vm!=='core') refreshFocusCacheIfNeeded();

    let sumCurrent=0,sumMax=0;
    for (const pool of Object.keys(pools)){
      const el = elements[pool]; if (!el) continue;
      const v  = pools[pool] || {};
      const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);

      if (vm==='core'){
        const cap  = Math.max(0, daily * CORE_DAYS);
        const T    = truth[pool];

        // Ghost debits from pending
        let avail = { ...truth };
        let Lsplit = { health:0, mana:0, stamina:0, essence:0 };
        for (const tx of ordered){
          if (tx.ghostExpiryMs && tx.ghostExpiryMs <= now) continue;
          if (tx.amount >= 0) continue; // credits not previewed in reclaim
          const spend = Math.abs(tx.amount);
          const intent = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
          const part = allocateSpendAcrossPools(spend, intent==='mana'?'mana':'stamina', avail);
          Lsplit.health+=part.health||0; Lsplit.mana+=part.mana||0; Lsplit.stamina+=part.stamina||0;
        }
        const L = Lsplit[pool] || 0;
        const proj = applyRemainderFirst(T, cap, L);

        const useProjected = allowGhost && cap>0 && L>0.0001 && proj.ghostWidthPct>0.01;
        const pct = cap>0 ? ((useProjected ? proj.rAfter : proj.rNow)/cap)*100 : 0;
        el.fill.style.width = `${pct}%`;

        const normalText = `${(useProjected?proj.rAfter:proj.rNow).toFixed(2)} / ${cap.toFixed(2)}`;
        if (!el.value.__origText) el.value.__origText = el.value.textContent;
        el.value.textContent = el.value.classList.contains('is-rate') ? (el.value.__rateText || normalText) : normalText;
        enableGhostSoon();

        // Reclaim overlay
        const barEl = el.fill.closest('.bar');
        const reclaimEl = barEl?.querySelector('.bar-reclaim');
        const showGhost = allowGhost && cap>0 && L>0.0001 && proj.ghostWidthPct>0.01;
        if (reclaimEl){
          if (showGhost){
            reclaimEl.style.left  = `${Math.max(0,Math.min(100,proj.ghostLeftPct)).toFixed(2)}%`;
            reclaimEl.style.width = `${Math.max(0,Math.min(100,proj.ghostWidthPct)).toFixed(2)}%`;
            reclaimEl.style.opacity = '1';
          } else { reclaimEl.style.opacity='0'; reclaimEl.style.width='0%'; }
        }

        // Surplus pills (days over cap) — use original truthTotal baseline plus ghost preview
        const T_now = (proj.sNow*cap) + proj.rNow;      // live truth remainder within CORE_DAYS cap cycles
        const T_af  = (proj.sAfter*cap) + proj.rAfter;  // after pending
        const baselineTruth = Number(v.truthTotal || 0); // monthly-basis truth since anchor
        // Map baseline monthly truth to "core" window days: show days beyond one monthly cap
        const monthlyCap = Math.max(0, daily * AVG_MONTH_DAYS);
        const surplusNowDays = (daily>0) ? Math.floor(Math.max(0, (baselineTruth - monthlyCap) / daily)) : 0;
        const afterTruth = baselineTruth - (useProjected ? (T_now - T_af) : 0); // best-effort nudge
        const surplusAfDays  = (daily>0) ? Math.floor(Math.max(0, (afterTruth - monthlyCap) / daily)) : surplusNowDays;
        setSurplusPill(el, surplusNowDays, surplusAfDays);

        if (pool!=='essence'){ sumCurrent += (useProjected?proj.rAfter:proj.rNow); sumMax += cap; }
      } else {
        const daysIn = Math.max(1, (getViewMode()==='daily'?1:7));
        const cap = Math.max(0, daily * daysIn);
        const spent = Number(focusSpend?.[pool] || 0);
        let current = Math.max(0, Math.min(cap, cap - spent));
        const pct = cap>0 ? (current/cap)*100 : 0;
        el.fill.style.width = `${pct}%`;
        const txt = `${current.toFixed(2)} / ${cap.toFixed(2)}`;
        if (!el.value.__origText) el.value.__origText = el.value.textContent;
        el.value.textContent = el.value.classList.contains('is-rate') ? (el.value.__rateText || txt) : txt;

        // Hide surplus pills in Focus
        setSurplusPill(el, 0, 0);

        // Simple reclaim preview in Focus (clip current only)
        const barEl = el.fill.closest('.bar'); const reclaimEl = barEl?.querySelector('.bar-reclaim');
        if (reclaimEl){
          let availFocus = { health:current, mana: (pool==='mana')?current:0, stamina:(pool==='stamina')?current:0, essence:0 };
          let Lpool = 0;
          for (const tx of ordered){
            if (tx.ghostExpiryMs && tx.ghostExpiryMs <= now) continue;
            if (tx.amount >= 0) continue;
            const spend = Math.abs(tx.amount);
            const intent = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
            const part = allocateSpendAcrossPools(spend, intent==='mana'?'mana':'stamina', { ...availFocus });
            Lpool += Number(part[pool] || 0);
          }
          if (cap>0 && Lpool>0.0001 && current>0.0001){
            const eat = Math.min(Lpool, current);
            reclaimEl.style.left  = `${Math.max(0,Math.min(100, ((current-eat)/cap)*100)).toFixed(2)}%`;
            reclaimEl.style.width = `${Math.max(0,Math.min(100, (eat/cap)*100)).toFixed(2)}%`;
            reclaimEl.style.opacity = '1';
          } else { reclaimEl.style.opacity='0'; reclaimEl.style.width='0%'; }
        }
        if (pool!=='essence'){ sumCurrent+=current; sumMax+=cap; }
      }

      // Trend tint
      const barEl = elements[pool]?.fill?.closest('.bar');
      barEl?.classList.remove("overspending","underspending");
      const trend = v.trend || "stable";
      if (trend === "overspending")  barEl?.classList.add("overspending");
      if (trend === "underspending") barEl?.classList.add("underspending");
    }

    setVitalsTotals(sumCurrent, sumMax);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("vitals:viewmode", (e)=>{
    const raw = e?.detail?.mode || "daily";
    allowGhost = false; enableGhostSoon();
    refreshBarGrids();
    updateRatePeekTexts(elements, pools, raw==='core'?'core':raw);
    repaintEngravingLabels();
  });
  window.addEventListener("vitals:primary", ()=>{
    const vmNow = getViewMode();
    refreshBarGrids();
    updateRatePeekTexts(elements, pools, vmNow==='core'?'core':vmNow);
    repaintEngravingLabels();
  });
}

// ───────────────────────── Update Log (pending / recent) ────────────────────
function normalizeTxn(d){
  const x=d.data()||{};
  return {
    id:d.id, amount:Number(x.amount ?? x.amountMajor ?? 0),
    dateMs: x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? Date.now(),
    status: x.status || "pending",
    provisionalTag: x.provisionalTag || null,
    tag: x.tag || null,
    ghostExpiryMs: Number(x.ghostExpiryMs ?? 0),
    transactionData: { 
        description: x?.transactionData?.description || '', 
        entryDateMs: x?.transactionData?.entryDate?.toMillis?.() ?? null, 
    }
  };
}
export function listenUpdateLogPending(uid, cb, txCollectionPath){
  const qy = query(
    collection(db, txCollectionPath),
    where("status","==","pending"),
    orderBy("dateMs","desc"),
    limit(5)
  );
  return onSnapshot(qy,(snap)=>{ cb(snap.docs.map(normalizeTxn)); });
}
export function listenRecentlyConfirmed(uid, lookbackMs = 24*60*60*1000, cb, txCollectionPath){
  const since = Date.now() - lookbackMs;
  const qy = query(
    collection(db, txCollectionPath),
    where("status","==","confirmed"),
    where("tag.setAtMs",">=", since),
    orderBy("tag.setAtMs","desc"),
    limit(5)
  );
  return onSnapshot(qy,(snap)=>{ cb(snap.docs.map(normalizeTxn)); });
}
export async function setProvisionalTag(uid, txId, pool){
  const path = CURRENT_TX_COLLECTION_PATH || (await resolveDataSources(uid)).txCollectionPath;
  await updateDoc(doc(db, `${path}/${txId}`), { provisionalTag: { pool, setAtMs: Date.now() } });
}


// Long-press helper for inline editor
const LONG_PRESS_MS = 550;
function onLongPress(targetEl, startCb){
  let timer=null;
  const start=ev=>{ timer=setTimeout(()=>startCb(ev), LONG_PRESS_MS); };
  const clear=()=>{ if(timer) clearTimeout(timer); timer=null; };
  targetEl.addEventListener('mousedown', start);
  targetEl.addEventListener('mouseup', clear);
  targetEl.addEventListener('mouseleave', clear);
  targetEl.addEventListener('touchstart', start, {passive:true});
  targetEl.addEventListener('touchend', clear);
  targetEl.addEventListener('touchcancel', clear);
}
// ───────────────────────── UI: Events Log + History Modal ───────────────────
// Events Logs
export function autoInitUpdateLog(){
  const listEl   = document.querySelector("#update-log-list");
  const recentEl = document.querySelector("#recently-locked-list");
  if (!listEl && !recentEl) return;
  const auth = getAuth();
  onAuthStateChanged(auth,async (user) => {
    if (!user) return; const uid=user.uid;

    const ds = await resolveDataSources(uid); const col=collection(db, ds.txCollectionPath);
    function setActiveButtons(li,pool){
      const buttons=li.querySelectorAll(".tag-btn");
      buttons.forEach(b=>{ 
        b.classList.remove("active","stamina","mana"); 
        if (b.dataset.pool===pool) b.classList.add("active",pool);
      }, ds.txCollectionPath);
    }

    if (listEl){
      (async ()=>{ const { txCollectionPath } = await resolveDataSources(uid); })();
      resolveDataSources(uid).then(ds=>{
      listenUpdateLogPending(uid,(items)=>{
        listEl.innerHTML="";
        if (!items.length){ const li=document.createElement("li"); li.textContent="Nothing pending — nice!"; listEl.appendChild(li); return; }
        items.forEach(tx=>{
          const li=document.createElement("li"); li.setAttribute('data-tx',tx.id);
          const nowMs=Date.now(); const ttl=Number(tx.ghostExpiryMs||0); const secsLeft = ttl>nowMs ? Math.floor((ttl-nowMs)/1000) : 0;
          const minLeft=Math.floor(secsLeft/60); const secLeft=secsLeft%60;
          const name=tx.transactionData?.description||"Transaction";
          const amt = Number(tx.amount).toFixed(2);
          const tag = tx.provisionalTag?.pool ?? "stamina";
          const actionsHtml = `
            <div class="ul-actions two">
              <button class="tag-btn" data-pool="mana"    title="Mana"    aria-label="Mana">M</button>
              <button class="tag-btn" data-pool="stamina" title="Stamina" aria-label="Stamina">S</button>
            </div>`;
          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • <span class="countdown">${minLeft}m ${secLeft}s</span> • ${tag}</div>
              </div>
              ${actionsHtml}
            </div>`;
          setActiveButtons(li, tag);
          li.querySelectorAll(".tag-btn").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
              const pool=btn.getAttribute("data-pool"); setActiveButtons(li,pool); await setProvisionalTag(uid, tx.id, pool);
            });
          });
          listEl.appendChild(li);
          // Inline editor on long-press (description & amount; delete)
          onLongPress(li, ()=>{
            const existing = li.querySelector('.ul-editor'); if(existing) return;
            li.classList.add('is-editing');
            const main = li.querySelector('.ul-main');
            const actions = li.querySelector('.ul-actions'); if(actions) actions.style.display='none';
            const editor = document.createElement('div'); editor.className='ul-editor';
            const name = tx.transactionData?.description || 'Transaction';
            const amt = Number(tx.amount).toFixed(2);
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
              </div>`;
            editor.style.marginTop='0.5rem';
            main.appendChild(editor);
            const [descInput, amtInput] = editor.querySelectorAll('.ul-edit-input');
            const btnSave = editor.querySelector('.btn-save');
            const btnCancel = editor.querySelector('.btn-cancel');
            const btnDelete = editor.querySelector('.btn-delete');
            const cleanup = ()=>{ editor.remove(); li.classList.remove('is-editing'); if(actions) actions.style.display=''; };

            btnCancel.addEventListener('click', cleanup);
            btnSave.addEventListener('click', async ()=>{
              try{
                const path = CURRENT_TX_COLLECTION_PATH || (await resolveDataSources(uid)).txCollectionPath;
                const ref = doc(db, `${path}/${tx.id}`);
                const newDesc = String(descInput.value||'').slice(0,120);
                const newAmt  = Number(amtInput.value);
                await updateDoc(ref, {
                  transactionData: { ...(tx.transactionData||{}), description:newDesc },
                  amount: isFinite(newAmt)? newAmt : tx.amount
                });
                cleanup();
              }catch(e){ console.warn('Inline save failed', e); }
            });
            btnDelete.addEventListener('click', async ()=>{
              try{
                const path = CURRENT_TX_COLLECTION_PATH || (await resolveDataSources(uid)).txCollectionPath;
                await deleteDoc(doc(db, `${path}/${tx.id}`));
                cleanup();
              }catch(e){ console.warn('Inline delete failed', e); }
            });
          });
        });
      });

      // lightweight countdown tick (bus below updates empty payload; keep for future)
      window.addEventListener("tx:expiry-tick",(e)=>{
        const ticks=e?.detail?.ticks||[]; for (const {id,seconds} of ticks){
          const row=listEl?.querySelector(`li[data-tx="${id}"]`); if (!row) continue;
          const span=row.querySelector(".countdown"); if (!span) continue;
          const s=Math.max(0,Number(seconds)||0); const m=Math.floor(s/60); const r=s%60; span.textContent=`${m}m ${r}s`;
        }
      }, ds.txCollectionPath); });
    }

    if (recentEl){
      listenRecentlyConfirmed(uid, 24*60*60*1000, (items)=>{
        recentEl.innerHTML="";
        if (!items.length){ const li=document.createElement("li"); li.textContent="No recent locks."; recentEl.appendChild(li); return; }
        items.forEach(tx=>{
          const li=document.createElement("li");
          const name=tx.transactionData?.description||"Transaction";
          const amt = Number(tx.amount).toFixed(2);
          const when = tx.tag?.setAtMs ? new Date(tx.tag.setAtMs).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
          const intentPool = tx.tag?.pool ?? tx.provisionalTag?.pool ?? "stamina";
          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • ${when} <span class="badge ${intentPool}">${intentPool}</span></div>
              </div>
            </div>`;
          recentEl.appendChild(li);
        });
      }, ds.txCollectionPath); 
    };
  });
}

// History 
export function autoInitHistoryButtons() {
  const btn = document.getElementById('btn-expand-update');
  if (btn) btn.addEventListener('click', () => openHistoryFor_energy());
}

// ───────────────────────────── History helpers (energy-vitals compatible)
// Friendly label from the resolved tx collection path
function friendlySourceLabelFromTxPath(path) {
  return (String(path || '').endsWith('/verified')) ? 'Verified' : 'Manual Entry';
}

// Resolve context once: tx collection, label, and sources to include
async function getHistoryContext(uid) {
  const ds = await resolveDataSources(uid);
  const txPath = ds?.txCollectionPath || `players/${uid}/classifiedTransactions`;
  const sourceLabel = friendlySourceLabelFromTxPath(txPath);

  // Keep contributions visible in both modes; prefer base consistent with legacy
  const sources = txPath.endsWith('/verified')
    ? ['truelayer', 'stripe', 'manual_bank']
    : ['manual', 'stripe', 'manual_bank'];

  return { txPath, sourceLabel, sources };
}

// Row renderer (unchanged)
function renderTxRow(tx) {
  const name = tx?.transactionData?.description || 'Transaction';
  const amt  = Number(tx.amount || 0);
  const sign = amt >= 0 ? '+' : '−';
  const abs  = Math.abs(amt).toFixed(2);
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

// Menu definition: uses resolved tx collection + safe source filter
function historyMenuDef_energy({ uid, txPath, sourceLabel, sources }) {
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

      const col = collection(getFirestore(), txPath);
      let last = null;
      let loading = false;
      let done = false;
      let cache = [];

      // Detect if 'source' field exists at all (cheap heuristic: first page without filter)
      async function collectionHasSourceField() {
        const test = await getDocs(query(col, orderBy('dateMs', 'desc'), limit(5)));
        let seen = false;
        test.forEach(d => { if ((d.data() || {}).source != null) seen = true; });
        return seen;
      }

      let useSourceFilter = false;
      (async () => { useSourceFilter = await collectionHasSourceField(); })();

      async function fetchPage() {
        if (loading || done) return;
        loading = true;

        let qy = query(col, orderBy('dateMs', 'desc'), limit(50));
        if (useSourceFilter) qy = query(qy, where('source', 'in', sources));
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
            amount: Number(x.amount || x.amountMajor || 0),
            dateMs: x.dateMs || x.postedAtMs || x?.transactionData?.entryDate?.toMillis?.() || 0,
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
      b.className = 'btn';
      b.textContent = 'Close';
      b.addEventListener('click', () => window.MyFiModal.close());
      return [b];
    }
  };
}

function openHistoryFor_energy() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid;

  (async () => {
    const ctx = await getHistoryContext(uid); // { txPath, sourceLabel, sources }
    const def = historyMenuDef_energy({ uid, ...ctx });
    const menu = { history: def };
    window.MyFiModal.setMenu(menu);
    window.MyFiModal.open('history', { variant: 'single', menuTitle: 'Activity Log' });
  })();
}



// ───────────────────────── Dashboard helpers & buttons ──────────────────────
export async function refreshVitals(){
  try{
    const u=getAuth().currentUser; if(!u) return {};
    await recomputeVitalsGatewayStub(u.uid);
    return (await readGateway(u.uid))||{};
  } catch {
    return {};
  }
}
export async function lockExpiredOrOverflow(uid, queueCap = 50){ return { locked: 0 }; }
export async function getEssenceAvailableMonthlyFromHUD(uid){ return 0; }

export function autoInitAddEnergyButton(){
  const btn=document.getElementById("left-btn"); if(!btn) return;
  btn.addEventListener("click", async (e)=>{
    e.preventDefault();
    try {
      await openEnergyMenu();
    } catch (err) {
      console.error("Failed to open Energy Menu:", err);
    }
  });
}
export function autoInitAddSocialButton() {
  const btn = document.getElementById('right-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.MyFiModal?.openChildItem?.(window.MyFiSocialMenu, 'home', { menuTitle: 'Social' });
    });
  }
}
export function autoInitAddSpendButton(){
  const addBtn=document.getElementById('btn-add-spend');
  if (addBtn) addBtn.addEventListener('click',(e)=>{
    e.preventDefault();
    window.MyFiModal?.openChildItem?.(window.MyFiFinancesMenu,'addTransaction',{menuTitle:'Add Transaction'});
  });
}

// ───────────────────────── Small tick bus for countdowns ────────────────────
(function tickBus(){
  let last = 0;
  function t(){
    const now=Math.floor(Date.now()/1000);
    if (now!==last){ last=now; window.dispatchEvent(new CustomEvent("tx:expiry-tick",{ detail:{ ticks: [] }})); }
    requestAnimationFrame(t);
  }
  requestAnimationFrame(t);
})();

/* ────────────────────────────────────────────────────────────────────────────
   Mode UI wiring
   ──────────────────────────────────────────────────────────────────────────── */
(function(){
  const run = ()=>{
    // Ensure labels and classes are present from the start
    repaintEngravingLabels();

    const engrave = document.getElementById("mode-engrave");
    if (engrave){
      const vm = getViewMode();
      const titleLabel = (vm==='core') ? displayLabelFor('core') : displayLabelFor(vm);
      engrave.title = `View mode: ${titleLabel} — tap a rune to change`;
    }

    const coreBtn  = document.getElementById("engrave-core");
    const focusBtn = document.getElementById("engrave-focus");

    if (coreBtn && !coreBtn.__wired){
      coreBtn.__wired = true;
      coreBtn.addEventListener("click", ()=>{
        setPrimaryMode("core");
        window.dispatchEvent(new CustomEvent("vitals:viewmode",{ detail:{ mode:"core" }}));
        refreshBarGrids();
        updateModeEngrave("core");
        repaintEngravingLabels();
      });
      coreBtn.title = "Current (30.44-day cycle)";
    }

    if (focusBtn && !focusBtn.__wired){
      focusBtn.__wired = true;
      focusBtn.addEventListener("click", ()=>{
        if (getPrimaryMode()==="core"){
          setPrimaryMode("focus");
          const vm2 = getViewMode(); // coerced daily|weekly
          window.dispatchEvent(new CustomEvent("vitals:viewmode",{ detail:{ mode: vm2 }}));
          updateModeEngrave(vm2);
        } else {
          cycleViewMode(); // toggles daily ↔ weekly
        }
        refreshBarGrids();
        repaintEngravingLabels();
      });
      const vm2 = getViewMode();
      focusBtn.title = `Focus (${displayLabelFor(vm2)}) — tap to cycle`;
    }

    refreshBarGrids();
    updateModeEngrave(getViewMode());
  };

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run, { once:true });
  } else {
    run();
  }
})();
