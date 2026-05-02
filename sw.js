// AthleteLog Service Worker — Cache-first, offline-ready
const CACHE = 'athletelog-v4';
const ASSETS = [
  '/athlete_log.html',
  '/manifest.json',
  '/icon.svg',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap'
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

// Fetch: cache-first for local, network-first for APIs
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for Claude API / Open Food Facts
  if (url.hostname === 'api.anthropic.com' || url.hostname.includes('openfoodfacts')) {
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful GET responses
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback — return app shell
        if (e.request.destination === 'document') {
          return caches.match('/athlete_log.html');
        }
      });
    })
  );
});
