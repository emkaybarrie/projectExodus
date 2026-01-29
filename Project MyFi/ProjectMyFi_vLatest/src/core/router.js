import { mountScreenSurface } from './surfaceRuntime.js';
import * as actionBus from './actionBus.js';
import { consumeTransitionDirection, animateTransition } from './screenTransition.js';

export function createRouter({ hostEl, defaultSurfaceId = 'start', ctx = {} }){
  if (!hostEl) throw new Error('Router requires hostEl');

  let current = null;
  let mounting = null; // Track in-progress mount to prevent race conditions

  function getSurfaceIdFromHash(){
    const h = (location.hash || '').replace(/^#/, '').trim();
    return h || defaultSurfaceId;
  }

  async function navigate(surfaceId){
    if (!surfaceId) return;
    if (location.hash.replace(/^#/, '') === surfaceId) {
      await ensureMounted(surfaceId);
      return;
    }
    location.hash = `#${surfaceId}`;
  }

  async function ensureMounted(surfaceId){
    // Already mounted to this surface
    if (current?.id === surfaceId) return;

    // Already mounting this surface (race condition guard)
    if (mounting === surfaceId) return;

    // Set mounting lock
    mounting = surfaceId;

    // Check for pending transition direction
    const transitionDir = consumeTransitionDirection();

    try {
      // C1-FIX: Emit surface:unmounted before unmounting
      if (current?.id) {
        actionBus.emit('surface:unmounted', { surfaceId: current.id });
      }

      if (transitionDir && current?.id) {
        // Animated transition: keep old content for animation
        const oldContent = hostEl.firstElementChild;

        // Create wrapper for new content and add to DOM first (hidden)
        const newWrapper = document.createElement('div');
        newWrapper.className = 'surface-transition-wrapper';
        newWrapper.style.visibility = 'hidden';
        newWrapper.style.position = 'absolute';
        hostEl.appendChild(newWrapper);

        // Mount new surface into wrapper (now in DOM)
        const api = await mountScreenSurface(surfaceId, newWrapper, {
          ...ctx,
          navigate,
          surfaceId,
        });

        // Make visible and perform animated transition
        newWrapper.style.visibility = '';
        newWrapper.style.position = '';
        await animateTransition(hostEl, oldContent, newWrapper, transitionDir);

        // Cleanup old surface after animation
        try { current?.unmount?.(); } catch(e){ console.warn('unmount failed', e); }

        current = { id: surfaceId, unmount: api?.unmount };
      } else {
        // No animation: direct swap
        try { current?.unmount?.(); } catch(e){ console.warn('unmount failed', e); }
        hostEl.innerHTML = '';

        const api = await mountScreenSurface(surfaceId, hostEl, {
          ...ctx,
          navigate,
          surfaceId,
        });

        current = { id: surfaceId, unmount: api?.unmount };
      }

      // C1-FIX: Emit surface:mounted after mounting
      actionBus.emit('surface:mounted', { surfaceId });
    } finally {
      // Clear mounting lock
      mounting = null;
    }
  }

  async function onHashChange(){
    const id = getSurfaceIdFromHash();
    await ensureMounted(id);
  }

  function start(){
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
  }

  return { start, navigate };
}
