// js/data/maintenance.js
// Client-side front for vitals reset (now delegates to server).
// - Lets the server:
//   * set pay date (lastPayDateMs)
//   * set anchor (lastPaySavedAtMs = now on server)
//   * optionally delete txns (all|before_anchor|none)
//   * recompute summary + vitals (incl. True-mode flatten)

import { firebaseApp as app, auth, db, functions as fns } from '../../ProjectMyFi_vExperimental/src/core/firestore.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

const REGION = "europe-west2";
const functions = getFunctions(undefined, REGION);

// optional helper if you want to keep a callable-only path in future
async function callVitalsSnapshot() {
  try {
    const fn = httpsCallable(functions, 'vitals_getSnapshot');
    await fn();
  } catch (e) {
    console.warn('[resetVitalsToNow] vitals_getSnapshot failed (non-fatal):', e);
  }
}

/**
 * resetVitalsToNow
 * @param {{
 *   uid?: string,
 *   anchorDateMs?: number|null,     // if null → server will use NOW as anchor; payDateMs still required
 *   setAnchorToToday?: boolean,     // deprecated (ignored here)
 *   deletePolicy?: 'all'|'before_anchor'|'none'  // default 'all'
 * }} opts
 */
export async function resetVitalsToNow(opts = {}) {
  const uid = auth?.currentUser?.uid ?? opts.uid;
  if (!uid) throw new Error('Not signed in.');

  const deletePolicy = (opts.deletePolicy === 'before_anchor' || opts.deletePolicy === 'none')
    ? opts.deletePolicy : 'all';

  // We treat anchorDateMs (user's "Last Pay Day" choice) as the **payDateMs** param.
  // The server sets **anchor** (lastPaySavedAtMs) to its current time.
  const payDateMs = Number.isFinite(opts.anchorDateMs) ? Number(opts.anchorDateMs) : null;

  if (!Number.isFinite(payDateMs)) {
    // If caller didn't provide, you *can* decide to fall back to "today midnight" here,
    // but the Settings dialog always sends a concrete ms. We'll guard anyway:
    const today = new Date();
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    console.warn('[resetVitalsToNow] no anchorDateMs provided; falling back to today midnight.');
    return await hitResetEndpoint(uid, midnight, deletePolicy);
  }

  const res = await hitResetEndpoint(uid, payDateMs, deletePolicy);

  // As a courtesy, poke vitals snapshot (not strictly required, server already recomputed)
  try { await callVitalsSnapshot(); } catch {}

  return res;
}

async function hitResetEndpoint(uid, payDateMs, deletePolicy) {
  const base = `https://europe-west2-${location.hostname.includes('localhost') ? 'myfi-app-7fa78' : 'myfi-app-7fa78'}.cloudfunctions.net`;
  const url = new URL(`${base}/maintenanceResetPayCycle`);
  url.searchParams.set('uid', uid);
  url.searchParams.set('payDateMs', String(payDateMs));
  url.searchParams.set('delete', deletePolicy); // 'all' | 'before_anchor' | 'none'

  const r = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok || j?.error) {
    const msg = j?.details || j?.error || `HTTP ${r.status}`;
    throw new Error(`Reset failed: ${msg}`);
  }
  return j;
}
