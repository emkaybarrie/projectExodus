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
  query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc, startAfter
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { openEnergyMenu } from "./modules/energy-menu.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

import { loadCSS } from "../js/core/utilities.js";

import {
  loadVitalsSnapshot,
  storeVitalsSnapshot,
  loadVitalsSnapshotRemote,   
  storeVitalsSnapshotRemote,  
  runWakeRegenAnimation,

  initEmberwardFrame,
  
  initSummaryModal, openSummaryFromGateway , openSummaryModal, buildSummaryFromHUDFallback,

  wireVitalsStatusToggle
} from "./energy-vitals-NEW_FUNCTIONS.js";

import { autoInitSpiritStoneButton } from './modules/vitals-spirit-menu.js';

// ───────────────────────────────── CSS ─────────────────────────────────────

(function ensureScreenCss(){
  // Give it an id so it’s easy to spot in DOM; dedupe happens by href anyway.
  // Main
  loadCSS('./vitals/modules/vitalsScreen.css', { id: 'vitals-screen-css', preload: true })
    .catch(err => console.warn('[Vitals Screen] CSS load failed', err));
  // Spirit Stone Menu
  // loadCSS('./vitals/modules/spiritStoneMenu.css', { id: 'spirit-stone-menu-css', preload: true })
  // .catch(err => console.warn('[Spirirt Stone Menu] CSS load failed', err));
})();

// ───────────────────────────────── Constants ────────────────────────────────
const MS_PER_DAY     = 86_400_000;
const AVG_MONTH_DAYS = 30.44;      // cap basis

const CORE_DAYS   = 30.44;         // HUD “Current” window (visual only)
const VIEW_MODES  = ["daily","weekly"];
const VIEW_FACTORS= { daily:1, weekly:7 };

const DEFAULT_TITLE = "VITALS";
const MAX_ALIAS_LEN = 16;
const COLLAPSE_LEN_HINT = 14;

// HUD readiness flag so refreshers can no-op or do a static paint before init
let __HUD_READY = false;

// ─────────────────────────────── Cycle constants & config ───────────────────
const CYCLE_DAYS = AVG_MONTH_DAYS; // 30.44 — treat as the Cycle length

function todayLocalKey(){
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

// Read vitals config flags from cashflowData (with sensible defaults)
function readVitalsFlags(A){
  // Essence baseline on/off; default OFF
  const essenceBaselineEnabled = !!A?.essenceBaselineEnabled;

  // Redistribution vector for the would-be Essence share when baseline disabled
  const R = A?.redistributionR || { h: 0.34, m: 0.33, s: 0.33 }; // must sum to 1

  // Essence soft-cap mode for UI only: "MS" or "HMS"
  const essenceSoftCapMode = (String(A?.essenceSoftCapMode||'HMS').toUpperCase()==='HMS') ? 'HMS':'MS';

  // Overflow buffer in days of regen before counting as overflow to Essence
  const overflowBufferDays = Number.isFinite(A?.overflowBufferDays) ? A.overflowBufferDays : 0;

  return { essenceBaselineEnabled, R, essenceSoftCapMode, overflowBufferDays };
}


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

// Resolve the cycle window start (anchor or 1st of current month)
function resolveCycleStartMs(payCycleAnchorMs){
  if (Number.isFinite(payCycleAnchorMs) && payCycleAnchorMs > 0) return payCycleAnchorMs;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

// Days strictly since cycle window start (anchor or 1st of month)
function daysSincePayCycleStart(payCycleAnchorMs){
  const start = resolveCycleStartMs(payCycleAnchorMs);
  return Math.max(0, (Date.now() - start) / MS_PER_DAY);
}

// ---------- HUD number formatting (one knob) ----------
const HUD_DECIMALS = 0; // ← change this to 1/2/etc later to update all value texts

const hudFmt = (n, d = HUD_DECIMALS) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
};



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
    //const snap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));
    const snap = await getDoc(doc(db, `players/${uid}/financialData/cashflowData`));
    if (snap.exists()){
      const d = snap.data() || {};
      
      const health  = safeNum(d.poolAllocations.healthAllocation, 0.3);
      const mana    = safeNum(d.poolAllocations.manaAllocation,   0.3);
      const stamina = safeNum(d.poolAllocations.staminaAllocation,0.3);
      const essence = safeNum(d.poolAllocations.essenceAllocation,0.1); // can be zero safely
      const sum = Math.max(1e-9, health+mana+stamina+essence);
      return {
        health:  health/sum,
        mana:    mana/sum,
        stamina: stamina/sum,
        essence: essence/sum,
      };
    }
  }catch(_){}
  return { health:0.3, mana:0.3, stamina:0.3, essence:0.1 };
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
// Reads processedTransactions and returns in-window totals (spends & credits split)
async function readNonCoreUsage(db, uid, windowStartMs, creditMode = 'essence', txCollectionPath){
  const base = collection(db, txCollectionPath);
  const shot = await getDocs(base);

  const zeroPools = () => ({ health:0, mana:0, stamina:0, essence:0 });

  const totals = {
    all:    { spends: zeroPools(), credits: zeroPools() },   // window: ≥ anchor
    last7:  { spends: zeroPools(), credits: zeroPools() },   // last 7d (clamped to window)
    pending: zeroPools()                                     // signed preview (unchanged)
  };

  const sevenAgo = Date.now() - 7*MS_PER_DAY;
  const sevenWindowStart = Math.max(Number(windowStartMs||0), sevenAgo);

  function add(obj, k, v){ obj[k] = Number((Number(obj[k]||0) + Number(v||0)).toFixed(2)); }

  function applyAllocatedCredit(amount, intent, when){
    const avail = { health: Infinity, mana: Infinity, stamina: Infinity, essence: 0 };
    const split = allocateSpendAcrossPools(amount, intent==='mana'?'mana':'stamina', avail);
    const B = totals.all.credits;
    add(B,'health',  split.health  || 0);
    add(B,'mana',    split.mana    || 0);
    add(B,'stamina', split.stamina || 0);
    if (when >= sevenWindowStart){
      const C = totals.last7.credits;
      add(C,'health',  split.health  || 0);
      add(C,'mana',    split.mana    || 0);
      add(C,'stamina', split.stamina || 0);
    }
  }

  shot.forEach(d=>{
    const tx  = d.data() || {};
    const amt = safeNum(tx.amount ?? tx.amountMajor ?? 0, 0);
    if (!amt) return;

    const cls = String(tx.classification || '').toLowerCase();
    if (cls === 'coreinflow' || cls === 'coreoutflow') return;

    const status   = String(tx.status || 'confirmed').toLowerCase();
    const when     = safeNum(tx.dateMs ?? tx.postedAtMs ?? tx.transactionData?.entryDate?.toMillis?.(), 0);
    const inWindow = (when >= Number(windowStartMs||0));

    // CREDITS (amt > 0)
    if (amt > 0){
      const txOverride = String(tx.creditModeOverride || '').toLowerCase();
      const effMode = (txOverride === 'essence' || txOverride === 'health' || txOverride === 'allocate')
        ? txOverride : creditMode;

      if (status === 'pending'){
        if (effMode === 'essence') add(totals.pending,'essence', amt);
        else if (effMode === 'health') add(totals.pending,'health', amt);
        else {
          const intent = tx?.tag?.pool || tx?.provisionalTag?.pool || 'stamina';
          const split  = allocateSpendAcrossPools(amt, intent==='mana'?'mana':'stamina', { health:Infinity, mana:Infinity, stamina:Infinity, essence:0 });
          add(totals.pending,'health',  split.health  || 0);
          add(totals.pending,'mana',    split.mana    || 0);
          add(totals.pending,'stamina', split.stamina || 0);
        }
      } else if (inWindow){
        if (effMode === 'essence'){
          add(totals.all.credits,'essence', amt);
          if (when >= sevenWindowStart) add(totals.last7.credits,'essence', amt);
        } else if (effMode === 'allocate'){
          const intent = tx?.tag?.pool || tx?.provisionalTag?.pool || 'stamina';
          applyAllocatedCredit(amt, intent, when);
        } else if (effMode === 'health'){
          add(totals.all.credits,'health', amt);
          if (when >= sevenWindowStart) add(totals.last7.credits,'health', amt);
        }
      }
      return;
    }

    // DEBITS (amt < 0)
    const spend = Math.abs(amt);

    if (status === 'pending'){
      const intent = tx?.provisionalTag?.pool || tx?.tag?.pool || 'stamina';
      const alloc  = allocateSpendAcrossPools(spend, intent==='mana' ? 'mana' : 'stamina', { health:Infinity, mana:Infinity, stamina:Infinity, essence:0 });
      add(totals.pending,'health',  -(alloc.health  || 0));
      add(totals.pending,'mana',    -(alloc.mana    || 0));
      add(totals.pending,'stamina', -(alloc.stamina || 0));
      return;
    }

    if (!inWindow) return;

    // Confirmed: prefer appliedAllocation
    const applied = tx.appliedAllocation || null;
    if (applied){
      add(totals.all.spends,'health',  safeNum(applied.health,  0));
      add(totals.all.spends,'mana',    safeNum(applied.mana,    0));
      add(totals.all.spends,'stamina', safeNum(applied.stamina, 0));
      add(totals.all.spends,'essence', safeNum(applied.essence, 0));
      if (when >= sevenWindowStart){
        add(totals.last7.spends,'health',  safeNum(applied.health,  0));
        add(totals.last7.spends,'mana',    safeNum(applied.mana,    0));
        add(totals.last7.spends,'stamina', safeNum(applied.stamina, 0));
        add(totals.last7.spends,'essence', safeNum(applied.essence, 0));
      }
      return;
    }

    // Fallback split by intent
    const intent = tx?.tag?.pool || tx?.provisionalTag?.pool || 'stamina';
    const alloc  = allocateSpendAcrossPools(spend, intent==='mana' ? 'mana' : 'stamina', { health:Infinity, mana:Infinity, stamina:Infinity, essence:0 });

    add(totals.all.spends,'health',  alloc.health  || 0);
    add(totals.all.spends,'mana',    alloc.mana    || 0);
    add(totals.all.spends,'stamina', alloc.stamina || 0);
    if (when >= sevenWindowStart){
      add(totals.last7.spends,'health',  alloc.health  || 0);
      add(totals.last7.spends,'mana',    alloc.mana    || 0);
      add(totals.last7.spends,'stamina', alloc.stamina || 0);
    }
  });

  return totals;
}



// ───────────────────────── Vitals Gateway recompute (stub) ──────────────────
export async function recomputeVitalsGatewayStub(uid){
  const { cashflowDocPath, txCollectionPath } = await resolveDataSources(uid);

  const activeRef = doc(db, cashflowDocPath);
  const activeSnap = await getDoc(activeRef);

  // Ensure gateway doc exists to read meta/escrow, etc.
  const gatewayRef = doc(db, `players/${uid}/vitalsData/gateway`);
  const priorGatewaySnap = await getDoc(gatewayRef);
  const priorGateway = priorGatewaySnap.exists() ? (priorGatewaySnap.data()||{}) : {};

  if (!activeSnap.exists()){
    // Minimal bootstrap to keep callers happy
    await setDoc(gatewayRef, {
      transactionMode: "unverified",
      mode: "continuous",
      cadence: "monthly",
      payCycleAnchorMs: null,
      lastAnchorUpdateMs: null,
      core: { dailyIncome:0, dailyExpense:0, netDaily:0 },
      pools: {
        health:{  max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,truthTotal:0,bankedDays:0,trend:"stable" },
        mana:{    max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,truthTotal:0,bankedDays:0,trend:"stable" },
        stamina:{ max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,truthTotal:0,bankedDays:0,trend:"stable" },
        essence:{ max:0,current:0,regenDaily:0,spentToDate:0,creditToDate:0,truthTotal:0,bankedDays:0,trend:"stable" },
      },
      meta: {
        seededAtMs: priorGateway?.meta?.seededAtMs || null,
        seedAnchorMs: priorGateway?.meta?.seedAnchorMs ?? null,
        essenceSeedGrant: safeNum(priorGateway?.meta?.essenceSeedGrant, 0),
        lastCrystallisedDay: priorGateway?.meta?.lastCrystallisedDay || null,
        escrow: {
          carry: priorGateway?.meta?.escrow?.carry || { total:0, bySource:{ health:0, mana:0, stamina:0 } },
          bySourceToday: { health:0, mana:0, stamina:0 }
        }
      },
      updatedAt: Date.now()
    }, { merge:true });
    return;
  }

  const A = activeSnap.data() || {};
  const transactionMode = String(A.transactionMode)
  const mode = String(A.energyMode || A.mode || 'continuous').toLowerCase();
  const creditMode = resolveCreditMode(A);

  const { essenceBaselineEnabled, R, essenceSoftCapMode, overflowBufferDays } = readVitalsFlags(A);

  const payCycleAnchorMs   = safeNum(A.payCycleAnchorMs ?? A.anchorMs, NaN);
  const lastAnchorUpdateMs = safeNum(A.lastAnchorUpdateMs, NaN);

  const incMo = safeNum(A?.inflow?.total ?? A?.inflow ?? 0, 0);
  const outMo = safeNum(A?.outflow?.total ?? A?.outflow ?? 0, 0);
  const dailyIncome  = incMo / CYCLE_DAYS;
  const dailyExpense = outMo / CYCLE_DAYS;
  const netDaily     = dailyIncome - dailyExpense;

  const alloc = await readAllocations(db, uid);

  // Base regen from allocations (per-day)
  const baseRegen = {
    health:  Number((netDaily * alloc.health ).toFixed(2)),
    mana:    Number((netDaily * alloc.mana   ).toFixed(2)),
    stamina: Number((netDaily * alloc.stamina).toFixed(2)),
    essence: Number((netDaily * alloc.essence).toFixed(2)),
  };

  // Apply redistribution of the would-be Essence share when baseline is disabled
  let regenDaily = { ...baseRegen };
  if (!essenceBaselineEnabled){
    const e = Math.max(0, baseRegen.essence);
    regenDaily.essence = 0;
    regenDaily.health  = Number((regenDaily.health  + e * (R.h||0)).toFixed(2));
    regenDaily.mana    = Number((regenDaily.mana    + e * (R.m||0)).toFixed(2));
    regenDaily.stamina = Number((regenDaily.stamina + e * (R.s||0)).toFixed(2));
  }

  // Static caps (baseline-only; unaffected by redistribution/nudge)
  const cap = {
    health:  Math.max(0, alloc.health  * netDaily * CYCLE_DAYS),
    mana:    Math.max(0, alloc.mana    * netDaily * CYCLE_DAYS),
    stamina: Math.max(0, alloc.stamina * netDaily * CYCLE_DAYS),
    essence: 0 // Essence has no real cap; handled via soft-cap in UI only
  };
  Object.keys(cap).forEach(k=> cap[k] = Number(cap[k].toFixed(2)));

  // Windowed usage since resolved start (anchor or 1st of month)
  const windowStartMs = resolveCycleStartMs(payCycleAnchorMs);
  const usage = await readNonCoreUsage(db, uid, windowStartMs, creditMode, txCollectionPath);

  // Days since anchor (for truth accumulation)
  const days = daysSincePayCycleStart(payCycleAnchorMs);

  // Optional simple trend via 7-day spend vs baseline (unchanged approach)
  function trendFor(pool){
    const base    = Math.max(0, regenDaily[pool]);
    const used7   = safeNum(usage.last7.spends?.[pool], 0);
    const expect7 = base * 7;
    if (expect7 <= 0) return "stable";
    if (used7 > expect7 * 1.15) return "overspending";
    if (used7 < expect7 * 0.80) return "underspending";
    return "on target";
  }

  // Seeding (one-time at player start) — sticky unless EXPLICIT anchor changes.
  // If no anchor is set, we tie the seed to `null` (not the 1st-of-month fallback).
  let meta = priorGateway?.meta || {
    seededAtMs: null,
    seedAnchorMs: null,
    essenceSeedGrant: 0,
    lastCrystallisedDay: null,
    escrow: { carry: { total:0, bySource:{ health:0, mana:0, stamina:0 } }, bySourceToday: { health:0, mana:0, stamina:0 } }
  };
  
  // IMPORTANT: do NOT resolve fallback here. We only care about the *explicit* anchor.
  const anchorForSeed =
    (Number.isFinite(payCycleAnchorMs) && payCycleAnchorMs > 0) ? payCycleAnchorMs : null;
  const anchorChanged = (meta.seedAnchorMs ?? null) !== anchorForSeed;

  // ── Reset escrow if the explicit anchor changed (window moved ⇒ prior overflow invalid)
  if (anchorChanged) {
    meta.escrow = {
      carry: { total: 0, bySource: { health: 0, mana: 0, stamina: 0 } },
      bySourceToday: { health: 0, mana: 0, stamina: 0 }
    };
    // Set the crystallisation marker to today so we don't "auto-crystallise" a zeroed carry
    meta.lastCrystallisedDay = todayLocalKey();
  }

  
  // Use persisted grant unless we have never seeded or the explicit anchor changed.
  let essenceSeedGrant = safeNum(meta.essenceSeedGrant, 0);
  if (!meta.seededAtMs || anchorChanged || !Number.isFinite(essenceSeedGrant)) {
    const msSpent = safeNum(usage.all.spends?.mana,0) + safeNum(usage.all.spends?.stamina,0);
    const msCaps  = Math.max(0, cap.mana + cap.stamina);
    essenceSeedGrant = Math.max(0, msCaps - msSpent);
    meta.seededAtMs       = Date.now();
    meta.seedAnchorMs     = anchorForSeed;             // may be null
    meta.essenceSeedGrant = Number(essenceSeedGrant.toFixed(2));
  }
  
  const capsNow = { ...cap };
  const poolSeed = {
    health:  capsNow.health, // full at start
    mana:    0,
    stamina: 0,
    essence: Math.max(0, essenceSeedGrant),
  };

  // Crystalise yesterday’s escrow (1-day) into Essence on local day change
  const priorDay = priorGateway?.meta?.lastCrystallisedDay || null;
  const nowDay   = todayLocalKey();
  let crystallisedToday = 0;
  let carryEscrow = meta?.escrow?.carry || { total:0, bySource:{ health:0, mana:0, stamina:0 } };

  if (priorDay && priorDay !== nowDay){
    // move carry (yesterday) into Essence
    crystallisedToday = Math.max(0, Number(carryEscrow.total || 0));
    carryEscrow = { total:0, bySource:{ health:0, mana:0, stamina:0 } };
  }

  // Truth totals (no wrap) and currents (clamped to cap)
  const poolsOut = {};
  const basePools = ["health","mana","stamina","essence"];

  // Essence credits include: confirmed credits to Essence + crystallisedToday + essenceSeedGrant
  const essenceCreditsExtra = safeNum(usage.all.credits?.essence,0) + crystallisedToday;

  for (const k of basePools){
    const spent  = safeNum(usage.all.spends?.[k], 0);
    const credit = (k === 'essence')
      ? essenceCreditsExtra
      : safeNum(usage.all.credits?.[k], 0);

    //const T = Math.max(0, (poolSeed[k]||0) + (regenDaily[k]||0) * days - spent + credit); // no wrap + seeded start
    //const maxK = (k === 'essence') ? 0 : capsNow[k];
    //const current = (k === 'essence') ? T : clamp(T, 0, maxK);

    // NEW — allow negative truth for Health only
    const rawT = (poolSeed[k]||0) + (regenDaily[k]||0) * days - spent + credit;

    // Health: keep raw (can be negative). Others: clamp to >= 0 like before.
    const T = (k === 'health')
    ? Number(rawT.toFixed(2))
    : Math.max(0, Number(rawT.toFixed(2)));

    const maxK   = (k === 'essence') ? 0 : capsNow[k];
    // UI current always clamped (health negative renders as 0)
    const current = (k === 'essence') ? T : clamp(T, 0, maxK);

    // Derive explicit debt for Health (for “revival”)
    const debt = (k === 'health' && T < 0) ? Math.abs(T) : 0;

    poolsOut[k] = {
      max:           Number(maxK.toFixed(2)),
      current:       Number(current.toFixed(2)),
      regenDaily:    Number((regenDaily[k]||0).toFixed(2)),
      spentToDate:   Number(spent.toFixed(2)),
      creditToDate:  Number(credit.toFixed(2)),
      truthTotal:    Number(T.toFixed(2)),
      bankedDays:    Number(priorGateway?.pools?.[k]?.bankedDays || 0), // updated below for H/M/S
      trend:         trendFor(k),
        ...(k === 'health' ? { debt: Number(debt.toFixed(2)) } : {})
    };
  }

  // Overflow → today escrow; banked days (crystallised) counters (H/M/S only)
  const bufferDays = Math.max(0, Number(overflowBufferDays||0));
  const newBySource = { health:0, mana:0, stamina:0 };

  ["health","mana","stamina"].forEach(k=>{
    const capK   = poolsOut[k].max;
    const rdK    = poolsOut[k].regenDaily;
    const truthK = poolsOut[k].truthTotal;

    const alreadyBankedAmt = 0; // keep simple client-side; backend can reconcile exacts if needed
    const threshold = capK + bufferDays * rdK;
    const overflowToday = Math.max(0, truthK - threshold) - alreadyBankedAmt;

    if (overflowToday > 0){
      newBySource[k] = Number(overflowToday.toFixed(2));
    }

    // banked days shown via crystallised days only; increment when crystallised
    // we don’t change bankedDays here; it grows only when carry is crystallised
  });

  // Update carry using only the delta vs the last saved "level for today"
  // If today’s overflow shrinks (due to spend), we decrease carry accordingly.
  const prevBySourceToday =
    (priorDay && priorDay !== nowDay)
      ? { health:0, mana:0, stamina:0 } // day flipped: reset baseline
      : (priorGateway?.meta?.escrow?.bySourceToday || { health:0, mana:0, stamina:0 });

  const bySourceToday = {
    health: Number(newBySource.health  || 0),
    mana:   Number(newBySource.mana    || 0),
    stamina:Number(newBySource.stamina || 0),
  };

  const delta = {
    health: Number((bySourceToday.health  - Number(prevBySourceToday.health  || 0)).toFixed(2)),
    mana:   Number((bySourceToday.mana    - Number(prevBySourceToday.mana    || 0)).toFixed(2)),
    stamina:Number((bySourceToday.stamina - Number(prevBySourceToday.stamina || 0)).toFixed(2)),
  };

  // Apply signed delta and clamp per source to >= 0; recompute total from parts.
  const nextCarryBySource = {
    health: Number(Math.max(0, Number(carryEscrow.bySource?.health  || 0) + delta.health ).toFixed(2)),
    mana:   Number(Math.max(0, Number(carryEscrow.bySource?.mana    || 0) + delta.mana   ).toFixed(2)),
    stamina:Number(Math.max(0, Number(carryEscrow.bySource?.stamina || 0) + delta.stamina).toFixed(2)),
  };
  carryEscrow.bySource = nextCarryBySource;
  carryEscrow.total    = Number((nextCarryBySource.health + nextCarryBySource.mana + nextCarryBySource.stamina).toFixed(2));

  // If we just crystallised, convert that into bankedDays per pool (days = crystallised_by_pool / regenDaily_k)
  if ((priorDay && priorDay !== nowDay) && (priorGateway?.meta?.escrow?.carry)){
    const prevCarry = priorGateway.meta.escrow.carry;
    ["health","mana","stamina"].forEach(k=>{
      const rd = Math.max(0.0001, poolsOut[k].regenDaily);
      const prevAmt = Number(prevCarry?.bySource?.[k] || 0);
      const daysBankedInc = Math.floor(prevAmt / rd);
      if (daysBankedInc > 0){
        const prev = Number(priorGateway?.pools?.[k]?.bankedDays || 0);
        poolsOut[k].bankedDays = prev + daysBankedInc;
      }
    });
  }

  // Essence soft-cap for UI (store derived so HUD can read)
  const softCapEssence = (essenceSoftCapMode === 'HMS')
    ? (poolsOut.health.max + poolsOut.mana.max + poolsOut.stamina.max)
    : (poolsOut.mana.max + poolsOut.stamina.max);
  const essenceUI = {
    softCapMode: essenceSoftCapMode,
    softCap: Number(softCapEssence.toFixed(2)),
    escrowToday: bySourceToday, // level so far today (used by UI overlays)
  };

  // NEW — build a real Shield pool from escrow + soft cap
{
  const carryTot = Number((carryEscrow?.total || 0).toFixed(2));
  const softCap  = Number((essenceUI?.softCap || 0).toFixed(2));

  // "days worth" = carry / (H+M+S per-day)
  const hmsPerDay = Math.max(
    0,
    Number(poolsOut.health?.regenDaily || 0) +
    Number(poolsOut.mana?.regenDaily || 0) +
    Number(poolsOut.stamina?.regenDaily || 0)
  );
  const shieldDays = (hmsPerDay > 0) ? Math.floor(carryTot / hmsPerDay) : 0;

  poolsOut.shield = {
    max:          softCap,
    // Current is the escrow amount; clamp for width consistency, but value text can still show full
    current:      Number(Math.min(softCap || Infinity, carryTot).toFixed(2)),
    regenDaily:   0,
    spentToDate:  0,
    creditToDate: 0,
    truthTotal:   carryTot,         // no wrap
    bankedDays:   shieldDays,
    trend:        "stable"
  };
}

  const healthDebt = Math.max(0, Number(poolsOut?.health?.debt || 0));  

  const payload = {
    transactionMode,
    mode,
    cadence: "monthly",
    payCycleAnchorMs:   Number.isFinite(payCycleAnchorMs)   ? payCycleAnchorMs   : null,
    lastAnchorUpdateMs: Number.isFinite(lastAnchorUpdateMs) ? lastAnchorUpdateMs : null,
    core: {
      dailyIncome:  Number(dailyIncome.toFixed(2)),
      dailyExpense: Number(dailyExpense.toFixed(2)),
      netDaily:     Number(netDaily.toFixed(2)),
    },
    pools: poolsOut,
    essenceUI,
    meta: {
      seededAtMs: meta.seededAtMs || null,
      seedAnchorMs: meta?.seedAnchorMs ?? null,
      essenceSeedGrant: Number(meta?.essenceSeedGrant ?? 0),
      lastCrystallisedDay: nowDay,
      escrow: {
        carry: carryEscrow,
        bySourceToday // save today's *level* (not cumulative) for delta on next recompute
      },
      debts: { health: healthDebt, asOf: nowDay } // new, non-breaking
    },
    updatedAt: Date.now()
  };

  await setDoc(gatewayRef, payload, { merge:true });
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
    titleEl.classList.toggle('is-gt10', (capped.length > 8));
    titleEl.classList.toggle('is-gt12', (capped.length > 10)); }
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
  const pools = ["health","mana","stamina","essence", "shield"]; const map = {};
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
function paintBarGrid(gridEl, totalDays, tickEveryDays = 1){
  gridEl.innerHTML = '';

  // number of interior ticks (exclude the right edge at 100%)
  const tickCount = Math.floor(totalDays / tickEveryDays);

  for (let i = 1; i <= tickCount; i++){
    const leftPct = (i * tickEveryDays / totalDays) * 100;
    if (leftPct >= 100) break;          // avoid a line on the far right border
    const line = document.createElement('div');
    line.className = 'grid-line';
    line.style.left = leftPct.toFixed(4) + '%';
    gridEl.appendChild(line);
  }
}
function refreshBarGrids(){
  const vm = getViewMode();

  // Decide total span and tick spacing
  let totalDays, tickEvery;
  if (vm === 'core') {
    totalDays = CORE_DAYS;  // your cycle length (e.g., 28/30/31)
    tickEvery = 7;          // weeks
  } else if (vm === 'weekly') {          // "Focus: This Week"
    totalDays = 7;
    tickEvery = 1;          // days
  } else {
    // fallback for other focus modes (keep your prior behavior)
    totalDays = VIEW_FACTORS[vm] || 7;
    tickEvery = 1;
  }

  const pools = ["health","mana","stamina","shield","essence"];
  for (const p of pools){
    const root = document.querySelector(`#vital-${p}`);
    const bar  = root?.querySelector('.bar');
    if (!bar) continue;

    let grid = bar.querySelector('.bar-grid');
    if (!grid){
      grid = document.createElement('div');
      grid.className = 'bar-grid';
      bar.insertBefore(grid, bar.querySelector('.bar-fill'));
    }
    paintBarGrid(grid, totalDays, tickEvery);
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

// Sum of daily regen for H/M/S (used as the "one day of energy" budget)
function getDailyHMS(data){
  const p = data?.pools || {};
  const h = Number(p.health?.regenDaily ?? p.health?.regenCurrent ?? 0);
  const m = Number(p.mana?.regenDaily   ?? p.mana?.regenCurrent   ?? 0);
  const s = Number(p.stamina?.regenDaily?? p.stamina?.regenCurrent?? 0);
  return Math.max(0, h + m + s);
}

// Compute "days worth" from a carry amount
function shieldDaysFromCarry(carry, data){
  const denom = getDailyHMS(data);
  if (denom <= 0.0001) return 0;       // avoid div-by-zero; treat as 0 days
  return Math.floor(Math.max(0, Number(carry||0)) / denom);
}

function installShieldBreakdown(getData){
  const bar = document.querySelector('#vital-shield .bar');
  if (!bar || bar.__shieldBreakdownWired) return;
  bar.__shieldBreakdownWired = true;

  const fill = bar.querySelector('.bar-fill');
  if (!fill) return;

  // Create dedicated overlay inside the fill so it clips & matches shape
  const overlay = document.createElement('div');
  overlay.className = 'shield-breakdown';
  fill.appendChild(overlay);

  const HIDE_MS = 1500;
  let timer = null;
  let isOn = false;

  function paint(d){
    // composition of the *carry* (energy shield total)
    const by = d?.meta?.escrow?.carry?.bySource || { health:0, mana:0, stamina:0 };
    const h = Math.max(0, +by.health  || 0);
    const m = Math.max(0, +by.mana    || 0);
    const s = Math.max(0, +by.stamina || 0);
    const tot = h + m + s;
    if (!tot){
      overlay.style.opacity = '0';
      overlay.classList.remove('is-visible');
      return;
    }

    const hp = (h / tot) * 100;
    const mp = (m / tot) * 100;
    // NOTE: right segment is whatever remains for stamina.
    overlay.style.background = `linear-gradient(90deg,
      var(--health-color, #7f1d1d) 0% ${hp.toFixed(2)}%,
      var(--mana-color,   #164e63) ${hp.toFixed(2)}% ${(hp+mp).toFixed(2)}%,
      var(--stamina-color,#14532d) ${(hp+mp).toFixed(2)}% 100%
    )`;
  }

  function show(){
    paint(getData());
    overlay.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(hide, HIDE_MS);
    isOn = true;
  }
  function hide(){
    overlay.classList.remove('is-visible');
    isOn = false;
  }

  // Toggle on tap
  bar.addEventListener('click', () => (isOn ? hide() : show()), { passive:true });

  // Keep correct if gateway refreshes while visible
  window.addEventListener('vitals:refresh', (e)=>{
    if (!isOn) return;
    paint(e?.detail?.data || getData());
  });

  // Hide on mode switches / primary toggle for consistency
  window.addEventListener('vitals:viewmode', hide);
  window.addEventListener('vitals:primary', hide);
}





// ───────────────────────── Gateway reader for HUD paint ─────────────────────
async function readGateway(uid){
  const snap = await getDoc(doc(db, `players/${uid}/vitalsData/gateway`));
  return snap.exists() ? (snap.data()||{}) : null;
}

// ───────────────────────────── Public: Static paint (HUD) ───────────────────

/**
 * loadVitalsToHUD(uid, opts?)
 *  - Default: fetch + paint.
 *  - Paint-only: pass { data, paintOnly:true } to *paint exactly what's given*.
 *  - Per-frame speed: set { refreshGrids:false } during animation frames.
 *  - No Shield overlay is ever shown here.
 */
export async function loadVitalsToHUD(uid, opts = {}) {
  const {
    data: dataIn = null,
    paintOnly = false,          // true = use provided data, no fetch/handlers
    refreshGrids = true,
    skipHandlers = false,       // extra guard if you really want to skip handlers
    elements: elementsIn = null // reuse a cached elements map if you have one
  } = opts;

  const data = dataIn || await readGateway(uid);
  if (!data) return;

  const elements = elementsIn || getVitalsElements();
  const pools = data.pools || {};
  const vm = getViewMode();

  // Handlers only when we’re in the normal fetch path
  if (!paintOnly && !skipHandlers) {
    installRatePeekHandlers(elements, pools, vm === 'core' ? 'core' : vm);
    ensureReclaimLayers(elements); // harmless if already there
  }



  const essenceSoftCap = Number(data?.essenceUI?.softCap || 0);

  let sumCurrent = 0, sumMax = 0;

  // Paint all pools (H/M/S/Essence)
  for (const [pool, v] of Object.entries(pools)) {
    const el = elements[pool]; if (!el) continue;

    const cap     = Number(v.max || 0);
    const current = Number(v.current || 0);

    // Widths
    if (pool === 'essence') {
      const pctE = essenceSoftCap > 0 ? Math.min(100, (current / essenceSoftCap) * 100) : 0;
      el.fill.style.width = `${pctE.toFixed(2)}%`;
    } else {
      const pct = cap > 0 ? (current / cap) * 100 : 0;
      el.fill.style.width = `${pct}%`;
    }

    // Text (respect rate-peek override)
    const baseTxt = (pool === 'essence')
      ? (essenceSoftCap > 0 ? `${hudFmt(current)} / ${hudFmt(essenceSoftCap)}` : hudFmt(current))
      : `${hudFmt(current)} / ${hudFmt(cap)}`;

    if (!el.value.__origText) el.value.__origText = el.value.textContent;
    el.value.textContent = el.value.classList.contains('is-rate')
      ? (el.value.__rateText || baseTxt)
      : baseTxt;

    // Trend classes
    const barEl = el.fill.closest('.bar');
    barEl?.classList.remove('overspending','underspending');
    if (v.trend === 'overspending')  barEl?.classList.add('overspending');
    if (v.trend === 'underspending') barEl?.classList.add('underspending');

    // Surplus pills
    if (pool === 'shield') {
      const days = shieldDaysFromCarry(current, data);
      setSurplusPill(el, days, days);
      // (Do NOT add Shield to sumCurrent/sumMax if totals are H/M/S only)
    } else {
      setSurplusPill(el, 0, 0);
    }

    // Hide any overlay on regular pools in static pass
    const rec = barEl?.querySelector('.bar-reclaim');
    if (rec) {
      rec.style.opacity = '0';
      rec.style.width   = '0%';
      rec.classList.remove('is-credit','is-breakdown');
    }

    let currentBase = clamp(current, 0, cap);
    sumCurrent += currentBase;
    sumMax     += cap;
  }

  

  setVitalsTotals(sumCurrent, sumMax);
  if (refreshGrids) refreshBarGrids();
}

// ─────────────────────────── Public: Animated HUD (ghosts) ──────────────────
export async function initVitalsHUD(uid, timeMultiplier = 1){
  const elements = getVitalsElements();

    // --- NEW: instant paint from last local snapshot (no awaits, no handlers)
    // Coerce a local/remote snapshot (buildSnapshotFromGateway) into a minimal gateway-like shape
    function snapshotToGateway(snap){
      if (!snap?.pools) return null;
      return {
        pools: {
          health:  { current: Number(snap.pools.health?.current||0),  max: Number(snap.pools.health?.max||0)  },
          mana:    { current: Number(snap.pools.mana?.current||0),    max: Number(snap.pools.mana?.max||0)    },
          stamina: { current: Number(snap.pools.stamina?.current||0), max: Number(snap.pools.stamina?.max||0) },
          shield:  { current: Number(snap.pools.shield?.current||0),  max: Number(snap.pools.shield?.max||0)  },
          essence: { current: Number(snap.pools.essence?.current||0), max: 0 }, // essence has no hard cap here
        },
        // Essence width uses softCap; we don't have it in the snapshot, so default to 0
        essenceUI: { softCap: Number(snap?.pools?.shield?.max || 0) }
      };
    }

  try {
    const prevLocal = loadVitalsSnapshot(uid); // synchronous localStorage read
    const ghost = snapshotToGateway(prevLocal);
    if (ghost) {
      // Paint exactly what we have; no handlers/grid churn yet
      await loadVitalsToHUD(uid, { data: ghost, paintOnly:true, refreshGrids:false, elements });
    }
  } catch {}

  // Opportunistic refresh for freshness
  try { await recomputeVitalsGatewayStub(uid); } catch {}

  let data = await readGateway(uid); if (!data) return;
  const { txCollectionPath } = await resolveDataSources(uid);

  
  let pools = data.pools || {};

  ensureReclaimLayers(elements);
  { const vm = getViewMode(); installRatePeekHandlers(elements, pools, vm==='core'?'core':vm); }

  // Running truth (client-side tween) + regen/sec
  const truth = {};
  const regenPerSec = {};
  for (const [pool, v] of Object.entries(pools)){
    const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);
    truth[pool]      = Math.max(0, Number(v.current || 0));
    regenPerSec[pool]= daily * (timeMultiplier / 86_400);
  }

  // Live "pending" queue
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
        creditModeOverride: String(x.creditModeOverride || '').toLowerCase(),
        transactionData:{ description: x?.transactionData?.description || '' },
      };
    });
  });

  // Focus cache (confirmed, non-core debits inside daily/weekly window)
  let focusSpend = { health:0, mana:0, stamina:0, essence:0 };
  let focusStart = 0, focusEnd = 0, focusDays = 1, lastFetchMs = 0;

  function getFocusPeriodBounds(mode){
    const now = new Date(); let start, end;
    if (mode === 'daily'){
      start = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
      end   = start + MS_PER_DAY;
    } else {
      const dow=(now.getDay()+6)%7;
      const startDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow);
      start=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()).getTime();
      end  = start + 7*MS_PER_DAY;
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

  // Helpers
  function clampGhostAddition(current, cap, deltaSigned){
    const after = clamp(current + deltaSigned, 0, cap);
    const add   = after - current;
    const leftPct  = (deltaSigned >= 0) ? (current / (cap||1)) * 100 : (after / (cap||1)) * 100;
    const widthPct = (cap>0) ? Math.abs(add / cap) * 100 : 0;
    return { after, leftPct, widthPct, isCredit: deltaSigned >= 0 };
  }

  // Shared state for the frame loop
  let last = null;
  let allowGhost = false;
  const enableGhostSoon = ()=>{ if(!allowGhost) setTimeout(()=>allowGhost=true,60); };

  // One-time hydrator so we can hot-swap gateway data without tearing down the loop
  if (!window.__vitalsRefreshWired) {
    window.__vitalsRefreshWired = true;
    window.addEventListener('vitals:refresh', (e) => {
      const fresh = e?.detail?.data;
      if (!fresh) return;

      data  = fresh;
      pools = data.pools || {};

      for (const [pool, v] of Object.entries(pools)) {
        const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);
        truth[pool]       = Math.max(0, Number(v.current || 0));
        regenPerSec[pool] = daily * (timeMultiplier / 86_400);
      }

      try { lastFetchMs = 0; } catch {}

      const vmNow = getViewMode();
      updateRatePeekTexts(getVitalsElements(), pools, vmNow==='core' ? 'core' : vmNow);
      ensureReclaimLayers(getVitalsElements());
      repaintEngravingLabels();
    });
  }

  /** Build pending deltas + escrow drawdown once per frame (Core or Focus) */
  function computePendingEffects(mode){
    // Escrow snapshots (UI-local, mutable): carry & today's level
    const escCarry = { ...(data?.meta?.escrow?.carry?.bySource || { health:0, mana:0, stamina:0 }) };
    const escToday = { ...(data?.essenceUI?.escrowToday || { health:0, mana:0, stamina:0 }) };
    const escUsed  = { health:0, mana:0, stamina:0 };

    let delta = { health:0, mana:0, stamina:0, essence:0 };

    // Availability map differs per mode
    let avail = { health:0, mana:0, stamina:0, essence:0 };
    let beforeFocus = { health:0, mana:0, stamina:0, essence:0 };
    let capMap = { health:0, mana:0, stamina:0, essence:0, shield:0 };

    if (mode==='core'){
      const capH = Number(pools.health?.max || 0);
      const capM = Number(pools.mana?.max   || 0);
      const capS = Number(pools.stamina?.max|| 0);
      avail.health  = clamp(truth.health,  0, capH);
      avail.mana    = clamp(truth.mana,    0, capM);
      avail.stamina = clamp(truth.stamina, 0, capS);
      capMap = { health:capH, mana:capM, stamina:capS, essence:0, shield:Number(pools?.shield?.max||0) };
    } else {
      const daysIn = (mode==='daily') ? 1 : 7;

      // Cap for Focus: min(Cycle cap, regenDaily*daysIn); base = clamp(cap - confirmedSpend, 0, cap)
      ['health','mana','stamina','essence'].forEach(pool=>{
        const capCycle = (pool==='essence') ? 0 : Number(pools[pool]?.max || 0);
        const dailyP   = Number((pools[pool]?.regenDaily ?? pools[pool]?.regenCurrent) || 0);
        const capP     = (pool==='essence') ? 0 : Math.min(capCycle, Math.max(0, dailyP * daysIn));
        capMap[pool]   = capP;

        if (pool==='essence'){
          beforeFocus.essence = Number(pools.essence?.current || 0); // no special cap here
        } else {
          const spentP   = Number(focusSpend?.[pool] || 0);
          const baseP    = clamp(capP - spentP, 0, capP);
          beforeFocus[pool] = baseP;
          // Available to allocate pending against:
          avail[pool] = baseP;
        }
      });
      capMap.shield = Number(pools?.shield?.max || 0);
    }

    // Consider only pending still alive (and in-window for Focus)
    const now = Date.now();
    const ordered = [...pendingTx]
      .filter(tx => !tx.ghostExpiryMs || tx.ghostExpiryMs > now)
      .filter(tx => {
        if (mode==='core') return true;
        return (tx.dateMs >= focusStart && tx.dateMs < focusEnd);
      })
      .sort((a,b)=>a.dateMs-b.dateMs);

    // Accumulate deltas + escrow usage
    for (const tx of ordered){
      const amt = Number(tx.amount || 0);

      if (amt < 0){
        // Debit: intent pool decides primary; we consume escrow first
        const intent  = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
        const primary = (intent === 'mana') ? 'mana' : 'stamina';
        const spend   = Math.abs(amt);

        // (1) consume from primary pool's escrow
        const takePrimaryEsc = Math.min(spend, Math.max(0, Number(escCarry[primary] || 0)));
        if (takePrimaryEsc > 0){
          escCarry[primary] = Number((escCarry[primary] - takePrimaryEsc).toFixed(2));
          escToday[primary] = Number(Math.max(0, (escToday[primary]||0) - takePrimaryEsc).toFixed(2));
          escUsed[primary]  = Number((escUsed[primary] + takePrimaryEsc).toFixed(2));
        }
        let residual = Math.max(0, spend - takePrimaryEsc);

        // (2) allocate the remainder across H/M/S (primary-first; overspill → Health)
        if (residual > 0){
          const split = allocateSpendAcrossPools(
            residual,
            primary,
            avail
          );

          // (2a) for each pool with a debit, draw down THAT pool’s escrow first
          (['health','mana','stamina']).forEach(pool=>{
            const willDebit = Number(split[pool] || 0);
            if (willDebit <= 0) return;
            const fromEsc = Math.min(willDebit, Math.max(0, Number(escCarry[pool] || 0)));
            if (fromEsc > 0){
              escCarry[pool] = Number((escCarry[pool] - fromEsc).toFixed(2));
              escToday[pool] = Number(Math.max(0, (escToday[pool]||0) - fromEsc).toFixed(2));
              escUsed[pool]  = Number((escUsed[pool] + fromEsc).toFixed(2));
              split[pool]    = Number((willDebit - fromEsc).toFixed(2)); // debit remainder from pool
            }
          });

          // (2b) apply remaining debits to pools + reduce availability
          delta.health  -= Number(split.health  || 0);
          delta.mana    -= Number(split.mana    || 0);
          delta.stamina -= Number(split.stamina || 0);

          avail.health  = Math.max(0, (avail.health  ||0) - Number(split.health  || 0));
          avail.mana    = Math.max(0, (avail.mana    ||0) - Number(split.mana    || 0));
          avail.stamina = Math.max(0, (avail.stamina ||0) - Number(split.stamina || 0));
        }
      } else if (amt > 0){
        // Credit: essence / health / allocate
        const eff  = String(tx.creditModeOverride || '').toLowerCase();
        const modeC = (eff==='essence'||eff==='health'||eff==='allocate') ? eff : 'essence';
        if (modeC === 'essence') {
          delta.essence += amt;
        } else if (modeC === 'health') {
          delta.health  += amt;
          avail.health  = (avail.health||0) + amt;
        } else {
          const intent = tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina';
          const split  = allocateSpendAcrossPools(
            amt,
            (intent==='mana')?'mana':'stamina',
            { health:Infinity, mana:Infinity, stamina:Infinity, essence:0}
          );
          delta.health  += Number(split.health  || 0);
          delta.mana    += Number(split.mana    || 0);
          delta.stamina += Number(split.stamina || 0);
          avail.health  = (avail.health||0) + (split.health  ||0);
          avail.mana    = (avail.mana  ||0) + (split.mana    ||0);
          avail.stamina = (avail.stamina||0)+ (split.stamina ||0);
        }
      }
    }

    return { delta, escUsed, escToday, capMap, beforeFocus };
  }

  function frame(ts){
    if (last===null) last=ts; const dt=(ts-last)/1000; last=ts;

    // Animate truth toward cap (no wrap). Essence has no hard cap here (UI cap handled elsewhere).
    for (const p of Object.keys(truth)){
      const capP = Number(pools[p]?.max || 0);
      truth[p] = clamp(
        truth[p] + (regenPerSec[p]||0) * dt,
        0,
        capP || (p==='essence' ? Number(pools[p]?.current||0) + 1e9 : 0)
      );
    }

    // Dispatch expiry countdown ticks for Update Log rows
    if (pendingTx.length){
      const nowMs = Date.now();
      const ticks = pendingTx
        .filter(tx=>!tx.ghostExpiryMs || tx.ghostExpiryMs > nowMs)
        .map(tx=>({ id: tx.id, seconds: Math.max(0, Math.ceil((Number(tx.ghostExpiryMs||0) - nowMs)/1000)) }));
      if (ticks.length) window.dispatchEvent(new CustomEvent('tx:expiry-tick',{ detail:{ ticks } }));
    }

    const vm = getViewMode();
    if (vm!=='core') refreshFocusCacheIfNeeded();

    // Compute pending effects once per frame (Core/Focus)
    const { delta, escUsed, escToday, capMap, beforeFocus } = computePendingEffects(vm==='core'?'core':(vm==='daily'?'daily':'weekly'));

    let sumCurrent=0,sumMax=0;

    for (const pool of Object.keys(pools)){
      const el = elements[pool]; if (!el) continue;
      const v  = pools[pool] || {};
      const barEl = el.fill.closest('.bar');
      const reclaimEl = barEl?.querySelector('.bar-reclaim');

      if (vm==='core'){
        // ───────── Core (Cycle) ─────────
        if (pool==='essence'){
          // Essence: current + pending essence credits; softCap for width
          const valNow  = Number(v.current || 0);
          const pend    = Number(delta.essence || 0);
          const softCap = Number(data?.essenceUI?.softCap || 0);
          const effective = valNow + pend;

          const pct = softCap > 0 ? Math.min(100, (effective / softCap) * 100) : 0;
          el.fill.style.width = `${pct.toFixed(2)}%`;
          el.value.textContent = softCap > 0
            ? `${hudFmt(effective)} / ${hudFmt(softCap)}`
            : `${hudFmt(effective)}`;

          // Essence overlay off
          if (reclaimEl){
            reclaimEl.style.opacity='0'; 
            reclaimEl.style.width='0%'; 
            reclaimEl.classList.remove('is-credit');
          }

          // Hide pill for Essence in Core (spec says only Shield shows)
          setSurplusPill(el, 0, 0);
          enableGhostSoon();
        }
        else if (pool==='shield'){
          // Shield is a real pool: cap = softCap; current = gateway carry minus live escrow drawdown
          const cap = Number(v.max || 0);
          const before = Number(v.current || 0);
          const used = Number(((escUsed.health||0)+(escUsed.mana||0)+(escUsed.stamina||0)).toFixed(2));
          const current = clamp(before - used, 0, cap);
          const pct = cap > 0 ? (current / cap) * 100 : 0;

          el.fill.style.width = `${pct.toFixed(2)}%`;
          el.value.textContent = cap > 0
            ? `${hudFmt(current)} / ${hudFmt(cap)}`
            : `${hudFmt(current)}`;

          // Pill = "days of energy" from live carry
          const days = shieldDaysFromCarry(current, data);
          setSurplusPill(el, days, days);

          // "Today" overlay: level remaining for today, clamped to remaining width
          // if (reclaimEl){
          //   const today = Number((escToday.health||0)+(escToday.mana||0)+(escToday.stamina||0));
          //   if (cap > 0 && today > 0){
          //     const overlayPct = Math.min(100 - pct, (today / cap) * 100);
          //     reclaimEl.classList.add('is-credit');
          //     reclaimEl.style.left    = `${pct.toFixed(2)}%`;
          //     reclaimEl.style.width   = `${Math.max(0, overlayPct).toFixed(2)}%`;
          //     reclaimEl.style.opacity = '1';
          //   } else {
          //     reclaimEl.style.opacity='0';
          //     reclaimEl.style.width  ='0%';
          //     reclaimEl.classList.remove('is-credit');
          //   }
          // }

        }
        else {
          // Health/Mana/Stamina: ghost overlay from pending deltas, clamped to cycle cap
          const cap = Number(v.max || 0);
          let currentBase = clamp(truth[pool], 0, cap);
          const d = Number(delta[pool] || 0);

          let showGhost=false, leftPct=0, widthPct=0, isCreditGhost=false;
          if (cap > 0 && Math.abs(d) > 0.0001){
            const proj = clampGhostAddition(currentBase, cap, d);
            leftPct       = Math.max(0, Math.min(100, proj.leftPct));
            widthPct      = Math.max(0, Math.min(100, proj.widthPct));
            isCreditGhost = proj.isCredit;
            currentBase   = proj.after; // preview value
            showGhost     = allowGhost && widthPct > 0.01;
          }

          const pct = (cap>0 ? (currentBase / cap) * 100 : 0);
          el.fill.style.width = `${pct.toFixed(2)}%`;
          const txt = `${hudFmt(currentBase)} / ${hudFmt(cap)}`;
          if (!el.value.__origText) el.value.__origText = el.value.textContent;
          el.value.textContent = el.value.classList.contains('is-rate') ? (el.value.__rateText || txt) : txt;

          // Ghost overlay (H/M/S only)
          if (reclaimEl){
            reclaimEl.classList.toggle('is-credit', !!(showGhost && isCreditGhost));
            if (showGhost){
              reclaimEl.style.left   = `${leftPct.toFixed(2)}%`;
              reclaimEl.style.width  = `${widthPct.toFixed(2)}%`;
              reclaimEl.style.opacity= '1';
            } else {
              reclaimEl.style.opacity='0';
              reclaimEl.style.width  ='0%';
              reclaimEl.classList.remove('is-credit');
            }
          }

          // Only H/M/S contribute to totals; no pills in Core except Shield
          sumCurrent += currentBase;
          sumMax     += cap;
          setSurplusPill(el, 0, 0);
          enableGhostSoon();
        }
      } else {
        // ───────── Focus (Today / This Week) ─────────
        if (pool==='essence'){
          // Essence in Focus: show current + pending essence credits ONLY (carry is Shield now)
          const softCap = Number(data?.essenceUI?.softCap || 0);
          const vNow    = Number(pools.essence?.current || 0);
          const pend    = Number(delta.essence || 0);
          const effective = vNow + pend;

          const pct = softCap > 0 ? Math.min(100, (effective / softCap) * 100) : 0;
          el.fill.style.width = `${pct.toFixed(2)}%`;

          const txt = softCap > 0
            ? `${hudFmt(effective)} / ${hudFmt(softCap)}`
            : `${hudFmt(effective)}`;
          if (!el.value.__origText) el.value.__origText = el.value.textContent;
          el.value.textContent = el.value.classList.contains('is-rate') ? (el.value.__rateText || txt) : txt;

          // Overlay off
          if (reclaimEl){
            reclaimEl.style.opacity='0';
            reclaimEl.style.width  ='0%';
            reclaimEl.classList.remove('is-credit');
          }

          // Hide all pills in Focus
          setSurplusPill(el, 0, 0);
        }
        else if (pool==='shield'){
          // Shield in Focus: show live carry minus drawdown from pending inside the window
          const cap    = Number(pools.shield?.max || 0);
          const before = Number(pools.shield?.current || 0);
          const used   = Number(((escUsed.health||0)+(escUsed.mana||0)+(escUsed.stamina||0)).toFixed(2));
          const current = clamp(before - used, 0, cap);
          const pct = cap > 0 ? (current / cap) * 100 : 0;

          el.fill.style.width = `${pct.toFixed(2)}%`;
          el.value.textContent = cap > 0
            ? `${hudFmt(current)} / ${hudFmt(cap)}`
            : `${hudFmt(current)}`;

          // Today overlay relative to remaining width
          // if (reclaimEl){
          //   const today = Number((escToday.health||0)+(escToday.mana||0)+(escToday.stamina||0));
          //   if (cap > 0 && today > 0){
          //     const overlayPct = Math.min(100 - pct, (today / cap) * 100);
          //     reclaimEl.classList.add('is-credit');
          //     reclaimEl.style.left    = `${pct.toFixed(2)}%`;
          //     reclaimEl.style.width   = `${Math.max(0, overlayPct).toFixed(2)}%`;
          //     reclaimEl.style.opacity = '1';
          //   } else {
          //     reclaimEl.style.opacity='0';
          //     reclaimEl.style.width  ='0%';
          //     reclaimEl.classList.remove('is-credit');
          //   }
          // }

          // Hide pills in Focus
          setSurplusPill(el, 0, 0);
        }
        else {
          // H/M/S in Focus: base from window cap minus confirmed spend; apply pending delta once
          const cap    = Number(capMap[pool] || 0);
          const before = Number(beforeFocus[pool] || 0);
          const d      = Number(delta[pool] || 0);
          const current = clamp(before + d, 0, cap);
          const pct = cap > 0 ? (current / cap) * 100 : 0;

          el.fill.style.width = `${pct.toFixed(2)}%`;
          const txt = `${hudFmt(current)} / ${hudFmt(cap)}`;
          if (!el.value.__origText) el.value.__origText = el.value.textContent;
          el.value.textContent = el.value.classList.contains('is-rate') ? (el.value.__rateText || txt) : txt;

          // Overlay: debit shrinks from right; credit extends to right
          if (reclaimEl) {
            const mag = Math.min(Math.abs(d), cap);
            if (cap > 0 && mag > 0.0001) {
              const leftPct  = (d < 0) ? ((current / cap) * 100) : ((before / cap) * 100);
              const widthPct = (mag / cap) * 100;
              reclaimEl.classList.toggle('is-credit', d > 0);
              reclaimEl.style.left   = `${Math.max(0, Math.min(100, leftPct)).toFixed(2)}%`;
              reclaimEl.style.width  = `${Math.max(0, Math.min(100, widthPct)).toFixed(2)}%`;
              reclaimEl.style.opacity= '1';
            } else {
              reclaimEl.style.opacity = '0';
              reclaimEl.style.width   = '0%';
              reclaimEl.classList.remove('is-credit');
            }
          }

          // Totals (H/M/S only); no pills in Focus
          sumCurrent += current;
          sumMax     += cap;
          setSurplusPill(el, 0, 0);
        }
      }

      // Trend tint (unchanged)
      barEl?.classList.remove("overspending","underspending");
      const trend = v.trend || "stable";
      if (trend === "overspending")  barEl?.classList.add("overspending");
      if (trend === "underspending") barEl?.classList.add("underspending");
    }



    setVitalsTotals(sumCurrent, sumMax);
    requestAnimationFrame(frame);
  }

  __HUD_READY = true;

  // Wake tween then start loop
  const runWakeThenStart = async () => {
    try {
      const u = (getAuth().currentUser && getAuth().currentUser.uid) || uid;
      const prev = loadVitalsSnapshot(u) || await loadVitalsSnapshotRemote(u) || null;

      // if (prev?.pools) {
      //   try {
      //     paintSnapshotToHUD(elements, prev);
      //     await new Promise(requestAnimationFrame);
      //     await new Promise(r => setTimeout(r, 1000));
      //   } catch {}
      // }

      await runWakeRegenAnimation(uid, elements, prev, data, { duration: 1900 });

      try { storeVitalsSnapshot(u, data); } catch {}
      try { await storeVitalsSnapshotRemote(u, data); } catch {}
    } catch (e) {
      console.warn("Wake regen animation failed (non-fatal):", e);
    }

    requestAnimationFrame(frame);
  };

  // Defer until splash is done, or run immediately if no splash
  if (window.__MYFI_SPLASH_ACTIVE) {
    window.addEventListener('splash:done', () => { runWakeThenStart(); }, { once: true });
  } else {
    await runWakeThenStart();
  }

  // Mode switches / primary pool changes
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

  // Tap-to-show Shield composition; uses data→meta.escrow/bySource for the split
  installShieldBreakdown(() => data);
}


// Public: recompute gateway (optional) and refresh the live HUD without re-init
export async function refreshVitalsHUD(uid, { recompute = true } = {}) {
  try {
    if (recompute) await recomputeVitalsGatewayStub(uid);
  } catch {}

  const fresh = await readGateway(uid);
  if (!fresh) return;

  // If HUD hasn't been initialised yet, do a safe static paint and bail.
  if (!__HUD_READY) {
    await loadVitalsToHUD(uid);
    return;
  }

  // Hydrate the running HUD (handled by the listener inside initVitalsHUD)
  window.dispatchEvent(new CustomEvent('vitals:refresh', { detail: { data: fresh } }));

  // Persist new snapshot so next wake anim is accurate (both local & remote)
  try {
    const u = (getAuth().currentUser && getAuth().currentUser.uid) || uid;
    storeVitalsSnapshot(u, fresh);
    await storeVitalsSnapshotRemote(u, fresh);
  } catch {}


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
export async function listenUpdateLogPending(uid, cb, txCollectionPath){
  const path = txCollectionPath || (await resolveDataSources(uid)).txCollectionPath;
  const qy = query(
    collection(db, path),
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
  const db   = getFirestore();

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const uid = user.uid;

    // Active bindings we’ll tear down on mode change
    let unsubPending = null;
    let unsubRecent  = null;
    let tickHandler  = null;
    let curTxPath    = null;
    let lockTimer    = null; 

    // Helper: cleanly remove all current listeners
    function detachAll(){
      try { unsubPending?.(); } catch {}
      try { unsubRecent?.(); }  catch {}
      if (tickHandler) {
        window.removeEventListener("tx:expiry-tick", tickHandler);
        tickHandler = null;
      }

      if (lockTimer){ clearInterval(lockTimer); lockTimer = null; }
      unsubPending = unsubRecent = null;
    }

    // Helper: per-row tagging buttons class state
    function setActiveButtons(li, pool){
      const buttons = li.querySelectorAll(".tag-btn");
      buttons.forEach((b) => {
        b.classList.remove("active","stamina","mana");
        if (b.dataset.pool === pool) b.classList.add("active", pool);
      });
    }

    // Attach (or reattach) all listeners for a given txPath
    async function attachFor(txPath){
      detachAll();
      curTxPath = txPath;

      // Fresh placeholders so the UI never shows stale results
      if (listEl)   listEl.innerHTML   = `<li class="ul-meta">Loading transactions…</li>`;
      if (recentEl) recentEl.innerHTML = `<li class="ul-meta">Loading recent locks…</li>`;

      // 1) PENDING (with pool tagging + inline editor)
      unsubPending = await listenUpdateLogPending(uid, (items) => {
        listEl.innerHTML = "";
        if (!items.length){
          const li = document.createElement("li");
          li.textContent = "Nothing pending — nice!";
          listEl.appendChild(li);
          return;
        }

        items.forEach((tx) => {
          const li = document.createElement("li");
          li.setAttribute("data-tx", tx.id);

          // Countdown
          const nowMs  = Date.now();
          const ttl    = Number(tx.ghostExpiryMs || 0);
          const secs   = ttl > nowMs ? Math.floor((ttl - nowMs) / 1000) : 0;
          const mLeft  = Math.floor(secs / 60);
          const sLeft  = secs % 60;

          // Render (unchanged structure)
          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);
          const tag  = tx.provisionalTag?.pool ?? "stamina";

          const isCredit = Number(tx.amount) > 0;
          let actionsHtml = '';
          if (isCredit){
            // Credit → toggle Essence / Health
            const eff = String(tx.creditModeOverride || '').toLowerCase();
            const active = (eff==='essence' || eff==='health') ? eff : 'essence'; // fallback
            actionsHtml = `
              <div class="ul-actions two">
                <button class="tag-btn" data-credit="essence" title="Essence (credit to Essence)" aria-label="Essence">E</button>
                <button class="tag-btn" data-credit="health"  title="Health (reduce Health spend)" aria-label="Health">H</button>
              </div>`;
          } else {
            // Debit → Mana / Stamina (unchanged)
            actionsHtml = `
              <div class="ul-actions two">
                <button class="tag-btn" data-pool="mana"    title="Mana"    aria-label="Mana">M</button>
                <button class="tag-btn" data-pool="stamina" title="Stamina" aria-label="Stamina">S</button>
              </div>`;
          }

          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • <span class="countdown">${mLeft}m ${sLeft}s</span> • ${tag}</div>
              </div>
              ${actionsHtml}
            </div>`;

          // Pool tag buttons (no regression)
          if (isCredit){
            const setActive = (mode)=>{
              li.querySelectorAll('.tag-btn').forEach(b=>b.classList.remove('active','essence','health'));
              const btn = li.querySelector(`.tag-btn[data-credit="${mode}"]`);
              if (btn){ btn.classList.add('active', mode); }
            };
            // initial
            const current = (String(tx.creditModeOverride || '').toLowerCase()) || 'essence';
            setActive(current);

            li.querySelectorAll('.tag-btn').forEach(btn=>{
              btn.addEventListener('click', async ()=>{
                const mode = btn.getAttribute('data-credit'); // 'essence' | 'health'
                setActive(mode);
                await setCreditModeOverride(uid, tx.id, mode);
              });
            });
          } else {
            // existing debit M/S logic (unchanged)
            setActiveButtons(li, tx.provisionalTag?.pool ?? 'stamina');
            li.querySelectorAll(".tag-btn").forEach((btn) => {
              btn.addEventListener("click", async () => {
                const pool = btn.getAttribute("data-pool");
                setActiveButtons(li, pool);
                await setProvisionalTag(uid, tx.id, pool);
              });
            });
          }

          // Inline editor (no regression)
          onLongPress(li, () => {
            const existing = li.querySelector(".ul-editor"); if (existing) return;
            li.classList.add("is-editing");
            const main = li.querySelector(".ul-main");
            const actions = li.querySelector(".ul-actions"); if (actions) actions.style.display = "none";

            const editor = document.createElement("div");
            editor.className = "ul-editor";
            const name0 = tx.transactionData?.description || "Transaction";
            const amt0  = Number(tx.amount).toFixed(2);
            editor.innerHTML = `
              <div class="ul-edit-fields">
                <label class="ul-edit-row">
                  <span class="ul-edit-label">Description</span>
                  <input class="ul-edit-input" type="text" value="${name0.replace(/"/g,'&quot;')}" />
                </label>
                <label class="ul-edit-row">
                  <span class="ul-edit-label">Amount (£)</span>
                  <input class="ul-edit-input" type="number" step="0.01" inputmode="decimal" value="${amt0}" />
                </label>
              </div>
              <div class="ul-edit-actions">
                <button class="btn-save">Save</button>
                <button class="btn-cancel">Cancel</button>
                <button class="btn-delete">Delete</button>
              </div>`;
            editor.style.marginTop = "0.5rem";
            main.appendChild(editor);

            const [descInput, amtInput] = editor.querySelectorAll(".ul-edit-input");
            const btnSave   = editor.querySelector(".btn-save");
            const btnCancel = editor.querySelector(".btn-cancel");
            const btnDelete = editor.querySelector(".btn-delete");

            const cleanup = () => { editor.remove(); li.classList.remove("is-editing"); if (actions) actions.style.display = ""; };

            btnCancel.addEventListener("click", cleanup);
            btnSave.addEventListener("click", async () => {
              try{
                const path = curTxPath || (await resolveDataSources(uid)).txCollectionPath;
                const ref  = doc(db, `${path}/${tx.id}`);
                const newDesc = String(descInput.value || "").slice(0,120);
                const newAmt  = Number(amtInput.value);
                await updateDoc(ref, {
                  transactionData: { ...(tx.transactionData || {}), description: newDesc },
                  amount: isFinite(newAmt) ? newAmt : tx.amount
                });
                cleanup();
              }catch(e){ console.warn("Inline save failed", e); }
            });
            btnDelete.addEventListener("click", async () => {
              try{
                const path = curTxPath || (await resolveDataSources(uid)).txCollectionPath;
                await deleteDoc(doc(db, `${path}/${tx.id}`));
                cleanup();
              }catch(e){ console.warn("Inline delete failed", e); }
            });
          });

          listEl.appendChild(li);
        });
      }, txPath);

      // 2) RECENTLY CONFIRMED (no regression)
      unsubRecent = listenRecentlyConfirmed(uid, 24*60*60*1000, (items) => {
        recentEl.innerHTML = "";
        if (!items.length){
          const li = document.createElement("li");
          li.textContent = "No recent locks.";
          recentEl.appendChild(li);
          return;
        }
        items.forEach((tx) => {
          const li   = document.createElement("li");
          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);
          const when = tx.tag?.setAtMs
            ? new Date(tx.tag.setAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
          const pool = tx.tag?.pool ?? tx.provisionalTag?.pool ?? "stamina";
          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • ${when} <span class="badge ${pool}">${pool}</span></div>
              </div>
            </div>`;
          recentEl.appendChild(li);
        });
      }, txPath);

      // 3) Countdown tick (no regression) — add & clean on reattach
      tickHandler = (e) => {
        const ticks = e?.detail?.ticks || [];
        for (const { id, seconds } of ticks){
          const row  = listEl?.querySelector(`li[data-tx="${id}"]`); if (!row) continue;
          const span = row.querySelector(".countdown"); if (!span) continue;
          const s = Math.max(0, Number(seconds) || 0);
          const m = Math.floor(s / 60); const r = s % 60;
          span.textContent = `${m}m ${r}s`;
        }
      };
      window.addEventListener("tx:expiry-tick", tickHandler);

      // Kick the locker once now, then every 20s (simple, backend-pivotable)
      try { await lockExpiredOrOverflow(uid, 50); } catch {}
      lockTimer = setInterval(() => {
        lockExpiredOrOverflow(uid, 50).catch(()=>{});
      }, 20_000);
    }

    // Player-mode watcher: re-resolve tx path and reattach listeners live
    const playerRef = doc(db, "players", uid);
    onSnapshot(playerRef, async (snap) => {
      const ds = await resolveDataSources(uid);
      const nextTxPath = ds?.txCollectionPath;
      if (!nextTxPath) return;

      // Only flip if the path actually changes (prevents thrash)
      if (nextTxPath !== curTxPath){
        await attachFor(nextTxPath);
      }
    });

    // Initial attach on first resolve
    (async () => {
      const ds = await resolveDataSources(uid);
      if (ds?.txCollectionPath) await attachFor(ds.txCollectionPath);
    })();
  });
}

// Event Logs Helpers
export async function setCreditModeOverride(uid, txId, mode){
  const path = CURRENT_TX_COLLECTION_PATH || (await resolveDataSources(uid)).txCollectionPath;
  await updateDoc(doc(db, `${path}/${txId}`), {
    creditModeOverride: (mode === 'essence' || mode === 'health') ? mode : null,
    provisionalTag: (mode === 'essence'
      ? { pool:'essence', setAtMs: Date.now() }
      : mode === 'health'
        ? { pool:'health', setAtMs: Date.now() }
        : null)
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

// Local fallback: confirm expired and enforce queueCap if backend can't
async function sweepLocalExpiredAndOverflow(uid, queueCap = 5){
  const { txCollectionPath } = await resolveDataSources(uid);
  if (!txCollectionPath) return { locked: 0 };

  const now = Date.now();
  const col = collection(db, txCollectionPath);
  const snap = await getDocs(query(col, where("status","==","pending")));

  // Load player credit mode for credits without override
  let creditMode = 'essence';
  try{
    const cfg = await getDoc(doc(db, CURRENT_CASHFLOW_DOC_PATH || `players/${uid}/financialData/cashflowData`));
    creditMode = String(cfg.data()?.creditMode || 'essence').toLowerCase();
  }catch{}

  const pend = [];
  snap.forEach(d=>{
    const x = d.data()||{};
    pend.push({
      id: d.id,
      amount: Number(x.amount ?? x.amountMajor ?? 0),
      dateMs: Number(x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? 0),
      addedMs: Number(x.addedMs ?? 0),
      ghostExpiryMs: Number(x.ghostExpiryMs ?? 0),
      provisionalTag: x.provisionalTag || null,
      tag: x.tag || null,
      creditModeOverride: String(x.creditModeOverride || '').toLowerCase(),
      suggestedPool: x.suggestedPool || null,
    });
  });

  // 1) Expired first
  const toLock = pend.filter(x => x.ghostExpiryMs && x.ghostExpiryMs <= now);

  // 2) Overflow next (oldest by dateMs; fallback addedMs)
  const remain = pend.filter(x => !toLock.find(t => t.id === x.id));
  const overflow = Math.max(0, pend.length - queueCap - toLock.length);
  if (overflow > 0){
    remain.sort((a,b) => (a.dateMs||a.addedMs) - (b.dateMs||b.addedMs));
    toLock.push(...remain.slice(0, overflow));
  }

  // Apply locks
  // AFTER: compute appliedAllocation for debits using gateway + escrow

  const gatewayRef = doc(db, `players/${uid}/vitalsData/gateway`);
  const gatewaySnap = await getDoc(gatewayRef);
  const G = gatewaySnap.exists() ? (gatewaySnap.data() || {}) : {};

  let avail = {
    health:  Number(G?.pools?.health?.current  || 0),
    mana:    Number(G?.pools?.mana?.current    || 0),
    stamina: Number(G?.pools?.stamina?.current || 0),
  };
  let escCarry = {
    health:  Number(G?.meta?.escrow?.carry?.bySource?.health  || 0),
    mana:    Number(G?.meta?.escrow?.carry?.bySource?.mana    || 0),
    stamina: Number(G?.meta?.escrow?.carry?.bySource?.stamina || 0),
  };

  // Lock oldest-first so avail/escrow updates are consistent
  toLock.sort((a,b)=> (a.dateMs||a.addedMs) - (b.dateMs||b.addedMs));

  const ops = toLock.map(tx => {
    const isCredit = tx.amount > 0;
    const effOverride = String(tx.creditModeOverride || '').toLowerCase();

    // Resolve final tag.pool (keep your existing logic)
    let pool;
    if (isCredit) {
      const eff = (effOverride==='essence'||effOverride==='health'||effOverride==='allocate')
        ? effOverride : creditMode;
      pool = (eff==='health') ? 'health'
          : (eff==='essence') ? 'essence'
          : (tx.tag?.pool || tx.provisionalTag?.pool || 'stamina');
    } else {
      pool = tx.provisionalTag?.pool || tx.suggestedPool || 'stamina';
    }

    let write = {
      status: 'confirmed',
      tag: { pool, setAtMs: now },
      provisionalTag: null,
      autoLockReason: 'client_fallback'
    };

    // Credits don’t need appliedAllocation (reader handles credit modes)
    if (isCredit) {
      return updateDoc(doc(db, `${txCollectionPath}/${tx.id}`), write);
    }

    // ----- Debit: compute appliedAllocation with escrow + overspill -----
    const primary = (pool === 'mana') ? 'mana' : 'stamina';
    let spend = Math.abs(Number(tx.amount || 0));

    const applied = { health:0, mana:0, stamina:0, essence:0 };

    // (1) Burn escrow from primary first
    const fromPrimaryEsc = Math.min(spend, Math.max(0, escCarry[primary]));
    if (fromPrimaryEsc > 0) {
      escCarry[primary] = Number((escCarry[primary] - fromPrimaryEsc).toFixed(2));
      spend -= fromPrimaryEsc;
    }

    if (spend > 0) {
      // (2) Split remainder by intent; use *live* availability (not Infinity)
      const split = allocateSpendAcrossPools(
        spend,
        primary,
        { health: Math.max(0, avail.health), mana: Math.max(0, avail.mana), stamina: Math.max(0, avail.stamina), essence: 0 }
      );

      // (3) For each pool getting debited, burn that pool’s escrow first
      for (const k of ['health','mana','stamina']) {
        const willDebit = Number(split[k] || 0);
        if (!willDebit) continue;
        const takeEsc = Math.min(willDebit, Math.max(0, escCarry[k]));
        if (takeEsc > 0) {
          escCarry[k] = Number((escCarry[k] - takeEsc).toFixed(2));
        }
        const postEscDebit = Number((willDebit - takeEsc).toFixed(2)); // ← hits the pool
        if (postEscDebit > 0) {
          applied[k] = postEscDebit;
          avail[k] = Math.max(0, Number((avail[k] - postEscDebit).toFixed(2)));
        }
      }
    }

    write.appliedAllocation = applied;
    return updateDoc(doc(db, `${txCollectionPath}/${tx.id}`), write);
  });

  if (ops.length) await Promise.allSettled(ops);
  return { locked: toLock.length };
}

// Public forwarder: backend first, then local fallback
export async function lockExpiredOrOverflow(uid, queueCap = 5){
  let locked = 0;
  // try{
  //   const be = await lockExpiredOrOverflow_BE(uid, queueCap);
  //   locked += Number(be?.locked || 0);
  // }catch{}
  try{
    const fe = await sweepLocalExpiredAndOverflow(uid, queueCap);
    locked += Number(fe?.locked || 0);
  }catch{}

  if (locked > 0) await refreshVitalsHUD(getAuth().currentUser.uid, { recompute: true });

  return { locked };
}


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
  const addBtn = document.getElementById('btn-add-spend');
  if (!addBtn) return;

  // Start fully hidden & inert (in case auth is slow)
  const hideBtn = () => {
    addBtn.hidden = true;
    addBtn.disabled = true;
    addBtn.tabIndex = -1;
  };
  const showBtn = () => {
    addBtn.hidden = false;
    addBtn.disabled = false;
    addBtn.tabIndex = 0;
  };
  hideBtn();

  const auth = getAuth();

  // Wire the click handler once
  if (!addBtn.__wired) {
    addBtn.__wired = true;
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Only act if visible/enabled
      if (addBtn.hidden || addBtn.disabled) return;
      window.MyFiModal?.openChildItem?.(
        window.MyFiFinancesMenu,
        'addTransaction',
        { menuTitle: 'Add Transaction' }
      );
    });
  }

  // Keep a single live subscription per session
  onAuthStateChanged(auth, (user) => {
    // Cleanup prior watcher if any
    addBtn.__unsub?.(); addBtn.__unsub = null;

    if (!user) { hideBtn(); return; }

    const playerRef = doc(getFirestore(), 'players', user.uid);
    addBtn.__unsub = onSnapshot(playerRef, (snap) => {
      const tMode = String(snap.data()?.transactionMode || 'unverified').toLowerCase();
      const isUnverified = (tMode === 'unverified');
      if (isUnverified) showBtn(); else hideBtn();
    }, () => hideBtn());
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

        // 🔹 add this line:
    wireVitalsStatusToggle();
  };

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run, { once:true });
  } else {
    run();
  }
})();

// Exports - Public
export async function initHUD(uid){
  // If caller didn’t pass uid, use current user
  const u = uid || (getAuth().currentUser && getAuth().currentUser.uid);
  if (!u) return;
  startAliasListener(u);
  startLevelListener(u);
  await refreshVitals();     // server snapshot
  initVitalsHUD(u, 1);       // animated HUD

  const stopEmberward = initEmberwardFrame(uid, {
    shape: 'inherit',  // or 'round' if you later switch to a circular portrait
    maxRatio: 1.0      // clamp intensity at 100% (adjust if you want >100% to still scale)
  });

  initSummaryModal();
  const portraitHost = document.querySelector('.portrait-wrapper');
  if (portraitHost && !portraitHost.__sumWired) {
    portraitHost.__sumWired = true;
    portraitHost.addEventListener('click', () => {
      openSummaryFromGateway(uid), { passive: true }

      // For now, pull a quick snapshot from what’s on-screen.
      // We’ll replace this with real gateway-derived stats in the next step.
      // const data = buildSummaryFromHUDFallback();
      // openSummaryModal(data);
    }, { passive: true });
  }

  autoInitSpiritStoneButton(); // will grab .main-btn (the big center essence button)

}

