async function fetchJSON(url){
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to fetch JSON: ${url} (${res.status})`);
  return res.json();
}

function surfaceBase(surfaceId){
  return new URL(`../surfaces/screens/${surfaceId}/`, import.meta.url);
}

export async function loadSurfaceScreen(surfaceId){
  const base = surfaceBase(surfaceId);
  const jsonUrl = new URL('surface.json', base).toString();

  const surface = await fetchJSON(jsonUrl);

  // Attach optional css URLs (these may 404; styleLoader handles that safely)
  surface._css = {
    baseUrl: new URL('styles.css', base).toString(),
    upliftUrl: new URL('uplift.css', base).toString(),
  };

  // Normalise
  surface.id = surface.id || surfaceId;
  surface.type = surface.type || 'screen';

  return surface;
}
