// fe/vitals.vm.js
// Builds a lightweight VM for the Hub vitals card and (optionally) computes
// Focus math (Today / This Week) from confirmed transactions.
//
// Public API:
//   - buildHUDModel(gw, mode='core'): returns VM for renderBars/renderPortrait
//   - ensureFocusCache(mode): prefetches/refreshes focus sums when mode != 'core'

import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from '../../../core/firestore.js';
import { resolveDataSources } from '../../../_graveyard/gateway.js';

const nf = (n, d=0) => new Intl.NumberFormat(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n||0));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ───────────────────────── Focus cache (confirmed spend only) ─────────────────
const focusCache = {
  mode: 'core',
  start: 0,
  end: 0,
  days: 1,
  sums: { health:0, mana:0, stamina:0, essence:0 },
  lastFetchMs: 0
};

const MS_PER_DAY = 86_400_000;

function getFocusBounds(mode){
  const now = new Date();
  if (mode === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { start, end: start + MS_PER_DAY, days: 1 };
  }
  // weekly → Monday..Sunday (Mon = 0)
  const dow = (now.getDay() + 6) % 7;
  const sDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const start = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate()).getTime();
  return { start, end: start + 7*MS_PER_DAY, days: 7 };
}

async function fetchConfirmedSpendInRange(s, e){
  const u = auth.currentUser?.uid;
  if (!u) return { health:0, mana:0, stamina:0, essence:0 };

  const { txCollectionPath } = await resolveDataSources(u);
  const col = collection(db, txCollectionPath);
  const qy = query(col,
    where('status','==','confirmed'),
    where('dateMs','>=', s),
    where('dateMs','<',  e)
  );

  const sums = { health:0, mana:0, stamina:0, essence:0 };
  const snap = await getDocs(qy);
  snap.forEach(d=>{
    const x = d.data()||{};
    const cls = String(x.classification||'').toLowerCase();
    const isCore = (cls==='coreinflow'||cls==='coreoutflow');
    if (isCore) return;

    const amt = Number(x.amount ?? x.amountMajor ?? 0);
    if (amt >= 0) return; // credits handled by gateway/essence

    const alloc = x.appliedAllocation || {};
    sums.health  += Number(alloc.health  || 0);
    sums.mana    += Number(alloc.mana    || 0);
    sums.stamina += Number(alloc.stamina || 0);
  });

  for (const k of Object.keys(sums)) sums[k] = Number(sums[k].toFixed(2));
  return sums;
}

/** Ensure we have fresh confirmed-spend sums for the given mode. */
export async function ensureFocusCache(mode){
  if (mode === 'core') return;
  const { start, end, days } = getFocusBounds(mode);
  const stale = (Date.now() - (focusCache.lastFetchMs||0)) > 15000
             || start !== focusCache.start
             || end   !== focusCache.end
             || mode  !== focusCache.mode;

  if (!stale) return;

  focusCache.mode  = mode;
  focusCache.start = start;
  focusCache.end   = end;
  focusCache.days  = Math.max(1, days);
  focusCache.sums  = await fetchConfirmedSpendInRange(start, end);
  focusCache.lastFetchMs = Date.now();
  window.dispatchEvent(new CustomEvent('vitals:focusCache', { detail:{ ...focusCache }}));
}

// ───────────────────────────────── VM builder ─────────────────────────────────
export function buildHUDModel(gw, mode = 'core') {
  if (!gw || !gw.pools) return null;

  const portraitKey = gw.portraitKey;
  const P = gw.pools;
  const essenceSoftCap = Number(gw?.essenceUI?.softCap || 0);

  // helpers
  const bar = (label, current, max, trend) => {
    const widthPct = max > 0 ? (current / max) * 100 : 0;
    const text = (max > 0)
      ? `${Math.round(current).toLocaleString()} / ${Math.round(max).toLocaleString()}`
      : `${Math.round(current).toLocaleString()}`;
    return { label, widthPct, text, trend: trend || 'stable' };
  };

  // Base values
  const H = P.health  || {};
  const M = P.mana    || {};
  const S = P.stamina || {};
  const Sh= P.shield  || {};
  const E = P.essence || {};

  let titleLabel = 'Current';
  let totals = { current: 0, max: 0 };

  // derive view-specific numbers
  let hCur, hMax, mCur, mMax, sCur, sMax, shCur, shMax, eCur, eMax;

  if (mode === 'core') {
    // Core (cycle)
    hMax = Number(H.max||0); hCur = clamp(Number(H.current||0), 0, hMax);
    mMax = Number(M.max||0); mCur = clamp(Number(M.current||0), 0, mMax);
    sMax = Number(S.max||0); sCur = clamp(Number(S.current||0), 0, sMax);

    shMax = Number(Sh.max||0);
    shCur = clamp(Number(Sh.current||0), 0, shMax);

    eCur = Number(E.current||0);
    eMax = Number(essenceSoftCap||0); // soft cap drives width only

    totals.current = (hCur + mCur + sCur);
    totals.max     = (hMax + mMax + sMax);
    titleLabel     = 'Current';
  } else {
    // Focus (Today / This Week)
    const daysIn = focusCache.days || (mode==='daily'?1:7);

    const capF = (poolObj, days) => {
      const cyc = Number(poolObj?.max || 0);
      const daily = Number(poolObj?.regenDaily ?? poolObj?.regenCurrent ?? 0);
      return Math.min(cyc, Math.max(0, daily * days));
    };

    const capH = capF(H, daysIn);
    const capM = capF(M, daysIn);
    const capS = capF(S, daysIn);

    const spent = focusCache.sums || { health:0, mana:0, stamina:0, essence:0 };

    hMax = capH; mMax = capM; sMax = capS;
    hCur = clamp(capH - Number(spent.health||0),  0, capH);
    mCur = clamp(capM - Number(spent.mana||0),    0, capM);
    sCur = clamp(capS - Number(spent.stamina||0), 0, capS);

    shMax = Number(Sh.max||0);
    shCur = clamp(Number(Sh.current||0), 0, shMax); // pending drawdown can be layered later

    eCur = Number(E.current||0);
    eMax = Number(essenceSoftCap||0);

    totals.current = (hCur + mCur + sCur);
    totals.max     = (hMax + mMax + sMax);
    titleLabel     = (mode==='daily') ? 'Focus: Today' : 'Focus: This Week';
  }

  const vm = {
    portraitKey,
    labels: {
      title: titleLabel,
      totals: `${nf(totals.current)}/${nf(totals.max)}`
    },
    totals,
    bars: {
      health:  bar('Health',  hCur, hMax, H.trend),
      mana:    bar('Mana',    mCur, mMax, M.trend),
      stamina: bar('Stamina', sCur, sMax, S.trend),
      shield:  bar('Shield',  shCur, shMax, Sh.trend),
      essence: (() => {
        const max = eMax;
        const widthPct = max > 0 ? Math.min(100, (eCur / max) * 100) : 0;
        const text = max > 0
          ? `${Math.round(eCur).toLocaleString()} / ${Math.round(max).toLocaleString()}`
          : `${Math.round(eCur).toLocaleString()}`;
        return { label:'Essence', widthPct, text, trend: E.trend || 'stable' };
      })()
    },
    pills: {
      shield: { now: Number(Sh.bankedDays || 0), next: Number(Sh.bankedDays || 0) }
    },
    ratePeek: {
      health:  `+${nf(H.regenDaily||0,2)}/day`,
      mana:    `+${nf(M.regenDaily||0,2)}/day`,
      stamina: `+${nf(S.regenDaily||0,2)}/day`,
      essence: `+${nf(E.regenDaily||0,2)}/day`,
    }
  };

  return vm;
}
