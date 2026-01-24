// surfaceRuntime.js — Updated for I1-Hub-Phase1-Scaffold
// Adds: VM data injection, actionBus wiring

import { loadSurfaceScreen } from './surfaceLoader.js';
import { mountSurface } from './surfaceCompositor.js';
import { ensureGlobalCSS } from './styleLoader.js';
import { resolvePart } from '../parts/registry.js';
import * as actionBus from './actionBus.js';

// VM providers by surface ID
const vmProviders = new Map();

/**
 * Register a VM provider for a specific surface.
 * @param {string} surfaceId - Surface ID (e.g., 'hub')
 * @param {function} provider - Function returning VM data object
 */
export function registerVMProvider(surfaceId, provider) {
  vmProviders.set(surfaceId, provider);
}

/**
 * Get VM data for a surface.
 * @param {string} surfaceId
 * @returns {object} VM data keyed by slot ID
 */
function getVMForSurface(surfaceId) {
  const provider = vmProviders.get(surfaceId);
  if (provider) {
    return provider();
  }
  // Default: empty VM (Parts receive empty data objects)
  return {};
}

export async function mountScreenSurface(surfaceId, hostEl, ctx = {}) {
  const surface = await loadSurfaceScreen(surfaceId);

  // Apply chrome config (if chrome exists)
  console.log('[SurfaceRuntime] Mounting surface:', surfaceId);
  console.log('[SurfaceRuntime] ctx.chrome exists:', !!ctx?.chrome);
  console.log('[SurfaceRuntime] surface.chrome config:', surface.chrome);
  if (ctx?.chrome?.apply) {
    ctx.chrome.apply(surface.chrome || {});
  } else {
    console.warn('[SurfaceRuntime] No chrome.apply found in ctx!');
  }

  // Surface CSS (optional; if missing, ignore)
  if (surface._css?.baseUrl) await ensureGlobalCSS(`surface.${surfaceId}.base`, surface._css.baseUrl);
  if (surface._css?.upliftUrl) await ensureGlobalCSS(`surface.${surfaceId}.uplift`, surface._css.upliftUrl);

  // Apply background to the host that contains the surface
  // Use classList.add to preserve existing classes (e.g., chrome__surfaceHost)
  const bgKey = surface.background || 'cosmic';
  hostEl.classList.add('screen-host', `bg-${bgKey}`);

  // Get VM data for this surface
  const vm = getVMForSurface(surfaceId);

  const api = await mountSurface(hostEl, surface, {
    resolvePart,
    ctx,
    vm,
  });

  return {
    unmount() {
      api?.unmount?.();
      // Remove only surface-specific classes, preserve chrome classes
      hostEl.classList.remove('screen-host');
      for (const cls of [...hostEl.classList]) {
        if (cls.startsWith('bg-')) hostEl.classList.remove(cls);
      }
    },
  };
}

// Export actionBus for external access (debugging, Journey runner, etc.)
export { actionBus };
