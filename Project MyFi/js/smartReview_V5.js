// smartreview.js — Smart Review overlay (frontend) — v7
// Fixes: no colour on mode pills, single tab set, net/daily/weekly alignment,
// label+category same row, card bottom row tidy, mobile no x-overflow.

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ───────────────────────────────── CONFIG ─────────────────────────────────
const SR_CFG = {
  useBackendAnalyze: false,
  useBackendSave:    false,
  callRecompute:     true,
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
  minAnchorAmountMajor: 20,
  incomeCategories: ["Salary","Bonus","Stipend","Pension","Other"],
  emberCategories:  ["Shelter","Energy","Internet","Insurance","Council Tax","Loan","Phone","Other"],
  onTelemetry: (evt, payload)=>{ /* console.log('[SR]', evt, payload); */ },
  showConfidenceBadges: false,
};

const DAYS = 86400000;
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };
const GBP = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);

// ───────────────────────────────── STYLE ─────────────────────────────────
function ensureStyles(){
  if (document.getElementById('sr-styles')) return;
  const css = `
  :root{
    --bg:#0f1118; --panel:#111827; --edge:#1f2937; --ink:#fff;
    --muted:.85; --green:#10b981; --red:#ef4444; --blue:#3b82f6;
    --chip:#0d1220;
  }
  *{box-sizing:border-box}
  html,body{max-width:100%;overflow-x:hidden}
  #srOverlay{position:fixed;inset:0;background:rgba(6,8,12,.88);
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

  /* Summary layout */
  .sr-summary{display:flex;flex-direction:column;gap:10px;margin-top:6px}
  .totals-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .kbox{border-radius:12px;padding:10px 12px;background:var(--panel);border:1px solid var(--edge);min-width:0}
  .kval{font-weight:700}
  .green{color:var(--green)} .red{color:var(--red)} .muted{opacity:var(--muted)}
  .bar{height:14px;border-radius:12px;background:var(--edge);overflow:hidden}
  .bar>div{height:100%;width:0%}
  .bar .pos{background:linear-gradient(90deg,#22c55e,#06b6d4)}
  .bar .neg{background:linear-gradient(90deg,#ef4444,#f59e0b)}
  .anchor-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
  .ao-select,.ao-input{width:100%;padding:8px;border-radius:8px;border:1px solid #2a3a55;background:#0d1220;color:#fff}

  /* Net grid: Net (left spans 2 rows) + right stack (Daily, Weekly) */
  .net-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch}
  .net-left{display:flex;flex-direction:column;justify-content:center;min-height:96px}
  .right-stack{display:grid;grid-template-rows:1fr 1fr;gap:10px}

  /* Tabs for lists (single set, full width) */
  .sr-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 6px}
  .tab{padding:8px 10px;border:1px solid #2a3a55;border-radius:10px;background:var(--chip);color:var(--ink);text-align:center}
  .tab.active{border-color:#334155; box-shadow:0 0 0 2px rgba(255,255,255,.08) inset}

  /* Section separation */
  .list-section{margin-top:6px;border-top:1px dashed var(--edge);padding-top:8px}
  .toolbar{display:flex;gap:8px;margin:6px 0;flex-wrap:wrap;align-items:center;justify-content:space-between}
  .count-pill{font-size:12px;opacity:var(--muted)}
  .section-title{font-weight:600}
  .section-title.in{color:var(--green)} .section-title.out{color:var(--red)}

  /* List & cards */
  .sr-list{display:flex;flex-direction:column;gap:10px}
  .ao-tile{border:1px solid #223044;border-radius:14px;padding:12px;background:#121626}
  .row-top{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}
  .row-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .row-bottom{display:grid;grid-template-columns:2fr 1fr;gap:10px;align-items:stretch;margin-top:10px}
  .bottom-box{border:1px dashed var(--edge);border-radius:12px;padding:10px;background:rgba(255,255,255,.02)}
  .monthly-pill{border:1px solid var(--edge);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));
    border-radius:16px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .amount-chip{font-weight:700}
  .amount-chip.green{color:var(--green)} .amount-chip.red{color:var(--red)}
  .include-wrap{display:flex;align-items:center;gap:8px;white-space:nowrap}

  @media (max-width: 680px){
    .totals-row{grid-template-columns:1fr}
    .net-grid{grid-template-columns:1fr}
    .right-stack{grid-template-rows:auto;grid-auto-rows:1fr}
    .row-bottom{grid-template-columns:1fr}
  }
  `;
  const style=document.createElement('style');
  style.id='sr-styles';
  style.textContent=css;
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
    return { ts:x.ts, amt:amount, name };
  }).filter(t => Number.isFinite(t.ts) && t.ts>=cutoff);

  const groups = new Map();
  for (const t of txs){
    const kind = t.amt>=0 ? 'inflow' : 'ember';
    const key = `${t.name}|${kind}`;
    if (!groups.has(key)) groups.set(key, { name:t.name, kind, occ:[] });
    groups.get(key).occ.push({ ts:t.ts, amt:Math.abs(t.amt) });
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
      txCount: g.occ.length, confidence: Math.min(1, best.fit)
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
async function saveSelections({ mode, anchorTs, inflowRows, emberRows }){
  const user = getAuth().currentUser; if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken(); const uid = user.uid; const db = getFirestore();

  const ins  = inflowRows.filter(x=>x.include);
  const outs = emberRows .filter(x=>x.include);

  const incomeMo = ins.reduce((s,x)=>s+(x.monthly||0),0);
  const emberMo  = outs.reduce((s,x)=>s+(x.monthly||0),0);
  const incCats = {}; ins .forEach(x=> incCats[x.category||x.label] = (incCats[x.category||x.label]||0) + (x.monthly||0));
  const outCats = {}; outs.forEach(x=> outCats[x.category||x.label] = (outCats[x.category||x.label]||0) + (x.monthly||0));

  if (SR_CFG.useBackendSave){
    const res = await fetch(SR_CFG.endpoints.saveUrl, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:"Bearer "+idToken },
      body: JSON.stringify({
        mode, anchorMs: anchorTs || null,
        inflow:{ totalMonthly: incomeMo, categories: incCats, selections: ins },
        ember: { totalMonthly: emberMo,  categories: outCats, selections: outs },
        client:{ userAgent: navigator.userAgent, ts: Date.now() }
      })
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok || json?.error) throw new Error(json?.error || "save_failed");
  } else if (SR_CFG.devWriteRailsStub){
    const now=Date.now();
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
    try{
      const res = await fetch(SR_CFG.endpoints.recomputeUrl, { method:"POST", headers:{ Authorization:"Bearer "+idToken }});
      if (!res.ok) console.warn("recompute failed", await res.json().catch(()=>({})));
    }catch(e){ console.warn("recompute error", e?.message||e); }
  }
  SR_CFG.onTelemetry("save_ok",{ mode, incomeMo, emberMo, anchorTs });
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

  // Row 1: Label | Category  (equal width)
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

  // Bottom: Left cadence/avg (avg in white), Right monthly pill + Include at far right
  const bottom = el('div','row-bottom');

  const cadenceBlock = el('div','bottom-box','');
  const cadTitle = el('div','', `<strong>Cadence: ${(group.cadence||'monthly')[0].toUpperCase()+(group.cadence||'monthly').slice(1)}</strong>`);
  const avgLine  = el('div','', `<div class="sr-sub" style="margin-top:6px">Avg:</div>
                                 <div style="font-weight:700;color:#fff">${GBP(group.representative||0)} ${cadenceUnitLabel(group.cadence||'monthly')}</div>`);
  cadenceBlock.append(cadTitle, avgLine);

  const monthlyVal = Number(((group.representative||0) * MONTHLY_MULT[group.cadence||'monthly']).toFixed(2));
  const monthlyBox = el('div','monthly-pill','');
  const leftCol = el('div','', `<div class="sr-sub">Monthly Total</div><div class="amount-chip ${kind==='inflow'?'green':'red'}">${GBP(monthlyVal)}/mo</div>`);
  const include = document.createElement('input'); include.type='checkbox';
  include.checked = (kind==='inflow') ? suggestInclude(group.name) : true;
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
      classAs: kind
    }),
    setIncluded: (on)=>{ include.checked=!!on; include.dispatchEvent(new Event('change')); }
  };
}

// ───────────────────────────────── PHASE: CONTINUOUS ─────────────────────────────────
function renderContinuousPhase(bodyHost, analysis){
  bodyHost.innerHTML = '';

  // Summary (pinned under header)
  const summary = document.createElement('div'); summary.className='sr-summary';

  // 1) Energy/Ember (side by side, full width)
  const totalsRow = el('div','totals-row','');
  const energyBox = el('div','kbox','<div>Energy Source</div><div id="srKpiEnergy" class="kval green">£0/mo</div>');
  const emberBox  = el('div','kbox','<div>Emberward</div><div id="srKpiEmber" class="kval red">£0/mo</div>');
  totalsRow.append(energyBox, emberBox);

  // 2) Progress bar (full width)
  const bar = el('div','bar'); const fill = el('div','pos'); bar.append(fill);

  // 3) Anchor row (label left, dropdown right)
  const anchorBox = el('div','kbox','');
  const anchorRow = el('div','anchor-row','');
  const anchorLbl = el('div','sr-sub','Anchor date (last 30d):');
  const anchorSelect = document.createElement('select'); anchorSelect.className='ao-select';
  anchorSelect.append(new Option('Auto (latest strong inflow)',''));
  (analysis.anchorDates||[]).forEach(dStr=>{
    const [y,m,d]=dStr.split('-').map(Number);
    const disp = new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    anchorSelect.append(new Option(disp, String(new Date(y,m-1,d).getTime())));
  });
  anchorRow.append(anchorLbl, anchorSelect);
  anchorBox.append(anchorRow);

  // 4) Net grid (Net spans two rows on left; right shows Daily then Weekly)
  const netGrid = el('div','net-grid','');
  const netBox = el('div','kbox net-left','<div>Net per month</div><div id="srKpiNet" class="kval">£0/mo</div>');
  netBox.style.textAlign = 'left';
  const rightStack = el('div','right-stack','');
  const dailyBox  = el('div','kbox','Daily: £0');
  const weeklyBox = el('div','kbox','Weekly: £0');
  rightStack.append(dailyBox, weeklyBox);
  // place net on left spanning two rows; grid handles span automatically with rightStack
  netGrid.append(netBox, rightStack);

  summary.append(totalsRow, bar, anchorBox, netGrid);

  // SINGLE set of tabs (pinned, below summary)
  const tabs = el('div','sr-tabs','');
  const tabIn  = el('button','tab active', 'Energy Source');
  const tabOut = el('button','tab',        'Emberward');
  tabs.append(tabIn, tabOut);

  // Mount pinned content into header
  const topInner = document.getElementById('srTopInner');
  topInner.append(summary, tabs);

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
  addListControls(toolIn,  inRows,  'Source (inflows)', 'in',  () => updateSummary());
  addListControls(toolOut, outRows, 'Ember (foundation outflows)', 'out', () => updateSummary());

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
    fill.style.width = pct + '%'; fill.className = (incMo - outMo >= 0) ? 'pos' : 'neg';
    const netDaily  = Number(((incMo - outMo)/MONTHLY_MULT.daily).toFixed(2));
    const netWeekly = Number(((incMo - outMo)/MONTHLY_MULT.weekly).toFixed(2));
    dailyBox.textContent  = `Daily: ${GBP(netDaily)}`;
    weeklyBox.textContent = `Weekly: ${GBP(netWeekly)}`;
  }
  [...inRows, ...outRows].forEach(r => r.include.addEventListener('change', updateSummary));

  function show(kind){
    tabIn.classList.toggle('active', kind==='in');
    tabOut.classList.toggle('active', kind==='out');
    listWrap.innerHTML='';
    if (kind==='in'){ listWrap.append(toolIn);  inRows .forEach(r=>listWrap.append(r.node)); }
    else            { listWrap.append(toolOut); outRows.forEach(r=>listWrap.append(r.node)); }
    updateSummary();
  }
  tabIn.onclick = ()=> show('in');
  tabOut.onclick= ()=> show('out');
  show('in');

  return {
    collectSelections: ()=>{
      const anchorTs = anchorSelect.value ? Number(anchorSelect.value) : null;
      return { mode:"continuous", anchorTs, inflowRows: inRows.map(r=>r.collect()), emberRows: outRows.map(r=>r.collect()) };
    }
  };
}

// ───────────────────────────────── PHASE: FINITE (placeholder) ─────────────────────────────────
function renderFinitePhase(bodyHost){
  bodyHost.innerHTML='';
  const card = el('div','ao-tile', `<h3 style="margin:0 0 8px;">Finite mode</h3><p class="sr-sub">Seed/duration/replenishment screen will live here (placeholder).</p>`);
  bodyHost.append(card);
  return { collectSelections: ()=>({ mode:"finite", anchorTs:null, inflowRows:[], emberRows:[] }) };
}

// ───────────────────────────────── PUBLIC API ─────────────────────────────────
export async function openSmartReviewOverlay(){
  ensureStyles();

  const overlay = document.createElement('div'); overlay.id='srOverlay';
  const wrap = document.createElement('section'); wrap.id='srWrap';

  const top = document.createElement('div'); top.id='srTop';
  top.innerHTML = `
    <div id="srTopInner">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <h2 style="margin:0">Smart Review</h2>
        <div style="display:flex;gap:8px">
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
  wrap.append(top, body, actions); overlay.append(wrap); document.body.appendChild(overlay);

  const back = actions.querySelector('#srBack');
  const apply= actions.querySelector('#srApply');
  const pillC= top.querySelector('#pill-cont');
  const pillF= top.querySelector('#pill-fin');

  let mode='continuous';
  let phaseApi={ collectSelections: ()=>({ mode, anchorTs:null, inflowRows:[], emberRows:[] }) };

  async function setMode(m){
    mode=m; pillC.classList.toggle('active', m==='continuous'); pillF.classList.toggle('active', m==='finite');
    if (m==='finite'){ phaseApi = renderFinitePhase(body); return; }

    body.innerHTML = `<div class="ao-tile">Analysing your transactions…</div>`;
    try{
      const uid = getAuth().currentUser?.uid; if (!uid) throw new Error("Not signed in");
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

  back.onclick = ()=>{ overlay.remove(); window.dispatchEvent(new CustomEvent('smartReview:closed')); };

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
      overlay.remove();
      window.dispatchEvent(new CustomEvent('cashflow:updated', { detail:{ source:'smartReview' } }));
    }catch(e){ alert("Could not save your Smart Review. " + (e?.message||e)); }
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
