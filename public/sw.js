// ---------------------------------------------------------------------------
// BoredBrain AI - Service Worker
// ---------------------------------------------------------------------------
// Strategy:
//   - Static assets (CSS, JS, fonts, images): Cache-first
//   - API calls: Network-first with cache fallback
//   - Navigation: Network-first with offline fallback page
// ---------------------------------------------------------------------------

const CACHE_NAME = 'boredbrain-v1';
const STATIC_CACHE = 'boredbrain-static-v1';
const API_CACHE = 'boredbrain-api-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/footer-logo.png',
  '/favicon.ico',
];

// ---------------------------------------------------------------------------
// Install - Pre-cache core assets
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// Activate - Clean up old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch handler
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // ---------------------------------------------------------------------------
  // API calls -> Network-first, fall back to cache
  // ---------------------------------------------------------------------------
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Static assets (JS, CSS, fonts, images) -> Cache-first
  // ---------------------------------------------------------------------------
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webp');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Navigation requests -> Network-first with offline fallback
  // ---------------------------------------------------------------------------
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match('/offline').then((offlinePage) => {
              if (offlinePage) return offlinePage;
              // Ultimate fallback: simple offline HTML
              return new Response(
                '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - BoredBrain AI</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#06060a;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:2rem}.container{max-width:400px}h1{font-size:1.5rem;margin-bottom:0.75rem;background:linear-gradient(to right,#f59e0b,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent}p{color:rgba(255,255,255,0.4);line-height:1.6;margin-bottom:1.5rem}button{background:#f59e0b;color:#000;border:none;padding:0.75rem 2rem;border-radius:1rem;font-weight:600;cursor:pointer;font-size:0.875rem}button:hover{background:#fbbf24}</style></head><body><div class="container"><h1>You\'re Offline</h1><p>BoredBrain AI requires an internet connection. Please check your network and try again.</p><button onclick="window.location.reload()">Try Again</button></div></body></html>',
                {
                  status: 200,
                  headers: { 'Content-Type': 'text/html; charset=utf-8' },
                }
              );
            });
          })
        )
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Everything else -> Network with cache fallback
  // ---------------------------------------------------------------------------
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
