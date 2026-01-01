// src/core/styleLoader.js
// Tiny global CSS loader with "load-once" semantics.
//
// We use this for per-part uplift styles so parts stay portable:
// - baseline look: tokens.css + base.css (loaded globally)
// - uplift look: part-owned uplift.css (loaded once when part is first used)

/**
 * Ensure a global stylesheet is loaded exactly once.
 *
 * @param {string} key Unique id for the stylesheet.
 * @param {string|URL} url Stylesheet URL.
 */
export function ensureGlobalCSS(key, url) {
  // NOTE: Do NOT bake `key` into the *attribute name*.
  // Keys may contain characters (e.g. dots) that produce invalid CSS selectors.
  // Instead, store the key as the attribute *value* and query by value.
  const esc = (window.CSS && typeof window.CSS.escape === 'function')
    ? window.CSS.escape(String(key))
    : String(key).replace(/[^a-zA-Z0-9_-]/g, '\\$&');

  const existing = document.querySelector(`link[data-myfi-style="${esc}"]`);
  if (existing) return existing;

  const href = (url instanceof URL) ? url.href : String(url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-myfi-style', String(key));
  document.head.appendChild(link);
  return link;
}
