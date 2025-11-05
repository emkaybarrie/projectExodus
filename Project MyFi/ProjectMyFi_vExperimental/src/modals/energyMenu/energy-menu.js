// src/menus/energy/energy-menu.js

// Use your project Firebase instance
import { auth, db, waitForAuthUser } from '../../core/firestore.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Call the two menu openers (now modal-based after our tiny patches)
import { openEnergyVerified }   from './energy-verified.js';
import { openEnergyUnverified } from './energy-unverified.js';

// ─────────────────────────────────────────────────────────────
// Keep this helper: used by both verified/unverified files to scope CSS
export function scopeCSS(rawCss, rootId) {
  const root = `#${rootId}`;

  // stash @keyframes so we don’t rewrite "from/to/0%" selectors
  const kf = [];
  let css = rawCss.replace(/@keyframes[\s\S]*?\}\s*\}/g, m => {
    const t = `__KF_${kf.length}__`; kf.push(m); return t;
  });

  // localize :root + html,body to our overlay root
  css = css.replace(/\:root\b/g, root).replace(/\bhtml\s*,\s*body\b/g, root);

  // prefix all non-@ rules with the overlay root (unless already prefixed)
  css = ('}' + css).replace(/\}\s*([^@{}][^{]*)\{/g, (_, sel) => {
    const parts = sel.split(',').map(s => s.trim()).filter(Boolean).map(s => {
      return s.startsWith(root) ? s : `${root} ${s}`;
    });
    return `}${parts.join(', ')}{`;
  }).slice(1);

  // restore keyframes
  kf.forEach((m, i) => { css = css.replace(`__KF_${i}__`, m); });
  return css;
}

// Normalize players/{uid}.transactionMode
function normalizeMode(val) {
  if (val === true) return 'verified';
  const s = String(val || '').toLowerCase().trim();
  return (s === 'true' || s === 'verified') ? 'verified' : 'unverified';
}

/** Open the right Energy menu for the current user. */
export async function openEnergyMenu() {
  const u = (await waitForAuthUser()) || auth.currentUser;
  if (!u?.uid) { console.warn('[EnergyMenu] No user'); return; }

  let mode = 'unverified';
  try {
    const snap = await getDoc(doc(db, `players/${u.uid}`));
    mode = normalizeMode(snap.exists() ? snap.data()?.transactionMode : null);
  } catch (e) {
    console.warn('[EnergyMenu] Could not read players/{uid}.transactionMode; defaulting to unverified.', e);
  }

  // Modal opening is handled inside each menu file after the small patches
  return mode === 'verified' ? openEnergyVerified() : openEnergyUnverified();
}

// Optional helpers:
export async function openEnergyVerifiedMenu()   { return openEnergyVerified(); }
export async function openEnergyUnverifiedMenu() { return openEnergyUnverified(); }
