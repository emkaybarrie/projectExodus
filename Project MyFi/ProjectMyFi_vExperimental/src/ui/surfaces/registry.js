/**
 * Surface registry (V1)
 * Keep trivial: map ID -> fetch JSON.
 */

const loaders = {
  'quests.v1': async () => {
    const url = new URL('./quests.v1.surface.json', import.meta.url);
    const res = await fetch(url, { cache: 'no-store' });
    const ct = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
      throw new Error(`[surface:quests.v1] ${res.status} ${res.statusText} :: ${url.pathname}`);
    }
    if (!ct.includes('json')) {
      const preview = (await res.text()).slice(0, 120).replace(/\s+/g, ' ');
      throw new Error(`[surface:quests.v1] bad content-type "${ct}" :: ${url.pathname} :: "${preview}"`);
    }
    return await res.json();
  }
};


export async function loadSurfaceSpec(surfaceId) {
  const loader = loaders[surfaceId];
  if (!loader) throw new Error(`unknown surfaceId: ${surfaceId}`);
  return loader();
}
