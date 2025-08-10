const CACHE_NAME = "myfi-cache-v1";

const FILES_TO_CACHE = [
  './',                        // root
  './manifest.json',
  './auth.html',
  './dashboard.html',
  './vitals_v8.css',
  './css/global/forms.css',
  './js/core/auth.js',
  './js/dashboard.js',
  './js/hud/modules/vitals.js',
  './js/hud/hud.js',
  './assets/img/avatarExample2.png',
  './assets/img/stars-bg.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  // add more assets as needed
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch(err => {
        console.error("❌ Cache addAll failed:", err);
      })
  );
});

