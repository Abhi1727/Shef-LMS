/**
 * LMS Service Worker - Network-first for API and HTML, cache static assets.
 * Avoids serving stale data and outdated app after deployments.
 */
const CACHE_NAME = 'lms-v2';
const STATIC_CACHE = 'lms-static-v2';

// Static assets to cache (hashed filenames = safe to cache long)
const STATIC_PATTERNS = [/\.js$/, /\.css$/, /\.woff2?$/, /\.ttf$/, /\.png$/, /\.jpg$/, /\.svg$/, /\.ico$/];

function isApiRequest(url) {
  try {
    return new URL(url).pathname.startsWith('/api');
  } catch { return false; }
}

function isStaticAsset(url) {
  try {
    const path = new URL(url).pathname;
    return STATIC_PATTERNS.some(r => r.test(path)) && path.startsWith('/static/');
  } catch { return false; }
}

function isNavigationRequest(url) {
  try {
    return new URL(url).pathname === '/' || new URL(url).pathname === '/index.html';
  } catch { return false; }
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME && k !== STATIC_CACHE ? caches.delete(k) : Promise.resolve())))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Never cache API - always network
  if (isApiRequest(url)) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"Network error"}', { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Navigation (index.html) - network first, fallback to cache when offline
  if (e.request.mode === 'navigator' || isNavigationRequest(url)) {
    e.respondWith(
      fetch(e.request)
        .then(r => (r.ok ? r : caches.match(e.request)))
        .catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // Static assets - cache first, network fallback
  if (isStaticAsset(url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Default: network first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
