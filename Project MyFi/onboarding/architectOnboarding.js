// Full-screen narration (word-by-word fade) ➜ tap anywhere ➜ modal inputs.
// Back now jumps to previous INPUT scene (no narration replay).
// Narration-chip visibility & narration-box are toggleable.
// Speed is configurable via setNarrationSpeed.
// Finish: window.location.replace('../dashboard.html').

import { auth, db, fns } from '../js/core/auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initHUD } from "../js/hud/hud.js";
import { VO, PROMPT, INFO } from "./architectCopy.js";

// Optional: TrueLayer connector
let connectTrueLayerAccount = null;
try { const tl = await import('../core/truelayer.js'); connectTrueLayerAccount = tl?.connectTrueLayerAccount || null; } catch {}

/* ---------- DOM helpers ---------- */
const $ = (sel, root=document) => root.querySelector(sel);
const el = (tag, cls, html) => { const d=document.createElement(tag); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; };
const field = (label, input) => { const w=el('div','ao-field'); const l=el('label','',label); w.append(l,input); return w; };
const inputEl = (attrs={}) => { const i=el('input','ao-input'); Object.entries(attrs).forEach(([k,v])=>i.setAttribute(k,v)); return i; };
const selectEl = (opts) => { const s=el('select','ao-select'); opts.forEach(([v,t])=>{const o=el('option');o.value=v;o.textContent=t;s.appendChild(o);}); return s; };
const btn = (label, onClick) => { const b=el('button','ao-btn',label); b.addEventListener('click', onClick); return b; };
const btnAccent = (label, onClick) => { const b=btn(label,onClick); b.classList.add('ao-btn--accent'); return b; };
const tile = ({title, desc, key, selected=false}) => { const t=el('button','ao-tile'); t.type='button'; t.dataset.key=key; t.setAttribute('aria-selected', String(selected)); t.innerHTML=`<h4>${title}</h4><p>${desc||''}</p>`; return t; };

/* ---------- Stage (narration) ---------- */
// Helper: ensure fonts & a stable layout before animating
async function primeLayout(el){
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch {}
  // force a layout read
  void el.offsetHeight;
  // commit styles across two RAFs
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
function ensureStage(){
  let st = document.getElementById('ao-stage');
  if (!st){ st = document.createElement('div'); st.id='ao-stage'; document.body.appendChild(st); }
  return st;
}
function clearStage(){ ensureStage().innerHTML=''; }
function showStage(){ ensureStage().classList.remove('hidden'); }
function hideStage(){ ensureStage().classList.add('hidden'); }
function setBackgroundBlack(){ const st=ensureStage(); st.className=''; st.style.background='#000'; }
function setBackgroundImage(url){ const st=ensureStage(); st.className='ao-bg-image'; st.style.backgroundImage=`url("${url}")`; }

let NARRATION_BOXED = false;
let SHOW_ADVANCE_CHIP = true;
//let SPEED = { wordBase: 100, lineGap: 320, punctuationPause: 260 }; // default pacing
let SPEED = { wordBase: 150, lineGap: 430, punctuationPause: 390 };

function setNarrationBoxed(flag){ NARRATION_BOXED = !!flag; }
function setAdvanceChipVisible(flag){ SHOW_ADVANCE_CHIP = !!flag; }
function setNarrationSpeed({ wordBase, lineGap, punctuationPause }={}){
  if (typeof wordBase === 'number') SPEED.wordBase = wordBase;
  if (typeof lineGap === 'number') SPEED.lineGap = lineGap;
  if (typeof punctuationPause === 'number') SPEED.punctuationPause = punctuationPause;
}
function setWordFade(secondsOrMs){
  // accepts number of seconds (e.g., 0.35) or string "350ms"
  const v = (typeof secondsOrMs === 'number') ? `${secondsOrMs}s` : String(secondsOrMs);
  document.documentElement.style.setProperty('--ao-word-fade', v);
}


// === Word-by-word fade (WHOLE words, not typewriter) ===
async function speakLine(container, line){
  const p = document.createElement('p');
  container.appendChild(p);

  const words = line.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    // add a real space between words
    if (i > 0) p.appendChild(document.createTextNode(' '));

    const span = document.createElement('span');
    span.className = 'ao-word';
    span.textContent = words[i];
    p.appendChild(span);

    // ensure styles are committed before toggling .show
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // tiny reflow to lock in layout
    void span.offsetWidth;
    span.classList.add('show');

    // cadence
    const w = words[i];
    const len = Math.max(1, w.replace(/[^\w]/g,'').length);
    const trailing = /[.,;:!?…]$/.test(w) ? SPEED.punctuationPause : 0;  // uses your global SPEED
    const delay = SPEED.wordBase + (len > 6 ? (len - 6) * 12 : 0) + trailing;
    await new Promise(r => setTimeout(r, delay));
  }
}


// === Full-screen narration: plays lines, then await tap anywhere ===
function playNarrationOnStage(text){
  clearStage();            // your helper
  showStage();             // your helper
  const stage = ensureStage();

  const layer = el('div','ao-narration-layer');   // uses your el() helper
  if (NARRATION_BOXED) layer.classList.add('boxed');  // uses your toggle
  stage.appendChild(layer);

  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

  let finishedResolve, tapResolve;
  const finished = new Promise(res => (finishedResolve = res));
  const awaitTap = new Promise(res => (tapResolve = res));

  (async () => {
    // 1) Fonts + layout prime (so scene 1 animates without a tap)
    await primeLayout(layer);

    // optional: tiny seed to stabilize first line width, then remove next frame
    const seedP = document.createElement('p');
    const seed = document.createElement('span');
    seed.className = 'ao-word show';
    seed.style.opacity = '0';
    seed.textContent = '•';
    seedP.appendChild(seed);
    layer.appendChild(seedP);
    await new Promise(r => requestAnimationFrame(r));
    seedP.remove();

    // 2) Speak lines
    for (let i = 0; i < lines.length; i++) {
      await speakLine(layer, lines[i]);
      if (i < lines.length - 1) {
        await new Promise(r => setTimeout(r, SPEED.lineGap)); // uses your global SPEED
      }
    }

    // 3) Show “tap to continue” chip (toggleable), but allow tap ANYWHERE
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

    // tap ANYWHERE on the narration layer to continue
    layer.addEventListener('click', onAdvance);
    document.addEventListener('keydown', onKey);
  })();

  return { finished, awaitTap };
}

// Helpers
// 3–32 chars, letters/numbers/_/-
function validateAlias(str){
  const v = (str || '').trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(v)) {
    return { ok:false, msg:"Alias must be 3–32 chars: letters, numbers, _ or -." };
  }
  return { ok:true, val: v };
}

async function reserveAlias(alias){
  const setAlias = httpsCallable(fns, "setAlias");
  // Cloud Function will throw on "already-exists" or "invalid-argument"
  return await setAlias({ alias });
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
function setProgress(step,total=6){ const bar = document.querySelector('#ao-progress i'); if (bar) bar.style.width = Math.round((step-0.5)*100/total)+'%'; }
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
  source: 'stream',            // 'stream'|'vault'
  incomeMonthly: null,
  lastPayDateMs: null,
  runwayAmount: null,
  stretchMonths: 3,
  coreMonthly: null,          // ← NEW: player's core expenses (per month)
  mode: 'standard',            // 'relaxed'|'standard'|'focused'
  avatarMode: 'auto',         // 'auto'|'manual'
  avatar: null
};

// Track which input screens were visited (to skip narration thereafter)
const inputsVisited = { 1:false, 2:false, 3:false, 4:false, 5:false, 6:false };

/* =========================================================
   INPUT RENDERERS (no narration) — used for Back/skip behavior
   ========================================================= */
function renderInputs1(){
  inputsVisited[1] = true;
  openOverlay(); setTitle(VO.s1_title); setProgress(1);
  const info = infoPanel(INFO.alias);
  const row = promptRow(PROMPT.s1, 'alias', ()=> info.classList.toggle('open'));
  const name = inputEl({ placeholder:'Your spirit name', maxlength:'16', autocapitalize:'none' });
  name.value = state.alias || '';
  const fx = field('Spirit Name', name);

  const back = btn('Back', ()=> {/* first step: stay here */});
  const next = btnAccent('Continue', onNext);

  setBody([row, info, fx, errBox()]);
  setFooter([back, next]);

    async function onNext(){
    const raw = name.value;
    const check = validateAlias(raw);
    if (!check.ok) return showErr(check.msg);

    const alias = check.val;

    // Skip remote call if we’ve already reserved this exact alias
    if (state.aliasReserved && state.alias === alias) {
      return proceed(alias);
    }

    // UI: disable to prevent double-tap
    next.disabled = true; back.disabled = true;
    const oldLabel = next.textContent; next.textContent = 'Checking…';

    try {
      await reserveAlias(alias);        // 🔒 calls your CF: setAlias
      state.alias = alias;
      state.aliasReserved = true;
      proceed(alias);
    } catch (e){
      // Map common errors from your signup code
      const code = e?.code || '';
      if (code === 'already-exists') {
        showErr('That alias is taken. Try another.');
      } else if (code === 'invalid-argument') {
        showErr('Alias must be 3–32 chars: letters, numbers, _ or -.');
      } else {
        showErr(e?.message || 'Could not reserve alias right now.');
      }
      next.disabled = false; back.disabled = false;
      next.textContent = oldLabel;
      return;
    }
  }

  function proceed(alias){
    // optional: restore label before moving on
    // next.textContent = 'Continue';
    playScene2(); // or renderInputs2() if you want to skip narration here
  }
}

function renderInputs2(){
  inputsVisited[2] = true;
  openOverlay(); setTitle(VO.s2_title); setProgress(2);
  const info = infoPanel(INFO.alignment);
  const row = promptRow(PROMPT.s2, 'alignment', ()=> info.classList.toggle('open'));
  const tiles = tileGroup([
    ['balanced','Balanced (even pools)'],
    ['enduring','Enduring (Health+)'],
    ['everyday','Everyday (Stamina+)'],
    ['ardent','Ardent (Mana+)']
  ], (key)=> state.alignment = key, state.alignment);

  const back = btn('Back', renderInputs1);
  const next = btnAccent('Continue', playScene3);
  setBody([row, info, tiles, errBox()]);
  setFooter([back, next]);
}

function renderInputs3(){
  inputsVisited[3] = true;
  openOverlay(); setTitle(VO.s3_title); setProgress(3);

  const info = infoPanel(INFO.source);
  const row = promptRow(PROMPT.s3, 'source', ()=> info.classList.toggle('open'));

  const tiles = el('div','ao-tiles');
  const tStream = tile({ title:'Stream', desc:'Steady, renewing flow', key:'stream', selected: state.source==='stream' });
  const tVault  = tile({ title:'Vault',  desc:'A finite reserve for now', key:'vault',  selected: state.source!=='stream' });
  [tStream,tVault].forEach(t=>{
    t.addEventListener('click',()=>{
      [tStream,tVault].forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      state.source = t.dataset.key;
      renderInputs3(); // re-render to show correct fields
    });
  });
  tiles.append(tStream,tVault);

  const inputsWrap = el('div');

  const back = btn('Back', renderInputs2);
  const next = btnAccent('Continue', ()=>{
    try { next._collect && next._collect(); }
    catch(e){ return showErr(e.message || 'Please complete the fields.'); }
    playScene4();
  });

  setBody([row, info, tiles, inputsWrap, errBox()]);
  setFooter([back, next]);

  inputsWrap.innerHTML=''; next._collect = null;

  if (state.source==='stream'){
    const tiles2 = el('div','ao-tiles');
    const link = tile({ title:'Link a Realm', desc:'Connect to detect your stream', key:'link' });
    const manual = tile({ title:'Enter Manually', desc:'Type your monthly flow', key:'manual' });
    tiles2.append(link, manual);

    link.addEventListener('click', async ()=>{
      if (!connectTrueLayerAccount) return showErr('Linking not available here. Enter manually for now.');
      try{ await connectTrueLayerAccount(); }catch{ return showErr('Could not link. You can enter manually.'); }
    });

    manual.addEventListener('click', ()=>{
      const income = inputEl({ type:'number', step:'0.01', min:'0', placeholder:'e.g. 3200.00' });
      const dt     = inputEl({ type:'date' });
      const core   = inputEl({ type:'number', step:'0.01', min:'0', placeholder:'e.g. 1800.00' });

      const fx1 = field('Monthly Stream (£)', income);
      const fx2 = field('Last inflow date', dt);
      const fx3 = field('Core Expenses / month (£)', core);   // ← NEW

      inputsWrap.append(fx1, fx2, fx3);
      manual.disabled = true; link.disabled = true;

      next._collect = ()=> {
        const inc = Number(income.value||0);
        const cor = Number(core.value||0);

        if (!Number.isFinite(inc) || inc<=0)  throw new Error('Enter a positive monthly amount.');
        if (!Number.isFinite(cor) || cor<0)   throw new Error('Enter your monthly core expenses (0 or more).');

        state.incomeMonthly = inc;
        state.coreMonthly   = cor;
        state.lastPayDateMs = dt.valueAsDate ? dt.valueAsDate.getTime() : null;
      };
    });


    inputsWrap.append(tiles2);
  } else {
    const amt = inputEl({ type:'number', step:'0.01', min:'0', placeholder:'e.g. 4500.00' });
    const months = selectEl([['3','3 months'],['4','4 months'],['6','6 months']]);
    months.value = String(state.stretchMonths||3);
    const fx1 = field('Vault amount (£)', amt);
    const fx2 = field('How long should it last?', months);
    inputsWrap.append(fx1, fx2);
    next._collect = ()=> {
      const v = Number(amt.value||0);
      if (!Number.isFinite(v) || v<=0) throw new Error('Enter a positive vault amount.');
      state.runwayAmount = v;
      state.stretchMonths = Number(months.value||3);
      state.incomeMonthly = Math.max(0, v / state.stretchMonths);
    };
  }
}

function renderInputs4(){
  inputsVisited[4] = true;
  openOverlay(); setTitle(VO.s4_title); setProgress(4);

  const info = infoPanel(INFO.flame);
  const row = promptRow(PROMPT.s4, 'flame', ()=> info.classList.toggle('open'));

  const tiles = tileGroup([
    ['relaxed','Relaxed — gentle guidance'],
    ['standard','Standard — balanced guidance'],
    ['focused','Focused — sharper guidance']
  ], (key)=> state.mode = key, state.mode);

  const back = btn('Back', renderInputs3);
  const next = btnAccent('Continue', playScene5);
  setBody([row, info, tiles, errBox()]);
  setFooter([back, next]);
}

function renderInputs5(){
  inputsVisited[5] = true;
  openOverlay(); setTitle(VO.s5_title); setProgress(5);

  const info = infoPanel(INFO.essence);
  const row = promptRow(PROMPT.s5, 'essence', ()=> info.classList.toggle('open'));

  const tiles = el('div','ao-tiles');
  const auto = tile({ title:'Guide me (quick questions)', desc:'Auto-assign a fitting vessel', key:'auto', selected: state.avatarMode==='auto' });
  const manual = tile({ title:'I’ll choose myself', desc:'Pick a starter avatar now', key:'manual', selected: state.avatarMode==='manual' });
  [auto, manual].forEach(t=>{
    t.addEventListener('click', ()=>{
      [auto,manual].forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      state.avatarMode = t.dataset.key;
      renderInputs5();
    });
  });

  const pickerWrap = el('div');

  const back = btn('Back', renderInputs4);
  const next = btnAccent('Continue', ()=>{
    try { next._collect && next._collect(); }
    catch(e){ return showErr(e.message); }
    playScene6();
  });

  setBody([row, info, tiles, pickerWrap, errBox()]);
  setFooter([back, next]);

  pickerWrap.innerHTML='';
  if (state.avatarMode==='auto'){
    const q1 = selectEl([['enduring','Steady'],['ardent','Willful'],['everyday','Swift']]);
    const q2 = selectEl([['defensive','Defensive'],['balanced','Balanced'],['aggressive','Aggressive']]);
    const q3 = selectEl([['solo','Solo'],['team','Team-oriented']]);
    pickerWrap.append(field('Your pace', q1), field('Your style', q2), field('Your flow', q3));
    next._collect = ()=> {
      const map = { enduring:'Emkay', ardent:'Alie', everyday:'Richard' };
      state.avatar = map[q1.value] || 'Jane';
    };
  } else {
    const roster = el('div','ao-tiles');
    const starters = [
      ['Emkay','Steadfast tactician'],
      ['Alie','Sable sorceress'],
      ['Richard','Storm-bound duelist'],
      ['Jane','Radiant ranger']
    ];
    starters.forEach(([name, desc])=>{
      const t = tile({ title:name, desc, key:name.toLowerCase(), selected: state.avatar?.toLowerCase()===name.toLowerCase() });
      t.addEventListener('click', ()=>{
        roster.querySelectorAll('.ao-tile').forEach(x=>x.setAttribute('aria-selected','false'));
        t.setAttribute('aria-selected','true');
        state.avatar = name;
      });
      roster.append(t);
    });
    pickerWrap.append(roster);
    next._collect = ()=> {
      if (!state.avatar) throw new Error('Please choose a vessel, or use guided assignment.');
    };
  }
}

function renderInputs6(){
  inputsVisited[6] = true;
  openOverlay(); setTitle(VO.s6_title); setProgress(6);
  const row = el('div','ao-prompt-row'); row.append(el('div','ao-prompt',PROMPT.s6));

  const back = btn('Back', renderInputs5);
  const finish = btnAccent('Enter the Loom', async ()=>{
    try{ await persistAndFinish(); }catch(e){ return showErr('Could not save now.'); }
    closeOverlay(); hideStage();
    try{ await initHUD(); }catch{}
    if (location.pathname.toLowerCase().includes('/onboarding/')){
      window.location.replace('../dashboard.html');
    }
    window.dispatchEvent(new CustomEvent('onboarding:done'));
  });

  setBody([row]);
  setFooter([back, finish]);
}

/* =========================================================
   NARRATION FLOWS (play narration once; skip if visited)
   ========================================================= */
async function playScene1(){
  closeOverlay(); setBackgroundBlack();
  if (inputsVisited[1]) return renderInputs1();
  const n = playNarrationOnStage(VO.s1);
  await n.finished; await n.awaitTap;
  renderInputs1();
}
async function playScene2(){
  closeOverlay();
  if (inputsVisited[2]) return renderInputs2();
  const n = playNarrationOnStage(VO.s2);
  await n.finished; await n.awaitTap;
  renderInputs2();
}
async function playScene3(){
  closeOverlay();
  if (inputsVisited[3]) return renderInputs3();
  const n = playNarrationOnStage(VO.s3);
  await n.finished; await n.awaitTap;
  renderInputs3();
}
async function playScene4(){
  closeOverlay();
  if (inputsVisited[4]) return renderInputs4();
  const n = playNarrationOnStage(VO.s4);
  await n.finished; await n.awaitTap;
  renderInputs4();
}
async function playScene5(){
  closeOverlay();
  if (inputsVisited[5]) return renderInputs5();
  const n = playNarrationOnStage(VO.s5);
  await n.finished; await n.awaitTap;
  renderInputs5();
}
async function playScene6(){
  closeOverlay();
  if (inputsVisited[6]) return renderInputs6();
  const n = playNarrationOnStage(VO.s6);
  await n.finished; await n.awaitTap;
  renderInputs6();
}

/* =========================================================
   Persistence
   ========================================================= */
async function persistAndFinish(){
  const user = auth.currentUser; if (!user) return;
  const ref = doc(db, 'players', user.uid);

  const allocations =
    state.alignment==='enduring' ? {healthAllocation:.45,manaAllocation:.15,staminaAllocation:.30,essenceAllocation:.10} :
    state.alignment==='everyday' ? {healthAllocation:.15,manaAllocation:.20,staminaAllocation:.50,essenceAllocation:.10} :
    state.alignment==='ardent'   ? {healthAllocation:.25,manaAllocation:.45,staminaAllocation:.20,essenceAllocation:.10} :
                                   {healthAllocation:.20,manaAllocation:.30,staminaAllocation:.40,essenceAllocation:.10};

  const incomeState = (state.source==='stream' && Number(state.incomeMonthly||0)>0) ? 'salary' : 'runway';
  const recurringIncomeMonthly = incomeState==='salary' ? Number(state.incomeMonthly||0) : null;
  const runwayAmount = incomeState==='runway' ? Number(state.runwayAmount||0) : (Number(state.runwayAmount||0) || 0);
  const vitalsMode = state.mode==='focused' ? 'focused' : (state.mode==='standard' ? 'standard' : 'relaxed');

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
      lastPayDateMs: state.lastPayDateMs || null
    },
    vitalsMode
  };
  await setDoc(ref, payload, { merge: true });

  // ---- Seed/Update auxiliary docs moved from auth.js ----

  // 3a) cashflowData/dailyAverages  (store daily values)
  const daysPerMonth = 30.44; // average month
  const dIncome = Number(state.incomeMonthly || 0) > 0
    ? Number((state.incomeMonthly / daysPerMonth).toFixed(2))
    : 0;
  const dCoreExpenses = Number(state.coreMonthly || 0) > 0
    ? Number((state.coreMonthly / daysPerMonth).toFixed(2))
    : 0;

  await setDoc(doc(db, `players/${user.uid}/cashflowData/dailyAverages`), {
    dCoreExpenses,
    dIncome
  }, { merge: true });

  // 3b) cashflowData/poolAllocations  (percent splits used by vitals)
  await setDoc(doc(db, `players/${user.uid}/cashflowData/poolAllocations`), {
    essenceAllocation: Number((allocations.essenceAllocation ?? 0.1).toFixed(3)),
    healthAllocation:  Number((allocations.healthAllocation  ?? 0.2).toFixed(3)),
    manaAllocation:    Number((allocations.manaAllocation    ?? 0.3).toFixed(3)),
    staminaAllocation: Number((allocations.staminaAllocation ?? 0.4).toFixed(3)),
  }, { merge: true });

  // 3c) classifiedTransactions/summary (zeros)
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

  // Ensure modal exists but stays closed until narration tap
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
