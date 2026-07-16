/**
 * Random Walk — Service Worker v2.0
 * Cache-first for assets, network-first for navigation.
 * Compatible with GitHub Pages (project subpath).
 */

const CACHE_NAME  = 'rw-v4';
const STATIC_URLS = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/js/main.js',
  './assets/js/config.js',
  './assets/js/storage.js',
  './assets/js/geo.js',
  './assets/js/route.js',
  './assets/js/map.js',
  './assets/js/challenges.js',
  './assets/js/gamification.js',
  './assets/js/share.js',
  './assets/js/ui.js',
  './assets/icon.svg',
  './manifest.webmanifest',
  './404.html',
  './privacy.html',
  './about.html',
  './guides/walking-challenges.html',
  './guides/daily-walk-ideas.html',
  './guides/how-random-walks-work.html',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET, cross-origin (tiles, APIs, fonts), and chrome-extension
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return; // let CDN requests pass through

  // For HTML navigation: network-first (always get fresh page), fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For JS/CSS/fonts: cache-first
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(response => {
        // Cache new same-origin assets dynamically
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      }))
      .catch(() => {
        // Offline fallback for navigation
        if (e.request.destination === 'document') return caches.match('./404.html');
      })
  );
});
