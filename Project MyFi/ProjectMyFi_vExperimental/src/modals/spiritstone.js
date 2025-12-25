// src/modals/spiritstone.js
// Spirit Stone Menu (Transmute / Charge / Shards / Contribute)
// 1:1 port of legacy vitals-spirit-menu.js UI/behaviour, adapted for the new modal system.
// - Uses MyFiModal.openChildRaw
// - Reads Essence from vitals gateway; Shards/Charge from wallet
// - Writes synthetic confirmed transactions for Transmute (same as legacy)
//
// External deps: Firebase web v11 modules (cdn)
// No imports from old vitals-screen-manager.
//
// -------------------------------------------------------------------

import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFeature } from "../features/registry.js";

/* ---------- small utils ---------- */
const fmt = (n, d=0) => new Intl.NumberFormat(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n||0));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n)||0));
const uc = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const GHOST_WINDOW_MS = 6 * 60 * 1000; // 6 minutes (legacy parity)
function startOfDayMs(ms = Date.now()) { const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }

function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html!=null) n.innerHTML = html; return n; }

/* ---------- data ---------- */
async function getUid() { 
  const user = getFeature('auth').api.getUser();
  return user?.uid || null; 
}

async function getTransactionMode(uid) {
  const db = getFirestore();
  const snap = await getDoc(doc(db, "players", uid));
  return snap.exists() ? (snap.data()?.transactionMode || "verified") : "verified";
}

// gateway: read once (no recompute import used here)
async function readGateway(uid) {
  const db = getFirestore();
  const ref = doc(db, `players/${uid}/vitalsData/gateway`);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data()||{}) : {};
}

// wallet: shards / charge { pct, tier }
async function readWallet(uid) {
  try {
    const db = getFirestore();
    const snap = await getDoc(doc(db, `players/${uid}/wallet/main`));
    return snap.exists() ? (snap.data() || {}) : {};
  } catch { return {}; }
}

/* ---------- synthetic TX bundle for Transmute (legacy parity) ---------- */
// (+) pooled credits to H/M/S; (–) one Essence debit with appliedAllocation
async function writeTransmuteTxBundle(db, uid, pendingActions, bucket = 'verified') {
  if (!uid || !Array.isArray(pendingActions) || !pendingActions.length) return;

  // Aggregate by destination pool
  const byPool = pendingActions.reduce((acc, a) => {
    const pool = String(a.to || '').toLowerCase();  // 'health'|'mana'|'stamina'
    const amt  = Number(a.amount || 0);
    if (!amt || !['health','mana','stamina'].includes(pool)) return acc;
    acc[pool] = Number(((acc[pool] || 0) + amt).toFixed(2));
    return acc;
  }, {});

  const total = Object.values(byPool).reduce((s,v) => Number((s+v).toFixed(2)), 0);
  if (total <= 0) return;

  const nowMs  = Date.now();
  const dateMs = startOfDayMs(nowMs);
  const colRef = collection(db, `players/${uid}/financialData/processedTransactions/${bucket}`);

  const baseCommon = {
    accountId: null,
    addedMs: nowMs,
    dateMs,
    ghostWindowMs: GHOST_WINDOW_MS,
    ghostExpiryMs: nowMs + GHOST_WINDOW_MS,
    rulesVersion: 'v1',
    status: 'confirmed',
    creditModeOverride: null,
    provisionalTag: null,
    suggestedPool: null,
    autoLockReason: 'client_fallback',
    setAtMs: nowMs,
    appliedAllocation: {},
    transactionData: {
      description: '',
      entryDate: new Date(nowMs).toUTCString()
    }
  };

  const writes = [];

  // (+) credits per destination
  for (const [pool, amount] of Object.entries(byPool)) {
    const isHealth = (pool === 'health');
    const row = {
      ...baseCommon,
      amount: Number(amount.toFixed(2)),  // credit
      essence: 0, health: 0, mana: 0, stamina: 0,
      pool,
      tag: { pool },                      // intent for allocate
      creditModeOverride: isHealth ? 'health' : 'allocate',
      transactionData: {
        description: `Spirit: Transmute → ${uc(pool)}`,
        entryDate: new Date(nowMs).toUTCString()
      }
    };
    writes.push(addDoc(colRef, row));
  }

  // (–) Essence debit (explicit appliedAllocation)
  const essenceDebit = {
    ...baseCommon,
    amount: Number((-total).toFixed(2)),  // debit
    pool: 'essence',
    tag: { pool: 'essence' },
    creditModeOverride: null,
    appliedAllocation: { health:0, mana:0, stamina:0, essence: Number(total.toFixed(2)) },
    essence: 0, health: 0, mana: 0, stamina: 0,
    transactionData: {
      description: `Spirit: Transmute ← Essence`,
      entryDate: new Date(nowMs).toUTCString()
    }
  };
  writes.push(addDoc(colRef, essenceDebit));

  await Promise.all(writes);
}

/* ---------- tiny toast ---------- */
function showSpiritToast(message = "Transmutation complete") {
  const host = document.createElement('div');
  host.className = 'spirit-toast';
  host.innerHTML = `
    <div class="toast-stone">
      <span class="spark s1"></span>
      <span class="spark s2"></span>
      <span class="spark s3"></span>
      <span class="glow"></span>
      <div class="toast-msg">${message}</div>
    </div>`;
  document.body.appendChild(host);
  setTimeout(()=> host.classList.add('leaving'), 2000);
  setTimeout(()=> host.remove(), 2600);
}

/* ---------- CSS (scoped inject; legacy look & feel) ---------- */
function ensureStyles() {
  const ID = 'spirit-stone-css';
  if (document.getElementById(ID)) return;
  const css = `
  /* root containment inside modal body */
  .spirit-root{ color:#fff; }
  .spirit-row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .spirit-card{ border:1px solid #223044; border-radius:14px; padding:12px; background:#121626; }
  .spirit-muted{ opacity:.85; }
  .spirit-chip{ padding:6px 10px; border:1px solid #2a3a55; border-radius:999px; background:#0d1220; color:#fff; }
  .spirit-tabs{ display:flex; gap:8px; margin:8px 0; flex-wrap:wrap; }
  .spirit-tab{ padding:8px 10px; border:1px solid #2a3a55; border-radius:10px; background:#0d1220; color:#fff; cursor:pointer; }
  .spirit-tab.active{ box-shadow:0 0 0 1px rgba(59,130,246,.35), 0 0 14px rgba(59,130,246,.25) inset; border-color:rgba(59,130,246,.45); }

  /* summary */
  .spirit-summary{ display:grid; gap:10px; margin-bottom:6px; }
  .sp-k{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:12px; background:#111827; border:1px solid #1f2937; }
  .sp-k .label{ opacity:.85; }
  .sp-k .value{ font-weight:700; }
  .sp-bar{ height:10px; border-radius:999px; overflow:hidden; background:#1f2937; }
  .sp-bar > div{ height:100%; width:0%; background:linear-gradient(90deg,#22c55e,#06b6d4); }

  /* ring (charge) */
  .sp-ring{ display:flex; align-items:center; gap:12px; }
  .ring{ position:relative; width:64px; height:64px; border-radius:50%; background:conic-gradient(#a855f7 var(--pct,0%), #2a2f3a 0); }
  .ring::after{ content:""; position:absolute; inset:6px; background:#0f1118; border-radius:50%; box-shadow:inset 0 0 22px rgba(168,85,247,.25); }
  .ring .tier{ position:absolute; inset:0; display:grid; place-items:center; font-weight:700; font-size:12px; color:#c084fc; }

  /* transmute controls */
  .tx-row{ display:grid; grid-template-columns:120px 1fr auto; gap:10px; align-items:center; }
  .tx-row .pool{ font-weight:700; }
  .tx-row input[type="number"]{ width:100%; padding:8px; border-radius:8px; border:1px solid #2a3a55; background:#0d1220; color:#fff; }
  .tx-row .btns{ display:flex; gap:6px; }
  .btn{ padding:8px 10px; border-radius:10px; border:1px solid #2a3a55; background:#0f1b33; color:#fff; cursor:pointer; }
  .btn.secondary{ background:#0d1220; }
  .btn:disabled{ opacity:.6; cursor:not-allowed; }

  .hint{ font-size:12px; opacity:.75; }
  .err{ font-size:12px; color:#fca5a5; min-height:16px; }

  /* footer */
  .sp-footer{ position:sticky; bottom:0; display:flex; justify-content:space-between; gap:8px; padding-top:10px; margin-top:10px; border-top:1px solid #1f2937; background:transparent; }
  .sp-left, .sp-right{ display:flex; gap:8px; }

  /* tiny toast */
  .spirit-toast{ position:fixed; inset:0; display:flex; align-items:flex-end; justify-content:center; pointer-events:none; z-index:9999; }
  .toast-stone{ margin:0 0 28px; padding:10px 14px; border-radius:12px; border:1px solid #2a3a55; background:#0f1118; color:#fff; box-shadow:0 8px 40px rgba(0,0,0,.5); position:relative; overflow:hidden; }
  .toast-msg{ position:relative; z-index:2; }
  .spark{ position:absolute; width:6px; height:6px; background:#a78bfa; border-radius:50%; filter:blur(0.5px); opacity:.9; animation:sp-spark 1.4s ease-out infinite; }
  .spark.s1{ left:6px;  top:6px; }
  .spark.s2{ right:8px; top:10px; }
  .spark.s3{ left:36px; bottom:6px; }
  .glow{ position:absolute; inset:-12px; background:radial-gradient(40px 40px at 30% 20%, rgba(168,85,247,.22), transparent 60%); z-index:1; }
  .spirit-toast.leaving{ opacity:0; transition:opacity .6s ease; }
  @keyframes sp-spark { from{transform:translateY(0)} to{transform:translateY(-12px); opacity:0} }
  `;
  const tag = document.createElement('style');
  tag.id = ID;
  tag.textContent = css;
  document.head.appendChild(tag);
}

/* ---------- UI builders ---------- */
function buildSummary({ essence=0, shards=0, chargePct=0, tier=0 }) {
  const wrap = el('div','spirit-summary','');

  const k1 = el('div','sp-k','');
  k1.append(el('div','label','Essence'), el('div','value', fmt(essence,2)));
  const k2 = el('div','sp-k','');
  k2.append(el('div','label','Shards'), el('div','value', fmt(shards)));

  const k3 = el('div','sp-k','');
  const ringRow = el('div','sp-ring','');
  const ring = el('div','ring',''); ring.style.setProperty('--pct', `${Math.round(chargePct*100)}%`);
  const tierEl = el('div','tier', `T${Math.max(1, Number(tier||1))}`);
  ring.append(tierEl);
  ringRow.append(ring, el('div','', `<div class="spirit-muted">Charge</div><div class="value">${Math.round(chargePct*100)}%</div>`));
  k3.append(ringRow);

  const bar = el('div','sp-bar',''); const fill = el('div',''); fill.style.width = `${Math.max(0, Math.min(100, chargePct*100))}%`; bar.append(fill);

  wrap.append(k1,k2,k3,bar);
  return wrap;
}

function buildTabs() {
  const row = el('div','spirit-tabs','');
  const t1 = el('button','spirit-tab active','Transmute');
  const t2 = el('button','spirit-tab','Charge');
  const t3 = el('button','spirit-tab','Shards');
  const t4 = el('button','spirit-tab','Contribute');
  row.append(t1,t2,t3,t4);
  return { row, t1, t2, t3, t4 };
}

function buildTransmutePanel({ essence=0 }) {
  const card = el('div','spirit-card','');
  const err = el('div','err','');

  const rows = [
    { pool:'health',  label:'Health',  value:0 },
    { pool:'mana',    label:'Mana',    value:0 },
    { pool:'stamina', label:'Stamina', value:0 },
  ];

  const nodes = rows.map(r => {
    const row = el('div','tx-row','');
    row.append(el('div','pool', r.label));
    const input = document.createElement('input');
    input.type = 'number'; input.step = '1'; input.min = '0'; input.value = '0';
    const btns = el('div','btns','');
    const plus = el('button','btn','+'); const minus = el('button','btn secondary','–');
    btns.append(minus, plus);
    row.append(input, btns);
    r.input = input; r.plus = plus; r.minus = minus; r.row = row;
    return row;
  });

  const hint = el('div','hint', `Available: ${fmt(essence,2)} Essence`);
  const footer = el('div','hint','From: Essence');

  const holder = el('div',''); nodes.forEach(n=>holder.append(n)); card.append(holder, hint, footer, err);

  function totalRequested(){ return rows.reduce((s,r)=> s + Math.max(0, Number(r.input.value||0)), 0); }
  function validate() {
    const sum = totalRequested();
    if (sum > Number(essence||0) + 1e-6) {
      err.textContent = `You only have ${fmt(essence,2)} Essence. Reduce the total.`;
      return false;
    }
    err.textContent = '';
    return true;
  }
  function clampRowInput(input) {
    const v = Math.max(0, Number(input.value||0));
    input.value = String(Math.floor(v));
    validate();
  }

  rows.forEach(r=>{
    r.input.addEventListener('input', ()=> clampRowInput(r.input));
    r.plus.addEventListener('click', ()=>{
      r.input.value = String(Math.floor(Number(r.input.value||0))+1);
      validate();
    });
    r.minus.addEventListener('click', ()=>{
      r.input.value = String(Math.max(0, Math.floor(Number(r.input.value||0))-1));
      validate();
    });
  });

  function pendingActions(){
    const acts = [];
    for (const r of rows) {
      const amt = Math.max(0, Math.floor(Number(r.input.value||0)));
      if (amt > 0) acts.push({ to: r.pool, amount: amt });
    }
    return acts;
  }

  return {
    node: card,
    validate,
    pendingActions,
    reset(){ rows.forEach(r=> r.input.value = '0'); err.textContent=''; }
  };
}

function buildChargePanel({ shards=0 }) {
  const card = el('div','spirit-card','');
  card.innerHTML = `
    <div class="spirit-muted">Charge your Stone</div>
    <div style="margin-top:8px">Use shards to increase charge and unlock premium features.</div>
    <div class="hint" style="margin-top:6px">Shards available: <strong>${fmt(shards)}</strong></div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="btn" id="btnUseShard" ${shards<=0?'disabled':''}>Use 1 shard</button>
      <button class="btn secondary" id="btnGetShards">Get shards</button>
    </div>
    <div class="hint" style="margin-top:8px">Note: exact premium gating TBD — UI is 1:1 port (action hooks only).</div>
  `;
  return {
    node: card,
    wire(onUseShard, onGetShards){
      card.querySelector('#btnUseShard')?.addEventListener('click', onUseShard);
      card.querySelector('#btnGetShards')?.addEventListener('click', onGetShards);
    }
  };
}

function buildShardsPanel({ shards=0 }) {
  const card = el('div','spirit-card','');
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><div class="spirit-muted">Shards</div><div style="font-weight:700">${fmt(shards)}</div></div>
      <button class="btn secondary" id="btnHowTo">How to earn</button>
    </div>
    <div class="hint" style="margin-top:8px">Shards are rare fragments you can earn or receive during events. They can be used to charge your Stone.</div>
  `;
  return {
    node: card,
    wire(onHow){ card.querySelector('#btnHowTo')?.addEventListener('click', onHow); }
  };
}

function buildContribPanel() {
  const card = el('div','spirit-card','');
  card.innerHTML = `
    <div class="spirit-muted">Contribute</div>
    <div style="margin-top:8px">Support development and receive shards/charge (campaign-specific).</div>
    <div style="margin-top:10px">
      <button class="btn" id="btnContrib">Contribute via Card</button>
    </div>
    <div class="hint" style="margin-top:8px">This triggers a frontend event; hook your PSP/Stripe flow to it.</div>
  `;
  return {
    node: card,
    wire(onContrib){ card.querySelector('#btnContrib')?.addEventListener('click', onContrib); }
  };
}

/* ---------- Public: open ---------- */
export async function openSpiritStoneModal(/* sceneOrCaller optional */) {
  ensureStyles();
  const uid = await getUid();
  if (!uid) return;

  const [gateway, wallet, mode] = await Promise.all([
    readGateway(uid),
    readWallet(uid),
    getTransactionMode(uid)
  ]);

  const pools = gateway?.pools || {};
  const essence = Number(pools?.essence?.current || 0);         // from gateway (1:1 with legacy)  ⟵ :contentReference[oaicite:2]{index=2}
  const shards  = Number(wallet?.shards ?? 0);
  const chargePct = clamp(Number(wallet?.charge?.pct ?? 0), 0, 1);
  const tier      = Number(wallet?.charge?.tier ?? 1);

  // root
  const root = el('div','spirit-root','');

  // summary
  const summary = buildSummary({ essence, shards, chargePct, tier });
  root.append(summary);

  // tabs
  const { row: tabs, t1, t2, t3, t4 } = buildTabs();
  root.append(tabs);

  // body host
  const body = el('div',''); root.append(body);

  // footer
  const footer = el('div','sp-footer','');
  const left = el('div','sp-left','');
  const right = el('div','sp-right','');
  const btnReset = el('button','btn secondary','Reset');
  const btnConfirm = el('button','btn','Confirm');
  left.append(btnReset);
  right.append(btnConfirm);
  footer.append(left,right);
  root.append(footer);

  // panels
  const panelTx  = buildTransmutePanel({ essence });
  const panelCh  = buildChargePanel({ shards });
  const panelSh  = buildShardsPanel({ shards });
  const panelCo  = buildContribPanel();

  function show(which){
    [t1,t2,t3,t4].forEach(b=>b.classList.remove('active'));
    body.innerHTML = '';
    if (which==='tx'){ t1.classList.add('active'); body.append(panelTx.node); }
    if (which==='ch'){ t2.classList.add('active'); body.append(panelCh.node); }
    if (which==='sh'){ t3.classList.add('active'); body.append(panelSh.node); }
    if (which==='co'){ t4.classList.add('active'); body.append(panelCo.node); }
  }
  t1.onclick = ()=> show('tx');
  t2.onclick = ()=> show('ch');
  t3.onclick = ()=> show('sh');
  t4.onclick = ()=> show('co');
  show('tx');

  // hooks for panels with actions (UI parity: events only for non-transmute flows)
  panelCh.wire(async ()=>{
    // Use 1 shard → placeholder: decrement in wallet (client-merge) + toast
    const db = getFirestore();
    if (shards > 0) {
      await setDoc(doc(db, `players/${uid}/wallet/main`), { shards: Math.max(0, shards-1), updatedAt: serverTimestamp() }, { merge:true });
      showSpiritToast("Shard used");
    }
  }, ()=>{
    window.dispatchEvent(new CustomEvent('spirit:get-shards'));
  });
  panelSh.wire(()=> window.dispatchEvent(new CustomEvent('spirit:how-to-earn')));
  panelCo.wire(()=> window.dispatchEvent(new CustomEvent('spirit:contribute')));

  // footer buttons
  btnReset.onclick = ()=> { if (t1.classList.contains('active')) panelTx.reset(); };

  btnConfirm.onclick = async ()=>{
    if (!t1.classList.contains('active')) return;        // Confirm is only for Transmute (legacy parity)
    if (!panelTx.validate()) return;
    const acts = panelTx.pendingActions();
    if (!acts.length) return;

    const db = getFirestore();
    const bucket = await getTransactionMode(uid);        // verified/unverified  ⟵ keeps behaviour consistent
    await writeTransmuteTxBundle(db, uid, acts, bucket);
    showSpiritToast("Transmutation complete");

    // Emit a generic refresh signal so your HUD can react (same approach as legacy)
    window.dispatchEvent(new CustomEvent('vitals:refresh', { detail:{ source:'spiritstone' }}));
    panelTx.reset();
  };

  // open via modal system (new)
  if (window.MyFiModal?.openChildRaw) {
    window.MyFiModal.openChildRaw({ menuTitle: 'Spirit Stone', node: root, closeOnBackdrop: true });
  } else {
    // very small fallback if modal shell not present
    const sheet = el('div','', ''); sheet.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.6);z-index:9999;';
    const card = el('div','', ''); card.style.cssText = 'width:min(680px,94vw);max-height:92vh;overflow:auto;border-radius:16px;border:1px solid #273142;background:#0f1118;padding:12px;';
    card.append(root); sheet.append(card); document.body.append(sheet);
    sheet.addEventListener('click', (e)=>{ if (e.target===sheet) sheet.remove(); }, { passive:true });
  }
}

/* ---------- Public: footer binder ---------- */
export function autoInitSpiritStoneButton(selector = '#essence-btn'){
  const btn = document.querySelector(selector) || document.querySelector('#essence-btn');
  if (!btn || btn.__spiritWired) return;
  btn.__spiritWired = true;
  btn.addEventListener('click', (e) => { e.preventDefault(); openSpiritStoneModal().catch(console.warn); }, { passive:false });
}
