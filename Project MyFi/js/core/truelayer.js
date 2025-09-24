// js/core/truelayer.js
// Centralised TrueLayer client helpers + RICH Smart Review UI (with stub fallback).

import { auth } from "./auth.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ───────────────────────── OAuth PKCE helpers ─────────────────────────
async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function randomString(n=64) {
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let s=''; for(let i=0;i<n;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}
async function makePkce() {
  const verifier = randomString(64);
  return { verifier, challenge: await sha256(verifier) };
}

/**
 * Legal links snippet (use anywhere: consent modal, footer, disclosures)
 */
export function renderLegalLinks() {
  return `
    <a href="./privacy.html" target="_blank" rel="noopener">Privacy</a> ·
    <a href="./complaints.html" target="_blank" rel="noopener">Support & Complaints</a> ·
    <a href="https://truelayer.com/legal/privacy/" target="_blank" rel="noopener">TrueLayer Privacy</a> ·
    <a href="https://truelayer.com/legal/terms-of-service/" target="_blank" rel="noopener">TrueLayer Terms</a>
  `;
}

// ───────────────────────── Consent modal ─────────────────────────
export function ensureTlConsentDialog() {
  let dlg = document.getElementById('tlConsent');
  if (dlg) return dlg;

  dlg = document.createElement('dialog');
  dlg.id = 'tlConsent';
  dlg.innerHTML = `
    <form method="dialog" style="min-width:320px;max-width:560px">
      <h3 style="margin:0 0 8px;font-weight:600">Connect your bank</h3>
      <p style="margin:0 0 8px">
        We connect via <strong>TrueLayer</strong>. We act as their <em>agent</em> to access your data
        <strong>only with your consent</strong>.
      </p>
      <ul style="margin:0 0 12px;padding-left:18px;font-size:.95em;opacity:.95;line-height:1.35">
        <li>You can revoke access at any time in Settings.</li>
        <li>We fetch accounts and transactions to power automation and your Vitals.</li>
      </ul>
      <p style="margin:0 0 12px;font-size:0.9em;opacity:.9">
        ${renderLegalLinks()}
      </p>
      <menu style="display:flex;gap:8px;justify-content:flex-end;margin:0">
        <button value="cancel">Cancel</button>
        <button id="tlAgree" value="default" style="border:1px solid #58d;padding:8px 12px;border-radius:10px">
          Agree & Continue
        </button>
      </menu>
    </form>
  `;
  document.body.appendChild(dlg);
  return dlg;
}

// ───────────────────────── Auth start (PKCE) ─────────────────────────
export async function connectTrueLayerAccount() {
  const user = auth.currentUser;
  if (!user) { alert("Please log in first."); return; }

  const clientId = "sandbox-projectmyfi-f89485";

  // Build the clean callback URL beside the current page (no query string)
  const rawRedirect = new URL('callback.html', window.location.href);
  rawRedirect.search = '';
  sessionStorage.setItem('tl_redirect_uri', rawRedirect.toString());

  const redirectUri = encodeURIComponent(rawRedirect.toString());
  const scope = encodeURIComponent("info accounts balance cards transactions direct_debits standing_orders offline_access");
  const state = encodeURIComponent(user.uid);
  const providers = encodeURIComponent("uk-cs-mock uk-ob-all uk-oauth-all");

  const { verifier, challenge } = await makePkce();
  sessionStorage.setItem('tl_code_verifier', verifier);

  const authUrl =
    `https://auth.truelayer-sandbox.com/?response_type=code&client_id=${clientId}` +
    `&scope=${scope}&redirect_uri=${redirectUri}&state=${state}&providers=${providers}` +
    `&code_challenge_method=S256&code_challenge=${encodeURIComponent(challenge)}`;

  window.location.href = authUrl;
}
if (typeof window !== 'undefined') {
  window.connectTrueLayerAccount = connectTrueLayerAccount;
}

// ───────────────────────── Server fetch triggers ─────────────────────────
export async function triggerTrueLayerFetch(type) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();

  const base = {
    Accounts:       'https://fetchaccounts-frxqsvlhwq-nw.a.run.app',
    Cards:          'https://fetchcards-frxqsvlhwq-nw.a.run.app',
    Transactions:   'https://fetchtransactions-frxqsvlhwq-nw.a.run.app',
    DirectDebits:   'https://fetchdirectdebits-frxqsvlhwq-nw.a.run.app',
    StandingOrders: 'https://fetchstandingorders-frxqsvlhwq-nw.a.run.app',
  }[type];

  const r = await fetch(base, { headers: { Authorization: 'Bearer ' + idToken }});
  const json = await r.json();
  if (!r.ok || json?.error) throw json?.error || new Error('fetch_failed');
  return json.data;
}

export async function syncTrueLayerAll() {
  await triggerTrueLayerFetch('Accounts');
  await triggerTrueLayerFetch('Cards');
  await triggerTrueLayerFetch('Transactions');
  await triggerTrueLayerFetch('DirectDebits');
  await triggerTrueLayerFetch('StandingOrders');
}
if (typeof window !== 'undefined') {
  window.syncTrueLayerAll = syncTrueLayerAll;
}
export async function triggerIngestBackfill(sinceMs) {
  const user = auth.currentUser;
  if (!user) return alert("Not signed in");
  const base = 'https://europe-west2-myfi-app-7fa78.cloudfunctions.net';
  const qs = new URLSearchParams({ uid: user.uid });
  if (sinceMs) qs.set('sinceMs', String(sinceMs));
  const url = `${base}/ingestTrueLayerBackfill?${qs.toString()}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json?.error) throw json?.error || new Error('backfill_failed');
  return json;
}
if (typeof window !== 'undefined') {
  window.triggerIngestBackfill = triggerIngestBackfill;
}

// ======================================================================
//                              RICH SMART REVIEW
// ======================================================================

// Tiny CSS injector (keeps this self-contained wherever you call it)
function ensureSmartReviewStyles(){
  if (document.getElementById('sr-styles')) return;
  const css = `
  #srWrap{ max-width:880px; margin:16px auto; padding:12px; border:1px solid #273142; border-radius:14px; background:#0f1118; color:#fff; }
  #srWrap h2{ margin:0 0 8px; font-size:18px; }
  #srWrap h4{ margin:8px 0; font-size:15px; opacity:.95; }
  .sr-info{ opacity:.85; font-size: 13px; margin:6px 0 12px; }
  .ao-tile{ border:1px solid #223044; border-radius:12px; padding:10px; background:#121626; }
  .ao-input{ width:100%; padding:8px; border-radius:8px; border:1px solid #2a3a55; background:#0d1220; color:#fff; }
  .ao-select{ width:100%; padding:8px; border-radius:8px; border:1px solid #2a3a55; background:#0d1220; color:#fff; }
  .sr-field{ display:flex; flex-direction:column; gap:4px; }
  .sr-row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .sr-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
  .sr-sub{ font-size:12px; opacity:.8; }
  .sr-badge{ display:inline-block; font:600 12px system-ui; opacity:.85; }
  .sr-more{ margin-top:6px; }
  @media (min-width: 740px){
    #srWrap .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  }`;
  const style = document.createElement('style');
  style.id = 'sr-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// Format/cadence helpers
const GBP = (n)=> new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n)||0);
const MONTHLY_MULT = { monthly:1, weekly:52/12, fortnightly:26/12, quarterly:4/12, yearly:1/12, daily:30.44 };
const CADENCE_LABELS = { weekly:'Weekly', fortnightly:'Fortnightly', monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly', daily:'Daily' };
const FREQ_OPTIONS_FULL = [['weekly','Weekly'],['fortnightly','Fortnightly'],['monthly','Monthly'],['quarterly','Quarterly'],['yearly','Yearly'],['daily','Daily']];
const toMonthly = (value, cadence)=> Number((Number(value||0) * (MONTHLY_MULT[cadence]??1)).toFixed(2));

// Firestore IO
// Replace your current readRecentTransactions with this:

async function readRecentTransactions(uid, lookbackDays = 365) {
  const db = getFirestore();
  const cutoff = Date.now() - lookbackDays * 24 * 3600 * 1000;

  // 1) Try the new fan-out (preferred)
  try {
    const itemsCol = doc(db, `players/${uid}/financialData_TRUELAYER/accounts`).parent.collection('accounts').doc('items');
    const itemsSnap = await itemsCol.get?.()  // SDK compat guard
      ?? await (await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"))
            .getDocs((await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"))
            .collection(db, `players/${uid}/financialData_TRUELAYER/accounts/items`));

    const txns = [];
    if (itemsSnap?.forEach) {
      // Iterate all accounts’ /transactions subcollections
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
      const tasks = [];
      itemsSnap.forEach(accDoc => {
        const txCol = collection(db, `players/${uid}/financialData_TRUELAYER/accounts/items/${accDoc.id}/transactions`);
        tasks.push(getDocs(txCol));
      });
      const all = await Promise.all(tasks);
      for (const snap of all) {
        snap.forEach(d => {
          const t = d.data() || {};
          const ts = t?.postedAt?.toMillis?.() ?? (t.raw?.timestamp ? new Date(t.raw.timestamp).getTime() : NaN);
          if (Number.isFinite(ts) && ts >= cutoff) {
            txns.push({
              timestamp: ts,
              amount: (typeof t.amountMinor === 'number') ? t.amountMinor / 100 : t.raw?.amount ?? 0,
              description: t.description || t.raw?.description || '',
              merchant: t.merchantName || t.raw?.merchant_name || '',
              currency: t.currency || t.raw?.currency || 'GBP',
            });
          }
        });
      }
      if (txns.length) return txns;
    }
  } catch (_) { /* fall back below */ }

  // 2) Try the old aggregate TL doc if present
  try {
    const aggSnap = await getDoc(doc(db, `players/${uid}/financialData_TRUELAYER/transactions`));
    if (aggSnap.exists()) {
      const payload = aggSnap.data()?.data || {};     // { [accountId]: [tx...] }
      const txns = [];
      for (const arr of Object.values(payload)) {
        for (const t of (arr || [])) {
          const ts = Number(new Date(t.timestamp || t.posted || t.booked || t.date));
          if (Number.isFinite(ts) && ts >= cutoff) {
            txns.push({
              timestamp: ts,
              amount: t.amount, // TL REST aggregate is in major units (signed)
              description: t.description || '',
              merchant: t.merchant_name || '',
              currency: t.currency || 'GBP',
            });
          }
        }
      }
      if (txns.length) return txns;
    }
  } catch (_) { /* ignore */ }

  // 3) Lastly, try the very old path you had (kept for safety)
  try {
    const snap = await getDoc(doc(db, `players/${uid}/financialData/transactions`));
    if (snap.exists()) {
      const d = snap.data() || {};
      const items = Array.isArray(d.items) ? d.items : [];
      return items.filter(t => {
        const ts = Number(new Date(t.timestamp || t.date || t.booked || t.valueDate));
        return Number.isFinite(ts) && ts >= cutoff;
      });
    }
  } catch (_) {}

  return [];
}

async function writeUnified(uid, kind, totalAmount, categories){
  await setDoc(doc(getFirestore(), `players/${uid}/cashflowData/itemised_${kind}`), {
    mode:'itemised', cadence:'monthly', totalAmount: Number(totalAmount)||0, categories: categories||{}, updatedAt: Date.now()
  }, { merge:true });
}

// Normalisation & grouping
function normalizeName(s=''){
  let n = String(s).toLowerCase();
  n = n.replace(/card\s*\d+|pos\s*\d+|ref[:\s]*\d+|#[a-z0-9]+/g,' ');
  n = n.replace(/[\u{1F300}-\u{1FAFF}]/gu, ''); // emojis
  n = n.replace(/[^\p{L}\p{N}\s\.\-&]/gu,' ');
  n = n.replace(/\s{2,}/g,' ').trim();
  n = n.replace(/tesco.*$/,'tesco').replace(/sainsbury.*$/,'sainsbury')
       .replace(/british\s*gas.*$/,'british gas').replace(/vodafone.*$/,'vodafone')
       .replace(/oyster|tfl/,'tfl').replace(/hmrc.*$/,'hmrc');
  return n || 'unknown';
}
const signOf = a => (a===0?0:(a>0?1:-1));
function groupTransactions(txs){
  const groups = new Map(); // key -> {name, sign, occ:[{ts,amt}]}
  for (const t of txs){
    const rawAmt = Number(t.amount || t.amount_minor || 0);
    const amt = Math.abs(rawAmt) >= 1000 ? rawAmt/100 : rawAmt; // tolerate minor/major
    if (!amt) continue;
    const sgn = signOf(amt);
    const keyName = normalizeName(t.description || t.merchant || t.counterparty || t.reference || 'unknown');
    const key = keyName + '|' + sgn;
    if (!groups.has(key)) groups.set(key, { name: keyName, sign: sgn, occ: [] });
    const ts = Number(new Date(t.timestamp || t.date || t.booked || t.valueDate));
    if (Number.isFinite(ts)) groups.get(key).occ.push({ ts, amt });
  }
  for (const g of groups.values()) g.occ.sort((a,b)=>a.ts-b.ts);
  return Array.from(groups.values());
}

// Cadence/score
function detectCadence(occ){
  if (occ.length < 3) return { cadence: 'monthly', hits: 0, fit: 0.3 };
  const deltas = [];
  for (let i=1;i<occ.length;i++) deltas.push((occ[i].ts - occ[i-1].ts)/86400000);
  const med = deltas.slice().sort((a,b)=>a-b)[Math.floor(deltas.length/2)];
  const buckets = [
    { key:'weekly',      center: 7,   tol: 2  },
    { key:'fortnightly', center: 14,  tol: 2  },
    { key:'monthly',     center: 30,  tol: 4  },
    { key:'quarterly',   center: 91,  tol: 10 },
    { key:'yearly',      center: 365, tol: 30 },
  ];
  let best = { cadence:'monthly', fit:0, hits:0 };
  for (const b of buckets){
    const inBand = deltas.filter(d => Math.abs(d - b.center) <= b.tol);
    const fit = inBand.length / deltas.length;
    if (fit > best.fit) best = { cadence: b.key, fit, hits: inBand.length };
  }
  return best;
}
function amountStabilityScore(occ){
  if (occ.length < 3) return 0.2;
  const vals = occ.map(o=>Math.abs(o.amt)).sort((a,b)=>a-b);
  const med = vals[Math.floor(vals.length/2)];
  const within = vals.filter(v => Math.abs(v - med) <= med*0.2).length;
  return within / vals.length; // 0..1
}
function keywordBoost(name, isCredit){
  const s = String(name||'').toLowerCase();
  const strongIn = /(salary|payroll|wage|hmrc|employer|scholarship|stipend)/.test(s);
  const strongOut= /(rent|mortgage|council|insurance|vodafone|o2|ee|british gas|octopus|energy|loan|credit\s*card|broadband|internet)/.test(s);
  return (isCredit && strongIn) || (!isCredit && strongOut) ? 0.1 : 0;
}
const representativeAmount = occ => Number((occ.map(o=>Math.abs(o.amt)).sort((a,b)=>a-b)[Math.floor(occ.length/2)]||0).toFixed(2));
function scoreGroup(g){
  const cadence = detectCadence(g.occ);
  const stab = amountStabilityScore(g.occ);
  const expectedCoverage = Math.min(1, (cadence.hits + 1) / Math.max(1, g.occ.length));
  const kw = keywordBoost(g.name, g.sign > 0);
  const score = (0.4*cadence.fit) + (0.3*expectedCoverage) + (0.2*stab) + (0.1*kw);
  return { cadence: cadence.cadence, score: Math.min(1, Number(score.toFixed(3))) };
}
function buildAnalysisFromTxs(txs){
  const groups = groupTransactions(txs);
  const items = groups.map(g=>{
    const rep = representativeAmount(g.occ);
    const { cadence, score } = scoreGroup(g);
    return {
      id: g.name + '|' + (g.sign>0?'in':'out'),
      name: g.name,
      cadence,
      representative: rep,
      confidence: score,
      txCount: g.occ.length,
      kind: g.sign>0 ? 'inflow' : 'ember'
    };
  });
  const inflow = items.filter(x=>x.kind==='inflow').sort((a,b)=>b.confidence-a.confidence);
  const ember  = items.filter(x=>x.kind==='ember').sort((a,b)=>b.confidence-a.confidence);
  return { inflow: inflow.slice(0,5), ember: ember.slice(0,10) };
}
function stubAnalysis(){
  return {
    inflow: [
      { id:'emp',  name:'employer ltd',       cadence:'monthly',   representative:2900, confidence:0.92, txCount:12 },
      { id:'stip', name:'scholarship office', cadence:'monthly',   representative:450,  confidence:0.78, txCount:9  },
      { id:'side', name:'side income',        cadence:'quarterly', representative:300,  confidence:0.55, txCount:4  },
    ],
    ember: [
      { id:'rent',   name:'rent · oak estates', cadence:'monthly',   representative:1250, confidence:0.96, txCount:12 },
      { id:'ins',    name:'insurance · admiral',cadence:'yearly',    representative:144,  confidence:0.72, txCount:1  },
      { id:'phone',  name:'phone · vodafone',   cadence:'monthly',   representative:18,   confidence:0.88, txCount:12 },
      { id:'energy', name:'energy · octopus',   cadence:'monthly',   representative:110,  confidence:0.83, txCount:11 },
      { id:'council',name:'council tax',        cadence:'monthly',   representative:150,  confidence:0.85, txCount:10 },
      { id:'train',  name:'railcard',           cadence:'yearly',    representative:30,   confidence:0.60, txCount:1  },
      { id:'net',    name:'internet · bt',      cadence:'monthly',   representative:29.99,confidence:0.91, txCount:12 }
    ]
  };
}

// UI helpers
function el(tag, cls, text){ const n=document.createElement(tag); if(cls) n.className=cls; if(text) n.textContent=text; return n; }
function field(label, node){ const w=el('div','sr-field'); const l=el('label','',label); w.append(l,node); return w; }
function confBadge(score=0.5){
  const span = el('span','sr-badge');
  const t = score>=0.85 ? 'High' : score>=0.6 ? 'Medium' : 'Low';
  span.textContent = `Confidence: ${t}`;
  return span;
}
function buildReviewRow(group, kind /* 'inflow'|'ember' */){
  const row = el('div','ao-tile');

  const label = el('input','ao-input'); label.value = group.name || '';
  label.placeholder = kind==='inflow' ? 'Label (e.g., Salary)' : 'Label (e.g., Rent)';

  const cad = el('select','ao-select');
  FREQ_OPTIONS_FULL.forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v;o.textContent=t; cad.append(o); });
  cad.value = group.cadence || 'monthly';

  const monthly = el('div');
  const mval = el('div'); mval.style.font='700 16px system-ui';
  const msub = el('div'); msub.className='sr-sub';
  monthly.append(mval, msub);

  const include = document.createElement('input'); include.type='checkbox'; include.checked = true;
  const includeLbl = el('label','', 'Include');

  const kindSel = el('select','ao-select');
  [['inflow','Inflow'],['ember','Ember (outflow)'],['ignore','Ignore']].forEach(([v,t])=>{
    const o = document.createElement('option'); o.value=v; o.textContent=t; kindSel.append(o);
  });
  kindSel.value = kind;

  const lock = el('div','sr-sub'); lock.textContent = '🔒 amounts from bank data';
  const conf = confBadge(group.confidence ?? 0.5);

  function recalc(){
    const mon = toMonthly(group.representative || 0, cad.value);
    mval.textContent = GBP(mon) + '/mo';
    const base = `${GBP(group.representative || 0)} per ${CADENCE_LABELS[cad.value] || 'period'}`;
    msub.textContent = base + (group.txCount ? ` • ${group.txCount} hit${group.txCount>1?'s':''}` : '');
  }
  cad.addEventListener('change', recalc);
  recalc();

  const top = el('div'); top.style.display='grid'; top.style.gridTemplateColumns='1fr auto'; top.style.alignItems='center';
  const left = el('div'); left.append(label);
  const right = el('div'); right.append(conf);
  top.append(left,right);

  const grid = el('div'); grid.className='sr-row';
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
      monthly: toMonthly(group.representative || 0, cad.value),
      include: include.checked && kindSel.value!=='ignore',
      classAs: kindSel.value
    })
  };
}

// Reserve stretch mini-flow (only if no inflow accepted)
function renderReserveStretch(state, onDone){
  const host = state._host;
  host.innerHTML = '';
  const p = el('div','sr-info','We didn’t find a steady Source. You can stretch what you carry now over a few months.');
  const sel = el('select','ao-select');
  [['3','3 months'],['4','4 months'],['6','6 months']].forEach(([v,t])=>{
    const o=document.createElement('option'); o.value=v; o.textContent=t; sel.append(o);
  });
  sel.value = String(state.stretchMonths || 3);
  host.append(p, field('Stretch over', sel));

  state._backBtn.onclick = ()=> state._render(state.analysis, state); // back to review
  state._applyBtn.onclick = ()=>{
    state.stretchMonths = Number(sel.value || 3);
    if (!state.runwayAmount) {
      state.runwayAmount = Number(((state.incomeMonthly||0) * state.stretchMonths).toFixed(2));
    }
    state.incomeMonthly = Number((state.runwayAmount / state.stretchMonths).toFixed(2));
    onDone();
  };
}

// Main review renderer
function renderSmartReview(analysis, state = {}){
  ensureSmartReviewStyles();
  let wrap = document.getElementById('srWrap');
  if (!wrap){
    wrap = document.createElement('section');
    wrap.id = 'srWrap';
    wrap.innerHTML = `
      <h2>Smart Review</h2>
      <div class="sr-info">
        We analysed your recent transactions. Amounts are locked to bank data. You can rename, include/exclude,
        reclassify items, or adjust cadence to update the monthly equivalent. You can add missing bills later.
      </div>
      <div id="srContent"></div>
      <div class="sr-actions"><button id="srBack">Back</button><button id="srApply" class="primary">Apply & Continue</button></div>
    `;
    document.body.appendChild(wrap);
  }

  const host = wrap.querySelector('#srContent');
  const backBtn = wrap.querySelector('#srBack');
  const applyBtn= wrap.querySelector('#srApply');
  host.innerHTML='';

  // Store handles on state for sub-views
  state._host = host; state._backBtn = backBtn; state._applyBtn = applyBtn; state._render = renderSmartReview;

  const infoTop = el('div','sr-info','Confirm what applies to you (you can tweak later in the dashboard).');
  host.append(infoTop);

  // Inflows
  const inflowWrap = el('div');
  inflowWrap.append(el('h4','', 'Source (inflows)'));
  const inflowTop = (analysis.inflow || []).slice(0,3).map(g=>buildReviewRow(g,'inflow'));
  const inflowRest= (analysis.inflow || []).slice(3).map(g=>buildReviewRow(g,'inflow'));
  inflowTop.forEach(r => inflowWrap.append(r.node));
  let inflowExpanded = false;
  const inflowMoreBtn = (inflowRest.length>0) ? (()=>{
    const b = document.createElement('button'); b.textContent='Show more';
    b.onclick = ()=>{
      inflowExpanded = !inflowExpanded;
      if (inflowExpanded){ inflowRest.forEach(r => inflowWrap.append(r.node)); b.textContent = 'Show less'; }
      else { inflowRest.forEach(r => r.node.remove()); b.textContent = 'Show more'; }
    };
    return b;
  })(): null;
  if (inflowMoreBtn) inflowWrap.append(el('div','sr-more',''), inflowMoreBtn);

  // Ember
  const emberWrap = el('div');
  emberWrap.append(el('h4','', 'Ember (foundation outflows)'));
  const emberTop = (analysis.ember || []).slice(0,6).map(g=>buildReviewRow(g,'ember'));
  const emberRest= (analysis.ember || []).slice(6).map(g=>buildReviewRow(g,'ember'));
  emberTop.forEach(r => emberWrap.append(r.node));
  let emberExpanded = false;
  const emberMoreBtn = (emberRest.length>0) ? (()=>{
    const b = document.createElement('button'); b.textContent='Show more';
    b.onclick = ()=>{
      emberExpanded = !emberExpanded;
      if (emberExpanded){ emberRest.forEach(r => emberWrap.append(r.node)); b.textContent = 'Show less'; }
      else { emberRest.forEach(r => r.node.remove()); b.textContent = 'Show more'; }
    };
    return b;
  })(): null;
  if (emberMoreBtn) emberWrap.append(el('div','sr-more',''), emberMoreBtn);

  host.append(inflowWrap, emberWrap);

  // Back / Apply
  backBtn.onclick = ()=> { window.location.href = 'dashboard.html'; };
  applyBtn.onclick = async ()=>{
    const inflowRows = [...inflowTop, ...inflowRest];
    const emberRows  = [...emberTop,  ...emberRest];
    const inflowAccepted = inflowRows.map(r=>r.collect()).filter(x=>x.include && x.classAs==='inflow');
    const emberAccepted  = emberRows .map(r=>r.collect()).filter(x=>x.include && x.classAs==='ember');

    const incomeMonthly = Number(inflowAccepted.reduce((s,x)=> s + (x.monthly||0), 0).toFixed(2));
    const coreMonthly   = Number(emberAccepted .reduce((s,x)=> s + (x.monthly||0), 0).toFixed(2));

    const uid = getAuth().currentUser?.uid;
    if (uid){
      const incCats = {}; inflowAccepted.forEach(x=> incCats[x.label||x.id] = Number(x.monthly||0));
      const expCats = {}; emberAccepted .forEach(x=> expCats[x.label||x.id] = Number(x.monthly||0));
      await writeUnified(uid, 'income',   incomeMonthly, incCats);
      await writeUnified(uid, 'expenses', coreMonthly,   expCats);
      window.dispatchEvent(new CustomEvent('cashflow:updated', { detail:{ source:'smartReview' } }));
    }

    // Optional reserve path (if no steady inflow accepted)
    if (incomeMonthly <= 0){
      renderReserveStretch({ analysis, incomeMonthly, coreMonthly }, ()=> {
        window.location.href = 'dashboard.html';
      });
    } else {
      window.location.href = 'dashboard.html';
    }
  };

  wrap.style.display = 'block';
}

// Public: run Smart Review (real if possible; stub fallback)
export async function runSmartReviewFlow(opts = {}) {
  // opts: { useStub?:boolean, analysisOverride?:object }
  ensureSmartReviewStyles();
  const uid = getAuth().currentUser?.uid;
  let analysis = null;

  if (opts.analysisOverride) {
    analysis = opts.analysisOverride;
  } else if (!opts.useStub && uid) {
    try {
      const txs = await readRecentTransactions(uid, 365);
      if (txs && txs.length >= 10) analysis = buildAnalysisFromTxs(txs);
    } catch (e) {
      console.warn('SmartReview: real analysis failed; will use stub.', e);
    }
  }

  if (!analysis) analysis = stubAnalysis();
  renderSmartReview(analysis, { analysis });
  return true;
}
