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
  const attr = `data-myfi-style-${key}`;
  const existing = document.querySelector(`link[${attr}]`);
  if (existing) return existing;

  const href = (url instanceof URL) ? url.href : String(url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(attr, '1');
  document.head.appendChild(link);
  return link;
}
