// smartreview.js — self-contained Smart Review overlay (frontend)
//
// What this file does:
// - Opens a full-screen overlay on any page (dashboard, callback, etc.)
// - Phase 1: mode pills (Continuous / Finite). Finite shows a placeholder for now.
// - Phase 2 (Continuous): grouped inflow/outflow suggestions from processed verified txns
//   with include toggles, label edits, category dropdowns, cadence selector,
//   persistent summary bar (Energy, Ember, Net) incl. daily/weekly/monthly,
//   anchor pay-day selector (last 30d, confidence >= threshold, amount >= min).
// - Phase 3 (Continuous): Auto backfill tagging shell (single-button auto-assign + toggle to include already-tagged)
// - Undo/Redo, telemetry hooks, conflict check shell
// - Save: either call backend endpoints OR write rails stub (and optionally call recomputeRails)
// - No backend imports; Firestore path discovery is resilient (items subcollection or root).
//
// Dependencies: Firebase Auth + Firestore V11 ESM URLs.

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDocs, collection, Timestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ---------------------------------------------------------------------------
// CONFIG (edit here, not below)
// ---------------------------------------------------------------------------
const SR_CFG = {
  // Feature toggles (flip as your backend catches up)
  useBackendAnalyze: false,   // GET/POST SR analysis endpoint (server generates groups)
  useBackendSave:    false,   // POST SR selections endpoint (server persists choices + rails)
  callRecompute:     true,    // POST recomputeRails endpoint after save
  devWriteRailsStub: false,    // write cashflowData/* locally for fast UI iteration

  // Endpoints (only used when the flags above are true)
  endpoints: {
    analyzeUrl:    "https://smartreview-analyze-frxqsvlhwq-nw.a.run.app",
    saveUrl:       "https://smartreview-save-frxqsvlhwq-nw.a.run.app",
    recomputeUrl:  "https://recomputerails-frxqsvlhwq-nw.a.run.app",
  },

  // Analyzer params (match your backend config if/when enabled)
  lookbackMonthsFetch: 36,    // fetch data horizon
  lookbackMonthsGroup: 12,    // only group items that occurred within this window
  minOccurrences: 2,          // allow yearly detection
  minConfidenceForAnchor: 0.25,
  minAnchorAmountMajor: 20,   // filter very small "income" edges (configurable)
  excludeNonLiquid: true,     // will omit mortgage-like categories from suggestions
  defaultExcludeCreditCard: true,

  // Categories
  incomeCategories: ["Salary","Bonus","Stipend","Pension","Other"],
  emberCategories:  ["Shelter","Energy","Internet","Insurance","Council Tax","Loan","Phone","Other"],

  // Telemetry hook (you can wire this to your analytics)
  onTelemetry: (eventName, payload)=>{ /* console.log("[SR]", eventName, payload); */ },

  // Conflict detection toggle
  conflictCheck: true,

  // UI bits
  showConfidenceBadges: false,  // easy toggle
};

// ---------------------------------------------------------------------------
// STYLE
// ---------------------------------------------------------------------------
function ensureStyles(){
  if (document.getElementById('sr-styles')) return;
  const css = `
  #srOverlay{position:fixed;inset:0;background:rgba(6,8,12,.88);backdrop-filter:saturate(120%) blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;}
  #srWrap{width:min(1120px,94vw);max-height:94vh;overflow:auto;padding:16px;border:1px solid #273142;border-radius:16px;background:#0f1118;color:#fff;box-shadow:0 20px 80px rgba(0,0,0,.5)}
  #srWrap h2{margin:0 0 8px;font-size:20px}
  .sr-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
  .pill{padding:6px 10px;border-radius:999px;border:1px solid #2a3a55;background:#0d1220;color:#fff}
  .pill.active{outline:2px solid #3b82f6}
  .sr-summary{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin:8px 0 12px}
  .sr-totals{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .sr-kpi{display:flex;gap:10px;align-items:center}
  .kbox{border-radius:10px;padding:8px 12px;background:#111827;border:1px solid #1f2937}
  .green{color:#10b981} .red{color:#ef4444} .muted{opacity:.8}
  .bar{height:18px;border-radius:12px;background:#1f2937;overflow:hidden;min-width:260px}
  .bar>div{height:100%;width:0%}
  .bar .pos{background:linear-gradient(90deg,#22c55e,#06b6d4)}
  .bar .neg{background:linear-gradient(90deg,#ef4444,#f59e0b)}
  .sr-sub{font-size:12px;opacity:.85}
  .sr-subgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
  .anchor-box{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .anchor-badge{padding:4px 8px;border-radius:999px;border:1px solid #2a3a55;background:#0d1220;cursor:pointer}
  .anchor-badge.active{outline:2px solid #3b82f6}
  .sr-tabs{display:flex;gap:8px;margin:8px 0}
  .tab{padding:6px 10px;border:1px solid #2a3a55;border-radius:8px;background:#0d1220;color:#fff}
  .tab.active{outline:2px solid #3b82f6}
  .sr-list{display:flex;flex-direction:column;gap:8px}
  .ao-tile{border:1px solid #223044;border-radius:12px;padding:10px;background:#121626}
  .row-top{display:grid;grid-template-columns:1fr auto;align-items:center}
  .ao-input,.ao-select{width:100%;padding:8px;border-radius:8px;border:1px solid #2a3a55;background:#0d1220;color:#fff}
  .row-grid{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-top:8px}
  .tiny{font-size:11px;opacity:.7}
  .toolbar{display:flex;gap:8px;margin:8px 0}
  `;
  const style=document.createElement('style');
  style.id='sr-styles';
  style.textContent=css;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------
const GBP = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);
const DAYS = 86400000;
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };

function el(tag, cls, html){ const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; }
function button(text, cls='pill'){ const b=document.createElement('button'); b.className=cls; b.textContent=text; return b; }

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

// ---------------------------------------------------------------------------
// DATA LOADING (processed verified)
// Tries BOTH shapes: .../verified/items and .../verified
// ---------------------------------------------------------------------------
async function loadProcessedVerified(uid, monthsFetch){
  const db = getFirestore();
  const sinceMs = Date.now() - monthsFetch*30.44*DAYS;

  const tryColl = [
    collection(db, `players/${uid}/financialData/processedTransactions/verified`)
  ];

  for (const coll of tryColl){
    try {
      const qs = await getDocs(coll);
      const arr = [];
      qs.forEach(d => {
        const x = d.data() || {};
        const ts = x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? 0;
        if (ts >= sinceMs) arr.push({ id: d.id, ...x, ts });
      });
      if (arr.length) return arr;
    } catch (_) {}
  }
  return [];
}

// ---------------------------------------------------------------------------
// ANALYZER (client-side fallback; mirrors backend intentions)
// - Fetch 36m, group from last 12m only (configurable)
// - cadence detection (simple for now; monthly default), confidence score
// - include/exclude suggestion rules (mortgage, cc, etc.)
// - anchor date candidates in last 30d (confidence >= threshold, amt >= min)
// ---------------------------------------------------------------------------
function detectCadence(occ){
  if (occ.length < SR_CFG.minOccurrences) return { cadence: 'monthly', fit: 0.3, hits: 0 };
  const deltas = [];
  for (let i=1;i<occ.length;i++) deltas.push((occ[i].ts - occ[i-1].ts)/DAYS);
  deltas.sort((a,b)=>a-b);
  const med = deltas[Math.floor(deltas.length/2)] || 30;
  const bands = [
    {key:'weekly',center:7,tol:2},
    {key:'fortnightly',center:14,tol:2},
    {key:'monthly',center:30,tol:4},
    {key:'quarterly',center:91,tol:10},
    {key:'yearly',center:365,tol:30},
  ];
  let best={cadence:'monthly',fit:0,hits:0};
  for (const b of bands){
    const hits = deltas.filter(d=>Math.abs(d-b.center)<=b.tol).length;
    const fit = hits / Math.max(1,deltas.length);
    if (fit>best.fit) best={cadence:b.key,fit,hits};
  }
  return best;
}

function representative(occ){
  const vals = occ.map(o=>Math.abs(o.amt)).sort((a,b)=>a-b);
  return vals[Math.floor(vals.length/2)] || 0;
}

function suggestInclude(name, kind){
  const n = name.toLowerCase();
  if (SR_CFG.excludeNonLiquid && /mortgage/.test(n)) return false;
  if (SR_CFG.defaultExcludeCreditCard && /credit\s*card/.test(n)) return false;
  return true;
}

function buildGroups(processed, monthsGroup){
  const cutoff = Date.now() - monthsGroup*30.44*DAYS;
  // Build tx array with signed major, normalised name
  const txs = processed
    .map(x => {
      const amt = Number(x.amount ?? x.amountMajor ?? 0);
      const td = x.transactionData || {};
      const name = normName(td.description || td.merchantName || x.label || x.counterparty || '');
      return { ts: x.ts, amt, name };
    })
    .filter(t => Number.isFinite(t.ts) && t.ts >= cutoff);

  // Group
  const map = new Map();
  for (const t of txs){
    const kind = t.amt >= 0 ? 'inflow' : 'ember';
    const key = `${t.name}|${kind}`;
    if (!map.has(key)) map.set(key, { name: t.name, kind, occ: [] });
    map.get(key).occ.push({ ts: t.ts, amt: Math.abs(t.amt) });
  }
  map.forEach(g => g.occ.sort((a,b)=>a.ts-b.ts));

  // Summarise
  const items = [];
  for (const g of map.values()){
    const cad = detectCadence(g.occ);
    const rep = representative(g.occ);
    const hits = g.occ.length;
    const confidence = Math.min(1, (0.6*cad.fit) + (0.4*Math.min(1, hits/6)));
    items.push({
      id: g.name + '|' + (g.kind==='inflow'?'in':'out'),
      name: g.name,
      kind: g.kind,
      cadence: cad.cadence,
      representative: Number(rep.toFixed(2)),
      txCount: hits,
      confidence
    });
  }
  const inflow = items.filter(i=>i.kind==='inflow').sort((a,b)=>b.confidence-a.confidence);
  const ember  = items.filter(i=>i.kind==='ember') .sort((a,b)=>b.confidence-a.confidence);

  // Anchor candidates (last 30d, inflow, above thresholds)
  const thirtyDaysAgo = Date.now() - 30*DAYS;
  const anchorCandidates = [];
  for (const i of inflow){
    if (i.confidence < SR_CFG.minConfidenceForAnchor) continue;
    const occ30 = i.occ?.filter ? i.occ.filter(o=>o.ts>=thirtyDaysAgo) : null;
    // If original occ not carried, derive by re-scanning txs of this group:
    const occTarget = occ30 || txs.filter(t=>t.name===i.name && t.amt>=0 && t.ts>=thirtyDaysAgo).map(t=>({ts:t.ts,amt:t.amt}));
    for (const o of occTarget){
      if (o.amt >= SR_CFG.minAnchorAmountMajor) anchorCandidates.push({ ts:o.ts, label:i.name, amount:o.amt, conf:i.confidence });
    }
  }
  anchorCandidates.sort((a,b)=>b.amount-a.amount || b.ts-a.ts);
  return { inflow, ember, anchorCandidates };
}

async function analyzeClient(uid){
  const raw = await loadProcessedVerified(uid, SR_CFG.lookbackMonthsFetch);
  return buildGroups(raw, SR_CFG.lookbackMonthsGroup);
}

// ---------------------------------------------------------------------------
// SAVE (either backend or local stub), then optional recompute
// ---------------------------------------------------------------------------
async function saveSelections({ mode, anchorTs, inflowRows, emberRows }){
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();
  const uid = user.uid;
  const db = getFirestore();

  // Fold into monthly totals + category maps (label = bucket)
  const ins = inflowRows.filter(x=>x.include);
  const outs= emberRows .filter(x=>x.include);

  const incomeMo = ins.reduce((s,x)=>s+(x.monthly||0),0);
  const emberMo  = outs.reduce((s,x)=>s+(x.monthly||0),0);
  const incCats = {}; ins .forEach(x=> incCats[x.category||x.label] = (incCats[x.category||x.label]||0) + (x.monthly||0));
  const outCats = {}; outs.forEach(x=> outCats[x.category||x.label] = (outCats[x.category||x.label]||0) + (x.monthly||0));

  if (SR_CFG.useBackendSave){
    const res = await fetch(SR_CFG.endpoints.saveUrl, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization: "Bearer " + idToken },
      body: JSON.stringify({
        mode, anchorMs: anchorTs || null,
        inflow: { totalMonthly: incomeMo, categories: incCats, selections: ins },
        ember:  { totalMonthly: emberMo,  categories: outCats, selections: outs },
        client: { userAgent: navigator.userAgent, ts: Date.now() }
      })
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok || json?.error) throw new Error(json?.error || "save_failed");
  } else if (SR_CFG.devWriteRailsStub) {
    const now = Date.now();
    await setDoc(doc(db, `players/${uid}/cashflowData/verified`), {
      itemised_inflow:  { total: Number(incomeMo.toFixed(2)),  categories: incCats,  cadence:"monthly", updatedAt: now },
      itemised_outflow: { total: Number(emberMo.toFixed(2)),   categories: outCats, cadence:"monthly", updatedAt: now },
      updatedAt: now
    }, { merge: true });

    // Mirror into active (so dashboard shows it at once)
    await setDoc(doc(db, `players/${uid}/cashflowData/active`), {
      mode: "continuous", cadence:"monthly",
      inflow:{ total: Number(incomeMo.toFixed(2)), categories: incCats },
      outflow:{ total: Number(emberMo.toFixed(2)), categories: outCats },
      updatedAt: now
    }, { merge: true });
  }

  if (SR_CFG.callRecompute){
    try {
      const res = await fetch(SR_CFG.endpoints.recomputeUrl, {
        method: "POST",
        headers: { Authorization: "Bearer " + idToken }
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) console.warn("recompute failed", json);
    } catch (e) { console.warn("recompute error", e?.message||e); }
  }

  SR_CFG.onTelemetry("save_ok", { mode, incomeMo, emberMo, anchorTs });
}

// ---------------------------------------------------------------------------
// UI (overlay, phases, undo/redo, conflict shell)
// ---------------------------------------------------------------------------
function buildRowUI(group, kind){
  const row = el('div','ao-tile');
  const top = el('div','row-top');
  const left = el('div', '', `<strong>${group.name || 'unknown'}</strong><div class="sr-sub">${group.txCount} hits${SR_CFG.showConfidenceBadges ? ` • conf ${(group.confidence*100|0)}%` : ''}</div>`);
  const include = document.createElement('input'); include.type='checkbox'; include.checked = suggestInclude(group.name, kind);
  const rightTop = el('div','', `<span class="tiny muted">${kind==='inflow'?'Energy':'Ember'}</span>`);
  top.append(left, rightTop);

  const label = document.createElement('input'); label.className='ao-input'; label.placeholder = kind==='inflow' ? 'Label (e.g., Salary)' : 'Label (e.g., Rent)'; label.value = group.name || '';
  const category = document.createElement('select'); category.className='ao-select';
  const cats = (kind==='inflow'? SR_CFG.incomeCategories : SR_CFG.emberCategories);
  cats.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; category.append(o); });
  category.value = cats.includes(group.name?.[0]?.toUpperCase()+group.name?.slice(1)) ? group.name : "Other";

  const cadence = document.createElement('select'); cadence.className='ao-select';
  ["weekly","fortnightly","monthly","quarterly","yearly","daily"].forEach(v=>{
    const o=document.createElement('option'); o.value=v; o.textContent=v[0].toUpperCase()+v.slice(1); cadence.append(o);
  });
  cadence.value = group.cadence || "monthly";

  const monthly = el('div','sr-sub', `${GBP((group.representative||0) * MONTHLY_MULT[cadence.value])}/mo`);
  cadence.addEventListener('change', ()=> {
    monthly.textContent = `${GBP((group.representative||0) * MONTHLY_MULT[cadence.value])}/mo`;
  });

  const grid = el('div','row-grid');
  const incWrap = el('div','',`<label class="sr-sub">Include</label>`); incWrap.append(include);
  grid.append(
    el('div','',`<label class="sr-sub">Label</label>`), label,
    el('div','',`<label class="sr-sub">Category</label>`), category,
    el('div','',`<label class="sr-sub">Cadence</label>`), cadence,
    el('div','',`<label class="sr-sub">Monthly</label>`), monthly,
    el('div','',``), incWrap
  );

  row.append(top, grid);

  return {
    node: row,
    collect: () => ({
      id: group.id,
      name: group.name,
      label: label.value.trim() || group.name || '',
      category: category.value || 'Other',
      cadence: cadence.value,
      representative: Number(group.representative || 0),
      monthly: Number(((group.representative || 0) * MONTHLY_MULT[cadence.value]).toFixed(2)),
      include: include.checked,
      classAs: kind
    })
  };
}

function renderContinuousPhase(host, analysis){
  host.innerHTML = '';

  // Summary
  const summary = document.createElement('div'); summary.className='sr-summary';
  const totals = document.createElement('div'); totals.className='sr-totals';
  const k1 = el('div','sr-kpi'); const lEng = el('div','kbox','Energy Source'); const vEng = el('div','kbox green','£0/mo'); k1.append(lEng,vEng);
  const k2 = el('div','sr-kpi'); const lEmb = el('div','kbox','Emberward');    const vEmb = el('div','kbox red','£0/mo');  k2.append(lEmb,vEmb);
  const k3 = el('div','sr-kpi'); const lNet = el('div','kbox','Net per month'); const vNet = el('div','kbox','£0/mo');     k3.append(lNet,vNet);
  totals.append(k1,k2,k3);
  const bar = el('div','bar'); const fill = el('div','pos'); bar.append(fill);
  summary.append(totals, bar);

  // Daily/Weekly row below
  const subgrid = el('div','sr-subgrid');
  const dailyBox  = el('div','kbox','Daily: £0');  const weeklyBox = el('div','kbox','Weekly: £0');
  subgrid.append(dailyBox, weeklyBox);
  // Anchor section
  const anchorWrap = el('div','anchor-box');
  const anchorLabel = el('div','sr-sub','Anchor date:');
  const anchorList = el('div'); anchorWrap.append(anchorLabel, anchorList);
  // Append summary bits
  host.append(summary, subgrid, anchorWrap);

  // Tabs
  const tabs = el('div','sr-tabs');
  const tabIn  = el('button','tab active', 'Energy Source');
  const tabOut = el('button','tab',         'Emberward');
  tabs.append(tabIn, tabOut);
  host.append(tabs);

  // List
  const list = el('div','sr-list');
  host.append(list);

  // Build rows
  const inRows = (analysis.inflow||[]).map(g=>buildRowUI(g,'inflow'));
  const outRows= (analysis.ember ||[]).map(g=>buildRowUI(g,'ember'));

  // Anchor candidates UI
  let selectedAnchorTs = null;
  anchorList.innerHTML = '';
  const candidates = (analysis.anchorCandidates||[]).slice(0,15);
  if (!candidates.length){
    anchorList.append(el('div','sr-sub','No suitable inflow found in last 30 days. You can continue, but regen timing may be off.'));
  } else {
    candidates.forEach((c, idx) => {
      const d = new Date(c.ts); const label = `${d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} · ${c.label} · ${GBP(c.amount)}`;
      const b = el('span','anchor-badge', label);
      b.onclick = () => {
        selectedAnchorTs = c.ts;
        [...anchorList.querySelectorAll('.anchor-badge')].forEach(n=>n.classList.remove('active'));
        b.classList.add('active');
      };
      if (idx===0){ b.classList.add('active'); selectedAnchorTs = c.ts; }
      anchorList.append(b);
    });
  }

  // Undo/Redo state (very light — stores last 20 payloads)
  const history = []; let histIdx = -1;
  function pushHistory(){
    const payload = collectSelections();
    history.splice(histIdx+1); history.push(JSON.stringify(payload)); histIdx = history.length-1;
  }
  function undo(){ if (histIdx<=0) return; histIdx--; applyState(JSON.parse(history[histIdx])); }
  function redo(){ if (histIdx>=history.length-1) return; histIdx++; applyState(JSON.parse(history[histIdx])); }

  // Toolbar (Undo/Redo + Include locked toggle for backfill, etc.)
  const toolbar = el('div','toolbar');
  const btnUndo = button('Undo'); const btnRedo = button('Redo');
  toolbar.append(btnUndo, btnRedo);
  host.insertBefore(toolbar, list);

  btnUndo.onclick = undo; btnRedo.onclick = redo;

  function recalc(){
    const ins  = inRows .map(r=>r.collect()).filter(x=>x.include);
    const outs = outRows.map(r=>r.collect()).filter(x=>x.include);
    const incMo = ins .reduce((s,x)=>s+(x.monthly||0),0);
    const outMo = outs.reduce((s,x)=>s+(x.monthly||0),0);
    vEng.textContent = GBP(incMo) + '/mo';
    vEmb.textContent = GBP(outMo) + '/mo';
    vNet.textContent = GBP(incMo - outMo) + '/mo';
    fill.style.width = Math.max(0, Math.min(100, incMo? ((incMo-outMo)/incMo*100):0)) + '%';
    fill.className = (incMo - outMo >= 0) ? 'pos' : 'neg';
    const netDaily = Number(((incMo - outMo)/MONTHLY_MULT.daily).toFixed(2));
    const netWeekly= Number(((incMo - outMo)/MONTHLY_MULT.weekly).toFixed(2));
    dailyBox.textContent = `Daily: ${GBP(netDaily)}`; weeklyBox.textContent = `Weekly: ${GBP(netWeekly)}`;
  }
  function show(kind){
    tabIn.classList.toggle('active', kind==='in');
    tabOut.classList.toggle('active', kind==='out');
    list.innerHTML=''; (kind==='in'?inRows:outRows).forEach(r=>list.append(r.node));
    recalc();
    pushHistory();
  }
  function collectSelections(){
    return {
      mode: "continuous",
      anchorTs: selectedAnchorTs || null,
      inflowRows: inRows.map(r=>r.collect()),
      emberRows:  outRows.map(r=>r.collect())
    };
  }
  function applyState(state){
    // Minimal: re-apply include/category/cadence where we can match by id
    const byId = new Map();
    state.inflowRows?.forEach(x=>byId.set(x.id,x));
    state.emberRows ?.forEach(x=>byId.set(x.id,x));
    [...inRows, ...outRows].forEach(r=>{
      const s = byId.get(r.collect().id);
      if (!s) return;
      // Quick re-inflate by simulating UI changes:
      const now = r.collect();
      if (now.include !== s.include) r.node.querySelector('input[type=checkbox]').checked = s.include;
      const sels = r.node.querySelectorAll('select');
      // [category, cadence] ordering from buildRowUI:
      if (sels[0]?.value !== s.category) sels[0].value = s.category;
      if (sels[1]?.value !== s.cadence)  { sels[1].value = s.cadence; sels[1].dispatchEvent(new Event('change')); }
    });
    selectedAnchorTs = state.anchorTs || null;
    [...anchorList.querySelectorAll('.anchor-badge')].forEach(n=>n.classList.remove('active'));
    if (selectedAnchorTs){
      const first = anchorList.querySelector('.anchor-badge'); if (first) first.classList.add('active');
    }
    recalc();
  }

  tabIn.onclick = ()=> show('in');
  tabOut.onclick= ()=> show('out');
  show('in'); // initial

  return { collectSelections, recalc };
}

function renderFinitePhase(host){
  host.innerHTML='';
  const card = el('div','ao-tile',
    `<h3 style="margin:0 0 8px;">Finite mode</h3>
     <p class="sr-sub">Seed/duration/replenishment screen will live here (placeholder). You can still save to switch modes.</p>`);
  host.append(card);

  return {
    collectSelections: ()=>({ mode:"finite", anchorTs:null, inflowRows:[], emberRows:[] })
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------
export async function openSmartReviewOverlay(){
  ensureStyles();
  const overlay = el('div','', ''); overlay.id='srOverlay';
  const wrap = el('section','', `
    <h2>Smart Review</h2>
    <div style="display:flex;gap:8px;margin:8px 0 12px">
      <button id="pill-cont" class="pill active">Continuous</button>
      <button id="pill-fin"  class="pill">Finite</button>
    </div>
    <div id="srBody"><div class="ao-tile">Loading…</div></div>
    <div class="sr-actions">
      <button id="srBack">Back</button>
      <button id="srApply" class="pill">Apply & Continue</button>
    </div>
  `);
  wrap.id='srWrap';
  overlay.append(wrap);
  document.body.appendChild(overlay);

  const body = wrap.querySelector('#srBody');
  const back = wrap.querySelector('#srBack');
  const apply= wrap.querySelector('#srApply');
  const pillC= wrap.querySelector('#pill-cont');
  const pillF= wrap.querySelector('#pill-fin');

  let mode='continuous';
  let phaseApi={ collectSelections: ()=>({ mode, anchorTs:null, inflowRows:[], emberRows:[] }) };

  async function setMode(m){
    mode=m; pillC.classList.toggle('active', m==='continuous'); pillF.classList.toggle('active', m==='finite');
    if (m==='finite'){
      phaseApi = renderFinitePhase(body);
      SR_CFG.onTelemetry("mode_set",{mode});
      return;
    }
    // Continuous: load analysis (backend or client)
    body.innerHTML = `<div class="ao-tile">Analysing your transactions…</div>`;
    try{
      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error("Not signed in");
      let analysis = null;

      if (SR_CFG.useBackendAnalyze){
        const idToken = await getAuth().currentUser.getIdToken();
        const res = await fetch(SR_CFG.endpoints.analyzeUrl, {
          method: "GET", headers: { Authorization: "Bearer " + idToken }
        });
        analysis = await res.json();
        if (!res.ok || analysis?.error) throw new Error(analysis?.error || "analyze_failed");
      } else {
        analysis = await analyzeClient(uid);
      }

      phaseApi = renderContinuousPhase(body, analysis);
      SR_CFG.onTelemetry("analysis_ok",{ mode, counts: { in: analysis.inflow?.length||0, out: analysis.ember?.length||0 } });
    } catch (e) {
      body.innerHTML = `<div class="ao-tile">Could not analyse data. ${e?.message||e}</div>`;
      SR_CFG.onTelemetry("analysis_fail",{ mode, error: e?.message||String(e) });
      phaseApi = { collectSelections: ()=>({ mode, anchorTs:null, inflowRows:[], emberRows:[] }) };
    }
  }

  pillC.onclick = ()=> setMode('continuous');
  pillF.onclick = ()=> setMode('finite');
  setMode('continuous');

  back.onclick = ()=>{
    overlay.remove();
    window.dispatchEvent(new CustomEvent('smartReview:closed'));
  };

  apply.onclick = async ()=>{
    try{
      const state = phaseApi.collectSelections();

      // Guardrail: in continuous, block if Ember > Energy
      if (state.mode==='continuous'){
        const incMo = state.inflowRows.filter(x=>x.include).reduce((s,x)=>s+x.monthly,0);
        const outMo = state.emberRows .filter(x=>x.include).reduce((s,x)=>s+x.monthly,0);
        if (outMo > incMo){
          alert(`Your Emberward exceeds your Energy Source. Consider adjusting, or switch to Finite mode.\nNet: ${GBP(incMo - outMo)}/mo`);
          return;
        }
      }

      await saveSelections(state);
      SR_CFG.onTelemetry("apply_ok", {mode: state.mode});
      overlay.remove();
      window.dispatchEvent(new CustomEvent('cashflow:updated', { detail:{ source:'smartReview' } }));
    } catch(e){
      SR_CFG.onTelemetry("apply_fail", { error: e?.message||String(e) });
      alert("Could not save your Smart Review. " + (e?.message||e));
    }
  };

  return true;
}

// Helpers to wire SR after TL flow or on page load
export function showSmartReviewAfterTrueLayer(){ localStorage.setItem('showSmartReviewOnce','1'); }
export function maybeOpenSmartReviewOnLoad(){
  if (localStorage.getItem('showSmartReviewOnce') === '1'){
    localStorage.removeItem('showSmartReviewOnce');
    openSmartReviewOverlay().catch(console.error);
  }
}
