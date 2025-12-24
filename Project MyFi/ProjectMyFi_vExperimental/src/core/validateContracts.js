/**
 * Dev-only contract validator.
 * Goal: prevent drift/duplication and keep decentralised development safe.
 *
 * This never throws in production. In dev it logs a readable report.
 */
import { validateScreenShape } from './contracts/screenContract.js';
import { validateFeatureShape } from './contracts/featureContract.js';
import { validateJourneyShape } from './contracts/journeyContract.js';

function isDev() {
  // Simple heuristic: localhost OR explicit flag
  if (window.__MYFI_DEV__ === true) return true;
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function groupLog(title, lines) {
  console.groupCollapsed(title);
  lines.forEach(l => console.log(l));
  console.groupEnd();
}

export async function validateAll({ screens = [], features = [], journeys = [] } = {}) {
  if (!isDev()) return;

  const issues = [];

  // Screens: dynamic import and validate shape
  for (const s of screens) {
    try {
      const mod = await s.loader();
      const res = validateScreenShape(s.id, mod);
      if (!res.ok) issues.push({ type: 'screen', id: s.id, problems: res.problems });
    } catch (e) {
      issues.push({ type: 'screen', id: s.id, problems: [`failed to import: ${e?.message || e}`] });
    }
  }

  // Features: already imported objects
  for (const f of features) {
    const res = validateFeatureShape(f.id, f.feature);
    if (!res.ok) issues.push({ type: 'feature', id: f.id, problems: res.problems });
  }

  // Journeys: imported objects
  for (const j of journeys) {
    const res = validateJourneyShape(j.id, j.journey);
    if (!res.ok) issues.push({ type: 'journey', id: j.id, problems: res.problems });
  }

  if (issues.length === 0) {
    groupLog('✅ MyFi Contracts: all good', [
      `Screens: ${screens.length}`,
      `Features: ${features.length}`,
      `Journeys: ${journeys.length}`
    ]);
    return;
  }

  groupLog('⚠️ MyFi Contracts: issues found', issues.map(i => `[${i.type}] ${i.id}: ${i.problems.join('; ')}`));
}
