// js/core/utilities.js

/**
 * Load a CSS file once (idempotent) into <head>.
 * Returns a Promise that resolves when the sheet is loaded (or already present).
 *
 * @param {string} href           URL to the CSS file (relative or absolute).
 * @param {object} [opts]
 * @param {string} [opts.id]      Optional id for the <link> (helps debugging/dedup).
 * @param {string} [opts.media]   Optional media query, e.g. "(max-width: 640px)".
 * @param {string} [opts.nonce]   CSP nonce value (if your site uses CSP nonces).
 * @param {string} [opts.integrity] SRI hash, if you use Subresource Integrity.
 * @param {boolean}[opts.preload] If true, preloads first for perf.
 * @param {boolean}[opts.blocking] If true, sets `blocking="render"` (Chromium).
 * @returns {Promise<void>}
 */
export function loadCSS(href, opts = {}) {
  const {
    id,
    media,
    nonce,
    integrity,
    preload = false,
    blocking = false,
  } = opts;

  // Normalize to absolute to make dedupe robust
  const absHref = new URL(href, document.baseURI).href;

  // Already present?
  const existing = [...document.styleSheets].find(s => s.href === absHref);
  if (existing) return Promise.resolve();

  // Also check existing <link> tags in case they're not in styleSheets yet
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => new URL(l.href, document.baseURI).href === absHref)) {
    return Promise.resolve();
  }

  // Optional: warm up with <link rel="preload" as="style">
  if (preload && !document.querySelector(`link[rel="preload"][as="style"][href="${absHref}"]`)) {
    const pre = document.createElement('link');
    pre.rel = 'preload';
    pre.as = 'style';
    pre.href = absHref;
    if (nonce) pre.nonce = nonce;
    if (integrity) { pre.integrity = integrity; pre.crossOrigin = 'anonymous'; }
    document.head.appendChild(pre);
  }

  // Create the stylesheet link
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = absHref;
  if (id) link.id = id;
  if (media) link.media = media;
  if (nonce) link.nonce = nonce;
  if (integrity) { link.integrity = integrity; link.crossOrigin = 'anonymous'; }
  if (blocking) link.setAttribute('blocking', 'render'); // Chromium hint

  document.head.appendChild(link);

  return new Promise((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Failed to load CSS: ${absHref}`)), { once: true });
  });
}

/**
 * Unload a previously loaded CSS file (by href or id).
 * @param {string} ref  Either the href (any form) or the element id.
 */
export function unloadCSS(ref) {
  // Try id first
  const byId = document.getElementById(ref);
  if (byId && byId.tagName === 'LINK' && byId.rel === 'stylesheet') {
    byId.remove(); return true;
  }
  // Try href
  const absHref = new URL(ref, document.baseURI).href;
  const link = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find(l => new URL(l.href, document.baseURI).href === absHref);
  if (link) { link.remove(); return true; }
  return false;
}

/**
 * Attach CSS inside a shadowRoot.
 * Uses Constructable Stylesheets when available for best performance;
 * falls back to a <link> inside the shadow root otherwise.
 *
 * @param {ShadowRoot} shadowRoot
 * @param {string} href
 * @returns {Promise<void>}
 */
export async function adoptCss(shadowRoot, href) {
  const absHref = new URL(href, document.baseURI).href;

  // If Constructable Stylesheets are supported:
  if ('adoptedStyleSheets' in Document.prototype && 'replace' in CSSStyleSheet.prototype) {
    // Avoid duplicate adoption
    const already = shadowRoot.adoptedStyleSheets
      .some(sheet => sheet.__href === absHref);
    if (already) return;

    const cssText = await fetch(absHref, { cache: 'force-cache' }).then(r => {
      if (!r.ok) throw new Error(`Failed to fetch CSS for shadow: ${absHref}`);
      return r.text();
    });
    const sheet = new CSSStyleSheet();
    await sheet.replace(cssText);
    // Tag sheet for future dedupe checks
    sheet.__href = absHref;
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
    return;
  }

  // Fallback: link inside shadow
  if ([...shadowRoot.querySelectorAll('link[rel="stylesheet"]')].some(l => new URL(l.href, document.baseURI).href === absHref)) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = absHref;
  shadowRoot.appendChild(link);
  await new Promise((res, rej) => {
    link.onload = () => res();
    link.onerror = () => rej(new Error(`Failed to load shadow CSS: ${absHref}`));
  });
}
