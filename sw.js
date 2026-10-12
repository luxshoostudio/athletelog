// AthleteLog Service Worker: fresh navigations with offline fallback
const CACHE = 'athletelog-v42';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './lib/week-plan.mjs',
  './lib/next-sync.mjs',
  './lib/next-sync-boot.js',
  './lib/usual-breakfast.mjs',
  './vendor/barcode-detector.js',
  './vendor/zxing_reader.wasm',
  'https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap'
];

// Install: pre-cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: wipe old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for navigation so installed PWAs do not get stuck on
// an old index.html; cache-first for versioned/static assets.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for Claude API / Open Food Facts / GitHub
  // API calls stay on the network: Claude, food search, Gist backup, and the
  // athletelog-next sync server (a tailnet host). The service worker must not
  // answer those with a cached page.
  if (url.hostname === 'api.anthropic.com' || url.hostname.includes('openfoodfacts') || url.hostname === 'api.github.com' || url.hostname.endsWith('.ts.net')) {
    return;
  }

  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(cache => cache.put('./index.html', res.clone()));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // App modules are not content-hashed. An installed phone was cache-first
  // on lib/next-sync-boot.js, so it kept the old boot file after index.html
  // updated and never seeded breakfast or painted the header. Prefer the
  // network for lib scripts, and fall back to the cache when offline.
  if (url.origin === self.location.origin && /\/lib\/[^/]+\.m?js$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
