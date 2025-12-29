/**
 * Minimal VM Store
 * - Holds current VM
 * - refresh() rebuilds VM via provided builder
 * - subscribe(listener) for screens/surfaces
 */
export function createVMStore({ buildVM }) {
  if (typeof buildVM !== 'function') throw new Error('vmStore requires buildVM()');

  let vm = null;
  const listeners = new Set();
  let inflight = null;

  async function refresh() {
    if (inflight) return inflight;

    inflight = (async () => {
      vm = await buildVM();
      listeners.forEach(fn => {
        try { fn(vm); } catch (e) { console.warn('[vmStore] listener error', e); }
      });
      return vm;
    })();

    try { return await inflight; }
    finally { inflight = null; }
  }

  function getVM() { return vm; }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { refresh, getVM, subscribe };
}
