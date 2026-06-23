const CACHE_NAME = 'sway-cache-v2'; // Bump class version to bust old cache
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force active immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => console.log('SW Cache open warning:', err));
    })
  );
});

self.addEventListener('activate', (e) => {
  self.clients.claim(); // Take control immediately
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Network First strategy (falls back to cache if offline)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Bypass and fetch directly for browser hot-reload, dev scripts, or chrome extension calls
  if (url.origin !== self.location.origin) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        // Cache same-origin valid GET requests
        if (e.request.method === 'GET' && url.origin === self.location.origin) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // offline fallback placeholder if any
        });
      })
  );
});
