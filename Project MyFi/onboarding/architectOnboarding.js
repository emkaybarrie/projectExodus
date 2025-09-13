
// onboarding/architectOnboarding.js
// Standalone wizard overlay for post-signup → HUD onboarding.
// Drop-in: import this module from dashboard (or include via <script type="module">) and call MyFiOnboarding.start().
// It also auto-starts if it detects onboarding not done for the current user.

import { auth, db } from './core/auth.js';
import {
  getDoc, doc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { initHUD } from "./hud/hud.js"; // just in case we want to refresh after finish
import { VO, UI } from "./onboarding/architectCopy.js";

// Optional TrueLayer helper if present
let connectTrueLayerAccount = null;
try {
  const tl = await import('./core/truelayer.js');
  connectTrueLayerAccount = tl?.connectTrueLayerAccount || null;
} catch {}

const WIZARD_FLAG = 'onboarding.architectWizardDone';

// ---- DOM helpers ----
function el(tag, cls, html){ const d=document.createElement(tag); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; }
function field(label, input){ const w=el('div','ao-field'); const l=el('label','',label); w.append(l,input); return w; }
function input(attrs={}){ const i=el('input','ao-input'); Object.entries(attrs).forEach(([k,v])=>i.setAttribute(k,v)); return i; }
function select(opts){ const s=el('select','ao-select'); opts.forEach(([v,t])=>{const o=el('option');o.value=v;o.textContent=t;s.appendChild(o);}); return s; }
function tile({title, desc, key, selected=false}){
  const t=el('button','ao-tile'); t.type='button'; t.setAttribute('data-key', key); t.setAttribute('aria-selected', String(selected));
  t.innerHTML = `<h4>${title}</h4><p>${desc}</p>`;
  return t;
}

function ensureOverlay(){
  let ov = document.getElementById('ao-overlay');
  if (ov) return ov;
  ov = el('div'); ov.id='ao-overlay';
  const card = el('div'); card.id='ao-card';
  const header = el('div'); header.id='ao-header';
  const glyph = el('div','ao-glyph'); header.append(glyph);
  const title = el('div'); title.id='ao-title'; header.append(title);
  const body = el('div'); body.id='ao-body';
  const footer = el('div'); footer.id='ao-footer';

  const progress = el('div'); progress.id='ao-progress'; const bar = el('i'); progress.append(bar);
  body.append(progress);

  card.append(header, body, footer); ov.append(card); document.body.appendChild(ov);
  return ov;
}

// ---- State ----
const state = {
  step: 1,
  alias: '',
  incomeMode: 'hoard', // 'wellspring'|'hoard'
  incomeMonthly: null, // number
  lastPayDateMs: null,
  runwayAmount: null,
  stretchMonths: 3,
  allocations: { health:.35, mana:.25, stamina:.30, essence:.10 },
  seed: 'safe', // 'safe'|'accel'|'manual'|'true'
  avatar: null
};

function setProgress(step,total=7){
  const bar = document.querySelector('#ao-progress > i'); if (bar) bar.style.width = Math.round((step-0.5)*100/total)+'%';
}

function open(){ ensureOverlay().setAttribute('data-open','true'); }
function close(){ const ov=ensureOverlay(); ov.removeAttribute('data-open'); setTimeout(()=>ov.remove(),180); }

function setTitle(s){ const t=document.getElementById('ao-title'); if (t) t.textContent = s; }
function setBody(nodes){ const b=document.getElementById('ao-body'); if (!b) return; b.querySelectorAll('.ao-screen').forEach(x=>x.remove()); const wrap=el('div','ao-screen'); nodes.forEach(n=>wrap.append(n)); b.append(wrap); }
function setFooter(btns){ const f=document.getElementById('ao-footer'); if (!f) return; f.innerHTML=''; btns.forEach(b=>f.append(b)); }

function narration(text){ const p=el('p','ao-narration'); p.textContent = text.replace(/\s+/g,' ').trim(); return p; }
function helper(html){ return el('div','ao-helper', html); }
function errBox(){ const d=el('div','ao-error'); d.id='ao-error'; return d; }
function showErr(msg){ const d=document.getElementById('ao-error'); if(d){ d.textContent=msg; d.style.display='block'; setTimeout(()=>d.style.display='none', 2800);} }

// ---- Steps ----
function scene1(){
  state.step=1; setProgress(1);
  setTitle(VO.s1_title);
  const intro = narration(VO.s1);
  const alias = input({ placeholder:'Your spirit name', maxlength:'16', autocapitalize:'none' });
  alias.value = state.alias || '';
  const fx = field('Spirit Name', alias);
  const next = el('button','ao-btn ao-btn--accent', UI.next);
  next.addEventListener('click', ()=>{
    const v = alias.value.trim();
    if (!v) return showErr('Please choose a name for your spirit.');
    state.alias = v;
    scene2();
  });
  const skip = el('button','ao-btn ao-btn--ghost', UI.skip);
  skip.addEventListener('click', ()=> scene2());
  setBody([intro, fx, errBox()]);
  setFooter([skip, next]);
}

function scene2(){
  state.step=2; setProgress(2);
  setTitle(VO.s2_title);
  const txt = narration(VO.s2);
  const tiles = el('div','ao-tiles');
  const t1 = tile({ title:UI.tiles.wellspring.title, desc:UI.tiles.wellspring.desc, key:'wellspring', selected: state.incomeMode==='wellspring' });
  const t2 = tile({ title:UI.tiles.hoard.title, desc:UI.tiles.hoard.desc, key:'hoard', selected: state.incomeMode!=='wellspring' });
  [t1,t2].forEach(t=>{
    t.addEventListener('click', ()=>{
      [t1,t2].forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      state.incomeMode = t.getAttribute('data-key');
    });
  });
  tiles.append(t1,t2);

  const back = el('button','ao-btn', UI.back);
  back.addEventListener('click', scene1);
  const next = el('button','ao-btn ao-btn--accent', UI.next);
  next.addEventListener('click', ()=> state.incomeMode==='wellspring' ? scene3a() : scene3b());

  setBody([txt, tiles]);
  setFooter([back, next]);
}

function scene3a(){
  state.step=3; setProgress(3);
  setTitle(VO.s3a_title);
  const txt = narration(VO.s3a);
  const tiles = el('div','ao-tiles');
  const linkBtn = tile({ title: UI.link_realm, desc: 'Connect to read your streams automatically.', key:'link' });
  const manualBtn = tile({ title: UI.manual, desc: 'Type your usual monthly amount.', key:'manual' });

  tiles.append(linkBtn, manualBtn);

  linkBtn.addEventListener('click', async ()=>{
    if (!connectTrueLayerAccount) return showErr('Linking not available here. Enter manually for now.');
    try{
      await connectTrueLayerAccount();
      // After linking, you likely have a background job to detect RI.
      // For now just proceed to allocations.
      state.seed = 'true';
      scene4();
    }catch{ showErr('Could not link. You can enter manually.'); }
  });

  manualBtn.addEventListener('click', ()=>{
    const amt = input({ type:'number', step:'0.01', min:'0', placeholder:'e.g. 3200.00' });
    const last = input({ type:'date' });
    const fx1 = field('Monthly boon (£)', amt);
    const fx2 = field('Last boon date', last);
    const wrap = el('div'); wrap.append(fx1, fx2);
    const b = document.getElementById('ao-body'); b.querySelector('.ao-screen').append(wrap);
    manualBtn.disabled = true; linkBtn.disabled = true;
    const next = el('button','ao-btn ao-btn--accent', UI.next);
    next.addEventListener('click', ()=>{
      const v = Number(amt.value||0);
      if (!Number.isFinite(v) || v<=0) return showErr('Enter a positive monthly amount.');
      state.incomeMonthly = v;
      state.lastPayDateMs = last.valueAsDate ? last.valueAsDate.getTime() : null;
      scene4();
    });
    const footer = document.getElementById('ao-footer');
    footer.append(next);
  });

  const back = el('button','ao-btn', UI.back);
  back.addEventListener('click', scene2);
  setBody([txt, tiles, errBox()]);
  setFooter([back]);
}

function scene3b(){
  state.step=3; setProgress(3);
  setTitle(VO.s3b_title);
  const txt = narration(VO.s3b);
  const amt = input({ type:'number', step:'0.01', min:'0', placeholder:'e.g. 4500.00' });
  const months = select([['3','3 months'],['4','4 months'],['6','6 months']]);
  months.value = String(state.stretchMonths||3);
  const fx1 = field('Hoard amount (£)', amt);
  const fx2 = field('Stretch target', months);
  const tip = helper('We use this to set a monthly plan while your wellspring is quiet.');

  const back = el('button','ao-btn', UI.back);
  back.addEventListener('click', scene2);
  const next = el('button','ao-btn ao-btn--accent', UI.next);
  next.addEventListener('click', ()=>{
    const v = Number(amt.value||0);
    if (!Number.isFinite(v) || v<=0) return showErr('Enter a positive hoard amount.');
    state.runwayAmount = v;
    state.stretchMonths = Number(months.value||3);
    state.incomeMonthly = Math.max(0, v / state.stretchMonths);
    scene4();
  });

  setBody([txt, fx1, fx2, tip, errBox()]);
  setFooter([back, next]);
}

function scene4(){
  state.step=4; setProgress(4);
  setTitle(VO.s4_title);
  const txt = narration(VO.s4);

  const tiles = el('div','ao-tiles');
  const presets = [
    ['balanced','Balanced',{h:.35,m:.25,s:.30,e:.10}],
    ['saver','Enduring (Health+)',{h:.45,m:.20,s:.25,e:.10}],
    ['everyday','Everyday (Stamina+)',{h:.30,m:.20,s:.40,e:.10}],
    ['ardent','Ardent (Mana+)',{h:.30,m:.40,s:.20,e:.10}],
  ];
  presets.forEach(([key,label,vals])=>{
    const t = tile({ title: label, desc:'', key });
    t.addEventListener('click', ()=>{
      tiles.querySelectorAll('.ao-tile').forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      state.allocations = { health:vals.h, mana:vals.m, stamina:vals.s, essence:vals.e };
    });
    tiles.append(t);
  });

  const back = el('button','ao-btn', UI.back);
  back.addEventListener('click', ()=> state.incomeMode==='wellspring' ? scene3a() : scene3b());
  const next = el('button','ao-btn ao-btn--accent', UI.next);
  next.addEventListener('click', scene5);

  setBody([txt, tiles]);
  setFooter([back, next]);
}

function scene5(){
  state.step=5; setProgress(5);
  setTitle(VO.s5_title);
  const txt = narration(VO.s5);

  const tiles = el('div','ao-tiles');
  const opts = [
    ['safe','Safe — a gentle spark'],
    ['accel','Accelerated — brighter start'],
    ['manual','Manual — I will tune it'],
    ['true','True — bound to streams'],
  ];
  opts.forEach(([k, label])=>{
    const t = tile({ title: label, desc:'', key:k, selected: state.seed===k });
    t.addEventListener('click', ()=>{
      tiles.querySelectorAll('.ao-tile').forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      state.seed = k;
    });
    tiles.append(t);
  });

  const back = el('button','ao-btn', UI.back);
  back.addEventListener('click', scene4);
  const next = el('button','ao-btn ao-btn--accent', UI.next);
  next.addEventListener('click', scene6);

  setBody([txt, tiles]);
  setFooter([back, next]);
}

function scene6(){
  state.step=6; setProgress(6);
  setTitle(VO.s6_title);
  const txt = narration(VO.s6);

  // Minimal roster placeholder (user can wire their real list later)
  const tiles = el('div','ao-tiles');
  const starters = [
    ['Emkay','Steadfast tactician'],
    ['Alie','Sable sorceress'],
    ['Richard','Storm-bound duelist'],
    ['Jane','Radiant ranger']
  ];
  starters.forEach(([name, desc])=>{
    const t = tile({ title: name, desc, key:name.toLowerCase() });
    t.addEventListener('click', ()=>{
      tiles.querySelectorAll('.ao-tile').forEach(x=>x.setAttribute('aria-selected','false'));
      t.setAttribute('aria-selected','true');
      state.avatar = name;
    });
    tiles.append(t);
  });

  const back = el('button','ao-btn', UI.back);
  back.addEventListener('click', scene5);
  const next = el('button','ao-btn ao-btn--accent', UI.next);
  next.addEventListener('click', scene7);

  setBody([txt, tiles]);
  setFooter([back, next]);
}

async function persistAndFinish(){
  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;
  const ref = doc(db, 'players', uid);

  const incomeState = (state.incomeMode==='wellspring' && (Number(state.incomeMonthly||0) > 0))
    ? 'salary' : 'runway';

  const recurringIncomeMonthly = incomeState==='salary' ? Number(state.incomeMonthly||0) : null;
  const runwayAmount = incomeState==='runway' ? Number(state.runwayAmount||0) : Number(state.runwayAmount||0) || 0;

  const payload = {
    alias: state.alias || null,
    avatar: state.avatar || null,
    onboarding: { architectWizardDone: true, architectWizardDoneAt: serverTimestamp() },
    incomeMeta: {
      recurringIncomeMonthly,
      runwayAmount,
      runwayReserved: 0,
      stretchMonths: state.stretchMonths || null,
      monthlyBudgetUser: incomeState==='runway' ? (recurringIncomeMonthly ?? (runwayAmount>0 ? (runwayAmount/(state.stretchMonths||3)) : 0)) : null,
      budgetPreset: null,
      budgetInputs: null,
      allocations: state.allocations,
      incomeState,
      runwayAutoTopUp: false,
      expectedNextIncomeMs: null,
      lastPayDateMs: state.lastPayDateMs || null
    },
    vitalsMode: (state.seed==='true') ? 'true' : (state.seed==='accel' ? 'focused' : (state.seed==='safe' ? 'relaxed' : 'standard'))
  };

  await setDoc(ref, payload, { merge: true });
}

function scene7(){
  state.step=7; setProgress(7);
  setTitle(VO.s7_title);
  const txt = narration(VO.s7);
  const tip = el('div','ao-tip','You can refine your plan any time in Settings.');

  const back = el('button','ao-btn', UI.back);
  back.addEventListener('click', scene6);
  const finish = el('button','ao-btn ao-btn--accent', UI.finish);
  finish.addEventListener('click', async ()=>{
    try{
      await persistAndFinish();
    }catch(e){
      console.warn('Onboarding save failed', e);
      return showErr('Could not save just yet. Check your connection.');
    }
    close();
    // let dashboard continue; optionally refresh HUD
    try { await initHUD(); } catch {}
    window.dispatchEvent(new CustomEvent('onboarding:done', { detail:{ at: Date.now() } }));
  });

  setBody([txt, tip]);
  setFooter([back, finish]);
}

// ---- Public API ----
async function shouldStart(){
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, 'players', user.uid));
    if (!snap.exists()) return true;
    const d = snap.data();
    // Start if our wizard not marked done
    return !(d?.onboarding?.architectWizardDone === true);
  } catch {
    return true;
  }
}

export async function start(){
  open();
  // inject CSS once
  if (!document.getElementById('ao-style')) {
    const link = document.createElement('link');
    link.id = 'ao-style';
    link.rel = 'stylesheet';
    link.href = './onboarding/architectOnboarding.css';
    document.head.appendChild(link);
  }
  scene1();
}

// Auto-start hook when module is imported
(async () => {
  try{
    const startOnLoad = await shouldStart();
    if (startOnLoad) start();
  }catch{}
})();

// Expose global for manual start or re-entry
window.MyFiOnboarding = { start };
