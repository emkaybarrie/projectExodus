// /serviceWorker.js
const VERSION = 'v1.4';
const DEV_MODE = /^(localhost|127\.0\.0\.1)$/.test(self.location.hostname);
const APP_SHELL_CACHE = `myfi-shell-${VERSION}`;
const RUNTIME_CACHE   = `myfi-runtime-${VERSION}`;
const IMAGE_CACHE     = `myfi-images-${VERSION}`;

// Absolute paths from the origin, since SW is at /
const APP_SHELL = [
  '/',                         // if your root serves start or a landing
  '/manifest.json',
  '/start.html',
  '/dashboard.html',
  // CSS (core only)
  '/css/vitals.css',
  '/css/global/forms.css',
  // JS (core only)
  '/js/dashboard.js',
  '/js/hud/hud.js',
  '/js/hud/modules/vitals.js',
  '/js/core/auth.js',
  // Icons referenced by manifest
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  // Small, frequently-visible image (optional)
  '/assets/img/stars-bg.png',
];

// ---- Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('❌ addAll failed:', err))
  );
});

// ---- Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const keep = new Set([APP_SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE]);
    await Promise.all(
      keys.filter(k => !keep.has(k)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Optional: navigation preload can speed SSR apps
// self.addEventListener('activate', (e)=>{ if (self.registration.navigationPreload) self.registration.navigationPreload.enable(); });
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- Fetch handler with sensible defaults
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // We only handle GET requests
  if (req.method !== 'GET') return;

  // Same-origin only; let the browser handle cross-origin
  if (url.origin !== self.location.origin) {
    // You could add runtime caching for fonts here if you want.
    return;
  }

  // 1) Handle navigations (HTML): keep network-first (good for dev & prod)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        // Try the network first (fresh content)
        const fresh = await fetch(req);
        return fresh;
      } catch {
        // Offline fallback: serve a pre-cached shell page
        // Prefer dashboard if your app expects auth, else start.html
        return await caches.match('/dashboard.html') ||
               await caches.match('/start.html') ||
               new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

 // 2) Scripts/styles: stale-while-revalidate so code updates land quickly
   //    DEV → network-first (see changes on first reload)
  //    PROD → stale-while-revalidate (fast, then quietly refresh)
  if (['script', 'style'].includes(req.destination)) {
    if (DEV_MODE) {
      event.respondWith(networkFirst(req, RUNTIME_CACHE));
    } else {
      event.respondWith(networkFirst(req, RUNTIME_CACHE));
      // event.respondWith(staleWhileRevalidateWithLimit(req, RUNTIME_CACHE, 80));
    }
    return;
  }
  // Fonts: cache-first is fine
  if (req.destination === 'font') {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // 3) Images: stale-while-revalidate with a small cache
  if (req.destination === 'image') {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    // event.respondWith(staleWhileRevalidateWithLimit(req, IMAGE_CACHE, 60));
    return;
  }

  // 4) Default: network-first with cache fallback
  event.respondWith(networkFirst(req, RUNTIME_CACHE));
});

// ---- Strategies ----
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  cache.put(request, fresh.clone());
  return fresh;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Network failed and no cache.');
  }
}

async function staleWhileRevalidateWithLimit(request, cacheName, maxEntries = 60) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      enforceCacheLimit(cache, maxEntries);
      return response;
    })
    .catch(() => null);
  return cached || fetchPromise || fetch(request);
}

async function enforceCacheLimit(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Evict oldest entries first
  const toDelete = keys.length - maxEntries;
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(keys[i]);
  }
}
