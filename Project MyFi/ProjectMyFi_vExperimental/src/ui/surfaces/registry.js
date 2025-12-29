/**
 * Surface registry (V1)
 * Keep trivial: map ID -> fetch JSON.
 */

const loaders = {
  'quests.v1': () => fetch(new URL('./quests.v1.surface.json', import.meta.url)).then(r => r.json())
};

export async function loadSurfaceSpec(surfaceId) {
  const loader = loaders[surfaceId];
  if (!loader) throw new Error(`unknown surfaceId: ${surfaceId}`);
  return loader();
}
