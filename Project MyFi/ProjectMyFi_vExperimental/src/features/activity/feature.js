/**
 * Feature Pack: activity
 * Responsibility:
 * - Build an "events feed" model from current app state (VM + gateway snapshot).
 *
 * It returns plain objects describing feed items; UI decides how to render them.
 * This keeps your Events Log predictable, testable, and backend-migration-ready.
 */
function item(icon, title, body, tone = 'neutral') {
  return { icon, title, body, tone };
}

function trendHint(vm) {
  const tH = vm?.bars?.health?.trend || 'stable';
  const tM = vm?.bars?.mana?.trend || 'stable';
  const tS = vm?.bars?.stamina?.trend || 'stable';

  // These labels depend on your VM; adjust as needed.
  const overs = [tM, tS].includes('overspending');
  const unders = [tM, tS].includes('underspending');

  if (overs) return item('⚠️', 'Spending pressure', 'Mana/Stamina burn rate is above baseline.', 'warn');
  if (unders) return item('✨', 'Good pacing', 'You’re running below baseline burn this week.', 'good');
  return item('🧭', 'On course', 'Vitals are tracking close to baseline.', 'neutral');
}

function shieldHint(vm) {
  const pct = Number(vm?.bars?.shield?.widthPct || 0);
  if (pct > 0) return item('🛡️', 'Shield active', 'Overflow is buffering your next hits.', 'good');
  return null;
}

function essenceHint(vm) {
  const text = vm?.bars?.essence?.text;
  if (!text) return null;
  return item('⦿', 'Essence', `Current: ${text}`, 'neutral');
}

function escrowHint(gw) {
  const by = gw?.meta?.escrow?.carry?.bySource;
  if (!by) return null;

  const h = Math.round(Number(by.health || 0));
  const m = Math.round(Number(by.mana || 0));
  const s = Math.round(Number(by.stamina || 0));
  const tot = h + m + s;
  if (tot <= 0) return null;

  return item('🔮', 'Escrow carry', `H:${h} · M:${m} · S:${s}`, 'neutral');
}

function buildFeed(vm, gw) {
  const out = [];
  out.push(trendHint(vm));

  const sh = shieldHint(vm);
  if (sh) out.push(sh);

  const ess = essenceHint(vm);
  if (ess) out.push(ess);

  const esc = escrowHint(gw);
  if (esc) out.push(esc);

  return out;
}

export const activityFeature = {
  id: 'activity',
  api: {
    buildFeed
  }
};

export default activityFeature;
