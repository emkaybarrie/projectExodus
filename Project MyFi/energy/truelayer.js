// js/core/truelayer.js - CLIENT SIDE
// Centralised TrueLayer client helpers + RICH Smart Review UI (with stub fallback).

import { auth } from "../js/core/auth.js";
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
  const rawRedirect = new URL('energy/callback.html', window.location.href);
  rawRedirect.search = '';
  sessionStorage.setItem('tl_redirect_uri', rawRedirect.toString());

  const redirectUri = encodeURIComponent(rawRedirect.toString());
  const scope = encodeURIComponent("info accounts balance cards transactions direct_debits standing_orders offline_access");
  const state = encodeURIComponent(user.uid);
  const providers = encodeURIComponent("uk-cs-mock uk-ob-all uk-oauth-all");

  const { verifier, challenge } = await makePkce();
  sessionStorage.setItem('tl_code_verifier', verifier);
  localStorage.setItem('tl_code_verifier', verifier);

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

