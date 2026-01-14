import { loadSurfaceScreen } from './surfaceLoader.js';
import { mountSurface } from './surfaceCompositor.js';
import { ensureGlobalCSS } from './styleLoader.js';
import { resolvePart } from '../parts/registry.js';

export async function mountScreenSurface(surfaceId, hostEl, ctx = {}){
  const surface = await loadSurfaceScreen(surfaceId);

  // Apply chrome config (if chrome exists)
  if (ctx?.chrome?.apply) {
    ctx.chrome.apply(surface.chrome || {});
  }

  // Surface CSS (optional; if missing, ignore)
  if (surface._css?.baseUrl) await ensureGlobalCSS(`surface.${surfaceId}.base`, surface._css.baseUrl);
  if (surface._css?.upliftUrl) await ensureGlobalCSS(`surface.${surfaceId}.uplift`, surface._css.upliftUrl);

  // Apply background to the host that contains the surface
  const bgKey = surface.background || 'cosmic';
  hostEl.className = `screen-host bg-${bgKey}`;

  const api = await mountSurface(hostEl, surface, {
    resolvePart,
    ctx,
  });

  return {
    unmount(){
      api?.unmount?.();
      hostEl.className = 'screen-host';
    }
  };
}
