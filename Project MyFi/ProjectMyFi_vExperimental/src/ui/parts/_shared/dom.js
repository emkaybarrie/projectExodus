export function qs(el, sel) { return el?.querySelector(sel); }
export function qsa(el, sel) { return Array.from(el?.querySelectorAll(sel) || []); }

export function on(el, ev, fn, opts) {
  el.addEventListener(ev, fn, opts);
  return () => el.removeEventListener(ev, fn, opts);
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
