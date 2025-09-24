// Architect Onboarding
// Full-screen narration (word-by-word fade) ➜ tap anywhere ➜ modal inputs.
// Back jumps to previous INPUT scene (no narration replay).
// Matches dashboard itemisation UX (global cadence + category itemise).
// Includes TrueLayer Smart Review (amounts locked).
// Finish: window.location.replace('../dashboard.html').

import { auth, db, fns } from '../js/core/auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { VO, PROMPT, INFO } from "./architectCopy.js";

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
  affinity: 'air', // 'air'|'earth'|'water'|'fire'|'chaos'

  mode: 'standard',           // 'relaxed'|'standard'|'focused'

  // Avatar formation details
  avatarFormation: {
    aspect: '',        // 'solar' | 'lunar' | 'horizon' (balanced)
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

  const info = infoPanel(INFO.flame);
  const row = promptRow(PROMPT.s4, 'flame', ()=> info.classList.toggle('open'));

  const tiles = tileGroup([
    ['focused','Gentle'],
    ['standard','Standard'],
    ['relaxed','Intense']
  ], (key)=> state.mode = key, state.mode);

  const back = btn('Back', renderInputs3);
  const next = btnAccent('Continue', playScene5);
  setBody([row, info, tiles, errBox()]);
  setFooter([back, next]);
}

function renderInputs5(){
  inputsVisited[5] = true;
  openOverlay(); setTitle(VO.s5_title); setProgress(5);

  const info = infoPanel(INFO.essence || 'Describe the shape your vessel should take. This guides how we’ll form your starting avatar later.');
  const row  = promptRow(PROMPT.s5 || 'Describe your essence and form.', 'essence', ()=> info.classList.toggle('open'));

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
  const back = btn('Back', renderInputs4);
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

    playScene6();
  });

  setBody([row, info, fxAspect, fxWeapon, fxWeaponOther, fxAttire, fxAttireOther, fxEssence, errBox()]);
  setFooter([back, next]);
}

function renderInputs6(){
  inputsVisited[6] = true;
  openOverlay(); setTitle(VO.s6_title); setProgress(6);
  const row = el('div','ao-prompt-row'); row.append(el('div','ao-prompt',PROMPT.s6));

  const back = btn('Back', renderInputs5);
  const finish = btnAccent('Enter the Crucible', async ()=>{
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

  const payload = {
    onboarding: { architectWizardDone: true, architectWizardDoneAt: serverTimestamp() },
    alias: state.alias || null,
    alignment: state.alignment || 'balanced',
    affinity: state.affinity || 'air',
    vitalsMode: state.mode || 'standard',
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
