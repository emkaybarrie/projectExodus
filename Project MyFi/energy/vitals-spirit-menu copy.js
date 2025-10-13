// vitals-spirit-menu.js
// Spirit Stone Menu (Transmute / Charge / Shards / Contribute)
// Frontend-only; emits CustomEvents for backend & Stripe integration.
// Depends on: energy-vitals.js (refreshVitals), optional window.MyFiModal

import { refreshVitals, refreshVitalsHUD } from "./energy-vitals.js";

// Read-only wallet helpers
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/** ---------- Utils ---------- */
const fmt = (n, d=0) => new Intl.NumberFormat(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n||0));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const uc = s => s.charAt(0).toUpperCase() + s.slice(1);

// ↓ ADD (helpers for schema fields)
const GHOST_WINDOW_MS = 6 * 60 * 1000; // 360000 (matches example)

function startOfDayMs(ms = Date.now()){
  const d = new Date(ms);
  d.setHours(0,0,0,0);
  return d.getTime();
}

async function readWallet(uid){
  try{
    const db = getFirestore();
    const snap = await getDoc(doc(db, `players/${uid}/wallet/main`));
    return snap.exists() ? (snap.data() || {}) : {};
  }catch{ return {}; }
}

// --- Synthetic TX writer for Transmute (no energy-vitals changes needed) ---
// Writes a bundle of synthetic transactions for Transmute.
// - One (+) credit per destination pool (H/M/S) with amount > 0
// - One (–) debit from Essence with amount < 0 and appliedAllocation = { essence: total }
// These post as "confirmed" so recompute picks them up immediately.
async function writeTransmuteTxBundle(db, uid, pendingActions, bucket = 'verified'){
  if (!uid || !Array.isArray(pendingActions) || pendingActions.length === 0) return;

  // Aggregate by pool
  const byPool = pendingActions.reduce((acc, a) => {
    const pool = String(a.to || '').toLowerCase();      // 'health' | 'mana' | 'stamina'
    const amt  = Number(a.amount || 0);
    if (!amt || !['health','mana','stamina'].includes(pool)) return acc;
    acc[pool] = Number(((acc[pool] || 0) + amt).toFixed(2));
    return acc;
  }, {});

  const total = Object.values(byPool).reduce((s, v) => Number((s + v).toFixed(2)), 0);
  if (total <= 0) return;

  const nowMs  = Date.now();
  const dateMs = startOfDayMs(nowMs);            // keep consistent with your example
  const colRef = collection(db, `players/${uid}/financialData/processedTransactions/${bucket}`);

  const baseCommon = {
    accountId: null,
    addedMs: nowMs,
    dateMs,                                      // used by reader for the window
    ghostWindowMs: GHOST_WINDOW_MS,              // 360000
    ghostExpiryMs: nowMs + GHOST_WINDOW_MS,
    rulesVersion: 'v1',
    source: 'spirit_transmute',
    status: 'confirmed',
    creditModeOverride: null,
    provisionalTag: null,
    suggestedPool: null,
    autoLockReason: 'client_fallback',           // safe default; matches your example
    setAtMs: nowMs,
    appliedAllocation: {},                       // credits: unused by reader; debit: we set essence below
    // pool + tag filled per-row
    transactionData: {
      description: '',                           // filled per-row
      entryDate: new Date(nowMs).toUTCString()   // reader prefers dateMs, but this keeps parity
    }
  };

  const writes = [];

  // (+) One CREDIT per destination pool.
  // For HEALTH → override 'health' so reader books it straight to Health.
  // For MANA/STAMINA → use 'allocate' and set tag.pool to intent ('mana'|'stamina').
  //   readNonCoreUsage.applyAllocatedCredit(amount, intent, when)
  //   will allocate to the intent pool given infinite availability.
  for (const [pool, amount] of Object.entries(byPool)) {
    const isHealth = (pool === 'health');

    const row = {
      ...baseCommon,
      amount: Number(amount.toFixed(2)),  // amt > 0 ⇒ credit path
      essence: 0, health: 0, mana: 0, stamina: 0, // not used by reader for credits
      pool,                                // convenience for queries
      tag: { pool },                       // intent for allocate mode
      creditModeOverride: isHealth ? 'health' : 'allocate',
      transactionData: {
        description: `Spirit: Transmute → ${pool}`,
        entryDate: new Date(nowMs).toUTCString()
      }
    };

    writes.push(addDoc(colRef, row));
  }

  // (–) One DEBIT from ESSENCE with explicit appliedAllocation
  // Reader prefers appliedAllocation for debits; this ensures spend comes from Essence only
  const essenceDebit = {
    ...baseCommon,
    amount: Number((-total).toFixed(2)),      // amt < 0 ⇒ debit path
    pool: 'essence',
    tag: { pool: 'essence' },
    creditModeOverride: null,
    appliedAllocation: { health:0, mana:0, stamina:0, essence: Number(total.toFixed(2)) },
    essence: 0, health: 0, mana: 0, stamina: 0,  // not used for debits
    transactionData: {
      description: `Spirit: Transmute ← Essence`,
      entryDate: new Date(nowMs).toUTCString()
    }
  };

  writes.push(addDoc(colRef, essenceDebit));

  await Promise.all(writes);
}

// ADD this helper somewhere near other utils (e.g., after attachFallbackOverlay)
function showSpiritToast(message = "Transmutation complete"){
  // container
  const host = document.createElement('div');
  host.className = 'spirit-toast';
  host.innerHTML = `
    <div class="toast-stone">
      <span class="spark s1"></span>
      <span class="spark s2"></span>
      <span class="spark s3"></span>
      <span class="glow"></span>
      <div class="toast-msg">${message}</div>
    </div>
  `;
  document.body.appendChild(host);
  // auto-remove
  setTimeout(()=> host.classList.add('leaving'), 2000);
  setTimeout(()=> host.remove(), 2600);
}




/** ---------- Public: init ---------- */
export function autoInitSpiritStoneButton(selector = '#essence-btn'){
  const btn = document.querySelector(selector) || document.querySelector('.essence-btn');
  if (!btn || btn.__spiritWired) return;
  btn.__spiritWired = true;
  btn.addEventListener('click', (e) => { e.preventDefault(); openSpiritStoneMenu().catch(console.warn); }, { passive:true });
}

/** ---------- Public: open ---------- */
export async function openSpiritStoneMenu() {
  const uid = getAuth().currentUser?.uid;
  const [gateway, wallet] = await Promise.all([ refreshVitals().catch(()=>null), uid ? readWallet(uid) : {} ]);
  const ui = buildMenuUI({ gateway: gateway||{}, wallet: wallet||{} });
  if (window.MyFiModal?.openChildRaw) window.MyFiModal.openChildRaw({ menuTitle: 'Spirit Stone', node: ui.root });
  else attachFallbackOverlay(ui.root);
}

/** ---------- UI ---------- */
function buildMenuUI({ gateway, wallet }) {
  const pools = gateway?.pools || {};

  // Essence + cap **only** from vitals gateway
  const essence = Number(pools?.essence?.current || 0);
  const shards  = Number(wallet?.shards ?? 0);
  const chargePct = clamp(Number(wallet?.charge?.pct ?? 0), 0, 1);
  const tier      = Number(wallet?.charge?.tier ?? 1);

  const v = {
    health: { cur: Number(pools?.health?.current || 0), max: Number(pools?.health?.max || 0) },
    mana:   { cur: Number(pools?.mana?.current   || 0), max: Number(pools?.mana?.max   || 0) },
    stamina:{ cur: Number(pools?.stamina?.current|| 0), max: Number(pools?.stamina?.max|| 0) },
  };

  // Essence soft cap for UI (matches vitals essence bar)
  const softCap = Number(gateway?.essenceUI?.softCap || pools?.essence?.max || 0);

  // Decide tx bucket from gateway mode
  const txBucket = (
    gateway?.transactionMode === 'unverified' ||
    gateway?.finance?.txBucket === 'unverified' ||
    gateway?.writeBucket === 'unverified'
  ) ? 'unverified' : 'verified';

  const root = document.createElement('div');
  root.className = 'spirit-card';
  root.innerHTML = `
    <div class="spirit-summary">
      ${renderStoneSummary(chargePct, tier)}
      ${renderSummaryRows({ essence, shards, tier })}
    </div>

    <!-- MAIN TABS -->
    <div class="spirit-tabs">
      <button class="spirit-tab is-active" data-tab="transmute">Transmute</button>
      <button class="spirit-tab" data-tab="spend">Spend</button>
    </div>

    <div class="spirit-panels">
      <!-- TRANSMUTE PANEL -->
      <section class="spirit-panel is-active" data-panel="transmute">
        ${panelTransmute(essence, v, softCap)}
      </section>

      <!-- SPEND PANEL with SUB-TABS -->
      <section class="spirit-panel" data-panel="spend">
        <div class="spend-tabs">
          <button class="spend-tab is-active" data-stab="charge">Channel</button>
          <button class="spend-tab" data-stab="shards">Forge</button>
          <button class="spend-tab" data-stab="contrib">Gift</button>
        </div>
        <div class="spend-panels">
          <section class="spend-panel is-active" data-spanel="charge">${panelCharge(essence, chargePct)}</section>
          <section class="spend-panel" data-spanel="shards">${panelShards(essence, shards, tier)}</section>
          <section class="spend-panel" data-spanel="contrib">${panelContrib(essence)}</section>
        </div>
      </section>
    </div>

    <!-- GLOBAL SHARED FOOTER (applies to current tab) -->
    <div class="footer-actions global-footer">
      <button class="btn-reset"  data-action="reset-global">Reset</button>
      <button class="btn-confirm" data-action="confirm-global">Confirm</button>
    </div>
  `;

  wireTabs(root);
  wireTransmutePanel(root, { essence, v, softCap, txBucket });
  wireChargePanel(root, { essence });
  wireShardsPanel(root, { essence, shards, tier });
  wireContribPanel(root, { essence });
  wireSpendControls(root, { essence, shards, tier });
  wireGlobalFooter(root);    // <-- new router for the shared footer

  return { root };
}

/** ---------- Summary (Header) ---------- */
function renderStoneSummary(chargePct, _tier){
  const tiers = 5;
  const litCount = Math.floor(chargePct * tiers);
  const frac = (chargePct * tiers) - litCount;

  // inner → outer glow order
  const rings = Array.from({length: tiers}).map((_, i) => {
    const idx = i + 1;                 // 1..5 (1=outer)
    const innerIndex = tiers - idx + 1; // 5..1 (5 = inner)
    let cls = 'ring';
    if (innerIndex <= litCount) cls += ' ring-on';
    else if (innerIndex === litCount + 1 && frac > 0.01) cls += ' ring-partial';
    return `<span class="${cls}" style="--i:${idx}"></span>`;
  }).join('');

  const pctLabel = Math.round(chargePct * 100);
  return `
    <div class="stone-wrap" aria-label="Spirit Stone Charge ${pctLabel}%">
      <div class="stone-core">
        <div class="stone-glow"></div>
        ${rings}
        <div class="stone-label">${pctLabel}%</div>
      </div>
    </div>
  `;
}


function renderSummaryRows({ essence, shards, tier }){
  return `
    <div class="summary-rows">
      <div class="summary-caption">Spirit Stone • Tier ${tier}</div>
      <div class="summary-row"><div class="summary-row__label">Essence</div><div class="summary-row__value js-ess">${fmt(essence)}</div></div>
      <div class="summary-row"><div class="summary-row__label">Soul Shards</div><div class="summary-row__value js-shards">${fmt(shards)}</div></div>
    </div>
  `;
}


/** ---------- Tabs ---------- */
function wireTabs(root){
  // Main tabs
  const tabs = [...root.querySelectorAll('.spirit-tab')];
  const panels = [...root.querySelectorAll('.spirit-panel')];

  root.addEventListener('click', (e)=>{
    const t = e.target.closest('.spirit-tab');
    if (t){
      const key = t.dataset.tab;
      tabs.forEach(b => b.classList.toggle('is-active', b===t));
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel===key));
      return;
    }
    // Sub-tabs (only inside Spend panel)
    const s = e.target.closest('.spend-tab');
    if (s){
      const wrap = root.querySelector('[data-panel="spend"]');
      const stabs = [...wrap.querySelectorAll('.spend-tab')];
      const spans = [...wrap.querySelectorAll('.spend-panel')];
      const key = s.dataset.stab;
      stabs.forEach(b => b.classList.toggle('is-active', b===s));
      spans.forEach(p => p.classList.toggle('is-active', p.dataset.spanel===key));
    }
  });
}

/** ---------- Footer ---------- */
function wireGlobalFooter(root){
  const resetBtn   = root.querySelector('.global-footer .btn-reset');
  const confirmBtn = root.querySelector('.global-footer .btn-confirm');

  const activeMain = () => (root.querySelector('.spirit-tab.is-active')?.dataset.tab || 'transmute');
  const activeSub  = () => (root.querySelector('[data-panel="spend"] .spend-tab.is-active')?.dataset.stab || 'charge');

  const fire = (type) => {
    const main = activeMain();
    const sub  = main === 'spend' ? activeSub() : null;
    root.dispatchEvent(new CustomEvent(`spirit:footer:${type}`, { detail: { main, sub } }));
  };

  resetBtn?.addEventListener('click',   () => fire('reset'));
  confirmBtn?.addEventListener('click', () => fire('confirm'));
}



/** =========================================================
 *  TRANSMUTE: Essence → Pools (hold→preview, confirm modal)
 *  =======================================================*/
function panelTransmute(essence, v, softCap){
  const pct = k => (v[k].max ? Math.round((v[k].cur / v[k].max)*100) : 0);
  return `
    <div class="panel-wrap">
      <p class="panel-note">Transmute Essence into Health, Mana or Stamina.</p>

      <div class="pools-grid">
        ${renderPoolBar('health', v.health.cur, v.health.max, pct('health'))}
        ${renderPoolBar('mana',   v.mana.cur,   v.mana.max,   pct('mana'))}
        ${renderPoolBar('stamina',v.stamina.cur,v.stamina.max,pct('stamina'))}
      </div>

      ${renderEssenceBar(essence, softCap)}

      <div class="target-pools">
        <span class="tgt-label">Target:</span>
        <button class="pool-btn pill health is-active" data-target="health">Health</button>
        <button class="pool-btn pill mana" data-target="mana">Mana</button>
        <button class="pool-btn pill stamina" data-target="stamina">Stamina</button>
      </div>

      <div class="charge-meter">
        <div class="charge-bar"><div class="charge-fill plan" style="width:0%"></div></div>
        <div class="charge-stats centered">
          <span class="plan-label health">Planned: £<span class="cs-amt">0</span> → <b class="cs-target">Health</b></span>
        </div>
      </div>

      <div class="quick-row">
        <button class="quick full-selected">Fill Selected to Full</button>
        <button class="quick full-all">Fill All to Full</button>
      </div>

      <button class="transmute-hold" aria-label="Hold to transmute">Hold to Transmute</button>

    </div>
  `;
}


function renderPoolBar(key, cur, max, pct){
  return `
    <div class="poolbar ${key}" data-key="${key}" data-cur="${cur}" data-max="${max}">
      <div class="poolbar__hdr">
        <span class="poolbar__name">${uc(key)}</span>
        <span class="poolbar__val">£${fmt(cur)} / £${fmt(max)} <b>(${pct}%)</b></span>
      </div>
      <div class="poolbar__track">
        <div class="poolbar__fill base"></div>
        <div class="poolbar__fill plan plan-${key}" style="width:0%"></div>
      </div>
    </div>
  `;
}

function renderEssenceBar(essence, softCap){
  const cur = essence;
  const max = Math.max(softCap || cur || 1, 1);
  const pct = Math.round((cur / max) * 100);
  return `
    <div class="essbar" data-cur="${cur}" data-max="${max}">
      <div class="poolbar__hdr">
        <span class="poolbar__name">Essence</span>
        <span class="poolbar__val">£${fmt(cur)} <b>(${pct}%)</b></span>
      </div>
      <div class="poolbar__track">
        <!-- base (solid) = current/remaining essence vs softCap -->
        <div class="poolbar__fill base ess-base" style="width:${pct}%"></div>
        <!-- plan (striped) = slice to be deducted; starts at remaining -->
        <div class="poolbar__fill plan ess-plan" style="left:${pct}%; width:0%"></div>
      </div>
    </div>
  `;
}


function wireTransmutePanel(root, { essence, v, softCap, txBucket }){
  const wrap = root.closest('.spirit-card') || root;

  // UI nodes
  const targetBtns = [...root.querySelectorAll('.pool-btn')];
  const fill  = root.querySelector('[data-panel="transmute"] .charge-fill.plan') || root.querySelector('.charge-fill.plan');
  const amtEl = root.querySelector('[data-panel="transmute"] .cs-amt') || root.querySelector('.cs-amt');
  const planLabel = root.querySelector('[data-panel="transmute"] .plan-label') || root.querySelector('.plan-label');
  const tgtEl = root.querySelector('[data-panel="transmute"] .cs-target') || root.querySelector('.cs-target');
  const btnHold = root.querySelector('.transmute-hold');

  const headEssEl = wrap.querySelector('.summary-row .js-ess');

  const getEssNow = () =>
    Number(String(headEssEl?.textContent || '').replace(/[,£]/g,'')) || Number(essence) || 0;

  // colour utility: toggle class on host for CSS theming
  const host = root.closest('.spirit-card');
  const setTargetTheme = (k)=>{
    host?.classList.remove('tgt-health','tgt-mana','tgt-stamina');
    host?.classList.add(`tgt-${k}`);
    planLabel?.classList.remove('health','mana','stamina');
    planLabel?.classList.add(k);
  };

  // Pool DOM
  const poolsEls  = {
    health: root.querySelector('.poolbar.health'),
    mana:   root.querySelector('.poolbar.mana'),
    stamina:root.querySelector('.poolbar.stamina'),
  };

  // Essence bar elements (uses softCap as max)
  const essBar  = root.querySelector('.essbar');
  const essBase = essBar.querySelector('.ess-base');
  const essPlan = essBar.querySelector('.ess-plan');
  const essMax  = Number(essBar.dataset.max || softCap || 0);

  /** ======== STATE ======== */
  const baseline = {
    essence: getEssNow(),
    pools: {
      health: { cur: Number(poolsEls.health.dataset.cur||0), max: Number(poolsEls.health.dataset.max||0) },
      mana:   { cur: Number(poolsEls.mana.dataset.cur||0),   max: Number(poolsEls.mana.dataset.max||0) },
      stamina:{ cur: Number(poolsEls.stamina.dataset.cur||0),max: Number(poolsEls.stamina.dataset.max||0) },
    }
  };
  const working = JSON.parse(JSON.stringify(baseline));
  /** list of {to:'health'|'mana'|'stamina', amount:number} */
  let pendingActions = [];

  // Paint functions from working state
  function paintPools(){
    for (const k of Object.keys(poolsEls)){
      const el = poolsEls[k];
      const cur = working.pools[k].cur, max = working.pools[k].max;
      const pct = max ? (cur/max)*100 : 0;
      el.dataset.cur = String(cur);
      el.querySelector('.poolbar__fill.base').style.width = `${clamp(pct,0,100)}%`;
      el.querySelector('.poolbar__fill.plan').style.width = '0%';
      el.querySelector('.poolbar__val').innerHTML = `£${fmt(cur)} / £${fmt(max)} <b>(${max?Math.round((cur/max)*100):0}%)</b>`;
    }
  }
  function paintEssenceBars(){
    const essNow = working.essence;
    const remPct = essMax ? (essNow / essMax) * 100 : 0;
    essBase.style.width = `${clamp(remPct,0,100)}%`;
    essPlan.style.left  = `${clamp(remPct,0,100)}%`;
    essPlan.style.width = `0%`;
    // 1) header summary number
    if (headEssEl) headEssEl.textContent = fmt(essNow);
    // 2) the Essence bar’s own value label
    const essVal = essBar.querySelector('.poolbar__hdr .poolbar__val');
    if (essVal){
      const pctText = Math.round(clamp(remPct, 0, 100));
      essVal.innerHTML = `£${fmt(essNow)} <b>(${pctText}%)</b>`;
    }

    // Keep Charge Essence Value text
    const chargeEss = wrap.querySelector('[data-panel="charge"] .cs-ess');
    if (chargeEss) chargeEss.textContent = fmt(essNow);
  }
  function clearPlanPreview(){
    root.querySelectorAll('.poolbar__fill.plan').forEach(p => p.style.width = '0%');
    fill.style.width = '0%';
    amtEl.textContent = '0';
    // reset essence plan slice to 0 (keep base at working)
    const remPct = essMax ? (working.essence / essMax) * 100 : 0;
    essBase.style.width = `${clamp(remPct,0,100)}%`;
    essPlan.style.left  = `${clamp(remPct,0,100)}%`;
    essPlan.style.width = `0%`;
  }

  // Initial paints
  paintPools();
  paintEssenceBars();

  /** ======== PREVIEW ======== */
  function previewPlan(targetKey, amount){
    const essNow = working.essence;
    const el = poolsEls[targetKey];
    const cur = working.pools[targetKey].cur, max = working.pools[targetKey].max;

    // clamp against both essence and pool capacity
    const need = Math.max(0, max - cur);
    const planned = clamp(amount, 0, Math.min(essNow, need));

    // Planned overlay: pool
    root.querySelectorAll('.poolbar__fill.plan').forEach(p => p.style.width = '0%');
    const basePct = max ? (cur / max) * 100 : 0;
    const newPct  = max ? ((cur + planned) / max) * 100 : 0;
    el.querySelector('.poolbar__fill.base').style.width  = `${clamp(basePct,0,100)}%`;
    el.querySelector('.poolbar__fill.plan').style.width  = `${clamp(newPct,0,100)}%`;

    // Meter (relative to available essence)
    const pctMeter = essNow ? (planned / essNow) * 100 : 0;
    fill.style.width = `${pctMeter.toFixed(2)}%`;
    amtEl.textContent = fmt(planned, 2);

    // Essence plan slice (striped)
    const curPct = essMax ? (essNow / essMax) * 100 : 0;
    const remPct = essMax ? ((essNow - planned) / essMax) * 100 : 0;
    const slice  = clamp(curPct - remPct, 0, 100);
    essBase.style.width = `${clamp(remPct,0,100)}%`;
    essPlan.style.left  = `${clamp(remPct,0,100)}%`;
    essPlan.style.width = `${slice}%`;

    return planned; // return clamped amount (for auto-stop)
  }

  /** ======== APPLY TO WORKING (TEMP, no Firestore) ======== */
  function applyTransferToWorking(targetKey, amount){
    const planned = previewPlan(targetKey, amount); // ensures clamped value
    if (planned <= 0) { clearPlanPreview(); return 0; }

    working.essence = clamp(working.essence - planned, 0, 9e12);
    working.pools[targetKey].cur = clamp(
      working.pools[targetKey].cur + planned, 0, working.pools[targetKey].max
    );

    // reflect working state on UI
    paintPools();
    paintEssenceBars();
    fill.classList.add('flash'); setTimeout(()=>fill.classList.remove('flash'), 200);
    clearPlanPreview();

    // enqueue action
    pendingActions.push({ to: targetKey, amount: Number(planned.toFixed(2)) });
    return planned;
  }

  // Target selection
  let target = 'health';
  targetBtns.forEach(b=>b.addEventListener('click', ()=>{
    targetBtns.forEach(x=>x.classList.toggle('is-active', x===b));
    target = b.dataset.target; tgtEl.textContent = uc(target);
    setTargetTheme(target);
    clearPlanPreview();
  }));
  setTargetTheme(target); // on load

  // Hold-to-preview then confirm (auto-stop if capped or empty)
  let raf=null,start=0,running=false, planned=0;
  const MAX_RATE_PER_SEC = Math.max(1, working.essence/6);

  const step=(t)=>{
    if (!running) return;
    if (!start) start = t;
    const dt = (t - start)/1000;

    // compute proposed amount and clamp by preview (returns clamped)
    const rawPlanned = dt * MAX_RATE_PER_SEC;
    const clamped = previewPlan(target, rawPlanned);
    planned = clamped;

    // Auto-stop if we hit a limit (no essence or capped)
    const atEssenceEmpty = working.essence <= 0;
    const atCap = clamped < rawPlanned - 1e-6; // preview had to clamp (hit cap/essence)
    if (atEssenceEmpty || atCap) {
      endHold();
      return;
    }
    raf = requestAnimationFrame(step);
  };

  function endHold(){
    running=false; cancelAnimationFrame(raf); start=0;
    openConfirmTransmute(target, planned);
    planned=0;
  }

  btnHold.addEventListener('pointerdown',(e)=>{ e.preventDefault(); if(running) return; running=true; btnHold.classList.add('is-armed'); raf=requestAnimationFrame(step); }, {passive:false});
  const stop=()=>{ if(!running) return; btnHold.classList.remove('is-armed'); endHold(); };
  ['pointerup','pointercancel','pointerleave','keyup','blur'].forEach(ev=>{ (ev==='keyup'?window:btnHold).addEventListener(ev, stop); });

  // Quick actions (apply immediately to working)
  const btnFullSel = root.querySelector('.quick.full-selected');
  const btnFullAll = root.querySelector('.quick.full-all');

  btnFullSel.addEventListener('click', ()=>{
    const need = Math.max(0, working.pools[target].max - working.pools[target].cur);
    const use  = Math.min(working.essence, need);
    if (use>0) applyTransferToWorking(target, use);
  });

  btnFullAll.addEventListener('click', ()=>{
    const order = ['health','mana','stamina'];
    for (const k of order){
      if (working.essence <= 0) break;
      const need = Math.max(0, working.pools[k].max - working.pools[k].cur);
      const use  = Math.min(working.essence, need);
      if (use>0) applyTransferToWorking(k, use);
    }
  });

  /** ======== Inline confirm modal ======== */
  function openConfirmTransmute(targetKey, initial){
    const host = root.closest('.summary-card') || root.closest('.spirit-card') || document.body;
    const shell = document.createElement('div');
    shell.className = 'inline-confirm';
    shell.innerHTML = `
      <div class="inline-card">
        <div class="inline-hd"><b>Confirm Transmute</b></div>
        <div class="inline-body">
          <p>Transfer to <b>${uc(targetKey)}</b></p>
          <label>Amount (£)
            <input class="confirm-input" type="number" min="0.01" step="0.01" value="${Number(initial||0).toFixed(2)}" />
          </label>
        </div>
        <div class="inline-actions">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-confirm">Confirm</button>
        </div>
      </div>
    `;
    host.appendChild(shell);

    const close = ()=> shell.remove();
    shell.addEventListener('click', e => { if (e.target === shell) close(); });
    shell.querySelector('.btn-cancel').addEventListener('click', ()=>{
      // Cancel: revert preview only (no working change)
      clearPlanPreview();
      close();
    });
    shell.querySelector('.btn-confirm').addEventListener('click', ()=>{
      const n = Number(shell.querySelector('.confirm-input').value||0);
      close();
      if (Number.isFinite(n) && n>0) {
        applyTransferToWorking(targetKey, n);
      } else {
        clearPlanPreview();
      }
    });
  }

  /** ======== Footer actions ======== */
  // Shared footer → RESET (only when Transmute is active)
  root.addEventListener('spirit:footer:reset', (e) => {
  if (e.detail.main !== 'transmute') return;

  // restore working from baseline & repaint (unchanged logic)
  working.essence = baseline.essence;
  for (const k of Object.keys(baseline.pools)){
    working.pools[k].cur = baseline.pools[k].cur;
    working.pools[k].max = baseline.pools[k].max;
  }
  pendingActions = [];
  paintPools();
  paintEssenceBars();
  clearPlanPreview();
});

  // Shared footer → CONFIRM (only when Transmute is active)
  root.addEventListener('spirit:footer:confirm', async (e) => {
    if (e.detail.main !== 'transmute') return;
    if (pendingActions.length === 0) return;

    // Build summary BEFORE clearing (unchanged)
    const sum = pendingActions.reduce((acc, a)=>{
      acc.total = Number((acc.total + a.amount).toFixed(2));
      acc[a.to] = Number(((acc[a.to]||0) + a.amount).toFixed(2));
      return acc;
    }, { total:0 });

    try{
      const uid = getAuth().currentUser?.uid;
      if (uid){
        const db = getFirestore();
        await writeTransmuteTxBundle(db, uid, pendingActions, txBucket);
      }
    }catch(e){
      console.warn('Transmute commit failed:', e);
      return; // Do not advance baseline on failure
    }

    window.dispatchEvent(new CustomEvent('spirit:transmutes:commit', {
      detail: { actions: pendingActions.slice(), newEssence: working.essence, bucket: txBucket }
    }));

    // Baseline <= working; clear queue
    baseline.essence = working.essence;
    for (const k of Object.keys(baseline.pools)){
      baseline.pools[k].cur = working.pools[k].cur;
      baseline.pools[k].max = working.pools[k].max;
    }
    pendingActions = [];
    clearPlanPreview();

    try { await refreshVitalsHUD(getAuth().currentUser.uid); } catch {}

    const parts = ['health','mana','stamina']
      .filter(k => sum[k] > 0.009)
      .map(k => `${uc(k)} £${fmt(sum[k],2)}`)
      .join(' • ');
    const msg = parts ? `Transmuted £${fmt(sum.total,2)} Essence → ${parts}` : `Transmuted £${fmt(sum.total,2)} Essence`;
    showSpiritToast(msg);
  });


  // Initial preview clear
  clearPlanPreview();
}

/** =========================================================
 *  Spend Controls
 *  =======================================================*/

function wireSpendControls(root, { essence }) {
  const spend = root.querySelector('[data-panel="spend"]');
  if (!spend) return;

  const headEss = root.closest('.spirit-card')?.querySelector('.summary-row .js-ess');
  const getEss = () => Number(String(headEss?.textContent || '').replace(/[,£]/g,'')) || Number(essence) || 0;

  // RESET by sub-tab
  root.addEventListener('spirit:footer:reset', (e) => {
    if (e.detail.main !== 'spend') return;
    const key = e.detail.sub;

    if (key === 'charge') {
      const wrap = spend.querySelector('[data-spanel="charge"]');
      const fill = wrap?.querySelector('.charge-fill');
      if (fill) fill.style.width = '0%';
      const amtEl = wrap?.querySelector('.cs-amt'); if (amtEl) amtEl.textContent = '0';
    }

    if (key === 'shards') {
      const inp = spend.querySelector('.qty-input');
      if (inp) {
        inp.value = '1';
        inp.dispatchEvent(new Event('input', { bubbles:true }));
      }
    }

    if (key === 'contrib') {
      const inp = spend.querySelector('.contrib-amt');
      if (inp) inp.value = '';
    }
  });

  // CONFIRM by sub-tab → “Coming soon” + dispatch checkout envelope
  root.addEventListener('spirit:footer:confirm', (e) => {
    if (e.detail.main !== 'spend') return;
    const key = e.detail.sub;

    try { showSpiritToast('Coming soon…'); } catch {}

    setTimeout(() => {
      if (key === 'charge') {
        const wrap = spend.querySelector('[data-spanel="charge"]');
        const rawAmt = Number(String(wrap?.querySelector('.cs-amt')?.textContent || '0').replace(/[,£]/g,''));
        const amount = Number((rawAmt || 0).toFixed(2));
        if (amount > 0.009) {
          const mode = wrap?.querySelector('.overcap-mode')?.value || 'overcharge';
          window.dispatchEvent(new CustomEvent('spirit:checkout', {
            detail: { kind: 'charge', amountGBP: amount, options: { overcap: mode } }
          }));
        }
      }

      if (key === 'shards') {
        const inp = spend.querySelector('.qty-input');
        const q = clamp(Number(inp?.value || 1), 1, 9999);
        const UNIT_PRICE = 5.00;
        const total = Number((q * UNIT_PRICE).toFixed(2));
        if (total > 0.009) {
          window.dispatchEvent(new CustomEvent('spirit:checkout', {
            detail: { kind: 'shards', amountGBP: total, options: { quantity: q, unitPrice: UNIT_PRICE } }
          }));
        }
      }

      if (key === 'contrib') {
        const inp = spend.querySelector('.contrib-amt');
        let n = Number(inp?.value || 0);
        if (!Number.isFinite(n) || n <= 0) return;
        n = Math.min(n, getEss());
        const amount = Number(n.toFixed(2));
        if (amount > 0.009) {
          window.dispatchEvent(new CustomEvent('spirit:checkout', {
            detail: { kind: 'contribution', amountGBP: amount, options: {} }
          }));
        }
      }
    }, 220);
  });
}


/** =========================================================
 *  CHARGE: Hold + Overcap handling + Stripe hook
 *  =======================================================*/
function panelCharge(essence, chargePct){
  const capLeftPct = clamp(1 - (chargePct||0), 0, 1);
  return `
    <div class="panel-wrap">
      <p class="panel-note">Channel Essence to attune your Spirit Stone.</p>

      <div class="opt-row">
        <label class="toggle">
          Overflow:
          <select class="overcap-mode">
            <option value="overcharge">Overcharge</option>
            <option value="convert_to_shards">Generate Soul Shards</option>
          </select>
        </label>
      </div>

      <div class="charge-meter">
        <div class="charge-bar"><div class="charge-fill" style="width:0%"></div></div>
        <div class="charge-stats">
          <span class="cs-left">Planned: £<span class="cs-amt">0</span></span>
          <span class="cs-right">Essence: £<span class="cs-ess">${fmt(essence)}</span></span>
        </div>
      </div>

      <button class="charge-hold" aria-label="Hold to channel">Hold to Channel</button>
      <div class="charge-hint">Cap remaining ~ ${(capLeftPct*100|0)}%. Additional essence follow your overflow setting.</div>
    </div>
  `;
}

function wireChargePanel(root, { essence }){
  const btn = root.querySelector('.charge-hold');
  const overSel = root.querySelector('.overcap-mode');
  const fill = root.querySelector('[data-panel="charge"] .charge-fill') || root.querySelector('.charge-fill');
  const amtEl = root.querySelector('[data-panel="charge"] .cs-amt') || root.querySelector('.cs-amt');
  const essEl = root.querySelector('[data-panel="charge"] .cs-ess') || root.querySelector('.cs-ess');
  const headEss = root.closest('.spirit-card')?.querySelector('.summary-row .js-ess');

  let raf=null,start=0,running=false, planned=0;
  const MAX_RATE_PER_SEC = Math.max(1, (Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence)/6);

  const step=(t)=>{
    if (!running) return;
    if (!start) start = t;
    const dt = (t - start)/1000;
    const ess = Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence;
    planned = clamp(dt * MAX_RATE_PER_SEC, 0, ess);
    const pct = ess ? (planned / ess) * 100 : 0;
    fill.style.width = `${pct.toFixed(2)}%`;
    amtEl.textContent = fmt(planned, 2);
    raf = requestAnimationFrame(step);
  };

  const commit=()=>{
    running=false; cancelAnimationFrame(raf); btn.classList.remove('is-armed'); start=0;
    if (planned <= 0.01) { fill.style.width='0%'; amtEl.textContent='0'; return; }

    const amount = Number(planned.toFixed(2));
    const mode = overSel.value;

    // Legacy event
    window.dispatchEvent(new CustomEvent('spirit:charge', { detail: { amount, source:'essence', intent:'spirit_charge', overcap: mode } }));

    // Stripe-ready envelope
    window.dispatchEvent(new CustomEvent('spirit:checkout', {
      detail: { kind: 'charge', amountGBP: amount, options: { overcap: mode } }
    }));

    const ess = Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence;
    const nextEss = clamp(ess - amount, 0, 9e12);
    essEl.textContent = fmt(nextEss); if (headEss) headEss.textContent = fmt(nextEss);

    fill.classList.add('flash'); setTimeout(()=>fill.classList.remove('flash'), 300);
    planned=0; amtEl.textContent='0'; fill.style.width='0%';
  };

  btn.addEventListener('pointerdown',(e)=>{ e.preventDefault(); if(running) return; running=true; btn.classList.add('is-armed'); raf=requestAnimationFrame(step); }, {passive:false});
  const stop=()=>{ if(!running) return; commit(); };
  ['pointerup','pointercancel','pointerleave','keyup','blur'].forEach(ev=>{ (ev==='keyup'?window:btn).addEventListener(ev, stop); });
}

/** =========================================================
 *  SHARDS: Purchase flow + Essence cap + Stripe hook
 *  =======================================================*/
function panelShards(essence, shards, tier){
  return `
    <div class="panel-wrap">
      <p class="panel-note">Transform Essence into Soul Shards to progress avatars and cosmetics.</p>

      <div class="shards-row">
        <div class="qty">
          <button class="qty-dec" aria-label="Decrease">–</button>
          <input class="qty-input" type="number" min="1" value="1">
          <button class="qty-inc" aria-label="Increase">+</button>
        </div>
        <div class="cost">Cost: £<span class="cost-val">5.00</span></div>
      </div>

      <div class="hint-mini">Capped by available Essence.</div>
      <button class="btn-buy-shards">Forge Shards</button>
    </div>
  `;
}

function wireShardsPanel(root, { essence }){
  const input = root.querySelector('.qty-input');
  const dec   = root.querySelector('.qty-dec');
  const inc   = root.querySelector('.qty-inc');
  const costEl= root.querySelector('.cost-val');
  const buy   = root.querySelector('.btn-buy-shards');
  const headEss = root.closest('.spirit-card')?.querySelector('.summary-row .js-ess');

  const UNIT_PRICE = 5.00;

  function recalc(){
    const q = clamp(Number(input.value||1), 1, 9999);
    const ess = Number((headEss?.textContent || '').replace(/[,£]/g,'')) || essence;
    const maxQtyByEssence = Math.max(0, Math.floor( (ess + 1e-9) / UNIT_PRICE ));
    const finalQ = clamp(q, 1, Math.max(1, maxQtyByEssence));
    input.value = String(finalQ);
    costEl.textContent = fmt(finalQ * UNIT_PRICE, 2);
  }

  dec.addEventListener('click', ()=>{ input.value = String(Math.max(1, Number(input.value||1)-1)); recalc(); });
  inc.addEventListener('click', ()=>{ input.value = String(Number(input.value||1)+1); recalc(); });
  input.addEventListener('input', recalc);

  buy.addEventListener('click', ()=>{
    const q = clamp(Number(input.value||1), 1, 9999);
    const ess = Number((headEss?.textContent || '').replace(/[,£]/g,'')) || essence;
    const total = Number((q * UNIT_PRICE).toFixed(2));
    if (total > ess) { recalc(); return; }

    // Legacy event
    window.dispatchEvent(new CustomEvent('spirit:buyShards', { detail: { quantity: q, amount: total, currency: 'GBP', source:'essence' } }));
    // Stripe-ready envelope
    window.dispatchEvent(new CustomEvent('spirit:checkout', { detail: { kind: 'shards', amountGBP: total, options: { quantity: q, unitPrice: UNIT_PRICE } } }));

    const nextEss = clamp(ess - total, 0, 9e12);
    if (headEss) headEss.textContent = fmt(nextEss);
    buy.classList.add('flash'); setTimeout(()=>buy.classList.remove('flash'), 300);
    recalc();
  });

  recalc();
}

/** =========================================================
 *  CONTRIBUTE: gift Essence → Altruism + Stripe hook
 *  =======================================================*/
function panelContrib(essence){
  return `
    <div class="panel-wrap">
      <p class="panel-note">Gift Essence to the community and raise your Altruism.</p>

      <div class="exact-row">
        <label>Amount (£)
          <input class="contrib-amt" type="number" min="1" step="0.01" placeholder="e.g. 10">
        </label>
        <button class="btn-contrib-stripe">Contribute</button>
      </div>

      <div class="hint-mini">Capped by available Essence. May grant additional bonuses based on Spririt Stone tier.</div>
    </div>
  `;
}

function wireContribPanel(root, { essence }){
  const amtInp = root.querySelector('.contrib-amt');
  const btn    = root.querySelector('.btn-contrib-stripe');
  const headEss= root.closest('.spirit-card')?.querySelector('.summary-row .js-ess');

  btn.addEventListener('click', ()=>{
    const ess = Number((headEss?.textContent || '').replace(/[,£]/g,'')) || essence;
    let n = Number(amtInp.value||0);
    if (!Number.isFinite(n) || n <= 0) return;
    n = Math.min(n, ess);

    window.dispatchEvent(new CustomEvent('spirit:checkout', {
      detail: { kind: 'contribution', amountGBP: Number(n.toFixed(2)), options: {} }
    }));
  });
}

/** ---------- Fallback modal ---------- */
function attachFallbackOverlay(node){
  const overlay = document.createElement('div'); overlay.className = 'summary-overlay is-open';
  const card = document.createElement('div'); card.className = 'summary-card';
  card.innerHTML = `<div class="summary-card__hd"><h3>Spirit Stone</h3><button class="summary-close" aria-label="Close">✕</button></div>`;
  card.appendChild(node); overlay.appendChild(card); document.body.appendChild(overlay); overlay.style.display = 'grid';
  overlay.querySelector('.summary-close').addEventListener('click', ()=>overlay.remove());
}

/** ---------- CSS (scoped) ---------- */
(function injectCss(){
  if (document.getElementById('spirit-stone-css')) return;
  const css = `
  .spirit-card{ display:grid; gap:10px; width:min(560px, 92vw); }
  .spirit-summary{ display:grid; grid-template-columns: 120px 1fr; gap:12px; padding:10px; border:1px solid rgba(255,255,255,.10); border-radius:14px; background: rgba(255,255,255,.04); }
  .stone-wrap{ display:grid; justify-items:center; align-content:center; }
  .stone-core{ position:relative; width:96px; height:96px; border-radius:999px; background: radial-gradient(circle at 50% 50%, rgba(168,85,247,.55), rgba(155,93,229,.25) 60%, transparent 62%); box-shadow: 0 0 20px rgba(155,93,229,.35), inset 0 0 8px rgba(255,255,255,.08); }
  .stone-glow{ position:absolute; inset:-8px; border-radius:999px; box-shadow: 0 0 22px rgba(155,93,229,.45), inset 0 0 10px rgba(255,255,255,.06); pointer-events:none; }
  .stone-core .ring{ position:absolute; inset:0; border-radius:999px; border:2px solid rgba(255,255,255,.08); transform: scale(calc(1 - (var(--i) * 0.08))); }
  .stone-core .ring-on{ border-color: rgba(240,220,160,.85); box-shadow: 0 0 8px rgba(240,220,160,.35); }
  .stone-core .ring-partial{ border-color: rgba(240,220,160,.55); box-shadow: 0 0 6px rgba(240,220,160,.22), inset 0 0 6px rgba(240,220,160,.1); }
  .stone-label{ position:absolute; left:50%; top:50%; transform: translate(-50%,-50%); text-align:center; font-weight:800; font-family:'Cinzel', serif; color:#f0e6d2; }

  .summary-rows { display:grid; gap:6px; align-content:start; }
  .summary-caption{ font-weight:800; letter-spacing:.2px; color:#f0e6d2; margin-bottom:2px; opacity:.95; }
  .summary-row{ display:grid; grid-template-columns: 1fr auto; gap:8px; padding:8px 10px; border-radius:10px; background: rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); }
  .summary-row__label{ opacity:.9; }
  .summary-row__value{ font-variant-numeric: tabular-nums; }
  .summary-row .js-ess, .summary-row .js-shards { font-weight:700; }

  /* MAIN TABS */
  .spirit-tabs{ display:grid; grid-auto-flow:column; gap:6px; }
  .spirit-tab{ padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color:#f0e6d2; cursor:pointer; }
  .spirit-tab.is-active{ background: rgba(155,93,229,.16); box-shadow: 0 0 10px rgba(155,93,229,.28); }

  .spirit-panels{ position:relative; }
  .spirit-panel{ display:none; }
  .spirit-panel.is-active{ display:block; }
  .panel-wrap{ display:grid; gap:10px; padding:10px; border:1px solid rgba(255,255,255,.10); border-radius:14px; background: rgba(255,255,255,.04); }
  .panel-note, .charge-hint, .rebalance-hint, .shards-hint, .hint-mini{ opacity:.85; font-size:.95rem; margin:0; }
  .hint-mini{ font-size:.9rem; }

  /* SUB-TABS (Spend) */
  .spend-tabs{ display:grid; grid-auto-flow:column; gap:6px; margin-bottom:6px; }
  .spend-tab{ padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color:#f0e6d2; cursor:pointer; }
  .spend-tab.is-active{ background: rgba(240,220,160,.16); box-shadow: 0 0 10px rgba(240,220,160,.28); }
  .spend-panels{ position:relative; }
  .spend-panel{ display:none; }
  .spend-panel.is-active{ display:block; }

  .opt-row { display:flex; gap:10px; align-items:center; }
  .opt-row select{ padding:6px 8px; border-radius:8px; background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); color:#f0e6d2; }

  .charge-meter{ display:grid; gap:6px; }
  .charge-bar{ height:14px; border-radius:999px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); overflow:hidden; }
  .charge-fill{ height:100%; width:0%; background: linear-gradient(90deg, rgba(155,93,229,.6), rgba(240,220,160,.8)); transition: width .12s ease; }
  .charge-fill.plan{ background: repeating-linear-gradient(45deg, rgba(240,220,160,.25), rgba(240,220,160,.25) 8px, rgba(155,93,229,.25) 8px, rgba(155,93,229,.25) 16px); }
  .charge-fill.flash{ animation: chargeFlash .35s ease; }
  @keyframes chargeFlash { 0%{filter:brightness(1)} 50%{filter:brightness(1.6)} 100%{filter:brightness(1)} }
  .charge-stats{ display:flex; align-items:center; justify-content:space-between; font-variant-numeric:tabular-nums; }
  .charge-hold, .transmute-hold, .btn-buy-shards, .btn-contrib-stripe, .quick { padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color:#f0e6d2; font-weight:700; cursor:pointer; }
  .charge-hold.is-armed, .transmute-hold.is-armed{ box-shadow: 0 0 10px rgba(240,220,160,.35), inset 0 0 8px rgba(240,220,160,.2); }

  .pools-grid{ display:grid; gap:8px; }
  .poolbar__hdr{ display:flex; justify-content:space-between; align-items:center; font-size:.95rem; }
  .poolbar__track{ position:relative; height:14px; border-radius:10px; background: rgba(255,255,255,.06); overflow:hidden; border:1px solid rgba(255,255,255,.12); }
  .poolbar__fill{ position:absolute; left:0; top:0; height:100%; transition: width .12s ease; }
  .poolbar__fill.base{ background: var(--pool-base, rgba(255,255,255,.25)); }
  .poolbar__fill.plan{ background: var(--pool-plan, repeating-linear-gradient(45deg, rgba(255,255,255,.25), rgba(255,255,255,.25) 8px, rgba(255,255,255,.12) 8px, rgba(255,255,255,.12) 16px)); }
  .poolbar.health { --pool-base: rgba(220, 83, 100,.7); --pool-plan: repeating-linear-gradient(45deg, rgba(220,83,100,.35), rgba(220,83,100,.35) 8px, rgba(220,83,100,.20) 8px, rgba(220,83,100,.20) 16px); }
  .poolbar.mana   { --pool-base: rgba(75, 125, 220,.7); --pool-plan: repeating-linear-gradient(45deg, rgba(75,125,220,.35), rgba(75,125,220,.35) 8px, rgba(75,125,220,.20) 8px, rgba(75,125,220,.20) 16px); }
  .poolbar.stamina{ --pool-base: rgba(120, 200, 120,.7); --pool-plan: repeating-linear-gradient(45deg, rgba(120,200,120,.35), rgba(120,200,120,.35) 8px, rgba(120,200,120,.20) 8px, rgba(120,200,120,.20) 16px); }

  .essbar .ess-base{ background: rgba(155,93,229,.55); z-index: 1; }
  .essbar .ess-plan{
    background: repeating-linear-gradient(45deg, rgba(155,93,229,.35), rgba(155,93,229,.35) 8px, rgba(240,220,160,.25) 8px, rgba(240,220,160,.25) 16px);
    z-index: 2;
  }

  .inline-confirm{
    position: fixed; inset: 0; display: grid; place-items: center;
    background: rgba(0,0,0,.35); z-index: 9999;
  }
  .inline-card{
    width: min(380px, 92vw); border-radius: 14px;
    background: rgba(20,20,35,.9);
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: 0 10px 30px rgba(0,0,0,.4);
    display: grid; gap: 10px; padding: 12px;
  }
  .inline-hd{ font-weight: 800; }
  .inline-body{ display: grid; gap: 8px; }
  .inline-body input{
    width: 160px; padding: 8px; border-radius: 10px;
    border:1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.06); color:#f0e6d2; text-align: right;
  }
  .inline-actions{ display:flex; gap:8px; justify-content:flex-end; }
  .inline-actions .btn-cancel, .inline-actions .btn-confirm{
    padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.06); color:#f0e6d2; font-weight:700; cursor:pointer;
  }

  .target-pools{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .tgt-label{ opacity:.85; margin-right:4px; }
  .pool-btn.pill{ border-radius:999px; padding:6px 12px; border:1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); }
  .pool-btn.pill.health{ color:rgb(150,40,55); }
  .pool-btn.pill.mana{   color:rgb(46,78,155); }
  .pool-btn.pill.stamina{color:rgb(40,110,60); }
  .pool-btn.pill.health.is-active { background: rgba(220, 83,100,.25); box-shadow: 0 0 8px rgba(220,83,100,.35); }
  .pool-btn.pill.mana.is-active   { background: rgba(75,125,220,.25);  box-shadow: 0 0 8px rgba(75,125,220,.35); }
  .pool-btn.pill.stamina.is-active{ background: rgba(120,200,120,.25); box-shadow: 0 0 8px rgba(120,200,120,.35); }

  .charge-stats.centered{ justify-content:center; }
  .plan-label{ font-weight:800; }
  .plan-label.health{ color: rgb(220,83,100); }
  .plan-label.mana{   color: rgb(75,125,220); }
  .plan-label.stamina{color: rgb(120,200,120); }

  .quick-row{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
  .quick-row .quick{ width:100%; }
  .tgt-health .quick.full-selected{ box-shadow:0 0 12px rgba(220,83,100,.35); border-color: rgba(220,83,100,.35); }
  .tgt-mana   .quick.full-selected{ box-shadow:0 0 12px rgba(75,125,220,.35);  border-color: rgba(75,125,220,.35); }
  .tgt-stamina .quick.full-selected{ box-shadow:0 0 12px rgba(120,200,120,.35); border-color: rgba(120,200,120,.35); }

  .transmute-hold{
    padding:14px 16px;
    background: rgba(155,93,229,.18);
    border-color: rgba(155,93,229,.35);
  }
  .transmute-hold.is-armed{ box-shadow: 0 0 12px rgba(155,93,229,.45), inset 0 0 8px rgba(155,93,229,.25); }

  /* Global footer spacing */
  .global-footer{ 
    margin-top:6px; 
    margin-bottom:12px;      /* <-- NEW: visible gap below the buttons */
  }
  .footer-actions{
    display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:2px;
  }
  .footer-actions .btn-reset,
  .footer-actions .btn-confirm{
    padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.06); color:#f0e6d2; font-weight:700; cursor:pointer;
  }
  .footer-actions .btn-confirm{ background: rgba(155,93,229,.18); border-color: rgba(155,93,229,.35); }

  /* Optional: tiny bottom padding so content never kisses container edge */
  .spirit-card{ padding-bottom:8px; }  /* safe in modal or embedded */

  .shards-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .qty{ display:grid; grid-template-columns: 34px 80px 34px; gap:6px; }
  .qty button{ padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color:#f0e6d2; font-weight:700; cursor:pointer; }
  .qty-input{ text-align:center; padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color:#f0e6d2; }

  /* === Contribute (Spend → Contribute) exact amount row === */
  .spirit-card .exact-row{
    display:flex;                 /* override any old display:none */
    gap:10px;
    align-items:center;
    flex-wrap:wrap;
  }

  .spirit-card .exact-row label{
    display:flex;
    align-items:center;
    gap:8px;
    margin:0;
    white-space:nowrap;
    font-size:.95rem;
    opacity:.95;
  }

  .spirit-card .exact-row .contrib-amt{
    width:160px;                  /* tidy, not full-width */
    padding:8px 10px;
    border-radius:10px;
    border:1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.06);
    color:#f0e6d2;
    text-align:right;
    font-variant-numeric: tabular-nums;
  }

  /* remove number spinners for a cleaner look */
  .spirit-card .exact-row .contrib-amt::-webkit-outer-spin-button,
  .spirit-card .exact-row .contrib-amt::-webkit-inner-spin-button{
    -webkit-appearance: none;
    margin: 0;
  }
  .spirit-card .exact-row .contrib-amt{
    -moz-appearance:textfield;
  }

  .spirit-card .btn-contrib-stripe{
    white-space:nowrap;
    height:36px;                  /* match input height visually */
    display:inline-flex;
    align-items:center;
  }
 
  /* === NEW: Toast (fantasy glow + sparkles) === */
  .spirit-toast{
    position: fixed; left:50%; bottom: 24px; transform: translateX(-50%);
    z-index: 99999; pointer-events:none;
    animation: toastIn .25s ease-out;
  }
  .spirit-toast.leaving{ animation: toastOut .4s ease-in forwards; }
  .toast-stone{
    position:relative; min-width: 280px; max-width: 86vw;
    display:grid; place-items:center;
    padding: 10px 14px; border-radius: 14px;
    background: radial-gradient(circle at 50% 0%, rgba(155,93,229,.18), rgba(20,20,35,.92));
    border:1px solid rgba(240,220,160,.35);
    box-shadow: 0 6px 24px rgba(0,0,0,.45), inset 0 0 10px rgba(240,220,160,.12);
    overflow:hidden;
  }
  .toast-msg{ color:#f0e6d2; font-weight:800; text-align:center; }
  .toast-stone .glow{
    position:absolute; inset:-20px; border-radius:18px; filter: blur(10px);
    background: radial-gradient(circle at 50% 50%, rgba(240,220,160,.12), transparent 60%);
    animation: glowPulse 1.8s ease-in-out infinite;
  }
  .spark{
    position:absolute; width:6px; height:6px; border-radius:999px; background: rgba(240,220,160,.9);
    filter: drop-shadow(0 0 6px rgba(240,220,160,.8));
    animation: sparkle 1.2s linear infinite;
  }
  .spark.s1{ left: 14%; top: 60%; animation-delay: .0s; }
  .spark.s2{ left: 50%; top: 70%; animation-delay: .2s; }
  .spark.s3{ left: 82%; top: 58%; animation-delay: .4s; }
  @keyframes sparkle{
    0%{ transform: translateY(0) scale(1); opacity:.9; }
    70%{ transform: translateY(-16px) scale(1.2); opacity:.6; }
    100%{ transform: translateY(-26px) scale(.8); opacity:0; }
  }
  @keyframes glowPulse{
    0%,100%{ opacity:.35; } 50%{ opacity:.6; }
  }
  @keyframes toastIn{ from{ transform: translate(-50%, 10px); opacity:0; } to{ transform: translate(-50%, 0); opacity:1; } }
  @keyframes toastOut{ to{ transform: translate(-50%, 6px); opacity:0; } }
  `;
  const tag = document.createElement('style'); tag.id = 'spirit-stone-css'; tag.textContent = css; document.head.appendChild(tag);
})();
