// src/screens/vitals/modules/be/vitals.be.js
// Backend-facing module for Vitals Gateway:
// - Moves recompute stub + all helper deps out of UI
// - Centralizes Gateway reads/writes + CF wrappers
// - Exposes resolveDataSources() so UI can reuse path logic

// ───────────────────────────────── Imports ─────────────────────────────────
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs,
  query, where, orderBy, limit, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

import { db, functions } from '../core/firestore.js';

// ───────────────────────────────── Firestore / Functions ────────────────────

// const db = getFirestore();
// const functions = getFunctions();

// (Kept for compatibility; prefer using resolveDataSources() instead of relying on these.)
let CURRENT_TX_COLLECTION_PATH = null;
let CURRENT_CASHFLOW_DOC_PATH  = null;

// Optional getters for legacy callers that still read the globals.
export function getCurrentTxCollectionPath()      { return CURRENT_TX_COLLECTION_PATH; }
export function getCurrentCashflowDocPath()       { return CURRENT_CASHFLOW_DOC_PATH; }

// ───────────────────────────────── Constants ────────────────────────────────
const MS_PER_DAY     = 86_400_000;
const AVG_MONTH_DAYS = 30.44;
const CYCLE_DAYS     = AVG_MONTH_DAYS; // Treat as the Cycle length

// ───────────────────────────────── Utilities (pure) ─────────────────────────
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
function safeNum(n, d=0){ n = Number(n); return Number.isFinite(n) ? n : d; }

function todayLocalKey(){
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function resolveCycleStartMs(payCycleAnchorMs){
  if (Number.isFinite(payCycleAnchorMs) && payCycleAnchorMs > 0) return payCycleAnchorMs;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function daysSincePayCycleStart(payCycleAnchorMs){
  const start = resolveCycleStartMs(payCycleAnchorMs);
  return Math.max(0, (Date.now() - start) / MS_PER_DAY);
}

function resolveCreditMode(configDoc){
  const raw = String(configDoc?.creditMode || '').toLowerCase();
  if (["essence","allocate","health"].includes(raw)) return raw;
  return "essence";
}

function readVitalsFlags(A){
  const essenceBaselineEnabled = !!A?.essenceBaselineEnabled;
  const R = A?.redistributionR || { h: 0.34, m: 0.33, s: 0.33 };
  const essenceSoftCapMode = (String(A?.essenceSoftCapMode||'HMS').toUpperCase()==='HMS') ? 'HMS':'MS';
  const overflowBufferDays = Number.isFinite(A?.overflowBufferDays) ? A.overflowBufferDays : 0;
  return { essenceBaselineEnabled, R, essenceSoftCapMode, overflowBufferDays };
}

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

// ───────────────────────────────── Data source resolver (I/O) ───────────────
/**
 * Decides whether to read verified or unverified processed transactions for a player.
 * Sets CURRENT_* paths for legacy callers, but prefer using the returned object.
 */
export async function resolveDataSources(uid) {
  const profSnap = await getDoc(doc(db, `players/${uid}`));
  const prof = profSnap.exists() ? (profSnap.data() || {}) : {};
  const tMode = String(prof.transactionMode || 'unverified').toLowerCase();

  const dataSources = {
    cashflowDocPath: `players/${uid}/financialData/cashflowData`,
    txCollectionPath: (tMode === 'verified')
      ? `players/${uid}/financialData/processedTransactions/verified`
      : `players/${uid}/financialData/processedTransactions/unverified`
  };

  CURRENT_TX_COLLECTION_PATH  = dataSources.txCollectionPath;
  CURRENT_CASHFLOW_DOC_PATH   = dataSources.cashflowDocPath;
  return dataSources;
}

// ───────────────────────────────── Reads (I/O helpers) ──────────────────────
export async function readAllocations(dbHandle, uid){
  try{
    const snap = await getDoc(doc(dbHandle, `players/${uid}/financialData/cashflowData`));
    if (snap.exists()){
      const d = snap.data() || {};
      const health  = safeNum(d.poolAllocations?.healthAllocation,  0.3);
      const mana    = safeNum(d.poolAllocations?.manaAllocation,    0.3);
      const stamina = safeNum(d.poolAllocations?.staminaAllocation, 0.3);
      const essence = safeNum(d.poolAllocations?.essenceAllocation, 0.1);
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

/**
 * Reads processedTransactions (verified/unverified) and returns totals split by spends/credits.
 */
export async function readNonCoreUsage(dbHandle, uid, windowStartMs, creditMode = 'essence', txCollectionPath){
  const base = collection(dbHandle, txCollectionPath);
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

// ───────────────────────────────── Cloud Function wrappers ──────────────────
export async function refreshVitals_BE(uid){
  try{
    const fn = httpsCallable(functions, "vitals_getSnapshot");
    const res = await fn();
    return res?.data||{};
  }catch(e){
    console.warn("refreshVitals_BE failed", e);
    return {};
  }
}

export async function lockExpiredOrOverflow_BE(uid, queueCap = 5){
  try{
    const fn = httpsCallable(functions, "vitals_lockPending");
    const res = await fn({ queueCap });
    const payload = res?.data || {};
    // Optional: broadcast to UI if present (non-breaking)
    if (typeof window !== 'undefined' && payload.appliedTotals){
      window.dispatchEvent(new CustomEvent("vitals:locked", { detail: { appliedTotals: payload.appliedTotals } }));
    }
    return payload;
  }catch(e){
    console.warn("Server lock failed:", e);
    return { locked: 0 };
  }
}

// Local fallback: confirm expired and enforce queueCap if backend can't
export async function sweepLocalExpiredAndOverflow(uid, queueCap = 5){
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

export async function getEssenceAvailableMonthly_BE(uid){
  try{
    const fn = httpsCallable(functions, "vitals_getEssenceAvailableMonthly");
    const res = await fn();
    return Number(res?.data?.available||0);
  }catch(e){
    return 0;
  }
}

// ───────────────────────── Vitals Gateway recompute (migrated) ──────────────
/**
 * Recomputes vitalsData/gateway from:
 *  - cashflowData (allocations, inflow/outflow, config flags)
 *  - processedTransactions (verified or unverified, based on player mode)
 */
export async function recomputeVitalsGatewayStub(uid){
  const { cashflowDocPath, txCollectionPath } = await resolveDataSources(uid);
  const playerDataPath = `players/${uid}`

  const activeRef = doc(db, cashflowDocPath);
  const activeSnap = await getDoc(activeRef);

  // Ensure gateway doc exists to read meta/escrow, etc.
  const gatewayRef = doc(db, `players/${uid}/gateways/hub`);
  const priorGatewaySnap = await getDoc(gatewayRef);
  const priorGateway = priorGatewaySnap.exists() ? (priorGatewaySnap.data()||{}) : {};

  if (!activeSnap.exists()){
    // Minimal bootstrap to keep callers happy
    await setDoc(gatewayRef, {
      portraitKey:"default",
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

  // Player Data
  const playerRef = doc(db, playerDataPath);
  const playerSnap = await getDoc(playerRef);
  const Ap = playerSnap.data()
  const portraitKey = Ap.avatarKey

  // Vitals Data
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
  let meta = priorGateway?.meta || {
    seededAtMs: null,
    seedAnchorMs: null,
    essenceSeedGrant: 0,
    lastCrystallisedDay: null,
    escrow: { carry: { total:0, bySource:{ health:0, mana:0, stamina:0 } }, bySourceToday: { health:0, mana:0, stamina:0 } }
  };

  const anchorForSeed =
    (Number.isFinite(payCycleAnchorMs) && payCycleAnchorMs > 0) ? payCycleAnchorMs : null;
  const anchorChanged = (meta.seedAnchorMs ?? null) !== anchorForSeed;

  // Reset escrow if the explicit anchor changed
  if (anchorChanged) {
    meta.escrow = {
      carry: { total: 0, bySource: { health: 0, mana: 0, stamina: 0 } },
      bySourceToday: { health: 0, mana: 0, stamina: 0 }
    };
    meta.lastCrystallisedDay = todayLocalKey();
  }

  // Use persisted grant unless never seeded or the explicit anchor changed.
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
    crystallisedToday = Math.max(0, Number(carryEscrow.total || 0));
    carryEscrow = { total:0, bySource:{ health:0, mana:0, stamina:0 } };
  }

  // Truth totals (no wrap) and currents (clamped to cap)
  const poolsOut = {};
  const basePools = ["health","mana","stamina","essence"];

  // Essence credits include: confirmed credits to Essence + crystallisedToday
  const essenceCreditsExtra = safeNum(usage.all.credits?.essence,0) + crystallisedToday;

  for (const k of basePools){
    const spent  = safeNum(usage.all.spends?.[k], 0);
    const credit = (k === 'essence')
      ? essenceCreditsExtra
      : safeNum(usage.all.credits?.[k], 0);

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
      bankedDays:    Number(priorGateway?.pools?.[k]?.bankedDays || 0),
      trend:         (['health','mana','stamina'].includes(k) ? (trendFor(k)) : 'stable'),
      ...(k === 'health' ? { debt: Number(debt.toFixed(2)) } : {})
    };
  }

  // Overflow → today escrow; banked days counters (H/M/S only)
  const bufferDays = Math.max(0, Number(overflowBufferDays||0));
  const newBySource = { health:0, mana:0, stamina:0 };

  ["health","mana","stamina"].forEach(k=>{
    const capK   = poolsOut[k].max;
    const rdK    = poolsOut[k].regenDaily;
    const truthK = poolsOut[k].truthTotal;

    const alreadyBankedAmt = 0;
    const threshold = capK + bufferDays * rdK;
    const overflowToday = Math.max(0, truthK - threshold) - alreadyBankedAmt;

    if (overflowToday > 0){
      newBySource[k] = Number(overflowToday.toFixed(2));
    }
  });

  // Update carry using only the delta vs last saved "level for today"
  const prevBySourceToday =
    (priorDay && priorDay !== nowDay)
      ? { health:0, mana:0, stamina:0 }
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

  // Essence soft-cap for UI hint + Shield derivation
  const softCapEssence = (String(essenceSoftCapMode).toUpperCase() === 'HMS')
    ? (poolsOut.health.max + poolsOut.mana.max + poolsOut.stamina.max)
    : (poolsOut.mana.max + poolsOut.stamina.max);

  const essenceUI = {
    softCapMode: String(essenceSoftCapMode).toUpperCase(),
    softCap: Number(softCapEssence.toFixed(2)),
    escrowToday: bySourceToday,
  };

  // Shield = escrow carry constrained by soft-cap, includes derived bankedDays
  {
    const carryTot = Number((carryEscrow?.total || 0).toFixed(2));
    const softCap  = Number((essenceUI?.softCap || 0).toFixed(2));
    const hmsPerDay =
      Math.max(0, Number(poolsOut.health?.regenDaily || 0) + Number(poolsOut.mana?.regenDaily || 0) + Number(poolsOut.stamina?.regenDaily || 0));
    const shieldDays = (hmsPerDay > 0) ? Math.floor(carryTot / hmsPerDay) : 0;

    poolsOut.shield = {
      max:          softCap,
      current:      Number(Math.min(softCap || Infinity, carryTot).toFixed(2)),
      regenDaily:   0,
      spentToDate:  0,
      creditToDate: 0,
      truthTotal:   carryTot,
      bankedDays:   shieldDays,
      trend:        "stable"
    };
  }

  const healthDebt = Math.max(0, Number(poolsOut?.health?.debt || 0));

  const payload = {
    portraitKey,
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
        bySourceToday // save today's level for delta on next recompute
      },
      debts: { health: healthDebt, asOf: nowDay }
    },
    updatedAt: Date.now()
  };

  await setDoc(gatewayRef, payload, { merge:true });
  return payload;
}

// ───────────────────────── Convenience: setCreditModeOverride (BE-side) ─────
// (Used by UI, but safe to keep in BE module since it's pure data write.)
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
