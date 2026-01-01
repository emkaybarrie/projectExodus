// src/ui/parts/registry.js
// Mobile-safe: isolates which part import fails (case/path/deploy issues)
// so a single missing part doesn't take down the entire screen.

async function tryImport(label, relUrl) {
  const url = new URL(relUrl, import.meta.url).href;
  try {
    const mod = await import(url);
    const part = mod?.default || mod?.part || mod;
    if (!part || !part.id) {
      throw new Error(`Module loaded but no default part export with .id (got: ${Object.keys(mod || {})})`);
    }
    return { ok: true, label, part };
  } catch (e) {
    return {
      ok: false,
      label,
      url,
      error: e?.stack || e?.message || String(e)
    };
  }
}

const results = await Promise.all([
  tryImport('SegmentedTabs', './SegmentedTabs/part.js'),
  tryImport('List',          './List/part.js'),
  tryImport('Button',        './Button/part.js'),
  tryImport('Badge',         './Badge/part.js'),
  tryImport('ProgressBar',   './ProgressBar/part.js'),
  tryImport('QuestItem',     './PreFabs/QuestItem/part.js'),
]);

const partRegistry = {};
const failures = [];

for (const r of results) {
  if (r.ok) partRegistry[r.label] = r.part;
  else failures.push(r);
}

// Expose failures for dev/debug
export const __PART_IMPORT_FAILURES__ = failures;

if (failures.length) {
  // This will show in desktop console, and your controller can also surface it on-screen if needed
  console.warn('[parts.registry] Some parts failed to import:', failures);
}

export { partRegistry };
