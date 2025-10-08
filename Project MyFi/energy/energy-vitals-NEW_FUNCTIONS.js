// energy-vitals-NEW_FUNCTIONS.js
// Lightweight, schema-safe helpers for wake regen animation and local snapshots.

import {
  getFirestore, doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";



// Local snapshot key per user
function keyFor(uid){ return `vitals:lastSeen:${uid}`; }

// Extract the minimal snapshot we need from a gateway payload
export function buildSnapshotFromGateway(gateway){
  if (!gateway || !gateway.pools) return null;
  const p = gateway.pools;
  return {
    ts: Date.now(),
    pools: {
      health:  { current: Number(p.health?.current||0),  max: Number(p.health?.max||0)  },
      mana:    { current: Number(p.mana?.current||0),    max: Number(p.mana?.max||0)    },
      stamina: { current: Number(p.stamina?.current||0), max: Number(p.stamina?.max||0) },
      essence: { current: Number(p.essence?.current||0), max: 0 } // essence has no hard cap here
    }
  };
}

export function loadVitalsSnapshot(uid){
  try{
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const snap = JSON.parse(raw);
    // sanity
    if (!snap?.pools) return null;
    return snap;
  }catch{ return null; }
}

export function storeVitalsSnapshot(uid, gateway){
  try{
    const snap = buildSnapshotFromGateway(gateway);
    if (!snap) return;
    localStorage.setItem(keyFor(uid), JSON.stringify(snap));
  }catch{}
}

// OPTIONAL remote snapshot (for cross-device)
export async function loadVitalsSnapshotRemote(uid){
  try{
    const db = getFirestore();
    const ref = doc(db, `players/${uid}/vitalsData/gateway`);
    const snap = await getDoc(ref);
    const d = snap.exists() ? (snap.data()||{}) : null;
    const s = d?.meta?.lastClientSnapshot || null;
    if (!s?.pools) return null;
    return s;
  }catch{ return null; }
}

export async function storeVitalsSnapshotRemote(uid, gateway){
  try{
    const db = getFirestore();
    const ref = doc(db, `players/${uid}/vitalsData/gateway`);
    const s = buildSnapshotFromGateway(gateway);
    if (!s) return;
    await setDoc(ref, { meta: { lastClientSnapshot: s } }, { merge: true });
  }catch{}
}

// --- tweak: add a helper to toggle a glow class on .bar during tween
function setBarsWaking(elements, on){
  const pools = ['health','mana','stamina','essence'];
  pools.forEach(k=>{
    const bar = elements?.[k]?.fill?.closest?.('.bar');
    if (!bar) return;
    bar.classList.toggle('is-waking', !!on);
  });
}

// Per-bar glow: on('pos'|'neg') or off(null)
function setBarGlow(el, dir /* 'pos' | 'neg' | null */){
  const bar = el?.fill?.closest?.('.bar');
  if (!bar) return;
  bar.classList.remove('is-waking', 'is-waking--pos', 'is-waking--neg');
  if (!dir) return;
  bar.classList.add('is-waking', dir === 'pos' ? 'is-waking--pos' : 'is-waking--neg');
}

// clamp helper used in step painting
function clamp01(x){ return Math.max(0, Math.min(1, x)); }


// Simple tween (cubic ease-out)
function tween({ from, to, dur=900, step, done }){
  const t0 = performance.now();
  const d  = to - from;
  function f(t){
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    step(from + d * e);
    if (k < 1) requestAnimationFrame(f); else done && done();
  }
  requestAnimationFrame(f);
}

// Format exactly like energy-vitals.js uses in HUD values
function formatPair(current, cap){
  return `${current.toFixed(2)} / ${cap.toFixed(2)}`;
}



// Drive the initial “between-logins” animation
// elements: result of getVitalsElements() (passed in from main file)
// prev: snapshot from loadVitalsSnapshot(uid) or null
// curr: full gateway payload (from readGateway / recompute)
// opts: { duration?: number } (900ms default)
// export async function runWakeRegenAnimation(elements, prev, curr, opts = {}){
//   const duration = Number(opts.duration || 900);
//   if (!elements || !curr?.pools) return;

//   // If we have no prior snapshot, just paint current values once (no animation)
//   const pools = ['health','mana','stamina','essence'];

//   // Build current targets from gateway
//   const target = {};
//   for (const k of pools){
//     const v = curr.pools[k] || {};
//     target[k] = { current: Number(v.current||0), max: Number(v.max||0) };
//   }

//   // If no previous snapshot, set bars to current silently and exit
//   if (!prev?.pools){
//     for (const k of pools){
//       const el = elements[k]; if (!el) continue;
//       const cur = target[k].current, cap = target[k].max;
//       const pct = cap > 0 ? (cur / cap) * 100 : (k==='essence' ? 0 : 0);
//       el.fill.style.width   = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`;
//       el.value.textContent  = (k==='essence' && cap===0)
//         ? `${cur.toFixed(2)}`
//         : formatPair(cur, cap);
//     }
//     return;
//   }

//     // Turn on glow
//   setBarsWaking(elements, true);

//   // Animate each pool from prev.current -> target.current, respecting cap
//   await new Promise((resolveAll) => {
//     let doneCount = 0;
//     const total   = pools.length;

//     pools.forEach((k)=>{
//       const el = elements[k]; if (!el) { if(++doneCount===total){ setBarsWaking(elements,false); resolveAll(); } return; }
//       const from   = Number(prev.pools[k]?.current || 0);
//       const to     = Number(target[k].current || 0);
//       const cap    = Number(target[k].max || 0);

//       // No movement
//       if (Math.abs(to - from) < 1e-6){
//         const pct0 = cap > 0 ? (to / cap) * 100 : (k==='essence' ? 0 : 0);
//         el.fill.style.width  = `${Math.max(0, Math.min(100, pct0)).toFixed(2)}%`;
//         el.value.textContent = (k==='essence' && cap===0)
//           ? `${to.toFixed(2)}`
//           : formatPair(to, cap);
//         if(++doneCount===total){ setBarsWaking(elements,false); resolveAll(); }
//         return;
//       }

//       // Single tween from -> to (down or up). Keep it simple and readable.
//       tween({
//         from, to, dur: duration,
//         step: (v)=>{
//           const cur = Math.max(0, v);
//           const pct = cap > 0 ? (cur / cap) * 100 : (k==='essence' ? 0 : 0);
//           el.fill.style.width  = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`;
//           el.value.textContent = (k==='essence' && cap===0)
//             ? `${cur.toFixed(2)}`
//             : formatPair(cur, cap);
//         },
//         done: ()=>{ if(++doneCount===total){ setBarsWaking(elements,false); resolveAll(); } }
//       });
//     });
//   });
// }

export async function runWakeRegenAnimation(elements, prev, curr, opts = {}){
  const duration = Number(opts.duration || 900);
  if (!elements || !curr?.pools) return;

  const pools = ['health','mana','stamina','essence'];

  // Build current targets from gateway
  const target = {};
  for (const k of pools){
    const v = curr.pools[k] || {};
    target[k] = { current: Number(v.current||0), max: Number(v.max||0) };
  }

  // If no previous snapshot, paint once (no tween, no glow)
  if (!prev?.pools){
    for (const k of pools){
      const el = elements[k]; if (!el) continue;
      const cur = Number(target[k].current || 0);
      const cap = Number(target[k].max || 0);

      if (k === 'essence' || cap <= 0){
        // Essence has no hard cap in this phase; keep fill as-is, set text only
        el.value.textContent = `${cur.toFixed(2)}`;
      } else {
        const pct = clamp01(cur / cap) * 100;
        el.fill.style.width  = `${pct.toFixed(2)}%`;
        el.value.textContent = `${cur.toFixed(2)} / ${cap.toFixed(2)}`;
      }
    }
    return;
  }

  // Otherwise, per-bar tween from prev -> curr (net movement), with sign-aware glow
  await new Promise((resolveAll) => {
    let doneCount = 0;
    const total   = pools.length;
    const EPS = 1e-6;

    pools.forEach((k)=>{
      const el = elements[k];
      if (!el){ if(++doneCount===total) resolveAll(); return; }

      const cap = Number(target[k].max || 0);

      const fromRaw = Number(prev.pools?.[k]?.current || 0);
      const toRaw   = Number(target[k].current || 0);

      // Effective (visible) value: clamp H/M/S to cap; Essence unbounded here
      const eff = (val) => (k==='essence' || cap<=0) ? Math.max(0, val) : Math.max(0, Math.min(cap, val));
      const fromEff = eff(fromRaw);
      const toEff   = eff(toRaw);

      const delta = toEff - fromEff;
      const moved = Math.abs(delta) >= EPS;

      if (!moved){
        // No visible change → paint once, no glow
        if (k === 'essence' || cap <= 0){
          el.value.textContent = `${toEff.toFixed(2)}`;
        } else {
          const pct = clamp01(toEff / cap) * 100;
          el.fill.style.width  = `${pct.toFixed(2)}%`;
          el.value.textContent = `${toEff.toFixed(2)} / ${cap.toFixed(2)}`;
        }
        if(++doneCount===total) resolveAll();
        return;
      }

      // Visible movement → animate once with sign-aware glow
      setBarGlow(el, delta > 0 ? 'pos' : 'neg');

      tween({
        from: fromEff,
        to:   toEff,
        dur:  duration,
        step: (v)=>{
          const cur = Math.max(0, v);
          if (k === 'essence' || cap <= 0){
            // Don’t fake a width for essence here; just update value
            el.value.textContent = `${cur.toFixed(2)}`;
          } else {
            const pct = clamp01(cur / cap) * 100;
            el.fill.style.width  = `${pct.toFixed(2)}%`;
            el.value.textContent = `${cur.toFixed(2)} / ${cap.toFixed(2)}`;
          }
        },
        done: ()=>{
          setBarGlow(el, null);
          if(++doneCount===total) resolveAll();
        }
      });
    });
  });
}


// ----------------------- 
// Emberward UI
// -------------
// energy/emberward-frame.js

// Reuse the same active doc path your HUD already uses
// See energy-vitals.js resolveDataSources() → cashflowDocPath. :contentReference[oaicite:1]{index=1}

function clamp(v, a=0, b=1){ return Math.max(a, Math.min(b, v)); }

function ensureFrame(host){
  if (!host) return null;
  let frame = host.querySelector('.emberward-frame');
  if (!frame){
    frame = document.createElement('div');
    frame.className = 'emberward-frame';
    host.appendChild(frame);
  }
  return frame;
}

/**
 * shape: 'inherit' | 'round'  (default 'inherit' = match current portrait shape)
 * maxRatio: cap for intensity mapping (e.g., 1.0 = 100% ember vs income)
 */
export function initEmberwardFrame(uid, { shape='inherit', maxRatio=1.0 } = {}){
  const host = document.querySelector('.portrait-wrapper');
  if (!host) return () => {};

  // optional shape toggle
  if (shape === 'round') host.classList.add('round'); else host.classList.remove('round');

  const frame = ensureFrame(host);
  const db = getFirestore();
  const ref = doc(db, `players/${uid}/financialData/cashflowData`);

  // One-off initial paint then live updates
  let unsub = onSnapshot(ref, snap => apply(snap?.data()||{}), () => { /* silent */ });

  async function apply(A){
    // Compatible with both verified/unverified writers (they merge into the active doc):
    // inflow.total / outflow.total (monthly) are written here. :contentReference[oaicite:2]{index=2}
    const inc = Number(A?.inflow?.total ?? A?.inflow ?? 0);
    const out = Number(A?.outflow?.total ?? A?.outflow ?? 0);

    console.log(inc)
    console.log(out)

    const hasEmber = out > 0;
    const intensity = hasEmber && inc > 0 ? clamp(out / inc, 0, maxRatio) / maxRatio : 0;
    console.log(hasEmber, intensity)

    host.classList.toggle('is-ember-on', hasEmber);
    host.classList.toggle('is-ember-off', !hasEmber);

    // Drive the flame strength
    frame.style.setProperty('--ember-intensity', String(intensity));

    console.log(frame)
  }

  // Expose a tiny helper to flick shape later without re-init
  window.MyFiEmberwardUI = {
    setShape(mode /* 'inherit' | 'round' */){
      if (mode === 'round') host.classList.add('round');
      else host.classList.remove('round');
    }
  };

  return () => { try{ unsub?.(); }catch{} };
}


// --------------
// Stats Summary Modal
// ------------
// energy/summary-modal.js
// Minimal, style-matching Summary Modal (UI-only).
// API: initSummaryModal(); openSummaryModal(data); closeSummaryModal();

let __summaryMounted = false;

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function ensureModalDOM() {
  if (__summaryMounted) return;

  const overlay = el('div', 'summary-overlay', `
    <div class="summary-card" role="dialog" aria-modal="true" aria-labelledby="summaryTitle">
      <div class="summary-card__hd">
        <h3 id="summaryTitle">Daily Summary</h3>
        <button class="summary-close" aria-label="Close">✕</button>
      </div>

      <div class="summary-card__body">
        <!-- Sections are intentionally simple & easy to extend -->
        <section class="summary-sec" id="sum-daily">
          <h4>Daily</h4>
          <div class="summary-rows"></div>
        </section>

        <section class="summary-sec" id="sum-cycle">
          <h4>Cycle</h4>
          <div class="summary-rows"></div>
        </section>

        <section class="summary-sec" id="sum-essence">
          <h4>Essence</h4>
          <div class="summary-rows"></div>
        </section>
      </div>
    </div>
  `);

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSummaryModal();
  });
  overlay.querySelector('.summary-close')?.addEventListener('click', closeSummaryModal);
  __summaryMounted = true;
}

export function initSummaryModal() {
  ensureModalDOM();
}

export function closeSummaryModal() {
  const o = document.querySelector('.summary-overlay');
  if (!o) return;
  o.classList.remove('is-open');
  setTimeout(() => { o.style.display = 'none'; }, 160);
}

function rowHTML(label, value, hint='') {
  const hintHtml = hint ? `<span class="hint">${hint}</span>` : '';
  return `
    <div class="summary-row">
      <div class="summary-row__label">${label}</div>
      <div class="summary-row__value">${value} ${hintHtml}</div>
    </div>
  `;
}

/**
 * data (all optional; strings or numbers):
 * {
 *   dailyIncome, dailyExpense, netDaily,
 *   cyclePct, cycleDaysIn, cycleDaysTotal,
 *   essenceNow, essenceSoftCap, crystalisedToday
 * }
 */
export function openSummaryModal(data = {}) {
  ensureModalDOM();
  const o = document.querySelector('.summary-overlay');
  if (!o) return;

  // DAILY
  const daily = o.querySelector('#sum-daily .summary-rows');
  daily.innerHTML = [
    rowHTML('Income', fmt(data.dailyIncome)),
    rowHTML('Expense', fmt(data.dailyExpense)),
    rowHTML('Net / day', tagNet(fmt(data.netDaily)))
  ].join('');

  // CYCLE
  const cycle = o.querySelector('#sum-cycle .summary-rows');
  const pct = isFiniteNum(data.cyclePct) ? `${Number(data.cyclePct).toFixed(0)}%` : '—';
  cycle.innerHTML = [
    rowHTML('Progress', pct, `${fmt(data.cycleDaysIn)} / ${fmt(data.cycleDaysTotal)} days`)
  ].join('');

  // ESSENCE
  const ess = o.querySelector('#sum-essence .summary-rows');
  const hasSoft = isFiniteNum(data.essenceSoftCap) && Number(data.essenceSoftCap) > 0;

  const essenceRows = [
    rowHTML('Current', hasSoft
      ? `${fmt(data.essenceNow)} <span class="sep">/</span> ${fmt(data.essenceSoftCap)}`
      : fmt(data.essenceNow))
  ];

  // Optional: show escrow generated today if present
  if (isFiniteNum(data.escrowToday) && Number(data.escrowToday) > 0) {
    essenceRows.push(rowHTML('Escrow (today)', fmt(data.escrowToday)));
  }

  // Keep the old line if you still want a placeholder:
  if (isFiniteNum(data.crystalisedToday) && Number(data.crystalisedToday) > 0) {
    essenceRows.push(rowHTML('Crystallised today', fmt(data.crystalisedToday)));
  }

  ess.innerHTML = essenceRows.join('');

  o.style.display = 'grid';
  requestAnimationFrame(() => o.classList.add('is-open'));
}

/* -------- helpers (local) -------- */
function isFiniteNum(n){ return Number.isFinite(Number(n)); }
function fmt(n) {
  if (!isFiniteNum(n)) return '—';
  const x = Number(n);
  return (Math.abs(x) >= 1000) ? Math.round(x).toLocaleString('en-GB') : x.toFixed(2);
}
function tagNet(html) {
  const x = Number(String(html).replace(/[,]/g,''));
  if (!Number.isFinite(x)) return html;
  const cls = x > 0 ? 'pos' : (x < 0 ? 'neg' : '');
  return `<span class="net ${cls}">${html}</span>`;
}

/* -------- Optional: quick HUD scrape for demo -------- */
/**
 * Reads visible numbers from your HUD to provide a "good enough" summary
 * when you don't want to plumb gateway data yet.
 */
export function buildSummaryFromHUDFallback() {
  // Daily: infer from rate peek text if available, else 0s
  const getRate = (id) => {
    const val = document.querySelector(`#vital-${id} .bar-value`);
    const txt = val?.__rateText || ''; // we set this in your HUD wiring
    const m = /([+-]?\d+(\.\d+)?)\/(hr|day|wk)/i.exec(txt || '');
    return m ? Number(m[1]) : 0;
  };
  const healthRate = getRate('health');
  const manaRate = getRate('mana');
  const staminaRate = getRate('stamina');
  const essenceRate = getRate('essence');
  // best-effort for daily net = sum of per-day equivalents
  const toPerDay = (r) => {
    const val = Number(r||0);
    // __rateText is +x/hr for daily mode by default in your code
    // multiply by 24 for a rough per-day
    return val * 24;
  };
  const netDaily = toPerDay(healthRate) + toPerDay(manaRate) + toPerDay(staminaRate) + toPerDay(essenceRate);

  // Essence current / soft-cap (from text your HUD prints)
  const essVal = document.querySelector('#vital-essence .bar-value')?.textContent || '';
  const mm = /([0-9.,]+)\s*\/\s*([0-9.,]+)/.exec(essVal);
  const essenceNow = mm ? Number(mm[1].replace(/,/g,'')) : Number(essVal.replace(/,/g,'')) || 0;
  const essenceSoftCap = mm ? Number(mm[2].replace(/,/g,'')) : 0;

  return {
    dailyIncome: NaN,                // not scraped; you’ll wire in later
    dailyExpense: NaN,               // not scraped; you’ll wire in later
    netDaily,
    cyclePct: NaN,                   // wire later (needs anchor math)
    cycleDaysIn: NaN,
    cycleDaysTotal: NaN,
    essenceNow,
    essenceSoftCap,
    crystalisedToday: 0              // wire later (escrow carry delta)
  };
}

// ---- Real data hook (Firestore gateway) ----

export async function openSummaryFromGateway(uid) {
  try {
    const db  = getFirestore();
    const ref = doc(db, `players/${uid}/vitalsData/gateway`);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // fallback to HUD scrape if gateway not ready
      return openSummaryModal(buildSummaryFromHUDFallback());
    }

    const g = snap.data() || {};
    const core = g.core || {};
    const pools = g.pools || {};
    const essenceUI = g.essenceUI || {};
    const meta = g.meta || {};

    // Daily (already computed server-side)
    const dailyIncome  = Number(core.dailyIncome  || 0);
    const dailyExpense = Number(core.dailyExpense || 0);
    const netDaily     = Number(core.netDaily     || 0);

    // Cycle progress — anchor or 1st of month fallback
    const MS_DAY = 86_400_000;
    const CYCLE_DAYS = 30.44;
    const anchorMs = Number.isFinite(g.payCycleAnchorMs) && g.payCycleAnchorMs > 0
      ? g.payCycleAnchorMs
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const daysIn = Math.max(0, (Date.now() - anchorMs) / MS_DAY);
    const cyclePct = Math.max(0, Math.min(100, (daysIn / CYCLE_DAYS) * 100));

    // Essence
    const essenceNow     = Number(pools.essence?.current || 0);
    const essenceSoftCap = Number(essenceUI.softCap || 0);

    // Optional: escrow generated today (UI concept)
    const escrowToday = Math.max(
      0,
      Number(essenceUI?.escrowToday?.health || 0) +
      Number(essenceUI?.escrowToday?.mana   || 0) +
      Number(essenceUI?.escrowToday?.stamina|| 0)
    );

    // You can also surface meta.lastCrystallisedDay if you want later.
    openSummaryModal({
      dailyIncome,
      dailyExpense,
      netDaily,
      cyclePct,
      cycleDaysIn: daysIn,
      cycleDaysTotal: CYCLE_DAYS,
      essenceNow,
      essenceSoftCap,
      // we don’t track “crystallised today” as a scalar right now;
      // pass escrowToday to show as an extra line in the Essence section.
      escrowToday
    });

  } catch (e) {
    console.warn('[summary] openSummaryFromGateway failed', e);
    // graceful fallback
    openSummaryModal(buildSummaryFromHUDFallback());
  }
}


