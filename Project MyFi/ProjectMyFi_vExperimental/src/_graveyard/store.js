// fe/store.js
const listeners = new Map();

export function subscribe(event, fn) {
  const arr = listeners.get(event) || [];
  arr.push(fn);
  listeners.set(event, arr);
  return () => listeners.set(event, (listeners.get(event) || []).filter(x => x !== fn));
}

export function emit(event, payload) {
  (listeners.get(event) || []).forEach(fn => fn(payload));
}
