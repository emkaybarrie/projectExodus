let _byKind = null;

async function loadManifest(){
  if (_byKind) return _byKind;
  const url = new URL('./manifest.json', import.meta.url).toString();
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`parts manifest fetch failed (${res.status})`);
  const json = await res.json();

  _byKind = new Map();
  for (const p of (json.parts || [])) {
    if (p?.kind && p?.path) _byKind.set(p.kind, p);
  }
  return _byKind;
}

export async function resolvePart(kind){
  const map = await loadManifest();
  const entry = map.get(kind);
  if (!entry) throw new Error(`resolvePart: "${kind}" not found in parts/manifest.json`);

  const modUrl = new URL(entry.path, import.meta.url).toString();
  const mod = await import(modUrl);
  return mod.default;
}
