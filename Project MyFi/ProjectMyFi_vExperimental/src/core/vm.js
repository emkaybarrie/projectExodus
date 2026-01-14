// ---FILE: src/core/vm.js
function getByPath(obj, path) {
  if (!path) return obj;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

export function createVM(initialState = {}) {
  let state = structuredClone(initialState);
  const listeners = new Set();

  function isPathAffected(watchedPath, changedPath) {
    // Fires when:
    // - watched path changes
    // - any child path changes
    // - a parent path changes (set("hub", {...}) should notify "hub.vitals" watchers)
    if (!watchedPath) return true;
    if (!changedPath) return true;
    if (changedPath === watchedPath) return true;
    if (changedPath.startsWith(watchedPath + ".")) return true;
    if (watchedPath.startsWith(changedPath + ".")) return true;
    return false;
  }

  function notify(changedPath) {
    for (const fn of listeners) fn(changedPath);
  }

  return {
    get(path) {
      return getByPath(state, path);
    },
    set(path, value) {
      setByPath(state, path, value);
      notify(path);
    },
    watch(path, cb) {
      // Convenience wrapper over subscribe that fires when watched path (or parents/children) change.
      if (typeof cb !== "function") return () => {};

      // Initial call
      cb(getByPath(state, path), path);

      const unsub = this.subscribe((changedPath) => {
        if (isPathAffected(path, changedPath)) {
          cb(getByPath(state, path), changedPath);
        }
      });
      return unsub;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}
