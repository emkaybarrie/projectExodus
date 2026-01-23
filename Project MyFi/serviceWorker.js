/* serviceWorker.js — Minimal, safe SW
   - No HTML precache; no navigation interception
   - Network-first caching for static assets (same-origin)
   - No caching of partial/opaque responses
   - Immediate activation on update
*/

const VERSION = 'v3.0';
const RUNTIME_CACHE = `myfi-runtime-${VERSION}`;

/* ---------- Install: activate immediately ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

/* ---------- Activate: clean old caches + take control ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.includes(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Optional: allow app to force-activate */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------- Fetch: static assets only; never intercept documents ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin GETs
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never intercept HTML navigations/documents (incl. callback.html, auth.html, etc.)
  if (req.mode === 'navigate' || req.destination === 'document') {
    // Let the browser load pages normally (fresh + no SW interference)
    return;
  }

  // For static assets, do network-first with safe caching
  if (['script', 'style', 'image', 'font'].includes(req.destination)) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // Default: let the request through (no caching)
  return;
});

/* ---------- Strategy helpers ---------- */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    await safePut(cache, request, fresh);
    return fresh;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Only cache safe responses: 200 + basic (same-origin), not range/partial
async function safePut(cache, request, response) {
  try {
    if (request.method !== 'GET') return;
    if (!response || response.status !== 200) return;
    if (response.type !== 'basic') return;         // avoid opaque/cross-origin
    if (request.headers.has('range')) return;      // avoid partial requests
    await cache.put(request, response.clone());
  } catch (e) {
    // Never break flow due to caching errors
    console.warn('[SW] safePut skipped:', e?.message || e);
  }
}
