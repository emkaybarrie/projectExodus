// energy-vitals-hud.js — drop-in replacement for vitals.js (reads new Firestore layout)
// Public API kept identical where used by dashboard.

// ───────────────────────────────── Imports ─────────────────────────────────
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where,
  getDocs, orderBy, limit, onSnapshot, updateDoc, deleteDoc, startAfter
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { openEnergyMenu } from "./energy-menu.js";
import { recomputeVitalsGatewayStub } from "./energy-vitals.js";

// ───────────────────────────────── Constants ─────────────────────────────────
const MS_PER_DAY = 86_400_000;
const CORE_DAYS  = 30.44;       // “Core” window
const VIEW_MODES = ["daily","weekly"];
const VIEW_FACTORS = { daily:1, weekly:7 };

// ───────────────────────────────── Local state (legacy-compatible) ──────────
const db = getFirestore();
const DEFAULT_TITLE = "VITALS";
const MAX_ALIAS_LEN = 16;
const COLLAPSE_LEN_HINT = 14;

let unsubPlayer = null;
let unsubPlayerLevel = null;

// ───────────────────────────────── Mode helpers (same keys as legacy) ───────
function displayLabelFor(mode){
  const map = { daily:"Today", weekly:"This Week", core:"Current" };
  return map[String(mode).toLowerCase()] || mode;
}
function getPrimaryMode(){
  return localStorage.getItem("vitals:primary") || "core";
}
function setPrimaryMode(next){
  const v = (next === "core" || next === "focus") ? next : "core";
  localStorage.setItem("vitals:primary", v);
  repaintEngravingLabels();
  window.dispatchEvent(new CustomEvent("vitals:primary",{ detail:{ primary:v }}));
}
export function getViewMode(){
  const primary = getPrimaryMode();
  if (primary === "core") return "core";
  const raw = localStorage.getItem("vitals:viewMode") || "daily";
  return (raw === "monthly") ? "weekly" : raw;
}
export function setViewMode(mode){
  const next = VIEW_MODES.includes(mode) ? mode : "daily";
  localStorage.setItem("vitals:viewMode", next);
  setPrimaryMode("focus");
  repaintEngravingLabels();
  window.dispatchEvent(new CustomEvent("vitals:viewmode",{ detail:{ mode: next }}));
  refreshBarGrids();
  updateModeEngrave(next);
}
export function cycleViewMode(){
  const cur = getViewMode();
  setViewMode(cur === "daily" ? "weekly" : "daily");
}

// ───────────────────────────────── Alias / Level (unchanged wiring) ─────────
const titleEl   = document.getElementById("header-title");
const actionsEl = document.getElementById("headerActions");
const moreBtn   = document.getElementById("btnMore");
const moreMenu  = document.getElementById("moreMenu");

function collapseActionsIfNeeded(){
  if (!titleEl || !actionsEl) return;
  actionsEl.classList.remove('is-collapsed');
  const overflows = titleEl.scrollWidth > titleEl.clientWidth;
  const tiny      = window.innerWidth < 420;
  const nameLen   = (titleEl.textContent||"").length;
  const should    = overflows || (tiny && nameLen >= COLLAPSE_LEN_HINT);
  actionsEl.classList.toggle('is-collapsed', should);
  if (moreBtn) moreBtn.style.display = should ? 'inline-flex' : 'none';
}
function wireMoreMenu(){
  if (!moreBtn || !moreMenu || moreBtn.__wired) return;
  moreBtn.__wired = true;
  moreBtn.addEventListener('click', ()=>{
    const isOpen = moreMenu.hidden === false;
    moreMenu.hidden = isOpen; moreBtn.setAttribute('aria-expanded', String(!isOpen));
  });
  moreMenu.addEventListener('click',(e)=>{
    const btn = e.target.closest('button[data-proxy]');
    if (!btn) return; const sel = btn.getAttribute('data-proxy'); const target = document.querySelector(sel);
    if (target) target.click(); moreMenu.hidden = true; moreBtn.setAttribute('aria-expanded','false');
  });
  document.addEventListener('click', (e)=>{
    if (!moreMenu.hidden && !moreMenu.contains(e.target) && e.target !== moreBtn){
      moreMenu.hidden = true; moreBtn.setAttribute('aria-expanded','false');
    }
  });
}
export async function startAliasListener(uid){
  if (unsubPlayer) { unsubPlayer(); unsubPlayer = null; }
  wireMoreMenu();
  unsubPlayer = onSnapshot(doc(db,"players",uid),(snap)=>{
    const raw = (snap.exists() && typeof snap.data().alias === "string") ? snap.data().alias.trim() : "";
    const capped = raw.length > MAX_ALIAS_LEN ? raw.slice(0,MAX_ALIAS_LEN) : raw;
    if (titleEl){ titleEl.textContent = capped || DEFAULT_TITLE; titleEl.title = raw || DEFAULT_TITLE; }
    requestAnimationFrame(collapseActionsIfNeeded);
  },()=>{ if (titleEl){ titleEl.textContent = DEFAULT_TITLE; } requestAnimationFrame(collapseActionsIfNeeded); });
  window.addEventListener('resize', ()=>requestAnimationFrame(collapseActionsIfNeeded));
}
const levelEl = document.getElementById("player-level");
export async function startLevelListener(uid){
  if (unsubPlayerLevel) { unsubPlayerLevel(); unsubPlayerLevel = null; }
  unsubPlayerLevel = onSnapshot(doc(db,"players",uid),(snap)=>{
    let lvl; if (snap.exists()) lvl = Number(snap.data().level ?? snap.data().playerLevel ?? snap.data().stats?.level);
    if (Number.isFinite(lvl)){ if(levelEl){ levelEl.textContent=String(lvl); levelEl.hidden=false;} }
    else { if(levelEl) levelEl.hidden = true; }
  },()=>{ if(levelEl) levelEl.hidden = true; });
}

// ───────────────────────────────── DOM helpers (same selectors as legacy) ───
function getVitalsElements(){
  const pools = ["health","mana","stamina","essence"]; const map = {};
  for (const p of pools){
    const root = document.querySelector(`#vital-${p}`);
    const fill = root?.querySelector('.bar-fill');
    const val  = root?.querySelector('.bar-value');
    const label= root?.querySelector('.bar-label');
    const pill = root?.querySelector('.bar-surplus');
    if (fill && val && label && pill) map[p] = { fill, value: val, label, pill };
  }
  return map;
}
function paintBarGrid(gridEl, days){
  const needed = Math.max(0, (days|0)-1); gridEl.innerHTML='';
  for (let i=1;i<=needed;i++){ const line=document.createElement('div'); line.className='grid-line'; line.style.left=((i/days)*100).toFixed(4)+'%'; gridEl.appendChild(line); }
}
function refreshBarGrids(){
  const vm = getViewMode(); const days = (vm==='core')? CORE_DAYS : VIEW_FACTORS[vm];
  const pools = ["health","mana","stamina","essence"];
  for (const p of pools){
    const root = document.querySelector(`#vital-${p}`); const bar = root?.querySelector('.bar'); if(!bar) continue;
    let grid = bar.querySelector('.bar-grid'); if (!grid){ grid=document.createElement('div'); grid.className='bar-grid'; bar.insertBefore(grid, bar.querySelector('.bar-fill')); }
    paintBarGrid(grid, days);
  }
}
function updateModeEngrave(mode = getViewMode()){
  const coreBtn  = document.getElementById('engrave-core');
  const focusBtn = document.getElementById('engrave-focus'); if (!coreBtn||!focusBtn) return;
  const key = String(mode).toLowerCase(); const isCore = (key==='core');
  if (!isCore) focusBtn.dataset.mode = key;
  coreBtn.classList.toggle('is-active', isCore);
  focusBtn.classList.toggle('is-active', !isCore);
}
function repaintEngravingLabels(){
  const coreBtn  = document.getElementById("engrave-core");
  const focusBtn = document.getElementById("engrave-focus");
  if (coreBtn){ coreBtn.textContent="Current"; coreBtn.dataset.mode="core"; coreBtn.setAttribute("aria-label","Current"); }
  if (focusBtn){
    const vm = getViewMode();
    const shown = (vm==='core') ? (localStorage.getItem("vitals:viewMode")||"daily") : vm;
    const coerced = (shown==='monthly')?'weekly':shown;
    focusBtn.textContent  = `Focus: ${displayLabelFor(coerced)}`;
    focusBtn.dataset.mode = coerced;
    focusBtn.setAttribute("aria-label", `Focus: ${displayLabelFor(coerced)}`);
  }
}
function setSurplusPill(el, daysNow, daysAfter){
  const pill = el.pill; if (!pill) return;
  const isCore = (getPrimaryMode()==='core');
  const anyNow = isCore && (Number(daysNow||0) > 0);
  const anyAf  = isCore && (Number(daysAfter||0)> 0);
  if (!anyNow && !anyAf){ pill.style.display="none"; pill.textContent=""; pill.classList.remove("with-next","pill-up","pill-down"); return; }
  pill.style.display="inline-flex"; pill.classList.remove("pill-up","pill-down");
  const txt = (d)=>`+${Math.max(0, Math.floor(Number(d)||0))}`;
  if (anyAf && (daysAfter!==daysNow)){ if(daysAfter>daysNow) pill.classList.add("pill-up"); else pill.classList.add("pill-down"); pill.textContent = `${txt(daysNow)} → ${txt(daysAfter)}`; pill.classList.add("with-next"); }
  else { pill.textContent = txt(daysNow); pill.classList.remove("with-next"); }
}
function formatNum(n){ return (Math.round(n)||0).toLocaleString('en-GB'); }
function setVitalsTotals(currentTotal, maxTotal){
  const el = document.getElementById('vitals-total'); if (!el) return;
  el.innerHTML = `
    <span class="label">Total</span>
    <span class="vital-value">${formatNum(currentTotal)}</span>
    <span class="sep">/</span>
    <span class="vital-max">${formatNum(maxTotal)}</span>
  `;
}
function rateTextForMode(perDay, mode=getViewMode()){
  const d=Number(perDay||0);
  switch(String(mode).toLowerCase()){
    case 'daily':  return `+${(d/24).toFixed(2)}/hr`;
    case 'weekly': return `+${(d).toFixed(2)}/day`;
    case 'core':   return `+${(d*7).toFixed(2)}/wk`;
    default:       return `+${(d/24).toFixed(2)}/hr`;
  }
}
function installRatePeekHandlers(elements, pools, mode=getViewMode()){
  const POOLS = Object.keys(pools||{});
  for (const p of POOLS){
    const el = elements[p]; if (!el?.value) continue; const v = pools[p]||{};
    const rate = rateTextForMode(v.regenDaily || v.regenCurrent, mode);
    el.value.__origText = el.value.textContent; el.value.__rateText = rate; el.value.title = `Regen: ${rate}`;
    if (el.value.__rateWired) continue; el.value.__rateWired = true;
    const bar = el.value.closest('.bar');
    const show=()=>{ el.value.textContent=el.value.__rateText; el.value.classList.add('is-rate'); };
    const hide=()=>{ el.value.textContent=el.value.__origText; el.value.classList.remove('is-rate'); };
    bar.addEventListener('pointerenter',show); bar.addEventListener('pointerleave',hide);
    bar.addEventListener('focusin',show); bar.addEventListener('focusout',hide);
    let t=null; bar.addEventListener('click',()=>{ show(); clearTimeout(t); t=setTimeout(hide,1500); },{passive:true});
    bar.addEventListener('touchstart',()=>{ show(); clearTimeout(t); t=setTimeout(hide,1500); },{passive:true});
  }
}
function updateRatePeekTexts(elements, pools, mode=getViewMode()){
  for (const p of Object.keys(pools||{})){
    const el = elements[p]; if (!el?.value) continue; const v = pools[p]||{};
    el.value.__rateText = rateTextForMode(v.regenDaily || v.regenCurrent, mode);
    if (el.value.classList.contains('is-rate')) el.value.textContent = el.value.__rateText;
  }
}
function ensureReclaimLayers(elements){
  for (const p of Object.keys(elements)){
    const bar = elements[p]?.fill?.closest('.bar'); if (!bar) continue;
    if (!bar.querySelector('.bar-reclaim')){ const seg = document.createElement('div'); seg.className='bar-reclaim'; bar.appendChild(seg); }
  }
}

// ───────────────────────────────── Gateway Reader ───────────────────────────
async function readGateway(uid){
  const snap = await getDoc(doc(db, `players/${uid}/vitalsData/gateway`));
  return snap.exists() ? (snap.data()||{}) : null;
}

// ───────────────────────────────── Public: Static paint ─────────────────────
export async function loadVitalsToHUD(uid){
  const data = await readGateway(uid); if (!data) return;
  const elements = getVitalsElements();
  const pools = data.pools || {};
  const vm = getViewMode();
  const factor = (vm === 'core') ? CORE_DAYS : VIEW_FACTORS[vm];

  installRatePeekHandlers(elements, pools, vm === 'core' ? 'core' : vm);

  let sumCurrent = 0, sumMax = 0;
  for (const [pool, v] of Object.entries(pools)){
    const el = elements[pool]; if (!el) continue;
    const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);
    const cap   = Math.max(0, daily * factor);
    const current = Math.max(0, Math.min(cap, Number(v.current||0)));  // gateway current is already remainder
    const pct = cap>0 ? (current / cap) * 100 : 0;
    el.fill.style.width = `${pct}%`;
    el.value.innerText = `${current.toFixed(2)} / ${cap.toFixed(2)}`;

    // Surplus pill: compute days beyond one cycle if any (Core only)
    const surplusNowDays = (vm==='core' && daily>0)
      ? Math.floor(Math.max(0, ((Number(v.sNow||0)*cap) + current - cap) / daily))
      : 0;
    setSurplusPill(el, surplusNowDays, surplusNowDays);

    if (pool!=='essence'){ sumCurrent += current; sumMax += cap; }

    const barEl = el.fill.closest('.bar');
    barEl?.classList.remove("overspending","underspending");
    if (v.trend === "overspending")  barEl?.classList.add("overspending");
    if (v.trend === "underspending") barEl?.classList.add("underspending");
  }
  setVitalsTotals(sumCurrent, sumMax);
  refreshBarGrids();
}

// ───────────────────────────────── Public: Animated HUD ─────────────────────
export async function initVitalsHUD(uid, timeMultiplier = 1){
  const data = await readGateway(uid); if (!data) return;

  // Make sure gateway exists (and optionally kick a recompute once at start)
  try { await recomputeVitalsGatewayStub(uid); } catch {}

  const elements = getVitalsElements();
  const pools = data.pools || {};
  ensureReclaimLayers(elements);
  { const vm = getViewMode(); installRatePeekHandlers(elements, pools, vm==='core'?'core':vm); }

  // Truth remainder starts from gateway.current; regen per sec from regenDaily
  const truth = {};
  const regenPerSec = {};
  for (const [pool, v] of Object.entries(pools)){
    const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);
    truth[pool] = Math.max(0, Number(v.current || 0));
    regenPerSec[pool] = daily * (timeMultiplier / 86_400);
  }

  // Ghosts (pending) come from processedTransactions/verified
  const pendingCol = collection(db, `players/${uid}/financialData/processedTransactions/verified`);
  let pendingTx = [];
  const pendingQ = query(pendingCol, where("status","==","pending"));
  onSnapshot(pendingQ, (shot)=>{
    pendingTx = shot.docs.map(d=>{
      const x = d.data()||{};
      return {
        id: d.id,
        amount: Number(x.amount ?? x.amountMajor ?? 0),
        dateMs: x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? 0,
        ghostExpiryMs: Number(x.ghostExpiryMs ?? 0),
        provisionalTag: x.provisionalTag || null,
        suggestedPool:  x.suggestedPool  || null,
        transactionData:{ description: x?.transactionData?.description || '' },
      };
    });
  });

  // Focus window cache (confirmed spend) also from processedTransactions/verified (non-core confirmed debits)
  let focusSpend = { health:0, mana:0, stamina:0, essence:0 };
  let focusStart = 0, focusEnd = 0, focusDays = 1, lastFetchMs = 0;
  function getFocusPeriodBounds(mode){
    const now = new Date(); let start, end;
    if (mode === 'daily'){ start = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(); end = start + MS_PER_DAY; }
    else { const dow=(now.getDay()+6)%7; const startDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow);
           start=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()).getTime(); end=start+7*MS_PER_DAY; }
    return [start,end];
  }
  async function fetchConfirmedSpendInRange(uid, s, e){
    // Only NON-CORE debits contribute to HUD spend (gateway already included core)
    const qy = query(
      pendingCol,
      where("status","==","confirmed"),
      where("dateMs",">=",s),
      where("dateMs","<", e)
    );
    const snap = await getDocs(qy);
    const sums = { health:0, mana:0, stamina:0, essence:0 };
    snap.forEach(d=>{
      const x=d.data()||{};
      const cls = String(x.classification||'').toLowerCase();
      const isCore = (cls==='coreinflow'||cls==='coreoutflow');
      if (isCore) return;
      const amt = Number(x.amount ?? x.amountMajor ?? 0);
      if (amt >= 0) return; // credits handled into Essence in gateway
      const alloc = x.appliedAllocation || {};
      sums.health  += Number(alloc.health  || 0);
      sums.mana    += Number(alloc.mana    || 0);
      sums.stamina += Number(alloc.stamina || 0);
    });
    return Object.fromEntries(Object.entries(sums).map(([k,v])=>[k,Number(v.toFixed(2))]));
  }
  async function refreshFocusCacheIfNeeded(){
    const vm = getViewMode(); if (vm==='core') return;
    const [s,e] = getFocusPeriodBounds(vm);
    const stale = (Date.now()-lastFetchMs)>15000 || s!==focusStart || e!==focusEnd;
    if (!stale) return;
    focusStart=s; focusEnd=e; focusDays=Math.max(1,(e-s)/MS_PER_DAY);
    focusSpend = await fetchConfirmedSpendInRange(getAuth().currentUser.uid, s, e);
    lastFetchMs = Date.now();
    repaintEngravingLabels();
  }
  setInterval(()=>{ refreshFocusCacheIfNeeded(); }, 5000);
  await refreshFocusCacheIfNeeded();

  // Ghost allocation (same rules as legacy)
  function allocateSpendAcrossPools(spend, intent, availTruth){
    const out = { health:0, mana:0, stamina:0, essence:0 };
    if (spend <= 0) return out;
    if (intent === "mana"){
      const toMana = Math.min(spend, Math.max(0, availTruth.mana));
      if (toMana>0){ out.mana+=toMana; availTruth.mana-=toMana; }
      const leftover = spend - toMana; if (leftover>0) out.health += leftover;
      return out;
    }
    const toStamina = Math.min(spend, Math.max(0, availTruth.stamina));
    if (toStamina>0){ out.stamina+=toStamina; availTruth.stamina-=toStamina; }
    const toHealth = spend - toStamina; if (toHealth>0) out.health += toHealth;
    return out;
  }
  function applyRemainderFirst(T, cap, L){
    if (cap<=0) return { rNow:0, sNow:0, rAfter:0, sAfter:0, ghostLeftPct:0, ghostWidthPct:0 };
    const sNow=Math.floor(T/cap); const rNow=T - sNow*cap;
    if (L<=0.000001) return { rNow, sNow, rAfter:rNow, sAfter:sNow, ghostLeftPct:0, ghostWidthPct:0 };
    if (L<=rNow){
      const rAfter=rNow-L;
      return { rNow, sNow, rAfter, sAfter:sNow, ghostLeftPct:(rAfter/cap)*100, ghostWidthPct:(L/cap)*100 };
    }
    let Lleft=L-rNow; let s=sNow; let r=0;
    if (s>0){ const whole=Math.min(s, Math.floor(Lleft/cap)); if (whole>0){ s-=whole; Lleft-=whole*cap; } }
    if (Lleft>0 && s>0){ s-=1; r=cap; }
    const rAfter=Math.max(0, r-Lleft);
    return { rNow, sNow, rAfter, sAfter:s, ghostLeftPct:(rAfter/cap)*100, ghostWidthPct:((r-rAfter)/cap)*100 };
  }

  let last = null; let allowGhost = false; const enableGhostSoon=()=>{ if(!allowGhost) setTimeout(()=>allowGhost=true,60); };

  function frame(ts){
    if (last===null) last=ts; const dt=(ts-last)/1000; last=ts;

    for (const p of Object.keys(truth)) truth[p] = Math.max(0, truth[p] + (regenPerSec[p]||0) * dt);

    const now = Date.now();
    const ordered = [...pendingTx].sort((a,b)=>a.dateMs-b.dateMs);

    const vm = getViewMode();
    if (vm!=='core') refreshFocusCacheIfNeeded();

    let sumCurrent=0,sumMax=0;
    for (const pool of Object.keys(pools)){
      const el = elements[pool]; if (!el) continue;
      const v  = pools[pool] || {};
      const daily = Number(v.regenDaily ?? v.regenCurrent ?? 0);

      if (vm==='core'){
        const cap  = Math.max(0, daily * CORE_DAYS);
        const T    = truth[pool];

        // Build ghost totals from pendingTx each frame (intent from provisionalTag/suggestedPool)
        let avail = { ...truth };
        let Lsplit = { health:0, mana:0, stamina:0, essence:0 };
        for (const tx of ordered){
          if (tx.ghostExpiryMs && tx.ghostExpiryMs <= now) continue; // countdown only
          if (tx.amount >= 0) continue; // credits preview not shown in core reclaim
          const spend = Math.abs(tx.amount);
          const intent = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
          const part = allocateSpendAcrossPools(spend, intent==='mana'?'mana':'stamina', avail);
          Lsplit.health+=part.health||0; Lsplit.mana+=part.mana||0; Lsplit.stamina+=part.stamina||0;
        }
        const L = Lsplit[pool] || 0;
        const proj = applyRemainderFirst(T, cap, L);

        const useProjected = allowGhost && cap>0 && L>0.0001 && proj.ghostWidthPct>0.01;
        const pct = cap>0 ? ((useProjected ? proj.rAfter : proj.rNow)/cap)*100 : 0;
        el.fill.style.width = `${pct}%`;

        const normalText = `${(useProjected?proj.rAfter:proj.rNow).toFixed(2)} / ${cap.toFixed(2)}`;
        if (!el.value.__origText) el.value.__origText = el.value.textContent;
        el.value.textContent = el.value.classList.contains('is-rate') ? (el.value.__rateText || normalText) : normalText;
        enableGhostSoon();

        const barEl = el.fill.closest('.bar');
        const reclaimEl = barEl?.querySelector('.bar-reclaim');
        const showGhost = allowGhost && cap>0 && L>0.0001 && proj.ghostWidthPct>0.01;
        if (reclaimEl){
          if (showGhost){
            reclaimEl.style.left  = `${Math.max(0,Math.min(100,proj.ghostLeftPct)).toFixed(2)}%`;
            reclaimEl.style.width = `${Math.max(0,Math.min(100,proj.ghostWidthPct)).toFixed(2)}%`;
            reclaimEl.style.opacity = '1';
          } else { reclaimEl.style.opacity='0'; reclaimEl.style.width='0%'; }
        }

        // Surplus pills (days) using before/after
        const T_now = (proj.sNow*cap) + proj.rNow;
        const T_af  = (proj.sAfter*cap) + proj.rAfter;
        const surplusNowDays = daily>0 ? Math.floor(Math.max(0, (T_now - cap)/daily)) : 0;
        const surplusAfDays  = daily>0 ? Math.floor(Math.max(0, (T_af  - cap)/daily)) : 0;
        setSurplusPill(el, surplusNowDays, surplusAfDays);

        if (pool!=='essence'){ sumCurrent += (useProjected?proj.rAfter:proj.rNow); sumMax += cap; }
      } else {
        const daysIn = focusDays || VIEW_FACTORS[vm];
        const cap = Math.max(0, daily * daysIn);
        const spent = Number(focusSpend?.[pool] || 0);
        let current = Math.max(0, Math.min(cap, cap - spent));
        const pct = cap>0 ? (current/cap)*100 : 0;
        el.fill.style.width = `${pct}%`;
        const txt = `${current.toFixed(2)} / ${cap.toFixed(2)}`;
        if (!el.value.__origText) el.value.__origText = el.value.textContent;
        el.value.textContent = el.value.classList.contains('is-rate') ? (el.value.__rateText || txt) : txt;

        // Hide surplus pills in Focus
        setSurplusPill(el, 0, 0);

        // Simple reclaim preview in Focus (clip)
        const barEl = el.fill.closest('.bar'); const reclaimEl = barEl?.querySelector('.bar-reclaim');
        if (reclaimEl){
          // Use same pending split as Core computation but only eat into current
          let availFocus = { health:current, mana: (pool==='mana')?current:0, stamina:(pool==='stamina')?current:0, essence:0 };
          let Lpool = 0;
          for (const tx of ordered){
            if (tx.ghostExpiryMs && tx.ghostExpiryMs <= now) continue;
            if (tx.amount >= 0) continue;
            const spend = Math.abs(tx.amount);
            const intent = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
            const part = allocateSpendAcrossPools(spend, intent==='mana'?'mana':'stamina', { ...availFocus });
            Lpool += Number(part[pool] || 0);
          }
          if (cap>0 && Lpool>0.0001 && current>0.0001){
            const eat = Math.min(Lpool, current);
            reclaimEl.style.left  = `${Math.max(0,Math.min(100, ((current-eat)/cap)*100)).toFixed(2)}%`;
            reclaimEl.style.width = `${Math.max(0,Math.min(100, (eat/cap)*100)).toFixed(2)}%`;
            reclaimEl.style.opacity = '1';
          } else { reclaimEl.style.opacity='0'; reclaimEl.style.width='0%'; }
        }
        if (pool!=='essence'){ sumCurrent+=current; sumMax+=cap; }
      }

      // Trend tint
      const barEl = elements[pool]?.fill?.closest('.bar');
      barEl?.classList.remove("overspending","underspending");
      const trend = v.trend || "stable";
      if (trend === "overspending")  barEl?.classList.add("overspending");
      if (trend === "underspending") barEl?.classList.add("underspending");
    }

    setVitalsTotals(sumCurrent, sumMax);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("vitals:viewmode", (e)=>{
    const raw = e?.detail?.mode || "daily";
    allowGhost = false; enableGhostSoon();
    refreshBarGrids();
    updateRatePeekTexts(elements, pools, raw==='core'?'core':raw);
    repaintEngravingLabels();
    if (raw!=='core'){ lastFetchMs = 0; refreshFocusCacheIfNeeded(); }
  });
  window.addEventListener("vitals:primary", ()=>{
    const vmNow = getViewMode();
    refreshBarGrids();
    updateRatePeekTexts(elements, pools, vmNow==='core'?'core':vmNow);
    repaintEngravingLabels();
    if (vmNow!=='core'){ lastFetchMs = 0; refreshFocusCacheIfNeeded(); }
  });
}

// ───────────────────────────────── Update Log (pending / recent) ────────────
function normalizeTxn(d){
  const x=d.data()||{};
  return {
    id:d.id, amount:Number(x.amount ?? x.amountMajor ?? 0),
    dateMs: x.dateMs ?? x.postedAtMs ?? x.transactionData?.entryDate?.toMillis?.() ?? Date.now(),
    status: x.status || "pending",
    provisionalTag: x.provisionalTag || null,
    tag: x.tag || null,
    ghostExpiryMs: Number(x.ghostExpiryMs ?? 0),
    transactionData: { description: x?.transactionData?.description || '' }
  };
}
export function listenUpdateLogPending(uid, cb){
  const qy = query(
    collection(db, `players/${uid}/financialData/processedTransactions/verified`),
    where("status","==","pending"),
    orderBy("dateMs","desc"),
    limit(5)
  );
  return onSnapshot(qy,(snap)=>{ cb(snap.docs.map(normalizeTxn)); });
}
export function listenRecentlyConfirmed(uid, lookbackMs = 24*60*60*1000, cb){
  const since = Date.now() - lookbackMs;
  const qy = query(
    collection(db, `players/${uid}/financialData/processedTransactions/verified`),
    where("status","==","confirmed"),
    where("tag.setAtMs",">=", since),
    orderBy("tag.setAtMs","desc"),
    limit(5)
  );
  return onSnapshot(qy,(snap)=>{ cb(snap.docs.map(normalizeTxn)); });
}
export async function setProvisionalTag(uid, txId, pool){
  await updateDoc(doc(db, `players/${uid}/financialData/processedTransactions/verified/${txId}`), {
    provisionalTag: { pool, setAtMs: Date.now() }
  });
}

// UI helpers copied (unchanged signatures) so dashboard keeps working
export function autoInitUpdateLog(){
  const listEl   = document.querySelector("#update-log-list");
  const recentEl = document.querySelector("#recently-locked-list");
  if (!listEl && !recentEl) return;
  const auth = getAuth();
  onAuthStateChanged(auth,(user)=>{
    if (!user) return; const uid=user.uid;

    function setActiveButtons(li,pool){
      const buttons=li.querySelectorAll(".tag-btn");
      buttons.forEach(b=>{ b.classList.remove("active","stamina","mana"); if (b.dataset.pool===pool) b.classList.add("active",pool); });
    }

    if (listEl){
      listenUpdateLogPending(uid,(items)=>{
        listEl.innerHTML="";
        if (!items.length){ const li=document.createElement("li"); li.textContent="Nothing pending — nice!"; listEl.appendChild(li); return; }
        items.forEach(tx=>{
          const li=document.createElement("li"); li.setAttribute('data-tx',tx.id);
          const nowMs=Date.now(); const ttl=Number(tx.ghostExpiryMs||0); const secsLeft = ttl>nowMs ? Math.floor((ttl-nowMs)/1000) : 0;
          const minLeft=Math.floor(secsLeft/60); const secLeft=secsLeft%60;
          const name=tx.transactionData?.description||"Transaction";
          const amt = Number(tx.amount).toFixed(2);
          const tag = tx.provisionalTag?.pool ?? "stamina";
          const actionsHtml = `
            <div class="ul-actions two">
              <button class="tag-btn" data-pool="mana"    title="Mana"    aria-label="Mana">M</button>
              <button class="tag-btn" data-pool="stamina" title="Stamina" aria-label="Stamina">S</button>
            </div>`;
          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • <span class="countdown">${minLeft}m ${secLeft}s</span> • ${tag}</div>
              </div>
              ${actionsHtml}
            </div>`;
          setActiveButtons(li, tag);
          li.querySelectorAll(".tag-btn").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
              const pool=btn.getAttribute("data-pool"); setActiveButtons(li,pool); await setProvisionalTag(uid, tx.id, pool);
            });
          });
          listEl.appendChild(li);
        });
      });

      // lightweight countdown tick from live pending list
      window.addEventListener("tx:expiry-tick",(e)=>{
        const ticks=e?.detail?.ticks||[]; for (const {id,seconds} of ticks){
          const row=listEl?.querySelector(`li[data-tx="${id}"]`); if (!row) continue;
          const span=row.querySelector(".countdown"); if (!span) continue;
          const s=Math.max(0,Number(seconds)||0); const m=Math.floor(s/60); const r=s%60; span.textContent=`${m}m ${r}s`;
        }
      });
    }

    if (recentEl){
      listenRecentlyConfirmed(uid, 24*60*60*1000, (items)=>{
        recentEl.innerHTML="";
        if (!items.length){ const li=document.createElement("li"); li.textContent="No recent locks."; recentEl.appendChild(li); return; }
        items.forEach(tx=>{
          const li=document.createElement("li");
          const name=tx.transactionData?.description||"Transaction";
          const amt = Number(tx.amount).toFixed(2);
          const when = tx.tag?.setAtMs ? new Date(tx.tag.setAtMs).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
          const intentPool = tx.tag?.pool ?? tx.provisionalTag?.pool ?? "stamina";
          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • ${when} <span class="badge ${intentPool}">${intentPool}</span></div>
              </div>
            </div>`;
          recentEl.appendChild(li);
        });
      });
    }
  });
}
export function autoInitHistoryButtons(){
  const btn1=document.getElementById('btn-expand-update');
  const btn2=document.getElementById('btn-expand-locked');
  const open = ()=>{
    // Minimal, local client history using verified collection
    const user=getAuth().currentUser; if(!user) return; const uid=user.uid;
    (async ()=>{
      const wrap=document.createElement('div'); wrap.style.padding='8px';
      const list=document.createElement('ul'); list.style.listStyle='none'; list.style.margin='0'; list.style.padding='0';
      wrap.appendChild(list);
      const col=collection(db,`players/${uid}/financialData/processedTransactions/verified`);
      const qy=query(col, orderBy('dateMs','desc'), limit(50));
      const snap=await getDocs(qy);
      list.innerHTML = snap.docs.map(d=>{
        const x=d.data()||{}; const n=x?.transactionData?.description||'Transaction';
        const amt=Number(x.amount ?? x.amountMajor ?? 0); const sign=amt>=0?'+':'−';
        const abs=Math.abs(amt).toFixed(2);
        const when=x.dateMs?new Date(x.dateMs).toLocaleString():'';
        const type=amt>=0?'income':'spend';
        return `<li class="tx-row ${type}"><div class="ul-row"><div class="ul-main"><strong>${n}</strong><div class="ul-meta">${sign}£${abs} • ${when}</div></div></div></li>`;
      }).join('');
      // Simple overlay
      const modal=document.createElement('div'); modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
      const card=document.createElement('div'); card.style.cssText='width:min(720px,92vw);max-height:80vh;overflow:auto;background:#0f1118;color:#fff;border:1px solid #2a3a55;border-radius:12px;padding:12px';
      const close=document.createElement('button'); close.className='btn'; close.textContent='Close'; close.style.marginTop='10px';
      close.onclick=()=>modal.remove();
      card.append(wrap, close); modal.append(card); document.body.appendChild(modal);
    })();
  };
  if (btn1) btn1.addEventListener('click', open);
  if (btn2) btn2.addEventListener('click', open);
}

// ───────────────────────────────── Lock / server functions (stubs) ─────────
export async function refreshVitals(){ try{ const u=getAuth().currentUser; if(!u) return {}; await recomputeVitalsGatewayStub(u.uid); return (await readGateway(u.uid))||{}; } catch { return {}; } }
// No-op locker for now (parity placeholder). Wire to a Cloud Function when ready.
export async function lockExpiredOrOverflow(uid, queueCap = 50){ return { locked: 0 }; }
export async function getEssenceAvailableMonthlyFromHUD(uid){
  // You can compute from gateway if you store essence cap/current explicitly; return 0 as safe stub.
  return 0;
}

// ───────────────────────────────── Convenience buttons (unchanged) ─────────
export function autoInitAddEnergyButton(){
  const btn=document.getElementById("left-btn"); if(!btn) return;
  btn.addEventListener("click", async (e)=>{ e.preventDefault(); try{ await openEnergyMenu(); } catch(e){ console.error("Failed to open Energy Menu:", e); } });
}

export function autoInitAddSocialButton() {
  const btn = document.getElementById('right-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); 
      window.MyFiModal.openChildItem(window.MyFiSocialMenu, 'home', { 
          menuTitle: 'Social' 
      });
    });
  }
}

export function autoInitAddSpendButton(){
  const addBtn=document.getElementById('btn-add-spend');
  if (addBtn) addBtn.addEventListener('click',(e)=>{ e.preventDefault(); window.MyFiModal?.openChildItem?.(window.MyFiFinancesMenu,'addTransaction',{menuTitle:'Add Transaction'}); });
}



// ───────────────────────────────── Small tick bus for countdowns ───────────
(function tickBus(){
  let last = 0;
  function t(){ const now=Math.floor(Date.now()/1000); if (now!==last){ last=now; window.dispatchEvent(new CustomEvent("tx:expiry-tick",{ detail:{ ticks: [] }})); } requestAnimationFrame(t); }
  requestAnimationFrame(t);
})();
