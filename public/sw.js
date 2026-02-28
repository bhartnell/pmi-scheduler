/**
 * PMI EMS Scheduler — Service Worker
 * Strategy:
 *   - Cache-first for static assets (JS, CSS, images, fonts)
 *   - Network-first for API routes (never cache API responses)
 *   - Cache-first with network fallback for app shell HTML pages
 */

const CACHE_VERSION = 'pmi-scheduler-v1';

// Static asset file extensions that benefit from cache-first
const STATIC_EXTENSIONS = ['.js', '.css', '.woff', '.woff2', '.ttf', '.otf', '.ico', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];

// App shell HTML pages to pre-cache on install
const APP_SHELL_URLS = [
  '/',
];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Pre-cache the app shell; failures are non-fatal
      return cache.addAll(APP_SHELL_URLS).catch((err) => {
        console.warn('[SW] App shell pre-cache failed (non-fatal):', err);
      });
    }).then(() => {
      // Activate immediately without waiting for old clients to close
      return self.skipWaiting();
    })
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never cache API routes — always go to the network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Never cache Next.js internals
  if (url.pathname.startsWith('/_next/')) {
    // Static chunks inside _next/static are safe to cache
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request));
    } else {
      event.respondWith(networkOnly(request));
    }
    return;
  }

  // Static file extensions — cache-first
  const ext = url.pathname.substring(url.pathname.lastIndexOf('.'));
  if (STATIC_EXTENSIONS.includes(ext)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML navigation requests — network-first with cache fallback (app shell)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }

  // Everything else — network-first
  event.respondWith(networkFirst(request));
});

// ─── Strategy helpers ─────────────────────────────────────────────────────────

/** Cache-first: serve from cache; on miss, fetch and cache the response */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst: network failed and no cache for', request.url);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** Network-first: try network, fall back to cache */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** Network-first for HTML, with app shell cache fallback */
async function networkFirstWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try the exact URL first, then fall back to the cached root app shell
    const cached = await caches.match(request) || await caches.match('/');
    if (cached) return cached;
    return new Response(
      '<!DOCTYPE html><html><head><title>Offline</title></head><body><p>You are offline. Please check your internet connection and try again.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/** Network-only: never use cache */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
