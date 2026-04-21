/**
 * LMS Service Worker - Enhanced caching with aggressive versioning and development mode support.
 * Avoids serving stale data and outdated app after deployments.
 */
const CACHE_VERSION = Date.now();
const CACHE_NAME = `lms-${CACHE_VERSION}`;
const STATIC_CACHE = `lms-static-${CACHE_VERSION}`;
const DEV_CACHE = 'lms-dev';

// Development mode detection
const isDevelopment = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

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

// Cache management utilities
function shouldCacheBust(url) {
  return isDevelopment && (isApiRequest(url) || isNavigationRequest(url));
}

function addToCache(cacheName, request, response) {
  if (response.ok) {
    const clone = response.clone();
    caches.open(cacheName).then(cache => cache.put(request, clone));
  }
}

function clearAllCaches() {
  return caches.keys().then(keys => 
    Promise.all(keys.map(key => caches.delete(key)))
  );
}

function clearStaleCaches() {
  return caches.keys().then(keys => {
    const currentCaches = [CACHE_NAME, STATIC_CACHE, DEV_CACHE];
    return Promise.all(
      keys.map(key => 
        currentCaches.includes(key) ? Promise.resolve() : caches.delete(key)
      )
    );
  });
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      clearStaleCaches(),
      // Clear development cache more frequently
      isDevelopment ? caches.delete(DEV_CACHE) : Promise.resolve()
    ])
  );
  self.clients.claim();
});

// Listen for cache invalidation messages
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (e.data && e.data.type === 'CLEAR_CACHE') {
    e.waitUntil(clearAllCaches().then(() => {
      e.ports[0].postMessage({ type: 'CACHE_CLEARED' });
    }));
  }
  
  if (e.data && e.data.type === 'CLEAR_STALE_CACHE') {
    e.waitUntil(clearStaleCaches().then(() => {
      e.ports[0].postMessage({ type: 'STALE_CACHE_CLEARED' });
    }));
  }
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // API requests - enhanced handling with cache-busting in development
  if (isApiRequest(url)) {
    if (isDevelopment && shouldCacheBust(url)) {
      // Add cache-busting timestamp in development
      const bustUrl = new URL(url);
      bustUrl.searchParams.set('_cb', Date.now());
      const bustRequest = new Request(bustUrl.toString(), {
        method: e.request.method,
        headers: e.request.headers,
        body: e.request.body,
        credentials: e.request.credentials
      });
      e.respondWith(fetch(bustRequest).catch(() => 
        new Response('{"error":"Network error"}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      ));
    } else {
      e.respondWith(fetch(e.request).catch(() => 
        new Response('{"error":"Network error"}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      ));
    }
    return;
  }

  // Navigation requests - network first with development optimizations
  if (e.request.mode === 'navigator' || isNavigationRequest(url)) {
    if (isDevelopment) {
      // Always network-first in development, no fallback to cache
      e.respondWith(fetch(e.request));
    } else {
      // Production: network first with cache fallback
      e.respondWith(
        fetch(e.request)
          .then(r => {
            if (r.ok) {
              addToCache(CACHE_NAME, e.request, r);
              return r;
            }
            return caches.match(e.request);
          })
          .catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
      );
    }
    return;
  }

  // Static assets - cache first with development considerations
  if (isStaticAsset(url)) {
    const cacheName = isDevelopment ? DEV_CACHE : STATIC_CACHE;
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached && !isDevelopment) return cached;
        
        return fetch(e.request).then(res => {
          if (res.ok) {
            addToCache(cacheName, e.request, res);
          }
          return res;
        });
      })
    );
    return;
  }

  // Default: network first with cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) addToCache(CACHE_NAME, e.request, res);
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
