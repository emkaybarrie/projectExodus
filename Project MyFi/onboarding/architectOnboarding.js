// Architect Onboarding
// Full-screen narration (word-by-word fade) ➜ tap anywhere ➜ modal inputs.
// Back jumps to previous INPUT scene (no narration replay).
// Matches dashboard itemisation UX (global cadence + category itemise).
// Includes TrueLayer Smart Review (amounts locked).
// Finish: window.location.replace('../dashboard.html').

import { auth, db, fns } from '../js/core/auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initHUD } from "../js/hud/hud.js";
import { VO, PROMPT, INFO } from "./architectCopy.js";

// Reuse same cashflow writers as dashboard
import { updateIncome, updateCoreExpenses } from "../js/data/cashflowData.js";

// Optional: TrueLayer connector (kept disabled by default)
let connectTrueLayerAccount = null;
try {
  const tl = await import('../js/core/truelayer.js');
  connectTrueLayerAccount = tl?.connectTrueLayerAccount || null;
} catch {}

/* ---------- DOM helpers ---------- */
const $ = (sel, root=document) => root.querySelector(sel);
const el = (tag, cls, html) => { const d=document.createElement(tag); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; };
const field = (label, input) => { const w=el('div','ao-field'); const l=el('label','',label); w.append(l,input); return w; };
const inputEl = (attrs={}) => { const i=el('input','ao-input'); Object.entries(attrs).forEach(([k,v])=>i.setAttribute(k,v)); return i; };
const selectEl = (opts) => { const s=el('select','ao-select'); opts.forEach(([v,t])=>{const o=el('option');o.value=v;o.textContent=t;s.appendChild(o);}); return s; };
const btn = (label, onClick) => { const b=el('button','ao-btn',label); b.addEventListener('click', onClick); return b; };
const btnAccent = (label, onClick) => { const b=btn(label,onClick); b.classList.add('ao-btn--accent'); return b; };
const tile = ({title, desc, key, selected=false, disabled=false}) => {
  const t=el('button','ao-tile'); t.type='button'; t.dataset.key=key;
  t.setAttribute('aria-selected', String(selected));
  if (disabled) { t.disabled = true; t.style.opacity = .5; }
  t.innerHTML=`<h4>${title}</h4><p>${desc||''}</p>`;
  return t;
};

/* ---------- Stage (narration) ---------- */
async function primeLayout(elm){
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch {}
  void elm.offsetHeight;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
function ensureStage(){ let st = document.getElementById('ao-stage'); if (!st){ st = document.createElement('div'); st.id='ao-stage'; document.body.appendChild(st); } return st; }
function clearStage(){ ensureStage().innerHTML=''; }
function showStage(){ ensureStage().classList.remove('hidden'); }
function hideStage(){ ensureStage().classList.add('hidden'); }
function setBackgroundBlack(){ const st=ensureStage(); st.className=''; st.style.background='#000'; }
function setBackgroundImage(url){ const st=ensureStage(); st.className='ao-bg-image'; st.style.backgroundImage=`url("${url}")`; }

let NARRATION_BOXED = false;
let SHOW_ADVANCE_CHIP = true;
let SPEED = { wordBase: 150, lineGap: 430, punctuationPause: 390 }; // tweakable

function setNarrationBoxed(flag){ NARRATION_BOXED = !!flag; }
function setAdvanceChipVisible(flag){ SHOW_ADVANCE_CHIP = !!flag; }
function setNarrationSpeed({ wordBase, lineGap, punctuationPause }={}){
  if (typeof wordBase === 'number') SPEED.wordBase = wordBase;
  if (typeof lineGap === 'number') SPEED.lineGap = lineGap;
  if (typeof punctuationPause === 'number') SPEED.punctuationPause = punctuationPause;
}
function setWordFade(secondsOrMs){
  const v = (typeof secondsOrMs === 'number') ? `${secondsOrMs}s` : String(secondsOrMs);
  document.documentElement.style.setProperty('--ao-word-fade', v);
}

// WHOLE words fade, not typewriter
async function speakLine(container, line){
  const p = document.createElement('p');
  container.appendChild(p);
  const words = line.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (i > 0) p.appendChild(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'ao-word';
    span.textContent = words[i];
    p.appendChild(span);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    void span.offsetWidth;
    span.classList.add('show');
    const w = words[i];
    const len = Math.max(1, w.replace(/[^\w]/g,'').length);
    const trailing = /[.,;:!?…]$/.test(w) ? SPEED.punctuationPause : 0;
    const delay = SPEED.wordBase + (len > 6 ? (len - 6) * 12 : 0) + trailing;
    await new Promise(r => setTimeout(r, delay));
  }
}

// Full-screen narration ➜ await tap anywhere
function playNarrationOnStage(text){
  clearStage(); showStage();
  const stage = ensureStage();
  const layer = el('div','ao-narration-layer');
  if (NARRATION_BOXED) layer.classList.add('boxed');
  stage.appendChild(layer);

  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

  let finishedResolve, tapResolve;
  const finished = new Promise(res => (finishedResolve = res));
  const awaitTap = new Promise(res => (tapResolve = res));

  (async () => {
    await primeLayout(layer);
    const seedP = document.createElement('p');
    const seed = document.createElement('span');
    seed.className = 'ao-word show'; seed.style.opacity = '0'; seed.textContent = '•';
    seedP.appendChild(seed); layer.appendChild(seedP);
    await new Promise(r => requestAnimationFrame(r)); seedP.remove();

    for (let i = 0; i < lines.length; i++) {
      await speakLine(layer, lines[i]);
      if (i < lines.length - 1) { await new Promise(r => setTimeout(r, SPEED.lineGap)); }
    }

    const adv = el('div','ao-advance', SHOW_ADVANCE_CHIP ? `<span class="chip">Continue</span>` : '');
    layer.appendChild(adv);
    if (SHOW_ADVANCE_CHIP) adv.classList.add('show');

    finishedResolve();

    function onAdvance(){
      layer.removeEventListener('click', onAdvance);
      document.removeEventListener('keydown', onKey);
      adv.classList.remove('show');
      tapResolve();
    }
    function onKey(e){ if (e.key === 'Enter' || e.key === ' ') onAdvance(); }
    layer.addEventListener('click', onAdvance);
    document.addEventListener('keydown', onKey);
  })();

  return { finished, awaitTap };
}

// Alias helpers
function validateAlias(str){
  const v = (str || '').trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(v)) {
    return { ok:false, msg:"Alias must be 3–32 chars: letters, numbers, _ or -." };
  }
  return { ok:true, val: v };
}
async function reserveAlias(alias){
  const setAlias = httpsCallable(fns, "setAlias");
  return await setAlias({ alias });
}

/* ===============================
   Dashboard-like Itemise Editor (global cadence + categories)
   =============================== */

// NOTE: if/when you want to reuse the exact dashboard component, swap this block
// for an import and a small wrapper that returns a DOM node and onChange values.

const CADENCE_OPTS = [['yearly','Yearly'],['monthly','Monthly'], ['weekly','Weekly'], ['daily','Daily']];

const DEFAULT_INCOME_CATS = [
  ['salary', 'Salary/Wages'], ['bonus', 'Bonus'], ['side', 'Side Income'], ['other', 'Other']
];
const DEFAULT_EXPENSE_CATS = [
  ['shelter', 'Rent/Mortgage'], ['bills', 'Bills'], ['groceries', 'Groceries'],
  ['transport', 'Transport'], ['debt', 'Debts'], ['other', 'Other']
];

function buildDashboardStyleEditor({
  kind,                      // 'income' | 'expenses'
  titleLabel = 'Total Amount',
  freqLabel  = 'Cadence',
  defaultFreq = 'monthly',
  initialTotal = '',         // number or ''
  initialItemise = false,
  initialCats = {},          // { key: amount }
  onChange                       // ({ monthly, total, cadence, mode, categories }) => void
}={}){
  const isIncome = (kind === 'income');
  const wrap = el('div');

  const cadence = selectEl(CADENCE_OPTS);
  cadence.value = defaultFreq;

  const totalInput = inputEl({ type:'number', step:'0.01', min:'0', placeholder: isIncome ? 'e.g. 3200.00' : 'e.g. 1800.00' });
  if (initialTotal !== '') totalInput.value = String(initialTotal);
  const totalField = field(titleLabel, totalInput);

  const toggleRow = el('div','ao-field');
  const chk = inputEl({ type:'checkbox' });
  chk.checked = !!initialItemise;
  toggleRow.append(el('label','', 'Itemise'), chk);

  const catsWrap = el('div'); catsWrap.style.display = chk.checked ? '' : 'none';
  const list = el('div'); list.style.display='grid'; list.style.gridTemplateColumns='1fr auto'; list.style.gap='8px 10px';
  catsWrap.append(field('Categories', list));
  const catDefs = isIncome ? DEFAULT_INCOME_CATS : DEFAULT_EXPENSE_CATS;
  const catInputs = new Map();
  catDefs.forEach(([key,label])=>{
    const lab = el('div','', label);
    const inp = inputEl({ type:'number', step:'0.01', min:'0', placeholder:'0.00' });
    inp.value = Number(initialCats?.[key] || 0) ? String(Number(initialCats[key]).toFixed(2)) : '';
    inp.dataset.key = key;
    catInputs.set(key, inp);
    list.append(lab, inp);
  });

  function toMonthly(total, cadenceVal){
    const a = Number(total) || 0;
    switch((cadenceVal||'monthly').toLowerCase()){
      case 'daily': return Number(a * 30.44).toFixed(2);
      case 'weekly': return Number(a * (52/12)).toFixed(2);
      case 'yearly': return Number(a / 12).toFixed(2);
      default: return Number(a).toFixed(2); // monthly
    }
  }

  function recomputeFromCats(){
    let sum = 0;
    catInputs.forEach(inp => { sum += Math.max(0, Number(inp.value)||0); });
    if (chk.checked){
      totalInput.value = String(Number(sum).toFixed(2));
    }
    emit();
  }

  function reflectMode(){
    const on = chk.checked;
    catsWrap.style.display = on ? '' : 'none';
    totalInput.readOnly = on;
    totalInput.style.opacity = on ? '0.75' : '1';
    if (on) recomputeFromCats(); else emit();
  }

  function emit(){
    const cadenceVal = cadence.value || 'monthly';
    const total = Number(totalInput.value || 0);
    const categories = {};
    catInputs.forEach((inp, k) => { categories[k] = Math.max(0, Number(inp.value)||0); });
    const monthly = Number(toMonthly(total, cadenceVal));
    onChange && onChange({
      monthly, total, cadence: cadenceVal,
      mode: chk.checked ? 'itemised' : 'totals',
      categories
    });
  }

  // wire
  cadence.addEventListener('change', emit);
  totalInput.addEventListener('input', emit);
  chk.addEventListener('change', reflectMode);
  catInputs.forEach(inp => inp.addEventListener('input', recomputeFromCats));

  // initial
  reflectMode();
  emit();

  wrap.append(field(freqLabel, cadence), totalField, toggleRow, catsWrap);
  return wrap;
}

/* ===============================
   SMART REVIEW (TrueLayer auto)
   =============================== */

const CADENCE_LABELS = {
  weekly:'Weekly', fortnightly:'Fortnightly', monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly', daily:'Daily'
};
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };
const FREQ_OPTIONS_FULL = [['weekly','Weekly'],['fortnightly','Fortnightly'],['monthly','Monthly'],['quarterly','Quarterly'],['yearly','Yearly'],['daily','Daily']];

function toMonthlyStrict(value, cadence){
  const mul = MONTHLY_MULT[cadence] ?? 1;
  return Number((Number(value||0) * mul).toFixed(2));
}
function confBadge(score){
  const span = el('span');
  const t = score>=0.85 ? 'High' : score>=0.6 ? 'Medium' : 'Low';
  span.textContent = `Confidence: ${t}`;
  span.style.font = '600 12px system-ui';
  span.style.opacity = .85;
  return span;
}
function money(n){ return '£' + Number(n||0).toFixed(2); }

function buildReviewRow(group, kind /* 'inflow'|'ember' */){
  // group: {id,name,cadence,representative,confidence,txCount}
  const row = el('div','ao-tile');

  const label = el('input','ao-input');
  label.value = group.name || '';
  label.placeholder = kind==='inflow' ? 'Label (e.g., Salary)' : 'Label (e.g., Rent)';

  const cad = el('select','ao-select');
  FREQ_OPTIONS_FULL.forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v;o.textContent=t; cad.append(o); });
  cad.value = group.cadence || 'monthly';

  const monthly = el('div');
  const mval = el('div'); mval.style.font='700 16px system-ui';
  const msub = el('div'); msub.style.font='12px system-ui'; msub.style.opacity=.8;
  monthly.append(mval, msub);

  const include = el('input'); include.type='checkbox'; include.checked = true;
  const includeLbl = el('label','', 'Include');

  const kindSel = el('select','ao-select');
  [['inflow','Inflow'],['ember','Ember (outflow)'],['ignore','Ignore']].forEach(([v,t])=>{
    const o = document.createElement('option'); o.value=v; o.textContent=t; kindSel.append(o);
  });
  kindSel.value = kind;

  const lock = el('div'); lock.textContent = '🔒 amounts from bank data';
  lock.style.font='12px system-ui'; lock.style.opacity=.75;

  const conf = confBadge(group.confidence ?? 0.5);

  function recalc(){
    const mon = toMonthlyStrict(group.representative || 0, cad.value);
    mval.textContent = money(mon) + '/mo';
    const base = `${money(group.representative || 0)} per ${CADENCE_LABELS[cad.value] || 'period'}`;
    msub.textContent = base + (group.txCount ? ` • ${group.txCount} hit${group.txCount>1?'s':''}` : '');
  }
  cad.addEventListener('change', recalc);
  recalc();

  const top = el('div'); top.style.display='grid'; top.style.gridTemplateColumns='1fr auto'; top.style.alignItems='center';
  const left = el('div'); left.append(label);
  const right = el('div'); right.append(conf);
  top.append(left,right);

  const grid = el('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='1fr 1fr'; grid.style.gap='10px';
  grid.append(field('Cadence', cad), field('Classify as', kindSel));

  const opts = el('div'); opts.style.display='flex'; opts.style.alignItems='center'; opts.style.gap='12px';
  const wrapChk = el('div'); wrapChk.append(includeLbl, include);
  opts.append(lock, wrapChk);

  row.append(top, grid, field('Monthly (derived)', monthly), opts);

  return {
    node: row,
    collect: ()=>({
      id: group.id,
      label: label.value.trim() || group.name || '',
      cadence: cad.value,
      representative: Number(group.representative || 0),
      monthly: toMonthlyStrict(group.representative || 0, cad.value),
      include: include.checked && kindSel.value!=='ignore',
      classAs: kindSel.value
    })
  };
}

function renderSmartReview(analysis){
  openOverlay(); setTitle('Review detected Source & Ember'); setProgress(3);

  const info = infoPanel(
    'We analysed your recent transactions. Amounts are locked to bank data. You can rename, include/exclude, ' +
    'reclassify items, or adjust cadence for monthly equivalence. You can add missing bills later.'
  );
  const row  = promptRow('Confirm what applies to you (you can tweak later in the dashboard).', 'review',
                         ()=> info.classList.toggle('open'));

  // Inflows
  const inflowWrap = el('div'); inflowWrap.append(el('h4','', 'Source (inflows)'));
  const inflowTop = (analysis.inflow || []).slice(0,3).map(g=>buildReviewRow(g,'inflow'));
  const inflowRest= (analysis.inflow || []).slice(3).map(g=>buildReviewRow(g,'inflow'));
  inflowTop.forEach(r => inflowWrap.append(r.node));
  let inflowExpanded = false;
  const inflowMoreBtn = btn('Show more', ()=>{
    inflowExpanded = !inflowExpanded;
    if (inflowExpanded){ inflowRest.forEach(r => inflowWrap.append(r.node)); inflowMoreBtn.textContent = 'Show less'; }
    else { inflowRest.forEach(r => r.node.remove()); inflowMoreBtn.textContent = 'Show more'; }
  });
  if (inflowRest.length>0) inflowWrap.append(inflowMoreBtn);

  // Ember
  const emberWrap = el('div'); emberWrap.append(el('h4','', 'Ember (foundation outflows)'));
  const emberTop = (analysis.ember || []).slice(0,6).map(g=>buildReviewRow(g,'ember'));
  const emberRest= (analysis.ember || []).slice(6).map(g=>buildReviewRow(g,'ember'));
  emberTop.forEach(r => emberWrap.append(r.node));
  let emberExpanded = false;
  const emberMoreBtn = btn('Show more', ()=>{
    emberExpanded = !emberExpanded;
    if (emberExpanded){ emberRest.forEach(r => emberWrap.append(r.node)); emberMoreBtn.textContent = 'Show less'; }
    else { emberRest.forEach(r => r.node.remove()); emberMoreBtn.textContent = 'Show more'; }
  });
  if (emberRest.length>0) emberWrap.append(emberMoreBtn);

  const inflowRows = [...inflowTop, ...inflowRest];
  const emberRows  = [...emberTop,  ...emberRest];

  const back = btn('Back', renderInputs4);
  const apply = btnAccent('Apply & Continue', ()=>{
    const inflowAccepted = inflowRows.map(r=>r.collect()).filter(x=>x.include && x.classAs==='inflow');
    const emberAccepted  = emberRows .map(r=>r.collect()).filter(x=>x.include && x.classAs==='ember');

    const incomeMonthly = Number(inflowAccepted.reduce((s,x)=> s + (x.monthly||0), 0).toFixed(2));
    const coreMonthly   = Number(emberAccepted .reduce((s,x)=> s + (x.monthly||0), 0).toFixed(2));

    state.source        = (incomeMonthly > 0) ? 'continuous' : 'reserve';
    state.incomeMonthly = incomeMonthly;
    state.coreMonthly   = coreMonthly;

    // Persist TL-derived detail in state (for later surfacing)
    state.sourceItemise = inflowAccepted.length > 0;
    state.sourceItems   = inflowAccepted.map(x=>({ label:x.label, amount:x.representative, freq:x.cadence }));
    state.sourceFreq    = 'monthly'; // we normalise to monthly for saving

    state.foundationItemise = emberAccepted.length > 0;
    state.foundationItems   = emberAccepted.map(x=>({ label:x.label, amount:x.representative, freq:x.cadence }));
    state.foundationFreq    = 'monthly';

    if (state.source === 'reserve'){
      return renderSmartReserveStretchPrompt();
    }
    playScene6();
  });

  setBody([row, info, inflowWrap, emberWrap, errBox()]);
  setFooter([back, apply]);
}

function renderSmartReserveStretchPrompt(){
  openOverlay(); setTitle('Stretch your reserve'); setProgress(3);
  const p = el('div','ao-prompt','No steady Source detected. Choose how long to stretch what you carry now.');
  const sel = selectEl([['3','3 months'],['4','4 months'],['6','6 months']]); sel.value = String(state.stretchMonths || 3);
  const back = btn('Back', ()=> renderSmartReview({ inflow:[], ember:[] }) );
  const next = btnAccent('Continue', ()=>{
    state.stretchMonths = Number(sel.value || 3);
    if (!state.runwayAmount) {
      // If you later pipe balance from TL analysis, set state.runwayAmount there.
      state.runwayAmount = Number(((state.incomeMonthly||0) * state.stretchMonths).toFixed(2));
    }
    state.incomeMonthly = Number((state.runwayAmount / state.stretchMonths).toFixed(2));
    playScene6();
  });
  setBody([p, field('Stretch over', sel)]);
  setFooter([back, next]);
}

/* ---------- Modal overlay (inputs) ---------- */
function ensureOverlay(){
  let ov = document.getElementById('ao-overlay');
  if (!ov){
    ov = document.createElement('div'); ov.id='ao-overlay';
    const card = document.createElement('div'); card.id='ao-card';
    const header = document.createElement('div'); header.id='ao-header';
    const title = document.createElement('div'); title.id='ao-title'; header.append(title);
    const body = document.createElement('div'); body.id='ao-body';
    const footer = document.createElement('div'); footer.id='ao-footer';
    const progress = document.createElement('div'); progress.id='ao-progress'; const bar = document.createElement('i'); progress.append(bar);
    body.append(progress);
    card.append(header, body, footer); ov.append(card); document.body.appendChild(ov);
  }
  return ov;
}
function openOverlay(){ ensureOverlay().setAttribute('data-open','true'); }
function closeOverlay(){ const ov=ensureOverlay(); ov.removeAttribute('data-open'); ov.style.display=''; }
function setTitle(s){ const t=document.getElementById('ao-title'); if (t) t.textContent = s; }
function setBody(nodes){ const b=document.getElementById('ao-body'); b?.querySelectorAll('.ao-screen').forEach(n=>n.remove()); const wrap=document.createElement('div'); wrap.className='ao-screen'; nodes.forEach(n=>wrap.append(n)); b.append(wrap); }
function setFooter(btns){ const f=document.getElementById('ao-footer'); if (!f) return; f.innerHTML=''; btns.forEach(b=>f.append(b)); }
function setProgress(step,total=8){ const bar = document.querySelector('#ao-progress i'); if (bar) bar.style.width = Math.round((step-0.5)*100/total)+'%'; }
function errBox(){ const d=el('div','ao-error'); d.id='ao-error'; return d; }
function showErr(msg){ const d=$('#ao-error'); if(d){ d.textContent=msg; d.style.display='block'; setTimeout(()=>d.style.display='none',2600); }}

/* Prompt + info helpers */
function infoPanel(text){ const box=el('div','ao-infopanel'); box.textContent=text; return box; }
function promptRow(label, infoKey, onInfo){
  const row = el('div','ao-prompt-row');
  const p = el('div','ao-prompt', label);
  row.append(p);
  if (infoKey){
    const m = el('button','ao-info-btn','More info');
    m.addEventListener('click', onInfo);
    row.append(m);
  }
  return row;
}
function tileGroup(options, onSelect, selectedKey){
  const wrap = el('div','ao-tiles');
  options.forEach(([key,label,desc=''])=>{
    const t = tile({ title: label, desc, key, selected: key===selectedKey });
    t.addEventListener('click', ()=>{
      wrap.querySelectorAll('.ao-tile').forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      onSelect(key);
    });
    wrap.appendChild(t);
  });
  return wrap;
}

/* ---------- State ---------- */
const state = {
  step: 1,
  alias: '',
  aliasReserved: false,

  alignment: 'balanced',      // 'balanced'|'enduring'|'ardent'|'everyday'
  affinity: 'air', // 'air'|'earth'|'water'|'fire'|'chaos'


  // Source (inflow)
  source: 'continuous',       // 'continuous'|'reserve'
  sourceFreq: 'monthly',
  sourceItemise: false,
  sourceCats: {},             // {salary, bonus, side, other}
  incomeMonthly: null,
  lastPayDateMs: null,

  // Reserve path
  runwayAmount: null,
  stretchMonths: 3,

  // Ember / Foundation (outflow)
  foundationFreq: 'monthly',
  foundationItemise: false,
  foundationCats: {},         // {shelter, bills, groceries, transport, debt, other}
  coreMonthly: null,

  // Later scenes
  mode: 'standard',           // 'relaxed'|'standard'|'focused'
  avatarMode: 'auto',         // 'auto'|'manual'
  avatar: null,

  // NEW — Essence capture (no avatar selection here)
  avatarFormation: {
    aspect: 'solar',        // 'solar' | 'lunar' | 'horizon' (balanced)
    weapon: '',             // dropdown choice or 'other'
    weaponOther: '',        // if weapon === 'other'
    attire: '',             // dropdown choice or 'other'
    attireOther: '',        // if attire === 'other'
    essenceText: ''         // free-text description
  }
};

// Input visited flags (skip narration on revisit)
const inputsVisited = { 1:false, 2:false, 3:false, 4:false, '4a': false, '4b': false, 5:false, 6:false, 7:false };

/* =========================================================
   INPUT RENDERERS (no narration)
   ========================================================= */
function renderInputs1(){
  inputsVisited[1] = true;
  openOverlay(); setTitle(VO.s1_title); setProgress(1);
  const info = infoPanel(INFO.alias);
  const row = promptRow(PROMPT.s1, 'alias', ()=> info.classList.toggle('open'));
  const name = inputEl({ placeholder:'Your spirit name', maxlength:'16', autocapitalize:'none' });
  name.value = state.alias || '';
  const fx = field('Spirit Name', name);

  const back = btn('Back', ()=>{});
  const next = btnAccent('Continue', onNext);

  setBody([row, info, fx, errBox()]);
  setFooter([back, next]);

  async function onNext(){
    const raw = name.value;
    const check = validateAlias(raw);
    if (!check.ok) return showErr(check.msg);
    const alias = check.val;

    if (state.aliasReserved && state.alias === alias) return proceed();

    next.disabled = true; back.disabled = true;
    const oldLabel = next.textContent; next.textContent = 'Checking…';

    try {
      await reserveAlias(alias);
      state.alias = alias;
      state.aliasReserved = true;
      proceed();
    } catch (e){
      const code = e?.code || '';
      if (code === 'already-exists') showErr('That alias is taken. Try another.');
      else if (code === 'invalid-argument') showErr('Alias must be 3–32 chars: letters, numbers, _ or -.');
      else showErr(e?.message || 'Could not reserve alias right now.');
      next.disabled = false; back.disabled = false; next.textContent = oldLabel;
      return;
    }
  }
  function proceed(){ playScene2(); }
}

function renderInputs2(){
  inputsVisited[2] = true;
  openOverlay(); setTitle(VO.s2_title); setProgress(2);
  const info = infoPanel(INFO.alignment);
  const row = promptRow(PROMPT.s2, 'alignment', ()=> info.classList.toggle('open'));
  const tiles = tileGroup([
    ['resilience','Sentinel'],
    ['will','Invoker'],
    ['adaptability','Strider'],
    ['balanced','Harmonist'],

  ], (key)=> state.alignment = key, state.alignment);

  const back = btn('Back', renderInputs1);
  const next = btnAccent('Continue', playScene3);
  setBody([row, info, tiles, errBox()]);
  setFooter([back, next]);
}

function renderInputs3(){
  inputsVisited[3] = true;
  openOverlay(); setTitle(VO.s3_title); setProgress(3);
  const info = infoPanel(INFO.affinity);
  const row = promptRow(PROMPT.s3, 'affinity', ()=> info.classList.toggle('open'));
  const tiles = tileGroup([
    ['air','Air'],
    ['earth','Earth'],
    ['water','Water'],
    ['fire','Fire'],
    ['chaos', 'Chaos'],
  ], (key)=> state.affinity = key, state.affinity);

  const back = btn('Back', renderInputs2);
  const next = btnAccent('Continue', playScene4);
  setBody([row, info, tiles, errBox()]);
  setFooter([back, next]);
}

function renderInputs4(){
  inputsVisited[4] = true;
  openOverlay(); setTitle(VO.s4_title); setProgress(4);

  const info = infoPanel(INFO.sourceChoice || '');
  const row  = promptRow(PROMPT.s4_choice || 'Choose your Source.', 'source', ()=> info.classList.toggle('open'));

  const tiles = el('div','ao-tiles');

  // Optional: TrueLayer smart path (disabled until ready)
  const TL_ENABLED = false;
  const tLink = tile({ title:'Link accounts (auto)', desc:'Detect your Source & Ember', key:'tl', disabled: !TL_ENABLED });
  tLink.addEventListener('click', async ()=>{
    if (!TL_ENABLED) return;
    // Always show Smart Review with a stub for now.
    // If the connector exists, attempt linking first; on error, still show the stub.
    const stub = {
      sourceType: 'continuous',
      inflow: [
        { id:'emp',    name:'Employer Ltd',        cadence:'monthly',   representative:2900, confidence:0.92, txCount:12 },
        { id:'stip',   name:'Scholarship Office',  cadence:'monthly',   representative:450,  confidence:0.78, txCount:9  },
        { id:'gift',   name:'Family Support',      cadence:'quarterly', representative:300,  confidence:0.55, txCount:4  }
      ],
      ember: [
        { id:'rent',   name:'Rent • Oak Estates',  cadence:'monthly',   representative:1250, confidence:0.96, txCount:12 },
        { id:'ins',    name:'Insurance • Admiral', cadence:'yearly',    representative:144,  confidence:0.72, txCount:1  },
        { id:'phone',  name:'Phone • Vodafone',    cadence:'monthly',   representative:18,   confidence:0.88, txCount:12 },
        { id:'energy', name:'Energy • Octopus',    cadence:'monthly',   representative:110,  confidence:0.83, txCount:11 },
        { id:'council',name:'Council Tax',         cadence:'monthly',   representative:150,  confidence:0.85, txCount:10 },
        { id:'train',  name:'Railcard',            cadence:'yearly',    representative:30,   confidence:0.60, txCount:1  },
        { id:'net',    name:'Internet • BT',       cadence:'monthly',   representative:29.99,confidence:0.91, txCount:12 }
      ]
    };

    try{
      if (connectTrueLayerAccount) {
        //const ok = await connectTrueLayerAccount();
        // You can fetch & analyse real transactions here later.
        // For now, regardless of ok, show the stubbed review:
        renderSmartReview(stub);
        return;
      }
      // No connector available—just show the stubbed review
      renderSmartReview(stub);
    }catch(e){
      // On any error, still let the user proceed with the stubbed review
      renderSmartReview(stub);
    }
  });

  const tCont = tile({ title:'A flowing stream of fuel', desc:'(recurring/ continuous)', key:'continuous', selected: state.source==='continuous' });
  const tResv = tile({ title:'A spark to light the kindling',    desc:'(finite / reserve)', key:'reserve',    selected: state.source==='reserve' });

  [tCont, tResv].forEach(t=>{
    t.addEventListener('click', ()=>{
      [tCont,tResv].forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      state.source = t.dataset.key;
    });
  });
  tiles.append(tLink, tCont, tResv);

  const back = btn('Back', renderInputs3);
  const next = btnAccent('Continue', ()=>{
    if (state.source==='continuous') return renderInputs4A();
    return renderInputs4B();
  });

  setBody([row, info, tiles, errBox()]);
  setFooter([back, next]);
}

// 3A: continuous (dashboard-style itemise editor)
function renderInputs4A(){
  inputsVisited['4a'] = true;
  openOverlay(); setTitle(PROMPT.s3a_title || 'Your Source — Stream'); setProgress(4);

  const info = infoPanel(INFO.sourceContinuous || '');
  const row  = promptRow(PROMPT.s4a || 'Describe your stream of fuel each cycle.', null, null);

  const editor = buildDashboardStyleEditor({
    kind: 'income',
    titleLabel: 'Amount per period (£)',
    freqLabel: 'Period',
    defaultFreq: state.sourceFreq || 'monthly',
    initialTotal: (state.incomeMonthly && state.sourceFreq)
      ? (state.sourceFreq==='monthly' ? state.incomeMonthly
        : state.sourceFreq==='weekly' ? Number((state.incomeMonthly/(52/12)).toFixed(2))
        : state.sourceFreq==='daily' ? Number((state.incomeMonthly/30.44).toFixed(2))
        : state.sourceFreq==='yearly' ? Number((state.incomeMonthly*12).toFixed(2))
        : state.incomeMonthly)
      : '',
    initialItemise: !!state.sourceItemise,
    initialCats: state.sourceCats || {},
    onChange: ({ monthly, total, cadence, mode, categories })=>{
      state.sourceFreq    = cadence;
      state.sourceItemise = (mode === 'itemised');
      state.sourceCats    = categories;
      state.incomeMonthly = Number(monthly || 0);
    }
  });

  const date = inputEl({ type:'date' });
  if (state.lastPayDateMs) { const d=new Date(state.lastPayDateMs); date.valueAsDate=d; }
  const fxDate = field('Last replenished', date);

  const back = btn('Back', renderInputs4);
  const next = btnAccent('Continue', ()=>{
    if (!Number.isFinite(state.incomeMonthly) || state.incomeMonthly <= 0)
      return showErr('Enter a positive amount for your stream.');
    state.lastPayDateMs = date.valueAsDate ? date.valueAsDate.getTime() : null;
    playScene5();
  });

  setBody([row, info, editor, fxDate, errBox()]);
  setFooter([back, next]);
}

// 3B: reserve
function renderInputs4B(){
  inputsVisited['4b'] = true;
  openOverlay(); setTitle(PROMPT.s4b_title || 'Your Source — Spark'); setProgress(4);

  const info = infoPanel(INFO.sourceReserve || '');
  const row  = promptRow(PROMPT.s4b || 'Share what you carry now, and how long you’ll make it last.', null, null);

  const amt    = inputEl({ type:'number', step:'0.01', min:'0', placeholder:'e.g. 4500.00' });
  if (state.runwayAmount!=null) amt.value = String(state.runwayAmount);
  const months = selectEl([['3','3 months'],['4','4 months'],['6','6 months']]);
  months.value = String(state.stretchMonths||3);

  const fx1 = field('Reserve total £', amt);
  const fx2 = field('Stretch it over', months);

  const back = btn('Back', renderInputs4);
  const next = btnAccent('Continue', ()=>{
    const vAmt = Number(amt.value||0);
    if (!Number.isFinite(vAmt) || vAmt<=0) return showErr('Enter a positive reserve amount.');
    const vMonths = Number(months.value||3);
    state.runwayAmount  = vAmt;
    state.stretchMonths = vMonths;
    state.incomeMonthly = Math.max(0, vAmt / vMonths);
    playScene5();
  });

  setBody([row, info, fx1, fx2, errBox()]);
  setFooter([back, next]);
}

// 5: Ember/Foundation (dashboard-style itemise editor)
function renderInputs5(){
  inputsVisited[5] = true;
  openOverlay(); setTitle(VO.s5_title || 'Your Ember'); setProgress(5);

  const info = infoPanel(INFO.ember || '');
  const row  = promptRow(PROMPT.s5 || 'How much fuel does your ember consume each period?', 'foundation',
                         ()=> info.classList.toggle('open'));

  const editor = buildDashboardStyleEditor({
    kind: 'expenses',
    titleLabel: 'Ember (Foundation) per period (£)',
    freqLabel: 'Period',
    defaultFreq: state.foundationFreq || 'monthly',
    initialTotal: (state.coreMonthly && state.foundationFreq)
      ? (state.foundationFreq==='monthly' ? state.coreMonthly
        : state.foundationFreq==='weekly' ? Number((state.coreMonthly/(52/12)).toFixed(2))
        : state.foundationFreq==='daily' ? Number((state.coreMonthly/30.44).toFixed(2))
        : state.foundationFreq==='yearly' ? Number((state.coreMonthly*12).toFixed(2))        
        : state.coreMonthly)
      : '',
    initialItemise: !!state.foundationItemise,
    initialCats: state.foundationCats || {},
    onChange: ({ monthly, total, cadence, mode, categories })=>{
      state.foundationFreq    = cadence;
      state.foundationItemise = (mode === 'itemised');
      state.foundationCats    = categories;
      state.coreMonthly       = Number(monthly || 0);
    }
  });

  const back = btn('Back', ()=>{
    if (state.source === 'continuous') return renderInputs4A();
    return renderInputs4B();
  });
  const next = btnAccent('Continue', ()=>{
    if (!Number.isFinite(state.coreMonthly) || state.coreMonthly < 0)
      return showErr('Enter 0 or more.');
    playScene6();
  });

  setBody([row, info, editor, errBox()]);
  setFooter([back, next]);
}

function renderInputs6(){
  inputsVisited[6] = true;
  openOverlay(); setTitle(VO.s6_title); setProgress(6);

  const info = infoPanel(INFO.flame);
  const row = promptRow(PROMPT.s6, 'flame', ()=> info.classList.toggle('open'));

  const tiles = tileGroup([
    ['focused','Gentle'],
    ['standard','Standard'],
    ['relaxed','Intense']
  ], (key)=> state.mode = key, state.mode);

  const back = btn('Back', renderInputs5);
  const next = btnAccent('Continue', playScene7);
  setBody([row, info, tiles, errBox()]);
  setFooter([back, next]);
}

function renderInputs7(){
  inputsVisited[7] = true;
  openOverlay(); setTitle(VO.s7_title); setProgress(7);

  const info = infoPanel(INFO.essence || 'Describe the shape your vessel should take. This guides how we’ll form your starting avatar later.');
  const row  = promptRow(PROMPT.s7 || 'Describe your essence and form.', 'essence', ()=> info.classList.toggle('open'));

// --- Aspect (Solar/Lunar/Horizon)
  const aspect = selectEl([
    ['solar','Solar — radiant, outward, assertive'],
    ['lunar','Lunar — reflective, inward, intuitive'],
    ['horizon','Horizon — balanced, harmonised, centring']
  ]);
  aspect.value = state.avatarFormation.aspect || 'solar';
  const fxAspect = field('Aspect', aspect);

  // --- Weapon (dropdown + Other)
  const weapon = selectEl([
    ['sword','Sword'],
    ['dagger','Daggers'],
    ['spear','Spear'],
    ['bow','Bow'],
    ['staff','Arcane Staff'],
    ['hammer','Warhammer'],
    ['whip','Chain/Whip'],
    ['talisman','Talisman/Focus'],
    ['shield','Shield (primary)'],
    ['other','Other…']
  ]);
  weapon.value = state.avatarFormation.weapon || '';
  const weaponOther = inputEl({ placeholder:'Describe your weapon…' });
  weaponOther.value = state.avatarFormation.weaponOther || '';
  weaponOther.style.display = (weapon.value === 'other') ? '' : 'none';
  weapon.addEventListener('change', ()=>{
    weaponOther.style.display = (weapon.value === 'other') ? '' : 'none';
  });
  const fxWeapon = field('Weapon', weapon);
  const fxWeaponOther = field('If Other', weaponOther);

  // --- Attire/Armour (dropdown + Other)
  const attire = selectEl([
    ['leathers','Leathers'],
    ['robes','Robes'],
    ['plate','Plate Armour'],
    ['mail','Mail/Scale'],
    ['regalia','Regalia/Ceremonial'],
    ['travel','Traveller’s Garb'],
    ['shadow','Shadowcloak'],
    ['mystic','Mystic Vestments'],
    ['other','Other…']
  ]);
  attire.value = state.avatarFormation.attire || '';
  const attireOther = inputEl({ placeholder:'Describe your attire…' });
  attireOther.value = state.avatarFormation.attireOther || '';
  attireOther.style.display = (attire.value === 'other') ? '' : 'none';
  attire.addEventListener('change', ()=>{
    attireOther.style.display = (attire.value === 'other') ? '' : 'none';
  });
  const fxAttire = field('Armour / Attire', attire);
  const fxAttireOther = field('If Other', attireOther);

  // --- Essence free text
  const essence = document.createElement('textarea');
  essence.className = 'ao-input';
  essence.rows = 4;
  essence.placeholder = "Describe your essence — posture, presence, movement; how your power shows up in form.";
  essence.value = state.avatarFormation.essenceText || '';
  const fxEssence = field('Essence', essence);

  // Footer
  const back = btn('Back', renderInputs6);
  const next = btnAccent('Continue', ()=>{
    // Persist to state
    state.avatarFormation.aspect      = aspect.value;
    state.avatarFormation.weapon      = weapon.value;
    state.avatarFormation.weaponOther = (weapon.value === 'other') ? (weaponOther.value || '').trim() : '';
    state.avatarFormation.attire      = attire.value;
    state.avatarFormation.attireOther = (attire.value === 'other') ? (attireOther.value || '').trim() : '';
    state.avatarFormation.essenceText = (essence.value || '').trim();

    // Minimal validation: ensure at least one of weapon/other, attire/other has content
    if (weapon.value === 'other' && !state.avatarFormation.weaponOther) {
      return showErr('Please describe your weapon.');
    }
    if (attire.value === 'other' && !state.avatarFormation.attireOther) {
      return showErr('Please describe your attire.');
    }

    playScene8();
  });

  setBody([row, info, fxAspect, fxWeapon, fxWeaponOther, fxAttire, fxAttireOther, fxEssence, errBox()]);
  setFooter([back, next]);
}

function renderInputs8(){
  inputsVisited[8] = true;
  openOverlay(); setTitle(VO.s8_title); setProgress(8);
  const row = el('div','ao-prompt-row'); row.append(el('div','ao-prompt',PROMPT.s8));

  const back = btn('Back', renderInputs7);
  const finish = btnAccent('Enter the Loom', async ()=>{
    try{ await persistAndFinish(); }catch(e){ return showErr('Could not save now.'); }
    closeOverlay(); hideStage();
    //try{ await initHUD(); }catch{}
    if (location.pathname.toLowerCase().includes('/onboarding/')){
      window.location.replace('../dashboard.html');
    }
    window.dispatchEvent(new CustomEvent('onboarding:done'));
  });

  setBody([row]);
  setFooter([back, finish]);
}

/* =========================================================
   NARRATION FLOWS (play once; skip if visited)
   ========================================================= */
async function playScene1(){ closeOverlay(); setBackgroundBlack();
  if (inputsVisited[1]) return renderInputs1();
  const n = playNarrationOnStage(VO.s1); await n.finished; await n.awaitTap; renderInputs1(); }
async function playScene2(){ closeOverlay();
  if (inputsVisited[2]) return renderInputs2();
  const n = playNarrationOnStage(VO.s2); await n.finished; await n.awaitTap; renderInputs2(); }
async function playScene3(){ closeOverlay();
  if (inputsVisited[3]) return renderInputs3();
  const n = playNarrationOnStage(VO.s3); await n.finished; await n.awaitTap; renderInputs3(); }
async function playScene4(){ closeOverlay();
  if (inputsVisited[4]) return renderInputs4();
  const n = playNarrationOnStage(VO.s4); await n.finished; await n.awaitTap; renderInputs4(); }
async function playScene5(){ closeOverlay();
  if (inputsVisited[5]) return renderInputs5();
  const n = playNarrationOnStage(VO.s5); await n.finished; await n.awaitTap; renderInputs5(); }
async function playScene6(){ closeOverlay();
  if (inputsVisited[6]) return renderInputs6();
  const n = playNarrationOnStage(VO.s6); await n.finished; await n.awaitTap; renderInputs6(); }
async function playScene7(){ closeOverlay();
  if (inputsVisited[7]) return renderInputs7();
  const n = playNarrationOnStage(VO.s7); await n.finished; await n.awaitTap; renderInputs7(); }
async function playScene8(){ closeOverlay();
  if (inputsVisited[8]) return renderInputs8();
  const n = playNarrationOnStage(VO.s8); await n.finished; await n.awaitTap; renderInputs8(); }


/* =========================================================
   Persistence
   ========================================================= */
async function persistAndFinish(){
  const user = auth.currentUser; if (!user) return;
  const ref = doc(db, 'players', user.uid);

  // Pool allocations by alignment
  const allocations =
    state.alignment==='enduring' ? {healthAllocation:.45,manaAllocation:.15,staminaAllocation:.30,essenceAllocation:.10} :
    state.alignment==='everyday' ? {healthAllocation:.15,manaAllocation:.20,staminaAllocation:.50,essenceAllocation:.10} :
    state.alignment==='ardent'   ? {healthAllocation:.25,manaAllocation:.45,staminaAllocation:.20,essenceAllocation:.10} :
                                   {healthAllocation:.20,manaAllocation:.30,staminaAllocation:.40,essenceAllocation:.10};

  const incomeState = (state.source==='continuous' && Number(state.incomeMonthly||0)>0) ? 'salary' : 'runway';
  const recurringIncomeMonthly = incomeState==='salary' ? Number(state.incomeMonthly||0) : null;
  const runwayAmount = incomeState==='runway' ? Number(state.runwayAmount||0) : (Number(state.runwayAmount||0) || 0);
  const vitalsMode = state.mode==='focused' ? 'focused' : (state.mode==='standard' ? 'standard' : 'relaxed');

  // Push through SAME writers the dashboard uses (keeps the pipeline consistent)
  // Convert monthly totals to the cadence the writer expects:
  // updateIncome/updateCoreExpenses expect (amount, 'monthly'|'weekly'|'daily'), but we pass monthly already normalised.
  try {
    await updateIncome(Number(state.incomeMonthly||0), 'monthly');
  } catch(e){ console.warn('[onboarding] updateIncome failed, will still write meta:', e); }
  try {
    await updateCoreExpenses(Number(state.coreMonthly||0), 'monthly');
  } catch(e){ console.warn('[onboarding] updateCoreExpenses failed, will still write meta:', e); }

  const payload = {
    alias: state.alias || null,
    avatarAllocation: state.avatar || null,
    onboarding: { architectWizardDone: true, architectWizardDoneAt: serverTimestamp() },
    incomeMeta: {
      recurringIncomeMonthly,
      runwayAmount,
      runwayReserved: 0,
      stretchMonths: state.stretchMonths || null,
      monthlyBudgetUser: incomeState==='runway'
        ? (recurringIncomeMonthly ?? (runwayAmount>0 ? (runwayAmount/(state.stretchMonths||3)) : 0))
        : null,
      budgetPreset: null,
      budgetInputs: null,
      allocations,
      incomeState,
      runwayAutoTopUp: false,
      expectedNextIncomeMs: null,
      lastPayDateMs: state.lastPayDateMs || null,

      // store onboarding editor choices (for later revisiting)
      sourceFreq: state.sourceFreq || 'monthly',
      sourceItemise: !!state.sourceItemise,
      sourceCats: state.sourceCats || {},
      foundationFreq: state.foundationFreq || 'monthly',
      foundationItemise: !!state.foundationItemise,
      foundationCats: state.foundationCats || {}
    },
    vitalsMode,
    // NEW — store the formation blueprint
    avatarFormation: {
      aspect: state.avatarFormation?.aspect || 'solar',
      weapon: state.avatarFormation?.weapon || '',
      weaponOther: state.avatarFormation?.weaponOther || '',
      attire: state.avatarFormation?.attire || '',
      attireOther: state.avatarFormation?.attireOther || '',
      essenceText: state.avatarFormation?.essenceText || ''
    },
  };
  await setDoc(ref, payload, { merge: true });

  // Seed/merge auxiliary docs similar to your earlier flow
  await setDoc(doc(db, `players/${user.uid}/cashflowData/poolAllocations`), {
    essenceAllocation: Number((allocations.essenceAllocation ?? 0.1).toFixed(3)),
    healthAllocation:  Number((allocations.healthAllocation  ?? 0.2).toFixed(3)),
    manaAllocation:    Number((allocations.manaAllocation    ?? 0.3).toFixed(3)),
    staminaAllocation: Number((allocations.staminaAllocation ?? 0.4).toFixed(3)),
  }, { merge: true });

  await setDoc(doc(db, `players/${user.uid}/classifiedTransactions/summary`), {
    recentUsage:  { essence: 0, health: 0, mana: 0, stamina: 0 },
    historicUsage:{ essence: 0, health: 0, mana: 0, stamina: 0 },
  }, { merge: true });
}

/* =========================================================
   Boot / API
   ========================================================= */
async function shouldStart(){
  const user = auth.currentUser;
  if (!user) return false;
  try{
    const snap = await getDoc(doc(db,'players',user.uid));
    return !(snap.exists() && snap.data()?.onboarding?.architectWizardDone === true);
  }catch{ return true; }
}

export async function start({ background='black', imageUrl=null, boxed=false, showAdvanceChip=true, speed} = {}){
  // Attach CSS for this module
  if (!document.getElementById('ao-style')) {
    const link = document.createElement('link');
    link.id = 'ao-style'; link.rel = 'stylesheet'; link.href = './architectOnboarding.css';
    document.head.appendChild(link);
  }
  ensureStage(); clearStage(); showStage();
  if (background==='image' && imageUrl) setBackgroundImage(imageUrl); else setBackgroundBlack();
  setNarrationBoxed(!!boxed);
  setAdvanceChipVisible(!!showAdvanceChip);
  if (speed) setNarrationSpeed(speed);

  ensureOverlay(); closeOverlay();
  await playScene1();
}

(async ()=>{ try{ if (await shouldStart()) start(); }catch{} })();

window.MyFiOnboarding = {
  start,
  setBackgroundBlack, setBackgroundImage,
  showStage, hideStage,
  setNarrationBoxed, setAdvanceChipVisible, setNarrationSpeed, setWordFade
};
