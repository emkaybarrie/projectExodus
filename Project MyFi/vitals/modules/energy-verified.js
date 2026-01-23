// energy-verified.js — Smart Review overlay (frontend) — v9
// Changes (vs v8):
// - Anchor row moved directly under the Title/Mode pills (top of sticky summary)
// - Energy/Ember totals stay side-by-side on a single row (even width; on all breakpoints)
// - Net monthly is a single row below the bar
// - Daily & Weekly are below Net monthly, side-by-side (labels above values)
// - Tap/click Net monthly row to toggle Daily/Weekly sliding in/out from below (animated)

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import  { openEnergyMenu, scopeCSS } from "./energy-menu.js"
import { refreshVitalsHUD } from "../vitals-screen-manager.js";

// ───────────────────────────────── CONFIG ─────────────────────────────────
const SR_CFG = {
  useBackendAnalyze: false,
  useBackendSave:    false,
  callRecompute:     false,
  devWriteRailsStub: true,
  endpoints: {
    analyzeUrl:   "https://smartreview-analyze-frxqsvlhwq-nw.a.run.app",
    saveUrl:      "https://smartreview-save-frxqsvlhwq-nw.a.run.app",
    recomputeUrl: "https://recomputerails-frxqsvlhwq-nw.a.run.app",
  },
  lookbackMonthsFetch: 36,
  lookbackMonthsGroup: 12,
  minOccurrences: 2,
  minConfidenceForAnchor: 0.25,
  minAnchorAmountMajor: 50,
  incomeCategories: ["Salary","Bonus","Pension", "Rental", "Investment","Other"],
  emberCategories:  ["Shelter","Bills","Transport", "Groceries","Debts","Tax","Other"],
  onTelemetry: (evt, payload)=>{ /* console.log('[SR]', evt, payload); */ },
  showConfidenceBadges: false,
};

const DAYS = 86400000;
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };
const GBP = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);

let SR_NET_INLINE = true
let SR_CREDIT_MODE = "essence" ; // 'essence' , 'allocate', 'health'

// ───────────────────────────────── STYLE ─────────────────────────────────
function ensureStyles(){
  const STYLE_ID = 'em-styles';      // for verified menu use: 'sr-styles'
  const OVERLAY_ID = 'emOverlay';    // for verified menu use: 'srOverlay'

  // 1) Remove any previous copy (prevents stale/duplicated rules)
  const prev = document.getElementById(STYLE_ID);
  if (prev) prev.remove();

  // 2) Build (or fetch) your CSS as usual
  const css = `
  :root{
    --bg:#0f1118; --panel:#111827; --edge:#1f2937; --ink:#fff;
    --muted:.85; --green:#10b981; --red:#ef4444; --blue:#3b82f6;
    --chip:#0d1220;
  }
  *{box-sizing:border-box}
  html,body{max-width:100%;overflow-x:hidden}
  #emOverlay{position:fixed;inset:0;background:rgba(6,8,12,.88);
    backdrop-filter:saturate(120%) blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center}
  #srWrap{width:min(1120px,94vw);max-height:94vh;display:flex;flex-direction:column;
    border:1px solid #273142;border-radius:16px;background:var(--bg);color:var(--ink);
    box-shadow:0 20px 80px rgba(0,0,0,.5); overflow:hidden}
  #srTop{position:sticky;top:0;z-index:3;background:var(--bg);border-bottom:1px solid var(--edge)}
  #srTopInner{padding:16px}
  #srBody{flex:1;min-height:0;overflow:auto;padding:0 16px 12px 16px}
  .sr-actions{display:flex;gap:8px;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--edge);
    background:var(--bg);position:sticky;bottom:0;z-index:2}
  #srTop h2{margin:0 0 8px;font-size:20px}
  .pill{padding:6px 12px;border-radius:999px;border:1px solid #2a3a55;background:var(--chip);color:var(--ink)}
  .pill.active{outline:2px solid var(--blue)}

  /* Sticky summary content (now ordered: Anchor → Totals → Bar → Net → Daily/Weekly) */
  .sr-summary{display:flex;flex-direction:column;gap:10px;margin-top:6px}

  /* Anchor row (moved to the top of summary) */
  .kbox{border-radius:12px;padding:10px 12px;background:var(--panel);border:1px solid var(--edge);min-width:0}
  .anchor-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
  .ao-select,.ao-input{width:100%;padding:8px;border-radius:8px;border:1px solid #2a3a55;background:#0d1220;color:#fff}
  .sr-sub{font-size:12px;opacity:var(--muted)}
  .kval{font-weight:700}
  .green{color:var(--green)} .red{color:var(--red)}

  /* Energy / Ember totals: always two columns (even width, do not collapse on mobile) */
  .totals-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

  /* Progress bar */
  .bar{height:14px;border-radius:12px;background:var(--edge);overflow:hidden}
  .bar>div{height:100%;width:0%}
  .bar .pos{background:linear-gradient(90deg,#22c55e,#06b6d4)}
  .bar .neg{background:linear-gradient(90deg,#ef4444,#f59e0b)}

  /* Net monthly row (stays a single row under the bar) */
  .net-row{
    display:grid;
    grid-template-columns:1fr;
    gap:10px;
  }

  /* Compact, single-line box with chevron aligned to the right */
  .net-box{
    position:relative;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    min-height:64px;              /* a touch slimmer than before */
    padding:10px 12px;
    border:1px solid var(--edge);
    border-radius:12px;
    background:var(--panel);
    cursor:pointer;
    user-select:none;
  }
  .net-box:hover{ box-shadow:0 0 0 1px rgba(255,255,255,.06) inset; }
  .net-box:focus-visible{ outline:2px solid var(--blue); outline-offset:2px; }

  /* Left side: label above value */
  .net-content{
    display:flex;
    flex-direction:column;
    gap:4px;
  }
  .net-label{ font-size:12px; opacity:.85; }
  #srKpiNet{ font-weight:700; }

  /* Right side: small inline chevron, no extra vertical space */
  .net-right{
    display:flex;
    align-items:center;
    gap:6px;
    margin-left:12px;  /* slight breathing room from value */
  }
  .chev{
    line-height:1;
    font-size:0.95em;
    opacity:.7;
    transition:transform .2s ease;
  }
  .net-box.expanded .chev{ transform:rotate(180deg); }


  /* Net: stacked vs inline switch */
  .net-content{display:flex; flex-direction:column}
  .net-box.inline .net-content{
    display:grid;
    grid-template-columns:auto 1fr;
    align-items:baseline;
    column-gap:10px;
  }



  /* Daily/Weekly sit below Net monthly, side-by-side (labels above value) with slide animation */
  .dw-wrap{overflow:hidden;max-height:0;opacity:0;transform:translateY(-4px);
    transition:max-height .22s ease, opacity .22s ease, transform .22s ease;}
  .dw-wrap.open{max-height:240px;opacity:1;transform:translateY(0)}
  .dw-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}

  /* Tabs (single set, subtle aura on active) */
  .sr-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 6px}
  .tab{padding:8px 10px;border:1px solid #2a3a55;border-radius:10px;background:var(--chip);color:var(--ink);text-align:center;transition:box-shadow .15s ease,border-color .15s ease}
  .tab.in.active{border-color:rgba(16,185,129,.5); box-shadow:0 0 0 1px rgba(16,185,129,.25), 0 0 12px rgba(16,185,129,.25) inset}
  .tab.out.active{border-color:rgba(239,68,68,.5);  box-shadow:0 0 0 1px rgba(239,68,68,.25),  0 0 12px rgba(239,68,68,.25) inset}

  /* Lists section separation */
  .list-section{margin-top:6px;border-top:1px dashed var(--edge);padding-top:10px}
  .toolbar{display:flex;gap:8px;margin:6px 0;flex-wrap:wrap;align-items:center;justify-content:space-between}
  .count-pill{font-size:12px;opacity:var(--muted)}
  .section-title{font-weight:600}
  .section-title.in{color:var(--green)} .section-title.out{color:var(--red)}
  .sr-list{display:flex;flex-direction:column;gap:10px}

  /* Cards */
  .ao-tile{border:1px solid #223044;border-radius:14px;padding:12px;background:#121626}
  .row-top{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}
  .row-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}

  /* Bottom row: cadence/avg (left) and monthly+include (right); stacked so monthly sits below on narrow */
  .row-bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;margin-top:10px}
  .row-bottom.stacked{ grid-template-columns: 1fr; }
  .bottom-box{border:1px dashed var(--edge);border-radius:12px;padding:10px;background:rgba(255,255,255,.02)}
  .cadence-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

  .monthly-pill{border:1px solid var(--edge);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));
    border-radius:16px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .amount-chip{font-weight:700}
  .amount-chip.green{color:var(--green)} .amount-chip.red{color:var(--red)}
  .include-wrap{display:flex;align-items:center;gap:8px;white-space:nowrap}

  /* Keep no x-overflow on small screens without collapsing Energy/Ember row */
  @media (max-width: 480px){
    .sr-tabs{gap:6px}
    .dw-row{gap:8px}
    .totals-row{gap:8px}
  }
  `;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=scopeCSS(css, OVERLAY_ID);
  document.head.appendChild(style);
}

// ───────────────────────────────── UTILS ─────────────────────────────────
function el(tag, cls, html){ const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; }
function normName(s=''){
  let n = String(s||'').toLowerCase();
  n = n.replace(/card\s*\d+|pos\s*\d+|ref[:\s]*\d+|#[a-z0-9]+/g,' ');
  n = n.replace(/[\u{1F300}-\u{1FAFF}]/gu,''); // emojis
  n = n.replace(/[^\p{L}\p{N}\s\.\-&]/gu,' ');
  n = n.replace(/\s{2,}/g,' ').trim();
  n = n.replace(/tesco.*$/,'tesco').replace(/sainsbury.*$/,'sainsbury')
       .replace(/british\s*gas.*$/,'british gas').replace(/vodafone.*$/,'vodafone')
       .replace(/oyster|tfl/,'tfl').replace(/hmrc.*$/,'hmrc');
  return n || 'unknown';
}
function cadenceUnitLabel(c){ return c==='weekly'?'per week': c==='fortnightly'?'per fortnight' : c==='quarterly'?'per quarter' : c==='yearly'?'per year' : c==='daily'?'per day':'per month'; }
function suggestInclude(name=''){ return /(salary|payroll|wage|stipend|pension|employer|scholarship|grant)/.test(String(name).toLowerCase()); }
function iqrFilter(values){
  if (values.length < 4) return values.map((_,i)=>i);
  const vs = values.slice().sort((a,b)=>a-b);
  const q1 = vs[Math.floor((vs.length-1)*0.25)];
  const q3 = vs[Math.floor((vs.length-1)*0.75)];
  const iqr = q3 - q1, lo = q1 - 1.5*iqr, hi = q3 + 1.5*iqr;
  const keep = []; for (let i=0;i<values.length;i++){ const v=values[i]; if(v>=lo&&v<=hi) keep.push(i); } return keep;
}
function isoWeekKey(ms){ const d=new Date(ms); const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day); const ys=new Date(Date.UTC(t.getUTCFullYear(),0,1)); const wn=Math.ceil((((t-ys)/DAYS)+1)/7); return `${t.getUTCFullYear()}-W${String(wn).padStart(2,'0')}`; }
const monthKey = ms => `${new Date(ms).getFullYear()}-${String(new Date(ms).getMonth()+1).padStart(2,'0')}`;
const fortnightKey = ms => { const d=new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getDate()<=15?'A':'B'}`; };
const quarterKey = ms => { const d=new Date(ms), q=Math.floor(d.getMonth()/3)+1; return `${d.getFullYear()}-Q${q}`; };
const yearKey = ms => String(new Date(ms).getFullYear());
function aggregateByCadence(occ, cadence){
  const keyFn = cadence==='weekly'? isoWeekKey : cadence==='fortnightly'? fortnightKey
              : cadence==='monthly'? monthKey : cadence==='quarterly'? quarterKey
              : cadence==='yearly'? yearKey : monthKey;
  const m = new Map();
  for (const o of occ){ const k = keyFn(o.ts); m.set(k,(m.get(k)||0)+Math.abs(o.amt)); }
  const sums = Array.from(m.entries()).sort((a,b)=> a[0]<b[0]? -1 : 1).map(e=>e[1]);
  return { sums };
}
const median = v => !v.length ? 0 : v.slice().sort((a,b)=>a-b)[Math.floor(v.length/2)];
const mad = v => { if (v.length<3) return 0; const m=median(v); return median(v.map(x=>Math.abs(x-m))); };
function scoreCadence(occ, cadence){
  const { sums } = aggregateByCadence(occ, cadence);
  if (sums.length < SR_CFG.minOccurrences) return { fit:0, hits:0, rep:0 };
  const hits = sums.filter(x=>x>0).length;
  const coverage = hits / sums.length;
  const m = median(sums), m_mad = mad(sums);
  const stab = m===0 ? 0 : Math.max(0, 1 - (m_mad / (m*1.2)));
  return { fit: 0.6*coverage + 0.4*stab, hits, rep: m };
}

// ───────────────────────────────── DATA LOAD ─────────────────────────────────
async function loadProcessedVerified(uid, monthsFetch){
  const db = getFirestore(), sinceMs = Date.now() - monthsFetch*30.44*DAYS;
  const candidates = [ collection(db, `players/${uid}/financialData/processedTransactions/verified`) ];
  for (const coll of candidates){
    try {
      const qs = await getDocs(coll); const arr=[];
      qs.forEach(d => {
        const x = d.data()||{};
        const ts = x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? 0;
        if (ts >= sinceMs) arr.push({ id:d.id, ...x, ts });
      });
      if (arr.length) return arr;
    } catch(e){}
  }
  return [];
}

// ───────────────────────────────── ANALYZE (client) ─────────────────────────────────
function buildGroups(processed, monthsGroup){
  const cutoff = Date.now() - monthsGroup*30.44*DAYS;
  const txs = processed.map(x=>{
    const amount = Number(x.amount ?? x.amountMajor ?? 0);
    const td = x.transactionData || {};
    const name = normName(td.description || td.merchantName || x.label || x.counterparty || '');
    return { id: x.id, ts:x.ts, amt:amount, name };
  }).filter(t => Number.isFinite(t.ts) && t.ts>=cutoff);

  const groups = new Map();
  for (const t of txs){
    const kind = t.amt>=0 ? 'inflow' : 'ember';
    const key = `${t.name}|${kind}`;
    if (!groups.has(key)) groups.set(key, { name:t.name, kind, occ:[] });
    groups.get(key).occ.push({ ts:t.ts, amt:Math.abs(t.amt), id:t.id });
  }
  for (const g of groups.values()){
    g.occ.sort((a,b)=>a.ts-b.ts);
    const keep = iqrFilter(g.occ.map(o=>o.amt));
    g.occ = keep.map(i=>g.occ[i]);
  }

  const items=[];
  for (const g of groups.values()){
    if (g.occ.length < SR_CFG.minOccurrences) continue;
    const candidates=['weekly','fortnightly','monthly','quarterly','yearly'];
    let best = { cadence:'monthly', fit:0, hits:0, rep:0 };
    for (const c of candidates){
      const sc = scoreCadence(g.occ, c);
      if (sc.fit > best.fit) best = { cadence:c, ...sc };
    }
    items.push({
      id: g.name + '|' + (g.kind==='inflow'?'in':'out'),
      name: g.name, kind: g.kind, cadence:best.cadence,
      representative: Number((best.rep||0).toFixed(2)),
      txCount: g.occ.length, confidence: Math.min(1, best.fit),
      txIds: g.occ.map(o=>o.id).filter(Boolean)  // keep source processedTransactions IDs
    });
  }

  const inflow = items.filter(i=>i.kind==='inflow').sort((a,b)=>b.confidence-a.confidence);
  const ember  = items.filter(i=>i.kind==='ember') .sort((a,b)=>b.confidence-a.confidence);

  // Anchor candidates (unique dates by calendar day)
  const confByName = new Map(inflow.map(i=>[i.name, i.confidence]));
  const dset = new Set(); const last30 = Date.now()-30*DAYS;
  for (const t of txs){
    if (t.amt < SR_CFG.minAnchorAmountMajor) continue;
    if (t.ts < last30) continue;
    const conf = confByName.get(t.name)||0;
    if (conf < SR_CFG.minConfidenceForAnchor) continue;
    const d=new Date(t.ts);
    dset.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  const anchorDates = Array.from(dset).sort((a,b)=> (a<b?1:-1));
  return { inflow, ember, anchorDates };
}
async function analyzeClient(uid){
  const raw = await loadProcessedVerified(uid, SR_CFG.lookbackMonthsFetch);
  return buildGroups(raw, SR_CFG.lookbackMonthsGroup);
}

// ───────────────────────────────── SAVE ─────────────────────────────────
async function saveSelections({ mode, anchorTs, inflowRows, emberRows, creditMode }) {
  const user = getAuth().currentUser; 
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken(); 
  const uid = user.uid; 
  const db = getFirestore();

  const ins  = inflowRows.filter(x => x.include);
  const outs = emberRows.filter(x => x.include);

  const incomeMo = ins.reduce((s, x) => s + (x.monthly || 0), 0);
  const emberMo  = outs.reduce((s, x) => s + (x.monthly || 0), 0);
  const incCats = {}; 
  ins.forEach(x => { incCats[x.category || x.label] = (incCats[x.category || x.label] || 0) + (x.monthly || 0); });
  const outCats = {}; 
  outs.forEach(x => { outCats[x.category || x.label] = (outCats[x.category || x.label] || 0) + (x.monthly || 0); });

  if (SR_CFG.useBackendSave) {
    const res = await fetch(SR_CFG.endpoints.saveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
      body: JSON.stringify({
        mode, anchorMs: anchorTs || null,
        inflow: { totalMonthly: incomeMo, categories: incCats, selections: ins },
        ember:  { totalMonthly: emberMo,  categories: outCats, selections: outs },
        client: { userAgent: navigator.userAgent, ts: Date.now() }
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) throw new Error(json?.error || "save_failed");

  } else if (SR_CFG.devWriteRailsStub) {
    // Progress UI
    showApplyProgress();
    updateApplyProgress(5);

    const now = Date.now();
    const payload = {
      energyMode: mode === "finite" ? "finite" : "continuous", 
      creditMode: creditMode || 'essence',
      cadence: "monthly",
      inflow:  { total: Number(incomeMo.toFixed(2)), itemised: incCats },
      outflow: { total: Number(emberMo.toFixed(2)), itemised: outCats },
      netflow: Number(incomeMo.toFixed(2) - emberMo.toFixed(2)).toFixed(2),
      payCycleAnchorMs: anchorTs || null, 
      updatedAt: now
    };

    await setDoc(doc(db, `players/${uid}/financialData/cashflowData/verified/core`), payload, { merge: true });
    updateApplyProgress(15);

    // Active Recompute Stub
    await setModeToVerified();
    const tMode = await getTransactionMode();
    payload.transactionMode = tMode;
    await setDoc(doc(db, `players/${uid}/financialData/cashflowData`), payload, { merge: true });
    updateApplyProgress(30);

    // Stub Processed Txn Classification updates:
    try {
      await stubApplyClassificationsByIds(uid, { inflowRows, emberRows }, (done, total) => {
        const pct = 30 + (done / Math.max(1, total)) * 65; // progress from 30→90
        updateApplyProgress(pct);
      });
    } catch (e) {
      console.warn("Stub classification failed:", e?.message || e);
    }
    
    updateApplyProgress(100);
    setTimeout(hideApplyProgress, 400);
  }

  if (SR_CFG.callRecompute) {
    try {
      const res = await fetch(SR_CFG.endpoints.recomputeUrl, { method: "POST", headers: { Authorization: "Bearer " + idToken } });
      if (!res.ok) console.warn("recompute failed", await res.json().catch(() => ({})));
    } catch (e) {
      console.warn("recompute error", e?.message || e);
    }
  }

  SR_CFG.onTelemetry("save_ok", { mode, incomeMo, emberMo, anchorTs });
}


// ───────────────────────────────── LIST CONTROLS ─────────────────────────────────
function addListControls(host, rows, labelText, tone /* 'in'|'out' */, onChange){
  const bar = el('div','toolbar','');
  const left = document.createElement('div');
  const title = el('span',`section-title ${tone}`, labelText);
  const count = el('span','count-pill', ` (${rows.length} group${rows.length!==1?'s':''})`);
  left.append(title, count);

  const right = document.createElement('div');
  const btnToggle = document.createElement('button'); btnToggle.className='pill'; btnToggle.textContent='Select all';
  btnToggle.onclick = ()=>{
    const allChecked = btnToggle.dataset.state === 'all';
    const target = !allChecked;
    rows.forEach(r => r.setIncluded?.(target));
    btnToggle.dataset.state = target ? 'all' : 'none';
    btnToggle.textContent = target ? 'Unselect all' : 'Select all';
    onChange?.();
  };
  btnToggle.dataset.state = 'none';

  right.append(btnToggle);
  bar.append(left, right);
  host.append(bar);
}

// ───────────────────────────────── ROW UI ─────────────────────────────────
function buildRowUI(group, kind){
  const row = el('div','ao-tile');
  const top = el('div','row-top');
  const left = el('div','', `
    <strong>${group.name || 'unknown'}</strong>
    <div class="sr-sub">${group.txCount} hit${group.txCount!==1?'s':''}${SR_CFG.showConfidenceBadges ? ` • conf ${(group.confidence*100|0)}%` : ''}</div>
  `);
  const kindTag = el('div','sr-sub muted', kind==='inflow' ? 'Energy' : 'Ember');
  top.append(left, kindTag);

  // Row 1: Label | Category (equal width)
  const label = document.createElement('input'); label.className='ao-input';
  label.placeholder = kind==='inflow' ? 'Label (e.g., Salary)' : 'Label (e.g., Rent)'; label.value = group.name || '';
  const category = document.createElement('select'); category.className='ao-select';
  (kind==='inflow'? SR_CFG.incomeCategories : SR_CFG.emberCategories)
    .forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; category.append(o); });
  category.value = "Other";

  const grid = el('div','row-grid');
  const labWrap = el('div','',`<label class="sr-sub">Label</label>`);    labWrap.append(label);
  const catWrap = el('div','',`<label class="sr-sub">Category</label>`); catWrap.append(category);
  grid.append(labWrap, catWrap);

  // Bottom: cadence/avg (left) and monthly+include (right); stacked so monthly sits below cadence details
  const bottom = el('div','row-bottom stacked');

  const cadenceBlock = el('div','bottom-box','');
  const cGrid = el('div','cadence-grid','');
  const cLeft = el('div','', `<div class="sr-sub">Cadence</div><div style="font-weight:700">${(group.cadence||'monthly')[0].toUpperCase()+(group.cadence||'monthly').slice(1)}</div>`);
  const cRight= el('div','', `<div class="sr-sub">Avg Amount</div><div style="font-weight:700;color:#fff">${GBP(group.representative||0)} ${cadenceUnitLabel(group.cadence||'monthly')}</div>`);
  cGrid.append(cLeft, cRight);
  cadenceBlock.append(cGrid);

  const monthlyVal = Number(((group.representative||0) * MONTHLY_MULT[group.cadence||'monthly']).toFixed(2));
  const monthlyBox = el('div','monthly-pill','');
  const leftCol = el('div','', `<div class="sr-sub">Monthly Total</div><div class="amount-chip ${kind==='inflow'?'green':'red'}">${GBP(monthlyVal)}/mo</div>`);
  const include = document.createElement('input'); include.type='checkbox';
  // include.checked = (kind==='inflow') ? suggestInclude(group.name) : true;
  include.checked = (kind==='inflow') ? true : true;
  const incWrap = el('label','include-wrap','Include'); incWrap.prepend(include);
  monthlyBox.append(leftCol, incWrap);

  bottom.append(cadenceBlock, monthlyBox);

  row.append(top, grid, bottom);

  return {
    node: row,
    include,
    collect: () => ({
      id: group.id,
      name: group.name,
      label: label.value.trim() || group.name || '',
      category: category.value || 'Other',
      cadence: group.cadence || 'monthly',
      representative: Number(group.representative || 0),
      monthly: monthlyVal,
      include: include.checked,
      classAs: kind,
      txIds: group.txIds || [] // pass through IDs
    }),
    setIncluded: (on)=>{ include.checked=!!on; include.dispatchEvent(new Event('change')); }
  };
}

// ───────────────────────────────── STICKY HEADERS ─────────────────────────────────
function renderContinuousSticky(stickyHost, analysis){
  stickyHost.innerHTML = '';

  const summary = document.createElement('div'); summary.className='sr-summary';

  // 1) Anchor row (TOP)
  const anchorBox = el('div','kbox','');
  const anchorRow = el('div','anchor-row','');
  const anchorLbl = el('div','sr-sub','Anchor date:');
  const anchorSelect = document.createElement('select'); anchorSelect.className='ao-select';
  anchorSelect.append(new Option('Auto (last strong inflow)',''));
  (analysis.anchorDates||[]).forEach(dStr=>{
    const [y,m,d]=dStr.split('-').map(Number);
    const disp = new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    anchorSelect.append(new Option(disp, String(new Date(y,m-1,d).getTime())));
  });
  anchorRow.append(anchorLbl, anchorSelect);
  anchorBox.append(anchorRow);

  // Credit mode
  // Credit Mode (parity with unverified)
  const cmRow = el('div','anchor-row','');
  const cmLbl = el('div','sr-sub','Credit mode:');
  const cmSel = document.createElement('select');
  cmSel.className = 'ao-select';
  cmSel.id = 'srCreditMode';
  ['essence','allocate','health'].forEach(opt=>{
    const o=document.createElement('option');
    o.value=opt; o.textContent = opt[0].toUpperCase()+opt.slice(1);
    cmSel.append(o);
  });
  cmSel.value = SR_CREDIT_MODE;
  cmSel.addEventListener('change', ()=>{ SR_CREDIT_MODE = cmSel.value; });
  cmRow.append(cmLbl, cmSel);
  anchorBox.append(cmRow);


  // 2) Energy/Ember totals (always side-by-side)
  const totalsRow = el('div','totals-row','');
  const energyBox = el('div','kbox','<div>Energy Source</div><div id="srKpiEnergy" class="kval green">£0/mo</div>');
  const emberBox  = el('div','kbox','<div>Emberward</div><div id="srKpiEmber" class="kval red">£0/mo</div>');
  totalsRow.append(energyBox, emberBox);

  // 3) Bar
  const bar = el('div','bar'); const fill = el('div','pos'); bar.append(fill);

  // 4) Net monthly (single row)
  const netRow = el('div','net-row','');

  const netBox = el('div','kbox net-box clickable','');
  netBox.setAttribute('role','button');
  netBox.setAttribute('tabindex','0');
  netBox.innerHTML = `
    <div class="net-content">
      <div class="net-label sr-sub">Monthly</div>
      <div id="srKpiNet" class="kval">£0/mo</div>

      <span class="chev" aria-hidden="true">▾</span>
  
  `;

  if (SR_NET_INLINE){
    netBox.classList.add('inline')
  }
  netRow.append(netBox);


  // 5) Daily/Weekly (hidden until net tapped)
  const dwWrap = el('div','dw-wrap','');
  const dwRow = el('div','dw-row','');
  const dailyBox  = el('div','kbox','<div class="sr-sub">Daily</div><div id="srDailyVal" class="kval">£0</div>');
  const weeklyBox = el('div','kbox','<div class="sr-sub">Weekly</div><div id="srWeeklyVal" class="kval">£0</div>');
  dwRow.append(dailyBox, weeklyBox);
  dwWrap.append(dwRow);

  // Toggle behavior
  netBox.addEventListener('click', ()=>{
    const isOpen = dwWrap.classList.toggle('open');
    netBox.classList.toggle('expanded', isOpen);
    netBox.setAttribute('aria-expanded', String(isOpen));
  });
  netBox.setAttribute('role','button');
  netBox.setAttribute('tabindex','0');
  netBox.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); netBox.click(); }
  });

  summary.append(anchorBox, totalsRow, bar, netRow, dwWrap);

  // Tabs (unchanged)
  const tabs = el('div','sr-tabs','');
  const tabIn  = el('button','tab in active', 'Energy Source');
  const tabOut = el('button','tab out',        'Emberward');
  tabs.append(tabIn, tabOut);

  stickyHost.append(summary, tabs);

  return {
    tabIn, tabOut, fill, anchorSelect,
    setDaily: v => { const el=document.getElementById('srDailyVal'); if (el) el.textContent = v; },
    setWeekly: v => { const el=document.getElementById('srWeeklyVal'); if (el) el.textContent = v; },
  };
}

function renderFiniteSticky(stickyHost){
  stickyHost.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className='sr-summary';
  const box = el('div','kbox', `
    <div><strong>Finite mode</strong></div>
    <div class="sr-sub" style="margin-top:6px">
      Seed, duration, and replenishment controls will appear here (placeholder).
    </div>
  `);
  wrap.append(box);
  stickyHost.append(wrap);
}

// ───────────────────────────────── PHASE: CONTINUOUS ─────────────────────────────────
function renderContinuousPhase(bodyHost, analysis){
  bodyHost.innerHTML = '';

  // Sticky content (under the header title/pills)
  const sticky = document.getElementById('srSticky');
  const stickyApi = renderContinuousSticky(sticky, analysis);

  // Section + list
  const section = el('div','list-section','');
  const listWrap = el('div','sr-list','');
  section.append(listWrap);
  bodyHost.append(section);

  // Build rows
  const inRows  = (analysis.inflow||[]).map(g=>buildRowUI(g,'inflow'));
  const outRows = (analysis.ember ||[]).map(g=>buildRowUI(g,'ember'));

  // Toolbars
  const toolIn  = document.createElement('div');
  const toolOut = document.createElement('div');
  addListControls(toolIn,  inRows,  'Inflows', 'in',  () => updateSummary());
  addListControls(toolOut, outRows, 'Outflows', 'out', () => updateSummary());

  // Summary updater
  function updateSummary(){
    const ins  = inRows .map(r=>r.collect()).filter(x=>x.include);
    const outs = outRows.map(r=>r.collect()).filter(x=>x.include);
    const incMo = ins.reduce((s,x)=>s+(x.monthly||0),0);
    const outMo = outs.reduce((s,x)=>s+(x.monthly||0),0);
    document.getElementById('srKpiEnergy').textContent = GBP(incMo) + '/mo';
    document.getElementById('srKpiEmber') .textContent = GBP(outMo) + '/mo';
    document.getElementById('srKpiNet')   .textContent = GBP(incMo - outMo) + '/mo';
    const pct = Math.max(0, Math.min(100, incMo? ((incMo-outMo)/incMo*100):0));
    stickyApi.fill.style.width = pct + '%'; stickyApi.fill.className = (incMo - outMo >= 0) ? 'pos' : 'neg';
    const netDaily  = Number(((incMo - outMo)/MONTHLY_MULT.daily).toFixed(2));
    const netWeekly = Number(((incMo - outMo)/MONTHLY_MULT.weekly).toFixed(2));
    stickyApi.setDaily(GBP(netDaily));
    stickyApi.setWeekly(GBP(netWeekly));
  }
  [...inRows, ...outRows].forEach(r => r.include.addEventListener('change', updateSummary));

  function show(kind){
    const tabIn  = document.querySelector('.sr-tabs .in');
    const tabOut = document.querySelector('.sr-tabs .out');
    tabIn .classList.toggle('active', kind==='in');
    tabOut.classList.toggle('active', kind==='out');
    listWrap.innerHTML='';
    if (kind==='in'){ listWrap.append(toolIn);  inRows .forEach(r=>listWrap.append(r.node)); }
    else            { listWrap.append(toolOut); outRows.forEach(r=>listWrap.append(r.node)); }
    updateSummary();
  }
  const tabs = sticky.querySelector('.sr-tabs');
  const [tabInBtn, tabOutBtn] = tabs.querySelectorAll('button');
  tabInBtn.onclick  = ()=> show('in');
  tabOutBtn.onclick = ()=> show('out');
  show('in');

  return {
    collectSelections: ()=>{
      const anchorSelect = sticky.querySelector('.ao-select');
      const anchorTs = anchorSelect && anchorSelect.value ? Number(anchorSelect.value) : null;
      return { mode:"continuous", anchorTs, inflowRows: inRows.map(r=>r.collect()), emberRows: outRows.map(r=>r.collect()),
        creditMode: (document.getElementById('srCreditMode')?.value || SR_CREDIT_MODE || 'essence')
       };
    }
  };
}

// ───────────────────────────────── PHASE: FINITE (placeholder) ─────────────────────────────────
function renderFinitePhase(bodyHost){
  bodyHost.innerHTML='';
  const sticky = document.getElementById('srSticky');
  renderFiniteSticky(sticky);

  const card = el('div','ao-tile', `
    <h3 style="margin:0 0 8px;">Finite mode</h3>
    <p class="sr-sub">Seed/duration/replenishment screen will live here (placeholder).</p>
  `);
  bodyHost.append(card);

  return { collectSelections: ()=>({ mode:"finite", anchorTs:null, inflowRows:[], emberRows:[] }) };
}

// ───────────────────────────────── PUBLIC API ─────────────────────────────────
export async function openSmartReviewOverlay(){
  ensureStyles();

  const overlay = document.createElement('div'); overlay.id='emOverlay';
  const wrap = document.createElement('section'); wrap.id='srWrap';

  const top = document.createElement('div'); top.id='srTop';
  top.innerHTML = `
    <div id="srTopInner">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <h2 style="margin:0">Energy</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="btnConnect" class="pill btnPrimary">Disconnect bank</button>
          <button id="pill-cont" class="pill active">Continuous</button>
          <button id="pill-fin"  class="pill">Finite</button>
        </div>
      </div>
      <div id="srSticky"></div>
    </div>
  `;
  const body = document.createElement('div'); body.id='srBody';
  const actions = document.createElement('div'); actions.className='sr-actions';
  actions.innerHTML = `
    <button id="srBack" class="pill">Back</button>
    <button id="srApply" class="pill">Apply & Continue</button>
  `;
  wrap.append(top, body, actions); overlay.append(wrap); document.body.appendChild(overlay);

  // refs
  const back = actions.querySelector('#srBack');
  const apply= actions.querySelector('#srApply');

  const btnConnect = top.querySelector("#btnConnect");
  const pillC= top.querySelector('#pill-cont');
  const pillF= top.querySelector('#pill-fin');

  // state
  let mode='continuous';
  let phaseApi={ collectSelections: ()=>({ mode, anchorTs:null, inflowRows:[], emberRows:[] }) };

  // Connection Button
  btnConnect.onclick = ()=>{
    disconnectBank(overlay)
  };

  async function setMode(m){
    mode=m; pillC.classList.toggle('active', m==='continuous'); pillF.classList.toggle('active', m==='finite');
    if (m==='finite'){ phaseApi = renderFinitePhase(body); return; }

    body.innerHTML = `<div class="ao-tile">Analysing your transactions…</div>`;
    try{
      const uid = getAuth().currentUser?.uid; if (!uid) throw new Error("Not signed in");
      await readVerifiedCoreCreditMode(uid);
      let analysis=null;
      if (SR_CFG.useBackendAnalyze){
        const idToken = await getAuth().currentUser.getIdToken();
        const res = await fetch(SR_CFG.endpoints.analyzeUrl, { method:"GET", headers:{ Authorization:"Bearer "+idToken }});
        analysis = await res.json(); if (!res.ok || analysis?.error) throw new Error(analysis?.error || "analyze_failed");
      } else {
        analysis = await analyzeClient(uid);
      }
      phaseApi = renderContinuousPhase(body, analysis);
    } catch(e){
      body.innerHTML = `<div class="ao-tile">Could not analyse data. ${e?.message||e}</div>`;
      phaseApi = { collectSelections: ()=>({ mode, anchorTs:null, inflowRows:[], emberRows:[] }) };
    }
  }

  setMode('continuous');
  pillC.onclick = ()=> setMode('continuous');
  pillF.onclick = ()=> setMode('finite');

  back.onclick = ()=>{ 
    overlay.remove(); 
    document.getElementById('sr-styles')?.remove();
    window.dispatchEvent(new CustomEvent("energyMenu:closed"));
    window.dispatchEvent(new CustomEvent('smartReview:closed')); 
  };

  apply.onclick = async ()=>{
    try{
      const state = phaseApi.collectSelections();
      if (state.mode==='continuous'){
        const incMo = state.inflowRows.filter(x=>x.include).reduce((s,x)=>s+x.monthly,0);
        const outMo = state.emberRows .filter(x=>x.include).reduce((s,x)=>s+x.monthly,0);
        if (outMo > incMo){
          alert(`Your Emberward exceeds your Energy Source. Adjust selections or switch to Finite.\nNet: ${GBP(incMo - outMo)}/mo`);
          return;
        }
      }
      await saveSelections(state);
      await refreshVitalsHUD(getAuth().currentUser.uid, { recompute: true });
      overlay.remove(); 
      document.getElementById('sr-styles')?.remove();
      window.dispatchEvent(new CustomEvent("energyMenu:closed"));
      window.dispatchEvent(new CustomEvent('smartReview:closed'));
      window.dispatchEvent(new CustomEvent('cashflow:updated', { detail:{ source:'smartReview' } }));
    }catch(e){ alert("Could not save your Smart Review. " + (e?.message||e)); }
  };

  return true;
}

export function showSmartReviewAfterTrueLayer(){ localStorage.setItem('showSmartReviewOnce','1'); }
export function maybeOpenSmartReviewOnLoad(){
  if (localStorage.getItem('showSmartReviewOnce') === '1'){
    localStorage.removeItem('showSmartReviewOnce');
    setModeToVerified()
    openSmartReviewOverlay().catch(console.error);
  }
}

// Adapter export for the Energy Menu router
export function openEnergyVerified(/* uid optional */) {
  // openSmartReviewOverlay comes from this file's implementation
  return openSmartReviewOverlay();
}

// ----------------------- STUBS / In Progress functions -----------------------------
export async function setModeToVerified(){
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    console.warn("[EnergyMenu] No user logged in.");
    return;
  }
  const uid = user.uid;

  const db = getFirestore();
  await setDoc(doc(db, `players/${uid}`), {
    transactionMode: "verified",
  }, { merge:true });
}

export async function getTransactionMode(){
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    console.warn("[EnergyMenu] No user logged in.");
    return;
  }
  const uid = user.uid;

  const db = getFirestore();
  const snap = await getDoc(doc(db, "players", uid));
  let mode = null
  mode = snap.exists() ? snap.data()?.transactionMode : null;

  return mode
}

export async function disconnectBank(overlay) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    console.warn("[EnergyMenu] No user logged in.");
    return;
  }
  const uid = user.uid;
  const db = getFirestore();

  // Check if mode is not already unverified
  const snap = await getDoc(doc(db, "players", uid));
  let mode = "verified"
  mode = snap.exists() ? snap.data()?.transactionMode : "verified";

  if (mode === "verified"){
    // Player asked to select if they just want to revoke access and switch mode, or also purge (placheolder for now)

  }

  await setDoc(doc(db, `players/${uid}`), {
    transactionMode: "unverified",
  }, { merge:true });

  // Switch to energy-unverified / re-open energy-menu after doc update
  // Close overlay and re-open
    overlay.remove(); 
    document.getElementById('sr-styles')?.remove();
    window.dispatchEvent(new CustomEvent("energyMenu:closed"));
    window.dispatchEvent(new CustomEvent('smartReview:closed'));
  openEnergyMenu()
}

async function readVerifiedCoreCreditMode(uid){
  const db = getFirestore();
  try{
    const snap = await getDoc(doc(db, `players/${uid}/financialData/cashflowData/verified/core`));
    if (snap.exists()){
      const data = snap.data() || {};
      if (data.creditMode) SR_CREDIT_MODE = String(data.creditMode);
    }
  }catch(e){ /* silent */ }
}


// ────────────────────────── STUB: apply classifications by txId ──────────────────────────
// Expects rows as built by this file (with row.txIds). Uses writeBatch for speed.
async function stubApplyClassificationsByIds(uid, { inflowRows = [], emberRows = [] }, onProgress /* (done,total) */) {
  const db = getFirestore();

  // Build flat list of { txId, update }
  const updates = [];

  // Included inflows → classification=coreInflow
  for (const r of inflowRows) {
    const desired = r.include ? 'coreInflow' : null;
    const label = r.label || r.name || 'Other';
    const ids = Array.isArray(r.txIds) ? r.txIds : [];
    for (const txId of ids) {
      if (!txId) continue;
      if (desired) {
        updates.push({ txId, data: { classification: desired, groupLabel: label } });
      } else {
        updates.push({ txId, data: { classification: deleteField(), groupLabel: deleteField() } });
      }
    }
  }

  // Included outflows → classification=coreOutflow (else clear)
  for (const r of emberRows) {
    const desired = r.include ? 'coreOutflow' : null;
    const label = r.label || r.name || 'Other';
    const ids = Array.isArray(r.txIds) ? r.txIds : [];
    for (const txId of ids) {
      if (!txId) continue;
      if (desired) {
        updates.push({ txId, data: { classification: desired, groupLabel: label } });
      } else {
        updates.push({ txId, data: { classification: deleteField(), groupLabel: deleteField() } });
      }
    }
  }

  if (!updates.length) {
    onProgress?.(1, 1);
    return;
  }

  // Batch in chunks of 500 (Firestore limit)
  const BATCH_LIMIT = 500;
  let done = 0;
  const total = updates.length;

  while (done < total) {
    const batch = writeBatch(db);
    const slice = updates.slice(done, done + BATCH_LIMIT);
    for (const u of slice) {
      const ref = doc(db, `players/${uid}/financialData/processedTransactions/verified`, u.txId);
      batch.update(ref, u.data);
    }
    await batch.commit();
    done += slice.length;
    onProgress?.(done, total);
  }
}

// ───────────────────────────────── PROGRESS UI (stub) ─────────────────────────────────
function showApplyProgress() {
  let wrap = document.getElementById('srProgressWrap');
  if (wrap) return wrap;

  wrap = document.createElement('div');
  wrap.id = 'srProgressWrap';
  wrap.style.position = 'fixed';
  wrap.style.inset = '0';
  wrap.style.background = 'rgba(0,0,0,.35)';
  wrap.style.zIndex = '10000';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.innerHTML = `
    <div style="width:min(420px,84vw);padding:14px;border-radius:12px;border:1px solid #2a3a55;background:#0f1118;color:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong>Applying selections…</strong>
        <span id="srProgressPct" style="opacity:.9">0%</span>
      </div>
      <div style="height:8px;background:#1f2937;border-radius:999px;overflow:hidden">
        <div id="srProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#06b6d4)"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  return wrap;
}
function updateApplyProgress(pct) {
  const bar = document.getElementById('srProgressBar');
  const txt = document.getElementById('srProgressPct');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (txt) txt.textContent = `${Math.max(0, Math.min(100, Math.round(pct)))}%`;
}
function hideApplyProgress() {
  const wrap = document.getElementById('srProgressWrap');
  if (wrap) wrap.remove();
}






