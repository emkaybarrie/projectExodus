// src/screens/hub/modules/energy-unverified.js
// Unverified Energy Menu — faithful legacy UI port into new modal system.
// No external imports beyond your core/modal. No hard dependency on TL helpers.
// Saves to Firestore like legacy (optional; keep = true to retain behaviour).

import { open as openModal } from "../../core/modal.js";

// ---- CONFIG (legacy parity) ---------------------------------------------------
const CFG = {
  enableDailyAveragesWrite: false,          // legacy flag; leave false unless you use it
  currency: "GBP",
  cadenceOptions: ["monthly","weekly","fortnightly","daily","quarterly","yearly"],
  incomeCats:  [["salary","Salary/Wages"],["bonus","Bonus"],["side","Side income"],["other","Other"]],
  expenseCats: [["shelter","Rent/Mortgage"],["bills","Bills & Utilities"],["groceries","Groceries"],
                ["transport","Transport"],["debt","Debts"],["other","Other"]],
  performWrites: true                        // <- set false if you want UI-only shell
};
const GBP = n => new Intl.NumberFormat("en-GB",{ style:"currency", currency:CFG.currency }).format(Number(n)||0);
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };
const toMonthly = (a,c)=> (Number(a)||0) * (MONTHLY_MULT[c] || 1);
const dailyFromMonthly = (m)=> m/30.44;

// ---- (Safe) dynamic imports so file runs without Firebase present -------------
async function getFirebase() {
  try {
    const auth = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
    const fs   = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
    return { getAuth:auth.getAuth, getFirestore:fs.getFirestore, doc:fs.doc, getDoc:fs.getDoc, setDoc:fs.setDoc };
  } catch { return {}; }
}

// ---- Tiny helpers -------------------------------------------------------------
function el(tag, cls, html){ const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; }
function idScopeCSS(css, id){
  // prefix all top-level selectors with #id (very light, good enough for our rules)
  return css.replace(/(^|\})\s*([^@}\s][^{]*)\{/g, (_,b,sel)=>`${b} #${id} ${sel}{`);
}
function storeKey(uid, kind){ return `energy-unv:${uid||'anon'}:${kind}`; } // kind: 'in'|'out'

// ---- Draft persistence (localStorage) ----------------------------------------
function saveDraft(uid, kind, data){ try{ localStorage.setItem(storeKey(uid,kind), JSON.stringify(data)); }catch{} }
function loadDraft(uid, kind){ try{ return JSON.parse(localStorage.getItem(storeKey(uid,kind))||'null'); }catch{ return null; } }

// ---- Firebase read/write (guarded) -------------------------------------------
async function readUnverified(uid){
  const { getFirestore, doc, getDoc } = await getFirebase();
  if (!getFirestore) return null;
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/financialData/cashflowData/unverified/core`));
  return snap.exists() ? (snap.data() || {}) : null;
}
async function writeDailyAverages(uid, inflowMonthly, outflowMonthly){
  if (!CFG.enableDailyAveragesWrite) return;
  const { getFirestore, doc, setDoc } = await getFirebase(); if (!getFirestore) return;
  const db = getFirestore();
  await setDoc(doc(db, `players/${uid}/financialData/dailyAverages`), {
    income: Number(dailyFromMonthly(inflowMonthly).toFixed(2)),
    coreSpend: Number(dailyFromMonthly(outflowMonthly).toFixed(2)),
    updatedAt: Date.now()
  }, { merge:true });
}
async function setModeToUnverified(uid){
  const { getFirestore, doc, setDoc } = await getFirebase(); if (!getFirestore) return;
  const db = getFirestore();
  await setDoc(doc(db, `players/${uid}`), { transactionMode: "unverified" }, { merge:true });
}
async function saveUnverifiedDoc(uid, payload){
  const { getFirestore, doc, setDoc } = await getFirebase(); if (!getFirestore) return;
  const db = getFirestore();
  await setDoc(doc(db, `players/${uid}/financialData/cashflowData/unverified/core`), payload, { merge:true });
  await setDoc(doc(db, `players/${uid}/financialData/cashflowData`), payload, { merge:true }); // active doc for gateway readers
}

// ---- Unified card (legacy parity) --------------------------------------------
function buildUnifiedCard(kind, onChange, uid) {
  const isIncome = (kind==='in');
  const cats = isIncome ? CFG.incomeCats : CFG.expenseCats;

  const card = el("div","card","");

  // Itemise toggle
  const itemiseRow = el("div","field","");
  const itemise = document.createElement("input"); itemise.type="checkbox"; itemise.id=`${kind}-itemise`;
  const itemiseLbl = el("label","hint","Itemise by category"); itemiseLbl.prepend(itemise);
  itemiseRow.append(itemiseLbl);

  // Cadence + Total amount
  const inline = el("div","inline","");
  const cadWrap = el("div","field","<label class='hint'>Cadence</label>");
  const cad = document.createElement("select"); cad.className="ao-select";
  CFG.cadenceOptions.forEach(c=>{ const o=document.createElement("option"); o.value=c; o.textContent=c[0].toUpperCase()+c.slice(1); cad.append(o); });
  cad.value = "monthly"; cadWrap.append(cad);

  const totalWrap = el("div","field","<label class='hint'>Total amount</label>");
  const total = document.createElement("input"); total.type="number"; total.step="0.01"; total.min="0"; total.className="ao-number";
  total.placeholder = isIncome ? "e.g. 3200.00" : "e.g. 1800.00";
  totalWrap.append(total);
  inline.append(cadWrap, totalWrap);

  // Category grid
  const catField = el("div","field","<label class='hint'>Categories</label>");
  const catGrid = el("div","gridCat","");
  const catInputs = new Map();
  cats.forEach(([key,label])=>{
    const lab = el("div","",label);
    const inp = document.createElement("input"); inp.type="number"; inp.step="0.01"; inp.min="0"; inp.className="ao-number"; inp.dataset.key=key;
    catInputs.set(key, inp); catGrid.append(lab, inp);
  });
  catField.append(catGrid);
  catField.style.display="none";

  const err = el("div","err","");

  card.append(itemiseRow, inline, catField, err);

  function reflectItemise(){
    const on = itemise.checked;
    catField.style.display = on ? "" : "none";
    total.readOnly = on;
    total.style.opacity = on ? "0.7" : "1";
    if (on) recomputeFromCats();
  }
  function recomputeFromCats(){
    let sum=0; catInputs.forEach(inp=>{ sum += Math.max(0, Number(inp.value)||0); });
    total.value = String(sum.toFixed(2));
  }
  function validate(){
    const val = Number(total.value||0);
    if (!Number.isFinite(val) || val < 0) { err.textContent = "Please enter a valid amount."; return false; }
    err.textContent = ""; return true;
  }
  function collectMonthly(){
    const cadence = cad.value || "monthly";
    const totalMonthly = toMonthly(Number(total.value||0), cadence);
    const categories = {};
    catInputs.forEach((inp, key)=>{
      const v = Math.max(0, Number(inp.value)||0);
      categories[key] = Number(toMonthly(v, cadence).toFixed(2));
    });
    return { cadence, total: Number(total.value||0), totalMonthly: Number(totalMonthly.toFixed(2)), categories };
  }

  // draft persistence
  function save(){
    const data = {
      itemise: itemise.checked,
      cadence: cad.value,
      total: Number(total.value||0),
      cats: Object.fromEntries([...catInputs.entries()].map(([k,i])=>[k, Number(i.value||0)])),
    };
    saveDraft(uid, kind, data);
    onChange?.();
  }
  function load(d){
    if(!d) return;
    itemise.checked = !!d.itemise;
    cad.value = d.cadence || "monthly";
    total.value = Number(d.total||0);
    Object.entries(d.cats||{}).forEach(([k,v])=>{ if (catInputs.has(k)) catInputs.get(k).value = Number(v||0); });
    reflectItemise();
  }

  // events
  itemise.addEventListener("change", ()=>{ reflectItemise(); save(); });
  cad.addEventListener("change", save);
  total.addEventListener("input", ()=>{ validate(); save(); });
  catInputs.forEach(inp => { inp.addEventListener("input", ()=>{ if(itemise.checked) recomputeFromCats(); save(); }); });

  return {
    node: card,
    validate,
    collectMonthly,
    loadSaved(saved){
      const src = saved || {};
      const m = src.totalMonthly || 0;
      const catsObj = src.categories || {};
      // snapshot: load as monthly totals
      total.value = Number(m.toFixed(2));
      cad.value = "monthly";
      Object.keys(catsObj).forEach(k=>{ if (catInputs.has(k)) catInputs.get(k).value = Number((catsObj[k]||0).toFixed(2)); });
      const anyCat = Object.values(catsObj).some(v => Number(v||0)>0);
      itemise.checked = anyCat;
      reflectItemise();
      // then overlay local draft if present
      const draft = loadDraft(uid, kind);
      if (draft) load(draft);
    }
  };
}

// ---- Styles (scoped to #emRoot) ----------------------------------------------
function ensureStyles(){
  const ID="energy-unverified-styles", ROOT="emRoot";
  document.getElementById(ID)?.remove();
  const css = `
  :root{
    --bg:#0f1118; --panel:#111827; --edge:#1f2937; --ink:#fff;
    --muted:.85; --green:#10b981; --red:#ef4444; --chip:#0d1220; 
  }

  /* --- layout safety so nothing gets cropped or overflows --- */
  .kbox{ min-width:0; overflow:visible; }             /* allow date icon etc. */
  .inline{ display:flex; gap:10px; }
  .inline > *{ flex:1; min-width:0; }                 /* input/select can shrink */
  .anchor-row{ display:grid; grid-template-columns:auto 1fr; gap:8px; align-items:center; } /* label auto, input fills */

  /* form controls: use border-box so 100% width includes padding/border */
  .ao-input, .ao-select, .ao-number,
  input[type="number"], input[type="date"], select{
    width:100%; box-sizing:border-box;
    padding:8px; border-radius:8px; border:1px solid #2a3a55; background:#0d1220; color:#fff; outline:none;
  }

  /* pills & buttons */
  .pill{padding:6px 12px;border-radius:999px;border:1px solid #2a3a55;background:var(--chip);color:#fff}
  .pill.active{outline:2px solid #3b82f6}
  .btnPrimary{border-color:#3b82f6;background:#0f1b33}

  /* summary tiles */
  .summary{display:grid;gap:10px;margin-top:8px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .kval{font-weight:700}
  .kval.green{ color: var(--green) !important; }
  .kval.red{ color: var(--red) !important; }
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

  /* cards */
  .section{margin-top:6px;border-top:1px dashed var(--edge);padding-top:8px}
  .card{border:1px solid #223044;border-radius:14px;padding:12px;background:#121626}
  .field{display:flex;flex-direction:column;gap:6px;margin-top:8px}
  .gridCat{display:grid;grid-template-columns:1fr auto;gap:8px 10px}
  .err{font-size:12px;color:#fca5a5;min-height:16px}

  @media (max-width:680px){
    .net-collapsible-inner{grid-template-columns:1fr}
  }
  `;
  const tag=document.createElement('style'); tag.id=ID; tag.textContent=idScopeCSS(css, ROOT);
  document.head.appendChild(tag);
}


// ---- Main builder -------------------------------------------------------------
async function buildNode(){
  ensureStyles();
  const root = el('div',''); root.id='emRoot';

  // modal skeleton parts
  const head = el('div','modal-head','');
  const body = el('div','modal-body','');
  const foot = el('div','modal-footer','');

  // Title + actions (Connect bank, Continuous/Finite)
  head.append(el('div','modal-head-title','Energy'));
  const actionsRow = el('div','',`
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
      <button id="btnConnect" class="pill btnPrimary">Connect bank</button>
      <button id="pill-cont" class="pill active">Continuous</button>
      <button id="pill-fin"  class="pill">Finite</button>
    </div>
  `);
  head.append(actionsRow);

  // Summary rows: Anchor date + Credit mode
  const summaryHost = el("div","summary","");
  head.append(summaryHost);

  // Tabs
  const tabsBar = el("div","tabs","<button class='tab in active' id='tabIn'>Energy Source</button><button class='tab out' id='tabOut'>Emberward</button>");
  head.append(tabsBar);

  // Container in body for the card
  const section = el("div","section","");
  const holder  = el("div","");
  section.append(holder); body.append(section);

  // Footer
  foot.innerHTML = `
    <button class="modal-btn" data-act="close">Close</button>
    <span style="flex:1"></span>
    <button class="modal-btn modal-btn-primary" data-act="apply">Apply &amp; Continue</button>
  `;

  // ---------- state ----------
  const { getAuth } = await getFirebase();
  const uid = getAuth?.().currentUser?.uid || null;

  let mode = "continuous";
  let anchorMs = null;
  let creditMode = "essence";
  let inCard  = buildUnifiedCard('in',  ()=>buildSummary(), uid);
  let outCard = buildUnifiedCard('out', ()=>buildSummary(), uid);

  // ---------- summary (anchor + credit + tiles + bar + net) ----------
  function buildSummary(){
    const inM  = inCard?.collectMonthly()?.totalMonthly || 0;
    const outM = outCard?.collectMonthly()?.totalMonthly || 0;

    summaryHost.innerHTML = "";

    // Anchor
    const anchorBox = el("div","kbox","");
    const anchorRow = el("div","anchor-row","");
    const anchorLbl = el("div","muted","Anchor date:");
    const date = document.createElement("input");
    date.type = "date"; date.className = "ao-input";
    if (anchorMs) {
      const d = new Date(anchorMs);
      date.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    date.addEventListener("change", ()=>{
      if (!date.value) { anchorMs = null; return; }
      const [y,m,d] = date.value.split("-").map(Number);
      anchorMs = new Date(y, m-1, d).getTime();
    });
    anchorRow.append(anchorLbl, date);
    anchorBox.append(anchorRow);

    // Credit Mode
    const cmRow = el("div","anchor-row","");
    const cmLbl = el("div","muted","Credit mode:");
    const cmSel = document.createElement("select");
    cmSel.className = "ao-select";
    ["essence","allocate","health"].forEach(opt=>{
      const o=document.createElement("option");
      o.value=opt; o.textContent=opt[0].toUpperCase()+opt.slice(1); cmSel.append(o);
    });
    cmSel.value = creditMode;
    cmSel.addEventListener("change",()=>{ creditMode = cmSel.value; });
    cmRow.append(cmLbl, cmSel);
    anchorBox.append(cmRow);

    // Tiles: Energy Source / Emberward
    const row1 = el("div","row","");
    row1.append(el("div","kbox",`<div>Energy Source</div><div class="kval green">${GBP(inM)}/mo</div>`));
    row1.append(el("div","kbox",`<div>Emberward</div><div class="kval red">${GBP(outM)}/mo</div>`));

    // Bar (net as proportion of inflow)
    const bar = el("div","bar",""); const fill=document.createElement("div"); bar.append(fill);
    const pct = Math.max(0, Math.min(100, inM ? ((inM-outM)/inM)*100 : 0));
    fill.style.width = pct + "%";

    // Net per month (collapsible with daily/weekly)
    const netRow = el("div","net-row","");
    const netBox = el("div","net-box","");
    const left = el("div","net-left","");
    left.append(el("div","net-label","Net per month"), el("div","net-value", `${GBP(inM-outM)}/mo`));
    const chev = el("span","chev","▾");
    netBox.append(left, chev);

    const slide = el("div","net-collapsible","");
    const inner = el("div","net-collapsible-inner","");
    const daily = el("div","kbox",""); daily.innerHTML = `<div class="muted">Daily</div><div class="kval-sm">${GBP((inM-outM)/30.44)}</div>`;
    const weekly= el("div","kbox",""); weekly.innerHTML = `<div class="muted">Weekly</div><div class="kval-sm">${GBP((inM-outM)/(52/12))}</div>`;
    inner.append(daily, weekly); slide.append(inner);

    netBox.addEventListener("click", ()=>{
      const expanded = netBox.classList.toggle("expanded");
      slide.style.maxHeight = expanded ? inner.scrollHeight + "px" : "0px";
    });

    netRow.append(netBox, slide);

    summaryHost.append(anchorBox, row1, bar, netRow);
  }

  // ---------- tabs & cards ----------
  function show(kind){
    head.querySelector('#tabIn').classList.toggle('active', kind==='in');
    head.querySelector('#tabOut').classList.toggle('active', kind!=='in');
    holder.innerHTML = "";
    holder.append(kind==='in' ? inCard.node : outCard.node);
    buildSummary();
  }

  // ---------- hydrate from saved (legacy parity) ----------
  async function hydrateFromSaved(){
    const saved = (uid && CFG.performWrites) ? await readUnverified(uid) : null;
    if (saved?.inflow)  inCard.loadSaved(saved.inflow);
    if (saved?.outflow) outCard.loadSaved(saved.outflow);
    if (saved?.payCycleAnchorMs) anchorMs = Number(saved.payCycleAnchorMs)||null;
    if (saved?.creditMode) creditMode = String(saved.creditMode||'essence');
    buildSummary();
  }

  // ---------- mode switch (continuous / finite) ----------
  function setMode(m){
    mode=m;
    head.querySelector("#pill-cont").classList.toggle("active", m==='continuous');
    head.querySelector("#pill-fin").classList.toggle("active", m==='finite');
    show('in'); // keep current card visible
    buildSummary();
  }

  // ---------- wire head buttons ----------
  head.querySelector("#btnConnect").addEventListener("click", ()=>{
    // Let the app open its consent/connect flow
    root.dispatchEvent(new CustomEvent('energyMenu:connectTL',{ bubbles:true }));
  });
  head.querySelector("#pill-cont").addEventListener("click", ()=> setMode('continuous'));
  head.querySelector("#pill-fin").addEventListener("click",  ()=> setMode('finite'));
  head.querySelector("#tabIn").addEventListener("click",  ()=> show('in'));
  head.querySelector("#tabOut").addEventListener("click", ()=> show('out'));

  // ---------- initial paint ----------
  setMode('continuous');
  show('in');
  await hydrateFromSaved();

  // ---------- footer actions ----------
  foot.addEventListener('click', async (e)=>{
    const b = e.target.closest('[data-act]'); if(!b) return;
    if (b.dataset.act==='close') {
      root.dispatchEvent(new CustomEvent('requestClose',{ bubbles:true }));
      return;
    }
    if (b.dataset.act==='apply') {
      // validate
      if (!inCard.validate() || !outCard.validate()) return;

      const inMonthly  = inCard.collectMonthly();
      const outMonthly = outCard.collectMonthly();

      const payload = {
        energyMode: mode==="finite" ? "finite" : "continuous",
        creditMode: creditMode || 'essence',
        cadence: "monthly",
        inflow:  { total: Number(inMonthly.totalMonthly.toFixed(2)),  itemised: inMonthly.categories },
        outflow: { total: Number(outMonthly.totalMonthly.toFixed(2)), itemised: outMonthly.categories },
        netflow: Number((inMonthly.totalMonthly - outMonthly.totalMonthly).toFixed(2)),
        payCycleAnchorMs: anchorMs ?? null,
        updatedAt: Date.now(),
        transactionMode: "unverified"
      };

      try{
        if (uid && CFG.performWrites){
          await saveUnverifiedDoc(uid, payload);
          await setModeToUnverified(uid);
          await writeDailyAverages(uid, inMonthly.totalMonthly, outMonthly.totalMonthly);
        }
        // notify app
        root.dispatchEvent(new CustomEvent('cashflow:updated',{ bubbles:true, detail:{ source:'energy-unverified', payload } }));
        root.dispatchEvent(new CustomEvent('hub:requestRefresh',{ bubbles:true }));
        root.dispatchEvent(new CustomEvent('requestClose',{ bubbles:true }));
      } catch (e) {
        alert("Could not save your Energy settings. " + (e?.message || e));
      }
    }
  });

  // assemble
  root.append(head, body, foot);
  return root;
}

// ---- Public API ---------------------------------------------------------------
export async function openEnergyUnverified(){
  const node = await buildNode();
  const h = openModal({ content: node, owner:'hub', scope:'screen' });
  node.addEventListener('requestClose', ()=>h.close());
  return h;
}
