// src/core/view.js
// Minimal shared HTML loader/injector with caching + sanitization.

const htmlCache = new Map(); // href -> raw HTML string

/** Fetches and caches an HTML file as text */
export async function loadHTML(urlLike) {
  // urlLike can be a URL object or a string
  const href = (typeof urlLike === 'string') ? urlLike : urlLike.toString();
  if (htmlCache.has(href)) return htmlCache.get(href);

  const res = await fetch(href, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`loadHTML: failed to fetch ${href} (${res.status})`);

  const text = await res.text();
  htmlCache.set(href, text);
  return text;
}

/** Sanitizes HTML string by removing scripts and inline event attributes. */
export function sanitizeHTML(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');

  // Remove <script> tags entirely
  doc.querySelectorAll('script').forEach(n => n.remove());

  // Remove inline event handlers (on*)
  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
  });

  return doc;
}

/**
 * Extracts a fragment from a parsed Document:
 * - selector: optional CSS selector to extract a portion of the HTML
 * - returns string (innerHTML of the fragment or body)
 */
export function extractFragment(doc, selector) {
  if (selector) {
    const el = doc.querySelector(selector);
    if (!el) throw new Error(`extractFragment: selector "${selector}" not found`);
    return el.innerHTML;
  }
  return doc.body ? doc.body.innerHTML : '';
}

/**
 * Injects a view HTML into a root element.
 * - root: DOM node where to inject
 * - urlLike: URL string or URL object (e.g. new URL('./view.html', import.meta.url))
 * - options:
 *    - selector?: CSS selector string to extract a subfragment
 *    - mode?: 'replace' | 'append'  (default 'replace')
 */
export async function injectView(root, urlLike, { selector, mode = 'replace' } = {}) {
  if (!(root instanceof Element)) throw new Error('injectView: root must be a DOM Element');

  const raw = await loadHTML(urlLike);
  const doc = sanitizeHTML(raw);
  const html = extractFragment(doc, selector);

  if (mode === 'append') {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    root.appendChild(tpl.content);
  } else {
    root.innerHTML = html;
  }
}

/** Prefetch and cache a view (call at app boot if desired). */
export async function prefetchView(urlLike) {
  try { await loadHTML(urlLike); } catch (err) { /* ignore */ }
}
