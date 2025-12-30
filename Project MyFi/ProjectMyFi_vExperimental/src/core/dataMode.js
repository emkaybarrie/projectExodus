/**
 * Data Mode (demo vs real)
 *
 * Global:
 *  - localStorage.MYFI_DATA_MODE = "demo" | "real"
 * Feature override:
 *  - localStorage.MYFI_DATA_<featureId> = "demo" | "real"
 *
 * Optional querystring:
 *  - ?data=demo|real
 *  - ?data_quests=demo|real
 *
 * Precedence:
 *  1) feature query override (?data_<featureId>)
 *  2) global query override (?data)
 *  3) feature localStorage override
 *  4) global localStorage
 *  5) default ("demo")
 */

const VALID = new Set(['demo', 'real']);

function readQS() {
  try { return new URLSearchParams(location.search); }
  catch { return new URLSearchParams(); }
}

function readLS(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function normalizeMode(v) {
  if (!v) return null;
  const s = String(v).toLowerCase().trim();
  return VALID.has(s) ? s : null;
}

export function getGlobalDataMode({ defaultMode = 'demo' } = {}) {
  const qs = readQS();
  const qsMode = normalizeMode(qs.get('data'));
  if (qsMode) return qsMode;

  const lsMode = normalizeMode(readLS('MYFI_DATA_MODE'));
  if (lsMode) return lsMode;

  return normalizeMode(defaultMode) || 'demo';
}

export function getFeatureDataMode(featureId, { defaultMode = 'demo' } = {}) {
  const qs = readQS();

  const qsFeature = normalizeMode(qs.get(`data_${featureId}`));
  if (qsFeature) return qsFeature;

  const qsGlobal = normalizeMode(qs.get('data'));
  if (qsGlobal) return qsGlobal;

  const lsFeature = normalizeMode(readLS(`MYFI_DATA_${featureId}`));
  if (lsFeature) return lsFeature;

  const lsGlobal = normalizeMode(readLS('MYFI_DATA_MODE'));
  if (lsGlobal) return lsGlobal;

  return normalizeMode(defaultMode) || 'demo';
}

// Dev helpers (safe no-ops if localStorage blocked)
export function setGlobalDataMode(mode) {
  const m = normalizeMode(mode);
  if (!m) return false;
  try { localStorage.setItem('MYFI_DATA_MODE', m); return true; }
  catch { return false; }
}

export function setFeatureDataMode(featureId, mode) {
  const m = normalizeMode(mode);
  if (!m) return false;
  try { localStorage.setItem(`MYFI_DATA_${featureId}`, m); return true; }
  catch { return false; }
}
