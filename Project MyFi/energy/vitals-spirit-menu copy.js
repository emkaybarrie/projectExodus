// vitals-spirit-menu.js
// Spirit Stone Menu (Transmute / Charge / Shards / Contribute)
// Frontend-only; emits CustomEvents for backend & Stripe integration.
// Depends on: energy-vitals.js (refreshVitals), optional window.MyFiModal

import { refreshVitals } from "./energy-vitals.js";

// Read-only wallet helpers
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/** ---------- Utils ---------- */
const fmt = (n, d=0) => new Intl.NumberFormat(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n||0));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const uc = s => s.charAt(0).toUpperCase() + s.slice(1);

async function readWallet(uid){
  try{
    const db = getFirestore();
    const snap = await getDoc(doc(db, `players/${uid}/wallet/main`));
    return snap.exists() ? (snap.data() || {}) : {};
  }catch{ return {}; }
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

  // Wallet (SoT for money balances)
  const essence = Number(wallet?.essence_free ?? pools?.essence?.current ?? 0);
  const shards  = Number(wallet?.shards ?? 0);
  const chargePct = clamp(Number(wallet?.charge?.pct ?? 0), 0, 1);
  const tier      = Number(wallet?.charge?.tier ?? 1);

  // Vitals pools (for bars)
  const v = {
    health: { cur: Number(pools?.health?.current || 0), max: Number(pools?.health?.max || 0) },
    mana:   { cur: Number(pools?.mana?.current   || 0), max: Number(pools?.mana?.max   || 0) },
    stamina:{ cur: Number(pools?.stamina?.current|| 0), max: Number(pools?.stamina?.max|| 0) },
  };

  // Essence soft cap for UI (matches vitals essence bar)
  const softCap = Number(gateway?.essenceUI?.softCap || pools?.essence?.max || 0);

  const root = document.createElement('div');
  root.className = 'spirit-card';
  root.innerHTML = `
    <div class="spirit-summary">
      ${renderStoneSummary(chargePct, tier)}
      ${renderSummaryRows({ essence, shards })}
    </div>

    <div class="spirit-tabs">
      <button class="spirit-tab is-active" data-tab="transmute">Transmute</button>
      <button class="spirit-tab" data-tab="charge">Charge</button>
      <button class="spirit-tab" data-tab="shards">Shards</button>
      <button class="spirit-tab" data-tab="contrib">Contribute</button>
    </div>

    <div class="spirit-panels">
      <section class="spirit-panel is-active" data-panel="transmute">${panelTransmute(essence, v, softCap)}</section>
      <section class="spirit-panel" data-panel="charge">${panelCharge(essence, chargePct)}</section>
      <section class="spirit-panel" data-panel="shards">${panelShards(essence, shards, tier)}</section>
      <section class="spirit-panel" data-panel="contrib">${panelContrib(essence)}</section>
    </div>
  `;

  wireTabs(root);
  wireTransmutePanel(root, { essence, v, softCap });
  wireChargePanel(root, { essence });
  wireShardsPanel(root, { essence, shards, tier });
  wireContribPanel(root, { essence });

  return { root };
}

/** ---------- Summary ---------- */
function renderStoneSummary(chargePct, tier){
  const tiers = 5;
  const litCount = Math.floor(chargePct * tiers);
  const frac = (chargePct * tiers) - litCount;

  // reverse: inner ring = highest index, so light from inner → outer
  const rings = Array.from({length: tiers}).map((_, i) => {
    const idx = i + 1;                 // 1..5 (1=outer, 5=inner due to scale)
    const innerIndex = tiers - idx + 1; // convert to inner-order rank (5..1)
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
      <div class="stone-caption">Spirit Stone • Tier ${tier}</div>
    </div>
  `;
}

function renderSummaryRows({ essence, shards }){
  return `
    <div class="summary-rows">
      <div class="summary-row"><div class="summary-row__label">Essence</div><div class="summary-row__value js-ess">${fmt(essence)}</div></div>
      <div class="summary-row"><div class="summary-row__label">Soul Shards</div><div class="summary-row__value js-shards">${fmt(shards)}</div></div>
    </div>
  `;
}

/** ---------- Tabs ---------- */
function wireTabs(root){
  const tabs = [...root.querySelectorAll('.spirit-tab')];
  const panels = [...root.querySelectorAll('.spirit-panel')];
  root.addEventListener('click', (e)=>{
    const t = e.target.closest('.spirit-tab'); if(!t) return;
    const key = t.dataset.tab;
    tabs.forEach(b => b.classList.toggle('is-active', b===t));
    panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel===key));
  });
}

/** =========================================================
 *  TRANSMUTE: Essence → Pools (hold→preview, confirm modal)
 *  =======================================================*/
function panelTransmute(essence, v, softCap){
  const pct = k => (v[k].max ? Math.round((v[k].cur / v[k].max)*100) : 0);
  return `
    <div class="panel-wrap">
      <p class="panel-note">Refill your pools using stored Essence.</p>

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
        <div class="charge-stats">
          <span class="cs-left">Planned: £<span class="cs-amt">0</span> → <b class="cs-target">Health</b></span>
          <span class="cs-right">Essence: £<span class="cs-ess">${fmt(essence)}</span></span>
        </div>
      </div>

      <div class="quick-row">
        <button class="quick full-selected">Fill Selected to Full</button>
        <button class="quick full-all">Fill All to Full</button>
      </div>

      <button class="transmute-hold" aria-label="Hold to transfer">Hold to Transfer</button>
      <div class="rebalance-hint">Pool bars show current (solid) and planned (striped). Essence bar shows current and planned deduction.</div>
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


function wireTransmutePanel(root, { essence, v, softCap }){
  const wrap = root.closest('.spirit-card') || root;

  const targetBtns = [...root.querySelectorAll('.pool-btn')];
  const fill  = root.querySelector('[data-panel="transmute"] .charge-fill.plan') || root.querySelector('.charge-fill.plan');
  const amtEl = root.querySelector('[data-panel="transmute"] .cs-amt') || root.querySelector('.cs-amt');
  const essEl = root.querySelector('[data-panel="transmute"] .cs-ess') || root.querySelector('.cs-ess');
  const tgtEl = root.querySelector('[data-panel="transmute"] .cs-target') || root.querySelector('.cs-target');
  const btnHold = root.querySelector('.transmute-hold');

  const headEssEl = wrap.querySelector('.summary-row .js-ess');
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

  // Paint base pool widths
  for (const k of Object.keys(poolsEls)){
    const el = poolsEls[k];
    const cur = Number(el.dataset.cur||0), max = Number(el.dataset.max||0);
    const pct = max ? (cur/max)*100 : 0;
    el.querySelector('.poolbar__fill.base').style.width = `${clamp(pct,0,100)}%`;
  }

  // Essence base = current/softCap
  const essNow0 = Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence || 0;
  const essPct0 = essMax ? (essNow0 / essMax) * 100 : 0;
  // essBase.style.width = `${clamp(essPct0,0,100)}%`;
  // essPlan.style.width = `${clamp(essPct0,0,100)}%`;
  essBase.style.width = `${clamp(essPct0,0,100)}%`;
  essPlan.style.left  = `${clamp(essPct0,0,100)}%`;
  essPlan.style.width = `0%`;

  function previewPlan(targetKey, amount){
    const essNow = Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence || 0;
    const planned = clamp(amount, 0, essNow);

    // Target pool preview
    const el = poolsEls[targetKey];
    const cur = Number(el.dataset.cur||0), max = Number(el.dataset.max||0);
    const toAdd = clamp(planned, 0, Math.max(0, max - cur));

    // Reset planned overlays
    root.querySelectorAll('.poolbar__fill.plan').forEach(p => p.style.width = '0%');

    // Paint pool planned
    const basePct = max ? (cur / max) * 100 : 0;
    const newPct  = max ? ((cur + toAdd) / max) * 100 : 0;
    el.querySelector('.poolbar__fill.base').style.width  = `${clamp(basePct,0,100)}%`;
    el.querySelector('.poolbar__fill.plan').style.width  = `${clamp(newPct,0,100)}%`;

    // Meter (relative to available essence)
    const pctMeter = essNow ? (planned / essNow) * 100 : 0;
    fill.style.width = `${pctMeter.toFixed(2)}%`;
    amtEl.textContent = fmt(planned, 2);

    // // Essence planned (remaining vs softCap)
    // Essence bars:
    //   base (solid)   = remaining after deduction
    //   plan (striped) = ONLY the slice to be deducted (from remaining → current)
    const curPct = essMax ? (essNow / essMax) * 100 : 0;
    const remPct = essMax ? (clamp(essNow - planned, 0, essNow) / essMax) * 100 : 0;
    const slice  = clamp(curPct - remPct, 0, 100);
    essBase.style.width = `${clamp(remPct,0,100)}%`;
    essPlan.style.left  = `${clamp(remPct,0,100)}%`;
    essPlan.style.width = `${slice}%`;
  }

  function commitTransfer(targetKey, amount){
    const essNow = Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence || 0;
    let planned = clamp(amount, 0, essNow);

    const el = poolsEls[targetKey];
    const cur = Number(el.dataset.cur||0), max = Number(el.dataset.max||0);
    const toAdd = clamp(planned, 0, Math.max(0, max - cur));
    planned = toAdd;
    if (planned <= 0.01) return;

    window.dispatchEvent(new CustomEvent('spirit:transmute', {
      detail: { amount: Number(planned.toFixed(2)), from: 'essence', to: targetKey }
    }));

    // Update essence
    const nextEss = clamp(essNow - planned, 0, 9e12);
    essEl.textContent = fmt(nextEss);
    if (headEssEl) headEssEl.textContent = fmt(nextEss);

    // Update pool
    const newCur = cur + planned;
    el.dataset.cur = String(newCur);
    const basePct= max ? (newCur/max)*100 : 0;
    el.querySelector('.poolbar__fill.base').style.width  = `${clamp(basePct,0,100)}%`;
    el.querySelector('.poolbar__fill.plan').style.width  = '0%';

    // // Update essence planned (remaining vs softCap)
    // After commit, both bars equal the new current (no pending deduction)
    const newPct = essMax ? (nextEss / essMax) * 100 : 0;
    essBase.style.width = `${clamp(newPct,0,100)}%`;
    essPlan.style.left  = `${clamp(newPct,0,100)}%`;
    essPlan.style.width = `0%`;

    fill.classList.add('flash'); setTimeout(()=>fill.classList.remove('flash'), 250);
    fill.style.width = '0%'; amtEl.textContent = '0';
  }

  // Lightweight in-menu confirm modal (no MyFiModal child swap)
  function openConfirmTransmute(targetKey, planned){
    const host = root.closest('.summary-card') || root.closest('.spirit-card') || document.body;
    const shell = document.createElement('div');
    shell.className = 'inline-confirm';
    shell.innerHTML = `
      <div class="inline-card">
        <div class="inline-hd"><b>Confirm Transmute</b></div>
        <div class="inline-body">
          <p>Transfer to <b>${uc(targetKey)}</b></p>
          <label>Amount (£)
            <input class="confirm-input" type="number" min="0.01" step="0.01" value="${Number(planned||0).toFixed(2)}" />
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
    shell.querySelector('.btn-cancel').addEventListener('click', close);
    shell.querySelector('.btn-confirm').addEventListener('click', ()=>{
      const n = Number(shell.querySelector('.confirm-input').value||0);
      close();
      if (Number.isFinite(n) && n>0) commitTransfer(targetKey, n);
    });
  }

  // Target selection
  let target = 'health';
  targetBtns.forEach(b=>b.addEventListener('click', ()=>{
    targetBtns.forEach(x=>x.classList.toggle('is-active', x===b));
    target = b.dataset.target; tgtEl.textContent = uc(target);
    previewPlan(target, 0);
  }));

  // Hold-to-preview then confirm
  let raf=null,start=0,running=false, planned=0;
  const MAX_RATE_PER_SEC = Math.max(1, (Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence)/6);

  const step=(t)=>{
    if (!running) return;
    if (!start) start = t;
    const dt = (t - start)/1000;
    planned = clamp(dt * MAX_RATE_PER_SEC, 0, Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence);
    previewPlan(target, planned);
    raf = requestAnimationFrame(step);
  };

  const endHold=()=>{ running=false; cancelAnimationFrame(raf); start=0; openConfirmTransmute(target, planned); planned=0; };

  btnHold.addEventListener('pointerdown',(e)=>{ e.preventDefault(); if(running) return; running=true; btnHold.classList.add('is-armed'); raf=requestAnimationFrame(step); }, {passive:false});
  const stop=()=>{ if(!running) return; btnHold.classList.remove('is-armed'); endHold(); };
  ['pointerup','pointercancel','pointerleave','keyup','blur'].forEach(ev=>{ (ev==='keyup'?window:btnHold).addEventListener(ev, stop); });

  // Quick actions
  const btnFullSel = root.querySelector('.quick.full-selected');
  const btnFullAll = root.querySelector('.quick.full-all');

  btnFullSel.addEventListener('click', ()=>{
    const ess = Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence;
    const el = poolsEls[target]; const cur=+el.dataset.cur, max=+el.dataset.max;
    commitTransfer(target, Math.min(ess, Math.max(0, max - cur)));
  });

  btnFullAll.addEventListener('click', ()=>{
    let essAvail = Number(String(essEl.textContent).replace(/[,£]/g,'')) || essence;
    for (const k of ['health','mana','stamina']){
      if (essAvail <= 0) break;
      const el = poolsEls[k]; const cur=+el.dataset.cur, max=+el.dataset.max;
      const need = Math.max(0, max - cur);
      const use  = Math.min(essAvail, need);
      if (use>0){ commitTransfer(k, use); essAvail -= use; }
    }
  });  

  previewPlan(target, 0);
}

/** =========================================================
 *  CHARGE: Hold + Overcap handling + Stripe hook
 *  =======================================================*/
function panelCharge(essence, chargePct){
  const capLeftPct = clamp(1 - (chargePct||0), 0, 1);
  return `
    <div class="panel-wrap">
      <p class="panel-note">Hold to attune your Spirit Stone. Releasing commits the payment.</p>

      <div class="opt-row">
        <label class="toggle">
          Overcap handling:
          <select class="overcap-mode">
            <option value="overcharge">Overcharge (prepay)</option>
            <option value="convert_to_shards">Auto-convert overflow to Soul Shards</option>
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

      <button class="charge-hold" aria-label="Hold to charge">Hold to Charge</button>
      <div class="charge-hint">Cap remaining ~ ${(capLeftPct*100|0)}%. Extras follow your overcap setting.</div>
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
      <p class="panel-note">Convert Essence into Soul Shards to progress avatars and cosmetics.</p>

      <div class="shards-row">
        <div class="qty">
          <button class="qty-dec" aria-label="Decrease">–</button>
          <input class="qty-input" type="number" min="1" value="1">
          <button class="qty-inc" aria-label="Increase">+</button>
        </div>
        <div class="cost">Cost: £<span class="cost-val">5.00</span></div>
      </div>

      <div class="hint-mini">Capped by available Essence. Tier ${tier} may grant bonuses.</div>
      <button class="btn-buy-shards">Buy Shards</button>
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
        <button class="btn-contrib-stripe">Contribute (Stripe)</button>
      </div>

      <div class="hint-mini">Capped by available Essence. (Min £2 recommended for card fees.)</div>
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
  .stone-caption{ margin-top:6px; font-size:.9rem; opacity:.85; text-align:center; }

  .summary-rows{ display:grid; gap:6px; align-content:start; }
  .summary-row{ display:grid; grid-template-columns: 1fr auto; gap:8px; padding:8px 10px; border-radius:10px; background: rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); }
  .summary-row__label{ opacity:.9; }
  .summary-row__value{ font-variant-numeric: tabular-nums; }
  .summary-row .js-ess, .summary-row .js-shards { font-weight:700; }

  .spirit-tabs{ display:grid; grid-auto-flow:column; gap:6px; }
  .spirit-tab{ padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color:#f0e6d2; cursor:pointer; }
  .spirit-tab.is-active{ background: rgba(155,93,229,.16); box-shadow: 0 0 10px rgba(155,93,229,.28); }

  .spirit-panels{ position:relative; }
  .spirit-panel{ display:none; }
  .spirit-panel.is-active{ display:block; }
  .panel-wrap{ display:grid; gap:10px; padding:10px; border:1px solid rgba(255,255,255,.10); border-radius:14px; background: rgba(255,255,255,.04); }
  .panel-note, .charge-hint, .rebalance-hint, .shards-hint, .hint-mini{ opacity:.85; font-size:.95rem; margin:0; }
  .hint-mini{ font-size:.9rem; }

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

  /* Essence bar uses magenta theme (matches vitals) */
  .essbar .ess-base{
    background: rgba(155,93,229,.55);      /* solid magenta */
    z-index: 1;
  }
  .essbar .ess-plan{
    background: repeating-linear-gradient(
      45deg,
      rgba(155,93,229,.35),
      rgba(155,93,229,.35) 8px,
      rgba(240,220,160,.25) 8px,
      rgba(240,220,160,.25) 16px
    );
    z-index: 2;
  }

  /* Inline confirm overlay (stays in same menu) */
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
  .pool-btn.pill.health.is-active { background: rgba(220, 83,100,.25); box-shadow: 0 0 8px rgba(220,83,100,.35); }
  .pool-btn.pill.mana.is-active   { background: rgba(75,125,220,.25);  box-shadow: 0 0 8px rgba(75,125,220,.35); }
  .pool-btn.pill.stamina.is-active{ background: rgba(120,200,120,.25); box-shadow: 0 0 8px rgba(120,200,120,.35); }

  .quick-row{ display:flex; gap:8px; flex-wrap:wrap; }
  .exact-row{ display:none; } /* removed per spec */

  .shards-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .qty{ display:grid; grid-template-columns: 34px 80px 34px; gap:6px; }
  .qty button{ padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color:#f0e6d2; font-weight:700; cursor:pointer; }
  .qty-input{ text-align:center; padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color:#f0e6d2; }

  /* Confirm card */
  .confirm-card .confirm-body{ display:grid; gap:10px; padding:10px; }
  .confirm-card input{ width:140px; padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color:#f0e6d2; text-align:right; }
  .confirm-actions{ display:flex; gap:8px; justify-content:flex-end; }
  .confirm-actions .btn-cancel, .confirm-actions .btn-confirm{ padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color:#f0e6d2; font-weight:700; cursor:pointer; }
  `;
  const tag = document.createElement('style'); tag.id = 'spirit-stone-css'; tag.textContent = css; document.head.appendChild(tag);
})();
