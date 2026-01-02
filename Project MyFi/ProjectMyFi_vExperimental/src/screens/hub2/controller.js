import { loadScopedCSS } from '../../core/cssScope.js';
import { loadJSON, mountSurface } from '../../core/surface.js';
import { resolvePart } from '../../ui/registry.js';

import { getFeature } from '../../features/registry.js';

import { createHub2Store } from './model/store.js';

export function createController(){
  const gateway = getFeature('gateway').api;
  const vitals  = getFeature('vitals').api;

  const store = createHub2Store();
  let unstyle = null;
  let unmountSurfaceFn = null;
  let unwatch = null;

  async function refreshAndRender(mode='core'){
    const doc = await gateway.refreshAndGet();
    store.setGatewayDoc(doc);
    const vm = await vitals.buildHUDModel(doc, mode);
    store.setVM(vm);
  }

  async function mount(root, ctx={}){
    root.classList.add('hub2-screen');

    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

    const surfaceUrl = new URL('./surface.json', import.meta.url);
    const surface = await loadJSON(surfaceUrl);
    const mounted = await mountSurface(root, surface, {
      resolvePart,
      ctx: { ...ctx, hub2: { store } }
    });
    unmountSurfaceFn = () => mounted?.unmount?.();

    // Initial render
    await refreshAndRender('core');

    // Watch for gateway updates (safe, scoped)
    try {
      unwatch = await gateway.watch(async (doc) => {
        store.setGatewayDoc(doc);
        const vm = await vitals.buildHUDModel(doc, 'core');
        store.setVM(vm);
      });
    } catch {}
  }

  function onHide(){
    // non-dashboard screen; nothing special
  }

  function unmount(){
    try { unwatch?.(); } catch {}
    unwatch = null;
    try { unmountSurfaceFn?.(); } catch {}
    unmountSurfaceFn = null;
    try { unstyle?.(); } catch {}
    unstyle = null;
    store.destroy();
  }

  return { mount, onHide, unmount, store };
}
