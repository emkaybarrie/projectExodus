// public/js/smartreview.js
// Frontend Smart Review overlay (full-screen modal) that talks to backend SR endpoints.
// Depends on your Firebase auth instance.

import { auth } from './core/auth.js'; // adjust path if your js root differs

// ---------- tiny fetch helpers ----------
const REGION = 'europe-west2';
const CF_BASE = `https://${REGION}-myfi-app-7fa78.cloudfunctions.net`; // change project id if needed

async function withAuth(url, opts = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const idToken = await user.getIdToken();
  const headers = { ...(opts.headers||{}), Authorization: `Bearer ${idToken}` };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { ok:false, parseError:true, text }; }
  if (!res.ok || json?.ok === false) {
    console.warn('[SR][client] request failed', { url, status: res.status, json });
    throw Object.assign(new Error('smart_review_failed'), { status: res.status, body: json });
  }
  return json;
}

async function srAnalyze() {
  return withAuth(`${CF_BASE}/smartReview_analyze`);
}
async function srSave(payload) {
  return withAuth(`${CF_BASE}/smartReview_save`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload || {})
  });
}
async function srAutoBackfill(anchorSinceMs, includeAlreadyTagged=false) {
  return withAuth(`${CF_BASE}/smartReview_autobackfill`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ anchorSinceMs, includeAlreadyTagged })
  });
}

// ---------- UI helpers ----------
function h(tag, attrs={}, ...kids){
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})) {
    if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const k of kids) el.append(k?.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const GBP = (n)=> new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };
const toMonthly = (value, cadence)=> Number((Number(value||0) * (MONTHLY_MULT[cadence]??1)).toFixed(2));

// ---------- Overlay shell ----------
function ensureOverlay(){
  let host = document.getElementById('sr-modal');
  if (host) return host;
  host = h('div',{ id:'sr-modal', style:{
    position:'fixed', inset:'0', background:'rgba(4,7,12,.88)', zIndex:9999,
    display:'flex', alignItems:'center', justifyContent:'center'
  }});
  const panel = h('div',{ class:'sr-panel', style:{
    width:'min(980px, 92vw)', maxHeight:'90vh', overflow:'auto',
    background:'#0f1118', color:'#fff', border:'1px solid #223', borderRadius:'16px',
    boxShadow:'0 18px 50px rgba(0,0,0,.45)', padding:'16px 18px'
  }});
  host.append(panel);
  document.body.append(host);
  return host;
}

// ---------- Row builder ----------
function rowCard(item, kind, onToggle){
  // item: {id,name,cadence,representative,confidence,txCount}
  const mon = toMonthly(item.representative, item.cadence);
  const chk = h('input', { type:'checkbox', checked:true, onChange: ()=>onToggle(item, chk.checked) });
  const cad = h('select', {}, ...['weekly','fortnightly','monthly','quarterly','yearly','daily'].map(v=>{
    const o = h('option',{} , v); o.value=v; if (v===item.cadence) o.selected=true; return o;
  }));
  const name = h('input', { value:item.name, style:{ width:'100%' } });

  const wrap = h('div',{ class:'sr-card', style:{
    border:'1px solid #233248', borderRadius:'12px', padding:'10px', margin:'8px 0', background:'#121626'
  }},
    h('div', { style:{display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:'8px', alignItems:'center'}},
      name,
      h('span', { style:{opacity:.9}}, `${item.cadence}`),
      h('strong', {}, `${GBP(mon)}/mo`),
      chk
    ),
    h('div', { style:{fontSize:'12px', opacity:.8, marginTop:'6px'}},
      `≈ ${GBP(item.representative)} per ${item.cadence} • hits ${item.txCount} • conf ${Math.round(item.confidence*100)}%`
    )
  );

  // allow cadence edit to recompute monthly preview
  cad.addEventListener('change', ()=>{
    const newMon = toMonthly(item.representative, cad.value);
    wrap.querySelector('strong').textContent = `${GBP(newMon)}/mo`;
    item.cadence = cad.value;
  });

  // capture edits
  name.addEventListener('input', ()=>{ item.label = name.value.trim() || item.name; });

  // include/exclude hook
  onToggle(item, true);

  return wrap;
}

// ---------- main painter ----------
async function mountSmartReview() {
  const host = ensureOverlay();
  const panel = host.firstChild;
  panel.innerHTML = ''; // reset

  panel.append(
    h('h2',{},'Smart Review'),
    h('div',{style:{margin:'6px 0 12px', opacity:.85}},'Review your Energy Source (inflows) and Emberward (core outflows).')
  );

  // fetch analysis
  let analysis;
  try {
    analysis = await srAnalyze();
  } catch (e) {
    panel.append(h('div',{style:{color:'#f66'}},'Could not load Smart Review. Try again.'));
    console.error(e);
    return;
  }

  // state
  const includeIn = new Map();   // id -> item (mutated with label/cadence)
  const includeOut= new Map();

  // summary bar
  const sum = h('div',{style:{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', margin:'8px 0'}});
  const sumEnergy = h('div',{style:{border:'1px solid #264', borderRadius:'14px', padding:'8px 10px', background:'#0f1a14'}});
  const sumEmber  = h('div',{style:{border:'1px solid #642', borderRadius:'14px', padding:'8px 10px', background:'#1a1010'}});
  const sumDelta  = h('div',{style:{border:'1px solid #345', borderRadius:'14px', padding:'8px 10px', background:'#0f141a'}});
  const setSummary = ()=>{
    const e = [...includeIn.values()].reduce((s,x)=> s + toMonthly(x.representative, x.cadence), 0);
    const o = [...includeOut.values()].reduce((s,x)=> s + toMonthly(x.representative, x.cadence), 0);
    sumEnergy.innerHTML = `<b>Energy</b>: ${GBP(e)}`;
    sumEmber .innerHTML = `<b>Ember</b>: ${GBP(o)}`;
    sumDelta .innerHTML = `<b>Δ/mo</b>: ${GBP(e - o)}<div style="font-size:12px;opacity:.85;margin-top:4px">Δ/d ${GBP((e-o)/30.44)} · Δ/w ${GBP((e-o)*7/30.44)}</div>`;
  };
  sum.append(sumEnergy, sumEmber, sumDelta);
  panel.append(sum);

  // tabs
  const tabs = h('div',{style:{display:'flex', gap:'8px', margin:'6px 0 8px'}},
    h('button',{id:'tab-in',  class:'btn'},'Energy Source'),
    h('button',{id:'tab-out', class:'btn', style:{opacity:.8}},'Emberward')
  );
  panel.append(tabs);

  const list = h('div', {});
  panel.append(list);

  function paintList(which){
    list.innerHTML = '';
    const src = which==='in' ? analysis.preview.inflow : analysis.preview.ember;
    if (!src?.length) {
      list.append(h('div',{style:{opacity:.7}}, 'No candidates found in the last year.'));
      return;
    }
    src.forEach(it=>{
      list.append(rowCard(it, which, (item,checked)=>{
        const bucket = which==='in' ? includeIn : includeOut;
        if (checked) bucket.set(item.id, item); else bucket.delete(item.id);
        setSummary();
      }));
    });
  }
  paintList('in');

  tabs.querySelector('#tab-in').onclick = ()=>{
    tabs.querySelector('#tab-in').style.opacity = 1;
    tabs.querySelector('#tab-out').style.opacity = .8;
    paintList('in');
  };
  tabs.querySelector('#tab-out').onclick = ()=>{
    tabs.querySelector('#tab-in').style.opacity = .8;
    tabs.querySelector('#tab-out').style.opacity = 1;
    paintList('out');
  };

  // anchor picker (continuous)
  const anchorWrap = h('div',{style:{marginTop:'10px', padding:'10px', borderTop:'1px solid #233'}});
  const sel = h('select', {});
  sel.append(h('option', {}, '-- choose anchor in last 30d --'));
  (analysis.anchors||[]).forEach(a=>{
    const o = h('option',{}, `${a.dom}/${a.m}/${a.y}`); o.value = a.ms; sel.append(o);
  });
  anchorWrap.append(h('div',{style:{opacity:.85, marginBottom:'6px'}},'Anchor date'), sel);
  panel.append(anchorWrap);

  // actions
  const actions = h('div',{style:{display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'12px'}},
    h('button',{onClick:()=>document.getElementById('sr-modal')?.remove()},'Back'),
    h('button',{class:'primary', onClick: async ()=>{
      // build payload for backend
      const energy = [...includeIn.values()].map(x=>({
        label: x.label || x.name,
        cadence: x.cadence,
        monthly: toMonthly(x.representative, x.cadence),
        category: 'other'
      }));
      const ember = [...includeOut.values()].map(x=>({
        label: x.label || x.name,
        cadence: x.cadence,
        monthly: toMonthly(x.representative, x.cadence),
        category: 'other'
      }));
      const anchorDateMs = Number(sel.value || 0) || null;

      try {
        await srSave({ mode:'continuous', energy, ember, anchorDateMs });
        // optionally auto-backfill from anchor
        if (anchorDateMs) await srAutoBackfill(anchorDateMs, false);
        document.getElementById('sr-modal')?.remove();
        // soft refresh or dispatch event so vitals can refresh
        window.dispatchEvent(new CustomEvent('cashflow:updated', { detail:{ source:'smartReview' } }));
      } catch (e) {
        alert('Save failed. Check console.');
        console.error(e);
      }
    }},'Continue')
  );
  panel.append(actions);

  // initial summary
  setSummary();
}

// exported helpers
export function openSmartReviewModal(){ mountSmartReview(); }

// When called at end of TL callback flow, sets a flag, redirects to dashboard, and opens SR.
export function runSmartReviewAfterTLSync() {
  localStorage.setItem('sr:pending','1');
  // if you already are on dashboard, just open:
  if (location.pathname.includes('dashboard')) openSmartReviewModal();
  else window.location.href = 'dashboard.html';
}

// When dashboard loads, call this once to auto-open if pending
export function hydrateSmartReviewOnDashboard() {
  if (localStorage.getItem('sr:pending') === '1') {
    localStorage.removeItem('sr:pending');
    openSmartReviewModal();
  }
}

export default { mountSmartReview, openSmartReviewModal, runSmartReviewAfterTLSync, hydrateSmartReviewOnDashboard };
export { mountSmartReview };
