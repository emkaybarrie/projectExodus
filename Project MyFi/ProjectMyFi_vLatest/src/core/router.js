import { mountScreenSurface } from './surfaceRuntime.js';
import * as actionBus from './actionBus.js';

export function createRouter({ hostEl, defaultSurfaceId = 'start', ctx = {} }){
  if (!hostEl) throw new Error('Router requires hostEl');

  let current = null;

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
    if (current?.id === surfaceId) return;

    // C1-FIX: Emit surface:unmounted before unmounting
    if (current?.id) {
      actionBus.emit('surface:unmounted', { surfaceId: current.id });
    }

    try { current?.unmount?.(); } catch(e){ console.warn('unmount failed', e); }
    hostEl.innerHTML = '';

    const api = await mountScreenSurface(surfaceId, hostEl, {
      ...ctx,
      navigate,
      surfaceId,
    });

    current = { id: surfaceId, unmount: api?.unmount };

    // C1-FIX: Emit surface:mounted after mounting
    actionBus.emit('surface:mounted', { surfaceId });
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
