/** 
 * vitals_v11.js
 * ---------------------------------------------------------------------------
 * Truth T = regenCurrent * daysSince(calculationStartDate)
 *           − (spentToDate + seedCarryIfApplicable)
 * ...
 * ---------------------------------------------------------------------------
 */

import {
  getFirestore, doc, getDoc, setDoc, collection, query, where,
  getDocs, orderBy, limit, onSnapshot, updateDoc, writeBatch, deleteDoc, startAfter
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { maybeStartVitalsTour} from "./vitalsTour.js";

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

// match your deployed region for callables
const functions = getFunctions(undefined, "europe-west2");

// Optional (safer) server source of truth for Essence monthly
export async function getEssenceAvailableMonthlyFromHUD(uid) {
  try {
    const fn = httpsCallable(functions, "vitals_getEssenceAvailableMonthly");
    const res = await fn();
    return Number(res?.data?.available || 0);
  } catch {
    return 0;
  }
}

// ── Debounced "lock on expiry" trigger + refresh snapshot ───────────────────
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Firestore normalizers
   ──────────────────────────────────────────────────────────────────────────── */
function normalizeTxn(docSnap) {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    amount: Number(d?.amount ?? 0), // negative = spend; positive = income
    dateMs: d?.dateMs ?? Date.now(),
    status: d?.status || "pending",
    source: d?.source ?? null,
    ghostExpiryMs: d?.ghostExpiryMs ?? 0,
    addedMs: d?.addedMs ?? d?.dateMs ?? Date.now(),
    provisionalTag: { pool: d?.provisionalTag?.pool ?? null, setAtMs: d?.provisionalTag?.setAtMs ?? null },
    tag:           { pool: d?.tag?.pool           ?? null, setAtMs: d?.tag?.setAtMs           ?? null },
    suggestedPool: d?.suggestedPool ?? null,
    rulesVersion:  d?.rulesVersion  ?? null,
    transactionData: {
      description: d?.transactionData?.description ?? "",
      entryDateMs: d?.transactionData?.entryDate?.toMillis?.() ?? null,
    },
    appliedAllocation: d?.appliedAllocation ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Seeding helpers
   ──────────────────────────────────────────────────────────────────────────── */
async function getVitalsMode(uid) {
  try {
    const p = await getDoc(doc(db, "players", uid));
    if (p.exists()) {
      const mode = String(p.data().vitalsMode || '').toLowerCase();
      if (['relaxed','standard','focused','true'].includes(mode)) return mode;
    }
  } catch (_) {}
  return 'standard';
}

/* ────────────────────────────────────────────────────────────────────────────
   3) Animated HUD — truth uses calc-start + carry
   ──────────────────────────────────────────────────────────────────────────── */

export async function initVitalsHUD(uid, timeMultiplier = 1) {

  // Vitals Tour remains unchanged
  maybeStartVitalsTour(uid);
}

// ── Surplus pill style toggle: "days" => "+11"; "dwm" => "+1M +2W +1D"
const SURPLUS_PILL_STYLE = "days";
function formatSurplusDWM(daysFloat) {
  const M_AVG = CORE_DAYS;
  let whole = Math.max(0, Math.floor(daysFloat));
  const M = Math.floor(whole / M_AVG); whole -= Math.floor(M * M_AVG);
  const W = Math.floor(whole / 7);     whole -= W * 7;
  const D = Math.floor(whole);
  const parts = [];
  if (M > 0) parts.push(`+${M}M`);
  if (W > 0) parts.push(`+${W}W`);
  if (D > 0 || parts.length === 0) parts.push(`+${D}D`);
  return parts.join(' ');
}
function surplusText(daysFloat) {
  if (SURPLUS_PILL_STYLE === "dwm") return formatSurplusDWM(daysFloat);
  return `+${Math.max(0, Math.floor(daysFloat))}`;
}

// UPDATED: expects *days* numbers; only shows in Core
function setSurplusPill(el, daysNow, daysAfter) {
  const pill = el.pill; if (!pill) return;

  const isCore = (getPrimaryMode() === 'core');

  const barEl = pill.closest('.bar');
  if (barEl) {
    const anyAfter = isCore && (Number(daysAfter || 0) > 0);
    barEl.classList.toggle('has-surplus', anyAfter);
  }

  const anyNow   = isCore && (Number(daysNow   || 0) > 0);
  const anyAfter = isCore && (Number(daysAfter || 0) > 0);

  if (!anyNow && !anyAfter) {
    pill.style.display = "none";
    pill.textContent = "";
    pill.classList.remove("with-next","pill-up","pill-down");
    return;
  }

  pill.style.display = "inline-flex";
  pill.classList.remove("pill-up","pill-down");

  const nowTxt = surplusText(daysNow);
  const aftTxt = surplusText(daysAfter);

  if (isCore && typeof daysAfter === "number" && typeof daysNow === "number" && daysAfter !== daysNow) {
    if (daysAfter > daysNow) pill.classList.add("pill-up"); else pill.classList.add("pill-down");
    pill.textContent = `${nowTxt} → ${aftTxt}`;
    pill.classList.add("with-next");
  } else {
    pill.textContent = nowTxt;
    pill.classList.remove("with-next");
  }
}

function ensureGridLayers(elements) {
  const vm = getViewMode();
  const days = (vm === 'core') ? CORE_DAYS : VIEW_FACTORS[vm];
  for (const p of Object.keys(elements)) {
    const bar = elements[p]?.fill?.closest('.bar'); if (!bar) continue;
    let grid = bar.querySelector('.bar-grid');
    if (!grid) {
      grid = document.createElement('div'); grid.className = 'bar-grid';
      bar.insertBefore(grid, elements[p].fill);
    }
    paintBarGrid(grid, days);
  }
}





