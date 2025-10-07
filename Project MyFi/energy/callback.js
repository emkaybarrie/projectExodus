// js/callback.js
import { auth } from '../js/core/auth.js';
import { triggerTrueLayerFetch, renderLegalLinks } from './truelayer.js';
import { showSmartReviewAfterTrueLayer } from './energy-verified.js';

// ----- DOM -----
const overlay      = document.getElementById('syncOverlay');
const legalHost    = document.getElementById('legal-links');
const stepsList    = document.getElementById('stepsList');
const statusEl     = document.getElementById('syncStatus');
const fill         = document.getElementById('progressFill');
const errorBox     = document.getElementById('errorBox');
const restartBtn   = document.getElementById('restartBtn');
const retryBtn     = document.getElementById('retryBtn');
const continueBtn  = document.getElementById('continueBtn');

if (legalHost) legalHost.innerHTML = renderLegalLinks();

// ----- Helpers -----
function renderSteps() {
  const steps = [
    { key: 'Accounts',       label: 'Accounts' },
    { key: 'Cards',          label: 'Cards' },
    { key: 'Transactions',   label: 'Transactions' },
    { key: 'DirectDebits',   label: 'Direct Debits' },
    { key: 'StandingOrders', label: 'Standing Orders' },
  ];
  stepsList.innerHTML = '';
  steps.forEach((s, i) => {
    const li = document.createElement('li');
    li.id = `step-${i}`;
    li.dataset.key = s.key;
    li.className = 'pending';
    li.innerHTML = `
      <span class="badge"></span>
      <span class="label">${s.label}</span>
      <span class="hint" id="hint-${i}">Queued</span>
    `;
    stepsList.appendChild(li);
  });
  return steps;
}

function setStepState(i, state, hint) {
  const li = document.getElementById(`step-${i}`);
  const hintEl = document.getElementById(`hint-${i}`);
  if (!li) return;
  li.className = state;
  hintEl.textContent = hint || (
    state === 'running' ? 'Fetching…' :
    state === 'done'    ? 'Done' :
    state === 'fail'    ? 'Failed' : 'Queued'
  );
  const doneCount = [...stepsList.children].filter(
    n => n.className === 'done' || n.className === 'fail'
  ).length;
  fill.style.width = Math.round((doneCount / stepsList.children.length) * 100) + '%';
}

// Mobile-safe PKCE & redirect retrieval
function getWithFallback(key, def = '') {
  // Prefer sessionStorage; fall back to localStorage (mobile returns)
  return sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? def;
}
function setFallback(key, val) {
  try { sessionStorage.setItem(key, val); } catch {}
  try { localStorage.setItem(key, val); } catch {}
}

// Wait for Firebase auth (but do not stall the UI)
async function waitForAuthUser(timeoutMs = 8000) {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    let settled = false;
    const t = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, timeoutMs);
    const unsub = auth.onAuthStateChanged
      ? auth.onAuthStateChanged((u) => {
          if (!settled) { settled = true; clearTimeout(t); unsub(); resolve(u || null); }
        })
      : () => resolve(null);
  });
}

// ----- Flow -----
async function exchangeCodeForTokens(code, uid) {
  const savedRedirect = getWithFallback('tl_redirect_uri', location.origin + location.pathname);
  const code_verifier = getWithFallback('tl_code_verifier', '');
  if (!code_verifier) {
    // Surface a meaningful error (this was silently swallowed before)
    throw Object.assign(new Error('Missing PKCE code_verifier'), { code: 'no_verifier' });
  }
  // Persist again (helps any future retries on mobile)
  setFallback('tl_redirect_uri', savedRedirect);
  setFallback('tl_code_verifier', code_verifier);

  // Prefer ID token; if user not yet ready, try again shortly (mobile).
  let user = await waitForAuthUser(6000);
  if (!user) {
    // Try one more time quickly—auth sometimes races right after redirect.
    user = await waitForAuthUser(2000);
  }
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'no_user' });
  const idToken = await user.getIdToken();

  const r = await fetch('https://exchangetoken-frxqsvlhwq-nw.a.run.app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
    body: JSON.stringify({ code, uid, redirect_uri: savedRedirect, code_verifier })
  });
  const raw = await r.text();
  let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!r.ok || data?.error || data?.success === false) {
    throw Object.assign(new Error('Token exchange failed'), { code: 'exchange_fail', details: data, status: r.status });
  }
  return true;
}

async function runFullSync() {
  const steps = renderSteps();
  statusEl.textContent = 'Syncing your bank data…';

  for (let i = 0; i < steps.length; i++) {
    setStepState(i, 'running');
    try {
      await triggerTrueLayerFetch(steps[i].key);
      setStepState(i, 'done');
    } catch (err) {
      console.error(`Step ${steps[i].label} failed`, err);
      setStepState(i, 'fail', 'Failed');
      statusEl.textContent = `Something failed on "${steps[i].label}".`;
      errorBox.style.display = 'block';
      errorBox.textContent = 'We hit a snag fetching some items. You can retry, or continue and review data later.';
      retryBtn.style.display = 'inline-flex';
      continueBtn.style.display = 'inline-flex';
      return false;
    }
  }
  return true;
}

async function main() {
  overlay.style.display = 'flex';        // show UI immediately on mobile too

  // Parse redirect params
  const p = new URLSearchParams(location.search);
  const code = p.get('code');
  const uid  = p.get('state');
  if (!(code && uid)) {
    statusEl.textContent = 'Invalid redirect. Missing information from your bank.';
    errorBox.style.display = 'block';
    errorBox.textContent = 'Please restart the connection.';
    restartBtn.style.display = 'inline-flex';
    return;
  }

  // Try token exchange
  statusEl.textContent = 'Exchanging secure token…';
  try {
    await exchangeCodeForTokens(code, uid);
  } catch (e) {
    console.error('Token exchange error', e?.code || '', e?.details || e);
    statusEl.textContent = 'We could not complete the secure hand-off.';
    errorBox.style.display = 'block';
    errorBox.textContent = (e?.code === 'no_verifier')
      ? 'Your browser cleared a small security token during redirect (common on mobile). Please restart the connection.'
      : 'There was a problem completing the secure hand-off. Please try again.';
    restartBtn.style.display = 'inline-flex';
    return;
  }

  // Full sync sequence
  const ok = await runFullSync();

  // Navigate → dashboard and open Smart Review (real or stub)
  continueBtn.onclick = () => {
    overlay.style.display = 'none';
    showSmartReviewAfterTrueLayer();
    window.location.href = 'dashboard.html';
  };
  restartBtn.onclick = () => { window.location.href = 'dashboard.html'; };
  retryBtn.onclick   = async () => { await main(); };

  if (ok) {
    overlay.style.display = 'none';
    showSmartReviewAfterTrueLayer();
    window.location.href = '../dashboard.html';
  }
}

main().catch(err => {
  console.error('Callback fatal', err);
  statusEl.textContent = 'Unexpected error.';
  errorBox.style.display = 'block';
  errorBox.textContent = 'Please restart the connection.';
  restartBtn.style.display = 'inline-flex';
});
