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

/* ────────────────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────────────────── */
const MS_PER_DAY = 86_400_000;
const CORE_DAYS  = 30.44; // All-Time cycle
const CORE_LABEL = "Current"; // change to "Core" if preferred

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

// uid is available later; we bind it inside initVitalsHUD
let __triggerLockSoon = null;

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
  const db = getFirestore();
  const snap = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
  if (!snap.exists()) return;

  const cur = snap.data() || {};
  const pools = cur.pools || {};
  const elements = getVitalsElements();
  ensureGridLayers(elements);
  ensureReclaimLayers(elements);
  {
    const vm = getViewMode();
    installRatePeekHandlers(elements, pools, vm === 'core' ? 'core' : vm);
  }

  const days0   = Number(cur.elapsedDays || 0);
  const mode    = String(cur.mode || 'standard').toLowerCase();

  const seedOffset = cur.seedOffset || cur.seedCarry || {}; // legacy fallback
  const carryFor = (pool) => (mode === 'true' ? 0 : Number(seedOffset?.[pool] || 0));
  


  // STREAM-AWARE: only track pending tx from the active stream
  const desiredSource = (mode === 'true') ? 'truelayer' : 'manual';

  // Truth at t0
  const truth = {};
  const regenPerSec = {};
  for (const pool of Object.keys(pools)) {
    const v = pools[pool];
    truth[pool] = Math.max(
      0,
      (Number(v.regenCurrent || 0) * days0) - ((Number(v.spentToDate || 0)) + carryFor(pool))
    );
    regenPerSec[pool] = Number(v.regenCurrent || 0) * (timeMultiplier / 86_400);
  }

  // Bind the debounced locker to this user
  __triggerLockSoon = debounce(async () => {
    try {
      await lockExpiredOrOverflow(uid, 50);
      await refreshVitals();
    } catch (e) {
      console.warn("lock/refresh failed:", e);
    }
  }, 200);

  // Live ghosts (pending) — STREAM-AWARE QUERY
  let pendingTx = [];
  const pendingQ = query(
    collection(db, `players/${uid}/classifiedTransactions`),
    where("status", "==", "pending"),
    where("source", "==", desiredSource)
  );
  onSnapshot(pendingQ, (shot) => {
    pendingTx = shot.docs.map(d => {
      const x = d.data() || {};
      return {
        id: d.id,
        amount: Number(x.amount || 0),
        dateMs: x.dateMs || 0,
        ghostExpiryMs: x.ghostExpiryMs || 0,
        provisionalTag: x.provisionalTag || null,
        suggestedPool: x.suggestedPool || null,
        transactionData: { description: x?.transactionData?.description || '' },
      };
    });
  });

  window.addEventListener("vitals:locked", (e) => {
    const applied = e?.detail?.appliedTotals; if (!applied) return;
    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] - (Number(applied[p] || 0)));
    }
  });

  let viewMode = getViewMode(); // 'core' or Focus mode

  // ── Focus window caching (so we don’t query Firestore every animation frame)
  let focusSpend = { health:0, mana:0, stamina:0, essence:0 };
  let focusStart = 0, focusEnd = 0, focusDays = 1, lastFetchMs = 0;

  function getFocusPeriodBounds(mode /* 'daily' | 'weekly' */) {
    const now = new Date();
    let start, end;
    const m = String(mode).toLowerCase();
    if (m === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      end   = start + MS_PER_DAY;
    } else { // weekly
      const dow = (now.getDay() + 6) % 7; // 0=Mon
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
      start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
      end   = start + 7*MS_PER_DAY;
    }
    return [start, end];
  }


  async function fetchConfirmedSpendInRange(startMs, endMs) {
    const col = collection(db, `players/${uid}/classifiedTransactions`);
    const qy = query(
      col,
      where("status", "==", "confirmed"),
      where("source", "==", desiredSource),
      where("dateMs", ">=", startMs),
      where("dateMs", "<",  endMs),
      orderBy("dateMs", "asc")
    );
    const snap = await getDocs(qy);
    const sums = { health:0, mana:0, stamina:0, essence:0 };
    snap.forEach(d => {
      const x = d.data() || {};
      const alloc = x.appliedAllocation || {};
      sums.health  += Number(alloc.health  || 0);
      sums.mana    += Number(alloc.mana    || 0);
      sums.stamina += Number(alloc.stamina || 0);
      sums.essence += Number(alloc.essence || 0);
    });
    return {
      health:  Number(sums.health.toFixed(2)),
      mana:    Number(sums.mana.toFixed(2)),
      stamina: Number(sums.stamina.toFixed(2)),
      essence: Number(sums.essence.toFixed(2)),
    };
  }

  async function refreshFocusCacheIfNeeded() {
    if (viewMode === 'core') return;
    const [s, e] = getFocusPeriodBounds(viewMode);
    const stale = (Date.now() - lastFetchMs) > 15000 || s !== focusStart || e !== focusEnd;
    if (!stale) return;
    focusStart = s; focusEnd = e;
    focusDays = Math.max(1, (e - s) / MS_PER_DAY);
    focusSpend = await fetchConfirmedSpendInRange(s, e);
    lastFetchMs = Date.now();
    repaintEngravingLabels(); // keep "Focus: X" label feeling live
  }

  // Background refresh for Focus period numbers
  setInterval(() => { refreshFocusCacheIfNeeded(); }, 5000);
  await refreshFocusCacheIfNeeded();

  // Ghost preview helpers (unchanged)
  function allocateSpendAcrossPools(spend, intent, availTruth) {
    const out = { health:0, mana:0, stamina:0, essence:0 };
    if (spend <= 0) return out;
    if (intent === "mana") {
      const toMana = Math.min(spend, Math.max(0, availTruth.mana));
      if (toMana > 0) { out.mana += toMana; availTruth.mana -= toMana; }
      const leftover = spend - toMana;
      if (leftover > 0) out.health += leftover;
      return out;
    }
    const toStamina = Math.min(spend, Math.max(0, availTruth.stamina));
    if (toStamina > 0) { out.stamina += toStamina; availTruth.stamina -= toStamina; }
    const toHealth = spend - toStamina;
    if (toHealth > 0) out.health += toHealth;
    return out;
  }

  function applyRemainderFirst(T, cap, L) {
    if (cap <= 0) return { rNow:0, sNow:0, rAfter:0, sAfter:0, ghostLeftPct:0, ghostWidthPct:0 };
    const sNow = Math.floor(T / cap);
    const rNow = T - sNow * cap;

    if (L <= 0.000001) {
      return { rNow, sNow, rAfter: rNow, sAfter: sNow, ghostLeftPct:0, ghostWidthPct:0 };
    }
    if (L <= rNow) {
      const rAfter = rNow - L;
      return {
        rNow, sNow, rAfter, sAfter: sNow,
        ghostLeftPct: (rAfter / cap) * 100,
        ghostWidthPct: (L / cap) * 100,
      };
    }

    let Lleft = L - rNow;
    let s     = sNow;
    let r     = 0;

    if (s > 0) {
      const whole = Math.min(s, Math.floor(Lleft / cap));
      if (whole > 0) { s -= whole; Lleft -= whole * cap; }
    }
    if (Lleft > 0 && s > 0) { s -= 1; r = cap; }
    const rAfter = Math.max(0, r - Lleft);
    const ghostLeftPct  = (rAfter / cap) * 100;
    const ghostWidthPct = ((r - rAfter) / cap) * 100;
    return { rNow, sNow, rAfter, sAfter: s, ghostLeftPct, ghostWidthPct };
  }

  let last = null;

  // Delay ghost overlay until base bars have painted once
  let allowGhostOverlay = false;
  function enableGhostOverlaySoon() {
    if (!allowGhostOverlay) setTimeout(() => (allowGhostOverlay = true), 60);
  }

  function frame(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;

    for (const p of Object.keys(truth)) {
      truth[p] = Math.max(0, truth[p] + regenPerSec[p] * dt);
    }

    const availTruth = { ...truth };
    let pendingTotals = { health:0, mana:0, stamina:0, essence:0 };
    const now = Date.now();
    const ordered = [...pendingTx].sort((a,b)=>a.dateMs - b.dateMs);

    window.__myfi_lastTickSec ??= 0;
    const sec = Math.floor(now / 1000);
    if (sec !== window.__myfi_lastTickSec) {
      window.__myfi_lastTickSec = sec;
      const ticks = ordered.map(tx => ({
        id: tx.id,
        seconds: Math.max(0, Math.ceil((tx.ghostExpiryMs - now) / 1000))
      }));
      window.dispatchEvent(new CustomEvent("tx:expiry-tick", { detail: { ticks } }));
    }

    let hasLocalExpiry = false;
    for (const tx of ordered) {
      const ttl = (tx.ghostExpiryMs - now);
      if (ttl <= 0) { hasLocalExpiry = true; continue; }
      if (tx.amount >= 0) continue;
      const spend  = Math.abs(tx.amount);
      const intent = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');
      const split  = allocateSpendAcrossPools(spend, intent, availTruth);
      pendingTotals = {
        health:  pendingTotals.health  + (split.health  || 0),
        mana:    pendingTotals.mana    + (split.mana    || 0),
        stamina: pendingTotals.stamina + (split.stamina || 0),
        essence: pendingTotals.essence + (split.essence || 0),
      };
    }

    if (hasLocalExpiry && __triggerLockSoon) __triggerLockSoon();

    const vmLocal = viewMode;

    // Focus view: make sure spend cache is fresh-ish
    if (vmLocal !== 'core') { refreshFocusCacheIfNeeded(); }

    let sumCurrent = 0;
    let sumMax = 0;

    for (const pool of Object.keys(pools)) {
      const el = elements[pool]; if (!el) continue;
      const v  = pools[pool];

      if (vmLocal === 'core') {
        // All-Time core – 30.44 model + pills + ghost overlay
        const cap = (Number(v.regenBaseline || 0)) * CORE_DAYS || 0;
        const T = truth[pool];
        const L = pendingTotals[pool] || 0;

        const proj = applyRemainderFirst(T, cap, L);

        const useProjected = allowGhostOverlay && cap > 0 && L > 0.0001 && proj.ghostWidthPct > 0.01;
        const pct = cap > 0 ? ((useProjected ? proj.rAfter : proj.rNow) / cap) * 100 : 0;
        el.fill.style.width = `${pct}%`;

        const normalText = `${proj.rAfter.toFixed(2)} / ${cap.toFixed(2)}`;
        const showRate = el.value.classList.contains('is-rate');
        const rateText = el.value.__rateText || normalText;
        el.value.innerText = showRate ? rateText : normalText;
        enableGhostOverlaySoon();

        const daily = Number(v.regenBaseline || 0);
        const T_now   = (proj.sNow   * cap) + proj.rNow;
        const T_after = (proj.sAfter * cap) + proj.rAfter;
        const surplusNowDays   = daily > 0 ? Math.floor(Math.max(0, (T_now   - cap)) / daily) : 0;
        const surplusAfterDays = daily > 0 ? Math.floor(Math.max(0, (T_after - cap)) / daily) : 0;
        setSurplusPill(el, surplusNowDays, surplusAfterDays);

        const barEl = el.fill.closest('.bar');
        const reclaimEl = barEl.querySelector('.bar-reclaim');
        const showGhost = allowGhostOverlay && cap > 0 && L > 0.0001 && proj.ghostWidthPct > 0.01;
        if (showGhost) {
          reclaimEl.style.left    = `${Math.max(0, Math.min(100, proj.ghostLeftPct)).toFixed(2)}%`;
          reclaimEl.style.width   = `${Math.max(0, Math.min(100, proj.ghostWidthPct)).toFixed(2)}%`;
          reclaimEl.style.opacity = '1';
        } else {
          reclaimEl.style.opacity = '0';
          reclaimEl.style.width   = '0%';
        }

        if (pool === 'health' || pool === 'mana' || pool === 'stamina') {
          sumCurrent += useProjected ? proj.rAfter : proj.rNow;
          sumMax     += cap;
        }
      } else {
        // Focus (Daily/Weekly/Monthly)
        const daysInPeriod = focusDays || VIEW_FACTORS[vmLocal];
        const cap   = (Number(v.regenBaseline || 0)) * daysInPeriod || 0;
        const spent = Number(focusSpend?.[pool] || 0);

        // Remaining before ghosts
        let current = cap - spent;
        if (!Number.isFinite(current)) current = 0;
        current = Math.max(0, Math.min(cap, current));

        const pct = cap > 0 ? (current / cap) * 100 : 0;
        el.fill.style.width = `${pct}%`;

        const normalText = `${current.toFixed(2)} / ${cap.toFixed(2)}`;
        const showRate = el.value.classList.contains('is-rate');
        const rateText = el.value.__rateText || normalText;
        el.value.innerText = showRate ? rateText : normalText;

        // Hide pills in Focus
        setSurplusPill(el, 0, 0);

        // SHOW reclaim overlay in Focus (simple clip – no wrap)
        const barEl = el.fill.closest('.bar');
        const reclaimEl = barEl.querySelector('.bar-reclaim');
        if (reclaimEl) {
          const L = Math.max(0, Number(pendingTotals[pool] || 0));
          if (cap > 0 && L > 0.0001 && current > 0.0001) {
            // amount of current that would be eaten by pending
            const eat = Math.min(L, current);
            const leftPct  = ((current - eat) / cap) * 100;
            const widthPct = (eat / cap) * 100;
            reclaimEl.style.left    = `${Math.max(0, Math.min(100, leftPct)).toFixed(2)}%`;
            reclaimEl.style.width   = `${Math.max(0, Math.min(100, widthPct)).toFixed(2)}%`;
            reclaimEl.style.opacity = '1';
          } else {
            reclaimEl.style.opacity = '0';
            reclaimEl.style.width   = '0%';
          }
        }

        if (pool === 'health' || pool === 'mana' || pool === 'stamina') {
          sumCurrent += current;
          sumMax     += cap;
        }

      }

      // Trend colouring (shared)
      const barEl = el.fill.closest('.bar');
      barEl.classList.remove("overspending","underspending");
      if (v.trend === "overspending")  barEl.classList.add("overspending");
      if (v.trend === "underspending") barEl.classList.add("underspending");
    }

    setVitalsTotals(sumCurrent, sumMax);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("vitals:viewmode", (e) => {
    const raw = e?.detail?.mode || "daily";
    viewMode = (raw === 'core' || VIEW_MODES.includes(raw)) ? raw : "daily";
    allowGhostOverlay = false;
    enableGhostOverlaySoon();
    refreshBarGrids();
    updateRatePeekTexts(elements, pools, viewMode === 'core' ? 'core' : viewMode);
    repaintEngravingLabels();
    // Refresh focus window immediately when switching into focus
    if (viewMode !== 'core') { lastFetchMs = 0; refreshFocusCacheIfNeeded(); }
  });

  window.addEventListener("vitals:primary", () => {
    const vmNow = getViewMode();
    refreshBarGrids();
    updateRatePeekTexts(elements, pools, vmNow === 'core' ? 'core' : vmNow);
    repaintEngravingLabels();
    if (vmNow !== 'core') { lastFetchMs = 0; refreshFocusCacheIfNeeded(); }
  });

  // Vitals Tour remains unchanged
  maybeStartVitalsTour(uid);
}


/* ────────────────────────────────────────────────────────────────────────────
   Update Log wiring
   ──────────────────────────────────────────────────────────────────────────── */
export function autoInitUpdateLog() {
  const listEl   = document.querySelector("#update-log-list");
  const recentEl = document.querySelector("#recently-locked-list");
  if (!listEl && !recentEl) return;

  const auth = getAuth();
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const uid = user.uid;

    const mode = await getVitalsMode(uid); // relaxed|standard|focused|true
    const desiredSource = (mode === 'true') ? 'truelayer' : 'manual';

    function setActiveButtons(li, pool) {
      const buttons = li.querySelectorAll(".tag-btn");
      buttons.forEach(b => {
        b.classList.remove("active", "stamina", "mana");
        if (b.dataset.pool === pool) b.classList.add("active", pool);
      });
    }

    if (listEl) {
      listenUpdateLogPending(uid, (items) => {
        const allowed = new Set([desiredSource, "stripe", "manual_bank"]);
        const filtered = items.filter(x => allowed.has(x.source));

        listEl.innerHTML = "";
        if (!filtered.length) {
          const li = document.createElement("li");
          li.textContent = "Nothing pending — nice!";
          listEl.appendChild(li);
          return;
        }

        filtered.forEach(tx => {
          const li = document.createElement("li");
          li.setAttribute('data-tx', tx.id);

          const isContribution = (tx.source === "stripe" || tx.source === "manual_bank");

          const nowMs    = Date.now();
          const hasTTL   = Number.isFinite(Number(tx.ghostExpiryMs));
          const secsLeft = hasTTL ? Math.max(0, Math.floor((Number(tx.ghostExpiryMs) - nowMs) / 1000)) : 0;
          const minLeft  = Math.floor(secsLeft / 60);
          const secLeft  = secsLeft % 60;

          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);

          const tag = tx.provisionalTag?.pool ?? "stamina";
          const actionsHtml = isContribution
            ? `
              <div class="ul-actions one">
                <span class="badge essence" title="Essence">Essence</span>
              </div>
            `
            : `
              <div class="ul-actions two">
                <button class="tag-btn" data-pool="mana"     title="Mana"     aria-label="Mana">M</button>
                <button class="tag-btn" data-pool="stamina"  title="Stamina"  aria-label="Stamina">S</button>
              </div>
            `;

          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">
                  £${amt} • <span class="countdown">${minLeft}m ${secLeft}s</span> • ${isContribution ? "essence" : tag}
                </div>
              </div>
              ${actionsHtml}
            </div>
          `;

          if (!isContribution) {
            setActiveButtons(li, tag);
            li.querySelectorAll(".tag-btn").forEach(btn => {
              btn.addEventListener("click", async () => {
                const pool = btn.getAttribute("data-pool");
                setActiveButtons(li, pool);
                await setProvisionalTag(uid, tx.id, pool);
              });
            });

            const mainEl = li.querySelector('.ul-main');
            if (mainEl) {
              onLongPress(mainEl, () => {
                mountTxInlineEditor(li, tx, { uid, onDone: () => {} });
              });
            }
          }

          listEl.appendChild(li);
        });
      });

      window.addEventListener("tx:expiry-tick", (e) => {
        const ticks = e?.detail?.ticks || [];
        for (const { id, seconds } of ticks) {
          const row = listEl?.querySelector(`li[data-tx="${id}"]`);
          if (!row) continue;
          const span = row.querySelector(".countdown");
          if (!span) continue;
          const s = Math.max(0, (Number(seconds) || 0));
          const m = Math.floor(s / 60);
          const r = s % 60;
          span.textContent = `${m}m ${r}s`;
        }
      });
    }

    if (recentEl) {
      listenRecentlyConfirmed(uid, 24 * 60 * 60 * 1000, (items) => {
        const allowed = new Set([desiredSource, 'stripe', 'manual_bank']);
        const filtered = items.filter(x => allowed.has(x.source));

        recentEl.innerHTML = "";
        if (!filtered.length) {
          const li = document.createElement("li");
          li.textContent = "No recent locks.";
          recentEl.appendChild(li);
          return;
        }

        filtered.forEach(tx => {
          const li = document.createElement("li");
          const intentPool = tx.tag?.pool ?? "stamina";
          const name = tx.transactionData?.description || "Transaction";
          const amt  = Number(tx.amount).toFixed(2);
          const when = tx.tag?.setAtMs ? new Date(tx.tag.setAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          const alloc = tx.appliedAllocation || null;
          let badgesHtml = "";

          if (alloc && typeof tx.amount === "number" && tx.amount < 0) {
            const entries = Object.entries(alloc).filter(([_, v]) => Number(v) > 0);
            const poolOrder = ["stamina","mana","health","essence"];
            entries.sort((a, b) => {
              const [pa, va] = a, [pb, vb] = b;
              if (pa === intentPool && pb !== intentPool) return -1;
              if (pb === intentPool && pa !== intentPool) return 1;
              if (vb !== va) return Number(vb) - Number(va);
              return poolOrder.indexOf(pa) - poolOrder.indexOf(pb);
            });
            badgesHtml = entries.map(([p, v]) => {
              const n = Number(v).toFixed(2);
              return `<span class="badge ${p}" title="${p}: £${n}">${p}</span>`;
            }).join(" ");
          } else {
            badgesHtml = `<span class="badge ${intentPool}">${intentPool}</span>`;
          }

          li.innerHTML = `
            <div class="ul-row">
              <div class="ul-main">
                <strong>${name}</strong>
                <div class="ul-meta">£${amt} • ${when} ${badgesHtml}</div>
              </div>
            </div>
          `;
          recentEl.appendChild(li);
        });
      });
    }

    setInterval(() => lockExpiredOrOverflow(uid, 50), 20_000);
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   DOM helpers
   ──────────────────────────────────────────────────────────────────────────── */
function getVitalsElements() {
  const pools = ["health","mana","stamina","essence"];
  const map = {};
  for (const p of pools) {
    const root = document.querySelector(`#vital-${p}`);
    const fill = root?.querySelector('.bar-fill');
    const val  = root?.querySelector('.bar-value');
    const label= root?.querySelector('.bar-label');
    const pill = root?.querySelector('.bar-surplus');
    if (fill && val && label && pill) map[p] = { fill, value: val, label, pill };
  }
  return map;
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





