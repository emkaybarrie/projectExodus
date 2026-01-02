export function createHub2Store(){
  let vm = null;
  let gatewayDoc = null;
  const listeners = new Set();

  function emit(){
    for (const fn of listeners) {
      try { fn({ vm, gatewayDoc }); } catch {}
    }
  }

  return {
    subscribe(fn){
      listeners.add(fn);
      try { fn({ vm, gatewayDoc }); } catch {}
      return () => listeners.delete(fn);
    },
    getVM(){ return vm; },
    getGatewayDoc(){ return gatewayDoc; },
    setVM(next){ vm = next; emit(); },
    setGatewayDoc(next){ gatewayDoc = next; emit(); },
    destroy(){ listeners.clear(); vm = null; gatewayDoc = null; }
  };
}
