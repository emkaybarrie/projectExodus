// Verified Energy Menu — 1:1 legacy UI port using the new modal system
// - No hard deps on other local modules (only your core modal).
// - Firebase imports are dynamic+guarded so the UI runs even without FB loaded.
//
// Events emitted:
//   - energyMenu:disconnectTL     (header button)
//   - cashflow:updated { payload } (after Apply)
//   - hub:requestRefresh          (after Apply)
//   - requestClose                (close the modal)
//
// Saving behaviour (when Firebase available):
//   players/{uid}/financialData/cashflowData/verified/core   <- payload
//   players/{uid}/financialData/cashflowData                  <- payload (active)
//   players/{uid} transactionMode: "verified"

import { open as openModal } from "../../core/modal.js";

// ----------------------------- config / helpers -------------------------------
const CFG = {
  currency: "GBP",
  // used for per-group "Category" select (lightweight, adjust to your taxonomy)
  categories: [
    ["income","Income"],
    ["coreinflow","Core inflow"],
    ["coreoutflow","Core outflow"],
    ["bills","Bills & Utilities"],
    ["shelter","Rent/Mortgage"],
    ["groceries","Groceries"],
    ["transport","Transport"],
    ["debt","Debts"],
    ["other","Other"]
  ],
  performWrites: true // set false to keep as visual shell
};
const GBP = n => new Intl.NumberFormat("en-GB",{style:"currency",currency:CFG.currency}).format(Number(n)||0);
const MONTHLY_MULT = { weekly:52/12, fortnightly:26/12, monthly:1, quarterly:4/12, yearly:1/12, daily:30.44 };

function idScopeCSS(css, id){
  return css.replace(/(^|\})\s*([^@}\s][^{]*)\{/g, (_,b,sel)=>`${b} #${id} ${sel}{`);
}
function el(tag, cls, html){ const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; }
function min0(n){ return Math.max(0, Number(n)||0); }
function toMonthlyFrom(cadence, amount){
  const mult = MONTHLY_MULT[(cadence||"monthly").toLowerCase()] ?? 1;
  return (Number(amount)||0) * mult;
}

// ----------------------------- dynamic Firebase ------------------------------
async function getFirebase(){
  try{
    const auth = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
    const fs   = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
    return { getAuth:auth.getAuth, getFirestore:fs.getFirestore, doc:fs.doc, getDoc:fs.getDoc, setDoc:fs.setDoc };
  }catch{ return {}; }
}

// Try a few likely paths for verified groups (lightweight discovery)
async function readVerifiedGroups(uid){
  const { getFirestore, doc, getDoc } = await getFirebase();
  if (!getFirestore) return { inflows:[], outflows:[], anchorMs:null, creditMode:"essence" };

  const db = getFirestore();

  // 1) Canonical verified/core (anchor/credit mode live here)
  let verifiedCore = null;
  try {
    const s = await getDoc(doc(db, `players/${uid}/financialData/cashflowData/verified/core`));
    verifiedCore = s.exists() ? (s.data()||{}) : null;
  } catch {}

  // 2) Group collections — pick the first that exists
  const tryPaths = [
    `players/${uid}/financialData/verified/groups`,         // custom pre-agg
    `players/${uid}/financialData/trueLayer/groups`,        // TL-specific
    `players/${uid}/financialData/cashflowData/verified/groups` // old location
  ];

  let groupsDoc = null;
  for (const p of tryPaths){
    try{
      const s = await getDoc(doc(db, p));
      if (s.exists()){ groupsDoc = s.data()||{}; break; }
    }catch{}
  }

  // Structure we expect for each group:
  // { id, label, hits, cadence, avgAmount, monthlyTotal, category, include }
  const inflows  = Array.isArray(groupsDoc?.inflows)  ? groupsDoc.inflows  : [];
  const outflows = Array.isArray(groupsDoc?.outflows) ? groupsDoc.outflows : [];

  const anchorMs  = Number(verifiedCore?.payCycleAnchorMs || null) || null;
  const creditMode= String(verifiedCore?.creditMode || 'essence');

  return { inflows, outflows, anchorMs, creditMode };
}

async function writeVerifiedCore(uid, payload){
  const { getFirestore, doc, setDoc } = await getFirebase();
  if (!getFirestore) return;
  const db = getFirestore();
  await setDoc(doc(db, `players/${uid}/financialData/cashflowData/verified/core`), payload, { merge:true });
  await setDoc(doc(db, `players/${uid}/financialData/cashflowData`), payload, { merge:true }); // active for gateway
  await setDoc(doc(db, `players/${uid}`), { transactionMode:"verified" }, { merge:true });
}

// -------------------------------- styles --------------------------------------
function ensureStyles(){
  const ID="energy-verified-styles", ROOT="evRoot";
  document.getElementById(ID)?.remove();
  const css = `
  :root{
    --bg:#0f1118; --panel:#111827; --edge:#1f2937; --ink:#fff;
    --muted:.85; --green:#10b981; --red:#ef4444; --chip:#0d1220;
  }

  /* layout safety */
  .anchor-row{ display:grid; grid-template-columns:auto 1fr; gap:8px; align-items:center; }
  .inline{ display:flex; gap:10px; }
  .inline > *{ flex:1; min-width:0; }
  .kbox{ min-width:0; overflow:visible; }

  /* inputs */
  .ao-input,.ao-select,.ao-number,
  input[type="number"], input[type="date"], select{
    width:100%; box-sizing:border-box;
    padding:8px; border-radius:8px; border:1px solid #2a3a55; background:#0d1220; color:#fff; outline:none;
  }

  /* pills & header actions */
  .pill{padding:6px 12px;border-radius:999px;border:1px solid #2a3a55;background:var(--chip);color:#fff}
  .pill.active{outline:2px solid #3b82f6}
  .btnDanger{border-color:#ef4444;background:#2a0f14}

  /* summary tiles */
  .summary{display:grid;gap:10px;margin-top:8px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .kval{font-weight:700}
  .kval.green{ color: var(--green) !important; -webkit-text-fill-color: var(--green) !important; }
  .kval.red{   color: var(--red)   !important; -webkit-text-fill-color: var(--red)   !important; }
  .muted{opacity:.85}

  /* progress bar */
  .bar{height:8px;border-radius:12px;background:var(--edge);overflow:hidden}
  .bar>div{height:100%;width:0;background:linear-gradient(90deg,#22c55e,#06b6d4)}

  /* net per month collapsible */
  .net-row{display:grid;grid-template-columns:1fr;gap:10px}
  .net-box{
    position:relative; display:flex; align-items:center; justify-content:space-between;
    padding:10px 12px; border-radius:12px; background:#111827; border:1px solid #1f2937; cursor:pointer;
  }
  .net-left{display:flex; align-items:center; gap:10px}
  .net-label{opacity:.85}
  .net-value{font-weight:700}
  .chev{opacity:.7; transition:transform .2s ease}
  .net-box.expanded .chev{transform:rotate(180deg)}
  .net-collapsible{overflow:hidden; max-height:0; transition:max-height .24s ease;}
  .net-collapsible-inner{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .kval-sm{font-weight:700}

  /* tabs */
  .tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 6px}
  .tab{padding:8px 10px;border:1px solid #2a3a55;border-radius:10px;background:var(--chip);color:var(--ink);text-align:center;transition:box-shadow .15s ease,border-color .15s ease}
  .tab.in.active{border-color:rgba(16,185,129,.5); box-shadow:0 0 0 1px rgba(16,185,129,.25), 0 0 12px rgba(16,185,129,.25) inset}
  .tab.out.active{border-color:rgba(239,68,68,.5);  box-shadow:0 0 0 1px rgba(239,68,68,.25),  0 0 12px rgba(239,68,68,.25) inset}

  /* group list */
  .section{margin-top:6px;border-top:1px dashed var(--edge);padding-top:8px}
  .list-head{display:flex; align-items:center; justify-content:space-between; margin:8px 0;}
  .list-head h3{margin:0; font-size:14px; opacity:.9}
  .smallBtn{padding:6px 10px;border-radius:10px;border:1px solid #2a3a55;background:#0d1220;color:#fff}

  .gcard{border:1px solid #223044;border-radius:14px;padding:12px;background:#121626; display:grid; gap:10px}
  .ghead{display:flex; align-items:center; justify-content:space-between}
  .gtitle{font-weight:700}
  .ghits{opacity:.75; font-size:12px}
  .ggrid{display:grid; grid-template-columns:1fr 1fr; gap:10px}
  .grow{display:flex; gap:10px; align-items:center}
  .gmuted{opacity:.75}
  .gtotal{display:flex; align-items:center; justify-content:space-between; gap:10px}
  .gtotal .kval{font-weight:700}
  .includeRow{display:flex; align-items:center; gap:8px}

  @media (max-width:780px){ .ggrid{ grid-template-columns:1fr } }
  `;
  const tag=document.createElement('style'); tag.id=ID; tag.textContent=idScopeCSS(css, ROOT);
  document.head.appendChild(tag);
}

// ------------------------------- UI pieces ------------------------------------
function anchorRowUI(anchorMs, onChange){
  const wrap = el("div","kbox","");
  const row  = el("div","anchor-row","");
  const lbl  = el("div","muted","Anchor date:");
  const input= document.createElement("input");
  input.type="date"; input.className="ao-input";
  if (anchorMs){
    const d = new Date(anchorMs);
    input.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  input.addEventListener("change", ()=>{
    if (!input.value) { onChange(null); return; }
    const [y,m,d] = input.value.split("-").map(Number);
    onChange(new Date(y,m-1,d).getTime());
  });
  row.append(lbl, input); wrap.append(row); return wrap;
}
function creditModeRowUI(current, onChange){
  const wrap = el("div","kbox","");
  const row  = el("div","anchor-row","");
  const lbl  = el("div","muted","Credit mode:");
  const sel  = document.createElement("select"); sel.className="ao-select";
  ["essence","allocate","health"].forEach(opt=>{
    const o=document.createElement("option"); o.value=opt; o.textContent=opt[0].toUpperCase()+opt.slice(1); sel.append(o);
  });
  sel.value = current || "essence";
  sel.addEventListener("change",()=>onChange(sel.value));
  row.append(lbl, sel); wrap.append(row); return wrap;
}

function groupCard(group, onChange){
  // group: { id, label, hits, cadence, avgAmount, monthlyTotal, category, include }
  const g = Object.assign({
    id: group?.id || crypto.randomUUID(),
    label: group?.label || 'unknown',
    hits: Number(group?.hits||0),
    cadence: String(group?.cadence||'monthly'),
    avgAmount: Number(group?.avgAmount||0),
    monthlyTotal: Number(group?.monthlyTotal || toMonthlyFrom(group?.cadence, group?.avgAmount)),
    category: String(group?.category||'other'),
    include: !!group?.include
  });

  const card = el("div","gcard","");

  const head = el("div","ghead","");
  head.append(el("div","gtitle", g.label));
  head.append(el("div","ghits", `${g.hits} hits`));
  card.append(head);

  const grid = el("div","ggrid","");
  // Label (read-only input for visual parity)
  const labelWrap = el("div","field","");
  labelWrap.append(el("label","gmuted","Label"));
  const labelInput = document.createElement("input");
  labelInput.className="ao-input"; labelInput.value=g.label; labelInput.readOnly=true;
  labelWrap.append(labelInput);

  // Category
  const catWrap = el("div","field","");
  catWrap.append(el("label","gmuted","Category"));
  const catSel = document.createElement("select"); catSel.className="ao-select";
  CFG.categories.forEach(([v,t])=>{ const o=document.createElement("option"); o.value=v; o.textContent=t; catSel.append(o); });
  catSel.value = g.category;
  catSel.addEventListener("change", ()=>{ g.category = catSel.value; onChange?.(g); });
  catWrap.append(catSel);

  grid.append(labelWrap, catWrap);

  // Cadence & Avg Amount row
  const cadAvg = el("div","ggrid","");
  const cadBox = el("div","grow","");
  cadBox.append(el("div","gmuted","Cadence"), el("div","", g.cadence[0].toUpperCase()+g.cadence.slice(1)));
  const avgBox = el("div","grow","");
  avgBox.append(el("div","gmuted","Avg Amount"), el("div","", `${GBP(Math.abs(g.avgAmount))} per ${g.cadence}`));
  cadAvg.append(cadBox, avgBox);

  // Monthly total + Include
  const totalRow = el("div","gtotal","");
  const total = el("div","kval", `${GBP(g.monthlyTotal)}/mo`);
  const incRow = el("label","includeRow","");
  const inc = document.createElement("input"); inc.type="checkbox"; inc.checked = !!g.include;
  inc.addEventListener("change", ()=>{ g.include = inc.checked; onChange?.(g); });
  incRow.append(inc, document.createTextNode("Include"));
  totalRow.append(el("div","gmuted","Monthly Total"), total, incRow);

  card.append(grid, cadAvg, totalRow);

  return { node: card, state: g, updateMonthly(n){ total.textContent = `${GBP(n)}/mo`; } };
}

// ------------------------------- main builder ---------------------------------
async function buildNode(){
  ensureStyles();
  const root = el('div',''); root.id='evRoot';

  const head = el('div','modal-head','');
  const body = el('div','modal-body','');
  const foot = el('div','modal-footer','');

  // title + actions (Disconnect, Continuous/Finite)
  head.append(el('div','modal-head-title','Energy'));
  const actions = el("div","",`
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
      <button id="btnDisconnect" class="pill btnDanger">Disconnect bank</button>
      <button id="pill-cont" class="pill active">Continuous</button>
      <button id="pill-fin"  class="pill">Finite</button>
    </div>
  `);
  head.append(actions);

  // summary rows (anchor + credit mode + tiles + bar + net)
  const summaryHost = el("div","summary","");
  head.append(summaryHost);

  // tabs
  const tabsBar = el("div","tabs","<button class='tab in active' id='tabIn'>Energy Source</button><button class='tab out' id='tabOut'>Emberward</button>");
  head.append(tabsBar);

  // list host in body
  const section = el("div","section","");
  const listHead = el("div","list-head","");
  const listTitle = el("h3","","Inflows (0 groups)");
  const btnSelectAll = el("button","smallBtn","Select all");
  listHead.append(listTitle, btnSelectAll);
  const list = el("div","", "");
  section.append(listHead, list);
  body.append(section);

  // footer
  foot.innerHTML = `
    <button class="modal-btn" data-act="close">Close</button>
    <span style="flex:1"></span>
    <button class="modal-btn modal-btn-primary" data-act="apply">Apply &amp; Continue</button>
  `;

  // state
  const { getAuth } = await getFirebase();
  const uid = getAuth?.().currentUser?.uid || null;
  const dataset = uid ? await readVerifiedGroups(uid) : { inflows:[], outflows:[], anchorMs:null, creditMode:"essence" };

  let mode = "continuous";
  let creditMode = dataset.creditMode || "essence";
  let anchorMs   = dataset.anchorMs   || null;
  let tab = "in"; // 'in' or 'out'
  // working copies (user may toggle Include/category, we keep it local until Apply)
  let inflows  = (dataset.inflows || []).map(x => ({...x}));
  let outflows = (dataset.outflows|| []).map(x => ({...x}));

  // summary painter
  function paintSummary(){
    const inM  = inflows .filter(g=>g.include).reduce((s,g)=> s + min0(g.monthlyTotal), 0);
    const outM = outflows.filter(g=>g.include).reduce((s,g)=> s + min0(g.monthlyTotal), 0);

    summaryHost.innerHTML = "";
    // anchor + credit mode
    summaryHost.append(
      anchorRowUI(anchorMs, (v)=>{ anchorMs=v; }),
      creditModeRowUI(creditMode, (v)=>{ creditMode=v; })
    );

    // tiles
    const row = el("div","row","");
    row.append(el("div","kbox",`<div>Energy Source</div><div class="kval green">${GBP(inM)}/mo</div>`));
    row.append(el("div","kbox",`<div>Emberward</div><div class="kval red">${GBP(outM)}/mo</div>`));
    summaryHost.append(row);

    // net bar
    const bar = el("div","bar",""); const fill=document.createElement("div"); bar.append(fill);
    const pct = Math.max(0, Math.min(100, inM ? ((inM-outM)/inM)*100 : 0));
    fill.style.width = pct + "%";
    summaryHost.append(bar);

    // net collapsible
    const netRow = el("div","net-row","");
    const netBox = el("div","net-box","");
    const left   = el("div","net-left","");
    left.append(el("div","net-label","Net per month"), el("div","net-value", `${GBP(inM-outM)}/mo`));
    const chev   = el("span","chev","▾");
    netBox.append(left, chev);
    const slide  = el("div","net-collapsible","");
    const inner  = el("div","net-collapsible-inner","");
    const daily  = el("div","kbox","");  daily.innerHTML  = `<div class="muted">Daily</div><div class="kval-sm">${GBP((inM-outM)/30.44)}</div>`;
    const weekly = el("div","kbox","");  weekly.innerHTML = `<div class="muted">Weekly</div><div class="kval-sm">${GBP((inM-outM)/(52/12))}</div>`;
    inner.append(daily, weekly); slide.append(inner);
    netBox.addEventListener("click", ()=>{
      const expanded = netBox.classList.toggle("expanded");
      slide.style.maxHeight = expanded ? inner.scrollHeight + "px" : "0px";
    });
    netRow.append(netBox, slide);
    summaryHost.append(netRow);
  }

  // list painter
  function paintList(){
    const data = (tab==='in') ? inflows : outflows;
    list.innerHTML = "";
    listTitle.textContent = `${tab==='in' ? 'Inflows' : 'Outflows'} (${data.length} groups)`;

    const cards = [];
    data.forEach(g=>{
      const card = groupCard(g, (updated)=>{
        // recompute monthly total if cadence/avg changed (we don't change these in UI, but keep logic)
        updated.monthlyTotal = min0(updated.monthlyTotal || toMonthlyFrom(updated.cadence, updated.avgAmount));
        paintSummary();
      });
      cards.push(card); list.append(card.node);
    });

    // select all toggler
    btnSelectAll.onclick = ()=>{
      const data = (tab==='in') ? inflows : outflows;
      const shouldSelect = data.some(g=>!g.include);
      data.forEach(g=> g.include = shouldSelect);
      paintList(); paintSummary();
    };
  }

  // initial paint
  paintSummary();
  paintList();

  // head wiring
  head.querySelector("#btnDisconnect").addEventListener("click", ()=>{
    root.dispatchEvent(new CustomEvent('energyMenu:disconnectTL',{ bubbles:true }));
  });
  const setMode = (m)=>{
    mode=m;
    head.querySelector("#pill-cont").classList.toggle("active", m==='continuous');
    head.querySelector("#pill-fin").classList.toggle("active", m==='finite');
  };
  head.querySelector("#pill-cont").addEventListener("click", ()=>setMode('continuous'));
  head.querySelector("#pill-fin").addEventListener("click",  ()=>setMode('finite'));
  head.querySelector("#tabIn").addEventListener("click",  ()=>{ tab='in';  head.querySelector('#tabIn').classList.add('active'); head.querySelector('#tabOut').classList.remove('active'); paintList(); });
  head.querySelector("#tabOut").addEventListener("click", ()=>{ tab='out'; head.querySelector('#tabOut').classList.add('active'); head.querySelector('#tabIn').classList.remove('active'); paintList(); });

  // footer
  foot.addEventListener('click', async (e)=>{
    const b = e.target.closest('[data-act]'); if(!b) return;
    if (b.dataset.act==='close'){ root.dispatchEvent(new CustomEvent('requestClose',{ bubbles:true })); return; }
    if (b.dataset.act==='apply'){
      const inM  = inflows .filter(g=>g.include).reduce((s,g)=> s + min0(g.monthlyTotal), 0);
      const outM = outflows.filter(g=>g.include).reduce((s,g)=> s + min0(g.monthlyTotal), 0);

      const payload = {
        energyMode: mode==="finite" ? "finite" : "continuous",
        creditMode: creditMode || 'essence',
        cadence: "monthly",
        inflow:  { total: Number(inM.toFixed(2)),  groups: inflows  },
        outflow: { total: Number(outM.toFixed(2)), groups: outflows },
        netflow: Number((inM - outM).toFixed(2)),
        payCycleAnchorMs: anchorMs ?? null,
        updatedAt: Date.now(),
        transactionMode: "verified"
      };

      try{
        if (uid && CFG.performWrites){ await writeVerifiedCore(uid, payload); }
        root.dispatchEvent(new CustomEvent('cashflow:updated',{ bubbles:true, detail:{ source:'energy-verified', payload } }));
        root.dispatchEvent(new CustomEvent('hub:requestRefresh',{ bubbles:true }));
        root.dispatchEvent(new CustomEvent('requestClose',{ bubbles:true }));
      }catch(e){
        alert("Could not save your Energy settings. " + (e?.message || e));
      }
    }
  });

  root.append(head, body, foot);
  return root;
}

// ------------------------------ public API ------------------------------------
export async function openEnergyVerified(){
  const node = await buildNode();
  const h = openModal({ content: node, owner:'hub', scope:'screen' });
  node.addEventListener('requestClose', ()=>h.close());
  return h;
}
