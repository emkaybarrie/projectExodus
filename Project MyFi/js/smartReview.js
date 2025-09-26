// js/smartreview.js
// Very small client fetcher that asks backend for analysis and forwards selections back.
// UI code can import these and render however you like.

import { auth } from './core/auth.js';

const REGION = 'europe-west2';
const BASE = `https://${REGION}-${location.hostname.includes('localhost') ? 'myfi-app-7fa78' : 'myfi-app-7fa78'}.cloudfunctions.net`;
// ^ if you have a different project id for local vs prod, tweak the ternary.

async function authedFetch(url, opts = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const idToken = await user.getIdToken();
  const headers = { ...(opts.headers||{}), Authorization: `Bearer ${idToken}` };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { ok:false, parseError:true, text }; }
  if (!res.ok || json?.ok === false) {
    console.warn('[SR][client] request failed', { url, status: res.status, body: json });
    throw Object.assign(new Error('smart_review_failed'), { status: res.status, body: json });
  }
  return json;
}

export async function srAnalyze(params = {}) {
  const qs = new URLSearchParams();
  if (params.monthsLookback) qs.set('monthsLookback', String(params.monthsLookback));
  if (params.groupingCutoffMonths) qs.set('groupingCutoffMonths', String(params.groupingCutoffMonths));
  const url = `${BASE}/smartReview_analyze?${qs.toString()}`;
  const data = await authedFetch(url);
  console.log('[SR][client] analyze →', data);
  return data;
}

export async function srSave(payload) {
  const url = `${BASE}/smartReview_save`;
  const data = await authedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload || {})
  });
  console.log('[SR][client] save →', data);
  return data;
}

export async function srAutoBackfill(anchorSinceMs, includeAlreadyTagged = false) {
  const url = `${BASE}/smartReview_autobackfill`;
  const data = await authedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ anchorSinceMs, includeAlreadyTagged })
  });
  console.log('[SR][client] autobackfill →', data);
  return data;
}
