// smartreview.js — Smart Review overlay (frontend) — v6
// - Mobile-safe (no horizontal scroll)
// - Anchor label + dropdown on same row
// - Net (monthly) spans 2 rows on the left; Daily (top-right) + Weekly (bottom-right)
// - Tabs fill full width (two equal buttons)
// - Group row: Label | Category (equal width); bottom row Cadence | Avg | Monthly | Include (right)
// - Live summary totals; select/unselect-all per tab; unique anchor dates
// - Stub + endpoint flags preserved; recompute trigger preserved

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const SR_CFG = {
  // I/O toggles
  useBackendAnalyze: false,
  useBackendSave:    false,
  callRecompute:     true,
  devWriteRailsStub: true,

  // Endpoints (used when flags above are true)
  endpoints: {
    analyzeUrl:    "https://smartreview-analyze-frxqsvlhwq-nw.a.run.app",
    saveUrl:       "https://smartreview-save-frxqsvlhwq-nw.a.run.app",
    recomputeUrl:  "https://recomputerails-frxqsvlhwq-nw.a.run.app",
  },

  // Analytics windows
  lookbackMonthsFetch: 36,
  lookbackMonthsGroup: 12,
  minOccurrences: 2,

  // Anchor gating
  minConfidenceForAnchor: 0.25,
  minAnchorAmountMajor: 20,

  // Categories
  incomeCategories: ["Salary","Bonus","Stipend","Pension","Other"],
  emberCategories:  ["Shelter","Energy","Internet","Insurance","Council Tax","Loan","Phone","Other"],

  // Telemetry (no-op by default)
  onTelemetry: (_evt,_payload)=>{},
  showConfidenceBadges: false,
};

const DAYS = 86400000;
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };
const GBP = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);

// ---------------------------------------------------------------------------
// STYLE
// ---------------------------------------------------------------------------
function ensureStyles(){
  if (document.getElementById('sr-styles')) return;
  const css = `
  #srOverlay{position:fixed;inset:0;background:rgba(6,8,12,.88);backdrop-filter:saturate(120%) blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;}
  #srWrap{width:min(1120px,94vw);max-height:94vh;display:flex;flex-direction:column;border:1px solid #273142;border-radius:16px;background:#0f1118;color:#fff;box-shadow:0 20px 80px rgba(0,0,0,.5);overflow-x:hidden;max-width:100vw;}
  #srWrap *{box-sizing:border-box;min-width:0}
  #srTop{position:sticky;top:0;z-index:3;background:#0f1118;border-bottom:1px solid #1f2937}
  #srTopInner{padding:16px}
  #srBody{flex:1;min-height:0;overflow:auto;padding:0 16px 12px 16px;overflow-x:hidden}
  .sr-actions{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #1f2937;background:#0f1118;position:sticky;bottom:0;z-index:2}
  #srTop h2{margin:0 0 8px;font-size:20px}
  .pill{padding:6px 10px;border-radius:999px;border:1px solid #2a3a55;background:#0d1220;color:#fff}
  .pill.active{outline:2px solid #3b82f6}

  /* Summary block (flush to pills) */
  .sr-summary{margin-top:8px}
  .sr-row-1{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center}
  .sr-right{display:grid;gap:8px}
  .bar{height:16px;border-radius:12px;background:#1f2937;overflow:hidden}
  .bar>div{height:100%;width:0%}
  .bar .pos{background:linear-gradient(90deg,#22c55e,#06b6d4)}
  .bar .neg{background:linear-gradient(90deg,#ef4444,#f59e0b)}
  .kbox{border-radius:10px;padding:8px 12px;background:#111827;border:1px solid #1f2937;min-width:0}
  .green{color:#10b981} .red{color:#ef4444} .muted{opacity:.8}
  .sr-sub{font-size:12px;opacity:.85}

  /* Anchor label + select on one row */
  .anchor-box{
    display:grid;
    grid-template-columns: 1fr auto;
    gap:8px;
    align-items:center;
  }

  /* Net grid: 2 columns × 2 rows; left spans two rows */
  .sr-netgrid{
    display:grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 8px;
    margin-top:8px;
  }
  .sr-netgrid .netBox   { grid-column:1; grid-row:1 / span 2; }
  .sr-netgrid .dailyBox { grid-column:2; grid-row:1; }
  .sr-netgrid .weeklyBox{ grid-column:2; grid-row:2; }

  /* Tabs fill full width, two equal buttons */
  .sr-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
  .tab{padding:6px 10px;border:1px solid #2a3a55;border-radius:8px;background:#0d1220;color:#fff;text-align:center}
  .tab.active{outline:2px solid #3b82f6}

  .toolbar{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap;align-items:center;justify-content:space-between}
  .count-pill{font-size:12px;opacity:.85}

  .sr-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .ao-tile{border:1px solid #223044;border-radius:12px;padding:10px;background:#121626}
  .row-top{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}
  .ao-input,.ao-select{width:100%;max-width:100%;padding:8px;border-radius:8px;border:1px solid #2a3a55;background:#0d1220;color:#fff}

  /* Row 1: Label | Category (equal) */
  .row-grid{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:8px;
    margin-top:8px;
    grid-auto-rows:auto;
    align-items:end;
  }
  /* Bottom row: Cadence | Avg | Monthly | Include (right) */
  .row-line{
    display:grid;
    grid-template-columns: auto 1fr 1fr auto;
    gap:8px;
    margin-top:8px;
    align-items:end;
  }

  .amount-chip{font-weight:700}
  .amount-chip.green{color:#10b981}
  .amount-chip.red{color:#ef4444}
  .amount-chip.neutral{color:#fff}

  @media (max-width: 640px){
    .sr-row-1{grid-template-columns:1fr}
  }
  `;
  const style=document.createElement('style');
  style.id='sr-styles';
  style.textContent=css;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------
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
function cadenceUnitLabel(cadence) {
  switch (cadence) {
    case 'weekly':      return 'per week';
    case 'fortnightly': return 'per fortnight';
    case 'monthly':     return 'per month';
    case 'quarterly':   return 'per quarter';
    case 'yearly':      return 'per year';
    case 'daily':       return 'per day';
    default:            return 'per period';
  }
}
function suggestInclude(name=''){
  const s = String(name).toLowerCase();
  return /(salary|payroll|wage|stipend|pension|employer|scholarship|grant)/.test(s);
}
function iqrFilter(values){
  if (values.length < 4) return values.map((_,i)=>i);
  const vs = values.slice().sort((a,b)=>a-b);
  const q1 = vs[Math.floor((vs.length-1)*0.25)];
  const q3 = vs[Math.floor((vs.length-1)*0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5*iqr;
  const hi = q3 + 1.5*iqr;
  const keep = [];
  for (let i=0;i<values.length;i++){ const v=values[i]; if (v>=lo && v<=hi) keep.push(i); }
  return keep;
}
function isoWeekKey(ms){
  const d = new Date(ms);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((tmp - yearStart) / DAYS) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}
const monthKey     = ms => `${new Date(ms).getFullYear()}-${String(new Date(ms).getMonth()+1).padStart(2,'0')}`;
const fortnightKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getDate()<=15?'A':'B'}`; };
const quarterKey   = ms => { const d = new Date(ms), q=Math.floor(d.getMonth()/3)+1; return `${d.getFullYear()}-Q${q}`; };
const yearKey      = ms => String(new Date(ms).getFullYear());
function aggregateByCadence(occ, cadence){
  const keyFn = cadence==='weekly'      ? isoWeekKey
               : cadence==='fortnightly'? fortnightKey
               : cadence==='monthly'    ? monthKey
               : cadence==='quarterly'  ? quarterKey
               : cadence==='yearly'     ? yearKey
               : monthKey;
  const map = new Map();
  for (const o of occ){ const k = keyFn(o.ts); map.set(k, (map.get(k)||0) + Math.abs(o.amt)); }
  const entries = Array.from(map.entries()).sort((a,b)=> a[0]<b[0]? -1 : 1);
  const sums = entries.map(e=>e[1]);
  return { entries, sums };
}
function median(vals){ if (!vals.length) return 0; const v=vals.slice().sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; }
function mad(vals){ if (vals.length<3) return 0; const m=median(vals); const dev=vals.map(x=>Math.abs(x-m)); return median(dev); }
function scoreCadence(occ, cadence){
  const { sums } = aggregateByCadence(occ, cadence);
  if (sums.length < SR_CFG.minOccurrences) return { fit:0, hits:0, rep:0 };
  const hits = sums.filter(x=>x>0).length;
  const coverage = hits / sums.length;
  const m = median(sums);
  const m_mad = mad(sums);
  const stab = m===0 ? 0 : Math.max(0, 1 - (m_mad / (m*1.2)));
  const fit = 0.6*coverage + 0.4*stab;
  return { fit, hits, rep: m };
}

// ---------------------------------------------------------------------------
// DATA LOAD
// ---------------------------------------------------------------------------
async function loadProcessedVerified(uid, monthsFetch){
  const db = getFirestore();
  const sinceMs = Date.now() - monthsFetch*30.44*DAYS;
  const candidates = [
    collection(db, `players/${uid}/financialData/processedTransactions/verified`),
  ];
  for (const coll of candidates){
    try {
      const qs = await getDocs(coll);
      const arr = [];
      qs.forEach(d => {
        const x = d.data() || {};
        const ts = x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? 0;
        if (ts >= sinceMs) arr.push({ id:d.id, ...x, ts });
      });
      if (arr.length) return arr;
    } catch (_) {}
  }
  return [];
}

// ---------------------------------------------------------------------------
// ANALYZE (client)
// ---------------------------------------------------------------------------
function buildGroups(processed, monthsGroup){
  const cutoff = Date.now() - monthsGroup*30.44*DAYS;
  const txsRaw = processed
    .map(x => {
      const amount = Number(x.amount ?? x.amountMajor ?? 0);
      const td = x.transactionData || {};
      const name = normName(td.description || td.merchantName || x.label || x.counterparty || '');
      return { ts:x.ts, amt:amount, name };
    })
    .filter(t => Number.isFinite(t.ts) && t.ts >= cutoff);

  const groups = new Map();
  for (const t of txsRaw){
    const kind = t.amt >= 0 ? 'inflow' : 'ember';
    const key = `${t.name}|${kind}`;
    if (!groups.has(key)) groups.set(key, { name:t.name, kind, occ:[] });
    groups.get(key).occ.push({ ts:t.ts, amt:Math.abs(t.amt) });
  }
  groups.forEach(g => g.occ.sort((a,b)=>a.ts-b.ts));

  for (const g of groups.values()){
    const vals = g.occ.map(o=>o.amt);
    const keep  = iqrFilter(vals);
    g.occ = keep.map(i=>g.occ[i]);
  }

  const candidates = ['weekly','fortnightly','monthly','quarterly','yearly'];
  const items = [];
  for (const g of groups.values()){
    if (g.occ.length < SR_CFG.minOccurrences) continue;
    let best = { cadence:'monthly', fit:0, hits:0, rep:0 };
    for (const c of candidates){
      const sc = scoreCadence(g.occ, c);
      if (sc.fit > best.fit) best = { cadence:c, ...sc };
    }
    items.push({
      id: g.name + '|' + (g.kind==='inflow'?'in':'out'),
      name: g.name,
      kind: g.kind,
      cadence: best.cadence,
      representative: Number((best.rep || 0).toFixed(2)),
      txCount: g.occ.length,
      confidence: Math.min(1, best.fit)
    });
  }
  const inflow = items.filter(i=>i.kind==='inflow').sort((a,b)=>b.confidence-a.confidence);
  const ember  = items.filter(i=>i.kind==='ember') .sort((a,b)=>b.confidence-a.confidence);

  // Unique anchor dates (confidence + amount gated, last 30d)
  const confByName = new Map(inflow.map(i=>[i.name, i.confidence]));
  const dateSet = new Set();
  const thirtyDaysAgo = Date.now() - 30*DAYS;
  for (const t of txsRaw){
    if (t.amt < SR_CFG.minAnchorAmountMajor) continue;
    if (t.ts < thirtyDaysAgo) continue;
    const conf = confByName.get(t.name) || 0;
    if (conf < SR_CFG.minConfidenceForAnchor) continue;
    const d = new Date(t.ts);
    dateSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  const anchorDates = Array.from(dateSet).sort((a,b)=> (a<b?1:-1));
  return { inflow, ember, anchorDates };
}
async function analyzeClient(uid){
  const raw = await loadProcessedVerified(uid, SR_CFG.lookbackMonthsFetch);
  return buildGroups(raw, SR_CFG.lookbackMonthsGroup);
}

// ---------------------------------------------------------------------------
// SAVE
// ---------------------------------------------------------------------------
async function saveSelections({ mode, anchorTs, inflowRows, emberRows }){
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();
  const uid = user.uid;
  const db = getFirestore();

  const ins  = inflowRows.filter(x=>x.include);
  const outs = emberRows .filter(x=>x.include);

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
      anchorMs: anchorTs || null, updatedAt: now
    }, { merge:true });

    await setDoc(doc(db, `players/${uid}/cashflowData/active`), {
      mode: mode==="finite" ? "finite" : "continuous", cadence:"monthly",
      inflow:{ total: Number(incomeMo.toFixed(2)), categories: incCats },
      outflow:{ total: Number(emberMo.toFixed(2)), categories: outCats },
      updatedAt: now
    }, { merge:true });
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
// LIST CONTROLS
// ---------------------------------------------------------------------------
function addListControls(host, rows, labelText, onChange) {
  const bar = document.createElement('div'); bar.className='toolbar';

  const left = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = labelText;
  const count = el('span','count-pill', `(${rows.length} group${rows.length!==1?'s':''})`);
  left.append(title, count);

  const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px';
  const btnToggle = document.createElement('button'); btnToggle.className='pill'; btnToggle.textContent='Select all';
  btnToggle.onclick = () => {
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

// ---------------------------------------------------------------------------
// ROW UI
// ---------------------------------------------------------------------------
function buildRowUI(group, kind){
  const row = el('div','ao-tile');
  const top = el('div','row-top');

  const left = el('div','', `
    <strong>${group.name || 'unknown'}</strong>
    <div class="sr-sub">${group.txCount} hit${group.txCount!==1?'s':''}${SR_CFG.showConfidenceBadges ? ` • conf ${(group.confidence*100|0)}%` : ''}</div>
  `);
  const kindTag = el('div','sr-sub muted', kind==='inflow' ? 'Energy' : 'Ember');
  top.append(left, kindTag);

  const label = document.createElement('input'); label.className='ao-input';
  label.placeholder = kind==='inflow' ? 'Label (e.g., Salary)' : 'Label (e.g., Rent)';
  label.value = group.name || '';

  const category = document.createElement('select'); category.className='ao-select';
  (kind==='inflow'? SR_CFG.incomeCategories : SR_CFG.emberCategories)
    .forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; category.append(o); });
  category.value = "Other";

  const include = document.createElement('input'); include.type='checkbox';
  include.checked = (kind==='inflow') ? suggestInclude(group.name) : true;

  const monthlyVal = Number(((group.representative || 0) * MONTHLY_MULT[group.cadence || 'monthly']).toFixed(2));
  const avgPerCadence = `${GBP(group.representative || 0)} ${cadenceUnitLabel(group.cadence || 'monthly')}`;

  // Row 1 (Label | Category) equal widths
  const grid = el('div','row-grid');
  const labWrap = el('div','',`<label class="sr-sub">Label</label>`);    labWrap.append(label);
  const catWrap = el('div','',`<label class="sr-sub">Category</label>`); catWrap.append(category);
  grid.append(labWrap, catWrap);

  // Bottom row: Cadence | Avg | Monthly | Include (right)
  const line2 = el('div','row-line');

  const cadenceCell = el('div','', `
    <label class="sr-sub">Cadence</label>
    <div>${(group.cadence || 'monthly').replace(/^\w/, c=>c.toUpperCase())}</div>
  `);

  const avgCell = el('div','', `
    <label class="sr-sub">Avg</label>
    <div class="amount-chip neutral">${avgPerCadence}</div>
  `);

  const monthlyCell = el('div','', `
    <label class="sr-sub">Monthly</label>
    <div class="amount-chip ${kind==='inflow'?'green':'red'}">${GBP(monthlyVal)}/mo</div>
  `);

  const includeCell = el('div','',`<label class="sr-sub">Include</label>`);
  includeCell.append(include);

  line2.append(cadenceCell, avgCell, monthlyCell, includeCell);
  grid.append(line2);

  row.append(top, grid);

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
      classAs: kind
    }),
    setIncluded: (on) => { include.checked = !!on; include.dispatchEvent(new Event('change')); }
  };
}

// ---------------------------------------------------------------------------
// PHASE: CONTINUOUS
// ---------------------------------------------------------------------------
function renderContinuousPhase(bodyHost, analysis){
  bodyHost.innerHTML = '';

  // Sticky summary (flush to pills area)
  const summary = document.createElement('div'); summary.className='sr-summary';

  // Row 1: Energy/Ember left; bar + anchor right
  const row1 = el('div','sr-row-1');

  // Two KPI tiles side-by-side (equal width)
  const totals = document.createElement('div');
  const k1 = el('div','kbox'); k1.innerHTML = `<div>Energy Source</div><div id="srKpiEnergy" class="green">£0/mo</div>`;
  const k2 = el('div','kbox'); k2.innerHTML = `<div>Emberward</div><div id="srKpiEmber"  class="red">£0/mo</div>`;
  totals.append(k1, k2);

  const rightCol = el('div','sr-right');
  const bar = el('div','bar'); const fill = el('div','pos'); bar.append(fill);

  // Anchor (label left, select right)
  const anchorWrap = el('div','anchor-box');
  const anchorLabel = el('div','sr-sub','Anchor date (last 30d):');
  const anchorSelect = document.createElement('select'); anchorSelect.className='ao-select';
  anchorSelect.append(new Option('Auto (latest strong inflow)',''));
  (analysis.anchorDates||[]).forEach(dStr => {
    const [y,m,d] = dStr.split('-').map(Number);
    const disp = new Date(y, m-1, d).toLocaleDateString('en-GB',{ day:'2-digit', month:'short', year:'numeric' });
    anchorSelect.append(new Option(disp, String(new Date(y, m-1, d).getTime())));
  });
  anchorWrap.append(anchorLabel, anchorSelect);

  rightCol.append(bar, anchorWrap);
  row1.append(totals, rightCol);

  // Net + Daily/Weekly grid
  const netGrid = el('div','sr-netgrid');
  const netBox   = el('div','kbox netBox');   netBox.innerHTML   = `<div>Net per month</div><div id="srKpiNet">£0/mo</div>`;
  const dailyBox = el('div','kbox dailyBox','Daily: £0');        // top-right
  const weeklyBox= el('div','kbox weeklyBox','Weekly: £0');       // bottom-right
  netGrid.append(netBox, dailyBox, weeklyBox);

  summary.append(row1, netGrid);

  // Tabs (full width, equal halves)
  const tabs = el('div','sr-tabs');
  const tabIn  = el('button','tab active', 'Energy Source');
  const tabOut = el('button','tab',         'Emberward');
  tabs.append(tabIn, tabOut);

  // Inject summary + tabs into sticky top for flush layout
  const topInner = document.getElementById('srTopInner');
  topInner.append(summary, tabs);

  // ===== Scrollable list body =====
  const listWrap = document.createElement('div');
  listWrap.className = 'sr-list';
  bodyHost.append(listWrap);

  // Build rows
  const inRows  = (analysis.inflow||[]).map(g=>buildRowUI(g,'inflow'));
  const outRows = (analysis.ember ||[]).map(g=>buildRowUI(g,'ember'));

  // Toolbars
  const toolIn  = document.createElement('div');
  const toolOut = document.createElement('div');
  addListControls(toolIn,  inRows,  'Source (inflows)', () => updateSummary());
  addListControls(toolOut, outRows, 'Ember (foundation outflows)', () => updateSummary());

  // Summary updater
  const vEng = () => document.getElementById('srKpiEnergy');
  const vEmb = () => document.getElementById('srKpiEmber');
  const vNet = () => document.getElementById('srKpiNet');

  function updateSummary(){
    const ins  = inRows .map(r=>r.collect()).filter(x=>x.include);
    const outs = outRows.map(r=>r.collect()).filter(x=>x.include);
    const incMo = ins .reduce((s,x)=>s+(x.monthly||0),0);
    const outMo = outs.reduce((s,x)=>s+(x.monthly||0),0);
    vEng().textContent = GBP(incMo) + '/mo';
    vEmb().textContent = GBP(outMo) + '/mo';
    vNet().textContent = GBP(incMo - outMo) + '/mo';
    const fillPct = Math.max(0, Math.min(100, incMo? ((incMo-outMo)/incMo*100):0));
    fill.style.width = fillPct + '%';
    fill.className = (incMo - outMo >= 0) ? 'pos' : 'neg';
    const netDaily = Number(((incMo - outMo)/MONTHLY_MULT.daily).toFixed(2));
    const netWeekly= Number(((incMo - outMo)/MONTHLY_MULT.weekly).toFixed(2));
    dailyBox.textContent  = `Daily: ${GBP(netDaily)}`;
    weeklyBox.textContent = `Weekly: ${GBP(netWeekly)}`;
  }

  // Change handlers
  [...inRows, ...outRows].forEach(r => r.include.addEventListener('change', updateSummary));

  function show(kind){
    tabIn.classList.toggle('active', kind==='in');
    tabOut.classList.toggle('active', kind==='out');
    listWrap.innerHTML='';
    if (kind==='in'){
      listWrap.append(toolIn);
      inRows.forEach(r=>listWrap.append(r.node));
    } else {
      listWrap.append(toolOut);
      outRows.forEach(r=>listWrap.append(r.node));
    }
    updateSummary();
  }
  tabIn.onclick = ()=> show('in');
  tabOut.onclick= ()=> show('out');
  show('in');

  return {
    collectSelections: () => {
      const anchorTs = anchorSelect.value ? Number(anchorSelect.value) : null;
      return {
        mode: "continuous",
        anchorTs,
        inflowRows: inRows.map(r=>r.collect()),
        emberRows:  outRows.map(r=>r.collect())
      };
    }
  };
}

// ---------------------------------------------------------------------------
// PHASE: FINITE (placeholder)
// ---------------------------------------------------------------------------
function renderFinitePhase(bodyHost){
  bodyHost.innerHTML='';
  const card = el('div','ao-tile',
    `<h3 style="margin:0 0 8px;">Finite mode</h3>
     <p class="sr-sub">Seed/duration/replenishment screen will live here (placeholder).</p>`);
  bodyHost.append(card);
  return { collectSelections: ()=>({ mode:"finite", anchorTs:null, inflowRows:[], emberRows:[] }) };
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------
export async function openSmartReviewOverlay(){
  ensureStyles();

  const overlay = document.createElement('div'); overlay.id='srOverlay';
  const wrap = document.createElement('section'); wrap.id='srWrap';

  const top = document.createElement('div'); top.id='srTop';
  top.innerHTML = `
    <div id="srTopInner">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
        <h2 style="margin:0">Smart Review</h2>
        <div style="display:flex;gap:8px;">
          <button id="pill-cont" class="pill active">Continuous</button>
          <button id="pill-fin"  class="pill">Finite</button>
        </div>
      </div>
    </div>
  `;
  const body = document.createElement('div'); body.id='srBody';
  const actions = document.createElement('div'); actions.className='sr-actions';
  actions.innerHTML = `
    <button id="srBack" class="pill">Back</button>
    <button id="srApply" class="pill">Apply & Continue</button>
  `;
  wrap.append(top, body, actions);
  overlay.append(wrap);
  document.body.appendChild(overlay);

  const back = actions.querySelector('#srBack');
  const apply= actions.querySelector('#srApply');
  const pillC= top.querySelector('#pill-cont');
  const pillF= top.querySelector('#pill-fin');

  let mode='continuous';
  let phaseApi={ collectSelections: ()=>({ mode, anchorTs:null, inflowRows:[], emberRows:[] }) };

  async function setMode(m){
    mode=m; pillC.classList.toggle('active', m==='continuous'); pillF.classList.toggle('active', m==='finite');
    if (m==='finite'){
      phaseApi = renderFinitePhase(body);
      return;
    }
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
    } catch (e) {
      body.innerHTML = `<div class="ao-tile">Could not analyse data. ${e?.message||e}</div>`;
      phaseApi = { collectSelections: ()=>({ mode, anchorTs:null, inflowRows:[], emberRows:[] }) };
    }
  }

  pillC.onclick = ()=> setMode('continuous');
  pillF.onclick = ()=> setMode('finite');
  setMode('continuous');

  back.onclick = ()=>{ overlay.remove(); window.dispatchEvent(new CustomEvent('smartReview:closed')); };

  apply.onclick = async ()=> {
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
      overlay.remove();
      window.dispatchEvent(new CustomEvent('cashflow:updated', { detail:{ source:'smartReview' } }));
    } catch(e){
      alert("Could not save your Smart Review. " + (e?.message||e));
    }
  };

  return true;
}

export function showSmartReviewAfterTrueLayer(){ localStorage.setItem('showSmartReviewOnce','1'); }
export function maybeOpenSmartReviewOnLoad(){
  if (localStorage.getItem('showSmartReviewOnce') === '1'){
    localStorage.removeItem('showSmartReviewOnce');
    openSmartReviewOverlay().catch(console.error);
  }
}
