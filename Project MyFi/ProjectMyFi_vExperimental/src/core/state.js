// tiny global store for auth/user/session
const listeners = new Set();
let state = { user: null };

export function getState() { return state; }
export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn(state));
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
