// vitals_harness.js
// Self-contained Node.js harness to verify the shape of current MyFi vitals math.
// Run:  node vitals_harness.js
// No external deps.

const MS_PER_DAY = 86_400_000;

function computePayCycleBounds(lastPayDateMs, nowMs) {
  const d0 = new Date(lastPayDateMs);
  let y = d0.getFullYear(), m = d0.getMonth(), day = d0.getDate();
  let cycleStart = new Date(y, m, day).getTime();
  while (true) {
    const next = new Date(y, m + 1, day).getTime();
    if (nowMs < next) {
      const cycleLen = Math.max(MS_PER_DAY, next - cycleStart);
      const frac = Math.max(0, Math.min(1, (nowMs - cycleStart) / cycleLen));
      const daysSince = Math.max(0, (nowMs - cycleStart) / MS_PER_DAY);
      return { cycleStartMs: cycleStart, nextCycleStartMs: next, cycleLenMs: cycleLen, cycleFrac: frac, daysSinceCycleStart: daysSince };
    }
    const nx = new Date(next);
    y = nx.getFullYear(); m = nx.getMonth();
    cycleStart = next;
  }
}

const MODE_SPEND_FACTOR = { relaxed: 0.70, standard: 0.80, focused: 0.90, true: 0.80 };

function computeSeedCurrentsAll({ regenBaseline, lastPayDateMs, nowMs, mode }) {
  const { cycleLenMs, cycleFrac } = computePayCycleBounds(lastPayDateMs, nowMs);
  const daysInCycle = cycleLenMs / MS_PER_DAY;
  const F = MODE_SPEND_FACTOR[mode] ?? 0.80;

  const toMax = (k) => regenBaseline[k] * daysInCycle;

  const Hmax = toMax('health'), Mmax = toMax('mana'), Smax = toMax('stamina'), Emax = toMax('essence');

  const desired = {
    health:  { current: Hmax,                                 max: Hmax },
    mana:    { current: Math.min(Mmax, Mmax - (Mmax * cycleFrac * F)), max: Mmax },
    stamina: { current: Math.min(Smax, Smax - (Smax * cycleFrac * F)), max: Smax },
    essence: { current: Math.max(0, Emax * cycleFrac),        max: Emax }
  };
  return { desired, daysInCycle, cycleFrac };
}

function buildSeedOffset({ regenCurrent, anchorMs, lastPayDateMs, desired }) {
  const { cycleStartMs } = computePayCycleBounds(lastPayDateMs, anchorMs);
  const daysUpToAnchor = Math.max(0, (anchorMs - cycleStartMs) / MS_PER_DAY);
  const pools = ['health','mana','stamina','essence'];
  const seedOffset = {};
  for (const k of pools) {
    const accrued = (regenCurrent[k] || 0) * daysUpToAnchor;
    const want = desired[k].current || 0;
    seedOffset[k] = Number((accrued - want).toFixed(2));
  }
  return { seedOffset, daysUpToAnchor };
}

function truth({ regenCurrent, elapsedDays, spentToDate, seedOffset }) {
  const pools = ['health','mana','stamina','essence'];
  const out = {};
  for (const k of pools) {
    const T = (regenCurrent[k] || 0) * elapsedDays - ((spentToDate[k] || 0) + (seedOffset[k] || 0));
    out[k] = Math.max(0, Number(T.toFixed(2)));
  }
  return out;
}

// ---- Demo scenario (matches the doc) ----
(function demo(){
  // Now: 10 Sep 12:00 of a 30-day cycle (1 Sep → 1 Oct)
  const now = new Date(2025, 8, 10, 12, 0, 0).getTime();     // months are 0-based
  const lastPayDateMs = new Date(2025, 8, 1, 0, 0, 0).getTime();

  // Baselines per day
  const regenBaseline = { health: 20, mana: 10, stamina: 15, essence: 5 };
  // (Start with regenCurrent == regenBaseline; trend nudges can be tested later)
  const regenCurrent = { ...regenBaseline };

  const mode = 'standard';
  const { desired, cycleFrac } = computeSeedCurrentsAll({ regenBaseline, lastPayDateMs, nowMs: now, mode });

  const anchorMs = now; // user just confirmed pay date (reset) now
  const { seedOffset, daysUpToAnchor } = buildSeedOffset({ regenCurrent, anchorMs, lastPayDateMs, desired });

  const { daysSinceCycleStart } = computePayCycleBounds(lastPayDateMs, anchorMs);
  const T_at_anchor = truth({
    regenCurrent,
    elapsedDays: daysSinceCycleStart,
    spentToDate: { health:0, mana:0, stamina:0, essence:0 },
    seedOffset
  });

  // Spend £50 stamina post-anchor and advance 0.1 day (~2.4h)
  const spentToDate = { health:0, mana:0, stamina:50, essence:0 };
  const elapsedLater = daysSinceCycleStart + 0.1;
  const T_after_spend = truth({ regenCurrent, elapsedDays: elapsedLater, spentToDate, seedOffset });

  function p(obj){ return JSON.stringify(obj, null, 2); }

  console.log('--- Demo: MyFi vitals harness ---');
  console.log('cycleFrac:', cycleFrac.toFixed(4));
  console.log('desired currents @now:', p({
    H: desired.health.current.toFixed(2),
    M: desired.mana.current.toFixed(2),
    S: desired.stamina.current.toFixed(2),
    E: desired.essence.current.toFixed(2),
  }));
  console.log('seedOffset:', p(seedOffset));
  console.log('Truth @anchor:', p(T_at_anchor)); // should equal desired currents
  console.log('Truth after £50 stamina & +0.1d:', p(T_after_spend));
})();
