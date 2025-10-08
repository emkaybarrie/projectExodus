// energy-unverified.js — Unverified Energy Menu (unified inputs)
// Preserves legacy UI & styling.
// Adds: Credit Mode selector (essence | allocate | health), Anchor date,
// writes to cashflowData/unverified/core + active cashflowData, and sets transactionMode=unverified.

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ensureTlConsentDialog, connectTrueLayerAccount } from "./truelayer.js";
import { openEnergyMenu, scopeCSS } from "./energy-menu.js";
import { refreshVitalsHUD } from "./energy-vitals.js";

// ─────────────────────────── CONFIG ───────────────────────────
const CFG = {
  enableDailyAveragesWrite: false,
  currency: "GBP",
  cadenceOptions: ["monthly","weekly","fortnightly","daily","quarterly","yearly"],
  incomeCats:  [["salary","Salary/Wages"],["bonus","Bonus"],["side","Side income"],["other","Other"]],
  expenseCats: [["shelter","Rent/Mortgage"],["bills","Bills & Utilities"],["groceries","Groceries"],
                ["transport","Transport"],["debt","Debts"],["other","Other"]],
};
const GBP = (n)=> new Intl.NumberFormat("en-GB",{style:"currency",currency:CFG.currency}).format(Number(n)||0);
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };

// ─────────────────────────── STYLE ───────────────────────────
function ensureStyles(){
  const STYLE_ID = 'em-styles';
  const OVERLAY_ID = 'emOverlay';
  const prev = document.getElementById(STYLE_ID);
  if (prev) prev.remove();
  const css = `
  :root{ --bg:#0f1118; --panel:#111827; --edge:#1f2937; --ink:#fff;
         --muted:.85; --green:#10b981; --red:#ef4444; --blue:#3b82f6; --chip:#0d1220; }
  #emOverlay{position:fixed;inset:0;background:rgba(6,8,12,.88);backdrop-filter:saturate(120%) blur(3px);
    z-index:9999;display:flex;align-items:center;justify-content:center}
  #emWrap{width:min(1024px,94vw);max-height:94vh;display:flex;flex-direction:column;background:var(--bg);
    color:var(--ink);border:1px solid #273142;border-radius:16px;box-shadow:0 20px 80px rgba(0,0,0,.5);overflow:hidden}
  #emTop{position:sticky;top:0;z-index:3;background:var(--bg);border-bottom:1px solid var(--edge)}
  #emTopInner{padding:16px}
  #emBody{flex:1;min-height:0;overflow:auto;padding:0 16px 12px 16px}
  .actions{display:flex;gap:8px;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--edge);
    background:var(--bg);position:sticky;bottom:0;z-index:2}
  h2{margin:0 0 8px;font-size:20px}
  .pill{padding:6px 12px;border-radius:999px;border:1px solid #2a3a55;background:var(--chip);color:#fff}
  .pill.active{outline:2px solid var(--blue)}
  .btnPrimary{border-color:#3b82f6;background:#0f1b33}

  .summary{display:grid;gap:10px;margin-top:8px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .kbox{border-radius:12px;padding:10px 12px;background:#111827;border:1px solid #1f2937;min-width:0}
  .kval{font-weight:700}
  .green{color:var(--green)} .red{color:var(--red)} .muted{opacity:.85}
  .bar{height:14px;border-radius:12px;background:var(--edge);overflow:hidden}
  .bar>div{height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#06b6d4)}

  .anchor-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
  .ao-input,.ao-select{width:100%;padding:8px;border-radius:8px;border:1px solid #2a3a55;background:#0d1220;color:#fff}

  
  .net-row{display:grid;grid-template-columns:1fr;gap:10px}
  .net-box{position:relative; display:flex; align-items:center; justify-content:space-between;
           padding:10px 12px; border-radius:12px; background:#111827; border:1px solid #1f2937; cursor:pointer;}
  .net-left{display:flex; align-items:center; gap:10px}
  .net-label{opacity:.85}
  .net-value{font-weight:700}
  .chev{opacity:.7; transition:transform .2s ease}
  .net-box.expanded .chev{transform:rotate(180deg)}
  .net-collapsible{overflow:hidden; max-height:0; transition:max-height .24s ease;}
  .net-collapsible-inner{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .kval-sm{font-weight:700}

  /* Tabs (single set, subtle aura on active) */
  .tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 6px}
  .tab{padding:8px 10px;border:1px solid #2a3a55;border-radius:10px;background:var(--chip);color:var(--ink);text-align:center;transition:box-shadow .15s ease,border-color .15s ease}
  .tab.in.active{border-color:rgba(16,185,129,.5); box-shadow:0 0 0 1px rgba(16,185,129,.25), 0 0 12px rgba(16,185,129,.25) inset}
  .tab.out.active{border-color:rgba(239,68,68,.5);  box-shadow:0 0 0 1px rgba(239,68,68,.25),  0 0 12px rgba(239,68,68,.25) inset}

  .section{margin-top:6px;border-top:1px dashed var(--edge);padding-top:8px}
  .card{border:1px solid #223044;border-radius:14px;padding:12px;background:#121626}
  .field{display:flex;flex-direction:column;gap:6px;margin-top:8px}
  .inline{display:flex;gap:10px}
  .inline > *{flex:1}
  .gridCat{display:grid;grid-template-columns:1fr auto;gap:8px 10px}
  .ao-number{width:100%;padding:8px;border-radius:8px;border:1px solid #2a3a55;background:#0d1220;color:#fff}
  .hint{font-size:12px;opacity:.75}
  .err{font-size:12px;color:#fca5a5;min-height:16px}

  @media (max-width:680px){
    .net-collapsible-inner{grid-template-columns:1fr}
  }
  

  `;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=scopeCSS(css, OVERLAY_ID);
  document.head.appendChild(style);
}
function el(tag, cls, html){ const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; }

// ─────────────────────────── HELPERS ───────────────────────────
const toMonthly = (a,c)=> (Number(a)||0) * (MONTHLY_MULT[c] || 1);
const dailyFromMonthly = (m)=> m/30.44;
function storeKey(uid, kind){ return `energy-unv:${uid}:${kind}`; } // kind: 'in' | 'out'

async function readUnverified(uid){
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/financialData/cashflowData/unverified/core`));
  return snap.exists() ? (snap.data() || {}) : null;
}
async function writeDailyAverages(uid, inflowMonthly, outflowMonthly){
  if(!CFG.enableDailyAveragesWrite) return;
  const db=getFirestore();
  await setDoc(doc(db, `players/${uid}/financialData/dailyAverages`), {
    income: Number(dailyFromMonthly(inflowMonthly).toFixed(2)),
    coreSpend: Number(dailyFromMonthly(outflowMonthly).toFixed(2)),
    updatedAt: Date.now()
  }, { merge:true });
}

// ─────────────────────────── UNIFIED CARD ───────────────────────────
function buildUnifiedCard(kind, onChange) {
  const isIncome = (kind==='in');
  const cats = isIncome ? CFG.incomeCats : CFG.expenseCats;

  const card = el("div","card","");
  // Itemise
  const itemiseRow = el("div","field","");
  const itemise = document.createElement("input"); itemise.type="checkbox"; itemise.id=`${kind}-itemise`;
  const itemiseLbl = el("label","hint","Itemise by category"); itemiseLbl.prepend(itemise);
  itemiseRow.append(itemiseLbl);

  // Cadence + Total
  const inline = el("div","inline","");
  const cadWrap = el("div","field","<label class='hint'>Cadence</label>");
  const cad = document.createElement("select"); cad.className="ao-select";
  CFG.cadenceOptions.forEach(c=>{ const o=document.createElement("option"); o.value=c; o.textContent=c[0].toUpperCase()+c.slice(1); cad.append(o); });
  cad.value="monthly"; cadWrap.append(cad);

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
  const uid = getAuth().currentUser?.uid || "anon";
  const dKey = storeKey(uid, kind);
  function saveDraft(){
    const data = {
      itemise: itemise.checked,
      cadence: cad.value,
      total: Number(total.value||0),
      cats: Object.fromEntries([...catInputs.entries()].map(([k,i])=>[k, Number(i.value||0)])),
    };
    localStorage.setItem(dKey, JSON.stringify(data));
    onChange?.();
  }
  function loadDraft(d){
    if(!d) return;
    itemise.checked = !!d.itemise;
    cad.value = d.cadence || "monthly";
    total.value = Number(d.total||0);
    Object.entries(d.cats||{}).forEach(([k,v])=>{
      if (catInputs.has(k)) catInputs.get(k).value = Number(v||0);
    });
    reflectItemise();
  }

  itemise.addEventListener("change", ()=>{ reflectItemise(); saveDraft(); });
  cad.addEventListener("change", saveDraft);
  total.addEventListener("input", ()=>{ validate(); saveDraft(); });
  catInputs.forEach(inp => { inp.addEventListener("input", ()=>{ if(itemise.checked) recomputeFromCats(); saveDraft(); }); });

  return {
    node: card,
    validate,
    collectMonthly,
    load: (data)=>{
      cad.value = "monthly";
      total.value = Number((data?.totalMonthly||0).toFixed(2));
      const catsObj = data?.categories || {};
      Object.keys(catsObj).forEach(k=>{
        if (catInputs.has(k)) catInputs.get(k).value = Number((catsObj[k]||0).toFixed(2));
      });
      const anyCat = Object.values(catsObj).some(v => Number(v||0)>0);
      itemise.checked = anyCat;
      reflectItemise();
      try { loadDraft(JSON.parse(localStorage.getItem(dKey)||'null')); } catch(_) {}
    },
    saveDraft
  };
}

// ─────────────────────────── SAVE ───────────────────────────
async function saveUnverifiedDoc({ mode, anchorMs, inflowMonthly, outflowMonthly, inflowCatsMonthly, outflowCatsMonthly, creditMode }){
  const user = getAuth().currentUser; if (!user) throw new Error("Not signed in");
  const uid = user.uid; const db = getFirestore();

  const payload = {
    energyMode: mode==="finite" ? "finite" : "continuous",
    creditMode: creditMode || 'essence',
    cadence: "monthly",
    inflow:  { total: Number(inflowMonthly.toFixed(2)),  itemised: inflowCatsMonthly },
    outflow: { total: Number(outflowMonthly.toFixed(2)), itemised: outflowCatsMonthly },
    netflow: Number(inflowMonthly - outflowMonthly).toFixed(2),
    payCycleAnchorMs: anchorMs ?? null,
    updatedAt: Date.now()
  };

  await setDoc(doc(db, `players/${uid}/financialData/cashflowData/unverified/core`), payload, { merge:true });

  await writeDailyAverages(uid, inflowMonthly, outflowMonthly);

  // Active doc for gateway readers
  await setModeToUnverified();
  const tMode = await getTransactionMode();
  payload.transactionMode = tMode;
  await setDoc(doc(db, `players/${uid}/financialData/cashflowData`), payload, { merge: true });
}

// ─────────────────────────── MODAL ───────────────────────────
export async function openEnergyUnverified(){
  ensureStyles();

  const overlay = el("div",""); overlay.id="emOverlay";
  const wrap = el("section",""); wrap.id="emWrap";

  const top = el("div",""); top.id="emTop";
  top.innerHTML = `
    <div id="emTopInner">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <h2 style="margin:0">Energy</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="btnConnect" class="pill btnPrimary">Connect bank</button>
          <button id="pill-cont" class="pill active">Continuous</button>
          <button id="pill-fin"  class="pill">Finite</button>
        </div>
      </div>
      <div class="summary" id="emSummary"></div>
      <div class="tabs" id="emTabs" style="display:none">
        <button class="tab in active"  id="tabIn">Energy Source</button>
        <button class="tab out"        id="tabOut">Emberward</button>
      </div>
    </div>
  `;

  const body = el("div",""); body.id="emBody";
  const actions = el("div","actions","");
  actions.innerHTML = `
    <button id="btnClose" class="pill">Close</button>
    <button id="btnApply" class="pill">Apply & Continue</button>
  `;
  wrap.append(top, body, actions); overlay.append(wrap); document.body.appendChild(overlay);

  // refs
  const btnConnect = top.querySelector("#btnConnect");
  const pillCont = top.querySelector("#pill-cont");
  const pillFin  = top.querySelector("#pill-fin");
  const btnClose = actions.querySelector("#btnClose");
  const btnApply = actions.querySelector("#btnApply");
  const summaryHost = top.querySelector("#emSummary");
  const tabsBar  = top.querySelector("#emTabs");
  const tabInBtn = tabsBar.querySelector("#tabIn");
  const tabOutBtn= tabsBar.querySelector("#tabOut");

  // state
  let mode = "continuous";
  let inCard, outCard;
  let anchorMs = null;
  let creditMode = "essence";

  // ── Summary with Anchor + Credit Mode + Net toggle
  function buildSummary(){
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
      o.value=opt; o.textContent=opt[0].toUpperCase()+opt.slice(1);
      cmSel.append(o);
    });
    cmSel.value=creditMode;
    cmSel.addEventListener("change",()=>{ creditMode = cmSel.value; });
    cmRow.append(cmLbl, cmSel);
    anchorBox.append(cmRow);

    const inM  = inCard?.collectMonthly()?.totalMonthly || 0;
    const outM = outCard?.collectMonthly()?.totalMonthly || 0;

    // Totals
    const row1 = el("div","row","");
    row1.append(el("div","kbox",`<div>Energy Source</div><div class="kval green">${GBP(inM)}/mo</div>`));
    row1.append(el("div","kbox",`<div>Emberward</div><div class="kval red">${GBP(outM)}/mo</div>`));

    // Bar
    const bar = el("div","bar",""); const fill=document.createElement("div"); bar.append(fill);
    const pct = Math.max(0, Math.min(100, inM ? ((inM-outM)/inM)*100 : 0));
    fill.style.width = pct + "%";

    // Net toggle
    const netRow = el("div","net-row","");
    const netBox = el("div","net-box","");
    const left = el("div","net-left","");
    left.append(el("div","net-label","Net per month"), el("div","net-value", `${GBP(inM-outM)}/mo`));
    const chev = el("span","chev","▾");
    netBox.append(left, chev);

    const slide = el("div","net-collapsible","");
    const inner = el("div","net-collapsible-inner","");
    const daily = el("div","kbox",""); daily.innerHTML = `<div class="muted">Daily</div><div class="kval-sm">${GBP((inM-outM)/30.44)}</div>`;
    const weeky = el("div","kbox",""); weeky.innerHTML = `<div class="muted">Weekly</div><div class="kval-sm">${GBP((inM-outM)/(52/12))}</div>`;
    inner.append(daily, weeky); slide.append(inner);
    netBox.addEventListener("click", ()=>{
      const expanded = netBox.classList.toggle("expanded");
      slide.style.maxHeight = expanded ? inner.scrollHeight + "px" : "0px";
    });
    netRow.append(netBox, slide);

    summaryHost.append(anchorBox, row1, bar, netRow);
  }

  // rebuild summary when cards change
  const onChange = ()=> buildSummary();

  function renderContinuous(){
    body.innerHTML = "";
    tabsBar.style.display = "";

    inCard  = buildUnifiedCard('in',  onChange);
    outCard = buildUnifiedCard('out', onChange);

    const section = el("div","section",""); const holder = el("div","");
    section.append(holder); body.append(section);

    async function hydrateFromSaved(){
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      const saved = await readUnverified(uid);
      if (saved?.inflow)  inCard.load(saved.inflow);
      if (saved?.outflow) outCard.load(saved.outflow);
      if (saved?.payCycleAnchorMs) anchorMs = Number(saved.payCycleAnchorMs)||null;
      if (saved?.creditMode) creditMode = saved.creditMode;
      buildSummary();
    }

    function show(kind){
      tabInBtn.classList.toggle("active", kind==='in');
      tabOutBtn.classList.toggle("active", kind==='out');
      holder.innerHTML="";
      holder.append(kind==='in' ? inCard.node : outCard.node);
      buildSummary();
    }
    tabInBtn.onclick  = ()=> show('in');
    tabOutBtn.onclick = ()=> show('out');

    show('in');
    hydrateFromSaved().catch(console.warn);
    buildSummary();
  }

  function renderFinite(){
    body.innerHTML = "";
    tabsBar.style.display = "none";
    const card = el("div","card",`
      <h3 style="margin:0 0 8px;">Finite mode</h3>
      <p class="muted">Seed / duration / replenishment controls will appear here (placeholder).</p>
    `);
    body.append(card);
    buildSummary();
  }

  function setMode(m){
    mode=m;
    pillCont.classList.toggle("active",m==='continuous');
    pillFin.classList.toggle("active",m==='finite');
    if (m==='finite') renderFinite(); else renderContinuous();
  }
  pillCont.onclick = ()=> setMode('continuous');
  pillFin.onclick  = ()=> setMode('finite');
  setMode('continuous');

  // Header buttons
  btnConnect.onclick = ()=>{
    const dlg = ensureTlConsentDialog();
    dlg.showModal();
    const agree = dlg.querySelector('#tlAgree');
    const onAgree = async (ev) => {
      ev?.preventDefault?.();
      try {
        dlg.close();
        await connectTrueLayerAccount();
      } catch (e) {
        console.warn('TrueLayer connect failed:', e);
      } finally {
        agree.removeEventListener('click', onAgree);
      }
    };
    agree.addEventListener('click', onAgree);
  };

  btnClose.onclick = ()=> { overlay.remove(); window.dispatchEvent(new CustomEvent("energyMenu:closed")); };

  btnApply.onclick = async ()=>{
    try{
      if (!inCard?.validate() || !outCard?.validate()) return;
      const inMonthly  = inCard.collectMonthly();
      const outMonthly = outCard.collectMonthly();

      await saveUnverifiedDoc({
        mode,
        anchorMs,
        inflowMonthly: inMonthly.totalMonthly,
        outflowMonthly: outMonthly.totalMonthly,
        inflowCatsMonthly: inMonthly.categories,
        outflowCatsMonthly: outMonthly.categories,
        creditMode
      });

      await refreshVitalsHUD(getAuth().currentUser.uid, { recompute: true });
      overlay.remove();
      window.dispatchEvent(new CustomEvent("cashflow:updated", { detail:{ source:"energy-unverified" }}));
    }catch(e){
      alert("Could not save your Energy settings. " + (e?.message || e));
    }
  };

  return true;
}

// ----------------------- STUBS / In Progress functions -----------------------------
export async function setModeToUnverified(){
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) { console.warn("[EnergyMenu] No user logged in."); return; }
  const uid = user.uid;

  const db = getFirestore();
  await setDoc(doc(db, `players/${uid}`), {
    transactionMode: "unverified",
  }, { merge:true });
}

export async function getTransactionMode(){
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) { console.warn("[EnergyMenu] No user logged in."); return; }
  const uid = user.uid;

  const db = getFirestore();
  const snap = await getDoc(doc(db, "players", uid));
  return snap.exists() ? snap.data()?.transactionMode : null;
}
